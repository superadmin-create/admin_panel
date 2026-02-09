"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Loader2 } from "lucide-react";

function VivaStartContent() {
  const searchParams = useSearchParams();
  
  const subject = searchParams.get('subject') || '';
  const topic = searchParams.get('topic') || '';
  
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = studentName.trim().length > 0 && studentEmail.trim().length > 0 && subject;

  const handleContinue = async () => {
    if (!canSubmit) {
      setError("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('name', studentName.trim());
      params.set('email', studentEmail.trim());
      if (studentPhone.trim()) {
        params.set('phone', studentPhone.trim());
      }
      params.set('subject', subject);
      if (topic) {
        params.set('topic', topic);
      }
      
      // Redirect directly to /viva page to skip duplicate registration
      const aiVivaUrl = `https://fa4efc94-8e50-4690-906b-1db8890f5930-00-1fua1gs9falsj.sisko.replit.dev/viva?${params.toString()}`;
      window.location.href = aiVivaUrl;
    } catch (err) {
      console.error('Error:', err);
      setError('An error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (!subject) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
          <Image
            src="/logo.png"
            alt="LeapUp Logo"
            width={180}
            height={60}
            className="mx-auto mb-6"
          />
          <div className="text-red-500 font-medium mb-2">Invalid Viva Link</div>
          <p className="text-gray-500 text-sm">
            This link is missing required information. Please ask your teacher for a valid viva link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <Image
            src="/logo.png"
            alt="LeapUp Logo"
            width={180}
            height={60}
            className="mx-auto mb-6"
          />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Student Registration</h1>
          <p className="text-gray-500">Please fill in your details to continue</p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <input
              type="text"
              placeholder="Enter your full name"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              placeholder="Enter your email"
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone
            </label>
            <input
              type="tel"
              placeholder="Enter your phone number"
              value={studentPhone}
              onChange={(e) => setStudentPhone(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject
            </label>
            <div className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-700">
              {subject}
            </div>
          </div>

          {topic && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Topic
              </label>
              <div className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-700">
                {topic.includes(',') ? topic.split(',').join(', ') : topic}
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
              {error}
            </div>
          )}

          <button
            onClick={handleContinue}
            disabled={isSubmitting || !canSubmit}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Continue'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VivaStartPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <VivaStartContent />
    </Suspense>
  );
}
