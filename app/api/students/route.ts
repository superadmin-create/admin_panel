import { NextResponse } from "next/server";
import { getStudentsFromResults } from "@/lib/api/sheets";

export async function GET() {
  try {
    const response = await getStudentsFromResults();

    if (!response.success) {
      return NextResponse.json(
        { error: response.error || "Failed to fetch students" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: response.data,
      count: response.data?.length || 0,
    });
  } catch (error) {
    console.error("[API] Error fetching students:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
