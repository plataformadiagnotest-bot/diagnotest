// Un control está "en rojo" (avisado a cobranzas y carga) cuando fue
// cancelado por preanalítica/dirección o lleva la etiqueta "Anula".
export function esCanceladoOAnulado(c: {
  cancelado?: boolean | null;
  etiquetas?: string[] | null;
}): boolean {
  if (c.cancelado) return true;
  return (c.etiquetas ?? []).some((e) => /anul/i.test(e));
}

// Texto corto del estado en rojo para badges/etiquetas.
export function etiquetaRojo(c: {
  cancelado?: boolean | null;
  etiquetas?: string[] | null;
}): "Cancelado" | "Anulado" | null {
  if (c.cancelado) return "Cancelado";
  if ((c.etiquetas ?? []).some((e) => /anul/i.test(e))) return "Anulado";
  return null;
}
