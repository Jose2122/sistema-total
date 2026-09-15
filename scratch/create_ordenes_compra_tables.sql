-- =============================================================================
-- MIGRACIÓN BASE DE DATOS: ÓRDENES DE COMPRA (ODC) - FORMATO F-ADM-01-2
-- TOTAL CLEAN C.A.
-- =============================================================================

-- 1. Extensión de la tabla 'proveedores'
ALTER TABLE IF EXISTS public.proveedores 
ADD COLUMN IF NOT EXISTS condicion_pago_defecto TEXT DEFAULT 'CONTADO' CHECK (condicion_pago_defecto IN ('CONTADO', 'CREDITO')),
ADD COLUMN IF NOT EXISTS dias_credito_habituales INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS dias_credito INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS monto_limite_credito NUMERIC(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS limite_credito NUMERIC(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS persona_contacto TEXT,
ADD COLUMN IF NOT EXISTS contacto_nombre TEXT,
ADD COLUMN IF NOT EXISTS ciudad TEXT,
ADD COLUMN IF NOT EXISTS localizacion TEXT,
ADD COLUMN IF NOT EXISTS calificacion_precio INT DEFAULT 5,
ADD COLUMN IF NOT EXISTS calificacion_cumplimiento INT DEFAULT 5,
ADD COLUMN IF NOT EXISTS observaciones_negociacion TEXT,
ADD COLUMN IF NOT EXISTS proveedor_preferencial BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cuentas_bancarias JSONB DEFAULT '[]'::jsonb;

-- 2. Tabla de Destinos de Despacho Predeterminados
CREATE TABLE IF NOT EXISTS public.destinos_despacho_predeterminados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT UNIQUE NOT NULL,
    direccion TEXT,
    contacto_nombre TEXT,
    contacto_telefono TEXT,
    es_predeterminado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE IF EXISTS public.destinos_despacho_predeterminados 
ADD COLUMN IF NOT EXISTS direccion TEXT,
ADD COLUMN IF NOT EXISTS contacto_nombre TEXT,
ADD COLUMN IF NOT EXISTS contacto_telefono TEXT,
ADD COLUMN IF NOT EXISTS es_predeterminado BOOLEAN DEFAULT FALSE;

-- Sembrado inicial de destinos predeterminados
INSERT INTO public.destinos_despacho_predeterminados (nombre)
VALUES 
    ('Galpones Riese - Av. Los Haticos'),
    ('Campo Boscán'),
    ('Bajo Grande'),
    ('Petropiar - Anzoátegui')
ON CONFLICT (nombre) DO NOTHING;

-- 3. Tabla Principal: ordenes_compra
CREATE TABLE IF NOT EXISTS public.ordenes_compra (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_odc TEXT UNIQUE NOT NULL,
    requisicion_id BIGINT REFERENCES public.requisiciones(id) ON DELETE SET NULL,
    proveedor_id BIGINT REFERENCES public.proveedores(id) ON DELETE SET NULL,
    proveedor_nombre TEXT,
    proveedor_rif TEXT,
    cotizacion_ref TEXT,
    fecha_cotizacion DATE,
    tipo_pago TEXT NOT NULL DEFAULT 'CONTADO' CHECK (tipo_pago IN ('CONTADO', 'CREDITO')),
    dias_credito INT DEFAULT 0,
    fecha_emision DATE DEFAULT CURRENT_DATE,
    fecha_vencimiento_pago DATE,
    moneda TEXT DEFAULT '$/BS',
    destino_despacho TEXT,
    terminos_condiciones TEXT,
    subtotal NUMERIC(12,2) DEFAULT 0.00,
    porcentaje_iva NUMERIC(5,2) DEFAULT 16.00,
    total_general NUMERIC(12,2) DEFAULT 0.00,
    
    -- Firmas y Avales
    elaborado_por_id UUID,
    elaborado_por_nombre TEXT,
    revisado_por_nombre TEXT DEFAULT 'Ricardo Herrera',
    aprobado_por_nombre TEXT DEFAULT 'Carlos Vega',
    comprador_gestor_id UUID,
    comprador_nombre TEXT,
    gerente_compras_id UUID,
    gerente_compras_nombre TEXT DEFAULT 'Ricardo Herrera',
    fecha_aval_compras TIMESTAMPTZ,
    
    -- Despacho y Finanzas
    despachar_a_id UUID,
    despachar_a_direccion TEXT,
    fecha_vencimiento_credito DATE,
    iva_porcentaje NUMERIC(5,2) DEFAULT 16.00,
    iva_monto NUMERIC(12,2) DEFAULT 0.00,
    total NUMERIC(12,2) DEFAULT 0.00,
    tasa_bcv NUMERIC(15,4) DEFAULT 1.00,
    status_pago TEXT DEFAULT 'PENDIENTE',
    
    -- Aprobación Digital Remota Carlos Vega (Gerencia General)
    carlos_firma_digital_activa BOOLEAN DEFAULT FALSE,
    carlos_firma_fecha TIMESTAMPTZ,
    carlos_comentario_aprobacion TEXT,
    
    -- Estatus y Estados
    estatus_pago TEXT DEFAULT 'PENDIENTE' CHECK (estatus_pago IN ('PENDIENTE', 'PAGADO', 'VENCIDO', 'ANULADO')),
    estatus_orden TEXT DEFAULT 'EMITIDA' CHECK (estatus_orden IN ('BORRADOR', 'EMITIDA', 'APROBADA', 'EN_PROCESO', 'COMPLETADA', 'ANULADA')),
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Actualización por si la tabla ya existía
ALTER TABLE IF EXISTS public.ordenes_compra
ADD COLUMN IF NOT EXISTS elaborado_por_id UUID,
ADD COLUMN IF NOT EXISTS elaborado_por_nombre TEXT,
ADD COLUMN IF NOT EXISTS revisado_por_nombre TEXT DEFAULT 'Ricardo Herrera',
ADD COLUMN IF NOT EXISTS aprobado_por_nombre TEXT DEFAULT 'Carlos Vega',
ADD COLUMN IF NOT EXISTS despachar_a_id UUID,
ADD COLUMN IF NOT EXISTS despachar_a_direccion TEXT,
ADD COLUMN IF NOT EXISTS fecha_vencimiento_credito DATE,
ADD COLUMN IF NOT EXISTS iva_porcentaje NUMERIC(5,2) DEFAULT 16.00,
ADD COLUMN IF NOT EXISTS iva_monto NUMERIC(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS total NUMERIC(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS tasa_bcv NUMERIC(15,4) DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS status_pago TEXT DEFAULT 'PENDIENTE';

-- Indexación para optimizar consultas y trazabilidad
CREATE INDEX IF NOT EXISTS idx_odc_numero ON public.ordenes_compra(numero_odc);
CREATE INDEX IF NOT EXISTS idx_odc_requisicion ON public.ordenes_compra(requisicion_id);
CREATE INDEX IF NOT EXISTS idx_odc_proveedor ON public.ordenes_compra(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_odc_vencimiento ON public.ordenes_compra(fecha_vencimiento_pago);

-- 4. Tabla de Detalle / Renglones: ordenes_compra_items
CREATE TABLE IF NOT EXISTS public.ordenes_compra_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orden_compra_id UUID REFERENCES public.ordenes_compra(id) ON DELETE CASCADE,
    requisicion_item_id TEXT,
    item_numero INT,
    descripcion TEXT NOT NULL,
    cantidad NUMERIC(10,2) NOT NULL DEFAULT 1.00,
    unidad TEXT DEFAULT 'UNID',
    precio_unitario NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(12,2) DEFAULT 0.00,
    total_fila NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE IF EXISTS public.ordenes_compra_items 
ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0.00;

CREATE INDEX IF NOT EXISTS idx_odc_items_orden ON public.ordenes_compra_items(orden_compra_id);

-- 5. Habilitar RLS (Row Level Security) y dar permisos
ALTER TABLE public.ordenes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes_compra_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinos_despacho_predeterminados ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para usuarios autenticados
DROP POLICY IF EXISTS "Acceso total a ordenes_compra para usuarios autenticados" ON public.ordenes_compra;
CREATE POLICY "Acceso total a ordenes_compra para usuarios autenticados" 
ON public.ordenes_compra FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total a ordenes_compra_items para usuarios autenticados" ON public.ordenes_compra_items;
CREATE POLICY "Acceso total a ordenes_compra_items para usuarios autenticados" 
ON public.ordenes_compra_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total a destinos_despacho para usuarios autenticados" ON public.destinos_despacho_predeterminados;
CREATE POLICY "Acceso total a destinos_despacho para usuarios autenticados" 
ON public.destinos_despacho_predeterminados FOR ALL TO authenticated USING (true) WITH CHECK (true);
