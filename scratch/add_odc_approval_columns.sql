-- Migración: Columnas de Aprobación de Precios y Prioridad de Pagos para Órdenes de Compra (ODC)
-- Ejecutar en Supabase SQL Editor si se desea persistencia a nivel de columnas dedicadas en Postgres.

ALTER TABLE IF EXISTS public.ordenes_compra
ADD COLUMN IF NOT EXISTS estado_aprobacion_precio TEXT DEFAULT 'pendiente',
ADD COLUMN IF NOT EXISTS prioridad_pago INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS aprobado_compras_por TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fecha_aprobacion_compras TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS motivo_rechazo_compras TEXT DEFAULT NULL;

-- Asegurar compatibilidad en la columna estatus_orden si tiene CHECK constraint
DO $$ 
BEGIN
    ALTER TABLE public.ordenes_compra DROP CONSTRAINT IF EXISTS ordenes_compra_estatus_orden_check;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.ordenes_compra 
ADD CONSTRAINT ordenes_compra_estatus_orden_check 
CHECK (estatus_orden IN ('BORRADOR', 'EMITIDA', 'APROBADA', 'RECHAZADA', 'EN_PROCESO', 'COMPLETADA', 'ANULADA'));

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_odc_aprobacion ON public.ordenes_compra(estado_aprobacion_precio);
CREATE INDEX IF NOT EXISTS idx_odc_prioridad ON public.ordenes_compra(prioridad_pago);
