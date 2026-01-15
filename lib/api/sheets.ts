/**
 * Google Sheets integration for reading viva results
 * This fetches data from the same Google Sheet used by ai-viva-main
 */

import { google, Auth } from "googleapis";
import type { VivaResult, VivaEvaluation } from "@/lib/types/viva";

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
  const clientEmail =
    process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!privateKey || !clientEmail || !sheetId) {
    console.warn(
      "[Sheets] Google Sheets configuration not found. Required: GOOGLE_PRIVATE_KEY, GOOGLE_CLIENT_EMAIL, GOOGLE_SHEET_ID"
    );
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
 * Parse score string like "75/100" to number
 */
function parseScore(scoreStr: string): number {
  if (!scoreStr) return 0;
  const match = scoreStr.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Parse questions count from string like "8 questions"
 */
function parseQuestionsCount(str: string): number {
  if (!str) return 0;
  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Fetch all viva results from Google Sheets
 */
export async function getVivaResults(): Promise<{
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

    // Fetch all data from the sheet (skip header row)
    // Use a large range to get all rows, or use A2:K to get all rows dynamically
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: `'${SHEET_NAME}'!A2:K`, // Skip header, get all rows (including evaluation column K)
    });

    const rows = response.data.values || [];

    // Convert rows to VivaResult objects
    // Sheet columns: Date & Time, Student Name, Email, Subject, Topics, Questions Answered, Score, Overall Feedback, Transcript, Recording, Evaluation (JSON)
    const results: VivaResult[] = rows.map((row, index) => {
      // Try to parse evaluation from row[10] if it exists (column K, index 10)
      let evaluation: VivaEvaluation | null = null;
      try {
        // Check if there's an evaluation column (column K, index 10)
        if (row[10] && row[10].trim()) {
          const evalStr = row[10].trim();
          // Handle both string JSON and already parsed objects
          if (evalStr.startsWith('{') || evalStr.startsWith('[')) {
            evaluation = JSON.parse(evalStr);
            // Log successful parsing for debugging (only in development)
            if (process.env.NODE_ENV === 'development') {
              console.log(`[Sheets] Successfully parsed evaluation for row ${index + 2}, student: ${row[1] || 'Unknown'}`);
            }
          }
        } else if (process.env.NODE_ENV === 'development') {
          console.log(`[Sheets] No evaluation data found in column K for row ${index + 2}`);
        }
      } catch (error) {
        // Log parsing errors for debugging
        console.warn(`[Sheets] Failed to parse evaluation JSON for row ${index + 2}:`, error instanceof Error ? error.message : String(error));
        console.warn(`[Sheets] Evaluation data (first 200 chars):`, row[10]?.substring(0, 200));
      }

      return {
        id: `VIVA${String(index + 1).padStart(4, "0")}`,
        timestamp: row[0] || "",
        studentName: row[1] || "Unknown",
        studentEmail: row[2] || "",
        subject: row[3] || "Unknown Subject",
        topics: row[4] || "",
        questionsAnswered: parseQuestionsCount(row[5]),
        score: parseScore(row[6]),
        overallFeedback: row[7] || "",
        transcript: row[8] || "",
        recordingUrl: row[9] || undefined,
        evaluation: evaluation || undefined,
      };
    });

    // Sort by timestamp descending (most recent first)
    // Handle both ISO format and formatted string timestamps
    // Normalize all timestamps to local time for accurate comparison
    results.sort((a, b) => {
      const parseTimestamp = (ts: string): number => {
        if (!ts) return 0;
        
        // Try ISO format first (e.g., "2026-01-15T10:11:35.724Z")
        // ISO timestamps are in UTC, so we convert to local time
        if (ts.includes('T') && (ts.includes('Z') || ts.includes('+'))) {
          const date = new Date(ts);
          // Return local time in milliseconds for comparison
          return date.getTime();
        }
        
        // Try formatted string (e.g., "15 Jan 2026, 10:41 am")
        // These are already in local time
        const formattedMatch = ts.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4}),\s+(\d{1,2}):(\d{2})\s+(am|pm)/i);
        if (formattedMatch) {
          const [, day, month, year, hour, minute, ampm] = formattedMatch;
          const monthMap: Record<string, number> = {
            jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
            jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
          };
          let hour24 = parseInt(hour, 10);
          if (ampm.toLowerCase() === 'pm' && hour24 !== 12) hour24 += 12;
          if (ampm.toLowerCase() === 'am' && hour24 === 12) hour24 = 0;
          const date = new Date(
            parseInt(year, 10),
            monthMap[month.toLowerCase()],
            parseInt(day, 10),
            hour24,
            parseInt(minute, 10)
          );
          return date.getTime();
        }
        
        // Fallback to standard Date parsing
        const parsed = new Date(ts);
        return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
      };
      
      return parseTimestamp(b.timestamp) - parseTimestamp(a.timestamp);
    });

    return { success: true, data: results };
  } catch (error) {
    console.error("[Sheets] Error fetching viva results:", error);

    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
      if (errorMessage.includes("invalid_grant")) {
        errorMessage = "Authentication failed - check credentials";
      } else if (errorMessage.includes("not found")) {
        errorMessage = "Spreadsheet not found";
      } else if (errorMessage.includes("permission")) {
        errorMessage = "Permission denied";
      }
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Get aggregated statistics from viva results
 */
export async function getVivaStats(): Promise<{
  success: boolean;
  data?: {
    totalVivas: number;
    totalPassed: number;
    totalFailed: number;
    avgScore: number;
    subjectStats: Record<
      string,
      { count: number; avgScore: number; passRate: number }
    >;
    recentResults: VivaResult[];
  };
  error?: string;
}> {
  const resultsResponse = await getVivaResults();

  if (!resultsResponse.success || !resultsResponse.data) {
    return { success: false, error: resultsResponse.error };
  }

  const results = resultsResponse.data;
  const passingScore = 50; // 50% is passing

  const totalVivas = results.length;
  const totalPassed = results.filter((r) => r.score >= passingScore).length;
  const totalFailed = totalVivas - totalPassed;
  const avgScore =
    totalVivas > 0
      ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / totalVivas)
      : 0;

  // Calculate per-subject statistics
  const subjectMap = new Map<
    string,
    { scores: number[]; passed: number; count: number }
  >();

  for (const result of results) {
    const subject = result.subject;
    if (!subjectMap.has(subject)) {
      subjectMap.set(subject, { scores: [], passed: 0, count: 0 });
    }
    const stats = subjectMap.get(subject)!;
    stats.scores.push(result.score);
    stats.count++;
    if (result.score >= passingScore) {
      stats.passed++;
    }
  }

  const subjectStats: Record<
    string,
    { count: number; avgScore: number; passRate: number }
  > = {};

  subjectMap.forEach((stats, subject) => {
    subjectStats[subject] = {
      count: stats.count,
      avgScore:
        stats.count > 0
          ? Math.round(
              stats.scores.reduce((a, b) => a + b, 0) / stats.count
            )
          : 0,
      passRate:
        stats.count > 0 ? Math.round((stats.passed / stats.count) * 100) : 0,
    };
  });

  // Get 10 most recent results (increased from 5 to show more results)
  const recentResults = results.slice(0, 10);

  return {
    success: true,
    data: {
      totalVivas,
      totalPassed,
      totalFailed,
      avgScore,
      subjectStats,
      recentResults,
    },
  };
}

