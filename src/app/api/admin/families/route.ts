import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api-helpers";
import { toBigIntId } from "@/lib/serialize";
import { normalizeMobile } from "@/lib/format";

const familySchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  guardian_name: z.string().min(1).max(150),
  guardian_mobile: z.string().max(25).optional().nullable(),
  guardian_cnic: z.string().max(20).optional().nullable(),
  address: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  const { error } = await requireApiUser("ViewAny:Family");
  if (error) return error;

  const sp = request.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const trashed = sp.get("trashed") === "1";
  const numericQ = /^\d+$/.test(q) ? BigInt(q) : null;

  const families = await prisma.families.findMany({
    where: {
      deleted_at: trashed ? { not: null } : null,
      ...(q
        ? {
            OR: [
              { guardian_name: { contains: q, mode: "insensitive" } },
              { guardian_mobile: { contains: q, mode: "insensitive" } },
              { guardian_cnic: { contains: q, mode: "insensitive" } },
              ...(numericQ ? [{ family_number: numericQ }] : []),
            ],
          }
        : {}),
    },
    include: {
      students: {
        where: { deleted_at: null },
        select: { id: true, full_name: true, status: true },
      },
      family_fee_challans: {
        where: {
          deleted_at: null,
          status: { in: ["unpaid", "partial", "overdue"] },
        },
        select: { payable_before_due: true, paid_amount: true },
      },
    },
    orderBy: { family_number: "desc" },
  });

  const enriched = families.map((f) => ({
    ...f,
    students_count: f.students.length,
    outstanding_dues: f.family_fee_challans.reduce(
      (sum, c) => sum + Math.max(0, Number(c.payable_before_due) - Number(c.paid_amount)),
      0,
    ),
  }));

  return jsonOk({ families: enriched });
}

export async function POST(request: NextRequest) {
  const { error } = await requireApiUser("Create:Family");
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = familySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Guardian name is required.", 400);
    }

    const maxRes = await prisma.families.aggregate({
      _max: { family_number: true },
    });
    const nextFamilyNumber = (maxRes._max.family_number ?? BigInt(1000)) + BigInt(1);
    const now = new Date();

    const family = await prisma.families.create({
      data: {
        family_number: nextFamilyNumber,
        guardian_name: parsed.data.guardian_name.trim(),
        guardian_mobile: normalizeMobile(parsed.data.guardian_mobile),
        guardian_cnic: parsed.data.guardian_cnic?.trim() || null,
        address: parsed.data.address?.trim() || null,
        is_active: parsed.data.is_active,
        created_at: now,
        updated_at: now,
      },
    });

    return jsonOk({ family }, 201);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to create family.", 400);
  }
}

export async function PUT(request: NextRequest) {
  const { error } = await requireApiUser("Update:Family");
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = familySchema.safeParse(body);
    if (!parsed.success || !parsed.data.id) {
      return jsonError("Invalid family update payload.", 400);
    }

    const family = await prisma.families.update({
      where: { id: toBigIntId(parsed.data.id) },
      data: {
        guardian_name: parsed.data.guardian_name.trim(),
        guardian_mobile: normalizeMobile(parsed.data.guardian_mobile),
        guardian_cnic: parsed.data.guardian_cnic?.trim() || null,
        address: parsed.data.address?.trim() || null,
        is_active: parsed.data.is_active,
        updated_at: new Date(),
      },
    });

    return jsonOk({ family });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to update family.", 400);
  }
}

export async function DELETE(request: NextRequest) {
  const { error } = await requireApiUser("Delete:Family");
  if (error) return error;

  const id = request.nextUrl.searchParams.get("id");
  const mode = request.nextUrl.searchParams.get("mode") ?? "soft";
  if (!id) return jsonError("Missing family id.", 400);

  const familyId = toBigIntId(id);
  if (mode === "restore") {
    await prisma.families.update({
      where: { id: familyId },
      data: { deleted_at: null, updated_at: new Date() },
    });
  } else if (mode === "force") {
    await prisma.families.delete({ where: { id: familyId } });
  } else {
    await prisma.families.update({
      where: { id: familyId },
      data: { deleted_at: new Date(), updated_at: new Date() },
    });
  }
  return jsonOk({ ok: true });
}
