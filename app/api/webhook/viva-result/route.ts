import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

const STUDENT_DATA_SHEET_ID = "1dPderiJxJl534xNnzHVVqye9VSx3zZY3ZEgO3vjqpFY";

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
    { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken! } }
  );
  
  const data = await response.json();
  return data.items?.[0]?.settings?.access_token;
}

async function appendToSheet(result: any) {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.error("No access token for Google Sheets");
      return false;
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    const timestamp = new Date().toISOString();
    const values = [[
      timestamp,
      result.studentName || '',
      result.studentEmail || '',
      result.subject || '',
      result.topics || '',
      result.questionsAnswered?.toString() || '0',
      result.score?.toString() || '0',
      result.overallFeedback || '',
      result.transcript || '',
      result.recordingUrl || '',
      result.evaluation ? JSON.stringify(result.evaluation) : ''
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: "'Viva Results'!A:K",
      valueInputOption: 'RAW',
      requestBody: { values }
    });

    return true;
  } catch (error) {
    console.error("Error appending to Google Sheets:", error);
    return false;
  }
}

async function getTeacherEmailForSubject(subjectName: string): Promise<string> {
  try {
    const result = await pool.query(
      'SELECT teacher_email FROM subjects WHERE LOWER(name) = LOWER($1) LIMIT 1',
      [subjectName]
    );
    return result.rows[0]?.teacher_email || '';
  } catch {
    return '';
  }
}

