import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  Plus, 
  Trash2, 
  TrendingUp, 
  Activity, 
  Calendar,
  CheckCircle2,
  AlertCircle,
  Building2,
  DollarSign,
  RefreshCw
} from 'lucide-react';
import './Administracion.css';

// Inline Component for Stat Cards moved UP
const StatCard = ({ title, value, icon, color, subtitle }) => (
  <div className="stat-card">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ backgroundColor: `${color}10`, padding: '10px', borderRadius: '12px' }}>
        {icon}
      </div>
      <div style={{ textAlign: 'right' }}>
        <p style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</p>
        <h3 style={{ margin: '8px 0 0 0', fontSize: '1.5rem', fontWeight: '900', color: '#0f172a' }}>
          $ {Number(value || 0).toLocaleString('de-DE')}
        </h3>
      </div>
    </div>
    <div style={{ marginTop: '15px', borderTop: '1px solid #f8fafc', paddingTop: '12px' }}>
      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>{subtitle}</span>
    </div>
  </div>
);

const Administracion = () => {
  const [bancos, setBancos] = useState([]);
  const [nuevoBanco, setNuevoBanco] = useState({ nombre: '', cbu: '', alias: '', tipo: 'Corriente', moneda: 'USD' });
  const [cargandoBancos, setCargandoBancos] = useState(true);
  const [cargandoStats, setCargandoStats] = useState(true);
  const [stats, setStats] = useState({
    semanal: 0,
    mensual: 0,
    reembolsosPolizas: 0,
    tea: 0,
    totalGeneral: 0
  });
  const [recientes, setRecientes] = useState([]);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    await Promise.all([
      cargarBancos(),
      cargarStats(),
      cargarRecientes()
    ]);
  };

  const cargarBancos = async () => {
    try {
      const { data, error } = await supabase
        .from('bancos')
        .select('*')
        .order('nombre', { ascending: true });
      
      if (error) {
        if (error.code === '42P01') {
          console.warn('La tabla bancos no existe. Por favor ejecute el script SQL.');
        } else {
          throw error;
        }
      }
      setBancos(data || []);
    } catch (err) {
      console.error('Error al cargar bancos:', err?.message);
    } finally {
      setCargandoBancos(false);
    }
  };

  const cargarStats = async () => {
    setCargandoStats(true);
    try {
      const now = new Date();
      
      const { data, error } = await supabase
        .from('tickets_directos')
        .select('total_usd, fecha_pago, categoria, clasificacion_admin')
        .eq('estatus', 'Pagado');

      if (error) throw error;

      if (data && Array.isArray(data)) {
        const s = {
          semanal: data.filter(t => t?.clasificacion_admin === 'Semanal').reduce((acc, t) => acc + (Number(t?.total_usd) || 0), 0),
          mensual: data.filter(t => t?.clasificacion_admin === 'Mensual').reduce((acc, t) => acc + (Number(t?.total_usd) || 0), 0),
          reembolsosPolizas: data.filter(t => t?.clasificacion_admin === 'Reembolsos Pólizas').reduce((acc, t) => acc + (Number(t?.total_usd) || 0), 0),
          tea: data.filter(t => t?.clasificacion_admin === 'TEA').reduce((acc, t) => acc + (Number(t?.total_usd) || 0), 0),
          totalGeneral: data.reduce((acc, t) => acc + (Number(t?.total_usd) || 0), 0)
        };
        setStats(s);
      }
    } catch (err) {
      console.error('Error al cargar stats:', err?.message);
    } finally {
      setCargandoStats(false);
    }
  };

  const cargarRecientes = async () => {
    try {
      const { data, error } = await supabase
        .from('tickets_directos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      setRecientes(data || []);
    } catch (err) {
      console.error('Error al cargar recientes:', err?.message);
    }
  };

  const agregarBanco = async (e) => {
    e.preventDefault();
    if (!nuevoBanco.nombre) return alert('El nombre del banco es obligatorio');

    try {
      const { error } = await supabase
        .from('bancos')
        .insert([{
          nombre: nuevoBanco.nombre,
          cbu: nuevoBanco.cbu,
          alias: nuevoBanco.alias,
          tipo: nuevoBanco.tipo,
          moneda: nuevoBanco.moneda,
          activo: true
        }]);

      if (error) throw error;
      
      setNuevoBanco({ nombre: '', cbu: '', alias: '', tipo: 'Corriente', moneda: 'USD' });
      await cargarBancos();
      alert('Banco agregado correctamente');
    } catch (err) {
      alert('Error al agregar banco: ' + err?.message);
    }
  };

  const toggleBanco = async (id, estadoActual) => {
    try {
      const { error } = await supabase
        .from('bancos')
        .update({ activo: !estadoActual })
        .eq('id', id);

      if (error) throw error;
      await cargarBancos();
    } catch (err) {
      alert('Error al actualizar banco: ' + err?.message);
    }
  };

  const eliminarBanco = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar este banco?')) return;
    try {
      const { error } = await supabase
        .from('bancos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await cargarBancos();
    } catch (err) {
      alert('Error al eliminar banco: ' + err?.message);
    }
  };

  return (
    <div className="admin-container">
      
      {/* Header */}
      <div className="admin-header">
        <div>
          <h1 className="admin-title">Panel de Administración</h1>
          <p className="admin-subtitle">Gestiona bancos de la empresa y visualiza reportes financieros en tiempo real.</p>
        </div>
        <button onClick={cargarDatos} className="btn-update">
          <RefreshCw size={18} /> Actualizar Datos
        </button>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard 
          title="Gastos Semanales" 
          value={stats.semanal} 
          icon={<Calendar color="#0ea5e9" size={24} />} 
          color="#0ea5e9"
          subtitle="Siete días recientes"
        />
        <StatCard 
          title="Gastos Mensuales" 
          value={stats.mensual} 
          icon={<TrendingUp color="#10b981" size={24} />} 
          color="#10b981"
          subtitle="Mes en curso"
        />
        <StatCard 
          title="Reembolsos/Pólizas" 
          value={stats.reembolsosPolizas} 
          icon={<Activity color="#f59e0b" size={24} />} 
          color="#f59e0b"
          subtitle="Categoría específica"
        />
        <StatCard 
          title="Total TEA" 
          value={stats.tea} 
          icon={<DollarSign color="#ef4444" size={24} />} 
          color="#ef4444"
          subtitle="Gastos operativos TEA"
        />
      </div>

      <div className="content-grid">
        
        {/* Bank Management Column */}
        <div className="bank-card">
          <div className="bank-card-header">
            <div className="bank-icon-wrap">
              <Building2 color="#0ea5e9" size={24} />
            </div>
            <h2 className="bank-title">Gestión Bancaria</h2>
          </div>

          <form onSubmit={agregarBanco} className="bank-form">
            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Nombre del Banco</label>
              <input 
                type="text" 
                placeholder="Ej: Banesco, Mercantil..." 
                value={nuevoBanco.nombre}
                onChange={(e) => setNuevoBanco({...nuevoBanco, nombre: e.target.value})}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Nro Cuenta / CBU</label>
              <input 
                type="text" 
                placeholder="XXXX-XXXX-..." 
                value={nuevoBanco.cbu}
                onChange={(e) => setNuevoBanco({...nuevoBanco, cbu: e.target.value})}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Moneda</label>
              <select 
                value={nuevoBanco.moneda}
                onChange={(e) => setNuevoBanco({...nuevoBanco, moneda: e.target.value})}
                className="form-input" style={{ backgroundColor: 'white' }}
              >
                <option value="USD">Dólares (USD)</option>
                <option value="BS">Bolívares (BS)</option>
              </select>
            </div>
            <button type="submit" className="btn-add-bank">
              <Plus size={20} /> AGREGAR NUEVO BANCO
            </button>
          </form>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Banco</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Moneda</th>
                  <th style={{ textAlign: 'center', padding: '12px', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Estado</th>
                  <th style={{ textAlign: 'right', padding: '12px', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {bancos.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '14px' }}>
                      No hay bancos registrados.
                    </td>
                  </tr>
                ) : (
                  bancos.map((b) => (
                    <tr key={b.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ fontWeight: '700', color: '#334155' }}>{b.nombre}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{b.cbu || 'Sin datos'}</div>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <span style={{ 
                          backgroundColor: b.moneda === 'USD' ? '#dcfce7' : '#fee2e2', 
                          color: b.moneda === 'USD' ? '#166534' : '#991b1b',
                          padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800'
                        }}>
                          {b.moneda}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                        <button 
                          onClick={() => toggleBanco(b.id, b.activo)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: b.activo ? '#10b981' : '#cbd5e1' }}
                        >
                          {b.activo ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                        </button>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                        <button onClick={() => eliminarBanco(b.id)} className="btn-delete-bank">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Tickets Column */}
        <div className="recent-card">
          <div className="recent-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="recent-icon-wrap">
                <Activity color="#38bdf8" size={24} />
              </div>
              <h2 className="recent-title">Actividad Reciente</h2>
            </div>
            <span className="recent-badge">Últimos 10 tickets</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {recientes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.5 }}>
                No hay actividad reciente.
              </div>
            ) : (
              recientes.map((r) => (
                <div key={r.id} className="ticket-item">
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div className="ticket-avatar">
                      <span style={{ fontSize: '1.2rem' }}>{r.beneficiario?.charAt(0) || 'T'}</span>
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '14px' }}>{r.beneficiario}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{r.referencia_sf} • {r.categoria}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '800', color: '#38bdf8' }}>$ {(Number(r.total_usd) || 0).toLocaleString('de-DE')}</div>
                    <div style={{ fontSize: '10px', color: r.estatus === 'Pagado' ? '#10b981' : '#f59e0b', fontWeight: '900', textTransform: 'uppercase', marginTop: '4px' }}>
                      {r.estatus || 'Procesado'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <button className="btn-view-all">Ver Historial Completo</button>
        </div>
      </div>
    </div>
  );
};

export default Administracion;
