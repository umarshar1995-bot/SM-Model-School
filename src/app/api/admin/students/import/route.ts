import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api-helpers";
import { normalizeMobile } from "@/lib/format";
import { toBigIntId } from "@/lib/serialize";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_ROWS = 2000;

interface ValidatedRow {
  rowNumber: number;
  status: "valid" | "warning" | "error";
  errors: string[];
  warnings: string[];
  data: {
    full_name: string;
    father_name: string;
    guardian_mobile: string | null;
    guardian_cnic: string | null;
    address: string | null;
    family_number: string | null;
    class_id: number | null;
    class_name: string;
    section_id: number | null;
    section_name: string;
    roll_no: string | null;
    gender: "male" | "female" | "other" | "";
    dob: string | null;
    b_form_no: string | null;
    admission_no: string | null;
    admission_date: string;
    previous_school: string | null;
    student_status: "active" | "left" | "struck_off" | "passed_out";
  };
}

function normalizeHeaderKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function pickField(normRow: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    const val = normRow[alias];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      return val;
    }
  }
  return "";
}

function parseExcelDate(raw: unknown): Date | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }
  // Excel numeric serial date (e.g. 42505)
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 1000 && raw < 100000) {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    }
  }

  const str = String(raw).trim();
  if (!str) return null;

  // Numeric string Excel serial date
  if (/^\d{4,5}(\.\d+)?$/.test(str)) {
    const num = Number(str);
    if (num > 1000 && num < 100000) {
      const parsed = XLSX.SSF.parse_date_code(num);
      if (parsed && parsed.y && parsed.m && parsed.d) {
        return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
      }
    }
  }

  // ISO YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(str);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
      return dt;
    }
    return null;
  }

  // DD/MM/YYYY or DD-MM-YYYY (common in Pakistan/UK Excel sheets)
  const dmyMatch = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(str);
  if (dmyMatch) {
    const p1 = Number(dmyMatch[1]);
    const p2 = Number(dmyMatch[2]);
    const y = Number(dmyMatch[3]);
    // If first part > 12, definitely DD/MM/YYYY; default to DD/MM/YYYY unless second part > 12
    const day = p2 > 12 ? p2 : p1;
    const month = p2 > 12 ? p1 : p2;
    const dt = new Date(Date.UTC(y, month - 1, day));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day) {
      return dt;
    }
    return null;
  }

  const fallback = new Date(str);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function formatCnic(raw: string): { formatted: string | null; valid: boolean } {
  const trimmed = raw.trim();
  if (!trimmed) return { formatted: null, valid: true };
  const digits = trimmed.replace(/\D+/g, "");
  if (digits.length !== 13) {
    return { formatted: trimmed, valid: false };
  }
  return {
    formatted: `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`,
    valid: true,
  };
}

function normalizeClassToken(input: string): string {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
  if (s === "kg" || s === "k g" || s === "kindergarten") return "kg";
  if (s === "prep" || s === "nursery" || s === "pg") return s;
  const numMatch = /^(?:class|grade|std|standard)?\s*[-_]?(\d{1,2})(?:st|nd|rd|th)?$/.exec(s);
  if (numMatch) return `class ${Number(numMatch[1])}`;
  return s;
}

function normalizeGender(raw: string): "male" | "female" | "other" | "" {
  const g = raw.trim().toLowerCase();
  if (["male", "m", "boy", "boys"].includes(g)) return "male";
  if (["female", "f", "girl", "girls"].includes(g)) return "female";
  if (["other", "o"].includes(g)) return "other";
  return "";
}

