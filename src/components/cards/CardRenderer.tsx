import React from "react";
import { photoUrl } from "@/lib/format";

export interface CardTemplateData {
  id?: number;
  slug: string;
  name: string;
  template_type: string;
  orientation: string;
  settings?: Record<string, unknown> | null;
}

export interface CardStudentData {
  full_name?: string | null;
  admission_no?: string | null;
  photo_path?: string | null;
  family?: {
    family_number?: number | string | null;
    guardian_name?: string | null;
    guardian_mobile?: string | null;
    address?: string | null;
  } | null;
  className?: string | null;
  sectionName?: string | null;
}

export interface CardTeacherData {
  name?: string | null;
  employee_no?: string | null;
  photo_path?: string | null;
}

interface CardRendererProps {
  template: CardTemplateData;
  side: "front" | "back";
  student?: CardStudentData | null;
  teacher?: CardTeacherData | null;
  cardNumber?: string | null;
}

export function CardRenderer({
  template,
  side,
  student,
  teacher,
  cardNumber = "CARD-TEST-0001",
}: CardRendererProps) {
  const settings = (template.settings ?? {}) as Record<string, unknown>;
  const tagline = String(settings.tagline ?? "Learning with purpose");
  const backText = String(
    settings.back_text ?? "If found, please return this card to the school office.",
  );
  const showFamilyNumber = settings.show_family_number !== false;
  const showSessionValidity = settings.show_session_validity !== false;

  const studentName = student?.full_name || "Muhammed Ali Khan";
  const admissionNo = student?.admission_no || "SM-2025-084";
  const familyNumber = student?.family?.family_number ?? "1042";
  const guardianName = student?.family?.guardian_name || "Tariq Mehmood Khan";
  const guardianMobile = student?.family?.guardian_mobile || "0300-1234567";
  const address = student?.family?.address || "Hindyari, Sukkur, Sindh";
  const className = student?.className || "Class 8";
  const sectionName = student?.sectionName || "Section A";
  const studentPhoto = photoUrl(student?.photo_path);

  const teacherName = teacher?.name || "Staff Member";
  const employeeNo = teacher?.employee_no || "EMP-0001";
  const teacherPhoto = photoUrl(teacher?.photo_path);

  const slug = template.slug;

  // 1. PRESTIGE GOLD & SAPPHIRE
  if (slug === "prestige-gold") {
    if (side === "back") {
      return (
        <article className="relative flex h-[85.6mm] w-[54mm] flex-col justify-between overflow-hidden rounded-[4mm] bg-slate-900 text-white shadow-2xl ring-1 ring-amber-400/30 p-3.5 shrink-0">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="text-[7.5px] font-black uppercase tracking-widest text-amber-400">
                Card Terms & Safety
              </span>
              <span className="rounded bg-amber-400/10 px-1 py-0.5 text-[6px] font-bold text-amber-300 uppercase">
                Valid 2025-26
              </span>
            </div>
            <ul className="mt-2 space-y-1 text-[6.5px] leading-tight text-slate-300">
              <li className="flex items-start gap-1">
                <span className="text-amber-400">•</span>
                <span>Card must be worn at all times inside the campus premises.</span>
              </li>
              <li className="flex items-start gap-1">
                <span className="text-amber-400">•</span>
                <span>{backText}</span>
              </li>
            </ul>
          </div>

          <div className="space-y-1.5 rounded-lg bg-slate-800/80 p-2 text-[6.5px] ring-1 ring-slate-700/50">
            <div className="flex justify-between border-b border-slate-700/50 pb-1">
              <span className="uppercase text-slate-400">Guardian</span>
              <span className="font-bold text-slate-100 line-clamp-1">{guardianName}</span>
            </div>
            <div className="flex justify-between border-b border-slate-700/50 pb-1">
              <span className="uppercase text-slate-400">Emergency Mobile</span>
              <span className="font-mono font-bold text-amber-300">{guardianMobile}</span>
            </div>
            <div className="flex justify-between border-b border-slate-700/50 pb-1">
              <span className="uppercase text-slate-400">Blood Group</span>
              <span className="font-bold text-rose-400">O+</span>
            </div>
            <div className="pt-0.5">
              <span className="block uppercase text-slate-400">Address</span>
              <span className="font-medium text-slate-200 line-clamp-1">{address}</span>
            </div>
          </div>

          <div className="pt-1 text-center">
            <div className="flex items-center justify-between px-1">
              <div className="text-left">
                <div className="h-4 w-12 border-b border-dashed border-slate-600 font-serif text-[7px] italic text-amber-300">
                  Principal
                </div>
                <span className="text-[5.5px] uppercase tracking-wider text-slate-400">
                  Authorized Sig.
                </span>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded bg-white p-0.5 shadow-sm">
                <svg className="h-full w-full text-slate-900" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm8-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm13-2h3v2h-3v-2zm-3 2h2v3h-2v-3zm3 3h3v3h-3v-3zm-3 3h2v2h-2v-2z" />
                </svg>
              </div>
            </div>
            <p className="mt-1 text-[6px] font-mono tracking-widest text-slate-400">
              * {admissionNo} *
            </p>
          </div>
        </article>
      );
    }

    return (
      <article className="relative flex h-[85.6mm] w-[54mm] flex-col overflow-hidden rounded-[4mm] bg-slate-900 text-white shadow-2xl ring-1 ring-amber-400/30 shrink-0">
        <header className="relative bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 px-3.5 pb-6 pt-3 text-center">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500" />
          <div className="flex items-center justify-center gap-1.5">
            <svg className="h-4 w-4 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-amber-300">
              SM Public School
            </p>
          </div>
          <p className="mt-0.5 text-[6.5px] font-medium tracking-wider text-blue-200/80">
            EXCELLENCE IN EDUCATION • ESTD 2010
          </p>
        </header>

        <div className="relative z-10 mx-auto -mt-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 via-amber-200 to-amber-500 p-[2.5px] shadow-xl">
          {studentPhoto ? (
            <img
              src={studentPhoto}
              alt={studentName}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-800 text-2xl font-black text-amber-400">
              {studentName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white ring-2 ring-slate-900">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        <div className="flex-1 px-3.5 pt-2 text-center">
          <h1 className="text-xs font-black tracking-tight text-white line-clamp-1">
            {studentName}
          </h1>
          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2.5 py-0.5 ring-1 ring-amber-400/30">
            <span className="text-[7.5px] font-bold text-amber-300 uppercase tracking-wide">
              {className} — {sectionName}
            </span>
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-lg bg-slate-800/80 p-1.5 text-[7px] ring-1 ring-slate-700/50">
            <div className="text-left pl-1">
              <span className="block text-[6px] uppercase tracking-wider text-slate-400">
                Admission No
              </span>
              <span className="font-bold text-amber-200">{admissionNo}</span>
            </div>
            <div className="text-right pr-1">
              <span className="block text-[6px] uppercase tracking-wider text-slate-400">
                Family ID
              </span>
              <span className="font-bold text-blue-200">FAM-{familyNumber}</span>
            </div>
          </div>
        </div>

        <footer className="relative flex items-center justify-between border-t border-slate-800 bg-slate-950 px-3.5 py-2 text-[6.5px] font-semibold text-slate-400">
          <span className="uppercase tracking-wider text-amber-400/90">OFFICIAL ID</span>
          <span className="font-mono text-slate-500">RFID • 8092-A</span>
        </footer>
      </article>
    );
  }

  // 2. CLEAN WHITE PORTRAIT
  if (slug === "clean-white") {
    if (side === "back") {
      return (
        <article className="flex h-[85.6mm] w-[54mm] flex-col overflow-hidden rounded-[5mm] border-2 border-blue-700 bg-white text-slate-900 shadow-xl shrink-0">
          <div className="p-4 text-center">
            <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-blue-900">
              Student card verification
            </p>
            <div className="mx-auto mt-6 flex h-24 w-24 items-center justify-center border-4 border-blue-100 text-xs font-bold tracking-[0.2em] text-blue-800">
              QR
            </div>
            <p className="mt-2 text-[8px] font-semibold tracking-widest text-slate-700">
              {cardNumber}
            </p>
          </div>
          <div className="mt-auto border-t border-blue-100 px-4 py-4 text-center text-[8px] leading-4 text-slate-600">
            {backText}
          </div>
        </article>
      );
    }

    return (
      <article className="flex h-[85.6mm] w-[54mm] flex-col overflow-hidden rounded-[5mm] border-2 border-blue-700 bg-white text-slate-900 shadow-xl shrink-0">
        <div className="m-2 rounded-[3mm] border border-blue-100 px-3 py-4 text-center">
          <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-blue-900">
            Shabiran Mustafa Public School
          </p>
          <p className="mt-1 text-[7px] text-slate-500">Hindyari</p>
        </div>
        <div className="mx-auto mt-3 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-blue-100 bg-blue-50 text-2xl font-bold text-blue-800">
          {studentPhoto ? (
            <img src={studentPhoto} alt={studentName} className="h-full w-full object-cover" />
          ) : (
            studentName.slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="mt-4 flex-1 text-center">
          <div className="bg-blue-700 px-3 py-2 text-sm font-bold text-white">{studentName}</div>
          <p className="mt-3 text-[9px] text-slate-600">Student ID: {admissionNo}</p>
        </div>
        <footer className="px-3 py-3 text-center text-[7px] font-semibold uppercase tracking-wider text-blue-800">
          Student identity card
        </footer>
      </article>
    );
  }

  // 3. PRESTIGE GRADIENT
  if (slug === "prestige-gradient") {
    if (side === "back") {
      return (
        <article className="flex h-[85.6mm] w-[54mm] flex-col overflow-hidden rounded-[5mm] bg-gradient-to-br from-blue-950 via-blue-700 to-blue-400 p-3 text-white shadow-xl shrink-0">
          <div className="flex flex-1 flex-col items-center justify-center rounded-[3mm] bg-white p-4 text-center text-slate-900">
            <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-blue-950">
              Scan to verify
            </p>
            <div className="mt-5 flex h-24 w-24 items-center justify-center border-4 border-blue-100 text-xs font-bold tracking-[0.2em] text-blue-800">
              QR
            </div>
            <p className="mt-2 text-[8px] font-semibold tracking-widest text-slate-700">
              {cardNumber}
            </p>
            <p className="mt-5 text-[8px] leading-4 text-slate-600">
              Please return this card to Shabiran Mustafa Public School.
            </p>
          </div>
        </article>
      );
    }

    return (
      <article className="flex h-[85.6mm] w-[54mm] flex-col overflow-hidden rounded-[5mm] bg-gradient-to-br from-blue-950 via-blue-700 to-blue-400 p-3 text-white shadow-xl shrink-0">
        <div className="flex items-start justify-between px-1 py-2">
          <div>
            <p className="text-[8px] font-bold uppercase tracking-[0.14em]">Shabiran Mustafa</p>
            <p className="text-[7px] text-blue-100">Public School | Hindyari</p>
          </div>
          <span className="rounded-full border border-white/50 px-2 py-1 text-[6px] uppercase">
            Student
          </span>
        </div>
        <div className="mt-3 flex flex-1 flex-col justify-end rounded-[3mm] bg-white p-3 text-slate-900">
          <div className="-mt-12 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-blue-100 text-2xl font-bold text-blue-800 shadow">
            {studentPhoto ? (
              <img src={studentPhoto} alt={studentName} className="h-full w-full object-cover" />
            ) : (
              studentName.slice(0, 1).toUpperCase()
            )}
          </div>
          <h1 className="mt-3 text-sm font-bold text-blue-950">{studentName}</h1>
          <p className="mt-1 text-[9px] text-slate-600">{admissionNo}</p>
        </div>
      </article>
    );
  }

  // 4. ROYAL BLUE LANDSCAPE
  if (slug === "royal-blue-landscape") {
    if (side === "back") {
      return (
        <article className="flex h-[54mm] w-[85.6mm] overflow-hidden rounded-[5mm] bg-white text-slate-900 shadow-xl ring-1 ring-blue-200 shrink-0">
          <div className="flex w-2/5 flex-col items-center justify-center bg-blue-50">
            <div className="flex h-20 w-20 items-center justify-center border-4 border-blue-200 text-xs font-bold tracking-[0.2em] text-blue-800">
              QR
            </div>
            <p className="mt-2 text-[8px] font-semibold tracking-widest">{cardNumber}</p>
          </div>
          <div className="flex flex-1 items-center p-5 text-[8px] leading-4 text-slate-600">
            {backText}
          </div>
        </article>
      );
    }

    return (
      <article className="flex h-[54mm] w-[85.6mm] overflow-hidden rounded-[5mm] bg-white text-slate-900 shadow-xl ring-1 ring-blue-200 shrink-0">
        <div className="w-2/5 bg-blue-950 p-4 text-white">
          <p className="text-[8px] font-bold uppercase tracking-[0.12em]">Shabiran Mustafa</p>
          <div className="mt-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-xl font-bold text-blue-800">
            {studentPhoto ? (
              <img src={studentPhoto} alt={studentName} className="h-full w-full object-cover" />
            ) : (
              studentName.slice(0, 1).toUpperCase()
            )}
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-center p-4">
          <p className="text-[7px] uppercase tracking-wider text-blue-700">
            Student identity card
          </p>
          <h1 className="mt-2 text-sm font-bold text-blue-950">{studentName}</h1>
          <p className="mt-1 text-[9px] text-slate-600">{admissionNo}</p>
        </div>
      </article>
    );
  }

  // 5. CLEAN WHITE LANDSCAPE
  if (slug === "clean-white-landscape") {
    if (side === "back") {
      return (
        <article className="flex h-[54mm] w-[85.6mm] overflow-hidden rounded-[5mm] border-2 border-blue-700 bg-white text-slate-900 shadow-xl shrink-0">
          <div className="flex flex-1 flex-col justify-center p-5 text-[8px] leading-4 text-slate-600">
            {backText}
          </div>
          <div className="flex w-1/3 flex-col items-center justify-center bg-blue-50">
            <div className="flex h-20 w-20 items-center justify-center border-4 border-blue-200 text-xs font-bold tracking-[0.2em] text-blue-800">
              QR
            </div>
            <p className="mt-2 text-[8px] font-semibold tracking-widest">{cardNumber}</p>
          </div>
        </article>
      );
    }

    return (
      <article className="flex h-[54mm] w-[85.6mm] overflow-hidden rounded-[5mm] border-2 border-blue-700 bg-white text-slate-900 shadow-xl shrink-0">
        <div className="flex w-1/3 items-center justify-center bg-blue-50">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-blue-100 text-xl font-bold text-blue-800">
            {studentPhoto ? (
              <img src={studentPhoto} alt={studentName} className="h-full w-full object-cover" />
            ) : (
              studentName.slice(0, 1).toUpperCase()
            )}
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-center p-5">
          <p className="text-[7px] font-bold uppercase tracking-wider text-blue-800">
            Shabiran Mustafa Public School
          </p>
          <h1 className="mt-3 text-sm font-bold text-blue-950">{studentName}</h1>
          <p className="mt-1 text-[9px] text-slate-600">{admissionNo}</p>
        </div>
      </article>
    );
  }

  // 6. STAFF ROYAL BLUE
  if (slug === "staff-royal-blue" || template.template_type === "staff") {
    if (side === "back") {
      return (
        <article className="flex h-[85.6mm] w-[54mm] flex-col overflow-hidden rounded-[5mm] bg-white text-slate-900 shadow-xl ring-1 ring-blue-200 shrink-0">
          <div className="bg-blue-950 px-4 py-5 text-white">
            <p className="text-[8px] font-semibold uppercase tracking-[0.18em]">
              Staff verification
            </p>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="flex h-24 w-24 items-center justify-center border-4 border-blue-100 text-xs font-bold tracking-[0.2em] text-blue-800">
              QR
            </div>
            <p className="mt-2 text-[8px] font-semibold tracking-widest text-slate-700">
              {cardNumber}
            </p>
          </div>
          <footer className="bg-blue-50 px-4 py-3 text-center text-[7px] text-blue-800">
            School office: Hindyari
          </footer>
        </article>
      );
    }

    return (
      <article className="flex h-[85.6mm] w-[54mm] flex-col overflow-hidden rounded-[5mm] bg-white text-slate-900 shadow-xl ring-1 ring-blue-200 shrink-0">
        <header className="bg-blue-950 px-4 py-6 text-white">
          <p className="text-[8px] font-semibold uppercase tracking-[0.18em]">
            Shabiran Mustafa Public School
          </p>
          <p className="mt-1 text-[7px] text-blue-100">Staff identification</p>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-2xl font-bold text-blue-800">
            {teacherPhoto ? (
              <img src={teacherPhoto} alt={teacherName} className="h-full w-full object-cover" />
            ) : (
              teacherName.slice(0, 1).toUpperCase()
            )}
          </div>
          <h1 className="mt-4 text-sm font-bold text-blue-950">{teacherName}</h1>
          <p className="mt-1 text-[9px] text-slate-600">{employeeNo}</p>
        </div>
        <footer className="bg-blue-50 px-4 py-3 text-center text-[7px] font-semibold uppercase tracking-wider text-blue-800">
          Authorized staff
        </footer>
      </article>
    );
  }

  // 7. ROYAL BLUE (Default fallback)
  if (side === "back") {
    return (
      <article className="flex h-[85.6mm] w-[54mm] flex-col overflow-hidden rounded-[5mm] bg-white text-slate-900 shadow-xl ring-1 ring-blue-200 shrink-0">
        <div className="bg-blue-950 px-4 py-5 text-white">
          <p className="text-[8px] font-semibold uppercase tracking-[0.18em]">Card information</p>
          <p className="mt-1 text-[7px] text-blue-100">
            Property of Shabiran Mustafa Public School
          </p>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
          <div className="flex h-24 w-24 items-center justify-center border-4 border-blue-100 bg-white text-xs font-bold tracking-[0.2em] text-blue-800">
            QR
          </div>
          <p className="mt-2 text-[8px] font-semibold tracking-widest text-slate-700">
            {cardNumber}
          </p>
          {showSessionValidity && (
            <p className="mt-5 text-[8px] text-slate-500">
              Valid for the current academic session
            </p>
          )}
          <p className="mt-4 text-[8px] leading-4 text-slate-600">{backText}</p>
        </div>
        <footer className="bg-blue-50 px-4 py-3 text-center text-[7px] font-semibold text-blue-800">
          Emergency contact: school office
        </footer>
      </article>
    );
  }

  return (
    <article className="flex h-[85.6mm] w-[54mm] flex-col overflow-hidden rounded-[5mm] bg-white text-slate-900 shadow-xl ring-1 ring-blue-200 shrink-0">
      <header className="relative bg-blue-950 px-4 pb-8 pt-5 text-white">
        <div className="absolute -bottom-7 left-0 h-14 w-full rounded-[50%] bg-blue-700" />
        <p className="relative text-[8px] font-semibold uppercase tracking-[0.18em]">
          Shabiran Mustafa Public School
        </p>
        <p className="relative mt-1 text-[7px] text-blue-100">Hindyari | {tagline}</p>
      </header>
      <div className="relative z-10 mx-auto -mt-6 flex h-20 w-20 items-center justify-center rounded-full bg-white p-1 shadow-md">
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-blue-100 text-2xl font-bold text-blue-800">
          {studentPhoto ? (
            <img src={studentPhoto} alt={studentName} className="h-full w-full object-cover" />
          ) : (
            studentName.slice(0, 1).toUpperCase()
          )}
        </div>
      </div>
      <div className="flex-1 px-4 pt-3 text-center">
        <h1 className="text-sm font-bold text-blue-950">{studentName}</h1>
        <p className="mt-1 text-[9px] text-slate-500">Student ID: {admissionNo}</p>
        {showFamilyNumber && (
          <p className="mt-2 text-[8px] text-slate-600">Family {familyNumber}</p>
        )}
      </div>
      <footer className="bg-blue-50 px-4 py-3 text-center text-[7px] font-semibold uppercase tracking-wider text-blue-800">
        Student identity card
      </footer>
    </article>
  );
}
