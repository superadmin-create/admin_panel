// Viva result types - matches Google Sheets data structure

export interface VivaResult {
  id: string;
  timestamp: string;
  studentName: string;
  studentEmail: string;
  subject: string;
  topics: string;
  questionsAnswered: number;
  score: number; // out of 100
  overallFeedback: string;
  transcript: string;
  recordingUrl?: string;
}

export interface EvaluationMarks {
  questionNumber: number;
  question: string;
  answer: string;
  marks: number;
  maxMarks: number;
}

export interface EvaluationFeedback {
  questionNumber: number;
  feedback: string;
  strengths?: string[];
  weaknesses?: string[];
}

export interface VivaEvaluation {
  marks: EvaluationMarks[];
  feedback: EvaluationFeedback[];
  totalMarks: number;
  maxTotalMarks: number;
  percentage: number;
  overallFeedback: string;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  phone?: string;
  batch: string;
  vivasCompleted: number;
  averageScore: number;
  lastVivaDate?: string;
  status: "active" | "at_risk" | "pending";
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  totalStudents: number;
  vivasCompleted: number;
  avgScore: number;
  passRate: number;
  status: "active" | "inactive";
}


