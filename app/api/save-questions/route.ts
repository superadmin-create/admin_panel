import { NextRequest, NextResponse } from "next/server";
import { saveQuestionsToSheets } from "@/lib/api/save-questions";
import { STUDENT_DATA_SHEET_ID, getGoogleSheetsClient } from "@/lib/api/sheets";
import * as db from "@/lib/db";

const SUBJECTS_SHEET_NAME = "Subjects";

async function ensureSubjectExists(subjectName: string): Promise<void> {
  try {
    const sheets = await getGoogleSheetsClient();

    try {
      await sheets.spreadsheets.values.get({
        spreadsheetId: STUDENT_DATA_SHEET_ID,
        range: `'${SUBJECTS_SHEET_NAME}'!A1`,
      });
    } catch {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: STUDENT_DATA_SHEET_ID,
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
        spreadsheetId: STUDENT_DATA_SHEET_ID,
        range: `'${SUBJECTS_SHEET_NAME}'!A1:C1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [["Name", "Code", "Status"]],
        },
      });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: `'${SUBJECTS_SHEET_NAME}'!A2:A100`,
    });

    const existingSubjects = (response.data.values || []).map((row) =>
      row[0]?.toLowerCase()
    );

    if (!existingSubjects.includes(subjectName.toLowerCase())) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: STUDENT_DATA_SHEET_ID,
        range: `'${SUBJECTS_SHEET_NAME}'!A:C`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[subjectName, "", "active"]],
        },
      });
      console.log(`[Subjects] Auto-added new subject: ${subjectName}`);
    }

    try {
      await db.createSubject(subjectName, "");
    } catch (dbError) {
      console.error("[Subjects] Database save error:", dbError);
    }
  } catch (error) {
    console.error("[Subjects] Error ensuring subject exists:", error);
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

    try {
      await db.saveVivaQuestions(
        subject,
        (topics || []).join(", "),
        questions.map((q: { question: string; expectedAnswer: string; difficulty: string }) => ({
          question: q.question,
          expectedAnswer: q.expectedAnswer,
          difficulty: q.difficulty,
        }))
      );
    } catch (dbError) {
      console.error("[API] Database save error (non-blocking):", dbError);
    }

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
