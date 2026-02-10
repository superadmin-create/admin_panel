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
  Link,
  ExternalLink,
  Check,
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
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState("mixed");
  const [questionCount, setQuestionCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedViva, setGeneratedViva] = useState<GeneratedViva | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>("topic");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [vivaLink, setVivaLink] = useState<string>("");
  const [linkCopied, setLinkCopied] = useState(false);

  const [subjectsList, setSubjectsList] = useState<Subject[]>([]);
  const [topicsList, setTopicsList] = useState<Topic[]>([]);
  const [filteredTopics, setFilteredTopics] = useState<Topic[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);
  const [customTopics, setCustomTopics] = useState("");

  const subject = selectedSubjects.join(", ");
  const topics = [...selectedTopics, ...customTopics.split(",").map(t => t.trim()).filter(Boolean)].join(", ");

  const getTeacherEmail = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem("teacherInfo");
      if (stored) {
        try {
          const info = JSON.parse(stored);
          return info.username || '';
        } catch { return ''; }
      }
    }
    return '';
  };

  // Fetch subjects on mount
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const teacherEmail = getTeacherEmail();
        const url = teacherEmail ? `/api/subjects?teacherEmail=${encodeURIComponent(teacherEmail)}` : "/api/subjects";
        const response = await fetch(url);
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
        const teacherEmail = getTeacherEmail();
        const url = teacherEmail ? `/api/topics?teacherEmail=${encodeURIComponent(teacherEmail)}` : "/api/topics";
        const response = await fetch(url);
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

  useEffect(() => {
    if (selectedSubjects.length > 0) {
      const filtered = topicsList.filter(
        (t) => selectedSubjects.some(s => s.toLowerCase() === t.subject.toLowerCase())
      );
      setFilteredTopics(filtered);
      setSelectedTopics(prev => prev.filter(t => filtered.some(ft => ft.name === t)));
    } else {
      setFilteredTopics([]);
      setSelectedTopics([]);
    }
  }, [selectedSubjects, topicsList]);

  const toggleSubject = (name: string) => {
    setSelectedSubjects(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  const toggleTopic = (name: string) => {
    setSelectedTopics(prev =>
      prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
    );
  };

  const selectAllTopics = () => {
    const allNames = filteredTopics.map(t => t.name);
    const allSelected = allNames.every(n => selectedTopics.includes(n));
    if (allSelected) {
      setSelectedTopics([]);
    } else {
      setSelectedTopics(allNames);
    }
  };

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
      return selectedSubjects.length > 0 || selectedTopics.length > 0;
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
      formData.append("questionCount", questionCount.toString());

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

  const generateVivaLink = () => {
    if (selectedSubjects.length === 0) {
      setError("Please select at least one subject first");
      return;
    }
    
    const params = new URLSearchParams();
    params.set('subject', selectedSubjects.join(','));
    if (selectedTopics.length > 0) {
      params.set('topic', selectedTopics.join(','));
    }
    
    const link = `https://fa4efc94-8e50-4690-906b-1db8890f5930-00-1fua1gs9falsj.sisko.replit.dev/?${params.toString()}`;
    setVivaLink(link);
    setLinkCopied(false);
  };

  const copyVivaLink = () => {
    if (vivaLink) {
      navigator.clipboard.writeText(vivaLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
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

      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
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
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-base">
                  <BookOpen className="h-4 w-4 text-blue-500" />
                  Subjects <span className="text-destructive">*</span>
                </Label>
                {selectedSubjects.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedSubjects([])}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
              {isLoadingSubjects ? (
                <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading subjects...
                </div>
              ) : subjectsList.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center border rounded-lg bg-muted/30">
                  No subjects found. Add subjects in the Subjects section.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {subjectsList.map(s => {
                    const isSelected = selectedSubjects.includes(s.name);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSubject(s.name)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm text-left transition-all",
                          isSelected
                            ? "bg-blue-50 border-blue-300 text-blue-800 shadow-sm ring-1 ring-blue-200"
                            : "bg-background border-input hover:bg-accent/50 hover:border-blue-200 text-foreground"
                        )}
                      >
                        <div className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                          isSelected ? "bg-blue-500 border-blue-500 text-white" : "border-muted-foreground/30"
                        )}>
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <div className="flex flex-col min-w-0 overflow-hidden">
                          <span className="truncate font-medium text-xs sm:text-sm">{s.name}</span>
                          {s.code && <span className="text-[10px] text-muted-foreground truncate">{s.code}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t pt-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="flex items-center gap-2 text-base">
                  <Tag className="h-4 w-4 text-purple-500" />
                  Topics
                  {selectedSubjects.length > 0 && filteredTopics.length > 0 && (
                    <span className="text-xs font-normal text-muted-foreground">
                      ({filteredTopics.length} available)
                    </span>
                  )}
                </Label>
                <div className="flex items-center gap-3">
                  {selectedTopics.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedTopics([])}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                  {filteredTopics.length > 0 && (
                    <button
                      type="button"
                      onClick={selectAllTopics}
                      className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                    >
                      {filteredTopics.every(t => selectedTopics.includes(t.name)) ? "Deselect all" : "Select all"}
                    </button>
                  )}
                </div>
              </div>
              {selectedSubjects.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center border rounded-lg bg-muted/30">
                  Select at least one subject to see available topics
                </div>
              ) : isLoadingTopics ? (
                <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading topics...
                </div>
              ) : filteredTopics.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center border rounded-lg bg-muted/30">
                  No topics for selected subjects. Add topics in the Topics section.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-lg border bg-background">
                  {selectedSubjects.map(subj => {
                    const subjectTopics = filteredTopics.filter(
                      t => t.subject.toLowerCase() === subj.toLowerCase()
                    );
                    if (subjectTopics.length === 0) return null;
                    return (
                      <div key={subj}>
                        {selectedSubjects.length > 1 && (
                          <div className="px-3 py-1.5 bg-muted/50 border-b text-xs font-semibold text-muted-foreground flex items-center gap-1.5 sticky top-0">
                            <BookOpen className="h-3 w-3" />
                            {subj}
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 p-2">
                          {subjectTopics.map(topic => {
                            const isSelected = selectedTopics.includes(topic.name);
                            return (
                              <button
                                key={`${topic.subject}-${topic.name}`}
                                type="button"
                                onClick={() => toggleTopic(topic.name)}
                                className={cn(
                                  "flex items-center gap-2 px-2.5 py-2 rounded-md border text-sm text-left transition-all",
                                  isSelected
                                    ? "bg-purple-50 border-purple-300 text-purple-800 shadow-sm ring-1 ring-purple-200"
                                    : "bg-background border-transparent hover:bg-accent/50 hover:border-purple-200 text-foreground"
                                )}
                              >
                                <div className={cn(
                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                                  isSelected ? "bg-purple-500 border-purple-500 text-white" : "border-muted-foreground/30"
                                )}>
                                  {isSelected && <Check className="h-3 w-3" />}
                                </div>
                                <span className="truncate">{topic.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {(selectedSubjects.length > 0 || selectedTopics.length > 0) && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm font-medium mb-2">Selected Configuration:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedSubjects.map(s => (
                    <Badge key={s} variant="secondary" className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      {s}
                      <X
                        className="h-3 w-3 ml-0.5 cursor-pointer hover:text-destructive"
                        onClick={() => toggleSubject(s)}
                      />
                    </Badge>
                  ))}
                  {selectedTopics.map(t => (
                    <Badge key={t} variant="outline" className="flex items-center gap-1 border-purple-200 bg-purple-50 text-purple-700">
                      <Tag className="h-3 w-3" />
                      {t}
                      <X
                        className="h-3 w-3 ml-0.5 cursor-pointer hover:text-destructive"
                        onClick={() => toggleTopic(t)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Generate Viva Link Section */}
        <Card className="animate-fade-in-up border-green-200 bg-gradient-to-r from-green-50 to-transparent">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <Link className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle>Generate Student Viva Link</CardTitle>
                <CardDescription>
                  Create a shareable link for students to take their viva with the selected subject and topic
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={generateVivaLink}
                disabled={selectedSubjects.length === 0}
                className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
              >
                <Link className="h-4 w-4 mr-2" />
                Generate Viva Link
              </Button>
              {selectedSubjects.length === 0 && (
                <p className="text-sm text-muted-foreground flex items-center">
                  Select a subject above to generate a link
                </p>
              )}
            </div>
            
            {vivaLink && (
              <div className="p-4 rounded-lg bg-white border-2 border-green-200 space-y-3">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Viva Link Generated!</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input 
                    value={vivaLink} 
                    readOnly 
                    className="flex-1 bg-gray-50 text-xs sm:text-sm"
                  />
                  <Button 
                    variant="outline" 
                    onClick={copyVivaLink}
                    className={linkCopied ? "bg-green-100 text-green-700 border-green-300" : ""}
                  >
                    {linkCopied ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => window.open(vivaLink, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this link with students. They will enter their name and email, then start the viva for <strong>{subject}</strong>
                  {selectedTopics.length > 0 && <> - <strong>{selectedTopics.join(", ")}</strong></>}
                </p>
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
                    "flex-1 py-2 px-2 sm:px-3 rounded-md text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-1 sm:gap-1.5",
                    inputMode === "topic"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Lightbulb className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span className="hidden sm:inline">Topic Only</span>
                  <span className="sm:hidden">Topic</span>
                </button>
                <button
                  onClick={() => setInputMode("file")}
                  className={cn(
                    "flex-1 py-2 px-2 sm:px-3 rounded-md text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-1 sm:gap-1.5",
                    inputMode === "file"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span className="hidden sm:inline">Upload File</span>
                  <span className="sm:hidden">Upload</span>
                </button>
                <button
                  onClick={() => setInputMode("text")}
                  className={cn(
                    "flex-1 py-2 px-2 sm:px-3 rounded-md text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-1 sm:gap-1.5",
                    inputMode === "text"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span className="hidden sm:inline">Paste Text</span>
                  <span className="sm:hidden">Text</span>
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
                  value={customTopics}
                  onChange={(e) => setCustomTopics(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Add extra topics beyond the ones selected above
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
                    <span className="text-xs font-semibold">Questions</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={questionCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 1 && val <= 20) {
                          setQuestionCount(val);
                        }
                      }}
                      className="h-7 w-14 text-xs text-center px-1 bg-white border-purple-200 text-purple-700 font-semibold"
                    />
                    <span className="text-xs text-purple-600">
                      (1-20)
                    </span>
                  </div>
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
