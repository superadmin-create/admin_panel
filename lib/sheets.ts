/**
 * Google Sheets integration for reading viva results
 * Uses Replit's Google Sheets connector for OAuth2 authentication
 */

import { google } from "googleapis";

// Types for viva results from Google Sheets
export interface VivaResult {
  id: string;
  dateTime: string;
  studentName: string;
  email: string;
  subject: string;
  topics: string;
  questionsAnswered: string;
  score: number;
  overallFeedback: string;
  transcript: string;
  recordingUrl: string;
  status: "passed" | "failed";
}

export interface StudentSummary {
  id: string;
  name: string;
  email: string;
  vivasCompleted: number;
  averageScore: number;
  subjects: string[];
  lastVivaDate: string | null;
  status: "active" | "at_risk" | "pending";
}

export interface TeacherCredentials {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
}

const SHEET_NAME = "Viva Results";
const TEACHER_SHEET_ID = "1or1TVnD6Py-gZ1dSP25CJjwufDeQ_Pi-s1tKls3lq_0";
const VIVA_RESULTS_SHEET_ID = process.env.GOOGLE_SHEET_ID || "";

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('Replit authentication token not found');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Sheet not connected');
  }
  return accessToken;
}

async function getGoogleSheetsClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

/**
 * Parse score string like "85/100" to number
 */
function parseScore(scoreStr: string): number {
  if (!scoreStr) return 0;
  const match = scoreStr.match(/(\d+)\/100/);
  if (match) {
    return parseInt(match[1], 10);
  }
  const num = parseInt(scoreStr, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Fetch all viva results from Google Sheets
 */
export async function fetchVivaResults(): Promise<{
  success: boolean;
  data?: VivaResult[];
  error?: string;
}> {
  if (!VIVA_RESULTS_SHEET_ID) {
    return { success: false, error: "GOOGLE_SHEET_ID environment variable not set" };
  }

  try {
    const sheets = await getGoogleSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: VIVA_RESULTS_SHEET_ID,
      range: `'${SHEET_NAME}'!A:J`,
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return { success: true, data: [] };
    }

    const results: VivaResult[] = rows.slice(1).map((row, index) => {
      const score = parseScore(row[6] || "0");
      return {
        id: `VIVA${String(index + 1).padStart(3, "0")}`,
        dateTime: row[0] || "",
        studentName: row[1] || "Unknown",
        email: row[2] || "",
        subject: row[3] || "Unknown",
        topics: row[4] || "",
        questionsAnswered: row[5] || "0",
        score,
        overallFeedback: row[7] || "",
        transcript: row[8] || "",
        recordingUrl: row[9] || "",
        status: score >= 50 ? "passed" : "failed",
      };
    });

    results.sort((a, b) => {
      const dateA = new Date(a.dateTime);
      const dateB = new Date(b.dateTime);
      return dateB.getTime() - dateA.getTime();
    });

    return { success: true, data: results };
  } catch (error) {
    console.error("[Sheets] Error fetching viva results:", error);
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}

/**
 * Aggregate viva results into student summaries
 */
export async function fetchStudentSummaries(): Promise<{
  success: boolean;
  data?: StudentSummary[];
  error?: string;
}> {
  const resultsResponse = await fetchVivaResults();
  if (!resultsResponse.success || !resultsResponse.data) {
    return { success: false, error: resultsResponse.error };
  }

  const results = resultsResponse.data;

  const studentMap = new Map<
    string,
    {
      name: string;
      email: string;
      scores: number[];
      subjects: Set<string>;
      lastDate: string | null;
    }
  >();

  results.forEach((result) => {
    const email = result.email.toLowerCase();
    if (!studentMap.has(email)) {
      studentMap.set(email, {
        name: result.studentName,
        email: result.email,
        scores: [],
        subjects: new Set(),
        lastDate: null,
      });
    }

    const student = studentMap.get(email)!;
    student.scores.push(result.score);
    student.subjects.add(result.subject);

    if (!student.lastDate || result.dateTime > student.lastDate) {
      student.lastDate = result.dateTime;
    }
  });

  const students: StudentSummary[] = Array.from(studentMap.entries()).map(
    ([email, data], index) => {
      const avgScore =
        data.scores.length > 0
          ? Math.round(
              data.scores.reduce((a, b) => a + b, 0) / data.scores.length
            )
          : 0;

      let status: "active" | "at_risk" | "pending" = "active";
      if (data.scores.length === 0) {
        status = "pending";
      } else if (avgScore < 50) {
        status = "at_risk";
      }

      return {
        id: `STU${String(index + 1).padStart(3, "0")}`,
        name: data.name,
        email: data.email,
        vivasCompleted: data.scores.length,
        averageScore: avgScore,
        subjects: Array.from(data.subjects),
        lastVivaDate: data.lastDate,
        status,
      };
    }
  );

  students.sort((a, b) => {
    if (!a.lastVivaDate) return 1;
    if (!b.lastVivaDate) return -1;
    return b.lastVivaDate.localeCompare(a.lastVivaDate);
  });

  return { success: true, data: students };
}

/**
 * Fetch teacher credentials from Google Sheets (READ-ONLY)
 * Sheet ID: 1or1TVnD6Py-gZ1dSP25CJjwufDeQ_Pi-s1tKls3lq_0
 */
export async function fetchTeacherCredentials(): Promise<{
  success: boolean;
  data?: TeacherCredentials[];
  error?: string;
}> {
  try {
    const sheets = await getGoogleSheetsClient();

    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: TEACHER_SHEET_ID,
    });

    const sheetName =
      spreadsheet.data.sheets?.[0]?.properties?.title || "Sheet1";

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: TEACHER_SHEET_ID,
      range: `'${sheetName}'!A:D`,
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return { success: false, error: "No teacher credentials found in sheet" };
    }

    const credentials: TeacherCredentials[] = rows
      .slice(1)
      .map((row) => {
        return {
          username: (row[0] || "").trim(),
          password: (row[1] || "").trim(),
          firstName: (row[2] || "").trim(),
          lastName: (row[3] || "").trim(),
        };
      })
      .filter((cred) => cred.username && cred.password);

    if (credentials.length === 0) {
      return {
        success: false,
        error: "No valid teacher credentials found in sheet",
      };
    }

    return { success: true, data: credentials };
  } catch (error) {
    console.error("[Sheets] Error fetching teacher credentials:", error);
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}
