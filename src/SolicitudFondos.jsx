import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';
import Requisiciones from './Requisiciones';
import TicketExpress from './TicketExpress';
import { format, getWeek } from 'date-fns';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Loader2, Upload, FileText, Printer, FileSpreadsheet, BarChart3, Clock, Activity, CheckCircle2, DollarSign, Copy, AlertCircle, X, ChevronDown } from 'lucide-react';
import './SolicitudFondos.css';

const getWeeksForMonth = (monthVal, year = 2026) => {
  const weeksMap = new Map();
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);

  let current = new Date(start);
  while (current <= end) {
    const m = current.getMonth(); // 0-indexed
    const w = getWeek(current, { weekStartsOn: 1 });

    if (!weeksMap.has(w)) {
      weeksMap.set(w, {
        weekNum: w,
        minDate: new Date(current),
        maxDate: new Date(current),
        months: new Set()
      });
    }

    const wObj = weeksMap.get(w);
    wObj.months.add(m);
    if (current < wObj.minDate) wObj.minDate = new Date(current);
    if (current > wObj.maxDate) wObj.maxDate = new Date(current);

    current.setDate(current.getDate() + 1);
  }

  const weeksList = Array.from(weeksMap.values()).map(wObj => {
    const dStartStr = format(wObj.minDate, 'dd/MM');
    const dEndStr = format(wObj.maxDate, 'dd/MM');
    return {
      weekNum: wObj.weekNum.toString(),
      label: `Semana ${wObj.weekNum} (${dStartStr} - ${dEndStr})`,
      months: Array.from(wObj.months)
    };
  });

  if (!monthVal || monthVal === '') {
    return weeksList;
  } else {
    const targetMonth = parseInt(monthVal, 10);
    return weeksList.filter(w => w.months.includes(targetMonth));
  }
};

const safeArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
};

const esRequisicionCompletada = (requisicion) => {
  if (!requisicion) return false;
  if (requisicion.status_compra) {
    const st = String(requisicion.status_compra).toUpperCase();
    if (st !== 'COMPLETADO' && st !== 'COMPLETADA') return false;
  }
  const items = safeArray(requisicion.items);
  if (items.length === 0) return false;
  return items.every(item => {
    const cantPedida = parseFloat(item.cantidad_pedida ?? item.cant) || 0;
    const cantComprada = parseFloat(item.cantidad_comprada || 0);
    if (item.anulado) return true;
    return cantComprada >= cantPedida;
  });
};

const checkIsCulminada = (sol, partidas, tickets, pendingBs = 0, pendingUsd = 0) => {
  // Si aún queda saldo pendiente por comprar/pagar, NO puede estar completada
  if (pendingBs > 0.01 || pendingUsd > 0.01) return false;

  const activePartidas = (partidas || []).filter(p => p.status !== 'ANULADO_POR_USUARIO');
  if (activePartidas.length === 0) return false;

  return activePartidas.every(p => {
    // 1. Si es/tiene requisición (por id o por código_ref de requisición)
    if (p.requisicion_id || p.codigo_ref?.startsWith('RR-')) {
      if (p.requisiciones) {
        return esRequisicionCompletada(p.requisiciones);
      }
      return false;
    }

    // 2. Si es ticket de pago
    if (p.ticket_id || p.codigo_ticket?.startsWith('TP-') || p.codigo_ref?.startsWith('TP-')) {
      const tk = (tickets || []).find(t =>
        t.id === p.ticket_id ||
        t.codigo_control === p.codigo_ticket ||
        t.codigo_control === p.codigo_ref
      );
      if (tk) {
        const statusUpper = (tk.status || '').toUpperCase();
        if (statusUpper === 'PAGADO' || statusUpper === 'COMPLETADO' || statusUpper === 'ANULADO' || statusUpper === 'RECHAZADO') {
          return true;
        }
        const tkItems = safeArray(tk.items);
        if (tkItems.length > 0) {
          const it = tkItems.find(item =>
            (item.desc || item.descripcion || '').trim().toUpperCase() === (p.descripcion || '').trim().toUpperCase() &&
            (Number(item.cantidad_pedida || item.cant) === Number(p.cantidad))
          );
          if (it && Number(it.cantidad_pendiente) === 0) return true;
        }
      }
      return false;
    }

    // 3. Si no tiene referencia (pago manual/transferencia directa)
    return p.pago_realizado === true;
  });
};

const getEstadoSolicitud = (solicitud) => {
  if (!solicitud) return 'ACTIVA';

  // Si la solicitud tiene saldo pendiente (pending_bs > 0 o pending_usd > 0)
  // o si no es culminada (is_culminada es false), NUNCA puede ser 'COMPLETADA'
  const hasPending = (parseFloat(solicitud.pending_bs) > 0.01 || parseFloat(solicitud.pending_usd) > 0.01);
  if (solicitud.estado === 'COMPLETADA' && !hasPending && solicitud.is_culminada !== false) {
    return 'COMPLETADA';
  }

  const fechaStr = solicitud.fecha_operativa || solicitud.fecha;
  if (!fechaStr) return 'ACTIVA';

  const fechaOp = new Date(fechaStr + 'T12:00:00');
  const day = fechaOp.getDay();
  const daysToSunday = day === 0 ? 0 : 7 - day;

  const domingoSemana = new Date(fechaOp);
  domingoSemana.setDate(fechaOp.getDate() + daysToSunday);
  domingoSemana.setHours(23, 59, 59, 999);

  const now = new Date();
  if (now > domingoSemana) {
    return 'EN PROCESO';
  }
  return 'ACTIVA';
};

const TextInputLocal = ({ value, onChange, onBlur, ...props }) => {
  const [localVal, setLocalVal] = useState(value || '');

  useEffect(() => {
    setLocalVal(value || '');
  }, [value]);

  return (
    <input
      {...props}
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={(e) => {
        if (localVal !== value) {
          onChange(localVal);
        }
        if (onBlur) onBlur(e);
      }}
    />
  );
};

