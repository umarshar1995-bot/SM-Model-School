import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "sm_school_session";
export const TEACHER_DEVICE_COOKIE = "sm_teacher_device";

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
  isSuperAdmin: boolean;
}

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET environment variable must be set in production.",
      );
    }
    return new TextEncoder().encode("dev-only-sm-school-session-secret");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Verifies a password against bcrypt hashes, including PHP/Laravel $2y$ hashes.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  const normalized = hash.startsWith("$2y$") ? `$2b$${hash.slice(4)}` : hash;
  return bcrypt.compare(plain, normalized);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateRandomToken(length = 64): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

export async function createSessionToken(payload: {
  userId: number;
  email: string;
  name: string;
}): Promise<string> {
  return new SignJWT({
    sub: String(payload.userId),
    email: payload.email,
    name: payload.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<{ userId: number; email: string; name: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const userId = Number(payload.sub);
    if (!Number.isFinite(userId)) return null;
    return {
      userId,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifySessionToken(token);
  if (!claims) return null;

  const user = await prisma.users.findUnique({
    where: { id: BigInt(claims.userId) },
    select: { id: true, name: true, email: true },
  });
  if (!user) return null;

  const userRoles = await prisma.model_has_roles.findMany({
    where: {
      model_id: user.id,
      model_type: { in: ["App\\Models\\User", "User"] },
    },
    include: {
      roles: {
        include: {
          role_has_permissions: {
            include: { permissions: true },
          },
        },
      },
    },
  });

  const directPerms = await prisma.model_has_permissions.findMany({
    where: {
      model_id: user.id,
      model_type: { in: ["App\\Models\\User", "User"] },
    },
    include: { permissions: true },
  });

  const roleNames = userRoles.map((r) => r.roles.name);
  const permSet = new Set<string>();
  for (const r of userRoles) {
    for (const rp of r.roles.role_has_permissions) {
      permSet.add(rp.permissions.name);
    }
  }
  for (const dp of directPerms) {
    permSet.add(dp.permissions.name);
  }

  const isSuperAdmin = roleNames.some(
    (name) => name === "Super Admin" || name === "super_admin",
  );

  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    roles: roleNames,
    permissions: Array.from(permSet),
    isSuperAdmin,
  };
}

export function canUser(user: SessionUser | null, permission: string): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return user.permissions.includes(permission);
}

export async function setTeacherDeviceCookie(
  teacherId: number,
  deviceId: number,
  deviceToken: string,
) {
  const jar = await cookies();
  const value = JSON.stringify({ teacherId, deviceId, deviceToken });
  jar.set(TEACHER_DEVICE_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

export async function clearTeacherDeviceCookie() {
  const jar = await cookies();
  jar.delete(TEACHER_DEVICE_COOKIE);
}

export async function getAuthenticatedTeacher() {
  const jar = await cookies();
  const raw = jar.get(TEACHER_DEVICE_COOKIE)?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      teacherId?: number;
      deviceId?: number;
      deviceToken?: string;
    };
    if (!parsed.teacherId || !parsed.deviceId || !parsed.deviceToken) {
      return null;
    }

    const device = await prisma.teacher_devices.findFirst({
      where: {
        token_hash: hashToken(parsed.deviceToken),
        revoked_at: null,
      },
    });

    if (!device || Number(device.id) !== parsed.deviceId) {
      return null;
    }

    await prisma.teacher_devices.update({
      where: { id: device.id },
      data: { last_used_at: new Date(), updated_at: new Date() },
    });

    return prisma.teachers.findFirst({
      where: { id: BigInt(parsed.teacherId), deleted_at: null },
      include: {
        teacher_sections: {
          include: {
            class_sections: { include: { school_classes: true } },
            academic_sessions: true,
          },
        },
        teacher_subject_assignments: {
          include: {
            subjects: true,
            class_sections: { include: { school_classes: true } },
            academic_sessions: true,
          },
        },
      },
    });
  } catch {
    return null;
  }
}
