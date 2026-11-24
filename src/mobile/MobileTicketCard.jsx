import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, CheckCircle2, XCircle, Clock, Calendar } from 'lucide-react';
import MobileSoportesModal from './MobileSoportesModal';

export default function MobileTicketCard({ ticket, currentUser, onAprobar, onRechazar, loadingAction }) {
  const [expandido, setExpandido] = useState(false);
  const [modalSoportes, setModalSoportes] = useState(false);
  const [modalRechazo, setModalRechazo] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  // Desglose de partidas o conceptos
  const items = Array.isArray(ticket.detalles)
    ? ticket.detalles
    : (Array.isArray(ticket.items) ? ticket.items : []);

  // Extraer soportes / comprobantes
  const extraerSoportes = () => {
    const raw = ticket.factura_url || ticket.comprobante_url || ticket.soporte_url || [];
    const list = Array.isArray(raw) ? raw : [raw];
    return list.map((item, idx) => {
      if (!item) return null;
      if (typeof item === 'string') {
        const tr = item.trim();
        if (tr.startsWith('{')) {
          try {
            const parsed = JSON.parse(tr);
            return { url: parsed.url, nombre: parsed.name || parsed.etiqueta || `Soporte #${idx + 1}` };
          } catch {
            return { url: tr, nombre: `Soporte #${idx + 1}` };
          }
        }
        return { url: tr, nombre: `Soporte #${idx + 1}` };
      }
      if (typeof item === 'object' && item.url) {
        return { url: item.url, nombre: item.name || item.etiqueta || `Soporte #${idx + 1}` };
      }
      return null;
    }).filter(Boolean);
  };

  const soportes = extraerSoportes();

  // Permisos de aprobación
  const rolUpper = (currentUser?.rol || '').toUpperCase();
  const esAdmin = currentUser?.esAdminReal || currentUser?.esSuperAdmin || currentUser?.esAdminGlobal || rolUpper.includes('ADMIN') || rolUpper.includes('GERENTE GENERAL') || (currentUser?.correo || '').toLowerCase().includes('cvega');
  const esGerente = esAdmin || rolUpper.includes('GERENTE') || rolUpper.includes('DIRECTOR') || rolUpper.includes('COORDINADOR');

  const esAprobadorAsignado = ticket.aprobador_id && ticket.aprobador_id === currentUser?.id;
  const coincideDepto = ticket.departamento && currentUser?.departamento && ticket.departamento.toLowerCase().trim() === currentUser?.departamento.toLowerCase().trim();
  const obrasAsignadas = currentUser?.obras_asignadas || [];
  const coincideObra = ticket.centro_costo && obrasAsignadas.some(o => o.toLowerCase().trim() === (ticket.centro_costo || '').toLowerCase().trim());
  const sinAprobadorAsignado = !ticket.aprobador_id;

  const esSolicitante = ticket.usuario_id === currentUser?.id || ticket.solicitante === `${currentUser?.nombre} ${currentUser?.apellido}`.trim();

  const puedeAprobar = (ticket.status === 'Pendiente Aprobación' || ticket.status === 'Por Aprobar') &&
    !esSolicitante &&
    (esAdmin || (esGerente && (esAprobadorAsignado || coincideDepto || coincideObra || sinAprobadorAsignado)));

  const handleConfirmarRechazo = () => {
    if (!motivoRechazo.trim()) {
      alert('Por favor ingrese el motivo del rechazo');
      return;
    }
    onRechazar(ticket, motivoRechazo.trim());
    setModalRechazo(false);
    setMotivoRechazo('');
  };

  const getStatusBadge = () => {
    const est = (ticket.status || '').toLowerCase();
    if (est === 'emitido' || est === 'aprobado') {
      return <span className="m-status-pill m-status-info"><CheckCircle2 size={12} /> Emitido</span>;
    }
    if (est === 'pagado') {
      return <span className="m-status-pill m-status-success"><CheckCircle2 size={12} /> Pagado</span>;
    }
    if (est.includes('pendiente') || est.includes('aprobar')) {
      return <span className="m-status-pill m-status-warning"><Clock size={12} /> Por Aprobar</span>;
    }
    if (est === 'rechazado' || est === 'anulado') {
      return <span className="m-status-pill m-status-danger"><XCircle size={12} /> {ticket.status}</span>;
    }
    return <span className="m-status-pill m-status-info">{ticket.status}</span>;
  };

  const montoTotalUSD = parseFloat(ticket.monto_total || ticket.monto || 0);
  const montoBS = parseFloat(ticket.monto_bs || 0);

  return (
    <>
      <div className="m-card">
        {/* Cabecera / Resumen Compacto Clickeable */}
        <div className="m-card-compact-row" onClick={() => setExpandido(!expandido)}>
          <div className="m-card-header">
            <div className="m-card-id-row">
              <span className="m-card-id">{ticket.codigo_ticket || ticket.codigo_control || `TK-#${ticket.id}`}</span>
              <span className="m-card-date">
                <Calendar size={12} color="#64748b" />
                {ticket.created_at || ticket.fecha ? new Date(ticket.created_at || ticket.fecha).toLocaleDateString('es-VE') : 'Sin fecha'}
              </span>
            </div>
            <div>{getStatusBadge()}</div>
          </div>

          <div className="m-compact-meta">
            <span className="m-compact-user" style={{ color: '#38bdf8' }}>{ticket.proveedor_nombre || ticket.beneficiario || 'Beneficiario'}</span>
            <span className="m-compact-dot">•</span>
            <span className="m-compact-dept">{ticket.solicitante || 'Usuario'}</span>
            {(ticket.centro_costo || ticket.departamento) && (
              <>
                <span className="m-compact-dot">•</span>
                <span className="m-compact-cc">{ticket.centro_costo || ticket.departamento}</span>
              </>
            )}
          </div>

          <div className="m-compact-bottom">
            <div className="m-compact-amount">
              <span className="m-compact-amount-label">Monto a Pagar</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span className="m-compact-amount-val">
                  ${montoTotalUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {montoBS > 0 && (
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    ({montoBS.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs)
                  </span>
                )}
              </div>
            </div>

            <div className="m-compact-toggle">
              {items.length > 0 && (
                <span className="m-compact-items-count">
                  {items.length} {items.length === 1 ? 'partida' : 'partidas'}
                </span>
              )}
              <div className="m-chevron-circle" title={expandido ? 'Colapsar' : 'Ver detalle y aprobar'}>
                {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>
          </div>
        </div>

        {/* Contenido Expandido */}
        {expandido && (
          <div className="m-card-expanded">
            {/* Detalles / Justificación */}
            <div className="m-card-body">
              {ticket.justificacion && (
                <div className="m-info-group full">
                  <span className="m-info-label">Concepto / Justificación</span>
                  <span className="m-info-value" style={{ fontWeight: 400, color: '#cbd5e1' }}>
                    {ticket.justificacion}
                  </span>
                </div>
              )}

              {ticket.motivo_rechazo && (
                <div className="m-info-group full" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <span className="m-info-label" style={{ color: '#f87171' }}>Motivo de Rechazo:</span>
                  <span className="m-info-value" style={{ color: '#fca5a5' }}>{ticket.motivo_rechazo}</span>
                </div>
              )}
            </div>

            {/* Desglose de Conceptos/Partidas si existen */}
            {items.length > 0 && (
              <div className="m-items-summary">
                <div className="m-items-header">
                  <span>Partidas ({items.length})</span>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Desglose</span>
                </div>

                <div className="m-items-list">
                  {items.map((it, idx) => (
                    <div key={idx} className="m-item-card">
                      <div className="m-item-card-left">
                        <span className="m-item-number">#{idx + 1}</span>
                        <span className="m-item-desc">{it.descripcion || it.concepto || `Partida #${idx + 1}`}</span>
                      </div>
                      <div className="m-item-card-right">
                        <span className="m-item-qty-badge" style={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.15)' }}>
                          ${(parseFloat(it.monto || it.subtotal || 0)).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botón Soportes / Comprobantes */}
            {soportes.length > 0 && (
              <button className="m-btn-soportes" onClick={() => setModalSoportes(true)}>
                <FileText size={15} />
                <span>Ver Comprobantes y Facturas ({soportes.length})</span>
              </button>
            )}

            {/* Botones de Aprobación / Rechazo táctiles */}
            {puedeAprobar && (
              <div className="m-card-actions">
                <button
                  className="m-btn m-btn-reject"
                  onClick={() => setModalRechazo(true)}
                  disabled={loadingAction}
                >
                  <XCircle size={18} />
                  <span>Rechazar</span>
                </button>

                <button
                  className="m-btn m-btn-approve"
                  onClick={() => onAprobar(ticket)}
                  disabled={loadingAction}
                >
                  <CheckCircle2 size={18} />
                  <span>Aprobar Ticket</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Soportes */}
      <MobileSoportesModal
        isOpen={modalSoportes}
        onClose={() => setModalSoportes(false)}
        soportes={soportes}
        titulo={`Comprobantes: ${ticket.codigo_ticket || ticket.codigo_control || ''}`}
      />

      {/* Modal para ingresar motivo de rechazo */}
      {modalRechazo && (
        <div className="m-modal-overlay" onClick={() => setModalRechazo(false)}>
          <div className="m-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="m-modal-header">
              <h3 className="m-modal-title">Rechazar Ticket</h3>
              <button className="m-btn-icon" onClick={() => setModalRechazo(false)}>
                <XCircle size={20} />
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 12px 0' }}>
              Indique el motivo por el cual rechaza este ticket de pago.
            </p>
            <textarea
              autoFocus
              className="m-search-input"
              rows={4}
              placeholder="Escriba el motivo aquí..."
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              style={{ minHeight: '100px', resize: 'none', marginBottom: '16px' }}
            />
            <div className="m-card-actions">
              <button className="m-btn m-btn-reject" onClick={() => setModalRechazo(false)}>
                Cancelar
              </button>
              <button
                className="m-btn"
                style={{ background: '#ef4444', color: 'white' }}
                onClick={handleConfirmarRechazo}
                disabled={loadingAction}
              >
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

