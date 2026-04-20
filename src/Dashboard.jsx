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
import { Menu, X as CloseIcon, Search } from 'lucide-react';

function Dashboard() {
  const navigate = useNavigate();
  const [seccionActiva, setSeccionActiva] = useState('requisiciones');
  const [sidebarAbierto, setSidebarAbierto] = useState(window.innerWidth > 768); 
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [usuario, setUsuario] = useState({ nombre: '', apellido: '', rol: '', departamento: '' });
  const [cargando, setCargando] = useState(true);
  const [notificacionesLog, setNotificacionesLog] = useState([]);
  const [verNotificaciones, setVerNotificaciones] = useState(false);
  const [busquedaMenu, setBusquedaMenu] = useState('');

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

    if (seccionActiva === 'requisiciones') return <Requisiciones />;
    if (seccionActiva === 'usuarios') return <Usuarios currentUser={usuario} />;
    if (seccionActiva === 'fondos') return <SolicitudFondos />;
    if (seccionActiva === 'tickets') return <ModuloTicketsPago />;
    if (seccionActiva === 'compras') return <Compras />;
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

  if (cargando) return <div style={{ padding: '20px' }}>Iniciando SmartTC...</div>;

  return (
    <div style={estilos.contenedor}>
      {/* OVERLAY PARA MÓVIL */}
      {isMobile && sidebarAbierto && (
        <div className="sidebar-overlay" onClick={() => setSidebarAbierto(false)}></div>
      )}

      <div style={estilos.sidebar} className={`sidebar ${isMobile ? 'mobile-drawer' : ''} ${sidebarAbierto ? 'open' : ''}`}>

        {/* BOTÓN TOGGLE SUTIL (ESTILO <<) */}
        <div
          onClick={() => setSidebarAbierto(!sidebarAbierto)}
          style={{
            position: 'absolute', right: isMobile ? '10px' : '-12px', top: '15px', backgroundColor: '#030712', color: 'white',
            width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', zIndex: 100,
            transform: sidebarAbierto ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.3s',
            border: '2px solid #1e3a8a'
          }}
        >
          {isMobile ? <CloseIcon size={14} /> : <i className="fa-solid fa-angles-left" style={{ fontSize: '0.7rem' }}></i>}
        </div>

        {/* LOGO REMOVIDO POR SOLICITUD */}
        {/* BARRA DE BÚSQUEDA */}
        {sidebarAbierto && (
          <div className="sidebar-search">
            <Search size={18} color="#94a3b8" />
            <input 
              type="text" 
              placeholder="Search..." 
              value={busquedaMenu}
              onChange={(e) => setBusquedaMenu(e.target.value)}
            />
          </div>
        )}

        {!sidebarAbierto && (
          <div style={{ padding: '8px', display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
             <Search size={20} color="#94a3b8" />
          </div>
        )}

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
            
            const matchesSearch = item.label.toLowerCase().includes(busquedaMenu.toLowerCase());
            
            if (hasPerm && matchesSearch) {
              if (acc.length === 0 || acc[acc.length - 1].type !== 'header' || acc[acc.length - 1].cat !== item.cat) {
                 const lastItem = acc.length > 0 ? acc[acc.length-1] : null;
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
                onClick={() => { setSeccionActiva(node.id); if(isMobile) setSidebarAbierto(false); }}
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

      <div style={estilos.principal}>
        <div style={{ display: 'flex', justifyContent: isMobile ? 'space-between' : 'flex-end', alignItems: 'center', marginBottom: isMobile ? '12px' : '30px', position: 'relative' }}>
          
          {isMobile && (
            <button 
              onClick={() => setSidebarAbierto(true)}
              style={{ background: '#030712', color: 'white', border: 'none', padding: '10px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            >
              <Menu size={20} />
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '15px' }}>
            <div style={{ backgroundColor: 'white', padding: isMobile ? '4px 8px' : '10px 20px', borderRadius: isMobile ? '10px' : '15px', display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', fontWeight: '700', color: '#1e3a8a', fontSize: isMobile ? '0.7rem' : '1rem' }}>
              {!isMobile && <i className="fa-solid fa-id-card" style={{ color: '#0ea5e9' }}></i>} {!isMobile ? usuario.rol?.toUpperCase() : getInitials(usuario.nombre, usuario.apellido)}
              <div style={{ borderLeft: '1px solid #e2e8f0', height: '20px', marginLeft: '5px', marginRight: '5px' }}></div>
              <i className="fa-solid fa-user" style={{ color: '#64748b' }}></i> {!isMobile && usuario.nombre}
              <div style={{ borderLeft: '1px solid #e2e8f0', height: '20px', marginLeft: '5px', marginRight: '5px' }}></div>
              <button onClick={cerrarSesion} className="btn-exit-small" style={{ fontSize: '0.7rem', fontWeight: 'bold' }}><i className="fa-solid fa-power-off"></i> {!isMobile && 'SALIR'}</button>
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