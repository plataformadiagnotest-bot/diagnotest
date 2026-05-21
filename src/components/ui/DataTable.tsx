"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils/format";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface Props<T> {
  data: T[];
  columns: Column<T>[];
  keyFn: (row: T) => string;
  pageSize?: number;
  onExport?: () => void;
  className?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  keyFn,
  pageSize = 25,
  onExport,
  className,
}: Props<T>) {
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv), "es-AR");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const total = sorted.length;
  const pages = Math.ceil(total / pageSize);
  const slice = sorted.slice((page - 1) * pageSize, page * pageSize);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  return (
    <div className={cn("bg-white rounded-[14px] border border-gy200 shadow-sm overflow-hidden", className)}>
      {onExport && (
        <div className="flex justify-end px-4 py-2 border-b border-gy100">
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-gy600 bg-white border border-gy200 rounded-[6px] hover:bg-gy50"
          >
            Exportar Excel
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-gy50">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={cn(
                    "px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200 whitespace-nowrap",
                    col.sortable && "cursor-pointer select-none hover:text-gy800",
                    col.className
                  )}
                  onClick={() => col.sortable && toggleSort(String(col.key))}
                >
                  {col.header}
                  {col.sortable && sortKey === String(col.key) && (
                    <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row) => (
              <tr key={keyFn(row)} className="hover:bg-gy50 border-b border-gy100 last:border-0">
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={cn("px-3.5 py-2.5 text-gy800 align-middle", col.className)}
                  >
                    {col.render
                      ? col.render(row)
                      : String(row[String(col.key)] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
            {slice.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="py-10 text-center text-gy400 text-sm">
                  Sin registros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gy100 text-[11px] text-gy400">
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
          </span>
          <div className="flex gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-2.5 py-1 rounded border border-gy200 disabled:opacity-40 hover:bg-gy50"
            >
              ‹
            </button>
            <button
              disabled={page === pages}
              onClick={() => setPage((p) => p + 1)}
              className="px-2.5 py-1 rounded border border-gy200 disabled:opacity-40 hover:bg-gy50"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
