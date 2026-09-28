-- Migración para soporte de Proveedores Preferenciales y Trazabilidad en tabla 'proveedores'
-- Ejecutar en el SQL Editor de Supabase

ALTER TABLE IF EXISTS proveedores
  ADD COLUMN IF NOT EXISTS es_preferencial BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS nivel_preferencial TEXT DEFAULT 'Regular',
  ADD COLUMN IF NOT EXISTS descuento_pactado_porcentaje NUMERIC(5,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS dias_credito_pactados INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tiempo_entrega_acordado_dias INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vigencia_acuerdo_desde DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vigencia_acuerdo_hasta DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS condiciones_acuerdo_nota TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS creado_por TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS creado_por_nombre TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actualizado_por TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actualizado_por_nombre TEXT DEFAULT NULL;

-- Comentario descriptivo
COMMENT ON COLUMN proveedores.es_preferencial IS 'Indica si el proveedor posee acuerdo comercial preferencial institucional';
COMMENT ON COLUMN proveedores.nivel_preferencial IS 'Nivel o Tier preferencial (Tier 1 / Oro, Tier 2 / Plata, Regular)';
COMMENT ON COLUMN proveedores.descuento_pactado_porcentaje IS 'Porcentaje de descuento comercial acordado';
COMMENT ON COLUMN proveedores.dias_credito_pactados IS 'Días de crédito pactados en el acuerdo';
