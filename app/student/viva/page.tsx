"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useVivaSession } from "@/lib/hooks/useVivaSession";
import { AudioVisualizer } from "@/components/viva/AudioVisualizer";
import { ConfirmationModal } from "@/components/viva/ConfirmationModal";
import { Timer } from "@/components/viva/Timer";
import { VapiSession, type VapiSessionHandle } from "@/components/viva/VapiSession";
import { stopAllVapiCalls } from "@/lib/utils/vapi-cleanup";
import { Button } from "@/components/ui/button";
import { Mic, PhoneOff } from "lucide-react";

interface StudentFormData {
  fullName: string;
  email: string;
  phone: string;
  subject: string;
  topic?: string;
  batchId?: string;
}

export default function VivaPage() {
  const router = useRouter();
  const [studentData, setStudentData] = useState<StudentFormData | null>(null);
  const [showEndModal, setShowEndModal] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const vapiSessionRef = useRef<VapiSessionHandle>(null);
  const {
    state,
    callStatus,
    elapsedTime,
    startViva,
    endViva,
    setCallStatus,
  } = useVivaSession();

  // Load student data from sessionStorage
  useEffect(() => {
    const storedData = sessionStorage.getItem("studentFormData");
    if (!storedData) {
      router.push("/student");
      return;
    }

    try {
      const data = JSON.parse(storedData);
      if (!data.fullName || !data.subject) {
        router.push("/student");
        return;
      }
      setStudentData(data);
    } catch {
      router.push("/student");
    }
  }, [router]);

  // Cleanup: Stop Vapi calls when component unmounts (page navigation)
  useEffect(() => {
    return () => {
      console.log("[Viva Page] Component unmounting, stopping all Vapi calls");
      // stopAllVapiCalls handles both Vapi instances and tracked media streams
      stopAllVapiCalls();
    };
  }, []);

  // Handle Vapi session end
  const handleSessionEnd = (transcript?: string) => {
    console.log("Vapi session ended", transcript);
    endViva();
  };

  // Handle Vapi errors
  const handleVapiError = (error: string) => {
    setMicError(error);
  };

  const handleStartViva = async () => {
    setMicError(null);
    try {
      await startViva();
    } catch (error) {
      setMicError(
        error instanceof Error
          ? error.message
          : "Failed to start viva session. Please check your microphone permissions."
      );
    }
  };

  const handleEndViva = () => {
    setShowEndModal(true);
  };

  const handleConfirmEnd = () => {
    setShowEndModal(false);

    // IMMEDIATELY stop the Vapi call before ending the session
    console.log("[Viva Page] Ending session - stopping Vapi call immediately");

    // Stop via ref (this also calls stopAllVapiCalls internally)
    if (vapiSessionRef.current) {
      try {
        vapiSessionRef.current.stop();
      } catch (err) {
        console.error("[Viva Page] Error stopping via ref:", err);
      }
    } else {
      // Fallback to global cleanup if ref is not available
      stopAllVapiCalls();
    }

    // Small delay to ensure stop is processed, then end session
    setTimeout(() => {
      endViva();
    }, 100);
  };

  // Simplified status - no more distracting changes
  const getStatusText = () => {
    if (callStatus === "idle") {
      return "Connecting...";
    }
    return "AI Viva in Progress";
  };

  if (!studentData) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  // PRE-CALL State
  if (state === "PRE_CALL") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
        <div className="max-w-2xl w-full space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold">
              Ready for your Viva?
            </h1>
            <div className="space-y-2">
              <p className="text-2xl md:text-3xl text-gray-300">
                {studentData.subject}
              </p>
              <p className="text-xl text-gray-400">{studentData.fullName}</p>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Instructions:</h2>
            <ul className="space-y-3 text-gray-300 text-lg">
              <li className="flex items-start gap-3">
                <span className="text-blue-500 font-bold mt-1">1.</span>
                <span>
                  Ensure you are in a quiet environment with good internet
                  connection
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-500 font-bold mt-1">2.</span>
                <span>
                  You will be asked questions by the AI. Listen carefully and
                  answer clearly
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-500 font-bold mt-1">3.</span>
                <span>
                  Speak naturally and take your time to think before answering
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-500 font-bold mt-1">4.</span>
                <span>
                  The session will be recorded for evaluation purposes
                </span>
              </li>
            </ul>
          </div>

          {/* Error Message */}
          {micError && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
              {micError}
            </div>
          )}

          {/* Start Button */}
          <Button
            onClick={handleStartViva}
            size="lg"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xl py-6 h-auto"
          >
            <Mic className="w-6 h-6 mr-2" />
            Start Viva
          </Button>
        </div>
      </div>
    );
  }

  // IN-CALL State
  if (state === "IN_CALL") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col">
        {/* Vapi Session Component - handles the actual voice call */}
        {studentData && (
          <VapiSession
            ref={vapiSessionRef}
            studentEmail={studentData.email}
            studentName={studentData.fullName}
            subject={studentData.subject}
            topics={studentData.topic && studentData.topic !== "all" ? [studentData.topic] : []}
            onSessionEnd={handleSessionEnd}
            onStatusChange={setCallStatus}
            onCallStart={() => {
              setCallStatus("listening");
            }}
            onError={handleVapiError}
          />
        )}

        <ConfirmationModal
          isOpen={showEndModal}
          onConfirm={handleConfirmEnd}
          onCancel={() => setShowEndModal(false)}
          title="End Viva Session?"
          message="Are you sure you want to end the viva session early? This action cannot be undone."
        />

        {/* Error Message */}
        {micError && (
          <div className="p-4 bg-red-900/50 border-b border-red-700">
            <div className="max-w-4xl mx-auto">
              <p className="text-red-200">{micError}</p>
            </div>
          </div>
        )}

        {/* Header with Timer */}
        <div className="p-6 border-b border-gray-800">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-2xl font-semibold">{studentData.subject}</h2>
              {studentData.topic && studentData.topic !== "all" && (
                <p className="text-blue-400 text-sm">Topic: {studentData.topic}</p>
              )}
              <p className="text-gray-400">{studentData.fullName}</p>
            </div>
            <Timer seconds={elapsedTime} />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-12">
          {/* Audio Visualizer */}
          <AudioVisualizer isActive={callStatus !== "idle"} />

          {/* Status Text - simplified, no distracting changes */}
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-semibold text-gray-200">
              {getStatusText()}
            </p>
          </div>
        </div>

        {/* Footer with End Button */}
        <div className="p-6 border-t border-gray-800">
          <div className="max-w-4xl mx-auto flex justify-center">
            <Button
              variant="destructive"
              size="lg"
              onClick={handleEndViva}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <PhoneOff className="w-5 h-5 mr-2" />
              End Viva Early
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ENDING State
  if (state === "ENDING") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-4xl md:text-5xl font-bold">Wrapping up...</h1>
          <p className="text-xl text-gray-400">
            Please wait while we finalize your session
          </p>
        </div>
      </div>
    );
  }

  return null;
}