const TextareaLocal = ({ value, onChange, onBlur, ...props }) => {
  const [localVal, setLocalVal] = useState(value || '');

  useEffect(() => {
    setLocalVal(value || '');
  }, [value]);

  return (
    <textarea
      {...props}
      value={localVal}
      onChange={(e) => {
        setLocalVal(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
      }}
      onBlur={(e) => {
        if (localVal !== value) {
          onChange(localVal);
        }
        if (onBlur) onBlur(e);
      }}
    />
  );
};

const StockSmartTotalClean = ({ currentUserProp }) => {
  const [showModal, setShowModal] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // --- ESTADOS PARA CONTROLAR EL MODAL DE REQUISICIONES ---
  const [abrirReq, setAbrirReq] = useState(false);
  const [dataParaReq, setDataParaReq] = useState(null);

  // --- ESTADOS PARA CONTROLAR EL MODAL DE TICKETS ---
  const [abrirTicketModal, setAbrirTicketModal] = useState(false);
  const [dataParaTicket, setDataParaTicket] = useState(null);

  // --- ESTADO PARA GASTOS IMPREVISTOS ---
  const [mostrarImprevistos, setMostrarImprevistos] = useState(false);
  const [mostrarDesglose, setMostrarDesglose] = useState(false);

  // --- ESTADOS PARA FILTROS DENTRO DEL MODAL ---
  const [filtroPartidaEmisor, setFiltroPartidaEmisor] = useState('Todos');
  const [filtroPartidaCategoria, setFiltroPartidaCategoria] = useState('Todos');
  const [filtroPartidaClasificacion, setFiltroPartidaClasificacion] = useState('Todos');
  const [filtroPartidaEstadoId, setFiltroPartidaEstadoId] = useState('Todos');
  const [mostrarFiltrosTabla, setMostrarFiltrosTabla] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    if (!currentUserProp) return null;
    const emailLower = (currentUserProp.correo || currentUserProp.email || '').toLowerCase();
    const esSuperAdmin = emailLower === 'jcontreras.totalclean@gmail.com';
    const esAdminReal = esSuperAdmin ||
      emailLower === 'cvega.totalclean@gmail.com' ||
      emailLower === 'cvega@totalclean.com' ||
      emailLower === 'karincmm1@gmail.com';
    return {
      ...currentUserProp,
      esSuperAdmin,
      esAdminReal
    };
  });
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // --- ESTADOS PARA VALIDACIÓN PREVIA Y CIERRE SEMANAL ---
  const [showPreVal, setShowPreVal] = useState(false);
  const [ccPreVal, setCcPreVal] = useState('');
  const [fechaPreVal, setFechaPreVal] = useState(new Date().toISOString().split('T')[0]);
  const [loadingCheck, setLoadingCheck] = useState(false);
  const [errorCheck, setErrorCheck] = useState('');
  const [solCheckExitosa, setSolCheckExitosa] = useState(false);
  const [solicitudConflictiva, setSolicitudConflictiva] = useState(null);
  const [esAdminBypass, setEsAdminBypass] = useState(false);

  useEffect(() => {
    if (currentUserProp) {
      const emailLower = (currentUserProp.correo || currentUserProp.email || '').toLowerCase();
      const esSuperAdmin = emailLower === 'jcontreras.totalclean@gmail.com';
      const esAdminReal = esSuperAdmin ||
        emailLower === 'cvega.totalclean@gmail.com' ||
        emailLower === 'cvega@totalclean.com' ||
        emailLower === 'karincmm1@gmail.com';
      setCurrentUser({
        ...currentUserProp,
        esSuperAdmin,
        esAdminReal
      });
    }
  }, [currentUserProp]);

  const esRrHhOAdm = useMemo(() => {
    const depto = (currentUser?.departamento || '').toLowerCase();
    return depto === 'recursos humanos' || depto.includes('administración') || depto.includes('administracion');
  }, [currentUser]);

  // --- ESTADOS DE DATA MAESTRA ---
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [todasClasificaciones, setTodasClasificaciones] = useState([]);
  const [todasCategorias, setTodasCategorias] = useState([]);
  const [gerentesDisponibles, setGerentesDisponibles] = useState([]);
  const [gerenciasBaseDatos, setGerenciasBaseDatos] = useState([]);

  // --- DATOS MAESTROS ESTÁTICOS ---
  const gerenciasData = {
    "Operaciones": ["Hilda Colina"],
    "Mantenimiento": ["José Cohén"],
    "Seguridad": ["Xiomara Acevedo"],
    "Recursos Humanos": ["Ider Marín"],
    "Estimación": ["Karin Machado"],
    "Estimacion": ["Karin Machado"],
    "Estimación y Control": ["Karin Machado"],
    "Estimacion y Control": ["Karin Machado"],
    "Estimación y Control Interno": ["Karin Machado"],
    "Estimacion y Control Interno": ["Karin Machado"],
    "Estimaciones": ["Karin Machado"],
    "Estimaciónes": ["Karin Machado"],
    "Estimaciones y Control": ["Karin Machado"],
    "Estimaciónes y Control": ["Karin Machado"],
    "Estimaciones y Control Interno": ["Karin Machado"],
    "Estimaciónes y Control Interno": ["Karin Machado"],
    "Almacén": ["Diana García"],
    "Servicios Generales": ["Luis Fallica"],
    "Administración Maracaibo": ["Perla Delgado"],
    "Administración El Tigre": ["Zuleika Lara"],
    "Dirección Corporativa": ["Carlos Vega"],
    "Gerencia General": ["Carlos Vega"],
    "Contabilidad": ["Jorge Urdaneta"]
  };

  const unidades = ["UNID", "KG", "LTS", "ML", "M2", "M3", "SERV", "SG", "VIAJES", "Gal", "Sacos", "Rollo", "Pipa", "Jgo"];

  // --- LÓGICA DE SIGLAS GERENCIA ---
  const obtenerSiglas = (nombreGerencia) => {
    if (!nombreGerencia) return '---';
    const norm = nombreGerencia.trim().toLowerCase();
    if (norm.startsWith('estimac') || norm.startsWith('estimación')) {
      return 'EST';
    }
    const matchDB = gerenciasBaseDatos.find(g => (g.nombre || '').trim().toLowerCase() === norm);
    if (matchDB && matchDB.abreviatura) return matchDB.abreviatura;

    const mappingGerencias = {
      "Administración Maracaibo": "ADM-MCB",
      "Administración El Tigre": "ADM-TG",
      "Operaciones": "OPE",
      "Mantenimiento": "MTT",
      "Seguridad": "SHA",
      "SIAHO": "SHA",
      "Recursos Humanos": "RRH",
      "Estimación": "EST",
      "Estimacion": "EST",
      "Estimación y Control": "EST",
      "Estimacion y Control": "EST",
      "Estimación y Control Interno": "EST",
      "Estimacion y Control Interno": "EST",
      "Estimaciones": "EST",
      "Estimaciónes": "EST",
      "Estimaciones y Control": "EST",
      "Estimaciónes y Control": "EST",
      "Estimaciones y Control Interno": "EST",
      "Estimaciónes y Control Interno": "EST",
      "Almacén": "ALM",
      "Dirección Corporativa": "DC",
      "Gerencia General": "GG",
      "Servicios Generales": "SVG",
      "Contabilidad": "CNT",
      "Compras": "CMP"
    };
    return mappingGerencias[nombreGerencia] || "---";
  };

  // --- ESTADO INICIAL DEL FORMULARIO ---
  const [form, setForm] = useState({
    id: '',
    fecha: new Date().toISOString().split('T')[0],
    sede: 'MARACAIBO',
    gerencia: '',
    responsable: '',
    partidas: [{ id: Date.now(), selected: false, cc: '', clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', puBs: '', puUsd: '', pago_realizado: false, emisor: '' }],
    imprevistos: [{ id: Date.now() + 1, selected: false, cc: '', clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', puBs: '', puUsd: '', pago_realizado: false, emisor: '' }]
  });


  const formatName = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 1) return fullName;
    const firstName = parts[0];
    const firstLastName = parts[1];
    return `${firstName} ${firstLastName}`;
  };

  // --- ESTADO PARA FILTROS ---
  const [busqueda, setBusqueda] = useState("");
  const [filtroGerencia, setFiltroGerencia] = useState("Todos");
  const [filtroMes, setFiltroMes] = useState("");
  const [filtroSemana, setFiltroSemana] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todos");

  const handleMonthChange = (newMonth) => {
    setFiltroMes(newMonth);
    if (filtroSemana !== "") {
      const validWeeks = getWeeksForMonth(newMonth, 2026);
      const isValid = validWeeks.some(w => {
        const semValue = w.weekNum.padStart(2, '0');
        return semValue === filtroSemana;
      });
      if (!isValid) {
        setFiltroSemana("");
      }
    }
  };
  const [quickFilter, setQuickFilter] = useState("Activas");
  const [hasChanges, setHasChanges] = useState(false);
  const [itemParaAnular, setItemParaAnular] = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const [justificacionAnulacion, setJustificacionAnulacion] = useState("");
  const [isAnulando, setIsAnulando] = useState(false);

  const estadoActual = getEstadoSolicitud(isEditing ? form : { fecha_operativa: form.fecha || fechaPreVal });

  // --- ESTADOS Y REFS PARA CO-PRESENCIA MULTIUSUARIO (Supabase Presence) ---
  const [activeUsers, setActiveUsers] = useState([]);
  const [selectedRowsByOthers, setSelectedRowsByOthers] = useState({});
  const presenceChannelRef = useRef(null);
  const blurTimeoutRef = useRef(null);

  // --- FUNCIÓN PARA ELIMINAR ---
  const eliminarSolicitud = (id_db) => {
    const esAutorizado = currentUser?.correo?.toLowerCase() === 'jcontreras.totalclean@gmail.com';

    if (!esAutorizado) {
      toast.error("Solo el Administrador jcontreras.totalclean@gmail.com tiene permisos para eliminar solicitudes.");
      return;
    }

    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '500' }}>¿Estás seguro de que deseas eliminar esta solicitud permanentemente? Se borrarán también todos los renglones asociados.</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => { toast.dismiss(t.id); ejecutarEliminarSolicitud(id_db); }}
            style={{ padding: '4px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            SÍ, ELIMINAR
          </button>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>CANCELAR</button>
        </div>
      </div>
    ), { duration: 6000, position: 'top-center' });
  };

  const ejecutarEliminarSolicitud = async (id_db) => {
    const esAutorizado = currentUser?.correo?.toLowerCase() === 'jcontreras.totalclean@gmail.com';
    if (!esAutorizado) {
      toast.error("Solo el Administrador jcontreras.totalclean@gmail.com tiene permisos para eliminar solicitudes.");
      return;
    }
    try {
      setLoading(true);
      const { error: errorPartidas } = await supabase.from('partidas_fondos').delete().eq('solicitud_id', id_db);
      if (errorPartidas) throw new Error("Error al eliminar partidas");

      const { error: errorCabecera } = await supabase.from('solicitudes_fondos').delete().eq('id', id_db);
      if (errorCabecera) throw new Error("Error al eliminar cabecera");

      toast.success("Solicitud eliminada.");
      setHistorial(prev => prev.filter(h => h.id_db !== id_db));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const duplicarPartida = (index) => {
    const original = form.partidas[index];
    const nueva = {
      ...original,
      id: Date.now() + Math.random(),
      selected: false,
      desc: '',
      puBs: '',
      puUsd: '',
      requisicion_id: null,
      codigo_req: null,
      status: 'Disponible'
    };
    const nuevasPartidas = [...form.partidas];
    nuevasPartidas.splice(index + 1, 0, nueva);
    setHasChanges(true);
    setForm({ ...form, partidas: nuevasPartidas });
  };

  const duplicarImprevisto = (index) => {
    const original = form.imprevistos[index];
    const nueva = {
      ...original,
      id: Date.now() + Math.random(),
      selected: false,
      desc: '',
      puBs: '',
      puUsd: '',
      requisicion_id: null,
      codigo_req: null,
      status: 'Disponible'
    };
    const nuevosImprevistos = [...form.imprevistos];
    nuevosImprevistos.splice(index + 1, 0, nueva);
    setHasChanges(true);
    setForm({ ...form, imprevistos: nuevosImprevistos });
  };

  const intentarCerrarModal = () => {
    if (hasChanges) {
      toast((t) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b' }}>⚠️ Tienes datos sin guardar</p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>¿Estás seguro de que deseas cerrar? Se perderán los renglones añadidos.</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '5px' }}>
            <button
              onClick={() => { toast.dismiss(t.id); setShowModal(false); }}
              style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
            >CERRAR SIN GUARDAR</button>
            <button
              onClick={() => toast.dismiss(t.id)}
              style={{ padding: '6px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}
            >CONTINUAR</button>
          </div>
        </div>
      ), { duration: 6000, position: 'top-center' });
    } else {
      setShowModal(false);
    }
  };

  // --- LÓGICA DE FILTRADO ---
  const mappingGerenciasDropdown = {
    "ADM-MCB": "Administración Maracaibo",
    "ADM-TG": "Administración El Tigre",
    "OPE": "Operaciones",
    "MTT": "Mantenimiento",
    "SHA": "Seguridad",
    "RRH": "Recursos Humanos",
    "EST": "Estimación",
    "ALM": "Almacén",
    "DC": "Dirección Corporativa",
    "GG": "Gerencia General",
    "SVG": "Servicios Generales",
    "CNT": "Contabilidad",
    "CMP": "Compras"
  };

  // --- BASE HISTORIAL PARA CONTEO DE PILLS ---
  const baseHistorial = useMemo(() => {
    return historial.filter(h => {
      const matchTexto =
        h.id.toLowerCase().includes(busqueda.toLowerCase()) ||
        h.responsable.toLowerCase().includes(busqueda.toLowerCase());
      const matchGerencia = filtroGerencia === "Todos" || h.id.startsWith(filtroGerencia);
      const matchMes = !filtroMes || (() => {
        if (!h.fecha_operativa) return false;
        const dateObj = new Date(h.fecha_operativa + 'T12:00:00');
        return dateObj.getMonth().toString() === filtroMes;
      })();
      return matchTexto && matchGerencia && matchMes;
    });
  }, [historial, busqueda, filtroGerencia, filtroMes]);

  const counts = useMemo(() => {
    let todos = 0;
    let activas = 0;
    let enProceso = 0;
    let completadas = 0;

    baseHistorial.forEach(h => {
      todos++;
      const est = getEstadoSolicitud(h);
      if (est === 'ACTIVA') {
        activas++;
      } else if (est === 'EN PROCESO') {
        enProceso++;
      } else if (est === 'COMPLETADA') {
        completadas++;
      }
    });

    return { todos, activas, enProceso, completadas };
  }, [baseHistorial]);

  const historialFiltrado = historial.filter(h => {
    const matchTexto =
      h.id.toLowerCase().includes(busqueda.toLowerCase()) ||
      h.responsable.toLowerCase().includes(busqueda.toLowerCase());

    const matchGerencia = filtroGerencia === "Todos" || h.id.startsWith(filtroGerencia);

    const matchMes = !filtroMes || (() => {
      if (!h.fecha_operativa) return false;
      const dateObj = new Date(h.fecha_operativa + 'T12:00:00');
      return dateObj.getMonth().toString() === filtroMes;
    })();

    // Filtro por semana (usar el número de semana calculado de la fecha o del ID)
    const matchSemana = !filtroSemana ||
      h.id.includes(`SEM ${filtroSemana}`) ||
      h.id.includes(`SEMANA ${filtroSemana}`) ||
      getWeek(new Date(h.fecha_operativa + 'T12:00:00'), { weekStartsOn: 1 }) === parseInt(filtroSemana);

    const isCulminada = h.is_culminada;
    const isPendiente = !isCulminada;

    const matchStatus = filtroStatus === "Todos" ||
      (filtroStatus === "Pendientes" && isPendiente) ||
      (filtroStatus === "Culminadas" && isCulminada);

    if (!matchTexto || !matchGerencia || !matchMes || !matchSemana || !matchStatus) return false;

    const est = h.estado || h.estado_dinamico || getEstadoSolicitud(h);
    if (quickFilter === "Activas") {
      return est === 'ACTIVA' && !h.is_culminada;
    } else if (quickFilter === "EnProceso") {
      return est === 'EN PROCESO' && !h.is_culminada;
    } else if (quickFilter === "Completadas") {
      return est === 'COMPLETADA' || Boolean(h.is_culminada);
    }

    return true; // "Todos"
  });

  const obtenerSesionUsuario = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const email = session.user.email.toLowerCase();

      // FORZAR lectura de perfil fresco (Sin caché)
      const { data: perfil, error: pError } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (pError) {
        console.log("[VISIBILIDAD FONDOS] Error leyendo perfil:", pError.message);
        return;
      }

      if (perfil) {
        const emailLower = (session.user.email || '').toLowerCase();
        // José es el ÚNICO que puede borrar
        const esSuperAdmin = emailLower === 'jcontreras.totalclean@gmail.com';
        // Administradores reales (José, Carlos, Karin)
        const esAdminReal = esSuperAdmin ||
          emailLower === 'cvega.totalclean@gmail.com' ||
          emailLower === 'cvega@totalclean.com' ||
          emailLower === 'karincmm1@gmail.com';

        const esPerlaDelgado = (perfil.nombre || '').trim().toLowerCase() === 'perla' && (perfil.apellido || '').trim().toLowerCase() === 'delgado';

        const userData = {
          ...perfil,
          esSuperAdmin,
          esAdminReal,
          esPerlaDelgado,
          correo: emailLower,
          departamento: (perfil.departamento || '').trim(),
          rol: (perfil.rol || '').trim()
        };
        setCurrentUser(userData);
        console.log("[VISIBILIDAD FONDOS] Sesión sincronizada para:", emailLower);
      }
    } catch (err) {
      console.error("[VISIBILIDAD FONDOS] Error fatal:", err.message);
    }
  };

  // --- LOGICA DE DASHBOARD PREMIUM ---
  const kpis = useMemo(() => {
    const list = historial || [];
    const totalInversion = list.reduce((acc, h) => acc + (h.total || 0), 0);

    // Calcular semana actual
    const d = new Date();
    const semAhora = getWeek(d, { weekStartsOn: 1 });

    const solicitudesSemana = list.filter(h => {
      if (!h.fecha_operativa) return false;
      return getWeek(new Date(h.fecha_operativa + 'T12:00:00'), { weekStartsOn: 1 }) === semAhora;
    }).length;

    const totalRegistros = list.length;
    const promedio = totalRegistros > 0 ? totalInversion / totalRegistros : 0;

    return { totalInversion, solicitudesSemana, totalRegistros, promedio };
  }, [historial]);

  const cargarTodo = useCallback(async () => {
    setLoading(true);

    // Asegurar que tenemos al usuario antes de filtrar (con datos frescos)
    let userContext = currentUser;
    if (!userContext) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: perfil } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single();
        if (perfil) {
          const emailLower = (session.user.email || '').toLowerCase();
          const esSuperAdmin = emailLower === 'jcontreras.totalclean@gmail.com';
          const esAdminReal = esSuperAdmin ||
            emailLower === 'cvega.totalclean@gmail.com' ||
            emailLower === 'cvega@totalclean.com' ||
            emailLower === 'karincmm1@gmail.com';

          const esPerlaDelgado = (perfil.nombre || '').trim().toLowerCase() === 'perla' && (perfil.apellido || '').trim().toLowerCase() === 'delgado';

          userContext = {
            ...perfil,
            esSuperAdmin,
            esAdminReal,
            esPerlaDelgado,
            correo: emailLower,
            departamento: (perfil.departamento || '').trim(),
            rol: (perfil.rol || '').trim()
          };
          setCurrentUser(userContext);
        }
      }
    }

    if (!userContext) {
      setLoading(false);
      return;
    }

    // Cargar lista de responsables (Gerentes, Coordinadores, Analistas)
    const { data: dataGerentes } = await supabase
      .from('perfiles')
      .select('nombre, apellido, departamento')
      .in('rol', ['Gerente', 'Coordinador', 'Analista'])
      .order('nombre');
    if (dataGerentes) setGerentesDisponibles(dataGerentes);

    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - 120);
    const fechaLimiteStr = fechaLimite.toISOString();

    let query = supabase.from('solicitudes_fondos').select('*').gte('created_at', fechaLimiteStr);

    const rolUpper = (userContext.rol || '').toUpperCase();
    const deptoUpper = (userContext.departamento || '').toUpperCase();
    const tienePermisoDepto = userContext.capacidades?.ver_departamento === true;

    console.log(`[VISIBILIDAD FONDOS] Usuario: ${userContext.correo} | Depto: ${userContext.departamento} | Rol: ${rolUpper} | Permiso Especial: ${tienePermisoDepto}`);

    // REGLAS DE JERARQUÍA
    if (!userContext.esAdminReal && rolUpper !== 'GERENTE GENERAL' && rolUpper !== 'ADMIN' && !userContext.esPerlaDelgado && !userContext.capacidades?.ver_solicitudes_global) {
      const puedeVerDepto = tienePermisoDepto || ['GERENTE', 'COORDINADOR', 'ANALISTA', 'COMPRAS'].includes(rolUpper) || deptoUpper.includes('COMPRAS');
      const misObras = userContext.obras_asignadas || [];
      const esRestringidoObra = rolUpper.includes('PROYECTO') || (rolUpper.includes('ANALISTA') && misObras.length > 0);

      if (esRestringidoObra) {
        // Lógica de visibilidad por OBRA (Proyecto/Analista asignado)
        // Necesitamos primero las solicitudes que tengan al menos una partida de sus obras
        const { data: partidasMias } = await supabase
          .from('partidas_fondos')
          .select('solicitud_id')
          .in('centro_costo', misObras)
          .limit(5000);

        const idsSolicitudes = [...new Set((partidasMias || []).map(p => p.solicitud_id).filter(id => id))];

        if (idsSolicitudes.length > 0) {
          query = query.in('id', idsSolicitudes);
        } else {
          // Si no hay partidas de sus obras, solo puede ver lo que él mismo creó (si aplica)
          query = query.eq('responsable_nombre', `${userContext.nombre} ${userContext.apellido}`);
        }
        console.log(`[VISIBILIDAD FONDOS] Aplicando restricción por Obras Asignadas: ${misObras.join(', ')}`);
      } else if (puedeVerDepto) {
        // Ven todo lo de su departamento/gerencia (Fuzzy Match + Case-insensitive)
        const filtroDepto = (userContext.departamento || '').trim();

        // Lógica de SINÓNIMOS para Seguridad
        if (filtroDepto.toUpperCase() === 'SEGURIDAD' || filtroDepto.toUpperCase() === 'SIAHO') {
          query = query.or(`gerencia_nombre.ilike.%Seguridad%,gerencia_nombre.ilike.%SIAHO%,gerencia_nombre.ilike.%SHA%`);
          console.log(`[VISIBILIDAD FONDOS] Aplicando filtro de búsqueda múltiple (SIAHO/SHA/Seguridad)`);
        } else {
          query = query.ilike('gerencia_nombre', `%${filtroDepto}%`);
          console.log(`[VISIBILIDAD FONDOS] Aplicando filtro de departamento: %${filtroDepto}%`);
        }
      } else {
        // Otros roles sin permiso explícito: solo lo propio
        query = query.eq('responsable_nombre', `${userContext.nombre} ${userContext.apellido}`);
        console.log(`[VISIBILIDAD FONDOS] Aplicando filtro restrictivo personal: ${userContext.nombre}`);
      }
    }

    const { data: dataHist } = await query.order('created_at', { ascending: false });

    if (dataHist) {
      const reqIds = dataHist.map(h => h.id).filter(Boolean);

      // --- FIX CRÍTICO: Fetch por BATCHES con límite explícito ---
      // PostgREST tiene un límite por defecto de ~1000 filas. Con muchas solicitudes
      // y partidas, la consulta se trunca silenciosamente, dejando solicitudes nuevas
      // sin partidas asociadas → mostrando $0.00 en la tabla principal.
      // Solución: dividir reqIds en lotes y usar .limit() explícito por lote.
      const BATCH_SIZE = 30; // Máximo IDs por consulta (evita URLs demasiado largas)
      let pagosData = [];
      let pagosError = null;
      for (let i = 0; i < reqIds.length; i += BATCH_SIZE) {
        const batch = reqIds.slice(i, i + BATCH_SIZE);
        const { data: batchData, error: batchError } = await supabase
          .from('partidas_fondos')
          .select('solicitud_id, pu_bs, pu_usd, cantidad, pago_realizado, status, requisicion_id, ticket_id, codigo_ticket, descripcion, requisiciones(id, items, status_compra, estado_aprobacion)')
          .in('solicitud_id', batch)
          .limit(5000);
        if (batchError) {
          console.error("[ERRORES FONDOS] Error cargando partidas_fondos (batch):", batchError.message);
          pagosError = batchError;
        }
        if (batchData) pagosData = pagosData.concat(batchData);
      }
      if (pagosError) {
        console.error("[ERRORES FONDOS] Error cargando partidas_fondos:", pagosError.message);
      }

      // Obtener Tickets directos involucrados en estas solicitudes
      const ticketIds = (pagosData || []).map(p => p.ticket_id).filter(Boolean);
      const ticketCodigos = (pagosData || []).map(p => p.codigo_ticket).filter(c => c && c.startsWith('TP-'));
      let ticketsInvolucrados = [];
      if (ticketIds.length > 0 || ticketCodigos.length > 0) {
        try {
          let query = supabase.from('tickets_directos').select('*');
          if (ticketIds.length > 0 && ticketCodigos.length > 0) {
            query = query.or(`id.in.(${ticketIds.join(',')}),codigo_control.in.(${ticketCodigos.map(c => `"${c}"`).join(',')})`);
          } else if (ticketIds.length > 0) {
            query = query.in('id', ticketIds);
          } else {
            query = query.in('codigo_control', ticketCodigos);
          }
          const { data: tData } = await query.limit(5000);
          if (tData) ticketsInvolucrados = tData;
        } catch (e) {
          console.error("Error fetching tickets in fetchHistorial:", e);
        }
      }

      setHistorial(dataHist.map(h => {
        const misPartidas = (pagosData || []).filter(p => {
          if (!p.solicitud_id) return false;
          const pSolId = String(p.solicitud_id).toLowerCase().trim();
          const hId = h.id ? String(h.id).toLowerCase().trim() : '';
          const hCode = h.codigo_control ? String(h.codigo_control).toLowerCase().trim() : '';
          return pSolId === hId || pSolId === hCode;
        });

        let calculatedTotalBs = parseFloat(h.total_bs || 0);
        let calculatedTotalUsd = parseFloat(h.total_usd || 0);

        const emailLower = (userContext?.correo || '').toLowerCase();
        const esTostitomas = emailLower.includes('tostitomas') || (userContext?.nombre || '').toLowerCase().includes('tostitomas');

        if (misPartidas.length > 0 && !esTostitomas) {
          const sumPartidasBs = misPartidas.reduce((acc, p) => acc + (p.status === 'ANULADO_POR_USUARIO' ? 0 : (parseFloat(p.pu_bs) || 0) * (p.cantidad || 1)), 0);
          const sumPartidasUsd = misPartidas.reduce((acc, p) => acc + (p.status === 'ANULADO_POR_USUARIO' ? 0 : (parseFloat(p.pu_usd) || 0) * (p.cantidad || 1)), 0);
          
          if (sumPartidasBs > 0 || sumPartidasUsd > 0) {
            calculatedTotalBs = sumPartidasBs;
            calculatedTotalUsd = sumPartidasUsd;
          }
        }

        let totalPagado = 0;
        let pendingBs = 0;
        let pendingUsd = 0;

        if (misPartidas.length > 0 && !esTostitomas) {
          let totalMontoReal = 0;
          let totalPendingBs = 0;
          let totalPendingUsd = 0;

          misPartidas.forEach(p => {
            if (p.status === 'ANULADO_POR_USUARIO') return;

            let mReal = 0;
            let mPendingBs = (parseFloat(p.pu_bs) || 0) * (p.cantidad || 1);
            let mPendingUsd = (parseFloat(p.pu_usd) || 0) * (p.cantidad || 1);

            const isReqComp = p.requisiciones ? esRequisicionCompletada(p.requisiciones) : false;

            if (p.pago_realizado) {
              mReal = (parseFloat(p.pu_bs) || parseFloat(p.pu_usd) || 0) * (p.cantidad || 1);
              mPendingBs = 0;
              mPendingUsd = 0;
            } else if (p.requisicion_id && p.requisiciones && p.requisiciones.items) {
              const normPDesc = (p.descripcion || '').trim().toLowerCase();
              const pCant = Number(p.cantidad) || 1;
              const itemsArr = safeArray(p.requisiciones.items);

              let itemReq = itemsArr.find(item => {
                const normItemDesc = (item.descripcion || item.desc || '').trim().toLowerCase();
                const descMatch = normItemDesc === normPDesc || (normItemDesc && normPDesc && (normItemDesc.includes(normPDesc) || normPDesc.includes(normItemDesc)));
                const cantMatch = Number(item.cantidad_pedida ?? item.cant ?? item.cantidad) === pCant;
                return descMatch && cantMatch;
              }) || itemsArr.find(item => {
                const normItemDesc = (item.descripcion || item.desc || '').trim().toLowerCase();
                return normItemDesc === normPDesc || (normItemDesc && normPDesc && (normItemDesc.includes(normPDesc) || normPDesc.includes(normItemDesc)));
              });

              if (itemReq) {
                mReal = (itemReq.historial_compras || []).reduce((sum, tx) => {
                  if (tx.tipo === 'JUSTIFICACION') return sum;
                  return sum + ((parseFloat(tx.cant) || 0) * (parseFloat(tx.pu) || 0));
                }, 0);
                const cantPendiente = parseFloat(itemReq.cantidad_pendiente ?? itemReq.cant) || 0;
                const puEst = parseFloat(itemReq.pu_estimado ?? itemReq.pu) || 0;
                
                if (mReal === 0 && isReqComp) {
                  mReal = (parseFloat(p.pu_bs) || parseFloat(p.pu_usd) || 0) * (p.cantidad || 1);
                  mPendingBs = 0;
                  mPendingUsd = 0;
                } else if (p.pu_bs > 0) {
                  mPendingBs = cantPendiente * puEst;
                  mPendingUsd = 0;
                } else {
                  mPendingBs = 0;
                  mPendingUsd = cantPendiente * puEst;
                }
              } else if (isReqComp) {
                mReal = (parseFloat(p.pu_bs) || parseFloat(p.pu_usd) || 0) * (p.cantidad || 1);
                mPendingBs = 0;
                mPendingUsd = 0;
              }
            } else if (p.ticket_id || p.codigo_ticket?.startsWith('TP-')) {
              const ticketAsociado = ticketsInvolucrados.find(t =>
                t.id === p.ticket_id ||
                (p.codigo_ticket && t.codigo_control === p.codigo_ticket)
              );
              if (ticketAsociado) {
                if (ticketAsociado.items && ticketAsociado.items.length > 0) {
                  const normPDesc = (p.descripcion || '').trim().toLowerCase();
                  const itemTicket = ticketAsociado.items.find(it =>
                    (it.desc || it.descripcion || '').trim().toLowerCase() === normPDesc &&
                    (Number(it.cantidad_pedida || it.cant) === Number(p.cantidad))
                  ) || ticketAsociado.items.find(it => (it.desc || it.descripcion || '').trim().toLowerCase() === normPDesc);
                  
                  if (itemTicket) {
                    mReal = (itemTicket.historial_compras || []).reduce((sum, tx) => {
                      return sum + ((parseFloat(tx.cant) || 0) * (parseFloat(tx.pu) || 0));
                    }, 0);
                    const cantPendiente = parseFloat(itemTicket.cantidad_pendiente ?? itemTicket.cant) || 0;
                    const puEst = parseFloat(itemTicket.pu_estimado ?? itemTicket.pu) || 0;
                    
                    if (mReal === 0 && (ticketAsociado.status === 'Pagado' || ticketAsociado.status === 'COMPLETADO')) {
                      mReal = (parseFloat(p.pu_bs) || parseFloat(p.pu_usd) || 0) * (p.cantidad || 1);
                      mPendingBs = 0;
                      mPendingUsd = 0;
                    } else if (p.pu_bs > 0) {
                      mPendingBs = cantPendiente * puEst;
                      mPendingUsd = 0;
                    } else {
                      mPendingBs = 0;
                      mPendingUsd = cantPendiente * puEst;
                    }
                  } else {
                    if (ticketAsociado.status === 'Pagado' || ticketAsociado.status === 'COMPLETADO') {
                      mReal = (parseFloat(p.pu_bs) || parseFloat(p.pu_usd) || 0) * (p.cantidad || 1);
                      mPendingBs = 0;
                      mPendingUsd = 0;
                    }
                  }
                } else if (ticketAsociado.status === 'Pagado' || ticketAsociado.status === 'COMPLETADO') {
                  mReal = (parseFloat(p.pu_bs) || parseFloat(p.pu_usd) || 0) * (p.cantidad || 1);
                  mPendingBs = 0;
                  mPendingUsd = 0;
                }
              }
            }

            totalMontoReal += mReal;
            totalPendingBs += mPendingBs;
            totalPendingUsd += mPendingUsd;
          });

          totalPagado = totalMontoReal;
          pendingBs = totalPendingBs;
          pendingUsd = totalPendingUsd;

          const reqsAllComp = misPartidas.length > 0 && misPartidas.every(p => p.pago_realizado || (p.requisiciones && esRequisicionCompletada(p.requisiciones)));
          if ((h.pago_realizado || h.estado === 'COMPLETADA' || h.status === 'COMPLETADA' || reqsAllComp) && totalPagado < (calculatedTotalBs + calculatedTotalUsd)) {
            totalPagado = calculatedTotalBs + calculatedTotalUsd;
            pendingBs = 0;
            pendingUsd = 0;
          }
        } else {
          totalPagado = (h.pago_realizado || h.estado === 'COMPLETADA' || h.status === 'COMPLETADA') ? (calculatedTotalBs + calculatedTotalUsd) : 0;
          pendingBs = (h.pago_realizado || h.estado === 'COMPLETADA' || h.status === 'COMPLETADA') ? 0 : calculatedTotalBs;
          pendingUsd = (h.pago_realizado || h.estado === 'COMPLETADA' || h.status === 'COMPLETADA') ? 0 : calculatedTotalUsd;
        }

        const total = calculatedTotalBs + calculatedTotalUsd;

        const tieneRequisiciones = misPartidas.some(p => p.requisicion_id);
        const requisicionesCompletadas = tieneRequisiciones && misPartidas
          .filter(p => p.requisicion_id)
          .every(p => p.requisiciones ? esRequisicionCompletada(p.requisiciones) : false);

        const isCulminadaValue = checkIsCulminada(h, misPartidas, ticketsInvolucrados, pendingBs, pendingUsd);
        const dynamicEstado = isCulminadaValue ? 'COMPLETADA' : getEstadoSolicitud(h);

        return {
          ...h,
          id_db: h.id,
          id: h.codigo_control,
          total_bs: calculatedTotalBs,
          total_usd: calculatedTotalUsd,
          total,
          total_pagado: totalPagado,
          responsable: h.responsable_nombre,
          gerencia: h.gerencia_nombre,
          pending_bs: pendingBs,
          pending_usd: pendingUsd,
          tiene_requisiciones: tieneRequisiciones,
          requisiciones_completadas: requisicionesCompletadas,
          estado: dynamicEstado,
          is_culminada: isCulminadaValue
        };
      }));
    }

    const { data: dataCC } = await supabase.from('maestros_centros_costo').select('id, nombre').eq('activo', true).order('nombre');
    if (dataCC) setCentrosCosto(dataCC);

    const { data: dataClas } = await supabase
      .from('maestros_clasificaciones')
      .select('id, nombre, centro_costo_id')
      .eq('activo', true);

    if (dataClas) {
      setTodasClasificaciones(dataClas.map(c => ({
        id: c.id,
        nombre: c.nombre,
        padreId: c.centro_costo_id
      })));
    }

    const { data: dataSub } = await supabase
      .from('maestros_sub_clasificaciones')
      .select('id, nombre, clasificacion_id')
      .eq('activo', true);

    if (dataSub) {
      setTodasCategorias(dataSub.map(s => ({
        id: s.id,
        nombre: s.nombre,
        padreId: s.clasificacion_id
      })));
    }

    const { data: dataGer } = await supabase.from('cat_gerencias').select('*').order('nombre');
    if (dataGer) setGerenciasBaseDatos(dataGer);

    setLoading(false);
  }, [currentUser]);

  // --- EFECTO DE CARGA INICIAL CON SUSCRIPCIÓN EN TIEMPO REAL ---
  useEffect(() => {
    cargarTodo();

    const channel = supabase
      .channel('fondos_realtime')
      // 1. Escuchar cambios en solicitudes_fondos (creación, edición o eliminación)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'solicitudes_fondos'
      }, (payload) => {
        console.log('[REALTIME FONDOS] Cambio detectado en solicitudes_fondos:', payload.eventType, payload.new);
        cargarTodo();
      })
      // 2. Escuchar cambios en partidas_fondos (pagos, duplicaciones, eliminaciones o vinculación a requisiciones)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'partidas_fondos'
      }, (payload) => {
        console.log('[REALTIME FONDOS] Cambio detectado en partidas_fondos:', payload.eventType, payload.new);
        cargarTodo();
      })
      // 3. Escuchar creación de nuevas requisiciones (INSERT) para bloquear partidas de inmediato
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'requisiciones'
      }, (payload) => {
        console.log('[REALTIME FONDOS] Nueva Requisición creada:', payload.new);
        toast.success(`Nueva requisición ${payload.new.correlativo_req || ''} generada. Sincronizando partidas...`, { icon: '📝' });
        cargarTodo();
      })
      // 4. Escuchar actualizaciones de requisiciones (UPDATE) para sincronizar aprobaciones
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'requisiciones'
      }, (payload) => {
        console.log('[REALTIME FONDOS] Requisición actualizada:', payload.new);
        if (payload.new.estado_aprobacion === 'aprobado_final') {
          toast.success(`Requisición ${payload.new.correlativo_req || ''} APROBADA GLOBAL. Sincronizando montos...`, { icon: '✅' });
        }
        cargarTodo();
      })
      .subscribe();

  }, [cargarTodo]);

  // --- EFECTO DE PRESENCIA MULTIUSUARIO ---
  useEffect(() => {
    if (!showModal || !currentUser) {
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
      setActiveUsers([]);
      setSelectedRowsByOthers({});
      return;
    }

    const depto = currentUser.departamento || '';
    const channelId = form.id_db
      ? `solicitud_presencia_${form.id_db}`
      : `solicitud_presencia_nueva_${depto.replace(/\s+/g, '_')}`;

    console.log(`[PRESENCE] Suscribiendo al canal: ${channelId}`);
    const channel = supabase.channel(channelId);
    presenceChannelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.entries(state).flatMap(([ref, presences]) => {
          return presences.map(p => ({
            presence_ref: ref,
            ...p
          }));
        });

        // Deduplicar usuarios por user_id
        const uniqueUsers = [];
        const seenIds = new Set();
        for (const u of users) {
          if (u.user_id && !seenIds.has(u.user_id)) {
            seenIds.add(u.user_id);
            uniqueUsers.push(u);
          }
        }
        console.log('[PRESENCE] Usuarios activos:', uniqueUsers);
        setActiveUsers(uniqueUsers);
      })
      .on('broadcast', { event: 'checkbox_change' }, ({ payload }) => {
        const { user_id, rowId, selected } = payload;
        if (user_id !== currentUser.id) {
          setSelectedRowsByOthers(prev => {
            const next = { ...prev };
            if (selected) {
              next[rowId] = user_id;
            } else {
              delete next[rowId];
            }
            return next;
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUser.id,
            nombre: `${currentUser.nombre} ${currentUser.apellido}`,
            gerencia: currentUser.departamento,
            fila_editando: null
          });
        }
      });

    return () => {
      console.log(`[PRESENCE] Desuscribiendo del canal: ${channelId}`);
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
      setActiveUsers([]);
      setSelectedRowsByOthers({});
    };
  }, [showModal, currentUser, form.id_db]);

  // Limpiar temporizador de blur al desmontar
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const handleFocusRow = (rowId) => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    if (presenceChannelRef.current) {
      presenceChannelRef.current.track({
        user_id: currentUser?.id,
        nombre: `${currentUser?.nombre} ${currentUser?.apellido}`,
        gerencia: currentUser?.departamento,
        fila_editando: rowId
      });
    }
  };

  const handleBlurRow = () => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    blurTimeoutRef.current = setTimeout(() => {
      if (presenceChannelRef.current) {
        presenceChannelRef.current.track({
          user_id: currentUser?.id,
          nombre: `${currentUser?.nombre} ${currentUser?.apellido}`,
          gerencia: currentUser?.departamento,
          fila_editando: null
        });
      }
    }, 150);
  };

  const obtenerGerentePorCentroCosto = (cc) => {
    if (!cc) return null;
    const ccUpper = cc.toString().toUpperCase().trim();

    // Si contiene "MTTO" o "MAYOR" o "GRANDE"
    if (
      ccUpper.includes("MTTO") ||
      ccUpper.includes("MAYOR") ||
      ccUpper.includes("GRANDE")
    ) {
      return "Hilda Colina";
    }

    // Si contiene "EXCELENCIA" o "VAC" o "VACCUM"
    if (
      ccUpper.includes("EXCELENCIA") ||
      ccUpper.includes("VAC") ||
      ccUpper.includes("VACCUM")
    ) {
      return "Johannel García";
    }

    return null;
  };

  const determinarGerenteSuperior = async (user, depto) => {
    try {
      // 0. Si el perfil del usuario tiene asignado explícitamente un gerente directo, usarlo
      if (user && user.gerente_directo_nombre) {
        console.log(`[GERENTE SUPERIOR] Asignado por Gerente Directo en Perfil:`, user.gerente_directo_nombre);
        return user.gerente_directo_nombre;
      }

      // Recopilar posibles Centros de Costo / Contratos del usuario
      const posiblesCCs = [];
      if (user && user.contrato) {
        posiblesCCs.push(user.contrato);
      }
      if (user && user.obras_asignadas && user.obras_asignadas.length > 0) {
        posiblesCCs.push(...user.obras_asignadas);
      }

      // 1. PRIMER NIVEL: Evaluar los Centros de Costo recopilados contra la matriz estricta
      if (posiblesCCs.length > 0) {
        for (const cc of posiblesCCs) {
          const gerente = obtenerGerentePorCentroCosto(cc);
          if (gerente) {
            console.log(`[GERENTE SUPERIOR] Asignado por matriz (obra/contrato: ${cc}):`, gerente);
            return gerente;
          }
        }
      }

      // 2. SEGUNDO NIVEL: Buscar Gerente de Proyecto genérico en base de datos
      if (posiblesCCs.length > 0) {
        const { data: gProyectos } = await supabase
          .from('perfiles')
          .select('nombre, apellido, obras_asignadas, contrato, rol')
          .ilike('rol', '%proyecto%')
          .eq('activo', true);

        if (gProyectos && gProyectos.length > 0) {
          const matchedProj = gProyectos.find(g => {
            const ccG = [];
            if (g.contrato) ccG.push(g.contrato);
            if (g.obras_asignadas && g.obras_asignadas.length > 0) ccG.push(...g.obras_asignadas);
            return ccG.some(obra => posiblesCCs.includes(obra));
          });
          if (matchedProj) {
            console.log("[GERENTE SUPERIOR] Gerente Proyecto genérico encontrado:", `${matchedProj.nombre} ${matchedProj.apellido}`);
            return `${matchedProj.nombre} ${matchedProj.apellido}`;
          }
        }
      }

      // 3. TERCER NIVEL: Buscar Gerente de Área
      if (depto) {
        const { data: gerentesArea } = await supabase
          .from('perfiles')
          .select('nombre, apellido, rol')
          .ilike('departamento', `%${depto}%`)
          .eq('activo', true);

        if (gerentesArea && gerentesArea.length > 0) {
          const matchedArea = gerentesArea.find(g => {
            const r = (g.rol || '').toLowerCase();
            return (r.includes('área') || r.includes('area') || g.rol === 'Gerente') && !r.includes('proyecto');
          });
          if (matchedArea) {
            console.log("[GERENTE SUPERIOR] Gerente de Área encontrado:", `${matchedArea.nombre} ${matchedArea.apellido}`);
            return `${matchedArea.nombre} ${matchedArea.apellido}`;
          }
        }
      }

      // Fallback
      const gerentesDept = gerenciasData[depto];
      if (gerentesDept && gerentesDept.length > 0) {
        console.log("[GERENTE SUPERIOR] Fallback estático:", gerentesDept[0]);
        return gerentesDept[0];
      }
    } catch (err) {
      console.error("[GERENTE SUPERIOR] Error determinando superior:", err);
    }
    return '';
  };

  useEffect(() => {
    if (showModal && !isEditing && currentUser) {
      const depto = currentUser.departamento || '';

      const inicializarResponsable = async () => {
        const superior = await determinarGerenteSuperior(currentUser, depto);
        setForm(prev => ({
          ...prev,
          responsable: superior || `${currentUser.nombre} ${currentUser.apellido}`,
          gerencia: depto
        }));
      };

      inicializarResponsable();
    }
  }, [showModal, isEditing, currentUser]);

  // --- FUNCIONES DE LÓGICA ---
  const cargarDetallesYEditar = async (solicitud) => {
    try {
      const targetId = solicitud.id_db || solicitud.id;

      // 1. Obtener Partidas
      const { data: partidasRaw } = await supabase
        .from('partidas_fondos')
        .select('*, requisiciones(id, correlativo_req, items, status_compra, estado_aprobacion)')
        .eq('solicitud_id', targetId);

      // 1.1 Obtener Requisiciones vinculadas por correlativo o ID para verificar estado (en caso de desvinculación previa o join directo)
      const rrCodigos = (partidasRaw || []).map(p => p.codigo_ticket).filter(c => c && c.startsWith('RR-'));
      const rrIds = (partidasRaw || []).map(p => p.requisicion_id).filter(Boolean);
      let requisicionesInvolucradas = [];
      if (rrCodigos.length > 0 || rrIds.length > 0) {
        try {
          let query = supabase.from('requisiciones').select('id, correlativo_req, estado_aprobacion, items, status_compra');
          if (rrIds.length > 0 && rrCodigos.length > 0) {
            query = query.or(`id.in.(${rrIds.join(',')}),correlativo_req.in.(${rrCodigos.map(c => `"${c}"`).join(',')})`);
          } else if (rrIds.length > 0) {
            query = query.in('id', rrIds);
          } else {
            query = query.in('correlativo_req', rrCodigos);
          }
          const { data: rData } = await query;
          if (rData) requisicionesInvolucradas = rData;
        } catch (e) {
          console.error("Error fetching requisiciones involucradas:", e);
        }
      }

      // Auto-limpieza en BD: desvincular partidas de requisiciones anuladas
      const partidasParaLiberar = (partidasRaw || []).filter(p => {
        const r = p.requisiciones || requisicionesInvolucradas.find(req => req.id === p.requisicion_id || (p.codigo_ticket && req.correlativo_req === p.codigo_ticket));
        return r?.estado_aprobacion === 'ANULADA' || r?.estado_aprobacion === 'RECHAZADA';
      });
      if (partidasParaLiberar.length > 0) {
        const idsLiberar = partidasParaLiberar.map(p => p.id);
        supabase.from('partidas_fondos').update({ status: 'Disponible', requisicion_id: null, codigo_ticket: null, emisor_nombre: null }).in('id', idsLiberar).then(() => console.log('[AUTO-LIMPIEZA FONDOS] Liberadas:', idsLiberar));
      }

      // 1.2 Obtener Tickets Directos Involucrados para calcular ejecución
      const ticketIds = partidasRaw.map(p => p.ticket_id).filter(Boolean);
      const ticketCodigos = partidasRaw.map(p => p.codigo_ticket).filter(c => c && c.startsWith('TP-'));
      let ticketsInvolucrados = [];
      if (ticketIds.length > 0 || ticketCodigos.length > 0) {
        try {
          let query = supabase.from('tickets_directos').select('*');
          if (ticketIds.length > 0 && ticketCodigos.length > 0) {
            query = query.or(`id.in.(${ticketIds.join(',')}),codigo_control.in.(${ticketCodigos.map(c => `"${c}"`).join(',')})`);
          } else if (ticketIds.length > 0) {
            query = query.in('id', ticketIds);
          } else {
            query = query.in('codigo_control', ticketCodigos);
          }
          const { data: tData } = await query;
          if (tData) ticketsInvolucrados = tData;
        } catch (e) {
          console.error("Error fetching tickets directos:", e);
        }
      }

      // 2. Mapear Partidas con Lógica de Ejecución (P.U. REAL)
      const procesarEjecucion = (p) => {
        if (p.status === 'ANULADO_POR_USUARIO') {
          return { montoReal: 0, montoPendiente: 0 };
        }

        const isReqComp = p.requisiciones ? esRequisicionCompletada(p.requisiciones) : false;

        if (p.pago_realizado) {
          return {
            montoReal: (parseFloat(p.pu_bs) || parseFloat(p.pu_usd) || 0) * (p.cantidad || 1),
            montoPendiente: 0
          };
        }

        let montoReal = 0;
        let montoPendiente = (p.pu_bs || p.pu_usd || 0) * (p.cantidad || 1);

        if (p.requisiciones && p.requisiciones.items) {
          const normPDesc = (p.descripcion || '').trim().toLowerCase();
          const pCant = Number(p.cantidad) || 1;
          const itemsArr = safeArray(p.requisiciones.items);

          let itemReq = itemsArr.find(item => {
            const normItemDesc = (item.descripcion || item.desc || '').trim().toLowerCase();
            const descMatch = normItemDesc === normPDesc || (normItemDesc && normPDesc && (normItemDesc.includes(normPDesc) || normPDesc.includes(normItemDesc)));
            const cantMatch = Number(item.cantidad_pedida ?? item.cant ?? item.cantidad) === pCant;
            return descMatch && cantMatch;
          }) || itemsArr.find(item => {
            const normItemDesc = (item.descripcion || item.desc || '').trim().toLowerCase();
            return normItemDesc === normPDesc || (normItemDesc && normPDesc && (normItemDesc.includes(normPDesc) || normPDesc.includes(normItemDesc)));
          });

          if (itemReq) {
            montoReal = (itemReq.historial_compras || []).reduce((sum, h) => {
              if (h.tipo === 'JUSTIFICACION') return sum;
              return sum + ((parseFloat(h.cant) || 0) * (parseFloat(h.pu) || 0));
            }, 0);

            const cantPendiente = parseFloat(itemReq.cantidad_pendiente ?? itemReq.cant) || 0;
            const puEst = parseFloat(itemReq.pu_estimado ?? itemReq.pu) || 0;
            
            if (montoReal === 0 && isReqComp) {
              montoReal = (parseFloat(p.pu_bs) || parseFloat(p.pu_usd) || 0) * (p.cantidad || 1);
              montoPendiente = 0;
            } else {
              montoPendiente = cantPendiente * puEst;
            }
          } else if (isReqComp) {
            montoReal = (parseFloat(p.pu_bs) || parseFloat(p.pu_usd) || 0) * (p.cantidad || 1);
            montoPendiente = 0;
          }
        } else {
          const ticketAsociado = ticketsInvolucrados.find(t =>
            t.id === p.ticket_id ||
            (p.codigo_ticket && t.codigo_control === p.codigo_ticket)
          );
          if (ticketAsociado) {
            if (ticketAsociado.items && ticketAsociado.items.length > 0) {
              const normPDesc = (p.descripcion || '').trim().toLowerCase();
              const itemTicket = ticketAsociado.items.find(it =>
                (it.desc || it.descripcion || '').trim().toLowerCase() === normPDesc &&
                (Number(it.cantidad_pedida || it.cant) === Number(p.cantidad))
              ) || ticketAsociado.items.find(it => (it.desc || it.descripcion || '').trim().toLowerCase() === normPDesc);
              
              if (itemTicket) {
                montoReal = (itemTicket.historial_compras || []).reduce((sum, h) => {
                  return sum + ((parseFloat(h.cant) || 0) * (parseFloat(h.pu) || 0));
                }, 0);
                const cantPendiente = parseFloat(itemTicket.cantidad_pendiente ?? itemTicket.cant) || 0;
                const puEst = parseFloat(itemTicket.pu_estimado ?? itemTicket.pu) || 0;
                
                if (montoReal === 0 && (ticketAsociado.status === 'Pagado' || ticketAsociado.status === 'COMPLETADO')) {
                  montoReal = (parseFloat(p.pu_bs) || parseFloat(p.pu_usd) || 0) * (p.cantidad || 1);
                  montoPendiente = 0;
                } else {
                  montoPendiente = cantPendiente * puEst;
                }
              } else {
                if (ticketAsociado.status === 'Pagado' || ticketAsociado.status === 'COMPLETADO') {
                  montoReal = (parseFloat(p.pu_bs) || parseFloat(p.pu_usd) || 0) * (p.cantidad || 1);
                  montoPendiente = 0;
                }
              }
            } else if (ticketAsociado.status === 'Pagado' || ticketAsociado.status === 'COMPLETADO') {
              montoReal = (parseFloat(p.pu_bs) || parseFloat(p.pu_usd) || 0) * (p.cantidad || 1);
              montoPendiente = 0;
            }
          }
        }

        return { montoReal, montoPendiente };
      };

      const estActual = getEstadoSolicitud(solicitud);
      setIsReadOnly(estActual === 'COMPLETADA' && !esRrHhOAdm);

      const getIsCompletado = (p) => {
        if (p.requisicion_id && p.requisiciones) {
          return esRequisicionCompletada(p.requisiciones);
        }
        if (p.ticket_id || p.codigo_ticket?.startsWith('TP-')) {
          const tk = ticketsInvolucrados.find(t => t.id === p.ticket_id || t.codigo_control === p.codigo_ticket);
          if (tk) {
            if (tk.status === 'Pagado') return true;
            if (tk.items && tk.items.length > 0) {
              const it = tk.items.find(item =>
                (item.desc || item.descripcion || '').trim().toUpperCase() === (p.descripcion || '').trim().toUpperCase() &&
                (Number(item.cantidad_pedida || item.cant) === Number(p.cantidad))
              );
              if (it && Number(it.cantidad_pendiente) === 0) return true;
            }
          }
        }
        return false;
      };

      const activePartidasRaw = partidasRaw.filter(p => p.status !== 'ANULADO_POR_USUARIO' && !p.clasificacion?.includes('[*]') && p.clasificacion !== 'Gastos Imprevistos' && p.clasificacion !== 'Ticket de Pago' && p.clasificacion !== 'Solicitud de ticket');
      const hasPartidasIncompletas = activePartidasRaw.length === 0 || activePartidasRaw.some(p => !getIsCompletado(p));

      const estadoFinalReal = hasPartidasIncompletas 
        ? (getEstadoSolicitud(solicitud) === 'COMPLETADA' ? 'EN PROCESO' : getEstadoSolicitud(solicitud))
        : (solicitud.estado || 'COMPLETADA');

      setIsReadOnly(estadoFinalReal === 'COMPLETADA' && !esRrHhOAdm);

      setForm({
        ...solicitud,
        id: solicitud.codigo_control || solicitud.id,
        id_db: solicitud.id_db,
        fecha: solicitud.fecha_operativa,
        gerencia: solicitud.gerencia,
        responsable: solicitud.responsable,
        estado: estadoFinalReal,
        bloque_operativo: solicitud.bloque_operativo || null,
        partidas: partidasRaw.filter(p => !p.clasificacion.includes('[*]') && p.clasificacion !== 'Gastos Imprevistos' && p.clasificacion !== 'Ticket de Pago' && p.clasificacion !== 'Solicitud de ticket').map(p => {
          const { montoReal, montoPendiente } = procesarEjecucion(p);
          const isReqCompletada = getIsCompletado(p);
          const reqObj = p.requisiciones || requisicionesInvolucradas.find(r => r.id === p.requisicion_id || (p.codigo_ticket && r.correlativo_req === p.codigo_ticket)) || null;
          const isReqAnulada = reqObj?.estado_aprobacion === 'ANULADA' || reqObj?.estado_aprobacion === 'RECHAZADA';
          const tieneReqValida = (p.requisicion_id || reqObj?.id) && !isReqAnulada;

          return {
            id: p.id,
            cc: p.centro_costo,
            clasif: p.clasificacion,
            cat: p.categoria,
            cant: p.cantidad,
            uni: p.unidad,
            desc: p.descripcion,
            ben: p.beneficiario,
            puBs: p.pu_bs,
            puUsd: p.pu_usd,
            pago_realizado: p.pago_realizado || false,
            emisor: p.emisor_nombre || 'S/E',
            requisicion_id: tieneReqValida ? (p.requisicion_id || reqObj?.id) : null,
            ticket_id: p.ticket_id || null,
            codigo_ticket: (p.codigo_ticket?.startsWith('RR-') && !tieneReqValida) ? null : (p.codigo_ticket || null),
            codigo_ref: (p.codigo_ticket?.startsWith('RR-') && !tieneReqValida) ? null : (isReqAnulada ? null : (p.codigo_ticket || reqObj?.correlativo_req || null)),
            isReqCompletada: isReqAnulada ? false : isReqCompletada,
            status: (isReqAnulada || (p.status === 'Bloqueado' && !tieneReqValida)) ? 'Disponible' : (p.status || 'Disponible'),
            selected: false,
            montoReal: isReqAnulada ? 0 : montoReal,
            montoPendiente: isReqAnulada ? (p.pu_bs || p.pu_usd || 0) * (p.cantidad || 1) : montoPendiente,
            requisiciones: tieneReqValida ? reqObj : null
          };
        }),
        imprevistos: partidasRaw.filter(p => p.clasificacion.includes('[*]') || p.clasificacion === 'Gastos Imprevistos' || p.clasificacion === 'Ticket de Pago' || p.clasificacion === 'Solicitud de ticket').length > 0
          ? partidasRaw.filter(p => p.clasificacion.includes('[*]') || p.clasificacion === 'Gastos Imprevistos' || p.clasificacion === 'Ticket de Pago' || p.clasificacion === 'Solicitud de ticket').map(p => {
            const { montoReal, montoPendiente } = procesarEjecucion(p);
            const isReqCompletada = getIsCompletado(p);
            const reqObj = p.requisiciones || requisicionesInvolucradas.find(r => r.id === p.requisicion_id || (p.codigo_ticket && r.correlativo_req === p.codigo_ticket)) || null;
            const isReqAnulada = reqObj?.estado_aprobacion === 'ANULADA' || reqObj?.estado_aprobacion === 'RECHAZADA';
            const tieneReqValida = (p.requisicion_id || reqObj?.id) && !isReqAnulada;

            return {
              id: p.id,
              cc: p.centro_costo,
              clasif: p.clasificacion.replace(' [*]', ''),
              cat: p.categoria,
              cant: p.cantidad,
              uni: p.unidad,
              desc: p.descripcion,
              ben: p.beneficiario,
              puBs: p.pu_bs,
              puUsd: p.pu_usd,
              pago_realizado: p.pago_realizado || false,
              emisor: p.emisor_nombre || 'S/E',
              requisicion_id: tieneReqValida ? (p.requisicion_id || reqObj?.id) : null,
              ticket_id: p.ticket_id || null,
              codigo_ticket: (p.codigo_ticket?.startsWith('RR-') && !tieneReqValida) ? null : (p.codigo_ticket || null),
              codigo_ref: (p.codigo_ticket?.startsWith('RR-') && !tieneReqValida) ? null : (isReqAnulada ? null : (p.codigo_ticket || reqObj?.correlativo_req || null)),
              isReqCompletada: isReqAnulada ? false : isReqCompletada,
              status: (isReqAnulada || (p.status === 'Bloqueado' && !tieneReqValida)) ? 'Disponible' : (p.status || 'Disponible'),
              selected: false,
              montoReal: isReqAnulada ? 0 : montoReal,
              montoPendiente: isReqAnulada ? (p.pu_bs || p.pu_usd || 0) * (p.cantidad || 1) : montoPendiente,
              requisiciones: tieneReqValida ? reqObj : null
            };
          })
          : [{ id: Date.now() + 1, selected: false, cc: '', clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', puBs: '', puUsd: '', pago_realizado: false, isReqCompletada: false, montoReal: 0, montoPendiente: 0 }]
      });
      if (partidasRaw.some(p => p.clasificacion === 'Gastos Imprevistos' || p.clasificacion === 'Ticket de Pago')) {
        setMostrarImprevistos(true);
      } else {
        setMostrarImprevistos(false);
      }
      setIsEditing(true);
      const esAdmin = currentUser?.esSuperAdmin || currentUser?.esAdminReal;
      const esPropioDepto = (solicitud.gerencia || solicitud.gerencia_nombre || '').toLowerCase() === (currentUser?.departamento || '').toLowerCase();
      setIsReadOnly((estActual === 'COMPLETADA' && !esRrHhOAdm) || (!esAdmin && !esPropioDepto && !esRrHhOAdm));
      setShowModal(true);
    } catch (err) { toast.error("Error cargando detalles."); }
  };

  const manejarCambioPartida = (index, campo, valor) => {
    const nuevas = [...form.partidas];
    let valorFinal = valor;

    // BLOQUEO DE NEGATIVOS / PERMITIR VACÍOS Y FORMATOS TEMPORALES
    if (['cant', 'puBs', 'puUsd'].includes(campo)) {
      let stringVal = (valor !== undefined && valor !== null) ? valor.toString().replace(/[^0-9.]/g, '') : '';
      const parts = stringVal.split('.');
      if (parts.length > 2) {
        stringVal = parts[0] + '.' + parts.slice(1).join('');
      }
      // Limpiar ceros a la izquierda (ej. "05" -> "5"), pero permitir "0" y "0."
      if (stringVal.startsWith('0') && stringVal.length > 1 && stringVal[1] !== '.') {
        stringVal = stringVal.replace(/^0+/, '');
        if (stringVal === '') stringVal = '0';
      }
      valorFinal = stringVal;
    }

    nuevas[index][campo] = valorFinal;
    if (campo === 'cc') { nuevas[index].clasif = ''; nuevas[index].cat = ''; }
    if (campo === 'clasif') { nuevas[index].cat = ''; }
    
    const parsedVal = parseFloat(valorFinal) || 0;
    if (campo === 'puBs' && parsedVal > 0) nuevas[index].puUsd = '';
    if (campo === 'puUsd' && parsedVal > 0) nuevas[index].puBs = '';
    setHasChanges(true);
    setForm({ ...form, partidas: nuevas });
  };

  const manejarCambioImprevisto = (index, campo, valor) => {
    const nuevos = [...form.imprevistos];

    // --- VALIDACIÓN DE CENTRO DE COSTO ÚNICO PARA TICKET DE PAGO ---
    if (campo === 'selected' && valor === true) {
      const yaSeleccionados = nuevos.filter((imp, idx) => idx !== index && imp.selected);
      if (yaSeleccionados.length > 0) {
        const ccBase = yaSeleccionados[0].cc;
        if (ccBase && nuevos[index].cc && nuevos[index].cc !== ccBase) {
          toast.error("No se pueden mezclar Centros de Costos en un mismo Ticket de Pago. Por favor, genere un ticket por separado.");
          return; // Impedir la selección
        }
      }
    }

    let valorFinal = valor;
    // BLOQUEO DE NEGATIVOS / PERMITIR VACÍOS Y FORMATOS TEMPORALES
    if (['cant', 'puBs', 'puUsd'].includes(campo)) {
      let stringVal = (valor !== undefined && valor !== null) ? valor.toString().replace(/[^0-9.]/g, '') : '';
      const parts = stringVal.split('.');
      if (parts.length > 2) {
        stringVal = parts[0] + '.' + parts.slice(1).join('');
      }
      // Limpiar ceros a la izquierda, ej. "05" -> "5", pero permitir "0" y "0."
      if (stringVal.startsWith('0') && stringVal.length > 1 && stringVal[1] !== '.') {
        stringVal = stringVal.replace(/^0+/, '');
        if (stringVal === '') stringVal = '0';
      }
      valorFinal = stringVal;
    }

    nuevos[index][campo] = valorFinal;
    if (campo === 'cc') { nuevos[index].clasif = ''; nuevos[index].cat = ''; }
    if (campo === 'clasif') { nuevos[index].cat = ''; }
    
    const parsedVal = parseFloat(valorFinal) || 0;
    if (campo === 'puBs' && parsedVal > 0) nuevos[index].puUsd = '';
    if (campo === 'puUsd' && parsedVal > 0) nuevos[index].puBs = '';
    setHasChanges(true);
    setForm({ ...form, imprevistos: nuevos });
  };

  const normalizarNumeroOnBlur = (index, campo, valor, esImprevisto = false) => {
    const list = esImprevisto ? [...form.imprevistos] : [...form.partidas];
    if (!list[index]) return;
    
    let stringVal = (valor !== undefined && valor !== null) ? valor.toString().trim() : '';
    let numVal = parseFloat(stringVal);
    
    if (isNaN(numVal) || numVal < 0) {
      numVal = 0;
    }
    
    if (stringVal === '' && (campo === 'puBs' || campo === 'puUsd')) {
      list[index][campo] = '';
    } else {
      list[index][campo] = numVal;
    }
    
    if (campo === 'puBs' && numVal > 0) list[index].puUsd = '';
    if (campo === 'puUsd' && numVal > 0) list[index].puBs = '';
    
    setForm({ ...form, [esImprevisto ? 'imprevistos' : 'partidas']: list });
  };

  const getWeekNumber = (d) => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  };

  // --- HELPER: Rango de fechas de una semana ISO (Lunes a Domingo) ---
  const getWeekRange = (weekNum, year) => {
    // Encontrar el Lunes de la semana ISO dada
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7; // Lunes=1 ... Domingo=7
    const mondayWeek1 = new Date(jan4);
    mondayWeek1.setDate(jan4.getDate() - (dayOfWeek - 1));
    // Avanzar a la semana deseada
    const targetMonday = new Date(mondayWeek1);
    targetMonday.setDate(mondayWeek1.getDate() + (weekNum - 1) * 7);
    const targetSunday = new Date(targetMonday);
    targetSunday.setDate(targetMonday.getDate() + 6);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(targetMonday.getDate())}/${pad(targetMonday.getMonth() + 1)} al ${pad(targetSunday.getDate())}/${pad(targetSunday.getMonth() + 1)}`;
  };

  // Extraer semana y año desde un codigo_control como "OPE - SEM 14 - 26"
  const extractPeriodoFromId = (codigoControl) => {
    const match = codigoControl?.match(/SEM\s+(\d+)/i) || codigoControl?.match(/SEMANA\s+(\d+)/i);
    if (!match) return '—';
    const weekNum = parseInt(match[1], 10);
    // Intentar obtener el año del registro (últimos dos dígitos)
    const yearMatch = codigoControl?.match(/-\s+(\d{2})$/);
    const year = yearMatch ? 2000 + parseInt(yearMatch[1], 10) : new Date().getFullYear();
    return getWeekRange(weekNum, year);
  };

  const numSemana = getWeek(new Date(form.fecha + 'T12:00:00'), { weekStartsOn: 1 });
  const siglasGerencia = obtenerSiglas(form.gerencia);
  const aa = new Date(form.fecha).getFullYear().toString().slice(-2);

  const getSiglasBloque = (bloque) => {
    if (!bloque) return '';
    const bLower = bloque.toLowerCase();
    
    // Específico Mantenimiento (Jose Luis -> A, Habner -> B)
    if (bLower.includes('jose luis') || bLower.includes('jl')) {
      return 'A';
    }
    if (bLower.includes('habner') || bLower.includes('herrera') || bLower.includes('hh') || bLower.includes('hab') || bLower.includes('campo') || bLower.includes('cmp')) {
      return 'B';
    }
    
    // Operaciones (Hilda/MTT -> A, Johannel/Excelencia/Vacuum -> B)
    if (bLower.includes('mantenimiento mayor') ||
      bLower.includes('mtto') ||
      bLower.includes('mantenimiento') ||
      bLower.includes('hilda') ||
      bLower.trim() === 'a') {
      return 'A';
    }
    if (bLower.includes('excelencia') ||
      bLower.includes('vacuum') ||
      bLower.includes('exva') ||
      bLower.includes('johannel') ||
      bLower.trim() === 'b') {
      return 'B';
    }
    
    return '';
  };

  const deptoLower = (form.gerencia || currentUser?.departamento || '').toLowerCase();
  const siglasBloque = (deptoLower === 'operaciones' || deptoLower === 'mantenimiento')
    ? getSiglasBloque(form.bloque_operativo || currentUser?.bloque_operativo)
    : '';

  const idDinamico = isEditing
    ? form.id
    : (siglasBloque ? `${siglasGerencia}-${siglasBloque}-SEM ${numSemana}-${aa}` : `${siglasGerencia}-SEM ${numSemana}-${aa}`);
  const periodoSemana = getWeekRange(numSemana, new Date(form.fecha).getFullYear());

  useEffect(() => {
    setFiltroPartidaEmisor('Todos');
    setFiltroPartidaCategoria('Todos');
    setFiltroPartidaClasificacion('Todos');
    setFiltroPartidaEstadoId('Todos');
    setMostrarFiltrosTabla(false);
  }, [idDinamico]);

  // --- LÓGICA DE CIERRE SEMANAL (DOMINGO 23:59:59) ---
  const calculateDeadline = (fecha) => {
    const d = new Date(fecha + 'T12:00:00');
    const day = d.getDay() || 7;
    const sunday = new Date(d);
    sunday.setDate(d.getDate() + (7 - day));
    sunday.setHours(23, 59, 59, 999);
    return sunday;
  };

  const deadlineDate = calculateDeadline(form.fecha);
  const isExpired = estadoActual === 'COMPLETADA' && !esRrHhOAdm;

  const verificarDisponibilidad = async () => {
    if (!fechaPreVal) return setErrorCheck("Por favor, seleccione una fecha operativa.");

    // --- EXCEPCIÓN DE ADMINISTRADOR / GERENTE GENERAL ---
    const rolUpper = (currentUser?.rol || '').toUpperCase();
    const isPrivileged = currentUser?.esAdminReal || rolUpper === 'GERENTE GENERAL' || rolUpper === 'ADMIN' || currentUser?.esPerlaDelgado || currentUser?.capacidades?.ver_solicitudes_global;
    setEsAdminBypass(isPrivileged);

    setLoadingCheck(true);
    setErrorCheck('');
    setSolicitudConflictiva(null);

    try {
      const week = getWeek(new Date(fechaPreVal + 'T12:00:00'), { weekStartsOn: 1 });
      const year = new Date(fechaPreVal).getFullYear();
      const depto = currentUser?.departamento;

      // Calculamos rango de fechas para la consulta segura
      const d = new Date(fechaPreVal + 'T12:00:00');
      const day = d.getDay() || 7;
      const monday = new Date(d); monday.setDate(d.getDate() - (day - 1));
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);

      const pad = (n) => String(n).padStart(2, '0');
      const fStart = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
      const fEnd = `${sunday.getFullYear()}-${pad(sunday.getMonth() + 1)}-${pad(sunday.getDate())}`;

      // Verificamos si ya existe una solicitud para esa gerencia en esa semana
      let checkQuery = supabase
        .from('solicitudes_fondos')
        .select('*')
        .eq('gerencia_nombre', depto)
        .gte('fecha_operativa', fStart)
        .lte('fecha_operativa', fEnd);

      const deptoLowerCheck = depto ? depto.toLowerCase() : '';
      const isBlockDepto = deptoLowerCheck === 'operaciones' || deptoLowerCheck === 'mantenimiento';
      if (isBlockDepto) {
        checkQuery = checkQuery.eq('bloque_operativo', currentUser?.bloque_operativo || '');
      }

      const { data: existencias, error } = await checkQuery.limit(1);

      if (error) throw error;

      if (existencias && existencias.length > 0) {
        const sol = existencias[0];
        setSolicitudConflictiva(sol);
        setErrorCheck(`Error: El departamento de ${depto}${isBlockDepto ? ' (' + (sol.bloque_operativo || 'Sin bloque') + ')' : ''} ya tiene una solicitud abierta para la Semana ${week} por ${sol.responsable_nombre}. Por favor, colabora en esa solicitud o espera a que se finalice.`);
        setSolCheckExitosa(isPrivileged); // Si es admin, dejamos el check en éxito parcial
      } else {
        setSolCheckExitosa(true);
        setErrorCheck('');
      }
    } catch (err) {
      setErrorCheck("Error al validar: " + err.message);
    } finally {
      setLoadingCheck(false);
    }
  };

  // --- CÁLCULO DE TOTALES PARA PANEL DE INDICADORES ---
  const totalesVisibles = useMemo(() => {
    return historialFiltrado.reduce((acc, h) => {
      acc.solicitado += (parseFloat(h.total_bs) || 0) + (parseFloat(h.total_usd) || 0);
      acc.pagado += parseFloat(h.total_pagado || 0);
      acc.pendiente += (parseFloat(h.pending_bs) || 0) + (parseFloat(h.pending_usd) || 0);
      return acc;
    }, { solicitado: 0, pagado: 0, pendiente: 0 });
  }, [historialFiltrado]);

  // --- FUNCIÓN DE EXPORTACIÓN A EXCEL PREMIUM ---
  const exportarExcel = async () => {
    // Importamos dinámicamente para evitar problemas de carga inicial
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Solicitud de Fondos');

    // Estilo de Título (12 columnas: A a L)
    ws.mergeCells('A1:L1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'TOTAL CLEAN C.A. - SOLICITUD DE FONDOS OPERATIVOS';
    titleCell.font = { name: 'Arial Black', size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0EA5E9' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(1).height = 35;

    // Encabezados
    const headers = [
      'ID CONTROL', 'SEMANA', 'PERÍODO', 'RESPONSABLE', 'GERENCIA',
      'Solicitado sem. ant. ($/$)', 'Solicitado sem. ant. (Bs/$)', 'Total Solicitado sem. ant. ($)',
      'Solicitado actual ($/$)', 'Solicitado actual (Bs/$)', 'Total Solicitado actual ($)',
      'TOTAL GENERAL ($)'
    ];
    ws.addRow(headers);
    const headerRow = ws.getRow(2);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    headerRow.alignment = { horizontal: 'center' };

    let sumPrevUsd = 0;
    let sumPrevBs = 0;
    let sumPrevTotal = 0;
    let sumUsd = 0;
    let sumBs = 0;
    let sumActualTotal = 0;
    let sumGrandTotal = 0;

    // Calcular la semana máxima presente en el reporte filtrado como semana actual de referencia
    let maxYearWeek = 0;
    historialFiltrado.forEach(h => {
      let w = 0;
      let y = 0;
      if (h.fecha_operativa) {
        const dateObj = new Date(h.fecha_operativa + 'T12:00:00');
        w = getWeek(dateObj, { weekStartsOn: 1 });
        y = dateObj.getFullYear();
      } else {
        const match = h.id?.match(/SEM\s+(\d+)/i) || h.id?.match(/SEMANA\s+(\d+)/i);
        if (match) {
          w = parseInt(match[1], 10);
          const yearMatch = h.id?.match(/-\s+(\d{2})$/);
          y = yearMatch ? 2000 + parseInt(yearMatch[1], 10) : new Date().getFullYear();
        }
      }
      const yw = y * 100 + w;
      if (yw > maxYearWeek) {
        maxYearWeek = yw;
      }
    });

    // Datos
    historialFiltrado.forEach(h => {
      let w = 0;
      let y = 0;
      if (h.fecha_operativa) {
        const dateObj = new Date(h.fecha_operativa + 'T12:00:00');
        w = getWeek(dateObj, { weekStartsOn: 1 });
        y = dateObj.getFullYear();
      } else {
        const match = h.id?.match(/SEM\s+(\d+)/i) || h.id?.match(/SEMANA\s+(\d+)/i);
        if (match) {
          w = parseInt(match[1], 10);
          const yearMatch = h.id?.match(/-\s+(\d{2})$/);
          y = yearMatch ? 2000 + parseInt(yearMatch[1], 10) : new Date().getFullYear();
        }
      }

      const yw = y * 100 + w;
      const isPastWeek = yw < maxYearWeek;

      let acumuladoAnteriorBs = 0;
      let acumuladoAnteriorUsd = 0;

      historial.forEach(prev => {
        if (prev.gerencia !== h.gerencia) return;

        let prevW = 0;
        let prevY = 0;
        if (prev.fecha_operativa) {
          const dateObj = new Date(prev.fecha_operativa + 'T12:00:00');
          prevW = getWeek(dateObj, { weekStartsOn: 1 });
          prevY = dateObj.getFullYear();
        } else {
          const match = prev.id?.match(/SEM\s+(\d+)/i) || prev.id?.match(/SEMANA\s+(\d+)/i);
          if (match) {
            prevW = parseInt(match[1], 10);
            const yearMatch = prev.id?.match(/-\s+(\d{2})$/);
            prevY = yearMatch ? 2000 + parseInt(yearMatch[1], 10) : new Date().getFullYear();
          }
        }

        const isOlder = prevY < y || (prevY === y && prevW < w);
        if (isOlder) {
          acumuladoAnteriorBs += parseFloat(prev.pending_bs || 0);
          acumuladoAnteriorUsd += parseFloat(prev.pending_usd || 0);
        }
      });

      const rowPrevUsd = acumuladoAnteriorUsd + (isPastWeek ? parseFloat(h.pending_usd || 0) : 0);
      const rowPrevBs = acumuladoAnteriorBs + (isPastWeek ? parseFloat(h.pending_bs || 0) : 0);
      const rowPrevTotal = rowPrevUsd + rowPrevBs;

      const rowActualUsd = isPastWeek ? 0 : parseFloat(h.pending_usd || 0);
      const rowActualBs = isPastWeek ? 0 : parseFloat(h.pending_bs || 0);
      const rowActualTotal = rowActualUsd + rowActualBs;

      const rowGrandTotal = rowPrevTotal + rowActualTotal;

      sumPrevUsd += rowPrevUsd;
      sumPrevBs += rowPrevBs;
      sumPrevTotal += rowPrevTotal;
      sumUsd += rowActualUsd;
      sumBs += rowActualBs;
      sumActualTotal += rowActualTotal;
      sumGrandTotal += rowGrandTotal;

      ws.addRow([
        h.id,
        `SEM ${w}`,
        extractPeriodoFromId(h.id),
        h.responsable,
        h.gerencia,
        rowPrevUsd,
        rowPrevBs,
        rowPrevTotal,
        rowActualUsd,
        rowActualBs,
        rowActualTotal,
        rowGrandTotal
      ]);
    });

    // Formato de Moneda
    for (let c = 6; c <= 12; c++) {
      ws.getColumn(c).numFmt = '"$"#,##0.00';
    }

    // Ajuste de Anchos
    ws.columns.forEach(col => { col.width = 15; });
    ws.getColumn(1).width = 25;
    ws.getColumn(3).width = 20;
    ws.getColumn(4).width = 25;
    ws.getColumn(5).width = 20;
    ws.getColumn(6).width = 24;
    ws.getColumn(7).width = 24;
    ws.getColumn(8).width = 24;
    ws.getColumn(9).width = 24;
    ws.getColumn(10).width = 24;
    ws.getColumn(11).width = 24;
    ws.getColumn(12).width = 24;

    // Totales Finales
    const totalRowIndex = historialFiltrado.length + 3;
    ws.mergeCells(`A${totalRowIndex}:E${totalRowIndex}`);
    const totalLabel = ws.getCell(`A${totalRowIndex}`);
    totalLabel.value = 'TOTALES GENERALES:';
    totalLabel.font = { bold: true, size: 12 };
    totalLabel.alignment = { horizontal: 'right' };

    const cellPrevUsd = ws.getCell(`F${totalRowIndex}`);
    cellPrevUsd.value = sumPrevUsd;
    cellPrevUsd.font = { bold: true, color: { argb: 'FF15803D' } };
    cellPrevUsd.numFmt = '"$"#,##0.00';

    const cellPrevBs = ws.getCell(`G${totalRowIndex}`);
    cellPrevBs.value = sumPrevBs;
    cellPrevBs.font = { bold: true, color: { argb: 'FFB45309' } };
    cellPrevBs.numFmt = '"$"#,##0.00';

    const cellPrevTotal = ws.getCell(`H${totalRowIndex}`);
    cellPrevTotal.value = sumPrevTotal;
    cellPrevTotal.font = { bold: true, size: 12, color: { argb: 'FF1E3A8A' } };
    cellPrevTotal.numFmt = '"$"#,##0.00';

    const cellUsd = ws.getCell(`I${totalRowIndex}`);
    cellUsd.value = sumUsd;
    cellUsd.font = { bold: true, color: { argb: 'FF15803D' } };
    cellUsd.numFmt = '"$"#,##0.00';

    const cellBs = ws.getCell(`J${totalRowIndex}`);
    cellBs.value = sumBs;
    cellBs.font = { bold: true, color: { argb: 'FFB45309' } };
    cellBs.numFmt = '"$"#,##0.00';

    const cellActualTotal = ws.getCell(`K${totalRowIndex}`);
    cellActualTotal.value = sumActualTotal;
    cellActualTotal.font = { bold: true, size: 12, color: { argb: 'FF1E3A8A' } };
    cellActualTotal.numFmt = '"$"#,##0.00';

    const cellGrandTotal = ws.getCell(`L${totalRowIndex}`);
    cellGrandTotal.value = sumGrandTotal;
    cellGrandTotal.font = { bold: true, size: 12, color: { argb: 'FF1E3A8A' } };
    cellGrandTotal.numFmt = '"$"#,##0.00';

    // Bordes
    ws.eachRow((row, rowNumber) => {
      if (rowNumber >= 2) {
        row.eachCell(cell => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      }
    });

    // Generar y Guardar
    const buffer = await wb.xlsx.writeBuffer();
    const { saveAs } = await import('file-saver');
    saveAs(new Blob([buffer]), `Solicitud_Fondos_Reporte_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const generarReporteSaldosPendientes = async () => {
    try {
      setLoading(true);
      const solicitudesIds = historialFiltrado.map(h => h.id_db);
      if (solicitudesIds.length === 0) return toast.error("No hay solicitudes para reportar.");

      // 1. Obtener Partidas
      const { data: todasPartidas, error } = await supabase
        .from('partidas_fondos')
        .select('*, requisiciones(id, items, correlativo_req, status_compra)')
        .in('solicitud_id', solicitudesIds)
        .order('n_renglon', { ascending: true });

      if (error) throw error;

      // 2. Obtener Tickets directos involucrados para calcular ejecución
      const ticketIds = (todasPartidas || []).map(p => p.ticket_id).filter(Boolean);
      const ticketCodigos = (todasPartidas || []).map(p => p.codigo_ticket).filter(c => c && c.startsWith('TP-'));
      let ticketsInvolucrados = [];
      if (ticketIds.length > 0 || ticketCodigos.length > 0) {
        try {
          let query = supabase.from('tickets_directos').select('*');
          if (ticketIds.length > 0 && ticketCodigos.length > 0) {
            query = query.or(`id.in.(${ticketIds.join(',')}),codigo_control.in.(${ticketCodigos.map(c => `"${c}"`).join(',')})`);
          } else if (ticketIds.length > 0) {
            query = query.in('id', ticketIds);
          } else {
            query = query.in('codigo_control', ticketCodigos);
          }
          const { data: tData } = await query;
          if (tData) ticketsInvolucrados = tData;
        } catch (e) {
          console.error("Error fetching tickets in report:", e);
        }
      }

      // Helper para decidir si un renglón está pagado
      const isRenglonPagado = (p) => {
        if (p.status === 'ANULADO_POR_USUARIO') return true;
        if (p.pago_realizado) return true;
        
        if (p.requisicion_id && p.requisiciones) {
          return esRequisicionCompletada(p.requisiciones);
        }
        if (p.ticket_id || p.codigo_ticket?.startsWith('TP-')) {
          const tk = ticketsInvolucrados.find(t => t.id === p.ticket_id || t.codigo_control === p.codigo_ticket);
          if (tk) {
            if (tk.status === 'Pagado') return true;
            if (tk.items && tk.items.length > 0) {
              const it = tk.items.find(item =>
                (item.desc || item.descripcion || '').trim().toUpperCase() === (p.descripcion || '').trim().toUpperCase() &&
                (Number(item.cantidad_pedida || item.cant) === Number(p.cantidad))
              );
              if (it && Number(it.cantidad_pendiente) === 0) return true;
            }
          }
        }
        return false;
      };

      const printWindow = window.open('', '_blank');
      const emitDate = new Date();
      const formatDate = emitDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const formatTime = emitDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });

      let html = `
           <html>
             <head>
               <title>Reporte de Saldos Pendientes</title>
               <style>
                 @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
                 body { font-family: 'Inter', sans-serif; padding: 20px; color: #000; background: white; font-size: 11px; }
                 .page-break { page-break-after: always; margin-bottom: 50px; border-bottom: 2px dashed #eee; padding-bottom: 50px; }
                 .header-table { width: 100%; margin-bottom: 10px; }
                 .company-name { font-weight: bold; font-size: 13px; }
                 .report-meta { text-align: right; font-size: 10px; }
                 .report-title-container { text-align: center; margin: 15px 0; }
                 .report-title { font-size: 14px; font-weight: bold; text-decoration: underline; color: #b91c1c; }
                 .info-section { margin-bottom: 15px; display: flex; justify-content: space-between; border: 1px solid #eee; padding: 10px; border-radius: 5px; }
                 table.data-table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                 table.data-table th { background-color: #fef2f2 !important; -webkit-print-color-adjust: exact; padding: 6px 4px; border-top: 1px solid #000; border-bottom: 1px solid #000; text-align: left; color: #991b1b; }
                 table.data-table td { padding: 5px 4px; border-bottom: 1px solid #eee; }
                 .text-right { text-align: right !important; }
                 .text-center { text-align: center !important; }
                 .totals-section { width: 100%; margin-top: 15px; display: flex; justify-content: flex-end; }
                 .totals-box { width: 250px; border: 1px solid #000; padding: 8px; }
                 .totals-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                 .totals-row.bold { font-weight: bold; border-top: 1px solid #000; padding-top: 3px; }
                 @media print { .page-break { border-bottom: none; padding-bottom: 0; } }
               </style>
             </head>
             <body>
         `;

      let paginasAgregadas = 0;
      historialFiltrado.forEach((sol, index) => {
        // Excluimos renglones ya pagados
        const partidasPendientes = todasPartidas.filter(p => p.solicitud_id === sol.id_db && !isRenglonPagado(p));

        if (partidasPendientes.length === 0) return;

        paginasAgregadas++;
        
        const totalSolUsd = partidasPendientes.reduce((acc, p) => acc + (parseFloat(p.pu_usd) || 0) * (p.cantidad || 1), 0);
        const totalSolBs = partidasPendientes.reduce((acc, p) => acc + (parseFloat(p.pu_bs) || 0) * (p.cantidad || 1), 0);

        html += `
             <div class="page-break-container">
               <table class="header-table">
                 <tr>
                   <td>
                     <div class="company-name">TOTAL CLEAN C.A.</div>
                     <div style="font-size: 9px;">J-3036586587-0</div>
                   </td>
                   <td class="report-meta">
                     <div>Fecha : ${formatDate} ${formatTime}</div>
                     <div>Solicitud ID: ${sol.codigo_control}</div>
                   </td>
                 </tr>
               </table>

               <div class="report-title-container">
                   <div class="report-title">REPORTE DE SALDOS PENDIENTES: ${sol.codigo_control}</div>
               </div>

               <div class="info-section">
                    <div>
                      <b>Gerencia:</b> ${sol.gerencia_nombre}<br>
                      <b>Responsable:</b> ${sol.responsable_nombre}<br>
                      ${(() => {
                        const respUpper = (sol.responsable_nombre || '').toUpperCase();
                        const esHilda = respUpper.includes('HILDA') && respUpper.includes('COLINA');
                        const esJohannel = respUpper.includes('JOHANNEL');
                        return esHilda ? '<b>Contrato:</b> Mtto Mayor<br>' : esJohannel ? '<b>Contrato:</b> Excelencia Y Vacumm<br>' : '';
                      })()}
                      <b>Período Semanal:</b> ${extractPeriodoFromId(sol.codigo_control)}
                    </div>
                    <div class="text-right">
                      <b>Fecha Operativa:</b> ${new Date(sol.fecha_operativa + 'T12:00:00').toLocaleDateString('es-ES')}<br>
                      <b>Sede:</b> ${sol.sede || 'N/A'}
                    </div>
               </div>

               <table class="data-table">
                 <thead>
                   <tr>
                     <th style="width: 10%">C.COSTO</th>
                     <th style="width: 12%">CLASIF.</th>
                     <th style="width: 12%">CATEGORIA</th>
                     <th style="width: 26%">DESCRIPCIÓN</th>
                     <th style="width: 8%" class="text-center">CANT.</th>
                     <th style="width: 11%" class="text-right">P.U. USD ($)</th>
                     <th style="width: 11%" class="text-right">P.U. Bs ($)</th>
                     <th style="width: 10%" class="text-right">PENDIENTE ($)</th>
                   </tr>
                 </thead>
                 <tbody>
                   ${partidasPendientes.map(p => {
                     const unitBs = p.pu_bs || 0;
                     const unitUsd = p.pu_usd || 0;
                     const totalRenglon = (unitBs + unitUsd) * (p.cantidad || 1);
                     return `
                         <tr>
                           <td style="font-size: 8px;">${p.centro_costo || ''}</td>
                           <td style="font-size: 8px;">${p.clasificacion || ''}</td>
                           <td style="font-size: 8px;">${p.categoria || ''}</td>
                           <td style="font-size: 8.5px; line-height: 1.1;">
                             <b>${p.descripcion || ''}</b><br>
                             <span style="color: #555; font-size: 7.5px;">Benef: ${p.beneficiario || ''}</span>
                           </td>
                           <td class="text-center" style="font-size: 9px;">${p.cantidad || 1}</td>
                           <td class="text-right" style="font-size: 9.5px; font-weight: 600;">
                             ${unitUsd > 0 ? unitUsd.toLocaleString('de-DE', { minimumFractionDigits: 2 }) : '-'}
                           </td>
                           <td class="text-right" style="font-size: 9.5px; font-weight: 600;">
                             ${unitBs > 0 ? unitBs.toLocaleString('de-DE', { minimumFractionDigits: 2 }) : '-'}
                           </td>
                           <td class="text-right" style="font-size: 9.5px; font-weight: 600; color: #b91c1c;">
                             ${totalRenglon.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                           </td>
                         </tr>
                       `;
                   }).join('')}
                 </tbody>
               </table>

               <div class="totals-section">
                 <div class="totals-box">
                   <div class="totals-row"><span>Saldos Pendientes USD ($)</span> <span>$ ${totalSolUsd.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span></div>
                   <div class="totals-row"><span>Saldos Pendientes Bs ($)</span> <span>$ ${totalSolBs.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span></div>
                   <div class="totals-row bold" style="color: #b91c1c;"><span>TOTAL PENDIENTE ($)</span> <span>$ ${(totalSolBs + totalSolUsd).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span></div>
                 </div>
               </div>
             </div>
             <div class="page-break" style="margin: 30px 0;"></div>
          `;
      });

      if (paginasAgregadas === 0) {
        printWindow.close();
        toast.info("No hay saldos pendientes para los filtros actuales.");
        return;
      }

      html += `
             <script>setTimeout(() => { window.print(); }, 1000);</script>
           </body>
         </html>
         `;

      printWindow.document.write(html);
      printWindow.document.close();
    } catch (err) {
      toast.error("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- FUNCIÓN DE IMPRESIÓN LIMPIA ---
  const manejarImprimir = async (solicitud) => {
    try {
      setLoading(true);
      const targetId = solicitud.id_db || solicitud.id;
      const { data: partidas, error } = await supabase.from('partidas_fondos').select('*').eq('solicitud_id', targetId).order('n_renglon', { ascending: true });
      if (error) throw error;

      const printWindow = window.open('', '_blank');
      const emitDate = new Date();
      const formatDate = emitDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const formatTime = emitDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });

      const html = `
        <html>
          <head>
            <title>Solicitud de Fondos - ${solicitud.codigo_control}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Inter:wght@400;600;700&display=swap');
              body { 
                font-family: 'Inter', Arial, sans-serif; 
                padding: 30px; 
                color: #000; 
                background: white; 
                font-size: 12px;
                line-height: 1.4;
              }
              .header-table { 
                width: 100%; 
                margin-bottom: 20px; 
              }
              .header-table td { 
                vertical-align: top; 
                border: none; 
                padding: 0;
              }
              .company-name { 
                font-weight: bold; 
                font-size: 14px; 
              }
              .company-address { 
                font-size: 11px; 
              }
              .report-meta { 
                text-align: right; 
                font-size: 11px; 
              }
              .report-title-container {
                  text-align: center;
                  margin: 30px 0;
              }
              .report-title { 
                font-size: 16px; 
                font-weight: bold; 
                text-decoration: underline;
                margin-bottom: 5px;
              }
              .report-subtitle {
                font-size: 12px;
                font-weight: bold;
              }
              .info-section {
                 margin-bottom: 20px;
                 font-size: 12px;
                 display: flex;
                 justify-content: space-between;
              }
              table.data-table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-top: 10px; 
                font-size: 11px;
              }
              table.data-table th { 
                background-color: #e5e7eb !important; 
                -webkit-print-color-adjust: exact;
                color: #000; 
                text-align: left; 
                padding: 8px 4px; 
                font-weight: bold; 
                border-top: 1px solid #000;
                border-bottom: 1px solid #000;
              }
              table.data-table td { 
                padding: 6px 4px; 
                border-bottom: 1px dashed #ccc; 
                vertical-align: top;
              }
              .text-right { text-align: right !important; }
              .text-center { text-align: center !important; }
              .totals-section {
                width: 100%;
                margin-top: 20px;
                display: flex;
                justify-content: flex-end;
              }
              .totals-box {
                width: 300px;
                border: 1px solid #000;
                padding: 10px;
              }
              .totals-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 5px;
                font-size: 12px;
              }
              .totals-row.bold {
                font-weight: bold;
                border-top: 1px solid #000;
                padding-top: 5px;
                margin-top: 5px;
              }
              @media print { 
                body { padding: 0; } 
                table.data-table th {
                  background-color: #e5e7eb !important;
                  -webkit-print-color-adjust: exact;
                }
              }
            </style>
          </head>
          <body>
            <table class="header-table">
              <tr>
                <td>
                  <div class="company-name">TOTAL CLEAN C.A.</div>
                  <div class="company-address">J-3036586587-0<br>AV 17 LOS HATICOS LOCAL GALPONES RIESE NRO 113-250. SECTOR HATICOS MARACAIBO ZULIA ZONA POSTAL 4001</div>
                </td>
                <td class="report-meta">
                  <div>Página : 1 de 1</div>
                  <div>Fecha : ${formatDate}</div>
                  <div>Hora : ${formatTime}</div>
                </td>
              </tr>
            </table>

            <div class="report-title-container">
                <div class="report-title">SOLICITUD DE FONDOS</div>
                <div class="report-subtitle">CÓDIGO: ${solicitud.codigo_control}</div>
            </div>

            <div class="info-section">
                <div>
                    <b>Gerencia:</b> ${solicitud.gerencia_nombre}<br>
                    <b>Responsable:</b> ${solicitud.responsable_nombre}<br>
                    ${(() => {
          const respUpper = (solicitud.responsable_nombre || '').toUpperCase();
          const esHilda = respUpper.includes('HILDA') && respUpper.includes('COLINA');
          const esJohannel = respUpper.includes('JOHANNEL');
          return esHilda ? '<b>Contrato:</b> Mtto Mayor<br>' : esJohannel ? '<b>Contrato:</b> Excelencia Y Vacumm<br>' : '';
        })()}
                    <b>Período Semanal:</b> ${extractPeriodoFromId(solicitud.codigo_control)}
                </div>
                <div class="text-right">
                    <b>Fecha Operativa:</b> ${new Date(solicitud.fecha_operativa + 'T12:00:00').toLocaleDateString('es-ES')}<br>
                    <b>Sede:</b> ${solicitud.sede || 'No Especificada'}
                </div>
            </div>

            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 12%">C. COSTO</th>
                  <th style="width: 13%">CLASIF.</th>
                  <th style="width: 13%">CATEGORIA</th>
                  <th style="width: 22%">DESCRIPCIÓN</th>
                  <th style="width: 8%" class="text-center">CANT.</th>
                  <th style="width: 11%" class="text-right">P.U. USD ($)</th>
                  <th style="width: 11%" class="text-right">P.U. Bs ($)</th>
                  <th style="width: 10%" class="text-right">TOTAL ($)</th>
                </tr>
              </thead>
              <tbody>
                ${partidas.map(p => {
          const unitBs = p.pu_bs || 0;
          const unitUsd = p.pu_usd || 0;
          const totalRenglon = (unitBs + unitUsd) * (p.cantidad || 1);

          const formatMonto = (val) => {
            if (!val || val === 0) return '-';
            return val.toLocaleString('de-DE', { minimumFractionDigits: 2 });
          };

          return `
                    <tr>
                      <td>${p.centro_costo || ''}</td>
                      <td>${p.clasificacion || ''}</td>
                      <td>${p.categoria || ''}</td>
                      <td>
                        ${p.descripcion || ''}<br>
                        <span style="font-size: 10px; color: #555;">Beneficiario: ${p.beneficiario || ''}</span>
                      </td>
                      <td class="text-center">${p.cantidad || 1}</td>
                      <td class="text-right">${formatMonto(unitUsd)}</td>
                      <td class="text-right">${formatMonto(unitBs)}</td>
                      <td class="text-right">${totalRenglon.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  `;
        }).join('')}
              </tbody>
            </table>

            <div class="totals-section">
              <div class="totals-box">
                <div class="totals-row">
                  <span>Solicitado actual USD ($)</span>
                  <span>$ ${solicitud.total_usd.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="totals-row">
                  <span>Solicitado actual Bs ($)</span>
                  <span>$ ${solicitud.total_bs.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="totals-row bold">
                  <span>TOTAL SOLICITUD ($)</span>
                  <span>$ ${(solicitud.total_bs + solicitud.total_usd).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <script>setTimeout(() => { window.print(); }, 800);</script>
          </body>
        </html>
      `;
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (err) {
      toast.error("Error al generar impresión: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- CÁLCULO DE TOTALES PARA EL MODAL ---
  const sumas = useMemo(() => {
    const s = {
      bs: form.partidas.reduce((acc, p) => acc + (p.status === 'ANULADO_POR_USUARIO' ? 0 : (parseFloat(p.puBs) || 0) * (p.cant || 1)), 0),
      usd: form.partidas.reduce((acc, p) => acc + (p.status === 'ANULADO_POR_USUARIO' ? 0 : (parseFloat(p.puUsd) || 0) * (p.cant || 1)), 0),
      imprevistosBs: form.imprevistos.reduce((acc, p) => acc + (p.status === 'ANULADO_POR_USUARIO' ? 0 : (parseFloat(p.puBs) || 0) * (p.cant || 1)), 0),
      imprevistosUsd: form.imprevistos.reduce((acc, p) => acc + (p.status === 'ANULADO_POR_USUARIO' ? 0 : (parseFloat(p.puUsd) || 0) * (p.cant || 1)), 0)
    };
    return s;
  }, [form.partidas, form.imprevistos]);

  const dashEjecucion = useMemo(() => {
    const estimado = (sumas.bs + sumas.usd) + (sumas.imprevistosBs + sumas.imprevistosUsd);
    const ejecutado = form.partidas.reduce((acc, p) => acc + (p.montoReal || 0), 0) +
                      form.imprevistos.reduce((acc, p) => acc + (p.montoReal || 0), 0);
    const pendiente = form.partidas.reduce((acc, p) => acc + (p.montoPendiente || 0), 0) +
                      form.imprevistos.reduce((acc, p) => acc + (p.montoPendiente || 0), 0);

    return {
      estimado,
      ejecutado,
      pendiente,
      diferencia: estimado - ejecutado
    };
  }, [form.partidas, form.imprevistos, sumas]);

  const categoriasEjecucion = useMemo(() => {
    const categoriesMap = {};
    const todas = [...form.partidas, ...form.imprevistos];
    todas.forEach(p => {
      if (p.status === 'ANULADO_POR_USUARIO') return;
      const cat = p.cat || 'S/C';
      if (!categoriesMap[cat]) {
        categoriesMap[cat] = { estimado: 0, ejecutado: 0 };
      }
      const p_est = (parseFloat(p.puBs) || parseFloat(p.puUsd) || 0) * (parseFloat(p.cant) || 1);
      categoriesMap[cat].estimado += p_est;
      categoriesMap[cat].ejecutado += (p.montoReal || 0);
    });
    return Object.entries(categoriesMap)
      .map(([name, data]) => ({
        name,
        estimado: data.estimado,
        ejecutado: data.ejecutado,
        porcentaje: data.estimado > 0 ? Math.min(100, (data.ejecutado / data.estimado) * 100) : 0
      }))
      .filter(c => c.estimado > 0)
      .sort((a, b) => b.estimado - a.estimado)
      .slice(0, 5);
  }, [form.partidas, form.imprevistos]);

  const abrirModalAnulacion = (item) => {
    setItemParaAnular(item);
    setMotivoAnulacion("");
    setJustificacionAnulacion("");
  };

  const confirmarAnulacion = async () => {
    if (!itemParaAnular) return;
    if (!motivoAnulacion) return toast.error("Debe seleccionar un motivo.");
    if (!justificacionAnulacion || justificacionAnulacion.trim().length < 10) {
      return toast.error("La justificación debe tener al menos 10 caracteres.");
    }

    setIsAnulando(true);
    try {
      // 1. Calcular monto liberado (cantidad * P.U)
      const pu = parseFloat(itemParaAnular.puBs) || parseFloat(itemParaAnular.puUsd) || 0;
      const cant = parseFloat(itemParaAnular.cant) || 1;
      const montoLiberado = pu * cant;

      // 2. Insertar en auditoria_renglones (Intento no bloqueante)
      let auditSuccess = true;
      try {
        const { error: auditError } = await supabase
          .from('auditoria_renglones')
          .insert([{
            renglon_id: itemParaAnular.id,
            usuario: `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim() || currentUser?.correo || 'Sistema',
            fecha: new Date().toISOString(),
            motivo: `${motivoAnulacion} - Justificación: ${justificacionAnulacion}`,
            monto_liberado: montoLiberado
          }]);
  
        if (auditError) {
          console.error("Error inserting audit record:", auditError);
          auditSuccess = false;
        }
      } catch (err) {
        console.error("Exception inserting audit record:", err);
        auditSuccess = false;
      }

      // 3. Actualizar estatus en partidas_fondos
      const { error: updateError } = await supabase
        .from('partidas_fondos')
        .update({ status: 'ANULADO_POR_USUARIO' })
        .eq('id', itemParaAnular.id);

      if (updateError) throw updateError;

      // 3.1 Recalcular y actualizar totales en la cabecera (solicitudes_fondos)
      const nuevasPartidas = form.partidas.map(p => p.id === itemParaAnular.id ? { ...p, status: 'ANULADO_POR_USUARIO' } : p);
      const nuevosImprevistos = form.imprevistos.map(imp => imp.id === itemParaAnular.id ? { ...imp, status: 'ANULADO_POR_USUARIO' } : imp);

      const totalBs = nuevasPartidas.reduce((acc, p) => acc + (p.status === 'ANULADO_POR_USUARIO' ? 0 : (parseFloat(p.puBs) || 0) * (p.cant || 1)), 0) +
                      nuevosImprevistos.reduce((acc, p) => acc + (p.status === 'ANULADO_POR_USUARIO' ? 0 : (parseFloat(p.puBs) || 0) * (p.cant || 1)), 0);
      const totalUsd = nuevasPartidas.reduce((acc, p) => acc + (p.status === 'ANULADO_POR_USUARIO' ? 0 : (parseFloat(p.puUsd) || 0) * (p.cant || 1)), 0) +
                       nuevosImprevistos.reduce((acc, p) => acc + (p.status === 'ANULADO_POR_USUARIO' ? 0 : (parseFloat(p.puUsd) || 0) * (p.cant || 1)), 0);

      const { error: cabeceraError } = await supabase
        .from('solicitudes_fondos')
        .update({ total_bs: totalBs, total_usd: totalUsd })
        .eq('id', form.id_db);

      if (cabeceraError) {
        console.error("Error updating solicitudes_fondos totals on annulment:", cabeceraError);
      }

      // 4. Actualizar estado local
      const esImprevisto = form.imprevistos.some(imp => imp.id === itemParaAnular.id);

      if (esImprevisto) {
        setForm(prev => ({
          ...prev,
          imprevistos: prev.imprevistos.map(imp =>
            imp.id === itemParaAnular.id
              ? { ...imp, status: 'ANULADO_POR_USUARIO', montoReal: 0, montoPendiente: 0 }
              : imp
          )
        }));
      } else {
        setForm(prev => ({
          ...prev,
          partidas: prev.partidas.map(p =>
            p.id === itemParaAnular.id
              ? { ...p, status: 'ANULADO_POR_USUARIO', montoReal: 0, montoPendiente: 0 }
              : p
          )
        }));
      }

      if (auditSuccess) {
        toast.success("Renglón anulado con éxito (Sin Efecto).");
      } else {
        toast.success("Renglón anulado con éxito (El log de auditoría se omitió por políticas RLS).");
      }
      setItemParaAnular(null);
      await cargarTodo(); // Recargar la lista principal en segundo plano
    } catch (error) {
      toast.error("Error al anular el renglón: " + error.message);
    } finally {
      setIsAnulando(false);
    }
  };

  const finalizarSolicitudManual = async () => {
    if (!form.id_db) return toast.error("La solicitud no ha sido registrada aún.");
    const confirmar = window.confirm("¿Está seguro de que desea finalizar esta solicitud? Esto bloqueará cualquier cambio posterior (incluyendo la emisión de requisiciones).");
    if (!confirmar) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('solicitudes_fondos')
        .update({ estado: 'COMPLETADA' })
        .eq('id', form.id_db);

      if (error) throw error;

      toast.success("Solicitud finalizada con éxito.");
      setIsReadOnly(!esRrHhOAdm);
      setForm(prev => ({ ...prev, estado: 'COMPLETADA' }));
      await cargarTodo();
    } catch (err) {
      toast.error("Error al finalizar la solicitud: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const registrarOActualizar = async (keepOpen = false, overrideForm = null) => {
    if (isSaving) return;
    if (isReadOnly) {
      toast.error("No tienes permisos para modificar esta solicitud de fondos.");
      return;
    }
    setIsSaving(true);
    try {
      let finalCodigoControl = idDinamico;
      const targetForm = overrideForm || form;

      // Un renglón tiene contenido si se ha seleccionado o llenado al menos un campo significativo
      const tieneContenido = (p) => {
        return !!(
          (p.cc && p.cc.trim() !== '') ||
          (p.clasif && p.clasif.trim() !== '') ||
          (p.cat && p.cat.trim() !== '') ||
          (p.desc && p.desc.trim() !== '') ||
          (p.ben && p.ben.trim() !== '') ||
          (p.puBs && parseFloat(p.puBs) > 0) ||
          (p.puUsd && parseFloat(p.puUsd) > 0)
        );
      };

      // --- CÁLCULO MANUAL DE TOTALES PARA EVITAR DESFASE POR ASINCRONÍA ---
      const pFiltradas = targetForm.partidas.filter(tieneContenido);
      const iFiltradas = (mostrarImprevistos || targetForm.imprevistos?.length > 0)
        ? targetForm.imprevistos.filter(tieneContenido)
        : [];

      const totalBsCalc = [...pFiltradas, ...iFiltradas].reduce((acc, p) => acc + (p.status === 'ANULADO_POR_USUARIO' ? 0 : (parseFloat(p.puBs) || 0) * (parseFloat(p.cant) || 1)), 0);
      const totalUsdCalc = [...pFiltradas, ...iFiltradas].reduce((acc, p) => acc + (p.status === 'ANULADO_POR_USUARIO' ? 0 : (parseFloat(p.puUsd) || 0) * (parseFloat(p.cant) || 1)), 0);

      // --- VALIDACIÓN DE UNICIDAD SEMANAL (NO DUPLICADOS) ---
      if (!isEditing) {
        const { data: checkData } = await supabase
          .from('solicitudes_fondos')
          .select('id')
          .eq('codigo_control', idDinamico);

        if (checkData && checkData.length > 0) {
          setIsSaving(false);
          return toast.error("Ya existe una Solicitud de Fondo para esta semana. Por favor, edite la existente para evitar redundancias.");
        }
        finalCodigoControl = idDinamico;
      }

      const cabecera = {
        codigo_control: finalCodigoControl,
        fecha_operativa: targetForm.fecha,
        sede: targetForm.sede,
        gerencia_nombre: targetForm.gerencia,
        responsable_nombre: targetForm.responsable,
        total_bs: totalBsCalc,
        total_usd: totalUsdCalc,
        bloque_operativo: isEditing 
          ? targetForm.bloque_operativo 
          : (['operaciones', 'mantenimiento'].includes((targetForm.gerencia || currentUser?.departamento || '').toLowerCase())
              ? (targetForm.bloque_operativo || currentUser?.bloque_operativo || null)
              : null)
      };

      let cabeceraId;
      if (isEditing) {
        const { error: errorUpdate } = await supabase.from('solicitudes_fondos').update(cabecera).eq('id', targetForm.id_db);
        if (errorUpdate) throw errorUpdate;
        cabeceraId = targetForm.id_db;
        await supabase.from('partidas_fondos').delete().eq('solicitud_id', cabeceraId);
      } else {
        const { data: newCab, error: errorInsert } = await supabase.from('solicitudes_fondos').insert([cabecera]).select().single();
        if (errorInsert) throw errorInsert;
        cabeceraId = newCab.id;
        // Actualizamos id_db en el formulario para evitar duplicados en guardados silenciosos posteriores
        setForm(prev => ({ ...prev, id_db: newCab.id }));
      }

      // --- CORRECCIÓN: Filtramos filas completamente vacías para evitar que se guarde basura, pero permitimos guardar borradores incompletos ---
      const renglones = targetForm.partidas
        .filter(tieneContenido)
        .map((p, i) => {
          const codRef = p.codigo_ref || '';
          return {
            solicitud_id: cabeceraId,
            n_renglon: i + 1,
            centro_costo: p.cc || '',
            clasificacion: p.clasif || '',
            categoria: p.cat || '',
            cantidad: parseFloat(p.cant) || 0,
            unidad: p.uni || 'UNID',
            descripcion: p.desc || '',
            beneficiario: p.ben || '',
            pu_bs: parseFloat(p.puBs) || 0,
            pu_usd: parseFloat(p.puUsd) || 0,
            pago_realizado: p.pago_realizado || false,
            emisor_nombre: p.emisor || `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim() || 'Sistema',
            requisicion_id: p.requisicion_id || null,
            ticket_id: p.ticket_id || null,
            codigo_ticket: codRef || p.codigo_ticket || null,
            status: p.status || 'Disponible'
          };
        });

      if (mostrarImprevistos || targetForm.imprevistos?.length > 0) {
        const renglonesImprevistos = targetForm.imprevistos
          .filter(tieneContenido)
          .map((imp, i) => {
            const codRef = imp.codigo_ref || '';
            return {
              solicitud_id: cabeceraId,
              n_renglon: renglones.length + i + 1,
              centro_costo: imp.cc || 'No Aplica',
              clasificacion: (imp.clasif || 'Solicitud de ticket') + ' [*]',
              categoria: imp.cat || 'Ticket',
              cantidad: parseFloat(imp.cant) || 1,
              unidad: imp.uni || 'UND',
              descripcion: imp.desc || '',
              beneficiario: imp.ben || '',
              pu_bs: parseFloat(imp.puBs) || 0,
              pu_usd: parseFloat(imp.puUsd) || 0,
              pago_realizado: imp.pago_realizado || false,
              emisor_nombre: imp.emisor || `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim() || 'Sistema',
              requisicion_id: imp.requisicion_id || null,
              ticket_id: imp.ticket_id || null,
              codigo_ticket: codRef || imp.codigo_ticket || null,
              status: imp.status || 'Disponible'
            };
          });
        renglones.push(...renglonesImprevistos);
      }

      const { error: errorPartidas } = await supabase.from('partidas_fondos').insert(renglones);
      if (errorPartidas) throw errorPartidas;

      toast.success("¡Guardado con éxito!");
      await cargarTodo();
      setHasChanges(false);

      if (keepOpen) {
        setIsEditing(true);
        // Recargar las partidas recién insertadas de Supabase para obtener sus IDs reales y evitar duplicaciones
        const { data: dbPartidas } = await supabase
          .from('partidas_fondos')
          .select('*, requisiciones(id, correlativo_req, items, status_compra)')
          .eq('solicitud_id', cabeceraId);

        if (dbPartidas && dbPartidas.length > 0) {
          const mappedPartidas = dbPartidas.filter(p => !p.clasificacion.includes('[*]') && p.clasificacion !== 'Gastos Imprevistos' && p.clasificacion !== 'Ticket de Pago' && p.clasificacion !== 'Solicitud de ticket').map(p => ({
            id: p.id,
            cc: p.centro_costo,
            clasif: p.clasificacion,
            cat: p.categoria,
            cant: p.cantidad,
            uni: p.unidad,
            desc: p.descripcion,
            ben: p.beneficiario,
            puBs: p.pu_bs,
            puUsd: p.pu_usd,
            pago_realizado: p.pago_realizado || false,
            emisor: p.emisor_nombre || 'S/E',
            requisicion_id: p.requisicion_id || null,
            ticket_id: p.ticket_id || null,
            codigo_ticket: (p.codigo_ticket?.startsWith('RR-') && !p.requisicion_id) ? null : (p.codigo_ticket || null),
            codigo_ref: (p.codigo_ticket?.startsWith('RR-') && !p.requisicion_id) ? null : (p.codigo_ticket || p.requisiciones?.correlativo_req || null),
            status: (p.status === 'Bloqueado' && !p.requisicion_id) ? 'Disponible' : (p.status || 'Disponible'),
            selected: false,
            montoReal: 0,
            montoPendiente: (p.pu_bs || p.pu_usd || 0) * (p.cantidad || 1),
            requisiciones: p.requisicion_id ? (p.requisiciones || null) : null
          }));

          const mappedImprevistos = dbPartidas.filter(p => p.clasificacion.includes('[*]') || p.clasificacion === 'Gastos Imprevistos' || p.clasificacion === 'Ticket de Pago' || p.clasificacion === 'Solicitud de ticket').map(p => ({
            id: p.id,
            cc: p.centro_costo,
            clasif: p.clasificacion.replace(' [*]', ''),
            cat: p.categoria,
            cant: p.cantidad,
            uni: p.unidad,
            desc: p.descripcion,
            ben: p.beneficiario,
            puBs: p.pu_bs,
            puUsd: p.pu_usd,
            pago_realizado: p.pago_realizado || false,
            emisor: p.emisor_nombre || 'S/E',
            requisicion_id: p.requisicion_id || null,
            ticket_id: p.ticket_id || null,
            codigo_ticket: (p.codigo_ticket?.startsWith('RR-') && !p.requisicion_id) ? null : (p.codigo_ticket || null),
            codigo_ref: (p.codigo_ticket?.startsWith('RR-') && !p.requisicion_id) ? null : (p.codigo_ticket || p.requisiciones?.correlativo_req || null),
            status: (p.status === 'Bloqueado' && !p.requisicion_id) ? 'Disponible' : (p.status || 'Disponible'),
            selected: false,
            montoReal: 0,
            montoPendiente: (p.pu_bs || p.pu_usd || 0) * (p.cantidad || 1),
            requisiciones: p.requisicion_id ? (p.requisiciones || null) : null
          }));

          setForm(prev => ({
            ...prev,
            id_db: cabeceraId,
            partidas: mappedPartidas.length > 0 ? mappedPartidas : prev.partidas,
            imprevistos: mappedImprevistos.length > 0 ? mappedImprevistos : prev.imprevistos
          }));
        }
      } else {
        setShowModal(false);
      }
    } catch (err) {
      toast.error("Error al registrar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequisicionFinalizada = (nuevaReqId, idsPartidas, codigoControl) => {
    // Actualizar estado local para evitar recarga
    const actualizarLista = (lista) => lista.map(p =>
      idsPartidas.includes(p.id) ? { ...p, status: 'Bloqueado', requisicion_id: nuevaReqId, codigo_ref: codigoControl, selected: false } : p
    );

    const nextState = {
      ...form,
      partidas: actualizarLista(form.partidas),
      imprevistos: actualizarLista(form.imprevistos)
    };

    setForm(nextState);

    // GUARDADO AUTOMÁTICO AL CREAR REQUISICIÓN sin cerrar modal (Usando el estado fresco)
    registrarOActualizar(true, nextState);
  };

  const handleTicketFinalizado = (nuevoTicketId, idsPartidas, codigoControl) => {
    const actualizarLista = (lista) => lista.map(p =>
      idsPartidas.includes(p.id) ? { ...p, status: 'Bloqueado', ticket_id: nuevoTicketId, codigo_ref: codigoControl, selected: false } : p
    );

    const nextState = {
      ...form,
      partidas: actualizarLista(form.partidas),
      imprevistos: actualizarLista(form.imprevistos)
    };

    setForm(nextState);

    registrarOActualizar(true, nextState);
  };

  const handleCrearRequisicion = () => {
    const seleccionadas = form.partidas.filter(p => p.selected);
    if (seleccionadas.length === 0) return toast.error("Selecciona al menos una partida");

    // VALIDACIÓN ESTRICTA EN EJECUCIÓN (Centros y Clasificaciones)
    const centros = [...new Set(seleccionadas.map(f => f.cc))];
    const clases = [...new Set(seleccionadas.map(f => f.clasif))];

    if (centros.length > 1 || clases.length > 1) {
      toast.error("Error: Las filas deben tener el mismo Centro de Costo y Clasificación para generar una requisición.");
      return;
    }

    // VALIDACIÓN DE CAMPOS OBLIGATORIOS
    const incompletas = seleccionadas.some(p => !p.cc || !p.clasif || !p.cat || !p.cant || !p.uni || !p.desc);
    if (incompletas) {
      return toast.error("Error: Las filas seleccionadas deben tener Centro de Costo, Clasificación, Categoría, Cantidad, Unidad y Descripción.");
    }

    // ADVERTENCIA DE CATEGORÍAS
    const cats = [...new Set(seleccionadas.map(f => f.cat))];
    if (cats.length > 1) {
      toast((t) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '500' }}>¿Está seguro de guardar filas con diferentes categorías?</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => { toast.dismiss(t.id); ejecutarCrearRequisicion(seleccionadas); }}
              style={{ padding: '4px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
            >
              SÍ, CONTINUAR
            </button>
            <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>CANCELAR</button>
          </div>
        </div>
      ), { duration: 6000, position: 'top-center' });
      return;
    }

    ejecutarCrearRequisicion(seleccionadas);
  };

  const ejecutarCrearRequisicion = (seleccionadas) => {
    setDataParaReq({
      id_control: idDinamico, responsable: form.responsable, gerencia: form.gerencia,
      centro_costo: seleccionadas[0].cc, origen_proceso: `Generado desde Fondos: ${idDinamico}`,
      justificacion: "", partidasSeleccionadas: seleccionadas.map(p => ({
        ...p,
        ben: p.ben
      }))
    });
    setAbrirReq(true);
  };

  const handleClicCodigoRef = async (codigoRef) => {
    if (!codigoRef) return;

    if (codigoRef.startsWith('RR-')) {
      try {
        const { data, error } = await supabase
          .from('requisiciones')
          .select('*')
          .eq('correlativo_req', codigoRef)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          toast.error(`No se encontró la requisición ${codigoRef}`);
          return;
        }
        const mappedReq = {
          id: data.id,
          correlativo: data.correlativo_req || `REQ-${String(data.id).padStart(3, '0')}`,
          origen: data.origen || 'Manual',
          solicitante: data.solicitante,
          centroCosto: data.centro_costo,
          aprobacion: data.aprobacion_nombre || (data.aprobacion ? 'Aprobado' : 'Pendiente'),
          status: data.status_compra || 'Pendiente',
          prioridad: data.prioridad || 'Normal',
          total: Number(data.total_bs) || 0,
          detalles: data.items,
          fecha: data.fecha_emision ? data.fecha_emision.split('T')[0] : '',
          justificacion: data.justificacion,
          fecha_requerida: data.fecha_requerida,
          gerencia: data.gerencia,
          aprobado_gerente_area: data.aprobado_gerente_area || false,
          aprobado_gerente_general: data.aprobado_gerente_general || false,
          aprobado_gerente_proyecto: data.aprobado_gerente_proyecto || false,
          estado_aprobacion: data.estado_aprobacion || 'pendiente_area',
          motivo_rechazo: data.motivo_rechazo || '',
          firma_gerente_general: data.firma_gerente_general,
          observaciones: data.observaciones || '',
          observaciones_direccion: data.observaciones_direccion || '',
          facturas_url: data.facturas_url || [],
          id_referencia_proyecto: data.id_referencia_proyecto || '',
          user_id: data.user_id,
          fecha_emision: data.fecha_emision,
          f_aprobacion_proyecto: data.f_aprobacion_proyecto,
          n_aprobacion_proyecto: data.n_aprobacion_proyecto,
          f_aprobacion_area: data.f_aprobacion_area,
          con_iva: data.con_iva
        };
        setDataParaReq({
          isExistingRequisition: true,
          req: mappedReq
        });
        setAbrirReq(true);
      } catch (err) {
        toast.error("Error al buscar requisición: " + err.message);
      }
    } else if (codigoRef.startsWith('TP-')) {
      try {
        const { data, error } = await supabase
          .from('tickets_directos')
          .select('*')
          .eq('codigo_control', codigoRef)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          toast.error(`No se encontró el ticket ${codigoRef}`);
          return;
        }
        setDataParaTicket({
          isExistingTicket: true,
          ticket: data
        });
        setAbrirTicketModal(true);
      } catch (err) {
        toast.error("Error al buscar ticket: " + err.message);
      }
    }
  };

  const handleEmitirTicketFromImprevisto = () => {
    const seleccionados = form.imprevistos.filter(i => i.selected);
    if (seleccionados.length === 0) return toast.error("Selecciona al menos un imprevisto");

    // VALIDACIÓN DE CC ÚNICO PARA TICKET DE PAGO
    const ccsUnicos = [...new Set(seleccionados.map(s => s.cc).filter(cc => cc))];
    if (ccsUnicos.length > 1) {
      return toast.error("No se pueden mezclar Centros de Costos en un mismo Ticket de Pago. Por favor, genere un ticket por separado.");
    }

    // VALIDACIÓN DE CAMPOS OBLIGATORIOS
    const incompletos = seleccionados.some(imp => !imp.cc || !imp.clasif || !imp.cat || !imp.cant || !imp.uni || !imp.desc);
    if (incompletos) {
      return toast.error("Error: Las filas seleccionadas deben tener Centro de Costo, Clasificación, Categoría, Cantidad, Unidad y Descripción.");
    }

    setDataParaTicket({
      fecha: form.fecha,
      gerencia: form.gerencia,
      solicitante: form.responsable,
      solicitud_ref: idDinamico,
      prioridad: form.prioridad || 'Normal',
      partidasSeleccionadas: seleccionados.map(imp => ({
        id: imp.id,
        cc: imp.cc,
        clasificacion: imp.clasif ? imp.clasif.replace(' [*]', '') : '',
        categoria: imp.cat,
        cantidad: (imp.cant !== undefined && imp.cant !== '') ? Number(imp.cant) : 1,
        unidad: imp.uni || 'UNID',
        descripcion: imp.desc || '',
        beneficiario: imp.ben || '',
        puUsd: Number(imp.puUsd) || 0,
        puBs: Number(imp.puBs) || 0
      }))
    });
    setAbrirTicketModal(true);
  };

  // --- ARRAYS FILTRADOS PARA LA TABLA DEL MODAL ---
  const partidasFiltradas = useMemo(() => {
    return form.partidas.map((p, idx) => ({ ...p, originalIndex: idx })).filter(p => {
      const matchEmisor = filtroPartidaEmisor === 'Todos' || (p.emisor || '---') === filtroPartidaEmisor;
      const matchCategoria = filtroPartidaCategoria === 'Todos' || p.cat === filtroPartidaCategoria;
      const matchClasif = filtroPartidaClasificacion === 'Todos' || p.clasif === filtroPartidaClasificacion;

      let matchEstadoId = true;
      if (filtroPartidaEstadoId === 'Comprados') {
        matchEstadoId = !!p.codigo_ref && p.isReqCompletada === true;
      } else if (filtroPartidaEstadoId === 'EnRequisicion') {
        matchEstadoId = !!p.codigo_ref && p.isReqCompletada !== true;
      } else if (filtroPartidaEstadoId === 'SinID') {
        matchEstadoId = !p.codigo_ref;
      }

      return matchEmisor && matchCategoria && matchClasif && matchEstadoId;
    });
  }, [form.partidas, filtroPartidaEmisor, filtroPartidaCategoria, filtroPartidaClasificacion, filtroPartidaEstadoId]);

  const imprevistosFiltrados = useMemo(() => {
    return form.imprevistos.map((imp, idx) => ({ ...imp, originalIndex: idx })).filter(imp => {
      const matchEmisor = filtroPartidaEmisor === 'Todos' || (imp.emisor || '---') === filtroPartidaEmisor;
      const matchCategoria = filtroPartidaCategoria === 'Todos' || imp.cat === filtroPartidaCategoria;
      const matchClasif = filtroPartidaClasificacion === 'Todos' || imp.clasif === filtroPartidaClasificacion;

      let matchEstadoId = true;
      if (filtroPartidaEstadoId === 'Comprados') {
        matchEstadoId = !!imp.codigo_ref && imp.isReqCompletada === true;
      } else if (filtroPartidaEstadoId === 'EnRequisicion') {
        matchEstadoId = !!imp.codigo_ref && imp.isReqCompletada !== true;
      } else if (filtroPartidaEstadoId === 'SinID') {
        matchEstadoId = !imp.codigo_ref;
      }

      return matchEmisor && matchCategoria && matchClasif && matchEstadoId;
    });
  }, [form.imprevistos, filtroPartidaEmisor, filtroPartidaCategoria, filtroPartidaClasificacion, filtroPartidaEstadoId]);

  const clasificacionesPorCC = useMemo(() => {
    const map = {};
    centrosCosto.forEach(cc => {
      map[cc.nombre] = todasClasificaciones.filter(cl => cl.padreId === cc.id);
    });
    return map;
  }, [centrosCosto, todasClasificaciones]);

  const clObjMap = useMemo(() => {
    const map = {};
    todasClasificaciones.forEach(cl => {
      const cc = centrosCosto.find(c => c.id === cl.padreId);
      if (cc) {
        map[`${cc.nombre}_${cl.nombre}`] = cl;
      }
    });
    return map;
  }, [centrosCosto, todasClasificaciones]);

  const categoriasPorClasif = useMemo(() => {
    const map = {};
    todasClasificaciones.forEach(cl => {
      map[cl.id] = todasCategorias.filter(ct => ct.padreId === cl.id);
    });
    return map;
  }, [todasClasificaciones, todasCategorias]);


  const listaEmisoresUnicos = useMemo(() => {
    const todos = [
      ...form.partidas.map(p => p.emisor || '---'),
      ...form.imprevistos.map(imp => imp.emisor || '---')
    ];
    return [...new Set(todos)].filter(x => x && x !== '---').sort();
  }, [form.partidas, form.imprevistos]);

  const listaCategoriasUnicas = useMemo(() => {
    const todos = [
      ...form.partidas.map(p => p.cat),
      ...form.imprevistos.map(imp => imp.cat)
    ];
    return [...new Set(todos)].filter(Boolean).sort();
  }, [form.partidas, form.imprevistos]);

  const listaClasificacionesUnicas = useMemo(() => {
    const todos = [
      ...form.partidas.map(p => p.clasif),
      ...form.imprevistos.map(imp => imp.clasif)
    ];
    return [...new Set(todos)].filter(Boolean).sort();
  }, [form.partidas, form.imprevistos]);

  return (
    <div style={{ padding: '25px', backgroundColor: '#f1f5f9', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>

      {/* --- ENCABECERA UNIFICADA PREMIUM --- */}
      <div style={{
        borderLeft: '6px solid #0ea5e9',
        paddingLeft: '16px',
        marginBottom: '30px'
      }}>
        <h1 style={{ margin: 0, color: '#0f172a', fontSize: '1.8rem', fontWeight: '900', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.5px' }}>
          Solicitud de Fondos
        </h1>
        <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem', fontWeight: '500', fontFamily: 'Inter, sans-serif' }}>
          Gestión y control de solicitudes de fondos
        </p>
      </div>

      {/* --- DASHBOARD Y ACCIONES DE SOLICITUD DE FONDOS --- */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px',
        marginBottom: '32px'
      }}>
        {/* KPI Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(200px, 1fr))',
          gap: '15px',
          flex: 1
        }}>
          {[
            { label: 'Total Solicitado', val: `$ ${totalesVisibles.solicitado.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`, icon: <DollarSign size={20} />, col: '#0284c7', bg: '#e0f2fe' },
            { label: 'Total Pagado (Gasto Acumulado)', val: `$ ${totalesVisibles.pagado.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`, icon: <DollarSign size={20} />, col: '#16a34a', bg: '#dcfce7' },
            { label: 'Saldo Pendiente', val: `$ ${totalesVisibles.pendiente.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`, icon: <DollarSign size={20} />, col: '#ea580c', bg: '#ffedd5' }
          ].map((x, i) => (
            <div
              key={i}
              style={{
                background: 'white',
                padding: '20px 24px',
                borderRadius: '24px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '15px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
            >
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '14px',
                backgroundColor: x.bg,
                color: x.col,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {x.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {x.label}
                </label>
                <h3 style={{ margin: '2px 0 0 0', fontSize: '1.25rem', fontWeight: '900', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {x.val}
                </h3>
              </div>
              <div style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <ChevronDown size={14} />
              </div>
            </div>
          ))}
        </div>

        {/* Botones de acción */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={exportarExcel}
            style={{ padding: '12px 20px', backgroundColor: '#166534', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px rgba(22, 101, 52, 0.2)' }}
          >
            <FileSpreadsheet size={18} /> Resumen General
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={async () => {
              try {
                setLoading(true);
                const solicitudesIds = historialFiltrado.map(h => h.id_db);
                if (solicitudesIds.length === 0) return toast.error("No hay solicitudes para reportar.");

                const { data: todasPartidas, error } = await supabase
                  .from('partidas_fondos')
                  .select('*')
                  .in('solicitud_id', solicitudesIds)
                  .order('n_renglon', { ascending: true });

                if (error) throw error;

                const printWindow = window.open('', '_blank');
                const emitDate = new Date();
                const formatDate = emitDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const formatTime = emitDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });

                let html = `
                     <html>
                       <head>
                         <title>Reporte Global de Solicitudes</title>
                         <style>
                           @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
                           body { font-family: 'Inter', sans-serif; padding: 20px; color: #000; background: white; font-size: 11px; }
                           .page-break { page-break-after: always; margin-bottom: 50px; border-bottom: 2px dashed #eee; padding-bottom: 50px; }
                           .header-table { width: 100%; margin-bottom: 10px; }
                           .company-name { font-weight: bold; font-size: 13px; }
                           .report-meta { text-align: right; font-size: 10px; }
                           .report-title-container { text-align: center; margin: 15px 0; }
                           .report-title { font-size: 14px; font-weight: bold; text-decoration: underline; }
                           .info-section { margin-bottom: 15px; display: flex; justify-content: space-between; border: 1px solid #eee; padding: 10px; border-radius: 5px; }
                           table.data-table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                           table.data-table th { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; padding: 6px 4px; border-top: 1px solid #000; border-bottom: 1px solid #000; text-align: left; }
                           table.data-table td { padding: 5px 4px; border-bottom: 1px solid #eee; }
                           .text-right { text-align: right !important; }
                           .text-center { text-align: center !important; }
                           .totals-section { width: 100%; margin-top: 15px; display: flex; justify-content: flex-end; }
                           .totals-box { width: 250px; border: 1px solid #000; padding: 8px; }
                           .totals-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                           .totals-row.bold { font-weight: bold; border-top: 1px solid #000; padding-top: 3px; }
                           @media print { .page-break { border-bottom: none; padding-bottom: 0; } }
                         </style>
                       </head>
                       <body>
                   `;

                historialFiltrado.forEach((sol, index) => {
                  const partidas = todasPartidas.filter(p => p.solicitud_id === sol.id_db);
                  html += `
                       <div class="${index < historialFiltrado.length - 1 ? 'page-break' : ''}">
                         <table class="header-table">
                           <tr>
                             <td>
                               <div class="company-name">TOTAL CLEAN C.A.</div>
                               <div style="font-size: 9px;">J-3036586587-0</div>
                             </td>
                             <td class="report-meta">
                               <div>Fecha : ${formatDate} ${formatTime}</div>
                               <div>Solicitud ${index + 1} de ${historialFiltrado.length}</div>
                             </td>
                           </tr>
                         </table>

                         <div class="report-title-container">
                             <div class="report-title">SOLICITUD DE FONDOS: ${sol.codigo_control}</div>
                         </div>

                         <div class="info-section">
                              <div>
                                <b>Gerencia:</b> ${sol.gerencia_nombre}<br>
                                <b>Responsable:</b> ${sol.responsable_nombre}<br>
                                ${(() => {
                      const respUpper = (sol.responsable_nombre || '').toUpperCase();
                      const esHilda = respUpper.includes('HILDA') && respUpper.includes('COLINA');
                      const esJohannel = respUpper.includes('JOHANNEL');
                      return esHilda ? '<b>Contrato:</b> Mtto Mayor<br>' : esJohannel ? '<b>Contrato:</b> Excelencia Y Vacumm<br>' : '';
                    })()}
                                <b>Período Semanal:</b> ${extractPeriodoFromId(sol.codigo_control)}
                              </div>
                              <div class="text-right">
                                <b>Fecha Operativa:</b> ${new Date(sol.fecha_operativa + 'T12:00:00').toLocaleDateString('es-ES')}<br>
                                <b>Sede:</b> ${sol.sede || 'N/A'}
                              </div>
                          </div>

                          <table class="data-table">
                            <thead>
                              <tr>
                                <th style="width: 10%">C.COSTO</th>
                                <th style="width: 12%">CLASIF.</th>
                                <th style="width: 12%">CATEGORIA</th>
                                <th style="width: 26%">DESCRIPCIÓN</th>
                                <th style="width: 8%" class="text-center">CANT.</th>
                                <th style="width: 11%" class="text-right">P.U. USD ($)</th>
                                <th style="width: 11%" class="text-right">P.U. Bs ($)</th>
                                <th style="width: 10%" class="text-right">TOTAL ($)</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${partidas.map(p => {
                      const unitBs = p.pu_bs || 0;
                      const unitUsd = p.pu_usd || 0;
                      const totalRenglon = (unitBs + unitUsd) * (p.cantidad || 1);
                      return `
                                  <tr>
                                    <td style="font-size: 8px;">${p.centro_costo || ''}</td>
                                    <td style="font-size: 8px;">${p.clasificacion || ''}</td>
                                    <td style="font-size: 8px;">${p.categoria || ''}</td>
                                    <td style="font-size: 8.5px; line-height: 1.1;">
                                      <b>${p.descripcion || ''}</b><br>
                                      <span style="color: #555; font-size: 7.5px;">Benef: ${p.beneficiario || ''}</span>
                                    </td>
                                    <td class="text-center" style="font-size: 9px;">${p.cantidad || 1}</td>
                                    <td class="text-right" style="font-size: 9.5px; font-weight: 600;">
                                      ${unitUsd > 0 ? unitUsd.toLocaleString('de-DE', { minimumFractionDigits: 2 }) : '-'}
                                    </td>
                                    <td class="text-right" style="font-size: 9.5px; font-weight: 600;">
                                      ${unitBs > 0 ? unitBs.toLocaleString('de-DE', { minimumFractionDigits: 2 }) : '-'}
                                    </td>
                                    <td class="text-right" style="font-size: 9.5px; font-weight: 600;">
                                      ${totalRenglon.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                `;
                    }).join('')}
                            </tbody>
                          </table>

                          <div class="totals-section">
                            <div class="totals-box">
                              <div class="totals-row"><span>Solicitado actual USD ($)</span> <span>$ ${sol.total_usd.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span></div>
                              <div class="totals-row"><span>Solicitado actual Bs ($)</span> <span>$ ${sol.total_bs.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span></div>
                              <div class="totals-row bold"><span>TOTAL ($)</span> <span>$ ${(sol.total_bs + sol.total_usd).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span></div>
                            </div>
                          </div>
                        </div>
                     `;
                });

                html += `
                       <script>setTimeout(() => { window.print(); }, 1000);</script>
                     </body>
                   </html>
                   `;

                printWindow.document.write(html);
                printWindow.document.close();
              } catch (err) {
                toast.error("Error: " + err.message);
              } finally {
                setLoading(false);
              }
            }}
            style={{ padding: '12px 20px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px rgba(15, 23, 42, 0.2)' }}
          >
            <Printer size={18} /> Reporte Detallado
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={generarReporteSaldosPendientes}
            style={{ padding: '12px 20px', backgroundColor: '#991b1b', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px rgba(153, 27, 27, 0.2)' }}
          >
            <Printer size={18} /> Reporte de Saldos Pendientes
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setIsEditing(false);
              setCcPreVal('');
              setFechaPreVal(new Date().toISOString().split('T')[0]);
              setErrorCheck('');
              setSolCheckExitosa(false);
              setShowPreVal(true);
            }}
            style={{ padding: '12px 25px', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(14, 165, 233, 0.2)' }}
          >
            + Nueva Solicitud
          </motion.button>
        </div>
      </div>

      {/* TABLA DE HISTORIAL */}

      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>


        {/* BARRA DE FILTROS AL ESTILO REQUISICIONES */}
        <div style={{
          display: 'flex',
          gap: '15px',
          backgroundColor: '#f8fafc',
          padding: '12px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          marginBottom: '20px'
        }}>
          <div style={{ flex: 1.5, position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔍</span>
            <input
              type="text"
              placeholder="Buscar por ID o Responsable..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ width: '100%', padding: '10px 15px 10px 35px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>

          <select
            value={filtroGerencia}
            onChange={(e) => setFiltroGerencia(e.target.value)}
            style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px', backgroundColor: 'white' }}
          >
            <option value="Todos">Todas las Gerencias (Siglas)</option>
            {(() => {
              const totalMapeo = { ...mappingGerenciasDropdown };
              gerenciasBaseDatos.forEach(g => {
                if (g.abreviatura && g.nombre) {
                  totalMapeo[g.abreviatura] = g.nombre;
                }
              });
              return Object.entries(totalMapeo).map(([sigla, nombre]) => (
                <option key={sigla} value={sigla}>{sigla} - {nombre}</option>
              ));
            })()}
          </select>

          <select
            value={filtroMes}
            onChange={(e) => handleMonthChange(e.target.value)}
            style={{ flex: 0.8, padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px', backgroundColor: 'white' }}
          >
            <option value="">Mes (Todos)</option>
            {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((m, i) => (
              <option key={i} value={i.toString()}>{m}</option>
            ))}
          </select>

          <select
            value={filtroSemana}
            onChange={(e) => {
              setFiltroSemana(e.target.value);
              if (e.target.value !== "") {
                setQuickFilter("Todos");
              }
            }}
            style={{ flex: 1.2, padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px', backgroundColor: 'white' }}
          >
            <option value="">Semana (Todas)</option>
            {getWeeksForMonth(filtroMes, 2026).map(w => {
              const semValue = w.weekNum.padStart(2, '0');
              return <option key={w.weekNum} value={semValue}>{w.label}</option>;
            })}
          </select>

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            style={{ flex: 1.2, padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px', backgroundColor: 'white' }}
          >
            <option value="Todos">Todos los Estados</option>
            <option value="Pendientes">Pendientes (Procura/Pago)</option>
            <option value="Culminadas">Compradas / Culminadas</option>
          </select>
        </div>

        {/* PILLS DE FILTRADO ESTRATÉGICO RÁPIDO */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setQuickFilter("Todos")}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: quickFilter === "Todos" ? '2px solid #3b82f6' : '1px solid #cbd5e1',
              backgroundColor: quickFilter === "Todos" ? '#eff6ff' : 'white',
              color: quickFilter === "Todos" ? '#1e40af' : '#475569',
              fontWeight: 'bold',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
              boxShadow: quickFilter === "Todos" ? '0 2px 6px rgba(59, 130, 246, 0.15)' : 'none'
            }}
          >
            📁 Todos <span style={{
              backgroundColor: quickFilter === "Todos" ? '#3b82f6' : '#f1f5f9',
              color: quickFilter === "Todos" ? 'white' : '#475569',
              padding: '1px 6px',
              borderRadius: '8px',
              fontSize: '10px',
              fontWeight: '800'
            }}>{counts.todos}</span>
          </button>

          <button
            onClick={() => {
              setQuickFilter("Activas");
              setFiltroSemana(""); // Clear week dropdown so they don't conflict
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: quickFilter === "Activas" ? '2px solid #10b981' : '1px solid #cbd5e1',
              backgroundColor: quickFilter === "Activas" ? '#ecfdf5' : 'white',
              color: quickFilter === "Activas" ? '#065f46' : '#475569',
              fontWeight: 'bold',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
              boxShadow: quickFilter === "Activas" ? '0 2px 6px rgba(16, 185, 129, 0.15)' : 'none'
            }}
          >
            📅 Activas (Semana Actual) <span style={{
              backgroundColor: quickFilter === "Activas" ? '#10b981' : '#f1f5f9',
              color: quickFilter === "Activas" ? 'white' : '#475569',
              padding: '1px 6px',
              borderRadius: '8px',
              fontSize: '10px',
              fontWeight: '800'
            }}>{counts.activas}</span>
          </button>

          <button
            onClick={() => {
              setQuickFilter("EnProceso");
              setFiltroSemana(""); // Clear week dropdown so they don't conflict
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: quickFilter === "EnProceso" ? '2px solid #f59e0b' : '1px solid #cbd5e1',
              backgroundColor: quickFilter === "EnProceso" ? '#fef3c7' : 'white',
              color: quickFilter === "EnProceso" ? '#b45309' : '#475569',
              fontWeight: 'bold',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
              boxShadow: quickFilter === "EnProceso" ? '0 2px 6px rgba(245, 158, 11, 0.15)' : 'none'
            }}
          >
            🚚 Ejecución Logística (En Proceso) <span style={{
              backgroundColor: quickFilter === "EnProceso" ? '#f59e0b' : '#f1f5f9',
              color: quickFilter === "EnProceso" ? 'white' : '#475569',
              padding: '1px 6px',
              borderRadius: '8px',
              fontSize: '10px',
              fontWeight: '800'
            }}>{counts.enProceso}</span>
          </button>

          <button
            onClick={() => {
              setQuickFilter("Completadas");
              setFiltroSemana(""); // Clear week dropdown so they don't conflict
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: quickFilter === "Completadas" ? '2px solid #0ea5e9' : '1px solid #cbd5e1',
              backgroundColor: quickFilter === "Completadas" ? '#e0f2fe' : 'white',
              color: quickFilter === "Completadas" ? '#0369a1' : '#475569',
              fontWeight: 'bold',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
              boxShadow: quickFilter === "Completadas" ? '0 2px 6px rgba(14, 165, 233, 0.15)' : 'none'
            }}
          >
            ✅ Completadas <span style={{
              backgroundColor: quickFilter === "Completadas" ? '#0ea5e9' : '#f1f5f9',
              color: quickFilter === "Completadas" ? 'white' : '#475569',
              padding: '1px 6px',
              borderRadius: '8px',
              fontSize: '10px',
              fontWeight: '800'
            }}>{counts.completadas}</span>
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontSize: '0.75rem' }}>
              <th style={{ padding: '15px', width: '16%' }}>ID CONTROL</th>
              <th style={{ width: '15%' }}>SEMANA / PERÍODO</th>
              <th style={{ width: '25%' }}>RESPONSABLE / GERENCIA</th>
              <th style={{ width: '12%', textAlign: 'right' }}>SOLICITADO ACTUAL $/$</th>
              <th style={{ width: '14%', textAlign: 'right' }}>SOLICITADO ACTUAL BS/$</th>
              <th style={{ width: '10%', textAlign: 'right' }}>TOTAL ($)</th>
              <th style={{ width: '8%', textAlign: 'center' }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Cargando registros...</td></tr>
            ) : historialFiltrado.map((h, i) => (
              <tr key={h.id} style={{ borderBottom: '1px solid #f8fafc', fontSize: '0.80rem', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                <td data-label="ID CONTROL" style={{ padding: '12px' }}>
                  <motion.span
                    whileHover={{
                      scale: 1.1,
                      x: 5,
                      color: '#2563eb',
                      textShadow: '0 0 8px rgba(37, 99, 235, 0.2)'
                    }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                    onClick={() => cargarDetallesYEditar(h)}
                    style={{
                      fontSize: '12px',
                      fontWeight: '900',
                      color: '#1e40af',
                      textDecoration: 'underline',
                      textUnderlineOffset: '3px',
                      textDecorationColor: 'rgba(30, 64, 175, 0.4)',
                      cursor: 'pointer',
                      display: 'inline-block'
                    }}
                  >
                    {h.id}
                  </motion.span>
                </td>
                <td data-label="SEMANA" style={{ fontWeight: 'bold', color: '#64748b' }}>
                  <div>SEM {getWeek(new Date(h.fecha_operativa + 'T12:00:00'), { weekStartsOn: 1 })}</div>
                  <div style={{ fontSize: '0.7rem', color: '#0ea5e9', marginTop: '3px' }}>{extractPeriodoFromId(h.id)}</div>
                </td>
                <td data-label="RESPONSABLE">
                  <div style={{ fontWeight: '500' }}>{formatName(h.responsable)}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{h.gerencia}</div>
                </td>
                <td data-label="SOLICITADO ACTUAL USD" style={{ color: '#15803d', fontWeight: '600' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '10px' }}>
                    <span>$</span>
                    <span>{parseFloat(h.total_usd || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </td>
                <td data-label="SOLICITADO ACTUAL BS" style={{ color: '#b45309', fontWeight: '600' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '10px' }}>
                    <span>$</span>
                    <span>{parseFloat(h.total_bs || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </td>
                <td data-label="TOTAL" style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>$</span>
                    <span>{h.total.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </td>
                <td data-label="ACCIONES" style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', alignItems: 'center' }}>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        manejarImprimir(h);
                      }}
                      style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                      title="Imprimir Solicitud"
                    >
                      <Printer size={18} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        cargarDetallesYEditar(h);
                      }}
                      style={{ color: '#0ea5e9', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}
                    >

                    </button>
                    {currentUser?.correo?.toLowerCase() === 'jcontreras.totalclean@gmail.com' && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          eliminarSolicitud(h.id_db);
                        }}
                        style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                        title="Eliminar Solicitud"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {historialFiltrado.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No se encontraron resultados para "{busqueda}"</div>
        )}
      </div>

      {/* MODAL DE REGISTRO */}
      {showModal && (
        <div className="sf-modal-overlay">
          <div className="sf-modal-container" style={{
            width: '95vw',
            maxWidth: '1600px',
            height: '95vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: 0,
            borderRadius: '24px',
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(30px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)'
          }}>
            {/* --- CABECERA FIJA --- */}
            <div style={{ flexShrink: 0, padding: '25px 35px', borderBottom: '1px solid rgba(226, 232, 240, 0.5)', backgroundColor: 'rgba(255, 255, 255, 0.3)', position: 'relative' }}>
              <button
                onClick={intentarCerrarModal}
                style={{
                  position: 'absolute',
                  top: '20px',
                  right: '25px',
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '12px',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b',
                  transition: 'all 0.2s',
                  zIndex: 10
                }}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
              >
                <X size={20} />
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#0369a1', fontWeight: '800', backgroundColor: '#e0f2fe', padding: '4px 12px', borderRadius: '20px', letterSpacing: 'normal', display: 'inline-block', marginBottom: '6px' }}>
                    📅 Período: {periodoSemana}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '950', color: '#0f172a', letterSpacing: '-0.5px' }}>
                      {isEditing ? 'Solicitud de Fondos' : 'Registro de Fondos'}
                    </h1>
                    <div style={{
                      backgroundColor: estadoActual === 'COMPLETADA' ? '#10b981' : estadoActual === 'EN PROCESO' ? '#f59e0b' : '#0ea5e9',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '8px',
                      fontSize: '10px',
                      fontWeight: '800',
                      letterSpacing: '0.02em',
                      boxShadow: estadoActual === 'COMPLETADA'
                        ? '0 2px 4px rgba(16, 185, 129, 0.2)'
                        : estadoActual === 'EN PROCESO'
                          ? '0 2px 4px rgba(245, 158, 11, 0.2)'
                          : '0 2px 4px rgba(14, 165, 233, 0.2)'
                    }}>
                      {estadoActual === 'COMPLETADA' ? 'COMPLETADA' : estadoActual === 'EN PROCESO' ? 'EN PROCESO' : 'ACTIVA'}
                    </div>
                  </div>
                  <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ background: '#0f172a', color: 'white', padding: '3px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', display: 'inline-block' }}>
                      ID CONTROL: {idDinamico}
                    </span>
                    {activeUsers.length > 0 && (
                      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                        {activeUsers.map(u => (
                          <div
                            key={u.presence_ref || u.user_id}
                            className="sf-presence-avatar"
                            title={`${u.nombre} - ${u.gerencia || 'Sin Gerencia'}`}
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: '#e0f2fe',
                              color: '#2d2d2d',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              border: '1.5px solid #bae6fd',
                              cursor: 'default',
                              boxSizing: 'border-box'
                            }}
                          >
                            {(() => {
                              if (!u.nombre) return '??';
                              const parts = u.nombre.trim().split(/\s+/);
                              if (parts.length >= 2) {
                                return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
                              }
                              return parts[0].substring(0, 2).toUpperCase();
                            })()}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* DASHBOARD DE CONTROL DE CABECERA (RESTAURADO) */}
                <div style={{ display: 'flex', gap: '10px', marginLeft: '20px' }}>
                  {[
                    { label: 'ESTIMADO', val: dashEjecucion.estimado, col: '#0ea5e9', icon: <DollarSign size={14} /> },
                    { label: 'COMPRADO', val: dashEjecucion.ejecutado, col: '#10b981', icon: <CheckCircle2 size={14} /> },
                    { label: 'PENDIENTE', val: dashEjecucion.pendiente, col: '#f59e0b', icon: <Clock size={20} /> },
                    { label: 'DIFERENCIA', val: Math.abs(dashEjecucion.diferencia), col: dashEjecucion.diferencia < 0 ? '#ef4444' : '#10b981', icon: <Activity size={20} /> }
                  ].map((stat, idx) => (
                    <div key={idx} style={{
                      backgroundColor: 'white',
                      border: '1px solid rgba(226, 232, 240, 0.8)',
                      padding: '12px 20px',
                      borderRadius: '16px',
                      minWidth: '150px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ color: stat.col }}>{stat.icon}</span>
                        <span style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', letterSpacing: '0.05em' }}>{stat.label}</span>
                      </div>
                      <div style={{ fontSize: '1.4rem', fontWeight: '1000', color: stat.col, letterSpacing: '-0.5px' }}>
                        $ {stat.val.toLocaleString('de-DE', { minimumFractionDigits: 0 })}
                      </div>
                    </div>
                  ))}

                  {/* SALUD PRESUPUESTARIA */}
                  <div style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.6)',
                    border: '1px solid rgba(226, 232, 240, 0.8)',
                    padding: '12px 20px',
                    borderRadius: '16px',
                    minWidth: '180px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>Salud Presupuestaria</span>
                      <span style={{ fontSize: '10px', fontWeight: '1000', color: '#0ea5e9' }}>{Math.round((dashEjecucion.ejecutado / (dashEjecucion.estimado || 1)) * 100)}%</span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min((dashEjecucion.ejecutado / (dashEjecucion.estimado || 1)) * 100, 100)}%`,
                        backgroundColor: '#0ea5e9',
                        borderRadius: '3px',
                        boxShadow: '0 0 10px rgba(14, 165, 233, 0.4)'
                      }}></div>
                    </div>
                  </div>
                </div>

                {/* AREA DE TOTAL Y DESGLOSE RESTAURADA */}
                <div style={{ display: 'flex', gap: '40px', textAlign: 'right', alignItems: 'center' }}>
                  <div style={{ borderLeft: '2px solid #e2e8f0', paddingLeft: '30px', position: 'relative' }}>
                    <label style={{ fontSize: '10px', fontWeight: '900', color: '#64748b' }}>TOTAL ESTIMADO</label>
                    <div style={{ fontSize: '1.8rem', fontWeight: '950', color: '#0f172a' }}>$ {dashEjecucion.estimado.toLocaleString('de-DE', { minimumFractionDigits: 0 })}</div>

                    <button
                      onClick={() => setMostrarDesglose(!mostrarDesglose)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#0ea5e9',
                        fontSize: '9px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: 0,
                        marginTop: '2px',
                        width: '100%',
                        justifyContent: 'flex-end',
                        textTransform: 'uppercase',
                        textDecoration: 'underline'
                      }}
                    >
                      <BarChart3 size={10} /> {mostrarDesglose ? 'Ocultar Desglose' : 'VER DESGLOSE'}
                    </button>

                    {/* PANEL DESPLEGABLE DE CATEGORÍAS (REPOSICIONADO) */}
                    {mostrarDesglose && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        right: '0',
                        zIndex: 100,
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '20px',
                        padding: '18px',
                        width: '300px',
                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                        marginTop: '10px',
                        textAlign: 'left'
                      }}>
                        <label style={{ fontSize: '9px', fontWeight: '900', color: '#94a3b8', display: 'block', marginBottom: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>RESUMEN DE TOTALES</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 'bold' }}>
                            <span style={{ color: '#0369a1' }}>Requisiciones:</span>
                            <span style={{ color: '#0369a1' }}>$ {(sumas.bs + sumas.usd).toLocaleString('de-DE', { minimumFractionDigits: 0 })}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 'bold' }}>
                            <span style={{ color: '#b45309' }}>Tickets de Pago:</span>
                            <span style={{ color: '#b45309' }}>$ {(sumas.imprevistosBs + sumas.imprevistosUsd).toLocaleString('de-DE', { minimumFractionDigits: 0 })}</span>
                          </div>
                        </div>

                        <label style={{ fontSize: '9px', fontWeight: '900', color: '#94a3b8', display: 'block', marginBottom: '10px', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>DESGLOSE POR CATEGORÍA</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {categoriasEjecucion.length > 0 ? categoriasEjecucion.map((cat, ci) => (
                            <div key={ci}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: '700', marginBottom: '3px' }}>
                                <span style={{ color: '#475569', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
                                <span style={{ color: '#1e293b' }}>$ {cat.ejecutado.toLocaleString('de-DE', { minimumFractionDigits: 0 })}</span>
                              </div>
                              <div style={{ height: '4px', backgroundColor: '#f8fafc', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%',
                                  width: `${cat.porcentaje}%`,
                                  backgroundColor: '#0ea5e9',
                                  borderRadius: '4px'
                                }}></div>
                              </div>
                            </div>
                          )) : (
                            <div style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', marginTop: '10px' }}>Sin datos de ejecución</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* --- CUERPO DESPLAZABLE --- */}
            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '30px', backgroundColor: 'rgba(241, 245, 249, 0.4)' }}>

              {/* LÍMITE REQUISICIONES COLOCADO EN EL ESPACIO GRIS DEBAJO DEL TOTAL/DESGLOSE */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                <div style={{
                  fontSize: '11px',
                  color: isExpired ? '#ef4444' : '#475569',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: isExpired ? '#fee2e2' : '#f1f5f9',
                  padding: '6px 14px',
                  borderRadius: '10px',
                  border: isExpired ? '1px solid #fecaca' : '1px solid #e2e8f0',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                }}>
                  {isExpired ? (
                    <span>🛑 Plazo vencido. No se pueden añadir nuevos registros.</span>
                  ) : (
                    <span>⏰ Límite Requisiciones: <span style={{ color: '#0f172a', fontWeight: '800' }}>Dom {format(deadlineDate, 'dd/MM')} - 11:59 PM</span></span>
                  )}
                </div>
              </div>

              {/* FORM CABECERA */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', background: 'white', padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#363636', marginBottom: '5px' }}>FECHA OPERATIVA</label>
                  <input type="date" className="sf-input" value={form.fecha} readOnly style={{ backgroundColor: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#363636', marginBottom: '5px' }}>GERENCIA SOLICITANTE</label>
                  <input className="sf-input" value={form.gerencia} readOnly style={{ backgroundColor: '#f8fafc', color: '#475569' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#363636', marginBottom: '5px' }}>RESPONSABLE DE GASTO</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      className="sf-input"
                      value={form.responsable}
                      readOnly
                      style={{ backgroundColor: '#f8fafc', color: '#1e293b', fontWeight: '600', flex: 1, minWidth: 0 }}
                    />
                    <button
                      onClick={() => setMostrarFiltrosTabla(!mostrarFiltrosTabla)}
                      style={{
                        background: mostrarFiltrosTabla ? '#0ea5e9' : 'white',
                        border: '1px solid #cbd5e1',
                        borderRadius: '12px',
                        width: '42px',
                        height: '42px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: mostrarFiltrosTabla ? 'white' : '#64748b',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        transition: 'all 0.2s',
                        position: 'relative',
                        flexShrink: 0
                      }}
                      title="Filtrar Renglones por Emisor / Categoría / Clasificación / Estado ID"
                    >
                      <Activity size={18} />
                      {/* INDICADOR DOT DE FILTRO ACTIVO */}
                      {(filtroPartidaEmisor !== 'Todos' || filtroPartidaCategoria !== 'Todos' || filtroPartidaClasificacion !== 'Todos' || filtroPartidaEstadoId !== 'Todos') && (
                        <div style={{
                          position: 'absolute',
                          top: '-3px',
                          right: '-3px',
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: '#ef4444',
                          border: '2px solid white'
                        }} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* PANEL DE FILTROS OPCIONALES DESPLEGABLES */}
              {mostrarFiltrosTabla && (
                <div style={{
                  marginBottom: '15px',
                  background: 'white',
                  border: '1px solid #cbd5e1',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                  animation: 'fadeIn 0.2s ease-in-out'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '11px', fontWeight: '900', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Activity size={14} style={{ color: '#0ea5e9' }} />
                      <span>FILTRAR RENGLONES POR USUARIO / CATEGORÍA / CLASIFICACIÓN / ESTADO ID</span>
                    </div>

                    {(filtroPartidaEmisor !== 'Todos' || filtroPartidaCategoria !== 'Todos' || filtroPartidaClasificacion !== 'Todos' || filtroPartidaEstadoId !== 'Todos') && (
                      <button
                        onClick={() => {
                          setFiltroPartidaEmisor('Todos');
                          setFiltroPartidaCategoria('Todos');
                          setFiltroPartidaClasificacion('Todos');
                          setFiltroPartidaEstadoId('Todos');
                        }}
                        style={{
                          background: '#fee2e2',
                          border: 'none',
                          color: '#ef4444',
                          fontSize: '9px',
                          fontWeight: '900',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <X size={10} /> LIMPIAR FILTROS
                      </button>
                    )}
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '15px'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '8.5px', fontWeight: '900', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Usuario / Emisor</label>
                      <select
                        value={filtroPartidaEmisor}
                        onChange={(e) => setFiltroPartidaEmisor(e.target.value)}
                        style={{
                          width: '100%',
                          fontSize: '11px',
                          padding: '6px 10px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          backgroundColor: '#f8fafc',
                          color: '#334155',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="Todos">Todos ({listaEmisoresUnicos.length})</option>
                        {listaEmisoresUnicos.map(em => (
                          <option key={em} value={em}>{em}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '8.5px', fontWeight: '900', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Categoría</label>
                      <select
                        value={filtroPartidaCategoria}
                        onChange={(e) => setFiltroPartidaCategoria(e.target.value)}
                        style={{
                          width: '100%',
                          fontSize: '11px',
                          padding: '6px 10px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          backgroundColor: '#f8fafc',
                          color: '#334155',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="Todos">Todas ({listaCategoriasUnicas.length})</option>
                        {listaCategoriasUnicas.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '8.5px', fontWeight: '900', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Material / Clasificación</label>
                      <select
                        value={filtroPartidaClasificacion}
                        onChange={(e) => setFiltroPartidaClasificacion(e.target.value)}
                        style={{
                          width: '100%',
                          fontSize: '11px',
                          padding: '6px 10px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          backgroundColor: '#f8fafc',
                          color: '#334155',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="Todos">Todas ({listaClasificacionesUnicas.length})</option>
                        {listaClasificacionesUnicas.map(cl => (
                          <option key={cl} value={cl}>{cl}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '8.5px', fontWeight: '900', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Estado de ID / Ref</label>
                      <select
                        value={filtroPartidaEstadoId}
                        onChange={(e) => setFiltroPartidaEstadoId(e.target.value)}
                        style={{
                          width: '100%',
                          fontSize: '11px',
                          padding: '6px 10px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          backgroundColor: '#f8fafc',
                          color: '#334155',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="Todos">Todos</option>
                        <option value="Comprados">Comprados (Verde)</option>
                        <option value="EnRequisicion">En Requisición (Azul)</option>
                        <option value="SinID">Sin ID</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TABLA DE RENGLONES */}
              {!mostrarImprevistos && (
                <div style={{ marginTop: '1px' }}>
                  <div className="sf-table-wrapper">
                    <div className="sf-table-header">
                      <div style={{ width: '85px', padding: '12px', textAlign: 'center' }}>N°</div>
                      <div style={{ width: '130px', padding: '12px', textAlign: 'center' }}>ID REF</div>
                      <div style={{ width: '180px', padding: '12px' }}>C. COSTO</div>
                      <div style={{ width: '215px', padding: '12px' }}>CLASIFICACIÓN</div>
                      <div style={{ width: '215px', padding: '12px' }}>CATEGORÍA</div>
                      <div style={{ width: '80px', padding: '12px', textAlign: 'center' }}>CANT</div>
                      <div style={{ width: '90px', padding: '12px', textAlign: 'center' }}>UNID</div>
                      <div style={{ width: '460px', padding: '12px' }}>DESCRIPCIÓN DEL GASTO</div>
                      <div style={{ width: '200px', padding: '12px' }}>BENEFICIARIO</div>
                      <div style={{ width: '120px', padding: '12px', textAlign: 'center' }}>P.U $/BS</div>
                      <div style={{ width: '120px', padding: '12px', textAlign: 'center' }}>P.U $/$</div>
                      <div style={{ width: '122px', padding: '12px', textAlign: 'center' }}>TOTAL $</div>
                      <div style={{ width: '125px', padding: '12px' }}>USUARIO</div>
                      <div style={{ width: '70px', padding: '12px', textAlign: 'center' }}>ACCIONES</div>
                    </div>

                    <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
                      {partidasFiltradas.map((p, i) => {
                        const editingUser = activeUsers.find(u => u.fila_editando === p.id && u.user_id !== currentUser?.id);
                        const isSelectedByOther = !!selectedRowsByOthers[p.id];
                        const isAnulado = p.status === 'ANULADO_POR_USUARIO';
                        return (
                          <div key={p.id} className={`sf-table-row ${editingUser ? 'sf-row-editing' : ''}`} style={{
                            background: isAnulado ? '#f1f5f9' : (p.requisicion_id || p.codigo_ticket || p.status === 'Bloqueado') ? '#f1f5f9' : (p.selected ? '#e0f2fe' : (editingUser ? '#fff1f2' : 'transparent')),
                            opacity: isAnulado ? 0.6 : 1,
                            textDecoration: isAnulado ? 'line-through' : 'none'
                          }}>
                            <div style={{ width: '40px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={p.selected || false}
                                onChange={(e) => {
                                  const val = e.target.checked;
                                  manejarCambioPartida(p.originalIndex, 'selected', val);
                                  if (presenceChannelRef.current) {
                                    presenceChannelRef.current.send({
                                      type: 'broadcast',
                                      event: 'checkbox_change',
                                      payload: { user_id: currentUser?.id, rowId: p.id, selected: val }
                                    });
                                  }
                                }}
                                style={{ cursor: (isReadOnly || isAnulado || p.requisicion_id || p.codigo_ticket || p.status === 'Bloqueado' || isSelectedByOther || !!editingUser) ? 'not-allowed' : 'pointer', transform: 'scale(1.2)' }}
                                disabled={isReadOnly || isAnulado || !!p.requisicion_id || !!p.codigo_ticket || p.status === 'Bloqueado' || isSelectedByOther || !!editingUser}
                                title={p.codigo_ticket ? `Ticket Emitido: ${p.codigo_ticket}` : (p.requisicion_id ? "Bloqueado por Requisición" : (isSelectedByOther ? "Seleccionado por otro usuario" : (editingUser ? `Editando... (${editingUser.nombre})` : "")))}
                              />
                            </div>
                            <div style={{ width: '45px', textAlign: 'center', fontWeight: 'bold', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                              {i + 1}
                              {p.codigo_ref?.startsWith('TP-') && <span title={`Ticket: ${p.codigo_ref}`}>🎟️</span>}
                              {p.codigo_ref?.startsWith('RR-') && <span title={`Requisición: ${p.codigo_ref}`}>📝</span>}
                              {p.pago_realizado || (p.codigo_ref?.startsWith('TP-') && p.isReqCompletada) ? <span title="Pago Completado">✅</span> : null}
                            </div>
                            <div style={{ width: '130px', padding: '6px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {p.codigo_ref ? (
                                <div
                                  onClick={() => handleClicCodigoRef(p.codigo_ref)}
                                  style={{
                                    backgroundColor: p.isReqCompletada ? '#10b981' : '#0ea5e9',
                                    color: 'white',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    fontSize: '11px',
                                    fontWeight: '800',
                                    boxShadow: p.isReqCompletada ? '0 2px 6px rgba(16, 185, 129, 0.3)' : '0 2px 6px rgba(14, 165, 233, 0.3)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    userSelect: 'none'
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = p.isReqCompletada ? '#059669' : '#0284c7'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = p.isReqCompletada ? '#10b981' : '#0ea5e9'; e.currentTarget.style.transform = 'scale(1)'; }}
                                  title={p.isReqCompletada ? (p.codigo_ref?.startsWith('TP-') ? `Ticket de Pago COMPLETADO: ${p.codigo_ref}` : `Requisición COMPLETAMENTE COMPRADA: ${p.codigo_ref}`) : `Haga clic para ver el detalle de ${p.codigo_ref}`}
                                >
                                  {p.codigo_ref} {p.isReqCompletada ? '✅' : ''}
                                </div>
                              ) : (
                                <span style={{ color: '#cbd5e1' }}>---</span>
                              )}
                            </div>
                            <div style={{ width: '180px', padding: '6px' }}>
                              <select className="sf-table-input" value={p.cc} onChange={(e) => manejarCambioPartida(p.originalIndex, 'cc', e.target.value)} style={{ fontWeight: 'bold' }} disabled={isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || !!p.codigo_ref || !!editingUser} onFocus={() => handleFocusRow(p.id)} onBlur={handleBlurRow}>
                                <option value="">Seleccione C.C...</option>
                                {centrosCosto.map(op => <option key={op.id} value={op.nombre}>{op.nombre}</option>)}
                              </select>
                            </div>
                            <div style={{ width: '215px', padding: '6px' }}>
                              <select className="sf-table-input" value={p.clasif} onChange={(e) => manejarCambioPartida(p.originalIndex, 'clasif', e.target.value)} disabled={isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || !p.cc || !!p.codigo_ref || !!editingUser} onFocus={() => handleFocusRow(p.id)} onBlur={handleBlurRow}>
                                <option value="">Clasificación...</option>
                                {(() => {
                                  const clasifs = clasificacionesPorCC[p.cc] || [];
                                  return clasifs.map(op => <option key={op.id} value={op.nombre}>{op.nombre}</option>);
                                })()}
                              </select>
                            </div>
                            <div style={{ width: '215px', padding: '6px' }}>
                              <select className="sf-table-input" value={p.cat} onChange={(e) => manejarCambioPartida(p.originalIndex, 'cat', e.target.value)} disabled={isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || !p.clasif || !!p.codigo_ref || !!editingUser} onFocus={() => handleFocusRow(p.id)} onBlur={handleBlurRow}>
                                <option value="">Categoría...</option>
                                {(() => {
                                  const clObj = clObjMap[`${p.cc}_${p.clasif}`];
                                  const cats = clObj ? (categoriasPorClasif[clObj.id] || []) : [];
                                  return cats.map(op => <option key={op.id} value={op.nombre}>{op.nombre}</option>);
                                })()}
                              </select>
                            </div>
                            <div style={{ width: '80px', padding: '6px' }}><input className="sf-table-input" type="number" value={p.cant === undefined || p.cant === null ? '' : p.cant} onChange={(e) => manejarCambioPartida(p.originalIndex, 'cant', e.target.value)} style={{ textAlign: 'center' }} disabled={isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || !!p.codigo_ref || !!editingUser} onFocus={() => handleFocusRow(p.id)} onBlur={() => { handleBlurRow(); normalizarNumeroOnBlur(p.originalIndex, 'cant', p.cant, false); }} /></div>
                            <div style={{ width: '90px', padding: '6px' }}><select className="sf-table-input" value={p.uni} onChange={(e) => manejarCambioPartida(p.originalIndex, 'uni', e.target.value)} disabled={isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || !!p.codigo_ref || !!editingUser} onFocus={() => handleFocusRow(p.id)} onBlur={handleBlurRow}>{unidades.map(u => <option key={u}>{u}</option>)}</select></div>
                            <div style={{ width: '460px', padding: '10px' }}><TextareaLocal className="sf-table-input" value={p.desc} onChange={(val) => manejarCambioPartida(p.originalIndex, 'desc', val)} style={{ resize: 'none', height: 'auto', overflowY: 'hidden' }} rows="1" disabled={isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || !!p.codigo_ref || !!editingUser} onFocus={() => handleFocusRow(p.id)} onBlur={handleBlurRow} /></div>
                            <div style={{ width: '200px', padding: '6px' }}><TextInputLocal className="sf-table-input" value={p.ben} onChange={(val) => manejarCambioPartida(p.originalIndex, 'ben', val)} disabled={isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || !!p.codigo_ref || !!editingUser} onFocus={() => handleFocusRow(p.id)} onBlur={handleBlurRow} /></div>
                            <div style={{ width: '120px', padding: '6px' }}><input className="sf-table-input" type="number" value={p.puBs === undefined || p.puBs === null || p.puBs === '' ? '' : p.puBs} onChange={(e) => manejarCambioPartida(p.originalIndex, 'puBs', e.target.value)} style={{ textAlign: 'left' }} disabled={isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || p.puUsd > 0 || !!p.codigo_ref || !!editingUser} onFocus={() => handleFocusRow(p.id)} onBlur={() => { handleBlurRow(); normalizarNumeroOnBlur(p.originalIndex, 'puBs', p.puBs, false); }} /></div>
                            <div style={{ width: '120px', padding: '6px' }}><input className="sf-table-input" type="number" value={p.puUsd === undefined || p.puUsd === null || p.puUsd === '' ? '' : p.puUsd} onChange={(e) => manejarCambioPartida(p.originalIndex, 'puUsd', e.target.value)} style={{ textAlign: 'left' }} disabled={isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || p.puBs > 0 || !!p.codigo_ref || !!editingUser} onFocus={() => handleFocusRow(p.id)} onBlur={() => { handleBlurRow(); normalizarNumeroOnBlur(p.originalIndex, 'puUsd', p.puUsd, false); }} /></div>
                            <div style={{ width: '120px', padding: '6px', textAlign: 'left', fontWeight: 'bold' }}>{((parseFloat(p.puBs) || parseFloat(p.puUsd) || 0) * (p.cant || 0)).toLocaleString('de-DE')}</div>
                            <div style={{ width: '130px', padding: '6px', fontSize: '9px', color: editingUser ? '#e11d48' : '#64748b', fontWeight: editingUser ? 'bold' : '600' }}>
                              {editingUser ? `✏️ Editando... (${editingUser.nombre})` : (p.emisor || '---')}
                            </div>
                            <div style={{ width: '110px', display: 'flex', gap: '5px', justifyContent: 'center' }}>
                              <button onClick={() => duplicarPartida(p.originalIndex)} style={{ background: 'none', border: 'none', color: '#0ea5e9', cursor: (isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || p.codigo_ticket || p.requisicion_id || !!editingUser) ? 'not-allowed' : 'pointer', fontSize: '1rem', opacity: (isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || p.codigo_ticket || p.requisicion_id || !!editingUser) ? 0.3 : 1 }} disabled={isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || !!p.codigo_ticket || !!p.requisicion_id || !!editingUser} title="Duplicar renglón"><Copy size={16} /></button>
                              <button onClick={() => { setHasChanges(true); setForm({ ...form, partidas: form.partidas.filter((_, idx) => idx !== p.originalIndex) }); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: (isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || p.codigo_ticket || p.requisicion_id || !!editingUser) ? 'not-allowed' : 'pointer', fontSize: '1rem', opacity: (isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || p.codigo_ticket || p.requisicion_id || !!editingUser) ? 0.3 : 1 }} disabled={isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || !!p.codigo_ticket || !!p.requisicion_id || !!editingUser} title="Eliminar renglón">🗑️</button>
                              {p.id && (
                                <button
                                  onClick={() => abrirModalAnulacion(p)}
                                  disabled={isReadOnly || estadoActual === 'ACTIVA' || isAnulado || (p.requisiciones && (p.requisiciones.status_compra === 'Comprado' || p.requisiciones.status_compra === 'Recibido en Almacén')) || !!editingUser}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#f43f5e',
                                    cursor: (isReadOnly || estadoActual === 'ACTIVA' || isAnulado || (p.requisiciones && (p.requisiciones.status_compra === 'Comprado' || p.requisiciones.status_compra === 'Recibido en Almacén')) || !!editingUser) ? 'not-allowed' : 'pointer',
                                    fontSize: '1rem',
                                    opacity: (isReadOnly || estadoActual === 'ACTIVA' || isAnulado || (p.requisiciones && (p.requisiciones.status_compra === 'Comprado' || p.requisiciones.status_compra === 'Recibido en Almacén')) || !!editingUser) ? 0.3 : 1
                                  }}
                                  title={
                                    estadoActual === 'ACTIVA'
                                      ? "Para borrar un renglón en una solicitud activa, use el bote de basura (eliminar)"
                                      : (p.requisiciones && (p.requisiciones.status_compra === 'Comprado' || p.requisiciones.status_compra === 'Recibido en Almacén'))
                                        ? "No se puede anular: Requisición ya Comprada o en Almacén"
                                        : isAnulado
                                          ? "Renglón ya sin efecto"
                                          : "Anular Renglón (Sin Efecto)"
                                  }
                                >
                                  🚫
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* SECCIÓN GASTOS IMPREVISTOS */}
              {mostrarImprevistos && (
                <div style={{ marginTop: '30px', animation: 'fadeIn 0.3s ease-in-out' }}>



                  <div className="sf-table-wrapper" style={{ border: '1px solid #fcd34d', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.05)' }}>
                    <div className="sf-table-header" style={{ background: '#fffcf0', borderBottom: '2px solid #fef3c7', color: '#b45309' }}>
                      <div style={{ width: '40px', padding: '12px', textAlign: 'center' }}>SEL</div>
                      <div style={{ width: '45px', padding: '12px', textAlign: 'center' }}>N°</div>
                      <div style={{ width: '130px', padding: '12px', textAlign: 'center' }}>ID REF</div>
                      <div style={{ width: '180px', padding: '12px' }}>C. COSTO</div>
                      <div style={{ width: '215px', padding: '12px' }}>CLASIFICACIÓN</div>
                      <div style={{ width: '215px', padding: '12px' }}>CATEGORÍA</div>
                      <div style={{ width: '80px', padding: '12px', textAlign: 'center' }}>CANT</div>
                      <div style={{ width: '90px', padding: '12px', textAlign: 'center' }}>UNID</div>
                      <div style={{ width: '460px', padding: '12px' }}>DESCRIPCIÓN DEL GASTO</div>
                      <div style={{ width: '200px', padding: '12px' }}>BENEFICIARIO</div>
                      <div style={{ width: '120px', padding: '12px', textAlign: 'center' }}>P.U $/BS</div>
                      <div style={{ width: '120px', padding: '12px', textAlign: 'center' }}>P.U $/$</div>
                      <div style={{ width: '120px', padding: '12px', textAlign: 'center' }}>TOTAL $</div>
                      <div style={{ width: '130px', padding: '12px' }}>USUARIO</div>
                      <div style={{ width: '110px', padding: '12px', textAlign: 'center' }}>ACCIONES</div>
                    </div>

                    <div style={{ maxHeight: '30vh', overflowY: 'auto' }}>
                      {imprevistosFiltrados.map((imp, i) => {
                        const editingImpUser = activeUsers.find(u => u.fila_editando === imp.id && u.user_id !== currentUser?.id);
                        const isImpSelectedByOther = !!selectedRowsByOthers[imp.id];
                        const isAnulado = imp.status === 'ANULADO_POR_USUARIO';
                        return (
                          <div key={imp.id} className={`sf-table-row ${editingImpUser ? 'sf-row-editing' : ''}`} style={{
                            background: isAnulado ? '#f1f5f9' : (imp.requisicion_id || imp.status === 'Bloqueado') ? '#f1f5f9' : (imp.selected ? '#fffcf0' : (editingImpUser ? '#fff1f2' : 'transparent')),
                            opacity: isAnulado ? 0.6 : 1,
                            textDecoration: isAnulado ? 'line-through' : 'none'
                          }}>
                            <div style={{ width: '40px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={imp.selected || false}
                                onChange={(e) => {
                                  const val = e.target.checked;
                                  manejarCambioImprevisto(imp.originalIndex, 'selected', val);
                                  if (presenceChannelRef.current) {
                                    presenceChannelRef.current.send({
                                      type: 'broadcast',
                                      event: 'checkbox_change',
                                      payload: { user_id: currentUser?.id, rowId: imp.id, selected: val }
                                    });
                                  }
                                }}
                                style={{ cursor: (isReadOnly || isAnulado || imp.requisicion_id || imp.status === 'Bloqueado' || isImpSelectedByOther || !!editingImpUser) ? 'not-allowed' : 'pointer', transform: 'scale(1.2)' }}
                                disabled={isReadOnly || isAnulado || !!imp.requisicion_id || imp.status === 'Bloqueado' || isImpSelectedByOther || !!editingImpUser}
                                title={(imp.requisicion_id || imp.status === 'Bloqueado') ? "Esta partida está bloqueada por una requisición activa" : (isImpSelectedByOther ? "Seleccionado por otro usuario" : (editingImpUser ? `Editando... (${editingImpUser.nombre})` : ""))}
                              />
                            </div>
                            <div style={{ width: '45px', textAlign: 'center', fontWeight: 'bold', color: '#d97706', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                              {i + 1}
                              {imp.codigo_ref?.startsWith('TP-') && <span title={`Ticket: ${imp.codigo_ref}`}>🎟️</span>}
                              {imp.pago_realizado || (imp.codigo_ref?.startsWith('TP-') && imp.isReqCompletada) ? <span title="Pago Completado">✅</span> : null}
                            </div>
                            <div style={{ width: '130px', padding: '6px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {imp.codigo_ref ? (
                                <div
                                  onClick={() => handleClicCodigoRef(imp.codigo_ref)}
                                  style={{
                                    backgroundColor: imp.isReqCompletada ? '#10b981' : '#f59e0b',
                                    color: 'white',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    fontSize: '11px',
                                    fontWeight: '800',
                                    boxShadow: imp.isReqCompletada ? '0 2px 6px rgba(16, 185, 129, 0.3)' : '0 2px 6px rgba(245, 158, 11, 0.3)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    userSelect: 'none'
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = imp.isReqCompletada ? '#059669' : '#d97706'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = imp.isReqCompletada ? '#10b981' : '#f59e0b'; e.currentTarget.style.transform = 'scale(1)'; }}
                                  title={imp.isReqCompletada ? (imp.codigo_ref?.startsWith('TP-') ? `Ticket de Pago COMPLETADO: ${imp.codigo_ref}` : `Requisición COMPLETAMENTE COMPRADA: ${imp.codigo_ref}`) : `Haga clic para ver el detalle de ${imp.codigo_ref}`}
                                >
                                  {imp.codigo_ref} {imp.isReqCompletada ? '✅' : ''}
                                </div>
                              ) : (
                                <span style={{ color: '#cbd5e1' }}>---</span>
                              )}
                            </div>
                            <div style={{ width: '180px', padding: '6px' }}>
                              <select className="sf-table-input" value={imp.cc} onChange={(e) => manejarCambioImprevisto(imp.originalIndex, 'cc', e.target.value)} style={{ fontWeight: 'bold' }} disabled={isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || !!imp.codigo_ref || !!editingImpUser} onFocus={() => handleFocusRow(imp.id)} onBlur={handleBlurRow}>
                                <option value="">Seleccione C.C...</option>
                                {centrosCosto.map(op => <option key={op.id} value={op.nombre}>{op.nombre}</option>)}
                              </select>
                            </div>
                            <div style={{ width: '215px', padding: '6px' }}>
                              <select className="sf-table-input" value={imp.clasif} onChange={(e) => manejarCambioImprevisto(imp.originalIndex, 'clasif', e.target.value)} disabled={isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || !imp.cc || !!imp.codigo_ref || !!editingImpUser} onFocus={() => handleFocusRow(imp.id)} onBlur={handleBlurRow}>
                                <option value="">Clasificación...</option>
                                {(() => {
                                  const clasifs = clasificacionesPorCC[imp.cc] || [];
                                  return clasifs.map(op => <option key={op.id} value={op.nombre}>{op.nombre}</option>);
                                })()}
                              </select>
                            </div>
                            <div style={{ width: '215px', padding: '6px' }}>
                              <select className="sf-table-input" value={imp.cat} onChange={(e) => manejarCambioImprevisto(imp.originalIndex, 'cat', e.target.value)} disabled={isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || !imp.clasif || !!imp.codigo_ref || !!editingImpUser} onFocus={() => handleFocusRow(imp.id)} onBlur={handleBlurRow}>
                                <option value="">Categoría...</option>
                                {(() => {
                                  const clObj = clObjMap[`${imp.cc}_${imp.clasif}`];
                                  const cats = clObj ? (categoriasPorClasif[clObj.id] || []) : [];
                                  return cats.map(op => <option key={op.id} value={op.nombre}>{op.nombre}</option>);
                                })()}
                              </select>
                            </div>
                            <div style={{ width: '80px', padding: '6px' }}><input className="sf-table-input" type="number" value={imp.cant === undefined || imp.cant === null ? '' : imp.cant} onChange={(e) => manejarCambioImprevisto(imp.originalIndex, 'cant', e.target.value)} style={{ textAlign: 'center' }} disabled={isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || !!imp.codigo_ref || !!editingImpUser} onFocus={() => handleFocusRow(imp.id)} onBlur={() => { handleBlurRow(); normalizarNumeroOnBlur(imp.originalIndex, 'cant', imp.cant, true); }} /></div>
                            <div style={{ width: '90px', padding: '6px' }}><select className="sf-table-input" value={imp.uni} onChange={(e) => manejarCambioImprevisto(imp.originalIndex, 'uni', e.target.value)} disabled={isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || !!imp.codigo_ref || !!editingImpUser} onFocus={() => handleFocusRow(imp.id)} onBlur={handleBlurRow}>{unidades.map(u => <option key={u}>{u}</option>)}</select></div>
                            <div style={{ width: '460px', padding: '10px' }}><TextareaLocal className="sf-table-input" value={imp.desc} onChange={(val) => manejarCambioImprevisto(imp.originalIndex, 'desc', val)} style={{ resize: 'none', height: 'auto', overflowY: 'hidden' }} rows="1" disabled={isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || !!imp.codigo_ref || !!editingImpUser} onFocus={() => handleFocusRow(imp.id)} onBlur={handleBlurRow} /></div>
                            <div style={{ width: '200px', padding: '6px' }}><TextInputLocal className="sf-table-input" value={imp.ben} onChange={(val) => manejarCambioImprevisto(imp.originalIndex, 'ben', val)} disabled={isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || !!imp.codigo_ref || !!editingImpUser} onFocus={() => handleFocusRow(imp.id)} onBlur={handleBlurRow} /></div>
                            <div style={{ width: '120px', padding: '6px' }}><input className="sf-table-input" type="number" value={imp.puBs === undefined || imp.puBs === null || imp.puBs === '' ? '' : imp.puBs} onChange={(e) => manejarCambioImprevisto(imp.originalIndex, 'puBs', e.target.value)} style={{ textAlign: 'right' }} disabled={isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || imp.puUsd > 0 || !!imp.codigo_ref || !!editingImpUser} onFocus={() => handleFocusRow(imp.id)} onBlur={() => { handleBlurRow(); normalizarNumeroOnBlur(imp.originalIndex, 'puBs', imp.puBs, true); }} /></div>
                            <div style={{ width: '120px', padding: '6px' }}><input className="sf-table-input" type="number" value={imp.puUsd === undefined || imp.puUsd === null || imp.puUsd === '' ? '' : imp.puUsd} onChange={(e) => manejarCambioImprevisto(imp.originalIndex, 'puUsd', e.target.value)} style={{ textAlign: 'right' }} disabled={isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || imp.puBs > 0 || !!imp.codigo_ref || !!editingImpUser} onFocus={() => handleFocusRow(imp.id)} onBlur={() => { handleBlurRow(); normalizarNumeroOnBlur(imp.originalIndex, 'puUsd', imp.puUsd, true); }} /></div>
                            <div style={{ width: '120px', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>{((parseFloat(imp.puBs) || parseFloat(imp.puUsd) || 0) * (imp.cant || 1)).toLocaleString('de-DE')}</div>
                            <div style={{ width: '130px', padding: '6px', fontSize: '9px', color: editingImpUser ? '#e11d48' : '#64748b', fontWeight: editingImpUser ? 'bold' : '600' }}>
                              {editingImpUser ? `✏️ Editando... (${editingImpUser.nombre})` : (imp.emisor || '---')}
                            </div>
                            <div style={{ width: '110px', display: 'flex', gap: '5px', justifyContent: 'center' }}>
                              <button onClick={() => duplicarImprevisto(imp.originalIndex)} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: (isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || imp.codigo_ref || imp.status === 'Bloqueado' || !!editingImpUser) ? 'not-allowed' : 'pointer', fontSize: '1rem', opacity: (isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || imp.codigo_ref || imp.status === 'Bloqueado' || !!editingImpUser) ? 0.3 : 1 }} disabled={isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || !!imp.codigo_ref || imp.status === 'Bloqueado' || !!editingImpUser} title="Duplicar imprevisto"><Copy size={16} /></button>
                              <button onClick={() => { setHasChanges(true); setForm({ ...form, imprevistos: form.imprevistos.filter((_, idx) => idx !== imp.originalIndex) }); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: (isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || imp.codigo_ref || imp.status === 'Bloqueado' || !!editingImpUser) ? 'not-allowed' : 'pointer', fontSize: '1rem', opacity: (isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || imp.codigo_ref || imp.status === 'Bloqueado' || !!editingImpUser) ? 0.3 : 1 }} disabled={isReadOnly || (estadoActual === 'EN PROCESO' && !esRrHhOAdm) || isAnulado || !!imp.codigo_ref || imp.status === 'Bloqueado' || !!editingImpUser} title="Eliminar imprevisto">🗑️</button>
                              {imp.id && (
                                <button
                                  onClick={() => abrirModalAnulacion(imp)}
                                  disabled={isReadOnly || estadoActual === 'ACTIVA' || isAnulado || (imp.requisiciones && (imp.requisiciones.status_compra === 'Comprado' || imp.requisiciones.status_compra === 'Recibido en Almacén')) || !!editingImpUser}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#f43f5e',
                                    cursor: (isReadOnly || estadoActual === 'ACTIVA' || isAnulado || (imp.requisiciones && (imp.requisiciones.status_compra === 'Comprado' || imp.requisiciones.status_compra === 'Recibido en Almacén')) || !!editingImpUser) ? 'not-allowed' : 'pointer',
                                    fontSize: '1rem',
                                    opacity: (isReadOnly || estadoActual === 'ACTIVA' || isAnulado || (imp.requisiciones && (imp.requisiciones.status_compra === 'Comprado' || imp.requisiciones.status_compra === 'Recibido en Almacén')) || !!editingImpUser) ? 0.3 : 1
                                  }}
                                  title={
                                    estadoActual === 'ACTIVA'
                                      ? "Para borrar un renglón en una solicitud activa, use el bote de basura (eliminar)"
                                      : (imp.requisiciones && (imp.requisiciones.status_compra === 'Comprado' || imp.requisiciones.status_compra === 'Recibido en Almacén'))
                                        ? "No se puede anular: Requisición ya Comprada o en Almacén"
                                        : isAnulado
                                          ? "Renglón ya sin efecto"
                                          : "Anular Renglón (Sin Efecto)"
                                  }
                                >
                                  🚫
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {!isReadOnly && (
                      <div style={{ padding: '12px', background: '#fffcf0', borderTop: '1px solid #fef3c7', display: 'flex', justifyContent: 'center' }}>
                        <button className="sf-btn" onClick={() => { setHasChanges(true); setForm({ ...form, imprevistos: [...form.imprevistos, { id: Date.now(), selected: false, cc: '', clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', puBs: '', puUsd: '', pago_realizado: false, emisor: `${currentUser?.nombre} ${currentUser?.apellido}` }] }); }} style={{ color: '#d97706', border: '2px dashed #f59e0b', background: '#fffbeb', padding: '8px 40px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
                          <i className="fa-solid fa-plus-circle"></i> AÑADIR OTRO TICKET DE PAGO
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* --- PIE DE PÁGINA FIJO --- */}
            <div style={{
              flexShrink: 0,
              padding: '20px 30px',
              borderTop: '1px solid #e2e8f0',
              backgroundColor: 'rgba(248, 250, 252, 0.8)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                {!mostrarImprevistos && !isReadOnly && (
                  <button
                    className="sf-btn sf-btn-add"
                    onClick={() => {
                      setHasChanges(true);
                      setForm({ ...form, partidas: [...form.partidas, { id: Date.now(), selected: false, cc: form.partidas[0]?.cc || '', clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', puBs: '', puUsd: '', emisor: `${currentUser?.nombre} ${currentUser?.apellido}` }] });
                    }}
                    disabled={isExpired}
                    style={{ opacity: isExpired ? 0.5 : 1, cursor: isExpired ? 'not-allowed' : 'pointer' }}
                  >
                    + AÑADIR RENGLÓN
                  </button>
                )}
                <button className="sf-btn" onClick={() => setMostrarImprevistos(!mostrarImprevistos)} style={{
                  border: '2px solid #f59e0b',
                  color: '#d97706',
                  background: 'white',
                  padding: '10px 25px',
                  borderRadius: '12px',
                  fontWeight: '900',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {mostrarImprevistos ? (
                    <>
                      <FileText size={18} /> MOSTRAR REQUISICIONES
                    </>
                  ) : (
                    <>
                      <Activity size={18} /> MOSTRAR TICKET DE PAGO
                    </>
                  )}
                </button>
                {!mostrarImprevistos && !isReadOnly && (
                  <button className="sf-btn sf-btn-success" onClick={handleCrearRequisicion} disabled={isReadOnly || estadoActual === 'COMPLETADA'} style={{
                    backgroundColor: '#10b981',
                    color: 'white',
                    padding: '10px 25px',
                    borderRadius: '12px',
                    fontWeight: '900',
                    opacity: (isReadOnly || estadoActual === 'COMPLETADA') ? 0.5 : 1,
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <FileText size={18} /> CREAR REQUISICIÓN
                  </button>
                )}
                {mostrarImprevistos && !isReadOnly && (
                  <button className="sf-btn" style={{
                    background: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    padding: '10px 25px',
                    borderRadius: '12px',
                    fontWeight: '900',
                    opacity: (isReadOnly || estadoActual === 'COMPLETADA') ? 0.5 : 1,
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                  }} onClick={handleEmitirTicketFromImprevisto} disabled={isReadOnly || estadoActual === 'COMPLETADA'}>
                    <Activity size={18} /> EMITIR TICKET DE PAGO
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {isSaving && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '10px' }}>
                    <Loader2 className="animate-spin" size={18} color="#0ea5e9" />
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#0ea5e9' }}>Procesando...</span>
                  </div>
                )}
                <button className="sf-btn sf-btn-close" onClick={intentarCerrarModal} disabled={isSaving} style={{ minWidth: '180px', padding: '12px 30px', opacity: isSaving ? 0.6 : 1 }}>
                  {isReadOnly ? 'CERRAR' : 'CANCELAR'}
                </button>
                 {!isReadOnly && (estadoActual === 'ACTIVA' || esRrHhOAdm) && (
                  <button
                    className="sf-btn"
                    style={{ padding: '12px 30px', minWidth: '180px', background: '#fff', border: '1px solid #cbd5e1', color: '#475569', opacity: isSaving ? 0.5 : 1 }}
                    onClick={() => registrarOActualizar(true)}
                    disabled={isSaving}
                  >
                    GUARDAR BORRADOR
                  </button>
                )}
                {!isReadOnly && (estadoActual === 'ACTIVA' || esRrHhOAdm) && (
                  <button
                    className="sf-btn sf-btn-primary"
                    onClick={() => registrarOActualizar(false)}
                    disabled={isSaving}
                    style={{ opacity: isSaving ? 0.5 : 1, minWidth: '180px', padding: '12px 30px' }}
                  >
                    {isEditing ? 'ACTUALIZAR SOLICITUD' : 'FINALIZAR REGISTRO'}
                  </button>
                )}
                {!isReadOnly && estadoActual === 'EN PROCESO' && (
                  <button
                    className="sf-btn sf-btn-success"
                    onClick={finalizarSolicitudManual}
                    disabled={isSaving}
                    style={{
                      backgroundColor: '#10b981',
                      color: 'white',
                      fontWeight: 'bold',
                      padding: '12px 30px',
                      minWidth: '180px',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                      cursor: isSaving ? 'not-allowed' : 'pointer'
                    }}
                  >
                    FINALIZAR SOLICITUD
                  </button>
                )}
              </div>
            </div>
          </div>

          {abrirReq && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '20px' }}>
              <div style={{ width: '90%', maxWidth: '1200px' }}>
                <Requisiciones
                  isOpen={abrirReq}
                  onClose={() => setAbrirReq(false)}
                  datosPredefinidos={dataParaReq}
                  currentUserProp={currentUser}
                  onSuccess={handleRequisicionFinalizada}
                />
              </div>
            </div>
          )}

          {abrirTicketModal && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
              <div style={{ width: '95%', maxWidth: '1400px' }}>
                <TicketExpress
                  isOpen={abrirTicketModal}
                  onClose={() => setAbrirTicketModal(false)}
                  datosPredefinidos={dataParaTicket}
                  onSuccess={handleTicketFinalizado}
                />
              </div>
            </div>
          )}

          {itemParaAnular && (
            <div style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 20000,
              padding: '20px',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <div style={{
                width: '100%',
                maxWidth: '480px',
                backgroundColor: 'white',
                borderRadius: '20px',
                padding: '28px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>🚫</span>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: '#0f172a' }}>
                    Anular Renglón (Sin Efecto)
                  </h3>
                </div>

                <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569', lineHeight: '1.5' }}>
                  Está marcando el renglón <strong>"{itemParaAnular.desc || 'Sin descripción'}"</strong> como sin efecto. Esta acción liberará el saldo del presupuesto y quedará registrada en la auditoría.
                </p>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Motivo de la Anulación *
                  </label>
                  <select
                    value={motivoAnulacion}
                    onChange={(e) => setMotivoAnulacion(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.875rem',
                      color: '#0f172a',
                      backgroundColor: 'white',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">Seleccione un motivo...</option>
                    <option value="No se requiere el material">No se requiere el material</option>
                    <option value="Presupuesto insuficiente">Presupuesto insuficiente</option>
                    <option value="Error de transcripción">Error de transcripción</option>
                    <option value="Duplicado">Duplicado</option>
                    <option value="Cambio de especificación">Cambio de especificación</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Justificación Detallada *
                  </label>
                  <textarea
                    value={justificacionAnulacion}
                    onChange={(e) => setJustificacionAnulacion(e.target.value)}
                    placeholder="Escriba la justificación detallada para esta anulación (mínimo 10 caracteres)..."
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.875rem',
                      color: '#0f172a',
                      outline: 'none',
                      resize: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '5px' }}>
                  <button
                    onClick={() => setItemParaAnular(null)}
                    disabled={isAnulando}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      background: 'white',
                      color: '#475569',
                      fontWeight: 'bold',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarAnulacion}
                    disabled={isAnulando}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '10px',
                      border: 'none',
                      background: '#ef4444',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)'
                    }}
                  >
                    {isAnulando ? "Anulando..." : "Confirmar Anulación"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL DE PRE-VALIDACIÓN */}
      {showPreVal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(12px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div style={{ backgroundColor: 'white', width: '450px', borderRadius: '28px', padding: '40px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', textAlign: 'center' }}>
            <div style={{ width: '70px', height: '70px', backgroundColor: '#e0f2fe', borderRadius: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 25px', color: '#0ea5e9' }}>
              <FileText size={35} />
            </div>

            <h2 style={{ fontSize: '1.6rem', color: '#0f172a', fontWeight: '800', marginBottom: '10px' }}>Nueva Solicitud</h2>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '30px', lineHeight: '1.5' }}>Seleccione la Fecha Operativa para verificar la disponibilidad de la semana.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left', marginBottom: '30px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Fecha Operativa</label>
                <input
                  type="date"
                  className="sf-input"
                  value={fechaPreVal}
                  onChange={(e) => {
                    setFechaPreVal(e.target.value);
                    setSolCheckExitosa(false);
                    setSolicitudConflictiva(null);
                    setErrorCheck('');
                  }}
                  style={{ width: '100%', padding: '12px' }}
                />
              </div>
            </div>

            {errorCheck && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', padding: '15px', borderRadius: '15px', fontSize: '13px', marginBottom: '25px', fontWeight: '500' }}>
                ⚠️ {errorCheck}
              </div>
            )}

            <div style={{ display: 'flex', gap: '15px', flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: '15px' }}>
                <button
                  onClick={() => setShowPreVal(false)}
                  style={{ flex: 1, padding: '15px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#64748b', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  CANCELAR
                </button>

                {!solCheckExitosa && !solicitudConflictiva ? (
                  <button
                    onClick={verificarDisponibilidad}
                    disabled={loadingCheck || !fechaPreVal}
                    style={{ flex: 1.5, padding: '15px', borderRadius: '16px', border: 'none', backgroundColor: '#0f172a', color: 'white', fontWeight: 'bold', cursor: (loadingCheck || !fechaPreVal) ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
                  >
                    {loadingCheck ? <Loader2 className="spinner" size={18} /> : null}
                    {loadingCheck ? 'VERIFICANDO...' : 'VERIFICAR'}
                  </button>
                ) : null}

                {(solCheckExitosa && !solicitudConflictiva) && (
                  <button
                    onClick={() => {
                      setForm({
                        id: '',
                        fecha: fechaPreVal,
                        sede: 'MARACAIBO',
                        gerencia: currentUser?.departamento || '',
                        bloque_operativo: ['operaciones', 'mantenimiento'].includes((currentUser?.departamento || '').toLowerCase()) ? (currentUser?.bloque_operativo || null) : null,
                        responsable: (['Gerente', 'Coordinador', 'Analista', 'Admin'].includes(currentUser?.rol) || currentUser?.esAdminReal)
                          ? `${currentUser.nombre} ${currentUser.apellido}`
                          : '',
                        partidas: [{ id: Date.now(), selected: false, cc: '', clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', puBs: '', puUsd: '' }],
                        imprevistos: [{ id: Date.now() + 1, selected: false, cc: '', clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', puBs: '', puUsd: '' }]
                      });
                      setIsEditing(false);
                      setIsReadOnly(false);
                      setMostrarImprevistos(false);
                      setShowPreVal(false);
                      setShowModal(true);
                    }}
                    style={{ flex: 1.5, padding: '15px', borderRadius: '16px', border: 'none', backgroundColor: '#15803d', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    CREAR NUEVA ✅
                  </button>
                )}
              </div>

              {solicitudConflictiva && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    onClick={() => {
                      setShowPreVal(false);
                      cargarDetallesYEditar({
                        ...solicitudConflictiva,
                        id_db: solicitudConflictiva.id,
                        id: solicitudConflictiva.codigo_control,
                        responsable: solicitudConflictiva.responsable_nombre,
                        gerencia: solicitudConflictiva.gerencia_nombre
                      });
                    }}
                    style={{ width: '100%', padding: '15px', borderRadius: '16px', border: 'none', backgroundColor: '#0ea5e9', color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <i className="fa-solid fa-users"></i> UNIRSE A LA SOLICITUD DE {solicitudConflictiva.responsable_nombre.toUpperCase()}
                  </button>

                  {esAdminBypass && (
                    <button
                      onClick={() => {
                        setForm({
                          id: '',
                          fecha: fechaPreVal,
                          sede: 'MARACAIBO',
                          gerencia: currentUser?.departamento || '',
                          bloque_operativo: ['operaciones', 'mantenimiento'].includes((currentUser?.departamento || '').toLowerCase()) ? (currentUser?.bloque_operativo || null) : null,
                          responsable: `${currentUser.nombre} ${currentUser.apellido}`,
                          partidas: [{ id: Date.now(), selected: false, cc: ccPreVal, clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', puBs: '', puUsd: '' }],
                          imprevistos: [{ id: Date.now() + 1, selected: false, cc: ccPreVal, clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', puBs: '', puUsd: '' }]
                        });
                        setIsEditing(false);
                        setIsReadOnly(false);
                        setMostrarImprevistos(false);
                        setShowPreVal(false);
                        setShowModal(true);
                      }}
                      style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px dashed #94a3b8', backgroundColor: '#f8fafc', color: '#475569', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      IGNORAR Y CONTINUAR (EXCEPCIÓN DE ADMINISTRADOR)
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockSmartTotalClean;
