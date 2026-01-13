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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Download,
  Eye,
  FileText,
  Calendar,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  AlertCircle,
  MessageSquare,
  X,
  Mail,
} from "lucide-react";

interface VivaResult {
  id: string;
  timestamp: string;
  studentName: string;
  studentEmail: string;
  subject: string;
  topics: string;
  questionsAnswered: number;
  score: number;
  overallFeedback: string;
  transcript: string;
  recordingUrl?: string;
}

export default function ResultsPage() {
  const [results, setResults] = useState<VivaResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("All Subjects");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedResult, setSelectedResult] = useState<VivaResult | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  // Fetch results from API
  const fetchResults = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/results");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch results");
      }

      setResults(data.data || []);
    } catch (err) {
      console.error("Error fetching results:", err);
      setError(err instanceof Error ? err.message : "Failed to load results");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  // Get unique subjects for filter
  const subjects = [
    "All Subjects",
    ...Array.from(new Set(results.map((r) => r.subject))),
  ];

  const passingScore = 50;

  const getFilteredResults = () => {
    return results.filter((result) => {
      const matchesSearch =
        result.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        result.studentEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        result.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSubject =
        selectedSubject === "All Subjects" ||
        result.subject === selectedSubject;

      const isPassed = result.score >= passingScore;
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "passed" && isPassed) ||
        (activeTab === "failed" && !isPassed);

      return matchesSearch && matchesSubject && matchesTab;
    });
  };

  const filteredResults = getFilteredResults();

  const totalPassed = results.filter((r) => r.score >= passingScore).length;
  const totalFailed = results.filter((r) => r.score < passingScore).length;
  const avgScore =
    results.length > 0
      ? Math.round(
          results.reduce((sum, r) => sum + r.score, 0) / results.length
        )
      : 0;

  const getScoreBadge = (score: number) => {
    if (score < passingScore) {
      return (
        <Badge variant="destructive" className="font-mono">
          {score}%
        </Badge>
      );
    }
    if (score >= 80) {
      return (
        <Badge variant="success" className="font-mono">
          {score}%
        </Badge>
      );
    }
    if (score >= 60) {
      return (
        <Badge variant="warning" className="font-mono">
          {score}%
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="font-mono">
        {score}%
      </Badge>
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  // Parse transcript to show Q&A pairs
  const parseTranscript = (transcript: string) => {
    if (!transcript) return [];

    const lines = transcript.split("\n").filter((line) => line.trim());
    const qaPairs: { role: string; content: string }[] = [];

    for (const line of lines) {
      if (line.startsWith("AI:") || line.startsWith("Student:")) {
        const [role, ...contentParts] = line.split(":");
        qaPairs.push({
          role: role.trim(),
          content: contentParts.join(":").trim(),
        });
      }
    }

    return qaPairs;
  };

  // Send email with results to student
  const handleSendEmail = async (result: VivaResult) => {
    if (!result.studentEmail) {
      alert("Student email is not available");
      return;
    }

    setSendingEmail(result.id);
    try {
      const response = await fetch("/api/send-result-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentEmail: result.studentEmail,
          studentName: result.studentName,
          subject: result.subject,
          topics: result.topics,
          score: result.score,
          questionsAnswered: result.questionsAnswered,
          overallFeedback: result.overallFeedback,
          transcript: result.transcript,
          timestamp: result.timestamp,
          evaluation: result.evaluation,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert(`Email sent successfully to ${result.studentEmail}`);
      } else {
        alert(data.error || "Failed to send email");
      }
    } catch (error) {
      console.error("Failed to send email:", error);
      alert("Failed to send email. Please try again.");
    } finally {
      setSendingEmail(null);
    }
  };

  if (loading) {
    return (
      <>
        <Header
          title="Viva Results"
          description="View and analyze all viva examination results"
        />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center space-y-4">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading results...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header
          title="Viva Results"
          description="View and analyze all viva examination results"
        />
        <div className="p-6">
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <div className="flex-1">
                  <h3 className="font-semibold text-destructive">
                    Failed to Load Results
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">{error}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Make sure Google Sheets credentials are configured in your
                    environment variables (GOOGLE_PRIVATE_KEY, GOOGLE_CLIENT_EMAIL,
                    GOOGLE_SHEET_ID).
                  </p>
                </div>
                <Button onClick={fetchResults} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="Viva Results"
        description="View and analyze all viva examination results"
      />

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="animate-fade-in-up">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-100">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{results.length}</div>
                <p className="text-sm text-muted-foreground">Total Vivas</p>
              </div>
            </CardContent>
          </Card>
          <Card className="animate-fade-in-up stagger-1">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-100">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {totalPassed}
                </div>
                <p className="text-sm text-muted-foreground">Passed</p>
              </div>
            </CardContent>
          </Card>
          <Card className="animate-fade-in-up stagger-2">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-red-100">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {totalFailed}
                </div>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </CardContent>
          </Card>
          <Card className="animate-fade-in-up stagger-3">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-100">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{avgScore}%</div>
                <p className="text-sm text-muted-foreground">Avg. Score</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="animate-fade-in-up stagger-4">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Examination Results</CardTitle>
                <CardDescription>
                  Complete record of all AI viva examinations from Google Sheets
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={fetchResults} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <TabsList>
                  <TabsTrigger value="all">All Results</TabsTrigger>
                  <TabsTrigger value="passed">Passed</TabsTrigger>
                  <TabsTrigger value="failed">Failed</TabsTrigger>
                </TabsList>

                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search student..."
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Select
                    value={selectedSubject}
                    onValueChange={setSelectedSubject}
                  >
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder="Subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject} value={subject}>
                          {subject}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <TabsContent value={activeTab} className="mt-0">
                {filteredResults.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">
                      {results.length === 0
                        ? "No viva results found. Complete a viva in the AI Viva app to see results here."
                        : "No results match your criteria."}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead className="text-center">Score</TableHead>
                          <TableHead className="text-center">Questions</TableHead>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Feedback</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredResults.map((result) => (
                          <TableRow key={result.id} className="group">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div
                                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                                    result.score >= passingScore
                                      ? "bg-green-100 text-green-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {result.studentName
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .substring(0, 2)}
                                </div>
                                <div>
                                  <p className="font-medium">
                                    {result.studentName}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {result.studentEmail}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{result.subject}</TableCell>
                            <TableCell className="text-center">
                              {getScoreBadge(result.score)}
                            </TableCell>
                            <TableCell className="text-center">
                              {result.questionsAnswered}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {formatDate(result.timestamp)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm text-muted-foreground max-w-xs truncate">
                                {result.overallFeedback || "No feedback"}
                              </p>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleSendEmail(result)}
                                  disabled={sendingEmail === result.id || !result.studentEmail}
                                  title="Send results via email"
                                >
                                  {sendingEmail === result.id ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Mail className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setSelectedResult(result)}
                                  title="View details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {result.recordingUrl && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    asChild
                                    title="View recording"
                                  >
                                    <a
                                      href={result.recordingUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <FileText className="h-4 w-4" />
                                    </a>
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Pagination info */}
            {filteredResults.length > 0 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {filteredResults.length} of {results.length} results
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transcript Modal */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-3xl max-h-[80vh] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Viva Transcript</CardTitle>
                <CardDescription>
                  {selectedResult.studentName} - {selectedResult.subject}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSendEmail(selectedResult)}
                  disabled={sendingEmail === selectedResult.id || !selectedResult.studentEmail}
                >
                  {sendingEmail === selectedResult.id ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Send Email
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedResult(null)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[calc(80vh-120px)]">
              {/* Score and Feedback */}
              <div className="mb-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-4 mb-4">
                  <span className="font-semibold text-foreground">Score:</span>
                  {getScoreBadge(selectedResult.score)}
                  <span className="text-muted-foreground">
                    ({selectedResult.questionsAnswered} questions answered)
                  </span>
                </div>
                {selectedResult.overallFeedback && (
                  <div className="mt-4">
                    <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      Detailed Feedback & Recommendations
                    </h4>
                    <div className="bg-background/80 p-4 rounded-md border border-border/50">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                        {selectedResult.overallFeedback}
                      </p>
                    </div>
                    {selectedResult.score < 50 && (
                      <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
                        <p className="text-xs text-amber-800 dark:text-amber-200 font-medium">
                          💡 Review the questions and answers below to understand where you can improve. Focus on the areas mentioned in the feedback above.
                        </p>
                      </div>
                    )}
                    {selectedResult.score >= 80 && (
                      <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md">
                        <p className="text-xs text-green-800 dark:text-green-200 font-medium">
                          🎉 Great work! Continue building on your strengths and explore advanced topics to further enhance your knowledge.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Questions & Answers */}
              <h4 className="font-semibold mb-4">Questions & Answers</h4>
              <div className="space-y-4">
                {parseTranscript(selectedResult.transcript).length > 0 ? (
                  parseTranscript(selectedResult.transcript).map(
                    (item, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg ${
                          item.role === "AI"
                            ? "bg-primary/10 border-l-4 border-primary"
                            : "bg-muted/50 border-l-4 border-muted-foreground"
                        }`}
                      >
                        <span
                          className={`text-xs font-semibold uppercase ${
                            item.role === "AI"
                              ? "text-primary"
                              : "text-muted-foreground"
                          }`}
                        >
                          {item.role}
                        </span>
                        <p className="mt-1">{item.content}</p>
                      </div>
                    )
                  )
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No transcript available for this viva.</p>
                    {selectedResult.transcript && (
                      <pre className="mt-4 text-left text-xs bg-muted p-4 rounded overflow-x-auto whitespace-pre-wrap">
                        {selectedResult.transcript}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
