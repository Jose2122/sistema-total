-- Migration to add cuentas_bancarias column to proveedores table
-- Execute this SQL query in your Supabase SQL Editor
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS cuentas_bancarias JSONB DEFAULT '[]'::jsonb;
