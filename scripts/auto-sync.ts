import { Pool } from 'pg';
import { google } from 'googleapis';
import OpenAI from 'openai';
import { readFileSync } from 'fs';

const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const VAPI_API_URL = 'https://api.vapi.ai';
const STUDENT_DATA_SHEET_ID = '1dPderiJxJl534xNnzHVVqye9VSx3zZY3ZEgO3vjqpFY';

function getDatabaseUrl(): string {
  try {
    const url = readFileSync('/tmp/replitdb', 'utf-8').trim();
    if (url) return url;
  } catch {}
  return process.env.DATABASE_URL || '';
}

const pool = new Pool({ connectionString: getDatabaseUrl() });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// AI-powered evaluation function
async function generateAIEvaluation(transcript: string, subject: string, studentName: string): Promise<{
  score: number;
  questionsAnswered: number;
  overallFeedback: string;
  evaluation: any;
  marksBreakdown: any;
} | null> {
  if (!transcript || transcript.length < 50) {
    return null;
  }
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert viva examiner. Analyze the following viva transcript and provide an evaluation. 
The viva is for ${subject} with student ${studentName}.

Evaluate based on:
1. Knowledge accuracy and depth
2. Clarity of explanations
3. Ability to answer follow-up questions
4. Overall understanding of the topic

IMPORTANT: Extract each question asked and the student's answer, then assign marks to each.

Respond in JSON format only:
{
  "score": <number 0-100>,
  "questionsAnswered": <number of questions the student answered>,
  "overallFeedback": "<2-3 sentence summary of performance>",
  "evaluation": {
    "knowledge": <score 0-100>,
    "clarity": <score 0-100>,
    "depth": <score 0-100>,
    "strengths": ["<strength1>", "<strength2>"],
    "improvements": ["<area1>", "<area2>"]
  },
  "marksBreakdown": [
    {
      "questionNumber": 1,
      "question": "<the question asked>",
      "answer": "<student's answer summary>",
      "marks": <marks out of 10>,
      "maxMarks": 10,
      "feedback": "<brief feedback on this answer>"
    }
  ]
}`
        },
        {
          role: 'user',
          content: `Transcript:\n${transcript.substring(0, 8000)}`
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1500
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    
    const result = JSON.parse(content);
    return {
      score: Math.min(100, Math.max(0, parseInt(result.score) || 0)),
      questionsAnswered: parseInt(result.questionsAnswered) || 0,
      overallFeedback: result.overallFeedback || '',
      evaluation: result.evaluation || null,
      marksBreakdown: result.marksBreakdown || null
    };
  } catch (error) {
    console.log(`    -> AI evaluation failed for ${studentName}:`, (error as Error).message);
    return null;
  }
}

async function getGoogleSheetsAccessToken(): Promise<string | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  if (!hostname) {
    console.log('  Google Sheets connector not configured');
    return null;
  }

  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    console.log('  Replit auth token not found');
    return null;
  }

  try {
    const response = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
      { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken } }
    );
    
    const data = await response.json();
    return data.items?.[0]?.settings?.access_token || null;
  } catch (error) {
    console.log('  Failed to get Google Sheets token');
    return null;
  }
}

async function appendToGoogleSheet(data: any): Promise<boolean> {
  try {
    const accessToken = await getGoogleSheetsAccessToken();
    if (!accessToken) return false;

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    // Column order: A=Date&Time, B=StudentName, C=Email, D=Subject, E=Topics, 
    //               F=QuestionsAnswered, G=Score, H=OverallFeedback, I=Transcript, J=Recording, K=Evaluation(JSON)
    const values = [[
      data.timestamp.toISOString(),
      data.studentName,
      data.studentEmail || '',
      data.subject,
      data.topics,
      data.questionsAnswered.toString(),
      data.score.toString(),
      data.overallFeedback || '',
      data.transcript || '',
      data.recordingUrl || '',
      data.evaluation ? JSON.stringify(data.evaluation) : ''
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: "'Viva Results'!A:K",
      valueInputOption: 'RAW',
      requestBody: { values }
    });

    return true;
  } catch (error: any) {
    console.log(`  Sheet append error: ${error.message}`);
    return false;
  }
}

// Update specific cells in Google Sheets (for syncing evaluations back)
// Column order: A=Date&Time, B=StudentName, C=Email, D=Subject, E=Topics, 
//               F=QuestionsAnswered, G=Score, H=OverallFeedback, I=Transcript, J=Recording, K=Evaluation(JSON), L=MarksBreakdown(JSON)
async function updateGoogleSheetRow(rowIndex: number, updates: {
  score?: number;
  questionsAnswered?: number;
  overallFeedback?: string;
  studentEmail?: string;
  evaluation?: any;
  marksBreakdown?: any;
}): Promise<boolean> {
  try {
    const accessToken = await getGoogleSheetsAccessToken();
    if (!accessToken) return false;

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    const updateData: { range: string; values: string[][] }[] = [];
    
    // C=Email, F=QuestionsAnswered, G=Score, H=OverallFeedback, K=Evaluation, L=MarksBreakdown
    if (updates.studentEmail) {
      updateData.push({ range: `'Viva Results'!C${rowIndex}`, values: [[updates.studentEmail]] });
    }
    if (updates.questionsAnswered !== undefined) {
      updateData.push({ range: `'Viva Results'!F${rowIndex}`, values: [[updates.questionsAnswered.toString()]] });
    }
    if (updates.score !== undefined) {
      updateData.push({ range: `'Viva Results'!G${rowIndex}`, values: [[updates.score.toString()]] });
    }
    if (updates.overallFeedback) {
      updateData.push({ range: `'Viva Results'!H${rowIndex}`, values: [[updates.overallFeedback]] });
    }
    if (updates.evaluation) {
      updateData.push({ range: `'Viva Results'!K${rowIndex}`, values: [[JSON.stringify(updates.evaluation)]] });
    }
    if (updates.marksBreakdown) {
      updateData.push({ range: `'Viva Results'!L${rowIndex}`, values: [[JSON.stringify(updates.marksBreakdown)]] });
    }

    if (updateData.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: STUDENT_DATA_SHEET_ID,
        requestBody: {
          valueInputOption: 'RAW',
          data: updateData
        }
      });
      return true;
    }
    return false;
  } catch (error: any) {
    console.log(`  Sheet update error: ${error.message}`);
    return false;
  }
}

// Find existing row in sheets by student name and timestamp, or add a new row
async function findOrAddSheetRow(studentName: string, timestamp: string, subject: string): Promise<number> {
  try {
    const accessToken = await getGoogleSheetsAccessToken();
    if (!accessToken) return 0;

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    // First try to find existing row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: "'Viva Results'!A:K"
    });

    const rows = response.data.values || [];
    
    // Search for matching row (skip header)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowName = (row[1] || '').toLowerCase();
      const rowTimestamp = row[0] || '';
      
      // Match by name and close timestamp (within same minute)
      if (rowName === studentName.toLowerCase()) {
        const rowDate = new Date(rowTimestamp).getTime();
        const targetDate = new Date(timestamp).getTime();
        const timeDiff = Math.abs(rowDate - targetDate);
        
        // If within 5 minutes, consider it the same record
        if (timeDiff < 5 * 60 * 1000) {
          return i + 1; // Sheet rows are 1-indexed
        }
      }
    }

    // If no match found, add a new row
    await sheets.spreadsheets.values.append({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: "'Viva Results'!A:L",
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[
          timestamp,
          studentName,
          '', // email
          subject,
          '', // topics
          '', // questionsAnswered
          '', // score
          '', // overallFeedback
          '', // transcript
          '', // recording
          '', // evaluation
          ''  // marksBreakdown
        ]]
      }
    });

    // Return the new row index
    return rows.length + 1;
  } catch (error: any) {
    console.log(`  Error finding/adding sheet row: ${error.message}`);
    return 0;
  }
}

// Fetch evaluation data from Google Sheets
interface SheetEvaluation {
  studentName: string;
  studentEmail: string;
  subject: string;
  score: number;
  questionsAnswered: number;
  overallFeedback: string;
  evaluation?: any;
  timestamp: string;
  rowIndex: number;
}

let sheetsEvaluationCache: SheetEvaluation[] | null = null;

async function fetchSheetsEvaluations(): Promise<SheetEvaluation[]> {
  if (sheetsEvaluationCache) return sheetsEvaluationCache;
  
  try {
    const accessToken = await getGoogleSheetsAccessToken();
    if (!accessToken) {
      console.log('  No Google Sheets token, skipping sheets sync');
      return [];
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: "'Viva Results'!A2:K",
    });

    const rows = response.data.values || [];
    // Column order: A=Date&Time, B=StudentName, C=Email, D=Subject, E=Topics, 
    //               F=QuestionsAnswered, G=Score, H=OverallFeedback, I=Transcript, J=Recording, K=Evaluation(JSON)
    sheetsEvaluationCache = rows.map((row, index) => ({
      timestamp: row[0] || '',
      studentName: row[1] || '',
      studentEmail: row[2] || '',
      subject: row[3] || '',          // Column D (index 3)
      questionsAnswered: parseInt(row[5]) || 0,  // Column F (index 5)
      score: parseInt(row[6]) || 0,   // Column G (index 6)
      overallFeedback: row[7] || '',  // Column H (index 7)
      evaluation: row[10] ? tryParseJSON(row[10]) : null,  // Column K (index 10)
      rowIndex: index + 2  // Row number in sheet (1-indexed, +1 for header)
    })).filter(r => r.studentName && r.studentName.toLowerCase() !== 'unknown student');

    console.log(`  Loaded ${sheetsEvaluationCache.length} rows from Google Sheets`);
    return sheetsEvaluationCache;
  } catch (error: any) {
    console.log(`  Sheets fetch error: ${error.message}`);
    return [];
  }
}

function tryParseJSON(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function findMatchingSheetEvaluation(studentName: string, subject: string, timestamp: Date): SheetEvaluation | null {
  if (!sheetsEvaluationCache) return null;
  
  const targetTime = timestamp.getTime();
  const tenMinutes = 10 * 60 * 1000;
  
  // Find matching record by student name and subject within time window
  return sheetsEvaluationCache.find(entry => {
    const nameMatch = entry.studentName.toLowerCase().includes(studentName.toLowerCase().split(' ')[0]) ||
                      studentName.toLowerCase().includes(entry.studentName.toLowerCase().split(' ')[0]);
    const subjectMatch = entry.subject.toLowerCase() === subject.toLowerCase();
    const entryTime = new Date(entry.timestamp).getTime();
    const timeMatch = Math.abs(entryTime - targetTime) < tenMinutes;
    
    return nameMatch && subjectMatch && timeMatch;
  }) || null;
}

// Sync emails from database to Google Sheets for rows missing email
async function syncEmailsToSheets() {
  if (!sheetsEvaluationCache) return 0;
  
  let synced = 0;
  try {
    // Get records from database that have emails
    const result = await pool.query(
      `SELECT student_name, student_email, subject, timestamp FROM viva_results 
       WHERE student_email IS NOT NULL AND student_email != ''
       ORDER BY timestamp DESC LIMIT 100`
    );
    
    for (const dbRow of result.rows) {
      // Find matching sheet row that's missing email
      const sheetMatch = sheetsEvaluationCache.find(entry => {
        const nameMatch = entry.studentName.toLowerCase() === dbRow.student_name.toLowerCase();
        const subjectMatch = entry.subject.toLowerCase() === dbRow.subject.toLowerCase();
        const noEmail = !entry.studentEmail || entry.studentEmail === '';
        return nameMatch && subjectMatch && noEmail;
      });
      
      if (sheetMatch && sheetMatch.rowIndex > 0) {
        const updated = await updateGoogleSheetRow(sheetMatch.rowIndex, {
          studentEmail: dbRow.student_email
        });
        if (updated) {
          synced++;
          console.log(`    [Sheets] Synced email for ${dbRow.student_name} to row ${sheetMatch.rowIndex}`);
        }
      }
    }
  } catch (error: any) {
    console.log(`  Error syncing emails to sheets: ${error.message}`);
  }
  
  return synced;
}

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
    console.log('  VAPI_API_KEY (Private Key) not set');
    return [];
  }

  const allCalls: VapiCall[] = [];
  let createdAtLt: string | null = null;
  let hasMore = true;

  while (hasMore) {
    let url = `${VAPI_API_URL}/call?limit=100`;
    if (createdAtLt) {
      url += `&createdAtLt=${encodeURIComponent(createdAtLt)}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const body = await response.text();
      console.log(`  VAPI API error: ${response.status} ${response.statusText}`);
      console.log(`  Response: ${body.substring(0, 200)}`);
      return allCalls;
    }

    const calls: VapiCall[] = await response.json();
    
    if (calls.length === 0) {
      hasMore = false;
    } else {
      allCalls.push(...calls);
      createdAtLt = calls[calls.length - 1].createdAt;
      if (calls.length < 100) {
        hasMore = false;
      }
    }
  }

  return allCalls;
}

