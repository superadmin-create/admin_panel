"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from "react";
import type { CallStatus } from "@/lib/hooks/useVivaSession";
import { stopAllVapiCalls } from "@/lib/utils/vapi-cleanup";
import Vapi from "@vapi-ai/web";

// Global singleton state - persists across React Strict Mode re-mounts
declare global {
  // eslint-disable-next-line no-var
  var __vapiSingleton: Vapi | null;
  // eslint-disable-next-line no-var
  var __vapiCallStarted: boolean;
  // eslint-disable-next-line no-var
  var __vapiInitInProgress: boolean;
}

// Initialize globals
if (typeof globalThis.__vapiSingleton === "undefined") {
  globalThis.__vapiSingleton = null;
}
if (typeof globalThis.__vapiCallStarted === "undefined") {
  globalThis.__vapiCallStarted = false;
}
if (typeof globalThis.__vapiInitInProgress === "undefined") {
  globalThis.__vapiInitInProgress = false;
}

interface VapiSessionProps {
  studentEmail: string;
  studentName: string;
  subject: string;
  topics?: string[];
  onSessionEnd: (transcript?: string) => void;
  onStatusChange: (status: CallStatus) => void;
  onCallStart: () => void;
  onError?: (error: string) => void;
}

export interface VapiSessionHandle {
  stop: () => void;
}

