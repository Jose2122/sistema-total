import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
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
  Landmark,
  FileSpreadsheet,
  MessageSquare
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

const parseSafeDate = (dateVal) => {
  if (!dateVal) return null;
  try {
    const datePart = String(dateVal).split('T')[0].split(' ')[0];
    const d = new Date(datePart + 'T12:00:00');
    return isNaN(d.getTime()) ? new Date(dateVal) : d;
  } catch (e) {
    return new Date(dateVal);
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
        } catch (e) { }
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

const FormularioPagoToast = ({
  item,
  bancos,
  proveedores,
  onConfirm,
  onCancel
}) => {
  const defaultCant = item.cantidad_pendiente;
  const defaultPu = item.compra_actual_pu || item.pu || item.puUsd || 0;

  const [sinFactura, setSinFactura] = useState(false);
  const [docNum, setDocNum] = useState(item.doc_numero_actual || '');
  const [bancoId, setBancoId] = useState('');
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [categoriaProveedor, setCategoriaProveedor] = useState('Todos');
  const [proveedorId, setProveedorId] = useState('');
  const [nroReferencia, setNroReferencia] = useState('');
  const [metodoPago, setMetodoPago] = useState(item.metodo_pago_actual || (item.puBs > 0 ? '$ / BS' : '$ / $'));

  const [modificarMonto, setModificarMonto] = useState(false);
  const [cantidadModificada, setCantidadModificada] = useState(defaultCant);
  const [puModificada, setPuModificada] = useState(defaultPu);

  // Extract unique categories of providers
  const categoriasUnicas = useMemo(() => {
    const cats = new Set();
    proveedores.forEach(p => {
      if (p.categoria) {
        const pCats = String(p.categoria).split(',').map(c => c.trim()).filter(Boolean);
        pCats.forEach(c => cats.add(c.toUpperCase()));
      }
    });
    return Array.from(cats).sort();
  }, [proveedores]);

  // Filtered providers based on category
  const proveedoresFiltrados = useMemo(() => {
    if (categoriaProveedor === 'Todos') return proveedores;
    return proveedores.filter(p => {
      if (!p.categoria) return false;
      const pCats = String(p.categoria).split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
      return pCats.includes(categoriaProveedor);
    });
  }, [proveedores, categoriaProveedor]);

  const handleSinFacturaChange = (checked) => {
    setSinFactura(checked);
    if (checked) {
      setDocNum('N/A');
    } else {
      setDocNum(item.doc_numero_actual || '');
    }
  };

  const handleConfirm = () => {
    if (!docNum.trim()) {
      toast.error('El número de documento es obligatorio.');
      return;
    }
    if (!sinFactura && !file) {
      toast.error('Debe adjuntar el documento de la factura para poder marcar como pagado.');
      return;
    }
    if (file && (!fileName || !fileName.trim())) {
      toast.error('Debe ingresar un nombre o etiqueta para el soporte de pago.');
      return;
    }
    const finalCant = modificarMonto ? Number(cantidadModificada) : defaultCant;
    const finalPu = modificarMonto ? Number(puModificada) : defaultPu;

    if (isNaN(finalCant) || finalCant <= 0) {
      toast.error('La cantidad a pagar debe ser un número mayor a cero.');
      return;
    }
    if (isNaN(finalPu) || finalPu < 0) {
      toast.error('El precio unitario a pagar debe ser un número mayor o igual a cero.');
      return;
    }

    onConfirm({
      cant: finalCant,
      pu: finalPu,
      docNum: docNum.trim(),
      bancoPagoId: bancoId || null,
      file: file || null,
      fileName: file ? fileName.trim() : 'N/A',
      proveedorId: proveedorId || null,
      efectivo: false,
      nroReferencia: nroReferencia.trim(),
      metodoPago
    });
  };

  return (
    <div className="toast-pago-container">

      {/* HEADER SECTION */}
      <div className="toast-pago-header">
        <div className="toast-pago-header-left">
          <div className="toast-pago-icon-badge">
            <CreditCard size={20} />
          </div>
          <div>
            <h4 className="toast-pago-title">Registrar Pago</h4>
            <p className="toast-pago-subtitle">Confirmar y detallar transacción del ítem</p>
          </div>
        </div>
        <button className="toast-pago-close-btn" onClick={onCancel} title="Cerrar">
          <X size={16} />
        </button>
      </div>

      {/* MONTO DE LA TRANSACCIÓN — fila compacta */}
      <div className="toast-pago-panel" style={{ padding: '10px 14px' }}>
        <div className="toast-pago-panel-title" style={{ marginBottom: '8px' }}>Monto de la Transacción</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
          <div>
            <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: '700', textTransform: 'uppercase' }}>Cant. Pendiente</span>
            <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b' }}>{defaultCant}</span>
          </div>
          <div>
            <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: '700', textTransform: 'uppercase' }}>P.U. Original ($)</span>
            <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b' }}>$ {defaultPu.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: '700', textTransform: 'uppercase' }}>Total por Defecto</span>
            <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#10b981' }}>$ {(defaultCant * defaultPu).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
        <label className={`toast-pago-checkbox-card ${modificarMonto ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: modificarMonto ? '10px' : '0' }}>
          <input type="checkbox" checked={modificarMonto} onChange={(e) => setModificarMonto(e.target.checked)} />
          Modificar monto a pagar
        </label>
        {modificarMonto && (
          <>
            <div className="toast-pago-grid-2">
              <div>
                <label className="toast-pago-label">Nueva Cantidad</label>
                <input type="number" className="toast-pago-input" value={cantidadModificada} min="0.01" step="any" onChange={(e) => setCantidadModificada(e.target.value)} placeholder="Cantidad..." />
              </div>
              <div>
                <label className="toast-pago-label">Nuevo P.U. ($)</label>
                <input type="number" className="toast-pago-input" value={puModificada} min="0" step="0.01" onChange={(e) => setPuModificada(e.target.value)} placeholder="Precio Unitario..." />
              </div>
            </div>
            <div style={{ textAlign: 'right', marginTop: '6px', fontSize: '12px', fontWeight: 'bold', color: '#ef4444' }}>
              Nuevo Total: $ {((Number(cantidadModificada) || 0) * (Number(puModificada) || 0)).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
            </div>
          </>
        )}
      </div>

      {/* DOCUMENTACIÓN */}
      <div className="toast-pago-panel">
        <div className="toast-pago-panel-title">Documentación</div>
        <div className="toast-pago-grid-2">
          <div>
            <label className="toast-pago-label">Estatus Factura</label>
            <label className={`toast-pago-checkbox-card ${sinFactura ? 'active' : ''}`}>
              <input type="checkbox" checked={sinFactura} onChange={(e) => handleSinFacturaChange(e.target.checked)} />
              Sin Factura (N/A)
            </label>
          </div>
          <div>
            <label className="toast-pago-label">
              Número Factura / Control {!sinFactura && <span className="toast-pago-label-req">*</span>}
            </label>
            <input type="text" className="toast-pago-input" value={docNum} onChange={(e) => setDocNum(e.target.value)} disabled={sinFactura} placeholder={sinFactura ? 'N/A' : 'Factura...'} />
          </div>
        </div>
        <div className="toast-pago-grid-2">
          <div>
            <label className="toast-pago-label">Soporte {!sinFactura && <span className="toast-pago-label-req">*</span>}</label>
            <label className={`toast-pago-upload-zone ${file ? 'has-file' : ''}`}>
              <Upload size={14} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file ? `${file.name.slice(0, 18)}${file.name.length > 18 ? '...' : ''}` : 'Subir Imagen/PDF'}
              </span>
              <input type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  const selectedFile = e.target.files[0];
                  if (selectedFile.size > 5 * 1024 * 1024) {
                    toast.error("El archivo supera el límite de 5MB.");
                    e.target.value = '';
                    return;
                  }
                  setFile(selectedFile);
                  if (!fileName || fileName === 'N/A') setFileName(selectedFile.name.split('.')[0]);
                }
              }} style={{ display: 'none' }} />
            </label>
          </div>
          <div>
            <label className="toast-pago-label">Nombre Documento {!sinFactura && file && <span className="toast-pago-label-req">*</span>}</label>
            <input type="text" className="toast-pago-input" value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="Ej: Factura Mayo..." />
          </div>
        </div>
      </div>

      {/* BANCO + PROVEEDOR en fila */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* DETALLES DEL PAGO */}
        <div className="toast-pago-panel">
          <div className="toast-pago-panel-title">Detalles del Pago</div>
          <div>
            <label className="toast-pago-label">Banco Origen</label>
            <select className="toast-pago-select" value={bancoId} onChange={(e) => setBancoId(e.target.value)}>
              <option value="">— Seleccionar Banco —</option>
              {bancos.map(b => (<option key={b.id} value={b.id}>{b.nombre} ({b.moneda})</option>))}
            </select>
          </div>
          <div>
            <label className="toast-pago-label">Moneda de Pago</label>
            <select className="toast-pago-select" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
              <option value="$ / $">$ / $ (Dólares)</option>
              <option value="$ / BS">$ / BS (Bolívares)</option>
            </select>
          </div>
          <div>
            <label className="toast-pago-label">Número Referencia (Opcional)</label>
            <input type="text" className="toast-pago-input" value={nroReferencia} onChange={(e) => setNroReferencia(e.target.value)} placeholder="Número de Transferencia..." />
          </div>
        </div>

        {/* PROVEEDOR */}
        <div className="toast-pago-panel">
          <div className="toast-pago-panel-title">Proveedor</div>
          <div>
            <label className="toast-pago-label">Filtrar Categoría</label>
            <select className="toast-pago-select" value={categoriaProveedor} onChange={(e) => { setCategoriaProveedor(e.target.value); setProveedorId(''); }}>
              <option value="Todos">Todas las Categorías</option>
              {categoriasUnicas.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
            </select>
          </div>
          <div>
            <label className="toast-pago-label">Proveedor</label>
            <select className="toast-pago-select" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {proveedoresFiltrados.map(p => (<option key={p.id} value={p.id}>{p.razon_social} ({p.rif})</option>))}
            </select>
          </div>
        </div>
      </div>

      {/* ACCIONES */}
      <div className="toast-pago-actions">
        <button className="toast-pago-btn-cancel" onClick={onCancel}>Cancelar</button>
        <button className="toast-pago-btn-confirm" onClick={handleConfirm}>Confirmar Pago</button>
      </div>
    </div>
  );
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
  const [mostrarObservaciones, setMostrarObservaciones] = useState(false);
  const [mostrarSoportes, setMostrarSoportes] = useState(false);
  const [imagenesArchivos, setImagenesArchivos] = useState([]); // Soporte para múltiples archivos
  const [imagenesUrlsPreview, setImagenesUrlsPreview] = useState([]);
  const [imagenesNombres, setImagenesNombres] = useState([]); // Nombres de soportes para carga manual
  const [proveedores, setProveedores] = useState([]);
  const [preciosReferencia, setPreciosReferencia] = useState({});
  const [expandirHistorial, setExpandirHistorial] = useState({}); // { itemID: boolean }
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [todasCategorias, setTodasCategorias] = useState([]);

  const todasCategoriasUnicas = useMemo(() => {
    const vistos = new Set();
    return todasCategorias.filter(cat => {
      if (!cat.nombre) return false;
      const val = cat.nombre.trim().toUpperCase();
      if (vistos.has(val)) return false;
      vistos.add(val);
      return true;
    });
  }, [todasCategorias]);

  const centrosCostoUnicos = useMemo(() => {
    const vistos = new Set();
    return centrosCosto.filter(cc => {
      if (!cc.nombre) return false;
      const val = cc.nombre.trim().toUpperCase();
      if (vistos.has(val)) return false;
      vistos.add(val);
      return true;
    });
  }, [centrosCosto]);

  const [txEditando, setTxEditando] = useState(null); // { renglonId: '...', txIndex: 0 }
  const [txEditandoData, setTxEditandoData] = useState(null); // { fecha, doc_numero, banco_pago_id, efectivo, cant, pu, nro_referencia, ... }

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

      // Fetch de Centros de Costo y Clasificaciones
      const { data: dataCC } = await supabase.from('maestros_centros_costo').select('id, nombre').eq('activo', true).order('nombre');
      if (dataCC) setCentrosCosto(dataCC);

      const { data: dataClas } = await supabase.from('maestros_clasificaciones').select('id, nombre').eq('activo', true).order('nombre');
      if (dataClas) setTodasCategorias(dataClas);

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
          deptoUpper.includes('CONTABIL') ||
          activeUser.capacidades?.ver_tickets_global === true;

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

      // Auto-open collapsible sections if they have content
      const hasSoportes = parsearFacturaUrls(ticket.factura_url).length > 0;
      const hasObservaciones = !!ticket.observaciones && 
                               ticket.observaciones.trim() !== '' && 
                               ticket.observaciones.trim().toLowerCase() !== 'sin observaciones registradas.';
      setMostrarSoportes(hasSoportes);
      setMostrarObservaciones(hasObservaciones);

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

    toast((t) => (
      <FormularioPagoToast
        item={item}
        bancos={bancos}
        proveedores={proveedores}
        onConfirm={(values) => {
          toast.dismiss(t.id);
          guardarPagoRenglon(id, {
            cant: values.cant,
            pu: values.pu,
            docNum: values.docNum,
            bancoPagoId: values.bancoPagoId,
            file: values.file,
            fileName: values.fileName,
            proveedorId: values.proveedorId,
            efectivo: values.efectivo,
            nroReferencia: values.nroReferencia,
            metodoPago: values.metodoPago
          });
        }}
        onCancel={() => toast.dismiss(t.id)}
      />
    ), {
      duration: 80000,
      position: 'top-center',
      style: {
        maxWidth: '520px',
        width: '100%',
        padding: '16px',
        borderRadius: '16px',
        background: '#ffffff',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }
    });
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
    if (!esPrivilegiado) {
      toast.error('No tiene privilegios para registrar pagos.');
      return;
    }
    const item = renglones.find(r => r.id === id);
    if (!item) return;
    if (!overrideValues && !item.hasChanges) return;

    setLoading(true);
    try {
      const cantProcesar = overrideValues ? overrideValues.cant : Number(item.compra_actual_cant || 0);
      const puProcesar = overrideValues ? overrideValues.pu : Number(item.compra_actual_pu || 0);
      const docNumProcesar = overrideValues ? overrideValues.docNum : item.doc_numero_actual;
      const bancoPagoId = overrideValues?.bancoPagoId || null;
      const esEfectivo = overrideValues?.efectivo || false;
      const selectedProveedorId = overrideValues?.proveedorId || item.proveedor_seleccionado_id || null;
      const nroReferenciaProcesar = overrideValues?.nroReferencia || null;

      if (!docNumProcesar || !docNumProcesar.trim()) {
        toast.error('Error: El número de documento es obligatorio.');
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

      const proveedorSelec = proveedores.find(p => String(p.id) === String(selectedProveedorId));
      const bancoSelec = bancos.find(b => b.id === bancoPagoId);

      const nuevaTransaccion = {
        fecha: new Date().toISOString(),
        cant: cantProcesar,
        pu: puProcesar,
        metodo_pago: overrideValues?.metodoPago || (esEfectivo
          ? (bancoSelec ? (bancoSelec.moneda === 'USD' ? '$ / $ (Efectivo)' : '$ / BS (Efectivo)') : '$ / $ (Efectivo)')
          : (bancoSelec?.moneda === 'USD' ? '$ / $' : '$ / BS')),
        proveedor_id: selectedProveedorId ? (Number(selectedProveedorId) || selectedProveedorId) : null,
        proveedor_nombre: proveedorSelec?.razon_social || 'Pago Directo / Sin Proveedor',
        banco_pago_id: bancoPagoId || null,
        banco_nombre: bancoSelec?.nombre || (esEfectivo ? 'Efectivo' : ''),
        usuario_id: currentUser?.id,
        usuario_nombre: `${currentUser?.nombre} ${currentUser?.apellido}`,
        doc_tipo: item.doc_tipo_actual || 'FAC',
        doc_numero: docNumProcesar,
        efectivo: esEfectivo,
        nro_referencia: nroReferenciaProcesar
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
        metodo_pago_actual: overrideValues?.metodoPago || item.metodo_pago_actual || (bancoSelec?.moneda === 'USD' ? '$ / $' : '$ / BS'),
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
          total_usd: totalDinamicoReal * (ticketSeleccionado?.con_iva !== false ? 1.16 : 1.00),
          banco_pago_id: bancoPagoId || ticketSeleccionado.banco_pago_id || null,
          factura_url: serializedUrls
        })
        .eq('id', ticketSeleccionado.id);
      if (error) throw error;
      setRenglones(nuevosRenglones);
      setTicketSeleccionado(prev => prev ? { ...prev, items: nuevosRenglones, banco_pago_id: bancoPagoId || prev.banco_pago_id || null, factura_url: serializedUrls } : null);
      toast.success('Ítem guardado con éxito.');
      await fetchHistorial();
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const eliminarEntradaHistorial = async (idRenglon, indexHistorial) => {
    if (!esPrivilegiado) {
      toast.error('No tiene privilegios para eliminar registros de pago.');
      return;
    }
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
    if (!esPrivilegiado) {
      toast.error('No tiene privilegios para eliminar registros de pago.');
      return;
    }
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
        .update({ items: renglonesActualizados, total_usd: totalDinamicoReal * (ticketSeleccionado?.con_iva !== false ? 1.16 : 1.00) })
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

  const iniciarEdicionTx = (renglonId, index, tx) => {
    setTxEditando({ renglonId, txIndex: index });
    setTxEditandoData({
      fecha: tx.fecha || new Date().toISOString(),
      doc_tipo: tx.doc_tipo || 'FAC',
      doc_numero: tx.doc_numero || '',
      banco_pago_id: tx.banco_pago_id || '',
      banco_nombre: tx.banco_nombre || '',
      cant: tx.cant || 0,
      pu: tx.pu || 0,
      nro_referencia: tx.nro_referencia || '',
      efectivo: tx.efectivo || false,
      proveedor_id: tx.proveedor_id || null,
      proveedor_nombre: tx.proveedor_nombre || 'Pago Directo / Sin Proveedor',
      metodo_pago: tx.metodo_pago || '$ / $'
    });
  };

  const guardarEdicionTx = async (renglonId, index) => {
    if (loading) return;
    if (!esPrivilegiado) {
      toast.error('No tiene privilegios para modificar la información de pago.');
      return;
    }
    const r = renglones.find(item => item.id === renglonId);
    if (!r) return;

    if (!txEditandoData.doc_numero.trim()) {
      toast.error('El número de documento es obligatorio.');
      return;
    }

    if (txEditandoData.cant <= 0) {
      toast.error('Ingrese una cantidad mayor a 0.');
      return;
    }

    const itemsSinEste = (r.historial_compras || []).filter((_, idx) => idx !== index);
    const totalCompradoOtros = itemsSinEste.reduce((sum, h) => sum + (h.cant || 0), 0);
    const maximoPermitido = r.cantidad_pedida - totalCompradoOtros;
    if (txEditandoData.cant > maximoPermitido) {
      toast.error(`La cantidad no puede superar el saldo pendiente disponible (${maximoPermitido})`);
      return;
    }

    setLoading(true);
    try {
      const bancoSelec = bancos.find(b => b.id === txEditandoData.banco_pago_id);
      const updatedTx = {
        ...r.historial_compras[index],
        fecha: txEditandoData.fecha,
        doc_tipo: txEditandoData.doc_tipo,
        doc_numero: txEditandoData.doc_numero,
        banco_pago_id: txEditandoData.banco_pago_id || null,
        banco_nombre: bancoSelec?.nombre || (txEditandoData.efectivo ? 'Efectivo' : ''),
        cant: txEditandoData.cant,
        pu: txEditandoData.pu,
        metodo_pago: txEditandoData.metodo_pago || (txEditandoData.efectivo
          ? (bancoSelec ? (bancoSelec.moneda === 'USD' ? '$ / $ (Efectivo)' : '$ / BS (Efectivo)') : '$ / $ (Efectivo)')
          : (bancoSelec?.moneda === 'USD' ? '$ / $' : '$ / BS')),
        efectivo: txEditandoData.efectivo,
        nro_referencia: txEditandoData.nro_referencia || null,
        proveedor_id: txEditandoData.proveedor_id ? (Number(txEditandoData.proveedor_id) || txEditandoData.proveedor_id) : null,
        proveedor_nombre: txEditandoData.proveedor_nombre || 'Pago Directo / Sin Proveedor'
      };

      const nuevoHistorial = r.historial_compras.map((h, idx) => idx === index ? updatedTx : h);
      const nuevaCantComprada = totalCompradoOtros + txEditandoData.cant;
      const nuevaCantPendiente = Math.max(0, r.cantidad_pedida - nuevaCantComprada);

      let nuevoStatus = r.status;
      if (nuevaCantPendiente === 0) nuevoStatus = 'Completado';
      else if (nuevaCantComprada > 0) nuevoStatus = 'Parcial';
      else nuevoStatus = 'En Espera';

      const renglonProcesado = {
        ...r,
        cantidad_comprada: nuevaCantComprada,
        cantidad_pendiente: nuevaCantPendiente,
        historial_compras: nuevoHistorial,
        status: nuevoStatus,
        pu: txEditandoData.pu || r.pu,
        hasChanges: false
      };

      const nuevosRenglones = renglones.map(item => item.id === renglonId ? renglonProcesado : item);
      const totalDinamicoReal = nuevosRenglones.reduce((acc, item) => {
        const ejecutadoItem = (item.historial_compras || []).reduce((sum, t) => sum + ((Number(t.cant) || 0) * (Number(t.pu) || 0)), 0);
        const estimadoPendiente = (Number(item.cantidad_pendiente) || 0) * Number(item.pu_estimado || item.pu || 0);
        return acc + ejecutadoItem + estimadoPendiente;
      }, 0);

      const primerBancoIdValido = nuevosRenglones.flatMap(item => (item.historial_compras || []).map(h => h.banco_pago_id)).filter(Boolean)[0] || null;

      const { error } = await supabase
        .from('tickets_directos')
        .update({
          items: nuevosRenglones,
          total_usd: totalDinamicoReal * (ticketSeleccionado?.con_iva !== false ? 1.16 : 1.00),
          banco_pago_id: primerBancoIdValido
        })
        .eq('id', ticketSeleccionado.id);

      if (error) throw error;
      setRenglones(nuevosRenglones);
      setTicketSeleccionado(prev => prev ? {
        ...prev,
        items: nuevosRenglones,
        banco_pago_id: primerBancoIdValido
      } : null);

      toast.success('Pago editado correctamente.');
      setTxEditando(null);
      setTxEditandoData(null);
      await fetchHistorial();
    } catch (err) {
      toast.error('Error al guardar edición: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // LÓGICA DE ACTUALIZACIÓN DE PAGO
  // ==========================================
  const handleImagenChange = (e) => {
    const files = Array.from(e.target.files);
    const filesValidos = [];
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`El archivo "${file.name}" supera el límite de 5MB y no será cargado.`);
      } else {
        filesValidos.push(file);
      }
    }
    if (filesValidos.length > 0) {
      setImagenesArchivos(prev => [...prev, ...filesValidos]);
      const newUrls = filesValidos.map(file => URL.createObjectURL(file));
      setImagenesUrlsPreview(prev => [...prev, ...newUrls]);
      const newNames = filesValidos.map(file => file.name.split('.')[0]);
      setImagenesNombres(prev => [...prev, ...newNames]);
      setMostrarSoportes(true);
    }
  };

  const quitarArchivoTemporal = (index) => {
    setImagenesArchivos(prev => prev.filter((_, i) => i !== index));
    setImagenesUrlsPreview(prev => prev.filter((_, i) => i !== index));
    setImagenesNombres(prev => prev.filter((_, i) => i !== index));
  };
  const actualizarPago = async () => {
    const existingUrls = parsearFacturaUrls(ticketSeleccionado.factura_url);
    if (!modoEdicion && !imagenesArchivos.length && existingUrls.length === 0) {
      return toast.error("Debe adjuntar al menos una imagen o comprobante antes de registrar y procesar el pago.");
    }
    for (let i = 0; i < imagenesArchivos.length; i++) {
      if (!imagenesNombres[i] || !imagenesNombres[i].trim()) {
        return toast.error(`Debe asignar un nombre al soporte "${imagenesArchivos[i].name}" antes de guardar.`);
      }
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

      // Auto-procesar renglones que tienen Número de documento escrito pero no se ha hecho clic en "Marcar Pagado" (solo fuera de modoEdicion)
      const renglonesListos = modoEdicion ? renglones : renglones.map(r => {
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

      // El estatus global del ticket depende de si hay compras y saldos pendientes
      const tieneCompras = renglonesListos.some(r => (r.cantidad_comprada || 0) > 0);
      const tienePendientes = renglonesListos.some(r => r.cantidad_pendiente > 0);
      const estatusFinal = tienePendientes ? (tieneCompras ? 'Parcial' : 'Emitido') : 'Pagado';

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
        total_usd: totalDinamicoReal * (ticketSeleccionado?.con_iva !== false ? 1.16 : 1.00)
      };

      if (renglonesListos.length > 0) {
        updatePayload.justificacion = ticketSeleccionado.justificacion || renglonesListos[0].desc || renglonesListos[0].descripcion || '';
      }

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
        .update({
          observaciones: obsTemporal
        })
        .eq('id', ticketSeleccionado.id);

      if (error) throw error;
      setTicketSeleccionado({
        ...ticketSeleccionado,
        observaciones: obsTemporal
      });
      setEditandoObs(false);
      const hasObservaciones = !!obsTemporal && 
                               obsTemporal.trim() !== '' && 
                               obsTemporal.trim().toLowerCase() !== 'sin observaciones registradas.';
      setMostrarObservaciones(hasObservaciones);
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
      const hasSoportes = nuevasUrls.length > 0;
      setMostrarSoportes(hasSoportes);
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
    const esAutorizado = currentUser?.correo?.toLowerCase() === 'jcontreras.totalclean@gmail.com';

    if (!esAutorizado) {
      toast.error("Solo el Administrador jcontreras.totalclean@gmail.com tiene permisos para eliminar tickets.");
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
  // ==========================================
  // FILTRADO COMPARTIDO DE TICKETS PARA EXCEL Y TABLA
  // ==========================================
  const filtradosTickets = useMemo(() => {
    return historialTickets.filter(t => {
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
  }, [historialTickets, busqueda, filtroStatus, filtroGerencia, filtroCategoria, filtroCC, filtroFechaDesde, filtroFechaHasta]);

  // ==========================================
  // EXPORTACIONES A EXCEL
  // ==========================================
  const exportPendingToExcel = async () => {
    const pendientes = filtradosTickets.filter(t => {
      const statusUpper = (t.status || '').toUpperCase().trim();
      return statusUpper !== 'PAGADO' && statusUpper !== 'RECHAZADO' && statusUpper !== 'ANULADO' && statusUpper !== 'COMPLETADO';
    });
    if (pendientes.length === 0) {
      toast.error("No hay tickets pendientes por pagar en la selección actual.");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Pendientes por Pagar');

      // Fila de Título
      worksheet.mergeCells('A1:I1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'TOTAL CLEAN C.A. - TICKETS PENDIENTES POR PAGAR';
      titleCell.font = { name: 'Arial Black', size: 14, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } }; // Naranja
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 40;

      // Encabezados
      const headers = ['ID', 'FECHA SOLICITUD', 'CATEGORÍA', 'DESCRIPCIÓN', 'CENTRO DE COSTO', 'GERENCIA', 'MONEDA DE PAGO', 'STATUS', 'TOTAL ($)'];
      worksheet.addRow(headers);
      const headerRow = worksheet.getRow(2);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(2).height = 25;

      // Datos
      pendientes.forEach(t => {
        const d = parseSafeDate(t.fecha_emision);
        const fechaStr = d && !isNaN(d.getTime()) ? d : 'N/A';
        const categ = (t.items || []).map(it => it.clasificacion || it.categoria || 'Sin categoría').filter(Boolean).join(', ') || 'Sin categoría';
        const justif = t.justificacion || (t.items || []).map(it => it.desc || it.descripcion).filter(Boolean).join(', ') || 'Sin justificación';
        const cc = t.centro_costo || (t.items || []).map(it => it.cc || it.centro_costo).filter(Boolean).join(', ') || '---';
        const gerencia = t.departamento || 'No especificado';
        const total = Number(t.total_usd) || 0;

        const statusUpper = (t.status || '').toUpperCase().trim();
        const statusText = statusUpper === 'PARCIAL' ? 'Parcialmente Pagado' : 'Pendiente por Pagar';

        const metodosPago = (t.items || []).flatMap(r => (r.historial_compras || []).map(h => h.metodo_pago)).filter(Boolean);
        let monedaPago = '—';
        if (metodosPago.length > 0) {
          monedaPago = Array.from(new Set(metodosPago)).join(' / ');
        } else {
          const metodosItems = Array.from(new Set(
            (t.items || []).map(r => r.metodo_pago_actual || (r.puBs > 0 ? '$ / BS' : '$ / $')).filter(Boolean)
          ));
          if (metodosItems.length > 0) {
            monedaPago = metodosItems.join(' / ');
          }
        }

        const row = worksheet.addRow([
          t.codigo_control || `TX-${String(t.id).padStart(4, '0')}`,
          fechaStr,
          categ,
          justif,
          cc,
          gerencia,
          monedaPago,
          statusText,
          total
        ]);

        if (fechaStr !== 'N/A') {
          row.getCell(2).numFmt = 'dd/mm/yyyy';
        }
        row.getCell(1).numFmt = '@'; // ID como texto
        row.getCell(9).numFmt = '"$"#,##0.00;[Red]"$"#,##0.00';
      });

      // Anchos de columnas
      worksheet.columns = [
        { key: 'id', width: 15 },
        { key: 'fecha', width: 18 },
        { key: 'categoria', width: 25 },
        { key: 'descripcion', width: 45 },
        { key: 'cc', width: 25 },
        { key: 'gerencia', width: 25 },
        { key: 'moneda', width: 20 },
        { key: 'status', width: 20 },
        { key: 'total', width: 18 }
      ];

      // Formatos de alineación y bordes
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 2) {
          row.getCell(1).alignment = { horizontal: 'center' };
          row.getCell(2).alignment = { horizontal: 'center' };
          row.getCell(7).alignment = { horizontal: 'center' };
          row.getCell(8).alignment = { horizontal: 'center' };
          row.getCell(9).alignment = { horizontal: 'right' };

          row.eachCell(cell => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
          });
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Tickets_Pendientes_Pago_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success("Excel de pendientes generado.");
    } catch (error) {
      console.error("Error al exportar a Excel:", error);
      toast.error("Error al generar el reporte Excel.");
    }
  };

  const exportProcessedToExcel = async () => {
    const procesados = filtradosTickets.filter(t => {
      const statusUpper = (t.status || '').toUpperCase().trim();
      return statusUpper === 'PAGADO' || statusUpper === 'COMPLETADO';
    });
    if (procesados.length === 0) {
      toast.error("No hay tickets procesados (pagados) en la selección actual.");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Tickets Procesados');

      // Fila de Título
      worksheet.mergeCells('A1:J1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'TOTAL CLEAN C.A. - TICKETS PROCESADOS (PAGADOS)';
      titleCell.font = { name: 'Arial Black', size: 14, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }; // Verde
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 40;

      // Encabezados
      const headers = [
        'ID',
        'FECHA SOLICITUD',
        'CATEGORÍA',
        'DESCRIPCIÓN',
        'CENTRO DE COSTO',
        'GERENCIA',
        'BANCO ORIGEN',
        'NRO DE FACTURA',
        'NRO DE REFERENCIA',
        'MONEDA DE PAGO',
        'TOTAL ($)'
      ];
      worksheet.addRow(headers);
      const headerRow = worksheet.getRow(2);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(2).height = 25;

      // Datos
      procesados.forEach(t => {
        const d = parseSafeDate(t.fecha_emision);
        const fechaStr = d && !isNaN(d.getTime()) ? d : 'N/A';
        const categ = (t.items || []).map(it => it.clasificacion || it.categoria || 'Sin categoría').filter(Boolean).join(', ') || 'Sin categoría';
        const justif = t.justificacion || (t.items || []).map(it => it.desc || it.descripcion).filter(Boolean).join(', ') || 'Sin justificación';
        const cc = t.centro_costo || (t.items || []).map(it => it.cc || it.centro_costo).filter(Boolean).join(', ') || '---';
        const gerencia = t.departamento || 'No especificado';
        const total = Number(t.total_usd) || 0;

        // Banco de pago
        const bancoNombre = bancos.find(b => b.id === t.banco_pago_id)?.nombre
          || (() => {
            const bn = (t.items || []).flatMap(r => (r.historial_compras || []).map(h => h.banco_nombre)).filter(Boolean);
            return bn.length > 0 ? [...new Set(bn)].join(' / ') : null;
          })() || '—';

        // Factura
        const todosLosDocs = Array.from(new Set(
          (t.items || []).flatMap(r => (r.historial_compras || []).map(h => h.doc_numero)).filter(Boolean)
        )).join(', ') || '—';

        // Referencias
        const todasLasRefs = Array.from(new Set(
          (t.items || []).flatMap(r => (r.historial_compras || []).map(h => h.nro_referencia)).filter(Boolean)
        )).join(', ') || '—';

        // Moneda/Método de pago (Bs/$ o $/$)
        const metodosPago = (t.items || []).flatMap(r => (r.historial_compras || []).map(h => h.metodo_pago)).filter(Boolean);
        let metodoPagoText = '—';
        if (metodosPago.length > 0) {
          metodoPagoText = Array.from(new Set(metodosPago)).join(' / ');
        } else {
          const metodosItems = Array.from(new Set(
            (t.items || []).map(r => r.metodo_pago_actual || (r.puBs > 0 ? '$ / BS' : '$ / $')).filter(Boolean)
          ));
          if (metodosItems.length > 0) {
            metodoPagoText = metodosItems.join(' / ');
          }
        }

        const row = worksheet.addRow([
          t.codigo_control || `TX-${String(t.id).padStart(4, '0')}`,
          fechaStr,
          categ,
          justif,
          cc,
          gerencia,
          bancoNombre,
          todosLosDocs,
          todasLasRefs,
          metodoPagoText,
          total
        ]);

        if (fechaStr !== 'N/A') {
          row.getCell(2).numFmt = 'dd/mm/yyyy';
        }
        row.getCell(1).numFmt = '@'; // ID como texto
        row.getCell(8).numFmt = '@'; // Nro Factura como texto
        row.getCell(9).numFmt = '@'; // Nro Referencia como texto
        row.getCell(10).numFmt = '@'; // Método de Pago como texto
        row.getCell(11).numFmt = '"$"#,##0.00;[Red]"$"#,##0.00';
      });

      // Anchos de columnas
      worksheet.columns = [
        { key: 'id', width: 15 },
        { key: 'fecha', width: 18 },
        { key: 'categoria', width: 25 },
        { key: 'descripcion', width: 45 },
        { key: 'cc', width: 25 },
        { key: 'gerencia', width: 25 },
        { key: 'banco', width: 25 },
        { key: 'factura', width: 25 },
        { key: 'referencia', width: 20 },
        { key: 'moneda', width: 18 },
        { key: 'total', width: 18 }
      ];

      // Formatos de alineación y bordes
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 2) {
          row.getCell(1).alignment = { horizontal: 'center' };
          row.getCell(2).alignment = { horizontal: 'center' };
          row.getCell(8).alignment = { horizontal: 'center' };
          row.getCell(9).alignment = { horizontal: 'center' };
          row.getCell(10).alignment = { horizontal: 'center' };
          row.getCell(11).alignment = { horizontal: 'right' };

          row.eachCell(cell => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
          });
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Tickets_Pagados_Procesados_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success("Excel de procesados generado.");
    } catch (error) {
      console.error("Error al exportar a Excel:", error);
      toast.error("Error al generar el reporte Excel.");
    }
  };

  const exportDetailedToExcel = async () => {
    const todos = filtradosTickets.filter(t => {
      const statusUpper = (t.status || '').toUpperCase().trim();
      return statusUpper !== 'ANULADO';
    });
    if (todos.length === 0) {
      toast.error("No hay tickets en la selección actual.");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Reporte Detallado');

      // Fila de Título
      // Fila de Título
      worksheet.mergeCells('A1:K1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'TOTAL CLEAN C.A. - REPORTE DETALLADO DE TICKETS DE PAGO';
      titleCell.font = { name: 'Arial Black', size: 14, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0EA5E9' } }; // Azul
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 40;

      // Encabezados
      const headers = [
        'ID',
        'FECHA SOLICITUD',
        'CATEGORÍA',
        'DESCRIPCIÓN',
        'CENTRO DE COSTO',
        'GERENCIA',
        'BANCO ORIGEN',
        'NRO DE FACTURA',
        'NRO DE REFERENCIA',
        'MONEDA DE PAGO',
        'STATUS',
        'TOTAL ($)'
      ];
      worksheet.addRow(headers);
      const headerRow = worksheet.getRow(2);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(2).height = 25;

      // Datos
      todos.forEach(t => {
        const d = parseSafeDate(t.fecha_emision);
        const fechaStr = d && !isNaN(d.getTime()) ? d : 'N/A';
        const categ = (t.items || []).map(it => it.clasificacion || it.categoria || 'Sin categoría').filter(Boolean).join(', ') || 'Sin categoría';
        const justif = t.justificacion || (t.items || []).map(it => it.desc || it.descripcion).filter(Boolean).join(', ') || 'Sin justificación';
        const cc = t.centro_costo || (t.items || []).map(it => it.cc || it.centro_costo).filter(Boolean).join(', ') || '---';
        const gerencia = t.departamento || 'No especificado';
        const total = Number(t.total_usd) || 0;

        const statusUpper = (t.status || '').toUpperCase().trim();
        const estaPagado = statusUpper === 'PAGADO' || statusUpper === 'COMPLETADO';

        // Banco de pago
        const bancoNombre = estaPagado
          ? (bancos.find(b => b.id === t.banco_pago_id)?.nombre
            || (() => {
              const bn = (t.items || []).flatMap(r => (r.historial_compras || []).map(h => h.banco_nombre)).filter(Boolean);
              return bn.length > 0 ? [...new Set(bn)].join(' / ') : null;
            })() || '—')
          : ' --';

        // Factura
        const todosLosDocs = estaPagado
          ? (Array.from(new Set(
            (t.items || []).flatMap(r => (r.historial_compras || []).map(h => h.doc_numero)).filter(Boolean)
          )).join(', ') || '—')
          : ' --';

        // Referencias
        const todasLasRefs = estaPagado
          ? (Array.from(new Set(
            (t.items || []).flatMap(r => (r.historial_compras || []).map(h => h.nro_referencia)).filter(Boolean)
          )).join(', ') || '—')
          : ' --';

        // Moneda/Método de pago (Bs/$ o $/$)
        const metodosPago = Array.from(new Set(
          (t.items || []).flatMap(r => (r.historial_compras || []).map(h => h.metodo_pago)).filter(Boolean)
        ));
        const metodoPagoText = estaPagado
          ? (metodosPago.length > 0 ? metodosPago.join(' / ') : '—')
          : 'Aún no pagado / En espera';

        let statusText = 'Pendiente por Pagar';
        if (estaPagado) {
          statusText = 'Pagado';
        } else if (statusUpper === 'PARCIAL') {
          statusText = 'Parcialmente Pagado';
        }

        const row = worksheet.addRow([
          t.codigo_control || `TX-${String(t.id).padStart(4, '0')}`,
          fechaStr,
          categ,
          justif,
          cc,
          gerencia,
          bancoNombre,
          todosLosDocs,
          todasLasRefs,
          metodoPagoText,
          statusText,
          total
        ]);

        if (fechaStr !== 'N/A') {
          row.getCell(2).numFmt = 'dd/mm/yyyy';
        }
        row.getCell(1).numFmt = '@'; // ID como texto
        row.getCell(8).numFmt = '@'; // Nro Factura como texto
        row.getCell(9).numFmt = '@'; // Nro Referencia como texto
        row.getCell(10).numFmt = '@'; // Método de Pago como texto
        row.getCell(11).numFmt = '@'; // Status como texto
        row.getCell(12).numFmt = '"$"#,##0.00;[Red]"$"#,##0.00';
      });

      // Anchos de columnas
      worksheet.columns = [
        { key: 'id', width: 15 },
        { key: 'fecha', width: 18 },
        { key: 'categoria', width: 25 },
        { key: 'descripcion', width: 45 },
        { key: 'cc', width: 25 },
        { key: 'gerencia', width: 25 },
        { key: 'banco', width: 25 },
        { key: 'factura', width: 25 },
        { key: 'referencia', width: 20 },
        { key: 'moneda', width: 25 },
        { key: 'status', width: 20 },
        { key: 'total', width: 18 }
      ];

      // Formatos de alineación y bordes
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 2) {
          row.getCell(1).alignment = { horizontal: 'center' };
          row.getCell(2).alignment = { horizontal: 'center' };
          row.getCell(8).alignment = { horizontal: 'center' };
          row.getCell(9).alignment = { horizontal: 'center' };
          row.getCell(10).alignment = { horizontal: 'center' };
          row.getCell(11).alignment = { horizontal: 'center' };
          row.getCell(12).alignment = { horizontal: 'right' };

          row.eachCell(cell => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
          });
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Reporte_Detallado_Tickets_Pago_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success("Reporte Detallado generado.");
    } catch (error) {
      console.error("Error al exportar a Excel:", error);
      toast.error("Error al generar el reporte Excel.");
    }
  };

  const renderHistorial = () => {
    const filtrados = filtradosTickets;

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
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderLeft: '6px solid #0ea5e9',
          paddingLeft: '16px',
          marginBottom: '30px',
          flexWrap: 'wrap',
          gap: '15px'
        }}>
          <div>
            <h1 style={{ margin: 0, color: '#0f172a', fontSize: '1.8rem', fontWeight: '900', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.5px' }}>
              Control de Tickets de Pago
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem', fontWeight: '500', fontFamily: 'Inter, sans-serif' }}>
              Gestión centralizada de emisiones y egresos
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <motion.button
              onClick={exportPendingToExcel}
              whileHover={{ scale: 1.04, boxShadow: '0 6px 20px rgba(245, 158, 11, 0.25)' }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '700',
                fontFamily: 'Inter, sans-serif',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)'
              }}
            >
              <FileSpreadsheet size={15} />
              Excel Pendientes
            </motion.button>

            <motion.button
              onClick={exportProcessedToExcel}
              whileHover={{ scale: 1.04, boxShadow: '0 6px 20px rgba(16, 185, 129, 0.25)' }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '700',
                fontFamily: 'Inter, sans-serif',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)'
              }}
            >
              <FileSpreadsheet size={15} />
              Excel Procesados
            </motion.button>

            <motion.button
              onClick={exportDetailedToExcel}
              whileHover={{ scale: 1.04, boxShadow: '0 6px 20px rgba(14, 165, 233, 0.25)' }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '700',
                fontFamily: 'Inter, sans-serif',
                boxShadow: '0 4px 12px rgba(14, 165, 233, 0.15)'
              }}
            >
              <FileSpreadsheet size={15} />
              Reporte Detallado
            </motion.button>
          </div>
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
                      const d = parseSafeDate(ticket.fecha_emision);
                      if (d) fechaStr = format(d, 'dd/MM/yyyy');
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{
                            fontSize: '0.82rem',
                            fontWeight: '700',
                            color: '#334155'
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
                          const refs = [...new Set(
                            (ticket.items || []).flatMap(r => (r.historial_compras || []).map(h => h.nro_referencia)).filter(Boolean)
                          )];
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {bancoNombre ? (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: '700', color: '#334155' }}>
                                  <Landmark size={13} color="#64748b" style={{ flexShrink: 0 }} />
                                  <span>{bancoNombre}</span>
                                </div>
                              ) : <span style={{ color: '#cbd5e1', fontSize: '11px' }}>—</span>}
                              {refs.length > 0 && (
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', marginTop: '2px' }}>
                                  Ref: {refs.join(', ')}
                                </div>
                              )}
                            </div>
                          );
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
                          {currentUser?.correo?.toLowerCase() === 'jcontreras.totalclean@gmail.com' && (
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
                <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.5rem', fontWeight: '800' }}>Ticket de pago</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px' }}>
                  <div className={`badge-status ${t.status?.toLowerCase() || 'emitido'}`} style={{ fontSize: '10px', height: '22px' }}>
                    {t.status?.toUpperCase() || 'EMITIDO'}
                  </div>
                  {t.solicitud_ref && (
                    <div style={{
                      fontSize: '10px',
                      height: '22px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0 10px',
                      borderRadius: '6px',
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      fontWeight: '800'
                    }}>
                      {t.solicitud_ref}
                    </div>
                  )}
                </div>
              </div>

              {/* DERECHA: ID TICKET */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '25px', marginRight: '50px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: '1.8rem',
                    fontWeight: '1000',
                    color: '#1e3a8a',
                    lineHeight: '1',
                    letterSpacing: '0.05em'
                  }}>
                    {t.codigo_control}
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
                  <label className="stat-label">FECHA PAGO</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px', color: '#1e293b', fontWeight: '600' }}>
                    <Calendar size={18} color="#94a3b8" />
                    {(() => {
                      const allTx = (t.items || []).flatMap(r => r.historial_compras || []);
                      const dates = allTx.map(h => h.fecha_pago || h.fecha).filter(Boolean);
                      if (dates.length === 0) return 'Pendiente';
                      const maxDate = new Date(Math.max(...dates.map(d => new Date(d).getTime())));
                      return maxDate.toLocaleDateString();
                    })()}
                  </div>
                </div>
              </div>
              <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '15px 0' }}></div>
              <div style={{
                backgroundColor: 'rgba(14, 165, 233, 0.03)',
                borderLeft: '4px solid #0ea5e9',
                padding: '12px 18px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}>
                <div style={{
                  backgroundColor: 'rgba(14, 165, 233, 0.1)',
                  color: '#0ea5e9',
                  borderRadius: '6px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Ticket size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="stat-label" style={{ display: 'block', marginBottom: '2px', fontSize: '9px', color: '#0369a1', fontWeight: '800', letterSpacing: '0.5px' }}>
                    ASUNTO / MOTIVO DEL PAGO
                  </label>
                  <div style={{ color: '#1e293b', fontWeight: '700', fontSize: '0.95rem', lineHeight: '1.4' }}>
                    {t.items?.[0]?.justificacion_detallada || t.justificacion || 'Sin asunto especificado'}
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
                      <th style={{ width: '80px', textAlign: 'center' }}>CANTIDAD</th>
                      <th style={{ width: '100px', textAlign: 'center' }}>P.U. ($)</th>
                      <th style={{ width: '160px' }}>PROVEEDOR</th>
                      <th style={{ width: '120px' }}>DOCUMENTO</th>
                      <th style={{ width: '220px' }}>BANCO / REF. BANCARIA</th>
                      <th style={{ width: '100px', textAlign: 'center' }}>MONEDA</th>
                      <th style={{ width: '110px', textAlign: 'right' }}>TOTAL</th>
                      <th style={{ width: '140px', textAlign: 'center' }}>ESTADO PAGO</th>
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
                            {modoEdicion ? (
                              <input
                                type="text"
                                className="premium-edit-input"
                                value={r.desc || r.descripcion || ''}
                                onChange={(e) => {
                                  actualizarFila(r.id, 'desc', e.target.value);
                                  actualizarFila(r.id, 'descripcion', e.target.value);
                                }}
                                style={{ width: '100%', fontWeight: '600', fontSize: '0.85rem' }}
                              />
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{r.desc || r.descripcion}</div>
                                {ticketSeleccionado?.observaciones && (
                                  <MessageSquare
                                    size={14}
                                    style={{ color: '#8b5cf6', flexShrink: 0, cursor: 'pointer' }}
                                    title={`Observaciones: ${ticketSeleccionado.observaciones}`}
                                    onClick={() => setMostrarObservaciones(!mostrarObservaciones)}
                                  />
                                )}
                              </div>
                            )}
                            {modoEdicion ? (
                              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                <select
                                  className="premium-edit-input"
                                  value={r.cc || ''}
                                  onChange={(e) => actualizarFila(r.id, 'cc', e.target.value)}
                                  style={{ fontSize: '0.7rem', padding: '4px 6px', width: '50%', backgroundColor: 'white' }}
                                >
                                  <option value="">CC (Seleccionar)...</option>
                                  {centrosCostoUnicos.map(cc => (
                                    <option key={cc.id} value={cc.nombre}>{cc.nombre}</option>
                                  ))}
                                </select>
                                <select
                                  className="premium-edit-input"
                                  value={r.categoria || ''}
                                  onChange={(e) => actualizarFila(r.id, 'categoria', e.target.value)}
                                  style={{ fontSize: '0.7rem', padding: '4px 6px', width: '50%', backgroundColor: 'white' }}
                                >
                                  <option value="">Categoría...</option>
                                  {todasCategoriasUnicas.map(cat => (
                                    <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>CC: {r.cc} | {r.categoria}</div>
                            )}
                          </td>
                          {/* CANTIDAD */}
                          <td style={{ textAlign: 'center' }}>
                            {modoEdicion ? (
                              <input
                                type="number"
                                className="premium-edit-input"
                                value={r.cantidad_pedida || ''}
                                onChange={(e) => {
                                  const val = Math.max(1, Number(e.target.value) || 0);
                                  actualizarFila(r.id, 'cantidad_pedida', val);
                                  const compras = r.cantidad_comprada || 0;
                                  actualizarFila(r.id, 'cantidad_pendiente', Math.max(0, val - compras));
                                }}
                                style={{ width: '75px', textAlign: 'center', fontWeight: 'bold' }}
                              />
                            ) : (
                              <span style={{ fontWeight: 'bold' }}>{r.cantidad_pedida}</span>
                            )}
                          </td>
                          {/* P.U. ($) */}
                          <td style={{ textAlign: 'center' }}>
                            {modoEdicion ? (
                              <input
                                type="number"
                                step="0.01"
                                className="premium-edit-input"
                                value={r.pu || r.puUsd || ''}
                                onChange={(e) => {
                                  const val = Math.max(0, Number(e.target.value) || 0);
                                  actualizarFila(r.id, 'pu', val);
                                  actualizarFila(r.id, 'puUsd', val);
                                  actualizarFila(r.id, 'compra_actual_pu', val);
                                }}
                                style={{ textAlign: 'center', width: '90px' }}
                              />
                            ) : (
                              <span style={{ fontWeight: '600', color: '#475569' }}>
                                $ {(r.pu || r.puUsd || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </td>
                          {/* PROVEEDOR */}
                          <td>
                            {(() => {
                              const transacciones = r.historial_compras || [];
                              const proveedoresNombres = Array.from(new Set(transacciones.map(h => h.proveedor_nombre).filter(Boolean)));
                              return proveedoresNombres.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  {proveedoresNombres.map((pn, pIdx) => (
                                    <span key={pIdx} style={{ fontSize: '0.75rem', color: '#334155', fontWeight: '600' }}>
                                      {pn}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ fontSize: '0.7rem', color: '#cbd5e1', fontStyle: 'italic' }}>—</span>
                              );
                            })()}
                          </td>
                          {/* DOCUMENTO */}
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {(() => {
                                const txList = r.historial_compras || [];
                                const docsRenglon = Array.from(new Set(txList.map(h => h.doc_numero).filter(Boolean)));
                                return (
                                  <>
                                    {docsRenglon.length > 0 && (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '4px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                          {docsRenglon.map((doc, dIdx) => (
                                            <span key={dIdx} style={{ fontSize: '0.75rem', color: '#1e3a8a', fontWeight: '600' }}>
                                              {doc}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {modoEdicion ? (
                                      <input
                                        type="text"
                                        className="premium-edit-input"
                                        placeholder="Número  Documento"
                                        value={r.doc_numero_actual || ''}
                                        onChange={(e) => actualizarFila(r.id, 'doc_numero_actual', e.target.value)}
                                        style={{ fontSize: '0.7rem', width: '100px' }}
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
                          {/* BANCO / REF. BANCARIA */}
                          <td>
                            {(() => {
                              const transacciones = r.historial_compras || [];
                              const bancosRenglon = Array.from(new Set(transacciones.map(h => h.banco_nombre).filter(Boolean)));
                              const refsItem = Array.from(new Set(transacciones.map(h => h.nro_referencia).filter(Boolean)));

                              if (bancosRenglon.length === 0 && refsItem.length === 0) {
                                return <span style={{ fontSize: '0.7rem', color: '#cbd5e1', fontStyle: 'italic' }}>—</span>;
                              }

                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    {bancosRenglon.map((bnk, bIdx) => (
                                      <span key={bIdx} style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: '600' }}>
                                        {bnk}
                                      </span>
                                    ))}
                                    {refsItem.map((ref, rIdx) => (
                                      <span key={rIdx} style={{ fontSize: '0.75rem', color: '#475569', fontWeight: '600' }}>
                                        Ref: {ref}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                          {/* MONEDA */}
                          <td style={{ textAlign: 'center' }}>
                            {r.cantidad_pendiente === 0 ? (
                              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold' }}>
                                {(() => {
                                  const transacciones = r.historial_compras || [];
                                  const metodos = Array.from(new Set(transacciones.map(h => h.metodo_pago).filter(Boolean)));
                                  return metodos.length > 0 ? metodos.join(' / ') : (r.metodo_pago_actual || (r.puBs > 0 ? '$ / BS' : '$ / $'));
                                })()}
                              </span>
                            ) : (
                              <select
                                className="premium-edit-input"
                                value={r.metodo_pago_actual || (r.puBs > 0 ? '$ / BS' : '$ / $')}
                                onChange={(e) => actualizarFila(r.id, 'metodo_pago_actual', e.target.value)}
                                style={{ fontSize: '0.7rem', padding: '4px 6px', width: '90px', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                              >
                                <option value="$ / $">$ / $</option>
                                <option value="$ / BS">$ / BS</option>
                              </select>
                            )}
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
                              esPrivilegiado ? (
                                <button
                                  onClick={() => pagarTodoRenglon(r.id)}
                                  className="btn-tc btn-tc-success"
                                  style={{ padding: '8px 15px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold', width: '100%' }}
                                  disabled={loading}
                                >
                                  <DollarSign size={14} /> MARCAR PAGADO
                                </button>
                              ) : (
                                <div style={{ color: '#ca8a04', fontWeight: 'bold', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                                  PENDIENTE
                                </div>
                              )
                            )}
                          </td>
                        </tr>

                        {/* --- HISTORIAL EXPANDIBLES --- */}
                        {(expandirHistorial[r.id] || (modoEdicion && esPrivilegiado)) && (
                          <tr key={`expand-${r.id}`} style={{ backgroundColor: '#f8fafc' }}>
                            <td colSpan="10" style={{ padding: 0 }}>
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                                style={{ padding: '15px', overflow: 'hidden' }}
                              >
                                <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ color: '#94a3b8', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>CANT</th>
                                      <th style={{ padding: '10px 8px', textAlign: 'right' }}>P.U.</th>
                                      <th style={{ padding: '10px 8px' }}>PROVEEDOR</th>
                                      <th style={{ padding: '10px 8px' }}>DOC</th>
                                      <th style={{ padding: '10px 8px' }}>BANCO / REF. BANCARIA</th>
                                      <th style={{ padding: '10px 8px' }}>MONEDA</th>
                                      <th style={{ padding: '10px 8px', textAlign: 'right' }}>TOTAL</th>
                                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>ACCIONES</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(r.historial_compras || []).map((h, hIdx) => {
                                      const uniqueTxKey = h.id || `tx-${h.fecha}-${h.doc_numero || hIdx}-${hIdx}`;
                                      const estaEditandoEste = txEditando && txEditando.renglonId === r.id && txEditando.txIndex === hIdx;

                                      if (estaEditandoEste) {
                                        return (
                                          <tr key={uniqueTxKey} className="tx-edit-row">
                                            {/* 1. CANT */}
                                            <td style={{ padding: '8px', textAlign: 'center' }}>
                                              <input
                                                type="number"
                                                value={txEditandoData.cant}
                                                onChange={(e) => {
                                                  const val = Math.max(0, Number(e.target.value) || 0);
                                                  setTxEditandoData(prev => ({ ...prev, cant: val }));
                                                }}
                                                className="premium-edit-input"
                                                style={{ width: '60px', textAlign: 'center' }}
                                              />
                                            </td>
                                            {/* 2. P.U. */}
                                            <td style={{ padding: '8px', textAlign: 'right' }}>
                                              <input
                                                type="number"
                                                step="0.01"
                                                value={txEditandoData.pu}
                                                onChange={(e) => {
                                                  const val = Math.max(0, Number(e.target.value) || 0);
                                                  setTxEditandoData(prev => ({ ...prev, pu: val }));
                                                }}
                                                className="premium-edit-input"
                                                style={{ width: '80px', textAlign: 'right' }}
                                              />
                                            </td>
                                            {/* 3. PROVEEDOR */}
                                            <td style={{ padding: '8px' }}>
                                              <select
                                                value={txEditandoData.proveedor_id || ''}
                                                onChange={(e) => {
                                                  const selectedId = e.target.value;
                                                  const p = proveedores.find(item => String(item.id) === String(selectedId));
                                                  setTxEditandoData(prev => ({
                                                    ...prev,
                                                    proveedor_id: selectedId ? (Number(selectedId) || selectedId) : null,
                                                    proveedor_nombre: p ? p.razon_social : 'Pago Directo / Sin Proveedor'
                                                  }));
                                                }}
                                                className="premium-edit-input"
                                                style={{ width: '160px', backgroundColor: 'white' }}
                                              >
                                                <option value="">Pago Directo / Sin Proveedor</option>
                                                {proveedores.map(p => (
                                                  <option key={p.id} value={p.id}>{p.razon_social}</option>
                                                ))}
                                              </select>
                                            </td>
                                            {/* 4. DOC */}
                                            <td style={{ padding: '8px' }}>
                                              <input
                                                type="text"
                                                placeholder="Número Doc"
                                                value={txEditandoData.doc_numero}
                                                onChange={(e) => setTxEditandoData(prev => ({ ...prev, doc_numero: e.target.value }))}
                                                className="premium-edit-input"
                                                style={{ width: '100px' }}
                                              />
                                            </td>
                                            {/* 5. BANCO / REF. BANCARIA */}
                                            <td style={{ padding: '8px' }}>
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <select
                                                  value={txEditandoData.banco_pago_id || ''}
                                                  onChange={(e) => {
                                                    const selectedId = e.target.value;
                                                    const b = bancos.find(item => item.id === selectedId);
                                                    setTxEditandoData(prev => ({ ...prev, banco_pago_id: selectedId, banco_nombre: b ? b.nombre : '' }));
                                                  }}
                                                  className="premium-edit-input"
                                                  style={{ width: '100%', fontSize: '0.7rem', padding: '2px 4px', backgroundColor: 'white' }}
                                                >
                                                  <option value="">— Banco —</option>
                                                  {bancos.map(b => (
                                                    <option key={b.id} value={b.id}>{b.nombre} ({b.moneda})</option>
                                                  ))}
                                                </select>
                                                <input
                                                  type="text"
                                                  placeholder="Número  Referencia"
                                                  value={txEditandoData.nro_referencia || ''}
                                                  onChange={(e) => setTxEditandoData(prev => ({ ...prev, nro_referencia: e.target.value }))}
                                                  className="premium-edit-input"
                                                  style={{ width: '100%', fontSize: '0.7rem', padding: '2px 4px' }}
                                                />
                                              </div>
                                            </td>
                                            {/* 6. MONEDA */}
                                            <td style={{ padding: '8px' }}>
                                              <select
                                                value={txEditandoData.metodo_pago || ''}
                                                onChange={(e) => {
                                                  const selectedVal = e.target.value;
                                                  setTxEditandoData(prev => ({
                                                    ...prev,
                                                    metodo_pago: selectedVal
                                                  }));
                                                }}
                                                className="premium-edit-input"
                                                style={{ width: '90px', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                                              >
                                                <option value="$ / $">$ / $</option>
                                                <option value="$ / BS">$ / BS</option>
                                              </select>
                                            </td>
                                            {/* 7. TOTAL */}
                                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', fontSize: '0.82rem', color: '#0f172a' }}>
                                              $ {(txEditandoData.cant * txEditandoData.pu).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                                            </td>
                                            {/* 8. ACCIONES */}
                                            <td style={{ padding: '8px', textAlign: 'center' }}>
                                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                <button
                                                  onClick={() => guardarEdicionTx(r.id, hIdx)}
                                                  className="inline-edit-btn confirm"
                                                  title="Guardar"
                                                >
                                                  ✓
                                                </button>
                                                <button
                                                  onClick={() => { setTxEditando(null); setTxEditandoData(null); }}
                                                  className="inline-edit-btn cancel"
                                                  title="Cancelar"
                                                >
                                                  ×
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      }

                                      return (
                                        <tr key={uniqueTxKey} className="tx-read-row" style={{ borderBottom: '1px solid #e2e8f0', transition: 'background-color 0.2s' }}>
                                          {/* 1. CANT */}
                                          <td style={{ textAlign: 'center', padding: '10px 8px', fontWeight: '600' }}>{h.cant}</td>
                                          {/* 2. P.U. */}
                                          <td style={{ textAlign: 'right', padding: '10px 8px', color: '#475569' }}>$ {h.pu.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                                          {/* 3. PROVEEDOR */}
                                          <td style={{ padding: '10px 8px' }}>
                                            <span style={{ fontWeight: '600', color: '#475569', fontSize: '0.8rem' }}>
                                              {h.proveedor_nombre || 'Pago Directo / Sin Proveedor'}
                                            </span>
                                          </td>
                                          {/* 4. DOC */}
                                          <td style={{ padding: '10px 8px' }}>
                                            <span style={{ fontWeight: '700', color: '#1e293b' }}>
                                              {h.doc_tipo} {h.doc_numero}
                                            </span>
                                          </td>
                                          {/* 5. BANCO / REF. BANCARIA */}
                                          <td style={{ padding: '10px 8px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                                {h.banco_nombre ? (
                                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '5px', padding: '2px 6px', fontSize: '0.65rem', fontWeight: '700' }}>
                                                    <Landmark size={9} color="#0369a1" />{h.banco_nombre}
                                                  </span>
                                                ) : !h.nro_referencia && <span style={{ color: '#cbd5e1' }}>—</span>}
                                              </div>
                                              {h.nro_referencia && (
                                                <span style={{ fontSize: '9px', backgroundColor: '#f1f5f9', color: '#64748b', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold', width: 'fit-content' }}>
                                                  Ref: {h.nro_referencia}
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          {/* 6. MONEDA */}
                                          <td style={{ padding: '10px 8px' }}>
                                            <span style={{ fontWeight: '600', color: '#64748b' }}>
                                              {h.metodo_pago || '$ / $'}
                                            </span>
                                          </td>
                                          {/* 7. TOTAL */}
                                          <td style={{ textAlign: 'right', padding: '10px 8px', fontWeight: '800', color: '#0f172a' }}>$ {(h.cant * h.pu).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                                          {/* 8. ACCIONES */}
                                          <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                                            {esPrivilegiado && modoEdicion && (
                                              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center' }}>
                                                <button
                                                  onClick={() => iniciarEdicionTx(r.id, hIdx, h)}
                                                  style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0 }}
                                                  title="Editar Pago"
                                                >
                                                  ✏️
                                                </button>
                                                <button
                                                  onClick={() => eliminarEntradaHistorial(r.id, hIdx)}
                                                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                                                  title="Eliminar Pago"
                                                >
                                                  <Trash2 size={14} />
                                                </button>
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                    {(!r.historial_compras || r.historial_compras.length === 0) && (
                                      <tr>
                                        <td colSpan="8" style={{ textAlign: 'center', padding: '10px', color: '#94a3b8' }}>No hay registros.</td>
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

            {/* GRID SIDE-BY-SIDE: SOPORTES (LEFT) Y OBSERVACIONES (RIGHT) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '20px', alignItems: 'start', marginBottom: '35px' }}>

              {/* SOPORTES Y COMPROBANTES (LEFT) */}
              <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', minHeight: '200px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800' }}>
                    📁 Soportes y Comprobantes
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setMostrarSoportes(!mostrarSoportes)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        background: mostrarSoportes ? '#64748b' : 'white',
                        color: mostrarSoportes ? 'white' : '#475569',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {mostrarSoportes ? 'Ocultar Soportes' : 'Ver Soportes'}
                    </button>
                    {esPrivilegiado && (
                      <label className="btn-tc btn-tc-primary" style={{ cursor: 'pointer', padding: '6px 12px', fontSize: '0.7rem' }}>
                        <Upload size={14} /> Adjuntar
                        <input type="file" multiple style={{ display: 'none' }} onChange={handleImagenChange} />
                      </label>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {mostrarSoportes && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '15px' }}>
                        {parsearFacturaUrls(t.factura_url).map((item, idx) => {
                          const lowerUrl = item.url.split('?')[0].toLowerCase();
                          const isPdf = lowerUrl.endsWith('.pdf');
                          const isDoc = /\.(doc|docx|xls|xlsx|ppt|pptx)$/i.test(lowerUrl);
                          const isImg = /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(lowerUrl);
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
                                ) : (isDoc || !isImg) ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                    <FileText size={32} color="#2563eb" />
                                    <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#2563eb' }}>DOC</span>
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

                              {esPrivilegiado && (
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
                              )}
                            </div>
                          );
                        })}
                        {imagenesUrlsPreview.map((url, idx) => {
                          const file = imagenesArchivos[idx];
                          const isPdf = file?.type === 'application/pdf' || file?.name?.toLowerCase().endsWith('.pdf');
                          const isDoc = file?.name && /\.(doc|docx|xls|xlsx|ppt|pptx)$/i.test(file.name);
                          const isImg = file?.type && file.type.startsWith('image/');
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
                                ) : (isDoc || !isImg) ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                    <FileText size={32} color="#2563eb" />
                                    <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#2563eb' }}>DOC</span>
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* PANEL DE OBSERVACIONES DINÁMICAS (RIGHT) */}
              <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', minHeight: '200px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800' }}>
                    <MessageSquare size={16} color="#64748b" /> Notas de Auditoría / Observaciones 💬
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarObservaciones(!mostrarObservaciones);
                      setObsTemporal(ticketSeleccionado?.observaciones || '');
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      background: mostrarObservaciones ? '#64748b' : 'white',
                      color: mostrarObservaciones ? 'white' : '#475569',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {mostrarObservaciones ? 'Ocultar Notas' : 'Ver/Editar Notas'}
                  </button>
                </div>

                <AnimatePresence>
                  {mostrarObservaciones && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {editandoObs ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <textarea
                              style={{
                                minHeight: '85px',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                fontSize: '0.85rem',
                                width: '100%',
                                boxSizing: 'border-box',
                                fontFamily: 'inherit',
                                outline: 'none',
                                color: '#334155'
                              }}
                              value={obsTemporal}
                              onChange={(e) => setObsTemporal(e.target.value)}
                              placeholder="Agregue notas aclaratorias o justificaciones técnicas..."
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={guardarObservacionesTicket}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '0.75rem',
                                  backgroundColor: '#10b981',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold'
                                }}
                              >
                                ✓ GUARDAR
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditandoObs(false)}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '0.75rem',
                                  backgroundColor: '#e2e8f0',
                                  color: '#475569',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold'
                                }}
                              >
                                CANCELAR
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <div style={{
                              flexGrow: 1,
                              padding: '12px 15px',
                              background: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              borderRadius: '12px',
                              fontSize: '0.82rem',
                              color: '#334155',
                              whiteSpace: 'pre-line',
                              fontWeight: '600',
                              lineHeight: '1.4',
                              boxSizing: 'border-box'
                            }}>
                              {ticketSeleccionado?.observaciones || 'Sin observaciones registradas.'}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setObsTemporal(ticketSeleccionado?.observaciones || '');
                                setEditandoObs(true);
                              }}
                              style={{
                                border: '1px solid #e2e8f0',
                                background: 'white',
                                borderRadius: '8px',
                                padding: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#475569'
                              }}
                              title="Editar Observaciones"
                            >
                              ✏️
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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

              {/* Habilitar Edición — movido abajo al lado de finalizar ticket */}
              {(esPrivilegiado || (ticketSeleccionado?.usuario_id === currentUser?.id && ticketSeleccionado?.status !== 'Pagado')) && (
                <motion.button
                  onClick={() => setModoEdicion(prev => !prev)}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    background: modoEdicion
                      ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                      : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '700',
                    boxShadow: modoEdicion ? '0 4px 12px rgba(245,158,11,0.3)' : '0 4px 12px rgba(99,102,241,0.25)',
                    transition: 'all 0.2s',
                    minWidth: '160px',
                    height: '46px',
                    boxSizing: 'border-box'
                  }}
                >
                  <Activity size={15} />
                  {modoEdicion ? 'Edición Activa' : 'Habilitar Edición'}
                </motion.button>
              )}

              <motion.button
                onClick={actualizarPago}
                whileHover={{ scale: (loading || (!esPrivilegiado && !(modoEdicion && ticketSeleccionado?.usuario_id === currentUser?.id))) ? 1 : 1.04 }}
                whileTap={{ scale: (loading || (!esPrivilegiado && !(modoEdicion && ticketSeleccionado?.usuario_id === currentUser?.id))) ? 1 : 0.97 }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  background: (loading || (!esPrivilegiado && !(modoEdicion && ticketSeleccionado?.usuario_id === currentUser?.id)))
                    ? '#cbd5e1'
                    : 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: (loading || (!esPrivilegiado && !(modoEdicion && ticketSeleccionado?.usuario_id === currentUser?.id))) ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: '700',
                  boxShadow: (loading || (!esPrivilegiado && !(modoEdicion && ticketSeleccionado?.usuario_id === currentUser?.id)))
                    ? 'none'
                    : '0 4px 12px rgba(16,185,129,0.25)',
                  opacity: (esPrivilegiado || (modoEdicion && ticketSeleccionado?.usuario_id === currentUser?.id)) ? 1 : 0.6,
                  minWidth: '220px',
                  height: '46px',
                  boxSizing: 'border-box'
                }}
                disabled={loading || (!esPrivilegiado && !(modoEdicion && ticketSeleccionado?.usuario_id === currentUser?.id))}
              >
                <Save size={15} />
                {loading
                  ? 'Procesando...'
                  : (modoEdicion
                    ? 'Guardar Cambios de Edición'
                    : (esPrivilegiado
                      ? 'Finalizar y Guardar Cambios'
                      : 'Solo lectura'))}
              </motion.button>
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
