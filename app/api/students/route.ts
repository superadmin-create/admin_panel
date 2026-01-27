import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherEmail = searchParams.get("teacherEmail");

    let query = `
      SELECT 
        student_name as name,
        student_email as email,
        COUNT(*) as vivas_completed,
        ROUND(AVG(score)::numeric, 1) as average_score,
        MAX(timestamp) as last_viva_date,
        ARRAY_AGG(DISTINCT subject) FILTER (WHERE subject IS NOT NULL AND subject != '') as subjects
      FROM viva_results
      WHERE student_name IS NOT NULL AND student_name != ''
    `;
    
    const params: any[] = [];
    
    if (teacherEmail) {
      query += ` AND teacher_email = $1`;
      params.push(teacherEmail);
    }
    
    query += ` GROUP BY student_name, student_email ORDER BY last_viva_date DESC`;

    const result = await pool.query(query, params);
    
    const students = result.rows.map((row, index) => ({
      id: `STU${String(index + 1).padStart(4, '0')}`,
      name: row.name,
      email: row.email || '',
      vivasCompleted: parseInt(row.vivas_completed) || 0,
      averageScore: parseFloat(row.average_score) || 0,
      lastVivaDate: row.last_viva_date ? new Date(row.last_viva_date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }) : null,
      subjects: row.subjects || [],
      status: parseFloat(row.average_score) >= 50 ? 'active' : 
              parseFloat(row.average_score) >= 30 ? 'at_risk' : 'pending'
    }));

    return NextResponse.json({
      success: true,
      data: students,
      count: students.length,
      source: 'database'
    });
  } catch (error) {
    console.error("[API] Error fetching students:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
