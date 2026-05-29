-- Etiquetas que preanalítica marca al controlar un retiro
-- (citología, AMF, cross match, VITEK, histopatología, anula, sin orden, etc.)
alter table control_preanalitica
  add column if not exists etiquetas text[] not null default '{}';
