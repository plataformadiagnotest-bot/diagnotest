"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/ToastNotification";

interface VetOption { id: string; codigo: string; nombre: string }
interface PersonalOption { id: string; nombre: string }

interface Props {
  creadoPorId: string;
}

// Fecha límite por defecto: ahora + 2 horas, en formato datetime-local.
function defaultFechaLimite(): string {
  const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function NuevoPedidoForm({ creadoPorId }: Props) {
  const router = useRouter();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = createClient();

  const [veterinarias, setVeterinarias] = useState<VetOption[]>([]);
  const [personal, setPersonal] = useState<PersonalOption[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    veterinaria_texto: "",
    veterinaria_id: "",
    codigo: "",
    personal_asignado_id: "",
    fecha_limite: defaultFechaLimite(),
    detalle: "",
    urgente: false,
  });

  useEffect(() => {
    async function load() {
      // Veterinarias: paginar para superar el cap de 1000 de PostgREST.
      const vets: VetOption[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("veterinarias")
          .select("id, codigo, nombre")
          .eq("activa", true)
          .order("nombre")
          .range(from, from + 999);
        if (error || !data || data.length === 0) break;
        vets.push(...data);
        if (data.length < 1000) break;
      }
      setVeterinarias(vets);

      const { data: pers } = await supabase
        .from("personal")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre");
      setPersonal(pers ?? []);
    }
    load();
  }, []);

  function set(field: string, value: unknown) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.veterinaria_id) { toast("error", "Seleccioná una veterinaria de la lista"); return; }
    if (!form.personal_asignado_id) { toast("error", "Asigná el pedido a un personal de logística"); return; }
    setLoading(true);

    const { error } = await supabase.from("pedidos_retiro").insert({
      veterinaria_id: form.veterinaria_id,
      personal_asignado_id: form.personal_asignado_id,
      creado_por_id: creadoPorId,
      estado: "asignado",
      urgente: form.urgente,
      detalle: form.detalle.trim() || null,
      fecha_limite: new Date(form.fecha_limite).toISOString(),
    });

    if (error) {
      toast("error", "Error al crear el pedido: " + error.message);
      setLoading(false);
      return;
    }

    toast("success", "Pedido de retiro creado ✓");
    router.push("/pedidos");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Veterinaria */}
      <section>
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-g700 mb-3 pb-2 border-b border-g100">
          <i className="ti ti-building-hospital" /> Veterinaria / Cliente
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-gy600">Nombre o búsqueda <span className="text-red-500">*</span></label>
            <input
              list="vets-list-pedido"
              className="px-3 py-2 border-2 border-gy200 rounded-[6px] text-[13px] bg-gy50 focus:outline-none focus:border-g500"
              placeholder="Buscar por nombre..."
              value={form.veterinaria_texto}
              onChange={(e) => {
                set("veterinaria_texto", e.target.value);
                const match = veterinarias.find((v) => v.nombre === e.target.value);
                if (match) { set("veterinaria_id", match.id); set("codigo", match.codigo); }
                else { set("veterinaria_id", ""); set("codigo", ""); }
              }}
            />
            <datalist id="vets-list-pedido">
              {veterinarias.map((v) => <option key={v.id} value={v.nombre} />)}
            </datalist>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-gy600">Código</label>
            <input
              readOnly
              className="px-3 py-2 border-2 border-gy200 rounded-[6px] text-[13px] bg-gy100 text-gy500 focus:outline-none font-mono"
              placeholder="—"
              value={form.codigo}
            />
          </div>
        </div>
      </section>

      {/* Asignación */}
      <section>
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-g700 mb-3 pb-2 border-b border-g100">
          <i className="ti ti-user" /> Asignación
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-gy600">Asignar a <span className="text-red-500">*</span></label>
            <select
              className="px-3 py-2 border-2 border-gy200 rounded-[6px] text-[13px] bg-gy50 focus:outline-none focus:border-g500"
              value={form.personal_asignado_id}
              onChange={(e) => set("personal_asignado_id", e.target.value)}
              required
            >
              <option value="">— Seleccionar —</option>
              {personal.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-gy600">Fecha límite <span className="text-red-500">*</span></label>
            <input
              type="datetime-local"
              className="px-3 py-2 border-2 border-gy200 rounded-[6px] text-[13px] bg-gy50 focus:outline-none focus:border-g500"
              value={form.fecha_limite}
              onChange={(e) => set("fecha_limite", e.target.value)}
              required
            />
          </div>
        </div>
      </section>

      {/* Detalle */}
      <section>
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-g700 mb-3 pb-2 border-b border-g100">
          <i className="ti ti-notes" /> Detalle
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-gy600">Indicaciones para el retiro</label>
          <textarea
            className="px-3 py-2 border-2 border-gy200 rounded-[6px] text-[13px] bg-gy50 focus:outline-none focus:border-g500 resize-y min-h-[72px]"
            placeholder="Ej: Perfiles bioquímicos, retirar antes de mediodía..."
            value={form.detalle}
            onChange={(e) => set("detalle", e.target.value)}
          />
        </div>
      </section>

      {/* Urgente */}
      <section>
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-g700 mb-3 pb-2 border-b border-g100">
          <i className="ti ti-flag" /> Marcadores
        </div>
        <button type="button"
          onClick={() => set("urgente", !form.urgente)}
          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-[6px] border-2 transition-all ${form.urgente ? "border-red-400 bg-red-50" : "border-dashed border-gy300"}`}
        >
          <div className={`w-2.5 h-2.5 rounded-full transition-colors ${form.urgente ? "bg-red-500" : "bg-gy300"}`} />
          <span className={`text-[12px] font-semibold ${form.urgente ? "text-red-600" : "text-gy600"}`}>
            {form.urgente ? "Urgente: SÍ" : "Urgente: No"}
          </span>
        </button>
      </section>

      <button type="submit" disabled={loading}
        className="w-full py-3.5 bg-g800 hover:bg-g700 text-white font-semibold rounded-[10px] text-[14px] flex items-center justify-center gap-2 transition-colors disabled:opacity-60 tracking-wide"
      >
        {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <i className="ti ti-device-floppy" />}
        {loading ? "Creando…" : "Crear pedido"}
      </button>
    </form>
  );
}
