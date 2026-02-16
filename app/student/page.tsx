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

function StudentFormContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [subjects, setSubjects] = useState<{ name: string; teacherEmail: string }[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const router = useRouter();
  const searchParams = useSearchParams();

  const lockedSubject = searchParams.get("subject") || "";
  const lockedTopic = searchParams.get("topic") || "";
  const isSubjectLocked = !!lockedSubject;
  const questionsParam = searchParams.get("questions") || "";

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await fetch("/api/subjects");
        const data = await response.json();
        if (data.success && data.subjects) {
          const subjectList = data.subjects.map((s: any) =>
            typeof s === "string" ? { name: s, teacherEmail: "" } : s
          );
          setSubjects(subjectList);
        }
      } catch (error) {
        console.error("Failed to fetch subjects:", error);
        setSubjects([
          { name: "Data Structures", teacherEmail: "" },
          { name: "DBMS", teacherEmail: "" },
          { name: "Operating Systems", teacherEmail: "" },
          { name: "Computer Networks", teacherEmail: "" },
        ]);
      } finally {
        setIsLoadingSubjects(false);
      }
    };

    fetchSubjects();
  }, []);

  const [isHydrated, setIsHydrated] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(baseFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      subject: lockedSubject || undefined,
    },
  });

  useEffect(() => {
    if (lockedSubject) {
      form.setValue("subject", lockedSubject);
      setSelectedSubject(lockedSubject);
    }
  }, [lockedSubject, form]);

  useEffect(() => {
    if (isSubjectLocked) return;
    const savedData = getSavedFormData();
    if (savedData.fullName) form.setValue("fullName", savedData.fullName);
    if (savedData.email) form.setValue("email", savedData.email);
    if (savedData.phone) form.setValue("phone", savedData.phone);
    if (savedData.subject && !isSubjectLocked) {
      form.setValue("subject", savedData.subject);
      setSelectedSubject(savedData.subject);
    }
    setIsHydrated(true);
  }, [form, isSubjectLocked]);

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
  };

  const onSubmit = async (data: FormValues) => {
    if (!subjects.some(s => s.name === data.subject) && !isSubjectLocked) {
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
          verifyResult.error || verifyResult.message || "Email not registered in our system";
        form.setError("root", {
          message: errorMessage,
        });
        setIsLoading(false);
        return;
      }

      const matchedSubject = subjects.find(s => s.name === data.subject);
      const formDataWithTeacher: Record<string, any> = {
        ...data,
        teacherEmail: matchedSubject?.teacherEmail || "",
        topic: lockedTopic || undefined,
      };
      if (questionsParam) {
        formDataWithTeacher.questionCount = parseInt(questionsParam, 10);
      }
      sessionStorage.setItem("studentFormData", JSON.stringify(formDataWithTeacher));

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

      router.push("/student/verify");
    } catch (error) {
      console.error("Error submitting form:", error);
      form.setError("root", {
        message: error instanceof Error ? error.message : "An error occurred. Please try again.",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8 md:py-16">
        <div className="max-w-md mx-auto">
          <div className="bg-white/80 backdrop-blur-xl border border-slate-200/50 rounded-2xl shadow-2xl p-6 md:p-10">
            <div className="text-center mb-8">
              <Image
                src="/logo.png"
                alt="LeapUp Logo"
                width={180}
                height={60}
                className="mx-auto mb-6"
              />
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Student Registration
              </h1>
              <p className="text-gray-500">
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
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your full name"
                          {...field}
                          className="h-12"
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
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Enter your email"
                          {...field}
                          className="h-12"
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
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="Enter your 10-digit phone number"
                          {...field}
                          className="h-12"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isSubjectLocked ? (
                  <div>
                    <label className="text-sm font-medium leading-none">Subject</label>
                    <div className="mt-2 px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-700 cursor-not-allowed">
                      {lockedSubject}
                    </div>
                  </div>
                ) : (
                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject</FormLabel>
                        <Select
                          onValueChange={handleSubjectChange}
                          value={selectedSubject}
                          disabled={isLoadingSubjects}
                        >
                          <FormControl>
                            <SelectTrigger className="h-12">
                              <SelectValue placeholder={isLoadingSubjects ? "Loading subjects..." : "Select a subject"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {subjects.map((subject) => (
                              <SelectItem key={subject.name} value={subject.name}>
                                {subject.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {lockedTopic && (
                  <div>
                    <label className="text-sm font-medium leading-none">Topic</label>
                    <div className="mt-2 px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-700 cursor-not-allowed">
                      {lockedTopic.includes(',') ? lockedTopic.split(',').join(', ') : lockedTopic}
                    </div>
                  </div>
                )}

                {form.formState.errors.root && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm font-medium text-red-600">
                    {form.formState.errors.root.message}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
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

export default function StudentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
          <svg
            className="h-8 w-8 animate-spin text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      }
    >
      <StudentFormContent />
    </Suspense>
  );
}
