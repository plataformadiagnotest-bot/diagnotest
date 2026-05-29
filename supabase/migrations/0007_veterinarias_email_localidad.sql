-- Maestro de clientes (veterinarias): email + localidad, y mapa localidad→zona.

-- 1) Nuevos campos en veterinarias
alter table veterinarias add column if not exists email     text;
alter table veterinarias add column if not exists localidad text;

-- 2) Mapa localidad→zona: cada zona agrupa una o varias localidades.
--    Lo arma el jefe de logística. El sync usa esto para deducir la zona
--    cuando el Sheet no trae una columna 'zona' explícita.
alter table zonas add column if not exists localidades text[] not null default '{}';
