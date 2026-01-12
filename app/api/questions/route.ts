import { NextRequest, NextResponse } from "next/server";
import { getQuestionsForSubject, getAllQuestions } from "@/lib/api/save-questions";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get("subject");

    if (subject) {
      // Get questions for specific subject
      const result = await getQuestionsForSubject(subject);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Failed to fetch questions" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        subject,
        questions: result.questions,
        count: result.questions?.length || 0,
      });
    } else {
      // Get all questions grouped by subject
      const result = await getAllQuestions();

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Failed to fetch questions" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: result.data,
      });
    }
  } catch (error) {
    console.error("[API] Error fetching questions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


