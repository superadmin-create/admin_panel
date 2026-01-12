import { NextResponse } from "next/server";
import { fetchVivaResults } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await fetchVivaResults();

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to fetch results" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      count: result.data?.length || 0,
    });
  } catch (error) {
    console.error("[API] Error fetching viva results:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


