-- =============================================================================
-- MIGRACIÓN BASE DE DATOS: MÓDULO DE LIQUIDACIÓN FISCAL Y RETENCIONES (SITC)
-- TOTAL CLEAN C.A. - CUENTAS POR PAGAR
-- CÁLCULO DE RETENCIONES (IVA E ISLR) Y TIPOS DE CAMBIO (BCV / PREFERENCIAL)
-- =============================================================================

-- 1. Crear tabla principal: compras_retenciones
CREATE TABLE IF NOT EXISTS public.compras_retenciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_comprobante TEXT UNIQUE,
    proveedor_id BIGINT REFERENCES public.proveedores(id) ON DELETE SET NULL,
    proveedor_nombre TEXT NOT NULL,
    proveedor_rif TEXT,
    numero_factura TEXT NOT NULL,
    numero_control TEXT,
    fecha_emision DATE DEFAULT CURRENT_DATE,
    fecha_liquidacion TIMESTAMPTZ DEFAULT now(),
    orden_compra_id UUID REFERENCES public.ordenes_compra(id) ON DELETE SET NULL,
    requisicion_id BIGINT REFERENCES public.requisiciones(id) ON DELETE SET NULL,

    -- Parámetros cambiarios y fiscales obligatorios
    tipo_tasa TEXT CHECK (tipo_tasa IN ('BCV_USD', 'BCV_EUR', 'PREFERENCIAL')) NOT NULL DEFAULT 'BCV_USD',
    valor_tasa NUMERIC(12,4) NOT NULL,
    monto_exento NUMERIC(12,2) DEFAULT 0.00,
    base_imponible NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    alicuota_iva NUMERIC(5,2) DEFAULT 16.00,
    monto_iva NUMERIC(12,2) DEFAULT 0.00,
    porcentaje_retencion_iva NUMERIC(5,2) CHECK (porcentaje_retencion_iva IN (0, 75, 100)) DEFAULT 75.00,
    monto_retencion_iva NUMERIC(12,2) DEFAULT 0.00,
    porcentaje_retencion_islr NUMERIC(5,2) DEFAULT 2.00,
    monto_retencion_islr NUMERIC(12,2) DEFAULT 0.00,
    total_factura NUMERIC(12,2) NOT NULL,
    total_retenciones NUMERIC(12,2) NOT NULL,
    monto_neto_pagar NUMERIC(12,2) NOT NULL,
    equivalente_ves_neto NUMERIC(14,2) NOT NULL,

    -- Trazabilidad y auditoría
    concepto TEXT,
    observaciones TEXT,
    creado_por_id UUID,
    creado_por_nombre TEXT,
    estatus TEXT DEFAULT 'LIQUIDADO' CHECK (estatus IN ('BORRADOR', 'LIQUIDADO', 'ANULADO')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Asegurar columnas de liquidación fiscal en ordenes_compra (para sincronización directa)
ALTER TABLE IF EXISTS public.ordenes_compra
    ADD COLUMN IF NOT EXISTS tipo_tasa TEXT CHECK (tipo_tasa IN ('BCV_USD', 'BCV_EUR', 'PREFERENCIAL')) DEFAULT 'BCV_USD',
    ADD COLUMN IF NOT EXISTS valor_tasa NUMERIC(12,4) DEFAULT 1.0000,
    ADD COLUMN IF NOT EXISTS monto_exento NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS base_imponible NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS alicuota_iva NUMERIC(5,2) DEFAULT 16.00,
    ADD COLUMN IF NOT EXISTS monto_iva NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS porcentaje_retencion_iva NUMERIC(5,2) DEFAULT 75.00,
    ADD COLUMN IF NOT EXISTS monto_retencion_iva NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS porcentaje_retencion_islr NUMERIC(5,2) DEFAULT 2.00,
    ADD COLUMN IF NOT EXISTS monto_retencion_islr NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS total_factura NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS total_retenciones NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS monto_neto_pagar NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS equivalente_ves_neto NUMERIC(14,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS retencion_fiscal_id UUID;

-- 3. Habilitar RLS y políticas permisivas para compras_retenciones
ALTER TABLE public.compras_retenciones ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'compras_retenciones' AND policyname = 'compras_retenciones_select_policy'
    ) THEN
        CREATE POLICY compras_retenciones_select_policy ON public.compras_retenciones
            FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'compras_retenciones' AND policyname = 'compras_retenciones_insert_policy'
    ) THEN
        CREATE POLICY compras_retenciones_insert_policy ON public.compras_retenciones
            FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'compras_retenciones' AND policyname = 'compras_retenciones_update_policy'
    ) THEN
        CREATE POLICY compras_retenciones_update_policy ON public.compras_retenciones
            FOR UPDATE USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'compras_retenciones' AND policyname = 'compras_retenciones_delete_policy'
    ) THEN
        CREATE POLICY compras_retenciones_delete_policy ON public.compras_retenciones
            FOR DELETE USING (true);
    END IF;
END $$;

-- 4. Índices para acelerar búsquedas
CREATE INDEX IF NOT EXISTS idx_compras_retenciones_proveedor ON public.compras_retenciones(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_compras_retenciones_odc ON public.compras_retenciones(orden_compra_id);
CREATE INDEX IF NOT EXISTS idx_compras_retenciones_fecha ON public.compras_retenciones(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_compras_retenciones_factura ON public.compras_retenciones(numero_factura);
