import { NextRequest, NextResponse } from "next/server";
import { getVivaResults } from "@/lib/api/sheets";
import * as db from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherEmail = searchParams.get("teacherEmail");

    // Try to get results from database first
    try {
      const dbResults = await db.getVivaResults(teacherEmail || undefined);
      
      if (dbResults.length > 0) {
        const formattedResults = dbResults.map((r, index) => ({
          id: `VIVA${String(index + 1).padStart(4, '0')}`,
          timestamp: new Date(r.timestamp).toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }),
          studentName: r.student_name,
          studentEmail: r.student_email || '',
          subject: r.subject,
          topics: r.topics,
          questionsAnswered: r.questions_answered,
          score: r.score,
          overallFeedback: r.overall_feedback || '',
          transcript: r.transcript || '',
          recordingUrl: r.recording_url || '',
          evaluation: r.evaluation,
          teacherEmail: (r as any).teacher_email || ''
        }));

        return NextResponse.json({
          success: true,
          data: formattedResults,
          count: formattedResults.length,
          source: 'database'
        });
      }
    } catch (dbError) {
      console.error("[Results API] Database error, falling back to Sheets:", dbError);
    }

    // Fallback to Google Sheets
    const response = await getVivaResults();

    if (!response.success) {
      return NextResponse.json(
        { error: response.error || "Failed to fetch results" },
        { status: 500 }
      );
    }

    let results = response.data || [];
    
    // Filter by teacher if specified
    if (teacherEmail && results.length > 0) {
      results = results.filter((r: any) => r.teacherEmail === teacherEmail);
    }

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
      source: 'sheets'
    });
  } catch (error) {
    console.error("[API] Error fetching results:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


