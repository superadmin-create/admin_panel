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
}

export async function appendVivaResultToSheet(result: StudentVivaResult): Promise<boolean> {
  try {
    const sheets = await getSheetsClient();
    
    const timestamp = result.timestamp || new Date().toISOString();
    const score = result.evaluation?.score || result.score || "";
    const feedback = result.evaluation?.feedback || result.overallFeedback || "";
    
    const row = [
      timestamp,
      result.studentName || "",
      result.studentEmail || "",
      result.studentPhone || "",
      result.subject || "",
      result.topic || "",
      result.questionsAnswered?.toString() || "",
      score.toString(),
      feedback,
      result.transcript || "",
      result.recordingUrl || "",
      result.vapiCallId || "",
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: `${VIVA_RESULTS_SHEET}!A:L`,
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
    
    if (updates.score !== undefined || updates.evaluation?.score !== undefined) {
      const score = updates.evaluation?.score || updates.score;
      updateValues.push({
        range: `${VIVA_RESULTS_SHEET}!H${rowIndex}`,
        values: [[score?.toString() || ""]],
      });
    }
    
    if (updates.overallFeedback || updates.evaluation?.feedback) {
      const feedback = updates.evaluation?.feedback || updates.overallFeedback;
      updateValues.push({
        range: `${VIVA_RESULTS_SHEET}!I${rowIndex}`,
        values: [[feedback || ""]],
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
