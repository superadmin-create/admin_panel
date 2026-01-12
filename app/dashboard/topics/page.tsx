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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  Trash2,
  Tag,
  BookOpen,
  Loader2,
  X,
  Filter,
  Edit,
} from "lucide-react";

interface Topic {
  id: number;
  subject: string;
  name: string;
  status: string;
}

interface Subject {
  id: number;
  name: string;
  code: string;
  status: string;
}

export default function TopicsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicSubject, setNewTopicSubject] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [editTopicName, setEditTopicName] = useState("");
  const [editTopicSubject, setEditTopicSubject] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch subjects on mount
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await fetch("/api/subjects");
        const data = await response.json();
        if (data.success) {
          setSubjects(data.subjects || []);
        }
      } catch (error) {
        console.error("Failed to fetch subjects:", error);
      } finally {
        setIsLoadingSubjects(false);
      }
    };

    fetchSubjects();
  }, []);

  // Fetch topics on mount
  useEffect(() => {
    fetchTopics();
  }, []);

  const fetchTopics = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/topics");
      const data = await response.json();
      if (data.success) {
        setTopics(data.topics || []);
      }
    } catch (error) {
      console.error("Failed to fetch topics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTopic = async () => {
    if (!newTopicName.trim() || !newTopicSubject) return;

    setIsAdding(true);
    try {
      const response = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: newTopicSubject,
          name: newTopicName.trim(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchTopics();
        setShowAddDialog(false);
        setNewTopicName("");
        setNewTopicSubject("");
      } else {
        alert(data.error || "Failed to add topic");
      }
    } catch (error) {
      console.error("Failed to add topic:", error);
      alert("Failed to add topic");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteTopic = async (subject: string, name: string) => {
    if (!confirm(`Are you sure you want to delete topic "${name}"?`)) return;

    setIsDeleting(`${subject}-${name}`);
    try {
      const response = await fetch(
        `/api/topics?subject=${encodeURIComponent(subject)}&name=${encodeURIComponent(name)}`,
        { method: "DELETE" }
      );

      const data = await response.json();
      if (data.success) {
        await fetchTopics();
      } else {
        alert(data.error || "Failed to delete topic");
      }
    } catch (error) {
      console.error("Failed to delete topic:", error);
      alert("Failed to delete topic");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleEditTopic = (topic: Topic) => {
    setEditingTopic(topic);
    setEditTopicName(topic.name);
    setEditTopicSubject(topic.subject);
  };

  const handleUpdateTopic = async () => {
    if (!editingTopic || !editTopicName.trim() || !editTopicSubject) return;

    setIsUpdating(true);
    try {
      const response = await fetch("/api/topics", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldSubject: editingTopic.subject,
          oldName: editingTopic.name,
          newSubject: editTopicSubject,
          newName: editTopicName.trim(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchTopics();
        setEditingTopic(null);
        setEditTopicName("");
        setEditTopicSubject("");
      } else {
        alert(data.error || "Failed to update topic");
      }
    } catch (error) {
      console.error("Failed to update topic:", error);
      alert("Failed to update topic");
    } finally {
      setIsUpdating(false);
    }
  };

  // Filter topics
  const filteredTopics = topics.filter((topic) => {
    const matchesSearch =
      topic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      topic.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject =
      filterSubject === "all" ||
      topic.subject.toLowerCase() === filterSubject.toLowerCase();
    return matchesSearch && matchesSubject;
  });

  // Group topics by subject for display
  const topicsBySubject = filteredTopics.reduce((acc, topic) => {
    if (!acc[topic.subject]) {
      acc[topic.subject] = [];
    }
    acc[topic.subject].push(topic);
    return acc;
  }, {} as Record<string, Topic[]>);

  const totalTopics = topics.length;
  const uniqueSubjects = [...new Set(topics.map((t) => t.subject))].length;

  return (
    <>
      <Header
        title="Topics"
        description="Manage topics for each subject - these will appear in student registration"
      />

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="animate-fade-in-up">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-100">
                <Tag className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalTopics}</div>
                <p className="text-sm text-muted-foreground">Total Topics</p>
              </div>
            </CardContent>
          </Card>
          <Card className="animate-fade-in-up stagger-1">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-100">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{uniqueSubjects}</div>
                <p className="text-sm text-muted-foreground">Subjects with Topics</p>
              </div>
            </CardContent>
          </Card>
          <Card className="animate-fade-in-up stagger-2">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-100">
                <Filter className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{filteredTopics.length}</div>
                <p className="text-sm text-muted-foreground">Filtered Topics</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="animate-fade-in-up stagger-3">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Topic Management</CardTitle>
                <CardDescription>
                  Add topics for subjects - students can select these during registration
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Topic
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Add Topic Dialog */}
            {showAddDialog && (
              <div className="mb-6 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Add New Topic</h3>
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
                      Subject *
                    </label>
                    <Select
                      value={newTopicSubject}
                      onValueChange={setNewTopicSubject}
                      disabled={isLoadingSubjects}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            isLoadingSubjects
                              ? "Loading subjects..."
                              : "Select a subject"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.name}>
                            {subject.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Topic Name *
                    </label>
                    <Input
                      placeholder="e.g., Binary Trees, Sorting Algorithms"
                      value={newTopicName}
                      onChange={(e) => setNewTopicName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={handleAddTopic}
                    disabled={!newTopicName.trim() || !newTopicSubject || isAdding}
                  >
                    {isAdding ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Topic"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddDialog(false);
                      setNewTopicName("");
                      setNewTopicSubject("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Edit Topic Dialog */}
            {editingTopic && (
              <div className="mb-6 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Edit Topic</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingTopic(null);
                      setEditTopicName("");
                      setEditTopicSubject("");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Subject *
                    </label>
                    <Select
                      value={editTopicSubject}
                      onValueChange={setEditTopicSubject}
                      disabled={isLoadingSubjects}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            isLoadingSubjects
                              ? "Loading subjects..."
                              : "Select a subject"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.name}>
                            {subject.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Topic Name *
                    </label>
                    <Input
                      placeholder="e.g., Binary Trees, Sorting Algorithms"
                      value={editTopicName}
                      onChange={(e) => setEditTopicName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={handleUpdateTopic}
                    disabled={!editTopicName.trim() || !editTopicSubject || isUpdating}
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Update Topic"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingTopic(null);
                      setEditTopicName("");
                      setEditTopicSubject("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Search and Filter */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search topics..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={filterSubject} onValueChange={setFilterSubject}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.name}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                        <TableHead>Topic</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTopics.map((topic) => (
                        <TableRow key={`${topic.subject}-${topic.name}`} className="group">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                                <BookOpen className="h-4 w-4 text-blue-600" />
                              </div>
                              <span className="font-medium">{topic.subject}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Tag className="h-4 w-4 text-purple-500" />
                              <span>{topic.name}</span>
                            </div>
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
                                onClick={() => handleEditTopic(topic)}
                                disabled={isDeleting === `${topic.subject}-${topic.name}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteTopic(topic.subject, topic.name)}
                                disabled={isDeleting === `${topic.subject}-${topic.name}`}
                              >
                                {isDeleting === `${topic.subject}-${topic.name}` ? (
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

                {filteredTopics.length === 0 && (
                  <div className="text-center py-12">
                    <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {searchQuery || filterSubject !== "all"
                        ? "No topics found matching your filters."
                        : "No topics added yet. Click 'Add Topic' to get started."}
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
              <div className="p-3 rounded-xl bg-purple-100">
                <Tag className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">How it works</h3>
                <p className="text-sm text-muted-foreground">
                  Topics you add here will appear in the student registration form as a
                  dropdown after they select a subject. Students can choose a specific
                  topic to focus their viva questions on that topic area only.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}


