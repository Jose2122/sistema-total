import React from 'react';
import { formatCurrency } from '../../utils/helpers';

const FondosStats = ({ totales }) => {
  const stats = [
    { label: 'Dólares pagaderos en Bolívares', val: formatCurrency(totales.bs), col: '#030712' },
    { label: 'Dólares pagaderos en divisas', val: formatCurrency(totales.usd), col: '#030712' },
    { label: 'Total General ($)', val: formatCurrency(totales.general), col: '#030712' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>
      {stats.map((x, i) => (
        <div
          key={i}
          className="stat-card"
          style={{
            borderLeft: `6px solid ${x.col}`,
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
            {x.label}
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#1e293b', margin: 0 }}>
            {x.val}
          </div>
        </div>
      ))}
    </div>
  );
};

export default FondosStats;
