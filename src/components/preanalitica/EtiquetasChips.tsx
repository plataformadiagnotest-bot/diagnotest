export function EtiquetasChips({ etiquetas }: { etiquetas?: string[] | null }) {
  if (!etiquetas || etiquetas.length === 0) {
    return <span className="text-gy400">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {etiquetas.map((e) => (
        <span key={e} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-g50 text-g700 border border-g200">
          {e}
        </span>
      ))}
    </div>
  );
}
