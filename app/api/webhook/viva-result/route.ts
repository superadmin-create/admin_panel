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

export async function POST(request: NextRequest) {
  try {
    const result = await request.json();

    if (!result.studentName) {
      return NextResponse.json(
        { error: "Student name is required" },
        { status: 400 }
      );
    }

    const [dbSuccess, sheetSuccess] = await Promise.all([
      saveToDatabase(result),
      appendToSheet(result)
    ]);

    return NextResponse.json({
      success: true,
      savedToDatabase: dbSuccess,
      savedToSheet: sheetSuccess,
      message: `Result saved${dbSuccess ? ' to database' : ''}${dbSuccess && sheetSuccess ? ' and' : ''}${sheetSuccess ? ' to Google Sheets' : ''}`
    });
  } catch (error) {
    console.error("[Webhook] Error processing viva result:", error);
    return NextResponse.json(
      { error: "Failed to process viva result" },
      { status: 500 }
    );
  }
}
