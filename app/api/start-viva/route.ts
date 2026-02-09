import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

const VAPI_API_URL = 'https://api.vapi.ai';

async function getTeacherEmailForSubject(subjectName: string): Promise<string> {
  try {
    const result = await pool.query(
      'SELECT teacher_email FROM subjects WHERE LOWER(name) = LOWER($1) LIMIT 1',
      [subjectName]
    );
    return result.rows[0]?.teacher_email || '';
  } catch {
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentName, studentEmail, subject, topic, phoneNumber } = body;

    if (!studentName || !studentEmail || !subject) {
      return NextResponse.json(
        { error: "Student name, email, and subject are required" },
        { status: 400 }
      );
    }

    const teacherEmail = await getTeacherEmailForSubject(subject);
    const vapiApiKey = process.env.VAPI_API_KEY;
    const vapiPublicKey = process.env.VAPI_PUBLIC_KEY;
    
    if (!vapiApiKey) {
      return NextResponse.json(
        { error: "VAPI is not configured" },
        { status: 500 }
      );
    }

    const systemPrompt = `You are an AI Viva examiner conducting a viva voce examination.

Student Information:
- Name: ${studentName}
- Email: ${studentEmail}

Examination Details:
- Subject: ${subject}
${topic ? `- Topic(s): ${topic}` : ''}
${teacherEmail ? `- Teacher: ${teacherEmail}` : ''}

Instructions:
1. Greet the student by name and introduce yourself as the AI Viva examiner
2. Explain that this is a viva examination for ${subject}${topic ? ` focusing on ${topic}` : ''}
3. Ask 5 progressively challenging questions about the topic
4. Listen carefully to responses and provide follow-up questions when needed
5. Be encouraging but maintain academic rigor
6. At the end, provide a brief summary of the student's performance

Remember to:
- Speak clearly and at a moderate pace
- Give the student time to think and respond
- Probe deeper when answers are superficial
- Note the student's understanding, clarity, and depth of knowledge`;

    const response = await fetch(`${VAPI_API_URL}/call`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Viva: ${studentName} - ${subject}`,
        assistant: {
          name: "AI Viva Examiner",
          model: {
            provider: "openai",
            model: "gpt-4o-mini",
            temperature: 0.7,
            systemPrompt: systemPrompt,
          },
          voice: {
            provider: "11labs",
            voiceId: "21m00Tcm4TlvDq8ikWAM",
          },
          firstMessage: `Hello ${studentName}! I'm your AI Viva examiner. Welcome to your viva examination for ${subject}${topic ? `, focusing on ${topic}` : ''}. Are you ready to begin?`,
          transcriber: {
            provider: "deepgram",
            model: "nova-2",
            language: "en",
          },
          endCallFunctionEnabled: true,
          recordingEnabled: true,
          silenceTimeoutSeconds: 30,
          maxDurationSeconds: 600,
          metadata: {
            studentName,
            studentEmail,
            subject,
            topic: topic || '',
            teacherEmail: teacherEmail || '',
          },
        },
...(phoneNumber && { phoneNumberId: phoneNumber }),
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('VAPI call error:', errorData);
      
      return NextResponse.json(
        { error: "Failed to initiate viva call. Please try again or contact your teacher." },
        { status: 500 }
      );
    }

    const callData = await response.json();

    return NextResponse.json({
      success: true,
      message: "Viva call initiated",
      callId: callData.id,
      webCall: true,
      vapiPublicKey,
      student: { studentName, studentEmail, subject, topic },
    });

  } catch (error) {
    console.error("Error starting viva:", error);
    return NextResponse.json(
      { error: "Failed to start viva session" },
      { status: 500 }
    );
  }
}
