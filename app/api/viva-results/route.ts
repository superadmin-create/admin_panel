import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { fetchVivaResults } from "@/lib/sheets";

export const dynamic = "force-dynamic";

interface VivaResult {
  id: string;
  dateTime: string;
  studentName: string;
  email: string;
  subject: string;
  topics: string;
  questionsAnswered: string;
  score: number;
  overallFeedback: string;
  transcript: string;
  recordingUrl: string;
  status: "passed" | "failed";
}

export async function GET() {
  try {
    const dbResult = await pool.query(
      `SELECT * FROM viva_results ORDER BY timestamp DESC`
    );

    if (dbResult.rows.length > 0) {
      const data: VivaResult[] = dbResult.rows.map((row, index) => ({
        id: `VIVA${String(row.id).padStart(3, "0")}`,
        dateTime: row.timestamp?.toISOString() || new Date().toISOString(),
        studentName: row.student_name || "Unknown",
        email: row.student_email || "",
        subject: row.subject || "Unknown Subject",
        topics: row.topics || "",
        questionsAnswered: String(row.questions_answered || 0),
        score: row.score || 0,
        overallFeedback: row.overall_feedback || "",
        transcript: row.transcript || "",
        recordingUrl: row.recording_url || "",
        status: (row.score >= 50 ? "passed" : "failed") as "passed" | "failed"
      }));

      return NextResponse.json({
        success: true,
        data,
        count: data.length,
        source: "database"
      });
    }

    const sheetsResult = await fetchVivaResults();
    
    if (!sheetsResult.success) {
      return NextResponse.json(
        { error: sheetsResult.error || "Failed to fetch results" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: sheetsResult.data,
      count: sheetsResult.data?.length || 0,
      source: "google_sheets"
    });
  } catch (error) {
    console.error("[API] Error fetching viva results:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
