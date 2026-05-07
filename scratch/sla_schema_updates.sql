-- SQL Script for SLA Control and Advanced Analytics in Requisiciones

-- 1. Add new columns to 'requisiciones' table for SLA and Performance Metrics
ALTER TABLE requisiciones 
ADD COLUMN IF NOT EXISTS fecha_aprobacion_final TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS fecha_limite_compra TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_pausada BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS motivo_postergacion TEXT,
ADD COLUMN IF NOT EXISTS tiempo_pausado_total INTERVAL DEFAULT '0 seconds',
-- New Performance Metrics
ADD COLUMN IF NOT EXISTS sla_cumplimiento TEXT, -- 'A TIEMPO', 'VENCIDO', 'PENDIENTE'
ADD COLUMN IF NOT EXISTS dias_totales_proceso DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS dias_en_aprobacion DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS dias_en_compra DECIMAL(10,2);

-- 2. Create audit logs table (Extended for tracking)
CREATE TABLE IF NOT EXISTS requisicion_logs (
    id BIGSERIAL PRIMARY KEY,
    requisicion_id BIGINT REFERENCES requisiciones(id) ON DELETE CASCADE,
    usuario_id UUID,
    usuario_nombre TEXT,
    accion TEXT, -- 'PAUSA', 'REANUDACIÓN', 'SLA_CALCULO', 'FINALIZADO'
    comentario TEXT,
    fecha TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Advanced Function to calculate business days (skipping weekends)
CREATE OR REPLACE FUNCTION add_business_days(start_date TIMESTAMPTZ, days_to_add INTEGER)
RETURNS TIMESTAMPTZ AS $$
DECLARE
    fecha_rastreo TIMESTAMPTZ := start_date;
    added_days INTEGER := 0;
BEGIN
    WHILE added_days < days_to_add LOOP
        fecha_rastreo := fecha_rastreo + INTERVAL '1 day';
        -- Skip Saturday (6) and Sunday (0)
        IF EXTRACT(DOW FROM fecha_rastreo) NOT IN (0, 6) THEN
            added_days := added_days + 1;
        END IF;
    END LOOP;
    RETURN fecha_rastreo;
END;
$$ LANGUAGE plpgsql;

-- 4. Unified Trigger Function for SLA and Performance Metrics
CREATE OR REPLACE FUNCTION funcion_trigger_sla_performance()
RETURNS TRIGGER AS $$
BEGIN
    -- A. START: When first approved (Transition to 'aprobado_final')
    IF (NEW.estado_aprobacion = 'aprobado_final' AND (OLD.estado_aprobacion IS NULL OR OLD.estado_aprobacion != 'aprobado_final')) THEN
        NEW.fecha_aprobacion_final := NOW();
        NEW.sla_cumplimiento := 'PENDIENTE';
        
        -- Calculate deadline based on priority
        IF NEW.prioridad = 'Emergencia' THEN
            NEW.fecha_limite_compra := add_business_days(NOW(), 1);
        ELSE
            NEW.fecha_limite_compra := add_business_days(NOW(), 5);
        END IF;

        -- Metrics: Time spent in approval stage (from creation to final approval)
        NEW.dias_en_aprobacion := EXTRACT(EPOCH FROM (NOW() - NEW.created_at)) / 86400;

        -- Log initial calculation
        INSERT INTO requisicion_logs (requisicion_id, accion, comentario)
        VALUES (NEW.id, 'SLA_CALCULO', 'SLA iniciado. Prioridad: ' || NEW.prioridad || '. Tiempo en aprobación: ' || ROUND(NEW.dias_en_aprobacion, 2) || ' días.');
    END IF;

    -- B. END: When purchase is completed (SLA Ends)
    IF (NEW.status_compra = 'Completado' AND (OLD.status_compra IS NULL OR OLD.status_compra != 'Completado')) THEN
        NEW.f_culminacion_compras := NOW();
        
        -- Metrics: Time spent in purchase stage and total process
        NEW.dias_en_compra := EXTRACT(EPOCH FROM (NOW() - NEW.fecha_aprobacion_final)) / 86400;
        NEW.dias_totales_proceso := EXTRACT(EPOCH FROM (NOW() - NEW.created_at)) / 86400;

        -- Final Compliance Check (Accounting for paused time)
        IF NOW() <= (NEW.fecha_limite_compra + COALESCE(NEW.tiempo_pausado_total, '0 seconds')) THEN
            NEW.sla_cumplimiento := 'A TIEMPO';
        ELSE
            NEW.sla_cumplimiento := 'VENCIDO';
        END IF;

        -- Log completion
        INSERT INTO requisicion_logs (requisicion_id, accion, comentario)
        VALUES (NEW.id, 'FINALIZADO', 'Compra completada. Cumplimiento: ' || NEW.sla_cumplimiento || '. Días en compra: ' || ROUND(NEW.dias_en_compra, 2));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Attach trigger to table
DROP TRIGGER IF EXISTS trigger_sla_performance ON requisiciones;
CREATE TRIGGER trigger_sla_performance
BEFORE UPDATE ON requisiciones
FOR EACH ROW
EXECUTE FUNCTION funcion_trigger_sla_performance();
