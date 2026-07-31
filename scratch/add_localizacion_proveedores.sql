-- Migration to add localizacion column to proveedores table
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS localizacion TEXT;
