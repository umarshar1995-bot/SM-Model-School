import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { getClientIp } from "@/lib/audit";

const loginSchema = z.object({
  username: z.string().min(1).optional(),
  email: z.string().min(1).optional(),
  password: z.string().min(1),
});

// Sliding-window rate limit: max 5 failed login attempts per minute per IP
const RATE_WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;
const failedAttempts = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (failedAttempts.get(ip) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  failedAttempts.set(ip, timestamps);
  return timestamps.length >= MAX_ATTEMPTS;
}

function recordFailure(ip: string) {
  const now = Date.now();
  const timestamps = (failedAttempts.get(ip) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  timestamps.push(now);
  failedAttempts.set(ip, timestamps);
}

function clearFailures(ip: string) {
  failedAttempts.delete(ip);
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request) ?? "local";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many failed login attempts. Please wait 1 minute and try again." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    const identifier = (parsed.data?.username ?? parsed.data?.email ?? "").trim();

    if (!parsed.success || !identifier) {
      return NextResponse.json(
        { error: "Please enter a valid username and password." },
        { status: 400 },
      );
    }

    const user = await prisma.users.findFirst({
      where: {
        OR: [
          { email: { equals: identifier, mode: "insensitive" } },
          { name: { equals: identifier, mode: "insensitive" } },
        ],
      },
    });

    if (!user) {
      recordFailure(ip);
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 },
      );
    }

    const valid = await verifyPassword(parsed.data.password, user.password);
    if (!valid) {
      recordFailure(ip);
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 },
      );
    }

    clearFailures(ip);

    const token = await createSessionToken({
      userId: Number(user.id),
      email: user.email,
      name: user.name,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: Number(user.id),
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Unable to sign in right now." },
      { status: 500 },
    );
  }
}
