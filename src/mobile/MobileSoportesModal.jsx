import React from 'react';
import { X, FileText, Image as ImageIcon, ExternalLink, Download } from 'lucide-react';

export default function MobileSoportesModal({ isOpen, onClose, soportes = [], titulo = 'Soportes y Facturas' }) {
  if (!isOpen) return null;

  const esImagen = (url) => {
    if (!url || typeof url !== 'string') return false;
    const clean = url.split('?')[0].toLowerCase();
    return clean.endsWith('.png') || clean.endsWith('.jpg') || clean.endsWith('.jpeg') || clean.endsWith('.webp') || url.startsWith('data:image/');
  };

  const esPdf = (url) => {
    if (!url || typeof url !== 'string') return false;
    const clean = url.split('?')[0].toLowerCase();
    return clean.endsWith('.pdf') || url.startsWith('data:application/pdf');
  };

  return (
    <div className="m-modal-overlay" onClick={onClose}>
      <div className="m-modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="m-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="#38bdf8" />
            <h3 className="m-modal-title">{titulo}</h3>
          </div>
          <button className="m-btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', maxHeight: '60vh', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
          {soportes.length === 0 ? (
            <div className="m-empty-state">
              <FileText size={40} />
              <p>No hay documentos ni soportes adjuntos a este registro.</p>
            </div>
          ) : (
            soportes.map((sop, idx) => {
              const url = typeof sop === 'string' ? sop : sop.url;
              const nombre = typeof sop === 'object' ? (sop.nombre || sop.etiqueta || `Soporte #${idx + 1}`) : `Soporte #${idx + 1}`;
              const isImg = esImagen(url);
              const isP = esPdf(url);

              return (
                <div
                  key={idx}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '14px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      {isImg ? <ImageIcon size={18} color="#10b981" /> : isP ? <FileText size={18} color="#f43f5e" /> : <FileText size={18} color="#38bdf8" />}
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {nombre}
                      </span>
                    </div>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="m-btn-soportes"
                      style={{ textDecoration: 'none', padding: '6px 10px', fontSize: '0.75rem' }}
                    >
                      <span>Abrir</span>
                      <ExternalLink size={14} />
                    </a>
                  </div>

                  {/* Previsualización rápida si es imagen */}
                  {isImg && (
                    <div style={{ borderRadius: '10px', overflow: 'hidden', maxHeight: '180px', backgroundColor: '#000', display: 'flex', justifyContent: 'center' }}>
                      <img
                        src={url}
                        alt={nombre}
                        style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain' }}
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

