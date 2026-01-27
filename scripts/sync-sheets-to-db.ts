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

async function syncVivaResults(sheets: any) {
  console.log('Syncing viva results...');
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: `'Viva Results'!A2:K`,
    });

    const rows = response.data.values || [];
    let count = 0;

    for (const row of rows) {
      if (row[0] && row[1]) {
        const timestamp = row[0] ? new Date(row[0]) : new Date();
        const questionsAnswered = row[5] ? parseInt(row[5].match(/(\d+)/)?.[1] || '0', 10) : 0;
        const score = row[6] ? parseInt(row[6].match(/(\d+)/)?.[1] || '0', 10) : 0;
        
        let evaluation = null;
        if (row[10]) {
          try {
            evaluation = JSON.parse(row[10]);
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
    }
    console.log(`  Synced ${count} viva results`);
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
