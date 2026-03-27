import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Requisiciones from './Requisiciones';
import Usuarios from './Usuarios';
import SolicitudFondos from './SolicitudFondos';
import TicketExpress from './TicketExpress';
import Compras from './Compras';

function Dashboard() {
  const navigate = useNavigate();
  const [seccionActiva, setSeccionActiva] = useState('dashboard');
  const [sidebarAbierto, setSidebarAbierto] = useState(true); // NUEVO ESTADO
  const [usuario, setUsuario] = useState({ nombre: '', apellido: '', rol: '', departamento: '' });
  const [horaActual, setHoraActual] = useState(new Date().toLocaleTimeString());
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargarDatosUsuario = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate('/');
        return;
      }

      const { data: perfil, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (perfil) {
        setUsuario(perfil);
      } else {
        setUsuario({ nombre: user.email.split('@')[0], apellido: '', rol: 'Usuario', departamento: 'Total Clean' });
      }
      setCargando(false);
    };

    cargarDatosUsuario();

    const timer = setInterval(() => setHoraActual(new Date().toLocaleTimeString()), 1000);

    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      .animate-fade { animation: fadeIn 0.4s ease-out forwards; }
      .menu-item { transition: all 0.2s ease; }
      .menu-item:hover { background-color: #1e293b !important; transform: translateX(4px); color: #0ea5e9 !important; }
      .stat-card { transition: all 0.3s ease; }
      .stat-card:hover { transform: translateY(-4px); box-shadow: 0 12px 20px -5px rgba(0,0,0,0.1); }
      .btn-exit { transition: all 0.2s ease; display: flex; align-items: center; gap: 8px; cursor: pointer; }
      .btn-exit:hover { background-color: #fee2e2 !important; color: #ef4444 !important; transform: scale(1.02); }
    `;
    document.head.appendChild(style);

    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";

    return () => clearInterval(timer);
  }, [navigate]);

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const estilos = {
    contenedor: { display: 'flex', width: '100vw', height: '100vh', backgroundColor: '#f1f5f9', fontFamily: '"Inter", sans-serif' },
    sidebar: {
      width: sidebarAbierto ? '260px' : '80px',
      backgroundColor: '#0f172a',
      color: '#94a3b8',
      display: 'flex',
      flexDirection: 'column',
      padding: sidebarAbierto ? '24px' : '15px',
      flexShrink: 0,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative'
    },
    principal: { flex: 1, padding: '40px', overflowY: 'auto', height: '100vh', boxSizing: 'border-box', transition: 'all 0.3s' },
    card: { backgroundColor: 'white', padding: '30px', borderRadius: '24px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0' },
    gridStats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' },
    miniCard: (color) => ({ backgroundColor: 'white', padding: '20px', borderRadius: '18px', borderLeft: `6px solid ${color}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }),
    iconCircle: (bg) => ({ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' })
  };

  const renderContenido = () => {
    const config = {
      dashboard: { titulo: "Resumen General", icon: "fa-chart-pie", color: "#6366f1" },
      productos: { titulo: "Catálogo de Productos", icon: "fa-boxes-stacked", color: "#0ea5e9" },
      compras: { titulo: "Órdenes de Compra", icon: "fa-cart-shopping", color: "#f59e0b" },
      ventas: { titulo: "Registro de Ventas", icon: "fa-chart-line", color: "#10b981" },
      stocks: { titulo: "Control de Inventario", icon: "fa-warehouse", color: "#8b5cf6" },
      proveedores: { titulo: "Directorio de Proveedores", icon: "fa-truck-ramp-box", color: "#ec4899" },
      requisiciones: { titulo: "Solicitudes Internas", icon: "fa-file-signature", color: "#0ea5e9" },
      fondos: { titulo: "Solicitud de Fondos", icon: "fa-wallet", color: "#22c55e" },
      tickets: { titulo: "Ticket de Pago", icon: "fa-ticket", color: "#f59e0b" },
      usuarios: { titulo: "Gestión de Usuarios", icon: "fa-users-gear", color: "#64748b" }
    };

    if (seccionActiva === 'requisiciones') return <Requisiciones />;
    if (seccionActiva === 'usuarios') return <Usuarios />;
    if (seccionActiva === 'fondos') return <SolicitudFondos />;
    if (seccionActiva === 'tickets') return <TicketExpress />;
    if (seccionActiva === 'compras') return <Compras />;

    const current = config[seccionActiva] || config.dashboard;

    return (
      <div className="animate-fade">
        {seccionActiva === 'dashboard' && (
          <div style={estilos.gridStats}>
            <div style={estilos.miniCard('#0ea5e9')} className="stat-card">
              <div><div style={{ fontSize: '0.75rem', color: '#64748b' }}>Requisiciones</div><div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>12</div></div>
              <div style={estilos.iconCircle('#e0f2fe')}><i className="fa-solid fa-file-invoice" style={{ color: '#0ea5e9' }}></i></div>
            </div>
            <div style={estilos.miniCard('#f59e0b')} className="stat-card">
              <div><div style={{ fontSize: '0.75rem', color: '#64748b' }}>Stock Crítico</div><div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>4</div></div>
              <div style={estilos.iconCircle('#fef3c7')}><i className="fa-solid fa-triangle-exclamation" style={{ color: '#f59e0b' }}></i></div>
            </div>
            <div style={estilos.miniCard('#10b981')} className="stat-card">
              <div><div style={{ fontSize: '0.75rem', color: '#64748b' }}>Disponibilidad</div><div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>98%</div></div>
              <div style={estilos.iconCircle('#d1fae5')}><i className="fa-solid fa-check-double" style={{ color: '#10b981' }}></i></div>
            </div>
          </div>
        )}

        <div style={estilos.card}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '25px' }}>
            <div style={{ ...estilos.iconCircle(current.color), width: '55px', height: '55px', fontSize: '1.3rem' }}>
              <i className={`fa-solid ${current.icon}`}></i>
            </div>
            <div>
              <h3 style={{ margin: 0, color: '#1e293b' }}>{current.titulo}</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Sistema de Gestión SIS-REQUISICIONES</p>
            </div>
          </div>
          <div style={{ padding: '60px 20px', textAlign: 'center', border: '2px dashed #f1f5f9', borderRadius: '20px' }}>
            <i className={`fa-solid ${current.icon}`} style={{ fontSize: '3.5rem', color: current.color, opacity: 0.15, marginBottom: '15px' }}></i>
            <p style={{ color: '#94a3b8' }}>Panel de {current.titulo} en desarrollo.<br />Conexión con Supabase verificada.</p>
          </div>
        </div>
      </div>
    );
  };

  if (cargando) return <div style={{ padding: '20px' }}>Iniciando SmartTC...</div>;

  return (
    <div style={estilos.contenedor}>
      <div style={estilos.sidebar}>

        {/* BOTÓN TOGGLE SUTIL */}
        <div
          onClick={() => setSidebarAbierto(!sidebarAbierto)}
          style={{
            position: 'absolute', right: '-12px', top: '30px', backgroundColor: '#0ea5e9', color: 'white',
            width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 100,
            transform: sidebarAbierto ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.3s'
          }}
        >
          <i className="fa-solid fa-chevron-left" style={{ fontSize: '0.7rem' }}></i>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '30px', justifyContent: sidebarAbierto ? 'flex-start' : 'center' }}>
          <div style={{ backgroundColor: '#0ea5e9', padding: '8px', borderRadius: '10px', color: 'white', flexShrink: 0 }}>
            <i className="fa-solid fa-shield-halved"></i>
          </div>
          {sidebarAbierto && <div style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem', whiteSpace: 'nowrap' }}>SmartTC</div>}
        </div>

        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#475569', marginBottom: '10px', letterSpacing: '1px', textAlign: sidebarAbierto ? 'left' : 'center' }}>
            {sidebarAbierto ? 'PRINCIPAL' : '•••'}
          </div>
          {[
            { id: 'dashboard', icon: 'fa-house-chimney-window', label: 'Dashboard' },
            { id: 'productos', icon: 'fa-boxes-stacked', label: 'Productos' },
            { id: 'compras', icon: 'fa-cart-plus', label: 'Compras' },
            { id: 'ventas', icon: 'fa-cash-register', label: 'Ventas' },
            { id: 'stocks', icon: 'fa-cubes-stacked', label: 'Stocks' }
          ].map(item => (
            <div key={item.id} className="menu-item" style={{
              padding: '12px 15px', borderRadius: '10px', marginBottom: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
              justifyContent: sidebarAbierto ? 'flex-start' : 'center',
              backgroundColor: seccionActiva === item.id ? '#1e293b' : 'transparent',
              color: seccionActiva === item.id ? '#0ea5e9' : '#94a3b8'
            }} onClick={() => setSeccionActiva(item.id)} title={!sidebarAbierto ? item.label : ''}>
              <i className={`fa-solid ${item.icon}`} style={{ width: '18px', flexShrink: 0 }}></i>
              {sidebarAbierto && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
            </div>
          ))}

          <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#475569', margin: '20px 0 10px 0', letterSpacing: '1px', textAlign: sidebarAbierto ? 'left' : 'center' }}>
            {sidebarAbierto ? 'GESTIÓN' : '•••'}
          </div>
          {[
            { id: 'proveedores', icon: 'fa-address-book', label: 'Proveedores' },
            { id: 'requisiciones', icon: 'fa-file-signature', label: 'Requisiciones' },
            { id: 'fondos', icon: 'fa-hand-holding-dollar', label: 'Solicitud de Fondos' },
            { id: 'tickets', icon: 'fa-ticket', label: 'Ticket de Pago' }
          ].map(item => (
            <div key={item.id} className="menu-item" style={{
              padding: '12px 15px', borderRadius: '10px', marginBottom: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
              justifyContent: sidebarAbierto ? 'flex-start' : 'center',
              backgroundColor: seccionActiva === item.id ? '#1e293b' : 'transparent',
              color: seccionActiva === item.id ? '#0ea5e9' : '#94a3b8'
            }} onClick={() => setSeccionActiva(item.id)} title={!sidebarAbierto ? item.label : ''}>
              <i className={`fa-solid ${item.icon}`} style={{ width: '18px', flexShrink: 0 }}></i>
              {sidebarAbierto && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
            </div>
          ))}

          <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#475569', margin: '20px 0 10px 0', letterSpacing: '1px', textAlign: sidebarAbierto ? 'left' : 'center' }}>
            {sidebarAbierto ? 'CONFIGURACIÓN' : '•••'}
          </div>
          <div className="menu-item" style={{
            padding: '12px 15px', borderRadius: '10px', marginBottom: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
            justifyContent: sidebarAbierto ? 'flex-start' : 'center',
            backgroundColor: seccionActiva === 'usuarios' ? '#1e293b' : 'transparent',
            color: seccionActiva === 'usuarios' ? '#0ea5e9' : '#94a3b8'
          }} onClick={() => setSeccionActiva('usuarios')} title={!sidebarAbierto ? 'Usuarios' : ''}>
            <i className="fa-solid fa-users-gear" style={{ width: '18px', flexShrink: 0 }}></i>
            {sidebarAbierto && <span style={{ whiteSpace: 'nowrap' }}>Usuarios</span>}
          </div>
        </div>

        <div style={{ marginTop: 'auto', borderTop: '1px solid #1e293b', paddingTop: '20px', display: 'flex', alignItems: 'center', gap: '12px', justifyContent: sidebarAbierto ? 'flex-start' : 'center' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#0ea5e9', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>
            {usuario.nombre ? usuario.nombre[0].toUpperCase() : 'U'}
          </div>
          {sidebarAbierto && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ color: 'white', fontSize: '0.85rem', fontWeight: 'bold', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{usuario.nombre} {usuario.apellido}</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{usuario.rol || 'Sin Rol'}</div>
            </div>
          )}
        </div>
      </div>

      <div style={estilos.principal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <div>
            <h2 style={{ margin: 0, color: '#1e293b' }}>Panel Administrativo</h2>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Total Clean C.A. / {seccionActiva.toUpperCase()}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ backgroundColor: 'white', padding: '10px 20px', borderRadius: '15px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', fontWeight: '600', color: '#475569' }}>
              <i className="fa-regular fa-clock" style={{ color: '#0ea5e9' }}></i> {horaActual}
            </div>

            <div
              className="btn-exit"
              onClick={cerrarSesion}
              style={{
                backgroundColor: 'white', padding: '10px 18px', borderRadius: '15px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)', fontWeight: 'bold',
                color: '#f87171', fontSize: '0.85rem'
              }}
            >
              <i className="fa-solid fa-power-off"></i> SALIR
            </div>
          </div>
        </div>
        {renderContenido()}
      </div>
    </div>
  );
}

export default Dashboard;