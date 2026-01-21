import { NextRequest, NextResponse } from "next/server";
import { STUDENT_DATA_SHEET_ID, getGoogleSheetsClient } from "@/lib/api/sheets";

const SUBJECTS_SHEET_NAME = "Subjects";

export async function GET() {
  try {
    const sheets = await getGoogleSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: `'${SUBJECTS_SHEET_NAME}'!A2:C100`,
    });

    const rows = response.data.values || [];
    
    const subjects = rows
      .filter((row) => row[0])
      .map((row, index) => ({
        id: index + 1,
        name: row[0] || "",
        code: row[1] || "",
        status: row[2] || "active",
      }));

    return NextResponse.json({ success: true, subjects });
  } catch (error: unknown) {
    console.error("[Subjects API] Error fetching subjects:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (errorMessage.includes("Unable to parse range")) {
      return NextResponse.json({ success: true, subjects: [] });
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Subject name is required" },
        { status: 400 }
      );
    }

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
                properties: {
                  title: SUBJECTS_SHEET_NAME,
                },
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

    await sheets.spreadsheets.values.append({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: `'${SUBJECTS_SHEET_NAME}'!A:C`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[name, code || "", "active"]],
      },
    });

    return NextResponse.json({ success: true, message: "Subject added successfully" });
  } catch (error) {
    console.error("[Subjects API] Error adding subject:", error);
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
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Subject name is required" },
        { status: 400 }
      );
    }

    const sheets = await getGoogleSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
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

    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
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

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: subjectsSheet.properties.sheetId,
                dimension: "ROWS",
                startIndex: rowIndex + 1,
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
    const { oldName, newName, code } = body;

    if (!oldName || !newName) {
      return NextResponse.json(
        { success: false, error: "Old name and new name are required" },
        { status: 400 }
      );
    }

    const sheets = await getGoogleSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
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

    const updateRow = rowIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: `'${SUBJECTS_SHEET_NAME}'!A${updateRow}:C${updateRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[newName, code !== undefined ? code : (rows[rowIndex][1] || ""), rows[rowIndex][2] || "active"]],
      },
    });

    if (oldName !== newName) {
      try {
        const topicsResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: STUDENT_DATA_SHEET_ID,
          range: `'Topics'!A2:C100`,
        });

        const topicRows = topicsResponse.data.values || [];
        const topicsToUpdate: number[] = [];

        topicRows.forEach((row, index) => {
          if (row[0] === oldName) {
            topicsToUpdate.push(index + 2);
          }
        });

        if (topicsToUpdate.length > 0) {
          const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: STUDENT_DATA_SHEET_ID,
          });

          const topicsSheet = spreadsheet.data.sheets?.find(
            (s) => s.properties?.title === "Topics"
          );

          if (topicsSheet?.properties?.sheetId) {
            const updateRequests = topicsToUpdate.map((rowNum) => ({
              updateCells: {
                range: {
                  sheetId: topicsSheet.properties!.sheetId,
                  startRowIndex: rowNum - 1,
                  endRowIndex: rowNum,
                  startColumnIndex: 0,
                  endColumnIndex: 1,
                },
                rows: [{ values: [{ userEnteredValue: { stringValue: newName } }] }],
                fields: "userEnteredValue",
              },
            }));

            await sheets.spreadsheets.batchUpdate({
              spreadsheetId: STUDENT_DATA_SHEET_ID,
              requestBody: {
                requests: updateRequests,
              },
            });
          }
        }
      } catch (topicError) {
        console.error("[Subjects API] Error updating topics:", topicError);
      }
    }

    return NextResponse.json({ success: true, message: "Subject updated successfully" });
  } catch (error) {
    console.error("[Subjects API] Error updating subject:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
