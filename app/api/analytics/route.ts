import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "instrumentation_needed",
    message: "Token and cost analytics require instrumentation. Once agents report token usage, data will appear here.",
    placeholders: {
      totalTokensToday: null,
      totalCostToday: null,
      tokensByAgent: [],
      tokensByModel: [],
      dailyTrend: [],
      costBreakdown: {
        input: null,
        output: null,
        total: null,
      },
    },
  });
}
