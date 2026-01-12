import { NextResponse } from "next/server";
import { getVivaStats } from "@/lib/api/sheets";

export async function GET() {
  try {
    const response = await getVivaStats();

    if (!response.success) {
      return NextResponse.json(
        { error: response.error || "Failed to fetch stats" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("[API] Error fetching stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


