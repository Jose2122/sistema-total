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
  Calendar
} from 'lucide-react';
import { format, getWeek } from 'date-fns';
import toast from 'react-hot-toast';
import './TicketExpress.css';

const TicketExpress = ({ isOpen = false, onClose = null, datosPredefinidos = null }) => {
  // --- ESTADOS DE CONTROL ---
  const [showModal, setShowModal] = useState(isOpen);
  const [loading, setLoading] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [verTodos, setVerTodos] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // --- LÓGICA DE SIGLAS GERENCIA ---
  const obtenerSiglas = (nombreGerencia) => {
    if (!nombreGerencia) return '---';
    const mapeo = {
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
    return mapeo[nombreGerencia] || "GER";
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
        if (partesRR.length === 4) {
          const numRR = partesRR[3];
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
        if (partes.length === 4) {
          const num = parseInt(partes[3], 10);
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
        setForm(prev => ({
          ...prev,
          fecha: datosPredefinidos.fecha || prev.fecha,
          departamento: datosPredefinidos.gerencia || prev.departamento,
          solicitante: datosPredefinidos.solicitante || prev.solicitante,
          solicitud_ref: datosPredefinidos.solicitud_ref || '',
          partidas: (datosPredefinidos.partidasSeleccionadas && Array.isArray(datosPredefinidos.partidasSeleccionadas))
            ? datosPredefinidos.partidasSeleccionadas.map(p => {
                const cant = (p.cantidad !== undefined) ? Number(p.cantidad) : (p.cant !== undefined ? Number(p.cant) : 1);
                return {
                  id: p.id || Date.now() + Math.random(),
                  cc: p.cc || '',
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
                  total: (Number(p.puUsd || p.puBs || p.pu || 0)) * cant,
                  pago_realizado: false
                };
              }) 
            : prev.partidas
        }));
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
      let query = supabase.from('tickets_directos').select('id, gerente_nombre, departamento, fecha_emision, codigo_control, total_usd, status, factura_url, items, solicitud_ref, usuario_id');

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

  const eliminarRenglón = (id) => {
    if (form.partidas.length > 1) {
      setForm({ ...form, partidas: form.partidas.filter(p => p.id !== id) });
    }
  };

  // --- ADJUNTAR SOPORTE ---
  const manejarSubidaSoporte = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

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

  // --- CALCULAR TOTALES ---
  const subtotalTotal = useMemo(() => {
    return form.partidas.reduce((acc, p) => acc + (parseFloat(p.total) || 0), 0);
  }, [form.partidas]);

  const totalGeneral = subtotalTotal * 1.16;

  // --- EMITIR TICKET ---
  const emitirTicket = async () => {
    if (!form.partidas.every(p => p.cc && p.clasificacion && p.descripcion)) {
      return toast.error("Por favor complete los campos obligatorios de las partidas.");
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
        items: form.partidas.map(p => ({
          ...p,
          pago_realizado: p.pago_realizado || false
        })),
        factura_url: form.facturas_url || [],
        status: form.status || 'EMITIDO',
        solicitud_ref: form.solicitud_ref || null,
        clasificacion_admin: form.clasificacion_admin || null
      };

      const { data: newTicket, error } = await supabase.from('tickets_directos').insert([payload]).select().single();
      if (error) throw error;

      // ACTUALIZAR PARTIDAS FONDOS SI EXISTEN
      const idsRelacionados = form.partidas.map(p => p.id).filter(id => typeof id === 'number' || (typeof id === 'string' && id.length > 10)); // Los IDs de Supabase son largos
      if (idsRelacionados.length > 0) {
        await supabase
          .from('partidas_fondos')
          .update({ 
            ticket_id: newTicket.id,
            status: 'Bloqueado',
            codigo_ticket: idControlAutomatico
          })
          .in('id', idsRelacionados);
      }

      toast.success("Ticket EMITIDO con éxito.");
      setShowModal(false);
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
        status: 'EMITIDO'
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
          items: form.partidas,
          total_usd: totalGeneral,
          factura_url: form.facturas_url || [],
          status: form.status,
          clasificacion_admin: form.clasificacion_admin
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

      toast.success("Cambios guardados con éxito.");
      cargarHistorial();
    } catch (err) {
      toast.error("Error al actualizar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const anularTicket = async (t) => {
    if (currentUser?.correo?.toLowerCase() !== 'jcontreras.totalclean@gmail.com') {
      toast.error("Solo el SuperAdministrador (José) tiene permisos para anular tickets.");
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
      clasificacion_admin: t.clasificacion_admin || ''
    });
    setShowModal(true);
  };

  // --- FILTRADO HISTORIAL ---
  const historialFiltrado = useMemo(() => {
    if (!busqueda.trim()) return historial;
    const b = busqueda.toLowerCase();
    return historial.filter(t =>
      t.codigo_control?.toLowerCase().includes(b) ||
      t.gerente_nombre?.toLowerCase().includes(b) ||
      t.departamento?.toLowerCase().includes(b) ||
      t.solicitud_ref?.toLowerCase().includes(b)
    );
  }, [historial, busqueda]);

  return (
    <div className="te-container animate-fade-in">

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
              solicitud_ref: ''
            });
            setShowModal(true);
          }}
          style={{ padding: '12px 25px' }}
        >
          <Plus size={16} /> Nuevo Ticket
        </button>
      </div>

      {/* STATS CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="te-card te-card-premium">
          <div className="te-label">Mis Tickets Emitidos</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', marginTop: '8px' }}>{historial.length}</div>
        </div>
        <div className="te-card" style={{ borderLeft: '6px solid #10b981' }}>
          <div className="te-label">Total en Tickets ($)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', marginTop: '8px', color: '#10b981' }}>
            $ {historial.reduce((acc, t) => acc + (t.total_usd || 0), 0).toLocaleString('de-DE')}
          </div>
        </div>
        <div className="te-card" style={{ borderLeft: '6px solid #6366f1' }}>
          <div className="te-label">Usuario Activo</div>
          <div style={{ fontSize: '1rem', fontWeight: '700', marginTop: '8px' }}>{currentUser?.nombre}</div>
          <div className="te-badge te-badge-warn" style={{ marginTop: '8px', display: 'inline-block' }}>{currentUser?.rol}</div>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="te-card" style={{ padding: '16px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            className="te-input"
            placeholder="Buscar por gerente o departamento..."
            style={{ width: '100%', paddingLeft: '40px' }}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        {currentUser?.esAdminGlobal && (
          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className={`te-btn ${verTodos ? 'te-btn-primary' : 'te-btn-outline'}`}
              onClick={() => setVerTodos(!verTodos)}
              style={{ fontSize: '0.75rem' }}
            >
              <Filter size={14} /> {verTodos ? 'Viendo Todos los Tickets' : 'Ver Todos los Tickets (Admin)'}
            </button>
          </div>
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
                      const list = Array.isArray(t.factura_url) ? t.factura_url : (t.factura_url ? [t.factura_url] : []);
                      return list.map((url, idx) => (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#d97706' }}>
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

      {/* MODAL EMISIÓN TICKET */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="te-card animate-fade-in" style={{ width: '95%', maxWidth: '1400px', maxHeight: '90vh', overflowY: 'auto', background: 'white' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <h2 className="te-title">{isEditing ? 'Detalle de Ticket' : 'Nuevos Tickets de Pago'}</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ background: '#0f172a', color: 'white', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', display: 'inline-block', marginTop: '8px', fontWeight: 'bold' }}>ID: {isEditing ? form.id_control : idControlAutomatico}</div>
                  {form.solicitud_ref && (
                    <div style={{ background: '#f59e0b', color: 'white', padding: '4px 12px', borderRadius: '6px', fontSize: '11px', display: 'inline-block', marginTop: '8px', fontWeight: 'bold' }}>REF: {form.solicitud_ref}</div>
                  )}
                </div>
              </div>
              <button className="te-btn te-btn-outline" onClick={() => setShowModal(false)}><ArrowLeft size={16} /> Volver</button>
            </div>

            {/* HEADER FORM */}
            <div className="te-metadata-box" style={{ marginBottom: '24px' }}>
              <div className="te-header-grid">
                <div className="te-input-group">
                  <label className="te-label">Fecha Emisión</label>
                  <input className="te-input" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} disabled={isEditing && !esPrivilegiado} />
                </div>
                <div className="te-input-group">
                  <label className="te-label">Solicitante</label>
                  <input className="te-input" value={form.solicitante || form.gerente} readOnly />
                </div>
                <div className="te-input-group">
                  <label className="te-label">Departamento</label>
                  <input className="te-input" value={form.departamento} readOnly />
                </div>
                <div className="te-input-group">
                  <label className="te-label">Clasificación Admin</label>
                  <select 
                    className="te-input" 
                    value={form.clasificacion_admin}
                    onChange={(e) => setForm({...form, clasificacion_admin: e.target.value})}
                    disabled={isEditing && !esPrivilegiado}
                  >
                    <option value="">Seleccione...</option>
                    <option value="Semanal">Semanal</option>
                    <option value="Mensual">Mensual</option>
                    <option value="Nomina">Nomina</option>
                    <option value="TEA">TEA</option>
                    <option value="Reembolsos Pólizas">Reembolsos Pólizas</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ITEMS TABLE */}
            <div className="te-table-wrapper" style={{ marginBottom: '24px' }}>
              <table className="te-table">
                <thead className="te-thead">
                  <tr>
                    <th className="te-th">N°</th>
                    <th className="te-th" style={{ width: '200px' }}>C. COSTO</th>
                    <th className="te-th" style={{ width: '200px' }}>CLASIFICACIÓN</th>
                    <th className="te-th" style={{ width: '200px' }}>CATEGORÍA</th>
                    <th className="te-th" style={{ width: '80px' }}>CANT</th>
                    <th className="te-th" style={{ width: '100px' }}>UNID</th>
                    <th className="te-th">DESCRIPCIÓN</th>
                    <th className="te-th" style={{ width: '150px' }}>BENEFICIARIO</th>
                    <th className="te-th" style={{ width: '100px' }}>P.U ($)</th>
                    <th className="te-th" style={{ width: '100px' }}>TOTAL ($)</th>
                    <th className="te-th"></th>
                  </tr>
                </thead>
                <tbody className="te-tbody">
                  {form?.partidas?.map((p, i) => (
                    <tr key={p.id}>
                      <td className="te-td" style={{ fontWeight: '800', color: '#94a3b8', textAlign: 'center' }}>{i + 1}</td>
                      <td className="te-td">
                        <select className="te-cell-input" style={{ fontWeight: '700' }} value={p.cc} onChange={(e) => manejarCambioPartida(i, 'cc', e.target.value)} disabled={isEditing || !!form.solicitud_ref}>
                          <option value="">C.C...</option>
                          {centrosCosto.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                        </select>
                      </td>
                      <td className="te-td">
                        <select className="te-cell-input" value={p.clasificacion} onChange={(e) => manejarCambioPartida(i, 'clasificacion', e.target.value)} disabled={!p.cc || isEditing || !!form.solicitud_ref}>
                          <option value="">Clasificación...</option>
                          {(() => {
                            const ccObj = centrosCosto.find(c => c.nombre === p.cc);
                            return todasClasificaciones
                              .filter(cl => cl.padreId === ccObj?.id)
                              .map(op => <option key={op.id} value={op.nombre}>{op.nombre}</option>);
                          })()}
                        </select>
                      </td>
                      <td className="te-td">
                        <select className="te-cell-input" value={p.categoria} onChange={(e) => manejarCambioPartida(i, 'categoria', e.target.value)} disabled={!p.clasificacion || isEditing || !!form.solicitud_ref}>
                          <option value="">Categoría...</option>
                          {(() => {
                            const ccObj = centrosCosto.find(c => c.nombre === p.cc);
                            const clObj = todasClasificaciones.find(cl => cl.nombre === p.clasificacion && cl.padreId === ccObj?.id);
                            return todasCategorias
                              .filter(ct => ct.padreId === clObj?.id)
                              .map(op => <option key={op.id} value={op.nombre}>{op.nombre}</option>);
                          })()}
                        </select>
                      </td>
                      <td className="te-td"><input className="te-cell-input" type="number" value={p.cantidad} onChange={(e) => manejarCambioPartida(i, 'cantidad', e.target.value)} style={{ textAlign: 'center' }} disabled={isEditing || !!form.solicitud_ref} /></td>
                      <td className="te-td">
                        <select className="te-cell-input" value={p.unidad} onChange={(e) => manejarCambioPartida(i, 'unidad', e.target.value)} disabled={isEditing || !!form.solicitud_ref}>
                          {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="te-td"><input className="te-cell-input" value={p.descripcion} onChange={(e) => manejarCambioPartida(i, 'descripcion', e.target.value)} placeholder="¿En qué se gastará?" disabled={isEditing || !!form.solicitud_ref} /></td>
                      <td className="te-td"><input className="te-cell-input" value={p.beneficiario} onChange={(e) => manejarCambioPartida(i, 'beneficiario', e.target.value)} placeholder="Beneficiario" disabled={isEditing || !!form.solicitud_ref} /></td>
                      <td className="te-td"><input className="te-cell-input" type="number" value={p.pu} onChange={(e) => manejarCambioPartida(i, 'pu', e.target.value)} style={{ textAlign: 'right', fontWeight: 'bold', color: isEditing ? '#2563eb' : 'inherit' }} placeholder="0.00" /></td>
                      <td className="te-td" style={{ textAlign: 'right', fontWeight: '800', color: '#b45309' }}>$ {p.total.toLocaleString('de-DE')}</td>
                      <td className="te-td">
                      </td>
                      <td className="te-td">
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!isEditing && !form.solicitud_ref && (
                <div style={{ padding: '12px', background: '#f8fafc', borderTop: '1px solid #e2e880' }}>
                  <button className="te-btn te-btn-outline" onClick={añadirRenglón} style={{ fontSize: '0.75rem' }}><Plus size={14} /> Añadir otro renglón</button>
                </div>
              )}
            </div>

            {/* FOOTER ACTIONS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <label className="te-btn te-btn-outline" style={{ cursor: 'pointer' }}>
                  <Upload size={16} /> Añadir Soporte
                  <input type="file" hidden accept="image/*,application/pdf" onChange={manejarSubidaSoporte} capture="environment" />
                </label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {(form.facturas_url || []).map((url, idx) => {
                    const isImg = /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(url.split('?')[0]);
                    return (
                      <div key={idx} style={{ position: 'relative' }}>
                        <a href={url} target="_blank" rel="noopener noreferrer" style={{
                          display: 'block', width: '50px', height: '50px',
                          borderRadius: '8px', overflow: 'hidden', border: '2px solid #e2e8f0'
                        }}>
                          {isImg ? (
                            <img src={url} alt={`Soporte ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
                              <FileText size={20} color="#ef4444" />
                            </div>
                          )}
                        </a>
                        <button
                          onClick={() => setForm(prev => ({ ...prev, facturas_url: prev.facturas_url.filter((_, i) => i !== idx) }))}
                          style={{ position: 'absolute', top: '-8px', right: '-8px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: '30px' }}>
                <div className="totals-container" style={{ minWidth: '320px', background: '#f8fafc', padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '0.7rem', color: '#64748b' }}>SUB-TOTAL (BASE):</span>
                    <span style={{ fontWeight: '700', color: '#475569' }}>$ {subtotalTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span className="stat-label" style={{ fontSize: '0.7rem', color: '#64748b' }}>IVA (16%):</span>
                    <span style={{ fontWeight: '700', color: '#475569' }}>$ {(subtotalTotal * 0.16).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #cbd5e1', paddingTop: '12px' }}>
                    <span style={{ fontWeight: '900', fontSize: '0.9rem', color: '#0f172a' }}>TOTAL (CON IVA):</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: '900', color: '#d97706' }}>$ {totalGeneral.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {!isEditing ? (
                  <button className="te-btn te-btn-primary" style={{ padding: '16px 32px' }} onClick={emitirTicket} disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />} Emitir Ticket Directo
                  </button>
                ) : esPrivilegiado ? (
                  <button className="te-btn" style={{ padding: '16px 32px', background: '#0f172a', color: 'white' }} onClick={actualizarTicket} disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />} Guardar Cambios
                  </button>
                ) : (
                  <div style={{ padding: '10px 20px', backgroundColor: '#fffbeb', borderRadius: '12px', border: '1px solid #fef3c7', color: '#92400e', fontSize: '0.8rem', fontWeight: 'bold' }}>
                    ⚠️ Modo Lectura: No tiene permisos de edición sobre este ticket.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
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
