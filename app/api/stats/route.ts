import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherEmail = searchParams.get("teacherEmail");
    
    // Only return results for the logged-in teacher
    // If no teacher email provided, return empty stats
    if (!teacherEmail) {
      return NextResponse.json({
        success: true,
        data: {
          totalVivas: 0,
          totalPassed: 0,
          totalFailed: 0,
          avgScore: 0,
          subjectStats: {},
          recentResults: [],
        },
      });
    }
    
    const results = await db.getVivaResults(teacherEmail);
    
    const passingScore = 50;
    const totalVivas = results.length;
    const totalPassed = results.filter((r) => r.score >= passingScore).length;
    const totalFailed = totalVivas - totalPassed;
    const avgScore = totalVivas > 0
      ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / totalVivas)
      : 0;

    const subjectMap = new Map<string, { scores: number[]; passed: number; count: number }>();

    for (const result of results) {
      const subject = result.subject;
      if (!subjectMap.has(subject)) {
        subjectMap.set(subject, { scores: [], passed: 0, count: 0 });
      }
      const stats = subjectMap.get(subject)!;
      stats.scores.push(result.score);
      stats.count++;
      if (result.score >= passingScore) {
        stats.passed++;
      }
    }

    const subjectStats: Record<string, { count: number; avgScore: number; passRate: number }> = {};

    subjectMap.forEach((stats, subject) => {
      subjectStats[subject] = {
        count: stats.count,
        avgScore: stats.count > 0
          ? Math.round(stats.scores.reduce((a, b) => a + b, 0) / stats.count)
          : 0,
        passRate: stats.count > 0 ? Math.round((stats.passed / stats.count) * 100) : 0,
      };
    });

    const recentResults = results.slice(0, 10).map((r, index) => ({
      id: `VIVA${String(index + 1).padStart(4, '0')}`,
      timestamp: new Date(r.timestamp).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      }),
      studentName: r.student_name,
      studentEmail: r.student_email || '',
      subject: r.subject,
      topics: r.topics,
      questionsAnswered: r.questions_answered,
      score: r.score,
      overallFeedback: r.overall_feedback || '',
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalVivas,
        totalPassed,
        totalFailed,
        avgScore,
        subjectStats,
        recentResults,
      },
    });
  } catch (error) {
    console.error("[API] Error fetching stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


