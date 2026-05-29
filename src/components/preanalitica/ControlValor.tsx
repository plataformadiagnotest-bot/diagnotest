// Muestra el resultado de un control (1 o 2) como chip de color.
const MAP: Record<string, { label: string; cls: string }> = {
  ok: { label: "OK", cls: "bg-g50 text-g700 border-g200" },
  observar: { label: "Observar", cls: "bg-amber-bg text-amber-text border-amber/40" },
  rechazar: { label: "Rechazar", cls: "bg-red-50 text-red-700 border-red-200" },
};

export function ControlValor({ valor }: { valor?: string | null }) {
  if (!valor) return <span className="text-gy400">—</span>;
  const m = MAP[valor] ?? { label: valor, cls: "bg-gy50 text-gy600 border-gy200" };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${m.cls}`}>
      {m.label}
    </span>
  );
}
