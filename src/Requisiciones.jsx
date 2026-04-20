import React, { useState, useEffect, useCallback, useMemo } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from './supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Loader2, MessageSquare, FileText, Upload, Paperclip } from 'lucide-react';
import './Requisiciones.css';

const Requisiciones = ({ isOpen, onClose, datosPredefinidos, onSuccess }) => {
  // --- ESTADOS DEL SISTEMA ---
  const [showModal, setShowModal] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // --- NUEVOS ESTADOS PARA FILTROS ---
  const [busqueda, setBusqueda] = useState('');
  const [filtroDepto, setFiltroDepto] = useState('Todos');
  const [filtroAprobacion, setFiltroAprobacion] = useState('Todos');
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  const [filtroCC, setFiltroCC] = useState('Todos');
  const [filtroStatusCompra, setFiltroStatusCompra] = useState('Todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [showRechazoModal, setShowRechazoModal] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [rechazoAction, setRechazoAction] = useState(null); // 'area' o 'general'
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

      const email = session.user.email.toLowerCase();
      
      // FORZAR lectura de perfil fresco (Sin caché)
      const { data: perfil, error: pError } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (pError) {
        console.error("[VISIBILIDAD] Error leyendo perfil:", pError.message);
        return;
      }

      if (perfil) {
        const esAdminReal = email === 'jcontreras.totalclean@gmail.com' || email === 'cvega.totalclean@gmail.com';
        const userData = {
          ...perfil,
          esAdminReal,
          departamento: (perfil.departamento || '').trim(),
          rol: (perfil.rol || '').trim(),
          firma_url: perfil.url_firma_digital
        };
        setCurrentUser(userData);
        console.log("[VISIBILIDAD] Sesión sincronizada para:", email);
      }
    } catch (err) {
      console.error("[VISIBILIDAD] Error fatal obteniendo sesión:", err.message);
    }
  }, []);

  // --- LÓGICA DE CARGA DESDE SUPABASE CON FILTROS JERÁRQUICOS POR FASE ---
  const cargarHistorialDesdeBD = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      let query = supabase.from('requisiciones').select('*');

      const rolUpper = (currentUser.rol || '').toUpperCase();
      const deptoUpper = (currentUser.departamento || '').toUpperCase();
      const tienePermisoDepto = currentUser.capacidades?.ver_departamento === true;

      console.log(`[VISIBILIDAD REQUISICIONES] Usuario: ${currentUser.correo} | Depto: ${currentUser.departamento} | Rol: ${rolUpper} | Permiso Especial: ${tienePermisoDepto}`);

      // FLUJO JERÁRQUICO DE VISIBILIDAD POR FASE (ESTADO_APROBACION)
      if (!currentUser.esAdminReal && rolUpper !== 'GERENTE GENERAL' && rolUpper !== 'ADMIN') {
        const puedeVerDepto = tienePermisoDepto || ['GERENTE', 'COORDINADOR', 'ANALISTA', 'COMPRAS'].includes(rolUpper) || deptoUpper.includes('COMPRAS');

        if (puedeVerDepto) {
          // Ven todo lo de su departamento/gerencia (Fuzzy Match + Case-insensitive)
          const filtroDepto = (currentUser.departamento || '').trim();
          
          // Lógica de SINÓNIMOS para Seguridad
          if (filtroDepto.toUpperCase() === 'SEGURIDAD' || filtroDepto.toUpperCase() === 'SIAHO') {
            query = query.or(`gerencia.ilike.%Seguridad%,gerencia.ilike.%SIAHO%,gerencia.ilike.%SHA%`);
            console.log(`[VISIBILIDAD REQUISICIONES] Aplicando filtro de búsqueda múltiple (SIAHO/SHA/Seguridad)`);
          } else {
            query = query.ilike('gerencia', `%${filtroDepto}%`);
            console.log(`[VISIBILIDAD REQUISICIONES] Aplicando filtro de departamento: %${filtroDepto}%`);
          }
        } else {
          // Otros roles sin permiso explícito: solo lo propio
          query = query.eq('solicitante', `${currentUser.nombre} ${currentUser.apellido}`);
          console.log(`[VISIBILIDAD REQUISICIONES] Aplicando filtro restrictivo personal: ${currentUser.nombre}`);
        }
      }

      const { data, error } = await query.order('fecha_emision', { ascending: false });

      if (error) throw error;
      if (data) {
        const historialMapeado = data.map(db => ({
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
          estado_aprobacion: db.estado_aprobacion || 'pendiente_area',
          motivo_rechazo: db.motivo_rechazo || '',
          firma_gerente_general: db.firma_gerente_general,
          observaciones: db.observaciones || '',
          facturas_url: db.facturas_url || [],
          id_referencia_proyecto: db.id_referencia_proyecto || ''
        }));
        setHistorial(historialMapeado);

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

      let matchFecha = true;
      if (fechaDesde && req.fecha < fechaDesde) matchFecha = false;
      if (fechaHasta && req.fecha > fechaHasta) matchFecha = false;

      return matchTexto && matchDepto && matchStatus && matchCategoria && matchCC && matchStatusCompra && matchFecha;
    }).sort((a, b) => {
      // Prioridad Alta primero
      if (a.prioridad === 'Alta' && b.prioridad !== 'Alta') return -1;
      if (a.prioridad !== 'Alta' && b.prioridad === 'Alta') return 1;
      // Luego por fecha desc (ya viene ordenado de BD, pero por si acaso)
      return new Date(b.fecha) - new Date(a.fecha);
    });
  }, [historial, busqueda, filtroDepto, filtroAprobacion, filtroCategoria, filtroCC, filtroStatusCompra, fechaDesde, fechaHasta]);

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

  const listaGerencias = [
    "Administración Maracaibo", "Administración El Tigre", "Operaciones", "Mantenimiento",
    "Seguridad", "Recursos Humanos", "Estimación", "Almacén", "Gerencia General",
    "Servicios Generales", "Contabilidad"
  ];

  const unidades = ["UNID", "KG", "LTS", "ML", "M2", "M3", "SERV", "SG", "BOLSAS", "VIAJES"];

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

  const getInitials = (nombre, apellido) => {
    return `${nombre?.charAt(0) || ''}${apellido?.charAt(0) || ''}`.toUpperCase();
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
        if (campo === 'cant' || campo === 'pu') v = Math.max(0, Number(valor) || 0);
        const act = { ...f, [campo]: v };
        if (campo === 'clasificacion') act.categoria = ''; // Reset hijo
        if (campo === 'pu') act.pu_estimado = v;
        act.total = act.cant * act.pu;
        return act;
      }
      return f;
    }));
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
    if (!window.confirm('¿Estás seguro de ANULAR esta requisición? Los renglones asociados en Fondos quedarán disponibles nuevamente.')) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('requisiciones')
        .update({ estado_aprobacion: 'ANULADA', aprobacion_nombre: 'REQ. ANULADA' })
        .eq('id', id);
      if (error) throw error;

      await liberarPartidasFondos(id);

      setHistorial(prev => prev.map(req => req.id === id ? { ...req, estado_aprobacion: 'ANULADA' } : req));
      alert('Requisición ANULADA correctamente.');
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const manejarEliminar = async (id) => {
    if (!window.confirm("¿Eliminar esta requisición de forma permanente? Esta acción liberará los renglones en Fondos.")) return;
    setLoading(true);
    try {
      await liberarPartidasFondos(id);
      const { error } = await supabase.from('requisiciones').delete().eq('id', id);
      if (error) throw error;
      alert("Eliminada correctamente.");
      await cargarHistorialDesdeBD();
    } catch (err) { alert(err.message); } finally { setLoading(false); }
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
    setShowModal(true);
  };

  const manejarRechazarGerenteArea = () => {
    if (!editandoId || currentUser?.rol !== 'Gerente') return;
    setMotivoRechazo('');
    setRechazoAction('area');
    setShowRechazoModal(true);
  };

  const manejarRechazarGeneral = () => {
    const rolUpper = (currentUser?.rol || '').toUpperCase();
    if (!editandoId || (!currentUser?.esAdminReal && rolUpper !== 'GERENTE GENERAL' && rolUpper !== 'ADMIN')) return;
    setMotivoRechazo('');
    setRechazoAction('general');
    setShowRechazoModal(true);
  };

  const confirmRechazo = async () => {
    if (!motivoRechazo.trim()) return alert('El motivo de rechazo es obligatorio.');

    setLoading(true);
    try {
      let updatePayload = {
        estado_aprobacion: 'rechazada',
        motivo_rechazo: motivoRechazo,
      };

      if (rechazoAction === 'area') {
        updatePayload.aprobacion_nombre = 'Rechazado por Área';
        updatePayload.aprobado_gerente_area = false;
      } else {
        updatePayload.aprobacion_nombre = 'Rechazado por General';
        updatePayload.aprobado_gerente_general = false;
      }

      const { error } = await supabase.from('requisiciones').update(updatePayload).eq('id', editandoId);
      if (error) throw error;

      alert('Requisición rechazada.');
      await cargarHistorialDesdeBD();
      setShowRechazoModal(false);
      setShowModal(false);
      resetearFormulario();
    } catch (err) { alert(err.message); } finally { setLoading(false); }
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

      setObservaciones(obsTemporal);
      setHistorial(prev => prev.map(req => req.id === editandoId ? { ...req, observaciones: obsTemporal } : req));
      setEditandoObs(false);
      alert('Observaciones actualizadas correctamente.');
    } catch (err) {
      alert("Error al actualizar observaciones: " + err.message);
    } finally {
      setLoading(true); // Se mantiene cargando un momento para refresco visual
      await cargarHistorialDesdeBD();
      setLoading(false);
    }
  };

  const subirFactura = async (event) => {
    if (!editandoId) return alert("Guarde la requisición primero para poder adjuntar documentos.");
    try {
      setUploading(true);
      const files = Array.from(event.target.files);
      if (!files || files.length === 0) return;

      const uploadPromises = files.map(async (file, index) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `factura_${editandoId}_${Date.now()}_${index}.${fileExt}`;
        const filePath = `${fileName}`; // Subir a la raíz para evitar bloqueos por carpetas public/private

        const { error: uploadError } = await supabase.storage
          .from('facturas')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // OBTENER LA URL PÚBLICA CORRECTAMENTE
        const { data: { publicUrl } } = supabase.storage.from('facturas').getPublicUrl(filePath);
        return publicUrl;
      });

      const nuevasDescargas = await Promise.all(uploadPromises);

      // RECARGAR DATA ACTUAL PARA EVITAR SOBREESCRIBIR SI OTRO MODIFICÓ
      const { data: currentReq } = await supabase.from('requisiciones').select('facturas_url').eq('id', editandoId).single();
      const urlsActuales = currentReq?.facturas_url || [];
      const nuevasUrls = [...urlsActuales, ...nuevasDescargas];

      setFacturasUrls(nuevasUrls);

      const { error: updateError } = await supabase
        .from('requisiciones')
        .update({ facturas_url: nuevasUrls })
        .eq('id', editandoId);

      if (updateError) throw updateError;

      alert("Documentos adjuntados y guardados correctamente.");
      event.target.value = ''; // Limpiar el input
      cargarHistorialDesdeBD();
    } catch (error) {
      alert("Error al subir archivo: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const manejarAprobarGerenteArea = async () => {
    if (!editandoId || currentUser?.rol !== 'Gerente') {
      alert('Solo el Gerente de Área puede realizar esta aprobación.');
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
      alert('Aprobada por Gerente de Área. Enviada al Gerente General.');
      await cargarHistorialDesdeBD();
      setShowModal(false);
      resetearFormulario();
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const manejarAprobarGeneral = async () => {
    const rolUpper = (currentUser?.rol || '').toUpperCase();
    if (!editandoId || (!currentUser?.esAdminReal && rolUpper !== 'GERENTE GENERAL' && rolUpper !== 'ADMIN')) {
      alert('Solo el Gerente General tiene permisos para la aprobación final.');
      return;
    }
    setLoading(true);
    try {
      const updates = {
        aprobado_gerente_general: true,
        firma_gerente_general: currentUser.firma_url || null,
        estado_aprobacion: 'aprobado_final',
        aprobacion_nombre: 'Aprobación Final',
        status_compra: 'En espera'
      };

      // Si no tiene fecha_aprobacion previa, la grabamos ahora (Inmutabilidad)
      const currentReq = historial.find(h => h.id === editandoId);
      if (!currentReq?.fecha_aprobacion) {
        updates.fecha_aprobacion = new Date().toISOString();
        updates.gerente_aprobador = `${currentUser.nombre} ${currentUser.apellido}`;
      }

      const { error } = await supabase.from('requisiciones').update(updates).eq('id', editandoId);
      if (error) throw error;
      alert("Aprobación final exitosa.");
      await cargarHistorialDesdeBD();
      setShowModal(false);
      resetearFormulario();
    } catch (err) { alert(err.message); } finally { setLoading(false); }
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
      alert("Requisición re-enviada correctamente.");
      await cargarHistorialDesdeBD();
      setShowModal(false);
      resetearFormulario();
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const manejarGenerarOActualizar = async () => {
    setLoading(true);
    if (editandoId) {
      if (!justificacion?.trim()) {
        alert("La justificación es obligatoria.");
        setLoading(false);
        return;
      }

      // VALIDACIÓN ESTRICTA DE CLASIFICACIÓN
      if (!centroCosto) {
        alert("⚠️ El Centro de Costo es obligatorio.");
        setLoading(false);
        return;
      }

      for (let i = 0; i < renglones.length; i++) {
        const r = renglones[i];
        if (!r.clasificacion) {
          alert(`⚠️ Renglón ${i + 1}: La Clasificación es obligatoria.`);
          setLoading(false);
          return;
        }
        if (!r.categoria) {
          alert(`⚠️ Renglón ${i + 1}: La Categoría es obligatoria.`);
          setLoading(false);
          return;
        }
      }

      // VALIDACIÓN PASIVA PERO ESTRICTA EN EJECUCIÓN (Clasificación única)
      const clases = [...new Set(renglones.map(r => r.clasificacion).filter(c => c))];
      if (clases.length > 1) {
        alert("⚠️ Error: Todos los renglones deben tener la misma Clasificación.");
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
          total_bs: Number(totalEstimado) || 0
        }).eq('id', editandoId);
        if (error) throw error;

        // ALERTA DE CATEGORÍAS DIFERENTES
        const catsUnicas = [...new Set(renglones.map(r => r.categoria).filter(c => c))];
        if (catsUnicas.length > 1) {
          if (!window.confirm("Se han detectado diferentes categorías en los renglones. ¿Está seguro de que desea guardar la requisición así?")) {
            setLoading(false);
            return;
          }
        }

        alert("Cambios guardados.");
        await cargarHistorialDesdeBD();
        setShowModal(false);
        resetearFormulario();
      } catch (err) { alert(err.message); } finally { setLoading(false); }
      return;
    }

    if (!justificacion?.trim()) {
      alert("La justificación es obligatoria.");
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
      estado_aprobacion: 'pendiente_area',
      total_bs: Number(totalEstimado) || 0,
      items: renglones,
      justificacion,
      observaciones,
      id_referencia_proyecto: idReferenciaProyecto,
      origen: datosPredefinidos ? `REF: ${datosPredefinidos.id_control}` : 'Manual'
    };

    // VALIDACIÓN ESTRICTA DE CLASIFICACIÓN PARA NUEVA REQ
    if (!centroCosto) {
      alert("⚠️ El Centro de Costo es obligatorio.");
      setLoading(false);
      return;
    }

    for (let i = 0; i < renglones.length; i++) {
      const r = renglones[i];
      if (!r.clasificacion) {
        alert(`⚠️ Renglón ${i + 1}: La Clasificación es obligatoria.`);
        setLoading(false);
        return;
      }
      if (!r.categoria) {
        alert(`⚠️ Renglón ${i + 1}: La Categoría es obligatoria.`);
        setLoading(false);
        return;
      }
    }

    // VALIDACIÓN PASIVA PERO ESTRICTA EN EJECUCIÓN (Clasificación única)
    const clases = [...new Set(renglones.map(r => r.clasificacion).filter(c => c))];
    if (clases.length > 1) {
      alert("⚠️ Error: Todos los renglones deben tener la misma Clasificación.");
      setLoading(false);
      return;
    }

    // ALERTA DE CATEGORÍAS DIFERENTES ANTES DE GUARDAR NUEVA
    const catsUnicas = [...new Set(renglones.map(r => r.categoria).filter(c => c))];
    if (catsUnicas.length > 1) {
      if (!window.confirm("Se han detectado diferentes categorías en los renglones. ¿Está seguro de que desea guardar la requisición así?")) {
        setLoading(false);
        return;
      }
    }

    try {
      const { data: nuevaReq, error } = await supabase.from('requisiciones').insert([nuevaReqBD]).select().single();
      if (error) throw error;

      // SI VIENE DE SOLICITUD DE FONDOS, VINCULAR LAS PARTIDAS USADAS
      let idsPartidas = [];
      if (datosPredefinidos?.partidasSeleccionadas && nuevaReq) {
        idsPartidas = datosPredefinidos.partidasSeleccionadas.map(p => p.id);
        await supabase
          .from('partidas_fondos')
          .update({ requisicion_id: nuevaReq.id, status: 'Bloqueado' })
          .in('id', idsPartidas);
      }

      alert("Generada y guardada.");
      await cargarHistorialDesdeBD();
      onSuccess?.(nuevaReq.id, idsPartidas);
      setShowModal(false);
      onClose?.();
      resetearFormulario();
    } catch (err) { alert(err.message); } finally { setLoading(false); }
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
          { label: 'TOTAL REQUISICIONES', val: historial.length, col: '#64748b', filter: 'Todos' },
          { label: 'GERENTE ÁREA', val: historial.filter(r => r.estado_aprobacion === 'pendiente_area').length, col: '#ef4444', filter: 'pendiente_area' },
          { label: 'POR APROBAR', val: historial.filter(r => r.estado_aprobacion === 'enviada_general').length, col: '#facc15', filter: 'enviada_general' },
          { label: 'APROBADA GLOBAL', val: historial.filter(r => r.estado_aprobacion === 'aprobado_final').length, col: '#22c55e', filter: 'aprobado_final' },
          { label: 'RECHAZADA', val: historial.filter(r => r.estado_aprobacion === 'rechazada').length, col: '#ef4444', filter: 'rechazada' },
          { label: 'ANULADA', val: historial.filter(r => r.estado_aprobacion === 'ANULADA').length, col: '#94a3b8', filter: 'ANULADA' }
        ].filter(x => !(currentUser?.rol === 'Gerente General' && x.filter === 'pendiente_area')).map((x, i) => {
          const colorUsar = currentUser?.rol === 'Gerente General' ? '#64748b' : x.col;
          return (
            <div
              key={i}
              className="stat-card"
              onClick={() => setFiltroAprobacion(x.filter)}
              style={{
                borderLeft: `6px solid ${colorUsar}`,
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
                <div style={{ position: 'absolute', top: 0, right: 0, width: '4px', height: '100%', backgroundColor: colorUsar }}></div>
              )}
              <div className="stat-label" style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b' }}>{x.label}</div>
              <div className="stat-value" style={{ fontSize: '1.5rem', fontWeight: '900', color: colorUsar }}>{loading ? '...' : x.val}</div>
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
            {listaGerencias.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

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
              {currentUser?.rol !== 'Gerente General' && <th style={{ textAlign: 'center' }}>ACCIONES</th>}
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

                {currentUser?.rol !== 'Gerente General' && (
                  <td data-label="ACCIONES" style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
                      <button onClick={() => verRequisicion(req)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }} title="Ver Detalles">👁️</button>
                      {req.estado_aprobacion !== 'ANULADA' && currentUser?.rol !== 'Gerente General' && (
                        <button onClick={() => anularRequisicion(req.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }} title="Anular Requisición">🚫</button>
                      )}
                      {(currentUser?.esAdminReal || currentUser?.rol === 'Gerente' || currentUser?.rol === 'Admin' || currentUser?.rol === 'Gerente General') && (
                        <button onClick={() => manejarEliminar(req.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }} title="Borrar Registro">🗑️</button>
                      )}
                    </div>
                  </td>
                )}
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
                  <button className={`btn-tc ${prioridad === 'Normal' ? 'btn-tc-primary' : 'btn-tc-secondary'}`} onClick={() => setPrioridad('Normal')}>NORMAL</button>
                  <button className={`btn-tc ${prioridad === 'Alta' ? 'btn-tc-danger' : 'btn-tc-secondary'}`} onClick={() => setPrioridad('Alta')}>ALTA</button>
                  <div style={{ backgroundColor: '#fef08a', padding: '10px 15px', borderRadius: '8px', fontWeight: '900' }}>
                    {editandoId ? (historial.find(h => h.id === editandoId)?.correlativo) : previewCorrelativo}
                  </div>
                </div>
              </div>

              <div className="req-header-line"></div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px', marginBottom: '25px' }}>
                <div>
                  <label className="stat-label">FECHA REQUERIDA</label>
                  <input className="input-tc" type="date" value={fechaRequerida} onChange={(e) => setFechaRequerida(e.target.value)} />
                </div>
                <div>
                  <label className="stat-label">SOLICITANTE</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      backgroundColor: 'var(--primary)', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 'bold'
                    }}>
                      {getInitials(currentUser?.nombre, currentUser?.apellido)}
                    </div>
                    <span style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--slate-800)' }}>
                      {solicitante}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="stat-label">CENTRO DE COSTOS</label>
                  <select
                    className="input-tc"
                    value={centroCosto}
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
                  <select className="input-tc" value={departamento} onChange={(e) => setDepartamento(e.target.value)}>
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
                          <td><input className="input-tc" type="number" value={f.cant} onChange={(e) => actualizarFila(f.id, 'cant', e.target.value)} /></td>
                          <td>
                            <select className="input-tc" value={f.uni} onChange={(e) => actualizarFila(f.id, 'uni', e.target.value)}>
                              {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </td>
                          <td><textarea className="input-tc" value={f.descripcion} onChange={(e) => actualizarFila(f.id, 'descripcion', e.target.value)} style={{ resize: 'vertical', minHeight: '38px', paddingTop: '8px', width: '100%', boxSizing: 'border-box' }} rows="1" /></td>
                          <td><input className="input-tc" value={f.beneficiario} onChange={(e) => actualizarFila(f.id, 'beneficiario', e.target.value)} placeholder="Beneficiario" /></td>
                          <td><input className="input-tc" type="number" value={f.pu} style={{ textAlign: 'right' }} onChange={(e) => actualizarFila(f.id, 'pu', e.target.value)} /></td>
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

              {/* SECCIÓN DE DOCUMENTOS DE SOPORTE (IMÁGENES DE COMPRA) */}
              {editandoId && (
                <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={18} /> DOCUMENTOS Y SOPORTES
                    </h4>

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
                  </div>

                  <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                    {(historial.find(h => h.id === editandoId)?.facturas_url || []).map((url, idx) => {
                      const isImg = /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(url.split('?')[0]);
                      return (
                        <div key={idx} style={{ position: 'relative' }}>
                          <a href={url} target="_blank" rel="noreferrer" style={{
                            display: 'block',
                            width: '100px', height: '100px',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            border: '2px solid #e2e8f0',
                            backgroundColor: 'white',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                          }}>
                            {isImg ? (
                              <img src={url} alt={`Soporte ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', color: '#ef4444' }}>
                                <FileText size={32} />
                                <span style={{ fontSize: '0.6rem', fontWeight: 'bold', marginTop: '4px', color: '#64748b' }}>VER PDF</span>
                              </div>
                            )}
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}


              <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
                <div className="totals-container" style={{ minWidth: '350px' }}>
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

                      {/* BOTONES PARA GERENTE DE ÁREA (Nivel 1) */}
                      {currentUser?.rol === 'Gerente' &&
                        historial.find(h => h.id === editandoId)?.estado_aprobacion === 'pendiente_area' && (
                          <>
                            <button className="btn-tc btn-tc-danger" onClick={manejarRechazarGerenteArea} disabled={loading}>
                              {loading ? <Loader2 className="animate-spin" size={16} /> : 'RECHAZAR'}
                            </button>
                            <button className="btn-tc btn-tc-success" onClick={manejarAprobarGerenteArea} disabled={loading}>
                              {loading ? <Loader2 className="animate-spin" size={16} /> : '✓ APROBAR ÁREA'}
                            </button>
                          </>
                        )}

                      {/* BOTONES PARA GERENTE GENERAL (Nivel 2) */}
                      {(currentUser?.rol === 'Gerente General' || currentUser?.rol === 'Admin' || currentUser?.esAdminReal) &&
                        historial.find(h => h.id === editandoId)?.estado_aprobacion === 'enviada_general' && (
                          <>
                            <button className="btn-tc btn-tc-danger" onClick={manejarRechazarGeneral} disabled={loading}>
                              {loading ? <Loader2 className="animate-spin" size={16} /> : 'RECHAZAR'}
                            </button>
                            <button className="btn-tc btn-tc-success" onClick={manejarAprobarGeneral} disabled={loading}>
                              {loading ? <Loader2 className="animate-spin" size={16} /> : '✓ APROBACIÓN FINAL'}
                            </button>
                          </>
                        )}
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
