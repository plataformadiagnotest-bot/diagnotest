import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtMoney(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0 });
}

export function fmtMoneySign(n: number) {
  return "$" + fmtMoney(n);
}

export function fmtPct(n: number) {
  return n.toFixed(1) + "%";
}

export function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
