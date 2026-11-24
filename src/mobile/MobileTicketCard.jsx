import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, CheckCircle2, XCircle, Clock, DollarSign } from 'lucide-react';
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
        {/* Encabezado */}
        <div className="m-card-header">
          <div>
            <div className="m-card-id">{ticket.codigo_ticket || ticket.codigo_control || `TK-#${ticket.id}`}</div>
            <div className="m-card-date">
              {ticket.created_at || ticket.fecha ? new Date(ticket.created_at || ticket.fecha).toLocaleDateString('es-VE') : 'Sin fecha'}
            </div>
          </div>
          <div>{getStatusBadge()}</div>
        </div>

        {/* Datos Principales */}
        <div className="m-card-body">
          <div className="m-info-group full">
            <span className="m-info-label">Beneficiario / Proveedor</span>
            <span className="m-info-value" style={{ color: '#38bdf8' }}>
              {ticket.proveedor_nombre || ticket.beneficiario || 'No especificado'}
            </span>
          </div>

          <div className="m-info-group">
            <span className="m-info-label">Solicitante</span>
            <span className="m-info-value">{ticket.solicitante || 'Usuario'}</span>
          </div>

          <div className="m-info-group">
            <span className="m-info-label">C. Costo / Obra</span>
            <span className="m-info-value">{ticket.centro_costo || ticket.departamento || 'No definido'}</span>
          </div>

          <div className="m-info-group full">
            <span className="m-info-label">Monto a Pagar</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span className="m-info-amount">
                ${montoTotalUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {montoBS > 0 && (
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  ({montoBS.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs)
                </span>
              )}
            </div>
          </div>

          {ticket.justificacion && (
            <div className="m-info-group full">
              <span className="m-info-label">Concepto / Justificación</span>
              <span className="m-info-value" style={{ fontWeight: 400, color: '#cbd5e1' }}>
                {ticket.justificacion}
              </span>
            </div>
          )}

          {ticket.motivo_rechazo && (
            <div className="m-info-group full" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <span className="m-info-label" style={{ color: '#f87171' }}>Motivo de Rechazo:</span>
              <span className="m-info-value" style={{ color: '#fca5a5' }}>{ticket.motivo_rechazo}</span>
            </div>
          )}
        </div>

        {/* Desglose de Conceptos/Partidas si existen */}
        {items.length > 0 && (
          <div className="m-items-summary">
            <div className="m-items-header" onClick={() => setExpandido(!expandido)}>
              <span>Partidas / Conceptos ({items.length})</span>
              {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>

            {expandido && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {items.map((it, idx) => (
                  <div key={idx} className="m-item-row">
                    <span className="m-item-name">{it.descripcion || it.concepto || `Partida #${idx + 1}`}</span>
                    <span className="m-item-qty">
                      ${(parseFloat(it.monto || it.subtotal || 0)).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            )}
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

