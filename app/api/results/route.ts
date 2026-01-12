import { NextResponse } from "next/server";
import { getVivaResults } from "@/lib/api/sheets";

export async function GET() {
  try {
    const response = await getVivaResults();

    if (!response.success) {
      return NextResponse.json(
        { error: response.error || "Failed to fetch results" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: response.data,
      count: response.data?.length || 0,
    });
  } catch (error) {
    console.error("[API] Error fetching results:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


