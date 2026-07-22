"use client";

import { useMemo, useState } from "react";
import { PillStatus } from "@/components/ui/PillStatus";
import { toast } from "@/components/ui/ToastNotification";

export type VetRow = {
  id: string;
  codigo: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  localidad: string | null;
  activa: boolean;
  es_fija: boolean;
  zona: { nombre?: string } | null;
};

// Interruptor "Fija" de una veterinaria. Optimista: cambia al instante y
// revierte si el guardado falla. Una vet fija genera pedido de retiro diario.
function FijaToggle({ vet }: { vet: VetRow }) {
  const [on, setOn] = useState(vet.es_fija);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const nuevo = !on;
    setOn(nuevo);
    setSaving(true);
    const res = await fetch("/api/admin/veterinarias/fija", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: vet.id, es_fija: nuevo }),
    });
    setSaving(false);
    if (!res.ok) {
      setOn(!nuevo); // revertir
      const j = await res.json().catch(() => ({}));
      toast("error", j.error ?? "No se pudo guardar");
      return;
    }
    toast("success", nuevo ? "Marcada como fija ✓" : "Ya no es fija");
  }

  return (
    <button onClick={toggle} disabled={saving}
      title={on ? "Es fija: genera pedido diario. Tocá para desmarcar." : "Marcar como fija (pedido diario automático)"}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors disabled:opacity-50 ${on ? "bg-g700 text-white border-g700" : "bg-white text-gy500 border-gy300 hover:border-g400 hover:text-g700"}`}>
      <i className={`ti ${on ? "ti-map-pin" : "ti-map-pin"} text-[12px]`} />
      {on ? "Fija" : "No"}
    </button>
  );
}

export function VeterinariasTable({ vets }: { vets: VetRow[] }) {
  const [q, setQ] = useState("");
  const [soloFijas, setSoloFijas] = useState(false);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    return vets.filter((v) => {
      if (soloFijas && !v.es_fija) return false;
      if (!term) return true;
      return [v.codigo, v.nombre, v.email, v.localidad, v.zona?.nombre]
        .some((x) => String(x ?? "").toLowerCase().includes(term));
    });
  }, [vets, q, soloFijas]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-[420px]">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gy400 text-[14px]" />
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por código, nombre, localidad o zona…"
            className="w-full pl-8 pr-8 py-2 border-2 border-gy200 rounded-[8px] text-[12px] bg-gy50 focus:outline-none focus:border-g500 focus:bg-white" />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gy400 hover:text-gy700">
              <i className="ti ti-x text-[13px]" />
            </button>
          )}
        </div>
        <button onClick={() => setSoloFijas((s) => !s)}
          className={`px-3 py-1.5 rounded-full border text-[11px] font-medium transition-all ${soloFijas ? "bg-g800 text-white border-g800" : "bg-white text-gy600 border-gy200 hover:border-g400"}`}>
          <i className="ti ti-map-pin text-[12px] mr-1" /> Solo fijas
        </button>
        <span className="text-[11px] text-gy400 ml-auto">{filtrados.length} resultado{filtrados.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="bg-white rounded-[14px] border border-gy200 shadow-sm overflow-hidden">
        <div className="table-scroll table-scroll-tall">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-gy50">
                {["Código", "Nombre", "Zona", "Localidad", "Estado", "Fija"].map((h) => (
                  <th key={h} className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((v) => (
                <tr key={v.id} className="hover:bg-gy50 border-b border-gy100 last:border-0">
                  <td className="px-3.5 py-2.5 font-mono text-g700">{v.codigo}</td>
                  <td className="px-3.5 py-2.5 font-medium text-gy900">{v.nombre}</td>
                  <td className="px-3.5 py-2.5">{v.zona?.nombre ?? <span className="text-red-500">sin zona</span>}</td>
                  <td className="px-3.5 py-2.5 text-gy600">{v.localidad ?? "—"}</td>
                  <td className="px-3.5 py-2.5"><PillStatus variant={v.activa ? "ok" : "grey"} label={v.activa ? "Activa" : "Inactiva"} /></td>
                  <td className="px-3.5 py-2.5"><FijaToggle vet={v} /></td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-gy400">Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
