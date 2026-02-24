import { NextResponse } from "next/server";
import { queryWithRetry } from "@/lib/db";
import OpenAI from "openai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateMarksBreakdown(transcript: string, subject: string, studentName: string) {
  if (!transcript || transcript.length < 50) return null;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert viva examiner. Analyze the following viva transcript and provide an evaluation. 
The viva is for ${subject} with student ${studentName}.

Evaluate based on:
1. Knowledge accuracy and depth
2. Clarity of explanations
3. Ability to answer follow-up questions
4. Overall understanding of the topic

IMPORTANT: Extract each question asked and the student's answer, then assign marks to each.

Respond in JSON format only:
{
  "score": <number 0-100>,
  "questionsAnswered": <number of questions the student answered>,
  "overallFeedback": "<2-3 sentence summary of performance>",
  "evaluation": {
    "knowledge": <score 0-100>,
    "clarity": <score 0-100>,
    "depth": <score 0-100>,
    "strengths": ["<strength1>", "<strength2>"],
    "improvements": ["<area1>", "<area2>"]
  },
  "marksBreakdown": [
    {
      "questionNumber": 1,
      "question": "<the question asked>",
      "answer": "<student's answer summary>",
      "marks": <marks out of 10>,
      "maxMarks": 10,
      "feedback": "<brief feedback on this answer>"
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Transcript:\n${transcript.substring(0, 8000)}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    return JSON.parse(content);
  } catch (error) {
    console.error(`[Backfill] AI evaluation failed for ${studentName}:`, error);
    return null;
  }
}

export async function POST() {
  try {
    const result = await queryWithRetry(
      `SELECT id, student_name, subject, transcript, score, evaluation FROM viva_results 
       WHERE marks_breakdown IS NULL
       AND transcript IS NOT NULL AND LENGTH(transcript) > 100
       AND student_name != 'Unknown Student'
       AND subject != 'Unknown Subject'
       AND subject != 'Transient Assistant'
       ORDER BY timestamp DESC LIMIT 5`
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All records already have marks breakdown",
        processed: 0,
        remaining: 0,
      });
    }

    const totalMissing = await queryWithRetry(
      `SELECT COUNT(*) as count FROM viva_results 
       WHERE marks_breakdown IS NULL
       AND transcript IS NOT NULL AND LENGTH(transcript) > 100
       AND student_name != 'Unknown Student'
       AND subject != 'Unknown Subject'
       AND subject != 'Transient Assistant'`
    );

    let processed = 0;
    const details: string[] = [];

    for (const row of result.rows) {
      const aiResult = await generateMarksBreakdown(
        row.transcript,
        row.subject,
        row.student_name
      );

      if (aiResult && aiResult.marksBreakdown) {
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        updates.push(`marks_breakdown = $${paramIndex}`);
        values.push(JSON.stringify(aiResult.marksBreakdown));
        paramIndex++;

        if (!row.evaluation && aiResult.evaluation) {
          updates.push(`evaluation = $${paramIndex}`);
          values.push(JSON.stringify(aiResult.evaluation));
          paramIndex++;
        }

        if ((!row.score || row.score === 0) && aiResult.score > 0) {
          updates.push(`score = $${paramIndex}`);
          values.push(aiResult.score);
          paramIndex++;
          updates.push(`questions_answered = $${paramIndex}`);
          values.push(aiResult.questionsAnswered || 0);
          paramIndex++;
          updates.push(`overall_feedback = $${paramIndex}`);
          values.push(aiResult.overallFeedback || "");
          paramIndex++;
        }

        values.push(row.id);

        await queryWithRetry(
          `UPDATE viva_results SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
          values
        );

        processed++;
        details.push(
          `${row.student_name} (id: ${row.id}) - ${aiResult.marksBreakdown.length} questions`
        );
      }
    }

    const remaining = parseInt(totalMissing.rows[0].count) - processed;

    return NextResponse.json({
      success: true,
      message: `Generated marks breakdown for ${processed} records`,
      processed,
      remaining,
      details,
    });
  } catch (error) {
    console.error("[Backfill] Error:", error);
    return NextResponse.json(
      { error: "Failed to backfill marks" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const result = await queryWithRetry(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE marks_breakdown IS NOT NULL) as has_marks,
        COUNT(*) FILTER (WHERE marks_breakdown IS NULL) as missing_marks,
        COUNT(*) FILTER (WHERE marks_breakdown IS NULL AND transcript IS NOT NULL AND LENGTH(transcript) > 100) as can_generate
       FROM viva_results
       WHERE student_name != 'Unknown Student' AND subject != 'Unknown Subject' AND subject != 'Transient Assistant'`
    );

    return NextResponse.json({
      total: parseInt(result.rows[0].total),
      hasMarks: parseInt(result.rows[0].has_marks),
      missingMarks: parseInt(result.rows[0].missing_marks),
      canGenerate: parseInt(result.rows[0].can_generate),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to get backfill status" },
      { status: 500 }
    );
  }
}
