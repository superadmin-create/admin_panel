import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db";
import { getQuestionsForSubject } from "@/lib/api/save-questions";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get("subject");
    const topic = searchParams.get("topic");

    if (!subject) {
      return NextResponse.json(
        { success: false, error: "Subject is required" },
        { status: 400 }
      );
    }

    let questions: Array<{
      id: number;
      question: string;
      expectedAnswer: string;
      difficulty: string;
      topic: string;
    }> = [];

    try {
      const dbQuestions = await db.getVivaQuestions(subject);
      if (dbQuestions && dbQuestions.length > 0) {
        questions = dbQuestions.map((q: any, index: number) => ({
          id: q.id || index + 1,
          question: q.question,
          expectedAnswer: q.expected_answer || q.expectedAnswer || "",
          difficulty: q.difficulty || "medium",
          topic: q.topics || q.topic || "",
        }));
        console.log(`[get-questions] Found ${questions.length} questions from database for subject: ${subject}`);
      }
    } catch (dbError) {
      console.error("[get-questions] Database error, falling back to Sheets:", dbError);
    }

    if (questions.length === 0) {
      try {
        const sheetsResult = await getQuestionsForSubject(subject);
        if (sheetsResult.success && sheetsResult.questions && sheetsResult.questions.length > 0) {
          questions = sheetsResult.questions;
          console.log(`[get-questions] Found ${questions.length} questions from Google Sheets for subject: ${subject}`);
        }
      } catch (sheetsError) {
        console.error("[get-questions] Sheets error:", sheetsError);
      }
    }

    if (topic && topic !== "all") {
      const topicNames = topic.split(",").map(t => t.trim().toLowerCase());
      const filtered = questions.filter(q => {
        const qTopic = (q.topic || "").toLowerCase();
        return topicNames.some(t => qTopic.includes(t) || t.includes(qTopic));
      });
      if (filtered.length > 0) {
        questions = filtered;
        console.log(`[get-questions] Filtered to ${questions.length} questions for topic: ${topic}`);
      }
    }

    return NextResponse.json({
      success: true,
      questions,
      count: questions.length,
      source: questions.length > 0 ? "generated" : "none",
    });
  } catch (error) {
    console.error("[get-questions] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch questions" },
      { status: 500 }
    );
  }
}
