"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  BookOpen,
  Settings,
  LogOut,
  GraduationCap,
  Sparkles,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Viva Generator",
    href: "/dashboard/viva-generator",
    icon: Sparkles,
  },
  {
    title: "Students",
    href: "/dashboard/students",
    icon: Users,
  },
  {
    title: "Viva Results",
    href: "/dashboard/results",
    icon: ClipboardList,
  },
  {
    title: "Subjects",
    href: "/dashboard/subjects",
    icon: BookOpen,
  },
  {
    title: "Topics",
    href: "/dashboard/topics",
    icon: Tag,
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [teacherInfo, setTeacherInfo] = useState<{
    firstName: string;
    lastName: string;
    username: string;
  } | null>(null);

  useEffect(() => {
    // Get teacher info from localStorage
    const stored = localStorage.getItem("teacherInfo");
    if (stored) {
      try {
        setTeacherInfo(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse teacher info:", e);
      }
    }
  }, []);

  // Get initials from name
  const getInitials = () => {
    if (teacherInfo) {
      const first = teacherInfo.firstName?.[0] || "";
      const last = teacherInfo.lastName?.[0] || "";
      return (first + last).toUpperCase() || "JD";
    }
    return "JD";
  };

  const getFullName = () => {
    if (teacherInfo) {
      return `${teacherInfo.firstName} ${teacherInfo.lastName}`.trim() || "John Doe";
    }
    return "John Doe";
  };

  const getEmail = () => {
    return teacherInfo?.username || "john@example.com";
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar text-sidebar-foreground">
      {/* Logo Section */}
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-accent">
          <GraduationCap className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">AI Viva</h1>
          <p className="text-xs text-white/60">Teacher Portal</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-white shadow-lg shadow-sidebar-accent/25"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent/20 text-sm font-semibold text-sidebar-accent">
            {getInitials()}
          </div>
          <div className="flex-1 truncate">
            <p className="truncate text-sm font-medium text-white">{getFullName()}</p>
            <p className="truncate text-xs text-white/60">{getEmail()}</p>
          </div>
        </div>
        <Link
          href="/"
          onClick={() => {
            localStorage.removeItem("teacherInfo");
          }}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Link>
      </div>
    </aside>
  );
}

