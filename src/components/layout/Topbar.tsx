"use client";

import { SyncIndicator } from "@/components/offline/SyncIndicator";
import type { ReactNode } from "react";

interface Props {
  title: string;
  actions?: ReactNode;
}

export function Topbar({ title, actions }: Props) {
  return (
    <header className="h-[58px] bg-white border-b border-gy200 flex items-center px-6 gap-3.5 shrink-0 shadow-sm">
      <h1 className="text-[17px] font-semibold text-gy900 flex-1">{title}</h1>
      <SyncIndicator />
      {actions}
    </header>
  );
}
