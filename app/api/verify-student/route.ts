import { NextResponse } from "next/server";
import { verifyStudent } from "@/lib/api/edmingle";
import type { EdmingleVerifyStudentResponse } from "@/lib/types/edmingle";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, phone } = body;

    if (!email && !phone) {
      return NextResponse.json(
        { error: "Email or phone is required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    try {
      const result: EdmingleVerifyStudentResponse = await verifyStudent(
        email || phone
      );

      if (result.verified && result.studentData) {
        return NextResponse.json({
          success: true,
          verified: true,
          studentData: {
            name: result.studentData.fullName || 
              `${result.studentData.firstName} ${result.studentData.lastName}`.trim(),
            email: result.studentData.email,
            phone: result.studentData.phone,
            enrolledCourses: result.studentData.enrolledCourses || [],
            batchId: result.studentData.batchId,
            courseId: result.studentData.courseId,
          },
        });
      }

      return NextResponse.json({
        success: true,
        verified: false,
        message: "Student not found. Please ensure you are registered with your institution.",
      });
    } catch (error) {
      console.error("Error verifying student with Edmingle:", error);

      if (error instanceof Error && error.message.includes("not configured")) {
        return NextResponse.json(
          {
            success: false,
            verified: false,
            message: "LMS service is not configured. Please contact administrator.",
          },
          { status: 503 }
        );
      }

      if (error instanceof Error && error.message.includes("Unable to connect")) {
        return NextResponse.json(
          {
            success: false,
            verified: false,
            message: "Unable to connect to student database. Please try again later.",
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          verified: false,
          message: "Failed to verify student. Please try again later.",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in verify-student route:", error);
    return NextResponse.json(
      {
        success: false,
        verified: false,
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}
