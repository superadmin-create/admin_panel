import { NextResponse } from "next/server";
import { deleteInvalidRowsFromSheet } from "@/lib/api/sheets-service-account";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    console.log("[Cleanup] Starting Google Sheets cleanup...");
    
    const result = await deleteInvalidRowsFromSheet();
    
    console.log(`[Cleanup] Completed: deleted ${result.deleted} rows`);
    
    return NextResponse.json({
      success: true,
      deleted: result.deleted,
      errors: result.errors,
      message: `Deleted ${result.deleted} invalid rows from Google Sheets`,
    });
  } catch (error) {
    console.error("[Cleanup] Error:", error);
    return NextResponse.json(
      { error: "Failed to cleanup sheets", details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST to trigger cleanup of invalid rows from Google Sheets",
  });
}
