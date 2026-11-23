-- =====================================================================
-- SCRIPT: POLÍTICA RLS DEFINITIVA PARA APROBACIÓN DE TICKETS DE PAGO
-- =====================================================================
-- Ejecutar en: Supabase Dashboard > SQL Editor > Run
-- =====================================================================

-- 1. Eliminar políticas conflictivas anteriores de UPDATE sobre tickets_directos si existen
DROP POLICY IF EXISTS "Creador puede anular su propio ticket" ON tickets_directos;
DROP POLICY IF EXISTS "Creador puede modificar su propio ticket en estados permitidos" ON tickets_directos;
DROP POLICY IF EXISTS "Creador puede modificar y anular su propio ticket" ON tickets_directos;
DROP POLICY IF EXISTS "Gerente General y Admins pueden modificar y anular tickets" ON tickets_directos;
DROP POLICY IF EXISTS "Gerentes y Admins pueden aprobar y actualizar tickets" ON tickets_directos;
DROP POLICY IF EXISTS "Permitir update a creador y gerentes" ON tickets_directos;

-- 2. Política integral para UPDATE en tickets_directos:
-- Permite modificar/aprobar tickets a:
--   a) El propio creador del ticket (para anular o editar en borrador/pendiente).
--   b) Super Admins y Administradores / Gerencia General por correo.
--   c) El aprobador designado específicamente (aprobador_id = auth.uid()).
--   d) Cualquier Gerente, Coordinador, Director o Administrador registrado en la tabla `perfiles`.
CREATE POLICY "Gerentes y Admins pueden aprobar y actualizar tickets"
ON tickets_directos
FOR UPDATE
TO authenticated
USING (
  -- El creador del ticket
  usuario_id = auth.uid()
  
  -- El aprobador explícitamente asignado
  OR aprobador_id = auth.uid()
  
  -- Admins y Gerencia General explícitos por correo
  OR lower(coalesce(auth.jwt() ->> 'email', '')) IN (
    'cvega@totalclean.com.ve',
    'cvega@totalclean.com',
    'cvega.totalclean@gmail.com',
    'jcontreras.totalclean@gmail.com',
    'karincmm1@gmail.com',
    'larazuleika9@gmail.com'
  )
  
  -- Cualquier usuario que tenga rol de Gerente, Coordinador, Director o Administrador en `perfiles`
  OR EXISTS (
    SELECT 1 FROM perfiles p
    WHERE p.id = auth.uid()
      AND (
        lower(coalesce(p.rol, '')) LIKE '%gerente%'
        OR lower(coalesce(p.rol, '')) LIKE '%coordinador%'
        OR lower(coalesce(p.rol, '')) LIKE '%director%'
        OR lower(coalesce(p.rol, '')) LIKE '%admin%'
        OR lower(coalesce(p.departamento, '')) LIKE '%administra%'
        OR lower(coalesce(p.departamento, '')) LIKE '%contabil%'
      )
  )
)
WITH CHECK (
  true
);

-- Notificar éxito
COMMENT ON TABLE tickets_directos IS 'Políticas RLS actualizadas para permitir aprobación de gerentes de área, proyecto y admins.';
