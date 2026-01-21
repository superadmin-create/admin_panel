/**
 * Save generated viva questions to Google Sheets
 * These questions will be used by the AI Viva app
 */

import { google } from "googleapis";
import { STUDENT_DATA_SHEET_ID, getGoogleSheetsClient } from "./sheets";

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

async function ensureQuestionsSheet(
  sheets: ReturnType<typeof google.sheets>
) {
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
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

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: STUDENT_DATA_SHEET_ID,
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
      spreadsheetId: STUDENT_DATA_SHEET_ID,
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
  try {
    const sheets = await getGoogleSheetsClient();

    await ensureQuestionsSheet(sheets);

    const rows = questionSet.questions.map((q) => [
      questionSet.subject,
      questionSet.topics.join(", "),
      q.question,
      q.expectedAnswer,
      q.difficulty,
      questionSet.createdAt,
      "TRUE",
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
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
  try {
    const sheets = await getGoogleSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: `'${QUESTIONS_SHEET_NAME}'!A2:G1000`,
    });

    const rows = response.data.values || [];

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
  try {
    const sheets = await getGoogleSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
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
