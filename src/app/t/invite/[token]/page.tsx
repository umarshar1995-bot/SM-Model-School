import React from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth";
import { InviteAcceptForm } from "@/components/teacher/InviteAcceptForm";

export const dynamic = "force-dynamic";

export default async function TeacherInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await prisma.teacher_invites.findFirst({
    where: {
      token_hash: hashToken(token),
      used_at: null,
      expires_at: { gt: new Date() },
    },
    include: { teachers: true },
  });

  if (!invite || !invite.teachers) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-blue-50 flex items-center justify-center px-5 py-10 text-slate-900">
      <InviteAcceptForm token={token} teacherName={invite.teachers.name} />
    </main>
  );
}
