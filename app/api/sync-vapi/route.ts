import { NextResponse } from "next/server";
import { queryWithRetry } from "@/lib/db";
import { appendVivaResultToSheet } from "@/lib/api/sheets-service-account";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VAPI_API_URL = "https://api.vapi.ai";

interface VapiCall {
  id: string;
  status: string;
  createdAt: string;
  customer?: { name?: string; email?: string };
  assistant?: { name?: string };
  analysis?: {
    summary?: string;
    structuredData?: Record<string, any>;
  };
  artifact?: {
    transcript?: string;
    recordingUrl?: string;
  };
  messages?: { role: string; message: string }[];
  transcript?: string;
  recordingUrl?: string;
  metadata?: Record<string, any>;
}

function parseSystemPrompt(call: VapiCall): { studentName?: string; studentEmail?: string; subject?: string; topics?: string } {
  const messages = (call as any).messages || [];
  const systemMsg = messages.find((m: any) => m.role === "system");
  if (!systemMsg?.message) return {};

  const content = systemMsg.message;
  const result: { studentName?: string; studentEmail?: string; subject?: string; topics?: string } = {};

  const nameMatch = content.match(/Name:\s*([^\n]+)/i);
  if (nameMatch) result.studentName = nameMatch[1].trim();

  const emailMatch = content.match(/Email:\s*([^\n\s]+@[^\n\s]+)/i);
  if (emailMatch) result.studentEmail = emailMatch[1].trim();

  const subjectMatch = content.match(/Subject:\s*([^\n]+)/i);
  if (subjectMatch) result.subject = subjectMatch[1].trim();

  const topicsMatch = content.match(/Topics?:\s*([^\n]+)/i);
  if (topicsMatch) result.topics = topicsMatch[1].trim();

  return result;
}

function extractVivaData(call: VapiCall) {
  const structuredData = call.analysis?.structuredData || {};
  const parsedPrompt = parseSystemPrompt(call);

  const studentName = structuredData.studentName || parsedPrompt.studentName || call.customer?.name || "Unknown Student";
  const studentEmail = structuredData.studentEmail || structuredData.email || parsedPrompt.studentEmail || (call.customer as any)?.email || "";
  const subject = structuredData.subject || parsedPrompt.subject || call.assistant?.name || "Unknown Subject";
  const topics = structuredData.topics || structuredData.topic || parsedPrompt.topics || "";
  const questionsAnswered = structuredData.questionsAnswered || structuredData.totalQuestions || 0;
  const score = structuredData.score || structuredData.totalMarks || structuredData.marks || 0;
  const overallFeedback = structuredData.overallFeedback || structuredData.feedback || call.analysis?.summary || "";
  const evaluation = structuredData.evaluation || (structuredData.marks ? { marks: structuredData.marks, feedback: structuredData.feedback } : null);
  const transcript = call.artifact?.transcript || (call as any).transcript || "";
  const recordingUrl = call.artifact?.recordingUrl || (call as any).recordingUrl || "";

  return {
    timestamp: new Date(call.createdAt),
    studentName,
    studentEmail,
    subject,
    topics: typeof topics === "string" ? topics : JSON.stringify(topics),
    questionsAnswered: typeof questionsAnswered === "number" ? questionsAnswered : parseInt(String(questionsAnswered)) || 0,
    score: typeof score === "number" ? score : parseInt(String(score)) || 0,
    overallFeedback,
    transcript,
    recordingUrl,
    evaluation,
    vapiCallId: call.id,
  };
}

async function getTeacherEmailForSubject(subjectName: string): Promise<string> {
  try {
    const result = await queryWithRetry(
      "SELECT teacher_email FROM subjects WHERE LOWER(name) = LOWER($1) AND teacher_email IS NOT NULL AND teacher_email != '' LIMIT 1",
      [subjectName]
    );
    return result.rows[0]?.teacher_email || "";
  } catch {
    return "";
  }
}

