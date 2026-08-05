-- Migración: Agregar columna observaciones a tickets_directos
-- Ejecutar en Supabase Dashboard > SQL Editor
-- Fecha: 2026-08-05

ALTER TABLE tickets_directos
  ADD COLUMN IF NOT EXISTS observaciones TEXT;

COMMENT ON COLUMN tickets_directos.observaciones IS 'Observaciones y comentarios cortos del ticket directo';
