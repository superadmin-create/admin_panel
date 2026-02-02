"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Tag, User, Mail, Phone, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

function VivaStartContent() {
  const searchParams = useSearchParams();
  
  const subject = searchParams.get('subject') || '';
  const topic = searchParams.get('topic') || '';
  
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vivaStarted, setVivaStarted] = useState(false);

  const canStart = studentName.trim().length > 0 && studentEmail.trim().length > 0 && subject;

  const handleStartViva = async () => {
    if (!canStart) {
      setError("Please enter your name and email");
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      const response = await fetch('/api/start-viva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: studentName.trim(),
          studentEmail: studentEmail.trim(),
          subject,
          topic,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start viva');
      }

      setVivaStarted(true);
      
      if (data.phoneNumber) {
        window.location.href = `tel:${data.phoneNumber}`;
      }
    } catch (err) {
      console.error('Start viva error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsStarting(false);
    }
  };

  if (!subject) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-6 w-6" />
              <p className="font-medium">Invalid Viva Link</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              This link is missing required information. Please ask your teacher for a valid viva link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (vivaStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-700">Viva Initiated!</CardTitle>
            <CardDescription>
              Your viva session has been registered
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
              <p className="text-sm text-green-800">
                <strong>Your viva has been scheduled.</strong> You will receive a call from the AI Viva assistant. Please ensure your phone is nearby and ready to answer.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-sm text-blue-800 font-medium mb-2">What happens next:</p>
              <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                <li>You will receive a phone call</li>
                <li>The AI examiner will ask you questions about {subject}</li>
                <li>Speak clearly and take your time to answer</li>
                <li>Your responses will be recorded for evaluation</li>
              </ul>
            </div>
            <div className="space-y-2 text-sm border-t pt-4">
              <p><strong>Student:</strong> {studentName}</p>
              <p><strong>Email:</strong> {studentEmail}</p>
              <p><strong>Subject:</strong> {subject}</p>
              {topic && <p><strong>Topic:</strong> {topic}</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">AI Viva Examination</CardTitle>
          <CardDescription>
            Enter your details to start your viva
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 rounded-lg bg-muted/50 border space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Viva Configuration (Set by Teacher)</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="flex items-center gap-1 text-sm py-1 px-3">
                <BookOpen className="h-3 w-3" />
                {subject}
              </Badge>
              {topic && (
                <Badge variant="outline" className="flex items-center gap-1 text-sm py-1 px-3">
                  <Tag className="h-3 w-3" />
                  {topic.includes(',') ? 'Multiple Topics' : topic}
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Enter your full name"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                className="h-12"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Button
            className="w-full h-12 text-base font-semibold"
            onClick={handleStartViva}
            disabled={isStarting || !canStart}
          >
            {isStarting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Starting Viva...
              </>
            ) : (
              <>
                <Phone className="h-5 w-5 mr-2" />
                Start Viva
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By starting the viva, you agree to be recorded for evaluation purposes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VivaStartPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <VivaStartContent />
    </Suspense>
  );
}
