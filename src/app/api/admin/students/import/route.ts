import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api-helpers";

export async function POST(request: NextRequest) {
  const { error } = await requireApiUser("Create:Student");
  if (error) return error;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonError("Please upload an Excel (.xlsx/.xls) or CSV file.", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) {
      return jsonError("Uploaded spreadsheet is empty.", 400);
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[firstSheet],
      { defval: "" },
    );

    if (rows.length === 0) {
      return jsonError("No student rows found in file.", 400);
    }

    const now = new Date();
    let imported = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const familyNumberRaw = String(row.family_number ?? "").trim();
      const fullName = String(row.full_name ?? "").trim();
      const gender = String(row.gender ?? "").trim().toLowerCase();
      const dobRaw = String(row.dob ?? "").trim();
      const admissionDateRaw = String(row.admission_date ?? "").trim();
      const status = String(row.status ?? "active").trim().toLowerCase() || "active";

      if (!/^\d+$/.test(familyNumberRaw)) {
        errors.push(`Row ${rowNum}: invalid family_number`);
        continue;
      }
      if (!fullName) {
        errors.push(`Row ${rowNum}: full_name is required`);
        continue;
      }
      if (!["male", "female", "other"].includes(gender)) {
        errors.push(`Row ${rowNum}: gender must be male, female, or other`);
        continue;
      }

      const dob = new Date(dobRaw);
      const admissionDate = new Date(admissionDateRaw || now.toISOString());
      if (Number.isNaN(dob.getTime())) {
        errors.push(`Row ${rowNum}: invalid dob`);
        continue;
      }

      const family = await prisma.families.findFirst({
        where: { family_number: BigInt(familyNumberRaw), deleted_at: null },
      });
      if (!family) {
        errors.push(`Row ${rowNum}: family #${familyNumberRaw} not found`);
        continue;
      }

      const admissionNo = String(row.admission_no ?? "").trim() || null;
      await prisma.students.create({
        data: {
          family_id: family.id,
          admission_no: admissionNo,
          full_name: fullName,
          gender,
          dob,
          b_form_no: String(row.b_form_no ?? "").trim() || null,
          previous_school: String(row.previous_school ?? "").trim() || null,
          admission_date: Number.isNaN(admissionDate.getTime()) ? now : admissionDate,
          status: ["active", "left", "struck_off", "passed_out"].includes(status)
            ? status
            : "active",
          created_at: now,
          updated_at: now,
        },
      });
      imported++;
    }

    return jsonOk({
      imported,
      skipped: errors.length,
      errors: errors.slice(0, 10),
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Import failed.", 400);
  }
}
