/**
 * Save generated viva questions to Google Sheets
 * These questions will be used by the AI Viva app
 */

import { google, Auth } from "googleapis";

interface VivaQuestion {
  id: number;
  question: string;
  expectedAnswer: string;
  difficulty: "easy" | "medium" | "hard";
  topic: string;
}

interface QuestionSet {
  subject: string;
  topics: string[];
  questions: VivaQuestion[];
  createdAt: string;
  createdBy?: string;
}

const QUESTIONS_SHEET_NAME = "Viva Questions";

let cachedAuth: Auth.JWT | null = null;

function getSheetsConfig() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const clientEmail =
    process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!privateKey || !clientEmail || !sheetId) {
    return null;
  }

  return {
    privateKey: privateKey.replace(/\\n/g, "\n"),
    clientEmail,
    sheetId,
  };
}

function getAuthClient(config: { privateKey: string; clientEmail: string }) {
  if (cachedAuth) return cachedAuth;

  cachedAuth = new google.auth.JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return cachedAuth;
}

async function ensureQuestionsSheet(
  sheets: ReturnType<typeof google.sheets>,
  sheetId: string
) {
  try {
    // Try to create the sheet
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: QUESTIONS_SHEET_NAME },
            },
          },
        ],
      },
    });
    console.log(`[Sheets] Created new sheet: ${QUESTIONS_SHEET_NAME}`);
  } catch {
    // Sheet already exists
  }

  // Check/create headers
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${QUESTIONS_SHEET_NAME}'!A1:G1`,
  });

  const firstRow = response.data.values?.[0];
  if (!firstRow || firstRow[0] !== "Subject") {
    const headers = [
      "Subject",
      "Topics",
      "Question",
      "Expected Answer",
      "Difficulty",
      "Created At",
      "Active",
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'${QUESTIONS_SHEET_NAME}'!A1:G1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }
}

/**
 * Save questions to Google Sheets
 */
export async function saveQuestionsToSheets(
  questionSet: QuestionSet
): Promise<{ success: boolean; error?: string }> {
  const config = getSheetsConfig();
  if (!config) {
    return { success: false, error: "Sheets configuration not found" };
  }

  try {
    const auth = getAuthClient(config);
    const sheets = google.sheets({ version: "v4", auth });

    await ensureQuestionsSheet(sheets, config.sheetId);

    // Prepare rows - one row per question
    const rows = questionSet.questions.map((q) => [
      questionSet.subject,
      questionSet.topics.join(", "),
      q.question,
      q.expectedAnswer,
      q.difficulty,
      questionSet.createdAt,
      "TRUE", // Active by default
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: config.sheetId,
      range: `'${QUESTIONS_SHEET_NAME}'!A:G`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rows },
    });

    console.log(
      `[Sheets] Saved ${rows.length} questions for subject: ${questionSet.subject}`
    );
    return { success: true };
  } catch (error) {
    console.error("[Sheets] Error saving questions:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get questions for a subject from Google Sheets
 */
export async function getQuestionsForSubject(
  subject: string
): Promise<{ success: boolean; questions?: VivaQuestion[]; error?: string }> {
  const config = getSheetsConfig();
  if (!config) {
    return { success: false, error: "Sheets configuration not found" };
  }

  try {
    const auth = getAuthClient(config);
    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: `'${QUESTIONS_SHEET_NAME}'!A2:G1000`,
    });

    const rows = response.data.values || [];

    // Filter by subject and active status
    const questions: VivaQuestion[] = rows
      .filter(
        (row) =>
          row[0]?.toLowerCase() === subject.toLowerCase() &&
          row[6]?.toUpperCase() === "TRUE"
      )
      .map((row, index) => ({
        id: index + 1,
        question: row[2] || "",
        expectedAnswer: row[3] || "",
        difficulty: (row[4] as "easy" | "medium" | "hard") || "medium",
        topic: row[1] || "",
      }));

    return { success: true, questions };
  } catch (error) {
    console.error("[Sheets] Error fetching questions:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get all active questions grouped by subject
 */
export async function getAllQuestions(): Promise<{
  success: boolean;
  data?: Record<string, VivaQuestion[]>;
  error?: string;
}> {
  const config = getSheetsConfig();
  if (!config) {
    return { success: false, error: "Sheets configuration not found" };
  }

  try {
    const auth = getAuthClient(config);
    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: `'${QUESTIONS_SHEET_NAME}'!A2:G1000`,
    });

    const rows = response.data.values || [];
    const grouped: Record<string, VivaQuestion[]> = {};

    rows
      .filter((row) => row[6]?.toUpperCase() === "TRUE")
      .forEach((row, index) => {
        const subject = row[0] || "Unknown";
        if (!grouped[subject]) {
          grouped[subject] = [];
        }
        grouped[subject].push({
          id: index + 1,
          question: row[2] || "",
          expectedAnswer: row[3] || "",
          difficulty: (row[4] as "easy" | "medium" | "hard") || "medium",
          topic: row[1] || "",
        });
      });

    return { success: true, data: grouped };
  } catch (error) {
    console.error("[Sheets] Error fetching all questions:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}


