"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { GraduationCap, Lock, Mail, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useEffect } from "react";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type FormValues = z.infer<typeof formSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [teacherInfo, setTeacherInfo] = useState<{
    firstName: string;
    lastName: string;
    username: string;
  } | null>(null);
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Fetch teacher info when email changes
  const emailValue = form.watch("email");
  
  useEffect(() => {
    if (emailValue && emailValue.includes("@")) {
      // Fetch teacher info based on email
      fetch("/api/auth/get-teacher", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: emailValue }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.teacher) {
            setTeacherInfo(data.teacher);
          } else {
            setTeacherInfo(null);
          }
        })
        .catch(() => {
          setTeacherInfo(null);
        });
    } else {
      setTeacherInfo(null);
    }
  }, [emailValue]);

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    form.clearErrors("root");

    try {
      // Call authentication API
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Store teacher info in localStorage for sidebar
        if (result.teacher) {
          localStorage.setItem("teacherInfo", JSON.stringify(result.teacher));
        }
        // Authentication successful, redirect to dashboard
        router.push("/dashboard");
      } else {
        // Authentication failed
        form.setError("root", {
          message:
            result.error || "Invalid email or password. Please try again.",
        });
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Login error:", error);
      form.setError("root", {
        message: "An error occurred. Please try again later.",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      {/* Decorative elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo Section */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-lg shadow-primary/25 mb-4">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Teacher Portal
          </h1>
          <p className="text-muted-foreground mt-2">
            Sign in to access the AI Viva admin panel
          </p>
        </div>

        {/* Login Card */}
        <div className="glass rounded-2xl p-8 shadow-xl animate-fade-in-up stagger-1">
          {/* User Profile Section */}
          {teacherInfo && (
            <div className="mb-6 pb-6 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent/20 text-sm font-semibold text-sidebar-accent">
                  {(teacherInfo.firstName?.[0] || "").toUpperCase()}
                  {(teacherInfo.lastName?.[0] || "").toUpperCase()}
                </div>
                <div className="flex-1 truncate">
                  <p className="truncate text-sm font-medium text-foreground">
                    {teacherInfo.firstName} {teacherInfo.lastName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {teacherInfo.username}
                  </p>
                </div>
              </div>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground/80">
                      Email Address
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="teacher@school.edu"
                          className="pl-10 h-11 bg-background/50"
                          {...field}
                          disabled={isLoading}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground/80">
                      Password
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          className="pl-10 pr-10 h-11 bg-background/50"
                          {...field}
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          disabled={isLoading}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  <span className="text-muted-foreground">Remember me</span>
                </label>
                <a
                  href="#"
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot password?
                </a>
              </div>

              {form.formState.errors.root && (
                <div className="text-sm font-medium text-destructive bg-destructive/10 rounded-lg p-3">
                  {form.formState.errors.root.message}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 text-base font-semibold group"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Sign In
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                )}
              </Button>
            </form>
          </Form>


          <div className="mt-4 pt-4 border-t border-border/50 text-center">
            <p className="text-sm text-muted-foreground">
              Need help?{" "}
              <a
                href="#"
                className="text-primary hover:text-primary/80 transition-colors"
              >
                Contact administrator
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-6 animate-fade-in-up stagger-2">
          © 2026 AI Viva. All rights reserved.
        </p>
      </div>
    </div>
  );
}


