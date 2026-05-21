import { cn } from "@/lib/utils/format";
import type { ReactNode } from "react";

type Accent = "default" | "warn" | "danger" | "blue" | "purple" | "green";

const accentBar: Record<Accent, string> = {
  default: "bg-g500",
  warn: "bg-amber",
  danger: "bg-red-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  green: "bg-g600",
};

interface Props {
  label: string;
  value: ReactNode;
  sub?: string;
  badge?: ReactNode;
  accent?: Accent;
  className?: string;
}

export function StatCard({ label, value, sub, badge, accent = "default", className }: Props) {
  return (
    <div className={cn("bg-white rounded-[14px] border border-gy200 shadow-sm p-4 relative overflow-hidden", className)}>
      <div className={cn("absolute top-0 left-0 right-0 h-0.5", accentBar[accent])} />
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gy400 mb-1.5">
        {label}
      </div>
      <div className="text-2xl font-bold text-gy900 leading-none mb-1">{value}</div>
      {sub && <div className="text-[11px] text-gy400">{sub}</div>}
      {badge && <div className="mt-1.5">{badge}</div>}
    </div>
  );
}
