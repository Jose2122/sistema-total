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
import ReportesMaestro from './ReportesMaestro';
import Proveedores from './Proveedores';
import Administracion from './Administracion';
import Atributos from './Atributos';
import { Menu, X as CloseIcon, Search, Cloud, Sun, ChevronDown, Power } from 'lucide-react';

function Dashboard() {
  const navigate = useNavigate();
  const [seccionActiva, setSeccionActiva] = useState('requisiciones');
  const [sidebarAbierto, setSidebarAbierto] = useState(window.innerWidth > 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
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

  const getInitials = (n, a) => {
    if (!n) return 'TC';
    return `${n.charAt(0)}${a ? a.charAt(0) : ''}`.toUpperCase();
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

    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarAbierto(true);
      else setSidebarAbierto(false);
    };
    window.addEventListener('resize', handleResize);

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
      
      /* SIDEBAR SEARCH */
      .sidebar-search {
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        color: white;
        padding: 8px 12px;
        margin: 10px 15px 25px 15px;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.3s;
      }
      .sidebar-search:focus-within {
        background: rgba(255,255,255,0.1);
        border-color: #38bdf8;
      }
      .sidebar-search input {
        background: transparent;
        border: none;
        color: white;
        font-size: 0.85rem;
        width: 100%;
        outline: none;
      }

      /* HIDE SCROLLBARS */
      .sidebar-scrollable::-webkit-scrollbar { display: none; }
      .sidebar-scrollable { 
        -ms-overflow-style: none; 
        scrollbar-width: none; 
        overflow-y: auto;
        overflow-x: hidden;
        flex: 1;
      }

      /* MODERN MENU ITEMS (CENTRADOS) */
      .menu-item-new {
        margin: 4px auto;
        padding: 10px 5px;
        border-radius: 12px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        color: #94a3b8;
        font-weight: 500;
        width: 85%;
        text-align: center;
      }
      .menu-item-new:hover {
        background: rgba(255,255,255,0.05);
        color: white;
        transform: translateY(-2px);
      }
      .menu-item-new.active {
        background: rgba(56, 189, 248, 0.1);
        color: #38bdf8;
        font-weight: 700;
      }
      .menu-item-new i {
        font-size: 1.1rem;
      }
      .menu-item-new span {
        font-size: 0.65rem;
        line-height: 1.2;
        width: 100%;
        display: block;
        word-wrap: break-word;
      }

      @media (max-width: 768px) {
        .mobile-drawer {
          position: fixed !important;
          left: 0;
          top: 0;
          height: 100vh !important;
          z-index: 2000;
          width: 280px !important;
          transform: translateX(-100%);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .mobile-drawer.open {
          transform: translateX(0);
        }
        .sidebar-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(2px);
          z-index: 1999;
          animation: fadeIn 0.2s ease;
        }
        .input-style, select, button {
          font-size: 16px !important; /* Prevent iOS zoom */
          padding: 12px 14px !important;
          min-height: 44px; /* Touch target size */
        }
      }
    `;
    document.head.appendChild(style);

    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";

    return () => {
      document.head.removeChild(style);
      window.removeEventListener('resize', handleResize);
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
    if (!usuario?.id) return;

    const channel = supabase
      .channel(`notificaciones_user_${usuario.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notificaciones',
        filter: `usuario_id=eq.${usuario.id}`
      }, (payload) => {
        console.log("Notificación recibida en tiempo real:", payload.new);
        const msg = payload.new.mensaje;
        toast(msg, { icon: '🔔', duration: 8000 });

        setNotificacionesLog(prev => [{
          id: payload.new.id,
          msg: payload.new.mensaje,
          hora: new Date(payload.new.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          nuevo: true
        }, ...prev]);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Suscrito a notificaciones para usuario: ${usuario.id}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [usuario?.id]);

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const estilos = {
    contenedor: { display: 'flex', width: '100vw', height: '100vh', backgroundColor: '#f1f5f9', fontFamily: '"Inter", sans-serif' },
    sidebar: {
      width: sidebarAbierto ? '110px' : '75px',
      backgroundColor: '#030712', // Charcoal casi Negro original
      color: '#cbd5e1',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 0',
      flexShrink: 0,
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      boxShadow: '4px 0 10px rgba(0,0,0,0.2)',
      overflow: 'visible',
      zIndex: 1000
    },
    principal: {
      flex: 1,
      padding: isMobile ? '5px' : '10px',
      overflowY: 'auto',
      height: '100vh',
      boxSizing: 'border-box',
      transition: 'all 0.3s'
    },
    card: {
      backgroundColor: 'white',
      padding: isMobile ? '15px' : '30px',
      borderRadius: isMobile ? '16px' : '24px',
      boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
      border: '1px solid #e2e8f0'
    },
    gridStats: {
      display: 'grid',
      gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: isMobile ? '8px' : '20px',
      marginBottom: isMobile ? '15px' : '30px'
    },
    miniCard: (color) => ({
      backgroundColor: 'white',
      padding: isMobile ? '12px' : '20px',
      borderRadius: '14px',
      borderLeft: `${isMobile ? '4px' : '6px'} solid ${color}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: isMobile ? '70px' : 'auto'
    }),
    iconCircle: (bg) => ({
      width: isMobile ? '36px' : '48px',
      height: isMobile ? '36px' : '48px',
      borderRadius: '10px',
      backgroundColor: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white'
    })
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
      reportesmaestro: { titulo: "Centro de Reportes Maestro", icon: "fa-chart-line", color: "#6366f1" },
      reportestickets: { titulo: "Reporte de Tickets", icon: "fa-file-contract", color: "#f59e0b" },
      usuarios: { titulo: "Gestión de Usuarios", icon: "fa-users-gear", color: "#64748b" },
      administracion: { titulo: "Administración Central", icon: "fa-gears", color: "#8b5cf6" }
    };

    if (seccionActiva === 'requisiciones') return <Requisiciones currentUserProp={usuario} />;
    if (seccionActiva === 'usuarios') return <Usuarios currentUser={usuario} />;
    if (seccionActiva === 'fondos') return <SolicitudFondos currentUserProp={usuario} />;
    if (seccionActiva === 'tickets') return <ModuloTicketsPago currentUser={usuario} />;
    if (seccionActiva === 'compras') return <Compras currentUser={usuario} />;
    if (seccionActiva === 'reportes') return <Reportes />;
    if (seccionActiva === 'reportesmaestro') return <ReportesMaestro />;
    if (seccionActiva === 'proveedores') return <Proveedores />;
    if (seccionActiva === 'administracion') return <Administracion />;
    if (seccionActiva === 'atributos') return <Atributos />;

    return (
      <div className="animate-fade">
        <div style={estilos.card}>
          <div style={{ padding: '60px 20px', textAlign: 'center', border: '2px dashed #f1f5f9', borderRadius: '20px' }}>
            <p style={{ color: '#000000ff' }}>Bienvenido al Panel de Gestión SIS-REQUISICIONES. <br /><br /> Use el menú lateral para navegar.</p>
          </div>
        </div>
      </div>
    );
  };

  // Protección de seguridad: si la sección activa no está permitida, reset a la primera permitida
  useEffect(() => {
    if (!usuario?.id) return;
    const esAdmin = usuario?.correo === 'jcontreras.totalclean@gmail.com' ||
      usuario?.correo === 'cvega.totalclean@gmail.com' ||
      usuario?.esAdminReal ||
      usuario?.rol === 'Admin' ||
      usuario?.rol === 'Gerente General';
    if (esAdmin) return;

    const modulosPermitidos = usuario?.permisos_modulos || [];
    if (seccionActiva !== 'dashboard' && !modulosPermitidos.includes(seccionActiva)) {
      if (modulosPermitidos.length > 0) {
        setSeccionActiva(modulosPermitidos[0]);
      } else {
        setSeccionActiva('requisiciones'); // Fallback mínimo
      }
    }
  }, [seccionActiva, usuario?.permisos_modulos]);

  const toggleNotificaciones = () => {
    if (!verNotificaciones) { // Al abrir el panel
      setNotificacionesLog(prev => prev.map(n => ({ ...n, nuevo: false })));
      if (usuario?.id) {
        supabase.from('notificaciones').update({ leido: true }).eq('usuario_id', usuario.id).then();
      }
    }
    setVerNotificaciones(!verNotificaciones);
  };

  if (cargando) return (
    <div style={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #030712 0%, #1e293b 100%)',
      color: 'white',
      fontFamily: '"Inter", sans-serif'
    }}>
      <div style={{
        width: '60px',
        height: '60px',
        border: '4px solid rgba(14, 165, 233, 0.2)',
        borderTopColor: '#0ea5e9',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '20px'
      }}></div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: '800', letterSpacing: '2px', margin: 0 }}>SMART<span style={{ color: '#0ea5e9' }}>TC</span></h2>
      <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Iniciando sistema...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: '#f1f5f9', fontFamily: '"Inter", sans-serif' }}>
      
      {/* BARRA SUPERIOR FULL WIDTH (DASHBOARD PROFESIONAL) */}
      <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0f172a', /* Azul marino profundo */
          padding: '8px 24px',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
          color: 'white',
          position: 'relative',
          minHeight: '45px',
          zIndex: 1100
      }}>
        {/* LADO IZQUIERDO: Toggle y Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div
            onClick={() => setSidebarAbierto(!sidebarAbierto)}
            style={{
              color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px',
              transition: 'color 0.2s'
            }}
            title={sidebarAbierto ? 'Ocultar menú' : 'Mostrar menú'}
          >
            <Menu size={22} />
          </div>
          
          <h2 style={{ fontSize: '1.2rem', fontWeight: '800', letterSpacing: '2px', margin: 0 }}>SMART<span style={{ color: '#0ea5e9' }}>TC</span></h2>
        </div>

        {/* LADO DERECHO: Utilidades */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {/* Indicador de Nube/Sincronización */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.65rem', fontWeight: '700', color: '#60a5fa', letterSpacing: '0.5px' }} title="Conectado a Supabase">
              <Cloud size={14} />
              {!isMobile && <span>ONLINE</span>}
            </div>

            <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255,255,255,0.15)' }}></div>

            {/* Modo Oscuro/Claro */}
            <button style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }} title="Cambiar Tema">
              <Sun size={16} />
            </button>

            <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255,255,255,0.15)' }}></div>

            {/* Centro de Notificaciones */}
            <div
              style={{ position: 'relative', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
              onClick={toggleNotificaciones}
            >
              <i className="fa-solid fa-bell" style={{ fontSize: '1rem', color: notificacionesLog.some(n => n.nuevo) ? '#facc15' : '#cbd5e1', transition: 'color 0.2s' }}></i>
              {notificacionesLog.some(n => n.nuevo) && (
                <div style={{
                  position: 'absolute', top: '-2px', right: '-4px', background: '#3b82f6', color: 'white',
                  fontSize: '0.55rem', fontWeight: 'bold', minWidth: '14px', height: '14px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0f172a'
                }}>
                  {notificacionesLog.filter(n => n.nuevo).length}
                </div>
              )}

              {/* DROPDOWN DE NOTIFICACIONES */}
              {verNotificaciones && (
                <div className="animate-fade" style={{ position: 'absolute', top: '35px', right: 0, width: '320px', backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 15px 35px rgba(0,0,0,0.15)', zIndex: 1000, overflow: 'hidden', border: '1px solid #f1f5f9' }}>
                  <div style={{ padding: '15px 20px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#1e293b', letterSpacing: '0.5px' }}>NOTIFICACIONES</span>
                    <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '600' }}>{notificacionesLog.length} totales</span>
                  </div>
                  <div style={{ maxHeight: '350px', overflowY: 'auto', padding: '10px' }}>
                    {notificacionesLog.length === 0 ? (
                      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                        <i className="fa-solid fa-bell-slash" style={{ fontSize: '1.5rem', color: '#e2e8f0', marginBottom: '10px', display: 'block' }}></i>
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '500' }}>No hay alertas recientes</span>
                      </div>
                    ) : (
                      notificacionesLog.map((n, idx) => (
                        <div key={n.id || idx} style={{
                          padding: '12px 15px',
                          borderRadius: '12px',
                          marginBottom: '6px',
                          backgroundColor: n.nuevo ? '#f0f9ff' : 'transparent',
                          transition: 'all 0.2s',
                          borderLeft: n.nuevo ? '3px solid #0ea5e9' : '3px solid transparent'
                        }}>
                          <div style={{ fontSize: '0.75rem', color: '#1e293b', fontWeight: n.nuevo ? '700' : '500', lineHeight: '1.4' }}>{n.msg}</div>
                          <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: '6px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <i className="fa-regular fa-clock"></i> {n.hora}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div style={{ padding: '10px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
                    <button style={{ background: 'none', border: 'none', color: '#0ea5e9', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer' }}>VER TODO EL HISTORIAL</button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255,255,255,0.15)' }}></div>

            {/* Perfil de Usuario Compacto */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '2px 6px', borderRadius: '8px', transition: 'background 0.2s' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: '1.2' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'white' }}>{usuario.nombre || 'Usuario'}</span>
                <span style={{ fontSize: '0.6rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>{usuario.rol || 'Rol'}</span>
              </div>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#3b82f6',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold', color: 'white',
                border: '2px solid rgba(255,255,255,0.2)'
              }}>
                {getInitials(usuario.nombre, usuario.apellido)}
              </div>
              <ChevronDown size={14} style={{ color: '#94a3b8', marginLeft: '2px' }} title="Opciones" />
            </div>

            <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255,255,255,0.15)' }}></div>

            {/* Botón de Apagar / Salir */}
            <button
              onClick={cerrarSesion}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                borderRadius: '10px',
                transition: 'all 0.2s',
                marginLeft: '5px'
              }}
              title="Cerrar Sesión (Apagar Sistema)"
              onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; e.currentTarget.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.5)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; e.currentTarget.style.color = '#f87171'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <Power size={16} strokeWidth={2.5} />
            </button>
        </div>
      </div>

      {/* ÁREA DE CONTENIDO (SIDEBAR + PRINCIPAL) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* OVERLAY PARA MÓVIL */}
        {isMobile && sidebarAbierto && (
          <div className="sidebar-overlay" onClick={() => setSidebarAbierto(false)}></div>
        )}

        {/* SIDEBAR */}
        <div style={{ ...estilos.sidebar, height: '100%', boxShadow: '4px 0 10px rgba(0,0,0,0.1)', zIndex: 100, paddingTop: '10px' }} className={`sidebar ${isMobile ? 'mobile-drawer' : ''} ${sidebarAbierto ? 'open' : ''}`}>
          <div className="sidebar-scrollable">
            {[
              { id: 'compras', icon: 'fa-cart-plus', label: 'Compras', cat: 'COMPRAS' },
              { id: 'reportesmaestro', icon: 'fa-chart-line', label: 'Reportes Maestro', cat: 'COMPRAS' },
              { id: 'reportes', icon: 'fa-file-contract', label: 'Reporte de Compras', cat: 'COMPRAS' },
              { id: 'proveedores', icon: 'fa-address-book', label: 'Proveedores', cat: 'COMPRAS' },
              { id: 'requisiciones', icon: 'fa-file-signature', label: 'Requisiciones', cat: 'GESTIONES' },
              { id: 'fondos', icon: 'fa-hand-holding-dollar', label: 'Solicitud de Fondos', cat: 'GESTIONES' },
              { id: 'tickets', icon: 'fa-ticket', label: 'Ticket de Pago', cat: 'GESTIONES' },
              { id: 'usuarios', icon: 'fa-users', label: 'Usuarios', cat: 'CONFIGURACIÓN' },
              { id: 'atributos', icon: 'fa-database', label: 'Atributos', cat: 'CONFIGURACIÓN' },
            ].reduce((acc, item) => {
              const hasPerm = usuario?.correo === 'jcontreras.totalclean@gmail.com' ||
                usuario?.correo === 'cvega.totalclean@gmail.com' ||
                usuario?.esAdminReal ||
                usuario?.rol === 'Admin' ||
                usuario?.rol === 'Gerente General' ||
                usuario?.permisos_modulos?.includes(item.id);

              if (hasPerm) {
                if (acc.length === 0 || acc[acc.length - 1].type !== 'header' || acc[acc.length - 1].cat !== item.cat) {
                  const lastItem = acc.length > 0 ? acc[acc.length - 1] : null;
                  if (!lastItem || lastItem.cat !== item.cat) {
                    acc.push({ type: 'header', label: item.cat, cat: item.cat });
                  }
                }
                acc.push({ ...item, type: 'item' });
              }
              return acc;
            }, []).map((node, index) => (
              node.type === 'header' ? (
                sidebarAbierto && (
                  <div key={`header-${index}`} style={{ fontSize: '0.6rem', fontWeight: '900', color: '#475569', margin: '20px 0 10px 0', letterSpacing: '0.5px', textAlign: 'center' }}>
                    {node.label}
                  </div>
                )
              ) : (
                <div
                  key={node.id}
                  className={`menu-item-new ${seccionActiva === node.id ? 'active' : ''}`}
                  onClick={() => { setSeccionActiva(node.id); if (isMobile) setSidebarAbierto(false); }}
                  title={node.label}
                >
                  <i className={`fa-solid ${node.icon}`}></i>
                  {sidebarAbierto && (
                    <span>{node.label}</span>
                  )}
                  {node.id === 'requisiciones' && notificacionesLog.some(n => n.nuevo) && (
                    <div style={{
                      position: 'absolute', top: '2px', right: '12px', background: '#ef4444', color: 'white',
                      fontSize: '0.6rem', minWidth: '16px', height: '16px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
                      border: '1px solid #030712'
                    }}>
                      {notificacionesLog.filter(n => n.nuevo).length}
                    </div>
                  )}
                </div>
              )
            ))}
          </div>

          <div style={{ marginBottom: '20px' }}></div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div style={{ ...estilos.principal, height: '100%', overflowY: 'auto' }}>
          {renderContenido()}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;