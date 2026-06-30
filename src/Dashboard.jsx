import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import Requisiciones from './Requisiciones';
import Usuarios from './Usuarios';
import SolicitudFondos from './SolicitudFondos';
import ModuloTicketsPago from './ModuloTicketsPago';
import Compras from './Compras';
import Reportes from './Reportes';
import ReportesMaestro from './ReportesMaestro';
import ReporteOperaciones from './ReporteOperaciones';
import Proveedores from './Proveedores';
import Administracion from './Administracion';
import Atributos from './Atributos';
import Almacen from './Almacen';
import ResumenSesion from './ResumenSesion';
import ResumenEjecutivo from './ResumenEjecutivo';
import AnalyticsCompras from './AnalyticsCompras';
import ControlPrecios from './ControlPrecios';
import LiquidacionFacturas from './LiquidacionFacturas';
import AsistenteAyuda from './components/AsistenteAyuda';
import { Menu, X as CloseIcon, Search, Cloud, Sun, ChevronDown, Power, LayoutDashboard, BarChartBig, Gauge } from 'lucide-react';

function Dashboard() {
  const navigate = useNavigate();
  const [seccionActiva, setSeccionActiva] = useState('dashboard');
  const [sidebarAbierto, setSidebarAbierto] = useState(window.innerWidth > 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [usuario, setUsuario] = useState({ nombre: '', apellido: '', rol: '', departamento: '', permisos: {} });
  const [cargando, setCargando] = useState(true);
  const [notificacionesLog, setNotificacionesLog] = useState([]);
  const [verNotificaciones, setVerNotificaciones] = useState(false);
  const [verPerfil, setVerPerfil] = useState(false);
  const globalPresenceRef = useRef(null);

  const [dropdowns, setDropdowns] = useState({
    compras: true,
    control: true,
    gestiones: true,
    configuracion: true
  });

  const toggleDropdown = (key) => {
    setDropdowns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (['compras', 'reportesmaestro', 'reporte_operaciones', 'reportes', 'proveedores', 'analytics_compras'].includes(seccionActiva)) {
      setDropdowns(prev => ({ ...prev, compras: true }));
    } else if (['ejecutivo', 'control_precios'].includes(seccionActiva)) {
      setDropdowns(prev => ({ ...prev, control: true }));
    } else if (['requisiciones', 'fondos', 'tickets', 'almacen'].includes(seccionActiva)) {
      setDropdowns(prev => ({ ...prev, gestiones: true }));
    } else if (['usuarios', 'atributos'].includes(seccionActiva)) {
      setDropdowns(prev => ({ ...prev, configuracion: true }));
    }
  }, [seccionActiva]);


  // Helper para obtener semana actual
  const getSemanaActual = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  };

  const buildUsuarioConPermisos = (perfil) => {
    if (!perfil) return null;
    const permisos = {};
    const modulos = perfil.permisos_modulos || [];
    const todosModulos = [
      'dashboard', 'requisiciones', 'fondos', 'tickets', 'almacen',
      'compras', 'reportesmaestro', 'reporte_operaciones', 'reportes', 'proveedores',
      'analytics_compras', 'ejecutivo', 'control_precios', 'usuarios', 'atributos', 'administracion', 'liquidacion', 'admin_analytics'
    ];
    todosModulos.forEach(modId => {
      permisos[modId] = modulos.includes(modId);
    });
    return { ...perfil, permisos };
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
        setUsuario(buildUsuarioConPermisos(perfil));
      } else {
        setUsuario({ nombre: user.email.split('@')[0], apellido: '', rol: 'Usuario', departamento: 'Total Clean', permisos: {} });
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

        .user-dropdown-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 15px;
          color: #1e293b;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border-radius: 10px;
        }
        .user-dropdown-item:hover {
          background-color: #f1f5f9;
          color: #0ea5e9;
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

      let mapped = [];
      if (data) {
        mapped = data.map(n => {
          const date = new Date(n.created_at);
          const fCorta = date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
          const hCorta = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
          return {
            id: n.id,
            msg: n.mensaje,
            hora: `${fCorta} - ${hCorta}`,
            nuevo: !n.leido,
            requisicion_id: n.requisicion_id
          };
        });
      }

      // Consultar alertas administrativas virtuales
      const rolUpper = (usuario.rol || '').toUpperCase();
      const emailLower = (usuario.correo || usuario.email || '').toLowerCase();
      const esAdmin = rolUpper === 'ADMINISTRADOR' || rolUpper === 'ADMIN' || rolUpper === 'DESARROLLADOR' || emailLower === 'jcontreras.totalclean@gmail.com';
      
      if (esAdmin) {
        const alerts = [];
        const unDiaAtras = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const dosDiasAtras = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

        try {
          // 1. Errores de Sistema Recientes
          const { count: errCount } = await supabase
            .from('system_errors')
            .select('*', { count: 'exact', head: true })
            .gt('created_at', unDiaAtras);

          if (errCount && errCount > 0) {
            alerts.push({
              id: `alert-sys-err-${Date.now()}`,
              msg: `🚨 [SISTEMA] Se han registrado ${errCount} errores en las últimas 24 horas.`,
              hora: 'Alerta Activa ⚠️',
              nuevo: true,
              tipo_alerta: 'critico'
            });
          }

          // 2. Incumplimiento de SLA (Requisición en Espera / Pendiente por más de 48h)
          const { count: slaCount } = await supabase
            .from('requisiciones')
            .select('*', { count: 'exact', head: true })
            .or('estado_aprobacion.ilike.pendiente%,estado_aprobacion.eq.En Espera')
            .lt('created_at', dosDiasAtras);

          if (slaCount && slaCount > 0) {
            alerts.push({
              id: `alert-sla-${Date.now()}`,
              msg: `⏱️ [SLA] Hay ${slaCount} requisiciones esperando aprobación por más de 48 horas.`,
              hora: 'Alerta Activa ⚠️',
              nuevo: true,
              tipo_alerta: 'sla'
            });
          }

          // 3. Intentos de inicio fallidos (Seguridad)
          const { count: authFailCount } = await supabase
            .from('user_auth_logs')
            .select('*', { count: 'exact', head: true })
            .eq('exitoso', false)
            .gt('created_at', unDiaAtras);

          if (authFailCount && authFailCount > 0) {
            alerts.push({
              id: `alert-sec-${Date.now()}`,
              msg: `🔒 [SEGURIDAD] Se registraron ${authFailCount} inicios de sesión fallidos en las últimas 24h.`,
              hora: 'Alerta Activa ⚠️',
              nuevo: true,
              tipo_alerta: 'seguridad'
            });
          }

        } catch (err) {
          console.warn("Error al cargar alertas administrativas:", err.message);
        }
        setNotificacionesLog([...alerts, ...mapped]);
      } else {
        setNotificacionesLog(mapped);
      }
    };
    fetchNotificaciones();
  }, [usuario?.id, usuario?.rol, usuario?.correo, usuario?.email]);

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

        const date = new Date(payload.new.created_at);
        const fCorta = date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
        const hCorta = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });

        setNotificacionesLog(prev => [{
          id: payload.new.id,
          msg: payload.new.mensaje,
          hora: `${fCorta} - ${hCorta}`,
          nuevo: true,
          requisicion_id: payload.new.requisicion_id
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

  // --- SEGURIDAD Y TELEMETRÍA: CO-PRESENCIA GLOBAL EN TIEMPO REAL ---
  useEffect(() => {
    if (!usuario?.id) return;

    const channel = supabase.channel('sitc_global_presence');
    globalPresenceRef.current = channel;

    channel
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: usuario.id,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            rol: usuario.rol,
            departamento: usuario.departamento,
            correo: usuario.correo || usuario.email,
            online_at: new Date().toISOString()
          });
        }
      });

    return () => {
      if (globalPresenceRef.current) {
        supabase.removeChannel(globalPresenceRef.current);
        globalPresenceRef.current = null;
      }
    };
  }, [usuario?.id, usuario?.nombre, usuario?.apellido, usuario?.rol, usuario?.departamento, usuario?.correo, usuario?.email]);

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
      reporte_operaciones: { titulo: "Reporte de Operaciones", icon: "fa-chart-bar", color: "#3b82f6" },
      reportestickets: { titulo: "Reporte de Tickets", icon: "fa-file-contract", color: "#f59e0b" },
      usuarios: { titulo: "Gestión de Usuarios", icon: "fa-users-gear", color: "#64748b" },
      administracion: { titulo: "Administración Central", icon: "fa-gears", color: "#8b5cf6" },
      liquidacion: { titulo: "Liquidación de Facturas", icon: "fa-file-invoice-dollar", color: "#2563eb" }
    };

    if (seccionActiva === 'requisiciones') return <Requisiciones currentUserProp={usuario} />;
    if (seccionActiva === 'usuarios') return <Usuarios currentUser={usuario} onUserUpdate={(updatedUser) => setUsuario(buildUsuarioConPermisos(updatedUser))} />;
    if (seccionActiva === 'fondos') return <SolicitudFondos currentUserProp={usuario} />;
    if (seccionActiva === 'tickets') return <ModuloTicketsPago currentUser={usuario} />;
    if (seccionActiva === 'liquidacion') return <LiquidacionFacturas currentUser={usuario} />;
    if (seccionActiva === 'compras') return <Compras currentUser={usuario} />;
    if (seccionActiva === 'reportes') return <Reportes />;
    if (seccionActiva === 'reportesmaestro') return <ReportesMaestro />;
    if (seccionActiva === 'reporte_operaciones') return <ReporteOperaciones currentUser={usuario} />;
    if (seccionActiva === 'proveedores') return <Proveedores />;
    if (seccionActiva === 'administracion') return <Administracion />;
    if (seccionActiva === 'atributos') return <Atributos />;
    if (seccionActiva === 'almacen') return <Almacen />;
    if (seccionActiva === 'ejecutivo') return <ResumenEjecutivo currentUser={usuario} />;
    if (seccionActiva === 'control_precios') return <ControlPrecios currentUser={usuario} />;
    if (seccionActiva === 'analytics_compras') return <AnalyticsCompras usuario={usuario} />;
    if (seccionActiva === 'dashboard') return <ResumenSesion currentUser={usuario} setActiveSeccion={setSeccionActiva} />;

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
    if (!usuario?.id || !usuario?.permisos) return;
    const isPermitted = !!usuario?.permisos?.[seccionActiva] || seccionActiva === 'dashboard';
    if (!isPermitted) {
      // Buscar el primer módulo que tenga activo (true)
      const primerModuloPermitido = Object.keys(usuario.permisos).find(key => usuario.permisos[key] === true);
      if (primerModuloPermitido) {
        setSeccionActiva(primerModuloPermitido);
      } else {
        setSeccionActiva('dashboard'); // Fallback final
      }
    }
  }, [seccionActiva, usuario?.permisos]);

  // Suscripción en tiempo real a cambios del propio perfil
  useEffect(() => {
    if (!usuario?.id) return;

    const channel = supabase
      .channel(`perfil_cambios_${usuario.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'perfiles',
          filter: `id=eq.${usuario.id}`
        },
        (payload) => {
          console.log('Perfil de usuario actualizado en tiempo real:', payload.new);
          setUsuario(buildUsuarioConPermisos(payload.new));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [usuario?.id]);

  const toggleNotificaciones = async () => {
    const nuevoEstado = !verNotificaciones;
    setVerNotificaciones(nuevoEstado);
    if (nuevoEstado) {
      const nuevas = notificacionesLog.filter(n => n.nuevo);
      if (nuevas.length > 0) {
        try {
          const ids = nuevas.map(n => n.id);
          await supabase.from('notificaciones').update({ leido: true }).in('id', ids);
          setNotificacionesLog(prev => prev.map(n => ids.includes(n.id) ? { ...n, nuevo: false } : n));
        } catch (err) {
          console.error("Error al marcar notificaciones como leídas:", err);
        }
      }
    }
  };

  const manejarClicNotificacion = async (notif) => {
    // 1. Marcar como leído individualmente
    if (notif.nuevo) {
      if (notif.id && !notif.id.toString().startsWith('alert-')) {
        supabase.from('notificaciones').update({ leido: true }).eq('id', notif.id).then();
      }
      setNotificacionesLog(prev => prev.map(n => n.id === notif.id ? { ...n, nuevo: false } : n));
    }

    // 2. Deep Linking & Redirección de Alertas
    if (notif.tipo_alerta === 'critico' || notif.tipo_alerta === 'seguridad') {
      setSeccionActiva('admin_analytics');
      navigate('/admin/analytics');
      setVerNotificaciones(false); // Cerrar panel
    } else if (notif.tipo_alerta === 'sla') {
      setSeccionActiva('requisiciones');
      setVerNotificaciones(false); // Cerrar panel
    } else if (notif.requisicion_id) {
      setSeccionActiva('requisiciones');
      setVerNotificaciones(false); // Cerrar panel

      // Emitir evento global para que Requisiciones.jsx abra el modal
      setTimeout(() => {
        const event = new CustomEvent('abrirRequisicionDeepLink', { detail: notif.requisicion_id });
        window.dispatchEvent(event);
      }, 400); // Dar tiempo al componente para montar si no estaba activo
    }
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
      <h2 style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '2px', margin: 0 }}>SITC<span style={{ color: '#0ea5e9' }}>.</span></h2>
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
        backgroundColor: 'rgba(15, 23, 42, 0.85)', /* Glassmorphism Base */
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding: '8px 24px',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
        color: 'white',
        position: 'relative',
        minHeight: '55px',
        zIndex: 900,
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
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

          <h2 style={{ fontSize: '1.25rem', fontWeight: '900', letterSpacing: '3px', margin: 0, color: 'white' }}>
            SITC<span style={{ color: '#0ea5e9' }}>.</span>
          </h2>
        </div>

        {/* LADO DERECHO: Utilidades */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {/* Indicador de Nube/Sincronización */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.65rem', fontWeight: '700', color: '#60a5fa', letterSpacing: '0.5px' }} title="Conectado a Supabase">
            <Cloud size={14} />
          </div>

          <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(255,255,255,0.08)' }}></div>

          {/* Centro de Notificaciones */}
          <div
            style={{ position: 'relative', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
            onClick={toggleNotificaciones}
          >
            <i className="fa-solid fa-bell" style={{ fontSize: '1.1rem', color: notificacionesLog.some(n => n.nuevo) ? '#38bdf8' : '#64748b', transition: 'all 0.3s' }}></i>
            {notificacionesLog.some(n => n.nuevo) && (
              <div style={{
                position: 'absolute', top: '2px', right: '2px', width: '8px', height: '8px', backgroundColor: '#ef4444',
                borderRadius: '50%', border: '2px solid #0f172a', boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)'
              }}></div>
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
                      <div
                        key={n.id || idx}
                        className="notificacion-card-item"
                        onClick={() => manejarClicNotificacion(n)}
                        style={{
                          padding: '12px 15px',
                          borderRadius: '12px',
                          marginBottom: '6px',
                          backgroundColor: n.nuevo ? '#f0f9ff' : 'transparent',
                          transition: 'all 0.2s',
                          borderLeft: n.nuevo ? '3px solid #0ea5e9' : '3px solid transparent',
                          cursor: 'pointer' // Hover manejado por clase global
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

          <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(255,255,255,0.08)' }}></div>
 
           {/* Perfil de Usuario Premium */}
           <div 
             style={{ position: 'relative' }}
             onMouseLeave={() => setVerPerfil(false)}
           >
             <div 
               onClick={() => setVerPerfil(!verPerfil)}
               style={{ 
                 display: 'flex', 
                 alignItems: 'center', 
                 gap: '12px', 
                 cursor: 'pointer', 
                 padding: '4px 10px', 
                 borderRadius: '12px', 
                 transition: 'all 0.2s',
                 backgroundColor: verPerfil ? 'rgba(255,255,255,0.05)' : 'transparent'
               }}
               onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
               onMouseLeave={(e) => { if(!verPerfil) e.currentTarget.style.backgroundColor = 'transparent' }}
             >
               <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                 <span style={{ 
                   fontSize: '0.85rem', 
                   fontWeight: '800', 
                   color: 'white', 
                   letterSpacing: '0.2px',
                   lineHeight: '1.2'
                 }}>
                   {`${usuario.nombre?.split(' ')[0] || ''} ${usuario.apellido?.split(' ')[0] || ''}`.trim() || 'Usuario'}
                 </span>
                 <span style={{
                   fontSize: '0.55rem',
                   fontWeight: '900',
                   color: '#38bdf8',
                   textTransform: 'uppercase',
                   letterSpacing: '0.5px',
                   opacity: 0.9
                 }}>
                   {usuario.rol || 'Rol'}
                 </span>
               </div>
               <div style={{
                 width: '36px', 
                 height: '36px', 
                 borderRadius: '10px', 
                 backgroundColor: '#0ea5e9',
                 display: 'flex', 
                 alignItems: 'center', 
                 justifyContent: 'center', 
                 fontSize: '0.9rem', 
                 fontWeight: '900', 
                 color: 'white',
                 border: '2px solid rgba(255,255,255,0.15)',
                 boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
               }}>
                 {getInitials(usuario.nombre, usuario.apellido)}
               </div>
               <ChevronDown 
                 size={14} 
                 style={{ 
                   color: '#64748b', 
                   transition: 'transform 0.3s ease',
                   transform: verPerfil ? 'rotate(180deg)' : 'rotate(0)'
                 }} 
               />
             </div>
 
             {/* DROPDOWN DE PERFIL */}
             <AnimatePresence>
               {verPerfil && (
                 <motion.div
                   initial={{ opacity: 0, y: 10, scale: 0.95 }}
                   animate={{ opacity: 1, y: 5, scale: 1 }}
                   exit={{ opacity: 0, y: 10, scale: 0.95 }}
                   style={{
                     position: 'absolute',
                     top: '100%',
                     right: 0,
                     width: '200px',
                     backgroundColor: 'white',
                     borderRadius: '16px',
                     boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                     padding: '8px',
                     zIndex: 1100,
                     border: '1px solid #f1f5f9'
                   }}
                 >
                   <div style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', marginBottom: '4px' }}>
                     <div style={{ fontSize: '0.6rem', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase' }}>Sesión activa</div>
                     <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#1e293b', marginTop: '2px' }}>{usuario.correo}</div>
                   </div>
 
                   <div 
                     className="user-dropdown-item"
                     onClick={cerrarSesion}
                     style={{ color: '#ef4444', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: '600' }}
                   >
                     <Power size={16} />
                     <span>Cerrar Sesión</span>
                   </div>
                 </motion.div>
               )}
             </AnimatePresence>
            </div>

            {/* Botón de Cierre de Sesión Directo (Lado Derecho) */}
            {!isMobile && (
              <button
                onClick={cerrarSesion}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  padding: '6px 12px',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  marginLeft: '10px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                  e.currentTarget.style.color = '#ef4444';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                  e.currentTarget.style.color = '#f87171';
                }}
              >
                <Power size={14} />
                <span>SALIR</span>
              </button>
            )}
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
            {/* Direct Link to Dashboard */}
            {usuario?.permisos?.dashboard && (
              <div
                className={`menu-item-new ${seccionActiva === 'dashboard' ? 'active' : ''}`}
                onClick={() => { setSeccionActiva('dashboard'); if (isMobile) setSidebarAbierto(false); }}
                title="Resumen"
                style={{ position: 'relative' }}
              >
                <i className="fa-solid fa-house-chimney"></i>
                {sidebarAbierto && <span>Resumen</span>}
              </div>
            )}

            {/* Collapsible Groups */}
            {[
              {
                key: 'compras',
                label: 'GESTIÓN DE COMPRAS',
                iconCategory: 'fa-cart-flatbed-suitcases',
                items: [
                  { id: 'compras', icon: 'fa-cart-plus', label: 'Compras' },
                  { id: 'reportesmaestro', icon: 'fa-chart-line', label: 'Reportes Maestro' },
                  { id: 'reporte_operaciones', icon: 'fa-chart-bar', label: 'Reporte Operaciones' },
                  { id: 'reportes', icon: 'fa-file-contract', label: 'Reporte de Compras' },
                  { id: 'proveedores', icon: 'fa-address-book', label: 'Proveedores' },
                  { id: 'analytics_compras', icon: 'fa-gauge-high', label: 'Estadísticas' }
                ]
              },
              {
                key: 'control',
                label: 'CONTROL DE GESTIÓN',
                iconCategory: 'fa-chart-pie',
                items: [
                  { id: 'ejecutivo', icon: 'fa-chess-king', label: 'Resumen Ejecutivo' },
                  { id: 'control_precios', icon: 'fa-funnel-dollar', label: 'Control de Precios' }
                ]
              },
              {
                key: 'gestiones',
                label: 'GESTIÓN OPERATIVA',
                iconCategory: 'fa-folder-open',
                items: [
                  { id: 'requisiciones', icon: 'fa-file-signature', label: 'Requisiciones' },
                  { id: 'fondos', icon: 'fa-hand-holding-dollar', label: 'Solicitud de Fondos' },
                  { id: 'tickets', icon: 'fa-ticket', label: 'Ticket de Pago' },
                  { id: 'liquidacion', icon: 'fa-file-invoice-dollar', label: 'Cuentas por Pagar (Procura)' },
                  { id: 'almacen', icon: 'fa-warehouse', label: 'Almacén' }
                ]
              },
              {
                key: 'configuracion',
                label: 'CONFIGURACIÓN',
                iconCategory: 'fa-gears',
                items: [
                  { id: 'usuarios', icon: 'fa-users', label: 'Usuarios' },
                  { id: 'atributos', icon: 'fa-database', label: 'Atributos' },
                  { id: 'admin_analytics', icon: 'fa-terminal', label: 'Telemetría de Desarrollo' }
                ]
              }
            ].map(group => {
              const tienePermiso = (id) => {
                return !!usuario?.permisos?.[id];
              };

              const itemsPermitidos = group.items.filter(it => tienePermiso(it.id));
              if (itemsPermitidos.length === 0) return null;

              const isOpen = dropdowns[group.key];

              return (
                <div key={group.key} style={{ marginBottom: '6px' }}>
                  {/* Group Header */}
                  {sidebarAbierto ? (
                    <div
                      key={`${group.key}-header-open`}
                      onClick={() => toggleDropdown(group.key)}
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: '900',
                        color: isOpen ? '#38bdf8' : '#475569',
                        margin: '20px 0 10px 0',
                        letterSpacing: '0.5px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'color 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                      title={group.label}
                    >
                      <span>{group.label}</span>
                      <ChevronDown
                        size={10}
                        style={{
                          transition: 'transform 0.2s ease',
                          transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                          color: '#475569'
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      key={`${group.key}-header-closed`}
                      onClick={() => toggleDropdown(group.key)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        margin: '15px 0 5px 0',
                        cursor: 'pointer',
                        color: isOpen ? '#38bdf8' : '#475569'
                      }}
                      title={group.label}
                    >
                      <i className={`fa-solid ${group.iconCategory}`} style={{ fontSize: '1rem' }}></i>
                      <ChevronDown
                        size={8}
                        style={{
                          transition: 'transform 0.2s ease',
                          transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                          color: '#475569'
                        }}
                      />
                    </div>
                  )}

                  {/* Group Items */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key={`${group.key}-content`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        style={{ overflow: 'hidden' }}
                      >
                        {itemsPermitidos.map(item => (
                          <div
                            key={item.id}
                            className={`menu-item-new ${seccionActiva === item.id ? 'active' : ''}`}
                            onClick={() => { if (item.id === 'admin_analytics') { navigate('/admin/analytics'); } else { setSeccionActiva(item.id); } if (isMobile) setSidebarAbierto(false); }}
                            title={item.label}
                            style={{ position: 'relative' }}
                          >
                            <i className={`fa-solid ${item.icon}`}></i>
                            {sidebarAbierto && (
                              <span>{item.label}</span>
                            )}
                            {item.id === 'requisiciones' && notificacionesLog.some(n => n.nuevo) && (
                              <div style={{
                                position: 'absolute',
                                top: '2px',
                                right: sidebarAbierto ? '12px' : '8px',
                                background: '#ef4444',
                                color: 'white',
                                fontSize: '0.6rem',
                                minWidth: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                border: '1px solid #030712'
                              }}>
                                {notificacionesLog.filter(n => n.nuevo).length}
                              </div>
                            )}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <div style={{ marginBottom: '20px' }}></div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div style={{ ...estilos.principal, height: '100%', overflowY: 'auto' }}>
          {renderContenido()}
        </div>
      </div>
      
      {/* Widget de Asistencia Virtual e Interactiva */}
      <AsistenteAyuda />
    </div>
  );
}

export default Dashboard;