function parseSystemPrompt(call: VapiCall): { studentName?: string; studentEmail?: string; subject?: string; topics?: string } {
  // Look for the system message which contains student info
  const messages = (call as any).messages || [];
  const systemMsg = messages.find((m: any) => m.role === 'system');
  
  if (!systemMsg?.message) return {};
  
  const content = systemMsg.message;
  const result: { studentName?: string; studentEmail?: string; subject?: string; topics?: string } = {};
  
  // Parse "Name: Anuj Dicholekar"
  const nameMatch = content.match(/Name:\s*([^\n]+)/i);
  if (nameMatch) result.studentName = nameMatch[1].trim();
  
  // Parse "Email: student@example.com"
  const emailMatch = content.match(/Email:\s*([^\n\s]+@[^\n\s]+)/i);
  if (emailMatch) result.studentEmail = emailMatch[1].trim();
  
  // Parse "Subject: Finance"
  const subjectMatch = content.match(/Subject:\s*([^\n]+)/i);
  if (subjectMatch) result.subject = subjectMatch[1].trim();
  
  // Parse "Topics: Price Action"
  const topicsMatch = content.match(/Topics?:\s*([^\n]+)/i);
  if (topicsMatch) result.topics = topicsMatch[1].trim();
  
  return result;
}

function extractVivaData(call: VapiCall) {
  const structuredData = call.analysis?.structuredData || {};
  const parsedPrompt = parseSystemPrompt(call);
  
  // Priority: structuredData > parsed system prompt > fallbacks
  const studentName = structuredData.studentName || 
                      parsedPrompt.studentName ||
                      call.customer?.name || 
                      'Unknown Student';
  
  const studentEmail = structuredData.studentEmail || 
                       structuredData.email ||
                       parsedPrompt.studentEmail ||
                       (call.customer as any)?.email ||
                       '';
  
  const subject = structuredData.subject || 
                  parsedPrompt.subject ||
                  call.assistant?.name || 
                  'Unknown Subject';
  
  const topics = structuredData.topics || 
                 structuredData.topic || 
                 parsedPrompt.topics ||
                 '';
  
  let questionsAnswered = structuredData.questionsAnswered || 
                          structuredData.totalQuestions || 
                          0;
  
  let score = structuredData.score || 
              structuredData.totalMarks || 
              structuredData.marks || 
              0;
  
  let overallFeedback = structuredData.overallFeedback || 
                        structuredData.feedback || 
                        call.analysis?.summary || 
                        '';
  
  let evaluation = structuredData.evaluation || 
                   (structuredData.marks ? { marks: structuredData.marks, feedback: structuredData.feedback } : null);

  // If no evaluation from VAPI, try Google Sheets fallback
  if (score === 0 && sheetsEvaluationCache) {
    const sheetMatch = findMatchingSheetEvaluation(studentName, subject, new Date(call.createdAt));
    if (sheetMatch) {
      score = sheetMatch.score;
      questionsAnswered = sheetMatch.questionsAnswered || questionsAnswered;
      overallFeedback = sheetMatch.overallFeedback || overallFeedback;
      evaluation = sheetMatch.evaluation || evaluation;
      console.log(`    -> Found evaluation in Sheets: ${score}% for ${studentName}`);
    }
  }
  
  const transcript = call.artifact?.transcript || (call as any).transcript || '';
  const recordingUrl = call.artifact?.recordingUrl || (call as any).recordingUrl || '';

  return {
    timestamp: new Date(call.createdAt),
    studentName,
    studentEmail,
    subject,
    topics: typeof topics === 'string' ? topics : JSON.stringify(topics),
    questionsAnswered: typeof questionsAnswered === 'number' ? questionsAnswered : parseInt(String(questionsAnswered)) || 0,
    score: typeof score === 'number' ? score : parseInt(String(score)) || 0,
    overallFeedback,
    transcript,
    recordingUrl,
    evaluation,
    vapiCallId: call.id,
    needsAIEvaluation: score === 0 && transcript.length > 100
  };
}

