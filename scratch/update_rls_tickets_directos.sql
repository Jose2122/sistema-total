-- =====================================================================
-- SCRIPT DE MIGRACIÓN: AJUSTES DE COLUMNAS Y POLÍTICAS DE TICKETS DE PAGO
-- =====================================================================
-- Ejecutar este script en: Supabase Dashboard > SQL Editor
-- =====================================================================

-- 1. Agregar columna motivo_rechazo si no existe para registrar las observaciones del aprobador
ALTER TABLE tickets_directos ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT;

-- 2. Eliminar políticas de UPDATE anteriores para el creador si existen
DROP POLICY IF EXISTS "Creador puede anular su propio ticket" ON tickets_directos;
DROP POLICY IF EXISTS "Creador puede modificar su propio ticket en estados permitidos" ON tickets_directos;
DROP POLICY IF EXISTS "Creador puede modificar y anular su propio ticket" ON tickets_directos;
DROP POLICY IF EXISTS "Gerente General y Admins pueden modificar y anular tickets" ON tickets_directos;

-- 3. Crear nueva política que permita al creador modificar y anular su propio ticket
-- Permitir al creador actualizar el ticket si su estado actual es 'Borrador', 'Edición Habilitada', 'Rechazado', 'Pendiente Aprobación' o 'EMITIDO'.
-- El chequeo posterior (WITH CHECK) garantiza que pueda cambiarlo a cualquiera de estos o a 'ANULADO'.
CREATE POLICY "Creador puede modificar y anular su propio ticket"
ON tickets_directos
FOR UPDATE
TO authenticated
USING (
  usuario_id = auth.uid() AND (
    status = 'Borrador' OR 
    status = 'Edición Habilitada' OR 
    status = 'Rechazado' OR 
    status = 'Pendiente Aprobación' OR
    status = 'EMITIDO'
  )
)
WITH CHECK (
  usuario_id = auth.uid() AND (
    status = 'Borrador' OR 
    status = 'Edición Habilitada' OR 
    status = 'Rechazado' OR 
    status = 'Pendiente Aprobación' OR
    status = 'EMITIDO' OR
    status = 'ANULADO'
  )
);

-- 4. Crear política que permita al Gerente General y Administradores modificar y anular cualquier ticket
CREATE POLICY "Gerente General y Admins pueden modificar y anular tickets"
ON tickets_directos
FOR UPDATE
TO authenticated
USING (
  auth.jwt() ->> 'email' IN (
    'cvega@totalclean.com', 
    'cvega.totalclean@gmail.com', 
    'jcontreras.totalclean@gmail.com', 
    'karincmm1@gmail.com'
  )
)
WITH CHECK (
  auth.jwt() ->> 'email' IN (
    'cvega@totalclean.com', 
    'cvega.totalclean@gmail.com', 
    'jcontreras.totalclean@gmail.com', 
    'karincmm1@gmail.com'
  )
);
