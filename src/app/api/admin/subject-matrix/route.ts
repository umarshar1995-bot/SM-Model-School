import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api-helpers";
import { toBigIntId } from "@/lib/serialize";

export async function GET(request: NextRequest) {
  const { error } = await requireApiUser("ViewAny:Subject");
  if (error) return error;

  const sessionParam = request.nextUrl.searchParams.get("sessionId");

  const [sessions, classes, subjects] = await Promise.all([
    prisma.academic_sessions.findMany({
      where: { is_active: true, deleted_at: null },
      orderBy: [{ is_current: "desc" }, { start_date: "desc" }],
    }),
    prisma.school_classes.findMany({
      where: { is_active: true, deleted_at: null },
      orderBy: { sort_order: "asc" },
    }),
    prisma.subjects.findMany({
      where: { is_active: true, deleted_at: null },
      orderBy: { sort_order: "asc" },
    }),
  ]);

  const selectedSessionId = sessionParam
    ? toBigIntId(sessionParam)
    : sessions.find((s) => s.is_current)?.id ?? sessions[0]?.id ?? null;

  const assignments = selectedSessionId
    ? await prisma.class_subjects.findMany({
        where: {
          academic_session_id: selectedSessionId,
          deleted_at: null,
        },
      })
    : [];

  return jsonOk({
    sessions,
    classes,
    subjects,
    selectedSessionId,
    assignments,
  });
}

const matrixActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("toggle"),
    sessionId: z.union([z.number(), z.string()]),
    classId: z.union([z.number(), z.string()]),
    subjectId: z.union([z.number(), z.string()]),
  }),
  z.object({
    action: z.literal("save-settings"),
    sessionId: z.union([z.number(), z.string()]),
    classId: z.union([z.number(), z.string()]),
    subjectId: z.union([z.number(), z.string()]),
    totalMarks: z.number().int().min(1),
    passMarks: z.number().int().min(0),
    countsTowardTotal: z.boolean(),
    isOptional: z.boolean(),
  }),
  z.object({
    action: z.literal("assign-bulk"),
    sessionId: z.union([z.number(), z.string()]),
    classIds: z.array(z.union([z.number(), z.string()])).min(1),
    subjectIds: z.array(z.union([z.number(), z.string()])).min(1),
  }),
  z.object({
    action: z.literal("copy-class"),
    sessionId: z.union([z.number(), z.string()]),
    sourceClassId: z.union([z.number(), z.string()]),
    targetClassIds: z.array(z.union([z.number(), z.string()])).min(1),
  }),
  z.object({
    action: z.literal("copy-previous-session"),
    sessionId: z.union([z.number(), z.string()]),
  }),
]);

