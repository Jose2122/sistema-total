-- =====================================================================
-- SCRIPT: PERMITIR QUE EL CREADOR ANULE SU PROPIO TICKET
-- =====================================================================
-- Ejecutar en: Supabase > SQL Editor
--
-- Contexto: La política existente "Solo Administracion puede editar tickets"
-- solo permite UPDATE a usuarios del depto de Administración.
-- Esta nueva política permite adicionalmente que el creador del ticket
-- (quien lo emitió) pueda actualizarlo (necesario para anular).
--
-- En Supabase, múltiples políticas PERMISSIVE del mismo tipo se combinan
-- con OR, por lo que esta nueva política NO elimina la anterior.
-- =====================================================================

CREATE POLICY "Creador puede anular su propio ticket"
ON tickets_directos
FOR UPDATE
USING (
  usuario_id = auth.uid()
)
WITH CHECK (
  usuario_id = auth.uid()
);
