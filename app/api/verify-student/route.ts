import { NextResponse } from "next/server";
import { verifyStudent } from "@/lib/api/edmingle";
import type { EdmingleVerifyStudentResponse } from "@/lib/types/edmingle";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    try {
      const result: EdmingleVerifyStudentResponse = await verifyStudent(email);

      if (result.verified && result.studentData) {
        return NextResponse.json({
          verified: true,
          studentData: {
            name: result.studentData.fullName || 
              `${result.studentData.firstName} ${result.studentData.lastName}`.trim(),
            email: result.studentData.email,
            enrolledCourses: result.studentData.enrolledCourses || [],
            batchId: result.studentData.batchId,
            courseId: result.studentData.courseId,
          },
        });
      }

      return NextResponse.json(
        {
          verified: false,
          error: "Student not found in the system",
        },
        { status: 404 }
      );
    } catch (error) {
      console.error("Error verifying student with Edmingle:", error);

      if (error instanceof Error && error.message.includes("not configured")) {
        return NextResponse.json(
          {
            verified: false,
            error: "LMS service is not configured. Please contact administrator.",
          },
          { status: 503 }
        );
      }

      if (error instanceof Error && error.message.includes("Unable to connect")) {
        return NextResponse.json(
          {
            verified: false,
            error: "Unable to connect to student database. Please try again later.",
          },
          { status: 503 }
        );
      }

      if (error instanceof Error && 
          (error.message.includes("404") || 
           error.message.includes("Not Found") ||
           error.message.includes("No such user"))) {
        return NextResponse.json(
          {
            verified: false,
            error: "Student not found in the system",
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          verified: false,
          error: "Failed to verify student. Please try again later.",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in verify-student route:", error);
    return NextResponse.json(
      {
        verified: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
