import { NextRequest, NextResponse } from "next/server";
import { STUDENT_DATA_SHEET_ID, getGoogleSheetsClient } from "@/lib/api/sheets";

const TOPICS_SHEET_NAME = "Topics";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectFilter = searchParams.get("subject");

    const sheets = await getGoogleSheetsClient();

    let response;
    try {
      response = await sheets.spreadsheets.values.get({
        spreadsheetId: STUDENT_DATA_SHEET_ID,
        range: `'${TOPICS_SHEET_NAME}'!A2:C100`,
      });
    } catch {
      return NextResponse.json({ success: true, topics: [] });
    }

    const rows = response.data.values || [];

    let topics = rows
      .filter((row) => row[0] && row[1] && (row[2] === "active" || !row[2]))
      .map((row, index) => ({
        id: index + 1,
        subject: row[0] || "",
        name: row[1] || "",
        status: row[2] || "active",
      }));

    if (subjectFilter) {
      topics = topics.filter(
        (t) => t.subject.toLowerCase() === subjectFilter.toLowerCase()
      );
    }

    return NextResponse.json({ success: true, topics });
  } catch (error: unknown) {
    console.error("[Topics API] Error fetching topics:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subject, name } = body;

    if (!subject || !name) {
      return NextResponse.json(
        { success: false, error: "Subject and topic name are required" },
        { status: 400 }
      );
    }

    const sheets = await getGoogleSheetsClient();

    try {
      await sheets.spreadsheets.values.get({
        spreadsheetId: STUDENT_DATA_SHEET_ID,
        range: `'${TOPICS_SHEET_NAME}'!A1`,
      });
    } catch {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: STUDENT_DATA_SHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: TOPICS_SHEET_NAME,
                },
              },
            },
          ],
        },
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId: STUDENT_DATA_SHEET_ID,
        range: `'${TOPICS_SHEET_NAME}'!A1:C1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [["Subject", "Topic Name", "Status"]],
        },
      });
    }

    const existingResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: `'${TOPICS_SHEET_NAME}'!A2:B100`,
    });

    const existingRows = existingResponse.data.values || [];
    const exists = existingRows.some(
      (row) =>
        row[0]?.toLowerCase() === subject.toLowerCase() &&
        row[1]?.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      return NextResponse.json(
        { success: false, error: "Topic already exists for this subject" },
        { status: 400 }
      );
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: `'${TOPICS_SHEET_NAME}'!A:C`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[subject, name, "active"]],
      },
    });

    return NextResponse.json({
      success: true,
      message: "Topic added successfully",
    });
  } catch (error) {
    console.error("[Topics API] Error adding topic:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get("subject");
    const name = searchParams.get("name");

    if (!subject || !name) {
      return NextResponse.json(
        { success: false, error: "Subject and topic name are required" },
        { status: 400 }
      );
    }

    const sheets = await getGoogleSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: `'${TOPICS_SHEET_NAME}'!A2:C100`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(
      (row) =>
        row[0]?.toLowerCase() === subject.toLowerCase() &&
        row[1]?.toLowerCase() === name.toLowerCase()
    );

    if (rowIndex === -1) {
      return NextResponse.json(
        { success: false, error: "Topic not found" },
        { status: 404 }
      );
    }

    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
    });

    const topicsSheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === TOPICS_SHEET_NAME
    );

    if (!topicsSheet?.properties?.sheetId) {
      return NextResponse.json(
        { success: false, error: "Topics sheet not found" },
        { status: 404 }
      );
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: topicsSheet.properties.sheetId,
                dimension: "ROWS",
                startIndex: rowIndex + 1,
                endIndex: rowIndex + 2,
              },
            },
          },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      message: "Topic deleted successfully",
    });
  } catch (error) {
    console.error("[Topics API] Error deleting topic:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { oldSubject, oldName, newSubject, newName } = body;

    if (!oldSubject || !oldName) {
      return NextResponse.json(
        { success: false, error: "Old subject and topic name are required" },
        { status: 400 }
      );
    }

    if (!newSubject || !newName) {
      return NextResponse.json(
        { success: false, error: "New subject and topic name are required" },
        { status: 400 }
      );
    }

    const sheets = await getGoogleSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: `'${TOPICS_SHEET_NAME}'!A2:C100`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(
      (row) =>
        row[0]?.toLowerCase() === oldSubject.toLowerCase() &&
        row[1]?.toLowerCase() === oldName.toLowerCase()
    );

    if (rowIndex === -1) {
      return NextResponse.json(
        { success: false, error: "Topic not found" },
        { status: 404 }
      );
    }

    if (oldSubject !== newSubject || oldName !== newName) {
      const exists = rows.some(
        (row) =>
          row[0]?.toLowerCase() === newSubject.toLowerCase() &&
          row[1]?.toLowerCase() === newName.toLowerCase() &&
          rows.indexOf(row) !== rowIndex
      );

      if (exists) {
        return NextResponse.json(
          { success: false, error: "Topic already exists for this subject" },
          { status: 400 }
        );
      }
    }

    const updateRow = rowIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: `'${TOPICS_SHEET_NAME}'!A${updateRow}:C${updateRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[newSubject, newName, rows[rowIndex][2] || "active"]],
      },
    });

    return NextResponse.json({ success: true, message: "Topic updated successfully" });
  } catch (error) {
    console.error("[Topics API] Error updating topic:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
