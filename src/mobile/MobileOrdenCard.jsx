import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Building2,
  FileText,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import MobileSoportesModal from './MobileSoportesModal';

export default function MobileOrdenCard({
  odc,
  puedeAprobar,
  puedeFirmarCarlos,
  puedeFirmarRicardo,
  onAprobar,
  onRechazar,
  onToggleFirma,
  loadingAction
}) {
  const [expandido, setExpandido] = useState(false);
  const [prioridadSel, setPrioridadSel] = useState(
    odc.prioridad_pago === 1 || odc.prioridad_pago === 2 ? Number(odc.prioridad_pago) : 2
  );
  const [modalRechazo, setModalRechazo] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [modalSoportes, setModalSoportes] = useState(false);

  const estadoAprob = (odc.estado_aprobacion_precio || '').toLowerCase();
  const estatusOrden = (odc.estatus_orden || '').toUpperCase();
  const estatusPago = (odc.estatus_pago || odc.status_pago || '').toUpperCase();

  const esAnulada = estatusOrden === 'ANULADA' || estatusPago === 'ANULADA' || estadoAprob === 'anulada';
  const esAprobada = !esAnulada && (estadoAprob === 'aprobado' || estatusOrden === 'APROBADA');
  const esRechazada = !esAnulada && (estadoAprob === 'rechazado' || estatusOrden === 'RECHAZADA');
  const esPendiente = !esAnulada && !esAprobada && !esRechazada;

  const totalGeneral = Number(odc.total_general ?? odc.total ?? 0);
  const subtotal = Number(odc.subtotal ?? 0);
  const ivaMonto = Number(odc.iva_monto ?? 0);
  const items = Array.isArray(odc.items_detalle) ? odc.items_detalle : [];

  const soportes = [];
  if (odc.cotizacion_url) soportes.push({ url: odc.cotizacion_url, nombre: `Cotización ${odc.cotizacion_ref || ''}`.trim() });
  if (odc.soporte_url) soportes.push({ url: odc.soporte_url, nombre: 'Soporte ODC' });
  if (odc.url_pdf) soportes.push({ url: odc.url_pdf, nombre: `PDF ${odc.numero_odc}` });

  const renderStatusPill = () => {
    if (esAnulada) {
      return <span className="m-status-pill m-status-danger"><XCircle size={12} /> Anulada</span>;
    }
    if (esAprobada) {
      return <span className="m-status-pill m-status-success"><CheckCircle2 size={12} /> Aprobada</span>;
    }
    if (esRechazada) {
      return <span className="m-status-pill m-status-danger"><XCircle size={12} /> Rechazada</span>;
    }
    return <span className="m-status-pill m-status-warning"><Clock size={12} /> Por Aprobar</span>;
  };

  const formatFecha = (f) => {
    if (!f) return 'N/D';
    try {
      const d = new Date(f);
      if (isNaN(d.getTime())) return String(f);
      return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return String(f);
    }
  };

  return (
    <div className="m-card" style={{ borderLeft: odc.prioridad_pago === 1 ? '3px solid #ef4444' : undefined }}>
      {/* Cabecera colapsada */}
      <div
        onClick={() => setExpandido(!expandido)}
        style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' }}
      >
        <div className="m-card-header" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className="m-req-code">{odc.numero_odc || `ODC #${odc.id}`}</span>
            {odc.tipo_pago === 'CREDITO' ? (
              <span className="m-status-pill m-status-info" style={{ fontSize: '0.68rem', padding: '2px 7px' }}>
                CRÉDITO {odc.dias_credito ? `${odc.dias_credito}d` : ''}
              </span>
            ) : (
              <span className="m-status-pill" style={{ fontSize: '0.68rem', padding: '2px 7px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                CONTADO
              </span>
            )}
            {odc.prioridad_pago === 1 && (
              <span className="m-status-pill m-status-danger" style={{ fontSize: '0.68rem', padding: '2px 7px' }}>
                🔴 NIVEL 1
              </span>
            )}
          </div>
          {renderStatusPill()}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building2 size={14} color="#38bdf8" style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {odc.proveedor_nombre || 'Proveedor sin especificar'}
              </span>
            </div>
            <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '3px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <span>📋 {odc.requisicion_correlativo || odc.correlativo_req || 'Sin Req.'}</span>
              <span>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <Calendar size={11} /> {formatFecha(odc.fecha_emision || odc.created_at)}
              </span>
            </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#38bdf8' }}>
              $ {totalGeneral.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="m-chevron-circle" style={{ marginLeft: 'auto', marginTop: '4px' }}>
              {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>
        </div>

        {/* Mini resumen de firmas */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
          <span style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '6px',
            backgroundColor: odc.ricardo_firma_digital_activa ? 'rgba(16, 185, 129, 0.14)' : 'rgba(148, 163, 184, 0.1)',
            color: odc.ricardo_firma_digital_activa ? '#34d399' : '#94a3b8',
            border: `1px solid ${odc.ricardo_firma_digital_activa ? 'rgba(16, 185, 129, 0.3)' : 'rgba(148, 163, 184, 0.15)'}`
          }}>
            {odc.ricardo_firma_digital_activa ? '✓ Aval Compras' : '○ Sin Aval Compras'}
          </span>
          <span style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '6px',
            backgroundColor: odc.carlos_firma_digital_activa ? 'rgba(56, 189, 248, 0.14)' : 'rgba(148, 163, 184, 0.1)',
            color: odc.carlos_firma_digital_activa ? '#38bdf8' : '#94a3b8',
            border: `1px solid ${odc.carlos_firma_digital_activa ? 'rgba(56, 189, 248, 0.3)' : 'rgba(148, 163, 184, 0.15)'}`
          }}>
            {odc.carlos_firma_digital_activa ? '✓ Firma Carlos Vega' : '○ Sin Firma G. General'}
          </span>
        </div>
      </div>

      {/* Detalle expandido */}
      {expandido && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Metadatos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem', backgroundColor: 'rgba(15, 23, 42, 0.5)', padding: '10px', borderRadius: '12px' }}>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem' }}>Elaborado por</span>
              <strong style={{ color: '#e2e8f0' }}>{odc.elaborado_por_nombre || odc.comprador_nombre || 'Compras'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem' }}>RIF Proveedor</span>
              <strong style={{ color: '#e2e8f0' }}>{odc.proveedor_rif || 'N/D'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem' }}>Centro de Costo</span>
              <strong style={{ color: '#e2e8f0' }}>{odc.centro_costo || odc.destino_despacho || 'General'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem' }}>Subtotal / IVA</span>
              <strong style={{ color: '#e2e8f0' }}>
                ${subtotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })} + ${ivaMonto.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
              </strong>
            </div>
          </div>

          {odc.motivo_rechazo_compras && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px 10px', borderRadius: '10px', fontSize: '0.76rem', color: '#fca5a5', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div><strong>Motivo de rechazo:</strong> {odc.motivo_rechazo_compras}</div>
            </div>
          )}

          {/* Lista de renglones */}
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.04em' }}>
              Renglones ({items.length})
            </div>
            {items.length === 0 ? (
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>
                Sin detalle de renglones registrado.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {items.map((it, idx) => {
                  const cant = Number(it.cantidad ?? it.cant ?? 0);
                  const pu = Number(it.precio_unitario ?? it.pu ?? 0);
                  const tot = Number(it.total_fila ?? it.subtotal ?? cant * pu);
                  return (
                    <div
                      key={it.id || idx}
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '10px',
                        padding: '8px 10px',
                        fontSize: '0.78rem'
                      }}
                    >
                      <div style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: '3px' }}>
                        {idx + 1}. {it.descripcion || 'Ítem sin descripción'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.74rem' }}>
                        <span>{cant} {it.unidad || 'UND'} × ${pu.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                        <strong style={{ color: '#38bdf8' }}>${tot.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {soportes.length > 0 && (
            <button
              type="button"
              className="m-btn"
              style={{ backgroundColor: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.25)', minHeight: '40px', fontSize: '0.82rem' }}
              onClick={() => setModalSoportes(true)}
            >
              <FileText size={15} />
              <span>Ver Soportes / Cotización ({soportes.length})</span>
            </button>
          )}

          {/* Controles de Firma Digital Rápida (Carlos Vega / Ricardo Herrera / Super Admin) */}
          {!esAnulada && (puedeFirmarCarlos || puedeFirmarRicardo) && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {puedeFirmarRicardo && (
                <button
                  type="button"
                  disabled={loadingAction}
                  onClick={() => onToggleFirma(odc, 'ricardo', !odc.ricardo_firma_digital_activa)}
                  className="m-btn"
                  style={{
                    flex: 1,
                    minHeight: '38px',
                    fontSize: '0.76rem',
                    backgroundColor: odc.ricardo_firma_digital_activa ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255,255,255,0.06)',
                    color: odc.ricardo_firma_digital_activa ? '#34d399' : '#cbd5e1',
                    border: `1px solid ${odc.ricardo_firma_digital_activa ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255,255,255,0.12)'}`
                  }}
                >
                  <ShieldCheck size={14} />
                  <span>{odc.ricardo_firma_digital_activa ? 'Quitar Aval Compras' : 'Firmar Aval Compras'}</span>
                </button>
              )}
              {puedeFirmarCarlos && (
                <button
                  type="button"
                  disabled={loadingAction}
                  onClick={() => onToggleFirma(odc, 'carlos', !odc.carlos_firma_digital_activa)}
                  className="m-btn"
                  style={{
                    flex: 1,
                    minHeight: '38px',
                    fontSize: '0.76rem',
                    backgroundColor: odc.carlos_firma_digital_activa ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255,255,255,0.06)',
                    color: odc.carlos_firma_digital_activa ? '#38bdf8' : '#cbd5e1',
                    border: `1px solid ${odc.carlos_firma_digital_activa ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255,255,255,0.12)'}`
                  }}
                >
                  <ShieldCheck size={14} />
                  <span>{odc.carlos_firma_digital_activa ? 'Quitar Firma Carlos' : 'Estampar Firma Carlos'}</span>
                </button>
              )}
            </div>
          )}

          {/* Bloque de Aprobación / Rechazo */}
          {puedeAprobar && esPendiente && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'rgba(2, 132, 199, 0.08)', padding: '10px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#bae6fd' }}>
                Prioridad de Pago para Cuentas por Pagar:
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPrioridadSel(1)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    border: prioridadSel === 1 ? '1.5px solid #ef4444' : '1px solid rgba(255,255,255,0.12)',
                    backgroundColor: prioridadSel === 1 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.04)',
                    color: prioridadSel === 1 ? '#fca5a5' : '#94a3b8'
                  }}
                >
                  🔴 Nivel 1 (Máxima)
                </button>
                <button
                  type="button"
                  onClick={() => setPrioridadSel(2)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    border: prioridadSel === 2 ? '1.5px solid #38bdf8' : '1px solid rgba(255,255,255,0.12)',
                    backgroundColor: prioridadSel === 2 ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.04)',
                    color: prioridadSel === 2 ? '#bae6fd' : '#94a3b8'
                  }}
                >
                  🔵 Nivel 2 (Normal)
                </button>
              </div>

              <div className="m-actions-row" style={{ marginTop: '4px' }}>
                <button
                  type="button"
                  className="m-btn m-btn-approve"
                  disabled={loadingAction}
                  onClick={() => onAprobar(odc, prioridadSel)}
                >
                  <CheckCircle2 size={16} />
                  <span>Aprobar ODC</span>
                </button>
                <button
                  type="button"
                  className="m-btn m-btn-reject"
                  disabled={loadingAction}
                  onClick={() => setModalRechazo(true)}
                >
                  <XCircle size={16} />
                  <span>Rechazar</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Rechazo */}
      {modalRechazo && (
        <div className="m-modal-overlay" onClick={() => setModalRechazo(false)}>
          <div className="m-modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px 0', color: '#f8fafc', fontSize: '1.05rem' }}>
              Rechazar {odc.numero_odc}
            </h3>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              Indica el motivo o ajuste necesario para devolver la orden a Compras:
            </p>
            <textarea
              className="m-textarea"
              rows={3}
              placeholder="Ej: Ajustar precio unitario o corregir proveedor..."
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
            />
            <div className="m-actions-row" style={{ marginTop: '12px' }}>
              <button
                type="button"
                className="m-btn"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#cbd5e1' }}
                onClick={() => setModalRechazo(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="m-btn m-btn-reject"
                disabled={loadingAction || !motivoRechazo.trim()}
                onClick={() => {
                  onRechazar(odc, motivoRechazo.trim());
                  setModalRechazo(false);
                  setMotivoRechazo('');
                }}
              >
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      {modalSoportes && (
        <MobileSoportesModal
          soportes={soportes}
          titulo={`Soportes ${odc.numero_odc}`}
          onClose={() => setModalSoportes(false)}
        />
      )}
    </div>
  );
}
