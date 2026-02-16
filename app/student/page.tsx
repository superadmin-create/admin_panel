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
import Image from "next/image";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z
    .string()
    .min(10, "Phone number must be 10 digits")
    .max(10, "Phone number must be 10 digits")
    .regex(/^\d+$/, "Phone number must contain only digits"),
});

type FormValues = z.infer<typeof formSchema>;

function StudentFormContent() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const subject = searchParams.get('subject') || '';
  const topic = searchParams.get('topic') || '';
  const questionCount = searchParams.get('questions') || '';

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);

    try {
      const verifyResponse = await fetch("/api/verify-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          phone: values.phone,
        }),
      });

      const verifyResult = await verifyResponse.json();

      if (!verifyResult.success) {
        form.setError("root", {
          message: verifyResult.message || "Verification failed. Please try again.",
        });
        setIsLoading(false);
        return;
      }

      if (!verifyResult.verified) {
        form.setError("root", {
          message: verifyResult.message || "You are not registered with this institution. Please contact your teacher.",
        });
        setIsLoading(false);
        return;
      }

      const studentData = {
        fullName: verifyResult.studentData?.name || values.fullName,
        email: verifyResult.studentData?.email || values.email,
        phone: verifyResult.studentData?.phone || values.phone,
        studentId: verifyResult.studentData?.id,
        subject: subject,
        topic: topic || undefined,
        questionCount: questionCount ? parseInt(questionCount, 10) : undefined,
      };

      sessionStorage.setItem("studentFormData", JSON.stringify(studentData));
      router.push("/student/viva");
    } catch (error) {
      console.error("Error submitting form:", error);
      form.setError("root", {
        message: "An error occurred. Please try again.",
      });
      setIsLoading(false);
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

                <div>
                  <label className="text-sm font-medium leading-none">Subject</label>
                  <div className="mt-2 px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-700 cursor-not-allowed">
                    {subject}
                  </div>
                </div>

                {topic && (
                  <div>
                    <label className="text-sm font-medium leading-none">Topic</label>
                    <div className="mt-2 px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-700 cursor-not-allowed">
                      {topic.includes(',') ? topic.split(',').join(', ') : topic}
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
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Processing...
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
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <StudentFormContent />
    </Suspense>
  );
}
