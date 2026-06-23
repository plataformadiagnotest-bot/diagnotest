import { EtiquetasChips } from "@/components/preanalitica/EtiquetasChips";
import { ControlValor } from "@/components/preanalitica/ControlValor";
import { formatDateTime } from "@/lib/utils/dates";
import { esCanceladoOAnulado, etiquetaRojo } from "@/lib/utils/preanalitica";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

// Tabla de solo lectura de controlados, usada por los perfiles de Carga y por
// la vista de Cancelados/Anulados. Muestra etiquetas, comentario y resalta en
// rojo lo cancelado o anulado.
export function TablaControladosRO({
  rows,
  nombrePorId,
  emptyText = "Sin registros",
}: {
  rows: AnyRecord[];
  nombrePorId: Map<string, string>;
  emptyText?: string;
}) {
  return (
    <div className="bg-white rounded-[14px] border border-gy200 shadow-sm overflow-hidden">
      <div className="table-scroll">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-gy50">
              {["Código", "Personal", "Veterinaria", "Muestras", "Control 1", "Control 2", "Etiquetas", "Comentario", "Responsable", "Hora"].map((h) => (
                <th key={h} className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const r = c.retiro as AnyRecord;
              const rojo = esCanceladoOAnulado(c);
              const tag = etiquetaRojo(c);
              return (
                <tr key={c.id} className={`border-b border-gy100 last:border-0 ${rojo ? "bg-red-50" : ""}`}>
                  <td className="px-3.5 py-2.5 font-mono text-[11px] text-g700">
                    {tag && <span className="mr-1.5 inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-600 text-white align-middle">{tag.toUpperCase()}</span>}
                    {r?.codigo_original ?? "—"}
                  </td>
                  <td className="px-3.5 py-2.5 font-medium">{r?.personal?.nombre ?? "—"}</td>
                  <td className="px-3.5 py-2.5">{r?.veterinaria_texto_original}</td>
                  <td className="px-3.5 py-2.5 text-center font-semibold">{r?.cantidad_muestras}</td>
                  <td className="px-3.5 py-2.5"><ControlValor valor={c.control_1} /></td>
                  <td className="px-3.5 py-2.5"><ControlValor valor={c.control_2} /></td>
                  <td className="px-3.5 py-2.5"><EtiquetasChips etiquetas={c.etiquetas} /></td>
                  <td className="px-3.5 py-2.5 text-gy600 max-w-[220px]">
                    {c.comentario ? <span className="text-[11px]">{c.comentario}</span> : <span className="text-gy300">—</span>}
                    {rojo && c.cancelado && c.cancelado_motivo && (
                      <div className="text-[10px] text-red-600 mt-0.5">Motivo: {c.cancelado_motivo}</div>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 text-gy600">{c.responsable_id ? (nombrePorId.get(c.responsable_id) ?? "—") : "—"}</td>
                  <td className="px-3.5 py-2.5 text-gy600 whitespace-nowrap">{formatDateTime(c.updated_at)}</td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr><td colSpan={10} className="py-10 text-center text-gy400">{emptyText}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
