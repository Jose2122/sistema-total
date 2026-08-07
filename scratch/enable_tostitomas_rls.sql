-- =====================================================================
-- SCRIPT DE MIGRACIÓN: HABILITAR PERMISOS DE LECTURA (SELECT) PARA TOSTITOMAS
-- =====================================================================
-- Ejecutar este script en: Supabase Dashboard > SQL Editor
-- =====================================================================

-- 1. Política de Lectura (SELECT) para partidas_fondos
DROP POLICY IF EXISTS "Permitir select a tostitomas en partidas_fondos" ON partidas_fondos;
CREATE POLICY "Permitir select a tostitomas en partidas_fondos"
ON partidas_fondos
FOR SELECT
TO authenticated
USING (auth.jwt() ->> 'email' = 'tostitomas@gmail.com');

-- 2. Política de Lectura (SELECT) para solicitudes_fondos
DROP POLICY IF EXISTS "Permitir select a tostitomas en solicitudes_fondos" ON solicitudes_fondos;
CREATE POLICY "Permitir select a tostitomas en solicitudes_fondos"
ON solicitudes_fondos
FOR SELECT
TO authenticated
USING (auth.jwt() ->> 'email' = 'tostitomas@gmail.com');

-- 3. Política de Lectura (SELECT) para tickets_directos
DROP POLICY IF EXISTS "Permitir select a tostitomas en tickets_directos" ON tickets_directos;
CREATE POLICY "Permitir select a tostitomas en tickets_directos"
ON tickets_directos
FOR SELECT
TO authenticated
USING (auth.jwt() ->> 'email' = 'tostitomas@gmail.com');

-- 4. Política de Lectura (SELECT) para requisiciones
DROP POLICY IF EXISTS "Permitir select a tostitomas en requisiciones" ON requisiciones;
CREATE POLICY "Permitir select a tostitomas en requisiciones"
ON requisiciones
FOR SELECT
TO authenticated
USING (auth.jwt() ->> 'email' = 'tostitomas@gmail.com');
