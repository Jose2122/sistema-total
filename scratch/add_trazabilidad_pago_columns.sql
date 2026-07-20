-- Migración: Agregar columnas de trazabilidad de pago a tickets_directos
-- Ejecutar en Supabase SQL Editor
-- Fecha: 2026-07-17

ALTER TABLE tickets_directos
  ADD COLUMN IF NOT EXISTS pagado_por_nombre text,
  ADD COLUMN IF NOT EXISTS fecha_pago timestamptz;

-- Comentarios opcionales para documentación
COMMENT ON COLUMN tickets_directos.pagado_por_nombre IS 'Nombre del usuario que marcó el ticket como Pagado';
COMMENT ON COLUMN tickets_directos.fecha_pago IS 'Timestamp de cuando el ticket fue procesado/pagado';
