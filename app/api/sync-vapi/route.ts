import { NextResponse } from "next/server";
import { queryWithRetry } from "@/lib/db";
import { appendVivaResultToSheet } from "@/lib/api/sheets-service-account";
import { google } from "googleapis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VAPI_API_URL = "https://api.vapi.ai";
const STUDENT_DATA_SHEET_ID = "1dPderiJxJl534xNnzHVVqye9VSx3zZY3ZEgO3vjqpFY";

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

interface SheetRow {
  studentName: string;
  studentEmail: string;
  subject: string;
  score: number;
  questionsAnswered: number;
  overallFeedback: string;
  evaluation: any;
  timestamp: string;
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

function tryParseJSON(str: string): any {
  try {
    const trimmed = str.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return JSON.parse(trimmed);
    }
  } catch {}
  return null;
}

async function fetchSheetsData(): Promise<SheetRow[]> {
  try {
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    if (!privateKey || !clientEmail) return [];

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: STUDENT_DATA_SHEET_ID,
      range: "'Viva Results'!A2:K",
    });

    const rows = response.data.values || [];
    return rows
      .map((row: any[]) => ({
        timestamp: row[0] || "",
        studentName: row[1] || "",
        studentEmail: row[2] || "",
        subject: row[3] || "",
        questionsAnswered: parseInt(row[5]) || 0,
        score: parseInt(String(row[6]).match(/(\d+)/)?.[1] || "0") || 0,
        overallFeedback: row[7] || "",
        evaluation: row[10] ? tryParseJSON(row[10]) : null,
      }))
      .filter((r: SheetRow) => r.studentName && r.studentName.toLowerCase() !== "unknown student");
  } catch (error: any) {
    console.log("[Sync VAPI] Could not fetch Sheets data:", error.message);
    return [];
  }
}

function findSheetMatch(sheetsData: SheetRow[], studentName: string, subject: string, timestamp: Date): SheetRow | null {
  for (const row of sheetsData) {
    if (row.studentName.toLowerCase() === studentName.toLowerCase() &&
        row.subject.toLowerCase() === subject.toLowerCase()) {
      const rowDate = new Date(row.timestamp).getTime();
      const targetDate = timestamp.getTime();
      const timeDiff = Math.abs(rowDate - targetDate);
      if (timeDiff < 10 * 60 * 1000) {
        return row;
      }
    }
  }
  for (const row of sheetsData) {
    if (row.studentName.toLowerCase() === studentName.toLowerCase() &&
        row.subject.toLowerCase() === subject.toLowerCase() &&
        row.score > 0) {
      return row;
    }
  }
  return null;
}

export async function POST() {
  try {
    const apiKey = process.env.VAPI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "VAPI API key not configured" }, { status: 500 });
    }

    const sheetsData = await fetchSheetsData();
    console.log(`[Sync VAPI] Loaded ${sheetsData.length} rows from Google Sheets`);

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

    console.log(`[Sync VAPI] Fetched ${allCalls.length} calls from VAPI`);

    const invalidNames = ["unknown student", "unknown", "transient assistant", "", "test", "test user"];
    const invalidSubjects = ["transient assistant", "unknown subject", "unknown", ""];

    let synced = 0;
    let updated = 0;
    let enriched = 0;
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

      const sheetMatch = findSheetMatch(sheetsData, data.studentName, data.subject, data.timestamp);
      const bestScore = (sheetMatch && sheetMatch.score > data.score) ? sheetMatch.score : data.score;
      const bestQuestionsAnswered = (sheetMatch && sheetMatch.questionsAnswered > data.questionsAnswered) ? sheetMatch.questionsAnswered : data.questionsAnswered;
      const bestFeedback = data.overallFeedback || (sheetMatch?.overallFeedback || "");
      const bestEvaluation = data.evaluation || sheetMatch?.evaluation || null;
      const bestEmail = data.studentEmail || (sheetMatch?.studentEmail || "");

      const existing = await queryWithRetry(
        "SELECT id, score, teacher_email FROM viva_results WHERE vapi_call_id = $1",
        [data.vapiCallId]
      );

      if (existing.rows.length > 0) {
        const currentScore = existing.rows[0].score || 0;
        const currentTeacher = existing.rows[0].teacher_email || "";
        const finalScore = Math.max(currentScore, bestScore);
        const finalTeacher = teacherEmail || currentTeacher;

        await queryWithRetry(
          `UPDATE viva_results SET 
           student_name = $1, student_email = $2, subject = $3, 
           topics = $4, questions_answered = GREATEST(questions_answered, $5), 
           score = GREATEST(score, $6), 
           overall_feedback = CASE WHEN $7 != '' THEN $7 ELSE overall_feedback END, 
           transcript = CASE WHEN $8 != '' THEN $8 ELSE transcript END, 
           recording_url = COALESCE(NULLIF($9, ''), recording_url),
           evaluation = COALESCE($10, evaluation), 
           teacher_email = COALESCE(NULLIF($11, ''), teacher_email)
           WHERE vapi_call_id = $12`,
          [
            data.studentName,
            bestEmail,
            data.subject,
            data.topics,
            bestQuestionsAnswered,
            bestScore,
            bestFeedback,
            data.transcript,
            data.recordingUrl,
            bestEvaluation ? JSON.stringify(bestEvaluation) : null,
            finalTeacher,
            data.vapiCallId,
          ]
        );

        if ((currentScore === 0 && finalScore > 0) || (!currentTeacher && finalTeacher)) {
          enriched++;
        }
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
            bestEmail,
            data.subject,
            data.topics,
            bestQuestionsAnswered,
            bestScore,
            bestFeedback,
            data.transcript,
            data.recordingUrl,
            bestEvaluation ? JSON.stringify(bestEvaluation) : null,
            data.vapiCallId,
            teacherEmail,
          ]
        );
        synced++;

        try {
          await appendVivaResultToSheet({
            studentName: data.studentName,
            studentEmail: bestEmail,
            subject: data.subject,
            topic: data.topics,
            questionsAnswered: bestQuestionsAnswered,
            score: bestScore,
            overallFeedback: bestFeedback,
            transcript: data.transcript,
            recordingUrl: data.recordingUrl,
            evaluation: bestEvaluation,
            vapiCallId: data.vapiCallId,
          });
          sheetsSynced++;
        } catch (e) {
          console.error("[Sync VAPI] Sheet append error:", e);
        }
      }
    }

    const enrichMsg = enriched > 0 ? `, ${enriched} enriched from Sheets` : "";
    return NextResponse.json({
      success: true,
      totalCalls: allCalls.length,
      sheetsRows: sheetsData.length,
      newResults: synced,
      updatedResults: updated,
      enrichedResults: enriched,
      skipped,
      sheetsSynced,
      message: `Synced from VAPI: ${synced} new, ${updated} updated${enrichMsg}, ${skipped} skipped, ${sheetsSynced} added to Sheets`,
    });
  } catch (error: any) {
    console.error("[Sync VAPI] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync from VAPI" },
      { status: 500 }
    );
  }
}
