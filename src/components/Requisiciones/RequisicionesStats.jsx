import React from 'react';

const RequisicionesStats = ({ stats, activeFilter, onFilterChange }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '25px' }}>
      {stats.map((x, i) => (
        <div
          key={i}
          className="stat-card"
          onClick={() => onFilterChange(x.filter)}
          style={{
            borderLeft: `6px solid ${x.col || '#030712'}`,
            cursor: 'pointer',
            backgroundColor: activeFilter === x.filter ? '#f8fafc' : 'white',
            transform: activeFilter === x.filter ? 'scale(1.02)' : 'scale(1)',
            transition: 'all 0.2s ease',
            boxShadow: activeFilter === x.filter ? '0 4px 12px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.05)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0'
          }}
        >
          <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
            {x.label}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#1e293b' }}>
            {x.val}
          </div>
        </div>
      ))}
    </div>
  );
};

export default RequisicionesStats;
