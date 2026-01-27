import { Pool } from 'pg';

const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const VAPI_API_URL = 'https://api.vapi.ai';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface VapiCall {
  id: string;
  createdAt: string;
  endedAt?: string;
  type: string;
  status: string;
  assistant?: {
    name?: string;
  };
  customer?: {
    name?: string;
    number?: string;
  };
  analysis?: {
    summary?: string;
    structuredData?: any;
  };
  artifact?: {
    transcript?: string;
    recordingUrl?: string;
    messages?: any[];
  };
  costBreakdown?: any;
}

async function fetchVapiCalls(): Promise<VapiCall[]> {
  const apiKey = process.env.VAPI_API_KEY;
  if (!apiKey) {
    console.log('  VAPI_API_KEY not set');
    return [];
  }

  const allCalls: VapiCall[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`${VAPI_API_URL}/call?limit=100&page=${page}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`  VAPI API error: ${response.status} ${response.statusText}`);
      return allCalls;
    }

    const calls: VapiCall[] = await response.json();
    
    if (calls.length === 0) {
      hasMore = false;
    } else {
      allCalls.push(...calls);
      page++;
      if (calls.length < 100) {
        hasMore = false;
      }
    }
  }

  return allCalls;
}

function extractVivaData(call: VapiCall) {
  const structuredData = call.analysis?.structuredData || {};
  
  const studentName = structuredData.studentName || 
                      call.customer?.name || 
                      'Unknown Student';
  
  const studentEmail = structuredData.studentEmail || 
                       structuredData.email || 
                       '';
  
  const subject = structuredData.subject || 
                  call.assistant?.name || 
                  'Unknown Subject';
  
  const topics = structuredData.topics || 
                 structuredData.topic || 
                 '';
  
  const questionsAnswered = structuredData.questionsAnswered || 
                            structuredData.totalQuestions || 
                            0;
  
  const score = structuredData.score || 
                structuredData.totalMarks || 
                structuredData.marks || 
                0;
  
  const overallFeedback = structuredData.overallFeedback || 
                          structuredData.feedback || 
                          call.analysis?.summary || 
                          '';
  
  const transcript = call.artifact?.transcript || '';
  const recordingUrl = call.artifact?.recordingUrl || '';
  
  const evaluation = structuredData.evaluation || 
                     structuredData.marks ? { marks: structuredData.marks, feedback: structuredData.feedback } : 
                     null;

  return {
    timestamp: new Date(call.createdAt),
    studentName,
    studentEmail,
    subject,
    topics: typeof topics === 'string' ? topics : JSON.stringify(topics),
    questionsAnswered: typeof questionsAnswered === 'number' ? questionsAnswered : parseInt(questionsAnswered) || 0,
    score: typeof score === 'number' ? score : parseInt(score) || 0,
    overallFeedback,
    transcript,
    recordingUrl,
    evaluation,
    vapiCallId: call.id
  };
}

async function syncFromVapi() {
  const startTime = new Date();
  console.log(`[${startTime.toISOString()}] Starting VAPI sync...`);
  
  try {
    const calls = await fetchVapiCalls();
    console.log(`  Fetched ${calls.length} calls from VAPI`);
    
    if (calls.length === 0) {
      console.log('  No calls to sync');
      return;
    }

    let synced = 0;
    let updated = 0;
    let skipped = 0;

    for (const call of calls) {
      if (call.status !== 'ended') {
        skipped++;
        continue;
      }

      const data = extractVivaData(call);
      
      const existing = await pool.query(
        'SELECT id FROM viva_results WHERE vapi_call_id = $1',
        [data.vapiCallId]
      );

      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE viva_results SET 
           timestamp = $1, student_name = $2, student_email = $3, subject = $4, 
           topics = $5, questions_answered = $6, score = $7, overall_feedback = $8, 
           transcript = $9, recording_url = $10, evaluation = $11
           WHERE vapi_call_id = $12`,
          [
            data.timestamp,
            data.studentName,
            data.studentEmail,
            data.subject,
            data.topics,
            data.questionsAnswered,
            data.score,
            data.overallFeedback,
            data.transcript,
            data.recordingUrl,
            data.evaluation ? JSON.stringify(data.evaluation) : null,
            data.vapiCallId
          ]
        );
        updated++;
      } else {
        await pool.query(
          `INSERT INTO viva_results 
           (timestamp, student_name, student_email, subject, topics, questions_answered, 
            score, overall_feedback, transcript, recording_url, evaluation, vapi_call_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            data.timestamp,
            data.studentName,
            data.studentEmail,
            data.subject,
            data.topics,
            data.questionsAnswered,
            data.score,
            data.overallFeedback,
            data.transcript,
            data.recordingUrl,
            data.evaluation ? JSON.stringify(data.evaluation) : null,
            data.vapiCallId
          ]
        );
        synced++;
      }
    }

    console.log(`  New: ${synced}, Updated: ${updated}, Skipped: ${skipped}`);
  } catch (error: any) {
    console.error(`  Error: ${error.message}`);
  }
}

async function addVapiCallIdColumn() {
  try {
    await pool.query(`
      ALTER TABLE viva_results 
      ADD COLUMN IF NOT EXISTS vapi_call_id VARCHAR(255) UNIQUE
    `);
    console.log('  Added vapi_call_id column');
  } catch (error: any) {
    if (!error.message.includes('already exists')) {
      console.error('  Error adding column:', error.message);
    }
  }
}

async function main() {
  console.log('Auto-sync started. Syncing from VAPI every 5 minutes...');
  
  await addVapiCallIdColumn();
  await syncFromVapi();
  
  setInterval(syncFromVapi, SYNC_INTERVAL_MS);
}

main().catch(console.error);