export async function POST(request: NextRequest) {
  const { error } = await requireApiUser("Create:Subject");
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = matrixActionSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid subject matrix action.", 400);
    }

    const now = new Date();
    const sessionId = toBigIntId(parsed.data.sessionId);

    if (parsed.data.action === "toggle") {
      const classId = toBigIntId(parsed.data.classId);
      const subjectId = toBigIntId(parsed.data.subjectId);

      const existing = await prisma.class_subjects.findUnique({
        where: {
          academic_session_id_school_class_id_subject_id: {
            academic_session_id: sessionId,
            school_class_id: classId,
            subject_id: subjectId,
          },
        },
      });

      if (existing && existing.deleted_at) {
        await prisma.class_subjects.update({
          where: { id: existing.id },
          data: { deleted_at: null, updated_at: now },
        });
        return jsonOk({ assigned: true });
      }
      if (existing) {
        await prisma.class_subjects.update({
          where: { id: existing.id },
          data: { deleted_at: now, updated_at: now },
        });
        return jsonOk({ assigned: false });
      }

      await prisma.class_subjects.create({
        data: {
          academic_session_id: sessionId,
          school_class_id: classId,
          subject_id: subjectId,
          total_marks: 100,
          pass_marks: 40,
          counts_toward_total: true,
          is_optional: false,
          created_at: now,
          updated_at: now,
        },
      });
      return jsonOk({ assigned: true });
    }

    if (parsed.data.action === "save-settings") {
      if (parsed.data.passMarks > parsed.data.totalMarks) {
        return jsonError("Pass marks cannot exceed total marks.", 422);
      }
      const classId = toBigIntId(parsed.data.classId);
      const subjectId = toBigIntId(parsed.data.subjectId);

      const assignment = await prisma.class_subjects.upsert({
        where: {
          academic_session_id_school_class_id_subject_id: {
            academic_session_id: sessionId,
            school_class_id: classId,
            subject_id: subjectId,
          },
        },
        update: {
          total_marks: parsed.data.totalMarks,
          pass_marks: parsed.data.passMarks,
          counts_toward_total: parsed.data.countsTowardTotal,
          is_optional: parsed.data.isOptional,
          deleted_at: null,
          updated_at: now,
        },
        create: {
          academic_session_id: sessionId,
          school_class_id: classId,
          subject_id: subjectId,
          total_marks: parsed.data.totalMarks,
          pass_marks: parsed.data.passMarks,
          counts_toward_total: parsed.data.countsTowardTotal,
          is_optional: parsed.data.isOptional,
          created_at: now,
          updated_at: now,
        },
      });
      return jsonOk({ assignment });
    }

    if (parsed.data.action === "assign-bulk") {
      const { classIds, subjectIds } = parsed.data;
      await prisma.$transaction(async (tx) => {
        for (const cid of classIds) {
          for (const sid of subjectIds) {
            await tx.class_subjects.upsert({
              where: {
                academic_session_id_school_class_id_subject_id: {
                  academic_session_id: sessionId,
                  school_class_id: toBigIntId(cid),
                  subject_id: toBigIntId(sid),
                },
              },
              update: { deleted_at: null, updated_at: now },
              create: {
                academic_session_id: sessionId,
                school_class_id: toBigIntId(cid),
                subject_id: toBigIntId(sid),
                total_marks: 100,
                pass_marks: 40,
                counts_toward_total: true,
                is_optional: false,
                created_at: now,
                updated_at: now,
              },
            });
          }
        }
      });
      return jsonOk({ ok: true });
    }

    if (parsed.data.action === "copy-class") {
      const { sourceClassId, targetClassIds } = parsed.data;
      const sourceAssignments = await prisma.class_subjects.findMany({
        where: {
          academic_session_id: sessionId,
          school_class_id: toBigIntId(sourceClassId),
          deleted_at: null,
        },
      });

      await prisma.$transaction(async (tx) => {
        for (const targetCid of targetClassIds) {
          for (const src of sourceAssignments) {
            await tx.class_subjects.upsert({
              where: {
                academic_session_id_school_class_id_subject_id: {
                  academic_session_id: sessionId,
                  school_class_id: toBigIntId(targetCid),
                  subject_id: src.subject_id,
                },
              },
              update: {
                total_marks: src.total_marks,
                pass_marks: src.pass_marks,
                counts_toward_total: src.counts_toward_total,
                is_optional: src.is_optional,
                deleted_at: null,
                updated_at: now,
              },
              create: {
                academic_session_id: sessionId,
                school_class_id: toBigIntId(targetCid),
                subject_id: src.subject_id,
                total_marks: src.total_marks,
                pass_marks: src.pass_marks,
                counts_toward_total: src.counts_toward_total,
                is_optional: src.is_optional,
                created_at: now,
                updated_at: now,
              },
            });
          }
        }
      });
      return jsonOk({ copied: sourceAssignments.length });
    }

    // copy-previous-session
    const currentSession = await prisma.academic_sessions.findUnique({
      where: { id: sessionId },
    });
    if (!currentSession?.start_date) {
      return jsonError("Selected session has no start date.", 400);
    }

    const previousSession = await prisma.academic_sessions.findFirst({
      where: {
        deleted_at: null,
        start_date: { lt: currentSession.start_date },
      },
      orderBy: { start_date: "desc" },
    });

    if (!previousSession) {
      return jsonError("No previous academic session found to copy from.", 404);
    }

    const prevAssignments = await prisma.class_subjects.findMany({
      where: { academic_session_id: previousSession.id, deleted_at: null },
    });

    await prisma.$transaction(async (tx) => {
      for (const src of prevAssignments) {
        await tx.class_subjects.upsert({
          where: {
            academic_session_id_school_class_id_subject_id: {
              academic_session_id: sessionId,
              school_class_id: src.school_class_id,
              subject_id: src.subject_id,
            },
          },
          update: {
            total_marks: src.total_marks,
            pass_marks: src.pass_marks,
            counts_toward_total: src.counts_toward_total,
            is_optional: src.is_optional,
            deleted_at: null,
            updated_at: now,
          },
          create: {
            academic_session_id: sessionId,
            school_class_id: src.school_class_id,
            subject_id: src.subject_id,
            total_marks: src.total_marks,
            pass_marks: src.pass_marks,
            counts_toward_total: src.counts_toward_total,
            is_optional: src.is_optional,
            created_at: now,
            updated_at: now,
          },
        });
      }
    });

    return jsonOk({
      copied: prevAssignments.length,
      fromSession: previousSession.name,
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Action failed.", 500);
  }
}
