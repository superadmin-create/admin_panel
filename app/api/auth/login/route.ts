import { NextRequest, NextResponse } from "next/server";
import { fetchTeacherCredentials } from "@/lib/sheets";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Fetch teacher credentials from Google Sheets
    const credentialsResponse = await fetchTeacherCredentials();

    if (!credentialsResponse.success || !credentialsResponse.data) {
      console.error(
        "[Auth] Failed to fetch teacher credentials:",
        credentialsResponse.error
      );
      
      // Return a more user-friendly error message
      let errorMessage = credentialsResponse.error || "Failed to fetch teacher credentials";
      
      // If it's a permission error, provide detailed instructions
      if (errorMessage.includes("Permission denied") || errorMessage.includes("does not have permission")) {
        return NextResponse.json(
          {
            success: false,
            error: errorMessage,
          },
          { status: 403 } // 403 Forbidden for permission errors
        );
      }
      
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
        },
        { status: 500 }
      );
    }

    // Normalize the email for comparison (case-insensitive)
    const normalizedEmail = email.trim().toLowerCase();

    // Check if credentials match
    const teacher = credentialsResponse.data.find(
      (cred) =>
        cred.username.trim().toLowerCase() === normalizedEmail &&
        cred.password === password
    );

    if (!teacher) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Authentication successful
    return NextResponse.json({
      success: true,
      message: "Authentication successful",
      teacher: {
        username: teacher.username,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        fullName: `${teacher.firstName} ${teacher.lastName}`.trim(),
      },
    });
  } catch (error) {
    console.error("[Auth] Login error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "An error occurred during authentication",
      },
      { status: 500 }
    );
  }
}
