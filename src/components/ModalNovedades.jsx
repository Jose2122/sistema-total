import React from 'react';
import { X, Sparkles, CheckCircle2 } from 'lucide-react';

export default function ModalNovedades({ isOpen, version, descripcion, onClose }) {
  if (!isOpen) return null;

  // Separar líneas por saltos de línea para renderizar en viñetas
  const lineas = descripcion
    ? descripcion.split('\n').map(l => l.trim()).filter(Boolean)
    : [];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'modalNovedadesFadeIn 0.3s ease-out',
      }}
    >
      <style>{`
        @keyframes modalNovedadesFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalNovedadesScaleIn {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .modal-novedades-card::-webkit-scrollbar { width: 5px; }
        .modal-novedades-card::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .modal-novedades-item {
          transition: background-color 0.15s ease, transform 0.15s ease;
        }
        .modal-novedades-item:hover {
          background-color: rgba(99, 102, 241, 0.06) !important;
          transform: translateX(2px);
        }
        .modal-novedades-btn {
          transition: all 0.15s ease;
        }
        .modal-novedades-btn:hover {
          background-color: #4f46e5 !important;
          transform: scale(1.03);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.35) !important;
        }
        .modal-novedades-btn:active {
          transform: scale(0.97);
        }
        .modal-novedades-close {
          transition: background-color 0.2s ease;
        }
        .modal-novedades-close:hover {
          background-color: rgba(255, 255, 255, 0.25) !important;
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#ffffff',
          borderRadius: '18px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255,255,255,0.05)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'modalNovedadesScaleIn 0.35s ease-out',
        }}
      >
        {/* Header con gradiente premium */}
        <div
          style={{
            padding: '24px',
            background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 50%, #8b5cf6 100%)',
            color: '#ffffff',
            position: 'relative',
          }}
        >
          <button
            onClick={onClose}
            className="modal-novedades-close"
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              padding: '6px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 0,
            }}
            title="Cerrar"
          >
            <X size={16} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                padding: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '14px',
                lineHeight: 0,
              }}
            >
              <Sparkles size={24} style={{ color: '#fde047' }} />
            </div>
            <div>
              <span
                style={{
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  display: 'inline-block',
                }}
              >
                ¡Nueva Versión!
              </span>
              <h2
                style={{
                  fontSize: '1.3rem',
                  fontWeight: 900,
                  marginTop: '5px',
                  lineHeight: 1.1,
                  margin: '5px 0 0 0',
                }}
              >
                Novedades v{version}
              </h2>
            </div>
          </div>
        </div>

        {/* Contenido / Cambios */}
        <div
          className="modal-novedades-card"
          style={{
            padding: '20px 22px',
            maxHeight: '320px',
            overflowY: 'auto',
          }}
        >
          <p
            style={{
              fontSize: '10px',
              color: '#64748b',
              fontWeight: 800,
              marginBottom: '14px',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Cambios y mejoras:
          </p>
          {lineas.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
              No hay detalles específicos de cambios para esta versión.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {lineas.map((linea, index) => {
                const textoLimpio = linea.replace(/^-\s*/, '').replace(/^\*\s*/, '');
                return (
                  <div
                    key={index}
                    className="modal-novedades-item"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '10px 12px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '12px',
                      border: '1px solid #f1f5f9',
                    }}
                  >
                    <CheckCircle2
                      size={15}
                      style={{ color: '#6366f1', marginTop: '2px', flexShrink: 0 }}
                    />
                    <p
                      style={{
                        fontSize: '12px',
                        color: '#334155',
                        fontWeight: 600,
                        lineHeight: 1.5,
                        margin: 0,
                      }}
                    >
                      {textoLimpio}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 22px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            className="modal-novedades-btn"
            style={{
              padding: '9px 22px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#ffffff',
              backgroundColor: '#6366f1',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.25)',
            }}
          >
            ¡Entendido!
          </button>
        </div>
      </div>
    </div>
  );
}
