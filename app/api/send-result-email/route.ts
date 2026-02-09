import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

// Lazy initialization to avoid build-time errors when API key is not set
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

interface QuestionFeedback {
  questionNumber: number;
  question: string;
  answer: string;
  marks: number;
  maxMarks: number;
  feedback: string;
  strengths?: string[];
  weaknesses?: string[];
}

function formatEmailHTML(result: {
  studentName: string;
  subject: string;
  topics: string;
  score: number;
  questionsAnswered: number;
  overallFeedback: string;
  transcript: string;
  timestamp: string;
  evaluation?: {
    marks?: Array<{
      questionNumber: number;
      question: string;
      answer: string;
      marks: number;
      maxMarks: number;
    }>;
    feedback?: Array<{
      questionNumber: number;
      feedback: string;
      strengths?: string[];
      weaknesses?: string[];
    }>;
  };
}): string {
  const passingScore = 50;
  const isPassed = result.score >= passingScore;
  const scoreColor = isPassed ? (result.score >= 80 ? "#10b981" : "#f59e0b") : "#ef4444";
  
  // Parse transcript into Q&A pairs
  const parseTranscript = (transcript: string) => {
    if (!transcript) return [];
    const lines = transcript.split("\n").filter((line) => line.trim());
    const qaPairs: { role: string; content: string }[] = [];
    for (const line of lines) {
      if (line.startsWith("AI:") || line.startsWith("Student:")) {
        const [role, ...contentParts] = line.split(":");
        qaPairs.push({
          role: role.trim(),
          content: contentParts.join(":").trim(),
        });
      }
    }
    return qaPairs;
  };

  const qaPairs = parseTranscript(result.transcript);
  const formattedDate = new Date(result.timestamp).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Viva Results</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">AI Viva Examination Results</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
    <p style="font-size: 16px; margin-bottom: 20px;">Dear ${result.studentName},</p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      Thank you for completing your AI Viva examination. Please find your results below:
    </p>

    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h2 style="color: #1f2937; margin-top: 0; font-size: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Examination Details</h2>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Subject:</td>
          <td style="padding: 8px 0; color: #1f2937;">${result.subject}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Topics:</td>
          <td style="padding: 8px 0; color: #1f2937;">${result.topics || "General Topics"}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Date & Time:</td>
          <td style="padding: 8px 0; color: #1f2937;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Questions Answered:</td>
          <td style="padding: 8px 0; color: #1f2937;">${result.questionsAnswered}</td>
        </tr>
      </table>
    </div>

    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
      <h2 style="color: #1f2937; margin-top: 0; font-size: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Your Score</h2>
      <div style="font-size: 48px; font-weight: bold; color: ${scoreColor}; margin: 20px 0;">
        ${result.score}%
      </div>
      <div style="padding: 10px 20px; background: ${isPassed ? "#d1fae5" : "#fee2e2"}; color: ${isPassed ? "#065f46" : "#991b1b"}; border-radius: 6px; display: inline-block; font-weight: 600; margin-top: 10px;">
        ${isPassed ? "✓ PASSED" : "✗ FAILED"}
      </div>
    </div>

    ${result.overallFeedback ? `
    <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 8px; padding: 25px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid #3b82f6;">
      <h2 style="color: #1e40af; margin-top: 0; font-size: 22px; font-weight: 700; border-bottom: 2px solid #93c5fd; padding-bottom: 12px; margin-bottom: 20px;">
        📝 Detailed Feedback & Recommendations
      </h2>
      <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #bfdbfe;">
        <p style="color: #1f2937; margin: 0; line-height: 1.8; font-size: 15px; white-space: pre-wrap; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${result.overallFeedback}</p>
      </div>
      ${result.score < 50 ? `
      <div style="margin-top: 20px; padding: 15px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px;">
        <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">
          💡 Tip: Review the questions and answers below to understand where you can improve. Focus on the areas mentioned in the feedback above.
        </p>
      </div>
      ` : result.score >= 80 ? `
      <div style="margin-top: 20px; padding: 15px; background: #d1fae5; border-left: 4px solid #10b981; border-radius: 6px;">
        <p style="margin: 0; color: #065f46; font-size: 14px; font-weight: 600;">
          🎉 Great work! Continue building on your strengths and explore advanced topics to further enhance your knowledge.
        </p>
      </div>
      ` : ''}
    </div>
    ` : ''}

    ${result.evaluation && result.evaluation.marks && result.evaluation.feedback ? `
    <div style="background: white; border-radius: 8px; padding: 25px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h2 style="color: #1f2937; margin-top: 0; font-size: 22px; font-weight: 700; border-bottom: 3px solid #3b82f6; padding-bottom: 12px; margin-bottom: 25px;">
        📋 Question-by-Question Evaluation
      </h2>
      <div style="margin-top: 15px;">
        ${result.evaluation.marks.map((mark, index) => {
          const feedback = result.evaluation?.feedback?.find(f => f.questionNumber === mark.questionNumber);
          const marksPercentage = (mark.marks / mark.maxMarks) * 100;
          const markColor = marksPercentage >= 80 ? "#10b981" : marksPercentage >= 60 ? "#f59e0b" : "#ef4444";
          const markBg = marksPercentage >= 80 ? "#d1fae5" : marksPercentage >= 60 ? "#fef3c7" : "#fee2e2";
          
          return `
          <div style="margin-bottom: 30px; padding: 20px; background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 12px; border-bottom: 2px solid #e5e7eb;">
              <h3 style="color: #1f2937; margin: 0; font-size: 18px; font-weight: 600;">Question ${mark.questionNumber}</h3>
              <div style="padding: 6px 14px; background: ${markBg}; color: ${markColor}; border-radius: 6px; font-weight: 700; font-size: 14px;">
                ${mark.marks}/${mark.maxMarks} marks
              </div>
            </div>
            
            <div style="margin-bottom: 15px;">
              <div style="font-weight: 600; color: #1e40af; margin-bottom: 8px; font-size: 13px; text-transform: uppercase;">Question:</div>
              <div style="padding: 12px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px; color: #1f2937; line-height: 1.6;">${mark.question}</div>
            </div>
            
            <div style="margin-bottom: 15px;">
              <div style="font-weight: 600; color: #374151; margin-bottom: 8px; font-size: 13px; text-transform: uppercase;">Your Answer:</div>
              <div style="padding: 12px; background: #f9fafb; border-left: 4px solid #6b7280; border-radius: 4px; color: #1f2937; line-height: 1.6; white-space: pre-wrap;">${mark.answer || "No answer provided"}</div>
            </div>
            
            ${feedback ? `
            <div style="margin-bottom: 15px;">
              <div style="font-weight: 600; color: #7c3aed; margin-bottom: 8px; font-size: 13px; text-transform: uppercase;">Feedback:</div>
              <div style="padding: 12px; background: #faf5ff; border-left: 4px solid #8b5cf6; border-radius: 4px; color: #1f2937; line-height: 1.7;">${feedback.feedback}</div>
            </div>
            
            ${feedback.strengths && feedback.strengths.length > 0 ? `
            <div style="margin-bottom: 15px;">
              <div style="font-weight: 600; color: #059669; margin-bottom: 8px; font-size: 13px; text-transform: uppercase;">✓ Strengths:</div>
              <ul style="margin: 0; padding-left: 20px; color: #1f2937; line-height: 1.8;">
                ${feedback.strengths.map(s => `<li style="margin-bottom: 6px;">${s}</li>`).join('')}
              </ul>
            </div>
            ` : ''}
            
            ${feedback.weaknesses && feedback.weaknesses.length > 0 ? `
            <div style="margin-bottom: 15px;">
              <div style="font-weight: 600; color: #dc2626; margin-bottom: 8px; font-size: 13px; text-transform: uppercase;">⚠ Areas for Improvement:</div>
              <ul style="margin: 0; padding-left: 20px; color: #1f2937; line-height: 1.8;">
                ${feedback.weaknesses.map(w => `<li style="margin-bottom: 6px;">${w}</li>`).join('')}
              </ul>
            </div>
            ` : ''}
            ` : ''}
          </div>
        `;
        }).join('')}
      </div>
    </div>
    ` : qaPairs.length > 0 ? `
    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h2 style="color: #1f2937; margin-top: 0; font-size: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Questions & Answers</h2>
      <div style="margin-top: 15px;">
        ${qaPairs.map((item, index) => `
          <div style="margin-bottom: 20px; padding: 15px; background: ${item.role === "AI" ? "#eff6ff" : "#f9fafb"}; border-left: 4px solid ${item.role === "AI" ? "#3b82f6" : "#6b7280"}; border-radius: 4px;">
            <div style="font-weight: 600; color: ${item.role === "AI" ? "#1e40af" : "#374151"}; margin-bottom: 8px; text-transform: uppercase; font-size: 12px;">
              ${item.role}
            </div>
            <div style="color: #1f2937; white-space: pre-wrap;">${item.content}</div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : result.transcript ? `
    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h2 style="color: #1f2937; margin-top: 0; font-size: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Transcript</h2>
      <pre style="background: #f9fafb; padding: 15px; border-radius: 4px; overflow-x: auto; white-space: pre-wrap; font-size: 14px; color: #374151;">${result.transcript}</pre>
    </div>
    ` : ''}

    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
      <p>This is an automated email from the AI Viva system.</p>
      <p style="margin-top: 10px;">If you have any questions, please contact your instructor.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function formatEmailText(result: {
  studentName: string;
  subject: string;
  topics: string;
  score: number;
  questionsAnswered: number;
  overallFeedback: string;
  transcript: string;
  timestamp: string;
  evaluation?: {
    marks?: Array<{
      questionNumber: number;
      question: string;
      answer: string;
      marks: number;
      maxMarks: number;
    }>;
    feedback?: Array<{
      questionNumber: number;
      feedback: string;
      strengths?: string[];
      weaknesses?: string[];
    }>;
  };
}): string {
  const passingScore = 50;
  const isPassed = result.score >= passingScore;
  const formattedDate = new Date(result.timestamp).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `
AI Viva Examination Results

Dear ${result.studentName},

Thank you for completing your AI Viva examination. Please find your results below:

EXAMINATION DETAILS
Subject: ${result.subject}
Topics: ${result.topics || "General Topics"}
Date & Time: ${formattedDate}
Questions Answered: ${result.questionsAnswered}

YOUR SCORE
${result.score}% - ${isPassed ? "PASSED" : "FAILED"}

${result.overallFeedback ? `\nDETAILED FEEDBACK & RECOMMENDATIONS\n${'='.repeat(40)}\n${result.overallFeedback}\n\n` : ''}

${result.evaluation && result.evaluation.marks && result.evaluation.feedback ? `
QUESTION-BY-QUESTION EVALUATION
${'='.repeat(40)}
${result.evaluation.marks.map((mark, index) => {
  const feedback = result.evaluation?.feedback?.find(f => f.questionNumber === mark.questionNumber);
  return `
Question ${mark.questionNumber} - Score: ${mark.marks}/${mark.maxMarks} marks

Question: ${mark.question}

Your Answer: ${mark.answer || "No answer provided"}

${feedback ? `
Feedback: ${feedback.feedback}

${feedback.strengths && feedback.strengths.length > 0 ? `Strengths:\n${feedback.strengths.map(s => `  ✓ ${s}`).join('\n')}\n` : ''}
${feedback.weaknesses && feedback.weaknesses.length > 0 ? `Areas for Improvement:\n${feedback.weaknesses.map(w => `  ⚠ ${w}`).join('\n')}\n` : ''}
` : ''}
${'-'.repeat(40)}
`;
}).join('\n')}
` : ''}

${result.transcript ? `TRANSCRIPT\n${result.transcript}\n` : ''}

This is an automated email from the AI Viva system.
If you have any questions, please contact your instructor.
  `.trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      studentEmail,
      studentName,
      subject,
      topics,
      score,
      questionsAnswered,
      overallFeedback,
      transcript,
      timestamp,
      evaluation,
    } = body;

    // Validate required fields
    if (!studentEmail || !studentName || !subject || score === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if Resend is configured
    const resend = getResendClient();
    if (!resend) {
      console.error("[Send Result Email] RESEND_API_KEY is not configured");
      return NextResponse.json(
        { success: false, error: "Email service is not configured" },
        { status: 500 }
      );
    }

    // Prepare email data
    const emailData = {
      studentName,
      subject,
      topics: topics || "",
      score,
      questionsAnswered: questionsAnswered || 0,
      overallFeedback: overallFeedback || "",
      transcript: transcript || "",
      timestamp: timestamp || new Date().toISOString(),
      evaluation: evaluation || undefined,
    };

    // Use environment variable for from email, fallback to Resend default
    const fromEmail = process.env.RESEND_FROM_EMAIL || "AI Viva <onboarding@resend.dev>";

    // Send email
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: studentEmail,
      subject: `Your Viva Results - ${subject} (Score: ${score}%)`,
      html: formatEmailHTML(emailData),
      text: formatEmailText(emailData),
    });

    if (error) {
      console.error("[Send Result Email] Resend API error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to send email" },
        { status: 500 }
      );
    }

    console.log("[Send Result Email] Email sent successfully:", data);

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
      emailId: data?.id,
    });
  } catch (error) {
    console.error("[Send Result Email] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
