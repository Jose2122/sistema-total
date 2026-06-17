import React, { useState, useEffect, useCallback, useMemo, Component } from 'react';

// === ERROR BOUNDARY — evita pantalla en blanco por crashes internos ===
class TicketErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('[TicketExpress] Error capturado:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
          <h3>⚠️ Error al cargar el módulo de Ticket de Pago</h3>
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: '16px', padding: '10px 24px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            🔄 Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import { supabase } from './supabaseClient';
import {
  Plus,
  Trash2,
  FileText,
  Upload,
  ArrowLeft,
  CheckCircle2,
  Search,
  Filter,
  User,
  History,
  FileImage,
  Loader2,
  Eye,
  Calendar,
  Copy,
  Ticket,
  Hash,
  MessageSquare,
  FileDown,
  Diamond,
  X,
  Camera
} from 'lucide-react';
import { format, getWeek } from 'date-fns';
import toast from 'react-hot-toast';
import './TicketExpress.css';

const obtenerNombreDeUrl = (url) => {
  if (!url) return '';
  try {
    const parts = url.split('/');
    const last = parts[parts.length - 1];
    return decodeURIComponent(last.split('?')[0]);
  } catch (e) {
    return 'Soporte';
  }
};

const parsearFacturaUrls = (facturaUrlField) => {
  if (!facturaUrlField) return [];
  
  let rawItems = [];
  
  const extractRaw = (field) => {
    if (!field) return;
    if (Array.isArray(field)) {
      field.forEach(item => extractRaw(item));
    } else if (typeof field === 'string') {
      const trimmed = field.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          extractRaw(parsed);
        } catch (e) {
          rawItems.push(trimmed);
        }
      } else {
        rawItems.push(trimmed);
      }
    } else if (typeof field === 'object' && field !== null) {
      rawItems.push(field);
    }
  };

  extractRaw(facturaUrlField);

  return rawItems.map(item => {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed.startsWith('{')) {
        try {
          const obj = JSON.parse(trimmed);
          if (obj.url) {
            return {
              url: obj.url,
              name: obj.name || obj.etiqueta || obtenerNombreDeUrl(obj.url)
            };
          }
        } catch (e) {}
      }
      return {
        url: trimmed,
        name: obtenerNombreDeUrl(trimmed)
      };
    } else if (typeof item === 'object' && item !== null && item.url) {
      return {
        url: item.url,
        name: item.name || item.etiqueta || obtenerNombreDeUrl(item.url)
      };
    }
    return null;
  }).filter(item => item && typeof item.url === 'string' && item.url.trim().length > 10);
};

