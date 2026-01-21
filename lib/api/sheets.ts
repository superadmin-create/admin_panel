/**
 * Google Sheets integration for reading viva results
 * Uses Replit's Google Sheets connector for OAuth2 authentication
 */

import { google } from "googleapis";
import type { VivaResult, VivaEvaluation } from "@/lib/types/viva";

const SHEET_NAME = "Viva Results";
const STUDENT_DATA_SHEET_ID = "1dPderiJxJl534xNnzHVVqye9VSx3zZY3ZEgO3vjqpFY";

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings?.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  if (!hostname) {
    throw new Error('Google Sheets connection not configured. Please set up the Google Sheets integration.');
  }

  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('Replit authentication token not found.');
  }

  try {
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
      throw new Error('Google Sheet connection not found. Please reconnect your Google account.');
    }

    const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

    if (!accessToken) {
      throw new Error('Google Sheet access token not available. Please reconnect your Google account.');
    }
    
    return accessToken;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to connect to Google Sheets.');
  }
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
  try {
    const sheets = await getGoogleSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: `'${SHEET_NAME}'!A2:K`,
    });

    const rows = response.data.values || [];

    const results: VivaResult[] = rows.map((row, index) => {
      let evaluation: VivaEvaluation | null = null;
      try {
        if (row[10] && row[10].trim()) {
          const evalStr = row[10].trim();
          if (evalStr.startsWith('{') || evalStr.startsWith('[')) {
            evaluation = JSON.parse(evalStr);
          }
        }
      } catch (error) {
        console.warn(`[Sheets] Failed to parse evaluation JSON for row ${index + 2}`);
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

    results.sort((a, b) => {
      const parseTimestamp = (ts: string): number => {
        if (!ts) return 0;
        
        if (ts.includes('T') && (ts.includes('Z') || ts.includes('+'))) {
          const date = new Date(ts);
          return date.getTime();
        }
        
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
  const passingScore = 50;

  const totalVivas = results.length;
  const totalPassed = results.filter((r) => r.score >= passingScore).length;
  const totalFailed = totalVivas - totalPassed;
  const avgScore =
    totalVivas > 0
      ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / totalVivas)
      : 0;

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

export { STUDENT_DATA_SHEET_ID, getGoogleSheetsClient };
