import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface CheckConfig {
  name: string;
  url: string;
  expect: string;
}

interface CheckResult {
  name: string;
  status: "pass" | "fail";
  statusCode?: number;
  error?: string;
}

const CHECKS: CheckConfig[] = [
  { name: "Tasks API", url: "/api/tasks", expect: "array" },
  { name: "Factory API", url: "/api/factory", expect: "object" },
  { name: "Factory Agents API", url: "/api/factory/agents", expect: "object_with_agents" },
  { name: "Inbox API", url: "/api/inbox", expect: "array_or_object" },
  { name: "Heartbeat API", url: "/api/heartbeat", expect: "any_200" },
  { name: "Notes API", url: "/api/notes", expect: "any_200" },
  { name: "Memory API", url: "/api/memory", expect: "any_200" },
  { name: "Projects API", url: "/api/projects", expect: "any_200" },
  { name: "Docs API", url: "/api/docs", expect: "any_200" },
  { name: "Cron API", url: "/api/cron", expect: "any_200" },
  { name: "Activity API", url: "/api/activity", expect: "any_200" },
  { name: "Setup Status API", url: "/api/setup/status", expect: "object_with_connected" },
];

async function runCheck(base: string, check: CheckConfig): Promise<CheckResult> {
  const url = `${base}${check.url}`;
  try {
    const res = await fetch(url, {
      headers: { "x-health-check": "1" },
      signal: AbortSignal.timeout(8000),
    });

    const statusCode = res.status;

    if (!res.ok) {
      return {
        name: check.name,
        status: "fail",
        statusCode,
        error: `HTTP ${statusCode}`,
      };
    }

    // For any_200 checks — just 200 is enough
    if (check.expect === "any_200") {
      return { name: check.name, status: "pass", statusCode };
    }

    // Parse body for shape checks
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { name: check.name, status: "fail", statusCode, error: "Invalid JSON response" };
    }

    // Validate shape
    switch (check.expect) {
      case "array":
        if (!Array.isArray(body)) {
          return { name: check.name, status: "fail", statusCode, error: "Expected array response" };
        }
        break;

      case "object":
        if (typeof body !== "object" || Array.isArray(body) || body === null) {
          return { name: check.name, status: "fail", statusCode, error: "Expected object response" };
        }
        break;

      case "object_with_agents": {
        const b = body as Record<string, unknown>;
        if (typeof b !== "object" || b === null || !("agents" in b)) {
          return { name: check.name, status: "fail", statusCode, error: "Expected object with 'agents' key" };
        }
        break;
      }

      case "array_or_object":
        if (body === null || (typeof body !== "object" && !Array.isArray(body))) {
          return { name: check.name, status: "fail", statusCode, error: "Expected array or object response" };
        }
        break;

      case "object_with_team": {
        const b = body as Record<string, unknown>;
        if (typeof b !== "object" || b === null || !("team" in b)) {
          return { name: check.name, status: "fail", statusCode, error: "Expected object with 'team' key" };
        }
        break;
      }

      case "object_with_connected": {
        const b = body as Record<string, unknown>;
        if (typeof b !== "object" || b === null || !("connected" in b)) {
          return { name: check.name, status: "fail", statusCode, error: "Expected object with 'connected' key" };
        }
        break;
      }
    }

    return { name: check.name, status: "pass", statusCode };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      name: check.name,
      status: "fail",
      error: msg.includes("timed out") || msg.includes("Timeout") ? "Request timed out" : msg,
    };
  }
}

export async function GET(req: NextRequest) {
  // Derive base URL from the incoming request
  const { origin } = new URL(req.url);

  // Run all checks in parallel
  const results: CheckResult[] = await Promise.all(
    CHECKS.map((check) => runCheck(origin, check))
  );

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;

  return NextResponse.json({
    ok: failed === 0,
    passed,
    failed,
    total: results.length,
    checks: results,
  });
}
