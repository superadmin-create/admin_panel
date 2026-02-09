import { NextRequest, NextResponse } from "next/server";
import { fetchTeacherCredentials } from "@/lib/sheets";
import { getGoogleSheetsClient } from "@/lib/api/sheets";

const TEACHER_SHEET_ID = "1or1TVnD6Py-gZ1dSP25CJjwufDeQ_Pi-s1tKls3lq_0";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentEmail, firstName, lastName, phone, department } = body;

    if (!currentEmail) {
      return NextResponse.json(
        { success: false, error: "Current email is required" },
        { status: 400 }
      );
    }

    const credentialsResponse = await fetchTeacherCredentials();
    if (!credentialsResponse.success || !credentialsResponse.data) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch teacher data" },
        { status: 500 }
      );
    }

    const normalizedEmail = currentEmail.trim().toLowerCase();
    const teacherIndex = credentialsResponse.data.findIndex(
      (cred) => cred.username.trim().toLowerCase() === normalizedEmail
    );

    if (teacherIndex === -1) {
      return NextResponse.json(
        { success: false, error: "Teacher not found" },
        { status: 404 }
      );
    }

    const sheets = await getGoogleSheetsClient();

    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: TEACHER_SHEET_ID,
    });
    const sheetName = spreadsheet.data.sheets?.[0]?.properties?.title || "Sheet1";

    const rowIndex = teacherIndex + 2;

    const updates: { range: string; values: string[][] }[] = [];

    if (firstName !== undefined) {
      updates.push({
        range: `'${sheetName}'!C${rowIndex}`,
        values: [[firstName]],
      });
    }

    if (lastName !== undefined) {
      updates.push({
        range: `'${sheetName}'!D${rowIndex}`,
        values: [[lastName]],
      });
    }

    if (phone !== undefined) {
      updates.push({
        range: `'${sheetName}'!E${rowIndex}`,
        values: [[phone]],
      });
    }

    if (department !== undefined) {
      updates.push({
        range: `'${sheetName}'!F${rowIndex}`,
        values: [[department]],
      });
    }

    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: TEACHER_SHEET_ID,
        requestBody: {
          valueInputOption: "RAW",
          data: updates,
        },
      });
    }

    return NextResponse.json({
      success: true,
      teacher: {
        username: currentEmail,
        firstName: firstName ?? credentialsResponse.data[teacherIndex].firstName,
        lastName: lastName ?? credentialsResponse.data[teacherIndex].lastName,
        phone: phone || "",
        department: department || "",
      },
    });
  } catch (error) {
    console.error("[Auth] Update profile error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
