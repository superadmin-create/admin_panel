import { NextRequest, NextResponse } from "next/server";
import { getVivaResults } from "@/lib/api/sheets";
import * as db from "@/lib/db";

export const dynamic = "force-dynamic";

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherEmail = searchParams.get("teacherEmail");

    try {
      const dbResults = await withTimeout(
        db.getVivaResults(teacherEmail || undefined),
        15000,
        "Database query"
      );
      
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
          marksBreakdown: (r as any).marks_breakdown || null,
          teacherEmail: (r as any).teacher_email || ''
        }));

        return NextResponse.json({
          success: true,
          data: formattedResults,
          count: formattedResults.length,
          source: 'database'
        });
      }
    } catch (dbError: any) {
      console.error("[Results API] Database error, falling back to Sheets:", dbError?.message || dbError);
    }

    try {
      const response = await withTimeout(
        getVivaResults(),
        15000,
        "Google Sheets query"
      );

      if (!response.success) {
        return NextResponse.json({
          success: true,
          data: [],
          count: 0,
          source: 'none',
          message: 'No results available. Try clicking Sync Results to fetch from VAPI.'
        });
      }

      let results = response.data || [];
      
      if (teacherEmail && results.length > 0) {
        const hasTeacherEmail = results.some((r: any) => r.teacherEmail);
        if (hasTeacherEmail) {
          results = results.filter((r: any) => r.teacherEmail === teacherEmail);
        }
      }

      return NextResponse.json({
        success: true,
        data: results,
        count: results.length,
        source: 'sheets'
      });
    } catch (sheetsError: any) {
      console.error("[Results API] Sheets error:", sheetsError?.message || sheetsError);
    }

    return NextResponse.json({
      success: true,
      data: [],
      count: 0,
      source: 'none',
      message: 'Could not reach database or Google Sheets. Try clicking Sync Results.'
    });
  } catch (error) {
    console.error("[API] Error fetching results:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


