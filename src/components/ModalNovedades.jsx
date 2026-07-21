import React, { useState, useEffect } from 'react';
import { X, Sparkles, CheckCircle2, ChevronRight, ChevronLeft, CreditCard, Award, TrendingUp, ShieldCheck, ArrowRight, Package, Flame, Star, ShoppingCart, DollarSign, Bell } from 'lucide-react';

export default function ModalNovedades({ isOpen, isInline = false, version = '2.5.0', descripcion, onClose }) {
  const [pasoActual, setPasoActual] = useState(0);
  const [confirmado, setConfirmado] = useState(false);

  // Parsear la descripción en tarjetas individuales
  const lineasRaw = descripcion
    ? descripcion.split('\n').map(l => l.trim()).filter(Boolean)
    : [];

  // Novedades por defecto de la versión actual si no vienen estructuradas desde Supabase
  const novedadesDefault = [
    {
      titulo: 'Sección de Entregados & Justificaciones',
      modulo: 'Almacén',
      prioridad: '⭐ IMPORTANTE',
      icono: <Package size={28} style={{ color: '#10b981' }} />,
      colorBadge: '#10b981',
      bgGradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      resumen: 'Almacén ahora puede indicar a los usuarios cuando sus pedidos han sido entregados, junto con un ícono de alerta para marcar justificaciones u observaciones.'
    },
    {
      titulo: 'Asignación de Comprador y Filtro Semanal',
      modulo: 'Compras y Requisiciones',
      prioridad: '⚡ NUEVA FUNCIÓN',
      icono: <ShoppingCart size={28} style={{ color: '#6366f1' }} />,
      colorBadge: '#6366f1',
      bgGradient: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
      resumen: 'El tiempo de compra no inicia hasta que se le asigne un comprador. Se agrega filtro de compras semanales y buscador rápido por descripción.'
    },
    {
      titulo: 'Aprobación Gerencial y Trazabilidad',
      modulo: 'Tickets de Pago',
      prioridad: '🔥 CRÍTICO',
      icono: <DollarSign size={28} style={{ color: '#e11d48' }} />,
      colorBadge: '#e11d48',
      bgGradient: 'linear-gradient(135deg, #be123c 0%, #f43f5e 100%)',
      resumen: 'Flujo de aprobación multinivel por Gerente de Área y Gerente General, incorporando reloj de trazabilidad con fechas, horas y tiempos de gestión.'
    },
    {
      titulo: 'Planificación Semanal & Reportes Pendientes',
      modulo: 'Solicitud de Fondos',
      prioridad: '⚡ NUEVA FUNCIÓN',
      icono: <CreditCard size={28} style={{ color: '#0ea5e9' }} />,
      colorBadge: '#0ea5e9',
      bgGradient: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
      resumen: 'La gestión de compra inicia la semana posterior a la solicitud para planificar fondos. Se agrega sección de Completados y reporte de ítems pendientes.'
    }
  ];

  // Si hay líneas personalizadas, las transformamos limpiamente en tarjetas
  const tarjetas = lineasRaw.length > 0
    ? lineasRaw.map((linea, index) => {
        let textoLimpio = linea.replace(/^-\s*/, '').replace(/^\*\s*/, '').replace(/^✓\s*/, '').trim();
        
        // Detectar y extraer Prioridad (ej: 🔥 [CRÍTICO], ⭐ [IMPORTANTE], ⚡ [NUEVO])
        let prioridad = 'NORMAL';
        if (/🔥|\[(CRÍTICO|CRITICO|ALTA|URGENTE)\]/i.test(textoLimpio)) {
          prioridad = '🔥 CRÍTICO';
          textoLimpio = textoLimpio.replace(/🔥|\[(CRÍTICO|CRITICO|ALTA|URGENTE)\]/gi, '').trim();
        } else if (/⭐|\[(IMPORTANTE|DESTACADO)\]/i.test(textoLimpio)) {
          prioridad = '⭐ IMPORTANTE';
          textoLimpio = textoLimpio.replace(/⭐|\[(IMPORTANTE|DESTACADO)\]/gi, '').trim();
        } else if (/⚡|\[(NUEVO|NUEVA|FUNCIÓN)\]/i.test(textoLimpio)) {
          prioridad = '⚡ NUEVO';
          textoLimpio = textoLimpio.replace(/⚡|\[(NUEVO|NUEVA|FUNCIÓN)\]/gi, '').trim();
        }

        // Extract Módulo [Nombre] o (Módulo: Nombre)
        let modulo = 'Sistema';
        const matchBracket = textoLimpio.match(/^\[([^\]]+)\]/);
        if (matchBracket) {
          modulo = matchBracket[1].trim();
          textoLimpio = textoLimpio.replace(/^\[([^\]]+)\]/, '').trim();
        } else {
          const matchModulo = textoLimpio.match(/\(Módulo:\s*([^)]+)\)/i);
          if (matchModulo) {
            modulo = matchModulo[1].trim();
            textoLimpio = textoLimpio.replace(/\(Módulo:\s*([^)]+)\)/i, '').trim();
          }
        }

        let titulo = '';
        let resumen = '';

        // Separar Título y Descripción por ':', '-' o '|'
        if (textoLimpio.includes(':')) {
          const idx = textoLimpio.indexOf(':');
          titulo = textoLimpio.substring(0, idx).trim();
          resumen = textoLimpio.substring(idx + 1).trim();
        } else if (textoLimpio.includes(' - ')) {
          const idx = textoLimpio.indexOf(' - ');
          titulo = textoLimpio.substring(0, idx).trim();
          resumen = textoLimpio.substring(idx + 3).trim();
        } else if (textoLimpio.includes(' | ')) {
          const idx = textoLimpio.indexOf(' | ');
          titulo = textoLimpio.substring(0, idx).trim();
          resumen = textoLimpio.substring(idx + 3).trim();
        } else {
          const palabras = textoLimpio.split(' ');
          if (palabras.length > 6) {
            titulo = palabras.slice(0, 5).join(' ') + '...';
            resumen = textoLimpio;
          } else {
            titulo = textoLimpio;
            resumen = 'Se incorporaron optimizaciones y mejoras para esta función.';
          }
        }

        // Asignar colores e icono dinámicamente según prioridad y departamento/módulo
        let bgGradient = 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)';
        let colorIcono = '#6366f1';
        let icono = <Sparkles size={28} style={{ color: colorIcono }} />;

        const modLower = modulo.toLowerCase();
        if (modLower.includes('almacén') || modLower.includes('almacen')) {
          colorIcono = '#10b981';
          icono = <Package size={28} style={{ color: colorIcono }} />;
          bgGradient = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
        } else if (modLower.includes('compras') || modLower.includes('requisiciones')) {
          colorIcono = '#6366f1';
          icono = <ShoppingCart size={28} style={{ color: colorIcono }} />;
          bgGradient = 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)';
        } else if (modLower.includes('ticket') || modLower.includes('pago') || modLower.includes('cuentas')) {
          colorIcono = '#f59e0b';
          icono = <DollarSign size={28} style={{ color: colorIcono }} />;
          bgGradient = 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)';
        } else if (modLower.includes('fondos')) {
          colorIcono = '#0ea5e9';
          icono = <CreditCard size={28} style={{ color: colorIcono }} />;
          bgGradient = 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)';
        }

        // Si la prioridad es CRÍTICA, aplicar tema carmesí resaltado
        if (prioridad.includes('CRÍTICO')) {
          bgGradient = 'linear-gradient(135deg, #be123c 0%, #f43f5e 100%)';
          colorIcono = '#f43f5e';
          icono = <Flame size={28} style={{ color: colorIcono }} />;
        } else if (prioridad.includes('IMPORTANTE')) {
          bgGradient = 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)';
          colorIcono = '#f59e0b';
          icono = <Star size={28} style={{ color: colorIcono }} />;
        }

        return {
          titulo: titulo || `Novedad #${index + 1}`,
          modulo,
          prioridad,
          icono,
          bgGradient,
          resumen: resumen || titulo
        };
      })
    : novedadesDefault;

  // Reiniciar estado cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setPasoActual(0);
      setConfirmado(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const esUltimoPaso = pasoActual === tarjetas.length - 1;
  const pasoSeguro = Math.min(pasoActual, tarjetas.length - 1);
  const tarjetaActual = tarjetas[pasoSeguro] || tarjetas[0];
  const porcentajeProgreso = ((pasoSeguro + 1) / tarjetas.length) * 100;

  const handleSiguiente = () => {
    if (pasoActual < tarjetas.length - 1) {
      setPasoActual(prev => prev + 1);
    }
  };

  const handleAnterior = () => {
    if (pasoActual > 0) {
      setPasoActual(prev => prev - 1);
    }
  };

  const handleFinalizar = () => {
    setConfirmado(true);
    if (onClose) onClose();
  };

  const wrapperStyle = isInline
    ? {
        width: '100%',
        borderRadius: '18px',
        overflow: 'hidden',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
      }
    : {
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'modalNovedadesFadeIn 0.3s ease-out',
      };

  const cardContainerStyle = isInline
    ? {
        width: '100%',
        backgroundColor: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
      }
    : {
        width: '100%',
        maxWidth: '480px',
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        boxShadow: '0 25px 70px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255,255,255,0.1)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: 'modalNovedadesScaleIn 0.35s cubic-bezier(0.19, 1, 0.22, 1)',
      };

  return (
    <div style={wrapperStyle}>
      <style>{`
        @keyframes modalNovedadesFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalNovedadesScaleIn {
          from { opacity: 0; transform: scale(0.92) translateY(16px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .modal-novedades-btn-sig {
          transition: all 0.2s cubic-bezier(0.19, 1, 0.22, 1);
        }
        .modal-novedades-btn-sig:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4) !important;
        }
        .modal-novedades-dot {
          transition: all 0.3s ease;
        }
      `}</style>

      <div style={cardContainerStyle}>
        {/* Header con gradiente dinámico según tarjeta */}
        <div
          style={{
            padding: '24px 26px 20px 26px',
            background: tarjetaActual.bgGradient || 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
            color: '#ffffff',
            position: 'relative',
            transition: 'background 0.5s ease',
          }}
        >
          {/* Botón X disponible solo si ya se vio o se navega */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              padding: '6px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.18)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
            }}
            title="Cerrar (Omitir)"
          >
            <X size={16} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span
              style={{
                fontSize: '10px',
                textTransform: 'uppercase',
                fontWeight: 900,
                letterSpacing: '0.08em',
                backgroundColor: 'rgba(255, 255, 255, 0.22)',
                padding: '4px 10px',
                borderRadius: '20px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Sparkles size={12} style={{ color: '#fde047' }} />
              Novedades v{version}
            </span>

            {/* Contador de pasos */}
            <span style={{ fontSize: '11px', fontWeight: 800, opacity: 0.9 }}>
              {pasoActual + 1} de {tarjetas.length}
            </span>
          </div>

          <h2
            style={{
              fontSize: '1.35rem',
              fontWeight: 900,
              margin: '0 0 6px 0',
              lineHeight: 1.25,
            }}
          >
            {tarjetaActual.titulo}
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, backgroundColor: 'rgba(0,0,0,0.22)', padding: '3px 9px', borderRadius: '6px' }}>
              📍 {tarjetaActual.modulo}
            </div>
            {tarjetaActual.prioridad && tarjetaActual.prioridad !== 'NORMAL' && (
              <div style={{ fontSize: '10px', fontWeight: 900, backgroundColor: 'rgba(255,255,255,0.28)', color: '#ffffff', padding: '3px 9px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {tarjetaActual.prioridad}
              </div>
            )}
          </div>

          {/* Barra de progreso superior */}
          <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: '4px', marginTop: '16px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${porcentajeProgreso}%`,
                height: '100%',
                backgroundColor: '#ffffff',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>

        {/* Cuerpo de la tarjeta actual */}
        <div
          style={{
            padding: '24px 26px',
            minHeight: '160px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div
              style={{
                padding: '14px',
                borderRadius: '16px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {tarjetaActual.icono}
            </div>

            <div>
              <p
                style={{
                  fontSize: '13px',
                  color: '#334155',
                  fontWeight: 600,
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {tarjetaActual.resumen}
              </p>
            </div>
          </div>
        </div>

        {/* Indicadores de puntos / Navegación */}
        <div
          style={{
            padding: '14px 26px 20px 26px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Puntos de navegación */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {tarjetas.map((_, idx) => (
              <div
                key={idx}
                onClick={() => setPasoActual(idx)}
                className="modal-novedades-dot"
                style={{
                  width: idx === pasoActual ? '20px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  backgroundColor: idx === pasoActual ? '#6366f1' : '#cbd5e1',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>

          {/* Botones Anterior / Siguiente / Finalizar */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {pasoActual > 0 && (
              <button
                type="button"
                onClick={handleAnterior}
                style={{
                  padding: '9px 14px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#475569',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <ChevronLeft size={16} />
                Atrás
              </button>
            )}

            {!esUltimoPaso ? (
              <button
                type="button"
                onClick={handleSiguiente}
                className="modal-novedades-btn-sig"
                style={{
                  padding: '10px 22px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#ffffff',
                  backgroundColor: '#6366f1',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>Siguiente</span>
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinalizar}
                className="modal-novedades-btn-sig"
                style={{
                  padding: '10px 24px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 900,
                  color: '#ffffff',
                  backgroundColor: '#10b981',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <CheckCircle2 size={16} />
                <span>¡Entendido, ir al Sistema!</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

