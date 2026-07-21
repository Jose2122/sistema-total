import React from 'react';
import { MessageSquare, Paperclip, Eye, Ban, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

const RequisicionesTable = ({ 
  data, 
  loading, 
  onView, 
  onAnular, 
  onEliminar,
  currentUser 
}) => {
  const getStatusStyle = (status) => {
    switch (status) {
      case 'aprobado_final': return { color: '#16a34a', label: 'APROBADA' };
      case 'rechazada': return { color: '#ef4444', label: 'RECHAZADA' };
      case 'ANULADA': return { color: '#64748b', label: 'ANULADA' };
      default: return { color: '#0ea5e9', label: status?.replace('_', ' ').toUpperCase() || 'PENDIENTE' };
    }
  };

  return (
    <div className="table-container" style={{ overflowX: 'auto', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
      <table className="tc-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontSize: '0.75rem' }}>
            <th style={{ padding: '15px', width: '150px' }}>ID / PRIORIDAD</th>
            <th style={{ textAlign: 'center', width: '160px' }}>ESTATUS</th>
            <th>FECHA</th>
            <th>SOLICITANTE</th>
            <th style={{ textAlign: 'right' }}>TOTAL ($)</th>
            <th style={{ textAlign: 'center' }}>ACCIONES</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Cargando...</td></tr>
          ) : data.map((req) => (
            <tr key={req.id} style={{ borderBottom: '1px solid #f8fafc', fontSize: '0.85rem' }}>
              <td style={{ padding: '12px' }}>{req.correlativo || req.correlativo_req}</td>
              <td style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: '900', color: getStatusStyle(req.estado_aprobacion).color }}>
                    {getStatusStyle(req.estado_aprobacion).label}
                  </span>

                  {(() => {
                    const items = req.filas || req.detalles || req.items || [];
                    if (!items || items.length === 0) return null;

                    const total = items.length;
                    const entregados = items.filter(f => 
                      f.estatus_almacen === 'entregado' || 
                      f.is_entregado === true || 
                      f.estado === 'entregado'
                    ).length;

                    if (entregados === 0) return null;

                    const ratio = entregados / total;
                    const completo = entregados === total;

                    let bgBadge = '#16a34a';
                    let borderBadge = '#15803d';
                    let textBadge = '#ffffff';

                    if (completo) {
                      bgBadge = '#16a34a';
                      borderBadge = '#15803d';
                      textBadge = '#ffffff';
                    } else if (ratio <= 0.35) {
                      bgBadge = '#dcfce7';
                      borderBadge = '#86efac';
                      textBadge = '#15803d';
                    } else if (ratio <= 0.7) {
                      bgBadge = '#86efac';
                      borderBadge = '#4ade80';
                      textBadge = '#166534';
                    } else {
                      bgBadge = '#4ade80';
                      borderBadge = '#22c55e';
                      textBadge = '#064e3b';
                    }

                    return (
                      <span
                        title={`Almacén: ${entregados} de ${total} entregados`}
                        style={{
                          fontSize: '8px',
                          fontWeight: '900',
                          backgroundColor: bgBadge,
                          color: textBadge,
                          border: `1px solid ${borderBadge}`,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        ✓ {completo ? 'ENTREGADO' : `${entregados}/${total}`}
                      </span>
                    );
                  })()}
                </div>
              </td>
              <td>{req.fecha ? format(new Date(req.fecha + 'T12:00:00'), 'dd/MM/yyyy') : 'N/A'}</td>
              <td>{req.solicitante}</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>$ {parseFloat(req.total || 0).toLocaleString('de-DE')}</td>
              <td style={{ textAlign: 'center' }}>
                <button onClick={() => onView(req)} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}><Eye size={18} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RequisicionesTable;
