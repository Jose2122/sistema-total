import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  ChevronDown,
  Trash2,
  Upload,
  Save,
  FileText,
  DollarSign,
  Building2,
  Menu,
  Activity,
  History,
  Eye,
  RefreshCw,
  Search,
  AlertCircle,
  Image as ImageIcon,
  ArrowLeft,
  Calendar,
  User,
  Hash,
  CheckCircle2,
  CreditCard,
  Ticket,
  Clock,
  X,
  Landmark
} from 'lucide-react';
import './ModuloTicketsPago.css';

const obtenerNombreDeUrl = (url) => {
  if (!url) return 'Soporte';
  try {
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1].split('?')[0];
    const decoded = decodeURIComponent(lastPart);
    const cleanName = decoded.replace(/^\d+_/g, '');
    return cleanName || 'Soporte';
  } catch (e) {
    return 'Soporte';
  }
};

// Helper recursivo para des-serializar URLs de facturas mal formateadas, anidadas o serializadas múltiples veces en la BD
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
              name: obj.name || obtenerNombreDeUrl(obj.url)
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
        name: item.name || obtenerNombreDeUrl(item.url)
      };
    }
    return null;
  }).filter(item => item && typeof item.url === 'string' && item.url.trim().length > 10);
};


const ModuloTicketsPago = () => {
  const [vistaActual, setVistaActual] = useState('historial'); // 'historial' | 'nuevo' | 'detalle'
  const [ticketSeleccionado, setTicketSeleccionado] = useState(null);
  const [modoEdicion, setModoEdicion] = useState(false);

  // ==========================================
  // ESTADOS DEL HISTORIAL
  // ==========================================
  const [historialTickets, setHistorialTickets] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroBancos, setFiltroBancos] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [filtroGerencia, setFiltroGerencia] = useState('Todos');
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  const [filtroCC, setFiltroCC] = useState('Todos');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');

  // ==========================================
  // ESTADOS DEL FORMULARIO DE NUEVO TICKET
  // ==========================================
  const [currentUser, setCurrentUser] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [bancos, setBancos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [showConfirmacionPago, setShowConfirmacionPago] = useState(false);

  // ==========================================
  // ESTADOS MODAL GESTIÓN DE BANCOS
  // ==========================================
  const [showModalBancos, setShowModalBancos] = useState(false);
  const [nuevoBancoForm, setNuevoBancoForm] = useState({ nombre: '', cbu: '', moneda: 'USD' });
  const [guardandoBanco, setGuardandoBanco] = useState(false);

  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState('');
  const [bancoOrigen, setBancoOrigen] = useState('');
  const [refPago, setRefPago] = useState('');
  const [imagenArchivo, setImagenArchivo] = useState(null);
  const [imagenUrlpreview, setImagenUrlpreview] = useState('');
  const [responsableText, setResponsableText] = useState('');

  const [renglones, setRenglones] = useState([]);

  const [editandoObs, setEditandoObs] = useState(false);
  const [obsTemporal, setObsTemporal] = useState('');
  const [imagenesArchivos, setImagenesArchivos] = useState([]); // Soporte para múltiples archivos
  const [imagenesUrlsPreview, setImagenesUrlsPreview] = useState([]);
  const [imagenesNombres, setImagenesNombres] = useState([]); // Nombres de soportes para carga manual
  const [proveedores, setProveedores] = useState([]);
  const [preciosReferencia, setPreciosReferencia] = useState({});
  const [expandirHistorial, setExpandirHistorial] = useState({}); // { itemID: boolean }

  const formatName = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 1) return fullName;
    const firstName = parts[0];
    const firstLastName = parts[1];
    return `${firstName} ${firstLastName}`;
  };

  const getInitials = (nombre, apellido) => {
    return `${nombre?.charAt(0) || ''}${apellido?.charAt(0) || ''}`.toUpperCase();
  };

  // ==========================================
  // EFECTOS Y FETCH
  // ==========================================
  // ==========================================
  // FUNCIÓN PARA RECARGAR BANCOS
  // ==========================================
  const cargarBancosDeOrigen = useCallback(async () => {
    const { data: bData } = await supabase.from('bancos').select('*').eq('activo', true).order('nombre');
    if (bData) setBancos(bData);
  }, []);

  useEffect(() => {
    cargarInitialData();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    console.log('[REALTIME TICKETS] Subscribing to tickets_directos + bancos...');
    const channel = supabase
      .channel('tickets_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'tickets_directos'
      }, () => fetchHistorial())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tickets_directos'
      }, () => fetchHistorial())
      // Suscripción en tiempo real a la tabla bancos
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bancos'
      }, () => {
        console.log('[REALTIME BANCOS] Cambio detectado en bancos, recargando lista...');
        cargarBancosDeOrigen();
      })
      .subscribe();

    return () => {
      console.log('[REALTIME TICKETS] Unsubscribing...');
      supabase.removeChannel(channel);
    };
  }, [currentUser, cargarBancosDeOrigen]);

  const cargarInitialData = async () => {
    // 1. Cargar Usuario
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: perfil } = await supabase.from('perfiles').select('*').eq('id', user.id).single();
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
        esAdminGlobal: esAdminReal || perfil?.rol === 'Gerente General' || perfil?.rol === 'Administrador',
        obras_asignadas: perfil ? perfil.obras_asignadas || [] : [],
        contrato: perfil ? perfil.contrato || '' : ''
      };

      setCurrentUser(userInfo);

      if (perfil) {
        setResponsableText(`${perfil.nombre} ${perfil.apellido} - ${perfil.departamento}`);
      }

      // 2. Fetch de todas las solicitudes de fondo existentes
      const { data: sData } = await supabase.from('solicitudes_fondos').select('id, codigo_control, fecha_operativa, responsable_nombre').order('created_at', { ascending: false });
      if (sData) setSolicitudes(sData);

      // 3. Fetch de Bancos de Origen
      await cargarBancosDeOrigen();

      // 3.5 Fetch de Proveedores
      const { data: pData } = await supabase.from('proveedores').select('*').eq('status', true).order('razon_social', { ascending: true });
      if (pData) setProveedores(pData);

      // 4. Fetch Historial
      await fetchHistorial(userInfo);
    }
  };

  const totals = useMemo(() => {
    const list = historialTickets || [];
    const totalMonto = list.reduce((acc, t) => acc + (Number(t.total_usd) || 0), 0);
    const pagados = list.filter(t => t.status === 'Pagado').length;
    const pendientes = list.filter(t => t.status !== 'Pagado' && t.status !== 'Rechazado').length;
    const totalRegistros = list.length;

    return { totalMonto, pagados, pendientes, totalRegistros };
  }, [historialTickets]);

  const esPrivilegiado = useMemo(() => {
    if (!currentUser) return false;
    const rol = (currentUser.rol || '').toLowerCase().trim();
    const depto = (currentUser.departamento || '').toLowerCase().trim();
    
    const matchRol = rol.includes('administra') || rol.includes('contabil');
    const matchDepto = depto.includes('administra') || depto.includes('contabil');
    
    return matchRol || matchDepto || currentUser.esAdminReal === true || currentUser.esSuperAdmin === true;
  }, [currentUser]);

  const fetchHistorial = async (userParam = null) => {
    setCargandoHistorial(true);
    try {
      let query = supabase.from('tickets_directos').select('*');

      const activeUser = userParam || currentUser;

      if (activeUser) {
        const rolUpper = (activeUser.rol || '').toUpperCase().trim();
        const deptoUpper = (activeUser.departamento || '').toUpperCase().trim();
        const emailLower = (activeUser.correo || '').toLowerCase().trim();
        
        const esAdminReal = emailLower === 'jcontreras.totalclean@gmail.com' ||
          emailLower === 'cvega.totalclean@gmail.com' ||
          emailLower === 'cvega@totalclean.com' ||
          emailLower === 'karincmm1@gmail.com';

        const tieneVisibilidadGlobal = esAdminReal ||
          emailLower === 'cvega@totalclean.com' ||
          (activeUser.nombre || '').toLowerCase().includes('carlos') ||
          rolUpper.includes('ADMIN') ||
          rolUpper.includes('GERENTE GENERAL') ||
          rolUpper.includes('CONTABIL') ||
          rolUpper.includes('ADMINISTRA') ||
          deptoUpper.includes('ADMINISTRA') ||
          deptoUpper.includes('CONTABIL');

        if (!tieneVisibilidadGlobal) {
          const rawUserId = activeUser.id || '';
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawUserId);
          const userIdMatch = isUUID ? rawUserId : '00000000-0000-0000-0000-000000000000';

          const deptoMatch = activeUser.departamento || '';
          const nombreMatch = (activeUser.nombre || '').split(' ')[0] || 'Unknown';

          // Recopilar obras asignadas / contrato
          const misObras = [];
          if (activeUser.contrato) {
            misObras.push(activeUser.contrato);
          }
          if (activeUser.obras_asignadas && activeUser.obras_asignadas.length > 0) {
            misObras.push(...activeUser.obras_asignadas);
          }
          
          const obrasFiltro = misObras.length > 0 ? `centro_costo.in.(${misObras.map(o => `"${o}"`).join(',')})` : '';
          const rolUserLower = (activeUser.rol || '').toLowerCase();

          if (rolUserLower.includes('analista')) {
            // 1. ANALISTAS: Ven sus PROPIOS tickets + Obras Asignadas
            let orQ = `usuario_id.eq.${userIdMatch},gerente_nombre.ilike.%${nombreMatch}%`;
            if (obrasFiltro) orQ += `,${obrasFiltro}`;
            query = query.or(orQ);

          } else if (rolUserLower.includes('gerente') || rolUserLower.includes('coordinador')) {
            // 2. GERENTES DE ÁREA/PROYECTO: Ven su DEPARTAMENTO + OBRAS ASIGNADAS
            let orFiltros = [];
            if (deptoMatch) orFiltros.push(`departamento.ilike.%${deptoMatch}%`);
            if (obrasFiltro) orFiltros.push(obrasFiltro);

            if (orFiltros.length > 0) {
              query = query.or(orFiltros.join(','));
            } else {
              // Seguridad de respaldo
              query = query.or(`usuario_id.eq.${userIdMatch},gerente_nombre.ilike.%${nombreMatch}%`);
            }
          } else {
            // Otros roles: Ven sus propios
            query = query.or(`usuario_id.eq.${userIdMatch},gerente_nombre.ilike.%${nombreMatch}%`);
          }
        }
      }

      const { data, error } = await query.order('fecha_emision', { ascending: false });
      if (error) throw error;
      setHistorialTickets(data || []);
    } catch (err) {
      console.error('Error al cargar historial:', err.message);
    } finally {
      setCargandoHistorial(false);
    }
  };

  const obtenerPreciosReferencia = async (itemsActuales) => {
    try {
      const { data, error } = await supabase
        .from('requisiciones')
        .select('items')
        .eq('estado_aprobacion', 'aprobado_final')
        .order('fecha_emision', { ascending: false })
        .limit(50);
      if (error) throw error;
      const referencias = {};
      data.reverse().forEach(req => {
        (req.items || []).forEach(item => {
          if (item.historial_compras?.length > 0) {
            const compras = item.historial_compras.filter(h => h.tipo !== 'JUSTIFICACION');
            if (compras.length > 0) {
              referencias[item.descripcion.trim().toUpperCase()] = compras[compras.length - 1].pu;
            }
          }
        });
      });
      setPreciosReferencia(referencias);
    } catch (err) {
      console.error("Error obteniendo precios de referencia:", err.message);
    }
  };

  const abrirDetalleTicket = async (ticket) => {
    setLoading(true);
    try {
      const renglonesIniciados = (ticket.items || []).map(item => {
        const cantidad_pedida = item.cantidad_pedida || item.cant || item.cantidad || 0;
        const cantidad_comprada = item.cantidad_comprada || 0;
        const cantidad_pendiente = Math.max(0, cantidad_pedida - cantidad_comprada);
        return {
          ...item,
          cantidad_pedida,
          cantidad_comprada,
          cantidad_pendiente,
          historial_compras: item.historial_compras || [],
          compra_actual_cant: 0,
          compra_actual_pu: item.pu || item.puUsd || item.puBs || 0,
          doc_tipo_actual: item.doc_tipo || 'FAC',
          doc_numero_actual: '',
          proveedor_seleccionado_id: ''
        };
      });
      setRenglones(renglonesIniciados);
      setTicketSeleccionado(ticket);
      setBancoOrigen(ticket.banco_origen || '');
      setRefPago(ticket.codigo_control || '');
      setImagenUrlpreview(ticket.factura_url || '');
      setVistaActual('detalle');
      setModoEdicion(false);
      setExpandirHistorial({});
      await obtenerPreciosReferencia(renglonesIniciados);
    } catch (err) {
      console.error("Error al abrir detalle:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const pagarTodoRenglon = async (id) => {
    const item = renglones.find(r => r.id === id);
    if (!item || item.cantidad_pendiente === 0) return;

    const cant = item.cantidad_pendiente;
    const pu = item.compra_actual_pu || item.pu || item.puUsd || 0;
    let docNum = item.doc_numero_actual || '';

    // Variables mutables capturadas por el toast (sin re-renderizar)
    let tempDocNum = docNum || '';
    let tempBancoId = '';
    let tempFile = null;
    let tempFileName = '';

    toast((t) => {
      const inputStyle = {
        padding: '8px 12px',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        fontSize: '12px',
        width: '100%',
        outline: 'none',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        backgroundColor: '#f8fafc',
        boxSizing: 'border-box',
        color: '#1e293b'
      };
      const labelStyle = {
        fontSize: '11px',
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '4px',
        display: 'block'
      };
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '5px', minWidth: '280px' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={16} color="#0ea5e9" />
            Registrar Pago
          </p>

          {/* N° Factura */}
          <div>
            <label style={labelStyle}>N° FACTURA / CONTROL <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="text"
              defaultValue={tempDocNum}
              onChange={(e) => { tempDocNum = e.target.value; }}
              style={inputStyle}
              placeholder="N° de Factura..."
            />
          </div>

          {/* Banco Origen */}
          <div>
            <label style={labelStyle}>BANCO ORIGEN <span style={{ color: '#ef4444' }}>*</span></label>
            <select
              defaultValue={tempBancoId}
              onChange={(e) => { tempBancoId = e.target.value; }}
              style={{ ...inputStyle, backgroundColor: 'white', cursor: 'pointer' }}
            >
              <option value="">— Seleccionar Banco —</option>
              {bancos.map(b => (
                <option key={b.id} value={b.id}>{b.nombre} ({b.moneda})</option>
              ))}
            </select>
          </div>

          {/* Adjuntar Factura Documento */}
          <div>
            <label style={labelStyle}>Adjuntar Factura (Obligatorio) <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  tempFile = e.target.files[0];
                  const nameInput = document.getElementById('toast-invoice-name');
                  if (nameInput && !nameInput.value) {
                    const cleanName = tempFile.name.split('.')[0];
                    nameInput.value = cleanName;
                    tempFileName = cleanName;
                  }
                }
              }}
              style={{ ...inputStyle, padding: '6px', cursor: 'pointer', backgroundColor: 'white' }}
            />
          </div>

          {/* Nombre de la Factura / Soporte */}
          <div>
            <label style={labelStyle}>Nombre del Documento</label>
            <input
              id="toast-invoice-name"
              type="text"
              defaultValue={tempFileName}
              onChange={(e) => { tempFileName = e.target.value; }}
              style={inputStyle}
              placeholder="Ej: Factura Proveedor, Factura Mayo..."
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button
              onClick={() => {
                if (!tempDocNum.trim()) {
                  toast.error('El número de documento es obligatorio.');
                  return;
                }
                if (!tempBancoId) {
                  toast.error('Debe seleccionar el banco de origen.');
                  return;
                }
                if (!tempFile) {
                  toast.error('Debe adjuntar el documento de la factura para poder marcar como pagado.');
                  return;
                }
                toast.dismiss(t.id);
                // Pasamos todo via overrideValues para evitar closure stale del state
                guardarPagoRenglon(id, {
                  cant,
                  pu,
                  docNum: tempDocNum,
                  bancoPagoId: tempBancoId,
                  file: tempFile,
                  fileName: tempFileName || tempFile.name.split('.')[0] || 'Factura'
                });
              }}
              style={{
                padding: '6px 14px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
              }}
            >
              CONFIRMAR
            </button>
            <button
              onClick={() => toast.dismiss(t.id)}
              style={{
                padding: '6px 12px',
                background: '#f1f5f9',
                color: '#64748b',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: '500'
              }}
            >
              CANCELAR
            </button>
          </div>
        </div>
      );
    }, { duration: 40000, position: 'top-center' });
  };

  const actualizarFila = (id, campo, valor) => {
    setRenglones(prev => prev.map(f => {
      if (f.id === id) {
        let v = valor;
        if (campo === 'compra_actual_pu') v = Math.max(0, Number(valor) || 0);
        if (campo === 'compra_actual_cant') {
          v = Math.max(0, Number(valor) || 0);
          if (v > f.cantidad_pendiente) {
            toast.error(`No puede pagar más de la cantidad pendiente (${f.cantidad_pendiente})`);
            v = f.cantidad_pendiente;
          }
        }
        const act = { ...f, [campo]: v };
        act.total = act.compra_actual_cant * (act.compra_actual_pu || 0);
        const ref = preciosReferencia[f.descripcion.trim().toUpperCase()];
        if (campo === 'compra_actual_pu' && v > 0 && ref) {
          const variacion = ((v - ref) / ref) * 100;
          act.variacion_precio = variacion;
          act.precio_ref_encontrado = ref;
        }
        return { ...act, hasChanges: true };
      }
      return f;
    }));
  };

  const guardarPagoRenglon = async (id, overrideValues = null) => {
    if (loading) return;
    const item = renglones.find(r => r.id === id);
    if (!item) return;
    if (!overrideValues && !item.hasChanges) return;

    setLoading(true);
    try {
      const cantProcesar = overrideValues ? overrideValues.cant : Number(item.compra_actual_cant || 0);
      const puProcesar = overrideValues ? overrideValues.pu : Number(item.compra_actual_pu || 0);
      const docNumProcesar = overrideValues ? overrideValues.docNum : item.doc_numero_actual;
      const bancoPagoId = overrideValues?.bancoPagoId || null;

      if (!docNumProcesar || !docNumProcesar.trim()) {
        toast.error('Error: El número de documento es obligatorio.');
        setLoading(false);
        return;
      }
      if (!bancoPagoId) {
        toast.error('Error: Debe seleccionar el banco de origen.');
        setLoading(false);
        return;
      }
      if (cantProcesar <= 0) {
        toast.error('Error: Ingrese una cantidad mayor a 0.');
        setLoading(false);
        return;
      }

      // SUBIR FACTURA A STORAGE BUCKET tickets-evidencia
      let uploadedFileObj = null;
      if (overrideValues?.file) {
        const file = overrideValues.file;
        const customName = overrideValues.fileName || file.name.split('.')[0] || 'Factura';
        const fileName = `recibos/${Date.now()}_${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('tickets-evidencia')
          .upload(fileName, file);

        if (uploadError) {
          console.error("Error al subir archivo:", uploadError);
          toast.error(`Error al subir la factura: ${uploadError.message}`);
          throw uploadError;
        }

        const { data: publicUrlData } = supabase.storage.from('tickets-evidencia').getPublicUrl(fileName);
        uploadedFileObj = {
          url: publicUrlData.publicUrl,
          name: customName
        };
      }

      const proveedorSelec = proveedores.find(p => p.id === item.proveedor_seleccionado_id);
      const bancoSelec = bancos.find(b => b.id === bancoPagoId);

      const nuevaTransaccion = {
        fecha: new Date().toISOString(),
        cant: cantProcesar,
        pu: puProcesar,
        metodo_pago: item.metodo_pago_actual || '$ / BS',
        proveedor_id: item.proveedor_seleccionado_id || null,
        proveedor_nombre: proveedorSelec?.razon_social || 'Pago Directo / Sin Proveedor',
        banco_pago_id: bancoPagoId,
        banco_nombre: bancoSelec?.nombre || '',
        usuario_id: currentUser?.id,
        usuario_nombre: `${currentUser?.nombre} ${currentUser?.apellido}`,
        doc_tipo: item.doc_tipo_actual || 'FAC',
        doc_numero: docNumProcesar
      };

      const nuevaCantComprada = (item.cantidad_comprada || 0) + cantProcesar;
      const nuevaCantPendiente = Math.max(0, item.cantidad_pedida - nuevaCantComprada);
      let nuevoStatus = item.status;
      if (nuevaCantPendiente === 0) nuevoStatus = 'Completado';
      else if (nuevaCantComprada > 0) nuevoStatus = 'Parcial';

      const renglonProcesado = {
        ...item,
        cantidad_comprada: nuevaCantComprada,
        cantidad_pendiente: nuevaCantPendiente,
        historial_compras: [...(item.historial_compras || []), nuevaTransaccion],
        status: nuevoStatus,
        pu: puProcesar || item.pu,
        compra_actual_cant: 0,
        doc_numero_actual: '',
        proveedor_seleccionado_id: '',
        hasChanges: false
      };
      const nuevosRenglones = renglones.map(r => r.id === id ? renglonProcesado : r);
      const totalDinamicoReal = nuevosRenglones.reduce((acc, r) => {
        const ejecutadoItem = (r.historial_compras || []).reduce((sum, t) => sum + ((Number(t.cant) || 0) * (Number(t.pu) || 0)), 0);
        const estimadoPendiente = (Number(r.cantidad_pendiente) || 0) * Number(r.pu_estimado || r.pu || 0);
        return acc + ejecutadoItem + estimadoPendiente;
      }, 0);

      // Obtener facturas existentes y añadir la nueva
      let currentUrls = parsearFacturaUrls(ticketSeleccionado.factura_url);
      if (uploadedFileObj) {
        currentUrls.push(uploadedFileObj);
      }
      const serializedUrls = currentUrls.map(item => JSON.stringify(item));

      const { error } = await supabase
        .from('tickets_directos')
        .update({
          items: nuevosRenglones,
          total_usd: totalDinamicoReal * 1.16,
          banco_pago_id: bancoPagoId,
          factura_url: serializedUrls
        })
        .eq('id', ticketSeleccionado.id);
      if (error) throw error;
      setRenglones(nuevosRenglones);
      setTicketSeleccionado(prev => prev ? { ...prev, items: nuevosRenglones, banco_pago_id: bancoPagoId, factura_url: serializedUrls } : null);
      toast.success('Ítem guardado con éxito.');
      await fetchHistorial();
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const eliminarEntradaHistorial = async (idRenglon, indexHistorial) => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>¿Está seguro de eliminar esta entrada? El saldo pendiente se restaurará automáticamente.</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => { toast.dismiss(t.id); ejecutarEliminacionHistorial(idRenglon, indexHistorial); }}
            style={{ padding: '4px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            ELIMINAR
          </button>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 12px', background: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>CANCELAR</button>
        </div>
      </div>
    ), { duration: 5000 });
  };

  const ejecutarEliminacionHistorial = async (idRenglon, indexHistorial) => {
    const renglonesActualizados = renglones.map(r => {
      if (r.id === idRenglon) {
        const entrada = r.historial_compras[indexHistorial];
        let nuevaCantComprada = r.cantidad_comprada - (entrada.cant || 0);
        let nuevaCantPendiente = r.cantidad_pendiente + (entrada.cant || 0);
        const nuevoHistorial = [...r.historial_compras];
        nuevoHistorial.splice(indexHistorial, 1);
        return {
          ...r,
          cantidad_comprada: Math.max(0, nuevaCantComprada),
          cantidad_pendiente: Math.max(0, nuevaCantPendiente),
          historial_compras: nuevoHistorial,
          status: nuevaCantComprada === 0 ? 'En Espera' : 'Parcial'
        };
      }
      return r;
    });
    try {
      setLoading(true);
      const totalDinamicoReal = renglonesActualizados.reduce((acc, r) => {
        const ejecutadoItem = (r.historial_compras || []).reduce((sum, t) => sum + ((Number(t.cant) || 0) * (Number(t.pu) || 0)), 0);
        const estimadoPendiente = (Number(r.cantidad_pendiente) || 0) * Number(r.pu_estimado || r.pu || 0);
        return acc + ejecutadoItem + estimadoPendiente;
      }, 0);
      const { error } = await supabase
        .from('tickets_directos')
        .update({ items: renglonesActualizados, total_usd: totalDinamicoReal * 1.16 })
        .eq('id', ticketSeleccionado.id);
      if (error) throw error;
      setRenglones(renglonesActualizados);
      setTicketSeleccionado(prev => prev ? { ...prev, items: renglonesActualizados } : null);
      toast.success("Entrada eliminada y saldos restaurados.");
    } catch (err) {
      toast.error("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // LÓGICA DE ACTUALIZACIÓN DE PAGO
  // ==========================================
  const handleImagenChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setImagenesArchivos(prev => [...prev, ...files]);
      const newUrls = files.map(file => URL.createObjectURL(file));
      setImagenesUrlsPreview(prev => [...prev, ...newUrls]);
      const newNames = files.map(file => file.name.split('.')[0]);
      setImagenesNombres(prev => [...prev, ...newNames]);
    }
  };

  const quitarArchivoTemporal = (index) => {
    setImagenesArchivos(prev => prev.filter((_, i) => i !== index));
    setImagenesUrlsPreview(prev => prev.filter((_, i) => i !== index));
    setImagenesNombres(prev => prev.filter((_, i) => i !== index));
  };
  const actualizarPago = async () => {
    const existingUrls = parsearFacturaUrls(ticketSeleccionado.factura_url);
    if (!imagenesArchivos.length && existingUrls.length === 0) {
      return toast.error("Debe adjuntar al menos una imagen o comprobante antes de registrar y procesar el pago.");
    }
    setLoading(true);
    try {
      let finalUrls = [...existingUrls];

      if (imagenesArchivos.length > 0) {
        setSubiendoImagen(true);
        for (let i = 0; i < imagenesArchivos.length; i++) {
          const file = imagenesArchivos[i];
          const customName = imagenesNombres[i] || file.name.split('.')[0] || 'Soporte';
          const fileName = `recibos/${Date.now()}_${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from('tickets-evidencia')
            .upload(fileName, file);

          if (uploadError) {
            console.error("Error al subir archivo:", uploadError);
            toast.error(`Error al subir la imagen: ${uploadError.message}`);
            throw uploadError;
          }

          const { data: publicUrlData } = supabase.storage.from('tickets-evidencia').getPublicUrl(fileName);
          finalUrls.push({
            url: publicUrlData.publicUrl,
            name: customName
          });
        }
        setSubiendoImagen(false);
      }

      // Auto-procesar renglones que tienen N° de documento escrito pero no se ha hecho clic en "Marcar Pagado"
      const renglonesListos = renglones.map(r => {
        if (r.cantidad_pendiente > 0 && r.doc_numero_actual && r.doc_numero_actual.trim().length > 0) {
          const cant = r.cantidad_pendiente;
          const pu = r.compra_actual_pu || r.pu || r.puUsd || 0;
          const docNum = r.doc_numero_actual.trim();
          
          const proveedorSelec = proveedores.find(p => p.id === r.proveedor_seleccionado_id);
          
          const nuevaTransaccion = {
            fecha: new Date().toISOString(),
            cant: cant,
            pu: pu,
            metodo_pago: r.metodo_pago_actual || '$ / BS',
            proveedor_id: r.proveedor_seleccionado_id || null,
            proveedor_nombre: proveedorSelec?.razon_social || 'Pago Directo / Sin Proveedor',
            usuario_id: currentUser?.id,
            usuario_nombre: `${currentUser?.nombre} ${currentUser?.apellido}`,
            doc_tipo: r.doc_tipo_actual || 'FAC',
            doc_numero: docNum
          };
          
          const nuevaCantComprada = (r.cantidad_comprada || 0) + cant;
          const nuevaCantPendiente = 0;
          
          return {
            ...r,
            cantidad_comprada: nuevaCantComprada,
            cantidad_pendiente: nuevaCantPendiente,
            historial_compras: [...(r.historial_compras || []), nuevaTransaccion],
            status: 'Completado',
            pu: pu,
            compra_actual_cant: 0,
            doc_numero_actual: '',
            proveedor_seleccionado_id: '',
            hasChanges: false
          };
        }
        return r;
      });

      // El estatus global del ticket depende de si hay saldos pendientes
      const tienePendientes = renglonesListos.some(r => r.cantidad_pendiente > 0);
      const estatusFinal = tienePendientes ? 'Parcial' : 'Pagado';

      const totalDinamicoReal = renglonesListos.reduce((acc, r) => {
        const ejecutadoItem = (r.historial_compras || []).reduce((sum, t) => sum + ((Number(t.cant) || 0) * (Number(t.pu) || 0)), 0);
        const estimadoPendiente = (Number(r.cantidad_pendiente) || 0) * Number(r.pu_estimado || r.pu || 0);
        return acc + ejecutadoItem + estimadoPendiente;
      }, 0);

      const serializedUrls = finalUrls.map(item => JSON.stringify(item));

      const updatePayload = {
        factura_url: serializedUrls,
        status: estatusFinal,
        items: renglonesListos,
        total_usd: totalDinamicoReal * 1.16
      };

      // Preservar banco_pago_id si ya estaba en el ticket
      if (ticketSeleccionado.banco_pago_id) {
        updatePayload.banco_pago_id = ticketSeleccionado.banco_pago_id;
      }

      const { error } = await supabase.from('tickets_directos').update(updatePayload).eq('id', ticketSeleccionado.id);

      if (error) throw error;

      toast.success('Registros y comprobantes actualizados correctamente.');

      setImagenesArchivos([]);
      setImagenesUrlsPreview([]);
      setImagenesNombres([]);
      setTicketSeleccionado(null);
      await fetchHistorial();
      setVistaActual('historial');
    } catch (err) {
      toast.error('Error al actualizar pago: ' + err.message);
    } finally {
      setLoading(false);
      setSubiendoImagen(false);
      setShowConfirmacionPago(false);
    }
  };

  // ==========================================
  // FUNCIONES DEL MODAL DE BANCOS
  // ==========================================
  const agregarNuevoBanco = async (e) => {
    e.preventDefault();
    if (!nuevoBancoForm.nombre.trim()) {
      toast.error('El nombre del banco es obligatorio.');
      return;
    }
    setGuardandoBanco(true);
    try {
      const { error } = await supabase
        .from('bancos')
        .insert([{ nombre: nuevoBancoForm.nombre.trim(), cbu: nuevoBancoForm.cbu.trim() || null, moneda: nuevoBancoForm.moneda, activo: true }]);
      if (error) throw error;
      setNuevoBancoForm({ nombre: '', cbu: '', moneda: 'USD' });
      await cargarBancosDeOrigen();
      toast.success('Banco agregado correctamente.');
    } catch (err) {
      toast.error('Error al agregar banco: ' + err.message);
    } finally {
      setGuardandoBanco(false);
    }
  };

  const toggleActivoBanco = async (id, activo) => {
    try {
      const { error } = await supabase.from('bancos').update({ activo: !activo }).eq('id', id);
      if (error) throw error;
      await cargarBancosDeOrigen();
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  };

  const eliminarBancoModal = (id) => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>¿Eliminar este banco?</p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => {
              toast.dismiss(t.id);
              supabase.from('bancos').delete().eq('id', id).then(() => cargarBancosDeOrigen());
              toast.success('Banco eliminado.');
            }}
            style={{ padding: '4px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
          >
            ELIMINAR
          </button>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 12px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>CANCELAR</button>
        </div>
      </div>
    ), { duration: 6000, position: 'top-center' });
  };

  const guardarObservacionesTicket = async () => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('tickets_directos')
        .update({ observaciones: obsTemporal })
        .eq('id', ticketSeleccionado.id);

      if (error) throw error;
      setTicketSeleccionado({ ...ticketSeleccionado, observaciones: obsTemporal });
      setEditandoObs(false);
      toast.success("Observaciones actualizadas.");
    } catch (err) {
      toast.error("Error al guardar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const borrarComprobanteDB = async (url) => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>¿Está seguro de eliminar permanentemente este soporte? Se borrará tanto del registro como del servidor.</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => { toast.dismiss(t.id); ejecutarBorradoSoporte(url); }}
            style={{ padding: '4px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            ELIMINAR
          </button>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 12px', background: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>CANCELAR</button>
        </div>
      </div>
    ), { duration: 5000 });
  };

  const ejecutarBorradoSoporte = async (url) => {
    try {
      setLoading(true);
      let bucketName = '';
      if (url.includes('comprobantes')) bucketName = 'comprobantes';
      else if (url.includes('facturas')) bucketName = 'facturas';
      else if (url.includes('tickets-evidencia')) bucketName = 'tickets-evidencia';

      let filePath = '';
      if (bucketName) {
        const searchStr = bucketName + '/';
        const bIndex = url.indexOf(searchStr);
        if (bIndex !== -1) {
          filePath = url.substring(bIndex + searchStr.length).split('?')[0];
        } else {
          filePath = url.split('?')[0];
        }
      }

      if (bucketName && filePath) {
        const { error: storageError } = await supabase.storage
          .from(bucketName)
          .remove([filePath]);

        if (storageError) console.warn("Aviso: El archivo físico no se pudo borrar:", storageError.message);
      }

      const parsedUrls = parsearFacturaUrls(ticketSeleccionado.factura_url);
      const nuevasUrls = parsedUrls
        .filter(item => item.url !== url)
        .map(item => JSON.stringify(item));

      const { error: dbError } = await supabase
        .from('tickets_directos')
        .update({ factura_url: nuevasUrls })
        .eq('id', ticketSeleccionado.id);

      if (dbError) throw dbError;

      setTicketSeleccionado({ ...ticketSeleccionado, factura_url: nuevasUrls });
      toast.success("Soporte eliminado físicamente del servidor.");
      await fetchHistorial();
    } catch (err) {
      toast.error("Error al eliminar soporte: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const rechazarTicket = async () => {
    const motivo = window.prompt("Indique el motivo del rechazo:");
    if (motivo === null) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('tickets_directos').update({
        status: 'Rechazado',
        observaciones: ticketSeleccionado.observaciones ? `${ticketSeleccionado.observaciones}\n\nRECHAZO: ${motivo}` : `RECHAZO: ${motivo}`
      }).eq('id', ticketSeleccionado.id);

      if (error) throw error;
      toast.success("Ticket rechazado.");
      setTicketSeleccionado(null);
      setVistaActual('historial');
      await fetchHistorial();
    } catch (err) {
      toast.error("Error al rechazar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const manejarEliminarTicket = async (id) => {
    const esAutorizado = currentUser?.esSuperAdmin === true ||
                         currentUser?.esAdminReal === true ||
                         ['jcontreras.totalclean@gmail.com', 'karincmm1@gmail.com', 'cvega@totalclean.com', 'cvega.totalclean@gmail.com'].includes(currentUser?.correo?.toLowerCase());

    if (!esAutorizado) {
      toast.error("Solo el SuperAdministrador tiene permisos para eliminar tickets.");
      return;
    }

    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>¿Está seguro de eliminar permanentemente este ticket de pago? Esta acción no se puede deshacer.</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => { toast.dismiss(t.id); ejecutarEliminacionTicket(id); }}
            style={{ padding: '4px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            ELIMINAR TICKET
          </button>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 12px', background: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>CANCELAR</button>
        </div>
      </div>
    ), { duration: 6000 });
  };

  const ejecutarEliminacionTicket = async (id) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('tickets_directos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Ticket eliminado correctamente.");
      await fetchHistorial();
    } catch (err) {
      toast.error("Error al eliminar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderHistorial = () => {
    const filtrados = historialTickets.filter(t => {
      const qs = busqueda.toLowerCase();
      const bMatch = (t.codigo_control || '').toLowerCase().includes(qs) ||
                     (t.gerente_nombre || '').toLowerCase().includes(qs) ||
                     (t.departamento || '').toLowerCase().includes(qs);
      const sMatch = filtroStatus !== 'Todos' ? (t.status || 'Emitido').toLowerCase() === filtroStatus.toLowerCase() : true;
      const gMatch = filtroGerencia !== 'Todos' ? t.departamento === filtroGerencia : true;

      // Filtro Categoria: busca en items[]
      const cMatch = filtroCategoria !== 'Todos'
        ? (t.items || []).some(it => (it.clasificacion || '').toLowerCase().includes(filtroCategoria.toLowerCase()))
        : true;

      // Filtro CC
      const ccMatch = filtroCC !== 'Todos'
        ? (t.centro_costo || t.items?.[0]?.cc || '') === filtroCC
        : true;

      // Filtro fechas
      let fMatch = true;
      if (filtroFechaDesde || filtroFechaHasta) {
        const tDate = t.fecha_emision ? new Date(t.fecha_emision) : null;
        if (tDate) {
          if (filtroFechaDesde && tDate < new Date(filtroFechaDesde)) fMatch = false;
          if (filtroFechaHasta && tDate > new Date(filtroFechaHasta + 'T23:59:59')) fMatch = false;
        } else {
          fMatch = false;
        }
      }

      return bMatch && sMatch && gMatch && cMatch && ccMatch && fMatch;
    });

    // Opciones únicas para combos dinámicos
    const categoriasUnicas = [...new Set(
      historialTickets.flatMap(t => (t.items || []).map(it => it.clasificacion)).filter(Boolean)
    )].sort();
    const ccUnicos = [...new Set(
      historialTickets.map(t => t.centro_costo || t.items?.[0]?.cc).filter(Boolean)
    )].sort();

    return (
      <div style={{ padding: '30px' }}>
        {/* --- ENCABECERA UNIFICADA PREMIUM --- */}
        <div style={{
          borderLeft: '6px solid #0ea5e9',
          paddingLeft: '16px',
          marginBottom: '30px'
        }}>
          <h1 style={{ margin: 0, color: '#0f172a', fontSize: '1.8rem', fontWeight: '900', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.5px' }}>
            Control de Tickets de Pago
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem', fontWeight: '500', fontFamily: 'Inter, sans-serif' }}>
            Gestión centralizada de emisiones y egresos
          </p>
        </div>

        {/* --- DASHBOARD DE ESTADÍSTICAS (KPICards) clickables --- */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}>
          {[
            { label: 'Monto Total General', val: `$ ${totals.totalMonto.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`, icon: <DollarSign size={20} />, col: '#0ea5e9', bg: '#e0f2fe', filtro: null },
            { label: 'Tickets Pagados', val: totals.pagados, icon: <CheckCircle2 size={20} />, col: '#10b981', bg: '#dcfce7', filtro: 'Pagado' },
            { label: 'Pendientes por Procesar', val: totals.pendientes, icon: <Clock size={20} />, col: '#8b5cf6', bg: '#f3e8ff', filtro: 'pendiente' },
            { label: 'Total de Tickets', val: totals.totalRegistros, icon: <Ticket size={20} />, col: '#6366f1', bg: '#e0e7ff', filtro: 'Todos' },
          ].map((x, i) => {
            const isActive = x.filtro !== null && (
              x.filtro === 'Todos' ? filtroStatus === 'Todos' :
              x.filtro === 'pendiente' ? (filtroStatus === 'Emitido' || filtroStatus === 'Parcial') :
              filtroStatus === x.filtro
            );
            return (
              <motion.div
                key={i}
                onClick={() => {
                  if (x.filtro === null) return; // Monto no filtra
                  if (x.filtro === 'Todos') { setFiltroStatus('Todos'); return; }
                  if (x.filtro === 'pendiente') {
                    setFiltroStatus(filtroStatus === 'Emitido' ? 'Todos' : 'Emitido');
                    return;
                  }
                  setFiltroStatus(filtroStatus === x.filtro ? 'Todos' : x.filtro);
                }}
                whileHover={x.filtro !== null ? { scale: 1.03, boxShadow: `0 8px 24px ${x.col}22` } : {}}
                whileTap={x.filtro !== null ? { scale: 0.98 } : {}}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                style={{
                  background: 'white',
                  padding: '20px 24px',
                  borderRadius: '24px',
                  border: isActive ? `1.5px solid ${x.col}` : '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px',
                  boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.05)' : '0 4px 6px -1px rgba(0,0,0,0.02)',
                  transition: 'all 0.25s',
                  cursor: x.filtro !== null ? 'pointer' : 'default',
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
                  flexShrink: 0,
                  transition: 'all 0.25s'
                }}>
                  {x.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'inherit' }}>
                    {x.label}
                  </label>
                  <h3 style={{ margin: '2px 0 0 0', fontSize: '1.25rem', fontWeight: '900', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {x.val}
                  </h3>
                </div>
                {x.filtro !== null && (
                  <div style={{ color: isActive ? x.col : '#cbd5e1', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <ChevronDown size={14} style={{ transform: isActive ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="filters-overlap" style={{ marginBottom: '25px', backgroundColor: 'white', padding: '16px', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {/* Fila 1 */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
            <div style={{ flex: 2, minWidth: '180px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Buscar por referencia, beneficiario o gerencia..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                style={{ width: '100%', padding: '11px 12px 11px 30px', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none', boxSizing: 'border-box', backgroundColor: '#f8fafc', fontSize: '13px' }}
              />
            </div>
          
            <select
              value={filtroGerencia}
              onChange={(e) => setFiltroGerencia(e.target.value)}
              style={{ flex: 1, minWidth: '140px', padding: '11px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#475569', fontWeight: '600', fontSize: '13px' }}
            >
              <option value="Todos">Todas las Gerencias</option>
              {[...new Set(historialTickets.map(t => t.departamento))].filter(Boolean).sort().map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
             <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              style={{ flex: 1, minWidth: '130px', padding: '9px 11px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#475569', fontWeight: '600', fontSize: '12px' }}
            >
              <option value="Todos">Todas las Categorías</option>
              {categoriasUnicas.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
             <select
              value={filtroCC}
              onChange={(e) => setFiltroCC(e.target.value)}
              style={{ flex: 1, minWidth: '130px', padding: '9px 11px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#475569', fontWeight: '600', fontSize: '12px' }}
            >
              <option value="Todos">Todos los C. Costo / Contrato</option>
              {ccUnicos.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={fetchHistorial} title="Refrescar" style={{ backgroundColor: '#f1f5f9', color: '#475569', border: 'none', padding: '11px 14px', borderRadius: '10px', cursor: 'pointer', flexShrink: 0 }}>
              <RefreshCw size={18} />
            </button>
            {esPrivilegiado && (
              <motion.button
                id="btn-gestionar-bancos"
                onClick={() => setShowModalBancos(true)}
                whileHover={{ scale: 1.04, boxShadow: '0 6px 18px rgba(14, 165, 233, 0.22)' }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', flexShrink: 0 }}
              >
                <Landmark size={15} />
                Gestionar Bancos
              </motion.button>
            )}
          </div>
          {/* Fila 2: Filtros avanzados */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
           
           
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <Calendar size={14} style={{ color: '#94a3b8' }} />
              <input
                type="date"
                value={filtroFechaDesde}
                onChange={(e) => setFiltroFechaDesde(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#475569', fontSize: '12px', outline: 'none' }}
              />
              <span style={{ color: '#94a3b8', fontSize: '12px' }}>al</span>
              <input
                type="date"
                value={filtroFechaHasta}
                onChange={(e) => setFiltroFechaHasta(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#475569', fontSize: '12px', outline: 'none' }}
              />
            </div>
            {(filtroCategoria !== 'Todos' || filtroCC !== 'Todos' || filtroFechaDesde || filtroFechaHasta) && (
              <button
                onClick={() => { setFiltroCategoria('Todos'); setFiltroCC('Todos'); setFiltroFechaDesde(''); setFiltroFechaHasta(''); }}
                style={{ padding: '8px 12px', backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '10px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {cargandoHistorial ? (
          <div style={{ textAlign: 'center', padding: '50px', color: '#64748b' }}>Cargando historial de tickets...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px', color: '#64748b', backgroundColor: 'white', borderRadius: '24px', border: '1px dashed #cbd5e1' }}>
            No se encontraron tickets emitidos.
          </div>
        ) : (
          <div className="table-container">
            <table className="tc-table">
              <thead>
                <tr>
                  <th style={{ width: '150px' }}>ID / FECHA</th>
                  <th>SOLICITANTE / GERENCIA</th>
                  <th>JUSTIFICACIÓN / CATEGORÍA</th>
                  <th style={{ width: '140px' }}>CENTRO DE COSTO</th>
                  <th style={{ width: '120px' }}>BANCO</th>
                  <th style={{ textAlign: 'right' }}>TOTAL ($)</th>
                  <th style={{ textAlign: 'center', width: '120px' }}>ESTATUS</th>
                  <th style={{ textAlign: 'center' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(ticket => {
                  const justif = ticket.justificacion || ticket.items?.[0]?.justificacion_detallada || ticket.items?.[0]?.justificacion || 'Sin justificación';
                  const cc = ticket.centro_costo || ticket.items?.[0]?.cc || ticket.items?.[0]?.centro_costo || '---';
                  const categ = ticket.items?.[0]?.clasificacion || 'Sin categoría';
                  const todosLosDocs = Array.from(new Set(
                    (ticket.items || []).flatMap(r => (r.historial_compras || []).map(h => h.doc_numero)).filter(Boolean)
                  ));

                  let fechaStr = 'N/A';
                  try {
                    if (ticket.fecha_emision) {
                      fechaStr = format(new Date(ticket.fecha_emision + 'T12:00:00'), 'dd/MM/yyyy');
                    }
                  } catch (e) {
                    console.error("Error formatting date:", e);
                  }

                  return (
                    <tr key={ticket.id}>
                      <td
                        style={{ cursor: 'pointer', padding: '12px 15px' }}
                        onClick={() => abrirDetalleTicket(ticket)}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0ea5e9', flexShrink: 0 }} />
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
                              {ticket.codigo_control || `TX-${String(ticket.id).padStart(4, '0')}`}
                            </motion.span>
                          </div>
                          <div style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '14px', fontWeight: '600' }}>
                            {fechaStr}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 15px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.9rem' }}>{formatName(ticket.gerente_nombre)}</div>
                          <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>{ticket.departamento || 'No especificado'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 15px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '280px', gap: '4px' }}>
                          <span
                            title={justif}
                            style={{ fontWeight: '700', color: '#334155', fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                          >
                            {justif}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '600' }}>
                            {categ} {ticket.items?.length > 1 ? (
                              <span
                                style={{ color: '#0ea5e9', cursor: 'help', fontWeight: '800' }}
                                title={ticket.items.slice(1).map(it => `- ${it.descripcion || it.desc}`).join('\n')}
                              >
                                (+{ticket.items.length - 1} más)
                              </span>
                            ) : ''}
                          </span>
                          {todosLosDocs.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                              {todosLosDocs.map((doc, dIdx) => (
                                <span
                                  key={dIdx}
                                  style={{ fontSize: '9px', fontWeight: 'bold', color: '#1d4ed8', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '1px 5px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                >
                                  <FileText size={8} />
                                  {doc}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 15px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: '800',
                            color: '#475569',
                            backgroundColor: '#f1f5f9',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            display: 'inline-block'
                          }}>
                            {cc}
                          </span>
                          {ticket.contrato && ticket.contrato !== cc && (
                            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>
                              {ticket.contrato}
                            </span>
                          )}
                        </div>
                      </td>
                      {/* BANCO */}
                      <td style={{ padding: '12px 15px' }}>
                        {(() => {
                          const bancoNombre = bancos.find(b => b.id === ticket.banco_pago_id)?.nombre
                            || (() => {
                              const bn = (ticket.items || []).flatMap(r => (r.historial_compras || []).map(h => h.banco_nombre)).filter(Boolean);
                              return bn.length > 0 ? [...new Set(bn)].join(' / ') : null;
                            })();
                          return bancoNombre ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '700', color: '#0369a1', backgroundColor: '#e0f2fe', border: '1px solid #bae6fd', padding: '3px 8px', borderRadius: '7px' }}>
                              <Landmark size={11} color="#0369a1" />
                              {bancoNombre}
                            </span>
                          ) : <span style={{ color: '#cbd5e1', fontSize: '11px' }}>—</span>;
                        })()}
                      </td>
                      <td style={{ fontWeight: '1000', color: '#0f172a', textAlign: 'right', fontSize: '0.9rem', padding: '12px 15px' }}>
                        $ {(Number(ticket.total_usd) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'center', padding: '12px 15px' }}>
                        <div className={`badge-status ${ticket.status?.toLowerCase() || 'emitido'}`}>
                          {ticket.status === 'Pagado' && <span style={{ marginRight: '4px' }}>✓</span>}
                          {ticket.status || 'Emitido'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', padding: '12px 15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                          <button
                            onClick={() => abrirDetalleTicket(ticket)}
                            className="btn-tc btn-tc-secondary"
                            style={{ padding: '8px', borderRadius: '10px' }}
                            title="Ver Detalle"
                          >
                            <Eye size={18} />
                          </button>
                          {esPrivilegiado && (
                            <button
                              onClick={() => manejarEliminarTicket(ticket.id)}
                              className="btn-tc btn-tc-secondary"
                              style={{ padding: '8px', borderRadius: '10px', color: '#ef4444' }}
                              title="Eliminar Ticket"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderDetalle = () => {
    if (!ticketSeleccionado) return null;
    const t = ticketSeleccionado;

    return (
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => { setVistaActual('historial'); setTicketSeleccionado(null); }}
      >
        <motion.div
          className="modal-card animate-modal"
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{ maxWidth: '1400px', width: '95%', height: '95vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* --- CABECERA FIJA --- */}
          <div style={{ padding: '25px 35px 15px 35px', flexShrink: 0, borderBottom: '1px solid #f1f5f9', backgroundColor: 'white', position: 'relative' }}>
            <button 
              onClick={() => { setVistaActual('historial'); setTicketSeleccionado(null); }}
              style={{ position: 'absolute', top: '20px', right: '20px', border: 'none', background: '#f1f5f9', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s', zIndex: 100 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.5rem', fontWeight: '800' }}>Gestión de Pago Detallado</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px' }}>
                  <div style={{ background: '#0f172a', color: 'white', padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                    ID: {t.codigo_control}
                  </div>
                  <div className={`badge-status ${t.status?.toLowerCase() || 'emitido'}`} style={{ fontSize: '10px', height: '22px' }}>
                    {t.status?.toUpperCase() || 'EMITIDO'}
                  </div>
                </div>
              </div>

              <div style={{ marginRight: '50px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                {/* Habilitar Edición — solo el creador del ticket o admin pueden editar */}
                {(esPrivilegiado || ticketSeleccionado?.usuario_id === currentUser?.id) && ticketSeleccionado?.status !== 'Pagado' && (
                  <motion.button
                    onClick={() => setModoEdicion(prev => !prev)}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      padding: '9px 16px',
                      background: modoEdicion
                        ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                        : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '700',
                      boxShadow: modoEdicion ? '0 4px 12px rgba(245,158,11,0.3)' : '0 4px 12px rgba(99,102,241,0.25)'
                    }}
                  >
                    <Activity size={14} />
                    {modoEdicion ? 'Edición Activa' : 'Habilitar Edición'}
                  </motion.button>
                )}
                <button
                  onClick={() => { setVistaActual('historial'); setTicketSeleccionado(null); setModoEdicion(false); }}
                  className="btn-tc btn-tc-secondary"
                  style={{ padding: '10px 20px' }}
                >
                  <ArrowLeft size={16} /> Volver
                </button>
              </div>
            </div>

            <div className="te-header-line" style={{ height: '1px', background: '#f1f5f9', margin: '20px 0 15px 0' }}></div>

            {/* --- METADATA --- */}
            <div className="metadata-box" style={{ padding: '15px 20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '25px' }}>
                <div>
                  <label className="stat-label">FECHA EMISIÓN</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px', color: '#1e293b', fontWeight: '600' }}>
                    <Calendar size={18} color="#94a3b8" />
                    {t.fecha_emision ? new Date(t.fecha_emision).toLocaleDateString() : 'N/A'}
                  </div>
                </div>

                <div>
                  <label className="stat-label">BENEFICIARIO</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px', color: '#1e293b', fontWeight: '600' }}>
                    <User size={18} color="#94a3b8" />
                    {formatName(t.gerente_nombre) || 'Varios'}
                  </div>
                </div>

                <div>
                  <label className="stat-label">REFERENCIA FONDO</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px', color: '#0ea5e9', fontWeight: '700' }}>
                    <Hash size={18} color="#0ea5e9" />
                    {t.solicitud_ref || 'TR-Directo'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* --- CUERPO DESPLAZABLE --- */}
          <div style={{ flexGrow: 1, overflowY: 'auto', padding: '20px 35px' }}>
            {/* --- TABLA DE RENGLONES --- */}
            <div style={{ marginBottom: '35px' }}>
              <label className="stat-label" style={{ marginBottom: '15px' }}>DESGLOSE Y CONTROL DE SALDOS</label>
              <div className="te-table-wrapper" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <table className="tc-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}></th>
                      <th>DESCRIPCIÓN DEL ÍTEM</th>
                      <th style={{ width: '100px', textAlign: 'center' }}>CANTIDAD</th>
                      <th style={{ width: '120px', textAlign: 'center' }}>P.U. ($)</th>
                      <th style={{ width: '130px' }}>DOCUMENTO</th>
                      <th style={{ width: '130px' }}>BANCO</th>
                      <th style={{ width: '120px', textAlign: 'right' }}>TOTAL</th>
                      <th style={{ width: '150px', textAlign: 'center' }}>ESTADO PAGO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renglones.map((r) => (
                      <React.Fragment key={r.id}>
                        <tr className={r.cantidad_pendiente === 0 ? 'row-completed' : ''}>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => setExpandirHistorial(prev => ({ ...prev, [r.id]: !prev[r.id] }))}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                            >
                              <History size={16} />
                            </button>
                          </td>
                          <td>
                            <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{r.desc || r.descripcion}</div>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>CC: {r.cc} | {r.categoria}</div>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{r.cantidad_pedida}</td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ position: 'relative' }}>
                              <input
                                type="number"
                                className="editable-cell-input"
                                value={r.compra_actual_pu || r.pu || r.puUsd || ''}
                                onChange={(e) => actualizarFila(r.id, 'compra_actual_pu', e.target.value)}
                                disabled={r.cantidad_pendiente === 0}
                                style={{ textAlign: 'center' }}
                              />
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {(() => {
                                const docsRenglon = Array.from(new Set((r.historial_compras || []).map(h => h.doc_numero).filter(Boolean)));
                                return (
                                  <>
                                    {docsRenglon.length > 0 && (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '4px' }}>
                                        {docsRenglon.map((doc, dIdx) => (
                                          <span
                                            key={dIdx}
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '4px',
                                              backgroundColor: '#eff6ff',
                                              color: '#1d4ed8',
                                              border: '1px solid #bfdbfe',
                                              borderRadius: '6px',
                                              padding: '2px 6px',
                                              fontSize: '0.65rem',
                                              fontWeight: '700'
                                            }}
                                          >
                                            <FileText size={10} color="#1d4ed8" />
                                            {doc}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    {r.cantidad_pendiente > 0 ? (
                                      <input
                                        type="text"
                                        className="editable-cell-input"
                                        placeholder="N° Documento"
                                        value={r.doc_numero_actual || ''}
                                        onChange={(e) => actualizarFila(r.id, 'doc_numero_actual', e.target.value)}
                                        style={{ fontSize: '0.7rem' }}
                                      />
                                    ) : (
                                      docsRenglon.length === 0 && (
                                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>Sin documento</span>
                                      )
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                          {/* COLUMNA BANCO */}
                          <td>
                            {(() => {
                              const bancosRenglon = Array.from(new Set((r.historial_compras || []).map(h => h.banco_nombre).filter(Boolean)));
                              return bancosRenglon.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                  {bancosRenglon.map((bnk, bIdx) => (
                                    <span
                                      key={bIdx}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        backgroundColor: '#e0f2fe',
                                        color: '#0369a1',
                                        border: '1px solid #bae6fd',
                                        borderRadius: '6px',
                                        padding: '2px 6px',
                                        fontSize: '0.65rem',
                                        fontWeight: '700'
                                      }}
                                    >
                                      <Landmark size={10} color="#0369a1" />
                                      {bnk}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ fontSize: '0.7rem', color: '#cbd5e1', fontStyle: 'italic' }}>—</span>
                              );
                            })()}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                            $ {(r.cantidad_pedida * (r.compra_actual_pu || r.pu || r.puUsd || 0)).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {r.cantidad_pendiente === 0 ? (
                              <div style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                                <CheckCircle2 size={16} /> PAGADO
                              </div>
                            ) : (
                              <button
                                onClick={() => pagarTodoRenglon(r.id)}
                                className="btn-tc btn-tc-success"
                                style={{ padding: '8px 15px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold', width: '100%' }}
                                disabled={loading || !esPrivilegiado}
                              >
                                <DollarSign size={14} /> MARCAR PAGADO
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* --- HISTORIAL EXPANDIBLES --- */}
                        {expandirHistorial[r.id] && (
                          <tr key={`expand-${r.id}`} style={{ backgroundColor: '#f8fafc' }}>
                            <td colSpan="11" style={{ padding: 0 }}>
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                                style={{ padding: '15px', overflow: 'hidden' }}
                              >
                                <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ color: '#94a3b8', textAlign: 'left' }}>
                                      <th style={{ padding: '8px' }}>FECHA</th>
                                      <th>DOC</th>
                                      <th>BANCO</th>
                                      <th style={{ textAlign: 'center' }}>CANT</th>
                                      <th style={{ textAlign: 'right' }}>P.U.</th>
                                      <th style={{ textAlign: 'right' }}>TOTAL</th>
                                      <th style={{ textAlign: 'center' }}>ACCIONES</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(r.historial_compras || []).map((h, hIdx) => {
                                      const uniqueTxKey = h.id || `tx-${h.fecha}-${h.doc_numero || hIdx}-${hIdx}`;
                                      return (
                                        <tr key={uniqueTxKey} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                          <td style={{ padding: '8px' }}>{new Date(h.fecha).toLocaleDateString()}</td>
                                          <td>{h.doc_tipo} {h.doc_numero}</td>
                                          <td>
                                            {h.banco_nombre ? (
                                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '5px', padding: '2px 6px', fontSize: '0.65rem', fontWeight: '700' }}>
                                                <Landmark size={9} color="#0369a1" />{h.banco_nombre}
                                              </span>
                                            ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                                          </td>
                                          <td style={{ textAlign: 'center' }}>{h.cant}</td>
                                          <td style={{ textAlign: 'right' }}>$ {h.pu.toLocaleString()}</td>
                                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>$ {(h.cant * h.pu).toLocaleString()}</td>
                                          <td style={{ textAlign: 'center' }}>
                                            <button
                                              onClick={() => eliminarEntradaHistorial(r.id, hIdx)}
                                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                    {(!r.historial_compras || r.historial_compras.length === 0) && (
                                      <tr>
                                        <td colSpan="7" style={{ textAlign: 'center', padding: '10px', color: '#94a3b8' }}>No hay registros.</td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#0f172a' }}>Soportes y Comprobantes</h3>
                <label className="btn-tc btn-tc-primary" style={{ cursor: 'pointer', padding: '6px 12px', fontSize: '0.7rem' }}>
                  <Upload size={14} /> Adjuntar
                  <input type="file" multiple style={{ display: 'none' }} onChange={handleImagenChange} />
                </label>
              </div>

              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                {parsearFacturaUrls(t.factura_url).map((item, idx) => {
                  const isPdf = item.url.split('?')[0].toLowerCase().endsWith('.pdf');
                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        position: 'relative', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        width: '100px',
                        background: 'rgba(255, 255, 255, 0.6)',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '8px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                      }}
                    >
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noreferrer" 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          width: '84px', 
                          height: '84px', 
                          borderRadius: '8px', 
                          overflow: 'hidden', 
                          backgroundColor: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          position: 'relative'
                        }}
                      >
                        {isPdf ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <FileText size={32} color="#ef4444" />
                            <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#ef4444' }}>PDF</span>
                          </div>
                        ) : (
                          <img src={item.url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                      </a>
                      
                      <span 
                        style={{ 
                          fontSize: '10px', 
                          fontWeight: '600', 
                          color: '#334155', 
                          marginTop: '6px', 
                          textAlign: 'center', 
                          width: '100%', 
                          whiteSpace: 'nowrap', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          display: 'block'
                        }}
                        title={item.name}
                      >
                        {item.name}
                      </span>

                      <button
                        onClick={() => borrarComprobanteDB(item.url)}
                        style={{ 
                          position: 'absolute', 
                          top: '-6px', 
                          right: '-6px', 
                          backgroundColor: '#ef4444', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '50%', 
                          width: '22px', 
                          height: '22px', 
                          cursor: 'pointer', 
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)',
                          zIndex: 10
                        }}
                        title="Eliminar Soporte"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                {imagenesUrlsPreview.map((url, idx) => {
                  const file = imagenesArchivos[idx];
                  const isPdf = file?.type === 'application/pdf' || file?.name?.toLowerCase().endsWith('.pdf');
                  return (
                    <div 
                      key={`preview-${idx}`} 
                      style={{ 
                        position: 'relative', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        width: '100px',
                        background: 'rgba(255, 255, 255, 0.8)',
                        border: '1px dashed #94a3b8',
                        borderRadius: '12px',
                        padding: '8px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          width: '84px', 
                          height: '84px', 
                          borderRadius: '8px', 
                          overflow: 'hidden', 
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          position: 'relative'
                        }}
                      >
                        {isPdf ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <FileText size={32} color="#ef4444" />
                            <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#ef4444' }}>PDF</span>
                          </div>
                        ) : (
                          <img src={url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                      </div>

                      <input
                        type="text"
                        placeholder="Nombre..."
                        value={imagenesNombres[idx] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setImagenesNombres(prev => prev.map((n, i) => i === idx ? val : n));
                        }}
                        style={{
                          width: '100%',
                          marginTop: '6px',
                          padding: '3px 6px',
                          fontSize: '9px',
                          fontWeight: '600',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          boxSizing: 'border-box',
                          textAlign: 'center',
                          outline: 'none',
                          backgroundColor: 'white',
                          color: '#334155'
                        }}
                      />

                      <button
                        onClick={() => quitarArchivoTemporal(idx)}
                        style={{ 
                          position: 'absolute', 
                          top: '-6px', 
                          right: '-6px', 
                          backgroundColor: '#64748b', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '50%', 
                          width: '22px', 
                          height: '22px', 
                          cursor: 'pointer', 
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 4px rgba(100, 116, 139, 0.3)',
                          zIndex: 10
                        }}
                        title="Quitar"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* --- PIE DE PÁGINA FIJO --- */}
          <div style={{ padding: '20px 35px 30px 35px', flexShrink: 0, borderTop: '1px solid #f1f5f9', backgroundColor: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '30px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold' }}>TOTAL EJECUTADO:</span>
                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#10b981' }}>
                  $ {renglones.reduce((acc, r) => acc + (r.historial_compras || []).reduce((sum, h) => sum + (h.cant * h.pu), 0), 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold' }}>SALDO PENDIENTE:</span>
                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ef4444' }}>
                  $ {renglones.reduce((acc, r) => acc + (r.cantidad_pendiente * (r.pu || r.puUsd || 0)), 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.7rem', textAlign: 'right', width: '180px' }}>
                * El estatus cambiará según el saldo restante.
              </div>
              <button
                onClick={actualizarPago}
                className="btn-tc btn-tc-primary"
                style={{ padding: '12px 30px', fontSize: '0.95rem', fontWeight: 'bold', opacity: !esPrivilegiado ? 0.6 : 1, minWidth: '250px' }}
                disabled={loading || !esPrivilegiado}
              >
                {!esPrivilegiado ? 'Solo lectura' : (loading ? 'Procesando...' : 'Finalizar y Guardar Cambios')}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  // ==========================================
  // MODAL DE GESTIÓN DE BANCOS
  // ==========================================
  const renderModalBancos = () => (
    <AnimatePresence>
      {showModalBancos && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowModalBancos(false)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, backdropFilter: 'blur(4px)'
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 24 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '20px',
              width: '92%',
              maxWidth: '560px',
              boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
              overflow: 'hidden',
              border: '1px solid #e2e8f0'
            }}
          >
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px', borderRadius: '10px', display: 'flex' }}>
                  <Landmark size={20} color="white" />
                </div>
                <div>
                  <h3 style={{ margin: 0, color: 'white', fontSize: '15px', fontWeight: '800' }}>Gestionar Bancos</h3>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: '11px' }}>Fuentes de fondos para pagos</p>
                </div>
              </div>
              <button
                onClick={() => setShowModalBancos(false)}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', transition: 'background 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.35)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulario Agregar Banco */}
            <form onSubmit={agregarNuevoBanco} style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <p style={{ margin: '0 0 14px 0', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Agregar Nuevo Banco</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'end' }}>
                <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 2 }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>NOMBRE DEL BANCO</label>
                      <input
                        type="text"
                        placeholder="Ej: Banesco, Mercantil..."
                        value={nuevoBancoForm.nombre}
                        onChange={(e) => setNuevoBancoForm(prev => ({ ...prev, nombre: e.target.value }))}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', color: '#1e293b', backgroundColor: '#f8fafc' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>MONEDA</label>
                      <select
                        value={nuevoBancoForm.moneda}
                        onChange={(e) => setNuevoBancoForm(prev => ({ ...prev, moneda: e.target.value }))}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white', color: '#1e293b' }}
                      >
                        <option value="USD">USD</option>
                        <option value="VES">VES</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Nº DE CUENTA <span style={{ fontWeight: '400', textTransform: 'none', color: '#cbd5e1' }}>(opcional)</span></label>
                    <input
                      type="text"
                      placeholder="Ej: 0134-0001-00-0012345678"
                      value={nuevoBancoForm.cbu}
                      onChange={(e) => setNuevoBancoForm(prev => ({ ...prev, cbu: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', color: '#1e293b', backgroundColor: '#f8fafc', fontFamily: 'monospace', letterSpacing: '0.5px' }}
                    />
                  </div>
                </div>
                <motion.button
                  type="submit"
                  disabled={guardandoBanco}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    padding: '9px 16px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 8px rgba(16,185,129,0.25)'
                  }}
                >
                  <Plus size={15} />
                  {guardandoBanco ? 'Guardando...' : 'Guardar'}
                </motion.button>
              </div>
            </form>

            {/* Listado de Bancos */}
            <div style={{ padding: '16px 24px 24px 24px', maxHeight: '280px', overflowY: 'auto' }}>
              <p style={{ margin: '0 0 12px 0', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bancos Registrados ({bancos.length})</p>
              {bancos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '13px', border: '1px dashed #e2e8f0', borderRadius: '10px' }}>
                  No hay bancos registrados aún.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {bancos.map(b => (
                    <div
                      key={b.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid #f1f5f9',
                        backgroundColor: '#f8fafc',
                        transition: 'border-color 0.2s'
                      }}
                    >
                      <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Landmark size={16} color="#0ea5e9" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '700', fontSize: '12px', color: '#1e293b' }}>{b.nombre}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '800',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            backgroundColor: b.moneda === 'USD' ? '#dcfce7' : '#fef3c7',
                            color: b.moneda === 'USD' ? '#166534' : '#92400e'
                          }}>
                            {b.moneda}
                          </span>
                          {b.cbu && (
                            <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace', letterSpacing: '0.3px' }}>
                              {b.cbu}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                        <button
                          onClick={() => toggleActivoBanco(b.id, b.activo)}
                          title={b.activo ? 'Desactivar' : 'Activar'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: b.activo ? '#10b981' : '#cbd5e1', padding: '4px' }}
                        >
                          <CheckCircle2 size={18} />
                        </button>
                        <button
                          onClick={() => eliminarBancoModal(b.id)}
                          title="Eliminar banco"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {renderHistorial()}
      <AnimatePresence>
        {vistaActual === 'detalle' && renderDetalle()}
      </AnimatePresence>
      {renderModalBancos()}
    </>
  );
};

export default ModuloTicketsPago;
