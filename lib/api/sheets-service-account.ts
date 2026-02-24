/**
 * Google Sheets integration using Service Account for student data writes
 * Separate from OAuth connector used for teacher operations
 */

import { google } from "googleapis";

const STUDENT_DATA_SHEET_ID = "1dPderiJxJl534xNnzHVVqye9VSx3zZY3ZEgO3vjqpFY";
const VIVA_RESULTS_SHEET = "Viva Results";

function getServiceAccountAuth() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  if (!privateKey || !clientEmail) {
    throw new Error("Google service account credentials not configured");
  }

  const formattedKey = privateKey.replace(/\\n/g, "\n");

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: formattedKey,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return auth;
}

async function getSheetsClient() {
  const auth = getServiceAccountAuth();
  return google.sheets({ version: "v4", auth });
}

export interface StudentVivaResult {
  studentName: string;
  studentEmail?: string;
  studentPhone?: string;
  subject: string;
  topic?: string;
  score?: number;
  questionsAnswered?: number;
  overallFeedback?: string;
  transcript?: string;
  recordingUrl?: string;
  evaluation?: {
    score?: number;
    feedback?: string;
  };
  timestamp?: string;
  vapiCallId?: string;
  marksBreakdown?: string;
}

// Invalid values that should not be saved
const INVALID_NAMES = ['unknown student', 'unknown', 'transient assistant', '', 'test', 'test user'];
const INVALID_SUBJECTS = ['transient assistant', 'unknown subject', 'unknown', ''];

export async function appendVivaResultToSheet(result: StudentVivaResult): Promise<boolean> {
  try {
    // Validate before saving
    const studentName = (result.studentName || '').toLowerCase();
    const subject = (result.subject || '').toLowerCase();
    
    if (INVALID_NAMES.includes(studentName) || INVALID_SUBJECTS.includes(subject)) {
      console.log(`[ServiceAccount] Skipping invalid entry: ${result.studentName} / ${result.subject}`);
      return false;
    }
    
    const sheets = await getSheetsClient();
    
    const timestamp = result.timestamp || new Date().toISOString();
    const score = result.evaluation?.score || result.score || "";
    const feedback = result.evaluation?.feedback || result.overallFeedback || "";
    
    // Column order: A=Date&Time, B=StudentName, C=Email, D=Subject, E=Topics, 
    //               F=QuestionsAnswered, G=Score, H=OverallFeedback, I=Transcript, J=Recording, K=Evaluation(JSON)
    const row = [
      timestamp,
      result.studentName || "",
      result.studentEmail || "",
      result.subject || "",
      result.topic || "",
      result.questionsAnswered?.toString() || "",
      score.toString(),
      feedback,
      result.transcript || "",
      result.recordingUrl || "",
      result.evaluation ? JSON.stringify(result.evaluation) : "",
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: `${VIVA_RESULTS_SHEET}!A:K`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [row],
      },
    });

    console.log(`[ServiceAccount] Appended viva result for ${result.studentName} to Google Sheets`);
    return true;
  } catch (error) {
    console.error("[ServiceAccount] Error appending to Google Sheets:", error);
    return false;
  }
}

