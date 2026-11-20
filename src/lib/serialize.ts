export function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => {
      if (typeof v === "bigint") {
        const n = Number(v);
        return Number.isSafeInteger(n) ? n : v.toString();
      }
      if (v && typeof v === "object" && typeof v.toNumber === "function") {
        return v.toNumber();
      }
      return v;
    }),
  );
}

export function toBigIntId(id: string | number | bigint): bigint {
  if (typeof id === "bigint") return id;
  if (typeof id === "number") return BigInt(Math.trunc(id));
  const cleaned = id.trim();
  if (!/^\d+$/.test(cleaned)) {
    throw new Error(`Invalid numeric ID: ${id}`);
  }
  return BigInt(cleaned);
}
