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
import {
  Search,
  Download,
  MoreHorizontal,
  Mail,
  Eye,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";

interface StudentSummary {
  id: string;
  name: string;
  email: string;
  vivasCompleted: number;
  averageScore: number;
  subjects: string[];
  lastVivaDate: string | null;
  status: "active" | "at_risk" | "pending";
}

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("All Subjects");
  const [selectedStatus, setSelectedStatus] = useState("All Status");

  // Fetch data from API
  const fetchStudents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/students");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch students");
      }

      setStudents(data.data || []);
    } catch (err) {
      console.error("Error fetching students:", err);
      setError(err instanceof Error ? err.message : "Failed to load students");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // Get unique subjects for filter
  const allSubjects = new Set<string>();
  students.forEach((s) => s.subjects.forEach((subj) => allSubjects.add(subj)));
  const subjects = ["All Subjects", ...Array.from(allSubjects)];

  const statuses = ["All Status", "active", "at_risk", "pending"];

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSubject =
      selectedSubject === "All Subjects" ||
      student.subjects.includes(selectedSubject);

    const matchesStatus =
      selectedStatus === "All Status" || student.status === selectedStatus;

    return matchesSearch && matchesSubject && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="success">Active</Badge>;
      case "at_risk":
        return <Badge variant="warning">At Risk</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score > 0) return "text-red-600";
    return "text-muted-foreground";
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <>
        <Header
          title="Students"
          description="Manage and view all registered students"
        />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">
              Loading students from Google Sheets...
            </p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header
          title="Students"
          description="Manage and view all registered students"
        />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4 text-center">
            <XCircle className="h-12 w-12 text-destructive" />
            <div>
              <p className="text-lg font-medium">Failed to load students</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <Button onClick={fetchStudents} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </>
    );
  }

  const activeCount = students.filter((s) => s.status === "active").length;
  const atRiskCount = students.filter((s) => s.status === "at_risk").length;
  const pendingCount = students.filter((s) => s.status === "pending").length;

  return (
    <>
      <Header
        title="Students"
        description="Manage and view all registered students"
      />

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="animate-fade-in-up">
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{students.length}</div>
              <p className="text-sm text-muted-foreground">Total Students</p>
            </CardContent>
          </Card>
          <Card className="animate-fade-in-up stagger-1">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">
                {activeCount}
              </div>
              <p className="text-sm text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card className="animate-fade-in-up stagger-2">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {atRiskCount}
              </div>
              <p className="text-sm text-muted-foreground">At Risk</p>
            </CardContent>
          </Card>
          <Card className="animate-fade-in-up stagger-3">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-muted-foreground">
                {pendingCount}
              </div>
              <p className="text-sm text-muted-foreground">Pending Viva</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="animate-fade-in-up stagger-4">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Student Directory
                  <Badge variant="outline" className="ml-2 font-normal">
                    Live from Google Sheets
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Students who have taken AI Viva exams (aggregated from results)
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchStudents}>
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
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or ID..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
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
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full md:w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status === "All Status"
                        ? status
                        : status.charAt(0).toUpperCase() +
                          status.slice(1).replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Subjects</TableHead>
                    <TableHead className="text-center">Vivas</TableHead>
                    <TableHead className="text-center">Avg. Score</TableHead>
                    <TableHead>Last Viva</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12">
                        <p className="text-muted-foreground">
                          {students.length === 0
                            ? "No students found in Google Sheets yet."
                            : "No students match your criteria."}
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStudents.map((student) => (
                      <TableRow key={student.id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                              {student.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">{student.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {student.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {student.subjects.slice(0, 2).map((subject) => (
                              <Badge
                                key={subject}
                                variant="outline"
                                className="text-xs"
                              >
                                {subject}
                              </Badge>
                            ))}
                            {student.subjects.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{student.subjects.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {student.vivasCompleted}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`font-semibold ${getScoreColor(
                              student.averageScore
                            )}`}
                          >
                            {student.averageScore > 0
                              ? `${student.averageScore}%`
                              : "-"}
                          </span>
                        </TableCell>
                        <TableCell>{formatDate(student.lastVivaDate)}</TableCell>
                        <TableCell>{getStatusBadge(student.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {filteredStudents.length} of {students.length} students
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

