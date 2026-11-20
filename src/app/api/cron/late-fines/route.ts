import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { applyOverdueLateFines } from "@/lib/fee-service";
import { getClientIp } from "@/lib/audit";

function verifyCronSecret(request: NextRequest): boolean {
  const expected =
    process.env.CRON_SECRET ||
    process.env.SESSION_SECRET ||
    "dev-only-sm-school-session-secret";
  const provided =
    request.headers.get("x-cron-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  return Boolean(expected) && provided === expected;
}

async function runLateFineJob(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return jsonError("Unauthorized cron invocation.", 401);
  }

  try {
    const appliedCount = await applyOverdueLateFines({
      id: null,
      name: "System Cron",
      ipAddress: getClientIp(request),
    });

    return jsonOk({
      ok: true,
      appliedCount,
      ranAt: new Date().toISOString(),
    });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Late fine cron failed.",
      500,
    );
  }
}

export async function GET(request: NextRequest) {
  return runLateFineJob(request);
}

export async function POST(request: NextRequest) {
  return runLateFineJob(request);
}
