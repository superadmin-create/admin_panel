import { NextRequest, NextResponse } from "next/server";
import { getTeacherDocuments, deleteTeacherDocument } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherEmail = searchParams.get("teacherEmail");

    if (!teacherEmail) {
      return NextResponse.json(
        { error: "teacherEmail is required" },
        { status: 400 }
      );
    }

    const documents = await getTeacherDocuments(teacherEmail);
    return NextResponse.json({ success: true, documents });
  } catch (error) {
    console.error("Error fetching teacher documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const teacherEmail = searchParams.get("teacherEmail");

    if (!id || !teacherEmail) {
      return NextResponse.json(
        { error: "id and teacherEmail are required" },
        { status: 400 }
      );
    }

    const deleted = await deleteTeacherDocument(parseInt(id), teacherEmail);
    if (!deleted) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
