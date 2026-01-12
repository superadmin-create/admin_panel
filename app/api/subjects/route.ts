import { NextRequest, NextResponse } from "next/server";
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

function getAuthClient(config: { privateKey: string; clientEmail: string }) {
  return new google.auth.JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

// GET - Fetch all subjects
export async function GET() {
  const config = getSheetsConfig();
  if (!config) {
    return NextResponse.json(
      { success: false, error: "Google Sheets not configured" },
      { status: 500 }
    );
  }

  try {
    const auth = getAuthClient(config);
    const sheets = google.sheets({ version: "v4", auth });

    // Try to get subjects from the Subjects sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: `'${SUBJECTS_SHEET_NAME}'!A2:C100`,
    });

    const rows = response.data.values || [];
    
    // Column format: Name, Code, Status
    const subjects = rows
      .filter((row) => row[0]) // Filter out empty rows
      .map((row, index) => ({
        id: index + 1,
        name: row[0] || "",
        code: row[1] || "",
        status: row[2] || "active",
      }));

    return NextResponse.json({ success: true, subjects });
  } catch (error: unknown) {
    console.error("[Subjects API] Error fetching subjects:", error);
    
    // If sheet doesn't exist, return empty list
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (errorMessage.includes("Unable to parse range")) {
      return NextResponse.json({ success: true, subjects: [] });
    }
    
    return NextResponse.json(
      { success: false, error: "Failed to fetch subjects" },
      { status: 500 }
    );
  }
}

// POST - Add a new subject
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
    const { name, code } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Subject name is required" },
        { status: 400 }
      );
    }

    const auth = getAuthClient(config);
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
                properties: {
                  title: SUBJECTS_SHEET_NAME,
                },
              },
            },
          ],
        },
      });

      // Add headers
      await sheets.spreadsheets.values.update({
        spreadsheetId: config.sheetId,
        range: `'${SUBJECTS_SHEET_NAME}'!A1:C1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [["Name", "Code", "Status"]],
        },
      });
    }

    // Append the new subject
    await sheets.spreadsheets.values.append({
      spreadsheetId: config.sheetId,
      range: `'${SUBJECTS_SHEET_NAME}'!A:C`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[name, code || "", "active"]],
      },
    });

    return NextResponse.json({ success: true, message: "Subject added successfully" });
  } catch (error) {
    console.error("[Subjects API] Error adding subject:", error);
    return NextResponse.json(
      { success: false, error: "Failed to add subject" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a subject
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
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Subject name is required" },
        { status: 400 }
      );
    }

    const auth = getAuthClient(config);
    const sheets = google.sheets({ version: "v4", auth });

    // Get all subjects to find the row to delete
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: `'${SUBJECTS_SHEET_NAME}'!A2:C100`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex((row) => row[0] === name);

    if (rowIndex === -1) {
      return NextResponse.json(
        { success: false, error: "Subject not found" },
        { status: 404 }
      );
    }

    // Get sheet ID
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: config.sheetId,
    });

    const subjectsSheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === SUBJECTS_SHEET_NAME
    );

    if (!subjectsSheet?.properties?.sheetId) {
      return NextResponse.json(
        { success: false, error: "Subjects sheet not found" },
        { status: 404 }
      );
    }

    // Delete the row (rowIndex + 2 because of 0-index and header row)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.sheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: subjectsSheet.properties.sheetId,
                dimension: "ROWS",
                startIndex: rowIndex + 1, // +1 for header
                endIndex: rowIndex + 2,
              },
            },
          },
        ],
      },
    });

    return NextResponse.json({ success: true, message: "Subject deleted successfully" });
  } catch (error) {
    console.error("[Subjects API] Error deleting subject:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete subject" },
      { status: 500 }
    );
  }
}

// PUT - Update a subject
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
    const { oldName, newName, code } = body;

    if (!oldName || !newName) {
      return NextResponse.json(
        { success: false, error: "Old name and new name are required" },
        { status: 400 }
      );
    }

    const auth = getAuthClient(config);
    const sheets = google.sheets({ version: "v4", auth });

    // Get all subjects to find the row to update
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: `'${SUBJECTS_SHEET_NAME}'!A2:C100`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex((row) => row[0] === oldName);

    if (rowIndex === -1) {
      return NextResponse.json(
        { success: false, error: "Subject not found" },
        { status: 404 }
      );
    }

    // Update the row (rowIndex + 2 because of 0-index and header row)
    const updateRow = rowIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.sheetId,
      range: `'${SUBJECTS_SHEET_NAME}'!A${updateRow}:C${updateRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[newName, code !== undefined ? code : (rows[rowIndex][1] || ""), rows[rowIndex][2] || "active"]],
      },
    });

    // If the name changed, we also need to update all topics that reference this subject
    if (oldName !== newName) {
      try {
        const topicsResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: config.sheetId,
          range: `'Topics'!A2:C100`,
        });

        const topicRows = topicsResponse.data.values || [];
        const topicsToUpdate: number[] = [];

        topicRows.forEach((row, index) => {
          if (row[0] === oldName) {
            topicsToUpdate.push(index + 2); // +2 for header and 0-index
          }
        });

        // Update all topics that reference the old subject name
        if (topicsToUpdate.length > 0) {
          // Get the Topics sheet ID once
          const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: config.sheetId,
          });

          const topicsSheet = spreadsheet.data.sheets?.find(
            (s) => s.properties?.title === "Topics"
          );

          if (topicsSheet?.properties?.sheetId) {
            const updateRequests = topicsToUpdate.map((rowNum) => ({
              updateCells: {
                range: {
                  sheetId: topicsSheet.properties.sheetId,
                  startRowIndex: rowNum - 1,
                  endRowIndex: rowNum,
                  startColumnIndex: 0,
                  endColumnIndex: 1,
                },
                values: [{ userEnteredValue: { stringValue: newName } }],
              },
            }));

            await sheets.spreadsheets.batchUpdate({
              spreadsheetId: config.sheetId,
              requestBody: {
                requests: updateRequests,
              },
            });
          }
        }
      } catch (topicError) {
        console.error("[Subjects API] Error updating topics:", topicError);
        // Continue even if topic update fails
      }
    }

    return NextResponse.json({ success: true, message: "Subject updated successfully" });
  } catch (error) {
    console.error("[Subjects API] Error updating subject:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update subject" },
      { status: 500 }
    );
  }
}


