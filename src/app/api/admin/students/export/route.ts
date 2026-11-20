import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-helpers";
import { formatDateInput } from "@/lib/format";
import { toBigIntId } from "@/lib/serialize";

export async function GET(request: NextRequest) {
  const { error } = await requireApiUser("ViewAny:Student");
  if (error) return error;

  const sp = request.nextUrl.searchParams;
  const studentIdParam = sp.get("studentId");
  const classIdParam = sp.get("classId");

  const students = await prisma.students.findMany({
    where: {
      deleted_at: null,
      ...(studentIdParam ? { id: toBigIntId(studentIdParam) } : {}),
      ...(classIdParam
        ? {
            student_enrollments: {
              some: {
                deleted_at: null,
                status: "active",
                class_id: toBigIntId(classIdParam),
              },
            },
          }
        : {}),
    },
    include: {
      families: true,
      student_enrollments: {
        where: { deleted_at: null },
        orderBy: { id: "desc" },
        take: 1,
        include: { school_classes: true, class_sections: true },
      },
    },
    orderBy: { id: "asc" },
  });

  const rows = students.map((s) => {
    const enr = s.student_enrollments[0];
    return {
      admission_no: s.admission_no ?? "",
      full_name: s.full_name,
      father_name: s.families?.guardian_name ?? "",
      family_number: s.families ? Number(s.families.family_number) : "",
      guardian_mobile: s.families?.guardian_mobile ?? "",
      class_name: enr?.school_classes?.name ?? "",
      section_name: enr?.class_sections?.name ?? "",
      roll_no: enr?.roll_no ?? "",
      gender: s.gender,
      dob: formatDateInput(s.dob),
      b_form_no: s.b_form_no ?? "",
      previous_school: s.previous_school ?? "",
      admission_date: formatDateInput(s.admission_date),
      status: s.status,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Students");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const fileName = studentIdParam && students[0]
    ? `${students[0].full_name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.xlsx`
    : classIdParam
      ? `class-${classIdParam}-students.xlsx`
      : "students.xlsx";

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
