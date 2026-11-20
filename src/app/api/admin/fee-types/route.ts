import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonOk, requireApiUser } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const { error } = await requireApiUser("ViewAny:Fee", request);
  if (error) return error;

  const feeTypes = await prisma.fee_types.findMany({
    where: { is_active: true },
    orderBy: { sort_order: "asc" },
  });

  return jsonOk({ feeTypes });
}
