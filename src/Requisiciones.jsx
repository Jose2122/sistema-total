import React, { useState, useEffect, useCallback, useMemo } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from './supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  Loader2, MessageSquare, FileText, Upload, Paperclip,
  ChevronDown, ChevronUp, Settings, Building2, Diamond,
  ShoppingCart, CheckCircle2, Eye, EyeOff, ChevronRight,
  Clock, User, Ban, Trash2, Camera, Plus, X, ArrowLeft, Edit2
} from 'lucide-react';
import './Requisiciones.css';

const compararNombres = (nombre1, nombre2) => {
  if (!nombre1 || !nombre2) return false;
  const clean = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, ' ').trim();
  return clean(nombre1) === clean(nombre2);
};

const Requisiciones = ({ isOpen, onClose, datosPredefinidos, onSuccess, currentUserProp }) => {
  // --- ESTADOS DEL SISTEMA ---
  const [showModal, setShowModal] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(currentUserProp || null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [gerenteDirectoCreador, setGerenteDirectoCreador] = useState(null);
  const [gerenteDirectoIdCreador, setGerenteDirectoIdCreador] = useState(null);

  const getRank = (rol) => {
    const r = (rol || '').toLowerCase();
    if (r.includes('analista')) return 1;
    if (r.includes('coordinador')) return 2;
    if (r.includes('gerente de proyecto')) return 2.5;
    if (r.includes('gerente de área') || r.includes('gerente area')) return 3;
    if (r.includes('gerente general') || r.includes('admin')) return 4;
    if (r.includes('gerente')) return 3;
    return 0;
  };

  const obtenerAprobadorProyecto = (cc, reqCreatorManager = null) => {
    // Prioridad: gerente directo del creador
    const gerenteDirecto = reqCreatorManager || currentUser?.gerente_directo_nombre;
    if (gerenteDirecto) {
      return gerenteDirecto;
    }

    if (!cc) return null;
    const ccUpper = cc.toString().toUpperCase().trim();
    
    // Si contiene "MTTO", "MAYOR" o "GRANDE"
    if (
      ccUpper.includes("MTTO") || 
      ccUpper.includes("MAYOR") || 
      ccUpper.includes("GRANDE")
    ) {
      return "Hilda Colina";
    }
    
    // Si contiene "EXCELENCIA", "VAC" o "VACCUM"
    if (
      ccUpper.includes("EXCELENCIA") || 
      ccUpper.includes("VAC") || 
      ccUpper.includes("VACCUM")
    ) {
      return "Johannel García";
    }
    
    return null;
  };


  const enviarNotificacion = async (usuario_id, mensaje, tipo = 'Sistema', requisicion_id = null) => {
    if (!usuario_id || usuario_id === currentUser?.id) return;
    try {
      const { error } = await supabase
        .from('notificaciones')
        .insert([{
          usuario_id,
          mensaje,
          tipo,
          leido: false,
          requisicion_id
        }]);
      if (error) throw error;
    } catch (err) {
      console.error("Error al enviar notificación:", err.message);
    }
  };

  const notificarSegunEstado = async (reqId, estado, correlativo, cc, gerenciaDepto, creadorNombre) => {
    try {
      if (estado === 'pendiente_proyecto') {
        // Intentar obtener el creador y su gerente directo asignado
        const { data: reqData } = await supabase
          .from('requisiciones')
          .select('user_id')
          .eq('id', reqId)
          .single();

        let gerenteDirectoId = null;
        if (reqData?.user_id) {
          const { data: perfilCreador } = await supabase
            .from('perfiles')
            .select('gerente_directo_id')
            .eq('id', reqData.user_id)
            .single();
          if (perfilCreador?.gerente_directo_id) {
            gerenteDirectoId = perfilCreador.gerente_directo_id;
          }
        }

        if (gerenteDirectoId) {
          // Notificar solo al gerente directo
          await enviarNotificacion(
            gerenteDirectoId,
            `Nueva Requisición ${correlativo} de ${creadorNombre} requiere su aprobación de Proyecto.`,
            'Aprobación Pendiente',
            reqId
          );
        } else {
          // Si no hay gerente directo, notificar a los gerentes asociados a la obra
          const { data: gerentesProyecto } = await supabase
            .from('perfiles')
            .select('id')
            .contains('obras_asignadas', [cc])
            .ilike('rol', '%proyecto%');
          if (gerentesProyecto && gerentesProyecto.length > 0) {
            for (const gp of gerentesProyecto) {
              await enviarNotificacion(
                gp.id,
                `Nueva Requisición ${correlativo} de ${creadorNombre} requiere su aprobación de Proyecto.`,
                'Aprobación Pendiente',
                reqId
              );
            }
          }
        }
      } else if (estado === 'pendiente_area') {
        const { data: gerentesArea } = await supabase
          .from('perfiles')
          .select('id, rol')
          .eq('departamento', gerenciaDepto);
        if (gerentesArea) {
          const areaManagers = gerentesArea.filter(g => {
            const r = (g.rol || '').toLowerCase();
            return (r.includes('área') || r.includes('area') || g.rol === 'Gerente') && !r.includes('proyecto');
          });
          for (const g of areaManagers) {
            await enviarNotificacion(
              g.id,
              `Nueva Requisición ${correlativo} de ${creadorNombre} requiere su aprobación de Área.`,
              'Aprobación Pendiente',
              reqId
            );
          }
        }
      } else if (estado === 'enviada_general') {
        const { data: carlos } = await supabase
          .from('perfiles')
          .select('id')
          .ilike('rol', 'Gerente General')
          .limit(1)
          .single();
        if (carlos) {
          await enviarNotificacion(
            carlos.id,
            `Nueva Requisición ${correlativo} de ${creadorNombre} requiere su Aprobación Final.`,
            'Aprobación Pendiente',
            reqId
          );
        }
      }
    } catch (err) {
      console.error("Error al enviar notificaciones de estado:", err);
    }
  };

  const formatName = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 1) return fullName;
    const firstName = parts[0];
    // Buscamos el primer apellido. Si hay más de 2 partes, intentamos ser inteligentes,
    // pero la petición es "Primer nombre y primer apellido", así que tomamos parts[1]
    // a menos que parts[1] sea una partícula como "de", "la", etc. (simplificamos por ahora)
    const firstLastName = parts[1];
    return `${firstName} ${firstLastName}`;
  };

  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  // --- NUEVOS ESTADOS PARA FILTROS ---
  const [busqueda, setBusqueda] = useState('');
  const [filtroDepto, setFiltroDepto] = useState('Todos');
  const [filtroAprobacion, setFiltroAprobacion] = useState('Todos');
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  const [filtroCC, setFiltroCC] = useState('Todos');
  const [filtroStatusCompra, setFiltroStatusCompra] = useState('Todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [filtroSolicitante, setFiltroSolicitante] = useState('Todos');
  const [listaSubordinados, setListaSubordinados] = useState([]);
  const [listaGerencias, setListaGerencias] = useState([
    "Administración Maracaibo", "Administración El Tigre", "Dirección Corporativa", "Operaciones", "Mantenimiento",
    "Seguridad", "Recursos Humanos", "Estimación", "Almacén", "Gerencia General",
    "Servicios Generales", "Contabilidad"
  ]);
  const [showRechazoModal, setShowRechazoModal] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [rechazoAction, setRechazoAction] = useState(null); // 'proyecto', 'area' o 'general'
  const [expandirHistorial, setExpandirHistorial] = useState({}); // { itemID: boolean }
  const [editandoObs, setEditandoObs] = useState(false);
  const [obsTemporal, setObsTemporal] = useState('');
  const [uploading, setUploading] = useState(false);
  const [facturasUrls, setFacturasUrls] = useState([]);
  const editandoIdRef = React.useRef(editandoId);
  useEffect(() => {
    editandoIdRef.current = editandoId;
  }, [editandoId]);
  const [idReferenciaProyecto, setIdReferenciaProyecto] = useState('');
  const [idsReferenciaPrevios, setIdsReferenciaPrevios] = useState([]);
  const [mostrarTimeline, setMostrarTimeline] = useState(false);
  const [mostrarSoportes, setMostrarSoportes] = useState(false);
  const [mostrarObservaciones, setMostrarObservaciones] = useState(false);

  // --- MAESTROS ---
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [todasClasificaciones, setTodasClasificaciones] = useState([]);
  const [todasCategorias, setTodasCategorias] = useState([]);

  // --- LÓGICA DE CARGA DE USUARIO ACTUAL ---
  const obtenerSesionUsuario = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data: perfil } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single();
      if (perfil) setCurrentUser({ ...perfil, departamento: (perfil.departamento || '').trim(), rol: (perfil.rol || '').trim() });
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    if (currentUserProp) {
      setCurrentUser(currentUserProp);
    } else {
      obtenerSesionUsuario();
    }
  }, [currentUserProp, obtenerSesionUsuario]);

  // --- LÓGICA DE CARGA DESDE SUPABASE CON FILTROS JERÁRQUICOS POR FASE ---
  const cargarHistorialDesdeBD = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      let query = supabase.from('requisiciones').select('*');

      const rolUpper = (currentUser.rol || '').toUpperCase();
      const deptoUpper = (currentUser.departamento || '').toUpperCase();
      const tienePermisoDepto = currentUser.capacidades?.ver_departamento === true;

      // José es el ÚNICO SuperAdmin (Borrar/Anular)
      const emailLower = (currentUser?.correo || '').toLowerCase();
      const esJose = emailLower === 'jcontreras.totalclean@gmail.com';
      const esAdminReal = esJose ||
        emailLower === 'cvega.totalclean@gmail.com' ||
        emailLower === 'cvega@totalclean.com' ||
        emailLower === 'karincmm1@gmail.com';

      const emailActual = (currentUser?.correo || '').toLowerCase();
      const esGG = rolUpper.includes('GERENTE') || rolUpper.includes('ADMIN') || emailActual === 'cvega@totalclean.com' || emailActual === 'cvega.totalclean@gmail.com';
      // --- NUEVA LÓGICA DE SEGURIDAD JERÁRQUICA (SOLICITUD 24/04) ---
      const rolUserLower = (currentUser.rol || '').toLowerCase();
      const deptoUserLower = (currentUser.departamento || '').toLowerCase();

      const esAdminRealOCarlos = esAdminReal ||
        (currentUser.correo || '').toLowerCase() === 'cvega@totalclean.com' ||
        (currentUser.nombre || '').toLowerCase().includes('carlos') ||
        currentUser.capacidades?.ver_requisiciones_global === true;

      if (!esAdminRealOCarlos) {
        const rawUserId = currentUser.id || '';
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawUserId);
        const userIdMatch = isUUID ? rawUserId : '00000000-0000-0000-0000-000000000000';

        const deptoMatch = currentUser.departamento;
        const nombreMatch = (currentUser.nombre || '').split(' ')[0] || 'Unknown';

        // Soporte para Gerentes de Proyecto (Filtro por obras asignadas)
        const misObras = currentUser.obras_asignadas || [];
        const obrasFiltro = misObras.length > 0 ? `centro_costo.in.(${misObras.map(o => `"${o}"`).join(',')})` : '';

        if (rolUserLower.includes('analista')) {
          // 1. ANALISTAS: Ven sus PROPIAS requisiciones + Obras Asignadas
          let orQ = `user_id.eq.${userIdMatch},solicitante.ilike.%${nombreMatch}%`;
          if (obrasFiltro) orQ += `,${obrasFiltro}`;
          query = query.or(orQ);

        } else if (rolUserLower.includes('gerente') || rolUserLower.includes('coordinador')) {
          // 2. GERENTES DE ÁREA/PROYECTO: Ven su DEPARTAMENTO Y sus OBRAS ASIGNADAS (AND, no OR)
          if (deptoMatch) {
            query = query.ilike('gerencia', `%${deptoMatch}%`);
          }
          if (misObras.length > 0) {
            query = query.in('centro_costo', misObras);
          }
          if (!deptoMatch && misObras.length === 0) {
            // Seguridad de respaldo
            query = query.or(`user_id.eq.${userIdMatch},solicitante.ilike.%${nombreMatch}%`);
          }
        }
      }

      const { data, error } = await query.order('fecha_emision', { ascending: false });

      if (error) throw error;
      if (data) {
        let finalData = data;
        const myRank = getRank(currentUser.rol);

        const historialMapeado = finalData.map(db => ({
          id: db.id,
          correlativo: db.correlativo_req || `REQ-${String(db.id).padStart(3, '0')}`,
          origen: db.origen || 'Manual',
          solicitante: db.solicitante,
          centroCosto: db.centro_costo,
          aprobacion: db.aprobacion_nombre || (db.aprobacion ? 'Aprobado' : 'Pendiente'),
          status: db.status_compra || 'Pendiente',
          prioridad: db.prioridad || 'Normal',
          total: Number(db.total_bs) || 0,
          detalles: db.items,
          fecha: db.fecha_emision ? db.fecha_emision.split('T')[0] : '',
          justificacion: db.justificacion,
          fecha_requerida: db.fecha_requerida,
          gerencia: db.gerencia,
          aprobado_gerente_area: db.aprobado_gerente_area || false,
          aprobado_gerente_general: db.aprobado_gerente_general || false,
          aprobado_gerente_proyecto: db.aprobado_gerente_proyecto || false,
          estado_aprobacion: db.estado_aprobacion || 'pendiente_area',
          motivo_rechazo: db.motivo_rechazo || '',
          firma_gerente_general: db.firma_gerente_general,
          observaciones: db.observaciones || '',
          observaciones_direccion: db.observaciones_direccion || '',
          facturas_url: db.facturas_url || [],
          id_referencia_proyecto: db.id_referencia_proyecto || '',
          user_id: db.user_id,
          fecha_emision: db.fecha_emision,
          f_aprobacion_proyecto: db.f_aprobacion_proyecto,
          n_aprobacion_proyecto: db.n_aprobacion_proyecto,
          f_aprobacion_area: db.f_aprobacion_area,
          n_aprobacion_area: db.n_aprobacion_area,
          f_aprobacion_general: db.f_aprobacion_general,
          n_aprobacion_general: db.n_aprobacion_general,
          f_culminacion_compras: db.f_culminacion_compras,
          f_inicio_compras: db.f_inicio_compras,
          fecha_limite_compra: db.fecha_limite_compra,
          is_pausada: db.is_pausada,
          motivo_postergacion: db.motivo_postergacion,
          con_iva: db.con_iva !== false
        }));
        setHistorial(historialMapeado);

        // Extraer subordinados y gerencias únicas
        const subords = [...new Set(historialMapeado.map(h => h.solicitante))].sort();
        setListaSubordinados(subords);

        const gerencias = [...new Set(historialMapeado.map(h => h.gerencia))].sort();
        setListaGerencias(gerencias);

        // Por defecto para Gerentes: mostrar lo que tienen pendiente
        if (myRank === 2.5 && filtroAprobacion === 'Todos') setFiltroAprobacion('pendiente_proyecto');
        if (myRank === 3 && filtroAprobacion === 'Todos') setFiltroAprobacion('pendiente_area');
        if (myRank === 4 && filtroAprobacion === 'Todos') setFiltroAprobacion('enviada_general');

        // Extraer IDs de referencia únicos para el datalist
        const prevIds = [...new Set(data.map(db => db.id_referencia_proyecto).filter(id => id))];
        setIdsReferenciaPrevios(prevIds);
      }
    } catch (err) {
      console.error("Error cargando historial:", err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const cargarMasters = useCallback(async () => {
    const { data: dataCC } = await supabase.from('maestros_centros_costo').select('id, nombre').eq('activo', true).order('nombre');
    if (dataCC) setCentrosCosto(dataCC);

    const { data: dataClas } = await supabase.from('maestros_clasificaciones').select('id, nombre, centro_costo_id').eq('activo', true);
    if (dataClas) setTodasClasificaciones(dataClas.map(c => ({ id: c.id, nombre: c.nombre, padreId: c.centro_costo_id })));

    const { data: dataSub } = await supabase.from('maestros_sub_clasificaciones').select('id, nombre, clasificacion_id').eq('activo', true);
    if (dataSub) setTodasCategorias(dataSub.map(s => ({ id: s.id, nombre: s.nombre, padreId: s.clasificacion_id })));
  }, []);

  useEffect(() => { obtenerSesionUsuario(); }, [obtenerSesionUsuario]);
  useEffect(() => {
    cargarHistorialDesdeBD();
    cargarMasters();

    // SUSCRIPCIÓN REALTIME PARA OBS Y SOPORTES
    const channel = supabase
      .channel('requisiciones_realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'requisiciones'
      }, (payload) => {
        setHistorial(prev => prev.map(req => {
          if (req.id === payload.new.id) {
            return {
              ...req,
              observaciones: payload.new.observaciones || '',
              observaciones_direccion: payload.new.observaciones_direccion || '',
              facturas_url: payload.new.facturas_url || [],
              detalles: payload.new.items || []
            };
          }
          return req;
        }));
        if (editandoIdRef.current === payload.new.id) {
          setRenglones(payload.new.items || []);
        }
      })
      .subscribe();

    // --- DEEP LINKING LISTENER ---
    const handleDeepLink = (e) => {
      const targetId = e.detail;
      if (targetId && historial.length > 0) {
        const targetReq = historial.find(h => h.id === targetId || String(h.id) === String(targetId));
        if (targetReq) {
          verRequisicion(targetReq);
        }
      }
    };
    window.addEventListener('abrirRequisicionDeepLink', handleDeepLink);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('abrirRequisicionDeepLink', handleDeepLink);
    };
  }, [cargarHistorialDesdeBD]);

  // --- LÓGICA DE FILTRADO EN TIEMPO REAL ---
  const historialFiltrado = useMemo(() => {
    return historial.filter(req => {
      const matchTexto =
        req.solicitante.toLowerCase().includes(busqueda.toLowerCase()) ||
        req.correlativo.toLowerCase().includes(busqueda.toLowerCase());

      const matchDepto = filtroDepto === 'Todos' || req.gerencia === filtroDepto;
      const matchStatus = filtroAprobacion === 'Todos' || 
        (filtroAprobacion === 'pendientes_especiales' 
          ? ['pendiente_proyecto', 'pendiente_area', 'enviada_general', 'rechazada', 'ANULADA'].includes(req.estado_aprobacion)
          : filtroAprobacion === 'pendientes_de_aprobacion'
            ? ['pendiente_proyecto', 'pendiente_area', 'enviada_general'].includes(req.estado_aprobacion)
            : filtroAprobacion === 'rechazadas_y_anuladas'
              ? ['rechazada', 'ANULADA'].includes(req.estado_aprobacion)
              : req.estado_aprobacion === filtroAprobacion);
      const matchCategoria = filtroCategoria === 'Todos' || (req.detalles && req.detalles.some(d => d.categoria === filtroCategoria));
      const matchCC = filtroCC === 'Todos' || req.centroCosto.includes(filtroCC);
      const matchStatusCompra = filtroStatusCompra === 'Todos' || req.status.toUpperCase() === filtroStatusCompra.toUpperCase();
      const matchSolicitante = filtroSolicitante === 'Todos' || req.solicitante === filtroSolicitante;

      let matchFecha = true;
      if (fechaDesde && req.fecha < fechaDesde) matchFecha = false;
      if (fechaHasta && req.fecha > fechaHasta) matchFecha = false;

      return matchTexto && matchDepto && matchStatus && matchCategoria && matchCC && matchStatusCompra && matchFecha && matchSolicitante;
    }).sort((a, b) => {
      const aEmergenciaPendiente = a.prioridad === 'Emergencia' && !( (a.estado_aprobacion === 'aprobado_final' && a.status?.toUpperCase() === 'COMPLETADO') || a.estado_aprobacion === 'ANULADA' );
      const bEmergenciaPendiente = b.prioridad === 'Emergencia' && !( (b.estado_aprobacion === 'aprobado_final' && b.status?.toUpperCase() === 'COMPLETADO') || b.estado_aprobacion === 'ANULADA' );

      const aEmergenciaFin = a.prioridad === 'Emergencia' && ( (a.estado_aprobacion === 'aprobado_final' && a.status?.toUpperCase() === 'COMPLETADO') || a.estado_aprobacion === 'ANULADA' );
      const bEmergenciaFin = b.prioridad === 'Emergencia' && ( (b.estado_aprobacion === 'aprobado_final' && b.status?.toUpperCase() === 'COMPLETADO') || b.estado_aprobacion === 'ANULADA' );

      // 1. Emergencias pendientes primero
      if (aEmergenciaPendiente && !bEmergenciaPendiente) return -1;
      if (!aEmergenciaPendiente && bEmergenciaPendiente) return 1;

      // 2. Emergencias completadas/anuladas al final
      if (aEmergenciaFin && !bEmergenciaFin) return 1;
      if (!aEmergenciaFin && bEmergenciaFin) return -1;

      // 3. Luego por fecha desc
      return new Date(b.fecha) - new Date(a.fecha);
    });
  }, [historial, busqueda, filtroDepto, filtroAprobacion, filtroCategoria, filtroCC, filtroStatusCompra, fechaDesde, fechaHasta, filtroSolicitante]);

  // --- ESTADOS DEL FORMULARIO ---
  const [prioridad, setPrioridad] = useState('');
  const [solicitante, setSolicitante] = useState('');
  const [centroCosto, setCentroCosto] = useState('MTTO MAYOR-BOSCAN');
  const [departamento, setDepartamento] = useState('Operaciones');
  const [justificacion, setJustificacion] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [observacionesDireccion, setObservacionesDireccion] = useState('');
  const [fechaRequerida, setFechaRequerida] = useState(new Date().toISOString().split('T')[0]);
  const [renglones, setRenglones] = useState([
    { id: Date.now(), clasificacion: '', categoria: '', cant: 1, uni: 'UNID', descripcion: '', beneficiario: '', pu: 0, total: 0, status: 'En Espera' }
  ]);
  const [previewCorrelativo, setPreviewCorrelativo] = useState('');
  const [conIva, setConIva] = useState(true);

  const manejarCambioIdProyecto = (e) => {
    let valor = e.target.value.toUpperCase();

    // Si el usuario está borrando, permitimos cualquier entrada
    if (e.nativeEvent.inputType === 'deleteContentBackward') {
      setIdReferenciaProyecto(valor);
      return;
    }

    // Aplicar máscara básica XXX-0000-0000
    // Las letras iniciales
    if (valor.length <= 3) {
      valor = valor.replace(/[^A-Z]/g, '');
    } else if (valor.length === 4 && valor[3] !== '-') {
      valor = valor.slice(0, 3) + '-' + valor[3];
    } else if (valor.length > 4 && valor.length <= 8) {
      const parteNumerica = valor.slice(4).replace(/[^0-9]/g, '');
      valor = valor.slice(0, 4) + parteNumerica;
    } else if (valor.length === 9 && valor[8] !== '-') {
      valor = valor.slice(0, 8) + '-' + valor[8];
    } else if (valor.length > 9) {
      // Dejar que siga escribiendo libremente pero validando números en el segundo segmento
      const prefix = valor.slice(0, 9);
      const rest = valor.slice(9);
      valor = prefix + rest;
    }

    setHasChanges(true);
    setIdReferenciaProyecto(valor);
  };

  // --- LISTAS DE REFERENCIA ---
  const listaCentrosCostos = centrosCosto;

  const mappingSiglasGerencia = {
    "Administración Maracaibo": "ADM-MCB",
    "Administración El Tigre": "ADM-TGR",
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

  const obtenerSiglaGerencia = (depto) => {
    if (!depto) return 'GER';
    const norm = depto.trim().toLowerCase();
    if (norm.startsWith('estimac') || norm.startsWith('estimación')) {
      return 'EST';
    }
    return mappingSiglasGerencia[depto] || 'GER';
  };

  const obtenerEstructuraCorrelativo = (depto, user) => {
    const sigla = obtenerSiglaGerencia(depto);
    const aa = new Date().getFullYear().toString().slice(-2);
    
    if (depto && depto.toLowerCase() === 'operaciones') {
      const bloque = (user?.bloque_operativo || '').toLowerCase();
      if (bloque.includes('mantenimiento mayor') || bloque.includes('mtto') || bloque.includes('mantenimiento')) {
        return {
          likePattern: `OPE-MTT-${aa}-%`,
          prefix: `OPE-MTT-${aa}-`
        };
      }
      if (bloque.includes('excelencia') || bloque.includes('vacuum') || bloque.includes('exva')) {
        return {
          likePattern: `OPE-EXVA-${aa}-%`,
          prefix: `OPE-EXVA-${aa}-`
        };
      }
    }
    
    return {
      likePattern: `RR-${sigla}-${aa}-%`,
      prefix: `RR-${sigla}-${aa}-`
    };
  };

  const GERENCIAS_ESTATICAS = [
    "Administración Maracaibo", "Administración El Tigre", "Dirección Corporativa", "Operaciones", "Mantenimiento",
    "Seguridad", "Recursos Humanos", "Estimación", "Almacén", "Gerencia General",
    "Servicios Generales", "Contabilidad"
  ];

  const unidades = ["UNID", "KG", "LTS", "ML", "M2", "M3", "SERV", "SG", "BOLSAS", "VIAJES", "Gal", "Sacos", "Rollo", "Pipa", "Jgo"];

  const calcularTotales = () => {
    const arraySeguro = Array.isArray(renglones) ? renglones : [];

    // Estimado: Cantidad original por precio estimado
    const subTotalEstimado = arraySeguro.reduce((acc, r) => {
      const cantOri = Number(r.cantidad_pedida ?? r.cant) || 0;
      const puEst = Number(r.pu_estimado ?? r.pu) || 0;
      return acc + (cantOri * puEst);
    }, 0);

    // Ejecutado: Suma de historiales
    const subTotalEjecutado = arraySeguro.reduce((acc, r) => {
      const historialArray = Array.isArray(r.historial_compras) ? r.historial_compras : [];
      const ejecutadoItem = historialArray.reduce((sum, h) => {
        if (h.tipo === 'JUSTIFICACION' || h.tipo === 'ANULACION') return sum;
        return sum + ((Number(h.cant) || 0) * (Number(h.pu) || 0));
      }, 0);
      return acc + ejecutadoItem;
    }, 0);

    const totalEstimado = subTotalEstimado * (conIva ? 1.16 : 1.00);
    const totalEjecutado = subTotalEjecutado * (conIva ? 1.16 : 1.00);

    return { subTotalEstimado, subTotalEjecutado, totalEstimado, totalEjecutado };
  };

  const { subTotalEstimado, subTotalEjecutado, totalEstimado, totalEjecutado } = calcularTotales();

  const obtenerEstadoGlobal = () => {
    const arraySeguro = Array.isArray(renglones) ? renglones : [];
    if (arraySeguro.length === 0) return { texto: 'SIN ITEMS', color: '#94a3b8' };
    const todosCompletados = arraySeguro.every(r => r.status === 'Completado');
    const algunoEnProceso = arraySeguro.some(r => r.status === 'Parcial' || r.status === 'Completado');
    if (todosCompletados) return { texto: 'COMPLETADO', color: '#22c55e' };
    if (algunoEnProceso) return { texto: 'PARCIAL', color: '#f59e0b' };
    return { texto: 'EN ESPERA', color: '#64748b' };
  };

  const estadoGlobal = obtenerEstadoGlobal();

  // --- EFECTOS DE SINCRONIZACIÓN ---
  useEffect(() => {
    if (isOpen) {
      if (currentUser) {
        const full = `${currentUser.nombre || ''} ${currentUser.apellido || ''}`.trim();
        setSolicitante(full);
      }

      if (datosPredefinidos) {
        if (datosPredefinidos.isExistingRequisition) {
          verRequisicion(datosPredefinidos.req);
        } else {
          setDepartamento(datosPredefinidos.gerencia_solicitante || datosPredefinidos.gerencia || 'Operaciones');
          setJustificacion(datosPredefinidos.justificacion || '');
          setObservaciones(datosPredefinidos.observaciones || '');
          setIdReferenciaProyecto(datosPredefinidos.id_referencia_proyecto || '');
          setCentroCosto(datosPredefinidos.centro_costo || '');

          if (datosPredefinidos.partidasSeleccionadas) {
            const nuevosRenglones = datosPredefinidos.partidasSeleccionadas.map((p, idx) => ({
              id: Date.now() + idx,
              clasificacion: p.clasif || '',
              categoria: p.cat || '',
              cant: Number(p.cant) || 1,
              uni: p.uni || 'UNID',
              descripcion: p.desc || '',
              beneficiario: p.ben || '',
              pu: Number(p.puUsd || p.puBs || 0),
              total: (Number(p.cant) || 1) * Number(p.puUsd || p.puBs || 0),
              status: 'En Espera'
            }));
            setRenglones(nuevosRenglones);
          }
        }
      } else if (currentUser) {
        setSolicitante(`${currentUser.nombre} ${currentUser.apellido}`);
        setDepartamento(currentUser.departamento);
      }
      setShowModal(true);
    }
  }, [isOpen, datosPredefinidos, currentUser]);

  useEffect(() => {
    const actualizarPreview = async () => {
      if (!showModal || editandoId) return;
      const { likePattern, prefix } = obtenerEstructuraCorrelativo(departamento, currentUser);

      const { data } = await supabase
        .from('requisiciones')
        .select('correlativo_req')
        .like('correlativo_req', likePattern)
        .order('correlativo_req', { ascending: false })
        .limit(1);

      let max = 0;
      if (data && data.length > 0) {
        const correlativoMax = data[0].correlativo_req;
        const partes = correlativoMax.split('-');
        if (partes.length >= 1) {
          const num = parseInt(partes[partes.length - 1], 10);
          if (!isNaN(num)) max = num;
        }
      }
      setPreviewCorrelativo(`${prefix}${String(max + 1).padStart(4, '0')}`);
    };
    actualizarPreview();
  }, [departamento, showModal, editandoId, currentUser]);

  // --- MANEJADORES DE ACCIÓN ---
  const actualizarFila = (id, campo, valor) => {
    setHasChanges(true);
    setRenglones(prev => prev.map(f => {
      if (f.id === id) {
        let v = valor;
        if (campo === 'cant' || campo === 'pu') {
          // Si el valor es vacío o solo un cero, lo dejamos como cadena vacía para permitir escribir
          if (valor === '' || valor === '0') v = '';
          else v = Math.max(0, Number(valor) || 0);
        }
        const act = { ...f, [campo]: v };
        if (campo === 'clasificacion') act.categoria = ''; // Reset hijo
        if (campo === 'pu') act.pu_estimado = v;
        act.total = act.cant * act.pu;
        return act;
      }
      return f;
    }));
  };

  const duplicarRenglon = (id) => {
    const original = renglones.find(r => r.id === id);
    if (!original) return;
    const nuevo = {
      ...original,
      id: Date.now() + Math.random(),
      descripcion: '', // Se deja vacío para edición manual
      cant: 1,
      pu: 0,
      total: 0,
      status: 'En Espera'
    };
    const index = renglones.findIndex(r => r.id === id);
    const nuevosRenglones = [...renglones];
    nuevosRenglones.splice(index + 1, 0, nuevo);
    setHasChanges(true);
    setRenglones(nuevosRenglones);
  };

  const liberarPartidasFondos = async (requisicionId) => {
    try {
      const { error } = await supabase
        .from('partidas_fondos')
        .update({ status: 'Disponible', requisicion_id: null })
        .eq('requisicion_id', requisicionId);
      if (error) throw error;
    } catch (err) {
      console.error("Error al liberar partidas:", err.message);
    }
  };

  const anularRequisicion = async (id) => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '500' }}>¿Estás seguro de ANULAR esta requisición? Los renglones asociados en Fondos quedarán disponibles nuevamente.</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => { toast.dismiss(t.id); ejecutarAnularRequisicion(id); }}
            style={{ padding: '4px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            SÍ, ANULAR
          </button>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>NO</button>
        </div>
      </div>
    ), { duration: 6000, position: 'top-center' });
  };

  const ejecutarAnularRequisicion = async (id) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('requisiciones')
        .update({ estado_aprobacion: 'ANULADA', aprobacion_nombre: 'REQ. ANULADA' })
        .eq('id', id);
      if (error) throw error;

      await liberarPartidasFondos(id);

      // NOTIFICAR AL SOLICITANTE
      const reqAnulada = historial.find(h => h.id === id);
      if (reqAnulada) {
        await enviarNotificacion(reqAnulada.user_id, `Tu Requisición ${reqAnulada.correlativo} ha sido ANULADA.`, 'Anulación', id);
      }

      setHistorial(prev => prev.map(req => req.id === id ? { ...req, estado_aprobacion: 'ANULADA' } : req));
      toast.success('Requisición ANULADA correctamente.');
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  const manejarEliminar = async (id) => {
    if (currentUser?.correo?.toLowerCase() !== 'jcontreras.totalclean@gmail.com') {
      toast.error("Solo el Administrador jcontreras.totalclean@gmail.com tiene permisos para eliminar requisiciones.");
      return;
    }
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '500' }}>¿Eliminar esta requisición de forma permanente? Esta acción liberará los renglones en Fondos.</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => { toast.dismiss(t.id); ejecutarEliminarRequisicion(id); }}
            style={{ padding: '4px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            SÍ, ELIMINAR
          </button>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>CANCELAR</button>
        </div>
      </div>
    ), { duration: 6000, position: 'top-center' });
  };

  const ejecutarEliminarRequisicion = async (id) => {
    if (currentUser?.correo?.toLowerCase() !== 'jcontreras.totalclean@gmail.com') {
      toast.error("Solo el Administrador jcontreras.totalclean@gmail.com tiene permisos para eliminar requisiciones.");
      return;
    }
    setLoading(true);
    try {
      await liberarPartidasFondos(id);
      const { error } = await supabase.from('requisiciones').delete().eq('id', id);
      if (error) throw error;
      toast.success("Eliminada correctamente.");
      await cargarHistorialDesdeBD();
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  const puedeModificarRequisicion = (req) => {
    if (!req) return false;
    const esAdmin = currentUser?.esSuperAdmin || currentUser?.esAdminReal;
    if (esAdmin) return true;
    return (req.gerencia || '').toLowerCase() === (currentUser?.departamento || '').toLowerCase();
  };

  const resetearFormulario = () => {
    setJustificacion('');
    setObservaciones('');
    setObservacionesDireccion('');
    setIdReferenciaProyecto('');
    setEditandoId(null);
    setFechaRequerida(new Date().toISOString().split('T')[0]);
    setPrioridad('');
    setRenglones([{ id: Date.now(), clasificacion: '', categoria: '', cant: 1, uni: 'UNID', descripcion: '', beneficiario: '', pu: 0, total: 0, status: 'En Espera' }]);
    setModoEdicion(false);
    setHasChanges(false);
    setMostrarSoportes(false);
    setConIva(true);
    setGerenteDirectoCreador(null);
    setGerenteDirectoIdCreador(null);
  };

  const verRequisicion = (req) => {
    setEditandoId(req.id);
    setPrioridad(req.prioridad);
    setJustificacion(req.justificacion);
    setObservaciones(req.observaciones);
    setObservacionesDireccion(req.observaciones_direccion || '');
    setIdReferenciaProyecto(req.id_referencia_proyecto || '');
    setFacturasUrls(req.facturas_url || []);
    setFechaRequerida(req.fecha_requerida || req.fecha || req.fecha_emision);
    setDepartamento(req.gerencia || 'Operaciones');
    setGerenteDirectoCreador(null);
    setGerenteDirectoIdCreador(null);

    if (req.user_id) {
      supabase.from('perfiles')
        .select('gerente_directo_nombre, gerente_directo_id')
        .eq('id', req.user_id)
        .single()
        .then(({ data }) => {
          if (data) {
            setGerenteDirectoCreador(data.gerente_directo_nombre || null);
            setGerenteDirectoIdCreador(data.gerente_directo_id || null);
          }
        })
        .catch(err => console.error("Error al cargar gerente directo del creador:", err));
    }

    // SANITIZACIÓN DE DATOS (Raíz del problema)
    let detallesSeguros = [];
    const itemsRaw = req.detalles || req.items || [];
    if (typeof itemsRaw === 'string') {
      try {
        detallesSeguros = JSON.parse(itemsRaw);
        // Sometimes it's double stringified
        if (typeof detallesSeguros === 'string') {
          detallesSeguros = JSON.parse(detallesSeguros);
        }
      } catch (e) {
        detallesSeguros = [];
      }
    } else if (Array.isArray(itemsRaw)) {
      detallesSeguros = itemsRaw;
    }

    setRenglones(detallesSeguros);
    setCentroCosto(req.centroCosto || req.centro_costo);
    setSolicitante(req.solicitante || `${req.solicitante_nombre || ''} ${req.solicitante_apellido || ''}`);
    setModoEdicion(false);
    setHasChanges(false);
    setMostrarSoportes(detallesSeguros.length > 0 && (req.facturas_url?.length > 0));
    setConIva(req.con_iva !== false);
    setShowModal(true);
  };

  const manejarRechazarGerenteProyecto = () => {
    if (!editandoId) return;
    const reqActual = historial.find(h => String(h.id) === String(editandoId));
    if (!reqActual) return;

    const rolUser = (currentUser?.rol || '').toLowerCase();
    const cc = reqActual.centro_costo || '';
    const gerenteEsperado = obtenerAprobadorProyecto(cc, gerenteDirectoCreador);
    const esAdmin = currentUser?.esAdminReal ||
      rolUser.includes('admin') ||
      rolUser.includes('general') ||
      (currentUser?.correo || '').toLowerCase() === 'cvega@totalclean.com' ||
      (currentUser?.correo || '').toLowerCase() === 'cvega.totalclean@gmail.com';

    let puedeRechazar = false;
    if (esAdmin) {
      puedeRechazar = true;
    } else {
      if (gerenteDirectoIdCreador && currentUser?.id === gerenteDirectoIdCreador) {
        puedeRechazar = true;
      } else if (gerenteEsperado === 'Johannel García') {
        puedeRechazar = currentUser?.nombre?.toUpperCase().includes('JOHANNEL');
      } else if (gerenteEsperado === 'Hilda Colina') {
        puedeRechazar = currentUser?.nombre?.toUpperCase().includes('HILDA');
      } else if (gerenteEsperado) {
        const miNombre = `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim();
        puedeRechazar = compararNombres(miNombre, gerenteEsperado) || rolUser.includes('proyecto');
      } else {
        puedeRechazar = rolUser.includes('proyecto') || (rolUser.includes('gerente') && currentUser?.departamento === reqActual?.gerencia);
      }
    }

    if (!puedeRechazar) {
      toast.error('Solo el Gerente de Proyecto correspondiente tiene permisos para rechazar esta requisición.');
      return;
    }

    setMotivoRechazo('');
    setRechazoAction('proyecto');
    setShowRechazoModal(true);
  };

  const manejarRechazarGerenteArea = () => {
    if (!editandoId || !currentUser?.rol?.toLowerCase()?.includes('gerente')) return;
    setMotivoRechazo('');
    setRechazoAction('area');
    setShowRechazoModal(true);
  };

  const manejarRechazarGeneral = () => {
    const rolUpper = (currentUser?.rol || '').toUpperCase();
    const emailLower = (currentUser?.correo || '').toLowerCase();
    const esAdminPermitido = currentUser?.esAdminReal ||
      rolUpper.includes('GERENTE') ||
      rolUpper.includes('ADMIN') ||
      emailLower === 'cvega@totalclean.com' ||
      emailLower === 'cvega.totalclean@gmail.com';

    if (!editandoId || !esAdminPermitido) return;
    setMotivoRechazo('');
    setRechazoAction('general');
    setShowRechazoModal(true);
  };

  const confirmRechazo = async () => {
    if (!motivoRechazo.trim()) return toast.error('El motivo de rechazo es obligatorio.');

    setLoading(true);
    try {
      let updatePayload = {
        estado_aprobacion: 'rechazada',
        motivo_rechazo: motivoRechazo,
      };

      if (rechazoAction === 'proyecto') {
        updatePayload.aprobacion_nombre = 'Rechazado por Proyecto';
        updatePayload.aprobado_gerente_proyecto = false;
      } else if (rechazoAction === 'area') {
        updatePayload.aprobacion_nombre = 'Rechazado por Área';
        updatePayload.aprobado_gerente_area = false;
      } else {
        updatePayload.aprobacion_nombre = 'Rechazado por General';
        updatePayload.aprobado_gerente_general = false;
      }

      const { error } = await supabase.from('requisiciones').update(updatePayload).eq('id', editandoId);
      if (error) throw error;

      // Log the rejection event in requisicion_logs
      await supabase.from('requisicion_logs').insert([{
        requisicion_id: editandoId,
        usuario_id: currentUser?.id,
        usuario_nombre: `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim() || 'Aprobador',
        accion: 'RECHAZADA',
        comentario: motivoRechazo
      }]);

      toast.success('Requisición rechazada.');

      // NOTIFICAR AL SOLICITANTE
      const reqRechazada = historial.find(h => h.id === editandoId);
      if (reqRechazada) {
        await enviarNotificacion(reqRechazada.user_id, `Tu Requisición ${reqRechazada.correlativo} ha sido RECHAZADA. Motivo: ${motivoRechazo}`, 'Rechazo', editandoId);
      }

      await cargarHistorialDesdeBD();
      setShowRechazoModal(false);
      setShowModal(false); if (onClose) onClose();
      if (onClose) onClose();
      resetearFormulario();
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };


  const guardarObservacionesDirecto = async () => {
    if (!editandoId) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('requisiciones')
        .update({
          observaciones: obsTemporal,
          id_referencia_proyecto: idReferenciaProyecto,
          leido_compras_at: null
        })
        .eq('id', editandoId)
        .select();
      if (error) throw error;

      // NOTIFICAR A COMPRAS
      const { data: usuariosCompras } = await supabase
        .from('perfiles')
        .select('id')
        .or('departamento.ilike.%compras%,rol.ilike.%compras%');

      if (usuariosCompras) {
        for (const u of usuariosCompras) {
          await enviarNotificacion(u.id, `Nueva observación en REQ ${previewCorrelativo || 'Pendiente'} de ${currentUser.nombre}`, 'Observación', editandoId);
        }
      }

      setObservaciones(obsTemporal);
      setHistorial(prev => prev.map(req => req.id === editandoId ? { ...req, observaciones: obsTemporal } : req));
      setEditandoObs(false);
      toast.success('Observaciones actualizadas correctamente.');
    } catch (err) {
      toast.error("Error al actualizar observaciones: " + err.message);
    } finally {
      setLoading(true); // Se mantiene cargando un momento para refresco visual
      await cargarHistorialDesdeBD();
      setLoading(false);
    }
  };

  const renombrarAdjunto = async (idx, nuevoNombre) => {
    const reqActual = historial.find(h => String(h.id) === String(editandoId));
    const urlsActuales = [...(reqActual?.facturas_url || [])];
    const item = urlsActuales[idx];

    if (typeof item === 'string') {
      urlsActuales[idx] = { url: item, etiqueta: nuevoNombre };
    } else {
      urlsActuales[idx] = { ...item, etiqueta: nuevoNombre };
    }

    setFacturasUrls(urlsActuales);
    try {
      await supabase.from('requisiciones').update({ facturas_url: urlsActuales }).eq('id', editandoId);
    } catch (err) { console.error(err); }
  };

  const eliminarSoporteReal = async (idx, url) => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>¿Está seguro de eliminar permanentemente este soporte? Se borrará tanto del registro como del servidor.</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => { toast.dismiss(t.id); ejecutarEliminacionSoporte(idx, url); }}
            style={{ padding: '4px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            ELIMINAR
          </button>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 12px', background: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>CANCELAR</button>
        </div>
      </div>
    ), { duration: 5000 });
  };

  const ejecutarEliminacionSoporte = async (idx, url) => {
    const reqActual = historial.find(h => String(h.id) === String(editandoId));
    if (!puedeModificarRequisicion(reqActual)) {
      toast.error("No tienes permisos para modificar esta requisición.");
      return;
    }
    try {
      setUploading(true);
      let bucketName = 'facturas';
      let filePath = '';
      const searchStr = bucketName + '/';
      const bIndex = url.indexOf(searchStr);
      if (bIndex !== -1) {
        filePath = url.substring(bIndex + searchStr.length).split('?')[0];
      } else {
        filePath = url.split('?')[0];
      }

      if (filePath) {
        const { error: storageError } = await supabase.storage.from(bucketName).remove([filePath]);
        if (storageError) console.warn("Aviso storage:", storageError.message);
      }

      const reqActual = historial.find(h => String(h.id) === String(editandoId));
      const nuevasUrls = (reqActual?.facturas_url || []).filter((_, i) => i !== idx);

      const { error: dbError } = await supabase.from('requisiciones').update({ facturas_url: nuevasUrls }).eq('id', editandoId);
      if (dbError) throw dbError;

      setFacturasUrls(nuevasUrls);
      toast.success("Soporte eliminado.");
      cargarHistorialDesdeBD();
    } catch (err) {
      toast.error("Error al eliminar: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const subirArchivos = async (files) => {
    if (editandoId) {
      const reqActual = historial.find(h => String(h.id) === String(editandoId));
      if (!puedeModificarRequisicion(reqActual)) {
        toast.error("No tienes permisos para modificar esta requisición.");
        return;
      }
    }
    try {
      setUploading(true);
      if (!files || files.length === 0) return;

      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`El archivo "${file.name}" supera el límite de 5MB. Por favor, redúzcalo antes de subirlo.`);
          setUploading(false);
          return;
        }
      }

      const uploadPromises = files.map(async (file, index) => {
        const fileExt = file.name.split('.').pop();
        const prefix = editandoId ? editandoId : `nueva_${Date.now()}`;
        const fileName = `factura_${prefix}_${Date.now()}_${index}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage.from('facturas').upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('facturas').getPublicUrl(filePath);
        return publicUrl;
      });

      const nuevasDescargas = await Promise.all(uploadPromises);

      if (!editandoId) {
        // Modo creación: añadir a las urls locales
        const nuevasUrls = [...facturasUrls, ...nuevasDescargas.map(url => ({ url, etiqueta: 'Archivo sin etiqueta' }))];
        setFacturasUrls(nuevasUrls);
        toast.success("Documentos adjuntados correctamente.");
      } else {
        // Modo edición: obtener de base de datos y actualizar
        const { data: currentReq } = await supabase.from('requisiciones').select('facturas_url').eq('id', editandoId).single();
        const urlsActuales = currentReq?.facturas_url || [];
        const nuevasUrls = [...urlsActuales, ...nuevasDescargas.map(url => ({ url, etiqueta: 'Archivo sin etiqueta' }))];

        setFacturasUrls(nuevasUrls);
        const { error: updateError } = await supabase.from('requisiciones').update({ facturas_url: nuevasUrls }).eq('id', editandoId);
        if (updateError) throw updateError;

        toast.success("Documentos adjuntados correctamente.");
        cargarHistorialDesdeBD();
      }
    } catch (error) {
      toast.error("Error al subir: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const subirFactura = async (event) => {
    const files = Array.from(event.target.files);
    await subirArchivos(files);
    event.target.value = '';
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    await subirArchivos(files);
  };

  const eliminarSoporteDefinitivo = async (index) => {
    const confirmacion = window.confirm("¿Está seguro de que desea eliminar este documento permanentemente?");
    if (!confirmacion) return;

    try {
      const nuevasUrls = [...facturasUrls];
      const itemAEliminar = nuevasUrls[index];
      nuevasUrls.splice(index, 1);
      setFacturasUrls(nuevasUrls);

      // Si el archivo físico se subió a Storage, intentar removerlo
      const url = typeof itemAEliminar === 'string' ? itemAEliminar : itemAEliminar?.url;
      if (url) {
        let bucketName = 'facturas';
        let filePath = '';
        const searchStr = bucketName + '/';
        const bIndex = url.indexOf(searchStr);
        if (bIndex !== -1) {
          filePath = url.substring(bIndex + searchStr.length).split('?')[0];
        } else {
          filePath = url.split('?')[0];
        }
        if (filePath) {
          const { error: storageError } = await supabase.storage.from(bucketName).remove([filePath]);
          if (storageError) console.warn("Aviso storage:", storageError.message);
        }
      }

      if (!editandoId) {
        toast.success("Documento eliminado.");
        return;
      }

      const { error } = await supabase
        .from('requisiciones')
        .update({ facturas_url: nuevasUrls })
        .eq('id', editandoId);

      if (error) throw error;

      toast.success("Documento eliminado.");
      await cargarHistorialDesdeBD();
    } catch (err) {
      toast.error("Error al eliminar: " + err.message);
    }
  };

  const manejarAprobarGerenteProyecto = async () => {
    if (!editandoId) return;
    const reqActual = historial.find(h => String(h.id) === String(editandoId));
    if (!reqActual) return;

    const rolUser = (currentUser?.rol || '').toLowerCase();
    const cc = reqActual.centro_costo || '';
    const gerenteEsperado = obtenerAprobadorProyecto(cc, gerenteDirectoCreador);
    const esAdmin = currentUser?.esAdminReal ||
      rolUser.includes('admin') ||
      rolUser.includes('general') ||
      (currentUser?.correo || '').toLowerCase() === 'cvega@totalclean.com' ||
      (currentUser?.correo || '').toLowerCase() === 'cvega.totalclean@gmail.com';

    let puedeAprobar = false;
    if (esAdmin) {
      puedeAprobar = true;
    } else {
      if (gerenteDirectoIdCreador && currentUser?.id === gerenteDirectoIdCreador) {
        puedeAprobar = true;
      } else if (gerenteEsperado === 'Johannel García') {
        puedeAprobar = currentUser?.nombre?.toUpperCase().includes('JOHANNEL');
      } else if (gerenteEsperado === 'Hilda Colina') {
        puedeAprobar = currentUser?.nombre?.toUpperCase().includes('HILDA');
      } else if (gerenteEsperado) {
        const miNombre = `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim();
        puedeAprobar = compararNombres(miNombre, gerenteEsperado) || rolUser.includes('proyecto');
      } else {
        puedeAprobar = rolUser.includes('proyecto') || (rolUser.includes('gerente') && currentUser?.departamento === reqActual?.gerencia);
      }
    }

    if (!puedeAprobar) {
      toast.error('Solo el Gerente de Proyecto correspondiente tiene permisos para aprobar esta requisición.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('requisiciones').update({
        aprobado_gerente_proyecto: true,
        firma_gerente_proyecto: currentUser.firma_url || null,
        estado_aprobacion: 'pendiente_area',
        aprobacion_nombre: 'Aprobado por Proyecto',
        f_aprobacion_proyecto: new Date().toISOString(),
        n_aprobacion_proyecto: `${currentUser.nombre} ${currentUser.apellido}`.trim()
      }).eq('id', editandoId);
      if (error) throw error;
      toast.success('Aprobada por Gerente de Proyecto. Enviada al Gerente de Área.');

      const reqActual = historial.find(h => String(h.id) === String(editandoId));
      if (reqActual) {
        const { data: gerentesArea } = await supabase
          .from('perfiles')
          .select('id, rol')
          .eq('departamento', reqActual.gerencia);
        if (gerentesArea) {
          const areaManagers = gerentesArea.filter(g => {
            const r = (g.rol || '').toLowerCase();
            return (r.includes('área') || r.includes('area') || g.rol === 'Gerente') && !r.includes('proyecto');
          });
          for (const g of areaManagers) {
            await enviarNotificacion(
              g.id,
              `Requisición ${reqActual.correlativo || reqActual.correlativo_req || 'N/A'} aprobada por Proyecto. Requiere su aprobación de Área.`,
              'Aprobación Pendiente',
              editandoId
            );
          }
        }
      }

      await cargarHistorialDesdeBD();
      setShowModal(false); if (onClose) onClose();
      resetearFormulario();
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  const manejarAprobarGerenteArea = async () => {
    const reqActual = historial.find(h => String(h.id) === String(editandoId));
    if (!editandoId || !currentUser?.rol?.toLowerCase()?.includes('gerente')) {
      toast.error('Solo el Gerente de Área puede realizar esta aprobación.');
      return;
    }
    if (reqActual?.solicitante === `${currentUser.nombre} ${currentUser.apellido}`) {
      toast.error('No puede aprobar su propia requisición.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('requisiciones').update({
        aprobado_gerente_area: true,
        firma_gerente: currentUser.firma_url || null, // Firma Nivel 1 guardada en firma_gerente
        estado_aprobacion: 'enviada_general',
        aprobacion_nombre: 'Aprobado por Área',
        f_aprobacion_area: new Date().toISOString(),
        n_aprobacion_area: `${currentUser.nombre} ${currentUser.apellido}`.trim()
      }).eq('id', editandoId);
      if (error) throw error;
      toast.success('Aprobada por Gerente de Área. Enviada al Gerente General.');
      
      // NOTIFICAR AL GERENTE GENERAL
      try {
        const { data: carlos } = await supabase
          .from('perfiles')
          .select('id')
          .ilike('rol', 'Gerente General')
          .limit(1)
          .single();
        if (carlos) {
          const correlativoStr = reqActual?.correlativo || reqActual?.correlativo_req || `ID: ${editandoId}`;
          await enviarNotificacion(
            carlos.id,
            `Requisición ${correlativoStr} aprobada por Área. Requiere su Aprobación Final.`,
            'Aprobación Pendiente',
            editandoId
          );
        }
      } catch (err) {
        console.error("Error al notificar al Gerente General:", err);
      }

      await cargarHistorialDesdeBD();
      setShowModal(false); if (onClose) onClose();
      resetearFormulario();
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  const manejarAprobarGeneral = async () => {
    const reqActual = historial.find(h => String(h.id) === String(editandoId));
    const rolUpper = (currentUser?.rol || '').toUpperCase();
    const emailLower = (currentUser?.correo || '').toLowerCase();

    const esAdminPermitido = currentUser?.esAdminReal ||
      rolUpper === 'GERENTE GENERAL' ||
      rolUpper === 'ADMIN' ||
      emailLower.includes('cvega');

    if (reqActual?.solicitante === `${currentUser.nombre} ${currentUser.apellido}`) {
      toast.error('No puede aprobar su propia requisición.');
      return;
    }

    if (!editandoId) {
      toast.error("ERROR: No hay un ID de requisición válido.");
      return;
    }

    if (!esAdminPermitido) {
      toast.error(`ACCESO DENEGADO\nEmail: ${emailLower}\nRol: ${rolUpper}\nMotivo: El sistema no lo identifica como personal autorizado.`);
      return;
    }

    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '500' }}>¿Desea proceder con la APROBACIÓN FINAL?</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => { toast.dismiss(t.id); ejecutarAprobacionFinal(); }}
            style={{ padding: '4px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            SÍ, APROBAR
          </button>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>CANCELAR</button>
        </div>
      </div>
    ), { duration: 6000, position: 'top-center' });
  };

  const ejecutarAprobacionFinal = async () => {
    setLoading(true);
    try {
      console.log("[APROBACIÓN] Ejecutando Update en Supabase para ID:", editandoId);
      const updates = {
        aprobado_gerente_general: true,
        firma_gerente_general: currentUser.firma_url || null,
        estado_aprobacion: 'aprobado_final',
        aprobacion_nombre: 'Aprobación Final',
        status_compra: 'En espera',
        f_aprobacion_general: new Date().toISOString(),
        n_aprobacion_general: `${currentUser.nombre} ${currentUser.apellido}`.trim(),
        f_inicio_compras: new Date().toISOString()
      };

      const { data, error } = await supabase.from('requisiciones').update(updates).eq('id', editandoId).select();

      if (error) {
        console.error("[APROBACIÓN] Error de base de datos:", error);
        toast.error(`ERROR DE BASE DE DATOS:\n${error.message}\nCódigo: ${error.code}`);
        throw error;
      }

      if (!data || data.length === 0) {
        toast.error("ERROR RLS: La base de datos no permitió actualizar el registro. Es posible que existan políticas de seguridad bloqueando el acceso de escritura para su cuenta.");
        throw new Error("No se pudo actualizar el registro (RLS restriction).");
      }

      // Log final approval in requisicion_logs
      await supabase.from('requisicion_logs').insert([{
        requisicion_id: editandoId,
        usuario_id: currentUser?.id,
        usuario_nombre: `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim() || 'Aprobador',
        accion: 'APROBADA_FINAL',
        comentario: 'Aprobación final por Gerencia General.'
      }]);

      toast.success("¡APROBACIÓN COMPLETADA CON ÉXITO!");

      const reqActual = historial.find(h => String(h.id) === String(editandoId));
      // 1. Notificar al creador/solicitante
      if (reqActual?.user_id) {
        const correlativoStr = reqActual?.correlativo || reqActual?.correlativo_req || `ID: ${editandoId}`;
        await enviarNotificacion(
          reqActual.user_id,
          `¡Tu Requisición ${correlativoStr} ha sido Aprobada y está en cola para Compra!`,
          'Compra Aprobada',
          editandoId
        );
      }

      // 2. Notificar al Gerente de Compras
      try {
        const { data: gerentesCompras } = await supabase
          .from('perfiles')
          .select('id, rol, departamento')
          .eq('departamento', 'Compras');
        
        if (gerentesCompras) {
          const gCompras = gerentesCompras.filter(p => {
            const r = (p.rol || '').toUpperCase();
            return r.includes('GERENTE') || r.includes('ADMIN');
          });
          for (const g of gCompras) {
            const correlativoStr = reqActual?.correlativo || reqActual?.correlativo_req || `ID: ${editandoId}`;
            await enviarNotificacion(
              g.id,
              `Nueva Requisición ${correlativoStr} aprobada. Lista para ser asignada a un Analista de Compras.`,
              'Requisición Aprobada',
              editandoId
            );
          }
        }
      } catch (err) {
        console.error("Error al notificar al Gerente de Compras:", err);
      }

      await cargarHistorialDesdeBD();
      setShowModal(false); if (onClose) onClose();
      resetearFormulario();
    } catch (err) {
      console.error("[APROBACIÓN] Excepción capturada:", err);
      toast.error("ERROR INESPERADO:\n" + err.message);
    } finally {
      setLoading(false);
    }
  };

  const manejarReenviar = async () => {
    if (!editandoId) return;
    const reqActual = historial.find(h => String(h.id) === String(editandoId));
    setLoading(true);
    try {
      const rangoSolicitante = getRank(currentUser?.rol);
      let estadoInicial = 'pendiente_area';
      let nombreEstado = 'Re-enviada (Pendiente Área)';

      if (rangoSolicitante >= 3) {
        estadoInicial = 'enviada_general';
        nombreEstado = 'Re-enviada (Pendiente General)';
      }

      // DETERMINAR SI TIENE GERENTE DE PROYECTO ASIGNADO (Solo si el solicitante es Analista/Coordinador)
      // Doble condición: Centro de Costo de Proyecto Y la gerencia debe ser estrictamente 'Operaciones'
      if (rangoSolicitante < 2.5 && (departamento || '').trim() === 'Operaciones') {
        let requiereProyecto = false;
        const ccUpper = (centroCosto || '').toString().toUpperCase();
        if (
          ccUpper.includes("MTTO") || 
          ccUpper.includes("MAYOR") || 
          ccUpper.includes("GRANDE") || 
          ccUpper.includes("EXCELENCIA") || 
          ccUpper.includes("VAC") || 
          ccUpper.includes("VACCUM")
        ) {
          requiereProyecto = true;
        } else {
          try {
            const { data: gProyectos } = await supabase
              .from('perfiles')
              .select('id')
              .contains('obras_asignadas', [centroCosto])
              .ilike('rol', '%proyecto%');

            if (gProyectos && gProyectos.length > 0) {
              requiereProyecto = true;
            }
          } catch (err) {
            console.error("Error verificando gerente de proyecto:", err);
          }
        }

        if (requiereProyecto) {
          estadoInicial = 'pendiente_proyecto';
          nombreEstado = 'Re-enviada (Pendiente Proyecto)';
        }
      }

      const { error } = await supabase.from('requisiciones').update({
        estado_aprobacion: estadoInicial,
        motivo_rechazo: null,
        aprobacion_nombre: nombreEstado,
        // Limpiar firmas y aprobaciones anteriores
        firma_gerente: null,
        firma_gerente_general: null,
        aprobado_gerente_area: false,
        aprobado_gerente_general: false,
        aprobado_gerente_proyecto: false,
        firma_gerente_proyecto: null,
        // Se preservan los datos editados en los inputs
        items: renglones,
        justificacion,
        observaciones,
        id_referencia_proyecto: idReferenciaProyecto,
        centro_costo: centroCosto,
        prioridad,
        fecha_requerida: fechaRequerida,
        gerencia: departamento,
        con_iva: conIva
      }).eq('id', editandoId);
      if (error) throw error;
      const creador = solicitante || `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim();
      const correlativoStr = reqActual?.correlativo || reqActual?.correlativo_req || `ID: ${editandoId}`;
      await notificarSegunEstado(
        editandoId,
        estadoInicial,
        correlativoStr,
        centroCosto,
        departamento,
        creador
      );
      toast.success("Requisición re-enviada correctamente.");
      await cargarHistorialDesdeBD();
      setShowModal(false); if (onClose) onClose();
      if (onClose) onClose();
      resetearFormulario();
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };
  const ejecutarGuardarUpdate = async (id) => {
    const reqActual = historial.find(h => String(h.id) === String(id));
    if (!puedeModificarRequisicion(reqActual)) {
      toast.error("No tienes permisos para modificar esta requisición.");
      return;
    }
    setLoading(true);
    try {
      const { data: antigua } = await supabase.from('requisiciones').select('items').eq('id', id).single();
      const itemsAntiguos = antigua?.items || [];

      const { error } = await supabase.from('requisiciones').update({
        fecha_requerida: fechaRequerida,
        centro_costo: centroCosto,
        prioridad,
        items: renglones,
        justificacion,
        observaciones,
        id_referencia_proyecto: idReferenciaProyecto,
        total_bs: Number(totalEstimado) || 0,
        facturas_url: facturasUrls,
        con_iva: conIva
      }).eq('id', id);
      if (error) throw error;

      // --- SINCRONIZACIÓN Y AUDITORÍA ---
      for (let i = 0; i < renglones.length; i++) {
        const itemNuevo = renglones[i];
        const itemViejo = itemsAntiguos[i] || {};

        // Si hubo cambios, registrar en auditoría
        if (JSON.stringify(itemNuevo) !== JSON.stringify(itemViejo)) {
          await supabase.from('historial_acciones').insert([{
            requisicion_id: id,
            usuario_nombre: currentUser?.nombre || 'Usuario',
            accion: 'EDICIÓN',
            campo: `ITEM_${i}`,
            valor_anterior: JSON.stringify(itemViejo),
            valor_nuevo: JSON.stringify(itemNuevo)
          }]);

          // Sincronizar con Solicitud de Fondos (Proyecciones)
          const { data: fondSync } = await supabase
            .from('solicitudes_fondos')
            .select('*')
            .eq('requisicion_id', id);

          if (fondSync && fondSync.length > 0) {
            for (const sol of fondSync) {
              const itemsSol = sol.items || [];
              const idxEnSol = itemsSol.findIndex(s => s.item_idx_original === i);

              if (idxEnSol !== -1) {
                itemsSol[idxEnSol] = {
                  ...itemsSol[idxEnSol],
                  descripcion: itemNuevo.descripcion,
                  cant: itemNuevo.cant,
                  monto: itemNuevo.precio_unitario || itemsSol[idxEnSol].monto,
                  total: (itemNuevo.cant || 0) * (itemNuevo.precio_unitario || 0)
                };

                const nuevoTotalSol = itemsSol.reduce((acc, curr) => acc + (curr.total || 0), 0);
                await supabase.from('solicitudes_fondos').update({
                  items: itemsSol,
                  monto_total: nuevoTotalSol
                }).eq('id', sol.id);
              }
            }
          }
        }
      }

      toast.success("Cambios sincronizados con éxito.");
      await cargarHistorialDesdeBD();
      setModoEdicion(false);
      setShowModal(false); if (onClose) onClose();
      if (onClose) onClose();
      resetearFormulario();
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  const manejarGenerarOActualizar = async () => {
    setLoading(true);
    if (editandoId) {
      if (!justificacion?.trim()) {
        toast.error("La justificación es obligatoria.");
        setLoading(false);
        return;
      }
      if (!prioridad) {
        toast.error("Seleccione el nivel de prioridad.");
        setLoading(false);
        return;
      }

      // VALIDACIÓN ESTRICTA DE CLASIFICACIÓN
      if (!centroCosto) {
        toast.error("El Centro de Costo es obligatorio.");
        setLoading(false);
        return;
      }

      for (let i = 0; i < renglones.length; i++) {
        const r = renglones[i];
        if (!r.clasificacion) {
          toast.error(`Renglón ${i + 1}: La Clasificación es obligatoria.`);
          setLoading(false);
          return;
        }
        if (!r.categoria) {
          toast.error(`Renglón ${i + 1}: La Categoría es obligatoria.`);
          setLoading(false);
          return;
        }
      }

      // VALIDACIÓN PASIVA PERO ESTRICTA EN EJECUCIÓN (Clasificación única)
      const clases = [...new Set((Array.isArray(renglones) ? renglones : []).map(r => r.clasificacion).filter(c => c))];
      if (clases.length > 1) {
        toast.error("Error: Todos los renglones deben tener la misma Clasificación.");
        setLoading(false);
        return;
      }
      // Si está en modo edición (ej. re-enviando o corrigiendo)
      try {
        const reqActual = historial.find(h => String(h.id) === String(editandoId));
        const isRechazada = reqActual?.estado_aprobacion === 'rechazada';

        const updatePayload = {
          fecha_requerida: fechaRequerida,
          centro_costo: centroCosto,
          prioridad,
          items: renglones,
          justificacion,
          observaciones,
          id_referencia_proyecto: idReferenciaProyecto,
          total_bs: Number(totalEstimado) || 0,
          facturas_url: facturasUrls
        };

        if (isRechazada) {
          console.log("[RE-ENVIAR] Detectada REQ rechazada, reiniciando flujo...");
          const rangoSolicitante = getRank(currentUser?.rol);
          let estadoInicial = 'pendiente_area';
          let nombreEstado = 'Re-enviada (Pendiente Área)';

          if (rangoSolicitante >= 3) {
            estadoInicial = 'enviada_general';
            nombreEstado = 'Re-enviada (Pendiente General)';
          }

          // DETERMINAR SI TIENE GERENTE DE PROYECTO ASIGNADO
          // Doble condición: Centro de Costo de Proyecto Y la gerencia debe ser estrictamente 'Operaciones'
          if (rangoSolicitante < 2.5 && (departamento || '').trim() === 'Operaciones') {
            let requiereProyecto = false;
            const ccUpper = (centroCosto || '').toString().toUpperCase();
            if (
              ccUpper.includes("MTTO") || 
              ccUpper.includes("MAYOR") || 
              ccUpper.includes("GRANDE") || 
              ccUpper.includes("EXCELENCIA") || 
              ccUpper.includes("VAC") || 
              ccUpper.includes("VACCUM")
            ) {
              requiereProyecto = true;
            } else {
              try {
                const { data: gProyectos } = await supabase
                  .from('perfiles')
                  .select('id')
                  .contains('obras_asignadas', [centroCosto])
                  .ilike('rol', '%proyecto%');

                if (gProyectos && gProyectos.length > 0) {
                  requiereProyecto = true;
                }
              } catch (err) {
                console.error("Error verificando gerente de proyecto:", err);
              }
            }

            if (requiereProyecto) {
              estadoInicial = 'pendiente_proyecto';
              nombreEstado = 'Re-enviada (Pendiente Proyecto)';
            }
          }

          updatePayload.estado_aprobacion = estadoInicial;
          updatePayload.aprobacion_nombre = nombreEstado;
          updatePayload.motivo_rechazo = null;
          updatePayload.firma_gerente = null;
          updatePayload.firma_gerente_general = null;
          updatePayload.aprobado_gerente_area = false;
          updatePayload.aprobado_gerente_general = false;
          updatePayload.aprobado_gerente_proyecto = false;
          updatePayload.firma_gerente_proyecto = null;
        }

        const { error } = await supabase.from('requisiciones').update(updatePayload).eq('id', editandoId);
        if (error) throw error;

        await ejecutarGuardarUpdate(editandoId);
      } catch (err) { toast.error(err.message); } finally { setLoading(false); }
      return;
    }


    if (!justificacion?.trim()) {
      toast.error("La justificación es obligatoria.");
      setLoading(false);
      return;
    }

    if (!prioridad) {
      toast.error("Seleccione el nivel de prioridad.");
      setLoading(false);
      return;
    }

    // --- LÓGICA DE CORRELATIVO INDEPENDIENTE CON RESETEO ANUAL ---
    const { likePattern, prefix } = obtenerEstructuraCorrelativo(departamento, currentUser);

    const { data: registrosMismaSigla } = await supabase
      .from('requisiciones')
      .select('correlativo_req')
      .like('correlativo_req', likePattern)
      .order('correlativo_req', { ascending: false })
      .limit(1);

    let maxNumero = 0;
    if (registrosMismaSigla && registrosMismaSigla.length > 0) {
      const correlativoMax = registrosMismaSigla[0].correlativo_req;
      const partes = correlativoMax.split('-');
      if (partes.length >= 1) {
        const num = parseInt(partes[partes.length - 1], 10);
        if (!isNaN(num)) maxNumero = num;
      }
    }
    const nuevoCorrelativo = `${prefix}${String(maxNumero + 1).padStart(4, '0')}`;

    const rangoSolicitante = getRank(currentUser?.rol);
    let estadoInicial = 'pendiente_area';
    let nombreEstado = 'Pendiente Área';

    if (rangoSolicitante >= 3) {
      estadoInicial = 'enviada_general';
      nombreEstado = 'Pendiente General';
    }

    const nuevaReqBD = {
      correlativo_req: nuevoCorrelativo,
      fecha_emision: new Date().toISOString(),
      fecha_requerida: fechaRequerida,
      solicitante: solicitante || `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim() || 'S/E',
      gerencia: departamento,
      centro_costo: centroCosto,
      prioridad,
      status_compra: 'En espera',
      aprobacion: false,
      aprobacion_nombre: nombreEstado,
      estado_aprobacion: estadoInicial,
      total_bs: Number(totalEstimado) || 0,
      items: renglones,
      justificacion,
      observaciones,
      id_referencia_proyecto: idReferenciaProyecto,
      origen: datosPredefinidos ? `REF: ${datosPredefinidos.id_control}` : 'Manual',
      user_id: currentUser.id,
      facturas_url: facturasUrls,
      con_iva: conIva
    };

    // VALIDACIÓN ESTRICTA DE CLASIFICACIÓN PARA NUEVA REQ
    if (!centroCosto) {
      toast.error("El Centro de Costo es obligatorio.");
      setLoading(false);
      return;
    }

    for (let i = 0; i < renglones.length; i++) {
      const r = renglones[i];
      if (!r.clasificacion) {
        toast.error(`Renglón ${i + 1}: La Clasificación es obligatoria.`);
        setLoading(false);
        return;
      }
      if (!r.categoria) {
        toast.error(`Renglón ${i + 1}: La Categoría es obligatoria.`);
        setLoading(false);
        return;
      }
    }

    // VALIDACIÓN PASIVA PERO ESTRICTA EN EJECUCIÓN (Clasificación única)
    const clases = [...new Set((Array.isArray(renglones) ? renglones : []).map(r => r.clasificacion).filter(c => c))];
    if (clases.length > 1) {
      toast.error("Error: Todos los renglones deben tener la misma Clasificación.");
      setLoading(false);
      return;
    }

    // ALERTA DE CATEGORÍAS DIFERENTES ANTES DE GUARDAR NUEVA
    const catsUnicas = [...new Set((Array.isArray(renglones) ? renglones : []).map(r => r.categoria).filter(c => c))];
    if (catsUnicas.length > 1) {
      toast((t) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '500' }}>Se han detectado diferentes categorías en los renglones. ¿Está seguro de que desea guardar la requisición así?</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => { toast.dismiss(t.id); ejecutarGuardarNueva(nuevaReqBD); }}
              style={{ padding: '4px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
            >
              SÍ, GENERAR
            </button>
            <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>CANCELAR</button>
          </div>
        </div>
      ), { duration: 6000, position: 'top-center' });
      setLoading(false);
      return;
    }

    // DETERMINAR SI TIENE GERENTE DE PROYECTO ASIGNADO
    if (rangoSolicitante < 2.5 && (departamento || '').trim() === 'Operaciones') {
      let requiereProyecto = false;
      const ccUpper = (centroCosto || '').toString().toUpperCase();
      if (
        ccUpper.includes("MTTO") || 
        ccUpper.includes("MAYOR") || 
        ccUpper.includes("GRANDE") || 
        ccUpper.includes("EXCELENCIA") || 
        ccUpper.includes("VAC") || 
        ccUpper.includes("VACCUM")
      ) {
        requiereProyecto = true;
      } else {
        try {
          const { data: gProyectos } = await supabase
            .from('perfiles')
            .select('id')
            .contains('obras_asignadas', [centroCosto])
            .ilike('rol', '%proyecto%');

          if (gProyectos && gProyectos.length > 0) {
            requiereProyecto = true;
          }
        } catch (err) {
          console.error("Error verificando gerente de proyecto:", err);
        }
      }

      if (requiereProyecto) {
        nuevaReqBD.estado_aprobacion = 'pendiente_proyecto';
        nuevaReqBD.aprobacion_nombre = 'Pendiente por Proyecto';
      }
    }

    await ejecutarGuardarNueva(nuevaReqBD);
  };

  const intentarCerrarModal = () => {
    // Si estamos editando activamente una requisición existente y hay cambios, preguntamos
    if (editandoId && modoEdicion && hasChanges) {
      toast((t) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b' }}>⚠️ Tienes cambios sin guardar</p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>¿Estás seguro de que deseas cerrar? Se perderán los cambios realizados.</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '5px' }}>
            <button
              onClick={() => {
                toast.dismiss(t.id);
                setShowModal(false);
                if (onClose) onClose();
                resetearFormulario();
              }}
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
      // Si estamos creando una nueva o solo observando, cerramos directo
      setShowModal(false); if (onClose) onClose();
      if (onClose) onClose();
      // Solo reseteamos si estábamos viendo una específica para no dejar basura en el estado
      if (editandoId) resetearFormulario();
    }
  };

  const ejecutarGuardarNueva = async (payload) => {
    if (!currentUser?.id) {
      toast.error("Error: Sesión de usuario no encontrada. Por favor recargue la página.");
      return;
    }
    setLoading(true);
    try {
      const { data: nuevaReq, error } = await supabase.from('requisiciones').insert([payload]).select().single();
      if (error) throw error;

      // Log the creation event in requisicion_logs
      await supabase.from('requisicion_logs').insert([{
        requisicion_id: nuevaReq.id,
        usuario_id: currentUser?.id,
        usuario_nombre: `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim() || 'Creador',
        accion: 'CREACION',
        comentario: 'Requisición creada.'
      }]);

      // SI VIENE DE SOLICITUD DE FONDOS, VINCULAR LAS PARTIDAS USADAS
      let idsPartidas = [];
      if (datosPredefinidos?.partidasSeleccionadas && nuevaReq) {
        idsPartidas = datosPredefinidos.partidasSeleccionadas.map(p => p.id);
        console.log("Vinculando partidas a la REQ:", nuevaReq.correlativo_req);
        await supabase
          .from('partidas_fondos')
          .update({
            requisicion_id: nuevaReq.id,
            codigo_ticket: nuevaReq.correlativo_req, // GUARDAR EL CORRELATIVO PARA TRAZABILIDAD
            status: 'Bloqueado',
            emisor_nombre: solicitante || `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim()
          })
          .in('id', idsPartidas);
      }

      toast.success("Generada y guardada.");

      // --- LÓGICA DE NOTIFICACIONES PARA NUEVA REQ ---
      const creador = solicitante || `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim();
      await notificarSegunEstado(
        nuevaReq.id,
        nuevaReq.estado_aprobacion,
        nuevaReq.correlativo_req,
        nuevaReq.centro_costo,
        nuevaReq.gerencia,
        creador
      );

      await cargarHistorialDesdeBD();
      onSuccess?.(nuevaReq.id, idsPartidas, nuevaReq.correlativo_req);
      setShowModal(false); if (onClose) onClose();
      onClose?.();
      resetearFormulario();
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  const exportarPDF = async () => {
    const reqActual = editandoId ? historial.find(h => String(h.id) === String(editandoId)) : null;
    if (!reqActual) {
      toast.error("No se encontraron datos para exportar.");
      return;
    }

    // Inicializar jsPDF (A4 en mm)
    const pdf = new jsPDF('p', 'mm', 'a4');
    const fontPrimary = 'helvetica';
    
    // --- CABECERA ---
    // Izquierda: Nombre de la empresa
    pdf.setFont(fontPrimary, 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(15, 23, 42); // Gris muy oscuro / Slate-900
    pdf.text("TOTAL CLEAN C.A.", 15, 20);
    
    pdf.setFont(fontPrimary, 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105); // Slate-600
    pdf.text("J-303658587-0", 15, 25);
    
    // Derecha: Fecha y Solicitud #
    const fechaEmision = reqActual.fecha 
      ? format(new Date(reqActual.fecha + 'T12:00:00'), 'dd/MM/yyyy hh:mm a') 
      : format(new Date(), 'dd/MM/yyyy hh:mm a');
    
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`Fecha : ${fechaEmision}`, 195, 20, { align: 'right' });
    pdf.text("Solicitud 1 de 1", 195, 25, { align: 'right' });
    
    // --- TÍTULO CENTRAL ---
    const correlativoStr = reqActual.correlativo || `REQ-${String(reqActual.id).padStart(3, '0')}`;
    pdf.setFont(fontPrimary, 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    const titulo = `REQUISICIÓN DE RECURSOS: ${correlativoStr}`;
    const textWidth = pdf.getTextWidth(titulo);
    const posX = (210 - textWidth) / 2;
    pdf.text(titulo, posX, 38);
    
    // Línea subrayada del título
    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(0.4);
    pdf.line(posX, 40, posX + textWidth, 40);
    
    // --- CUADRO DE METADATA (Gerencia, Responsable, etc.) ---
    const startY = 46;
    pdf.setDrawColor(226, 232, 240); // Borde gris claro
    pdf.setFillColor(248, 250, 252); // Fondo gris muy claro
    pdf.setLineWidth(0.3);
    pdf.roundedRect(15, startY, 180, 22, 2, 2, 'FD');
    
    // Texto dentro de la Metadata
    pdf.setFontSize(9.5);
    pdf.setTextColor(15, 23, 42);
    
    // Columna Izquierda
    pdf.setFont(fontPrimary, 'bold');
    pdf.text("Gerencia: ", 20, startY + 8);
    pdf.setFont(fontPrimary, 'normal');
    pdf.setTextColor(51, 65, 85);
    pdf.text(reqActual.gerencia || 'N/A', 38, startY + 8);
    
    pdf.setFont(fontPrimary, 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text("Responsable: ", 20, startY + 15);
    pdf.setFont(fontPrimary, 'normal');
    pdf.setTextColor(51, 65, 85);
    pdf.text(reqActual.solicitante || 'N/A', 43, startY + 15);
    
    // Columna Derecha
    const fechaEmisionMeta = reqActual.fecha 
      ? format(new Date(reqActual.fecha + 'T12:00:00'), 'dd/MM/yyyy') 
      : 'N/A';
      
    pdf.setFont(fontPrimary, 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text("Fecha Emisión: ", 125, startY + 8);
    pdf.setFont(fontPrimary, 'normal');
    pdf.setTextColor(51, 65, 85);
    pdf.text(fechaEmisionMeta, 151, startY + 8);
    
    // --- TABLA DE ITEMS ---
    const tableY = startY + 30;
    
    // Cabecera de la tabla
    pdf.setFont(fontPrimary, 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(15, 23, 42);
    
    // Dibujar líneas superior e inferior de la cabecera de la tabla
    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(0.5);
    pdf.line(15, tableY, 195, tableY);
    
    pdf.text("C.COSTO", 16, tableY + 5);
    pdf.text("CLASIF.", 46, tableY + 5);
    pdf.text("DESCRIPCIÓN", 76, tableY + 5);
    pdf.text("CANT.", 145, tableY + 5, { align: 'right' });
    pdf.text("PAGO Bs ($)", 170, tableY + 5, { align: 'right' });
    pdf.text("PAGO USD ($)", 194, tableY + 5, { align: 'right' });
    
    pdf.line(15, tableY + 8, 195, tableY + 8);
    
    // Renglones de la tabla
    pdf.setFont(fontPrimary, 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(51, 65, 85);
    
    let currentY = tableY + 13;
    
    // Obtener ítems sanitizados
    let items = [];
    if (typeof reqActual.detalles === 'string') {
      try {
        items = JSON.parse(reqActual.detalles);
        if (typeof items === 'string') items = JSON.parse(items);
      } catch (e) {
        items = [];
      }
    } else if (Array.isArray(reqActual.detalles)) {
      items = reqActual.detalles;
    }
    
    items.forEach((item, idx) => {
      // Ajuste de descripción si es muy larga
      const descText = item.descripcion || 'N/A';
      const descLines = pdf.splitTextToSize(descText, 60);
      
      // Mostrar Centro de Costo de la req
      const ccText = reqActual.centroCosto || 'N/A';
      const ccLines = pdf.splitTextToSize(ccText, 28);
      
      // Mostrar Clasificación del renglón
      const clasifText = item.clasificacion || 'N/A';
      const clasifLines = pdf.splitTextToSize(clasifText, 28);
      
      // Altura requerida para este renglón
      const linesCount = Math.max(descLines.length, ccLines.length, clasifLines.length);
      const rowHeight = linesCount * 4 + 4;
      
      // Renderizar columnas de texto multilínea
      pdf.text(ccLines, 16, currentY);
      pdf.text(clasifLines, 46, currentY);
      pdf.text(descLines, 76, currentY);
      
      // Renderizar columnas simples
      pdf.text(`${item.cant || 1} ${item.uni || item.unidad || ''}`, 145, currentY, { align: 'right' });
      
      // Calcular valores acumulados de pago (Bs o USD) para el ítem
      const historial = Array.isArray(item.historial_compras) ? item.historial_compras : [];
      const tieneCompras = historial.some(h => h.tipo !== 'JUSTIFICACION' && h.tipo !== 'ANULACION');
      
      let totalPaidBs = 0;
      let totalPaidUsd = 0;
      
      if (tieneCompras) {
        historial.forEach(h => {
          if (h.tipo === 'JUSTIFICACION' || h.tipo === 'ANULACION') return;
          const monto = (Number(h.cant) || 0) * (Number(h.pu) || 0);
          const esBs = h.metodo_pago && (h.metodo_pago.toUpperCase().includes('BS') || h.metodo_pago.toUpperCase().includes('B/S'));
          if (esBs) {
            totalPaidBs += monto;
          } else {
            totalPaidUsd += monto;
          }
        });
      } else {
        const cantOri = Number(item.cantidad_pedida ?? item.cant) || 1;
        const puEst = Number(item.pu_estimado ?? item.precio_unitario ?? item.pu) || 0;
        totalPaidUsd = cantOri * puEst;
      }
      
      if (totalPaidBs > 0) {
        pdf.text(`$ ${totalPaidBs.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 170, currentY, { align: 'right' });
      } else {
        pdf.text("-", 170, currentY, { align: 'right' });
      }
      
      if (totalPaidUsd > 0) {
        pdf.text(`$ ${totalPaidUsd.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 194, currentY, { align: 'right' });
      } else {
        pdf.text("-", 194, currentY, { align: 'right' });
      }
      
      // Beneficiario si existe
      if (item.beneficiario) {
        pdf.setFont(fontPrimary, 'italic');
        pdf.setFontSize(7.5);
        pdf.setTextColor(100, 116, 139); // Slate-500
        pdf.text(`Benef: ${item.beneficiario}`, 76, currentY + (descLines.length * 4));
        pdf.setFont(fontPrimary, 'normal');
        pdf.setFontSize(8.5);
        pdf.setTextColor(51, 65, 85);
      }
      
      currentY += rowHeight;
      
      // Dibujar una sutil línea divisoria
      pdf.setDrawColor(241, 245, 249);
      pdf.setLineWidth(0.2);
      pdf.line(15, currentY - 1, 195, currentY - 1);
    });
    
    // --- CUADRO DE TOTALES (ALINEADO A LA DERECHA) ---
    let totalPagoBs = 0;
    let totalPagoUsd = 0;
    
    items.forEach(item => {
      const historial = Array.isArray(item.historial_compras) ? item.historial_compras : [];
      const tieneCompras = historial.some(h => h.tipo !== 'JUSTIFICACION' && h.tipo !== 'ANULACION');
      
      let itemBs = 0;
      let itemUsd = 0;
      
      if (tieneCompras) {
        historial.forEach(h => {
          if (h.tipo === 'JUSTIFICACION' || h.tipo === 'ANULACION') return;
          const monto = (Number(h.cant) || 0) * (Number(h.pu) || 0);
          const esBs = h.metodo_pago && (h.metodo_pago.toUpperCase().includes('BS') || h.metodo_pago.toUpperCase().includes('B/S'));
          if (esBs) {
            itemBs += monto;
          } else {
            itemUsd += monto;
          }
        });
      } else {
        const cantOri = Number(item.cantidad_pedida ?? item.cant) || 1;
        const puEst = Number(item.pu_estimado ?? item.precio_unitario ?? item.pu) || 0;
        itemUsd = cantOri * puEst;
      }
      
      totalPagoBs += itemBs;
      totalPagoUsd += itemUsd;
    });

    const aplicaIva = reqActual.con_iva !== false;
    const labelIva = aplicaIva ? "(Con IVA)" : "(Sin IVA)";
    const totalPagoBsConIva = totalPagoBs * (aplicaIva ? 1.16 : 1.00);
    const totalPagoUsdConIva = totalPagoUsd * (aplicaIva ? 1.16 : 1.00);
    
    let finalPagoBs = totalPagoBsConIva;
    let finalPagoUsd = totalPagoUsdConIva;
    
    if (totalPagoBs > 0 && totalPagoUsd === 0) {
      finalPagoBs = Number(reqActual.total) || totalPagoBsConIva;
      finalPagoUsd = 0;
    } else if (totalPagoUsd > 0 && totalPagoBs === 0) {
      finalPagoUsd = Number(reqActual.total) || totalPagoUsdConIva;
      finalPagoBs = 0;
    }
    
    const finalTotal = finalPagoBs + finalPagoUsd;

    currentY += 5;
    const boxWidth = 70;
    const boxHeight = 18;
    const boxX = 195 - boxWidth;
    
    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(0.4);
    pdf.rect(boxX, currentY, boxWidth, boxHeight);
    
    pdf.setFont(fontPrimary, 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(15, 23, 42);
    
    // Fila 1: Pago Bs
    pdf.text(`Pago Bs ${labelIva}`, boxX + 3, currentY + 5);
    pdf.text(`$ ${finalPagoBs.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 192, currentY + 5, { align: 'right' });
    
    // Fila 2: Pago USD
    pdf.text(`Pago USD ${labelIva}`, boxX + 3, currentY + 10);
    pdf.text(`$ ${finalPagoUsd.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 192, currentY + 10, { align: 'right' });
    
    // Línea divisoria interna
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.2);
    pdf.line(boxX, currentY + 12, 195, currentY + 12);
    
    // Fila 3: Total General
    pdf.setFont(fontPrimary, 'bold');
    pdf.text(`TOTAL ${labelIva}`, boxX + 3, currentY + 15);
    pdf.text(`$ ${finalTotal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 192, currentY + 15, { align: 'right' });
    
    // Guardar el PDF
    pdf.save(`REQ_${correlativoStr}.pdf`);
  };

  return (
    <motion.div
      className="animate-main"
      style={{ padding: '25px', backgroundColor: '#f1f5f9', minHeight: '100vh' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >

      {/* --- ENCABECERA UNIFICADA PREMIUM --- */}
      <div style={{
        borderLeft: '6px solid #0ea5e9',
        paddingLeft: '16px',
        marginBottom: '30px'
      }}>
        <h1 style={{ margin: 0, color: '#0f172a', fontSize: '1.8rem', fontWeight: '900', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.5px' }}>
          Gestión de Requisiciones
        </h1>
        <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem', fontWeight: '500', fontFamily: 'Inter, sans-serif' }}>
          Control y flujo de aprobación de requisiciones internas
        </p>
      </div>

      {/* --- DASHBOARD SUPERIOR (STATS CARDS INTERACTIVAS) --- */}
      <div className="dashboard-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '15px', marginBottom: '25px' }}>
        {(() => {
          const rolUser = (currentUser?.rol || '').toLowerCase();
          const baseStats = [
            { label: 'TOTAL REQUISICIONES', val: historial.length, col: '#0ea5e9', bg: '#e0f2fe', icon: <FileText size={18} />, filter: 'Todos' },
            { label: 'GERENTE PROYECTO', val: historial.filter(r => r.estado_aprobacion === 'pendiente_proyecto').length, col: '#d97706', bg: '#fef3c7', icon: <User size={18} />, filter: 'pendiente_proyecto' },
            { label: 'GERENTE ÁREA', val: historial.filter(r => r.estado_aprobacion === 'pendiente_area').length, col: '#6366f1', bg: '#e0e7ff', icon: <Building2 size={18} />, filter: 'pendiente_area' },
            { label: 'POR APROBAR', val: historial.filter(r => r.estado_aprobacion === 'enviada_general').length, col: '#8b5cf6', bg: '#f3e8ff', icon: <ShoppingCart size={18} />, filter: 'enviada_general' },
            { label: 'APROBADA GLOBAL', val: historial.filter(r => r.estado_aprobacion === 'aprobado_final').length, col: '#10b981', bg: '#dcfce7', icon: <CheckCircle2 size={18} />, filter: 'aprobado_final' },
            { label: 'RECHAZADA', val: historial.filter(r => r.estado_aprobacion === 'rechazada').length, col: '#ef4444', bg: '#fee2e2', icon: <Ban size={18} />, filter: 'rechazada' },
            { label: 'ANULADA', val: historial.filter(r => r.estado_aprobacion === 'ANULADA').length, col: '#6b7280', bg: '#f3f4f6', icon: <X size={18} />, filter: 'ANULADA' }
          ];

          const esAnalistaOCoordinador = rolUser.includes('analista') || rolUser.includes('coordinador');
          if (esAnalistaOCoordinador) {
            return [
              baseStats[0],
              baseStats[4],
              {
                label: 'PENDIENTES',
                val: historial.filter(r => ['pendiente_proyecto', 'pendiente_area', 'enviada_general'].includes(r.estado_aprobacion)).length,
                col: '#d97706',
                bg: '#fef3c7',
                icon: <Clock size={18} />,
                filter: 'pendientes_de_aprobacion'
              },
              {
                label: 'RECHAZADAS Y ANULADAS',
                val: historial.filter(r => ['rechazada', 'ANULADA'].includes(r.estado_aprobacion)).length,
                col: '#ef4444',
                bg: '#fee2e2',
                icon: <Ban size={18} />,
                filter: 'rechazadas_y_anuladas'
              }
            ];
          }

          return baseStats.filter(x => {
            if (rolUser.includes('proyecto')) {
              return !(x.filter === 'pendiente_area' || x.filter === 'enviada_general');
            } else if (rolUser.includes('gerente') && !rolUser.includes('general')) {
              return !(x.filter === 'pendiente_proyecto' || x.filter === 'enviada_general');
            } else if (rolUser.includes('general')) {
              return !(x.filter === 'pendiente_proyecto' || x.filter === 'pendiente_area');
            }
            return true;
          });
        })().map((x, i) => {
          const isActive = filtroAprobacion === x.filter;
          return (
            <div
              key={i}
              onClick={() => setFiltroAprobacion(x.filter)}
              style={{
                background: 'white',
                padding: '16px 20px',
                borderRadius: '20px',
                border: isActive ? `1.5px solid ${x.col}` : '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.06)' : '0 4px 6px -1px rgba(0,0,0,0.02)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: x.bg || '#f1f5f9',
                color: x.col,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {x.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: '0.62rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {x.label}
                </label>
                <h3 style={{ margin: '1px 0 0 0', fontSize: '1.15rem', fontWeight: '900', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {loading ? '...' : x.val}
                </h3>
              </div>
              <div style={{ color: isActive ? x.col : '#cbd5e1', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <ChevronDown size={14} />
              </div>
            </div>
          );
        })}
      </div>

      {/* --- SECCIÓN DE FILTROS (SIMILAR A GESTIÓN DE USUARIOS) --- */}
      <div className="table-container" style={{ marginBottom: '15px', padding: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', color: '#1e293b' }}>Historial de Requisiciones</h2>
        </div>

        <div style={{
          display: 'flex',
          gap: '15px',
          backgroundColor: '#f8fafc',
          padding: '12px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔍</span>
            <input
              className="input-tc"
              style={{ width: '100%', paddingLeft: '35px', margin: 0, backgroundColor: 'white', boxSizing: 'border-box' }}
              placeholder="Buscar por solicitante o N° REQ..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <select
            className="input-tc"
            style={{ flex: 1, margin: 0, backgroundColor: 'white' }}
            value={filtroDepto}
            onChange={(e) => setFiltroDepto(e.target.value)}
          >
            <option value="Todos">Gerencias</option>
            {listaGerencias
              .filter(g => {
                if (!currentUser) return true;
                const rank = getRank(currentUser.rol);
                if (rank <= 2) return g === currentUser.departamento;
                return true;
              })
              .map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          {getRank(currentUser?.rol) >= 2 && (
            <select
              className="input-tc"
              style={{ flex: 1, margin: 0, backgroundColor: 'white' }}
              value={filtroSolicitante}
              onChange={(e) => setFiltroSolicitante(e.target.value)}
            >
              <option value="Todos">Solicitante</option>
              {listaSubordinados.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          <select
            className="input-tc"
            style={{ flex: 1, margin: 0, backgroundColor: 'white' }}
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
          >
            <option value="Todos">Todas las Categorías</option>
            {[...new Set(historial.flatMap(h => (h.detalles || []).map(d => d.categoria)).filter(c => c))].sort().map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            className="input-tc"
            style={{ flex: 1, margin: 0, backgroundColor: 'white' }}
            value={filtroCC}
            onChange={(e) => setFiltroCC(e.target.value)}
          >
            <option value="Todos">C. Costo</option>
            {centrosCosto.map(cc => <option key={cc.id} value={cc.nombre}>{cc.nombre}</option>)}
          </select>

          <select
            className="input-tc"
            style={{ flex: 1, margin: 0, backgroundColor: 'white' }}
            value={filtroStatusCompra}
            onChange={(e) => setFiltroStatusCompra(e.target.value)}
          >
            <option value="Todos">Estatus de Compra</option>
            <option value="EN ESPERA">EN ESPERA</option>
            <option value="PARCIAL">PARCIAL</option>
            <option value="COMPLETADO">COMPLETADO</option>
          </select>

          <div style={{ display: 'flex', gap: '5px', alignItems: 'center', backgroundColor: 'white', padding: '0 10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>DEL:</span>
            <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} style={{ border: 'none', fontSize: '12px', outline: 'none' }} />
            <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>AL:</span>
            <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} style={{ border: 'none', fontSize: '12px', outline: 'none' }} />
          </div>
        </div>
      </div>

      {/* --- TABLA DE HISTORIAL --- */}
      <div className="table-container" style={{ borderRadius: 0, border: 'none', boxShadow: 'none' }}>
        <table className="tc-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '130px', padding: '15px' }}>ID / FECHA</th>
              <th style={{ width: '220px' }}>SOLICITANTE / GERENCIA</th>
              <th style={{ textAlign: 'center', width: '150px' }}>ESTATUS APROBACIÓN</th>
              <th style={{ width: '300px' }}>JUSTIFICACIÓN / CATEGORÍA</th>
              <th style={{ width: '180px' }}>CENTRO DE COSTO</th>
              <th style={{ width: '100px' }}>TOTAL ($)</th>
              <th style={{ textAlign: 'center', width: '130px' }}>TIEMPO SLA</th>
              <th style={{ textAlign: 'center', width: '120px' }}>ESTATUS COMPRA</th>
              <th style={{ textAlign: 'center', width: '100px' }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {historialFiltrado.map(req => (
              <tr key={req.id}>
                <td data-label="CORRELATIVO"
                  style={{ cursor: 'pointer', padding: '15px', verticalAlign: 'middle' }}
                  onClick={() => verRequisicion(req)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: req.prioridad === 'Emergencia' ? '#ef4444' : '#0ea5e9',
                          flexShrink: 0
                        }}
                      />
                      <motion.span
                        whileHover={{
                          scale: 1.1,
                          x: 5,
                          color: '#2563eb',
                          textShadow: '0 0 8px rgba(37, 99, 235, 0.2)'
                        }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 10 }}
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
                        {req.correlativo}
                      </motion.span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '14px', fontWeight: '500' }}>
                      {req.fecha ? format(new Date(req.fecha + 'T12:00:00'), 'dd/MM/yyyy') : 'N/A'}
                    </div>
                  </div>
                </td>

                <td data-label="SOLICITANTE" style={{ verticalAlign: 'middle' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#2D2D2D', lineHeight: '1.2' }}>{formatName(req.solicitante)}</div>
                  <div style={{ fontSize: '11px', fontWeight: '400', color: '#757575', marginTop: '1px', lineHeight: '1.2' }}>{req.gerencia}</div>
                </td>

                <td data-label="ESTADO" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                  {(() => {
                    const status = req.estado_aprobacion === 'aprobado_final' ? 'APROBADA' :
                      req.estado_aprobacion === 'ANULADA' ? 'ANULADA' :
                        req.estado_aprobacion === 'rechazada' ? 'RECHAZADA' : 'PENDIENTE';

                    const isGerente = req.estado_aprobacion?.includes('pendiente') || req.estado_aprobacion?.includes('enviada');

                    let bg = '#FFF9E6'; // Ámbar muy claro
                    let color = '#B25E00'; // Marrón oscuro

                    if (status === 'APROBADA') { bg = '#ECFDF5'; color = '#065F46'; }
                    else if (status === 'ANULADA' || status === 'RECHAZADA') { bg = '#F1F5F9'; color = '#475569'; }
                    else if (isGerente) { bg = '#EFF6FF'; color = '#1E40AF'; }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '500',
                          backgroundColor: bg,
                          color: color,
                          padding: '4px 10px',
                          borderRadius: '6px',
                          display: 'inline-block'
                        }}>
                          {req.estado_aprobacion === 'aprobado_final' ? 'APROBADA' :
                            req.estado_aprobacion === 'pendiente_proyecto' ? 'GERENTE PROYECTO' :
                              req.estado_aprobacion === 'pendiente_area' || req.estado_aprobacion === 'enviada_area' ? 'GERENTE ÁREA' :
                                req.estado_aprobacion === 'enviada_general' ? 'GERENTE GENERAL' :
                                  req.estado_aprobacion === 'rechazada' ? 'RECHAZADA' :
                                    req.estado_aprobacion?.toUpperCase()?.replace('_', ' ') || 'PENDIENTE'}
                        </span>
                      </div>
                    );
                  })()}
                </td>

                <td data-label="JUSTIFICACIÓN / CATEGORÍA" style={{ verticalAlign: 'middle' }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#2D2D2D',
                    textTransform: 'uppercase',
                    maxWidth: '280px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }} title={req.justificacion}>
                    {req.justificacion || 'SIN JUSTIFICACIÓN'}
                    {req.observaciones && <MessageSquare size={14} style={{ color: '#8b5cf6', marginLeft: '8px', verticalAlign: 'middle' }} title="Tiene observaciones" />}
                  </div>
                  <div style={{ fontSize: '11px', color: '#757575', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span>{req.estado_aprobacion === 'ANULADA' ? '-' : (req.detalles?.[0]?.categoria || 'N/A')}</span>
                    {req.detalles?.length > 1 && (
                      <span
                        style={{ color: '#0ea5e9', fontWeight: '700', cursor: 'help' }}
                        title={req.detalles.slice(1).map(d => `- ${d.descripcion}`).join('\n')}
                      >
                        (+{req.detalles.length - 1} más)
                      </span>
                    )}
                  </div>
                </td>

                <td data-label="CENTRO COSTO" style={{ fontSize: '12px', color: '#2D2D2D', verticalAlign: 'middle' }}>
                  {req.centroCosto}
                </td>

                <td data-label="TOTAL" style={{ verticalAlign: 'middle' }}>
                  {req.estado_aprobacion === 'ANULADA' ? (
                    <span style={{ color: '#757575', fontSize: '12px' }}>-</span>
                  ) : (
                    <span style={{
                      fontSize: '12px',
                      fontWeight: req.total > 0 ? '700' : '400',
                      color: req.total > 0 ? '#2D2D2D' : '#757575'
                    }}>
                      $ {req.total?.toLocaleString('de-DE')}
                    </span>
                  )}
                </td>

                <td data-label="TIEMPO SLA" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                  {(() => {
                    const isJustificada = req.items?.some(it => 
                      it.historial_compras?.some(h => h.tipo === 'JUSTIFICACION')
                    );

                    let deadline = req.fecha_limite_compra;
                    if (!deadline && req.estado_aprobacion === 'aprobado_final' && req.fecha_emision) {
                      const base = new Date(req.fecha_emision);
                      const dias = req.prioridad === 'Emergencia' ? 2 : 5;
                      deadline = new Date(base.getTime() + (dias * 24 * 60 * 60 * 1000)).toISOString();
                    }

                    if (deadline && req.status?.toUpperCase() !== 'COMPLETADO') {
                      const limite = new Date(deadline);
                      const hoy = new Date();
                      const diff = limite.getTime() - hoy.getTime();

                      if (isJustificada) return (
                        <div style={{
                          fontSize: '0.65rem',
                          fontWeight: '800',
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          display: 'inline-block',
                          whiteSpace: 'nowrap'
                        }}>
                          ⏸️ SLA Pausado - Justificado
                        </div>
                      );

                      if (req.is_pausada) return (
                        <div style={{
                          fontSize: '0.65rem',
                          fontWeight: '800',
                          backgroundColor: '#fef3c7',
                          color: '#d97706',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid #fde68a',
                          display: 'inline-block',
                          whiteSpace: 'nowrap'
                        }}>
                          ⏸️ SLA Pausado - Espera de Precios
                        </div>
                      );

                      const horasTotales = Math.floor(diff / (1000 * 60 * 60));
                      const color = horasTotales < 0 ? '#ef4444' : (horasTotales < 24 ? '#f59e0b' : '#16a34a');

                      const d = Math.floor(horasTotales / 24);
                      const h = horasTotales % 24;
                      const label = horasTotales < 0 ? 'VENCIDO' : (d > 0 ? `${d}d ${h}h` : `${h}h`);

                      return (
                        <div style={{
                          fontSize: '0.75rem',
                          fontWeight: '800',
                          backgroundColor: `${color}15`,
                          color: color,
                          padding: '4px 8px',
                          borderRadius: '6px',
                          display: 'inline-block'
                        }}>
                          {label}
                        </div>
                      );
                    }
                    return <span style={{ color: '#94a3b8', fontSize: '11px' }}>-</span>;
                  })()}
                </td>

                <td data-label="STATUS COMPRA" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                  {req.estado_aprobacion === 'ANULADA' ? '-' : (
                    <span style={{
                      backgroundColor: req.status?.toUpperCase() === 'COMPLETADO' ? '#ECFDF5' : '#FFF9E6',
                      color: req.status?.toUpperCase() === 'COMPLETADO' ? '#065F46' : '#B25E00',
                      fontSize: '11px',
                      fontWeight: '500',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      display: 'inline-block'
                    }}>
                      {req.status}
                    </span>
                  )}
                </td>

                <td data-label="ACCIONES" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); verRequisicion(req); }}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}
                    >
                      <Eye size={18} />
                    </button>

                    {req.estado_aprobacion !== 'ANULADA' && (currentUser?.correo?.toLowerCase() === 'jcontreras.totalclean@gmail.com' || (currentUser?.rol || '').toLowerCase().includes('analista')) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); anularRequisicion(req.id); }}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}
                      >
                        <Ban size={18} />
                      </button>
                    )}

                    {currentUser?.correo?.toLowerCase() === 'jcontreras.totalclean@gmail.com' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); manejarEliminar(req.id); }}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', transition: 'color 0.2s' }}
                        onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && historialFiltrado.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--slate-400)' }}>No se encontraron registros con esos filtros.</div>}
      </div>

      {/* --- MODAL DE FORMULARIO (NUEVA / EDITAR) --- */}
      {(isOpen || showModal) && ((() => {
        const reqActual = editandoId ? historial.find(h => String(h.id) === String(editandoId)) : null;
        return (
          <div className="modal-overlay">
            <div className="modal-card animate-modal" style={{ maxWidth: '95%', width: '1300px', height: '95vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
              <div id="area-pdf" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* --- ENCABEZADO FIJO --- */}
                <div style={{
                  flexShrink: 0,
                  background: 'rgba(235, 245, 255, 0.95)',
                  backdropFilter: 'blur(12px)',
                  padding: '20px 40px',
                  borderBottom: '1px solid rgba(0,0,0,0.05)',
                  position: 'relative'
                }}>
                  <button 
                    onClick={intentarCerrarModal}
                    style={{ position: 'absolute', top: '15px', right: '15px', border: 'none', background: 'rgba(255,255,255,0.8)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s', zIndex: 100 }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#white'; e.currentTarget.style.color = '#0f172a'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.8)'; e.currentTarget.style.color = '#64748b'; }}
                  >
                    <X size={18} />
                  </button>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {/* IZQUIERDA: TÍTULO Y REF + TIMELINE ICON */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <h1 style={{
                          margin: 0,
                          fontSize: '1.15rem',
                          fontWeight: '800',
                          color: '#1e293b',
                          letterSpacing: '-0.02em',
                          textTransform: 'uppercase'
                        }}>
                          REQUISICIÓN DE RECURSOS
                        </h1>
                        {observaciones && <MessageSquare size={20} style={{ color: '#8b5cf6' }} title="Esta requisición tiene observaciones" />}

                        {editandoId && (
                          <button
                            onClick={() => setMostrarTimeline(!mostrarTimeline)}
                            style={{
                              width: '32px', height: '32px', borderRadius: '50%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', transition: 'all 0.2s',
                              backgroundColor: mostrarTimeline ? '#0ea5e9' : 'white',
                              color: mostrarTimeline ? 'white' : '#64748b',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                              border: '1px solid #e2e8f0'
                            }}
                            title="Ver Línea de Tiempo"
                          >
                            <Clock size={16} />
                          </button>
                        )}
                      </div>


                      {(() => {
                        const reqActual = editandoId ? historial.find(h => h.id === editandoId) : null;
                        const ref = datosPredefinidos?.id_control ? `REF: ${datosPredefinidos.id_control}` : (reqActual?.origen || '');
                        if (!ref) return null;
                        return (
                          <div style={{
                            background: 'white',
                            color: '#475569',
                            padding: '2px 10px',
                            borderRadius: '6px',
                            fontSize: '0.65rem',
                            fontWeight: '900',
                            border: '1px solid #cbd5e1',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            width: 'fit-content',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                          }}>
                            <Diamond size={12} /> {ref}
                          </div>
                        );
                      })()}
                    </div>

                    {/* DERECHA: ID (AL TOPE) + SLA TIMER */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginRight: '40px' }}>
                      {(() => {
                        const reqActual = editandoId ? historial.find(h => h.id === editandoId) : null;
                        if (!reqActual || reqActual.status?.toUpperCase() === 'COMPLETADO') return null;

                        if (reqActual.estado_aprobacion !== 'aprobado_final' && reqActual.estado_aprobacion !== 'finalizado') return null;

                        let limiteDate = reqActual.fecha_limite_compra;
                        if (!limiteDate && reqActual.fecha_emision) {
                          const base = new Date(reqActual.fecha_emision);
                          const dias = reqActual.prioridad === 'Emergencia' ? 2 : 5;
                          limiteDate = new Date(base.getTime() + (dias * 24 * 60 * 60 * 1000));
                        } else if (limiteDate) {
                          limiteDate = new Date(limiteDate);
                        }

                        if (!limiteDate) return null;

                        const isJustificada = reqActual.items?.some(it => 
                          it.historial_compras?.some(h => h.tipo === 'JUSTIFICACION')
                        );

                        const hoy = new Date();
                        const diff = limiteDate.getTime() - hoy.getTime();
                        const isPausada = reqActual.is_pausada;

                        if (isJustificada) return (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            backgroundColor: '#f1f5f9',
                            padding: '8px 15px',
                            borderRadius: '10px',
                            border: '1px solid',
                            borderColor: '#cbd5e1'
                          }}>
                            <Clock size={16} color="#475569" />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>
                                SLA Pausado
                              </span>
                              <span style={{
                                fontSize: '0.9rem',
                                fontWeight: '1000',
                                color: '#475569'
                              }}>
                                Justificación Registrada
                              </span>
                            </div>
                          </div>
                        );

                        return (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            backgroundColor: isPausada ? '#fffbeb' : '#f8fafc',
                            padding: '8px 15px',
                            borderRadius: '10px',
                            border: '1px solid',
                            borderColor: isPausada ? '#fde68a' : '#e2e8f0'
                          }}>
                            {isPausada ? <Ban size={16} color="#d97706" /> : <Clock size={16} color="#64748b" />}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>
                                {isPausada ? 'SLA PAUSADO' : 'Tiempo Límite'}
                              </span>
                              <span style={{
                                fontSize: '0.9rem',
                                fontWeight: '1000',
                                color: (() => {
                                  if (isPausada) return '#d97706';
                                  return diff < 0 ? '#ef4444' : (diff < 86400000 ? '#f59e0b' : '#16a34a');
                                })()
                              }}>
                                {(() => {
                                  if (diff < 0 && !isPausada) return 'PLAZO VENCIDO';
                                  if (isPausada) return 'EN PAUSA';
                                  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                                  const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                  return `${d}d ${h}h restantes`;
                                })()}
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: '1.8rem',
                          fontWeight: '1000',
                          color: '#1e3a8a',
                          lineHeight: '1',
                          letterSpacing: '0.05em'
                        }}>
                          {editandoId ? (historial.find(h => h.id === editandoId)?.correlativo) : previewCorrelativo}
                        </div>
                        <div style={{
                          fontSize: '0.6rem',
                          fontWeight: '900',
                          color: '#64748b',
                          marginTop: '3px',
                          letterSpacing: '0.1em',
                          opacity: 0.8
                        }}>
                          ID REQ
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* --- CUERPO DESPLAZABLE --- */}
                <div style={{ flexGrow: 1, overflowY: 'auto', padding: '20px 40px' }}>
                  {/* --- LÍNEA DE TIEMPO COLAPSABLE --- */}
                  {editandoId && (
                    <div style={{ width: '100%' }}>
                      <AnimatePresence>
                        {mostrarTimeline && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            style={{ overflow: 'hidden', marginBottom: '20px' }}
                          >
                            <div className="timeline-container-premium">
                              <div className="timeline-line"></div>
                              {(() => {
                                const reqActual = historial.find(h => String(h.id) === String(editandoId));
                                if (!reqActual) return null;

                                const tieneProyecto = reqActual.aprobado_gerente_proyecto || reqActual.f_aprobacion_proyecto || reqActual.firma_gerente_proyecto;

                                const steps = [
                                  { label: 'SOLICITADO', name: reqActual.solicitante, date: reqActual.fecha_emision, icon: <User size={20} />, completed: true },
                                  ...(tieneProyecto ? [{ label: 'GERENTE PROYECTO', name: reqActual.n_aprobacion_proyecto, date: reqActual.f_aprobacion_proyecto, icon: <Settings size={20} />, completed: true }] : []),
                                  { label: 'GERENTE ÁREA', name: reqActual.n_aprobacion_area, date: reqActual.f_aprobacion_area, icon: <Building2 size={20} />, completed: reqActual.aprobado_gerente_area || (reqActual.estado_aprobacion !== 'pendiente_proyecto' && reqActual.estado_aprobacion !== 'pendiente_area' && reqActual.estado_aprobacion !== 'enviada_area' && reqActual.estado_aprobacion !== 'rechazada') },
                                  { label: 'GERENTE GENERAL', name: reqActual.n_aprobacion_general, date: reqActual.f_aprobacion_general, icon: <Diamond size={20} />, completed: reqActual.aprobado_gerente_general || reqActual.estado_aprobacion === 'aprobado_final' },
                                  { label: 'INICIO COMPRAS', date: reqActual.f_inicio_compras, icon: <Clock size={20} />, completed: !!reqActual.f_inicio_compras },
                                  { label: 'COMPRA CULMINADA', date: reqActual.f_culminacion_compras, icon: <ShoppingCart size={20} />, completed: reqActual.status?.toUpperCase() === 'COMPLETADO' }
                                ];

                                return steps.map((step, idx) => (
                                  <div key={idx} className={`timeline-step ${step.completed ? 'completed' : ''}`}>
                                    <div className="timeline-icon-wrapper">
                                      {step.completed ? <CheckCircle2 size={24} /> : step.icon}
                                    </div>
                                    <div className="timeline-info">
                                      <span className="timeline-label">{step.label}</span>
                                      {step.name && <span className="timeline-name" style={{ display: 'block', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step.name}</span>}
                                      {step.date && (
                                        <span className="timeline-date">
                                          {(() => {
                                            try {
                                              return format(new Date(step.date), 'dd/MM/yy HH:mm');
                                            } catch (e) {
                                              return step.date;
                                            }
                                          })()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ));
                              })()}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 160px) 1.5fr 1fr 1fr 180px 1fr', gap: '20px', marginBottom: '25px' }}>
                  <div>
                    <label className="stat-label" style={{ color: '#1e293b' }}>FECHA REQUERIDA <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                      <Clock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        className="input-tc"
                        type="date"
                        value={fechaRequerida}
                        onChange={(e) => { setHasChanges(true); setFechaRequerida(e.target.value); }}
                        disabled={!!editandoId}
                        style={{ width: '100%', paddingLeft: '38px' }}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="stat-label" style={{ color: '#1e293b' }}>SOLICITANTE</label>
                    <div className="input-tc" style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#f8fafc', height: '42px', boxSizing: 'border-box' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        backgroundColor: 'var(--primary)', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.7rem', fontWeight: 'bold'
                      }}>
                        {getInitials(solicitante)}
                      </div>
                      <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--slate-800)' }}>
                        {solicitante}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="stat-label" style={{ color: '#1e293b' }}>CENTRO DE COSTOS</label>
                    <div className="input-tc" style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: '#f8fafc',
                      height: '42px',
                      boxSizing: 'border-box',
                      border: '1px solid #e2e8f0'
                    }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--slate-800)' }}>
                        {centroCosto || 'Sin asignar'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="stat-label" style={{ color: '#1e293b' }}>GERENCIA</label>
                    <div className="input-tc" style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: '#f8fafc',
                      height: '42px',
                      boxSizing: 'border-box',
                      border: '1px solid #e2e8f0'
                    }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--slate-800)' }}>
                        {departamento || 'Sin asignar'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="stat-label" style={{ color: '#1e293b' }}>
                      PRIORIDAD <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>*</span>
                    </label>
                    <div style={{
                      display: 'flex',
                      background: '#f1f5f9',
                      padding: '3px',
                      borderRadius: '12px',
                      height: '42px',
                      border: '1px solid',
                      borderColor: !prioridad ? 'rgba(14, 165, 233, 0.4)' : '#e2e8f0',
                      boxShadow: !prioridad ? '0 0 0 2px rgba(14, 165, 233, 0.1)' : 'none',
                      gap: '3px',
                      transition: 'all 0.3s ease'
                    }}>
                      <button
                        onClick={() => { setHasChanges(true); setPrioridad('Normal'); }}
                        disabled={editandoId && !modoEdicion}
                        style={{
                          flex: 1,
                          border: 'none',
                          borderRadius: '9px',
                          background: prioridad === 'Normal' ? 'white' : 'transparent',
                          boxShadow: prioridad === 'Normal' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                          color: prioridad === 'Normal' ? '#0ea5e9' : '#64748b',
                          fontSize: '0.65rem',
                          fontWeight: '900',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        {prioridad === 'Normal' && <CheckCircle2 size={12} />}
                        NORMAL
                      </button>
                      <button
                        onClick={() => { setHasChanges(true); setPrioridad('Emergencia'); }}
                        disabled={editandoId && !modoEdicion}
                        style={{
                          flex: 1,
                          border: 'none',
                          borderRadius: '9px',
                          background: prioridad === 'Emergencia' ? 'white' : 'transparent',
                          boxShadow: prioridad === 'Emergencia' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                          color: prioridad === 'Emergencia' ? '#ef4444' : '#64748b',
                          fontSize: '0.65rem',
                          fontWeight: '900',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        {prioridad === 'Emergencia' && <CheckCircle2 size={12} color="#ef4444" />}
                        EMERGENCIA
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="stat-label" style={{ color: '#1e293b' }}>ID REF. PROYECTO / CONTRATO</label>
                    <div style={{ position: 'relative', height: '42px' }}>
                      <Building2 size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        className="input-tc"
                        style={{ paddingLeft: '38px', width: '100%', height: '100%' }}
                        list="ids-proyecto-previos"
                        value={idReferenciaProyecto}
                        onChange={manejarCambioIdProyecto}
                        placeholder="XXX-0000-0000"
                        disabled={editandoId && !modoEdicion}
                      />
                      <datalist id="ids-proyecto-previos">
                        {idsReferenciaPrevios.map(id => <option key={id} value={id} />)}
                      </datalist>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label className="stat-label" style={{
                    color: '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'linear-gradient(90deg, #f1f5f9 0%, transparent 100%)',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    borderLeft: '4px solid var(--primary)',
                    width: 'fit-content',
                    marginBottom: '10px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}>
                    <FileText size={16} color="var(--primary)" />
                    Descripción de la solicitud <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      className="input-tc"
                      type="text"
                      value={justificacion}
                      onChange={(e) => { setHasChanges(true); setJustificacion(e.target.value); }}
                      placeholder="Explique el motivo de la requisición (Obligatorio)"
                      required
                      disabled={!!editandoId}
                      style={{
                        flex: 1,
                        border: '1px solid',
                        borderColor: !justificacion ? 'rgba(14, 165, 233, 0.4)' : '#e2e8f0',
                        boxShadow: !justificacion ? '0 0 0 2px rgba(14, 165, 233, 0.1)' : 'none',
                        transition: 'all 0.3s ease'
                      }}
                    />
                    <button
                      onClick={() => setMostrarObservaciones(!mostrarObservaciones)}
                      style={{
                        width: '42px', height: '42px', borderRadius: '12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.2s',
                        backgroundColor: mostrarObservaciones ? '#8b5cf6' : 'white',
                        color: mostrarObservaciones ? 'white' : '#64748b',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        border: '1px solid #e2e8f0'
                      }}
                      title="Ver Observaciones"
                    >
                      <MessageSquare size={20} />
                    </button>
                  </div>
                </div>

                {/* --- SECCIÓN DE DIRECTRICES DE DIRECCIÓN (ESTÁTICO / SIEMPRE VISIBLE SI EXISTE) --- */}
                {observacionesDireccion && (
                  <div style={{
                    backgroundColor: '#faf5ff',
                    padding: '12px 18px',
                    borderRadius: '12px',
                    border: '1px solid #ddd6fe',
                    borderLeft: '4px solid #7c3aed',
                    marginBottom: '20px'
                  }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: '900', color: '#6d28d9', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', margin: 0, marginBottom: '6px' }}>
                      🏛️ Directrices de la Dirección
                    </label>
                    <p style={{ margin: 0, color: '#4c1d95', fontSize: '0.85rem', fontWeight: '600', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>
                      {observacionesDireccion}
                    </p>
                  </div>
                )}

                {/* --- SECCIÓN DE OBSERVACIONES COLAPSABLE --- */}
                <AnimatePresence>
                  {mostrarObservaciones && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      style={{ overflow: 'hidden', marginBottom: '20px' }}
                    >
                      <div style={{ padding: '15px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          <label className="stat-label" style={{ marginBottom: 0, color: '#1e293b', fontSize: '0.75rem' }}>OBSERVACIONES Y NOTAS</label>
                          {editandoId && !editandoObs && (
                            <button
                              onClick={() => {
                                setObsTemporal(observaciones);
                                setEditandoObs(true);
                              }}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.9rem', padding: 0 }}
                              title="Editar Observaciones"
                            >
                              ✏️
                            </button>
                          )}
                        </div>

                        {editandoObs ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <textarea
                              className="input-tc"
                              style={{ minHeight: '80px', paddingTop: '10px', fontSize: '0.85rem' }}
                              value={obsTemporal}
                              onChange={(e) => setObsTemporal(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  guardarObservacionesDirecto();
                                }
                              }}
                              placeholder="Actualice las observaciones aquí..."
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                className="btn-tc btn-tc-success"
                                style={{ padding: '4px 12px', fontSize: '0.7rem' }}
                                onClick={guardarObservacionesDirecto}
                              >
                                ✓ GUARDAR
                              </button>
                              <button
                                className="btn-tc btn-tc-secondary"
                                style={{ padding: '4px 12px', fontSize: '0.7rem' }}
                                onClick={() => setEditandoObs(false)}
                              >
                                CANCELAR
                              </button>
                            </div>
                          </div>
                        ) : (
                          <textarea
                            className="input-tc"
                            style={{ minHeight: '60px', paddingTop: '10px', fontSize: '0.85rem' }}
                            value={observaciones}
                            onChange={(e) => { setHasChanges(true); setObservaciones(e.target.value); }}
                            placeholder="Notas adicionales sobre la entrega, especificaciones técnicas, etc."
                            disabled={editandoId && !editandoObs}
                          />
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {editandoId && historial.find(h => h.id === editandoId)?.estado_aprobacion === 'rechazada' && (
                  <div style={{ marginBottom: '25px', padding: '15px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px' }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: '900', color: '#991b1b', textTransform: 'uppercase', marginBottom: '5px', display: 'block' }}>
                      ⚠️ MOTIVO DE RECHAZO
                    </label>
                    <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.9rem', fontWeight: '500' }}>
                      {historial.find(h => h.id === editandoId)?.motivo_rechazo || 'No especificado'}
                    </p>
                  </div>
                )}



                <table className="tc-table" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--slate-50)' }}>
                      <th style={{ width: '5px', fontSize: '0.65rem', color: '#1e293b' }}>#</th>
                      <th style={{ width: '250px', color: '#1e293b' }}>CLASIFICACIÓN</th>
                      <th style={{ width: '350px', color: '#1e293b' }}>CATEGORÍA</th>
                      <th style={{ width: '70px', color: '#1e293b' }}>CANT.</th>
                      <th style={{ width: '90px', color: '#1e293b' }}>UNI.</th>
                      <th style={{ width: '450px', color: '#1e293b' }}>DESCRIPCIÓN</th>
                      <th style={{ width: '250px', color: '#1e293b' }}>BENEFICIARIO</th>
                      <th style={{ width: '60px', textAlign: 'right', color: '#1e293b' }}>P.U.</th>
                      <th style={{ width: '60px', textAlign: 'right', color: '#1e293b' }}>TOTAL</th>
                      <th style={{ width: '40px', textAlign: 'center', color: '#1e293b' }}>ALM.</th>
                      <th style={{ width: '10px', textAlign: 'center', color: '#1e293b' }}>TR.</th>
                      <th style={{ width: '5px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {(Array.isArray(renglones) ? renglones : []).map((f, index) => (
                        <React.Fragment key={f.id}>
                          <motion.tr
                            className="renglon-row"
                            initial={{ opacity: 0, height: 0, scaleY: 0.8 }}
                            animate={{ opacity: 1, height: 'auto', scaleY: 1 }}
                            exit={{ opacity: 0, height: 0, scaleY: 0.8, overflow: 'hidden' }}
                            transition={{ duration: 0.3 }}
                            style={{ 
                              minHeight: '60px',
                              backgroundColor: f.anulado ? '#f8fafc' : 'transparent',
                              borderLeft: f.anulado ? '4px solid #ef4444' : 'none',
                              opacity: f.anulado ? 0.75 : 1
                            }}
                          >
                            <td style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', padding: '12px 4px' }}>{index + 1}</td>
                            <td style={{ padding: '12px 4px' }}><input className="input-tc" value={f.clasificacion} onChange={(e) => actualizarFila(f.id, 'clasificacion', e.target.value)} disabled={!!editandoId || f.anulado} /></td>
                            <td style={{ padding: '12px 4px' }}><input className="input-tc" value={f.categoria} onChange={(e) => actualizarFila(f.id, 'categoria', e.target.value)} disabled={!!editandoId || f.anulado} /></td>
                            <td style={{ padding: '12px 4px' }}><input className="input-tc" type="number" value={f.cant === '' ? '' : Number(f.cant)} onChange={(e) => actualizarFila(f.id, 'cant', e.target.value)} disabled={(editandoId && !modoEdicion) || f.anulado} /></td>
                            <td style={{ padding: '12px 4px' }}>
                              <select className="input-tc" value={f.uni} onChange={(e) => actualizarFila(f.id, 'uni', e.target.value)} disabled={(editandoId && !modoEdicion) || f.anulado}>
                                {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '12px 4px' }}>
                              <textarea 
                                className="input-tc" 
                                value={f.descripcion} 
                                onChange={(e) => actualizarFila(f.id, 'descripcion', e.target.value)} 
                                style={{ 
                                  resize: 'vertical', 
                                  minHeight: '48px', 
                                  paddingTop: '10px', 
                                  width: '100%', 
                                  boxSizing: 'border-box', 
                                  lineHeight: '1.4',
                                  textDecoration: f.anulado ? 'line-through' : 'none',
                                  color: f.anulado ? '#94a3b8' : 'inherit'
                                }} 
                                rows="1" 
                                disabled={(editandoId && !modoEdicion) || f.anulado} 
                              />
                              {f.anulado && (
                                <div style={{ marginTop: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.6rem', color: '#ef4444', backgroundColor: '#fee2e2', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                  🚫 SIN EFECTO / SALDO ANULADO
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '12px 4px' }}><input className="input-tc" value={f.beneficiario} onChange={(e) => actualizarFila(f.id, 'beneficiario', e.target.value)} placeholder="Beneficiario" disabled={(editandoId && !modoEdicion) || f.anulado} /></td>
                            <td style={{ padding: '12px 4px' }}><input className="input-tc" type="number" value={f.pu === '' ? '' : Number(f.pu)} style={{ textAlign: 'right' }} onChange={(e) => actualizarFila(f.id, 'pu', e.target.value)} disabled={(editandoId && !modoEdicion) || f.anulado} /></td>
                            <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '12px 4px' }}>{f.total.toLocaleString('de-DE')}</td>
                            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                              {(() => {
                                const statusAlmacen = f.estatus_almacen || (f.enviado_almacen ? 'Ubicado' : 'Pendiente_Compras');
                                const ubicacionVal = f.ubicacion_almacen || f.almacen_destino;
                                if (statusAlmacen !== 'Ubicado') return null;

                                return (
                                  <div 
                                    className="warehouse-located-icon-wrapper"
                                    style={{ 
                                      position: 'relative',
                                      display: 'inline-block',
                                      fontSize: '1.2rem',
                                      cursor: 'help',
                                      transition: 'all 0.3s ease',
                                      userSelect: 'none'
                                    }}
                                  >
                                    📦
                                    <div 
                                      className="warehouse-located-tooltip"
                                      style={{
                                        position: 'absolute',
                                        bottom: '125%',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        backgroundColor: '#1e293b',
                                        color: '#f8fafc',
                                        padding: '6px 10px',
                                        borderRadius: '6px',
                                        fontSize: '11px',
                                        fontWeight: '400',
                                        whiteSpace: 'nowrap',
                                        zIndex: 100,
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                        opacity: 0,
                                        pointerEvents: 'none',
                                        transition: 'opacity 0.2s',
                                        fontFamily: 'Inter, sans-serif'
                                      }}
                                    >
                                      Ubicado en: {ubicacionVal || 'Almacén general'}
                                      <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: '50%',
                                        marginLeft: '-5px',
                                        borderWidth: '5px',
                                        borderStyle: 'solid',
                                        borderColor: '#1e293b transparent transparent transparent'
                                      }} />
                                    </div>
                                  </div>
                                );
                              })()}
                              <style>{`
                                .warehouse-located-icon-wrapper:hover .warehouse-located-tooltip {
                                  opacity: 1 !important;
                                }
                              `}</style>
                            </td>
                            <td style={{ textAlign: 'center', padding: '12px 4px' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                                <button
                                  onClick={() => setExpandirHistorial(prev => ({ ...prev, [f.id]: !prev[f.id] }))}
                                  style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: (f.historial_compras?.length > 0) ? 1 : 0.3 }}
                                  title="Ver Trazabilidad"
                                  disabled={!f.historial_compras?.length}
                                >
                                  {expandirHistorial[f.id] ? '🔼' : '📜'}
                                </button>
                              </div>
                            </td>
                            <td style={{ textAlign: 'center', padding: '12px 4px' }}></td>
                          </motion.tr>
                          {expandirHistorial[f.id] && Array.isArray(f.historial_compras) && f.historial_compras.length > 0 && (
                            <tr>
                              <td colSpan="11" style={{ padding: '0 0 15px 40px' }}>
                                <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                  <div style={{ padding: '8px 12px', backgroundColor: '#f8fafc', fontSize: '0.7rem', fontWeight: '900', color: '#334155', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0' }}>
                                    <span>TRAZABILIDAD Y JUSTIFICACIONES DEL ÍTEM</span>
                                    <span style={{ color: 'var(--primary)' }}>{f.historial_compras.length} EVENTOS</span>
                                  </div>
                                  <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr style={{ backgroundColor: '#f1f5f9', color: '#334155', fontSize: '0.65rem' }}>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>FECHA</th>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>EVENTO</th>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>PROVEEDOR</th>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>DETALLE / MOTIVO</th>
                                        <th style={{ padding: '8px', textAlign: 'center' }}>CANT.</th>
                                        <th style={{ padding: '8px', textAlign: 'right' }}>P.U. REAL</th>
                                        <th style={{ padding: '8px', textAlign: 'right' }}>TOTAL / COMENTARIO</th>
                                        <th style={{ padding: '8px', textAlign: 'right' }}>USUARIO</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(Array.isArray(f.historial_compras) ? f.historial_compras : []).map((h, idx) => (
                                        <tr key={h.id || `${f.id}-h-${idx}`} style={{
                                          borderBottom: idx < f.historial_compras.length - 1 ? '1px solid #f1f5f9' : 'none',
                                          backgroundColor: h.tipo === 'ANULACION' ? '#fef2f2' : (h.tipo === 'JUSTIFICACION' ? '#fffbeb' : (h.tipo === 'DIRECTRIZ' ? '#faf5ff' : 'transparent'))
                                        }}>
                                          <td style={{ padding: '8px', color: '#64748b' }}>{new Date(h.fecha).toLocaleDateString()}</td>
                                          <td style={{ padding: '8px', fontWeight: 'bold', color: h.tipo === 'ANULACION' ? '#ef4444' : (h.tipo === 'JUSTIFICACION' ? '#d97706' : (h.tipo === 'DIRECTRIZ' ? '#7c3aed' : '#16a34a')) }}>
                                            {h.tipo === 'ANULACION' ? '🚫 SIN EFECTO' : (h.tipo === 'JUSTIFICACION' ? '⚠️ JUSTIFICACIÓN' : (h.tipo === 'DIRECTRIZ' ? '🏛️ DIRECTRIZ' : '✅ COMPRA'))}
                                          </td>
                                          <td style={{ padding: '8px', fontSize: '0.65rem', fontWeight: 'bold', color: '#64748b' }}>
                                            {(h.tipo !== 'JUSTIFICACION' && h.tipo !== 'ANULACION' && h.tipo !== 'DIRECTRIZ') ? (h.proveedor_nombre || 'No asignado') : '-'}
                                          </td>
                                          <td style={{ padding: '8px' }}>
                                            {h.tipo === 'ANULACION' ? (
                                              <span style={{ fontStyle: 'italic', color: '#b91c1c', fontWeight: '600' }}>Motivo: {h.motivo}</span>
                                            ) : h.tipo === 'JUSTIFICACION' ? (
                                              <span style={{ fontStyle: 'italic', color: '#92400e', fontWeight: '600' }}>{h.motivo}</span>
                                            ) : h.tipo === 'DIRECTRIZ' ? (
                                              <span style={{ fontStyle: 'italic', color: '#6d28d9', fontWeight: '600' }}>{h.motivo}</span>
                                            ) : (
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                {h.metodo_pago && (
                                                  <span style={{ fontSize: '0.55rem', backgroundColor: '#e2e8f0', color: '#475569', padding: '2px 5px', borderRadius: '4px', fontWeight: '900' }}>
                                                    {h.metodo_pago}
                                                  </span>
                                                )}
                                                <span style={{ fontWeight: '800', color: '#2563eb' }}>
                                                  {h.doc_tipo || 'FAC'}: {h.doc_numero || 'S/D'}
                                                </span>
                                                {h.factura_url && (
                                                  <a href={h.factura_url} target="_blank" rel="noreferrer" title="Ver Soporte" style={{ marginLeft: '8px', textDecoration: 'none', cursor: 'pointer', fontSize: '1rem' }}>
                                                    📎
                                                  </a>
                                                )}
                                              </div>
                                            )}
                                          </td>
                                          <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700' }}>{(h.tipo === 'JUSTIFICACION' || h.tipo === 'ANULACION' || h.tipo === 'DIRECTRIZ') ? '-' : (h.cant || '-')}</td>
                                          <td style={{ padding: '8px', textAlign: 'right' }}>{(h.tipo === 'JUSTIFICACION' || h.tipo === 'ANULACION' || h.tipo === 'DIRECTRIZ') ? '-' : (h.pu ? `$ ${h.pu.toLocaleString('de-DE')}` : '-')}</td>
                                          <td style={{ padding: '8px', textAlign: 'right' }}>
                                            {h.tipo === 'ANULACION' ? (
                                              <div style={{ fontSize: '0.7rem', color: '#7f1d1d', whiteSpace: 'pre-wrap', textAlign: 'left', backgroundColor: '#fee2e2', padding: '6px', borderRadius: '4px', border: '1px solid #fca5a5' }}>
                                                {h.comentario}
                                              </div>
                                            ) : h.tipo === 'JUSTIFICACION' ? (
                                              <div style={{ fontSize: '0.7rem', color: '#475569', whiteSpace: 'pre-wrap', textAlign: 'left', backgroundColor: '#fef3c7', padding: '6px', borderRadius: '4px' }}>
                                                {h.comentario}
                                              </div>
                                            ) : h.tipo === 'DIRECTRIZ' ? (
                                              <div style={{ fontSize: '0.7rem', color: '#4c1d95', whiteSpace: 'pre-wrap', textAlign: 'left', backgroundColor: '#f3e8ff', padding: '6px', borderRadius: '4px', border: '1px solid #ddd6fe' }}>
                                                {h.comentario}
                                              </div>
                                            ) : <span style={{ fontWeight: 'bold' }}>$ {(h.cant * h.pu).toLocaleString('de-DE')}</span>}
                                          </td>
                                          <td style={{ padding: '8px', textAlign: 'right', color: '#64748b', fontSize: '0.65rem' }}>{h.usuario_nombre}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>



                <div style={{ display: 'flex', gap: '20px', marginTop: '20px', alignItems: 'stretch' }}>
                  {/* IZQUIERDA: SOPORTES COMPACTOS */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                        <button
                          onClick={() => setMostrarSoportes(!mostrarSoportes)}
                          style={{
                            padding: '6px 14px', borderRadius: '8px',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            cursor: 'pointer', transition: 'all 0.2s',
                            backgroundColor: mostrarSoportes ? '#10b981' : '#f8fafc',
                            color: mostrarSoportes ? 'white' : '#64748b',
                            border: '1px solid #e2e8f0',
                            fontSize: '0.7rem',
                            fontWeight: '900'
                          }}
                        >
                          <Camera size={14} /> {mostrarSoportes ? 'OCULTAR SOPORTES' : 'VER SOPORTES'}
                        </button>

                        {mostrarSoportes && (!editandoId || modoEdicion) && (
                          <label
                            style={{
                              padding: '6px 14px', borderRadius: '8px',
                              display: 'flex', alignItems: 'center', gap: '8px',
                              cursor: uploading ? 'not-allowed' : 'pointer',
                              backgroundColor: '#0ea5e9',
                              color: 'white',
                              border: 'none',
                              fontSize: '0.7rem',
                              fontWeight: '900',
                              boxShadow: '0 2px 4px rgba(14, 165, 233, 0.2)'
                            }}
                          >
                            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            {uploading ? 'SUBIENDO...' : 'AÑADIR'}
                            <input type="file" multiple style={{ display: 'none' }} onChange={subirFactura} disabled={uploading || (editandoId && !modoEdicion)} accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv" />
                          </label>
                        )}
                      </div>

                      <AnimatePresence>
                        {mostrarSoportes && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            style={{ overflow: 'hidden' }}
                          >
                            <div
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                if (editandoId && !modoEdicion) {
                                  toast.error("Debe activar el modo edición para subir archivos.");
                                  return;
                                }
                                handleDrop(e);
                              }}
                              style={{
                                padding: '15px',
                                backgroundColor: '#f8fafc',
                                borderRadius: '12px',
                                border: '1px dashed #cbd5e1',
                                minHeight: '135px',
                                flex: 1
                              }}
                            >
                              {facturasUrls.length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', padding: '20px' }}>
                                  No hay archivos. Arrastre aquí para subir.
                                </div>
                              ) : (
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                  {facturasUrls.map((item, idx) => {
                                    const url = (() => {
                                      if (typeof item === 'string') {
                                        if (item.trim().startsWith('{')) {
                                          try { return JSON.parse(item).url; } catch (e) { return item; }
                                        }
                                        return item;
                                      }
                                      return item?.url;
                                    })();
                                    if (!url) return null;
                                    const lowerUrl = url.split('?')[0].toLowerCase();
                                    const isImg = /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(lowerUrl);
                                    const isPdf = lowerUrl.endsWith('.pdf');
                                    const isExcel = /\.(xls|xlsx|csv)$/i.test(lowerUrl);
                                    const isWord = /\.(doc|docx)$/i.test(lowerUrl);
                                    const isPowerPoint = /\.(ppt|pptx)$/i.test(lowerUrl);

                                    let fileInfo = { iconColor: '#64748b', bgColor: '#f8fafc', label: 'DOC' };
                                    if (isPdf) {
                                      fileInfo = { iconColor: '#ef4444', bgColor: '#fef2f2', label: 'PDF' };
                                    } else if (isExcel) {
                                      fileInfo = { iconColor: '#10b981', bgColor: '#ecfdf5', label: 'EXCEL' };
                                    } else if (isWord) {
                                      fileInfo = { iconColor: '#2563eb', bgColor: '#eff6ff', label: 'WORD' };
                                    } else if (isPowerPoint) {
                                      fileInfo = { iconColor: '#f97316', bgColor: '#fff7ed', label: 'PPT' };
                                    }

                                    return (
                                      <div key={idx} style={{ position: 'relative', width: '70px', height: '70px' }}>
                                        <a href={url} target="_blank" rel="noreferrer" style={{
                                          display: 'block', width: '100%', height: '100%',
                                          borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1',
                                          backgroundColor: 'white'
                                        }}>
                                          {isImg ? (
                                            <img src={url} alt={`Soporte ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                          ) : (
                                            <div style={{
                                              width: '100%', height: '100%',
                                              display: 'flex', flexDirection: 'column',
                                              alignItems: 'center', justifyContent: 'center',
                                              backgroundColor: fileInfo.bgColor, color: fileInfo.iconColor
                                            }}>
                                              <FileText size={18} style={{ marginBottom: '2px' }} />
                                              <span style={{ fontSize: '7px', fontWeight: 'bold', textTransform: 'uppercase' }}>{fileInfo.label}</span>
                                            </div>
                                          )}
                                        </a>
                                        <button
                                          onClick={() => eliminarSoporteDefinitivo(idx)}
                                          style={{ position: 'absolute', top: '-5px', right: '-5px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', fontSize: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  </div>

                  <div className="totals-container" style={{ width: '100%', maxWidth: '350px', minWidth: '350px', marginTop: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#64748b' }}>
                      <span className="stat-label" style={{ color: 'inherit' }}>SUB-TOTAL ESTIMADO:</span>
                      <span style={{ fontWeight: 'bold' }}>$ {subTotalEstimado.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {subTotalEjecutado > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#16a34a' }}>
                        <span className="stat-label" style={{ color: 'inherit' }}>SUB-TOTAL EJECUTADO:</span>
                        <span style={{ fontWeight: 'bold' }}>$ {subTotalEjecutado.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--slate-200)', paddingTop: '10px', color: '#64748b' }}>
                      <span style={{ fontWeight: '900', fontSize: '1rem' }}>TOTAL ESTIMADO {conIva ? "(C/IVA)" : "(S/IVA)"}:</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: '900' }}>$ {totalEstimado.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                    </div>

                    {subTotalEjecutado > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', color: '#16a34a' }}>
                        <span style={{ fontWeight: '900', fontSize: '1rem' }}>TOTAL EJECUTADO {conIva ? "(C/IVA)" : "(S/IVA)"}:</span>
                        <span style={{ fontSize: '1.2rem', fontWeight: '900' }}>$ {totalEjecutado.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    {/* Diferencia */}
                    {subTotalEjecutado > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', marginTop: '10px', borderTop: '1px dashed #cbd5e1' }}>
                        <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#475569' }}>DIFERENCIA:</span>
                        {(() => {
                          if (totalEstimado === 0) {
                            return <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#64748b' }}>+ $ {totalEjecutado.toLocaleString('de-DE', { minimumFractionDigits: 2 })} (Sin Est. Previa)</span>;
                          }
                          const diff = totalEjecutado - totalEstimado;
                          const pje = (diff / totalEstimado) * 100;
                          const isRed = diff > 0;
                          const isGreen = diff < 0;
                          const color = isRed ? '#ef4444' : isGreen ? '#16a34a' : '#64748b';
                          const sign = diff > 0 ? '+' : '';

                          // Prevent NaN or extreme values if close to 0
                          const pjeStr = isFinite(pje) ? `${pje > 0 ? '+' : ''}${pje.toFixed(1)}%` : 'N/A';

                          return (
                            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color }}>
                              {sign} $ {diff.toLocaleString('de-DE', { minimumFractionDigits: 2 })} ({pjeStr})
                            </span>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
                </div>

                  {/* --- PIE DE PÁGINA FIJO --- */}
                  <div style={{
                    flexShrink: 0,
                    padding: '20px 40px',
                    background: 'white',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '20px'
                  }}>
                    <div style={{ display: 'flex', gap: '20px' }}>
                      <button
                        className="btn-tc"
                        style={{
                          backgroundColor: 'transparent',
                          color: '#475569',
                          border: '2px solid #cbd5e1',
                          fontWeight: '900',
                          padding: '10px 22px',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.85rem'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f1f5f9';
                          e.currentTarget.style.borderColor = '#94a3b8';
                          e.currentTarget.style.color = '#0f172a';
                          e.currentTarget.style.transform = 'scale(1.03)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.borderColor = '#cbd5e1';
                          e.currentTarget.style.color = '#475569';
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                        onClick={intentarCerrarModal}
                      >
                        <ArrowLeft size={16} /> VOLVER
                      </button>
                      {editandoId && (
                        <button className="btn-tc btn-tc-dark" onClick={exportarPDF} title="Descargar como PDF">
                          <FileText size={18} /> PDF
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      {(!editandoId || modoEdicion) ? (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 'bold', color: '#475569', cursor: 'pointer', userSelect: 'none', marginRight: '6px' }}>
                          <input
                            type="checkbox"
                            checked={conIva}
                            onChange={(e) => { setHasChanges(true); setConIva(e.target.checked); }}
                            style={{ width: '15px', height: '15px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                          />
                          ¿Con IVA (16%)?
                        </label>
                      ) : (
                        <span style={{ fontSize: '0.7rem', fontWeight: '800', color: conIva ? '#16a34a' : '#ef4444', backgroundColor: conIva ? '#f0fdf4' : '#fef2f2', padding: '3px 8px', borderRadius: '6px', marginRight: '6px' }}>
                          {conIva ? 'CON IVA (16%)' : 'SIN IVA'}
                        </span>
                      )}
                      {editandoId ? (
                        <>
                          {modoEdicion ? (
                            (() => {
                              const reqActual = historial.find(h => String(h.id) === String(editandoId));
                              const isRechazada = reqActual?.estado_aprobacion === 'rechazada';

                              if (isRechazada) {
                                return (
                                  <button className="btn-tc btn-tc-primary" onClick={manejarGenerarOActualizar} disabled={loading}>
                                    {loading ? <Loader2 className="animate-spin" size={16} /> : 'ACTUALIZAR Y FINALIZAR (RE-ENVIAR)'}
                                  </button>
                                );
                              }

                              return (
                                <button className="btn-tc btn-tc-primary" onClick={manejarGenerarOActualizar} disabled={loading}>
                                  {loading ? <Loader2 className="animate-spin" size={16} /> : 'GUARDAR CAMBIOS'}
                                </button>
                              );
                            })()
                          ) : (
                            <button
                              className="btn-tc"
                              style={{
                                backgroundColor: '#2563eb', // Premium Blue-600
                                color: 'white',
                                fontWeight: '800',
                                padding: '10px 22px',
                                borderRadius: '10px',
                                border: 'none',
                                boxShadow: '0 4px 10px rgba(37, 99, 235, 0.35)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '0.85rem'
                              }}
                              onClick={() => {
                                const reqActual = historial.find(h => String(h.id) === String(editandoId));
                                if (!puedeModificarRequisicion(reqActual)) {
                                  toast.error("No tienes permisos para modificar requisiciones de otros departamentos.");
                                  return;
                                }
                                if (reqActual?.estado_aprobacion !== 'aprobado_final' && reqActual?.estado_aprobacion !== 'rechazada') {
                                  setModoEdicion(true);
                                } else if (reqActual?.estado_aprobacion === 'rechazada') {
                                  // Si está rechazada, permitimos editar para re-enviar
                                  setModoEdicion(true);
                                } else {
                                  toast.error("No se puede editar una requisición ya aprobada.");
                                }
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#1d4ed8';
                                e.currentTarget.style.transform = 'scale(1.03)';
                                e.currentTarget.style.boxShadow = '0 6px 14px rgba(29, 78, 216, 0.45)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#2563eb';
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.boxShadow = '0 4px 10px rgba(37, 99, 235, 0.35)';
                              }}
                            >
                              <Edit2 size={16} /> HABILITAR EDICIÓN
                            </button>
                          )}



                          {(() => {
                            const rolUser = (currentUser?.rol || '').toLowerCase();
                            const reqActual = historial.find(h => String(h.id) === String(editandoId));

                            let puedeVerBotonesProyecto = false;
                            if (reqActual?.estado_aprobacion === 'pendiente_proyecto') {
                              const cc = reqActual.centro_costo || '';
                              const gerenteEsperado = obtenerAprobadorProyecto(cc, gerenteDirectoCreador);
                              const esAdmin = currentUser?.esAdminReal ||
                                rolUser.includes('admin') ||
                                rolUser.includes('general') ||
                                (currentUser?.correo || '').toLowerCase() === 'cvega@totalclean.com' ||
                                (currentUser?.correo || '').toLowerCase() === 'cvega.totalclean@gmail.com';
                              
                              if (esAdmin) {
                                puedeVerBotonesProyecto = true;
                              } else {
                                if (gerenteDirectoIdCreador && currentUser?.id === gerenteDirectoIdCreador) {
                                  puedeVerBotonesProyecto = true;
                                } else if (gerenteEsperado === 'Johannel García') {
                                  puedeVerBotonesProyecto = currentUser?.nombre?.toUpperCase().includes('JOHANNEL');
                                } else if (gerenteEsperado === 'Hilda Colina') {
                                  puedeVerBotonesProyecto = currentUser?.nombre?.toUpperCase().includes('HILDA');
                                } else if (gerenteEsperado) {
                                  const miNombre = `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim();
                                  puedeVerBotonesProyecto = compararNombres(miNombre, gerenteEsperado) || rolUser.includes('proyecto') || (rolUser.includes('gerente') && currentUser?.departamento === reqActual?.gerencia);
                                } else {
                                  puedeVerBotonesProyecto = rolUser.includes('proyecto') || (rolUser.includes('gerente') && currentUser?.departamento === reqActual?.gerencia);
                                }
                              }
                            }

                            if (puedeVerBotonesProyecto) {
                              return (
                                <>
                                  <button className="btn-tc btn-tc-danger" onClick={manejarRechazarGerenteProyecto} disabled={loading}>
                                    {loading ? <Loader2 className="animate-spin" size={16} /> : 'RECHAZAR'}
                                  </button>
                                  <button className="btn-tc btn-tc-success" onClick={manejarAprobarGerenteProyecto} disabled={loading}>
                                    {loading ? <Loader2 className="animate-spin" size={16} /> : '✓ APROBAR PROYECTO'}
                                  </button>
                                </>
                              );
                            }
                            if (reqActual?.estado_aprobacion === 'pendiente_area' && currentUser?.rol?.toLowerCase()?.includes('gerente') && !currentUser?.rol?.toLowerCase()?.includes('general')) {
                              return (
                                <>
                                  <button className="btn-tc btn-tc-danger" onClick={manejarRechazarGerenteArea} disabled={loading}>
                                    {loading ? <Loader2 className="animate-spin" size={16} /> : 'RECHAZAR'}
                                  </button>
                                  <button className="btn-tc btn-tc-success" onClick={manejarAprobarGerenteArea} disabled={loading}>
                                    {loading ? <Loader2 className="animate-spin" size={16} /> : '✓ APROBAR ÁREA'}
                                  </button>
                                </>
                              );
                            }

                            const rolUpper = (currentUser?.rol || '').toUpperCase();
                            const emailLower = (currentUser?.correo || '').toLowerCase();
                            const esGG = currentUser?.esAdminReal || rolUpper === 'GERENTE GENERAL' || rolUpper === 'ADMIN' || emailLower.includes('cvega');

                            if (esGG && reqActual?.estado_aprobacion === 'enviada_general' && reqActual?.solicitante !== `${currentUser.nombre} ${currentUser.apellido}`) {
                              return (
                                <>
                                  <button className="btn-tc btn-tc-danger" onClick={manejarRechazarGeneral} disabled={loading}>
                                    {loading ? <Loader2 className="animate-spin" size={16} /> : 'RECHAZAR'}
                                  </button>
                                  <button className="btn-tc btn-tc-success" onClick={manejarAprobarGeneral} disabled={loading}>
                                    {loading ? <Loader2 className="animate-spin" size={16} /> : '✓ APROBACIÓN FINAL'}
                                  </button>
                                </>
                              );
                            }
                            return null;
                          })()}
                        </>
                      ) : (
                        <button className="btn-tc btn-tc-primary" onClick={manejarGenerarOActualizar} disabled={loading}>
                          {loading ? <Loader2 className="animate-spin" size={16} /> : 'GENERAR Y FINALIZAR REQUISICIÓN'}
                        </button>
                      )}
                    </div>
                  </div>
              </div>
            </div>
          </div>
        );
      })())}

      {/* --- MODAL DE RECHAZO PERSONALIZADO --- */}
      <AnimatePresence>
        {showRechazoModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 20000, padding: '20px' }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{ backgroundColor: 'white', borderRadius: '24px', padding: '30px', width: '100%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
            >
              <h3 style={{ margin: '0 0 10px 0', fontSize: '1.25rem', color: '#1e293b', fontWeight: '800' }}>Indique el motivo del rechazo:</h3>
              <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: '#64748b' }}>Esta información será visible para el solicitante de la requisición.</p>

              <textarea
                autoFocus
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '150px',
                  borderRadius: '16px',
                  border: '2px solid #e2e8f0',
                  padding: '15px',
                  fontSize: '0.95rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  fontFamily: 'inherit',
                  resize: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#0ea5e9'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                placeholder="Escriba aquí las razones del rechazo detalladamente..."
              />

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '25px' }}>
                <button
                  className="btn-tc btn-tc-secondary"
                  onClick={() => setShowRechazoModal(false)}
                  style={{ borderRadius: '12px', padding: '10px 20px' }}
                >
                  CANCELAR
                </button>
                <button
                  className="btn-tc btn-tc-dark"
                  onClick={confirmRechazo}
                  disabled={loading}
                  style={{ borderRadius: '12px', padding: '10px 25px', backgroundColor: '#0f172a' }}
                >
                  {loading ? <Loader2 className="animate-spin" size={16} /> : 'ACEPTAR'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
export default Requisiciones;
