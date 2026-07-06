-- =====================================================================
-- SCRIPT DE MIGRACIÓN: RECALCULAR TOTALES DE CABECERA HISTÓRICOS
-- =====================================================================
-- Este script actualiza la tabla solicitudes_fondos para corregir todos
-- los registros anteriores que quedaron con totales en 0 o desactualizados.
-- Suma todas las partidas activas (excluyendo las anuladas).
-- =====================================================================

UPDATE solicitudes_fondos sf
SET 
  total_bs = COALESCE((
    SELECT SUM(COALESCE(pf.pu_bs, 0) * COALESCE(pf.cantidad, 1))
    FROM partidas_fondos pf
    WHERE pf.solicitud_id = sf.id AND pf.status IS DISTINCT FROM 'ANULADO_POR_USUARIO'
  ), 0),
  total_usd = COALESCE((
    SELECT SUM(COALESCE(pf.pu_usd, 0) * COALESCE(pf.cantidad, 1))
    FROM partidas_fondos pf
    WHERE pf.solicitud_id = sf.id AND pf.status IS DISTINCT FROM 'ANULADO_POR_USUARIO'
  ), 0);
