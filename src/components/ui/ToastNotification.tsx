"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/format";

type ToastType = "success" | "warning" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

const styles: Record<ToastType, string> = {
  success: "bg-g800 text-white",
  warning: "bg-amber-bg text-amber-text border border-amber",
  error: "bg-red-600 text-white",
  info: "bg-blue-600 text-white",
};

let addToast: ((t: Omit<Toast, "id">) => void) | null = null;

export function toast(type: ToastType, message: string) {
  addToast?.({ type, message });
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    addToast = (t) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { ...t, id }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, 4000);
    };
    return () => { addToast = null; };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "px-4 py-3 rounded-[10px] shadow-lg text-sm font-medium max-w-sm animate-in slide-in-from-right-4 fade-in",
            styles[t.type]
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