export const VapiSession = forwardRef<VapiSessionHandle, VapiSessionProps>(
  (
    {
      studentEmail,
      studentName,
      subject,
      topics = [],
      onSessionEnd,
      onStatusChange,
      onCallStart,
      onError,
    },
    ref
  ) => {
    const sessionEndedRef = useRef(false);

    // Stable callbacks using refs
    const onSessionEndRef = useRef(onSessionEnd);
    const onStatusChangeRef = useRef(onStatusChange);
    const onCallStartRef = useRef(onCallStart);
    const onErrorRef = useRef(onError);

    // Stable student data refs (captured at mount time)
    const studentNameRef = useRef(studentName);
    const studentEmailRef = useRef(studentEmail);
    const subjectRef = useRef(subject);
    const topicsRef = useRef(topics);

    useEffect(() => {
      onSessionEndRef.current = onSessionEnd;
      onStatusChangeRef.current = onStatusChange;
      onCallStartRef.current = onCallStart;
      onErrorRef.current = onError;
      studentNameRef.current = studentName;
      studentEmailRef.current = studentEmail;
      subjectRef.current = subject;
      topicsRef.current = topics;
    }, [onSessionEnd, onStatusChange, onCallStart, onError, studentName, studentEmail, subject, topics]);

    // Stop function
    const stopCall = useCallback(() => {
      console.log("[VapiSession] Stop called");

      if (globalThis.__vapiSingleton) {
        try {
          globalThis.__vapiSingleton.stop();
          console.log("[VapiSession] Vapi stop() executed");
        } catch (err) {
          console.error("[VapiSession] Error stopping:", err);
        }
      }

      globalThis.__vapiCallStarted = false;
      globalThis.__vapiInitInProgress = false;
      stopAllVapiCalls();
    }, []);

    useImperativeHandle(ref, () => ({ stop: stopCall }), [stopCall]);

    useEffect(() => {
      sessionEndedRef.current = false;

      // If init is already in progress or call already started, skip this mount
      if (globalThis.__vapiInitInProgress || globalThis.__vapiCallStarted) {
        console.log("[VapiSession] Init already in progress or call started, skipping this mount");
        return;
      }

      // Mark init as in progress
      globalThis.__vapiInitInProgress = true;
      console.log("[VapiSession] Starting initialization");

      let vapi: Vapi | null = null;

      const initialize = async () => {
        try {
          // Create Vapi instance if needed
          if (!globalThis.__vapiSingleton) {
            const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
            if (!publicKey) {
              throw new Error("NEXT_PUBLIC_VAPI_PUBLIC_KEY is not set");
            }

            console.log("[VapiSession] Creating new Vapi instance");
            vapi = new Vapi(publicKey);
            globalThis.__vapiSingleton = vapi;
          } else {
            vapi = globalThis.__vapiSingleton;
            console.log("[VapiSession] Using existing Vapi instance");
          }

          // Note: Don't abort on cleanup - let the call continue even after Strict Mode cleanup
          // The second mount will skip because __vapiInitInProgress is true

          // Microphone permission is already granted by useVivaSession before this component mounts
          // Skip redundant permission request to speed up call initialization
          console.log("[VapiSession] Skipping mic request - already granted by useVivaSession");

          // Setup event handlers
          const handleCallStart = () => {
            console.log("[VapiSession] Call started");
            globalThis.__vapiCallStarted = true;
            globalThis.__vapiInitInProgress = false;
            onCallStartRef.current();
            onStatusChangeRef.current("listening");
          };

          const handleSpeechStart = () => {
            onStatusChangeRef.current("listening");
          };

          const handleSpeechEnd = () => {
            onStatusChangeRef.current("processing");
            setTimeout(() => onStatusChangeRef.current("ai_speaking"), 500);
          };

          const handleCallEnd = (event?: any) => {
            console.log("[VapiSession] Call ended", event);
            globalThis.__vapiCallStarted = false;
            globalThis.__vapiInitInProgress = false;

            if (sessionEndedRef.current) return;
            sessionEndedRef.current = true;

            let transcript: string | undefined;
            if (event?.transcript) transcript = event.transcript;

            setTimeout(() => onSessionEndRef.current(transcript), 100);
          };

          const handleError = (event: any) => {
            // Log full error object for debugging
            console.error("[VapiSession] Error event:", JSON.stringify(event, null, 2));

            if (sessionEndedRef.current) return;

            // Safely extract error message from various possible formats
            let errorMsg = "";
            try {
              // Handle nested error structure from Vapi
              const err = event?.error;
              if (err?.message?.message) {
                // Vapi returns { error: { message: { message: ["error text"] } } }
                errorMsg = Array.isArray(err.message.message)
                  ? err.message.message.join(", ")
                  : String(err.message.message);
              } else if (typeof err?.message === "string") {
                errorMsg = err.message;
              } else if (event?.errorMsg) {
                errorMsg = event.errorMsg;
              } else if (event?.message) {
                errorMsg = typeof event.message === "string"
                  ? event.message
                  : JSON.stringify(event.message);
              } else if (typeof event === "string") {
                errorMsg = event;
              } else if (err) {
                errorMsg = JSON.stringify(err);
              }
            } catch {
              errorMsg = "Unknown error";
            }

            console.log("[VapiSession] Extracted error message:", errorMsg);

            // Ignore expected errors (safely check with try-catch)
            try {
              if (
                typeof errorMsg === "string" && (
                  errorMsg.includes("Meeting has ended") ||
                  errorMsg.includes("Unhandled error") ||
                  errorMsg.includes("Duplicate DailyIframe")
                )
              ) {
                console.log("[VapiSession] Ignoring expected error");
                return;
              }
            } catch {
              // Ignore check errors
            }

            if (!globalThis.__vapiCallStarted) {
              onErrorRef.current?.(errorMsg || "Failed to start call");
              return;
            }

            // Safely check error type
            const errorType = typeof event?.type === "string" ? event.type : "";
            const criticalErrors = ["call-failed", "connection-failed", "assistant-error"];
            const isCritical = criticalErrors.some(t => errorType.includes(t));

            if (isCritical) {
              sessionEndedRef.current = true;
              globalThis.__vapiCallStarted = false;
              globalThis.__vapiInitInProgress = false;
              onErrorRef.current?.(errorMsg);
              onSessionEndRef.current();
            }
          };

          // User/AI end phrases
          const userEndPhrases = ["end viva", "stop viva", "end session", "i'm done", "im done", "end the viva", "stop the viva"];
          const aiConclusionPhrases = ["thank you for participating", "that concludes", "goodbye", "all the best", "no more questions", "best of luck", "good luck"];

          const handleMessage = (message: any) => {
            // Log all messages for debugging
            console.log("[VapiSession] Message received:", JSON.stringify(message, null, 2));

            // Vapi sends different message types:
            // - transcript: type="transcript", transcript="text", role="user"|"assistant"
            // - conversation-update: type="conversation-update", conversation=[...]

            // Get content from various possible locations in Vapi message format
            const content = (
              message?.transcript ||  // Vapi transcript format
              message?.content ||     // Alternative format
              message?.text ||        // Another alternative
              ""
            ).toLowerCase();

            const role = message?.role || "";
            const isUserMessage = role === "user" || message?.transcriptType === "final";

            if (content && globalThis.__vapiCallStarted) {
              console.log("[VapiSession] Processing content:", content, "role:", role, "isUser:", isUserMessage);

              // Check user end request
              if (isUserMessage && userEndPhrases.some(p => content.includes(p))) {
                console.log("[VapiSession] User requested end - stopping in 3s");
                setTimeout(() => {
                  if (globalThis.__vapiSingleton && globalThis.__vapiCallStarted) {
                    console.log("[VapiSession] Executing stop after user request");
                    globalThis.__vapiSingleton.stop();
                  }
                }, 3000);
                return;
              }

              // Check AI conclusion
              if (role === "assistant" && aiConclusionPhrases.some(p => content.includes(p))) {
                console.log("[VapiSession] AI concluding - stopping in 4s");
                setTimeout(() => {
                  if (globalThis.__vapiSingleton && globalThis.__vapiCallStarted) {
                    console.log("[VapiSession] Executing stop after AI conclusion");
                    globalThis.__vapiSingleton.stop();
                  }
                }, 4000);
                return;
              }
            }
          };

          // Attach event listeners
          vapi.on("call-start", handleCallStart);
          vapi.on("speech-start", handleSpeechStart);
          vapi.on("speech-end", handleSpeechEnd);
          vapi.on("call-end", handleCallEnd);
          vapi.on("error", handleError);
          vapi.on("message", handleMessage);

          // Start the call with student context
          const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
          if (!assistantId) {
            throw new Error("NEXT_PUBLIC_VAPI_ASSISTANT_ID is not set");
          }

          console.log("[VapiSession] Starting call with assistant:", assistantId);
          console.log("[VapiSession] Student context:", {
            studentName: studentNameRef.current,
            subject: subjectRef.current,
            topics: topicsRef.current
          });

          // Pass student context to personalize the AI conversation
          // Safely handle topics array
          const topicsValue = Array.isArray(topicsRef.current)
            ? topicsRef.current.join(", ")
            : String(topicsRef.current || "");

          // Fetch teacher-defined questions from Google Sheets
          let customQuestions = "";
          try {
            // Build query params - include topic if specified
            const queryParams = new URLSearchParams({
              subject: subjectRef.current || "General",
            });
            
            // Add topic filter if topics array has a value
            const selectedTopic = Array.isArray(topicsRef.current) && topicsRef.current.length > 0 
              ? topicsRef.current[0] 
              : null;
            if (selectedTopic) {
              queryParams.append("topic", selectedTopic);
              console.log(`[VapiSession] Filtering questions by topic: ${selectedTopic}`);
            }
            
            const questionsResponse = await fetch(
              `/api/get-questions?${queryParams.toString()}`
            );
            const questionsData = await questionsResponse.json();
            
            if (questionsData.success && questionsData.questions?.length > 0) {
              console.log(`[VapiSession] ✓ Found ${questionsData.questions.length} custom questions${selectedTopic ? ` for topic: ${selectedTopic}` : ""}`);
              console.log(`[VapiSession] Questions from API:`, questionsData.questions.map((q: any) => q.question));
              
              // Format questions clearly for the AI
              // Use a clear format that the AI can easily parse and ask
              customQuestions = questionsData.questions
                .map((q: { question: string; expectedAnswer: string }, i: number) => 
                  `Question ${i + 1}: ${q.question}\nExpected Answer: ${q.expectedAnswer}`
                )
                .join("\n\n");
              
              // Add instructions for the AI
              customQuestions = `You must ask these questions in order:\n\n${customQuestions}\n\nIMPORTANT: Ask these questions ONE AT A TIME. Wait for the student's complete answer before asking the next question.`;
              
              console.log(`[VapiSession] Formatted questions length: ${customQuestions.length} characters`);
              console.log(`[VapiSession] Questions preview:`, customQuestions.substring(0, 300) + "...");
            } else {
              console.warn("[VapiSession] ⚠ No custom questions found, AI will generate its own");
              console.warn("[VapiSession] API response:", JSON.stringify(questionsData, null, 2));
              console.warn("[VapiSession] To use custom questions:");
              console.warn("  1. Generate questions in Admin Panel");
              console.warn("  2. Save them to Google Sheets 'Viva Questions' sheet");
              console.warn("  3. Ensure subject name matches exactly");
              console.warn("  4. Set 'Active' column to TRUE");
            }
          } catch (err) {
            console.log("[VapiSession] Could not fetch custom questions:", err);
          }

          // Metadata is passed through to webhooks (end-of-call-report)
          const metadata = {
            studentName: studentNameRef.current || "Student",
            studentEmail: studentEmailRef.current || "",
            subject: subjectRef.current || "General",
            topics: topicsValue || "general topics",
          };

          // Build a brief first message that starts the viva immediately
          // Keep it short to avoid repetition - the system prompt already handles greeting
          let firstMessageWithQuestions = "";
          
          if (customQuestions) {
            // Start directly with the first question - no repeated greeting
            firstMessageWithQuestions = `Hello ${studentNameRef.current || "Student"}. Let's begin with the first question.`;
          } else {
            // Brief greeting only, then start
            firstMessageWithQuestions = `Hello ${studentNameRef.current || "Student"}. Let's begin.`;
          }

          // Pass questions via variableValues AND in firstMessage as backup
          const variableValues = {
            studentName: studentNameRef.current || "Student",
            studentEmail: studentEmailRef.current || "",
            subject: subjectRef.current || "General",
            topics: topicsValue || "general topics",
            customQuestions: customQuestions || "Generate 5 relevant questions based on the subject and topics.",
          };

          console.log("[VapiSession] Assistant ID:", assistantId);
          console.log("[VapiSession] Subject:", subjectRef.current);
          console.log("[VapiSession] Topics:", topicsRef.current);
          console.log("[VapiSession] Custom questions found:", customQuestions ? "YES" : "NO");
          console.log("[VapiSession] Questions count:", customQuestions ? customQuestions.split("Question").length - 1 : 0);
          if (customQuestions) {
            console.log("[VapiSession] Questions preview:", customQuestions.substring(0, 500) + "...");
          }

          // Ensure assistantId is a clean string
          const cleanAssistantId = String(assistantId).trim();

          // Start the call with variableValues and firstMessage override
          await vapi.start(cleanAssistantId, { 
            variableValues,
            firstMessage: firstMessageWithQuestions,
            metadata 
          });
          console.log("[VapiSession] Call start initiated with custom questions");

        } catch (err) {
          console.error("[VapiSession] Init error:", err);
          globalThis.__vapiInitInProgress = false;

          const errorStr = err instanceof Error ? err.message : String(err);
          if (errorStr.includes("Unhandled error") || errorStr.includes("Duplicate")) {
            console.log("[VapiSession] Ignoring init error");
            return;
          }

          onErrorRef.current?.(errorStr || "Failed to start call");
        }
      };

      // Start initialization
      initialize();

      // Cleanup function - don't do anything here for Strict Mode
      // The call will continue and page navigation will handle cleanup via stopAllVapiCalls
      return () => {
        console.log("[VapiSession] Cleanup called (Strict Mode) - call continues");
      };
    }, []); // Empty deps - only run once per mount

    return null;
  }
);

VapiSession.displayName = "VapiSession";
