import React, { useState, useEffect, useCallback, useMemo } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from './supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Loader2, MessageSquare, FileText, Upload, Paperclip } from 'lucide-react';
import './Requisiciones.css';

const Requisiciones = ({ isOpen, onClose, datosPredefinidos, onSuccess, currentUserProp }) => {
  // --- ESTADOS DEL SISTEMA ---
  const [showModal, setShowModal] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(currentUserProp || null);

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

  const enviarNotificacion = async (usuario_id, mensaje, tipo = 'Sistema') => {
    if (!usuario_id || usuario_id === currentUser?.id) return;
    try {
      const { error } = await supabase
        .from('notificaciones')
        .insert([{
          usuario_id,
          mensaje,
          tipo,
          leido: false
        }]);
      if (error) throw error;
    } catch (err) {
      console.error("Error al enviar notificación:", err.message);
    }
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
    "Administración Maracaibo", "Administración El Tigre", "Operaciones", "Mantenimiento",
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
  const [idReferenciaProyecto, setIdReferenciaProyecto] = useState('');
  const [idsReferenciaPrevios, setIdsReferenciaPrevios] = useState([]);

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
      const esPrivilegiado = esAdminReal || esGG || deptoUpper.includes('ADMINISTRACIÓN');

      // 1. Obtener todos los perfiles para el Triple Match local y Obras Asignadas
      const { data: perfilesDB } = await supabase.from('perfiles').select('id, rol, departamento, gerencia_id, obras_asignadas');


      if (!esPrivilegiado) {
        // Filtro Triple Match: En BD filtramos por depto O por creador (ID o Nombre para reqs antiguas)
        const nombreMatch = (currentUser.nombre || '').split(' ')[0] || 'Unknown';
        const userIdMatch = currentUser.id || '00000000-0000-0000-0000-000000000000';
        query = query.or(`gerencia.ilike.%${currentUser.departamento}%,user_id.eq.${userIdMatch},solicitante.ilike.%${nombreMatch}%`);
      }

      const { data, error } = await query.order('fecha_emision', { ascending: false });

      if (error) throw error;
      if (data) {
        let finalData = data;
        const myRank = getRank(currentUser.rol);

        if (!esPrivilegiado) {
          finalData = data.filter(req => {
            // REGLA FUNDAMENTAL: Siempre puede ver lo suyo
            if (currentUser.id && req.user_id === currentUser.id) return true;
            if (req.solicitante && req.solicitante.toLowerCase().includes((currentUser.nombre || '').toLowerCase().split(' ')[0])) return true;

            const creador = (perfilesDB || []).find(p => p.id === req.user_id);

            // NUEVA LÓGICA: Restricción por obras_asignadas para Gerentes de Proyecto y Analistas
            const misObras = currentUser.obras_asignadas || [];
            if (misObras.length > 0 && (rolUpper.includes('PROYECTO') || rolUpper.includes('ANALISTA'))) {
              if (misObras.includes(req.centro_costo)) return true;
            }

            // Si tiene user_id pero no lo encontramos en perfiles, lo dejamos pasar por si acaso
            if (req.user_id && !creador) return true;

            if (!creador) {
              return (req.gerencia || '').toLowerCase() === (currentUser.departamento || '').toLowerCase();
            }

            const matchDepto = (creador.departamento || '').toLowerCase() === (currentUser.departamento || '').toLowerCase();
            const matchGerencia = creador.gerencia_id === currentUser.gerencia_id;
            const rankSuperior = myRank > getRank(creador.rol);

            return matchDepto && matchGerencia && rankSuperior;
          });
        }

        const historialMapeado = finalData.map(db => ({
          id: db.id,
          correlativo: db.correlativo_req || `REQ-${String(db.id).padStart(3, '0')}`,
          origen: db.origen || 'Manual',
          solicitante: db.solicitante,
          centroCosto: db.centro_costo,
          aprobacion: db.aprobacion_nombre || (db.aprobacion ? 'Aprobado' : 'Pendiente'),
          status: db.status_compra || 'Pendiente',
          prioridad: db.prioridad,
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
          facturas_url: db.facturas_url || [],
          id_referencia_proyecto: db.id_referencia_proyecto || ''
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
              facturas_url: payload.new.facturas_url || []
            };
          }
          return req;
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cargarHistorialDesdeBD]);

  // --- LÓGICA DE FILTRADO EN TIEMPO REAL ---
  const historialFiltrado = useMemo(() => {
    return historial.filter(req => {
      const matchTexto =
        req.solicitante.toLowerCase().includes(busqueda.toLowerCase()) ||
        req.correlativo.toLowerCase().includes(busqueda.toLowerCase());

      const matchDepto = filtroDepto === 'Todos' || req.gerencia === filtroDepto;
      const matchStatus = filtroAprobacion === 'Todos' || req.estado_aprobacion === filtroAprobacion;
      const matchCategoria = filtroCategoria === 'Todos' || (req.detalles && req.detalles.some(d => d.categoria === filtroCategoria));
      const matchCC = filtroCC === 'Todos' || req.centroCosto.includes(filtroCC);
      const matchStatusCompra = filtroStatusCompra === 'Todos' || req.status.toUpperCase() === filtroStatusCompra.toUpperCase();
      const matchSolicitante = filtroSolicitante === 'Todos' || req.solicitante === filtroSolicitante;

      let matchFecha = true;
      if (fechaDesde && req.fecha < fechaDesde) matchFecha = false;
      if (fechaHasta && req.fecha > fechaHasta) matchFecha = false;

      return matchTexto && matchDepto && matchStatus && matchCategoria && matchCC && matchStatusCompra && matchFecha && matchSolicitante;
    }).sort((a, b) => {
      // Prioridad Alta primero
      if (a.prioridad === 'Alta' && b.prioridad !== 'Alta') return -1;
      if (a.prioridad !== 'Alta' && b.prioridad === 'Alta') return 1;
      // Luego por fecha desc (ya viene ordenado de BD, pero por si acaso)
      return new Date(b.fecha) - new Date(a.fecha);
    });
  }, [historial, busqueda, filtroDepto, filtroAprobacion, filtroCategoria, filtroCC, filtroStatusCompra, fechaDesde, fechaHasta, filtroSolicitante]);

  // --- ESTADOS DEL FORMULARIO ---
  const [prioridad, setPrioridad] = useState('Normal');
  const [solicitante, setSolicitante] = useState('');
  const [centroCosto, setCentroCosto] = useState('MTTO MAYOR-BOSCAN');
  const [departamento, setDepartamento] = useState('Operaciones');
  const [justificacion, setJustificacion] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [fechaRequerida, setFechaRequerida] = useState(new Date().toISOString().split('T')[0]);
  const [renglones, setRenglones] = useState([
    { id: Date.now(), clasificacion: '', categoria: '', cant: 1, uni: 'UNID', descripcion: '', beneficiario: '', pu: 0, total: 0, status: 'En Espera' }
  ]);
  const [previewCorrelativo, setPreviewCorrelativo] = useState('');

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
    "Estimación y Control": "EST",
    "Almacén": "ALM",
    "Gerencia General": "GG",
    "Servicios Generales": "SVG",
    "Contabilidad": "CNT",
    "Compras": "CMP"
  };

  const GERENCIAS_ESTATICAS = [
    "Administración Maracaibo", "Administración El Tigre", "Operaciones", "Mantenimiento",
    "Seguridad", "Recursos Humanos", "Estimación", "Almacén", "Gerencia General",
    "Servicios Generales", "Contabilidad"
  ];

  const unidades = ["UNID", "KG", "LTS", "ML", "M2", "M3", "SERV", "SG", "BOLSAS", "VIAJES", "Gal", "Sacos", "Rollo", "Pipa", "Jgo"];

  const calcularTotales = () => {
    // Estimado: Cantidad original por precio estimado
    const subTotalEstimado = renglones.reduce((acc, r) => {
      const cantOri = Number(r.cantidad_pedida ?? r.cant) || 0;
      const puEst = Number(r.pu_estimado ?? r.pu) || 0;
      return acc + (cantOri * puEst);
    }, 0);

    // Ejecutado: Suma de historiales
    const subTotalEjecutado = renglones.reduce((acc, r) => {
      const ejecutadoItem = (r.historial_compras || []).reduce((sum, h) => {
        if (h.tipo === 'JUSTIFICACION') return sum;
        return sum + ((Number(h.cant) || 0) * (Number(h.pu) || 0));
      }, 0);
      return acc + ejecutadoItem;
    }, 0);

    const totalEstimado = subTotalEstimado * 1.16;
    const totalEjecutado = subTotalEjecutado * 1.16;

    return { subTotalEstimado, subTotalEjecutado, totalEstimado, totalEjecutado };
  };

  const { subTotalEstimado, subTotalEjecutado, totalEstimado, totalEjecutado } = calcularTotales();

  const obtenerEstadoGlobal = () => {
    if (renglones.length === 0) return { texto: 'SIN ITEMS', color: '#94a3b8' };
    const todosCompletados = renglones.every(r => r.status === 'Completado');
    const algunoEnProceso = renglones.some(r => r.status === 'Parcial' || r.status === 'Completado');
    if (todosCompletados) return { texto: 'COMPLETADO', color: '#22c55e' };
    if (algunoEnProceso) return { texto: 'PARCIAL', color: '#f59e0b' };
    return { texto: 'EN ESPERA', color: '#64748b' };
  };

  const estadoGlobal = obtenerEstadoGlobal();

  // --- EFECTOS DE SINCRONIZACIÓN ---
  useEffect(() => {
    if (isOpen) {
      if (currentUser) {
        setSolicitante(`${currentUser.nombre} ${currentUser.apellido}`);
      }

      if (datosPredefinidos) {
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
      } else if (currentUser) {
        setSolicitante(`${currentUser.nombre} ${currentUser.apellido}`);
        setDepartamento(currentUser.departamento);
      }
      setShowModal(true);
    }
  }, [isOpen, datosPredefinidos, currentUser]);

  // --- LÓGICA DE PREVIEW DE CORRELATIVO ---
  useEffect(() => {
    const actualizarPreview = async () => {
      if (!showModal || editandoId) return;
      const sigla = mappingSiglasGerencia[departamento] || 'GER';
      const aa = new Date().getFullYear().toString().slice(-2);

      const { data } = await supabase
        .from('requisiciones')
        .select('correlativo_req')
        .like('correlativo_req', `RR-${sigla}-${aa}-%`)
        .order('correlativo_req', { ascending: false })
        .limit(1);

      let max = 0;
      if (data && data.length > 0) {
        const correlativoMax = data[0].correlativo_req;
        const partes = correlativoMax.split('-');
        if (partes.length === 4) {
          const num = parseInt(partes[3], 10);
          if (!isNaN(num)) max = num;
        }
      }
      setPreviewCorrelativo(`RR-${sigla}-${aa}-${String(max + 1).padStart(4, '0')}`);
    };
    actualizarPreview();
  }, [departamento, showModal, editandoId]);

  // --- MANEJADORES DE ACCIÓN ---
  const actualizarFila = (id, campo, valor) => {
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
        await enviarNotificacion(reqAnulada.user_id, `Tu Requisición ${reqAnulada.correlativo} ha sido ANULADA.`, 'Anulación');
      }

      setHistorial(prev => prev.map(req => req.id === id ? { ...req, estado_aprobacion: 'ANULADA' } : req));
      toast.success('Requisición ANULADA correctamente.');
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  const manejarEliminar = async (id) => {
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
    setLoading(true);
    try {
      await liberarPartidasFondos(id);
      const { error } = await supabase.from('requisiciones').delete().eq('id', id);
      if (error) throw error;
      toast.success("Eliminada correctamente.");
      await cargarHistorialDesdeBD();
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  const resetearFormulario = () => {
    if (currentUser) {
      setSolicitante(`${currentUser.nombre} ${currentUser.apellido}`);
      setDepartamento(currentUser.departamento);
    }
    setJustificacion('');
    setObservaciones('');
    setFacturasUrls([]);
    setIdReferenciaProyecto('');
    setEditandoId(null);
    setFechaRequerida(new Date().toISOString().split('T')[0]);
    setRenglones([{ id: Date.now(), clasificacion: '', categoria: '', cant: 1, uni: 'UNID', descripcion: '', beneficiario: '', pu: 0, total: 0, status: 'En Espera' }]);
  };

  const verRequisicion = (req) => {
    setEditandoId(req.id);
    setPrioridad(req.prioridad);
    setJustificacion(req.justificacion);
    setObservaciones(req.observaciones);
    setIdReferenciaProyecto(req.id_referencia_proyecto || '');
    setFacturasUrls(req.facturas_url || []);
    setFechaRequerida(req.fecha_requerida || req.fecha);
    setDepartamento(req.gerencia || 'Operaciones');
    setRenglones(req.detalles || []);
    setCentroCosto(req.centroCosto);
    setSolicitante(req.solicitante || `${req.solicitante_nombre || ''} ${req.solicitante_apellido || ''}`);
    setShowModal(true);
  };

  const manejarRechazarGerenteProyecto = () => {
    if (!editandoId || !currentUser?.rol?.toLowerCase()?.includes('proyecto')) return;
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

      toast.success('Requisición rechazada.');

      // NOTIFICAR AL SOLICITANTE
      const reqRechazada = historial.find(h => h.id === editandoId);
      if (reqRechazada) {
        await enviarNotificacion(reqRechazada.user_id, `Tu Requisición ${reqRechazada.correlativo} ha sido RECHAZADA. Motivo: ${motivoRechazo}`, 'Rechazo');
      }

      await cargarHistorialDesdeBD();
      setShowRechazoModal(false);
      setShowModal(false);
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
          await enviarNotificacion(u.id, `Nueva observación en REQ ${previewCorrelativo || 'Pendiente'} de ${currentUser.nombre}`, 'Observación');
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

  const subirFactura = async (event) => {
    if (!editandoId) return toast.error("Guarde la requisición primero para poder adjuntar documentos.");
    try {
      setUploading(true);
      const files = Array.from(event.target.files);
      if (!files || files.length === 0) return;

      const uploadPromises = files.map(async (file, index) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `factura_${editandoId}_${Date.now()}_${index}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage.from('facturas').upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('facturas').getPublicUrl(filePath);
        return publicUrl;
      });

      const nuevasDescargas = await Promise.all(uploadPromises);
      const { data: currentReq } = await supabase.from('requisiciones').select('facturas_url').eq('id', editandoId).single();
      const urlsActuales = currentReq?.facturas_url || [];
      const nuevasUrls = [...urlsActuales, ...nuevasDescargas.map(url => ({ url, etiqueta: 'Archivo sin etiqueta' }))];

      setFacturasUrls(nuevasUrls);
      const { error: updateError } = await supabase.from('requisiciones').update({ facturas_url: nuevasUrls }).eq('id', editandoId);
      if (updateError) throw updateError;

      toast.success("Documentos adjuntados correctamente.");
      event.target.value = '';
      cargarHistorialDesdeBD();
    } catch (error) {
      toast.error("Error al subir: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const eliminarSoporteDefinitivo = async (index) => {
    if (!editandoId) return;

    const confirmacion = window.confirm("¿Está seguro de que desea eliminar este documento permanentemente?");
    if (!confirmacion) return;

    try {
      const nuevasUrls = [...facturasUrls];
      nuevasUrls.splice(index, 1);

      setFacturasUrls(nuevasUrls);

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
    if (!editandoId || !currentUser?.rol?.toLowerCase()?.includes('proyecto')) {
      toast.error('Solo el Gerente de Proyecto puede realizar esta aprobación.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('requisiciones').update({
        aprobado_gerente_proyecto: true,
        firma_gerente_proyecto: currentUser.firma_url || null,
        estado_aprobacion: 'pendiente_area',
        aprobacion_nombre: 'Aprobado por Proyecto'
      }).eq('id', editandoId);
      if (error) throw error;
      toast.success('Aprobada por Gerente de Proyecto. Enviada al Gerente de Área.');
      await cargarHistorialDesdeBD();
      setShowModal(false);
      resetearFormulario();
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  const manejarAprobarGerenteArea = async () => {
    if (!editandoId || !currentUser?.rol?.toLowerCase()?.includes('gerente')) {
      toast.error('Solo el Gerente de Área puede realizar esta aprobación.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('requisiciones').update({
        aprobado_gerente_area: true,
        firma_gerente: currentUser.firma_url || null, // Firma Nivel 1 guardada en firma_gerente
        estado_aprobacion: 'enviada_general',
        aprobacion_nombre: 'Aprobado por Área'
      }).eq('id', editandoId);
      if (error) throw error;
      toast.success('Aprobada por Gerente de Área. Enviada al Gerente General.');
      await cargarHistorialDesdeBD();
      setShowModal(false);
      resetearFormulario();
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  const manejarAprobarGeneral = async () => {
    const rolUpper = (currentUser?.rol || '').toUpperCase();
    const emailLower = (currentUser?.correo || '').toLowerCase();

    const esAdminPermitido = currentUser?.esAdminReal ||
      rolUpper.includes('GERENTE') ||
      rolUpper.includes('ADMIN') ||
      emailLower.includes('cvega');

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
        status_compra: 'En espera'
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

      toast.success("¡APROBACIÓN COMPLETADA CON ÉXITO!");
      await cargarHistorialDesdeBD();
      setShowModal(false);
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
    setLoading(true);
    try {
      const { error } = await supabase.from('requisiciones').update({
        estado_aprobacion: 'pendiente_area',
        motivo_rechazo: null,
        aprobacion_nombre: 'Re-enviada (Pendiente Área)',
        // Limpiar firmas y aprobaciones anteriores
        firma_gerente: null,
        firma_gerente_general: null,
        aprobado_gerente_area: false,
        aprobado_gerente_general: false,
        // Se preservan los datos editados en los inputs
        items: renglones,
        justificacion,
        observaciones,
        id_referencia_proyecto: idReferenciaProyecto,
        centro_costo: centroCosto,
        prioridad,
        fecha_requerida: fechaRequerida,
        solicitante: solicitante,
        gerencia: departamento
      }).eq('id', editandoId);
      if (error) throw error;
      toast.success("Requisición re-enviada correctamente.");
      await cargarHistorialDesdeBD();
      setShowModal(false);
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
      const clases = [...new Set(renglones.map(r => r.clasificacion).filter(c => c))];
      if (clases.length > 1) {
        toast.error("Error: Todos los renglones deben tener la misma Clasificación.");
        setLoading(false);
        return;
      }
      // Si está en modo edición (ej. re-enviando o corrigiendo)
      try {
        const { error } = await supabase.from('requisiciones').update({
          fecha_requerida: fechaRequerida,
          centro_costo: centroCosto,
          prioridad,
          items: renglones,
          justificacion,
          observaciones,
          id_referencia_proyecto: idReferenciaProyecto,
          total_bs: Number(totalEstimado) || 0,
          facturas_url: facturasUrls
        }).eq('id', editandoId);
        if (error) throw error;

        // ALERTA DE CATEGORÍAS DIFERENTES
        const catsUnicas = [...new Set(renglones.map(r => r.categoria).filter(c => c))];
        if (catsUnicas.length > 1) {
          toast((t) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '500' }}>Se han detectado diferentes categorías en los renglones. ¿Está seguro de que desea guardar la requisición así?</p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { toast.dismiss(t.id); ejecutarGuardarUpdate(editandoId); }}
                  style={{ padding: '4px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                >
                  SÍ, GUARDAR
                </button>
                <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>CANCELAR</button>
              </div>
            </div>
          ), { duration: 6000, position: 'top-center' });
          setLoading(false);
          return;
        }

        await ejecutarGuardarUpdate(editandoId);
      } catch (err) { toast.error(err.message); } finally { setLoading(false); }
      return;
    }

    const ejecutarGuardarUpdate = async (id) => {
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
          facturas_url: facturasUrls
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
            // Buscamos si existe una fila en solicitudes_fondos vinculada a esta requisición y este item_idx
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
        setShowModal(false);
        resetearFormulario();
      } catch (err) { toast.error(err.message); } finally { setLoading(false); }
    };

    if (!justificacion?.trim()) {
      toast.error("La justificación es obligatoria.");
      setLoading(false);
      return;
    }

    const siglaGerencia = mappingSiglasGerencia[departamento] || 'GER';
    const aa = new Date().getFullYear().toString().slice(-2);

    // --- LÓGICA DE CORRELATIVO INDEPENDIENTE CON RESETEO ANUAL ---
    const { data: registrosMismaSigla } = await supabase
      .from('requisiciones')
      .select('correlativo_req')
      .like('correlativo_req', `RR-${siglaGerencia}-${aa}-%`)
      .order('correlativo_req', { ascending: false })
      .limit(1);

    let maxNumero = 0;
    if (registrosMismaSigla && registrosMismaSigla.length > 0) {
      const correlativoMax = registrosMismaSigla[0].correlativo_req;
      const partes = correlativoMax.split('-');
      if (partes.length === 4) {
        const num = parseInt(partes[3], 10);
        if (!isNaN(num)) maxNumero = num;
      }
    }
    const nuevoCorrelativo = `RR-${siglaGerencia}-${aa}-${String(maxNumero + 1).padStart(4, '0')}`;

    const nuevaReqBD = {
      correlativo_req: nuevoCorrelativo,
      fecha_emision: new Date().toISOString(),
      fecha_requerida: fechaRequerida,
      solicitante,
      gerencia: departamento,
      centro_costo: centroCosto,
      prioridad,
      status_compra: 'En espera',
      aprobacion: false,
      aprobacion_nombre: 'Pendiente',
      estado_aprobacion: 'pendiente_area', // Por defecto
      total_bs: Number(totalEstimado) || 0,
      items: renglones,
      justificacion,
      observaciones,
      id_referencia_proyecto: idReferenciaProyecto,
      origen: datosPredefinidos ? `REF: ${datosPredefinidos.id_control}` : 'Manual',
      user_id: currentUser.id,
      facturas_url: facturasUrls
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
    const clases = [...new Set(renglones.map(r => r.clasificacion).filter(c => c))];
    if (clases.length > 1) {
      toast.error("Error: Todos los renglones deben tener la misma Clasificación.");
      setLoading(false);
      return;
    }

    // ALERTA DE CATEGORÍAS DIFERENTES ANTES DE GUARDAR NUEVA
    const catsUnicas = [...new Set(renglones.map(r => r.categoria).filter(c => c))];
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
    try {
      const { data: gProyectos } = await supabase
        .from('perfiles')
        .select('id')
        .contains('obras_asignadas', [centroCosto])
        .ilike('rol', '%proyecto%');

      if (gProyectos && gProyectos.length > 0) {
        nuevaReqBD.estado_aprobacion = 'pendiente_proyecto';
        nuevaReqBD.aprobacion_nombre = 'Pendiente por Proyecto';
      }
    } catch (err) {
      console.error("Error verificando gerente de proyecto:", err);
    }

    await ejecutarGuardarNueva(nuevaReqBD);
  };

  const intentarCerrarModal = () => {
    const hayContenido = justificacion?.trim() || renglones.some(r => r.descripcion?.trim() || r.categoria);
    if (hayContenido && !editandoId) {
      toast((t) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b' }}>⚠️ Tienes datos sin guardar</p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>¿Estás seguro de que deseas cerrar? Se perderá la información de la nueva requisición.</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '5px' }}>
            <button
              onClick={() => { toast.dismiss(t.id); setShowModal(false); resetearFormulario(); }}
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
      resetearFormulario();
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

      // SI VIENE DE SOLICITUD DE FONDOS, VINCULAR LAS PARTIDAS USADAS
      let idsPartidas = [];
      if (datosPredefinidos?.partidasSeleccionadas && nuevaReq) {
        idsPartidas = datosPredefinidos.partidasSeleccionadas.map(p => p.id);
        console.log("Vinculando partidas a la REQ:", nuevaReq.correlativo_req);
        await supabase
          .from('partidas_fondos')
          .update({
            requisicion_id: nuevaReq.id,
            codigo_req: nuevaReq.correlativo_req, // GUARDAR EL CORRELATIVO PARA TRAZABILIDAD
            status: 'Bloqueado'
          })
          .in('id', idsPartidas);
      }

      toast.success("Generada y guardada.");

      // --- LÓGICA DE NOTIFICACIONES PARA NUEVA REQ ---
      const miRango = getRank(currentUser.rol);

      // 1. Notificar Superiores Directos (Misma gerencia si existe, mismo depto, rango mayor)
      let querySuperiores = supabase
        .from('perfiles')
        .select('id, rol, nombre')
        .eq('departamento', currentUser.departamento);

      if (currentUser.gerencia_id) {
        querySuperiores = querySuperiores.eq('gerencia_id', currentUser.gerencia_id);
      }

      const { data: superiores } = await querySuperiores;

      console.log("Buscando superiores para:", currentUser.nombre, "en", currentUser.departamento);
      if (superiores) {
        const superioresFiltrados = superiores.filter(s => getRank(s.rol) > miRango);
        console.log("Superiores encontrados:", superioresFiltrados.map(s => s.nombre));

        for (const s of superioresFiltrados) {
          await enviarNotificacion(s.id, `Nueva Requisición ${nuevaReq.correlativo_req} de ${currentUser.nombre} pendiente de su aprobación.`, 'Nueva Requisición');
        }
      }

      // 2. Notificar a Carlos Vega (Gerente General)
      const { data: carlos } = await supabase
        .from('perfiles')
        .select('id, nombre')
        .ilike('rol', 'Gerente General')
        .limit(1)
        .single();

      if (carlos) {
        console.log("Notificando a Carlos Vega...");
        await enviarNotificacion(carlos.id, `Nueva Requisición ${nuevaReq.correlativo_req} creada por ${currentUser.nombre}.`, 'Nueva Requisición');
      }

      await cargarHistorialDesdeBD();
      onSuccess?.(nuevaReq.id, idsPartidas);
      setShowModal(false);
      onClose?.();
      resetearFormulario();
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  const exportarPDF = async () => {
    const input = document.getElementById('area-pdf');
    const canvas = await html2canvas(input, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.addImage(imgData, 'PNG', 0, 0, 210, (canvas.height * 210) / canvas.width);
    pdf.save(`REQ_${editandoId || 'NUEVA'}.pdf`);
  };

  return (
    <motion.div
      className="animate-main"
      style={{ padding: '25px', backgroundColor: '#f1f5f9', minHeight: '100vh' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >

      {/* --- DASHBOARD SUPERIOR (STATS CARDS INTERACTIVAS) --- */}
      <div className="dashboard-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '25px' }}>
        {[
          { label: 'TOTAL REQUISICIONES', val: historial.length, col: '#030712', filter: 'Todos' },
          { label: 'GERENTE PROYECTO', val: historial.filter(r => r.estado_aprobacion === 'pendiente_proyecto').length, col: '#030712', filter: 'pendiente_proyecto' },
          { label: 'GERENTE ÁREA', val: historial.filter(r => r.estado_aprobacion === 'pendiente_area').length, col: '#030712', filter: 'pendiente_area' },
          { label: 'POR APROBAR', val: historial.filter(r => r.estado_aprobacion === 'enviada_general').length, col: '#030712', filter: 'enviada_general' },
          { label: 'APROBADA GLOBAL', val: historial.filter(r => r.estado_aprobacion === 'aprobado_final').length, col: '#030712', filter: 'aprobado_final' },
          { label: 'RECHAZADA', val: historial.filter(r => r.estado_aprobacion === 'rechazada').length, col: '#030712', filter: 'rechazada' },
          { label: 'ANULADA', val: historial.filter(r => r.estado_aprobacion === 'ANULADA').length, col: '#030712', filter: 'ANULADA' }
        ].filter(x => !(currentUser?.rol === 'Gerente General' && (x.filter === 'pendiente_area' || x.filter === 'pendiente_proyecto'))).map((x, i) => {
          const colorBorde = x.col; // El color del estatus solo para el borde
          const colorTexto = '#1e293b'; // Azul oscuro/Gris carbón profesional para todo el texto
          return (
            <div
              key={i}
              className="stat-card"
              onClick={() => setFiltroAprobacion(x.filter)}
              style={{
                borderLeft: `6px solid ${colorBorde}`,
                cursor: 'pointer',
                backgroundColor: filtroAprobacion === x.filter ? '#f8fafc' : 'white',
                transform: filtroAprobacion === x.filter ? 'scale(1.02)' : 'scale(1)',
                transition: 'all 0.2s ease',
                boxShadow: filtroAprobacion === x.filter ? '0 4px 12px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.05)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {filtroAprobacion === x.filter && (
                <div style={{ position: 'absolute', top: 0, right: 0, width: '4px', height: '100%', backgroundColor: colorBorde }}></div>
              )}
              <div className="stat-label" style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b' }}>{x.label}</div>
              <div className="stat-value" style={{ fontSize: '1.5rem', fontWeight: '900', color: colorTexto }}>{loading ? '...' : x.val}</div>
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
      <div className="table-container">
        <table className="tc-table">
          <thead>
            <tr>
              <th style={{ width: '150px' }}>ID</th>
              <th style={{ textAlign: 'center', width: '160px' }}>ESTATUS DE APROBACIÓN</th>
              <th>FECHA</th>
              <th>SOLICITANTE / GERENCIA</th>
              <th>CATEGORÍA</th>
              <th>CENTRO DE COSTO</th>
              <th>TOTAL (C/IVA)</th>
              <th style={{ textAlign: 'center', width: '140px' }}>ESTATUS DE COMPRA</th>
              <th style={{ textAlign: 'center' }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {historialFiltrado.map(req => (
              <tr key={req.id}>
                <td data-label="CORRELATIVO"
                  style={{ fontWeight: 'bold', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => verRequisicion(req)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Punto de color para prioridad */}
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: req.prioridad === 'Alta' ? '#ef4444' : '#0ea5e9',
                        flexShrink: 0
                      }}
                      title={`Prioridad: ${req.prioridad}`}
                    ></div>

                    {req.correlativo}
                    {req.observaciones && (
                      <MessageSquare
                        size={14}
                        style={{
                          color: req.leido_compras_at === null ? '#f59e0b' : '#16a34a',
                          fill: req.leido_compras_at === null ? '#fef3c7' : '#dcfce7'
                        }}
                        title={`Observaciones: ${req.observaciones} \nStatus: ${req.leido_compras_at === null ? 'Pendiente por Compras' : 'Leído por Compras'}`}
                      />
                    )}
                    {req.facturas_url?.length > 0 && (
                      <Paperclip size={14} style={{ color: '#0ea5e9' }} title="Tiene adjuntos" />
                    )}
                  </div>
                </td>

                <td data-label="ESTADO" style={{ textAlign: 'center' }}>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    color: req.estado_aprobacion === 'aprobado_final' ? '#16a34a' :
                      req.estado_aprobacion === 'rechazada' ? '#ef4444' :
                        req.estado_aprobacion === 'ANULADA' ? '#64748b' : '#0ea5e9',
                    display: 'inline-block',
                    width: '100%'
                  }}>
                    {req.estado_aprobacion === 'aprobado_final' ? 'APROBADA' :
                      req.estado_aprobacion === 'pendiente_proyecto' ? 'GERENTE DE PROYECTO' :
                        req.estado_aprobacion === 'pendiente_area' || req.estado_aprobacion === 'enviada_area' ? 'GERENTE DE ÁREA' :
                          req.estado_aprobacion === 'enviada_general' ? 'GERENTE GENERAL' :
                            req.estado_aprobacion?.replace('_', ' ') || 'PENDIENTE'}
                  </span>
                </td>

                <td data-label="FECHA" style={{ color: 'var(--slate-400)' }}>{req.fecha ? format(new Date(req.fecha + 'T12:00:00'), 'dd/MM/yyyy') : 'N/A'}</td>

                <td data-label="SOLICITANTE">
                  <div style={{ fontWeight: '500' }}>{req.solicitante}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{req.gerencia}</div>
                </td>

                <td data-label="CATEGORÍA" style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b' }}>
                  {req.estado_aprobacion === 'ANULADA' ? '-' : (req.detalles?.[0]?.categoria || 'N/A')}
                </td>

                <td data-label="CENTRO COSTO">{req.centroCosto}</td>

                <td data-label="TOTAL" style={{ fontWeight: 'bold' }}>
                  {req.estado_aprobacion === 'ANULADA' ? '-' : `$ ${req.total?.toLocaleString('de-DE')}`}
                </td>

                <td data-label="STATUS COMPRA" style={{ textAlign: 'center' }}>
                  {req.estado_aprobacion === 'ANULADA' ? '-' : (
                    <span style={{
                      color:
                        req.status?.toUpperCase() === 'COMPLETADO' ? '#16a34a' :
                          req.status?.toUpperCase() === 'PARCIAL' ? '#f59e0b' : '#ca8a04',
                      fontSize: '0.7rem',
                      fontWeight: '900',
                      textTransform: 'uppercase'
                    }}>
                      {req.status}
                    </span>
                  )}
                </td>

                <td data-label="ACCIONES" style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
                    <button onClick={(e) => { e.stopPropagation(); verRequisicion(req); }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }} title="Ver Detalles">👁️</button>

                    {/* Solo José y Analistas pueden Anular */}
                    {req.estado_aprobacion !== 'ANULADA' && (currentUser?.correo?.toLowerCase() === 'jcontreras.totalclean@gmail.com' || (currentUser?.rol || '').toLowerCase().includes('analista')) && (
                      <button onClick={(e) => { e.stopPropagation(); anularRequisicion(req.id); }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }} title="Anular Requisición">🚫</button>
                    )}

                    {/* Solo José puede Borrar */}
                    {currentUser?.correo?.toLowerCase() === 'jcontreras.totalclean@gmail.com' && (
                      <button onClick={(e) => { e.stopPropagation(); manejarEliminar(req.id); }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }} title="Borrar Registro">🗑️</button>
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
      {(isOpen || showModal) && (
        <div className="modal-overlay">
          <div className="modal-card animate-modal" style={{ maxWidth: '95%', width: '1300px' }}>
            <div id="area-pdf">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, color: 'var(--slate-900)' }}>Requisición de Recursos</h2>

                  {/* DIAGNÓSTICO PARA GERENCIA */}
                  {(currentUser?.esAdminReal || (currentUser?.rol || '').toUpperCase().includes('GERENTE')) && (
                    <div style={{
                      backgroundColor: '#fffbeb',
                      border: '1px solid #fde68a',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      color: '#92400e',
                      marginTop: '5px'
                    }}>
                      <b>SISTEMA DETECTA:</b> {currentUser?.correo} | <b>ROL:</b> {(currentUser?.rol || 'N/D').toUpperCase()}
                    </div>
                  )}

                  {(datosPredefinidos?.id_control || (editandoId && historial.find(h => h.id === editandoId)?.origen?.startsWith('REF:'))) && (
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', marginTop: '4px' }}>
                      {datosPredefinidos?.id_control ? `REF: ${datosPredefinidos.id_control}` : historial.find(h => h.id === editandoId)?.origen}
                    </div>
                  )}
                  <div className="status-purchase-badge" style={{ marginTop: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '9px' }}>ESTATUS DE COMPRA:</span>
                    <span style={{ fontSize: '10px', color: estadoGlobal.color, fontWeight: '900' }}>{estadoGlobal.texto}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--slate-600)', textTransform: 'uppercase' }}>Nivel de prioridad:</span>
                  <button
                    className={`btn-tc ${prioridad === 'Normal' ? 'btn-tc-primary' : 'btn-tc-secondary'}`}
                    onClick={() => setPrioridad('Normal')}
                    disabled={!!editandoId}
                  >
                    NORMAL
                  </button>
                  <button
                    className={`btn-tc ${prioridad === 'Alta' ? 'btn-tc-danger' : 'btn-tc-secondary'}`}
                    onClick={() => setPrioridad('Alta')}
                    disabled={!!editandoId}
                  >
                    ALTA
                  </button>
                  <div style={{ backgroundColor: '#fef08a', padding: '10px 15px', borderRadius: '8px', fontWeight: '900' }}>
                    {editandoId ? (historial.find(h => h.id === editandoId)?.correlativo) : previewCorrelativo}
                  </div>
                </div>
              </div>

              <div className="req-header-line"></div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px', marginBottom: '25px' }}>
                <div>
                  <label className="stat-label">FECHA REQUERIDA</label>
                  <input className="input-tc" type="date" value={fechaRequerida} onChange={(e) => setFechaRequerida(e.target.value)} disabled={!!editandoId} />
                </div>
                <div>
                  <label className="stat-label">SOLICITANTE</label>
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
                  <label className="stat-label">CENTRO DE COSTOS</label>
                  <select
                    className="input-tc"
                    value={centroCosto}
                    disabled={!!editandoId}
                    onChange={(e) => {
                      setCentroCosto(e.target.value);
                      // Resetear clasificaciones y categorías de todos los renglones al cambiar CC
                      setRenglones(prev => prev.map(r => ({ ...r, clasificacion: '', categoria: '' })));
                    }}
                  >
                    <option value="">Seleccione Centro de Costo...</option>
                    {centrosCosto.map(cc => <option key={cc.id} value={cc.nombre}>{cc.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="stat-label">GERENCIA</label>
                  <select className="input-tc" value={departamento} onChange={(e) => setDepartamento(e.target.value)} disabled={!!editandoId}>
                    {listaGerencias.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                    <label className="stat-label" style={{ marginBottom: 0 }}>ID REF. PROYECTO / CONTRATO</label>
                    {editandoId && !editandoObs && (
                      <button
                        onClick={() => {
                          setObsTemporal(observaciones);
                          setEditandoObs(true);
                        }}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
                        title="Editar Metadata"
                      >
                        ✏️
                      </button>
                    )}
                  </div>
                  <input
                    className="input-tc"
                    list="ids-proyecto-previos"
                    value={idReferenciaProyecto}
                    onChange={manejarCambioIdProyecto}
                    placeholder="XXX-0000-0000"
                    disabled={editandoId && !editandoObs}
                  />
                  <datalist id="ids-proyecto-previos">
                    {idsReferenciaPrevios.map(id => <option key={id} value={id} />)}
                  </datalist>
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label className="stat-label">JUSTIFICACIÓN DE LA SOLICITUD <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  className="input-tc"
                  type="text"
                  value={justificacion}
                  onChange={(e) => setJustificacion(e.target.value)}
                  placeholder="Explique el motivo de la requisición (Obligatorio)"
                  required
                  disabled={!!editandoId}
                />
              </div>

              {/* CAMPO DE OBSERVACIONES */}
              <div style={{ marginBottom: '25px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                  <label className="stat-label" style={{ marginBottom: 0 }}>OBSERVACIONES</label>
                  {editandoId && !editandoObs && (
                    <button
                      onClick={() => {
                        setObsTemporal(observaciones);
                        setEditandoObs(true);
                      }}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
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
                      style={{ minHeight: '80px', paddingTop: '10px' }}
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
                    style={{ minHeight: '60px', paddingTop: '10px' }}
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Notas adicionales sobre la entrega, especificaciones técnicas, etc."
                    disabled={editandoId && !editandoObs}
                  />
                )}
              </div>

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
                    <th style={{ width: '10px' }}>RENGLÓN</th>
                    <th style={{ width: '200px' }}>CLASIFICACIÓN</th>
                    <th style={{ width: '200px' }}>CATEGORÍA</th>
                    <th style={{ width: '70px' }}>CANT.</th>
                    <th style={{ width: '110px' }}>UNI.</th>
                    <th style={{ width: '500px' }}>DESCRIPCIÓN</th>
                    <th style={{ width: '300px' }}>BENEFICIARIO</th>
                    <th style={{ width: '60px', textAlign: 'right' }}>P.U.</th>
                    <th style={{ width: '60px', textAlign: 'right' }}>TOTAL</th>
                    <th style={{ width: '10px', textAlign: 'center' }}>TRAZAB.</th>
                    <th style={{ width: '5px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {renglones.map((f, index) => (
                      <React.Fragment key={f.id}>
                        <motion.tr
                          className="renglon-row"
                          initial={{ opacity: 0, height: 0, scaleY: 0.8 }}
                          animate={{ opacity: 1, height: 'auto', scaleY: 1 }}
                          exit={{ opacity: 0, height: 0, scaleY: 0.8, overflow: 'hidden' }}
                          transition={{ duration: 0.3 }}
                        >
                          <td style={{ textAlign: 'center' }}>{index + 1}</td>
                          <td><input className="input-tc" value={f.clasificacion} onChange={(e) => actualizarFila(f.id, 'clasificacion', e.target.value)} /></td>
                          <td><input className="input-tc" value={f.categoria} onChange={(e) => actualizarFila(f.id, 'categoria', e.target.value)} /></td>
                          <td><input className="input-tc" type="number" value={f.cant === '' ? '' : Number(f.cant)} onChange={(e) => actualizarFila(f.id, 'cant', e.target.value)} /></td>
                          <td>
                            <select className="input-tc" value={f.uni} onChange={(e) => actualizarFila(f.id, 'uni', e.target.value)}>
                              {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </td>
                          <td><textarea className="input-tc" value={f.descripcion} onChange={(e) => actualizarFila(f.id, 'descripcion', e.target.value)} style={{ resize: 'vertical', minHeight: '38px', paddingTop: '8px', width: '100%', boxSizing: 'border-box' }} rows="1" /></td>
                          <td><input className="input-tc" value={f.beneficiario} onChange={(e) => actualizarFila(f.id, 'beneficiario', e.target.value)} placeholder="Beneficiario" /></td>
                          <td><input className="input-tc" type="number" value={f.pu === '' ? '' : Number(f.pu)} style={{ textAlign: 'right' }} onChange={(e) => actualizarFila(f.id, 'pu', e.target.value)} /></td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{f.total.toLocaleString('de-DE')}</td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                              <button
                                onClick={() => setExpandirHistorial(prev => ({ ...prev, [f.id]: !prev[f.id] }))}
                                style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: (f.historial_compras?.length > 0) ? 1 : 0.3 }}
                                title="Ver Trazabilidad"
                                disabled={!f.historial_compras?.length}
                              >
                                {expandirHistorial[f.id] ? '🔼' : '🕒'}
                              </button>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => duplicarRenglon(f.id)}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem' }}
                              title="Duplicar Renglón"
                            >
                              👯
                            </button>
                          </td>
                        </motion.tr>
                        {expandirHistorial[f.id] && f.historial_compras?.length > 0 && (
                          <tr>
                            <td colSpan="11" style={{ padding: '0 0 15px 40px' }}>
                              <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                <div style={{ padding: '8px 12px', backgroundColor: '#f8fafc', fontSize: '0.7rem', fontWeight: '900', color: '#475569', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0' }}>
                                  <span>TRAZABILIDAD Y JUSTIFICACIONES DEL ÍTEM</span>
                                  <span style={{ color: 'var(--primary)' }}>{f.historial_compras.length} EVENTOS</span>
                                </div>
                                <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '0.65rem' }}>
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
                                    {f.historial_compras.map((h, idx) => (
                                      <tr key={idx} style={{
                                        borderBottom: idx < f.historial_compras.length - 1 ? '1px solid #f1f5f9' : 'none',
                                        backgroundColor: h.tipo === 'JUSTIFICACION' ? '#fffbeb' : 'transparent'
                                      }}>
                                        <td style={{ padding: '8px', color: '#64748b' }}>{new Date(h.fecha).toLocaleDateString()}</td>
                                        <td style={{ padding: '8px', fontWeight: 'bold', color: h.tipo === 'JUSTIFICACION' ? '#d97706' : '#16a34a' }}>
                                          {h.tipo === 'JUSTIFICACION' ? '⚠️ JUSTIFICACIÓN' : '✅ COMPRA'}
                                        </td>
                                        <td style={{ padding: '8px', fontSize: '0.65rem', fontWeight: 'bold', color: '#64748b' }}>
                                          {h.tipo !== 'JUSTIFICACION' ? (h.proveedor_nombre || 'No asignado') : '-'}
                                        </td>
                                        <td style={{ padding: '8px' }}>
                                          {h.tipo === 'JUSTIFICACION' ? (
                                            <span style={{ fontStyle: 'italic', color: '#92400e', fontWeight: '600' }}>{h.motivo}</span>
                                          ) : 'Procesamiento de compra'}
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700' }}>{h.cant || '-'}</td>
                                        <td style={{ padding: '8px', textAlign: 'right' }}>{h.pu ? `$ ${h.pu.toLocaleString('de-DE')}` : '-'}</td>
                                        <td style={{ padding: '8px', textAlign: 'right' }}>
                                          {h.tipo === 'JUSTIFICACION' ? (
                                            <div style={{ fontSize: '0.7rem', color: '#475569', whiteSpace: 'pre-wrap', textAlign: 'left', backgroundColor: '#fef3c7', padding: '6px', borderRadius: '4px' }}>
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

              <div style={{ display: 'flex', gap: '30px', marginTop: '30px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  {/* SECCIÓN DE DOCUMENTOS DE SOPORTE (IMÁGENES DE COMPRA) */}
                  {editandoId && (
                    <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileText size={18} /> DOCUMENTOS Y SOPORTES
                        </h4>

                        {/* Restricción de Adjuntos: Solo creación, aprobada/finalizada o modo compras. No en aprobación. */}
                        {(() => {
                          const reqActual = historial.find(h => String(h.id) === String(editandoId));
                          const estado = reqActual?.estado_aprobacion;
                          const esProcesoAprobacion = estado === 'pendiente_area' || estado === 'enviada_general';
                          const esFinalizada = estado === 'aprobada' || estado === 'completado' || reqActual?.status_compra === 'Completado';

                          // Solo permitir si: No se está editando (Creación), o está finalizada, o NO está en proceso de aprobación
                          if (!editandoId || (!esProcesoAprobacion || esFinalizada)) {
                            return (
                              <label className="btn-tc btn-tc-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
                                {uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                                {uploading ? 'SUBIENDO...' : 'ADJUNTAR SOPORTE'}
                                <input
                                  type="file"
                                  multiple
                                  style={{ display: 'none' }}
                                  onChange={subirFactura}
                                  disabled={uploading}
                                  accept="image/*,application/pdf"
                                  capture="environment"
                                />
                              </label>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                        {(facturasUrls || []).map((item, idx) => {
                          const url = typeof item === 'string' ? item : item?.url;
                          const etiqueta = typeof item === 'string' ? 'Archivo' : (item?.etiqueta || 'Sin etiqueta');
                          if (!url || url.length < 5) return null;

                          const isImg = /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(url.split('?')[0]);
                          return (
                            <div key={idx} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '5px', width: '90px' }}>
                              <a href={url} target="_blank" rel="noreferrer" style={{
                                display: 'block',
                                width: '90px', height: '90px',
                                borderRadius: '16px',
                                overflow: 'hidden',
                                border: '2px solid #e2e8f0',
                                backgroundColor: 'white',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                transition: 'transform 0.2s'
                              }} onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                                {isImg ? (
                                  <img src={url} alt={`Soporte ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fef2f2', color: '#ef4444' }}>
                                    <FileText size={28} />
                                    <span style={{ fontSize: '0.6rem', fontWeight: '900', marginTop: '4px' }}>PDF</span>
                                  </div>
                                )}
                              </a>
                              <div style={{ fontSize: '0.65rem', fontWeight: '700', textAlign: 'center', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {etiqueta}
                              </div>
                              <button
                                onClick={() => eliminarSoporteDefinitivo(idx)}
                                style={{ position: 'absolute', top: '-8px', right: '-8px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '22px', height: '22px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', fontWeight: 'bold', zIndex: 10 }}
                                title="Eliminar Soporte"
                              >
                                X
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
                    <span style={{ fontWeight: '900', fontSize: '1rem' }}>TOTAL ESTIMADO (C/IVA):</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: '900' }}>$ {totalEstimado.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                  </div>

                  {subTotalEjecutado > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', color: '#16a34a' }}>
                      <span style={{ fontWeight: '900', fontSize: '1rem' }}>TOTAL EJECUTADO (C/IVA):</span>
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

              <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <button className="btn-tc btn-tc-secondary" onClick={() => { setShowModal(false); onClose?.(); resetearFormulario(); }}>Cerrar</button>
                  <button className="btn-tc btn-tc-dark" onClick={exportarPDF}>📥 PDF</button>

                  {editandoId ? (
                    <>
                      {/* ACCIONES PARA ANALISTA / COORDINADOR (Re-enviar si está rechazada) */}
                      {(currentUser?.rol === 'Analista' || currentUser?.rol === 'Coordinador') &&
                        historial.find(h => h.id === editandoId)?.estado_aprobacion === 'rechazada' && (
                          <button className="btn-tc btn-tc-primary" onClick={manejarReenviar} disabled={loading}>
                            {loading ? <Loader2 className="animate-spin" size={16} /> : 'MODIFICAR Y RE-ENVIAR'}
                          </button>
                        )}

                      {/* BOTONES PARA GERENTE DE PROYECTO */}
                      {currentUser?.rol?.toLowerCase()?.includes('proyecto') &&
                        historial.find(h => String(h.id) === String(editandoId))?.estado_aprobacion === 'pendiente_proyecto' && (
                          <>
                            <button className="btn-tc btn-tc-danger" onClick={manejarRechazarGerenteProyecto} disabled={loading}>
                              {loading ? <Loader2 className="animate-spin" size={16} /> : 'RECHAZAR'}
                            </button>
                            <button className="btn-tc btn-tc-success" onClick={manejarAprobarGerenteProyecto} disabled={loading}>
                              {loading ? <Loader2 className="animate-spin" size={16} /> : '✓ APROBAR PROYECTO'}
                            </button>
                          </>
                        )}

                      {/* BOTONES PARA GERENTE DE ÁREA (Nivel 1) */}
                      {currentUser?.rol?.toLowerCase()?.includes('gerente') && !currentUser?.rol?.toLowerCase()?.includes('general') &&
                        historial.find(h => String(h.id) === String(editandoId))?.estado_aprobacion === 'pendiente_area' && (
                          <>
                            <button className="btn-tc btn-tc-danger" onClick={manejarRechazarGerenteArea} disabled={loading}>
                              {loading ? <Loader2 className="animate-spin" size={16} /> : 'RECHAZAR'}
                            </button>
                            <button className="btn-tc btn-tc-success" onClick={manejarAprobarGerenteArea} disabled={loading}>
                              {loading ? <Loader2 className="animate-spin" size={16} /> : '✓ APROBAR ÁREA'}
                            </button>
                          </>
                        )}

                      {(() => {
                        const rolUpper = (currentUser?.rol || '').toUpperCase();
                        const emailLower = (currentUser?.correo || '').toLowerCase();

                        const esGG = currentUser?.esAdminReal ||
                          rolUpper.includes('GERENTE') ||
                          rolUpper.includes('ADMIN') ||
                          emailLower.includes('cvega');

                        const reqActual = historial.find(h => String(h.id) === String(editandoId));

                        if (esGG && reqActual?.estado_aprobacion === 'enviada_general') {
                          return (
                            <>
                              <button className="btn-tc btn-tc-danger" onClick={manejarRechazarGeneral} disabled={loading}>
                                {loading ? <Loader2 className="animate-spin" size={16} /> : 'RECHAZAR'}
                              </button>
                              <button
                                className="btn-tc btn-tc-success"
                                onClick={(e) => {
                                  e.preventDefault();
                                  manejarAprobarGeneral();
                                }}
                                disabled={loading}
                              >
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
                      {loading ? <Loader2 className="animate-spin" size={16} /> : 'GENERAR REQUISICIÓN'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
