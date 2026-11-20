import { NextResponse } from "next/server";
import { canUser, getSessionUser, type SessionUser } from "@/lib/auth";
import { serialize } from "@/lib/serialize";
import { getClientIp, logFeeAudit } from "@/lib/audit";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(serialize(data), { status });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireApiUser(
  permission?: string,
  request?: Request,
): Promise<{ user: SessionUser; error: null } | { user: null; error: NextResponse }> {
  const user = await getSessionUser();
  if (!user) {
    return { user: null, error: jsonError("Unauthorized", 401) };
  }
  if (permission && !canUser(user, permission)) {
    if (permission.includes("Fee")) {
      try {
        await logFeeAudit({
          userId: user.id,
          userName: user.name,
          action: "LOGIN_DENIED_FEE_EDIT",
          entityType: "permission_guard",
          newValues: { requiredPermission: permission, roles: user.roles },
          reason: `Denied access to ${permission}`,
          ipAddress: getClientIp(request),
        });
      } catch {
        // never swallow 403 due to audit error
      }
    }
    return {
      user: null,
      error: jsonError("Forbidden: insufficient permissions", 403),
    };
  }
  return { user, error: null };
}

/**
 * Strictly requires Administrator (Super Admin / super_admin).
 * Logs every denied attempt to the immutable fee_audit_logs table.
 */
export async function requireAdministrator(
  request?: Request,
  context = "administrator_fee_action",
): Promise<{ user: SessionUser; error: null } | { user: null; error: NextResponse }> {
  const user = await getSessionUser();
  if (!user) {
    return { user: null, error: jsonError("Unauthorized", 401) };
  }
  if (!user.isSuperAdmin) {
    try {
      await logFeeAudit({
        userId: user.id,
        userName: user.name,
        action: "LOGIN_DENIED_FEE_EDIT",
        entityType: context,
        newValues: { roles: user.roles, url: request?.url ?? null },
        reason: "Non-administrator attempted an Administrator-only fee operation",
        ipAddress: getClientIp(request),
      });
    } catch {
      // ignore audit failure on denied path
    }
    return {
      user: null,
      error: jsonError(
        "Forbidden: only the Administrator can edit fee amounts, reverse payments, or view fee audit logs.",
        403,
      ),
    };
  }
  return { user, error: null };
}
