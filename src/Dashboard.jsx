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
  const [seccionActiva, setSeccionActiva] = useState('requisiciones');
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
        const rolUsuario = usuario?.rol?.trim().toLowerCase() || '';
        const deptoUsuario = usuario?.departamento?.trim().toLowerCase() || '';
        const deptoReq = payload.new.gerencia?.trim().toLowerCase() || '';
        
        let rolCreador = '';
        if (payload.new.usuario_id) {
          const { data: perfilCreador } = await supabase.from('perfiles').select('rol').eq('id', payload.new.usuario_id).single();
          if (perfilCreador) rolCreador = perfilCreador.rol.trim().toLowerCase();
        }

        const getRank = (rol) => {
          if (rol.includes('analista')) return 1;
          if (rol.includes('coordinador')) return 2;
          if (rol.includes('gerente general') || rol.includes('admin')) return 4;
          if (rol.includes('gerente')) return 3;
          return 0;
        };

        const userRank = getRank(rolUsuario);
        const creatorRank = getRank(rolCreador);

        const esGestionArea = deptoUsuario === deptoReq && userRank > creatorRank;
        const esGerenteGeneralSuperior = (rolUsuario === 'gerente general' || usuario?.esAdminReal) && creatorRank >= 3;

        if (esGestionArea || esGerenteGeneralSuperior) {
          const msg = `Tienes una nueva requisición pendiente de revisar: ${payload.new.correlativo_req || payload.new.id}`;
          toast(msg, { icon: '🔔', duration: 8000 });
          
          setNotificacionesLog(prev => {
            if (prev.length > 0 && prev[0].msg === msg) return prev;
            return [{ id: Date.now(), msg, hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), nuevo: true }, ...prev];
          });
          
          try {
            await supabase.from('notificaciones').insert([{ mensaje: msg, tipo: 'Requisición', usuario_id: usuario.id, leido: false }]);
          } catch (e) {
            console.error("Error guardando notif", e);
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'requisiciones' }, async (payload) => {
        const oldRow = payload.old || {};
        const newRow = payload.new || {};
        const rolUsuario = usuario?.rol?.trim().toLowerCase() || '';
        const deptoUsuario = usuario?.departamento?.trim().toLowerCase() || '';

        // Notificación para Gerente General/Admin cuando se aprueba por área
        if (newRow.estado_aprobacion === 'enviada_general' && oldRow.estado_aprobacion !== 'enviada_general') {
          if (rolUsuario === 'gerente general' || usuario?.esAdminReal) {
            const msg = `Nueva requisición pendiente final: ${newRow.correlativo_req || newRow.id}`;
            toast(msg, { icon: '🔔', duration: 8000 });
            setNotificacionesLog(prev => [{ id: Date.now(), msg, hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), nuevo: true }, ...prev]);
            await supabase.from('notificaciones').insert([{ mensaje: msg, tipo: 'Requisición', usuario_id: usuario.id, leido: false }]);
          }
        }

        // LÓGICA DE COMPRAS/ADMIN/SUPERIOR: Detección de nueva observación
        const observacionCambio = Boolean(newRow.observaciones && newRow.observaciones !== oldRow.observaciones);
        const resetLeido = Boolean(newRow.leido_compras_at === null && oldRow.leido_compras_at !== null);

        if (observacionCambio || resetLeido) {
          let rolCreador = '';
          if (newRow.usuario_id) {
            const { data: perfilCreador } = await supabase.from('perfiles').select('rol').eq('id', newRow.usuario_id).single();
            if (perfilCreador) rolCreador = perfilCreador.rol.trim().toLowerCase();
          }

          const getRank = (rol) => {
            if (rol.includes('analista')) return 1;
            if (rol.includes('coordinador')) return 2;
            if (rol.includes('gerente general') || rol.includes('admin')) return 4;
            if (rol.includes('gerente')) return 3;
            return 0;
          };

          const userRank = getRank(rolUsuario);
          const creatorRank = getRank(rolCreador);
          const deptoReq = newRow.gerencia?.trim().toLowerCase() || '';

          const esCompras = deptoUsuario === 'compras' || rolUsuario.includes('compras') || usuario?.esAdminReal;
          const esSuperiorArea = deptoUsuario === deptoReq && userRank > creatorRank;
          const esCreador = usuario.id === newRow.usuario_id;
          
          if (esCompras || esSuperiorArea || esCreador) {
            const msg = `Nueva observación en requisición ${newRow.correlativo_req || newRow.id}`;
            toast(msg, { icon: '💬', duration: 8000 });
            
            setNotificacionesLog(prev => {
              if (prev.length > 0 && prev[0].msg === msg) return prev;
              return [{ id: Date.now(), msg, hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), nuevo: true }, ...prev];
            });
            
            await supabase.from('notificaciones').insert([{ mensaje: msg, tipo: 'Mensajería', usuario_id: usuario.id, leido: false }]);
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Realtime activado correctamente.');
        }
      });

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
      width: sidebarAbierto ? '130px' : '75px',
      backgroundColor: '#030712', // Oscuro Charcoal casi Negro
      color: '#cbd5e1',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 0',
      flexShrink: 0,
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      boxShadow: '4px 0 10px rgba(0,0,0,0.2)',
      overflow: 'visible'
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

        {/* BOTÓN TOGGLE SUTIL (ESTILO <<) */}
        <div
          onClick={() => setSidebarAbierto(!sidebarAbierto)}
          style={{
            position: 'absolute', right: '-12px', top: '15px', backgroundColor: '#030712', color: 'white',
            width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', zIndex: 100,
            transform: sidebarAbierto ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.3s',
            border: '2px solid #1e3a8a'
          }}
        >
          <i className="fa-solid fa-angles-left" style={{ fontSize: '0.7rem' }}></i>
        </div>

        {/* LOGO REMOVIDO POR SOLICITUD */}
        <div style={{ marginBottom: '20px' }}></div>


        {/* 
        {sidebarAbierto && (
          <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#6d6f72ff', marginBottom: '10px', letterSpacing: '1px', textAlign: 'left', paddingLeft: '15px' }}>
            <i className="fa-solid fa-layer-group" style={{ marginRight: '6px' }}></i> DASHBOARD
          </div>
        )}
        {[
          { id: 'dashboard', icon: 'fa-house-chimney-window', label: 'Dashboard' },
        ].map(item => (
          <div key={item.id} className="menu-item" style={{
            padding: '12px 10px', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer', display: 'flex', 
            flexDirection: 'column', alignItems: 'center', gap: '4px',
            justifyContent: 'center',
            backgroundColor: seccionActiva === item.id ? '#1e293b' : 'transparent',
            color: seccionActiva === item.id ? '#38bdf8' : '#cbd5e1',
            width: '90%',
            transition: 'all 0.2s ease'
          }} onClick={() => setSeccionActiva(item.id)} title={item.label}>
            <div style={{ position: 'relative' }}>
              <i className={`fa-solid ${item.icon}`} style={{ fontSize: '1.1rem' }}></i>
              {(item.id === 'requisiciones' || item.id === 'dashboard') && notificacionesLog.length > 0 && (
                <div style={{ 
                  position: 'absolute', top: '-8px', right: '-10px', background: '#ef4444', color: 'white', 
                  fontSize: '0.65rem', minWidth: '18px', height: '18px', borderRadius: '50%', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', 
                  border: '2px solid #1E3A8A' 
                }}>
                  {notificacionesLog.filter(n => n.nuevo).length || notificacionesLog.length}
                </div>
              )}
            </div>
            {sidebarAbierto && (
              <span style={{ 
                fontSize: '0.65rem', fontWeight: '700', marginTop: '6px', textAlign: 'center',
                lineHeight: '1', width: '100%', whiteSpace: 'normal', display: 'block'
              }}>
                {item.label}
              </span>
            )}
          </div>
        ))}
        */}

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
              padding: '12px 10px', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer', display: 'flex', 
              flexDirection: 'column', alignItems: 'center', gap: '4px',
              justifyContent: 'center',
              backgroundColor: seccionActiva === item.id ? '#1e293b' : 'transparent',
              color: seccionActiva === item.id ? '#38bdf8' : '#cbd5e1',
              width: '90%',
              transition: 'all 0.2s ease'
            }} onClick={() => setSeccionActiva(item.id)} title={item.label}>
              <i className={`fa-solid ${item.icon}`} style={{ fontSize: '1.1rem' }}></i>
              {sidebarAbierto && (
                <span style={{ 
                  fontSize: '0.65rem', fontWeight: '700', marginTop: '6px', textAlign: 'center',
                  lineHeight: '1', width: '100%', whiteSpace: 'normal', display: 'block'
                }}>
                  {item.label}
                </span>
              )}
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
            // { id: 'reportestickets', icon: 'fa-file-contract', label: 'Reporte de Tickets' },

          ].map(item => (
            <div key={item.id} className="menu-item" style={{
              padding: '12px 10px', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer', display: 'flex', 
              flexDirection: 'column', alignItems: 'center', gap: '4px',
              justifyContent: 'center',
              backgroundColor: seccionActiva === item.id ? '#1e293b' : 'transparent',
              color: seccionActiva === item.id ? '#38bdf8' : '#cbd5e1',
              width: '90%',
              transition: 'all 0.2s ease'
            }} onClick={() => setSeccionActiva(item.id)} title={item.label}>
              <div style={{ position: 'relative' }}>
                <i className={`fa-solid ${item.icon}`} style={{ fontSize: '1.1rem' }}></i>
                {(item.id === 'requisiciones' || item.id === 'fondos' || item.id === 'tickets') && notificacionesLog.some(n => n.nuevo) && (
                  <div style={{ 
                    position: 'absolute', top: '-8px', right: '-10px', background: '#ef4444', color: 'white', 
                    fontSize: '0.65rem', minWidth: '18px', height: '18px', borderRadius: '50%', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', 
                    border: '2px solid #030712' 
                  }}>
                    {notificacionesLog.filter(n => n.nuevo).length}
                  </div>
                )}
              </div>
              {sidebarAbierto && (
                <span style={{ 
                  fontSize: '0.65rem', fontWeight: '700', marginTop: '6px', textAlign: 'center',
                  lineHeight: '1', width: '100%', whiteSpace: 'normal', display: 'block'
                }}>
                  {item.label}
                </span>
              )}
            </div>
          ))}


          {sidebarAbierto && (
            <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#475569', margin: '20px 0 10px 0', letterSpacing: '1px', textAlign: 'left', paddingLeft: '15px' }}>
              <i className="fa-solid fa-gears" style={{ marginRight: '6px' }}></i> CONFIGURACIÓN
            </div>
          )}
          <div className="menu-item" style={{
            padding: '12px 10px', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer', display: 'flex',
            flexDirection: 'column', alignItems: 'center', gap: '4px',
            justifyContent: 'center',
            backgroundColor: seccionActiva === 'usuarios' ? '#1e293b' : 'transparent',
            color: seccionActiva === 'usuarios' ? '#38bdf8' : '#cbd5e1',
            width: '90%',
            transition: 'all 0.2s ease'
          }} onClick={() => setSeccionActiva('usuarios')} title="Usuarios">
            <i className="fa-solid fa-users" style={{ fontSize: '1.1rem' }}></i>
            {sidebarAbierto && <span style={{ fontSize: '0.65rem', fontWeight: '700', marginTop: '6px', textAlign: 'center' }}>Usuarios</span>}
          </div>
          {/*
          <div className="menu-item" style={{
            padding: '12px 10px', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer', display: 'flex',
            flexDirection: 'column', alignItems: 'center', gap: '4px',
            justifyContent: 'center',
            backgroundColor: seccionActiva === 'administracion' ? '#1e293b' : 'transparent',
            color: seccionActiva === 'administracion' ? '#38bdf8' : '#cbd5e1',
            width: '90%',
            transition: 'all 0.2s ease'
          }} onClick={() => setSeccionActiva('administracion')} title="Administración">
            <i className="fa-solid fa-gears" style={{ fontSize: '1.1rem' }}></i>
            {sidebarAbierto && <span style={{ fontSize: '0.65rem', fontWeight: '700', marginTop: '6px', textAlign: 'center' }}>Admon</span>}
          </div>
          */}
        </div>

        {/* METADATA USUARIO REMOVIDO POR SOLICITUD */}
        <div style={{ marginBottom: '20px' }}></div>
      </div>

      <div style={estilos.principal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', position: 'relative' }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Total Clean C.A. / {seccionActiva.toUpperCase()}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ backgroundColor: 'white', padding: '10px 20px', borderRadius: '15px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', fontWeight: '700', color: '#1e3a8a' }}>
              <i className="fa-solid fa-id-card" style={{ color: '#0ea5e9' }}></i> {usuario.rol?.toUpperCase()}
              <div style={{ borderLeft: '1px solid #e2e8f0', height: '20px', marginLeft: '5px', marginRight: '5px' }}></div>
              <i className="fa-solid fa-user" style={{ color: '#64748b' }}></i> {usuario.nombre}
              <div style={{ borderLeft: '1px solid #e2e8f0', height: '20px', marginLeft: '5px', marginRight: '5px' }}></div>
              <button onClick={cerrarSesion} className="btn-exit-small" style={{ fontSize: '0.7rem', fontWeight: 'bold' }}><i className="fa-solid fa-power-off"></i> SALIR</button>
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