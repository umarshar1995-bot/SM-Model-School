import React from "react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { toBigIntId } from "@/lib/serialize";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { formatCurrency, formatDate, numberToWords } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PrintFeeReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ paymentId: string }>;
  searchParams: Promise<{ autoprint?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const { paymentId } = await params;
  const sp = await searchParams;

  let pid: bigint;
  try {
    pid = toBigIntId(paymentId);
  } catch {
    notFound();
  }

  const payment = await prisma.fee_payments.findFirst({
    where: { id: pid, deleted_at: null },
    include: {
      users: { select: { id: true, name: true } },
      users_fee_payments_reversed_by_user_idTousers: {
        select: { id: true, name: true },
      },
      family_fee_challans: {
        include: {
          families: true,
          academic_sessions: true,
          student_fees: {
            where: { deleted_at: null },
            include: {
              fee_types: true,
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
            orderBy: { id: "asc" },
          },
        },
      },
    },
  });

  if (!payment || !payment.family_fee_challans) {
    notFound();
  }

  const challan = payment.family_fee_challans;
  const family = challan.families;
  const isReversed = payment.status === "reversed";
  const amountPaid = Number(payment.amount_paid);
  const amountWords = numberToWords(amountPaid);
  const totalPayable = Number(challan.payable_before_due);
  const totalPaidToDate = Number(challan.paid_amount);
  const remainingDue = Math.max(0, totalPayable - totalPaidToDate);

  const paymentTimestamp = payment.created_at ?? payment.payment_date;
  const formattedTime = paymentTimestamp
    ? new Date(paymentTimestamp).toLocaleTimeString("en-PK", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const collectorName = payment.users?.name ?? "Authorized Cashier";
  const reversedByName =
    payment.users_fee_payments_reversed_by_user_idTousers?.name ??
    "Administrator";

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 text-slate-900">
      <style>{`
        @page { size: A4 portrait; margin: 12mm; }
        @media print {
          body { background: #ffffff !important; }
          .receipt-card { box-shadow: none !important; border-color: #cbd5e1 !important; }
        }
      `}</style>

      <PrintToolbar
        title={isReversed ? "Official Fee Receipt (REVERSED)" : "Official Fee Payment Receipt"}
        subtitle={`Receipt ${payment.receipt_no} • ${family.guardian_name} (FAM-${Number(family.family_number)})`}
        actionLabel="Print Official Receipt"
        autoprint={sp.autoprint === "1" || sp.autoprint === "true"}
        maxWidthClass="max-w-[780px]"
      />

      <main className="receipt-card relative mx-auto max-w-[780px] overflow-hidden rounded-2xl border border-slate-300 bg-white p-8 shadow-lg">
        {/* Bold diagonal REVERSED watermark when payment is reversed */}
        {isReversed && (
          <div
            aria-label="Payment Reversed Watermark"
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden"
          >
            <div className="-rotate-25 select-none rounded-2xl border-[6px] border-rose-600/45 px-10 py-4 text-6xl font-black uppercase tracking-[0.25em] text-rose-600/35">
              REVERSED
            </div>
          </div>
        )}

        <div className="relative z-10 space-y-6">
          {/* Header */}
          <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-blue-950 pb-5">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-950 text-lg font-black text-amber-300">
                SM
              </div>
              <div>
                <h1 className="text-xl font-black uppercase tracking-tight text-blue-950">
                  Shabeeran Mustafa Public School
                </h1>
                <p className="text-sm font-medium text-slate-500">
                  Airport Road, Sector 7, Sukkur • Tel: 071-5802914
                </p>
              </div>
            </div>

            <div className="text-right">
              <span
                className={`inline-block rounded-lg px-3 py-1 text-xs font-black uppercase tracking-widest ${
                  isReversed
                    ? "bg-rose-100 text-rose-800 border border-rose-300"
                    : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                }`}
              >
                {isReversed ? "REVERSED RECEIPT" : "OFFICIAL FEE RECEIPT"}
              </span>
              <p className="mt-2 font-mono text-lg font-black text-blue-950">
                {payment.receipt_no}
              </p>
              <p className="text-xs font-semibold text-slate-500">
                Date: {formatDate(payment.payment_date)}
                {formattedTime ? ` • ${formattedTime}` : ""}
              </p>
            </div>
          </header>

          {/* Reversal Banner */}
          {isReversed && (
            <section className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="font-black uppercase tracking-wide text-rose-800">
                  Notice: This payment receipt has been REVERSED
                </strong>
                <span className="font-mono text-xs font-bold text-rose-700">
                  Reversed on {formatDate(payment.reversed_at)} by {reversedByName}
                </span>
              </div>
              <p className="mt-1.5 text-sm font-medium text-rose-800">
                <strong>Reason:</strong> {payment.reversal_reason ?? "No reason recorded."}
              </p>
            </section>
          )}

          {/* Family & Payment Metadata Grid */}
          <section className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-2">
            <div className="space-y-1.5 text-sm">
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Received From
              </p>
              <p className="text-base font-black text-slate-900">
                {family.guardian_name}
              </p>
              <p className="text-sm font-semibold text-slate-600">
                Family ID:{" "}
                <span className="font-mono font-black text-indigo-700">
                  FAM-{Number(family.family_number)}
                </span>
                {family.guardian_mobile ? ` • ${family.guardian_mobile}` : ""}
              </p>
              <p className="text-sm text-slate-600">
                Challan #:{" "}
                <span className="font-mono font-bold text-slate-900">
                  {challan.challan_no}
                </span>{" "}
                ({challan.billing_month})
              </p>
            </div>

            <div className="space-y-1.5 text-sm sm:text-right">
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Payment Details
              </p>
              <p className="text-base font-bold text-slate-900">
                Method: {payment.payment_method}
              </p>
              <p className="text-sm text-slate-600">
                Reference:{" "}
                <span className="font-mono font-bold text-slate-800">
                  {payment.transaction_reference || "Counter Cash"}
                </span>
              </p>
              <p className="text-sm text-slate-600">
                Collected By:{" "}
                <strong className="text-slate-900">{collectorName}</strong>
              </p>
            </div>
          </section>

          {/* Highlighted Amount Paid Box */}
          <section
            className={`rounded-xl border-2 p-5 ${
              isReversed
                ? "border-rose-200 bg-rose-50/50"
                : "border-emerald-200 bg-emerald-50/60"
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-xs font-extrabold uppercase tracking-widest text-slate-500">
                {isReversed ? "Original Amount (Reversed)" : "Amount Received"}
              </span>
              <span
                className={`font-mono text-3xl font-black ${
                  isReversed
                    ? "text-rose-700 line-through"
                    : "text-emerald-700"
                }`}
              >
                {formatCurrency(amountPaid)}
              </span>
            </div>
            <p className="mt-2 border-t border-slate-200/80 pt-2 text-sm font-semibold text-slate-700">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                In Words:{" "}
              </span>
              <span className="italic">{amountWords}</span>
            </p>
            {payment.remarks && (
              <p className="mt-1 text-xs text-slate-600">
                <strong>Remarks:</strong> {payment.remarks}
              </p>
            )}
          </section>

          {/* Itemized Fee Breakdown on This Challan */}
          <section>
            <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Challan Fee Breakdown ({challan.billing_month})
            </h2>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs font-extrabold uppercase text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5">Student & Class</th>
                    <th className="px-4 py-2.5">Fee Head</th>
                    <th className="px-4 py-2.5 text-right">Gross</th>
                    <th className="px-4 py-2.5 text-right">Disc.</th>
                    <th className="px-4 py-2.5 text-right">Arrears</th>
                    <th className="px-4 py-2.5 text-right">Net Payable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {challan.student_fees.map((sf) => {
                    const enr = sf.students.student_enrollments[0];
                    return (
                      <tr key={Number(sf.id)}>
                        <td className="px-4 py-2.5">
                          <p className="font-bold text-slate-900">
                            {sf.students.full_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {enr?.school_classes?.name ?? "Class"}{" "}
                            {enr?.class_sections?.name
                              ? `(${enr.class_sections.name})`
                              : ""}
                          </p>
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-blue-900">
                          {sf.fee_type}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">
                          {formatCurrency(Number(sf.amount))}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-emerald-700">
                          {Number(sf.concession_amount) > 0
                            ? `- ${formatCurrency(Number(sf.concession_amount))}`
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-rose-700">
                          {Number(sf.arrears_amount) > 0
                            ? `+ ${formatCurrency(Number(sf.arrears_amount))}`
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(Number(sf.net_payable))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Challan Balance Summary */}
          <section className="grid grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">
                Challan Total
              </p>
              <p className="mt-1 font-mono text-base font-black text-slate-900">
                {formatCurrency(totalPayable)}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">
                Total Paid to Date
              </p>
              <p className="mt-1 font-mono text-base font-black text-emerald-700">
                {formatCurrency(totalPaidToDate)}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">
                Remaining Balance
              </p>
              <p
                className={`mt-1 font-mono text-base font-black ${
                  remainingDue > 0 ? "text-rose-700" : "text-emerald-700"
                }`}
              >
                {formatCurrency(remainingDue)}
              </p>
            </div>
          </section>

          {/* Signatures & Verification Footer */}
          <footer className="pt-8">
            <div className="grid grid-cols-2 gap-12 text-center text-xs">
              <div className="border-t border-slate-400 pt-2">
                <p className="font-bold text-slate-700">Guardian / Depositor Signature</p>
              </div>
              <div className="border-t border-slate-400 pt-2">
                <p className="font-bold text-slate-700">
                  Authorized Accounts Officer ({collectorName})
                </p>
              </div>
            </div>
            <p className="mt-6 text-center text-xs text-slate-400">
              System-generated official receipt • Receipt #{payment.receipt_no} • Retain for your records.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
