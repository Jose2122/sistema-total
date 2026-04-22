import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';
import Requisiciones from './Requisiciones';
import TicketExpress from './TicketExpress';
import { format, getWeek } from 'date-fns';
import toast from 'react-hot-toast';
import { Loader2, Upload, FileText, Printer, FileSpreadsheet, BarChart3, Clock, Activity, CheckCircle2, DollarSign } from 'lucide-react';
import './SolicitudFondos.css';

const StockSmartTotalClean = ({ currentUserProp }) => {
  const [showModal, setShowModal] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [isEditing, setIsEditing] = useState(false);

  // --- ESTADOS PARA CONTROLAR EL MODAL DE REQUISICIONES ---
  const [abrirReq, setAbrirReq] = useState(false);
  const [dataParaReq, setDataParaReq] = useState(null);

  // --- ESTADOS PARA CONTROLAR EL MODAL DE TICKETS ---
  const [abrirTicketModal, setAbrirTicketModal] = useState(false);
  const [dataParaTicket, setDataParaTicket] = useState(null);

  // --- ESTADO PARA GASTOS IMPREVISTOS ---
  const [mostrarImprevistos, setMostrarImprevistos] = useState(false);
  const [currentUser, setCurrentUser] = useState(currentUserProp || null);
  const [loading, setLoading] = useState(false);

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
    if (currentUserProp) setCurrentUser(currentUserProp);
  }, [currentUserProp]);

  // --- ESTADOS DE DATA MAESTRA ---
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [todasClasificaciones, setTodasClasificaciones] = useState([]);
  const [todasCategorias, setTodasCategorias] = useState([]);
  const [gerentesDisponibles, setGerentesDisponibles] = useState([]);

  // --- DATOS MAESTROS ESTÁTICOS ---
  const gerenciasData = {
    "Operaciones": ["Hilda Colina"],
    "Mantenimiento": ["José Cohén"],
    "Seguridad": ["Xiomara Acevedo"],
    "Recursos Humanos": ["Ider Marín"],
    "Estimación": ["Karin Machado"],
    "Almacén": ["Diana García"],
    "Servicios Generales": ["Luis Fallica"],
    "Administración Maracaibo": ["Perla Delgado"],
    "Administración El Tigre": ["Zuleika Lara"],
    "Gerencia General": ["Carlos Vega"],
    "Contabilidad": ["Jorge Urdaneta"]
  };

  const unidades = ["UNID", "KG", "LTS", "ML", "M2", "M3", "SERV", "SG", "VIAJES"];

  // --- LÓGICA DE SIGLAS GERENCIA ---
  const obtenerSiglas = (nombreGerencia) => {
    if (!nombreGerencia) return '---';
    const mappingGerencias = {
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
    return mappingGerencias[nombreGerencia] || "---";
  };

  // --- ESTADO INICIAL DEL FORMULARIO ---
  const [form, setForm] = useState({
    id: '',
    fecha: new Date().toISOString().split('T')[0],
    sede: 'MARACAIBO',
    gerencia: '',
    responsable: '',
    partidas: [{ id: Date.now(), selected: false, cc: '', clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', puBs: '', puUsd: '', pago_realizado: false }],
    imprevistos: [{ id: Date.now() + 1, selected: false, cc: '', clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', puBs: '', puUsd: '', pago_realizado: false }]
  });


  // --- ESTADO PARA FILTROS ---
  const [busqueda, setBusqueda] = useState("");
  const [filtroGerencia, setFiltroGerencia] = useState("Todos");
  const [filtroSemana, setFiltroSemana] = useState("");

  // --- FUNCIÓN PARA ELIMINAR ---
  const eliminarSolicitud = (id_db) => {
    if (currentUser?.correo?.toLowerCase() !== 'jcontreras.totalclean@gmail.com') {
      toast.error("Solo el SuperAdministrador (José) tiene permisos para eliminar solicitudes.");
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

  const intentarCerrarModal = () => {
    const hayContenido = form.partidas.some(p => p.desc?.trim() || p.cc);
    if (hayContenido && !isEditing) {
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
    "ADM-TGR": "Administración El Tigre",
    "OPE": "Operaciones",
    "MTT": "Mantenimiento",
    "SHA": "Seguridad",
    "RRH": "Recursos Humanos",
    "EST": "Estimación",
    "ALM": "Almacén",
    "GG": "Gerencia General",
    "SVG": "Servicios Generales",
    "CNT": "Contabilidad",
    "CMP": "Compras"
  };

  const historialFiltrado = historial.filter(h => {
    const matchTexto =
      h.id.toLowerCase().includes(busqueda.toLowerCase()) ||
      h.responsable.toLowerCase().includes(busqueda.toLowerCase());

    const matchGerencia = filtroGerencia === "Todos" || h.id.startsWith(filtroGerencia);

    // Filtro por semana (usar el número de semana calculado de la fecha o del ID)
    const matchSemana = !filtroSemana ||
      h.id.includes(`SEM ${filtroSemana}`) ||
      h.id.includes(`SEMANA ${filtroSemana}`) ||
      getWeek(new Date(h.fecha_operativa + 'T12:00:00'), { weekStartsOn: 1 }) === parseInt(filtroSemana);

    return matchTexto && matchGerencia && matchSemana;
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
        
        const userData = {
          ...perfil,
          esSuperAdmin,
          esAdminReal,
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
          
          userContext = { 
            ...perfil, 
            esSuperAdmin,
            esAdminReal,
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

    let query = supabase.from('solicitudes_fondos').select('*');

    const rolUpper = (userContext.rol || '').toUpperCase();
    const deptoUpper = (userContext.departamento || '').toUpperCase();
    const tienePermisoDepto = userContext.capacidades?.ver_departamento === true;

    console.log(`[VISIBILIDAD FONDOS] Usuario: ${userContext.correo} | Depto: ${userContext.departamento} | Rol: ${rolUpper} | Permiso Especial: ${tienePermisoDepto}`);

    // REGLAS DE JERARQUÍA
    if (!userContext.esAdminReal && rolUpper !== 'GERENTE GENERAL' && rolUpper !== 'ADMIN') {
      const puedeVerDepto = tienePermisoDepto || ['GERENTE', 'COORDINADOR', 'ANALISTA', 'COMPRAS'].includes(rolUpper) || deptoUpper.includes('COMPRAS');

      if (puedeVerDepto) {
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
      setHistorial(dataHist.map(h => ({
        ...h,
        id_db: h.id,
        id: h.codigo_control,
        total: parseFloat(h.total_usd || 0) + parseFloat(h.total_bs || 0),
        responsable: h.responsable_nombre,
        gerencia: h.gerencia_nombre
      })));
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
    setLoading(false);
  }, [currentUser]);

  // --- EFECTO DE CARGA INICIAL ---
  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  useEffect(() => {
    if (showModal && !isEditing && currentUser) {
      const depto = currentUser.departamento || '';
      const gerentesDept = gerenciasData[depto];
      const gerenteNombre = (gerentesDept && gerentesDept.length > 0) ? gerentesDept[0] : '';

      setForm(prev => ({
        ...prev,
        responsable: (['Gerente', 'Coordinador', 'Analista', 'Admin'].includes(currentUser.rol) || currentUser.esAdminReal)
          ? (gerenteNombre || `${currentUser.nombre} ${currentUser.apellido}`)
          : prev.responsable,
        gerencia: (['Gerente', 'Coordinador', 'Analista', 'Admin'].includes(currentUser.rol) || currentUser.esAdminReal)
          ? currentUser.departamento
          : prev.gerencia
      }));
    }
  }, [showModal, isEditing, currentUser]);

  // --- FUNCIONES DE LÓGICA ---
  const cargarDetallesYEditar = async (solicitud) => {
    try {
      const targetId = solicitud.id_db || solicitud.id;
      
      // 1. Obtener Partidas
      const { data: partidasRaw } = await supabase
        .from('partidas_fondos')
        .select('*, requisiciones(id, correlativo_req, items)')
        .eq('solicitud_id', targetId);

      // 2. Mapear Partidas con Lógica de Ejecución (P.U. REAL)
      const procesarEjecucion = (p) => {
        let montoReal = 0;
        let montoPendiente = (p.pu_bs || p.pu_usd || 0) * (p.cantidad || 1); // Por defecto todo es pendiente

        if (p.requisiciones && p.requisiciones.items) {
          // Intentar hacer match del item de la requisición con esta partida
          // Usamos descripción y cantidad como match primario para solicitudes de fondos
          const itemReq = p.requisiciones.items.find(item => 
            item.descripcion === p.descripcion && 
            (item.cantidad_pedida === p.cantidad || item.cant === p.cantidad)
          );

          if (itemReq) {
            // Calcular Ejecutado (Historial de Compras)
            montoReal = (itemReq.historial_compras || []).reduce((sum, h) => {
              if (h.tipo === 'JUSTIFICACION') return sum;
              return sum + ((parseFloat(h.cant) || 0) * (parseFloat(h.pu) || 0));
            }, 0);

            // Calcular Pendiente (Cant Pendiente * PU Estimado)
            const cantPendiente = parseFloat(itemReq.cantidad_pendiente ?? itemReq.cant) || 0;
            const puEst = parseFloat(itemReq.pu_estimado ?? itemReq.pu) || 0;
            montoPendiente = cantPendiente * puEst;
          }
        }

        return { montoReal, montoPendiente };
      };

      setForm({
        ...solicitud,
        id: solicitud.codigo_control || solicitud.id,
        id_db: solicitud.id_db,
        fecha: solicitud.fecha_operativa,
        gerencia: solicitud.gerencia,
        responsable: solicitud.responsable,
        partidas: partidasRaw.filter(p => !p.clasificacion.includes('[*]') && p.clasificacion !== 'Gastos Imprevistos' && p.clasificacion !== 'Ticket de Pago' && p.clasificacion !== 'Solicitud de ticket').map(p => {
          const { montoReal, montoPendiente } = procesarEjecucion(p);
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
            requisicion_id: p.requisicion_id || null,
            codigo_req: p.requisiciones?.correlativo_req || null,
            ticket_id: p.ticket_id || null,
            codigo_ticket: p.codigo_ticket || null,
            status: p.status || 'Disponible',
            selected: false,
            montoReal,
            montoPendiente
          };
        }),
        imprevistos: partidasRaw.filter(p => p.clasificacion.includes('[*]') || p.clasificacion === 'Gastos Imprevistos' || p.clasificacion === 'Ticket de Pago' || p.clasificacion === 'Solicitud de ticket').length > 0
          ? partidasRaw.filter(p => p.clasificacion.includes('[*]') || p.clasificacion === 'Gastos Imprevistos' || p.clasificacion === 'Ticket de Pago' || p.clasificacion === 'Solicitud de ticket').map(p => {
            const { montoReal, montoPendiente } = procesarEjecucion(p);
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
              requisicion_id: p.requisicion_id || null,
              codigo_req: p.requisiciones?.correlativo_req || null,
              ticket_id: p.ticket_id || null,
              codigo_ticket: p.codigo_ticket || null,
              status: p.status || 'Disponible',
              selected: false,
              montoReal,
              montoPendiente
            };
          })
          : [{ id: Date.now() + 1, selected: false, cc: '', clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', puBs: '', puUsd: '', pago_realizado: false, montoReal: 0, montoPendiente: 0 }]
      });
      if (partidasRaw.some(p => p.clasificacion === 'Gastos Imprevistos' || p.clasificacion === 'Ticket de Pago')) {
        setMostrarImprevistos(true);
      } else {
        setMostrarImprevistos(false);
      }
      setIsEditing(true);
      setShowModal(true);
    } catch (err) { toast.error("Error cargando detalles."); }
  };

  const manejarCambioPartida = (index, campo, valor) => {
    const nuevas = [...form.partidas];
    let valorFinal = valor;

    // BLOQUEO DE NEGATIVOS
    if (['cant', 'puBs', 'puUsd'].includes(campo)) {
      valorFinal = Math.max(0, parseFloat(valor) || 0);
    }

    nuevas[index][campo] = valorFinal;
    if (campo === 'cc') { nuevas[index].clasif = ''; nuevas[index].cat = ''; }
    if (campo === 'clasif') { nuevas[index].cat = ''; }
    if (campo === 'puBs' && valorFinal > 0) nuevas[index].puUsd = '';
    if (campo === 'puUsd' && valorFinal > 0) nuevas[index].puBs = '';
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
    // BLOQUEO DE NEGATIVOS
    if (['cant', 'puBs', 'puUsd'].includes(campo)) {
      valorFinal = Math.max(0, parseFloat(valor) || 0);
    }

    nuevos[index][campo] = valorFinal;
    if (campo === 'cc') { nuevos[index].clasif = ''; nuevos[index].cat = ''; }
    if (campo === 'clasif') { nuevos[index].cat = ''; }
    if (campo === 'puBs' && valorFinal > 0) nuevos[index].puUsd = '';
    if (campo === 'puUsd' && valorFinal > 0) nuevos[index].puBs = '';
    setForm({ ...form, imprevistos: nuevos });
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
  
  // Complementamos el identificador con el Centro de Costo (Primeras 4 letras o similar)
  const idDinamico = isEditing ? form.id : `${siglasGerencia}-SEM ${numSemana}-${aa}`;
  const periodoSemana = getWeekRange(numSemana, new Date(form.fecha).getFullYear());

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
  const isExpired = !isEditing && new Date() > deadlineDate;

  const verificarDisponibilidad = async () => {
    if (!fechaPreVal) return setErrorCheck("Por favor, seleccione una fecha operativa.");
    
    // --- EXCEPCIÓN DE ADMINISTRADOR / GERENTE GENERAL ---
    const rolUpper = (currentUser?.rol || '').toUpperCase();
    const isPrivileged = currentUser?.esAdminReal || rolUpper === 'GERENTE GENERAL' || rolUpper === 'ADMIN';
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
        const fStart = `${monday.getFullYear()}-${pad(monday.getMonth()+1)}-${pad(monday.getDate())}`;
        const fEnd = `${sunday.getFullYear()}-${pad(sunday.getMonth()+1)}-${pad(sunday.getDate())}`;

        // Verificamos si ya existe una solicitud para esa gerencia en esa semana
        const { data: existencias, error } = await supabase
            .from('solicitudes_fondos')
            .select('*')
            .eq('gerencia_nombre', depto)
            .gte('fecha_operativa', fStart)
            .lte('fecha_operativa', fEnd)
            .limit(1);

        if (error) throw error;

        if (existencias && existencias.length > 0) {
            const sol = existencias[0];
            setSolicitudConflictiva(sol);
            setErrorCheck(`Error: El departamento de ${depto} ya tiene una solicitud abierta para la Semana ${week} por ${sol.responsable_nombre}. Por favor, colabora en esa solicitud o espera a que se finalice.`);
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
      acc.bs += parseFloat(h.total_bs || 0);
      acc.usd += parseFloat(h.total_usd || 0);
      acc.general += (parseFloat(h.total_bs || 0) + parseFloat(h.total_usd || 0));
      return acc;
    }, { bs: 0, usd: 0, general: 0 });
  }, [historialFiltrado]);

  // --- FUNCIÓN DE EXPORTACIÓN A EXCEL PREMIUM ---
  const exportarExcel = async () => {
    // Importamos dinámicamente para evitar problemas de carga inicial
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Solicitud de Fondos');

    // Estilo de Título
    ws.mergeCells('A1:I1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'TOTAL CLEAN C.A. - SOLICITUD DE FONDOS OPERATIVOS';
    titleCell.font = { name: 'Arial Black', size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0EA5E9' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(1).height = 35;

    // Encabezados
    const headers = ['ID CONTROL', 'SEMANA', 'PERÍODO', 'RESPONSABLE', 'GERENCIA', 'PAGO BS ($)', 'PAGO USD ($)', 'TOTAL ($)', 'ESTADO'];
    ws.addRow(headers);
    const headerRow = ws.getRow(2);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    headerRow.alignment = { horizontal: 'center' };

    // Datos
    historialFiltrado.forEach(h => {
      ws.addRow([
        h.id,
        `SEM ${getWeek(new Date(h.fecha_operativa + 'T12:00:00'), { weekStartsOn: 1 })}`,
        extractPeriodoFromId(h.id),
        h.responsable,
        h.gerencia,
        parseFloat(h.total_bs || 0),
        parseFloat(h.total_usd || 0),
        parseFloat(h.total || 0),
        h.pago_realizado ? 'PAGADO' : 'PENDIENTE'
      ]);
    });

    // Formato de Moneda
    ws.getColumn(6).numFmt = '"$"#,##0.00';
    ws.getColumn(7).numFmt = '"$"#,##0.00';
    ws.getColumn(8).numFmt = '"$"#,##0.00';

    // Ajuste de Anchos
    ws.columns.forEach(col => { col.width = 15; });
    ws.getColumn(1).width = 25;
    ws.getColumn(3).width = 20;
    ws.getColumn(4).width = 25;
    ws.getColumn(5).width = 20;

    // Totales Finales
    const totalRowIndex = historialFiltrado.length + 3;
    ws.mergeCells(`A${totalRowIndex}:E${totalRowIndex}`);
    const totalLabel = ws.getCell(`A${totalRowIndex}`);
    totalLabel.value = 'TOTALES GENERALES:';
    totalLabel.font = { bold: true, size: 12 };
    totalLabel.alignment = { horizontal: 'right' };

    const sumBs = historialFiltrado.reduce((acc, h) => acc + parseFloat(h.total_bs || 0), 0);
    const sumUsd = historialFiltrado.reduce((acc, h) => acc + parseFloat(h.total_usd || 0), 0);
    const sumTotal = historialFiltrado.reduce((acc, h) => acc + parseFloat(h.total || 0), 0);

    const cellBs = ws.getCell(`F${totalRowIndex}`);
    cellBs.value = sumBs;
    cellBs.font = { bold: true, color: { argb: 'FFB45309' } };
    cellBs.numFmt = '"$"#,##0.00';

    const cellUsd = ws.getCell(`G${totalRowIndex}`);
    cellUsd.value = sumUsd;
    cellUsd.font = { bold: true, color: { argb: 'FF15803D' } };
    cellUsd.numFmt = '"$"#,##0.00';

    const cellTotal = ws.getCell(`H${totalRowIndex}`);
    cellTotal.value = sumTotal;
    cellTotal.font = { bold: true, size: 12 };
    cellTotal.numFmt = '"$"#,##0.00';

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
                    <b>Responsable:</b> ${solicitud.responsable_nombre}
                </div>
                <div class="text-right">
                    <b>Fecha Operativa:</b> ${new Date(solicitud.fecha_operativa + 'T12:00:00').toLocaleDateString('es-ES')}<br>
                    <b>Sede:</b> ${solicitud.sede || 'No Especificada'}
                </div>
            </div>

            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 15%">C. COSTO</th>
                  <th style="width: 25%">CLASIFICACIÓN</th>
                  <th style="width: 35%">DESCRIPCIÓN</th>
                  <th style="width: 10%" class="text-center">CANT.</th>
                  <th style="width: 15%" class="text-right">MONTO ($)</th>
                </tr>
              </thead>
              <tbody>
                ${partidas.map(p => {
        const totalRenglon = (p.pu_bs || 0) * (p.cantidad || 1) + (p.pu_usd || 0) * (p.cantidad || 1);
        return `
                    <tr>
                      <td>${p.centro_costo}</td>
                      <td>${p.clasificacion}</td>
                      <td>
                        ${p.descripcion}<br>
                        <span style="font-size: 10px; color: #555;">Beneficiario: ${p.beneficiario}</span>
                      </td>
                      <td class="text-center">${p.cantidad}</td>
                      <td class="text-right">${totalRenglon.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  `;
      }).join('')}
              </tbody>
            </table>

            <div class="totals-section">
              <div class="totals-box">
                <div class="totals-row">
                  <span>Pago Equivalente (BS)</span>
                  <span>$ ${solicitud.total_bs.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="totals-row">
                  <span>Pago en Divisas ($)</span>
                  <span>$ ${solicitud.total_usd.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="totals-row bold">
                  <span>TOTAL SOLICITUD ($)</span>
                  <span>$ ${(solicitud.total_bs + solicitud.total_usd).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
            
            <div style="margin-top: 50px; display: flex; justify-content: space-around;">
               <div style="text-align: center; border-top: 1px solid #000; width: 250px; padding-top: 5px; font-weight: bold;">
                  Preparado Por<br><span style="font-size: 10px; font-weight: normal;">${solicitud.responsable_nombre}</span>
               </div>
               <div style="text-align: center; border-top: 1px solid #000; width: 250px; padding-top: 5px; font-weight: bold;">
                  Aprobado Por<br><span style="font-size: 10px; font-weight: normal;">Gerencia General</span>
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
      bs: form.partidas.reduce((acc, p) => acc + (parseFloat(p.puBs) || 0) * (p.cant || 1), 0),
      usd: form.partidas.reduce((acc, p) => acc + (parseFloat(p.puUsd) || 0) * (p.cant || 1), 0),
      imprevistosBs: form.imprevistos.reduce((acc, p) => acc + (parseFloat(p.puBs) || 0) * (p.cant || 1), 0),
      imprevistosUsd: form.imprevistos.reduce((acc, p) => acc + (parseFloat(p.puUsd) || 0) * (p.cant || 1), 0)
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

  const registrarOActualizar = async (keepOpen = false) => {
    try {
      let finalCodigoControl = idDinamico;

      // --- VALIDACIÓN DE UNICIDAD SEMANAL (NO DUPLICADOS) ---
      if (!isEditing) {
        const { data: checkData } = await supabase
          .from('solicitudes_fondos')
          .select('id')
          .eq('codigo_control', idDinamico);

        if (checkData && checkData.length > 0) {
          return toast.error("Ya existe una Solicitud de Fondo para esta semana. Por favor, edite la existente para evitar redundancias.");
        }
        finalCodigoControl = idDinamico;
      }

      const cabecera = {
        codigo_control: finalCodigoControl,
        fecha_operativa: form.fecha,
        sede: form.sede,
        gerencia_nombre: form.gerencia,
        responsable_nombre: form.responsable,
        total_bs: sumas.bs + sumas.imprevistosBs,
        total_usd: sumas.usd + sumas.imprevistosUsd
      };

      let cabeceraId;
      if (isEditing) {
        const { error: errorUpdate } = await supabase.from('solicitudes_fondos').update(cabecera).eq('id', form.id_db);
        if (errorUpdate) throw errorUpdate;
        cabeceraId = form.id_db;
        await supabase.from('partidas_fondos').delete().eq('solicitud_id', cabeceraId);
      } else {
        const { data: newCab, error: errorInsert } = await supabase.from('solicitudes_fondos').insert([cabecera]).select().single();
        if (errorInsert) throw errorInsert;
        cabeceraId = newCab.id;
      }

      // --- CORRECCIÓN AQUÍ: Aseguramos que se envíen 'centro_costo', 'clasificacion' y 'categoria' correctamente ---
      const renglones = form.partidas.map((p, i) => ({
        solicitud_id: cabeceraId,
        n_renglon: i + 1,
        centro_costo: p.cc,
        clasificacion: p.clasif, // Cambiado de p.clasificacion a p.clasif para que coincida con el estado 'form'
        categoria: p.cat,       // Cambiado de p.categoria a p.cat para que coincida con el estado 'form'
        cantidad: parseFloat(p.cant) || 0,
        unidad: p.uni,
        descripcion: p.desc,
        beneficiario: p.ben,
        pu_bs: parseFloat(p.puBs) || 0,
        pu_usd: parseFloat(p.puUsd) || 0,
        pago_realizado: p.pago_realizado || false,
        requisicion_id: p.requisicion_id || null,
        status: p.status || 'Disponible'
      }));

      if (mostrarImprevistos) {
        const renglonesImprevistos = form.imprevistos.map((imp, i) => ({
          solicitud_id: cabeceraId,
          n_renglon: renglones.length + i + 1,
          centro_costo: imp.cc || 'No Aplica',
          clasificacion: (imp.clasif || 'Solicitud de ticket') + ' [*]',
          categoria: imp.cat || 'Ticket',
          cantidad: parseFloat(imp.cant) || 1,
          unidad: imp.uni || 'UND',
          descripcion: imp.desc,
          beneficiario: imp.ben,
          pu_bs: parseFloat(imp.puBs) || 0,
          pu_usd: parseFloat(imp.puUsd) || 0,
          pago_realizado: imp.pago_realizado || false,
          requisicion_id: imp.requisicion_id || null,
          status: imp.status || 'Disponible'
        }));
        renglones.push(...renglonesImprevistos);
      }

      const { error: errorPartidas } = await supabase.from('partidas_fondos').insert(renglones);
      if (errorPartidas) throw errorPartidas;

      toast.success("¡Guardado con éxito!");
      await cargarTodo();
      if (!keepOpen) setShowModal(false);
    } catch (err) {
      toast.error("Error al guardar: " + err.message);
    }
  };

  const handleRequisicionFinalizada = (nuevaReqId, idsPartidas) => {
    // Actualizar estado local para evitar recarga
    const actualizarLista = (lista) => lista.map(p =>
      idsPartidas.includes(p.id) ? { ...p, status: 'Bloqueado', requisicion_id: nuevaReqId, selected: false } : p
    );

    setForm(prev => ({
      ...prev,
      partidas: actualizarLista(prev.partidas),
      imprevistos: actualizarLista(prev.imprevistos)
    }));

    // GUARDADO AUTOMÁTICO AL CREAR REQUISICIÓN sin cerrar modal
    registrarOActualizar(true);

    // Si queremos que desaparezcan del modal de selección, ya están filtrados por requisicion_id
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

  const handleEmitirTicketFromImprevisto = () => {
    const seleccionados = form.imprevistos.filter(i => i.selected);
    if (seleccionados.length === 0) return toast.error("Selecciona al menos un imprevisto");

    // VALIDACIÓN DE CC ÚNICO PARA TICKET DE PAGO
    const ccsUnicos = [...new Set(seleccionados.map(s => s.cc).filter(cc => cc))];
    if (ccsUnicos.length > 1) {
      return toast.error("No se pueden mezclar Centros de Costos en un mismo Ticket de Pago. Por favor, genere un ticket por separado.");
    }

    setDataParaTicket({
      fecha: form.fecha,
      gerencia: form.gerencia,
      solicitante: form.responsable,
      solicitud_ref: idDinamico,
      partidasSeleccionadas: seleccionados.map(imp => ({
        id: imp.id,
        cc: imp.cc,
        clasificacion: imp.clasif ? imp.clasif.replace(' [*]', '') : '',
        categoria: imp.cat,
        cantidad: (imp.cant !== undefined && imp.cant !== '') ? Number(imp.cant) : 1,
        unidad: imp.uni || 'UNID',
        descripcion: imp.desc || '',
        beneficiario: imp.ben || form.responsable || '', // Fallback al responsable de la solicitud
        puUsd: Number(imp.puUsd) || 0,
        puBs: Number(imp.puBs) || 0
      }))
    });
    setAbrirTicketModal(true);
  };

  return (
    <div style={{ padding: '25px', backgroundColor: '#f1f5f9', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>

      {/* --- DASHBOARD UNIFICADO PREMIUM --- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {[
          { label: 'Dólares pagaderos en Bolívares', val: `$ ${totalesVisibles.bs.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`, col: '#030712' },
          { label: 'Dólares pagaderos en divisas', val: `$ ${totalesVisibles.usd.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`, col: '#030712' },
          { label: 'Total General ($)', val: `$ ${totalesVisibles.general.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`, col: '#030712' },
        ].map((x, i) => (
          <div
            key={i}
            className="stat-card"
            style={{
              borderLeft: `6px solid ${x.col}`,
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '20px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>{x.label}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#1e293b', margin: 0 }}>{x.val}</div>
          </div>
        ))}
      </div>

      {/* TABLA DE HISTORIAL */}

      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.3rem', color: '#1e293b', margin: 0 }}>Gestión de Solicitudes </h2>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={exportarExcel}
              style={{ padding: '12px 20px', backgroundColor: '#166534', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <FileSpreadsheet size={18} /> Exportar Excel
            </button>
            <button
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
                               <b>Responsable:</b> ${sol.responsable_nombre}
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
                               <th style="width: 38%">DESCRIPCIÓN</th>
                               <th style="width: 8%" class="text-center">CANT.</th>
                               <th style="width: 16%" class="text-right">PAGO Bs ($)</th>
                               <th style="width: 16%" class="text-right">PAGO USD ($)</th>
                             </tr>
                           </thead>
                           <tbody>
                             ${partidas.map(p => {
                      const montoBs = (p.pu_bs || 0) * (p.cantidad || 1);
                      const montoUsd = (p.pu_usd || 0) * (p.cantidad || 1);
                      return `
                                 <tr>
                                   <td style="font-size: 8px;">${p.centro_costo}</td>
                                   <td style="font-size: 8px;">${p.clasificacion}</td>
                                   <td style="font-size: 8.5px; line-height: 1.1;">
                                     <b>${p.descripcion}</b><br>
                                     <span style="color: #555; font-size: 7.5px;">Benef: ${p.beneficiario}</span>
                                   </td>
                                   <td class="text-center" style="font-size: 9px;">${p.cantidad}</td>
                                   <td class="text-right" style="font-size: 9.5px; font-weight: 600;">
                                     ${montoBs > 0 ? montoBs.toLocaleString('de-DE', { minimumFractionDigits: 2 }) : '-'}
                                   </td>
                                   <td class="text-right" style="font-size: 9.5px; font-weight: 600;">
                                     ${montoUsd > 0 ? montoUsd.toLocaleString('de-DE', { minimumFractionDigits: 2 }) : '-'}
                                   </td>
                                 </tr>
                               `;
                    }).join('')}
                           </tbody>
                         </table>

                         <div class="totals-section">
                           <div class="totals-box">
                             <div class="totals-row"><span>Pago Bs ($)</span> <span>$ ${sol.total_bs.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span></div>
                             <div class="totals-row"><span>Pago USD ($)</span> <span>$ ${sol.total_usd.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span></div>
                             <div class="totals-row bold"><span>TOTAL ($)</span> <span>$ ${(sol.total_bs + sol.total_usd).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span></div>
                           </div>
                         </div>

                         <div style="margin-top: 30px; display: flex; justify-content: space-around; font-size: 10px;">
                            <div style="text-align: center; border-top: 1px solid #000; width: 180px; padding-top: 5px;">
                               <b>Preparado Por:</b><br>${sol.responsable_nombre}
                            </div>
                            <div style="text-align: center; border-top: 1px solid #000; width: 180px; padding-top: 5px;">
                               <b>Aprobado Por:</b><br>Gerencia General
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
              style={{ padding: '12px 20px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Printer size={18} /> Reporte Global
            </button>
            <button onClick={() => {
              setIsEditing(false);
              setCcPreVal('');
              setFechaPreVal(new Date().toISOString().split('T')[0]);
              setErrorCheck('');
              setSolCheckExitosa(false);
              setShowPreVal(true);
            }} style={{ padding: '12px 25px', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>+ Nueva Solicitud</button>
          </div>
        </div>


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
            {Object.keys(mappingGerenciasDropdown).map(sigla => (
              <option key={sigla} value={sigla}>{sigla} - {mappingGerenciasDropdown[sigla]}</option>
            ))}
          </select>

          <select
            value={filtroSemana}
            onChange={(e) => setFiltroSemana(e.target.value)}
            style={{ flex: 0.8, padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px', backgroundColor: 'white' }}
          >
            <option value="">Semana (Todas)</option>
            {Array.from({ length: 52 }, (_, i) => {
              const sem = String(i + 1).padStart(2, '0');
              return <option key={sem} value={sem}>Semana {sem}</option>;
            })}
          </select>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontSize: '0.75rem' }}>
              <th style={{ padding: '15px', width: '16%' }}>ID CONTROL</th>
              <th style={{ width: '15%' }}>SEMANA / PERÍODO</th>
              <th style={{ width: '25%' }}>RESPONSABLE / GERENCIA</th>
              <th style={{ width: '14%', textAlign: 'right' }}>PAGO BS/$</th>
              <th style={{ width: '12%', textAlign: 'right' }}>PAGO $/$</th>
              <th style={{ width: '10%', textAlign: 'right' }}>TOTAL ($)</th>
              <th style={{ width: '8%', textAlign: 'center' }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Cargando registros...</td></tr>
            ) : historialFiltrado.map((h, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f8fafc', fontSize: '0.80rem', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                <td data-label="ID CONTROL" style={{ padding: '12px' }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      cargarDetallesYEditar(h);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      fontWeight: 'bold',
                      color: '#0ea5e9',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      font: 'inherit',
                      textAlign: 'left'
                    }}
                  >
                    {h.id}
                  </button>
                </td>
                <td data-label="SEMANA" style={{ fontWeight: 'bold', color: '#64748b' }}>
                  <div>SEM {getWeek(new Date(h.fecha_operativa + 'T12:00:00'), { weekStartsOn: 1 })}</div>
                  <div style={{ fontSize: '0.7rem', color: '#0ea5e9', marginTop: '3px' }}>{extractPeriodoFromId(h.id)}</div>
                </td>
                <td data-label="RESPONSABLE">
                  <div style={{ fontWeight: '500' }}>{h.responsable}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{h.gerencia}</div>
                </td>
                <td data-label="PAGO BS" style={{ color: '#b45309', fontWeight: '600' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '10px' }}>
                    <span>$</span>
                    <span>{parseFloat(h.total_bs || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </td>
                <td data-label="PAGO USD" style={{ color: '#15803d', fontWeight: '600' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '10px' }}>
                    <span>$</span>
                    <span>{parseFloat(h.total_usd || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                    {currentUser?.esSuperAdmin && (
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
          <div className="sf-modal-container">
            {/* BANNER DE FECHA TOPE */}
            <div style={{ 
              backgroundColor: isExpired ? '#fef2f2' : '#f0f9ff', 
              borderBottom: `1px solid ${isExpired ? '#fecaca' : '#bae6fd'}`,
              padding: '10px 30px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              margin: '-25px -25px 20px -25px',
              borderRadius: '20px 20px 0 0'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ 
                        backgroundColor: isExpired ? '#ef4444' : '#0ea5e9', 
                        color: 'white', 
                        padding: '4px 12px', 
                        borderRadius: '20px', 
                        fontSize: '11px', 
                        fontWeight: '800' 
                    }}>
                        {isExpired ? 'SEMANA CERRADA' : 'SEMANA ACTIVA'}
                    </div>
                    <span style={{ fontSize: '12px', color: isExpired ? '#991b1b' : '#0369a1', fontWeight: '600' }}>
                        Período: <span style={{ fontWeight: '800' }}>{periodoSemana}</span>
                    </span>
                </div>
                <div style={{ fontSize: '12px', color: isExpired ? '#ef4444' : '#64748b', fontWeight: 'bold' }}>
                    {isExpired ? (
                        <span>🛑 Plazo vencido. No se pueden añadir nuevos registros.</span>
                    ) : (
                        <span>⏰ Fecha Tope Requisciones: <span style={{ color: '#0f172a' }}>Domingo {format(deadlineDate, 'dd/MM')} - 11:59 PM</span></span>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <div>
                <h2 style={{ margin: 0, fontWeight: '900' }}>{isEditing ? 'Detalles de Ejecución' : 'Registro de Fondos'}</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
                  <div style={{ background: '#0f172a', color: 'white', padding: '4px 12px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold' }}>ID: {idDinamico}</div>
                  <div style={{ background: '#0ea5e9', color: 'white', padding: '4px 12px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold' }}>📅 {isEditing ? extractPeriodoFromId(form.id) : periodoSemana}</div>
                </div>
              </div>

              {/* DASHBOARD DE CONTROL DE EJECUCIÓN PREMIUM */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="rm-stat-card primary" style={{ padding: '12px 20px', minWidth: '160px', borderRadius: '14px' }}>
                  <div className="rm-stat-info">
                    <label style={{ fontSize: '10px' }}>Estimado</label>
                    <h3 style={{ fontSize: '1.2rem' }}>$ {dashEjecucion.estimado.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</h3>
                  </div>
                  <div className="rm-stat-icon" style={{ width: '32px', height: '32px' }}><DollarSign size={16} /></div>
                </div>

                <div className="rm-stat-card success" style={{ padding: '12px 20px', minWidth: '160px', borderRadius: '14px' }}>
                  <div className="rm-stat-info">
                    <label style={{ fontSize: '10px' }}>Comprado</label>
                    <h3 style={{ fontSize: '1.2rem', color: '#10b981' }}>$ {dashEjecucion.ejecutado.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</h3>
                  </div>
                  <div className="rm-stat-icon" style={{ width: '32px', height: '32px' }}><CheckCircle2 size={16} color="#10b981" /></div>
                </div>

                <div className="rm-stat-card highlight" style={{ padding: '12px 20px', minWidth: '160px', borderRadius: '14px' }}>
                  <div className="rm-stat-info">
                    <label style={{ fontSize: '10px' }}>Pendiente</label>
                    <h3 style={{ fontSize: '1.2rem', color: '#f59e0b' }}>$ {dashEjecucion.pendiente.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</h3>
                  </div>
                  <div className="rm-stat-icon" style={{ width: '32px', height: '32px' }}><Clock size={16} color="#f59e0b" /></div>
                </div>

                <div className={`rm-stat-card ${dashEjecucion.diferencia < 0 ? 'danger' : 'info'}`} style={{ 
                  padding: '12px 20px', 
                  minWidth: '160px', 
                  borderRadius: '14px',
                  backgroundColor: dashEjecucion.diferencia < 0 ? '#fff1f2' : '#f0f9ff',
                  borderColor: dashEjecucion.diferencia < 0 ? '#fecaca' : '#bae6fd'
                }}>
                  <div className="rm-stat-info">
                    <label style={{ fontSize: '10px', color: dashEjecucion.diferencia < 0 ? '#e11d48' : '#0369a1' }}>
                      {dashEjecucion.diferencia < 0 ? 'Exceso' : 'Ahorro'}
                    </label>
                    <h3 style={{ fontSize: '1.2rem', color: dashEjecucion.diferencia < 0 ? '#be123c' : '#0ea5e9' }}>
                      $ {Math.abs(dashEjecucion.diferencia).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </h3>
                  </div>
                  <div className="rm-stat-icon" style={{ 
                    width: '32px', 
                    height: '32px',
                    backgroundColor: dashEjecucion.diferencia < 0 ? '#ffe4e6' : '#e0f2fe'
                  }}>
                    {dashEjecucion.diferencia < 0 ? <AlertCircle size={16} color="#e11d48" /> : <Activity size={16} color="#0ea5e9" />}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '40px', textAlign: 'right', alignItems: 'center' }}>
                <div style={{ borderLeft: '2px solid #e2e8f0', paddingLeft: '30px' }}>
                  <label style={{ fontSize: '10px', fontWeight: '900', color: '#64748b' }}>TOTAL SOLICITADO</label>
                  <div style={{ fontSize: '1.8rem', fontWeight: '950', color: '#0f172a' }}>$ {(sumas.bs + sumas.usd + sumas.imprevistosBs + sumas.imprevistosUsd).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
              </div>
            </div>

            {/* FORM CABECERA */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', background: 'white', padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#363636', marginBottom: '5px' }}>FECHA OPERATIVA</label>
                <input type="date" className="sf-input" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#363636', marginBottom: '5px' }}>GERENCIA SOLICITANTE</label>
                {(currentUser?.esAdminReal || currentUser?.rol === 'Gerente General' || currentUser?.rol === 'Admin') ? (
                  <select
                    className="sf-input"
                    value={form.gerencia}
                    onChange={(e) => {
                      const nuevaGerencia = e.target.value;
                      const gerentesRel = gerenciasData[nuevaGerencia];
                      const primerGerente = (gerentesRel && gerentesRel.length > 0) ? gerentesRel[0] : '';
                      setForm({
                        ...form,
                        gerencia: nuevaGerencia,
                        responsable: primerGerente
                      });
                    }}
                  >
                    <option value="">Seleccione Gerencia...</option>
                    {[...new Set([...gerentesDisponibles.map(g => g.departamento), 'Contabilidad'])].sort().map(dep => (
                      <option key={dep} value={dep}>{dep}</option>
                    ))}
                  </select>
                ) : (
                  <input className="sf-input" value={form.gerencia} readOnly style={{ backgroundColor: '#f8fafc', color: '#475569' }} />
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#363636', marginBottom: '5px' }}>RESPONSABLE DE GASTO</label>
                <input
                  className="sf-input"
                  value={form.responsable}
                  readOnly
                  style={{ backgroundColor: '#f8fafc', color: '#1e293b', fontWeight: '600' }}
                />
              </div>
            </div>

            {/* TABLA DE RENGLONES */}
            <div className="sf-table-wrapper">
              <div className="sf-table-header">
                <div style={{ width: '40px', padding: '12px', textAlign: 'center' }}>SEL</div>
                <div style={{ width: '45px', padding: '12px' }}>N°</div>
                <div style={{ width: '110px', padding: '12px' }}>REQ</div>
                <div style={{ width: '200px', padding: '12px' }}>C. COSTO</div>
                <div style={{ width: '215px', padding: '12px' }}>CLASIFICACIÓN</div>
                <div style={{ width: '215px', padding: '12px' }}>CATEGORÍA</div>
                <div style={{ width: '80px', padding: '12px' }}>CANT</div>
                <div style={{ width: '90px', padding: '12px' }}>UNID</div>
                <div style={{ width: '460px', padding: '12px' }}>DESCRIPCIÓN DEL GASTO</div>
                <div style={{ width: '200px', padding: '12px' }}>BENEFICIARIO</div>
                <div style={{ width: '120px', padding: '12px', textAlign: 'center' }}>P.U $/BS</div>
                <div style={{ width: '120px', padding: '12px', textAlign: 'center' }}>P.U $/$</div>
                <div style={{ width: '120px', padding: '12px', textAlign: 'center' }}>TOTAL $</div>
              </div>

              <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
                {form.partidas.map((p, i) => (
                  <div key={p.id} className="sf-table-row" style={{
                    background: (p.requisicion_id || p.codigo_ticket || p.status === 'Bloqueado') ? '#f1f5f9' : (p.selected ? '#e0f2fe' : 'transparent'),
                    opacity: 1
                  }}>
                    <div style={{ width: '40px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={p.selected || false}
                        onChange={(e) => manejarCambioPartida(i, 'selected', e.target.checked)}
                        style={{ cursor: (p.requisicion_id || p.codigo_ticket || p.status === 'Bloqueado') ? 'not-allowed' : 'pointer', transform: 'scale(1.2)' }}
                        disabled={!!p.requisicion_id || !!p.codigo_ticket || p.status === 'Bloqueado'}
                        title={p.codigo_ticket ? `Ticket Emitido: ${p.codigo_ticket}` : (p.requisicion_id ? "Bloqueado por Requisición" : "")}
                      />
                    </div>
                    <div style={{ width: '45px', textAlign: 'center', fontWeight: 'bold', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                      {i + 1}
                      {p.codigo_ticket && <span title={`Ticket: ${p.codigo_ticket}`}>🎟️</span>}
                      {p.pago_realizado && <span title="Pago Completado">✅</span>}
                    </div>
                    <div style={{ width: '110px', padding: '6px', fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {p.codigo_req || '---'}
                    </div>
                    <div style={{ width: '200px', padding: '6px' }}>
                      <select className="sf-table-input" value={p.cc} onChange={(e) => manejarCambioPartida(i, 'cc', e.target.value)} style={{ fontWeight: 'bold' }} disabled={!!p.codigo_ticket}>
                        <option value="">Seleccione C.C...</option>
                        {centrosCosto.map(op => <option key={op.id} value={op.nombre}>{op.nombre}</option>)}
                      </select>
                    </div>
                    <div style={{ width: '215px', padding: '6px' }}>
                      <select className="sf-table-input" value={p.clasif} onChange={(e) => manejarCambioPartida(i, 'clasif', e.target.value)} disabled={!p.cc}>
                        <option value="">Clasificación...</option>
                        {(() => {
                          const ccObj = centrosCosto.find(c => c.nombre === p.cc);
                          return todasClasificaciones
                            .filter(cl => cl.padreId === ccObj?.id)
                            .map(op => <option key={op.id} value={op.nombre}>{op.nombre}</option>);
                        })()}
                      </select>
                    </div>
                    <div style={{ width: '215px', padding: '6px' }}>
                      <select className="sf-table-input" value={p.cat} onChange={(e) => manejarCambioPartida(i, 'cat', e.target.value)} disabled={!p.clasif}>
                        <option value="">Categoría...</option>
                        {(() => {
                          const ccObj = centrosCosto.find(c => c.nombre === p.cc);
                          const clObj = todasClasificaciones.find(cl => cl.nombre === p.clasif && cl.padreId === ccObj?.id);
                          return todasCategorias
                            .filter(ct => ct.padreId === clObj?.id)
                            .map(op => <option key={op.id} value={op.nombre}>{op.nombre}</option>);
                        })()}
                      </select>
                    </div>
                    <div style={{ width: '80px', padding: '6px' }}><input className="sf-table-input" type="number" value={p.cant} onChange={(e) => manejarCambioPartida(i, 'cant', e.target.value)} style={{ textAlign: 'center' }} disabled={!!p.codigo_ticket} /></div>
                    <div style={{ width: '90px', padding: '6px' }}><select className="sf-table-input" value={p.uni} onChange={(e) => manejarCambioPartida(i, 'uni', e.target.value)} disabled={!!p.codigo_ticket}>{unidades.map(u => <option key={u}>{u}</option>)}</select></div>
                    <div style={{ width: '460px', padding: '10px' }}><textarea className="sf-table-input" value={p.desc} onChange={(e) => manejarCambioPartida(i, 'desc', e.target.value)} style={{ resize: 'none' }} rows="1" disabled={!!p.codigo_ticket} /></div>
                    <div style={{ width: '200px', padding: '6px' }}><input className="sf-table-input" value={p.ben} onChange={(e) => manejarCambioPartida(i, 'ben', e.target.value)} disabled={!!p.codigo_ticket} /></div>
                    <div style={{ width: '120px', padding: '6px' }}><input className="sf-table-input" type="number" value={p.puBs} onChange={(e) => manejarCambioPartida(i, 'puBs', e.target.value)} style={{ textAlign: 'right' }} disabled={p.puUsd > 0 || !!p.codigo_ticket} /></div>
                    <div style={{ width: '120px', padding: '6px' }}><input className="sf-table-input" type="number" value={p.puUsd} onChange={(e) => manejarCambioPartida(i, 'puUsd', e.target.value)} style={{ textAlign: 'right' }} disabled={p.puBs > 0 || !!p.codigo_ticket} /></div>
                    <div style={{ width: '120px', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>{((parseFloat(p.puBs) || parseFloat(p.puUsd) || 0) * (p.cant || 0)).toLocaleString('de-DE')}</div>
                    <div style={{ width: '40px', textAlign: 'center' }}><button onClick={() => setForm({ ...form, partidas: form.partidas.filter((_, idx) => idx !== i) })} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: (p.codigo_ticket || p.requisicion_id) ? 'not-allowed' : 'pointer', fontSize: '1rem', opacity: (p.codigo_ticket || p.requisicion_id) ? 0.3 : 1 }} disabled={!!p.codigo_ticket || !!p.requisicion_id} title="Eliminar renglón">🗑️</button></div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECCIÓN GASTOS IMPREVISTOS */}
            {mostrarImprevistos && (
              <div style={{ marginTop: '30px', animation: 'fadeIn 0.3s ease-in-out' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                  <div style={{ flex: 1, height: '2px', background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)' }}></div>
                  <h3 style={{ margin: '0 20px', color: '#b45309', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <i className="fa-solid fa-triangle-exclamation"></i>TICKET DE PAGO
                  </h3>
                  <div style={{ flex: 1, height: '2px', background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)' }}></div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '25px', marginBottom: '12px', padding: '0 10px' }}>
                  <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '5px 15px', borderRadius: '8px', display: 'flex', gap: '15px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#d97706' }}>BALANCE DE TICKET DE PAGO:</span>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#b45309' }}>$/Bs. {sumas.imprevistosBs.toLocaleString('de-DE')}</span>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#b45309' }}>$ {sumas.imprevistosUsd.toLocaleString('de-DE')}</span>
                  </div>
                </div>

                <div className="sf-table-wrapper" style={{ border: '1px solid #fcd34d', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.05)' }}>
                  <div className="sf-table-header" style={{ background: '#fffcf0', borderBottom: '2px solid #fef3c7', color: '#b45309' }}>
                    <div style={{ width: '45px', padding: '12px' }}>N°</div>
                    <div style={{ width: '110px', padding: '12px' }}>REQ</div>
                    <div style={{ width: '200px', padding: '12px' }}>C. COSTO</div>
                    <div style={{ width: '215px', padding: '12px' }}>CLASIFICACIÓN</div>
                    <div style={{ width: '215px', padding: '12px' }}>CATEGORÍA</div>
                    <div style={{ width: '80px', padding: '12px' }}>CANT</div>
                    <div style={{ width: '90px', padding: '12px' }}>UNID</div>
                    <div style={{ width: '460px', padding: '12px' }}>DESCRIPCIÓN DEL GASTO</div>
                    <div style={{ width: '200px', padding: '12px' }}>BENEFICIARIO</div>
                    <div style={{ width: '120px', padding: '12px', textAlign: 'center' }}>P.U $/BS</div>
                    <div style={{ width: '120px', padding: '12px', textAlign: 'center' }}>P.U $/$</div>
                    <div style={{ width: '120px', padding: '12px', textAlign: 'center' }}>TOTAL $</div>
                  </div>

                  <div style={{ maxHeight: '30vh', overflowY: 'auto' }}>
                    {form.imprevistos.map((imp, i) => (
                      <div key={imp.id} className="sf-table-row" style={{
                        background: (imp.requisicion_id || imp.status === 'Bloqueado') ? '#f1f5f9' : (imp.selected ? '#fffcf0' : 'transparent'),
                        opacity: 1
                      }}>
                        <div style={{ width: '40px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={imp.selected || false}
                            onChange={(e) => manejarCambioImprevisto(i, 'selected', e.target.checked)}
                            style={{ cursor: (imp.requisicion_id || imp.status === 'Bloqueado') ? 'not-allowed' : 'pointer', transform: 'scale(1.2)' }}
                            disabled={!!imp.requisicion_id || imp.status === 'Bloqueado'}
                            title={(imp.requisicion_id || imp.status === 'Bloqueado') ? "Esta partida está bloqueada por una requisición activa" : ""}
                          />
                        </div>
                        <div style={{ width: '45px', textAlign: 'center', fontWeight: 'bold', color: '#d97706' }}>{i + 1}</div>
                        <div style={{ width: '110px', padding: '6px', fontSize: '10px', fontWeight: 'bold', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {imp.codigo_req || '---'}
                        </div>
                        <div style={{ width: '200px', padding: '6px' }}>
                          <select className="sf-table-input" value={imp.cc} onChange={(e) => manejarCambioImprevisto(i, 'cc', e.target.value)} style={{ fontWeight: 'bold' }}>
                            <option value="">Seleccione C.C...</option>
                            {centrosCosto.map(op => <option key={op.id} value={op.nombre}>{op.nombre}</option>)}
                          </select>
                        </div>
                        <div style={{ width: '215px', padding: '6px' }}>
                          <select className="sf-table-input" value={imp.clasif} onChange={(e) => manejarCambioImprevisto(i, 'clasif', e.target.value)} disabled={!imp.cc}>
                            <option value="">Clasificación...</option>
                            {(() => {
                              const ccObj = centrosCosto.find(c => c.nombre === imp.cc);
                              return todasClasificaciones
                                .filter(cl => cl.padreId === ccObj?.id)
                                .map(op => <option key={op.id} value={op.nombre}>{op.nombre}</option>);
                            })()}
                          </select>
                        </div>
                        <div style={{ width: '215px', padding: '6px' }}>
                          <select className="sf-table-input" value={imp.cat} onChange={(e) => manejarCambioImprevisto(i, 'cat', e.target.value)} disabled={!imp.clasif}>
                            <option value="">Categoría...</option>
                            {(() => {
                              const ccObj = centrosCosto.find(c => c.nombre === imp.cc);
                              const clObj = todasClasificaciones.find(cl => cl.nombre === imp.clasif && cl.padreId === ccObj?.id);
                              return todasCategorias
                                .filter(ct => ct.padreId === clObj?.id)
                                .map(op => <option key={op.id} value={op.nombre}>{op.nombre}</option>);
                            })()}
                          </select>
                        </div>
                        <div style={{ width: '80px', padding: '6px' }}><input className="sf-table-input" type="number" value={imp.cant} onChange={(e) => manejarCambioImprevisto(i, 'cant', e.target.value)} style={{ textAlign: 'center' }} /></div>
                        <div style={{ width: '90px', padding: '6px' }}><select className="sf-table-input" value={imp.uni} onChange={(e) => manejarCambioImprevisto(i, 'uni', e.target.value)}>{unidades.map(u => <option key={u}>{u}</option>)}</select></div>
                        <div style={{ width: '460px', padding: '10px' }}><textarea className="sf-table-input" value={imp.desc} onChange={(e) => manejarCambioImprevisto(i, 'desc', e.target.value)} style={{ resize: 'none' }} rows="1" /></div>
                        <div style={{ width: '200px', padding: '6px' }}><input className="sf-table-input" value={imp.ben} onChange={(e) => manejarCambioImprevisto(i, 'ben', e.target.value)} /></div>
                        <div style={{ width: '120px', padding: '6px' }}><input className="sf-table-input" type="number" value={imp.puBs} onChange={(e) => manejarCambioImprevisto(i, 'puBs', e.target.value)} style={{ textAlign: 'right' }} disabled={imp.puUsd > 0} /></div>
                        <div style={{ width: '120px', padding: '6px' }}><input className="sf-table-input" type="number" value={imp.puUsd} onChange={(e) => manejarCambioImprevisto(i, 'puUsd', e.target.value)} style={{ textAlign: 'right' }} disabled={imp.puBs > 0} /></div>
                        <div style={{ width: '120px', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>{((parseFloat(imp.puBs) || parseFloat(imp.puUsd) || 0) * (imp.cant || 1)).toLocaleString('de-DE')}</div>
                        <div style={{ width: '40px', textAlign: 'center' }}>
                          <button onClick={() => setForm({ ...form, imprevistos: form.imprevistos.filter((_, idx) => idx !== i) })} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }} title="Eliminar imprevisto">🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '12px', background: '#fffcf0', borderTop: '1px solid #fef3c7', display: 'flex', justifyContent: 'center' }}>
                    <button className="sf-btn" onClick={() => setForm({ ...form, imprevistos: [...form.imprevistos, { id: Date.now(), selected: false, cc: '', clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', puBs: '', puUsd: '', pago_realizado: false }] })} style={{ color: '#d97706', border: '2px dashed #f59e0b', background: '#fffbeb', padding: '8px 40px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <i className="fa-solid fa-plus-circle"></i> AÑADIR OTRO TICKET DE PAGO
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  className="sf-btn sf-btn-add" 
                  onClick={() => setForm({ ...form, partidas: [...form.partidas, { id: Date.now(), selected: false, cc: form.partidas[0]?.cc || '', clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', puBs: '', puUsd: '' }] })}
                  disabled={isExpired}
                  style={{ opacity: isExpired ? 0.5 : 1, cursor: isExpired ? 'not-allowed' : 'pointer' }}
                >
                  + AÑADIR RENGLÓN PARA REQUISICIÓN
                </button>
                <button className="sf-btn" onClick={() => setMostrarImprevistos(!mostrarImprevistos)} style={{ border: '1px solid #f59e0b', color: '#d97706', background: mostrarImprevistos ? '#fffbeb' : 'white' }}>
                  {mostrarImprevistos ? '- OCULTAR TICKET' : '+ MOSTRAR TICKET'}
                </button>
                <button className="sf-btn sf-btn-success" onClick={handleCrearRequisicion} disabled={isExpired} style={{ opacity: isExpired ? 0.5 : 1 }}>📝 CREAR REQUISICIÓN</button>
                {mostrarImprevistos && (
                  <button className="sf-btn" style={{ background: '#f59e0b', color: 'white', border: 'none', opacity: isExpired ? 0.5 : 1 }} onClick={handleEmitirTicketFromImprevisto} disabled={isExpired}>🏟️ EMITIR TICKET DE PAGO</button>
                )}
              </div>

              {/* BOTONES */}
              <div style={{ display: 'flex', gap: '10px', alignSelf: 'flex-end' }}>
                <button className="sf-btn sf-btn-close" onClick={intentarCerrarModal}>CERRAR</button>
                <button 
                  className="sf-btn" 
                  style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', padding: '12px 25px', opacity: isExpired ? 0.5 : 1 }} 
                  onClick={() => registrarOActualizar(true)}
                  disabled={isExpired}
                >
                  GUARDAR
                </button>
                <button className="sf-btn sf-btn-primary" onClick={() => registrarOActualizar(false)} disabled={isExpired} style={{ opacity: isExpired ? 0.5 : 1 }}>
                  {isEditing ? 'ACTUALIZAR Y FINALIZAR' : 'REGISTRAR Y FINALIZAR'}
                </button>
              </div>
            </div>
          </div>

          {abrirReq && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
              <div style={{ width: '90%', maxWidth: '1200px' }}>
                <Requisiciones
                  isOpen={abrirReq}
                  onClose={() => setAbrirReq(false)}
                  datosPredefinidos={dataParaReq}
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
                />
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
                            responsable: (['Gerente', 'Coordinador', 'Analista', 'Admin'].includes(currentUser?.rol) || currentUser?.esAdminReal)
                              ? `${currentUser.nombre} ${currentUser.apellido}`
                              : '',
                            partidas: [{ id: Date.now(), selected: false, cc: '', clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', puBs: '', puUsd: '' }],
                            imprevistos: [{ id: Date.now() + 1, selected: false, cc: '', clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', puBs: '', puUsd: '' }]
                        });
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
                              responsable: `${currentUser.nombre} ${currentUser.apellido}`,
                              partidas: [{ id: Date.now(), selected: false, cc: ccPreVal, clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', puBs: '', puUsd: '' }],
                              imprevistos: [{ id: Date.now() + 1, selected: false, cc: ccPreVal, clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', puBs: '', puUsd: '' }]
                          });
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