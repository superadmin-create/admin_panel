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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Plus,
  Trash2,
  BookOpen,
  Users,
  TrendingUp,
  BarChart3,
  Loader2,
  X,
  Edit,
} from "lucide-react";

interface Subject {
  id: number;
  name: string;
  code: string;
  status: string;
}

export default function SubjectsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCode, setNewSubjectCode] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editSubjectName, setEditSubjectName] = useState("");
  const [editSubjectCode, setEditSubjectCode] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch subjects on mount
  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/subjects");
      const data = await response.json();
      if (data.success) {
        setSubjects(data.subjects || []);
      }
    } catch (error) {
      console.error("Failed to fetch subjects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSubject = async () => {
    if (!newSubjectName.trim()) return;

    setIsAdding(true);
    try {
      const response = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSubjectName.trim(),
          code: newSubjectCode.trim(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchSubjects();
        setShowAddDialog(false);
        setNewSubjectName("");
        setNewSubjectCode("");
      } else {
        alert(data.error || "Failed to add subject");
      }
    } catch (error) {
      console.error("Failed to add subject:", error);
      alert("Failed to add subject");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteSubject = async (subjectName: string) => {
    if (!confirm(`Are you sure you want to delete "${subjectName}"?`)) return;

    setIsDeleting(subjectName);
    try {
      const response = await fetch(
        `/api/subjects?name=${encodeURIComponent(subjectName)}`,
        { method: "DELETE" }
      );

      const data = await response.json();
      if (data.success) {
        await fetchSubjects();
      } else {
        alert(data.error || "Failed to delete subject");
      }
    } catch (error) {
      console.error("Failed to delete subject:", error);
      alert("Failed to delete subject");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleEditSubject = (subject: Subject) => {
    setEditingSubject(subject);
    setEditSubjectName(subject.name);
    setEditSubjectCode(subject.code || "");
  };

  const handleUpdateSubject = async () => {
    if (!editingSubject || !editSubjectName.trim()) return;

    setIsUpdating(true);
    try {
      const response = await fetch("/api/subjects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldName: editingSubject.name,
          newName: editSubjectName.trim(),
          code: editSubjectCode.trim(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchSubjects();
        setEditingSubject(null);
        setEditSubjectName("");
        setEditSubjectCode("");
      } else {
        alert(data.error || "Failed to update subject");
      }
    } catch (error) {
      console.error("Failed to update subject:", error);
      alert("Failed to update subject");
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredSubjects = subjects.filter(
    (subject) =>
      subject.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      subject.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalSubjects = subjects.length;

  return (
    <>
      <Header
        title="Subjects"
        description="Manage subjects for AI viva examinations"
      />

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="animate-fade-in-up">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-100">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalSubjects}</div>
                <p className="text-sm text-muted-foreground">Total Subjects</p>
              </div>
            </CardContent>
          </Card>
          <Card className="animate-fade-in-up stagger-1">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-100">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">-</div>
                <p className="text-sm text-muted-foreground">Total Enrolled</p>
              </div>
            </CardContent>
          </Card>
          <Card className="animate-fade-in-up stagger-2">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-100">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">-</div>
                <p className="text-sm text-muted-foreground">Vivas Completed</p>
              </div>
            </CardContent>
          </Card>
          <Card className="animate-fade-in-up stagger-3">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-orange-100">
                <TrendingUp className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">-</div>
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
                <CardTitle>Subject Management</CardTitle>
                <CardDescription>
                  Add subjects that will appear in the student registration form
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Subject
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Add Subject Dialog */}
            {showAddDialog && (
              <div className="mb-6 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Add New Subject</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowAddDialog(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Subject Name *
                    </label>
                    <Input
                      placeholder="e.g., Data Structures"
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Subject Code (Optional)
                    </label>
                    <Input
                      placeholder="e.g., CS301"
                      value={newSubjectCode}
                      onChange={(e) => setNewSubjectCode(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={handleAddSubject}
                    disabled={!newSubjectName.trim() || isAdding}
                  >
                    {isAdding ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Subject"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddDialog(false);
                      setNewSubjectName("");
                      setNewSubjectCode("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Edit Subject Dialog */}
            {editingSubject && (
              <div className="mb-6 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Edit Subject</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingSubject(null);
                      setEditSubjectName("");
                      setEditSubjectCode("");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Subject Name *
                    </label>
                    <Input
                      placeholder="e.g., Data Structures"
                      value={editSubjectName}
                      onChange={(e) => setEditSubjectName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Subject Code (Optional)
                    </label>
                    <Input
                      placeholder="e.g., CS301"
                      value={editSubjectCode}
                      onChange={(e) => setEditSubjectCode(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={handleUpdateSubject}
                    disabled={!editSubjectName.trim() || isUpdating}
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Update Subject"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingSubject(null);
                      setEditSubjectName("");
                      setEditSubjectCode("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="flex gap-4 mb-6">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search subjects..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Loading State */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Table */}
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSubjects.map((subject) => (
                        <TableRow key={subject.id} className="group">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                <BookOpen className="h-5 w-5 text-primary" />
                              </div>
                              <p className="font-medium">{subject.name}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-muted-foreground font-mono">
                              {subject.code || "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="success">Active</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary hover:text-primary"
                                onClick={() => handleEditSubject(subject)}
                                disabled={isDeleting === subject.name}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteSubject(subject.name)}
                                disabled={isDeleting === subject.name}
                              >
                                {isDeleting === subject.name ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {filteredSubjects.length === 0 && (
                  <div className="text-center py-12">
                    <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {searchQuery
                        ? "No subjects found matching your search."
                        : "No subjects added yet. Click 'Add Subject' to get started."}
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="animate-fade-in-up">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-blue-100">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">How it works</h3>
                <p className="text-sm text-muted-foreground">
                  Subjects you add here will automatically appear in the student
                  registration form. Students can select from these subjects when
                  registering for their AI viva examination.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