function normalizeStatus(
  raw: string,
): "active" | "left" | "struck_off" | "passed_out" | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (!s) return "active";
  if (s === "active" || s === "left" || s === "struck_off" || s === "passed_out") {
    return s;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const { error } = await requireApiUser("Create:Student", request);
  if (error) return error;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const mode = String(formData.get("mode") ?? "commit").toLowerCase();
    const skipInvalid = String(formData.get("skipInvalid") ?? "true") !== "false";
    const targetClassIdRaw = String(formData.get("targetClassId") ?? "").trim();
    const targetSectionIdRaw = String(formData.get("targetSectionId") ?? "").trim();

    if (!(file instanceof File)) {
      return jsonError("Please upload an Excel (.xlsx / .xls) or CSV file.", 400);
    }

    if (file.size > MAX_FILE_BYTES) {
      return jsonError("File exceeds the 10 MB maximum size limit.", 400);
    }

    const fileName = file.name.toLowerCase();
    if (!/\.(xlsx|xls|csv)$/.test(fileName)) {
      return jsonError(
        "Unsupported file format. Please upload a .xlsx, .xls, or .csv spreadsheet.",
        400,
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) {
      return jsonError("Uploaded spreadsheet contains no sheets.", 400);
    }

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[firstSheet],
      { defval: "" },
    );

    // Filter out completely blank rows
    const nonEmptyEntries = rawRows
      .map((row, index) => ({ row, rowNumber: index + 2 }))
      .filter(({ row }) =>
        Object.values(row).some((v) => String(v ?? "").trim() !== ""),
      );

    if (nonEmptyEntries.length === 0) {
      return jsonError("No student data rows found in the uploaded file.", 400);
    }

    if (nonEmptyEntries.length > MAX_ROWS) {
      return jsonError(
        `Too many rows (${nonEmptyEntries.length}). Maximum ${MAX_ROWS} students per upload.`,
        400,
      );
    }

    const detectedHeaders = Object.keys(rawRows[0] ?? {});

    // Load DB reference catalog in parallel
    const [
      classes,
      currentSession,
      existingFamilies,
      existingStudents,
      existingEnrollments,
    ] = await Promise.all([
      prisma.school_classes.findMany({
        where: { is_active: true, deleted_at: null },
        include: {
          class_sections: {
            where: { is_active: true, deleted_at: null },
            orderBy: { name: "asc" },
          },
        },
        orderBy: [{ sort_order: "asc" }, { name: "asc" }],
      }),
      prisma.academic_sessions.findFirst({
        where: { is_current: true, deleted_at: null },
      }),
      prisma.families.findMany({
        where: { deleted_at: null },
        select: {
          id: true,
          family_number: true,
          guardian_name: true,
          guardian_mobile: true,
        },
      }),
      prisma.students.findMany({
        where: { deleted_at: null },
        select: {
          id: true,
          full_name: true,
          dob: true,
          admission_no: true,
          families: { select: { guardian_name: true } },
        },
      }),
      prisma.student_enrollments.findMany({
        where: { deleted_at: null, status: "active" },
        select: {
          session_id: true,
          class_id: true,
          section_id: true,
          roll_no: true,
        },
      }),
    ]);

    if (!currentSession) {
      return jsonError(
        "No active Academic Session found. Please configure a current academic session first.",
        422,
      );
    }

    const targetClass = targetClassIdRaw
      ? classes.find((c) => c.id === toBigIntId(targetClassIdRaw)) ?? null
      : null;

    const targetSection =
      targetClass && targetSectionIdRaw
        ? targetClass.class_sections.find(
            (s) => s.id === toBigIntId(targetSectionIdRaw),
          ) ?? null
        : null;

    // Lookup maps
    const classByToken = new Map<string, (typeof classes)[number]>();
    for (const cls of classes) {
      classByToken.set(normalizeClassToken(cls.name), cls);
      classByToken.set(cls.name.trim().toLowerCase(), cls);
    }

    const familyByNumber = new Map<string, (typeof existingFamilies)[number]>();
    for (const fam of existingFamilies) {
      familyByNumber.set(String(fam.family_number), fam);
    }

    const existingAdmissionNos = new Set(
      existingStudents
        .map((s) => s.admission_no?.trim().toLowerCase())
        .filter((x): x is string => Boolean(x)),
    );

    const existingStudentIdentity = new Set(
      existingStudents.map(
        (s) =>
          `${s.full_name.trim().toLowerCase()}|${(s.families?.guardian_name ?? "").trim().toLowerCase()}|${s.dob.toISOString().slice(0, 10)}`,
      ),
    );

    const existingRollKeys = new Set(
      existingEnrollments
        .filter((e) => e.session_id === currentSession.id && e.roll_no)
        .map(
          (e) =>
            `${e.class_id}|${e.section_id}|${e.roll_no!.trim().toLowerCase()}`,
        ),
    );

    // Track in-file uniqueness
    const seenAdmissionNos = new Set<string>();
    const seenRollKeys = new Set<string>();
    const seenStudentKeys = new Set<string>();

    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);
    const currentYear = now.getUTCFullYear();

    const validatedRows: ValidatedRow[] = [];

    for (const { row, rowNumber } of nonEmptyEntries) {
      const normRow: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        normRow[normalizeHeaderKey(k)] = v;
      }

      const fullName = String(
        pickField(normRow, [
          "full_name",
          "student_name",
          "student",
          "name",
          "student_full_name",
        ]),
      ).trim();

      // Skip untouched template example rows cleanly with a warning if present
      if (fullName.toLowerCase().includes("(replace example)")) {
        continue;
      }

      const fatherName = String(
        pickField(normRow, [
          "father_name",
          "fathers_name",
          "father_s_name",
          "guardian_name",
          "guardian",
          "parent_name",
          "father",
        ]),
      ).trim();

      const familyNumberRaw = String(
        pickField(normRow, ["family_number", "family_no", "family_id", "fam_no"]),
      )
        .trim()
        .replace(/^FAM-/i, "");

      const mobileRaw = String(
        pickField(normRow, [
          "guardian_mobile",
          "father_mobile",
          "mobile",
          "mobile_no",
          "phone",
          "contact",
          "contact_no",
        ]),
      ).trim();

      const guardianCnicRaw = String(
        pickField(normRow, ["guardian_cnic", "father_cnic", "cnic", "parent_cnic"]),
      ).trim();

      const address =
        String(pickField(normRow, ["address", "home_address", "residential_address"])).trim() ||
        null;

      const classNameRaw = String(
        pickField(normRow, ["class_name", "class", "grade", "standard"]),
      ).trim();

      const sectionNameRaw = String(
        pickField(normRow, ["section_name", "section", "sec"]),
      ).trim();

      const rollNo =
        String(pickField(normRow, ["roll_no", "roll_number", "roll"])).trim() || null;

      const genderRaw = String(pickField(normRow, ["gender", "sex"])).trim();
      const dobRaw = pickField(normRow, [
        "dob",
        "date_of_birth",
        "birth_date",
        "birthdate",
      ]);
      const bFormRaw = String(
        pickField(normRow, ["b_form_no", "b_form", "bform", "student_cnic", "form_b"]),
      ).trim();
      const admissionNoRaw =
        String(
          pickField(normRow, ["admission_no", "adm_no", "gr_no", "registration_no"]),
        ).trim() || null;
      const admissionDateRaw = pickField(normRow, [
        "admission_date",
        "adm_date",
        "date_of_admission",
      ]);
      const previousSchool =
        String(pickField(normRow, ["previous_school", "prev_school"])).trim() || null;
      const statusRaw = String(pickField(normRow, ["status"])).trim();

      const rowErrors: string[] = [];
      const rowWarnings: string[] = [];

      // 1. Student full_name validation
      if (!fullName) {
        rowErrors.push("Student full_name is required.");
      } else if (fullName.length < 2 || fullName.length > 180) {
        rowErrors.push("Student full_name must be between 2 and 180 characters.");
      } else if (/^\d+$/.test(fullName)) {
        rowErrors.push("Student full_name cannot be purely numeric.");
      }

      // 2. Family / Father validation
      let resolvedFatherName = fatherName;
      let resolvedFamilyNumber: string | null = null;
      if (familyNumberRaw) {
        if (!/^\d+$/.test(familyNumberRaw)) {
          rowErrors.push(`Invalid family_number "${familyNumberRaw}" (must be numeric).`);
        } else {
          const famMatch = familyByNumber.get(familyNumberRaw);
          if (!famMatch) {
            if (!fatherName) {
              rowErrors.push(
                `Family #${familyNumberRaw} does not exist. Provide father_name to auto-register a new family.`,
              );
            } else {
              rowWarnings.push(
                `Family #${familyNumberRaw} not found; will create a new family for "${fatherName}".`,
              );
            }
          } else {
            resolvedFamilyNumber = familyNumberRaw;
            if (!resolvedFatherName) resolvedFatherName = famMatch.guardian_name;
          }
        }
      } else {
        if (!fatherName) {
          rowErrors.push("Father / Guardian name (father_name) is required.");
        } else if (fatherName.length < 2 || fatherName.length > 150) {
          rowErrors.push("father_name must be between 2 and 150 characters.");
        }
      }

      // 3. Class validation (every active class supported!)
      let matchedClass: (typeof classes)[number] | null = null;
      if (classNameRaw) {
        matchedClass =
          classByToken.get(normalizeClassToken(classNameRaw)) ??
          classByToken.get(classNameRaw.toLowerCase()) ??
          null;
        if (!matchedClass) {
          rowErrors.push(
            `Unknown class "${classNameRaw}". Valid classes: ${classes.map((c) => c.name).join(", ")}.`,
          );
        } else if (targetClass && matchedClass.id !== targetClass.id) {
          rowWarnings.push(
            `Excel specifies "${matchedClass.name}" while target class is "${targetClass.name}" — will enroll in "${matchedClass.name}".`,
          );
        }
      } else if (targetClass) {
        matchedClass = targetClass;
      } else {
        rowErrors.push(
          "class_name is required (or select a Target Class before uploading).",
        );
      }

      // 4. Section resolution
      let matchedSectionId: number | null = null;
      let resolvedSectionName = "Section A";
      if (matchedClass) {
        if (sectionNameRaw) {
          const secLower = sectionNameRaw.toLowerCase();
          const secMatch = matchedClass.class_sections.find(
            (s) =>
              s.name.toLowerCase() === secLower ||
              s.name.toLowerCase() === `section ${secLower}` ||
              s.name.toLowerCase().replace(/^section\s+/, "") === secLower,
          );
          if (secMatch) {
            matchedSectionId = Number(secMatch.id);
            resolvedSectionName = secMatch.name;
          } else {
            resolvedSectionName =
              sectionNameRaw.length === 1
                ? `Section ${sectionNameRaw.toUpperCase()}`
                : sectionNameRaw;
            rowWarnings.push(
              `Section "${resolvedSectionName}" will be created automatically under ${matchedClass.name}.`,
            );
          }
        } else if (targetSection && targetClass && matchedClass.id === targetClass.id) {
          matchedSectionId = Number(targetSection.id);
          resolvedSectionName = targetSection.name;
        } else if (matchedClass.class_sections[0]) {
          matchedSectionId = Number(matchedClass.class_sections[0].id);
          resolvedSectionName = matchedClass.class_sections[0].name;
        } else {
          resolvedSectionName = "Section A";
        }
      }

      // 5. Gender validation
      const gender = normalizeGender(genderRaw);
      if (!gender) {
        rowErrors.push(
          `Invalid gender "${genderRaw || "(blank)"}". Use male, female, or other.`,
        );
      }

      // 6. DOB validation
      const dobDate = parseExcelDate(dobRaw);
      let dobIso: string | null = null;
      if (!dobDate) {
        rowErrors.push(
          `Invalid or missing dob "${String(dobRaw ?? "")}". Use YYYY-MM-DD or DD/MM/YYYY.`,
        );
      } else {
        const dobYear = dobDate.getUTCFullYear();
        if (dobDate.getTime() > now.getTime()) {
          rowErrors.push("Date of birth cannot be in the future.");
        } else if (dobYear < 1995 || dobYear > currentYear) {
          rowErrors.push(`Date of birth year (${dobYear}) is outside valid school range (1995–${currentYear}).`);
        } else {
          dobIso = dobDate.toISOString().slice(0, 10);
        }
      }

      // 7. Mobile validation
      let normalizedMobile: string | null = null;
      if (mobileRaw) {
        const digits = mobileRaw.replace(/\D+/g, "");
        if (digits.length < 10 || digits.length > 15) {
          rowErrors.push(
            `Invalid mobile number "${mobileRaw}" (must have 10–15 digits).`,
          );
        } else {
          normalizedMobile = normalizeMobile(mobileRaw);
        }
      }

      // 8. CNIC & B-Form validation
      const cnicCheck = formatCnic(guardianCnicRaw);
      if (!cnicCheck.valid) {
        rowErrors.push(
          `Invalid guardian_cnic "${guardianCnicRaw}" (must be 13 digits, e.g. 45203-1234567-1).`,
        );
      }
      const bFormCheck = formatCnic(bFormRaw);
      if (!bFormCheck.valid) {
        rowErrors.push(
          `Invalid b_form_no "${bFormRaw}" (must be 13 digits, e.g. 45203-1234567-3).`,
        );
      }

      // 9. Admission Date validation
      let admissionDateIso = todayIso;
      if (admissionDateRaw !== "" && admissionDateRaw !== null && admissionDateRaw !== undefined) {
        const admDt = parseExcelDate(admissionDateRaw);
        if (!admDt) {
          rowErrors.push(`Invalid admission_date "${String(admissionDateRaw)}".`);
        } else if (dobDate && admDt.getTime() < dobDate.getTime()) {
          rowErrors.push("admission_date cannot be earlier than date of birth.");
        } else {
          admissionDateIso = admDt.toISOString().slice(0, 10);
        }
      }

      // 10. Status validation
      const studentStatus = normalizeStatus(statusRaw);
      if (!studentStatus) {
        rowErrors.push(
          `Invalid status "${statusRaw}". Allowed: active, left, struck_off, passed_out.`,
        );
      }

      // 11. Admission No uniqueness
      if (admissionNoRaw) {
        const admKey = admissionNoRaw.toLowerCase();
        if (existingAdmissionNos.has(admKey)) {
          rowErrors.push(`Admission No "${admissionNoRaw}" already exists in database.`);
        } else if (seenAdmissionNos.has(admKey)) {
          rowErrors.push(`Duplicate Admission No "${admissionNoRaw}" inside this Excel file.`);
        } else {
          seenAdmissionNos.add(admKey);
        }
      }

      // 12. Roll No uniqueness within Class + Section
      if (rollNo && matchedClass) {
        const secKey = matchedSectionId ? String(matchedSectionId) : resolvedSectionName.toLowerCase();
        const fileRollKey = `${matchedClass.id}|${secKey}|${rollNo.toLowerCase()}`;
        if (matchedSectionId && existingRollKeys.has(`${matchedClass.id}|${matchedSectionId}|${rollNo.toLowerCase()}`)) {
          rowErrors.push(
            `Roll No "${rollNo}" is already taken in ${matchedClass.name} (${resolvedSectionName}).`,
          );
        } else if (seenRollKeys.has(fileRollKey)) {
          rowErrors.push(
            `Duplicate Roll No "${rollNo}" for ${matchedClass.name} (${resolvedSectionName}) inside this file.`,
          );
        } else {
          seenRollKeys.add(fileRollKey);
        }
      }

      // 13. Duplicate student identity detection
      if (fullName && resolvedFatherName && dobIso) {
        const identityKey = `${fullName.toLowerCase()}|${resolvedFatherName.toLowerCase()}|${dobIso}`;
        if (existingStudentIdentity.has(identityKey)) {
          rowErrors.push(
            `Student "${fullName}" (Father: ${resolvedFatherName}, DOB: ${dobIso}) already exists in database.`,
          );
        } else if (seenStudentKeys.has(identityKey)) {
          rowErrors.push(
            `Duplicate row for "${fullName}" (Father: ${resolvedFatherName}, DOB: ${dobIso}) inside this file.`,
          );
        } else {
          seenStudentKeys.add(identityKey);
        }
      }

      const rowStatus: ValidatedRow["status"] =
        rowErrors.length > 0
          ? "error"
          : rowWarnings.length > 0
            ? "warning"
            : "valid";

      validatedRows.push({
        rowNumber,
        status: rowStatus,
        errors: rowErrors,
        warnings: rowWarnings,
        data: {
          full_name: fullName,
          father_name: resolvedFatherName,
          guardian_mobile: normalizedMobile,
          guardian_cnic: cnicCheck.formatted,
          address,
          family_number: resolvedFamilyNumber,
          class_id: matchedClass ? Number(matchedClass.id) : null,
          class_name: matchedClass?.name ?? classNameRaw,
          section_id: matchedSectionId,
          section_name: resolvedSectionName,
          roll_no: rollNo,
          gender,
          dob: dobIso,
          b_form_no: bFormCheck.formatted,
          admission_no: admissionNoRaw,
          admission_date: admissionDateIso,
          previous_school: previousSchool,
          student_status: studentStatus ?? "active",
        },
      });
    }

    if (validatedRows.length === 0) {
      return jsonError(
        "Only the sample placeholder row was found. Please replace it with real student rows.",
        400,
      );
    }

    const validRows = validatedRows.filter((r) => r.status !== "error");
    const errorRows = validatedRows.filter((r) => r.status === "error");
    const warningRows = validatedRows.filter((r) => r.status === "warning");

    // Breakdown by class for UI preview
    const classCounts = new Map<string, number>();
    for (const r of validRows) {
      const label = r.data.class_name || "Unassigned";
      classCounts.set(label, (classCounts.get(label) ?? 0) + 1);
    }
    const classesBreakdown = Array.from(classCounts.entries()).map(
      ([className, count]) => ({ className, count }),
    );

    if (mode === "validate") {
      return jsonOk({
        mode: "validate",
        totalRows: validatedRows.length,
        validCount: validRows.length,
        warningCount: warningRows.length,
        errorCount: errorRows.length,
        detectedHeaders,
        classesBreakdown,
        rows: validatedRows,
      });
    }

    // COMMIT MODE
    if (!skipInvalid && errorRows.length > 0) {
      return jsonError(
        `Import blocked: ${errorRows.length} row(s) have validation errors. Fix them or enable "Skip invalid rows".`,
        422,
      );
    }

    if (validRows.length === 0) {
      return jsonError(
        "No valid student rows to import. Please fix the validation errors shown in the preview.",
        422,
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Track next family number starting at 1001 if DB is empty
      const maxFam = await tx.families.aggregate({ _max: { family_number: true } });
      let nextFamilyNumber = Math.max(
        1001,
        Number(maxFam._max.family_number ?? 1000) + 1,
      );

      // Family lookup cache (by number and by normalized father_name + mobile)
      const famCacheByNo = new Map<string, bigint>();
      const famCacheByIdentity = new Map<string, bigint>();
      const allExistingFams = await tx.families.findMany({
        where: { deleted_at: null },
        select: { id: true, family_number: true, guardian_name: true, guardian_mobile: true },
      });
      for (const f of allExistingFams) {
        famCacheByNo.set(String(f.family_number), f.id);
        const key = `${f.guardian_name.trim().toLowerCase()}|${(f.guardian_mobile ?? "").trim()}`;
        famCacheByIdentity.set(key, f.id);
      }

      // Section cache per classId:sectionNameLower -> sectionId
      const sectionCache = new Map<string, bigint>();
      for (const cls of classes) {
        for (const sec of cls.class_sections) {
          sectionCache.set(`${cls.id}|${sec.name.trim().toLowerCase()}`, sec.id);
        }
      }

      let studentCountSeq = await tx.students.count();
      const year = now.getFullYear();

      let imported = 0;
      let familiesCreated = 0;
      let sectionsCreated = 0;

      for (const item of validRows) {
        const d = item.data;

        // 1. Resolve or create Family
        let familyId: bigint | null = null;
        if (d.family_number && famCacheByNo.has(d.family_number)) {
          familyId = famCacheByNo.get(d.family_number)!;
        } else {
          const famIdentityKey = `${d.father_name.trim().toLowerCase()}|${(d.guardian_mobile ?? "").trim()}`;
          if (famCacheByIdentity.has(famIdentityKey)) {
            familyId = famCacheByIdentity.get(famIdentityKey)!;
          } else {
            const createdFam = await tx.families.create({
              data: {
                family_number: BigInt(nextFamilyNumber++),
                guardian_name: d.father_name.trim(),
                guardian_mobile: d.guardian_mobile,
                guardian_cnic: d.guardian_cnic,
                address: d.address,
                is_active: true,
                created_at: now,
                updated_at: now,
              },
            });
            familyId = createdFam.id;
            famCacheByNo.set(String(createdFam.family_number), createdFam.id);
            famCacheByIdentity.set(famIdentityKey, createdFam.id);
            familiesCreated++;
          }
        }

        // 2. Resolve or create Admission No
        let admissionNo = d.admission_no;
        if (!admissionNo) {
          studentCountSeq++;
          admissionNo = `SM-${year}-${String(studentCountSeq).padStart(3, "0")}`;
          while (
            await tx.students.findFirst({ where: { admission_no: admissionNo } })
          ) {
            studentCountSeq++;
            admissionNo = `SM-${year}-${String(studentCountSeq).padStart(3, "0")}`;
          }
        }

        // 3. Create Student
        const createdStudent = await tx.students.create({
          data: {
            family_id: familyId,
            admission_no: admissionNo,
            full_name: d.full_name,
            gender: d.gender as "male" | "female" | "other",
            dob: new Date(d.dob!),
            b_form_no: d.b_form_no,
            previous_school: d.previous_school,
            admission_date: new Date(d.admission_date),
            status: d.student_status,
            created_at: now,
            updated_at: now,
          },
        });

        // 4. Resolve or create Section under the student's respective Class & Enroll!
        if (d.class_id) {
          const classIdBig = BigInt(d.class_id);
          const secCacheKey = `${classIdBig}|${d.section_name.trim().toLowerCase()}`;
          let sectionIdBig: bigint | null = d.section_id
            ? BigInt(d.section_id)
            : sectionCache.get(secCacheKey) ?? null;

          if (!sectionIdBig) {
            const newSec = await tx.class_sections.create({
              data: {
                class_id: classIdBig,
                name: d.section_name.trim() || "Section A",
                capacity: 40,
                is_active: true,
                created_at: now,
                updated_at: now,
              },
            });
            sectionIdBig = newSec.id;
            sectionCache.set(secCacheKey, newSec.id);
            sectionsCreated++;
          }

          await tx.student_enrollments.create({
            data: {
              student_id: createdStudent.id,
              session_id: currentSession.id,
              class_id: classIdBig,
              section_id: sectionIdBig,
              roll_no: d.roll_no,
              admission_date: new Date(d.admission_date),
              status: "active",
              created_at: now,
              updated_at: now,
            },
          });
        }

        imported++;
      }

      return { imported, familiesCreated, sectionsCreated };
    }, { timeout: 60000, maxWait: 15000 });

    return jsonOk({
      mode: "commit",
      imported: result.imported,
      familiesCreated: result.familiesCreated,
      sectionsCreated: result.sectionsCreated,
      skipped: errorRows.length,
      classesBreakdown,
      errors: errorRows
        .slice(0, 15)
        .map((r) => `Row ${r.rowNumber}: ${r.errors.join("; ")}`),
    });
  } catch (err) {
    console.error("Student Excel import error:", err);
    return jsonError(
      err instanceof Error ? err.message : "Failed to process Excel import.",
      400,
    );
  }
}
