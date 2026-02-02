"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";

const STORAGE_KEY = "studentFormDraft";

const baseFormSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z
    .string()
    .min(10, "Phone number must be 10 digits")
    .max(10, "Phone number must be 10 digits")
    .regex(/^\d+$/, "Phone number must contain only digits"),
  subject: z.string().min(1, "Please select a subject"),
  topic: z.string().optional(),
});

type FormValues = z.infer<typeof baseFormSchema>;

function getSavedFormData(): Partial<FormValues> {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Error loading saved form data:", e);
  }
  return {};
}

function HomeContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get locked subject and topic from URL params
  const lockedSubject = searchParams.get('subject') || '';
  const lockedTopic = searchParams.get('topic') || '';
  const isSubjectLocked = !!lockedSubject;
  const isTopicLocked = !!lockedTopic;

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await fetch("/api/subjects");
        const data = await response.json();
        if (data.success && data.subjects) {
          setSubjects(data.subjects);
        }
      } catch (error) {
        console.error("Failed to fetch subjects:", error);
        setSubjects([
          "Data Structures",
          "DBMS",
          "Operating Systems",
          "Computer Networks",
        ]);
      } finally {
        setIsLoadingSubjects(false);
      }
    };

    fetchSubjects();
  }, []);

  useEffect(() => {
    const fetchTopics = async () => {
      if (!selectedSubject) {
        setTopics([]);
        return;
      }

      setIsLoadingTopics(true);
      try {
        const response = await fetch(`/api/topics?subject=${encodeURIComponent(selectedSubject)}`);
        const data = await response.json();
        if (data.success && data.topics) {
          setTopics(data.topics);
        } else {
          setTopics([]);
        }
      } catch (error) {
        console.error("Failed to fetch topics:", error);
        setTopics([]);
      } finally {
        setIsLoadingTopics(false);
      }
    };

    fetchTopics();
  }, [selectedSubject]);

  const [isHydrated, setIsHydrated] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(baseFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      subject: lockedSubject || undefined,
      topic: lockedTopic || undefined,
    },
  });

  // Set locked values from URL on mount
  useEffect(() => {
    if (lockedSubject) {
      form.setValue("subject", lockedSubject);
      setSelectedSubject(lockedSubject);
    }
    if (lockedTopic) {
      form.setValue("topic", lockedTopic);
    }
  }, [lockedSubject, lockedTopic, form]);

  useEffect(() => {
    if (isSubjectLocked) return; // Don't load saved data if subject is locked
    const savedData = getSavedFormData();
    if (savedData.fullName) form.setValue("fullName", savedData.fullName);
    if (savedData.email) form.setValue("email", savedData.email);
    if (savedData.phone) form.setValue("phone", savedData.phone);
    if (savedData.subject && !isSubjectLocked) {
      form.setValue("subject", savedData.subject);
      setSelectedSubject(savedData.subject);
    }
    if (savedData.topic && !isTopicLocked) form.setValue("topic", savedData.topic);
    setIsHydrated(true);
  }, [form, isSubjectLocked, isTopicLocked]);

  useEffect(() => {
    if (!isHydrated) return;
    
    const subscription = form.watch((values) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
      } catch (e) {
        console.error("Error saving form data:", e);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form, isHydrated]);

  const handleSubjectChange = (value: string) => {
    if (isSubjectLocked) return;
    setSelectedSubject(value);
    form.setValue("subject", value);
    form.setValue("topic", undefined);
  };

  const onSubmit = async (data: FormValues) => {
    if (!subjects.includes(data.subject) && !isSubjectLocked) {
      form.setError("subject", { message: "Please select a valid subject" });
      return;
    }

    setIsLoading(true);
    form.clearErrors("root");

    try {
      const verifyResponse = await fetch("/api/verify-student", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: data.email,
        }),
      });

      const verifyResult = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyResult.verified) {
        const errorMessage =
          verifyResult.error || "Email not registered in our system";
        form.setError("root", {
          message: errorMessage,
        });
        setIsLoading(false);
        return;
      }

      sessionStorage.setItem("studentFormData", JSON.stringify(data));

      const otpResponse = await fetch("/api/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: data.email }),
      });

      if (!otpResponse.ok) {
        const otpError = await otpResponse.json();
        throw new Error(otpError.error || "Failed to send OTP");
      }

      router.push("/verify");
    } catch (error) {
      console.error("Error submitting form:", error);
      
      if (error instanceof Error && error.message.includes("not registered")) {
        form.setError("root", {
          message: error.message,
        });
      } else {
        form.setError("root", {
          message: "Failed to send OTP. Please try again.",
        });
      }
      
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8 md:py-16">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-2xl shadow-slate-900/5 dark:shadow-slate-900/20 p-6 md:p-10 transition-all duration-300 hover:shadow-2xl hover:shadow-slate-900/10 dark:hover:shadow-slate-900/30">
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur-xl opacity-20 animate-pulse"></div>
                <Image
                  src="/logo.png"
                  alt="LeapUp Logo"
                  width={200}
                  height={60}
                  priority
                  className="h-auto relative z-10 drop-shadow-lg"
                />
              </div>
            </div>

            <div className="mb-8 text-center">
              <h1 className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                Student Registration
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-lg">
                Please fill in your details to continue
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 dark:text-slate-300 font-semibold">
                      Full Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your full name"
                        {...field}
                        disabled={isLoading}
                        className="h-12 text-base border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 transition-all duration-200"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 dark:text-slate-300 font-semibold">
                      Email
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        {...field}
                        disabled={isLoading}
                        className="h-12 text-base border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 transition-all duration-200"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 dark:text-slate-300 font-semibold">
                      Phone
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="Enter 10-digit phone number"
                        maxLength={10}
                        {...field}
                        disabled={isLoading}
                        className="h-12 text-base border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 transition-all duration-200"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Subject Field - Locked or Dropdown */}
              {isSubjectLocked ? (
                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Subject</label>
                  <div className="mt-2 px-4 py-3 h-12 flex items-center bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-gray-700 dark:text-slate-300 cursor-not-allowed">
                    {lockedSubject}
                  </div>
                </div>
              ) : (
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700 dark:text-slate-300 font-semibold">
                        Subject
                      </FormLabel>
                      <Select
                        onValueChange={handleSubjectChange}
                        value={field.value}
                        disabled={isLoading || isLoadingSubjects}
                      >
                        <FormControl>
                          <SelectTrigger className="h-12 text-base border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 transition-all duration-200">
                            <SelectValue placeholder={isLoadingSubjects ? "Loading subjects..." : "Select a subject"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {subjects.map((subject) => (
                            <SelectItem key={subject} value={subject}>
                              {subject}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Topic Field - Locked or Dropdown */}
              {isTopicLocked ? (
                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Topic</label>
                  <div className="mt-2 px-4 py-3 h-12 flex items-center bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-gray-700 dark:text-slate-300 cursor-not-allowed">
                    {lockedTopic.includes(',') ? lockedTopic.split(',').join(', ') : lockedTopic}
                  </div>
                </div>
              ) : selectedSubject && !isSubjectLocked ? (
                <FormField
                  control={form.control}
                  name="topic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700 dark:text-slate-300 font-semibold">
                        Topic <span className="text-slate-400 font-normal">(Optional)</span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isLoading || isLoadingTopics}
                      >
                        <FormControl>
                          <SelectTrigger className="h-12 text-base border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 transition-all duration-200">
                            <SelectValue 
                              placeholder={
                                isLoadingTopics 
                                  ? "Loading topics..." 
                                  : topics.length === 0 
                                    ? "No topics available" 
                                    : "Select a topic (optional)"
                              } 
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">All Topics</SelectItem>
                          {topics.map((topic) => (
                            <SelectItem key={topic} value={topic}>
                              {topic}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500 mt-1">
                        Select a specific topic to focus your viva questions
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              {form.formState.errors.root && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 animate-in-slide">
                  {form.formState.errors.root.message}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 dark:shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={isLoading || isLoadingSubjects}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                  </span>
                ) : (
                  "Continue"
                )}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
