import { NextResponse } from "next/server";
import { clearTeacherDeviceCookie } from "@/lib/auth";

export async function POST() {
  await clearTeacherDeviceCookie();
  return NextResponse.json({ ok: true });
}
