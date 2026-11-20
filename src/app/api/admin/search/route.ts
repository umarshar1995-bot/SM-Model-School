import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonOk, requireApiUser } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const { error } = await requireApiUser();
  if (error) return error;

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return jsonOk({ results: [] });
  }

  const numericQ = /^\d+$/.test(q) ? BigInt(q) : null;

  const [students, families, teachers, challans] = await Promise.all([
    prisma.students.findMany({
      where: {
        deleted_at: null,
        OR: [
          { full_name: { contains: q, mode: "insensitive" } },
          { admission_no: { contains: q, mode: "insensitive" } },
          { b_form_no: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { families: true },
      take: 6,
    }),
    prisma.families.findMany({
      where: {
        deleted_at: null,
        OR: [
          { guardian_name: { contains: q, mode: "insensitive" } },
          { guardian_mobile: { contains: q, mode: "insensitive" } },
          ...(numericQ ? [{ family_number: numericQ }] : []),
        ],
      },
      take: 5,
    }),
    prisma.teachers.findMany({
      where: {
        deleted_at: null,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { employee_no: { contains: q, mode: "insensitive" } },
          { mobile: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
    }),
    prisma.family_fee_challans.findMany({
      where: {
        deleted_at: null,
        OR: [
          { challan_no: { contains: q, mode: "insensitive" } },
          { billing_month: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { families: true },
      take: 5,
    }),
  ]);

  const results = [
    ...students.map((s) => ({
      type: "student" as const,
      id: Number(s.id),
      title: s.full_name,
      subtitle: `${s.admission_no ?? "No Adm #"} • Guardian: ${s.families?.guardian_name ?? "—"}`,
      href: `/admin/classes-and-sections?studentId=${s.id}`,
    })),
    ...families.map((f) => ({
      type: "family" as const,
      id: Number(f.id),
      title: f.guardian_name,
      subtitle: `FAM-${f.family_number} • ${f.guardian_mobile ?? "No mobile"}`,
      href: `/admin/families?q=${encodeURIComponent(String(f.family_number))}`,
    })),
    ...teachers.map((t) => ({
      type: "teacher" as const,
      id: Number(t.id),
      title: t.name,
      subtitle: `${t.employee_no ?? "No Emp #"} • ${t.status}`,
      href: `/admin/teachers?q=${encodeURIComponent(t.name)}`,
    })),
    ...challans.map((c) => ({
      type: "challan" as const,
      id: Number(c.id),
      title: c.challan_no,
      subtitle: `${c.billing_month} • ${c.families?.guardian_name ?? "Family"} • ${c.status}`,
      href: `/admin/fees-console?q=${encodeURIComponent(c.challan_no)}`,
    })),
  ];

  return jsonOk({ results });
}