async function saveToDatabase(result: any) {
  try {
    const timestamp = new Date();
    const evaluation = result.evaluation ? JSON.stringify(result.evaluation) : null;
    
    // Look up teacher email based on subject
    const teacherEmail = await getTeacherEmailForSubject(result.subject || '');

    await pool.query(
      `INSERT INTO viva_results 
       (timestamp, student_name, student_email, subject, topics, questions_answered, score, overall_feedback, transcript, recording_url, evaluation, teacher_email) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        timestamp,
        result.studentName || 'Unknown',
        result.studentEmail || '',
        result.subject || 'Unknown Subject',
        result.topics || '',
        parseInt(result.questionsAnswered) || 0,
        parseInt(result.score) || 0,
        result.overallFeedback || '',
        result.transcript || '',
        result.recordingUrl || null,
        evaluation,
        teacherEmail
      ]
    );

    return true;
  } catch (error) {
    console.error("Error saving to database:", error);
    return false;
  }
}

function parseSystemPrompt(messages: any[]): { studentName?: string; subject?: string; topics?: string } {
  const systemMsg = messages?.find((m: any) => m.role === 'system');
  if (!systemMsg?.message) return {};
  
  const content = systemMsg.message;
  const result: { studentName?: string; subject?: string; topics?: string } = {};
  
  const nameMatch = content.match(/Name:\s*([^\n]+)/i);
  if (nameMatch) result.studentName = nameMatch[1].trim();
  
  const subjectMatch = content.match(/Subject:\s*([^\n]+)/i);
  if (subjectMatch) result.subject = subjectMatch[1].trim();
  
  const topicsMatch = content.match(/Topics?:\s*([^\n]+)/i);
  if (topicsMatch) result.topics = topicsMatch[1].trim();
  
  return result;
}

function normalizeVivaResult(payload: any): any {
  // Check if this is a VAPI webhook payload (has 'message' with 'type' and 'call')
  if (payload.message?.type === 'end-of-call-report' && payload.message?.call) {
    const call = payload.message.call;
    const structuredData = call.analysis?.structuredData || {};
    const parsedPrompt = parseSystemPrompt(call.messages || []);
    
    return {
      studentName: structuredData.studentName || parsedPrompt.studentName || call.customer?.name || 'Unknown Student',
      studentEmail: structuredData.studentEmail || structuredData.email || '',
      subject: structuredData.subject || parsedPrompt.subject || call.assistant?.name || 'Unknown Subject',
      topics: structuredData.topics || structuredData.topic || parsedPrompt.topics || '',
      questionsAnswered: structuredData.questionsAnswered || structuredData.totalQuestions || 0,
      score: structuredData.score || structuredData.totalMarks || structuredData.percentage || 0,
      overallFeedback: structuredData.overallFeedback || structuredData.feedback || call.analysis?.summary || '',
      transcript: call.artifact?.transcript || call.transcript || '',
      recordingUrl: call.artifact?.recordingUrl || call.recordingUrl || '',
      evaluation: structuredData.evaluation || (structuredData.marks ? { marks: structuredData.marks, feedback: structuredData.feedback } : null),
      vapiCallId: call.id
    };
  }
  
  // Check if this is a direct VAPI call object (has 'id', 'status', 'createdAt')
  if (payload.id && payload.status && payload.createdAt) {
    const structuredData = payload.analysis?.structuredData || {};
    const parsedPrompt = parseSystemPrompt(payload.messages || []);
    
    return {
      studentName: structuredData.studentName || parsedPrompt.studentName || payload.customer?.name || 'Unknown Student',
      studentEmail: structuredData.studentEmail || structuredData.email || '',
      subject: structuredData.subject || parsedPrompt.subject || payload.assistant?.name || 'Unknown Subject',
      topics: structuredData.topics || structuredData.topic || parsedPrompt.topics || '',
      questionsAnswered: structuredData.questionsAnswered || structuredData.totalQuestions || 0,
      score: structuredData.score || structuredData.totalMarks || structuredData.percentage || 0,
      overallFeedback: structuredData.overallFeedback || structuredData.feedback || payload.analysis?.summary || '',
      transcript: payload.artifact?.transcript || payload.transcript || '',
      recordingUrl: payload.artifact?.recordingUrl || payload.recordingUrl || '',
      evaluation: structuredData.evaluation || (structuredData.marks ? { marks: structuredData.marks, feedback: structuredData.feedback } : null),
      vapiCallId: payload.id
    };
  }
  
  // Already in expected format (from student app)
  return payload;
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const messageType = payload.message?.type;
    
    // Log incoming webhook for debugging
    console.log("[Webhook] Received payload type:", 
      messageType || (payload.id ? 'vapi-call' : 'direct'));
    
    // IMPORTANT: Only process valid event types that contain actual viva data
    // Ignore intermediate VAPI events that don't have student/subject info
    const ignoredEventTypes = [
      'speech-update',
      'conversation-update', 
      'user-interrupted',
      'status-update',
      'hang',
      'tool-calls',
      'transfer-destination-request',
      'voice-input'
    ];
    
    if (messageType && ignoredEventTypes.includes(messageType)) {
      // Acknowledge the webhook but don't save anything
      console.log(`[Webhook] Ignoring intermediate event: ${messageType}`);
      return NextResponse.json({ 
        success: true, 
        message: `Acknowledged ${messageType} event (not saved)` 
      });
    }
    
    // Only process: end-of-call-report, direct VAPI calls, or student app submissions
    const isEndOfCallReport = messageType === 'end-of-call-report';
    const isVapiCall = payload.id && payload.status && payload.createdAt;
    const isStudentAppSubmission = payload.studentName && !messageType && !payload.id;
    
    if (!isEndOfCallReport && !isVapiCall && !isStudentAppSubmission) {
      console.log(`[Webhook] Unknown event type, ignoring:`, messageType || 'unknown');
      return NextResponse.json({ 
        success: true, 
        message: 'Unknown event type (not saved)' 
      });
    }
    
    // Normalize the payload to expected format
    const result = normalizeVivaResult(payload);

    // Don't save if no valid student name
    if (!result.studentName || result.studentName === 'Unknown Student') {
      console.log("[Webhook] No valid student name, skipping save");
      return NextResponse.json({ 
        success: true, 
        message: 'No student name found (not saved)' 
      });
    }

    const [dbSuccess, sheetSuccess] = await Promise.all([
      saveToDatabase(result),
      appendToSheet(result)
    ]);

    console.log("[Webhook] Saved:", { 
      studentName: result.studentName, 
      subject: result.subject,
      score: result.score,
      questionsAnswered: result.questionsAnswered,
      dbSuccess, 
      sheetSuccess 
    });

    return NextResponse.json({
      success: true,
      savedToDatabase: dbSuccess,
      savedToSheet: sheetSuccess,
      message: `Result saved${dbSuccess ? ' to database' : ''}${dbSuccess && sheetSuccess ? ' and' : ''}${sheetSuccess ? ' to Google Sheets' : ''}`,
      parsed: {
        studentName: result.studentName,
        subject: result.subject,
        score: result.score,
        questionsAnswered: result.questionsAnswered
      }
    });
  } catch (error) {
    console.error("[Webhook] Error processing viva result:", error);
    return NextResponse.json(
      { error: "Failed to process viva result" },
      { status: 500 }
    );
  }
}
