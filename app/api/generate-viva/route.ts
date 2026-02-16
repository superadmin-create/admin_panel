import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import mammoth from "mammoth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface VivaQuestion {
  id: number;
  question: string;
  expectedAnswer: string;
  difficulty: "easy" | "medium" | "hard";
  topic: string;
}

interface GenerateVivaResponse {
  questions: VivaQuestion[];
  documentSummary: string;
  topics: string[];
}

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse/lib/pdf-parse.js");
    const data = await pdfParse(buffer);
    
    if (!data.text || data.text.trim().length === 0) {
      throw new Error("PDF appears to be empty or contains only images/scanned content");
    }
    
    return data.text;
  } catch (error) {
    console.error("PDF extraction error:", error);
    
    if (error instanceof Error) {
      if (error.message.includes("password")) {
        throw new Error("This PDF is password-protected. Please remove the password or use Topic Only mode.");
      }
      if (error.message.includes("encrypted")) {
        throw new Error("This PDF is encrypted. Please use an unencrypted PDF or Topic Only mode.");
      }
      if (error.message.includes("empty") || error.message.includes("images")) {
        throw new Error("This PDF contains images/scanned content that cannot be read. Please use Topic Only mode or paste the text manually.");
      }
    }
    
    throw new Error(
      "Could not read this PDF. Try using 'Topic Only' mode or 'Paste Text' mode instead."
    );
  }
}

async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;
    
    if (!text || text.trim().length === 0) {
      throw new Error("Document appears to be empty");
    }
    
    return text;
  } catch (error) {
    console.error("DOCX extraction error:", error);
    throw new Error(
      "Could not read this document. Try using 'Paste Text' mode instead."
    );
  }
}

