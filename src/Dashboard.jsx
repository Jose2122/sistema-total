import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import Requisiciones from './Requisiciones';
import Usuarios from './Usuarios';
import SolicitudFondos from './SolicitudFondos';
import ModuloTicketsPago from './ModuloTicketsPago';
import Compras from './Compras';
import Reportes from './Reportes';
import Proveedores from './Proveedores';
import Administracion from './Administracion';

function Dashboard() {
  const navigate = useNavigate();
  const [seccionActiva, setSeccionActiva] = useState('dashboard');
  const [sidebarAbierto, setSidebarAbierto] = useState(true); // NUEVO ESTADO
  const [usuario, setUsuario] = useState({ nombre: '', apellido: '', rol: '', departamento: '' });
  const [cargando, setCargando] = useState(true);
  const [notificacionesLog, setNotificacionesLog] = useState([]);
  const [verNotificaciones, setVerNotificaciones] = useState(false);

  // Helper para obtener semana actual
  const getSemanaActual = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  };

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

    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      .animate-fade { animation: fadeIn 0.4s ease-out forwards; }
      .menu-item { transition: all 0.2s ease; }
      .menu-item:hover { background-color: #1e293b !important; transform: translateX(4px); color: #0ea5e9 !important; }
      .stat-card { transition: all 0.3s ease; }
      .stat-card:hover { transform: translateY(-4px); box-shadow: 0 12px 20px -5px rgba(0,0,0,0.1); }
      .btn-exit-small { transition: all 0.2s ease; cursor: pointer; color: #f87171; border: none; background: none; font-weight: 700; font-size: 0.75rem; padding: 4px 8px; border-radius: 6px; }
      .btn-exit-small:hover { background-color: #fee2e2; color: #ef4444; }
      .notif-badge { position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; font-size: 0.6rem; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; }
    `;
    document.head.appendChild(style);

    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";

    return () => {
      document.head.removeChild(style);
    };
  }, [navigate]);

  // --- CARGAR HISTORIAL DE NOTIFICACIONES ---
  useEffect(() => {
    if (!usuario?.id) return;
    const fetchNotificaciones = async () => {
      const { data } = await supabase
        .from('notificaciones')
        .select('*')
        .eq('usuario_id', usuario.id)
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (data) {
        setNotificacionesLog(data.map(n => ({
          id: n.id,
          msg: n.mensaje,
          hora: new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          nuevo: !n.leido
        })));
      }
    };
    fetchNotificaciones();
  }, [usuario?.id]);

  // --- REALTIME NOTIFICATIONS ---
  useEffect(() => {
    if (!usuario?.rol) return;

    const semActual = getSemanaActual();
    const currYear = new Date().getFullYear().toString().slice(-2);

    const channel = supabase
      .channel('dashboard_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requisiciones' }, async (payload) => {
        if (usuario.rol === 'Gerente') {
          if (usuario.departamento === payload.new.gerencia) {
            const msg = `Tienes una nueva requisición: ${payload.new.correlativo_req || payload.new.id}`;
            toast(msg, { icon: '🔔' });
            setNotificacionesLog(prev => [{ id: Date.now(), msg, hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), nuevo: true }, ...prev]);
            await supabase.from('notificaciones').insert([{ mensaje: msg, tipo: 'Requisición', usuario_id: usuario.id, leido: false }]);
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'requisiciones' }, async (payload) => {
        const oldRow = payload.old;
        const newRow = payload.new;

        if (newRow.estado_aprobacion === 'enviada_general' && oldRow.estado_aprobacion !== 'enviada_general') {
          if (usuario.rol === 'Gerente General' || usuario.esAdminReal) {
            const msg = `Nueva requisición pendiente de aprobación final: ${newRow.correlativo_req || newRow.id}`;
            toast(msg, { icon: '🔔' });
            setNotificacionesLog(prev => [{ id: Date.now(), msg, hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), nuevo: true }, ...prev]);
            await supabase.from('notificaciones').insert([{ mensaje: msg, tipo: 'Requisición', usuario_id: usuario.id, leido: false }]);
          }
        }

        // Detección de nueva observación para Compras
        const leidoCambio = newRow.leido_compras_at === null && oldRow.leido_compras_at !== null;
        const observacionCambio = newRow.observaciones !== oldRow.observaciones && newRow.observaciones;

        if (leidoCambio || observacionCambio) {
          if (usuario.departamento === 'Compras' || usuario.esAdminReal) {
            const msg = `Se ha hecho una nueva observación en la requisición ${newRow.correlativo_req || newRow.id} – SEM ${semActual}- ${currYear}`;
            toast(msg, { icon: '💬' });
            // Evitar duplicados inmediatos en UI
            setNotificacionesLog(prev => {
                if(prev.length > 0 && prev[0].msg === msg) return prev;
                return [{ id: Date.now(), msg, hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), nuevo: true }, ...prev];
            });
            await supabase.from('notificaciones').insert([{ mensaje: msg, tipo: 'Mensajería', usuario_id: usuario.id, leido: false }]);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [usuario]);

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const estilos = {
    contenedor: { display: 'flex', width: '100vw', height: '100vh', backgroundColor: '#f1f5f9', fontFamily: '"Inter", sans-serif' },
    sidebar: {
      width: sidebarAbierto ? '200px' : '68px',
      backgroundColor: '#04070eff',
      color: '#94a3b8',
      display: 'flex',
      flexDirection: 'column',
      padding: sidebarAbierto ? '12px' : '10px',
      flexShrink: 0,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      borderRight: '1px solid #1e293b'
    },
    principal: { flex: 1, padding: '10px', overflowY: 'auto', height: '100vh', boxSizing: 'border-box', transition: 'all 0.3s' },
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
      stocks: { titulo: "Control de Inventario", icon: "fa-warehouse", color: "#8b5cf6" },
      proveedores: { titulo: "Directorio de Proveedores", icon: "fa-truck-ramp-box", color: "#ec4899" },
      requisiciones: { titulo: "Solicitudes Internas", icon: "fa-file-signature", color: "#0ea5e9" },
      fondos: { titulo: "Solicitud de Fondos", icon: "fa-wallet", color: "#22c55e" },
      tickets: { titulo: "Ticket de Pago", icon: "fa-ticket", color: "#f59e0b" },
      reportes: { titulo: "Centro de Reportes", icon: "fa-file-contract", color: "#0ea5e9" },
      reportestickets: { titulo: "Reporte de Tickets", icon: "fa-file-contract", color: "#f59e0b" },
      usuarios: { titulo: "Gestión de Usuarios", icon: "fa-users-gear", color: "#64748b" },
      administracion: { titulo: "Administración Central", icon: "fa-gears", color: "#8b5cf6" }
    };

    if (seccionActiva === 'requisiciones') return <Requisiciones />;
    if (seccionActiva === 'usuarios') return <Usuarios />;
    if (seccionActiva === 'fondos') return <SolicitudFondos />;
    if (seccionActiva === 'tickets') return <ModuloTicketsPago />;
    if (seccionActiva === 'compras') return <Compras />;
    if (seccionActiva === 'reportes') return <Reportes />;
    if (seccionActiva === 'proveedores') return <Proveedores />;
    if (seccionActiva === 'administracion') return <Administracion />;


    const current = config[seccionActiva] || config.dashboard;

    return (
      <div className="animate-fade">
        {seccionActiva === 'dashboard' && (
          <div style={estilos.gridStats}>
            <div style={estilos.miniCard('#0ea5e9')} className="stat-card">
              <div><div style={{ fontSize: '0.75rem', color: '#64748b' }}>Requisiciones</div><div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>0</div></div>
              <div style={estilos.iconCircle('#e0f2fe')}><i className="fa-solid fa-file-invoice" style={{ color: '#0ea5e9' }}></i></div>
            </div>
            <div style={estilos.miniCard('#f59e0b')} className="stat-card">
              <div><div style={{ fontSize: '0.75rem', color: '#64748b' }}>Stock Crítico</div><div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>0</div></div>
              <div style={estilos.iconCircle('#fef3c7')}><i className="fa-solid fa-triangle-exclamation" style={{ color: '#f59e0b' }}></i></div>
            </div>
            <div style={estilos.miniCard('#10b981')} className="stat-card">
              <div><div style={{ fontSize: '0.75rem', color: '#64748b' }}>Disponibilidad</div><div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>0</div></div>
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
            <p style={{ color: '#000000ff' }}>Este Modulo Estará Activo Próximamente.  <br /><br /> {current.titulo}  en desarrollo.</p>
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
          {sidebarAbierto && <div style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem', whiteSpace: 'nowrap' }}>SITC</div>}
        </div>


        {sidebarAbierto && (
          <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#6d6f72ff', marginBottom: '10px', letterSpacing: '1px', textAlign: 'left', paddingLeft: '15px' }}>
            <i className="fa-solid fa-layer-group" style={{ marginRight: '6px' }}></i> DASHBOARD
          </div>
        )}
        {[
          { id: 'dashboard', icon: 'fa-house-chimney-window', label: 'Dashboard' },
        ].map(item => (
          <div key={item.id} className="menu-item" style={{
            padding: '12px 15px', borderRadius: '10px', marginBottom: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1px',
            justifyContent: sidebarAbierto ? 'flex-start' : 'center',
            backgroundColor: seccionActiva === item.id ? '#1e293b' : 'transparent',
            color: seccionActiva === item.id ? '#0ea5e9' : '#94a3b8'
          }} onClick={() => setSeccionActiva(item.id)} title={!sidebarAbierto ? item.label : ''}>
            <i className={`fa-solid ${item.icon}`} style={{ width: '18px', flexShrink: 0 }}></i>
            {sidebarAbierto && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
          </div>
        ))}

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {sidebarAbierto && (
            <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#6d6f72ff', marginBottom: '10px', letterSpacing: '1px', textAlign: 'left', paddingLeft: '15px' }}>
              <i className="fa-solid fa-layer-group" style={{ marginRight: '6px' }}></i> COMPRAS
            </div>
          )}
          {[
            { id: 'compras', icon: 'fa-cart-plus', label: 'Compras' },
            { id: 'reportes', icon: 'fa-file-contract', label: 'Reporte de Compras' },
            { id: 'proveedores', icon: 'fa-address-book', label: 'Proveedores' },

          ].map(item => (
            <div key={item.id} className="menu-item" style={{
              padding: '12px 15px', borderRadius: '10px', marginBottom: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1px',
              justifyContent: sidebarAbierto ? 'flex-start' : 'center',
              backgroundColor: seccionActiva === item.id ? '#1e293b' : 'transparent',
              color: seccionActiva === item.id ? '#0ea5e9' : '#94a3b8'
            }} onClick={() => setSeccionActiva(item.id)} title={!sidebarAbierto ? item.label : ''}>
              <i className={`fa-solid ${item.icon}`} style={{ width: '18px', flexShrink: 0 }}></i>
              {sidebarAbierto && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
            </div>
          ))}



          {sidebarAbierto && (
            <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#475569', margin: '20px 0 10px 0', letterSpacing: '1px', textAlign: 'left', paddingLeft: '15px' }}>
              <i className="fa-solid fa-list-check" style={{ marginRight: '6px' }}></i> GESTIONES
            </div>
          )}
          {[
            { id: 'requisiciones', icon: 'fa-file-signature', label: 'Requisiciones' },
            { id: 'fondos', icon: 'fa-hand-holding-dollar', label: 'Solicitud de Fondos' },
            { id: 'tickets', icon: 'fa-ticket', label: 'Ticket de Pago' },
            { id: 'reportestickets', icon: 'fa-file-contract', label: 'Reporte de Tickets' },

          ].map(item => (
            <div key={item.id} className="menu-item" style={{
              padding: '12px 15px', borderRadius: '10px', marginBottom: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1px',
              justifyContent: sidebarAbierto ? 'flex-start' : 'center',
              backgroundColor: seccionActiva === item.id ? '#1e293b' : 'transparent',
              color: seccionActiva === item.id ? '#0ea5e9' : '#94a3b8'
            }} onClick={() => setSeccionActiva(item.id)} title={!sidebarAbierto ? item.label : ''}>
              <i className={`fa-solid ${item.icon}`} style={{ width: '18px', flexShrink: 0 }}></i>
              {sidebarAbierto && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
            </div>
          ))}


          {sidebarAbierto && (
            <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#475569', margin: '20px 0 10px 0', letterSpacing: '1px', textAlign: 'left', paddingLeft: '15px' }}>
              <i className="fa-solid fa-gears" style={{ marginRight: '6px' }}></i> CONFIGURACIÓN
            </div>
          )}
          <div className="menu-item" style={{
            padding: '12px 15px', borderRadius: '10px', marginBottom: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
            justifyContent: sidebarAbierto ? 'flex-start' : 'center',
            backgroundColor: seccionActiva === 'usuarios' ? '#1e293b' : 'transparent',
            color: seccionActiva === 'usuarios' ? '#0ea5e9' : '#94a3b8'
          }} onClick={() => setSeccionActiva('usuarios')} title={!sidebarAbierto ? 'Usuarios' : ''}>
            <i className="fa-solid fa-users" style={{ width: '18px', flexShrink: 0 }}></i>
            {sidebarAbierto && <span style={{ whiteSpace: 'nowrap' }}>Usuarios</span>}
          </div>
          <div className="menu-item" style={{
            padding: '12px 15px', borderRadius: '10px', marginBottom: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
            justifyContent: sidebarAbierto ? 'flex-start' : 'center',
            backgroundColor: seccionActiva === 'administracion' ? '#1e293b' : 'transparent',
            color: seccionActiva === 'administracion' ? '#0ea5e9' : '#94a3b8'
          }} onClick={() => setSeccionActiva('administracion')} title={!sidebarAbierto ? 'Administración' : ''}>
            <i className="fa-solid fa-gears" style={{ width: '18px', flexShrink: 0 }}></i>
            {sidebarAbierto && <span style={{ whiteSpace: 'nowrap' }}>Administración</span>}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', position: 'relative' }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Total Clean C.A. / {seccionActiva.toUpperCase()}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ backgroundColor: 'white', padding: '10px 20px', borderRadius: '15px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', fontWeight: '600', color: '#475569' }}>
              <i className="fa-solid fa-user" style={{ color: '#0ea5e9' }}></i> {usuario.nombre} {usuario.apellido}
              <div style={{ borderLeft: '1px solid #e2e8f0', height: '20px', marginLeft: '5px', marginRight: '5px' }}></div>
              <button onClick={cerrarSesion} className="btn-exit-small"><i className="fa-solid fa-power-off"></i> SALIR</button>
            </div>

            <div
              style={{ backgroundColor: 'white', padding: '10px', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer', position: 'relative' }}
              onClick={() => setVerNotificaciones(!verNotificaciones)}
            >
              <i className="fa-solid fa-bell" style={{ color: notificacionesLog.length > 0 ? '#f59e0b' : '#94a3b8' }}></i>
              {notificacionesLog.length > 0 && <div className="notif-badge">{notificacionesLog.length}</div>}

              {/* DROPDOWN DE NOTIFICACIONES */}
              {verNotificaciones && (
                <div style={{ position: 'absolute', top: '50px', right: 0, width: '320px', backgroundColor: 'white', borderRadius: '18px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', padding: '15px', zIndex: 1000, maxHeight: '400px', overflowY: 'auto' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: '900', color: '#1e293b', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    LOG DE ACTIVIDAD
                    <span onClick={async () => {
                        // Limpiar UI visualmente de inmediato
                        setNotificacionesLog(prev => prev.map(n => ({...n, nuevo: false})));
                        if(usuario?.id) await supabase.from('notificaciones').update({leido: true}).eq('usuario_id', usuario.id);
                    }} style={{ color: '#0ea5e9', fontWeight: 'bold', fontSize: '0.65rem', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', backgroundColor: '#e0f2fe' }}>MARCAR LEÍDAS</span>
                  </div>
                  {notificacionesLog.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>No hay notificaciones recientes</div>
                  ) : (
                    notificacionesLog.map(n => (
                      <div key={n.id} style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', marginBottom: '5px', backgroundColor: n.nuevo ? '#f0f9ff' : 'transparent', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ fontSize: '0.75rem', color: '#1e293b', fontWeight: n.nuevo ? '700' : '500', lineHeight: '1.4' }}>{n.msg}</div>
                          {n.nuevo && <div style={{ minWidth: '8px', height: '8px', backgroundColor: '#0ea5e9', borderRadius: '50%', marginTop: '4px' }}></div>}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '6px', fontWeight: '600' }}>{n.hora}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {renderContenido()}
      </div>
    </div>
  );
}

export default Dashboard;