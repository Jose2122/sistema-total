import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, CheckCircle2, XCircle, AlertCircle, Clock, ShieldCheck, Zap, Calendar } from 'lucide-react';
import MobileSoportesModal from './MobileSoportesModal';

export default function MobileReqCard({ req, currentUser, onAprobar, onRechazar, loadingAction }) {
  const [expandido, setExpandido] = useState(false);
  const [modalSoportes, setModalSoportes] = useState(false);
  const [modalRechazo, setModalRechazo] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  const items = Array.isArray(req.items) ? req.items : [];
  const soportes = Array.isArray(req.soportes) ? req.soportes : [];

  // Calcular total estimado
  const totalEstimado = items.reduce((acc, it) => {
    if (it.total !== undefined && it.total !== null && !isNaN(parseFloat(it.total))) {
      return acc + parseFloat(it.total);
    }
    const qty = parseFloat(it.cantidad || it.cant || 1) || 1;
    const precio = parseFloat(it.pu || it.costo_unitario || it.precio_unitario || it.precio || 0) || 0;
    return acc + (qty * precio);
  }, 0);

  // Permisos de aprobación
  const rolUpper = (currentUser?.rol || '').toUpperCase();
  const emailLower = (currentUser?.correo || currentUser?.email || '').toLowerCase();
  const esFavio = (currentUser?.nombre || '').toUpperCase().includes('FAVIO') && (currentUser?.apellido || '').toUpperCase().includes('BAVUSO');
  const esGG = currentUser?.esAdminReal || currentUser?.esSuperAdmin || rolUpper.includes('GERENTE GENERAL') || rolUpper.includes('ADMIN') || emailLower.includes('cvega') || esFavio;
  const esGerenteArea = (currentUser?.rol?.toLowerCase()?.includes('gerente') && !currentUser?.rol?.toLowerCase()?.includes('general')) || emailLower === 'karincmm1@gmail.com';
  const esSuGerenteDirecto = req.gerente_directo_id && currentUser?.id === req.gerente_directo_id;

  const esSolicitante = req.solicitante === `${currentUser?.nombre} ${currentUser?.apellido}`.trim();

  let puedeAprobarProyecto = false;
  let puedeAprobarArea = false;
  let puedeAprobarGeneral = false;

  if (!esSolicitante || esGG) {
    if (req.estado_aprobacion === 'pendiente_proyecto') {
      const obrasAsignadas = currentUser?.obras_asignadas || [];
      const coincideObra = req.centro_costo && obrasAsignadas.some(o => o.toLowerCase().trim() === (req.centro_costo || '').toLowerCase().trim());
      puedeAprobarProyecto = esGG || rolUpper.includes('PROYECTO') || coincideObra || esSuGerenteDirecto;
    }
    if (req.estado_aprobacion === 'pendiente_area') {
      const coincideGerencia = currentUser?.departamento && req.gerencia &&
        currentUser.departamento.toLowerCase().trim() === req.gerencia.toLowerCase().trim();
      puedeAprobarArea = (esGerenteArea && (coincideGerencia || !req.gerencia)) || esSuGerenteDirecto || esFavio || esGG;
    }
    if (req.estado_aprobacion === 'enviada_general') {
      puedeAprobarGeneral = esGG;
    }
  }

  const tieneAccion = puedeAprobarProyecto || puedeAprobarArea || puedeAprobarGeneral;

  const handleConfirmarRechazo = () => {
    if (!motivoRechazo.trim()) {
      alert('Por favor ingrese el motivo del rechazo');
      return;
    }
    onRechazar(req, motivoRechazo.trim());
    setModalRechazo(false);
    setMotivoRechazo('');
  };

  const getStatusBadge = () => {
    const est = (req.estado_aprobacion || '').toLowerCase();
    if (est === 'aprobado_final' || req.aprobado_gerente_general) {
      return <span className="m-status-pill m-status-success"><CheckCircle2 size={12} /> Aprobada</span>;
    }
    if (est === 'pendiente_proyecto') {
      return <span className="m-status-pill m-status-warning"><Clock size={12} /> Pend. Proyecto</span>;
    }
    if (est === 'pendiente_area') {
      return <span className="m-status-pill m-status-warning"><Clock size={12} /> Pend. Área</span>;
    }
    if (est === 'enviada_general') {
      return <span className="m-status-pill m-status-info"><Clock size={12} /> Pend. GG</span>;
    }
    if (est === 'rechazada') {
      return <span className="m-status-pill m-status-danger"><XCircle size={12} /> Rechazada</span>;
    }
    return <span className="m-status-pill m-status-info">{req.estado_aprobacion || 'En Trámite'}</span>;
  };

  return (
    <>
      <div className="m-card">
        {/* Cabecera / Resumen Compacto Clickeable */}
        <div className="m-card-compact-row" onClick={() => setExpandido(!expandido)}>
          <div className="m-card-header">
            <div className="m-card-id-row">
              <span className="m-card-id">{req.correlativo || req.correlativo_req || 'REQ-S/N'}</span>
              <span className="m-card-date">
                <Calendar size={12} color="#64748b" />
                {req.fecha_emision ? new Date(req.fecha_emision).toLocaleDateString('es-VE') : 'Sin fecha'}
              </span>
            </div>
            <div>{getStatusBadge()}</div>
          </div>

          <div className="m-compact-meta">
            <span className="m-compact-user">{req.solicitante || 'No asignado'}</span>
            <span className="m-compact-dot">•</span>
            <span className="m-compact-dept">{req.gerencia || 'General'}</span>
            {req.centro_costo && (
              <>
                <span className="m-compact-dot">•</span>
                <span className="m-compact-cc">{req.centro_costo}</span>
              </>
            )}
          </div>

          <div className="m-compact-bottom">
            <div className="m-compact-amount">
              <span className="m-compact-amount-label">Total Estimado</span>
              <span className="m-compact-amount-val">
                ${totalEstimado.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="m-compact-toggle">
              <span className="m-compact-items-count">
                {items.length} {items.length === 1 ? 'renglón' : 'renglones'}
              </span>
              <div className="m-chevron-circle" title={expandido ? 'Colapsar detalles' : 'Ver renglones y aprobar'}>
                {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>
          </div>
        </div>

        {/* Contenido Expandido */}
        {expandido && (
          <div className="m-card-expanded">
            {/* Detalles adicionales */}
            <div className="m-card-body">
              {req.prioridad && (
                <div className="m-info-group">
                  <span className="m-info-label">Prioridad</span>
                  <span className="m-info-value" style={{ color: req.prioridad?.toLowerCase() === 'alta' || req.prioridad?.toLowerCase() === 'urgente' ? '#f43f5e' : '#94a3b8' }}>
                    {req.prioridad}
                  </span>
                </div>
              )}

              <div className="m-info-group">
                <span className="m-info-label">Centro de Costo</span>
                <span className="m-info-value">{req.centro_costo || 'No definido'}</span>
              </div>

              {req.motivo_rechazo && (
                <div className="m-info-group full" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <span className="m-info-label" style={{ color: '#f87171' }}>Motivo de Rechazo:</span>
                  <span className="m-info-value" style={{ color: '#fca5a5' }}>{req.motivo_rechazo}</span>
                </div>
              )}
            </div>

            {/* Desglose de Ítems */}
            <div className="m-items-summary">
              <div className="m-items-header">
                <span>Renglones ({items.length})</span>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Cantidades y Subtotales</span>
              </div>

              <div className="m-items-list">
                {items.map((it, idx) => {
                  const subtotal = parseFloat(it.total || 0) || ((parseFloat(it.cantidad || it.cant || 1) || 1) * (parseFloat(it.pu || it.costo_unitario || 0) || 0));
                  return (
                    <div key={idx} className="m-item-card">
                      <div className="m-item-card-left">
                        <span className="m-item-number">#{idx + 1}</span>
                        <span className="m-item-desc">{it.descripcion || it.nombre || it.item || 'Ítem sin descripción'}</span>
                      </div>
                      <div className="m-item-card-right">
                        <span className="m-item-qty-badge">{it.cantidad || it.cant || 1} {it.unidad || it.uni || 'UND'}</span>
                        {subtotal > 0 && (
                          <span className="m-item-subtotal">
                            ${subtotal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Botón Soportes si tiene */}
            {soportes.length > 0 && (
              <button className="m-btn-soportes" onClick={() => setModalSoportes(true)}>
                <FileText size={15} />
                <span>Ver Soportes y Facturas ({soportes.length})</span>
              </button>
            )}

            {/* Botones de Aprobación / Rechazo táctiles */}
            {tieneAccion && (
              <div className="m-card-actions">
                <button
                  className="m-btn m-btn-reject"
                  onClick={() => setModalRechazo(true)}
                  disabled={loadingAction}
                >
                  <XCircle size={18} />
                  <span>Rechazar</span>
                </button>

                {puedeAprobarProyecto && (
                  <button
                    className="m-btn m-btn-approve"
                    onClick={() => onAprobar(req, 'proyecto')}
                    disabled={loadingAction}
                  >
                    <CheckCircle2 size={18} />
                    <span>Aprobar Proyecto</span>
                  </button>
                )}

                {puedeAprobarArea && (
                  <button
                    className="m-btn m-btn-approve"
                    onClick={() => onAprobar(req, 'area')}
                    disabled={loadingAction}
                  >
                    <CheckCircle2 size={18} />
                    <span>{esGG ? 'Aprobar Área (GG)' : 'Aprobar Área'}</span>
                  </button>
                )}

                {puedeAprobarArea && esGG && (
                  <button
                    className="m-btn m-btn-approve"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}
                    onClick={() => onAprobar(req, 'general_directa')}
                    disabled={loadingAction}
                  >
                    <Zap size={18} />
                    <span>Aprobación Final</span>
                  </button>
                )}

                {puedeAprobarGeneral && (
                  <button
                    className="m-btn m-btn-approve"
                    style={{ background: 'linear-gradient(135deg, #0284c7, #2563eb)' }}
                    onClick={() => onAprobar(req, 'general')}
                    disabled={loadingAction}
                  >
                    <ShieldCheck size={18} />
                    <span>Aprobación Final</span>
                  </button>
                )}
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
        titulo={`Soportes: ${req.correlativo || ''}`}
      />

      {/* Modal para ingresar motivo de rechazo */}
      {modalRechazo && (
        <div className="m-modal-overlay" onClick={() => setModalRechazo(false)}>
          <div className="m-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="m-modal-header">
              <h3 className="m-modal-title">Motivo de Rechazo</h3>
              <button className="m-btn-icon" onClick={() => setModalRechazo(false)}>
                <XCircle size={20} />
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 12px 0' }}>
              Indique por qué rechaza la requisición {req.correlativo}. El solicitante recibirá este comentario.
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

