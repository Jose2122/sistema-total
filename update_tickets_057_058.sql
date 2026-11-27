-- ==============================================================================
-- ACTUALIZACIÓN MANUAL DE MONTOS ERRÓNEOS EN TICKETS DE PAGO
-- Sistema Integrado Total Clean (SITC)
-- Casos:
--   1. TP-CNT-26-058 -> Ajuste a $1,596.27 USD
--   2. TP-CNT-26-057 -> Ajuste a $22,518.35 USD
-- ==============================================================================

-- 1. Actualizar TP-CNT-26-058
UPDATE tickets_directos
SET 
  total_usd = 1596.27,
  monto_total = 1596.27,
  monto = 1596.27
WHERE 
  UPPER(REPLACE(codigo_control, ' ', '')) LIKE '%CNT%058%'
  OR UPPER(REPLACE(codigo_control, ' ', '')) LIKE '%CNT%0058%'
  OR UPPER(REPLACE(codigo_ticket, ' ', '')) LIKE '%CNT%058%';

-- 2. Actualizar TP-CNT-26-057
UPDATE tickets_directos
SET 
  total_usd = 22518.35,
  monto_total = 22518.35,
  monto = 22518.35
WHERE 
  UPPER(REPLACE(codigo_control, ' ', '')) LIKE '%CNT%057%'
  OR UPPER(REPLACE(codigo_control, ' ', '')) LIKE '%CNT%0057%'
  OR UPPER(REPLACE(codigo_ticket, ' ', '')) LIKE '%CNT%057%';

-- 3. Verificación de los registros modificados
SELECT id, codigo_control, total_usd, monto_total, monto, departamento, status
FROM tickets_directos
WHERE 
  UPPER(REPLACE(codigo_control, ' ', '')) LIKE '%CNT%058%'
  OR UPPER(REPLACE(codigo_control, ' ', '')) LIKE '%CNT%057%';

