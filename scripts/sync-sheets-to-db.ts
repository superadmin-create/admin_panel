import { Pool } from 'pg';
import { google } from 'googleapis';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const STUDENT_DATA_SHEET_ID = "1dPderiJxJl534xNnzHVVqye9VSx3zZY3ZEgO3vjqpFY";
const TEACHER_SHEET_ID = "1or1TVnD6Py-gZ1dSP25CJjwufDeQ_Pi-s1tKls3lq_0";

let connectionSettings: any;

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  if (!hostname) {
    throw new Error('Google Sheets connection not configured.');
  }

  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('Replit authentication token not found.');
  }

  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );
  
  const data = await response.json();
  connectionSettings = data.items?.[0];

  if (!connectionSettings) {
    throw new Error('Google Sheet connection not found.');
  }

  return connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;
}

async function getGoogleSheetsClient() {
  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.sheets({ version: 'v4', auth: oauth2Client });
}

async function syncSubjects(sheets: any) {
  console.log('Syncing subjects...');
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: `'Subjects'!A2:C100`,
    });

    const rows = response.data.values || [];
    let count = 0;

    for (const row of rows) {
      if (row[0]) {
        await pool.query(
          `INSERT INTO subjects (name, code, status) VALUES ($1, $2, $3) 
           ON CONFLICT (name) DO UPDATE SET code = EXCLUDED.code, status = EXCLUDED.status`,
          [row[0], row[1] || '', row[2] || 'active']
        );
        count++;
      }
    }
    console.log(`  Synced ${count} subjects`);
  } catch (error: any) {
    if (error.message?.includes('Unable to parse range')) {
      console.log('  No Subjects sheet found');
    } else {
      console.error('  Error syncing subjects:', error.message);
    }
  }
}

async function syncTopics(sheets: any) {
  console.log('Syncing topics...');
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: `'Topics'!A2:C100`,
    });

    const rows = response.data.values || [];
    let count = 0;

    for (const row of rows) {
      if (row[0] && row[1]) {
        await pool.query(
          `INSERT INTO topics (subject_name, name, status) VALUES ($1, $2, $3) 
           ON CONFLICT (subject_name, name) DO UPDATE SET status = EXCLUDED.status`,
          [row[0], row[1], row[2] || 'active']
        );
        count++;
      }
    }
    console.log(`  Synced ${count} topics`);
  } catch (error: any) {
    if (error.message?.includes('Unable to parse range')) {
      console.log('  No Topics sheet found');
    } else {
      console.error('  Error syncing topics:', error.message);
    }
  }
}

function parseTimestamp(ts: string): Date {
  if (!ts) return new Date();
  
  // Try ISO format first (2024-01-15T10:30:00Z)
  if (ts.includes('T') && (ts.includes('Z') || ts.includes('+'))) {
    const date = new Date(ts);
    if (!isNaN(date.getTime())) return date;
  }
  
  // Try "15 Jan 2024, 10:30 am" format
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

  // Try MM/DD/YYYY or DD/MM/YYYY formats
  const slashMatch = ts.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slashMatch) {
    const [, p1, p2, year] = slashMatch;
    const fullYear = year.length === 2 ? 2000 + parseInt(year, 10) : parseInt(year, 10);
    // Assume MM/DD/YYYY for US format
    return new Date(fullYear, parseInt(p1, 10) - 1, parseInt(p2, 10));
  }

  // Try standard Date parsing as fallback
  const parsed = new Date(ts);
  if (!isNaN(parsed.getTime())) return parsed;

  // Last resort: return current date
  console.log(`  Warning: Could not parse date "${ts}", using current date`);
  return new Date();
}

async function syncVivaResults(sheets: any) {
  console.log('Syncing viva results...');
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: `'Viva Results'!A2:K`,
    });

    const rows = response.data.values || [];
    let count = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        // Accept any row that has at least a student name (column B)
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
          count++;
        }
      } catch (rowError: any) {
        errors++;
        console.log(`  Error on row: ${rowError.message}`);
      }
    }
    console.log(`  Synced ${count} viva results (${errors} errors)`);
  } catch (error: any) {
    if (error.message?.includes('Unable to parse range')) {
      console.log('  No Viva Results sheet found');
    } else {
      console.error('  Error syncing viva results:', error.message);
    }
  }
}

async function syncVivaQuestions(sheets: any) {
  console.log('Syncing viva questions...');
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: `'Viva Questions'!A2:G1000`,
    });

    const rows = response.data.values || [];
    let count = 0;

    for (const row of rows) {
      if (row[0] && row[2]) {
        await pool.query(
          `INSERT INTO viva_questions 
           (subject, topics, question, expected_answer, difficulty, active, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            row[0],
            row[1] || '',
            row[2],
            row[3] || '',
            row[4] || 'medium',
            row[6]?.toUpperCase() === 'TRUE',
            row[5] ? new Date(row[5]) : new Date()
          ]
        );
        count++;
      }
    }
    console.log(`  Synced ${count} viva questions`);
  } catch (error: any) {
    if (error.message?.includes('Unable to parse range')) {
      console.log('  No Viva Questions sheet found');
    } else {
      console.error('  Error syncing viva questions:', error.message);
    }
  }
}

async function syncTeachers(sheets: any) {
  console.log('Syncing teachers...');
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: TEACHER_SHEET_ID });
    const firstSheetName = spreadsheet.data.sheets?.[0]?.properties?.title || 'Sheet1';
    console.log(`  Found sheet: ${firstSheetName}`);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: TEACHER_SHEET_ID,
      range: `'${firstSheetName}'!A2:D100`,
    });

    const rows = response.data.values || [];
    let count = 0;

    for (const row of rows) {
      if (row[0]) {
        await pool.query(
          `INSERT INTO teachers (email, name, password_hash, status) VALUES ($1, $2, $3, $4) 
           ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash`,
          [row[0], row[1] || '', row[2] || '', 'active']
        );
        count++;
      }
    }
    console.log(`  Synced ${count} teachers`);
  } catch (error: any) {
    console.error('  Error syncing teachers:', error.message);
  }
}

async function main() {
  console.log('Starting Google Sheets to Database sync...\n');
  
  try {
    const sheets = await getGoogleSheetsClient();
    
    await syncSubjects(sheets);
    await syncTopics(sheets);
    await syncVivaResults(sheets);
    await syncVivaQuestions(sheets);
    await syncTeachers(sheets);
    
    console.log('\nSync completed successfully!');
  } catch (error) {
    console.error('Sync failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