/**
 * Get unique students from viva results
 */
export async function getStudentsFromResults(): Promise<{
  success: boolean;
  data?: Array<{
    email: string;
    name: string;
    vivasCompleted: number;
    avgScore: number;
    lastViva: string;
    subjects: string[];
  }>;
  error?: string;
}> {
  const resultsResponse = await getVivaResults();

  if (!resultsResponse.success || !resultsResponse.data) {
    return { success: false, error: resultsResponse.error };
  }

  const results = resultsResponse.data;
  const studentMap = new Map<
    string,
    {
      name: string;
      scores: number[];
      lastViva: string;
      subjects: Set<string>;
    }
  >();

  for (const result of results) {
    const email = result.studentEmail;
    if (!studentMap.has(email)) {
      studentMap.set(email, {
        name: result.studentName,
        scores: [],
        lastViva: result.timestamp,
        subjects: new Set(),
      });
    }
    const student = studentMap.get(email)!;
    student.scores.push(result.score);
    student.subjects.add(result.subject);
    if (new Date(result.timestamp) > new Date(student.lastViva)) {
      student.lastViva = result.timestamp;
    }
  }

  const students = Array.from(studentMap.entries()).map(([email, data]) => ({
    email,
    name: data.name,
    vivasCompleted: data.scores.length,
    avgScore:
      data.scores.length > 0
        ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
        : 0,
    lastViva: data.lastViva,
    subjects: Array.from(data.subjects),
  }));

  return { success: true, data: students };
}


