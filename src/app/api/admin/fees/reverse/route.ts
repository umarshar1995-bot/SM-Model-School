import { NextRequest } from "next/server";
import { z } from "zod";
import {
  jsonError,
  jsonOk,
  requireAdministrator,
} from "@/lib/api-helpers";
import { toBigIntId } from "@/lib/serialize";
import {
  FeeValidationError,
  reverseChallanPayment,
} from "@/lib/fee-service";
import { getClientIp } from "@/lib/audit";

const reverseSchema = z.object({
  paymentId: z.union([z.number(), z.string()]),
  reason: z.string().trim().min(10, "Reversal reason must be at least 10 characters."),
});

export async function POST(request: NextRequest) {
  const { user, error } = await requireAdministrator(
    request,
    "fee_payment_reverse",
  );
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = reverseSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        parsed.error.issues[0]?.message ?? "Invalid reversal payload.",
        422,
      );
    }

    const payment = await reverseChallanPayment({
      paymentId: toBigIntId(parsed.data.paymentId),
      reason: parsed.data.reason,
      actor: {
        id: user.id,
        name: user.name,
        ipAddress: getClientIp(request),
      },
    });

    return jsonOk({
      message: `Payment ${payment.receipt_no} has been reversed and the challan balance updated.`,
      payment,
    });
  } catch (err) {
    if (err instanceof FeeValidationError) {
      return jsonError(err.message, err.status);
    }
    return jsonError(
      err instanceof Error ? err.message : "Failed to reverse payment.",
      500,
    );
  }
}
