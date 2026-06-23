// Criterio único para decidir si un retiro de un cadete "resuelve" un pedido.
// Lo usan tanto el API (/api/pedidos/resolver) como la pantalla de pedidos
// (para mostrar el cartelito "detectamos tu retiro"). Mantener una sola fuente
// de verdad evita que el aviso y la validación real se desincronicen.

// Normaliza un nombre de veterinaria (minúsculas, sin acentos, espacios
// colapsados) para comparar aunque el cadete lo haya escrito a mano.
export function normVet(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Fecha operativa (AR) de un timestamptz, en formato YYYY-MM-DD.
export function fechaPedidoAR(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

export interface PedidoMatch {
  veterinaria_id: string | null;
  vetNombre: string | null | undefined;
  created_at: string;
}

export interface RetiroMatch {
  veterinaria_id: string | null;
  veterinaria_texto_original: string | null;
  fecha_operativa: string;
}

// Coincidencia de veterinaria: por id o por nombre normalizado.
export function vetCoincide(pedido: PedidoMatch, retiro: RetiroMatch): boolean {
  if (pedido.veterinaria_id && retiro.veterinaria_id && retiro.veterinaria_id === pedido.veterinaria_id) {
    return true;
  }
  const vn = normVet(pedido.vetNombre);
  return !!vn && normVet(retiro.veterinaria_texto_original) === vn;
}

// El retiro resuelve el pedido si coincide la veterinaria y su fecha operativa
// es la del pedido o posterior (un pedido vencido ayer se cierra con el de hoy,
// nunca con uno anterior).
export function retiroResuelvePedido(pedido: PedidoMatch, retiro: RetiroMatch): boolean {
  return retiro.fecha_operativa >= fechaPedidoAR(pedido.created_at) && vetCoincide(pedido, retiro);
}
