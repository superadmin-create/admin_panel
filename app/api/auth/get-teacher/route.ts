import { NextRequest, NextResponse } from "next/server";
import { fetchTeacherCredentials } from "@/lib/sheets";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    // Fetch teacher credentials from Google Sheets
    const credentialsResponse = await fetchTeacherCredentials();

    if (!credentialsResponse.success || !credentialsResponse.data) {
      return NextResponse.json(
        {
          success: false,
          error: credentialsResponse.error || "Failed to fetch teacher credentials",
        },
        { status: 500 }
      );
    }

    // Normalize the email for comparison (case-insensitive)
    const normalizedEmail = email.trim().toLowerCase();

    // Find teacher by email
    const teacher = credentialsResponse.data.find(
      (cred) => cred.username.trim().toLowerCase() === normalizedEmail
    );

    if (!teacher) {
      return NextResponse.json(
        { success: false, error: "Teacher not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      teacher: {
        username: teacher.username,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        fullName: `${teacher.firstName} ${teacher.lastName}`.trim(),
      },
    });
  } catch (error) {
    console.error("[Auth] Get teacher error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "An error occurred",
      },
      { status: 500 }
    );
  }
}