async function getTeacherEmailForSubject(subjectName: string): Promise<string> {
  try {
    const result = await pool.query(
      "SELECT teacher_email FROM subjects WHERE LOWER(name) = LOWER($1) AND teacher_email IS NOT NULL AND teacher_email != '' LIMIT 1",
      [subjectName]
    );
    return result.rows[0]?.teacher_email || '';
  } catch {
    return '';
  }
}

async function updateMissingEvaluations() {
  console.log('  Checking for records with missing evaluations...');
  
  try {
    // Get records with score = 0 that have transcripts (we need transcripts for AI evaluation)
    const result = await pool.query(
      `SELECT id, student_name, student_email, subject, timestamp, transcript, vapi_call_id FROM viva_results 
       WHERE (score = 0 OR score IS NULL) 
       AND student_name != 'Unknown Student'
       AND subject != 'Unknown Subject'
       AND subject != 'Transient Assistant'
       ORDER BY timestamp DESC LIMIT 50`
    );
    
    if (result.rows.length === 0) {
      console.log('  No records with missing evaluations');
      return 0;
    }
    
    console.log(`  Found ${result.rows.length} records with missing evaluations`);
    let updatedFromSheets = 0;
    let updatedFromAI = 0;
    let sheetsSynced = 0;
    
    for (const row of result.rows) {
      // First try Google Sheets fallback
      const sheetMatch = findMatchingSheetEvaluation(
        row.student_name, 
        row.subject, 
        new Date(row.timestamp)
      );
      
      if (sheetMatch && sheetMatch.score > 0) {
        // Sync email from Sheets if we have it there but not in DB
        const emailToUse = row.student_email || sheetMatch.studentEmail || '';
        
        await pool.query(
          `UPDATE viva_results SET 
           score = $1, questions_answered = $2, overall_feedback = $3, evaluation = $4, student_email = $5
           WHERE id = $6`,
          [
            sheetMatch.score,
            sheetMatch.questionsAnswered,
            sheetMatch.overallFeedback,
            sheetMatch.evaluation ? JSON.stringify(sheetMatch.evaluation) : null,
            emailToUse,
            row.id
          ]
        );
        console.log(`    [Sheets] Updated ${row.student_name}: ${sheetMatch.score}%`);
        updatedFromSheets++;
        continue;
      }
      
      // If no sheet match and we have a transcript, use AI evaluation
      if (row.transcript && row.transcript.length > 100) {
        const aiEval = await generateAIEvaluation(row.transcript, row.subject, row.student_name);
        
        if (aiEval && aiEval.score > 0) {
          await pool.query(
            `UPDATE viva_results SET 
             score = $1, questions_answered = $2, overall_feedback = $3, evaluation = $4, marks_breakdown = $5
             WHERE id = $6`,
            [
              aiEval.score,
              aiEval.questionsAnswered,
              aiEval.overallFeedback,
              aiEval.evaluation ? JSON.stringify(aiEval.evaluation) : null,
              aiEval.marksBreakdown ? JSON.stringify(aiEval.marksBreakdown) : null,
              row.id
            ]
          );
          console.log(`    [AI] Evaluated ${row.student_name}: ${aiEval.score}%`);
          updatedFromAI++;
          
          // Also sync this AI evaluation to Google Sheets
          if (sheetMatch && sheetMatch.rowIndex > 0) {
            const updated = await updateGoogleSheetRow(sheetMatch.rowIndex, {
              score: aiEval.score,
              questionsAnswered: aiEval.questionsAnswered,
              overallFeedback: aiEval.overallFeedback,
              evaluation: aiEval.evaluation,
              marksBreakdown: aiEval.marksBreakdown
            });
            if (updated) {
              sheetsSynced++;
              console.log(`    [Sheets] Synced evaluation to row ${sheetMatch.rowIndex}`);
            }
          } else {
            // No sheet match - try to find by name and timestamp, or add new row
            const rowIndex = await findOrAddSheetRow(row.student_name, row.timestamp, row.subject);
            if (rowIndex > 0) {
              const updated = await updateGoogleSheetRow(rowIndex, {
                score: aiEval.score,
                questionsAnswered: aiEval.questionsAnswered,
                overallFeedback: aiEval.overallFeedback,
                evaluation: aiEval.evaluation,
                marksBreakdown: aiEval.marksBreakdown
              });
              if (updated) {
                sheetsSynced++;
                console.log(`    [Sheets] Synced evaluation to row ${rowIndex}`);
              }
            }
          }
        }
      }
    }
    
    console.log(`  Updated: ${updatedFromSheets} from Sheets, ${updatedFromAI} from AI, ${sheetsSynced} synced to Sheets`);
    return updatedFromSheets + updatedFromAI;
  } catch (error: any) {
    console.log(`  Error updating missing evaluations: ${error.message}`);
    return 0;
  }
}

