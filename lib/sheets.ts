/**
 * Google Sheets integration for reading viva results
 * Connects to the same sheet used by ai-viva-main student portal
 */

import { google, Auth } from "googleapis";

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

interface GoogleSheetsConfig {
  privateKey: string;
  clientEmail: string;
  sheetId: string;
}

// Cache the auth client
let cachedAuth: Auth.JWT | null = null;

const SHEET_NAME = "Viva Results";

/**
 * Get Google Sheets configuration from environment variables
 */
function getSheetsConfig(): GoogleSheetsConfig | null {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!privateKey || !clientEmail || !sheetId) {
    console.warn("[Sheets] Google Sheets configuration not found");
    return null;
  }

  // Unescape newlines in private key
  const unescapedKey = privateKey.replace(/\\n/g, "\n");

  return {
    privateKey: unescapedKey,
    clientEmail,
    sheetId,
  };
}

/**
 * Get authenticated Google Sheets client
 */
function getAuthClient(config: GoogleSheetsConfig) {
  if (cachedAuth) {
    return cachedAuth;
  }

  cachedAuth = new google.auth.JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return cachedAuth;
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
  // Try parsing as plain number
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
  const config = getSheetsConfig();
  if (!config) {
    return { success: false, error: "Sheets configuration not found" };
  }

  try {
    const auth = getAuthClient(config);
    const sheets = google.sheets({ version: "v4", auth });

    // Fetch all data from the sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: `'${SHEET_NAME}'!A:J`,
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return { success: true, data: [] };
    }

    // Skip header row and parse data
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

    // Sort by date (newest first)
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

  // Group by email
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

    // Update last date if this is more recent
    if (!student.lastDate || result.dateTime > student.lastDate) {
      student.lastDate = result.dateTime;
    }
  });

  // Convert to array
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

  // Sort by last viva date (most recent first)
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
 * This function only reads data from the sheet - it does not edit or modify the sheet.
 */
export async function fetchTeacherCredentials(): Promise<{
  success: boolean;
  data?: TeacherCredentials[];
  error?: string;
}> {
  const config = getSheetsConfig();
  if (!config) {
    return { success: false, error: "Sheets configuration not found" };
  }

  // Teacher credentials sheet ID
  const TEACHER_SHEET_ID = "1or1TVnD6Py-gZ1dSP25CJjwufDeQ_Pi-s1tKls3lq_0";

  try {
    // Use read-only authentication (already configured in getAuthClient)
    const auth = getAuthClient(config);
    const sheets = google.sheets({ version: "v4", auth });

    // READ-ONLY: Get the sheet metadata to find the first sheet name
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: TEACHER_SHEET_ID,
    });

    const sheetName =
      spreadsheet.data.sheets?.[0]?.properties?.title || "Sheet1";

    // READ-ONLY: Fetch username (column A), password (column B), firstName (column C), lastName (column D)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: TEACHER_SHEET_ID,
      range: `'${sheetName}'!A:D`,
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return { success: false, error: "No teacher credentials found in sheet" };
    }

    // Skip header row and parse credentials
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
      .filter((cred) => cred.username && cred.password); // Filter out empty rows

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
      // Provide more helpful error messages
      if (
        errorMessage.includes("PERMISSION_DENIED") ||
        errorMessage.includes("does not have permission") ||
        errorMessage.includes("permission")
      ) {
        errorMessage = `Permission denied. Please share the Google Sheet with your service account: ${config.clientEmail}. Open: https://docs.google.com/spreadsheets/d/${TEACHER_SHEET_ID}/edit and share with Viewer access.`;
      } else if (errorMessage.includes("NOT_FOUND")) {
        errorMessage = `Teacher credentials sheet not found. Please verify the sheet ID: ${TEACHER_SHEET_ID}`;
      }
    }
    return { success: false, error: errorMessage };
  }
}