async function generateVivaQuestions(
  documentText: string | null,
  subject: string,
  difficulty: string,
  topics?: string,
  questionCount: number = 5,
  qaMode: boolean = false
): Promise<GenerateVivaResponse> {
  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  const isTopicOnly = !documentText || documentText.trim().length === 0;

  if (qaMode && documentText) {
    const qaSystemPrompt = `You are an expert teacher and examiner. You are given a document that contains questions and answers (a Q&A document). Your task is to extract and format these questions and answers for a viva (oral examination).

CRITICAL INSTRUCTIONS:
- You MUST only use questions and answers that are explicitly present in the document
- Do NOT create new questions or modify existing ones
- Do NOT add any external knowledge
- Extract the questions and their corresponding answers exactly as they appear in the document
- If the document has more questions than requested, select the most important/diverse ones
- Preserve the original wording of questions and answers as closely as possible

You must respond with valid JSON in exactly this format:
{
  "documentSummary": "A 2-3 sentence description of the Q&A document",
  "topics": ["topic1", "topic2"],
  "questions": [
    {
      "id": 1,
      "question": "The exact question from the document",
      "expectedAnswer": "The exact answer from the document",
      "difficulty": "easy|medium|hard",
      "topic": "The topic this question belongs to"
    }
  ]
}

Extract up to ${questionCount} questions. Assign difficulty levels based on the complexity of each question.`;

    const qaUserPrompt = `Subject: ${subject}
${topics ? `Focus Topics: ${topics}` : ""}

Extract questions and answers from this Q&A document. Use ONLY the questions and answers that are explicitly written in the document. Do not create any new questions.

Q&A Document Content:
${documentText.slice(0, 15000)}

Extract up to ${questionCount} questions with their answers from this document. Every question and answer must come directly from the document text.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: qaSystemPrompt },
        { role: "user", content: qaUserPrompt },
      ],
      temperature: 0.3,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    try {
      return JSON.parse(content) as GenerateVivaResponse;
    } catch {
      throw new Error("Failed to parse AI response");
    }
  }

  const systemPrompt = isTopicOnly 
    ? `You are an expert teacher and examiner. Your task is to generate thoughtful viva (oral examination) questions.

You must respond with valid JSON in exactly this format:
{
  "documentSummary": "A 2-3 sentence description of what the questions cover",
  "topics": ["topic1", "topic2", "topic3"],
  "questions": [
    {
      "id": 1,
      "question": "The viva question",
      "expectedAnswer": "A comprehensive expected answer",
      "difficulty": "easy|medium|hard",
      "topic": "The specific topic this question covers"
    }
  ]
}

Generate exactly ${questionCount} questions with a mix of difficulty levels. Questions should:
- Test understanding, not just memorization
- Be open-ended to encourage discussion
- Cover different aspects of the subject
- Be appropriate for oral examination
- Include practical/real-world applications where relevant`
    : `You are an expert teacher and examiner. Your task is to generate viva (oral examination) questions STRICTLY based on the document content provided.

CRITICAL INSTRUCTION: You must ONLY use information from the document provided. Do NOT add any external knowledge, general facts, or information not explicitly present in the document. Every question and expected answer must be directly traceable to specific content in the document.

You must respond with valid JSON in exactly this format:
{
  "documentSummary": "A 2-3 sentence summary of the document content provided",
  "topics": ["topic1", "topic2", "topic3"],
  "questions": [
    {
      "id": 1,
      "question": "The viva question based on document content",
      "expectedAnswer": "An expected answer using ONLY information from the document",
      "difficulty": "easy|medium|hard",
      "topic": "The specific topic from the document"
    }
  ]
}

Generate exactly ${questionCount} questions. Questions MUST:
- Be answerable ONLY using the document content provided
- Reference specific concepts, facts, or details from the document
- Have expected answers that quote or paraphrase the document
- NOT require any external knowledge beyond the document
- Cover different sections/topics within the document`;

  let userPrompt: string;

  if (isTopicOnly) {
    // Generate based on subject/topics only
    userPrompt = `Subject: ${subject}
${topics ? `Specific Topics to Cover: ${topics}` : ""}
Preferred Difficulty: ${difficulty}

Generate ${questionCount} comprehensive viva questions for the subject "${subject}"${topics ? ` focusing on: ${topics}` : ""}. 
Include a mix of:
- Fundamental concept questions
- Application-based questions  
- Analytical/problem-solving questions
- Comparison/contrast questions
- Real-world scenario questions`;
  } else {
    // Generate based on document content ONLY
    userPrompt = `Subject: ${subject}
${topics ? `Focus Topics: ${topics}` : ""}
Preferred Difficulty: ${difficulty}

IMPORTANT: Generate questions EXCLUSIVELY from the document content provided below. Do NOT use any external knowledge or information not present in this document. All questions and expected answers must be directly derived from and answerable using ONLY the text provided.

Document Content:
${documentText!.slice(0, 15000)}

Based ONLY on this document content, generate ${questionCount} viva questions that:
1. Can be answered using ONLY information from the document above
2. Test the student's understanding of the specific content in this document
3. Include expected answers that reference specific points from the document
4. Do NOT require any knowledge beyond what is written in the document

Every question must be directly answerable from the provided text.`;
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 2500,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  try {
    const parsed = JSON.parse(content) as GenerateVivaResponse;
    return parsed;
  } catch {
    throw new Error("Failed to parse AI response");
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check for OpenAI API key first
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "your_openai_api_key_here") {
      return NextResponse.json(
        {
          error:
            "OpenAI API key not configured. Please add your OPENAI_API_KEY to .env.local file.",
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("document") as File | null;
    const textContent = formData.get("textContent") as string | null;
    const subject = (formData.get("subject") as string) || "General";
    const difficulty = (formData.get("difficulty") as string) || "mixed";
    const topics = formData.get("topics") as string | null;
    const topicOnly = formData.get("topicOnly") === "true";
    const qaMode = formData.get("qaMode") === "true";
    const questionCountRaw = formData.get("questionCount") as string | null;
    const questionCount = Math.min(Math.max(parseInt(questionCountRaw || "5", 10) || 5, 1), 20);

    let documentText: string | null = null;

    // If not topic-only mode, try to get document content
    if (!topicOnly) {
      if (file && file.size > 0) {
        try {
          const buffer = Buffer.from(await file.arrayBuffer());
          const fileName = file.name.toLowerCase();

          if (
            file.type === "application/pdf" ||
            fileName.endsWith(".pdf")
          ) {
            documentText = await extractTextFromPDF(buffer);
          } else if (
            fileName.endsWith(".docx") ||
            file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          ) {
            documentText = await extractTextFromDOCX(buffer);
          } else if (
            file.type === "text/plain" ||
            fileName.endsWith(".txt") ||
            fileName.endsWith(".md")
          ) {
            documentText = buffer.toString("utf-8");
          } else {
            return NextResponse.json(
              {
                error:
                  "Unsupported file format. Please upload PDF, DOCX, or TXT files.",
              },
              { status: 400 }
            );
          }
        } catch (error) {
          // If PDF parsing fails, return a clear error
          console.error("File processing error:", error);
          return NextResponse.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to process the uploaded file. Try using 'Topic Only' mode instead.",
            },
            { status: 400 }
          );
        }
      } else if (textContent && textContent.trim()) {
        documentText = textContent;
      }
    }

    // For topic-only mode or when no document is provided
    if (topicOnly || !documentText) {
      // Validate that we have at least a subject for topic-only mode
      if (!subject || subject === "General") {
        if (!topics) {
          return NextResponse.json(
            {
              error:
                "Please provide a subject name and/or specific topics to generate questions.",
            },
            { status: 400 }
          );
        }
      }
    } else {
      // For document mode, check content length
      if (documentText.trim().length < 50) {
        return NextResponse.json(
          {
            error:
              "Document content is too short. Please provide more content or use Topic Only mode.",
          },
          { status: 400 }
        );
      }
    }

    const result = await generateVivaQuestions(
      documentText,
      subject,
      difficulty,
      topics || undefined,
      questionCount,
      qaMode
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error generating viva:", error);

    if (error instanceof Error) {
      // Handle specific OpenAI errors
      if (
        error.message.includes("API key") ||
        error.message.includes("Incorrect API key")
      ) {
        return NextResponse.json(
          {
            error:
              "OpenAI API key is invalid or not configured. Please check your OPENAI_API_KEY.",
          },
          { status: 500 }
        );
      }
      if (error.message.includes("quota") || error.message.includes("rate limit") || error.message.includes("429")) {
        return NextResponse.json(
          { error: "OpenAI API quota exceeded. Please check your billing at platform.openai.com or use a different API key." },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "An unexpected error occurred while generating questions" },
      { status: 500 }
    );
  }
}