async function syncFromVapi() {
  const startTime = new Date();
  console.log(`[${startTime.toISOString()}] Starting VAPI sync...`);
  
  try {
    // Load Google Sheets evaluations first for fallback
    await fetchSheetsEvaluations();
    
    const calls = await fetchVapiCalls();
    console.log(`  Fetched ${calls.length} calls from VAPI`);
    
    if (calls.length === 0) {
      console.log('  No calls to sync');
      return;
    }

    let synced = 0;
    let updated = 0;
    let skipped = 0;
    let sheetsSynced = 0;

    for (const call of calls) {
      if (call.status !== 'ended') {
        skipped++;
        continue;
      }

      const data = extractVivaData(call);
      
      // Skip invalid entries - Unknown Students, Transient Assistants, etc.
      const invalidNames = ['unknown student', 'unknown', 'transient assistant', '', 'test', 'test user'];
      const invalidSubjects = ['transient assistant', 'unknown subject', 'unknown', ''];
      
      if (invalidNames.includes(data.studentName.toLowerCase()) || 
          invalidSubjects.includes(data.subject.toLowerCase())) {
        skipped++;
        continue;
      }
      
      // Look up teacher email based on subject
      const teacherEmail = await getTeacherEmailForSubject(data.subject);
      
      const existing = await pool.query(
        'SELECT id FROM viva_results WHERE vapi_call_id = $1',
        [data.vapiCallId]
      );

      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE viva_results SET 
           timestamp = $1, student_name = $2, student_email = $3, subject = $4, 
           topics = $5, questions_answered = $6, score = $7, overall_feedback = $8, 
           transcript = $9, recording_url = $10, evaluation = $11, teacher_email = $12
           WHERE vapi_call_id = $13`,
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
            teacherEmail,
            data.vapiCallId
          ]
        );
        updated++;
      } else {
        await pool.query(
          `INSERT INTO viva_results 
           (timestamp, student_name, student_email, subject, topics, questions_answered, 
            score, overall_feedback, transcript, recording_url, evaluation, vapi_call_id, teacher_email) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
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
            data.vapiCallId,
            teacherEmail
          ]
        );
        synced++;
        
        const sheetSuccess = await appendToGoogleSheet(data);
        if (sheetSuccess) sheetsSynced++;
      }
    }

    console.log(`  DB - New: ${synced}, Updated: ${updated}, Skipped: ${skipped}`);
    console.log(`  Sheets - Added: ${sheetsSynced}`);
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
  
  // Initial sync
  await syncFromVapi();
  
  // Update records with missing evaluations from Google Sheets
  const updatedCount = await updateMissingEvaluations();
  if (updatedCount > 0) {
    console.log(`  Updated ${updatedCount} records with evaluations`);
  }
  
  // Sync emails from DB to Sheets
  const emailsSynced = await syncEmailsToSheets();
  if (emailsSynced > 0) {
    console.log(`  Synced ${emailsSynced} emails to Google Sheets`);
  }
  
  // Clear cache after initial sync so next run gets fresh data
  sheetsEvaluationCache = null;
  
  setInterval(async () => {
    sheetsEvaluationCache = null; // Clear cache for fresh data
    await syncFromVapi();
    await updateMissingEvaluations();
    await syncEmailsToSheets();
  }, SYNC_INTERVAL_MS);
}

main().catch(console.error);
