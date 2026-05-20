-- SQL Update for Requisitions Purchase SLA and Start Stage

-- 1. Create or replace the unified trigger function for SLA and Performance Metrics
CREATE OR REPLACE FUNCTION funcion_trigger_sla_performance()
RETURNS TRIGGER AS $$
BEGIN
    -- A. START: When first approved (Transition to 'aprobado_final')
    IF (NEW.estado_aprobacion = 'aprobado_final' AND (OLD.estado_aprobacion IS NULL OR OLD.estado_aprobacion != 'aprobado_final')) THEN
        NEW.fecha_aprobacion_final := NOW();
        NEW.f_inicio_compras := NOW();
        NEW.sla_cumplimiento := 'PENDIENTE';
        
        -- Calculate deadline based on priority (24 hours for Emergency, 5 business days for Normal)
        IF NEW.prioridad = 'Emergencia' THEN
            NEW.fecha_limite_compra := NOW() + INTERVAL '24 hours';
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
        NEW.f_finalizado := NOW();
        
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
