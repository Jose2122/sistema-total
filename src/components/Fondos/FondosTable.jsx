import React from 'react';
import { Printer } from 'lucide-react';
import { getWeekNumber, getWeekRange, formatCurrency } from '../../utils/helpers';

const FondosTable = ({ data, loading, onEdit, onPrint }) => {
  const extractPeriodoFromId = (codigoControl, fecha) => {
    const match = codigoControl?.match(/SEM\s+(\d+)/i) || codigoControl?.match(/SEMANA\s+(\d+)/i);
    if (!match) return '—';
    const weekNum = parseInt(match[1], 10);
    const year = new Date(fecha).getFullYear();
    return getWeekRange(weekNum, year);
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontSize: '0.75rem' }}>
            <th style={{ padding: '15px', width: '22%' }}>ID CONTROL / FECHA</th>
            <th style={{ width: '15%' }}>SEMANA / PERÍODO</th>
            <th style={{ width: '23%' }}>RESPONSABLE / GERENCIA</th>
            <th style={{ width: '13%', textAlign: 'right' }}>PAGO BS/$</th>
            <th style={{ width: '11%', textAlign: 'right' }}>PAGO $/$</th>
            <th style={{ width: '10%', textAlign: 'right' }}>TOTAL ($)</th>
            <th style={{ width: '6%', textAlign: 'center' }}>ACCIONES</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Cargando registros...</td></tr>
          ) : data.length === 0 ? (
            <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No se encontraron registros.</td></tr>
          ) : data.map((h, i) => (
            <tr key={h.id || h.id_db || i} style={{ borderBottom: '1px solid #f8fafc', fontSize: '0.80rem', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
              <td style={{ padding: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <button
                    type="button"
                    onClick={() => onEdit(h)}
                    style={{
                      background: 'none', border: 'none', padding: 0, fontWeight: 'bold',
                      color: '#0ea5e9', cursor: 'pointer', textDecoration: 'underline',
                      font: 'inherit', textAlign: 'left', fontSize: '0.85rem'
                    }}
                  >
                    {h.id}
                  </button>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '500' }}>
                    {h.fecha_operativa ? new Date(h.fecha_operativa + 'T12:00:00').toLocaleDateString('es-VE') : '—'}
                  </div>
                </div>
              </td>
              <td style={{ color: '#64748b' }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>SEM {getWeekNumber(h.fecha_operativa)}</div>
                <div style={{ fontSize: '0.7rem', color: '#0ea5e9', marginTop: '3px', fontWeight: '500' }}>
                  {extractPeriodoFromId(h.id, h.fecha_operativa)}
                </div>
              </td>
              <td>
                <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{h.responsable}</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '500' }}>{h.gerencia}</div>
              </td>
              <td style={{ color: '#b45309', fontWeight: '600' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '10px' }}>
                  <span>$</span>
                  <span>{parseFloat(h.total_bs || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                </div>
              </td>
              <td style={{ color: '#15803d', fontWeight: '600' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '10px' }}>
                  <span>$</span>
                  <span>{parseFloat(h.total_usd || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                </div>
              </td>
              <td style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>$</span>
                  <span>{h.total.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                </div>
              </td>
              <td style={{ textAlign: 'center' }}>
                <button
                  onClick={() => onPrint(h)}
                  style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}
                  title="Imprimir Solicitud"
                >
                  <Printer size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FondosTable;
