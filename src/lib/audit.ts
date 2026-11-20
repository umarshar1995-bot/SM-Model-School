import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type FeeAuditAction =
  | "FEE_AMOUNT_CHANGED"
  | "CHALLAN_GENERATED"
  | "PAYMENT_RECORDED"
  | "PAYMENT_REVERSED"
  | "LATE_FINE_APPLIED"
  | "PROMOTION_FEE_CHARGED"
  | "LOGIN_DENIED_FEE_EDIT";

export interface AuditEntryInput {
  userId?: number | bigint | null;
  userName: string;
  action: FeeAuditAction;
  entityType: string;
  entityId?: number | bigint | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  reason?: string | null;
  ipAddress?: string | null;
}

type DbClient = PrismaClient | Prisma.TransactionClient;

export function getClientIp(request?: Request | null): string | null {
  if (!request) return null;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim().slice(0, 45);
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim().slice(0, 45);
  return null;
}

/**
 * Append an immutable entry into fee_audit_logs.
 * Supports passing a Prisma transaction client so audit records commit atomically.
 */
export async function logFeeAudit(
  entry: AuditEntryInput,
  db: DbClient = prisma,
) {
  await db.fee_audit_logs.create({
    data: {
      user_id:
        entry.userId !== undefined && entry.userId !== null
          ? BigInt(entry.userId)
          : null,
      user_name: entry.userName,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id:
        entry.entityId !== undefined && entry.entityId !== null
          ? BigInt(entry.entityId)
          : null,
      old_values: entry.oldValues
        ? (entry.oldValues as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      new_values: entry.newValues
        ? (entry.newValues as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      reason: entry.reason ?? null,
      ip_address: entry.ipAddress ?? null,
      created_at: new Date(),
    },
  });
}