export async function POST() {
  try {
    const apiKey = process.env.VAPI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "VAPI API key not configured" }, { status: 500 });
    }

    const allCalls: VapiCall[] = [];
    let createdAtLt: string | null = null;
    let hasMore = true;

    while (hasMore) {
      let url = `${VAPI_API_URL}/call?limit=100`;
      if (createdAtLt) {
        url += `&createdAtLt=${encodeURIComponent(createdAtLt)}`;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: `VAPI API error: ${response.status} ${response.statusText}` },
          { status: 502 }
        );
      }

      const calls: VapiCall[] = await response.json();

      if (calls.length === 0) {
        hasMore = false;
      } else {
        allCalls.push(...calls);
        createdAtLt = calls[calls.length - 1].createdAt;
        if (calls.length < 100) {
          hasMore = false;
        }
      }
    }

    const invalidNames = ["unknown student", "unknown", "transient assistant", "", "test", "test user"];
    const invalidSubjects = ["transient assistant", "unknown subject", "unknown", ""];

    let synced = 0;
    let updated = 0;
    let skipped = 0;
    let sheetsSynced = 0;

    for (const call of allCalls) {
      if (call.status !== "ended") {
        skipped++;
        continue;
      }

      const data = extractVivaData(call);

      if (
        invalidNames.includes(data.studentName.toLowerCase()) ||
        invalidSubjects.includes(data.subject.toLowerCase())
      ) {
        skipped++;
        continue;
      }

      let teacherEmail = (call.metadata as any)?.teacherEmail || "";
      if (!teacherEmail) {
        teacherEmail = await getTeacherEmailForSubject(data.subject);
      }

      const existing = await queryWithRetry(
        "SELECT id FROM viva_results WHERE vapi_call_id = $1",
        [data.vapiCallId]
      );

      if (existing.rows.length > 0) {
        await queryWithRetry(
          `UPDATE viva_results SET 
           timestamp = $1, student_name = $2, student_email = $3, subject = $4, 
           topics = $5, questions_answered = $6, score = $7, overall_feedback = $8, 
           transcript = $9, recording_url = $10, evaluation = $11, teacher_email = $12
           WHERE vapi_call_id = $13`,
          [
            data.timestamp,
            data.studentName,
            data.studentEmail,
            data.subject,
            data.topics,
            data.questionsAnswered,
            data.score,
            data.overallFeedback,
            data.transcript,
            data.recordingUrl,
            data.evaluation ? JSON.stringify(data.evaluation) : null,
            teacherEmail,
            data.vapiCallId,
          ]
        );
        updated++;
      } else {
        await queryWithRetry(
          `INSERT INTO viva_results 
           (timestamp, student_name, student_email, subject, topics, questions_answered, 
            score, overall_feedback, transcript, recording_url, evaluation, vapi_call_id, teacher_email) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            data.timestamp,
            data.studentName,
            data.studentEmail,
            data.subject,
            data.topics,
            data.questionsAnswered,
            data.score,
            data.overallFeedback,
            data.transcript,
            data.recordingUrl,
            data.evaluation ? JSON.stringify(data.evaluation) : null,
            data.vapiCallId,
            teacherEmail,
          ]
        );
        synced++;

        try {
          await appendVivaResultToSheet({
            studentName: data.studentName,
            studentEmail: data.studentEmail,
            subject: data.subject,
            topic: data.topics,
            questionsAnswered: data.questionsAnswered,
            score: data.score,
            overallFeedback: data.overallFeedback,
            transcript: data.transcript,
            recordingUrl: data.recordingUrl,
            evaluation: data.evaluation,
            vapiCallId: data.vapiCallId,
          });
          sheetsSynced++;
        } catch (e) {
          console.error("[Sync VAPI] Sheet append error:", e);
        }
      }
    }

    return NextResponse.json({
      success: true,
      totalCalls: allCalls.length,
      newResults: synced,
      updatedResults: updated,
      skipped,
      sheetsSynced,
      message: `Synced from VAPI: ${synced} new, ${updated} updated, ${skipped} skipped, ${sheetsSynced} added to Sheets`,
    });
  } catch (error: any) {
    console.error("[Sync VAPI] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync from VAPI" },
      { status: 500 }
    );
  }
}
