"use client";

import { useState, useRef, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileText,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  Trash2,
  BookOpen,
  Brain,
  Target,
  X,
  Lightbulb,
  Tag,
  Loader2,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VivaQuestion {
  id: number;
  question: string;
  expectedAnswer: string;
  difficulty: "easy" | "medium" | "hard";
  topic: string;
}

interface GeneratedViva {
  questions: VivaQuestion[];
  documentSummary: string;
  topics: string[];
}

interface Subject {
  id: number;
  name: string;
  code: string;
  status: string;
}

interface Topic {
  id: number;
  subject: string;
  name: string;
  status: string;
}

const difficultyColors = {
  easy: "bg-emerald-100 text-emerald-700 border-emerald-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  hard: "bg-rose-100 text-rose-700 border-rose-200",
};

type InputMode = "topic" | "file" | "text";

export default function VivaGeneratorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState("");
  const [subject, setSubject] = useState("");
  const [topics, setTopics] = useState("");
  const [difficulty, setDifficulty] = useState("mixed");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedViva, setGeneratedViva] = useState<GeneratedViva | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>("topic");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for subjects and topics from database
  const [subjectsList, setSubjectsList] = useState<Subject[]>([]);
  const [topicsList, setTopicsList] = useState<Topic[]>([]);
  const [filteredTopics, setFilteredTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);

  // Fetch subjects on mount
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await fetch("/api/subjects");
        const data = await response.json();
        if (data.success) {
          setSubjectsList(data.subjects || []);
        }
      } catch (error) {
        console.error("Failed to fetch subjects:", error);
      } finally {
        setIsLoadingSubjects(false);
      }
    };

    fetchSubjects();
  }, []);

  // Fetch all topics on mount
  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const response = await fetch("/api/topics");
        const data = await response.json();
        if (data.success) {
          setTopicsList(data.topics || []);
        }
      } catch (error) {
        console.error("Failed to fetch topics:", error);
      } finally {
        setIsLoadingTopics(false);
      }
    };

    fetchTopics();
  }, []);

  // Filter topics when subject changes
  useEffect(() => {
    if (subject) {
      const filtered = topicsList.filter(
        (t) => t.subject.toLowerCase() === subject.toLowerCase()
      );
      setFilteredTopics(filtered);
      setSelectedTopic(""); // Reset topic when subject changes
      setTopics(""); // Reset topics input
    } else {
      setFilteredTopics([]);
      setSelectedTopic("");
      setTopics("");
    }
  }, [subject, topicsList]);

  // Update topics input when a topic is selected
  useEffect(() => {
    if (selectedTopic && selectedTopic !== "all") {
      setTopics(selectedTopic);
    } else if (selectedTopic === "all") {
      // Set all topics for this subject
      const allTopicNames = filteredTopics.map((t) => t.name).join(", ");
      setTopics(allTopicNames);
    }
  }, [selectedTopic, filteredTopics]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = ["application/pdf", "text/plain"];
      const validExtensions = [".pdf", ".txt", ".md"];
      const isValidType = validTypes.includes(selectedFile.type);
      const isValidExtension = validExtensions.some((ext) =>
        selectedFile.name.toLowerCase().endsWith(ext)
      );

      if (isValidType || isValidExtension) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError("Please upload a PDF or text file");
        setFile(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const validExtensions = [".pdf", ".txt", ".md"];
      const isValidExtension = validExtensions.some((ext) =>
        droppedFile.name.toLowerCase().endsWith(ext)
      );

      if (isValidExtension) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError("Please upload a PDF or text file");
      }
    }
  };

  const canGenerate = () => {
    if (inputMode === "topic") {
      return subject.trim() || topics.trim();
    }
    if (inputMode === "file") {
      return file !== null;
    }
    if (inputMode === "text") {
      return textContent.trim().length > 0;
    }
    return false;
  };

  const handleGenerate = async () => {
    if (!canGenerate()) {
      if (inputMode === "topic") {
        setError("Please select a subject or enter specific topics");
      } else if (inputMode === "file") {
        setError("Please upload a document first");
      } else {
        setError("Please enter some text content");
      }
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const formData = new FormData();

      if (inputMode === "topic") {
        formData.append("topicOnly", "true");
      } else if (inputMode === "file" && file) {
        formData.append("document", file);
      } else if (inputMode === "text") {
        formData.append("textContent", textContent);
      }

      formData.append("subject", subject || "General");
      formData.append("topics", topics);
      formData.append("difficulty", difficulty);

      const response = await fetch("/api/generate-viva", {
        method: "POST",
        body: formData,
      });

      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text.substring(0, 500));
        throw new Error(
          "Server returned an invalid response. Please check if OpenAI API key is configured."
        );
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate viva questions");
      }

      setGeneratedViva(data);
    } catch (err) {
      console.error("Generation error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportQuestions = () => {
    if (!generatedViva) return;

    const content = generatedViva.questions
      .map(
        (q, i) =>
          `Question ${i + 1}: ${q.question}\n\nExpected Answer: ${q.expectedAnswer}\n\nDifficulty: ${q.difficulty}\nTopic: ${q.topic}\n\n${"─".repeat(50)}\n`
      )
      .join("\n");

    const blob = new Blob(
      [
        `AI Viva Questions - ${subject || "General"}\n${"═".repeat(50)}\n\nSummary:\n${generatedViva.documentSummary}\n\nTopics Covered: ${generatedViva.topics.join(", ")}\n\n${"═".repeat(50)}\n\n${content}`,
      ],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `viva-questions-${subject || "general"}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setFile(null);
    setTextContent("");
    setGeneratedViva(null);
    setError(null);
    setSaveSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const saveToViva = async () => {
    if (!generatedViva) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setError(null);

    try {
      const response = await fetch("/api/save-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject || "General",
          topics: generatedViva.topics,
          questions: generatedViva.questions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save questions");
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err) {
      console.error("Save error:", err);
      setError(err instanceof Error ? err.message : "Failed to save questions");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Header
        title="Viva Generator"
        description="Generate intelligent viva questions using AI - from topics, documents, or text"
      />

      <div className="p-6 space-y-6">
        {/* Configuration Section */}
        <Card className="animate-fade-in-up border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Settings2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Configuration</CardTitle>
                <CardDescription>
                  Select subject and topic for generating viva questions
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Subject Dropdown */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-500" />
                  Subject <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={subject}
                  onValueChange={setSubject}
                  disabled={isLoadingSubjects}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue
                      placeholder={
                        isLoadingSubjects ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading subjects...
                          </span>
                        ) : (
                          "Select a subject"
                        )
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {subjectsList.map((s) => (
                      <SelectItem key={s.id} value={s.name}>
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-blue-500" />
                          {s.name}
                          {s.code && (
                            <span className="text-xs text-muted-foreground">
                              ({s.code})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {subjectsList.length === 0 && !isLoadingSubjects && (
                  <p className="text-xs text-muted-foreground">
                    No subjects found. Add subjects in the Subjects section.
                  </p>
                )}
              </div>

              {/* Topic Dropdown */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-purple-500" />
                  Topic
                </Label>
                <Select
                  value={selectedTopic}
                  onValueChange={setSelectedTopic}
                  disabled={!subject || isLoadingTopics}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue
                      placeholder={
                        !subject
                          ? "Select a subject first"
                          : isLoadingTopics
                          ? "Loading topics..."
                          : filteredTopics.length === 0
                          ? "No topics available"
                          : "Select a topic"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-gray-500" />
                        All Topics
                      </div>
                    </SelectItem>
                    {filteredTopics.map((topic) => (
                      <SelectItem key={`${topic.subject}-${topic.name}`} value={topic.name}>
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-purple-500" />
                          {topic.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {subject && filteredTopics.length === 0 && !isLoadingTopics && (
                  <p className="text-xs text-muted-foreground">
                    No topics for this subject. Add topics in the Topics section.
                  </p>
                )}
              </div>
            </div>

            {/* Selected Configuration Display */}
            {subject && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm font-medium mb-2">Selected Configuration:</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    {subject}
                  </Badge>
                  {selectedTopic && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {selectedTopic === "all" ? "All Topics" : selectedTopic}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Input Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input Card */}
          <Card className="animate-fade-in-up">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Question Source
              </CardTitle>
              <CardDescription>
                Choose how to generate your viva questions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Input Mode Toggle - 3 options */}
              <div className="flex gap-1 p-1 bg-muted rounded-lg">
                <button
                  onClick={() => setInputMode("topic")}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5",
                    inputMode === "topic"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Lightbulb className="h-4 w-4" />
                  Topic Only
                </button>
                <button
                  onClick={() => setInputMode("file")}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5",
                    inputMode === "file"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Upload className="h-4 w-4" />
                  Upload File
                </button>
                <button
                  onClick={() => setInputMode("text")}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5",
                    inputMode === "text"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FileText className="h-4 w-4" />
                  Paste Text
                </button>
              </div>

              {inputMode === "topic" ? (
                <div className="p-6 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 text-center">
                  <Lightbulb className="h-10 w-10 mx-auto text-primary mb-3" />
                  <h3 className="font-semibold text-lg mb-1">
                    Topic-Based Generation
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Select a subject and topic from the Configuration above.
                    <br />
                    AI will generate comprehensive viva questions.
                  </p>
                </div>
              ) : inputMode === "file" ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className={cn(
                    "relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer hover:border-primary/50 hover:bg-primary/5",
                    file ? "border-primary bg-primary/5" : "border-border"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {file ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2 text-primary">
                        <CheckCircle2 className="h-8 w-8" />
                      </div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                      <p className="font-medium">
                        Drop your document here or click to browse
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Supports PDF, TXT, and MD files
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <Textarea
                  placeholder="Paste your educational content, notes, or study material here..."
                  className="min-h-[200px]"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                />
              )}
            </CardContent>
          </Card>

          {/* Generation Options Card */}
          <Card className="animate-fade-in-up stagger-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Generation Options
              </CardTitle>
              <CardDescription>
                Customize how your viva questions are generated
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="difficulty">Question Difficulty</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mixed">Mixed (Recommended)</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="custom-topics">
                  Additional Topics{" "}
                  <span className="text-muted-foreground text-xs">
                    (comma-separated, optional)
                  </span>
                </Label>
                <Input
                  id="custom-topics"
                  placeholder="e.g., Binary Trees, Sorting Algorithms"
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Add custom topics or the selected topic will be used
                </p>
              </div>

              <div className="pt-4 space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <Button
                  className="w-full h-12 text-base font-semibold"
                  onClick={handleGenerate}
                  disabled={isGenerating || !canGenerate()}
                >
                  {isGenerating ? (
                    <>
                      <Sparkles className="h-5 w-5 mr-2 animate-pulse" />
                      Generating Questions...
                    </>
                  ) : (
                    <>
                      <Brain className="h-5 w-5 mr-2" />
                      Generate Viva Questions
                    </>
                  )}
                </Button>

                {isGenerating && (
                  <div className="space-y-2">
                    <Progress indeterminate className="h-2" />
                    <p className="text-sm text-center text-muted-foreground">
                      AI is crafting thoughtful questions for you...
                    </p>
                  </div>
                )}
              </div>

              {/* Info Cards */}
              <div className="grid grid-cols-2 gap-3 pt-4">
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                  <div className="flex items-center gap-2 text-blue-700 mb-1">
                    <BookOpen className="h-4 w-4" />
                    <span className="text-xs font-semibold">Smart AI</span>
                  </div>
                  <p className="text-xs text-blue-600">
                    Generates relevant conceptual questions
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-purple-50 border border-purple-100">
                  <div className="flex items-center gap-2 text-purple-700 mb-1">
                    <Target className="h-4 w-4" />
                    <span className="text-xs font-semibold">5 Questions</span>
                  </div>
                  <p className="text-xs text-purple-600">
                    Varied difficulty & comprehensive
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Generated Questions */}
        {generatedViva && (
          <div className="space-y-6 animate-fade-in-up">
            {/* Summary Card */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Generated Viva
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={saveToViva}
                      disabled={isSaving || saveSuccess}
                      className={saveSuccess ? "bg-green-600 hover:bg-green-600" : ""}
                    >
                      {isSaving ? (
                        <>
                          <Sparkles className="h-4 w-4 mr-1 animate-spin" />
                          Saving...
                        </>
                      ) : saveSuccess ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Saved to AI Viva!
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-1" />
                          Save for AI Viva
                        </>
                      )}
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportQuestions}>
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                    <Button variant="ghost" size="sm" onClick={resetForm}>
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-1">Summary</h4>
                  <p className="text-sm text-muted-foreground">
                    {generatedViva.documentSummary}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Topics Covered</h4>
                  <div className="flex flex-wrap gap-2">
                    {generatedViva.topics.map((topic, i) => (
                      <Badge key={i} variant="secondary">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Questions Grid */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Viva Questions</h3>
              <div className="grid gap-4">
                {generatedViva.questions.map((q, index) => (
                  <Card
                    key={q.id}
                    className="animate-fade-in-up hover:shadow-lg transition-shadow"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                            {q.id}
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(difficultyColors[q.difficulty])}
                          >
                            {q.difficulty}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {q.topic}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(
                              `Q: ${q.question}\n\nExpected Answer: ${q.expectedAnswer}`,
                              q.id
                            )
                          }
                          className="shrink-0"
                        >
                          {copiedId === q.id ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <h4 className="text-sm font-semibold text-primary mb-1">
                            Question
                          </h4>
                          <p className="text-base font-medium">{q.question}</p>
                        </div>

                        <div className="pt-2 border-t">
                          <h4 className="text-sm font-semibold text-muted-foreground mb-1">
                            Expected Answer
                          </h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {q.expectedAnswer}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
