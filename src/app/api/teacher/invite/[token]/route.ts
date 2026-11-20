import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  generateRandomToken,
  hashPassword,
  hashToken,
  setTeacherDeviceCookie,
} from "@/lib/auth";

const acceptSchema = z
  .object({
    email: z.string().email().max(255),
    password: z.string().min(8),
    password_confirmation: z.string().min(8),
    device_name: z.string().max(120).optional().nullable(),
  })
  .refine((d) => d.password === d.password_confirmation, {
    message: "Password confirmation does not match.",
    path: ["password_confirmation"],
  });

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const now = new Date();

    const invite = await prisma.teacher_invites.findFirst({
      where: {
        token_hash: hashToken(token),
        used_at: null,
        expires_at: { gt: now },
      },
      include: { teachers: true },
    });

    if (!invite || !invite.teachers) {
      return NextResponse.json(
        { error: "This invitation link is invalid or has expired." },
        { status: 404 },
      );
    }

    const body = await request.json();
    const parsed = acceptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid form input." },
        { status: 400 },
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const existingEmail = await prisma.users.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (existingEmail) {
      return NextResponse.json(
        { error: "That email address is already registered." },
        { status: 409 },
      );
    }

    const hashedPassword = await hashPassword(parsed.data.password);
    const deviceToken = generateRandomToken(64);

    const { device } = await prisma.$transaction(async (tx) => {
      const user = await tx.users.create({
        data: {
          name: invite.teachers.name,
          email,
          password: hashedPassword,
          created_at: now,
          updated_at: now,
        },
      });

      const teacherRole = await tx.roles.findFirst({
        where: { name: "Teacher", guard_name: "web" },
      });
      if (teacherRole) {
        await tx.model_has_roles.create({
          data: {
            role_id: teacherRole.id,
            model_type: "App\\Models\\User",
            model_id: user.id,
          },
        });
      }

      await tx.teachers.update({
        where: { id: invite.teacher_id },
        data: { user_id: user.id, updated_at: now },
      });

      await tx.teacher_invites.update({
        where: { id: invite.id },
        data: { used_at: now, updated_at: now },
      });

      const createdDevice = await tx.teacher_devices.create({
        data: {
          teacher_id: invite.teacher_id,
          token_hash: hashToken(deviceToken),
          name: parsed.data.device_name?.trim() || "Teacher Device",
          last_used_at: now,
          created_at: now,
          updated_at: now,
        },
      });

      return { device: createdDevice };
    });

    await setTeacherDeviceCookie(
      Number(invite.teacher_id),
      Number(device.id),
      deviceToken,
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Teacher invite accept error:", err);
    return NextResponse.json(
      { error: "Unable to complete teacher portal setup." },
      { status: 500 },
    );
  }
}
