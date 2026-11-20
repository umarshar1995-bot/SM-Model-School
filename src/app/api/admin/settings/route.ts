import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api-helpers";
import { hashPassword } from "@/lib/auth";
import { toBigIntId } from "@/lib/serialize";

export async function GET() {
  const { error } = await requireApiUser();
  if (error) return error;

  const [settings, roles, users, userRoles] = await Promise.all([
    prisma.settings.findMany({ orderBy: { key: "asc" } }),
    prisma.roles.findMany({
      include: {
        _count: {
          select: { role_has_permissions: true, model_has_roles: true },
        },
      },
      orderBy: { id: "asc" },
    }),
    prisma.users.findMany({
      select: { id: true, name: true, email: true, created_at: true },
      orderBy: { id: "asc" },
    }),
    prisma.model_has_roles.findMany({
      where: { model_type: { in: ["App\\Models\\User", "User"] } },
      include: { roles: true },
    }),
  ]);

  const roleMap = new Map<string, string[]>();
  for (const ur of userRoles) {
    const key = String(ur.model_id);
    const list = roleMap.get(key) ?? [];
    list.push(ur.roles.name);
    roleMap.set(key, list);
  }

  return jsonOk({
    settings,
    roles,
    users: users.map((u) => ({
      ...u,
      roles: roleMap.get(String(u.id)) ?? [],
    })),
  });
}

const updateSettingSchema = z.object({
  key: z.string().min(1).max(255),
  value: z.unknown(),
  group_name: z.string().max(50).optional().nullable(),
});

export async function PUT(request: NextRequest) {
  const { error } = await requireApiUser();
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = updateSettingSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid setting payload.", 400);

    const now = new Date();
    const setting = await prisma.settings.upsert({
      where: { key: parsed.data.key },
      update: {
        value: parsed.data.value as Prisma.InputJsonValue,
        updated_at: now,
      },
      create: {
        key: parsed.data.key,
        value: parsed.data.value as Prisma.InputJsonValue,
        group_name: parsed.data.group_name ?? "general",
        is_system: false,
        created_at: now,
        updated_at: now,
      },
    });
    return jsonOk({ setting });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to save setting.", 400);
  }
}

const createUserSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  password: z.string().min(8),
  role_id: z.union([z.number(), z.string()]),
});

export async function POST(request: NextRequest) {
  const { user: currentUser, error } = await requireApiUser();
  if (error) return error;
  if (!currentUser.isSuperAdmin) {
    return jsonError("Only Super Admins can create staff accounts.", 403);
  }

  try {
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Provide valid name, email, password (8+ chars), and role.", 400);
    }

    const email = parsed.data.email.trim().toLowerCase();
    const exists = await prisma.users.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (exists) {
      return jsonError("A user with this email already exists.", 409);
    }

    const now = new Date();
    const hashedPassword = await hashPassword(parsed.data.password);

    const created = await prisma.$transaction(async (tx) => {
      const u = await tx.users.create({
        data: {
          name: parsed.data.name.trim(),
          email,
          password: hashedPassword,
          created_at: now,
          updated_at: now,
        },
        select: { id: true, name: true, email: true, created_at: true },
      });
      await tx.model_has_roles.create({
        data: {
          role_id: toBigIntId(parsed.data.role_id),
          model_type: "App\\Models\\User",
          model_id: u.id,
        },
      });
      return u;
    });

    return jsonOk({ user: created }, 201);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to create user.", 400);
  }
}
