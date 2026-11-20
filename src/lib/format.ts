import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function normalizeMobile(mobile?: string | null): string | null {
  if (!mobile || mobile.trim() === "") {
    return null;
  }

  const value = mobile.trim().toUpperCase();
  if (value.includes("X")) {
    return "92XXXXXXXXXXX";
  }

  let digits = value.replace(/\D+/g, "");
  if (!digits) {
    return null;
  }

  digits = digits.replace(/^00/, "");

  if (digits.startsWith("92")) {
    return digits;
  }
  if (digits.startsWith("0")) {
    return "92" + digits.slice(1);
  }
  return "92" + digits;
}

export function formatCurrency(amount: number | string | null | undefined): string {
  const num = Number(amount ?? 0);
  if (Number.isNaN(num)) return "Rs. 0";
  return `Rs. ${Math.round(num).toLocaleString("en-PK")}`;
}

export function formatNumber(amount: number | string | null | undefined): string {
  const num = Number(amount ?? 0);
  if (Number.isNaN(num)) return "0";
  return Math.round(num).toLocaleString("en-PK");
}

export function formatDate(value?: string | Date | null, long = false): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: long ? "long" : "short",
    year: "numeric",
  });
}

export function formatDateInput(value?: string | Date | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function formatDateOrdinal(value?: string | Date | null): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = date.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  const month = date.toLocaleDateString("en-US", { month: "long" });
  return `${day}${suffix} day of ${month}, ${date.getFullYear()}`;
}

export function getInitials(name?: string | null, length = 2): string {
  if (!name) return "SM";
  const trimmed = name.trim();
  if (!trimmed) return "SM";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2 && length === 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, length).toUpperCase();
}

export function photoUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/")) {
    return path;
  }
  return `/uploads/${path}`;
}

export function numberToWords(input: number): string {
  let num = Math.max(0, Math.round(input));
  if (num === 0) {
    return "Zero Rupees Only";
  }

  const ones: Record<number, string> = {
    1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five",
    6: "Six", 7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten",
    11: "Eleven", 12: "Twelve", 13: "Thirteen", 14: "Fourteen",
    15: "Fifteen", 16: "Sixteen", 17: "Seventeen", 18: "Eighteen",
    19: "Nineteen",
  };

  const tens: Record<number, string> = {
    2: "Twenty", 3: "Thirty", 4: "Forty", 5: "Fifty",
    6: "Sixty", 7: "Seventy", 8: "Eighty", 9: "Ninety",
  };

  const helper = (n: number): string => {
    if (n < 20) return ones[n] ?? "";
    const t = Math.floor(n / 10);
    const o = n % 10;
    return `${tens[t] ?? ""}${o > 0 ? " " + (ones[o] ?? "") : ""}`;
  };

  const words: string[] = [];

  if (num >= 10000000) {
    words.push(`${helper(Math.floor(num / 10000000))} Crore`);
    num %= 10000000;
  }
  if (num >= 100000) {
    words.push(`${helper(Math.floor(num / 100000))} Lakh`);
    num %= 100000;
  }
  if (num >= 1000) {
    words.push(`${helper(Math.floor(num / 1000))} Thousand`);
    num %= 1000;
  }
  if (num >= 100) {
    words.push(`${helper(Math.floor(num / 100))} Hundred`);
    num %= 100;
  }
  if (num > 0) {
    words.push(helper(num));
  }

  return `Rupees ${words.join(" ")} Only`;
}

export function getCurrentBillingMonth(date = new Date()): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
