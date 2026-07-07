-- ============================================================
-- 0021 — "Dejar materiales" en el pedido de retiro
-- ============================================================
-- El jefe de logística puede indicar, al asignar un pedido, que el cadete debe
-- dejar materiales en la veterinaria. Se guarda la lista de materiales elegidos
-- (Tubos, Órdenes, Hisopos, Frascos de orina, Bolsas). Sin cantidades: solo
-- qué materiales. Lista vacía / null = no hay materiales que dejar.

alter table pedidos_retiro
  add column if not exists materiales text[];