const TicketExpress = ({ isOpen = false, onClose = null, datosPredefinidos = null, onSuccess = null }) => {
  // --- ESTADOS DE CONTROL ---
  const [showModal, setShowModal] = useState(isOpen);
  const [loading, setLoading] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [verTodos, setVerTodos] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [verJustificacion, setVerJustificacion] = useState(false);
  const [mostrarSoportes, setMostrarSoportes] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [filtroGerencia, setFiltroGerencia] = useState('Todos');

  // --- LÓGICA DE SIGLAS GERENCIA ---
  const obtenerSiglas = (nombreGerencia) => {
    if (!nombreGerencia) return '---';
    const norm = nombreGerencia.trim().toLowerCase();
    if (norm.startsWith('estimac') || norm.startsWith('estimación')) {
      return 'EST';
    }
    const mapeo = {
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
    return mapeo[nombreGerencia] || "GER";
  };

  const getInitials = (nombre, apellido) => {
    return `${nombre?.charAt(0) || ''}${apellido?.charAt(0) || ''}`.toUpperCase();
  };

  const getWeekNumber = (d) => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  };

  const esPrivilegiado = useMemo(() => {
    if (!currentUser) return false;
    const emailLower = (currentUser.correo || '').toLowerCase();
    const deptoUpper = (currentUser.departamento || '').toUpperCase();
    return emailLower === 'jcontreras.totalclean@gmail.com' ||
      emailLower === 'cvega@totalclean.com' ||
      emailLower === 'karincmm1@gmail.com' ||
      deptoUpper.includes('ADMINISTRACIÓN') ||
      deptoUpper === 'RECURSOS HUMANOS' ||
      deptoUpper === 'CONTABILIDAD';
  }, [currentUser]);

  // --- DATA MAESTRA ---
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [todasClasificaciones, setTodasClasificaciones] = useState([]);
  const [todasCategorias, setTodasCategorias] = useState([]);

  // --- FORMULARIO ---
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    departamento: '',
    gerente: '',
    solicitante: '',
    solicitud_ref: '',
    clasificacion_admin: '',
    centro_costo: '',
    justificacion: '',
    justificacion_detallada: '',
    con_iva: true,
    partidas: [{
      id: Date.now(),
      cc: '',
      clasificacion: '',
      categoria: '',
      cantidad: 1,
      cantidad_pedida: 1,
      cantidad_comprada: 0,
      cantidad_pendiente: 1,
      unidad: 'UNID',
      descripcion: '',
      beneficiario: '',
      pu: '',
      total: 0,
      pago_realizado: false
    }],
    facturas_url: [],
    status: 'EMITIDO'
  });

  const [bancosDisponibles, setBancosDisponibles] = useState([]);

  const [idControlAutomatico, setIdControlAutomatico] = useState('TP-GER-26-0000');

  useEffect(() => {
    const generarID = async () => {
      if (isEditing) return;
      const sigla = obtenerSiglas(currentUser?.departamento || form.departamento);
      const aa = new Date().getFullYear().toString().slice(-2);

      // 1. Verificar si viene de una Requisición (RR)
      if (form.solicitud_ref && form.solicitud_ref.startsWith('RR-')) {
        const partesRR = form.solicitud_ref.split('-');
        if (partesRR.length >= 4) {
          const numRR = partesRR[partesRR.length - 1];
          setIdControlAutomatico(`TP-${sigla}-${aa}-${numRR}`);
          return;
        }
      }

      // 2. Si es directo, buscar el último correlativo TP del año actual
      const { data } = await supabase
        .from('tickets_directos')
        .select('codigo_control')
        .like('codigo_control', `TP-${sigla}-${aa}-%`)
        .order('codigo_control', { ascending: false })
        .limit(1);

      let max = 0;
      if (data && data.length > 0) {
        const partes = data[0].codigo_control.split('-');
        if (partes.length >= 4) {
          const num = parseInt(partes[partes.length - 1], 10);
          if (!isNaN(num)) max = num;
        }
      }
      let correlativo = String(max + 1).padStart(3, '0');
      setIdControlAutomatico(`TP-${sigla}-${aa}-${correlativo}`);
    };
    generarID();
  }, [form.departamento, form.solicitud_ref, currentUser, isEditing]);

  useEffect(() => {
    if (isOpen) setShowModal(true);
  }, [isOpen]);

  useEffect(() => {
    if (!showModal && onClose) onClose();
  }, [showModal, onClose]);

  const datosCargadosRef = React.useRef(false);

  useEffect(() => {
    if (datosPredefinidos && isOpen && !datosCargadosRef.current) {
      try {
        console.log("[TicketExpress] Aplicando datos predefinidos:", datosPredefinidos);
        if (datosPredefinidos.isExistingTicket) {
          setIsEditing(true);
          const t = datosPredefinidos.ticket;
          setForm({
            id: t.id,
            fecha: t.fecha_emision,
            gerente: t.gerente_nombre,
            solicitante: t.gerente_nombre,
            departamento: t.departamento,
            usuario_id: t.usuario_id,
            partidas: t.items || [],
            facturas_url: Array.isArray(t.factura_url) ? t.factura_url : (t.factura_url ? [t.factura_url] : []),
            status: t.status,
            id_control: t.codigo_control,
            solicitud_ref: t.solicitud_ref || '',
            clasificacion_admin: t.clasificacion_admin || '',
            justificacion: t.justificacion || '',
            justificacion_detallada: t.items?.[0]?.justificacion_detallada || '',
            centro_costo: t.centro_costo || t.items?.[0]?.cc || '',
            con_iva: t.con_iva !== false
          });
        } else {
          setIsEditing(false);
          setForm(prev => {
            const partidas = (datosPredefinidos.partidasSeleccionadas && Array.isArray(datosPredefinidos.partidasSeleccionadas))
              ? datosPredefinidos.partidasSeleccionadas.map(p => {
                const cant = (p.cantidad !== undefined) ? Number(p.cantidad) : (p.cant !== undefined ? Number(p.cant) : 1);
                return {
                  id: p.id || Date.now() + Math.random(),
                  cc: p.cc || p.centro_costo || '',
                  clasificacion: p.clasificacion || p.clasif || '',
                  categoria: p.categoria || p.cat || '',
                  cantidad: cant,
                  cantidad_pedida: cant,
                  cantidad_comprada: 0,
                  cantidad_pendiente: cant,
                  unidad: p.unidad || p.uni || 'UNID',
                  descripcion: p.descripcion || p.desc || '',
                  beneficiario: p.beneficiario || p.ben || '',
                  pu: Number(p.puUsd || p.puBs || p.pu || 0),
                  puBs: Number(p.puBs || 0),
                  puUsd: Number(p.puUsd || 0),
                  metodo_pago_actual: p.puBs > 0 ? '$ / BS' : '$ / $',
                  total: (Number(p.puUsd || p.puBs || p.pu || 0)) * cant,
                  pago_realizado: false
                };
              })
              : prev.partidas;

            return {
              ...prev,
              fecha: datosPredefinidos.fecha || prev.fecha,
              departamento: datosPredefinidos.gerencia || prev.departamento,
              solicitante: datosPredefinidos.solicitante || prev.solicitante,
              solicitud_ref: datosPredefinidos.solicitud_ref || '',
              centro_costo: partidas[0]?.cc || '',
              justificacion: datosPredefinidos.observaciones || datosPredefinidos.justificacion || '',
              partidas
            };
          });
        }
        datosCargadosRef.current = true;
      } catch (err) {
        console.error("[TicketExpress] Error al mapear datos predefinidos:", err);
      }
    }
    if (!isOpen) {
      datosCargadosRef.current = false;
    }
  }, [datosPredefinidos, isOpen]);

  useEffect(() => {
    const buscarGerente = async () => {
      if (!form.departamento || form.departamento === '') return;
      try {
        const { data, error } = await supabase
          .from('perfiles')
          .select('nombre, apellido')
          .eq('departamento', form.departamento)
          .eq('rol', 'Gerente')
          .limit(1)
          .maybeSingle();
        if (!error && data) {
          setForm(prev => ({ ...prev, gerente: `${data.nombre} ${data.apellido}` }));
        }
      } catch (err) {
        // Ignorar si no hay gerente registrado para ese departamento
      }
    };
    if (form.departamento && !isEditing) {
      buscarGerente();
    }
  }, [form.departamento, isEditing]);


  const unidades = ["UNID", "KG", "LTS", "SERV", "SG", "BOLSAS", "PZA"];

  // --- CARGAR SESIÓN Y PERFIL ---
  const cargarUsuario = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('*')
          .eq('id', user.id)
          .single();

        const emailLower = (user.email || '').toLowerCase();
        const esSuperAdmin = emailLower === 'jcontreras.totalclean@gmail.com';
        const esAdminReal = esSuperAdmin ||
          emailLower === 'cvega.totalclean@gmail.com' ||
          emailLower === 'cvega@totalclean.com' ||
          emailLower === 'karincmm1@gmail.com';

        const userInfo = {
          id: user.id,
          nombre: perfil ? `${perfil.nombre} ${perfil.apellido}` : emailLower.split('@')[0],
          correo: emailLower,
          departamento: perfil ? perfil.departamento : 'General',
          rol: perfil ? perfil.rol : 'Gerente',
          esSuperAdmin,
          esAdminReal,
          esAdminGlobal: esAdminReal || perfil?.rol === 'Gerente General' || perfil?.rol === 'Administrador'
        };

        setCurrentUser(userInfo);
        setForm(prev => ({
          ...prev,
          gerente: userInfo.nombre,
          solicitante: userInfo.nombre,
          departamento: userInfo.departamento,
          usuario_id: userInfo.id
        }));
      }
    } catch (err) {
      console.error('Error cargando usuario en TicketExpress:', err.message);
    }
  }, []);

  // --- CARGAR DATA MAESTRA ---
  const cargarDataMaestra = useCallback(async () => {
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

    const { data: dataBancos } = await supabase.from('bancos').select('*').eq('activo', true).order('nombre');
    if (dataBancos) setBancosDisponibles(dataBancos);
  }, []);

  // --- CARGAR HISTORIAL ---
  const cargarHistorial = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      let query = supabase.from('tickets_directos').select('*'); // Usar select(*) para evitar campos faltantes en el detalle

      // Si es Admin Global y tiene "Ver Todos" activado, NO filtra
      const esVistaTotal = currentUser.esAdminGlobal && verTodos;

      if (!esVistaTotal) {
        if (currentUser.esAdminGlobal || currentUser.rol === 'Gerente General') {
          // Admin global sin "Ver Todos" o Gerente General: ven todo de todas formas
          // No aplicamos filtro
        } else if (currentUser.rol === 'Gerente' || currentUser.rol === 'Coordinador' || currentUser.rol === 'Administrador') {
          query = query.eq('departamento', currentUser.departamento);
        } else if (currentUser.rol === 'Analista') {
          query = query.eq('departamento', currentUser.departamento);
        } else {
          query = query.eq('usuario_id', currentUser.id);
        }
      }

      const { data, error } = await query.order('fecha_emision', { ascending: false });
      if (error) throw error;
      setHistorial(data || []);
    } catch (err) {
      console.error("Error historial:", err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser, verTodos]);

  useEffect(() => {
    cargarUsuario();
    cargarDataMaestra();
  }, [cargarUsuario, cargarDataMaestra]);

  useEffect(() => {
    if (currentUser) cargarHistorial();
  }, [currentUser, cargarHistorial, verTodos]);

  // --- MANEJADORES DE FORMULARIO ---
  const manejarCambioPartida = (index, campo, valor) => {
    const nuevas = [...form.partidas];
    let valorFinal = valor;

    // BLOQUEO DE NEGATIVOS
    if (['cantidad', 'cant', 'pu'].includes(campo)) {
      valorFinal = Math.max(0, parseFloat(valor) || 0);
    }

    nuevas[index][campo] = valorFinal;

    if (campo === 'cc') { nuevas[index].clasificacion = ''; nuevas[index].categoria = ''; }
    if (campo === 'clasificacion') { nuevas[index].categoria = ''; }

    if (['cantidad', 'cant', 'pu'].includes(campo)) {
      const c = parseFloat(nuevas[index].cantidad || nuevas[index].cant) || 0;
      const p = parseFloat(nuevas[index].pu) || 0;
      nuevas[index].total = c * p;
    }
    setForm({ ...form, partidas: nuevas });
  };

  const manejarCambioPago = (index, valor) => {
    const nuevas = [...form.partidas];
    nuevas[index].pago_realizado = valor;

    let nuevoStatus = form.status;
    if (valor && form.status === 'EMITIDO') {
      nuevoStatus = 'PAGADO';
    } else if (!nuevas.some(p => p.pago_realizado)) {
      nuevoStatus = 'EMITIDO';
    }

    setForm({ ...form, partidas: nuevas, status: nuevoStatus });
  };

  const añadirRenglon = () => {
    setForm({
      ...form,
      partidas: [...form.partidas, {
        id: Date.now(),
        cc: '',
        clasificacion: '',
        categoria: '',
        cantidad: 1,
        cantidad_pedida: 1,
        cantidad_comprada: 0,
        cantidad_pendiente: 1,
        unidad: 'UNID',
        descripcion: '',
        beneficiario: '',
        pu: '',
        total: 0,
        pago_realizado: false
      }]
    });
  };

  const eliminarRenglon = (id) => {
    if (form.partidas.length > 1) {
      setForm({ ...form, partidas: form.partidas.filter(p => p.id !== id) });
    }
  };

  // --- ADJUNTAR SOPORTE ---
  const manejarSubidaSoporte = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("El archivo supera el límite de 5MB. Por favor, redúzcalo antes de subirlo.");
      return;
    }

    setLoading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `tickets/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('facturas') // Usamos el mismo bucket 'facturas' para todos los soportes
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('facturas')
        .getPublicUrl(filePath);

      const nuevasUrls = [...(form.facturas_url || []), publicUrl];
      setForm(prev => ({ ...prev, facturas_url: nuevasUrls }));

      // Si estamos en modo "Ver Detalle" (isEditing), actualizamos la BD de inmediato
      if (isEditing && form.id) {
        const { error: updateError } = await supabase
          .from('tickets_directos')
          .update({ factura_url: nuevasUrls }) // Intentamos guardar el array en factura_url
          .eq('id', form.id);

        if (updateError) throw updateError;
        toast.success("Soporte actualizado");
        cargarHistorial();
      } else {
        toast.success("Soporte adjuntado con éxito");
      }
    } catch (err) {
      toast.error("Error subiendo soporte: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const eliminarSoporte = async (index) => {
    const nuevasUrls = form.facturas_url.filter((_, idx) => idx !== index);
    setForm(prev => ({ ...prev, facturas_url: nuevasUrls }));

    if (isEditing && form.id) {
      try {
        const { error } = await supabase
          .from('tickets_directos')
          .update({ factura_url: nuevasUrls })
          .eq('id', form.id);
        if (error) throw error;
        toast.success("Soporte eliminado");
        cargarHistorial();
      } catch (err) {
        toast.error("Error al eliminar soporte de BD: " + err.message);
      }
    } else {
      toast.success("Soporte quitado");
    }
  };

  // --- CALCULAR TOTALES ---
  const subtotalTotal = useMemo(() => {
    return form.partidas.reduce((acc, p) => acc + (parseFloat(p.total) || 0), 0);
  }, [form.partidas]);

  const totalGeneral = subtotalTotal * (form.con_iva !== false ? 1.16 : 1.00);

  // --- EMITIR TICKET ---
  const emitirTicket = async () => {
    if (!form.partidas.every(p => p.cc && p.clasificacion && p.categoria && p.cantidad && p.unidad && p.descripcion)) {
      return toast.error("Error: Todas las filas deben tener Centro de Costo, Clasificación, Categoría, Cantidad, Unidad y Descripción.");
    }

    if (!form.justificacion_detallada) {
      return toast.error("La Justificación del Pago es obligatoria.");
    }

    // VALIDACIÓN DE CC ÚNICO
    const ccsUnicos = [...new Set(form.partidas.map(p => p.cc).filter(cc => cc))];
    if (ccsUnicos.length > 1) {
      return toast.error("No se pueden mezclar Centros de Costos en un mismo Ticket de Pago. Por favor, genere un ticket por separado.");
    }

    setLoading(true);
    try {
      const payload = {
        usuario_id: currentUser.id,
        gerente_nombre: form.solicitante || currentUser.nombre,
        departamento: form.departamento,
        fecha_emision: form.fecha,
        codigo_control: idControlAutomatico,
        total_usd: totalGeneral,
        items: form.partidas.map((p, idx) => ({
          ...p,
          pago_realizado: p.pago_realizado || false,
          // Guardamos la justificación detallada en el primer ítem para persistencia
          ...(idx === 0 ? { justificacion_detallada: form.justificacion_detallada } : {})
        })),
        factura_url: form.facturas_url || [],
        status: form.status || 'EMITIDO',
        solicitud_ref: form.solicitud_ref || null,
        clasificacion_admin: form.clasificacion_admin || null,
        justificacion: form.justificacion || form.justificacion_detallada || null,
        centro_costo: form.centro_costo || form.partidas?.[0]?.cc || null,
        con_iva: form.con_iva !== false
      };

      console.log("[TicketExpress] Payload de inserción:", payload);

      const { data: newTicket, error } = await supabase.from('tickets_directos').insert([payload]).select().single();
      if (error) throw error;

      // NOTIFICAR A ADMINISTRACIÓN
      try {
        const { data: perfiles } = await supabase
          .from('perfiles')
          .select('id, rol, departamento');
        if (perfiles) {
          const admins = perfiles.filter(p => {
            const rol = (p.rol || '').toLowerCase();
            const depto = (p.departamento || '').toLowerCase();
            return rol.includes('administra') || rol.includes('contabil') || depto.includes('administra') || depto.includes('contabil');
          });
          for (const admin of admins) {
            if (admin.id !== currentUser?.id) {
              await supabase.from('notificaciones').insert([{
                usuario_id: admin.id,
                mensaje: `Nuevo Ticket de Pago ${newTicket.codigo_control} en cola creado por ${newTicket.gerente_nombre || 'un usuario'}.`,
                tipo: 'Ticket Nuevo',
                leido: false,
                requisicion_id: null
              }]);
            }
          }
        }
      } catch (err) {
        console.error("Error al notificar a administración:", err);
      }

      // ACTUALIZAR PARTIDAS FONDOS SI EXISTEN
      const idsRelacionados = form.partidas.map(p => p.id).filter(id => typeof id === 'number' || (typeof id === 'string' && id.length > 10)); // Los IDs de Supabase son largos
      if (idsRelacionados.length > 0) {
        await supabase
          .from('partidas_fondos')
          .update({
            ticket_id: newTicket.id,
            status: 'Bloqueado',
            codigo_ticket: idControlAutomatico,
            emisor_nombre: form.solicitante || `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim()
          })
          .in('id', idsRelacionados);
      }

      toast.success("Ticket EMITIDO Y FINALIZADO con éxito.");
      setShowModal(false);
      if (onSuccess) onSuccess(newTicket.id, idsRelacionados, idControlAutomatico);
      cargarHistorial();
      // Reset form
      setForm({
        ...form,
        partidas: [{
          id: Date.now(),
          cc: '',
          clasificacion: '',
          categoria: '',
          cantidad: 1,
          unidad: 'UNID',
          descripcion: '',
          beneficiario: '',
          pu: '',
          total: 0,
          pago_realizado: false
        }],
        facturas_url: [],
        status: 'EMITIDO',
        con_iva: true
      });
    } catch (err) {
      toast.error("Error al emitir ticket: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const actualizarTicket = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('tickets_directos')
        .update({
          items: form.partidas.map((p, idx) => ({
            ...p,
            // Persistencia de justificación detallada
            ...(idx === 0 ? { justificacion_detallada: form.justificacion_detallada } : {})
          })),
          total_usd: totalGeneral,
          factura_url: form.facturas_url || [],
          status: form.status,
          clasificacion_admin: form.clasificacion_admin,
          justificacion: form.justificacion || form.justificacion_detallada || null,
          con_iva: form.con_iva !== false
        })
        .eq('id', form.id);

      if (error) throw error;

      // SI EL TICKET SE MARCÓ COMO PAGADO, ACTUALIZAR PARTIDAS FONDOS
      if (form.status === 'PAGADO') {
        const idsOriginales = form.partidas.map(p => p.id).filter(id => typeof id === 'number' || (typeof id === 'string' && id.length > 10));
        if (idsOriginales.length > 0) {
          await supabase
            .from('partidas_fondos')
            .update({ pago_realizado: true })
            .in('id', idsOriginales);
        }
      }

      toast.success("Ticket ACTUALIZADO Y FINALIZADO con éxito.");
      cargarHistorial();
    } catch (err) {
      toast.error("Error al actualizar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const anularTicket = async (t) => {
    const esAutorizado = currentUser?.esSuperAdmin === true ||
      currentUser?.esAdminReal === true ||
      ['jcontreras.totalclean@gmail.com', 'karincmm1@gmail.com', 'cvega@totalclean.com', 'cvega.totalclean@gmail.com'].includes(currentUser?.correo?.toLowerCase());

    if (!esAutorizado) {
      toast.error("Solo el SuperAdministrador tiene permisos para anular tickets.");
      return;
    }

    toast((toastId) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '500' }}>¿Estás seguro de que deseas ANULAR el ticket {t.codigo_control}? Esto liberará los renglones asociados en Fondos.</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => { toast.dismiss(toastId.id); ejecutarAnulacionTicket(t); }}
            style={{ padding: '4px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            SÍ, ANULAR
          </button>
          <button onClick={() => toast.dismiss(toastId.id)} style={{ padding: '4px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>CANCELAR</button>
        </div>
      </div>
    ), { duration: 6000, position: 'top-center' });
  };

  const ejecutarAnulacionTicket = async (t) => {
    setLoading(true);
    try {
      // 1. Marcar ticket como ANULADO
      const { error: errorT } = await supabase
        .from('tickets_directos')
        .update({ status: 'ANULADO' })
        .eq('id', t.id);
      if (errorT) throw errorT;

      // 2. Liberar renglones vinculados
      const { error: errorF } = await supabase
        .from('partidas_fondos')
        .update({
          ticket_id: null,
          status: 'Disponible',
          codigo_ticket: null,
          pago_realizado: false
        })
        .eq('ticket_id', t.id);
      if (errorF) throw errorF;

      toast.success("Ticket ANULADO y renglones liberados.");
      cargarHistorial();
    } catch (err) {
      toast.error("Error al anular: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerDetalle = (t) => {
    setIsEditing(true); // Usamos isEditing para modo "Ver/Solo Lectura"
    setForm({
      id: t.id,
      fecha: t.fecha_emision,
      gerente: t.gerente_nombre,
      solicitante: t.gerente_nombre, // Compatibilidad con tickets viejos
      departamento: t.departamento,
      usuario_id: t.usuario_id,
      partidas: t.items || [],
      facturas_url: Array.isArray(t.factura_url) ? t.factura_url : (t.factura_url ? [t.factura_url] : []),
      status: t.status,
      id_control: t.codigo_control,
      solicitud_ref: t.solicitud_ref || '',
      clasificacion_admin: t.clasificacion_admin || '',
      justificacion: t.justificacion || '',
      justificacion_detallada: t.items?.[0]?.justificacion_detallada || '',
      centro_costo: t.centro_costo || t.items?.[0]?.cc || '',
      con_iva: t.con_iva !== false
    });
    setShowModal(true);
  };

  // --- FILTRADO HISTORIAL ---
  const historialFiltrado = useMemo(() => {
    let result = historial;

    if (busqueda.trim()) {
      const b = busqueda.toLowerCase();
      result = result.filter(t =>
        t.codigo_control?.toLowerCase().includes(b) ||
        t.gerente_nombre?.toLowerCase().includes(b) ||
        t.departamento?.toLowerCase().includes(b) ||
        t.solicitud_ref?.toLowerCase().includes(b)
      );
    }

    if (filtroStatus !== 'Todos') {
      result = result.filter(t => t.status === filtroStatus);
    }

    if (filtroGerencia !== 'Todos') {
      result = result.filter(t => t.departamento === filtroGerencia);
    }

    return result;
  }, [historial, busqueda, filtroStatus, filtroGerencia]);

  return (
    <div className="te-container animate-fade-in" style={datosPredefinidos ? { background: 'transparent', padding: 0, boxShadow: 'none', border: 'none' } : {}}>

      {!datosPredefinidos ? (
        <div className="te-content">
          {/* HEADER SECTION */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <div>
              <h1 className="te-title">Ticket de Pago</h1>
              <p className="te-subtitle">Emisión de pagos directos sin aprobación - SmartTC</p>
            </div>
            <button
              className="te-btn te-btn-primary"
              onClick={() => {
                setIsEditing(false);
                setForm({
                  id: '',
                  fecha: new Date().toISOString().split('T')[0],
                  gerente: currentUser?.nombre || '',
                  departamento: currentUser?.departamento || '',
                  usuario_id: currentUser?.id || '',
                  partidas: [{
                    id: Date.now(),
                    cc: '',
                    clasificacion: '',
                    categoria: '',
                    cantidad: 1,
                    cantidad_pedida: 1,
                    cantidad_comprada: 0,
                    cantidad_pendiente: 1,
                    unidad: 'UNID',
                    descripcion: '',
                    beneficiario: '',
                    pu: '',
                    total: 0,
                    pago_realizado: false
                  }],
                  facturas_url: [],
                  status: 'EMITIDO',
                  id_control: '',
                  solicitud_ref: '',
                  con_iva: true
                });
                setShowModal(true);
              }}
              style={{ padding: '12px 25px' }}
            >
              <Plus size={16} /> Nuevo Ticket
            </button>
          </div>

          {/* STATS CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
            <div className="te-card te-card-premium">
              <div className="te-label">Total de Tickets</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '8px' }}>{historial.length}</div>
            </div>
            <div className="te-card" style={{ borderLeft: '6px solid #10b981' }}>
              <div className="te-label">Tickets Pagados</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '8px', color: '#10b981' }}>
                {historial.filter(t => t.status === 'PAGADO').length}
              </div>
            </div>
            <div className="te-card" style={{ borderLeft: '6px solid #f59e0b' }}>
              <div className="te-label">Pendientes por Procesar</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '8px', color: '#f59e0b' }}>
                {historial.filter(t => t.status === 'EMITIDO').length}
              </div>
            </div>
            <div className="te-card" style={{ borderLeft: '6px solid #6366f1' }}>
              <div className="te-label">Monto Total ($)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '8px', color: '#6366f1' }}>
                $ {historial.reduce((acc, t) => acc + (t.total_usd || 0), 0).toLocaleString('de-DE')}
              </div>
            </div>
          </div>

          {/* FILTERS BAR */}
          <div className="te-card" style={{ padding: '16px', display: 'flex', gap: '15px', alignItems: 'center' }}>
            <div style={{ flex: 1.5, position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                className="te-input"
                placeholder="Buscar por ID, Gerente o REF..."
                style={{ width: '100%', paddingLeft: '40px' }}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            <select
              className="te-input"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              style={{ flex: 0.8 }}
            >
              <option value="Todos">Todos los Status</option>
              <option value="EMITIDO">EMITIDO</option>
              <option value="PAGADO">PAGADO</option>
              <option value="ANULADO">ANULADO</option>
            </select>

            <select
              className="te-input"
              value={filtroGerencia}
              onChange={(e) => setFiltroGerencia(e.target.value)}
              style={{ flex: 1 }}
            >
              <option value="Todos">Todas las Gerencias</option>
              {[...new Set(historial.map(t => t.departamento))].filter(Boolean).sort().map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            {currentUser?.esAdminGlobal && (
              <button
                className={`te-btn ${verTodos ? 'te-btn-primary' : 'te-btn-outline'}`}
                onClick={() => setVerTodos(!verTodos)}
                style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
              >
                <Filter size={14} /> {verTodos ? 'Global' : 'Mi Gerencia'}
              </button>
            )}
          </div>

          {/* HISTORY TABLE */}
          <div className="te-table-wrapper">
            <table className="te-table">
              <thead className="te-thead">
                <tr>
                  <th className="te-th" style={{ width: '150px' }}>ID</th>
                  <th className="te-th">FECHA</th>
                  <th className="te-th">GERENTE</th>
                  <th className="te-th">DEPARTAMENTO</th>
                  <th className="te-th">TOTAL ($)</th>
                  <th className="te-th" style={{ textAlign: 'center', width: '140px' }}>STATUS</th>
                  <th className="te-th" style={{ textAlign: 'center' }}>SOPORTE</th>
                  <th className="te-th" style={{ textAlign: 'center' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody className="te-tbody">
                {loading ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="animate-spin" size={24} /> Cargando...</td></tr>
                ) : historialFiltrado?.map(t => (
                  <tr key={t.id}>
                    <td className="te-td" style={{ fontWeight: '700', color: '#d97706' }}>{t.codigo_control || `TX-${String(t.id).padStart(4, '0')}`}</td>
                    <td className="te-td">
                      {(() => {
                        if (!t.fecha_emision) return 'N/A';
                        try {
                          const d = new Date(t.fecha_emision + 'T12:00:00');
                          return format(d, 'dd/MM/yyyy');
                        } catch (e) {
                          return t.fecha_emision || 'Error';
                        }
                      })()}
                    </td>
                    <td className="te-td">{t.gerente_nombre}</td>
                    <td className="te-td">{t.departamento}</td>
                    <td className="te-td" style={{ fontWeight: 'bold' }}>$ {t.total_usd?.toLocaleString('de-DE')}</td>
                    <td className="te-td" style={{ textAlign: 'center' }}>
                      <span style={{
                        color: t.status === 'PAGADO' ? '#16a34a' : '#ca8a04',
                        fontSize: '0.7rem',
                        fontWeight: '900',
                        textTransform: 'uppercase'
                      }}>{t.status}</span>
                    </td>
                    <td className="te-td" style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                        {(() => {
                          const list = parsearFacturaUrls(t.factura_url);
                          return list.map((item, idx) => (
                            <a key={idx} href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: '#d97706' }} title={item.name}>
                              <FileImage size={18} />
                            </a>
                          ));
                        })()}
                      </div>
                    </td>
                    <td className="te-td" style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                        <button className="te-btn te-btn-outline" style={{ padding: '6px' }} onClick={() => handleVerDetalle(t)} title="Ver Detalle">
                          <Eye size={16} color="#d97706" />
                        </button>
                        {t.status !== 'ANULADO' && (
                          <button className="te-btn te-btn-outline" style={{ padding: '6px' }} onClick={() => anularTicket(t)} title="Anular Ticket">
                            <Trash2 size={16} color="#ef4444" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <TicketErrorBoundary>
          {/* MODAL VERSION (95vh Fixed Layout) */}
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10000,
            padding: '20px'
          }}>
            <div style={{
              width: '95vw',
              maxWidth: '1600px',
              height: '95vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              padding: 0,
              borderRadius: '28px',
              backgroundColor: 'rgba(255, 255, 255, 0.75)',
              backdropFilter: 'blur(30px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.45)',
              boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.35)'
            }}>
              {/* --- CABECERA FIJA --- */}
              <div style={{
                flexShrink: 0,
                background: 'rgba(235, 245, 255, 0.95)',
                backdropFilter: 'blur(12px)',
                padding: '20px 40px',
                borderBottom: '1px solid rgba(0,0,0,0.05)',
                position: 'relative'
              }}>
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    position: 'absolute',
                    top: '15px',
                    right: '15px',
                    border: 'none',
                    background: 'rgba(255,255,255,0.8)',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748b',
                    transition: 'all 0.2s',
                    zIndex: 100
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#0f172a'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.8)'; e.currentTarget.style.color = '#64748b'; }}
                >
                  <X size={18} />
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {/* IZQUIERDA: TÍTULO Y REF */}
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
                        TICKET DE PAGO
                      </h1>
                    </div>
                    {form.solicitud_ref && (
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
                        <Diamond size={12} /> REF: {form.solicitud_ref}
                      </div>
                    )}
                  </div>

                  {/* DERECHA: ID TICKET */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginRight: '40px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: '1.8rem',
                        fontWeight: '1000',
                        color: '#1e3a8a',
                        lineHeight: '1',
                        letterSpacing: '0.05em'
                      }}>
                        {idControlAutomatico}
                      </div>
                      <div style={{
                        fontSize: '0.6rem',
                        fontWeight: '900',
                        color: '#64748b',
                        marginTop: '3px',
                        letterSpacing: '0.1em',
                        opacity: 0.8
                      }}>
                        ID TICKET
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* --- CUERPO DESPLAZABLE --- */}
              <div style={{ flexGrow: 1, overflowY: 'auto', padding: '30px', backgroundColor: 'rgba(241, 245, 249, 0.4)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 160px) 1.5fr 1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                  <div>
                    <label className="te-label" style={{ color: '#1e293b', fontSize: '10px', fontWeight: '800', display: 'block', marginBottom: '5px' }}>FECHA EMISIÓN <span style={{ color: '#ef4444' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                      <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        className="te-input"
                        type="date"
                        value={form.fecha}
                        onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                        disabled={isEditing}
                        style={{ width: '100%', paddingLeft: '38px', height: '42px', boxSizing: 'border-box', backgroundColor: '#f8fafc' }}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="te-label" style={{ color: '#1e293b', fontSize: '10px', fontWeight: '800', display: 'block', marginBottom: '5px' }}>SOLICITANTE</label>
                    <div className="te-input" style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#f8fafc', height: '42px', boxSizing: 'border-box', border: '1px solid #cbd5e1' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        backgroundColor: '#0ea5e9', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.7rem', fontWeight: 'bold'
                      }}>
                        {form.solicitante ? form.solicitante.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'TC'}
                      </div>
                      <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#1e293b' }}>
                        {form.solicitante}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="te-label" style={{ color: '#1e293b', fontSize: '10px', fontWeight: '800', display: 'block', marginBottom: '5px' }}>CENTRO DE COSTOS</label>
                    <div className="te-input" style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: '#f8fafc',
                      height: '42px',
                      boxSizing: 'border-box',
                      border: '1px solid #cbd5e1'
                    }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#1e293b' }}>
                        {form.centro_costo || 'Sin asignar'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="te-label" style={{ color: '#1e293b', fontSize: '10px', fontWeight: '800', display: 'block', marginBottom: '5px' }}>GERENCIA</label>
                    <div className="te-input" style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: '#f8fafc',
                      height: '42px',
                      boxSizing: 'border-box',
                      border: '1px solid #cbd5e1'
                    }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#1e293b' }}>
                        {form.departamento || 'Sin asignar'}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'white', padding: '25px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                  <div style={{ marginBottom: '15px' }}>
                    <label className="stat-label" style={{
                      color: '#1e293b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'linear-gradient(90deg, #f1f5f9 0%, transparent 100%)',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      borderLeft: '4px solid #0ea5e9',
                      width: 'fit-content',
                      marginBottom: '10px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      fontSize: '11px',
                      fontWeight: '800',
                      textTransform: 'uppercase'
                    }}>
                      <FileText size={16} color="#0ea5e9" />
                      DESCRIPCIÓN DE LA SOLICITUD <span style={{ color: '#ef4444', fontWeight: 'bold' }}>*</span>
                    </label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        className="te-input"
                        type="text"
                        value={form.justificacion_detallada}
                        onChange={(e) => setForm({ ...form, justificacion_detallada: e.target.value })}
                        placeholder="Explique el motivo de la requisición (Obligatorio)"
                        required
                        disabled={isEditing}
                        style={{
                          flex: 1,
                          border: '1px solid',
                          borderColor: !form.justificacion_detallada ? 'rgba(14, 165, 233, 0.4)' : '#cbd5e1',
                          boxShadow: !form.justificacion_detallada ? '0 0 0 2px rgba(14, 165, 233, 0.1)' : 'none',
                          transition: 'all 0.3s ease',
                          height: '42px',
                          borderRadius: '12px',
                          backgroundColor: '#f8fafc',
                          padding: '0 12px',
                          boxSizing: 'border-box'
                        }}
                      />
                      <button
                        onClick={() => setVerJustificacion(!verJustificacion)}
                        style={{
                          width: '42px', height: '42px', borderRadius: '12px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', transition: 'all 0.2s',
                          backgroundColor: verJustificacion ? '#8b5cf6' : 'white',
                          color: verJustificacion ? 'white' : '#64748b',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                          border: '1px solid #cbd5e1'
                        }}
                        title="Ver Observaciones"
                      >
                        <MessageSquare size={20} />
                      </button>
                    </div>
                  </div>

                  {verJustificacion && (
                    <div style={{ padding: '15px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #cbd5e1', marginTop: '10px', marginBottom: '20px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '900', color: '#0f172a', marginBottom: '8px', display: 'block' }}>OBSERVACIONES Y NOTAS</label>
                      <textarea
                        className="te-input"
                        value={form.justificacion}
                        onChange={(e) => setForm({ ...form, justificacion: e.target.value })}
                        placeholder="Observaciones o notas adicionales..."
                        style={{ width: '100%', minHeight: '60px', borderRadius: '12px', backgroundColor: 'white', border: '1px solid #cbd5e1', boxSizing: 'border-box', padding: '10px 12px' }}
                        disabled={isEditing}
                      />
                    </div>
                  )}

                  <div className="te-table-wrapper" style={{ border: '1px solid #cbd5e1' }}>
                    <table className="te-table">
                      <thead className="te-thead">
                        <tr>
                          <th className="te-th" style={{ width: '50px' }}>#</th>
                          <th className="te-th">CLASIFICACIÓN</th>
                          <th className="te-th">CATEGORÍA</th>
                          <th className="te-th" style={{ textAlign: 'center', width: '80px' }}>CANT.</th>
                          <th className="te-th" style={{ textAlign: 'center', width: '90px' }}>UNI.</th>
                          <th className="te-th">DESCRIPCIÓN</th>
                          <th className="te-th">BENEFICIARIO</th>
                          <th className="te-th" style={{ textAlign: 'right', width: '100px' }}>P.U.</th>
                          <th className="te-th" style={{ textAlign: 'right', width: '120px' }}>TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="te-tbody">
                        {form.partidas.map((p, i) => (
                          <tr key={p.id}>
                            <td className="te-td" style={{ fontSize: '11px', textAlign: 'center', fontWeight: 'bold', color: '#64748b', padding: '12px 8px' }}>{i + 1}</td>
                            <td className="te-td" style={{ padding: '12px 8px', fontSize: '11px', color: '#1e293b' }}>{p.clasificacion}</td>
                            <td className="te-td" style={{ padding: '12px 8px', fontSize: '11px', color: '#1e293b' }}>{p.categoria}</td>
                            <td className="te-td" style={{ padding: '12px 8px', textAlign: 'center', fontSize: '11px', color: '#1e293b' }}>{p.cantidad}</td>
                            <td className="te-td" style={{ padding: '12px 8px', textAlign: 'center', fontSize: '11px', color: '#1e293b' }}>{p.unidad}</td>
                            <td className="te-td" style={{ padding: '12px 8px', fontSize: '11px', color: '#1e293b' }}>{p.descripcion}</td>
                            <td className="te-td" style={{ padding: '8px 4px' }}>
                              <input
                                className="te-input"
                                value={p.beneficiario || ''}
                                onChange={(e) => manejarCambioPartida(i, 'beneficiario', e.target.value)}
                                disabled={isEditing}
                                placeholder="Beneficiario"
                                style={{
                                  width: '100%',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '8px',
                                  padding: '6px 10px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  backgroundColor: 'white',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </td>
                            <td className="te-td" style={{ padding: '12px 8px', textAlign: 'right', fontSize: '11px', color: '#1e293b' }}>$ {p.pu?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                            <td className="te-td" style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '11px', paddingRight: '10px', color: '#1e293b' }}>
                              $ {p.total.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* SECCIÓN DE SOPORTES Y TOTALES */}
                  <div style={{ display: 'flex', gap: '20px', marginTop: '20px', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    {/* IZQUIERDA: SOPORTES COMPACTOS */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                        <button
                          onClick={() => setMostrarSoportes(!mostrarSoportes)}
                          style={{
                            padding: '6px 14px', borderRadius: '8px',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            cursor: 'pointer', transition: 'all 0.2s',
                            backgroundColor: mostrarSoportes ? '#10b981' : '#f8fafc',
                            color: mostrarSoportes ? 'white' : '#64748b',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.7rem',
                            fontWeight: '900'
                          }}
                        >
                          <Camera size={14} /> {mostrarSoportes ? 'OCULTAR SOPORTES' : 'VER SOPORTES'}
                        </button>

                        {mostrarSoportes && (
                          <label
                            style={{
                              padding: '6px 14px', borderRadius: '8px',
                              display: 'flex', alignItems: 'center', gap: '8px',
                              cursor: loading ? 'not-allowed' : 'pointer',
                              backgroundColor: '#0ea5e9',
                              color: 'white',
                              border: 'none',
                              fontSize: '0.7rem',
                              fontWeight: '900',
                              boxShadow: '0 2px 4px rgba(14, 165, 233, 0.2)'
                            }}
                          >
                            {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            {loading ? 'SUBIENDO...' : 'AÑADIR'}
                            <input type="file" style={{ display: 'none' }} onChange={manejarSubidaSoporte} disabled={loading} accept="image/*,application/pdf" />
                          </label>
                        )}
                      </div>

                      {mostrarSoportes && (
                        <div
                          style={{
                            padding: '15px',
                            backgroundColor: '#f8fafc',
                            borderRadius: '12px',
                            border: '1px dashed #cbd5e1',
                            minHeight: '80px',
                            boxSizing: 'border-box'
                          }}
                        >
                          {parsearFacturaUrls(form.facturas_url).length === 0 ? (
                            <div style={{ color: '#94a3b8', fontSize: '0.75rem', padding: '10px' }}>
                              No hay soportes adjuntos. Haz clic en AÑADIR para subir.
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                              {parsearFacturaUrls(form.facturas_url).map((item, idx) => {
                                if (!item || !item.url) return null;
                                const isImg = /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(item.url.split('?')[0]);
                                return (
                                  <div key={idx} style={{ position: 'relative', width: '60px', height: '60px' }}>
                                    <a href={item.url} target="_blank" rel="noreferrer" style={{
                                      display: 'block', width: '100%', height: '100%',
                                      borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1',
                                      backgroundColor: 'white'
                                    }} title={item.name}>
                                      {isImg ? (
                                        <img src={item.url} alt={item.name || `Soporte ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fef2f2', color: '#ef4444' }}>
                                          <FileText size={18} />
                                        </div>
                                      )}
                                    </a>
                                    <button
                                      onClick={() => eliminarSoporte(idx)}
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
                      )}
                    </div>

                    {/* DERECHA: TOTALES */}
                    <div className="totals-container" style={{ width: '100%', maxWidth: '350px', minWidth: '350px', marginTop: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#64748b' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold' }}>SUB-TOTAL ESTIMADO:</span>
                        <span style={{ fontSize: '12px', fontWeight: 'bold' }}>$ {subtotalTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #e2e8f0', paddingTop: '10px', color: '#1e3a8a' }}>
                        <span style={{ fontWeight: '900', fontSize: '1rem' }}>TOTAL ESTIMADO {form.con_iva !== false ? "(C/IVA)" : "(S/IVA)"}:</span>
                        <span style={{ fontSize: '1.2rem', fontWeight: '900' }}>$ {totalGeneral.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* --- PIE DE PÁGINA FIJO --- */}
              <div style={{ flexShrink: 0, padding: '20px 35px', borderTop: '1px solid rgba(226, 232, 240, 0.5)', backgroundColor: 'rgba(255, 255, 255, 0.3)', display: 'flex', justifyContent: 'flex-end', gap: '15px', alignItems: 'center' }}>
                {!isEditing ? (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 'bold', color: '#475569', cursor: 'pointer', userSelect: 'none', marginRight: '6px' }}>
                    <input
                      type="checkbox"
                      checked={form.con_iva !== false}
                      onChange={(e) => setForm({ ...form, con_iva: e.target.checked })}
                      style={{ width: '15px', height: '15px', accentColor: '#0ea5e9', cursor: 'pointer' }}
                    />
                    ¿Con IVA (16%)?
                  </label>
                ) : (
                  <span style={{ fontSize: '0.7rem', fontWeight: '800', color: (form.con_iva !== false) ? '#16a34a' : '#ef4444', backgroundColor: (form.con_iva !== false) ? '#f0fdf4' : '#fef2f2', padding: '3px 8px', borderRadius: '6px', marginRight: '6px' }}>
                    {(form.con_iva !== false) ? 'CON IVA (16%)' : 'SIN IVA'}
                  </span>
                )}
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '10px 25px',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    background: 'white',
                    fontWeight: 'bold',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    color: '#1e293b',
                    fontSize: '0.85rem'
                  }}
                >
                  <ArrowLeft size={16} /> VOLVER
                </button>
                <button
                  onClick={emitirTicket}
                  disabled={loading}
                  style={{
                    padding: '10px 35px',
                    borderRadius: '12px',
                    border: 'none',
                    background: '#2563eb',
                    color: 'white',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                    fontSize: '0.85rem'
                  }}
                >
                  {loading ? 'PROCESANDO...' : (isEditing ? 'ACTUALIZAR TICKET' : 'EMITIR Y FINALIZAR TICKET')}
                </button>
              </div>
            </div>
          </div>
        </TicketErrorBoundary>
      )}
    </div>
  );
};

const TicketExpressWithBoundary = (props) => (
  <TicketErrorBoundary>
    <TicketExpress {...props} />
  </TicketErrorBoundary>
);

export default TicketExpressWithBoundary;