export async function updateVivaResultInSheet(
  rowIndex: number,
  updates: Partial<StudentVivaResult>
): Promise<boolean> {
  try {
    const sheets = await getSheetsClient();
    
    const updateValues: { range: string; values: string[][] }[] = [];
    
    // Column order: A=Date&Time, B=StudentName, C=Email, D=Subject, E=Topics, 
    //               F=QuestionsAnswered, G=Score, H=OverallFeedback, I=Transcript, J=Recording, K=Evaluation(JSON)
    if (updates.studentEmail) {
      updateValues.push({
        range: `${VIVA_RESULTS_SHEET}!C${rowIndex}`,
        values: [[updates.studentEmail]],
      });
    }
    
    if (updates.questionsAnswered !== undefined) {
      updateValues.push({
        range: `${VIVA_RESULTS_SHEET}!F${rowIndex}`,
        values: [[updates.questionsAnswered.toString()]],
      });
    }
    
    if (updates.score !== undefined || updates.evaluation?.score !== undefined) {
      const score = updates.evaluation?.score || updates.score;
      updateValues.push({
        range: `${VIVA_RESULTS_SHEET}!G${rowIndex}`,
        values: [[score?.toString() || ""]],
      });
    }
    
    if (updates.overallFeedback || updates.evaluation?.feedback) {
      const feedback = updates.evaluation?.feedback || updates.overallFeedback;
      updateValues.push({
        range: `${VIVA_RESULTS_SHEET}!H${rowIndex}`,
        values: [[feedback || ""]],
      });
    }
    
    if (updates.evaluation) {
      updateValues.push({
        range: `${VIVA_RESULTS_SHEET}!K${rowIndex}`,
        values: [[JSON.stringify(updates.evaluation)]],
      });
    }

    if (updateValues.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: STUDENT_DATA_SHEET_ID,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: updateValues,
        },
      });
      console.log(`[ServiceAccount] Updated row ${rowIndex} in Google Sheets`);
    }

    return true;
  } catch (error) {
    console.error("[ServiceAccount] Error updating Google Sheets:", error);
    return false;
  }
}

export async function testServiceAccountConnection(): Promise<boolean> {
  try {
    const sheets = await getSheetsClient();
    
    const response = await sheets.spreadsheets.get({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      fields: "properties.title",
    });
    
    console.log(`[ServiceAccount] Connected to sheet: ${response.data.properties?.title}`);
    return true;
  } catch (error) {
    console.error("[ServiceAccount] Connection test failed:", error);
    return false;
  }
}

export async function deleteInvalidRowsFromSheet(): Promise<{ deleted: number; errors: string[] }> {
  const errors: string[] = [];
  let deleted = 0;
  
  try {
    const sheets = await getSheetsClient();
    
    // Get all rows
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: `${VIVA_RESULTS_SHEET}!A:L`,
    });
    
    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return { deleted: 0, errors: [] };
    }
    
    // Find rows to delete (check from bottom to top to avoid index shifting)
    const rowsToDelete: number[] = [];
    
    for (let i = rows.length - 1; i >= 1; i--) {
      const row = rows[i];
      const studentName = (row[1] || '').toLowerCase();
      const subject = (row[4] || '').toLowerCase();
      
      if (INVALID_NAMES.includes(studentName) || INVALID_SUBJECTS.includes(subject)) {
        rowsToDelete.push(i + 1); // Sheet rows are 1-indexed
      }
    }
    
    if (rowsToDelete.length === 0) {
      console.log('[ServiceAccount] No invalid rows found to delete');
      return { deleted: 0, errors: [] };
    }
    
    // Get the sheet ID for batch update
    const sheetMetadata = await sheets.spreadsheets.get({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
    });
    
    const vivaSheet = sheetMetadata.data.sheets?.find(
      s => s.properties?.title === VIVA_RESULTS_SHEET
    );
    
    if (!vivaSheet?.properties?.sheetId) {
      errors.push('Could not find Viva Results sheet');
      return { deleted: 0, errors };
    }
    
    const sheetId = vivaSheet.properties.sheetId;
    
    // Delete rows from bottom to top
    for (const rowIndex of rowsToDelete) {
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: STUDENT_DATA_SHEET_ID,
          requestBody: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: sheetId,
                  dimension: 'ROWS',
                  startIndex: rowIndex - 1,
                  endIndex: rowIndex,
                },
              },
            }],
          },
        });
        deleted++;
        console.log(`[ServiceAccount] Deleted invalid row ${rowIndex}`);
      } catch (error) {
        errors.push(`Failed to delete row ${rowIndex}: ${(error as Error).message}`);
      }
    }
    
    console.log(`[ServiceAccount] Deleted ${deleted} invalid rows from Google Sheets`);
    return { deleted, errors };
  } catch (error) {
    console.error('[ServiceAccount] Error cleaning up sheet:', error);
    errors.push((error as Error).message);
    return { deleted, errors };
  }
}
