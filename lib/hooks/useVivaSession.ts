"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { registerMediaStream } from "@/lib/utils/vapi-cleanup";

export type VivaSessionState = "PRE_CALL" | "IN_CALL" | "ENDING";

export type CallStatus = "idle" | "ai_speaking" | "listening" | "processing";

interface UseVivaSessionReturn {
  state: VivaSessionState;
  callStatus: CallStatus;
  elapsedTime: number;
  startViva: () => Promise<void>;
  endViva: () => void;
  setCallStatus: (status: CallStatus) => void;
}

export function useVivaSession(): UseVivaSessionReturn {
  const [state, setState] = useState<VivaSessionState>("PRE_CALL");
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [elapsedTime, setElapsedTime] = useState(0);
  const router = useRouter();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const endingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Timer for elapsed time during IN_CALL state
  useEffect(() => {
    if (state === "IN_CALL") {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (state === "PRE_CALL") {
        setElapsedTime(0);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [state]);

  // Handle ENDING state - redirect after 2-3 seconds
  useEffect(() => {
    if (state === "ENDING") {
      // Random delay between 2-3 seconds
      const delay = 2000 + Math.random() * 1000;
      endingTimeoutRef.current = setTimeout(() => {
        router.push("/student/complete");
      }, delay);

      return () => {
        if (endingTimeoutRef.current) {
          clearTimeout(endingTimeoutRef.current);
        }
      };
    }
  }, [state, router]);

  const startViva = useCallback(async () => {
    // Request microphone permissions before starting Vapi
    // VapiSession component will handle the actual Vapi initialization
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Register stream for proper cleanup later
      registerMediaStream(stream);
      // Stop the stream - VapiSession will request its own
      stream.getTracks().forEach((track) => track.stop());

      // Change state to IN_CALL
      // The actual call start will be handled by VapiSession
      setState("IN_CALL");
      setCallStatus("idle");
    } catch (error) {
      console.error("Error requesting microphone permission:", error);
      // Handle permission denied
      throw new Error(
        "Microphone permission is required for the viva session. Please allow access and try again."
      );
    }
  }, []);

  const endViva = useCallback(() => {
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    // Change to ENDING state
    setState("ENDING");
  }, []);

  return {
    state,
    callStatus,
    elapsedTime,
    startViva,
    endViva,
    setCallStatus,
  };
}
