import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, CheckCircle2, XCircle, AlertCircle, Clock, ShieldCheck, Zap } from 'lucide-react';
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
    const qty = parseFloat(it.cantidad || it.cant || 1) || 1;
    const precio = parseFloat(it.costo_unitario || it.precio_unitario || it.precio || 0) || 0;
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
        {/* Encabezado */}
        <div className="m-card-header">
          <div>
            <div className="m-card-id">{req.correlativo || req.correlativo_req || 'REQ-S/N'}</div>
            <div className="m-card-date">{req.fecha_emision ? new Date(req.fecha_emision).toLocaleDateString('es-VE') : 'Sin fecha'}</div>
          </div>
          <div>{getStatusBadge()}</div>
        </div>

        {/* Datos Principales */}
        <div className="m-card-body">
          <div className="m-info-group">
            <span className="m-info-label">Solicitante</span>
            <span className="m-info-value">{req.solicitante || 'No asignado'}</span>
          </div>

          <div className="m-info-group">
            <span className="m-info-label">Gerencia</span>
            <span className="m-info-value">{req.gerencia || 'General'}</span>
          </div>

          <div className="m-info-group">
            <span className="m-info-label">Centro de Costo</span>
            <span className="m-info-value">{req.centro_costo || 'No definido'}</span>
          </div>

          <div className="m-info-group">
            <span className="m-info-label">Total Estimado</span>
            <span className="m-info-amount">${totalEstimado.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>

          {req.prioridad && (
            <div className="m-info-group full">
              <span className="m-info-label">Prioridad</span>
              <span className="m-info-value" style={{ color: req.prioridad?.toLowerCase() === 'alta' || req.prioridad?.toLowerCase() === 'urgente' ? '#f43f5e' : '#94a3b8' }}>
                {req.prioridad}
              </span>
            </div>
          )}

          {req.motivo_rechazo && (
            <div className="m-info-group full" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <span className="m-info-label" style={{ color: '#f87171' }}>Motivo de Rechazo:</span>
              <span className="m-info-value" style={{ color: '#fca5a5' }}>{req.motivo_rechazo}</span>
            </div>
          )}
        </div>

        {/* Desglose de Ítems */}
        <div className="m-items-summary">
          <div className="m-items-header" onClick={() => setExpandido(!expandido)}>
            <span>Materiales / Renglones ({items.length})</span>
            {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>

          {expandido && (
            <div style={{ marginTop: '8px', display: 'flex', flex_direction: 'column', gap: '6px' }}>
              {items.map((it, idx) => (
                <div key={idx} className="m-item-row">
                  <span className="m-item-name">{it.descripcion || it.nombre || it.item || 'Ítem sin descripción'}</span>
                  <span className="m-item-qty">{it.cantidad || it.cant || 1} {it.unidad || 'UND'}</span>
                </div>
              ))}
            </div>
          )}
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

