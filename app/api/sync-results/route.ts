import { NextResponse } from "next/server";
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

function parseTimestamp(ts: string): Date {
  if (!ts) return new Date();
  
  if (ts.includes('T') && (ts.includes('Z') || ts.includes('+'))) {
    const date = new Date(ts);
    if (!isNaN(date.getTime())) return date;
  }
  
  const formattedMatch = ts.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (formattedMatch) {
    const [, day, month, year, hour, minute, second, ampm] = formattedMatch;
    const monthMap: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    let hour24 = parseInt(hour, 10);
    if (ampm?.toLowerCase() === 'pm' && hour24 !== 12) hour24 += 12;
    if (ampm?.toLowerCase() === 'am' && hour24 === 12) hour24 = 0;
    return new Date(
      parseInt(year, 10),
      monthMap[month.toLowerCase()],
      parseInt(day, 10),
      hour24,
      parseInt(minute, 10),
      parseInt(second || '0', 10)
    );
  }

  const slashMatch = ts.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slashMatch) {
    const [, p1, p2, year] = slashMatch;
    const fullYear = year.length === 2 ? 2000 + parseInt(year, 10) : parseInt(year, 10);
    return new Date(fullYear, parseInt(p1, 10) - 1, parseInt(p2, 10));
  }

  const parsed = new Date(ts);
  if (!isNaN(parsed.getTime())) return parsed;

  return new Date();
}

export async function POST() {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: "No Google Sheets access" }, { status: 500 });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: "'Viva Results'!A2:K",
    });

    const rows = response.data.values || [];
    
    await pool.query('TRUNCATE TABLE viva_results');
    
    let synced = 0;
    for (const row of rows) {
      if (row[1]) {
        const timestamp = parseTimestamp(row[0] || '');
        const questionsAnswered = row[5] ? parseInt(String(row[5]).match(/(\d+)/)?.[1] || '0', 10) : 0;
        const score = row[6] ? parseInt(String(row[6]).match(/(\d+)/)?.[1] || '0', 10) : 0;
        
        let evaluation = null;
        if (row[10]) {
          try {
            const evalStr = String(row[10]).trim();
            if (evalStr.startsWith('{') || evalStr.startsWith('[')) {
              evaluation = JSON.parse(evalStr);
            }
          } catch {}
        }

        await pool.query(
          `INSERT INTO viva_results 
           (timestamp, student_name, student_email, subject, topics, questions_answered, score, overall_feedback, transcript, recording_url, evaluation) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            timestamp,
            row[1] || 'Unknown',
            row[2] || '',
            row[3] || 'Unknown Subject',
            row[4] || '',
            questionsAnswered,
            score,
            row[7] || '',
            row[8] || '',
            row[9] || null,
            evaluation ? JSON.stringify(evaluation) : null
          ]
        );
        synced++;
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      message: `Synced ${synced} viva results from Google Sheets to database`
    });
  } catch (error) {
    console.error("[Sync] Error:", error);
    return NextResponse.json({ error: "Failed to sync results" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM viva_results');
    const lastSync = await pool.query('SELECT MAX(timestamp) as last FROM viva_results');
    
    return NextResponse.json({
      count: parseInt(result.rows[0].count),
      lastResult: lastSync.rows[0].last,
      message: "Use POST to trigger a sync from Google Sheets"
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to get sync status" }, { status: 500 });
  }
}
