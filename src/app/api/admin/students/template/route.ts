import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-helpers";
import { toBigIntId } from "@/lib/serialize";

export async function GET(request: NextRequest) {
  const { error } = await requireApiUser("ViewAny:Student");
  if (error) return error;

  const sp = request.nextUrl.searchParams;
  const classIdParam = sp.get("classId");

  const classes = await prisma.school_classes.findMany({
    where: { is_active: true, deleted_at: null },
    include: {
      class_sections: {
        where: { is_active: true, deleted_at: null },
        orderBy: { name: "asc" },
      },
    },
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
  });

  const selectedClass = classIdParam
    ? classes.find((c) => c.id === toBigIntId(classIdParam)) ?? null
    : null;

  const sampleClassName = selectedClass?.name ?? classes[0]?.name ?? "Class 1";
  const sampleSectionName =
    selectedClass?.class_sections[0]?.name ??
    classes[0]?.class_sections[0]?.name ??
    "Section A";

  const today = new Date().toISOString().slice(0, 10);

  // Sheet 1: Students import sheet with exact validated headers + 1 clear sample row
  const templateRows = [
    {
      full_name: "Ahmed Ali (Replace Example)",
      father_name: "Muhammad Ali",
      guardian_mobile: "0300-1234567",
      guardian_cnic: "45203-1234567-1",
      address: "Main Road, Sukkur",
      family_number: "",
      class_name: sampleClassName,
      section_name: sampleSectionName,
      roll_no: "01",
      gender: "male",
      dob: "2016-05-15",
      b_form_no: "45203-7654321-3",
      admission_no: "",
      admission_date: today,
      previous_school: "",
      status: "active",
    },
  ];

  const studentsSheet = XLSX.utils.json_to_sheet(templateRows);
  studentsSheet["!cols"] = [
    { wch: 28 }, // full_name
    { wch: 24 }, // father_name
    { wch: 16 }, // guardian_mobile
    { wch: 18 }, // guardian_cnic
    { wch: 24 }, // address
    { wch: 14 }, // family_number
    { wch: 14 }, // class_name
    { wch: 14 }, // section_name
    { wch: 10 }, // roll_no
    { wch: 10 }, // gender
    { wch: 14 }, // dob
    { wch: 18 }, // b_form_no
    { wch: 16 }, // admission_no
    { wch: 15 }, // admission_date
    { wch: 20 }, // previous_school
    { wch: 12 }, // status
  ];

  // Sheet 2: Reference sheet listing EVERY active class, sections, and validation rules
  const referenceRows: Record<string, string>[] = [
    {
      Field: "full_name",
      Required: "YES",
      Rule: "Student full name (2-180 characters, cannot be purely numeric). Replace the example row before importing.",
    },
    {
      Field: "father_name",
      Required: "YES*",
      Rule: "Father / Guardian full name (required unless an existing family_number is provided). Siblings with same father_name + guardian_mobile automatically link to one Family.",
    },
    {
      Field: "class_name",
      Required: "YES*",
      Rule: `Must match one of the valid school classes listed below (optional if you pick a Target Class in the import modal).`,
    },
    {
      Field: "section_name",
      Required: "Optional",
      Rule: "Defaults to Section A if left blank. Accepts 'A' or 'Section A'.",
    },
    {
      Field: "roll_no",
      Required: "Optional",
      Rule: "Unique per Class + Section in the current session (e.g. 01, 02).",
    },
    {
      Field: "gender",
      Required: "YES",
      Rule: "Allowed values: male, female, other (also accepts M / F / Boy / Girl).",
    },
    {
      Field: "dob",
      Required: "YES",
      Rule: "Date of Birth in YYYY-MM-DD (or DD/MM/YYYY or Excel date). Cannot be in the future.",
    },
    {
      Field: "guardian_mobile",
      Required: "Optional",
      Rule: "10-15 digits (e.g. 0300-1234567 or 923001234567).",
    },
    {
      Field: "guardian_cnic / b_form_no",
      Required: "Optional",
      Rule: "13-digit CNIC / B-Form (e.g. 45203-1234567-1).",
    },
    {
      Field: "admission_no",
      Required: "Optional",
      Rule: "Auto-generated (SM-YYYY-001...) if blank. Must be unique if entered.",
    },
    {
      Field: "admission_date",
      Required: "Optional",
      Rule: "Defaults to today if blank. Must be on or after DOB.",
    },
    {
      Field: "status",
      Required: "Optional",
      Rule: "Allowed values: active (default), left, struck_off, passed_out.",
    },
    { Field: "", Required: "", Rule: "" },
    {
      Field: "VALID SCHOOL CLASSES",
      Required: "SECTIONS",
      Rule: "Use these exact class names in the class_name column",
    },
    ...classes.map((c) => ({
      Field: c.name,
      Required: c.class_sections.map((s) => s.name).join(", ") || "Section A",
      Rule: `Active Class #${c.sort_order + 1}`,
    })),
  ];

  const rulesSheet = XLSX.utils.json_to_sheet(referenceRows);
  rulesSheet["!cols"] = [{ wch: 26 }, { wch: 24 }, { wch: 80 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, studentsSheet, "Students");
  XLSX.utils.book_append_sheet(workbook, rulesSheet, "Valid Classes & Rules");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const slug = selectedClass
    ? selectedClass.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()
    : "all-classes";

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="student-import-template-${slug}.xlsx"`,
    },
  });
}
