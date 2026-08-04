-- =====================================================================
-- SCRIPT DE MIGRACIÓN: EXTENSIÓN DE LA TABLA NOTIFICACIONES PARA TICKETS
-- =====================================================================
-- Ejecutar este script en: Supabase Dashboard > SQL Editor
-- =====================================================================

-- 1. Agregar columnas ticket_id y titulo si no existen
ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS ticket_id UUID;
ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS titulo TEXT;
