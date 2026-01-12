import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const TOPICS_SHEET_NAME = "Topics";

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
  return new google.auth.JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

// GET - Fetch all topics (optionally filtered by subject)
export async function GET(request: NextRequest) {
  const config = getSheetsConfig();
  if (!config) {
    return NextResponse.json(
      { success: false, error: "Google Sheets not configured" },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const subjectFilter = searchParams.get("subject");

    const auth = getAuthClient(config);
    const sheets = google.sheets({ version: "v4", auth });

    // Try to get topics from the Topics sheet
    let response;
    try {
      response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.sheetId,
        range: `'${TOPICS_SHEET_NAME}'!A2:C100`,
      });
    } catch {
      // Sheet doesn't exist, return empty list
      return NextResponse.json({ success: true, topics: [] });
    }

    const rows = response.data.values || [];

    // Column format: Subject, Topic Name, Status
    let topics = rows
      .filter((row) => row[0] && row[1] && (row[2] === "active" || !row[2]))
      .map((row, index) => ({
        id: index + 1,
        subject: row[0] || "",
        name: row[1] || "",
        status: row[2] || "active",
      }));

    // Filter by subject if provided
    if (subjectFilter) {
      topics = topics.filter(
        (t) => t.subject.toLowerCase() === subjectFilter.toLowerCase()
      );
    }

    return NextResponse.json({ success: true, topics });
  } catch (error: unknown) {
    console.error("[Topics API] Error fetching topics:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch topics" },
      { status: 500 }
    );
  }
}

// POST - Add a new topic
export async function POST(request: NextRequest) {
  const config = getSheetsConfig();
  if (!config) {
    return NextResponse.json(
      { success: false, error: "Google Sheets not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { subject, name } = body;

    if (!subject || !name) {
      return NextResponse.json(
        { success: false, error: "Subject and topic name are required" },
        { status: 400 }
      );
    }

    const auth = getAuthClient(config);
    const sheets = google.sheets({ version: "v4", auth });

    // First, ensure the Topics sheet exists
    try {
      await sheets.spreadsheets.values.get({
        spreadsheetId: config.sheetId,
        range: `'${TOPICS_SHEET_NAME}'!A1`,
      });
    } catch {
      // Sheet doesn't exist, create it with headers
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: config.sheetId,
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

      // Add headers
      await sheets.spreadsheets.values.update({
        spreadsheetId: config.sheetId,
        range: `'${TOPICS_SHEET_NAME}'!A1:C1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [["Subject", "Topic Name", "Status"]],
        },
      });
    }

    // Check if topic already exists for this subject
    const existingResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
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

    // Append the new topic
    await sheets.spreadsheets.values.append({
      spreadsheetId: config.sheetId,
      range: `'${TOPICS_SHEET_NAME}'!A:C`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[subject, name, "active"]],
      },
    });

    console.log(`[Topics API] Added topic "${name}" for subject "${subject}"`);

    return NextResponse.json({
      success: true,
      message: "Topic added successfully",
    });
  } catch (error) {
    console.error("[Topics API] Error adding topic:", error);
    return NextResponse.json(
      { success: false, error: "Failed to add topic" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a topic
export async function DELETE(request: NextRequest) {
  const config = getSheetsConfig();
  if (!config) {
    return NextResponse.json(
      { success: false, error: "Google Sheets not configured" },
      { status: 500 }
    );
  }

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

    const auth = getAuthClient(config);
    const sheets = google.sheets({ version: "v4", auth });

    // Get all topics to find the row to delete
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
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

    // Get sheet ID
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: config.sheetId,
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

    // Delete the row
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.sheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: topicsSheet.properties.sheetId,
                dimension: "ROWS",
                startIndex: rowIndex + 1, // +1 for header
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
    return NextResponse.json(
      { success: false, error: "Failed to delete topic" },
      { status: 500 }
    );
  }
}

// PUT - Update a topic
export async function PUT(request: NextRequest) {
  const config = getSheetsConfig();
  if (!config) {
    return NextResponse.json(
      { success: false, error: "Google Sheets not configured" },
      { status: 500 }
    );
  }

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

    const auth = getAuthClient(config);
    const sheets = google.sheets({ version: "v4", auth });

    // Get all topics to find the row to update
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
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

    // Check if the new topic name already exists for the new subject (if different)
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

    // Update the row (rowIndex + 2 because of 0-index and header row)
    const updateRow = rowIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.sheetId,
      range: `'${TOPICS_SHEET_NAME}'!A${updateRow}:C${updateRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[newSubject, newName, rows[rowIndex][2] || "active"]],
      },
    });

    return NextResponse.json({ success: true, message: "Topic updated successfully" });
  } catch (error) {
    console.error("[Topics API] Error updating topic:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update topic" },
      { status: 500 }
    );
  }
}


