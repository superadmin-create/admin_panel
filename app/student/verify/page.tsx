"use client";

import { useState, useEffect, useRef, KeyboardEvent, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

function maskEmail(email: string): string {
  if (!email) return "";
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return email;

  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }

  const maskedLocal = `${localPart[0]}${"*".repeat(Math.min(localPart.length - 1, 3))}${localPart.slice(-1)}`;
  return `${maskedLocal}@${domain}`;
}

export default function VerifyPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [resendCooldown, setResendCooldown] = useState(30);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Get email from sessionStorage and redirect if not found
  useEffect(() => {
    const storedData = sessionStorage.getItem("studentFormData");
    if (!storedData) {
      router.push("/student");
      return;
    }

    try {
      const data = JSON.parse(storedData);
      if (!data.email) {
        router.push("/student");
        return;
      }
      setEmail(data.email);
    } catch {
      router.push("/student");
    }
  }, [router]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  }, []);

  const handleVerify = useCallback(async () => {
    const otpString = otp.join("").trim();
    if (otpString.length !== 6) {
      setError("Please enter all 6 digits");
      triggerShake();
      return;
    }

    // Prevent duplicate submissions
    if (isLoading || isVerifying) {
      return;
    }

    setIsLoading(true);
    setIsVerifying(true);
    setError("");

    try {
      const response = await fetch("/api/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          otp: otpString,
        }),
      });

      const data = await response.json();

      if (response.ok && data.verified) {
        // Show success animation
        setShowSuccess(true);
        setTimeout(() => {
          router.push("/student/viva");
        }, 1000);
      } else {
        // Show error and clear inputs
        setError(data.error || "Invalid OTP. Please try again.");
        triggerShake();
        setOtp(Array(6).fill(""));
        hasSubmittedRef.current = false; // Reset submission flag on error
        inputRefs.current[0]?.focus();
        setIsLoading(false);
        setIsVerifying(false);
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      setError("Failed to verify OTP. Please try again.");
      triggerShake();
      setOtp(Array(6).fill(""));
      hasSubmittedRef.current = false; // Reset submission flag on error
      inputRefs.current[0]?.focus();
      setIsLoading(false);
      setIsVerifying(false);
    }
  }, [otp, email, router, triggerShake, isLoading, isVerifying]);

  // Auto-submit when 6 digits are entered
  // Use a ref to track if we've already submitted to prevent double submission
  const hasSubmittedRef = useRef(false);
  
  useEffect(() => {
    const otpString = otp.join("").trim();
    // Only auto-submit if we have exactly 6 digits, not loading, not verifying, and haven't already submitted
    if (otpString.length === 6 && !isLoading && !isVerifying && !hasSubmittedRef.current) {
      hasSubmittedRef.current = true;
      handleVerify();
    }
    // Reset submission flag when OTP changes (user deleted/edited)
    if (otpString.length < 6) {
      hasSubmittedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp.join(""), isLoading, isVerifying]);

  const handleInputChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError("");

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    // Handle paste
    if ((e.ctrlKey || e.metaKey) && e.key === "v") {
      e.preventDefault();
      navigator.clipboard.readText().then((text) => {
        if (/^\d{6}$/.test(text)) {
          const digits = text.split("");
          const newOtp = [...otp];
          digits.forEach((digit, i) => {
            if (i < 6) {
              newOtp[i] = digit;
            }
          });
          setOtp(newOtp);
          inputRefs.current[5]?.focus();
        }
      });
    }
  };


  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error("Failed to send OTP");
      }

      // Reset cooldown and OTP inputs
      setResendCooldown(30);
      setOtp(Array(6).fill(""));
      inputRefs.current[0]?.focus();
    } catch (error) {
      console.error("Error resending OTP:", error);
      setError("Failed to resend OTP. Please try again.");
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };


  if (!email) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8 md:py-16">
        <div className="max-w-md mx-auto">
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-2xl shadow-slate-900/5 dark:shadow-slate-900/20 p-6 md:p-10 transition-all duration-300">
            {/* Back Link */}
            <Link
              href="/student"
              className="inline-flex items-center text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 mb-6 transition-colors font-medium"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to form
            </Link>

            {/* Header */}
            <div className="mb-8 text-center">
              <h1 className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                Verify Your Email
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-lg">
                We sent a verification code to
              </p>
              <p className="font-semibold mt-2 text-slate-900 dark:text-slate-100 text-lg">{maskEmail(email)}</p>
            </div>

          {/* Success Animation */}
          {showSuccess && (
            <div className="flex justify-center mb-6 animate-in fade-in duration-300">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
          )}

          {/* OTP Inputs */}
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-4 text-center text-slate-700 dark:text-slate-300">
              Enter verification code
            </label>
            <div
              className={cn(
                "flex justify-center gap-2 md:gap-3",
                shake && "animate-shake"
              )}
            >
              {otp.map((digit, index) => (
                <Input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className={cn(
                    "w-12 h-14 md:w-14 md:h-16 text-center text-2xl font-semibold border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 transition-all duration-200",
                    error && "border-red-500 dark:border-red-500 focus-visible:ring-red-500/20"
                  )}
                  disabled={isLoading || isVerifying || showSuccess}
                  autoFocus={index === 0}
                />
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg animate-in-slide">
              <p className="text-sm text-red-600 dark:text-red-400 text-center font-medium">{error}</p>
            </div>
          )}

          {/* Verify Button */}
          <Button
            onClick={handleVerify}
            disabled={isLoading || isVerifying || showSuccess || otp.join("").length !== 6}
            className="w-full mb-4 h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 dark:shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            size="lg"
          >
            {isVerifying ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Verifying...
              </span>
            ) : (
              "Verify"
            )}
          </Button>

          {/* Resend Section */}
          <div className="text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              Didn&apos;t receive the code?
            </p>
            {resendCooldown > 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Resend code in{" "}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {resendCooldown}s
                </span>
              </p>
            ) : (
              <button
                onClick={handleResend}
                disabled={isLoading || isVerifying}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Resend OTP
              </button>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
