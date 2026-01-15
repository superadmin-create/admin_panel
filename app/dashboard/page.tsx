"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  ClipboardCheck,
  TrendingUp,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import type { VivaResult } from "@/lib/types/viva";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalVivas: 0,
    totalPassed: 0,
    totalFailed: 0,
    avgScore: 0,
    subjectStats: {} as Record<string, { count: number; avgScore: number; passRate: number }>,
    recentResults: [] as VivaResult[],
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/stats");
        const data = await response.json();

        if (response.ok && data.success && data.data) {
          setStats(data.data);
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Format stats for display
  const statsDisplay = [
    {
      title: "Total Students",
      value: stats.recentResults.length > 0 
        ? new Set(stats.recentResults.map(r => r.studentEmail)).size.toString()
        : "0",
      change: "",
      trend: "up" as const,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
    {
      title: "Vivas Completed",
      value: stats.totalVivas.toString(),
      change: "",
      trend: "up" as const,
      icon: ClipboardCheck,
      color: "text-green-600",
      bg: "bg-green-100",
    },
    {
      title: "Average Score",
      value: `${stats.avgScore}%`,
      change: "",
      trend: "up" as const,
      icon: TrendingUp,
      color: "text-purple-600",
      bg: "bg-purple-100",
    },
    {
      title: "Pass Rate",
      value: stats.totalVivas > 0
        ? `${Math.round((stats.totalPassed / stats.totalVivas) * 100)}%`
        : "0%",
      change: "",
      trend: stats.totalPassed >= stats.totalFailed ? "up" as const : "down" as const,
      icon: Clock,
      color: "text-orange-600",
      bg: "bg-orange-100",
    },
  ];

  // Format recent results (show up to 10)
  const recentResults = stats.recentResults.slice(0, 10).map((result) => ({
    id: result.id,
    student: result.studentName,
    subject: result.subject,
    score: result.score,
    date: result.timestamp,
    status: result.score >= 50 ? ("passed" as const) : ("failed" as const),
  }));

  // Format subject performance
  const subjectPerformance = Object.entries(stats.subjectStats)
    .map(([subject, data]) => ({
      subject,
      avgScore: data.avgScore,
      students: data.count,
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 4);
  return (
    <>
      <Header title="Dashboard" description="Welcome back! Here's an overview of your viva examinations." />

      <div className="p-6 space-y-6">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading dashboard data...</p>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {statsDisplay.map((stat, index) => (
            <Card
              key={stat.title}
              className="animate-fade-in-up hover:shadow-lg transition-shadow"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-xl ${stat.bg}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div
                    className={`flex items-center gap-1 text-sm font-medium ${
                      stat.trend === "up" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {stat.trend === "up" ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                    {stat.change}
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-3xl font-bold">{stat.value}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {stat.title}
                  </p>
                </div>
              </CardContent>
            </Card>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Recent Results */}
              <Card className="animate-fade-in-up stagger-2">
                <CardHeader>
                  <CardTitle>Recent Viva Results</CardTitle>
                  <CardDescription>
                    Latest examination results from your students
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {recentResults.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No results yet
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {recentResults.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {result.student
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div>
                        <p className="font-medium">{result.student}</p>
                        <p className="text-sm text-muted-foreground">
                          {result.subject}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          result.status === "passed" ? "success" : "destructive"
                        }
                      >
                        {result.score}%
                      </Badge>
                      </div>
                    </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Subject Performance */}
              <Card className="animate-fade-in-up stagger-3">
                <CardHeader>
                  <CardTitle>Subject Performance</CardTitle>
                  <CardDescription>
                    Average scores across different subjects
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {subjectPerformance.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No subject data available
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {subjectPerformance.map((subject) => (
                  <div key={subject.subject} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{subject.subject}</span>
                      <span className="text-sm text-muted-foreground">
                        {subject.students} students
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${subject.avgScore}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold w-12 text-right">
                        {subject.avgScore}%
                      </span>
                      </div>
                    </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Quick Actions */}
        <Card className="animate-fade-in-up stagger-4">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and shortcuts for efficient management
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <button className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all group">
                <Users className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium">Add Student</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all group">
                <ClipboardCheck className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium">View All Results</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all group">
                <TrendingUp className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium">Export Report</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all group">
                <Clock className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium">Schedule Viva</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
