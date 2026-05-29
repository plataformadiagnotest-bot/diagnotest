-- El tipo de pago solo es relevante cuando hubo cobro (importe != 0).
-- Lo hacemos opcional para no forzar un método de pago en retiros sin importe.
alter table retiros alter column metodo_pago drop default;
alter table retiros alter column metodo_pago drop not null;
