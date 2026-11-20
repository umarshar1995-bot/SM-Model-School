import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonOk, requireAdministrator } from "@/lib/api-helpers";
import { toBigIntId } from "@/lib/serialize";

function csvCell(value: unknown): string {
  const str =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const { error } = await requireAdministrator(request, "fee_audit_view");
  if (error) return error;

  const sp = request.nextUrl.searchParams;
  const action = (sp.get("action") ?? "").trim();
  const userId = (sp.get("userId") ?? "").trim();
  const from = (sp.get("from") ?? "").trim();
  const to = (sp.get("to") ?? "").trim();
  const q = (sp.get("q") ?? "").trim();
  const format = (sp.get("format") ?? "").trim().toLowerCase();
  const limitParam = Number(sp.get("limit") ?? 150);
  const take = Number.isFinite(limitParam)
    ? Math.min(Math.max(10, Math.round(limitParam)), 500)
    : 150;

  const createdAtFilter: { gte?: Date; lte?: Date } = {};
  if (from) {
    const dt = new Date(`${from}T00:00:00.000Z`);
    if (!Number.isNaN(dt.getTime())) createdAtFilter.gte = dt;
  }
  if (to) {
    const dt = new Date(`${to}T23:59:59.999Z`);
    if (!Number.isNaN(dt.getTime())) createdAtFilter.lte = dt;
  }

  const [logs, users] = await Promise.all([
    prisma.fee_audit_logs.findMany({
      where: {
        ...(action ? { action } : {}),
        ...(userId && /^\d+$/.test(userId) ? { user_id: toBigIntId(userId) } : {}),
        ...(createdAtFilter.gte || createdAtFilter.lte
          ? { created_at: createdAtFilter }
          : {}),
        ...(q
          ? {
              OR: [
                { user_name: { contains: q, mode: "insensitive" } },
                { action: { contains: q, mode: "insensitive" } },
                { entity_type: { contains: q, mode: "insensitive" } },
                { reason: { contains: q, mode: "insensitive" } },
                { ip_address: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: format === "csv" ? 1000 : take,
    }),
    prisma.users.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (format === "csv") {
    const header = [
      "ID",
      "Timestamp",
      "User",
      "Action",
      "Entity Type",
      "Entity ID",
      "Old Values",
      "New Values",
      "Reason",
      "IP Address",
    ].join(",");

    const rows = logs.map((row) =>
      [
        Number(row.id),
        row.created_at.toISOString(),
        row.user_name,
        row.action,
        row.entity_type,
        row.entity_id != null ? Number(row.entity_id) : "",
        row.old_values,
        row.new_values,
        row.reason ?? "",
        row.ip_address ?? "",
      ]
        .map(csvCell)
        .join(","),
    );

    const csv = [header, ...rows].join("\r\n");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="fee-audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return jsonOk({ logs, users });
}
