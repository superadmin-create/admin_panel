import { NextRequest, NextResponse } from "next/server";
import { saveQuestionsToSheets } from "@/lib/api/save-questions";
import { google } from "googleapis";

const SUBJECTS_SHEET_NAME = "Subjects";

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

async function ensureSubjectExists(subjectName: string): Promise<void> {
  const config = getSheetsConfig();
  if (!config) return;

  try {
    const auth = new google.auth.JWT({
      email: config.clientEmail,
      key: config.privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // First, ensure the Subjects sheet exists
    try {
      await sheets.spreadsheets.values.get({
        spreadsheetId: config.sheetId,
        range: `'${SUBJECTS_SHEET_NAME}'!A1`,
      });
    } catch {
      // Sheet doesn't exist, create it with headers
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: config.sheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title: SUBJECTS_SHEET_NAME },
              },
            },
          ],
        },
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId: config.sheetId,
        range: `'${SUBJECTS_SHEET_NAME}'!A1:C1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [["Name", "Code", "Status"]],
        },
      });
    }

    // Check if subject already exists
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: `'${SUBJECTS_SHEET_NAME}'!A2:A100`,
    });

    const existingSubjects = (response.data.values || []).map((row) =>
      row[0]?.toLowerCase()
    );

    if (!existingSubjects.includes(subjectName.toLowerCase())) {
      // Subject doesn't exist, add it
      await sheets.spreadsheets.values.append({
        spreadsheetId: config.sheetId,
        range: `'${SUBJECTS_SHEET_NAME}'!A:C`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[subjectName, "", "active"]],
        },
      });
      console.log(`[Subjects] Auto-added new subject: ${subjectName}`);
    }
  } catch (error) {
    console.error("[Subjects] Error ensuring subject exists:", error);
    // Don't throw - this is a secondary operation
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subject, topics, questions } = body;

    if (!subject || !questions || !Array.isArray(questions)) {
      return NextResponse.json(
        { error: "Subject and questions are required" },
        { status: 400 }
      );
    }

    // Save the questions
    const result = await saveQuestionsToSheets({
      subject,
      topics: topics || [],
      questions,
      createdAt: new Date().toISOString(),
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to save questions" },
        { status: 500 }
      );
    }

    // Also ensure the subject exists in the Subjects sheet
    await ensureSubjectExists(subject);

    return NextResponse.json({
      success: true,
      message: `Saved ${questions.length} questions for ${subject}`,
    });
  } catch (error) {
    console.error("[API] Error saving questions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

