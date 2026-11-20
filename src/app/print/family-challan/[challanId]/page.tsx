import React from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toBigIntId } from "@/lib/serialize";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { formatDate, formatNumber, numberToWords } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PrintFamilyChallanPage({
  params,
  searchParams,
}: {
  params: Promise<{ challanId: string }>;
  searchParams: Promise<{ autoprint?: string }>;
}) {
  const { challanId } = await params;
  const sp = await searchParams;

  let cid: bigint;
  try {
    cid = toBigIntId(challanId);
  } catch {
    notFound();
  }

  const challan = await prisma.family_fee_challans.findFirst({
    where: { id: cid, deleted_at: null },
    include: {
      families: true,
      student_fees: {
        where: { deleted_at: null },
        include: {
          students: {
            include: {
              student_enrollments: {
                where: { deleted_at: null },
                orderBy: { id: "desc" },
                take: 1,
                include: { school_classes: true, class_sections: true },
              },
            },
          },
        },
      },
    },
  });

  if (!challan) notFound();

  const payableBeforeDue = Number(challan.payable_before_due);
  const amountWords = numberToWords(payableBeforeDue);

  const copies = [
    { title: "BANK COPY", bg: "bg-blue-900" },
    { title: "SCHOOL COPY", bg: "bg-indigo-900" },
    { title: "PARENT / STUDENT COPY", bg: "bg-slate-900" },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 py-4 px-2">
      <style>{`
        @page { size: A4 landscape; margin: 5mm; }
        @media print {
          .challan-column { border-right: 1px dashed #94a3b8 !important; }
          .challan-column:last-child { border-right: none !important; }
        }
      `}</style>

      <PrintToolbar
        title="Family Fee Challan (3-Part Bank Slip)"
        subtitle={`Challan: ${challan.challan_no} • Family: ${challan.families.guardian_name} (FAM-${challan.families.family_number})`}
        actionLabel="Print 3-Part Challan"
        autoprint={sp.autoprint === "1" || sp.autoprint === "true"}
        maxWidthClass="max-w-[1120px]"
      />

      <main className="w-[287mm] max-w-[1120px] mx-auto bg-white rounded-xl shadow-lg border border-slate-300 p-2 grid grid-cols-3 divide-x divide-dashed divide-slate-300">
        {copies.map((copy) => (
          <div
            key={copy.title}
            className="challan-column flex flex-col justify-between px-3 py-2 text-[10px] leading-tight"
          >
            <div>
              {/* Institution Header */}
              <header className="text-center border-b border-slate-200 pb-1.5 mb-1.5">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-blue-950 text-amber-300 flex items-center justify-center font-black text-[9px]">
                    SM
                  </span>
                  <h2 className="font-black text-xs text-blue-950 uppercase tracking-wider">
                    SM PUBLIC SCHOOL
                  </h2>
                </div>
                <p className="text-[8px] text-slate-500 font-medium">
                  Airport Road, Sector 7, Sukkur • Tel: 071-5802914
                </p>

                <div className="mt-1 flex items-center justify-between text-[8px] bg-slate-50 px-2 py-0.5 rounded border border-slate-200 font-mono">
                  <span>
                    HBL A/C: <strong>0184-7901234-01</strong>
                  </span>
                  <span>
                    Meezan: <strong>0291-8840192-02</strong>
                  </span>
                </div>

                <div className="mt-1 text-center">
                  <span
                    className={`inline-block ${copy.bg} text-white text-[9px] font-black uppercase tracking-widest px-3 py-0.5 rounded`}
                  >
                    {copy.title}
                  </span>
                </div>
              </header>

              {/* Challan Metadata */}
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 bg-blue-50/40 p-2 rounded border border-blue-100 text-[9px] mb-2">
                <div>
                  <span className="text-slate-400 block text-[8px] uppercase font-bold">
                    Challan No
                  </span>
                  <strong className="font-mono text-blue-950 text-[10px]">
                    {challan.challan_no}
                  </strong>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[8px] uppercase font-bold">
                    Billing Month
                  </span>
                  <strong className="text-slate-900 font-bold">
                    {challan.billing_month}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[8px] uppercase font-bold">
                    Issue Date
                  </span>
                  <span className="text-slate-800">{formatDate(challan.issue_date)}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[8px] uppercase font-bold">
                    Due Date
                  </span>
                  <strong className="text-rose-700 font-bold">
                    {formatDate(challan.due_date)}
                  </strong>
                </div>
                <div className="col-span-2 pt-0.5 border-t border-blue-200/60 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 text-[8px] uppercase font-bold">
                      Guardian:{" "}
                    </span>
                    <strong className="text-slate-900">
                      {challan.families.guardian_name}
                    </strong>
                  </div>
                  <span className="font-mono font-black text-indigo-700 text-[9px]">
                    FAM-{Number(challan.families.family_number)}
                  </span>
                </div>
              </div>

              {/* Itemized Sibling Table */}
              <div className="mb-2">
                <table className="w-full text-left text-[8.5px] border border-slate-300 rounded overflow-hidden">
                  <thead className="bg-slate-100 text-[8px] font-bold text-slate-700 uppercase border-b border-slate-300">
                    <tr>
                      <th className="p-1">Student / Class</th>
                      <th className="p-1 text-right">Gross</th>
                      <th className="p-1 text-right">Disc.</th>
                      <th className="p-1 text-right">Arrears</th>
                      <th className="p-1 text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {challan.student_fees.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-2 text-center text-slate-400">
                          No student fees attached
                        </td>
                      </tr>
                    ) : (
                      challan.student_fees.map((sf) => {
                        const enr = sf.students.student_enrollments[0];
                        return (
                          <tr key={Number(sf.id)}>
                            <td className="p-1">
                              <strong className="text-slate-900 block">
                                {sf.students.full_name}
                              </strong>
                              <span className="text-[7.5px] text-blue-800 font-bold block">
                                {sf.fee_type}
                              </span>
                              <span className="text-[7.5px] text-slate-500 font-mono">
                                {enr?.school_classes?.name ?? "Class"} (
                                {enr?.class_sections?.name ?? "Sec"}) • R#
                                {enr?.roll_no ?? "—"}
                              </span>
                            </td>
                            <td className="p-1 text-right font-mono">
                              {formatNumber(Number(sf.amount))}
                            </td>
                            <td className="p-1 text-right font-mono text-emerald-700">
                              {Number(sf.concession_amount) > 0
                                ? `-${formatNumber(Number(sf.concession_amount))}`
                                : "0"}
                            </td>
                            <td
                              className={`p-1 text-right font-mono ${
                                Number(sf.arrears_amount) > 0
                                  ? "text-rose-700 font-bold"
                                  : "text-slate-400"
                              }`}
                            >
                              {formatNumber(Number(sf.arrears_amount))}
                            </td>
                            <td className="p-1 text-right font-mono font-bold text-slate-900">
                              {formatNumber(Number(sf.net_payable))}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div className="bg-slate-50 p-2 rounded border border-slate-200 text-[8.5px] space-y-0.5 mb-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Gross Charges:</span>
                  <span className="font-mono">
                    Rs. {formatNumber(Number(challan.total_gross))}
                  </span>
                </div>
                {Number(challan.total_concession) > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Sibling Concessions:</span>
                    <span className="font-mono">
                      - Rs. {formatNumber(Number(challan.total_concession))}
                    </span>
                  </div>
                )}
                {Number(challan.total_arrears) > 0 && (
                  <div className="flex justify-between text-rose-700 font-bold">
                    <span>Previous Unpaid Arrears:</span>
                    <span className="font-mono">
                      + Rs. {formatNumber(Number(challan.total_arrears))}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-slate-300 font-black text-[9.5px] text-blue-950">
                  <span>PAYABLE BEFORE DUE DATE:</span>
                  <span className="font-mono text-blue-900">
                    Rs. {formatNumber(payableBeforeDue)}
                  </span>
                </div>
                <div className="flex justify-between text-[8px] text-slate-500">
                  <span>Late Fee Surcharge:</span>
                  <span className="font-mono">
                    + Rs. {formatNumber(Number(challan.late_fine))}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-rose-800 text-[9px]">
                  <span>PAYABLE AFTER DUE DATE:</span>
                  <span className="font-mono">
                    Rs. {formatNumber(Number(challan.payable_after_due))}
                  </span>
                </div>
              </div>

              {/* Amount in Words */}
              <div className="p-1.5 rounded bg-amber-50/70 border border-amber-200 text-[8px] text-slate-800 mb-2">
                <span className="font-bold text-amber-900">In Words: </span>
                <span className="italic font-medium">{amountWords}</span>
              </div>
            </div>

            {/* Footer Signatures */}
            <div className="pt-2 border-t border-slate-200 mt-2">
              <p className="text-[7.5px] text-slate-400 text-center mb-4">
                Deposit at any online branch of designated banks or school cash counter.
              </p>
              <div className="grid grid-cols-2 gap-4 text-center text-[8px]">
                <div className="border-t border-slate-400 pt-1">
                  <span className="text-slate-600 block font-semibold">
                    Depositor Signature
                  </span>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <span className="text-slate-600 block font-semibold">
                    Bank Cashier / Stamp
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
