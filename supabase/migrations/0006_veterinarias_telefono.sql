-- Teléfono de la veterinaria (para el maestro importado desde Google Sheets)
alter table veterinarias
  add column if not exists telefono text;
