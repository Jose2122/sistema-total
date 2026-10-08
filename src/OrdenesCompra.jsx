import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion } from 'framer-motion';
import { 
  FileText, Search, Filter, Printer, Download, Eye, CheckCircle2, 
  Clock, AlertTriangle, XCircle, ShieldCheck, Plus, Calendar, DollarSign,
  Building2, Truck, CreditCard, User, ChevronRight, RefreshCw, Lock,
  Edit2, Trash2, Save, Ban, Landmark
} from 'lucide-react';
import { obtenerTodosProveedores } from './services/proveedoresService';
import { safeSupabaseUpdate } from './utils/helpers';
import './OrdenesCompra.css';

const DIRECCION_FISCAL_OFICIAL = "AV 61 ENTRE CALLE 147 Y TAPÓN PARCELA CI-19 SECTOR I, LOCAL GALPÓN NRO 147-113, ZONA INDUSTRIAL DE MARACAIBO SUR.";

const parsearJsonSeguro = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'object') return [val];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    return [];
  }
};

const OrdenesCompra = ({ currentUser }) => {
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabFiltro, setTabFiltro] = useState('todas'); // 'todas' | 'contado' | 'credito' | 'por_vencer' | 'calendario'
  const [busqueda, setBusqueda] = useState('');
  
  // Modal de Detalle / Expediente
  const [odcSeleccionada, setOdcSeleccionada] = useState(null);
  const [odcItems, setOdcItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [guardandoFirmaCarlos, setGuardandoFirmaCarlos] = useState(false);
  const [guardandoFirmaRicardo, setGuardandoFirmaRicardo] = useState(false);

  // Modal y estado para Edición Completa de ODC
  const [showEditModal, setShowEditModal] = useState(false);
  const [editOdcTarget, setEditOdcTarget] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [loadingEditData, setLoadingEditData] = useState(false);
  const [guardandoEditOdc, setGuardandoEditOdc] = useState(false);
  const [proveedoresList, setProveedoresList] = useState([]);
  const [filtroCategoriaProveedor, setFiltroCategoriaProveedor] = useState('TODAS');
  const [requisicionesList, setRequisicionesList] = useState([]);
  const [sourceReqSelected, setSourceReqSelected] = useState(null);
  const [showReqItemsPicker, setShowReqItemsPicker] = useState(false);

  // Destinos de Despacho compartidos con Compras
  const [destinosDespacho, setDestinosDespacho] = useState([]);
  const [showNuevoDestinoModal, setShowNuevoDestinoModal] = useState(false);
  const [nuevoDestinoForm, setNuevoDestinoForm] = useState({ nombre: '', direccion: '', contacto_nombre: '', contacto_telefono: '' });

  // Modal y estado para Asignación de Prioridad y Aprobación de Precios de ODC
  const [subtabPrioridad, setSubtabPrioridad] = useState('pendientes'); // 'pendientes' | 'aprobadas' | 'rechazadas' | 'todas'
  const [modalPrioridadOpen, setModalPrioridadOpen] = useState(false);
  const [odcPrioridadTarget, setOdcPrioridadTarget] = useState(null);
  const [prioridadSeleccionada, setPrioridadSeleccionada] = useState(1); // 1 (Nivel 1) | 2 (Nivel 2)
  const [mostrarRechazoInput, setMostrarRechazoInput] = useState(false);
  const [motivoRechazoInput, setMotivoRechazoInput] = useState('');
  const [itemsOdcPrioridad, setItemsOdcPrioridad] = useState([]);
  const [loadingItemsPrioridad, setLoadingItemsPrioridad] = useState(false);
  const [guardandoPrioridadOdc, setGuardandoPrioridadOdc] = useState(false);

  // Modal y estado para Vista Previa PDF F-ADM-01-2
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [pdfDocInstance, setPdfDocInstance] = useState(null);
  const [generandoPdfPreview, setGenerandoPdfPreview] = useState(false);
  const pdfIframeRef = useRef(null);

  // Modal y estado para Anulación de ODC con lista desplegable
  const [modalAnularOpen, setModalAnularOpen] = useState(false);
  const [odcParaAnular, setOdcParaAnular] = useState(null);
  const [motivoAnulacionSelect, setMotivoAnulacionSelect] = useState('Error en montos, precios unitarios o cotización');
  const [motivoAnulacionDetalle, setMotivoAnulacionDetalle] = useState('');
  const [guardandoAnulacion, setGuardandoAnulacion] = useState(false);

  const categoriasDisponibles = useMemo(() => {
    const setCat = new Set();
    (proveedoresList || []).forEach(p => {
      const c = p.categoria || p.categoria_proveedor || p.rubro;
      if (Array.isArray(c)) {
        c.forEach(x => { if (x) setCat.add(String(x).toUpperCase().trim()); });
      } else if (typeof c === 'string') {
        try {
          const parsed = JSON.parse(c);
          if (Array.isArray(parsed)) {
            parsed.forEach(x => { if (x) setCat.add(String(x).toUpperCase().trim()); });
          } else if (c.trim()) {
            setCat.add(c.toUpperCase().trim());
          }
        } catch {
          if (c.trim()) setCat.add(c.toUpperCase().trim());
        }
      }
    });

    const base = ["SERVICIO", "REPUESTO", "ALIMENTACIÓN", "TECNOLOGÍA", "PAPELERÍA", "LIMPIEZA", "MANTENIMIENTO", "FERRETERÍA", "CONSUMIBLE", "EQUIPO", "TRANSPORTE", "OTROS"];
    base.forEach(b => setCat.add(b));
    return Array.from(setCat).sort();
  }, [proveedoresList]);

  const proveedoresFiltradosPorCategoria = useMemo(() => {
    if (!filtroCategoriaProveedor || filtroCategoriaProveedor === 'TODAS') {
      return proveedoresList;
    }
    const filtroUpper = filtroCategoriaProveedor.toUpperCase().trim();
    return proveedoresList.filter(p => {
      const c = p.categoria || p.categoria_proveedor || p.rubro;
      if (Array.isArray(c)) {
        return c.some(x => String(x).toUpperCase().trim() === filtroUpper);
      }
      if (typeof c === 'string') {
        try {
          const parsed = JSON.parse(c);
          if (Array.isArray(parsed)) {
            return parsed.some(x => String(x).toUpperCase().trim() === filtroUpper);
          }
        } catch {
          // ignore
        }
        return c.toUpperCase().includes(filtroUpper);
      }
      return false;
    });
  }, [proveedoresList, filtroCategoriaProveedor]);
  
  // Edición de Términos y Condiciones / Leyes
  const [editandoTerminos, setEditandoTerminos] = useState(false);
  const [textoTerminos, setTextoTerminos] = useState('');
  const [guardandoTerminos, setGuardandoTerminos] = useState(false);

  // Edición de Observaciones de la ODC
  const [editandoObservaciones, setEditandoObservaciones] = useState(false);
  const [textoObservaciones, setTextoObservaciones] = useState('');
  const [guardandoObservaciones, setGuardandoObservaciones] = useState(false);
  
  // Imprimir / PDF ref
  const printRef = useRef(null);

  // Verificación RBAC para Prioridad, Impresión y Gestión ODC
  const deptoUser = (currentUser?.departamento || '').toLowerCase().trim();
  const rolUser = (currentUser?.rol || '').toLowerCase().trim();
  const emailUser = (currentUser?.correo || currentUser?.email || '').toLowerCase().trim();
  const nombreUser = (currentUser?.nombre || '').toLowerCase().trim();
  const apellidoUser = (currentUser?.apellido || '').toLowerCase().trim();
  const cargoUser = (currentUser?.cargo || '').toLowerCase().trim();

  // 1. Super Admin (José Contreras / Superadmin)
  const esSuperAdmin = emailUser === 'jcontreras.totalclean@gmail.com' || 
                       currentUser?.esAdminReal || 
                       rolUser === 'superadmin' || 
                       rolUser === 'admin' ||
                       (rolUser.includes('admin') && !rolUser.includes('analista'));

  // 2. Gerente General (Carlos Vega)
  const esGerenteGeneral = emailUser === 'cvega@totalclean.com.ve' || 
                           emailUser === 'cvega.totalclean@gmail.com' ||
                           emailUser === 'cvega@totalclean.com' ||
                           emailUser.includes('cvega') ||
                           (nombreUser.includes('carlos') && apellidoUser.includes('vega')) ||
                           rolUser.includes('gerente general') || 
                           cargoUser.includes('gerente general');

  // 3. Gerente de Compras (Ricardo Herrera)
  // NOTA: Excluye a los Analistas de Compras
  const esGerenteCompras = (nombreUser.includes('ricardo') && apellidoUser.includes('herrera')) ||
                           emailUser.includes('rherrera') ||
                           rolUser === 'gerente de compras' ||
                           rolUser === 'gerente compras' ||
                           cargoUser === 'gerente de compras' ||
                           cargoUser === 'gerente compras' ||
                           (rolUser.includes('gerente') && deptoUser.includes('compra') && !rolUser.includes('analista'));

  // EXCLUSIVO PARA: Super Admin, Gerente General y Gerente de Compras (NO analistas de compras)
  const puedeAprobarPrioridadODC = esSuperAdmin || esGerenteGeneral || esGerenteCompras;
  const puedeExportarODCOriginal = esSuperAdmin || esGerenteGeneral || esGerenteCompras;

  // Acceso general para analistas y compras
  const esUsuarioCompras = esSuperAdmin || esGerenteGeneral || esGerenteCompras || deptoUser.includes('compra') || rolUser.includes('compra');

  // EXCLUSIVO PARA: Super Admin (José) y Gerente General (Carlos Vega)
  const puedeActivarFirmaCarlos = esSuperAdmin || esGerenteGeneral;
  const esCarlosVega = puedeActivarFirmaCarlos;

  // EXCLUSIVO PARA: Super Admin (José) y Gerente de Compras (Ricardo Herrera)
  const puedeActivarFirmaRicardo = esSuperAdmin || esGerenteCompras;
  const esRicardoHerrera = puedeActivarFirmaRicardo;

  const esAdminSuper = esSuperAdmin;
  const esAdmin = esSuperAdmin || esGerenteGeneral;

  useEffect(() => {
    cargarOrdenes();
    cargarDestinosDespacho();

    const handleProvActualizados = () => {
      cargarOrdenes();
      cargarDestinosDespacho();
    };
    window.addEventListener('proveedores_actualizados', handleProvActualizados);

    const channel = supabase
      .channel('ordenes_compra_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_compra' }, () => {
        cargarOrdenes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('proveedores_actualizados', handleProvActualizados);
    };
  }, []);

  const cargarOrdenes = async () => {
    setLoading(true);
    try {
      // 1. Cargar catálogo de proveedores unificado
      const provsData = await obtenerTodosProveedores();
      setProveedoresList(provsData || []);
      
      const provMap = {};
      (provsData || []).forEach(p => {
        if (p.id !== undefined && p.id !== null) {
          provMap[String(p.id)] = p;
        }
        if (p.rif) {
          provMap[p.rif.trim().toUpperCase()] = p;
        }
      });

      // 2. Cargar requisiciones de origen para vinculación directa (Paginación completa)
      let reqsData = [];
      let pageReq = 0;
      let keepReq = true;
      while (keepReq) {
        const { data: chunk, error: reqErr } = await supabase
          .from('requisiciones')
          .select('id, correlativo_req, solicitante, gerencia, centro_costo, prioridad, items')
          .range(pageReq * 1000, (pageReq + 1) * 1000 - 1);
        if (reqErr) {
          console.error("Error al cargar catálogo de requisiciones:", reqErr);
        }
        if (chunk && chunk.length > 0) {
          reqsData = reqsData.concat(chunk);
          if (chunk.length < 1000) keepReq = false;
          else pageReq++;
        } else {
          keepReq = false;
        }
      }

      const reqMap = {};
      (reqsData || []).forEach(r => {
        if (r.id !== undefined && r.id !== null) {
          reqMap[String(r.id)] = r;
          reqMap[Number(r.id)] = r;
          reqMap[`REQ-${r.id}`] = r;
          reqMap[`REQ-${String(r.id).padStart(3, '0')}`] = r;
        }
        if (r.correlativo_req) {
          const cTrim = String(r.correlativo_req).trim();
          reqMap[cTrim] = r;
          reqMap[cTrim.toUpperCase()] = r;
        }
      });
      setRequisicionesList(reqsData || []);

      // 2.5 Cargar renglones de ordenes_compra_items para mapeo de descripción directa
      let itemsOdcData = [];
      let pageItems = 0;
      let keepItems = true;
      while (keepItems) {
        const { data: chunkItems, error: itemsErr } = await supabase
          .from('ordenes_compra_items')
          .select('id, orden_compra_id, item_numero, descripcion, cantidad, unidad, precio_unitario, subtotal, total_fila')
          .order('item_numero', { ascending: true })
          .range(pageItems * 1000, (pageItems + 1) * 1000 - 1);
        if (itemsErr) {
          console.warn("Aviso al cargar ítems globales de ODC:", itemsErr.message);
          break;
        }
        if (chunkItems && chunkItems.length > 0) {
          itemsOdcData = itemsOdcData.concat(chunkItems);
          if (chunkItems.length < 1000) keepItems = false;
          else pageItems++;
        } else {
          keepItems = false;
        }
      }

      const odcItemsMap = {};
      (itemsOdcData || []).forEach(it => {
        if (it.orden_compra_id) {
          const key = String(it.orden_compra_id);
          if (!odcItemsMap[key]) odcItemsMap[key] = [];
          odcItemsMap[key].push(it);
        }
      });

      // 3. Cargar órdenes de compra sin pedir relaciones embebidas
      let data = [];
      let pageOdc = 0;
      let keepOdc = true;
      while (keepOdc) {
        const { data: chunk, error } = await supabase
          .from('ordenes_compra')
          .select('*')
          .order('created_at', { ascending: false })
          .range(pageOdc * 1000, (pageOdc + 1) * 1000 - 1);

        if (error) {
          console.error("Error PostgREST en ordenes_compra:", error);
          throw error;
        }
        if (chunk && chunk.length > 0) {
          data = data.concat(chunk);
          if (chunk.length < 1000) keepOdc = false;
          else pageOdc++;
        } else {
          keepOdc = false;
        }
      }

      const mapeadas = (data || []).map(o => {
        const prov = provMap[String(o.proveedor_id)];
        const cleanReqId = o.requisicion_id ? String(o.requisicion_id).trim() : '';
        const numOnlyReqId = cleanReqId.replace(/^REQ-?/i, '').trim();

        const reqObj = reqMap[cleanReqId] || 
                       reqMap[cleanReqId.toUpperCase()] ||
                       reqMap[numOnlyReqId] ||
                       (o.numero_req ? reqMap[String(o.numero_req).trim().toUpperCase()] : null) || 
                       (o.correlativo_req ? reqMap[String(o.correlativo_req).trim().toUpperCase()] : null) || 
                       (o.requisicion_correlativo ? reqMap[String(o.requisicion_correlativo).trim().toUpperCase()] : null);

        let itemsThisOdc = odcItemsMap[String(o.id)] || [];

        // Fallback: Si no hay ítems en la tabla ordenes_compra_items, buscar en items de requisición
        if (itemsThisOdc.length === 0 && reqObj?.items) {
          const rawItems = Array.isArray(reqObj.items) ? reqObj.items : parsearJsonSeguro(reqObj.items);
          const matchingReqItems = (rawItems || []).filter(it => 
            (it.historial_compras || []).some(h => String(h.odc_id) === String(o.id) || h.odc_numero === o.numero_odc)
          );
          if (matchingReqItems.length > 0) {
            itemsThisOdc = matchingReqItems.map((it, idx) => ({
              id: it.id || `req_it_${idx}`,
              orden_compra_id: o.id,
              item_numero: idx + 1,
              descripcion: it.descripcion || it.nombre || it.material || 'Material / Servicio',
              cantidad: it.cantidad || it.cant || 1,
              unidad: it.unidad || it.uni || 'UND',
              precio_unitario: it.precio_unitario || it.pu || 0
            }));
          } else if (rawItems && rawItems.length > 0) {
            itemsThisOdc = rawItems.map((it, idx) => ({
              id: it.id || `req_it_${idx}`,
              orden_compra_id: o.id,
              item_numero: idx + 1,
              descripcion: it.descripcion || it.nombre || it.material || 'Material / Servicio',
              cantidad: it.cantidad || it.cant || 1,
              unidad: it.unidad || it.uni || 'UND',
              precio_unitario: it.precio_unitario || it.pu || 0
            }));
          }
        }

        let descResumen = '';
        if (itemsThisOdc.length === 1) {
          const it = itemsThisOdc[0];
          descResumen = `${it.cantidad ? it.cantidad + ' ' + (it.unidad || 'UND') + ' - ' : ''}${it.descripcion || ''}`.trim();
        } else if (itemsThisOdc.length > 1) {
          descResumen = itemsThisOdc.map(it => `${it.cantidad ? it.cantidad + ' ' + (it.unidad || 'UND') + ' - ' : ''}${it.descripcion}`).join(', ');
        } else {
          descResumen = o.observaciones || o.destino_despacho || 'Sin descripción detallada';
        }

        const nombreVal = (o.proveedor_nombre && o.proveedor_nombre !== 'N/A') 
          ? o.proveedor_nombre 
          : (prov?.razon_social || prov?.nombre || 'N/A');
        const rifVal = (o.proveedor_rif && o.proveedor_rif !== 'N/A') 
          ? o.proveedor_rif 
          : (prov?.rif || 'N/A');
        const contactoVal = o.proveedor_contacto || prov?.persona_contacto || prov?.contacto_nombre || 'N/A';
        const ciudadVal = o.proveedor_ciudad || prov?.ciudad || prov?.localizacion || 'N/A';
        const direccionVal = o.proveedor_direccion || prov?.direccion || 'N/A';

        const correlativoReq = reqObj?.correlativo_req || 
                               (o.requisicion_correlativo && !String(o.requisicion_correlativo).startsWith('REQ-') ? o.requisicion_correlativo : null) ||
                               (o.correlativo_req && !String(o.correlativo_req).startsWith('REQ-') ? o.correlativo_req : null) ||
                               (o.numero_req && !String(o.numero_req).startsWith('REQ-') ? o.numero_req : null) ||
                               reqObj?.correlativo_req ||
                               o.requisicion_correlativo ||
                               o.correlativo_req ||
                               o.numero_req ||
                               (cleanReqId && !cleanReqId.match(/^\d+$/) && !cleanReqId.startsWith('REQ-') ? cleanReqId : null);

        const reqIdResolved = reqObj?.id ? String(reqObj.id) : (o.requisicion_id && !String(o.requisicion_id).includes('-') ? String(o.requisicion_id) : null);

        const esPreferencial = Boolean(prov?.es_preferencial || prov?.proveedor_preferencial || o.proveedor_es_preferencial);
        const reqPrioStr = String(reqObj?.prioridad || o.requisicion_prioridad || '').trim().toUpperCase();
        const esEmergencia = reqPrioStr === 'EMERGENCIA' || reqPrioStr.includes('EMERGENCIA');
        
        const prioLocal = localStorage.getItem(`odc_prio_${o.id}`);
        const prioStatusLocal = localStorage.getItem(`odc_prio_status_${o.id}`);
        const prioUserLocal = localStorage.getItem(`odc_prio_user_${o.id}`);
        const motivoRechazoLocal = localStorage.getItem(`odc_prio_motivo_${o.id}`);
        const pasaAlmacenLocal = localStorage.getItem(`odc_pasa_almacen_${o.id}`) || localStorage.getItem(`odc_pasa_almacen_${o.numero_odc}`);

        let pasaAlmacenVal = true;
        if (o.pasa_por_almacen !== undefined && o.pasa_por_almacen !== null) {
          pasaAlmacenVal = o.pasa_por_almacen !== false;
        } else if (pasaAlmacenLocal !== null) {
          pasaAlmacenVal = pasaAlmacenLocal === 'true';
        } else if (reqObj?.items && Array.isArray(reqObj.items)) {
          const directItem = reqObj.items.find(it => 
            (it.historial_compras || []).some(h => (String(h.odc_id) === String(o.id) || h.odc_numero === o.numero_odc) && h.pasa_por_almacen === false) ||
            (it.pasa_por_almacen === false && (it.historial_compras || []).some(h => String(h.odc_id) === String(o.id) || h.odc_numero === o.numero_odc))
          );
          if (directItem) pasaAlmacenVal = false;
        }

        const stOrden = String(o.estatus_orden || '').trim().toUpperCase();
        const tieneRechazoEnComentario = typeof o.carlos_comentario_aprobacion === 'string' && o.carlos_comentario_aprobacion.startsWith('[RECHAZADO]:');

        let estadoAprobacion = (o.estado_aprobacion_precio || prioStatusLocal || '').toLowerCase();
        if (!estadoAprobacion) {
          if (stOrden === 'APROBADA' || o.carlos_firma_digital_activa) {
            estadoAprobacion = 'aprobado';
          } else if (stOrden === 'RECHAZADA' || tieneRechazoEnComentario) {
            estadoAprobacion = 'rechazado';
          } else if (o.estatus_pago === 'PAGADO' || o.status_pago === 'PAGADO') {
            estadoAprobacion = 'aprobado';
          } else {
            estadoAprobacion = 'pendiente';
          }
        }

        let motivoRechazo = o.motivo_rechazo_compras || motivoRechazoLocal || null;
        if (!motivoRechazo && tieneRechazoEnComentario) {
          motivoRechazo = o.carlos_comentario_aprobacion.replace('[RECHAZADO]:', '').trim();
        }

        let prioridadPago = null;
        if (o.prioridad_pago !== undefined && o.prioridad_pago !== null) {
          prioridadPago = Number(o.prioridad_pago);
        } else if (prioLocal) {
          prioridadPago = Number(prioLocal);
        } else if (estadoAprobacion === 'aprobado') {
          prioridadPago = esEmergencia ? 1 : 2;
        }

        let datosBancariosVal = o.datos_bancarios || o.cuenta_bancaria || o.cuenta_bancaria_proveedor || null;
        if (!datosBancariosVal && prov?.cuentas_bancarias) {
          let ctas = [];
          if (Array.isArray(prov.cuentas_bancarias)) ctas = prov.cuentas_bancarias;
          else if (typeof prov.cuentas_bancarias === 'string') {
            try { ctas = JSON.parse(prov.cuentas_bancarias); } catch { ctas = []; }
          }
          if (ctas.length > 0) {
            const c0 = ctas[0];
            datosBancariosVal = `${c0.banco || 'Banco'} (${c0.moneda || 'USD'}) - N° Cuenta: ${c0.nro_cuenta || 'N/A'} - Titular: ${c0.titular || 'N/A'} (${c0.rif || 'N/A'}) ${c0.tipo_cuenta ? `[${c0.tipo_cuenta}]` : ''}`.trim();
          }
        }

        return {
          ...o,
          items: itemsThisOdc,
          items_count: itemsThisOdc.length,
          descripcion_resumen: descResumen,
          datos_bancarios: datosBancariosVal,
          cuenta_bancaria: datosBancariosVal,
          pasa_por_almacen: pasaAlmacenVal,
          requisicion_id: reqIdResolved || o.requisicion_id || (reqObj ? reqObj.id : null),
          proveedor_nombre: nombreVal,
          proveedor_rif: rifVal,
          proveedor_contacto: contactoVal,
          proveedor_ciudad: ciudadVal,
          proveedor_direccion: direccionVal,
          fecha_despacho: o.fecha_despacho || o.fecha_emision || 'N/A',
          requisicion_correlativo: correlativoReq,
          requisicion_obj: reqObj || null,
          solicitante: (reqObj?.solicitante && (!o.solicitante || o.solicitante === 'Total Clean C.A.')) ? reqObj.solicitante : (o.solicitante || reqObj?.solicitante || 'Total Clean C.A.'),
          proveedor_es_preferencial: esPreferencial,
          proveedor_nivel_preferencial: prov?.nivel_preferencial || (esPreferencial ? 'Tier 1 / Oro' : 'Regular'),
          requisicion_prioridad: reqPrioStr || 'NORMAL',
          requisicion_es_emergencia: esEmergencia,
          estado_aprobacion_precio: estadoAprobacion,
          prioridad_pago: prioridadPago,
          aprobado_compras_por: o.aprobado_compras_por || o.aprobado_por_nombre || prioUserLocal || null,
          motivo_rechazo_compras: motivoRechazo,
          ricardo_firma_digital_activa: o.ricardo_firma_digital_activa !== undefined && o.ricardo_firma_digital_activa !== null ? Boolean(o.ricardo_firma_digital_activa) : (localStorage.getItem(`odc_ricardo_firma_${o.id}`) === 'true'),
          carlos_firma_digital_activa: Boolean(o.carlos_firma_digital_activa)
        };
      });
      setOrdenes(mapeadas);
    } catch (err) {
      console.error("Error al cargar órdenes de compra:", err);
      toast.error(`Error al cargar Órdenes de Compra: ${err.message || 'Error en consulta'}`);
    } finally {
      setLoading(false);
    }
  };

  const abrirDetalleOdc = async (odc) => {
    let odcCompleta = { ...odc };
    if (odcCompleta.proveedor_id) {
      try {
        const { data: provData } = await supabase
          .from('proveedores')
          .select('razon_social, rif, persona_contacto, contacto_nombre, ciudad, localizacion, direccion, cuentas_bancarias')
          .eq('id', odcCompleta.proveedor_id)
          .maybeSingle();
        if (provData) {
          if (!odcCompleta.proveedor_nombre || odcCompleta.proveedor_nombre === 'N/A') {
            odcCompleta.proveedor_nombre = provData.razon_social || 'N/A';
          }
          if (!odcCompleta.proveedor_rif || odcCompleta.proveedor_rif === 'N/A') {
            odcCompleta.proveedor_rif = provData.rif || 'N/A';
          }
          odcCompleta.proveedor_contacto = odcCompleta.proveedor_contacto || provData.persona_contacto || provData.contacto_nombre || 'N/A';
          odcCompleta.proveedor_ciudad = odcCompleta.proveedor_ciudad || provData.ciudad || provData.localizacion || 'N/A';
          odcCompleta.proveedor_direccion = odcCompleta.proveedor_direccion || provData.direccion || 'N/A';

          if (!odcCompleta.datos_bancarios && !odcCompleta.cuenta_bancaria && provData.cuentas_bancarias) {
            let ctas = [];
            if (Array.isArray(provData.cuentas_bancarias)) ctas = provData.cuentas_bancarias;
            else if (typeof provData.cuentas_bancarias === 'string') {
              try { ctas = JSON.parse(provData.cuentas_bancarias); } catch { ctas = []; }
            }
            if (ctas.length > 0) {
              const c0 = ctas[0];
              odcCompleta.datos_bancarios = `${c0.banco || 'Banco'} (${c0.moneda || 'USD'}) - N° ${c0.nro_cuenta || 'N/A'} - Titular: ${c0.titular || 'N/A'} (${c0.rif || 'N/A'})`;
            }
          }
        }
      } catch (e) {
        console.error("Error al obtener datos del proveedor:", e);
      }
    }

    // Resolver requisición exacta si no tiene el correlativo textual cargado
    if (odcCompleta.requisicion_id || odcCompleta.numero_req || odcCompleta.requisicion_correlativo) {
      try {
        const rawSearch = odcCompleta.requisicion_id || odcCompleta.numero_req || odcCompleta.requisicion_correlativo;
        const numOnly = String(rawSearch).replace(/^REQ-?/i, '').trim();

        let foundReq = (requisicionesList || []).find(r => 
          String(r.id) === String(rawSearch) ||
          String(r.id) === numOnly ||
          (r.correlativo_req && String(r.correlativo_req).trim().toUpperCase() === String(rawSearch).trim().toUpperCase())
        );

        if (!foundReq || !foundReq.correlativo_req) {
          let q = supabase.from('requisiciones').select('id, correlativo_req, solicitante, gerencia, centro_costo, items');
          if (!isNaN(Number(numOnly)) && Number(numOnly) > 0) {
            q = q.or(`id.eq.${Number(numOnly)},correlativo_req.eq.${rawSearch}`);
          } else {
            q = q.eq('correlativo_req', rawSearch);
          }
          const { data: dbReq } = await q.maybeSingle();
          if (dbReq) foundReq = dbReq;
        }

        if (foundReq) {
          odcCompleta.requisicion_obj = foundReq;
          odcCompleta.requisicion_correlativo = foundReq.correlativo_req || odcCompleta.requisicion_correlativo;
          if (foundReq.solicitante && (!odcCompleta.solicitante || odcCompleta.solicitante === 'Total Clean C.A.')) {
            odcCompleta.solicitante = foundReq.solicitante;
          }
          odcCompleta.centro_costo = foundReq.centro_costo || foundReq.obra || null;
        }
      } catch (e) {
        console.error("Error al buscar requisición vinculada:", e);
      }
    }

    const pasaAlmacenLocal = localStorage.getItem(`odc_pasa_almacen_${odcCompleta.id}`) || localStorage.getItem(`odc_pasa_almacen_${odcCompleta.numero_odc}`);
    if (odcCompleta.pasa_por_almacen === undefined || odcCompleta.pasa_por_almacen === null) {
      if (pasaAlmacenLocal !== null) {
        odcCompleta.pasa_por_almacen = pasaAlmacenLocal === 'true';
      } else if (odcCompleta.requisicion_obj?.items) {
        const direct = (odcCompleta.requisicion_obj.items || []).some(it => 
          (it.historial_compras || []).some(h => (String(h.odc_id) === String(odcCompleta.id) || h.odc_numero === odcCompleta.numero_odc) && h.pasa_por_almacen === false) ||
          (it.pasa_por_almacen === false && (it.historial_compras || []).some(h => String(h.odc_id) === String(odcCompleta.id) || h.odc_numero === odcCompleta.numero_odc))
        );
        if (direct) odcCompleta.pasa_por_almacen = false;
      }
    }

    const defaultGlobalTerms = localStorage.getItem('odc_global_default_terms') || "Precios incluyen entrega en el sitio de destino especificado. Mercancía sujeta a inspección de calidad y conteo físico.";
    const terminosActuales = odcCompleta.terminos_condiciones || localStorage.getItem(`odc_terms_${odcCompleta.id}`) || defaultGlobalTerms;
    odcCompleta.terminos_condiciones = terminosActuales;

    const obsActuales = odcCompleta.observaciones || localStorage.getItem(`odc_obs_${odcCompleta.id}`) || '';
    odcCompleta.observaciones = obsActuales;

    setOdcSeleccionada(odcCompleta);
    setTextoTerminos(terminosActuales);
    setTextoObservaciones(obsActuales);
    setEditandoTerminos(false);
    setEditandoObservaciones(false);
    setModalOpen(true);
    setLoadingItems(true);
    try {
      const { data, error } = await supabase
        .from('ordenes_compra_items')
        .select('*')
        .eq('orden_compra_id', odc.id)
        .order('item_numero', { ascending: true });

      if (error) throw error;
      setOdcItems(data || []);
    } catch (err) {
      console.error("Error al cargar renglones de ODC:", err);
      toast.error("Error al cargar ítems de la ODC");
    } finally {
      setLoadingItems(false);
    }
  };

  const guardarTerminosOdc = async (nuevoTexto) => {
    if (!odcSeleccionada) return;
    setGuardandoTerminos(true);
    try {
      const { error } = await supabase
        .from('ordenes_compra')
        .update({ terminos_condiciones: nuevoTexto })
        .eq('id', odcSeleccionada.id);

      if (error) {
        console.warn("Actualización DB terminos_condiciones:", error.message);
      }
      localStorage.setItem(`odc_terms_${odcSeleccionada.id}`, nuevoTexto);
      const odcActualizada = { ...odcSeleccionada, terminos_condiciones: nuevoTexto };
      setOdcSeleccionada(odcActualizada);
      setOrdenes(prev => prev.map(o => o.id === odcSeleccionada.id ? odcActualizada : o));
      setEditandoTerminos(false);
      toast.success("Leyes y condiciones de la ODC actualizadas con éxito.");
    } catch (err) {
      console.error("Error al guardar términos:", err);
      toast.error("Error al guardar términos: " + err.message);
    } finally {
      setGuardandoTerminos(false);
    }
  };

  const guardarObservacionesOdc = async (nuevoTexto) => {
    if (!odcSeleccionada) return;
    setGuardandoObservaciones(true);
    try {
      try {
        await supabase
          .from('ordenes_compra')
          .update({ observaciones: nuevoTexto })
          .eq('id', odcSeleccionada.id);
      } catch (e) {
        console.warn("Actualización DB observaciones:", e.message);
      }
      localStorage.setItem(`odc_obs_${odcSeleccionada.id}`, nuevoTexto);
      const odcActualizada = { ...odcSeleccionada, observaciones: nuevoTexto };
      setOdcSeleccionada(odcActualizada);
      setOrdenes(prev => prev.map(o => o.id === odcSeleccionada.id ? odcActualizada : o));
      setEditandoObservaciones(false);
      toast.success("Observaciones de la ODC actualizadas con éxito.");
    } catch (err) {
      console.error("Error al guardar observaciones:", err);
      toast.error("Error al guardar observaciones: " + err.message);
    } finally {
      setGuardandoObservaciones(false);
    }
  };

  const guardarTerminosPredeterminados = (nuevoTexto) => {
    localStorage.setItem('odc_global_default_terms', nuevoTexto);
    toast.success("Establecido como ley/condición predeterminada global para nuevas ODC.");
  };

  // -------------------------------------------------------------
  // DESTINOS DE DESPACHO PREDETERMINADOS (COMPARTIDOS CON COMPRAS)
  // -------------------------------------------------------------
  const cargarDestinosDespacho = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('destinos_despacho_predeterminados')
        .select('*')
        .order('es_predeterminado', { ascending: false });
      if (!error && data) {
        setDestinosDespacho(data);
      }
    } catch (err) {
      console.warn("Tabla destinos_despacho_predeterminados no disponible:", err.message);
    }
  }, []);

  const guardarNuevoDestino = async () => {
    if (!nuevoDestinoForm.nombre || !nuevoDestinoForm.direccion) {
      return toast.error("Ingrese el nombre y la dirección del destino.");
    }
    try {
      const { data, error } = await supabase.from('destinos_despacho_predeterminados').insert([{
        nombre: nuevoDestinoForm.nombre.trim(),
        direccion: nuevoDestinoForm.direccion.trim(),
        contacto_nombre: nuevoDestinoForm.contacto_nombre?.trim() || null,
        contacto_telefono: nuevoDestinoForm.contacto_telefono?.trim() || null
      }]).select().single();
      if (error) throw error;
      toast.success("Nuevo destino guardado.");
      setDestinosDespacho(prev => [...prev, data]);
      setEditOdcTarget(prev => ({
        ...prev,
        despachar_a_id: data.id,
        destino_despacho: data.nombre,
        despachar_a_direccion: data.direccion && data.direccion !== 'null' ? `${data.nombre} - ${data.direccion}` : data.nombre
      }));
      setShowNuevoDestinoModal(false);
      setNuevoDestinoForm({ nombre: '', direccion: '', contacto_nombre: '', contacto_telefono: '' });
    } catch (err) {
      toast.error("Error al guardar destino: " + err.message);
    }
  };

  const eliminarDestino = async (destinoId) => {
    if (!destinoId) return;
    const dest = destinosDespacho.find(d => String(d.id) === String(destinoId));
    if (!dest) return;
    if (!window.confirm(`¿Está seguro de eliminar el destino de despacho "${dest.nombre}"?`)) return;

    try {
      const { error } = await supabase
        .from('destinos_despacho_predeterminados')
        .delete()
        .eq('id', destinoId);
      if (error) throw error;
      toast.success("Destino de despacho eliminado.");
      setDestinosDespacho(prev => prev.filter(d => String(d.id) !== String(destinoId)));
      if (String(editOdcTarget?.despachar_a_id) === String(destinoId)) {
        setEditOdcTarget(prev => ({
          ...prev,
          despachar_a_id: '',
          destino_despacho: '',
          despachar_a_direccion: ''
        }));
      }
    } catch (err) {
      toast.error("Error al eliminar destino: " + err.message);
    }
  };

  // -------------------------------------------------------------
  // FUNCIONALIDAD DE EDICIÓN COMPLETA DE ORDEN DE COMPRA (ODC)
  // -------------------------------------------------------------
  const abrirModalEditarOdc = async (odc) => {
    const puedeEditar = esUsuarioCompras || 
                        odc.elaborado_por_id === currentUser?.id || 
                        currentUser?.permisos?.['ordenes_compra'] || 
                        currentUser?.permisos?.['compras'] || 
                        esAdminSuper;
    if (!puedeEditar) {
      toast.error("No tiene permisos para editar esta Órden de Compra.");
      return;
    }
    setLoadingEditData(true);
    setShowEditModal(true);

    try {
      // 1. Cargar lista de proveedores para el selector
      const provs = await obtenerTodosProveedores();
      setProveedoresList(provs || []);

      // 1.1 Cargar destinos de despacho si aún no están en memoria
      let currentDestinos = destinosDespacho;
      if (!currentDestinos || currentDestinos.length === 0) {
        try {
          const { data: dData } = await supabase
            .from('destinos_despacho_predeterminados')
            .select('*')
            .order('es_predeterminado', { ascending: false });
          if (dData && dData.length > 0) {
            setDestinosDespacho(dData);
            currentDestinos = dData;
          }
        } catch (e) {
          console.warn("Error cargando destinos en abrirModalEditarOdc:", e);
        }
      }

      // 2. Cargar lista de requisiciones aprobadas/activas para vincular o importar renglones (Paginación completa)
      let reqsAll = [];
      let pageReq = 0;
      let keepReq = true;
      while (keepReq) {
        const { data: chunk, error: reqErr2 } = await supabase
          .from('requisiciones')
          .select('id, correlativo_req, solicitante, gerencia, centro_costo, items, created_at')
          .order('created_at', { ascending: false })
          .range(pageReq * 1000, (pageReq + 1) * 1000 - 1);
        if (reqErr2) {
          console.error("Error al cargar requisiciones en modal edición:", reqErr2);
        }
        if (chunk && chunk.length > 0) {
          reqsAll = reqsAll.concat(chunk);
          if (chunk.length < 1000) keepReq = false;
          else pageReq++;
        } else {
          keepReq = false;
        }
      }
      setRequisicionesList(reqsAll || []);

      // Determinar requisición de origen vinculada
      let reqEncontrada = odc.requisicion_obj || null;
      if (!reqEncontrada && odc.requisicion_id) {
        reqEncontrada = (reqsAll || []).find(r => 
          String(r.id) === String(odc.requisicion_id) || 
          (r.correlativo_req && String(r.correlativo_req).trim().toUpperCase() === String(odc.requisicion_id).trim().toUpperCase())
        );
      }
      if (!reqEncontrada && odc.requisicion_correlativo) {
        reqEncontrada = (reqsAll || []).find(r => 
          (r.correlativo_req && String(r.correlativo_req).trim().toUpperCase() === String(odc.requisicion_correlativo).trim().toUpperCase()) || 
          String(r.id) === String(odc.requisicion_correlativo)
        );
      }
      if (!reqEncontrada && odc.numero_req) {
        reqEncontrada = (reqsAll || []).find(r => 
          (r.correlativo_req && String(r.correlativo_req).trim().toUpperCase() === String(odc.numero_req).trim().toUpperCase()) || 
          String(r.id) === String(odc.numero_req)
        );
      }
      setSourceReqSelected(reqEncontrada || null);

      const resolvedReqId = reqEncontrada ? String(reqEncontrada.id) : (odc.requisicion_id ? String(odc.requisicion_id) : '');

      // 3. Cargar ítems/renglones existentes de la ODC
      const { data: items, error: itemsErr } = await supabase
        .from('ordenes_compra_items')
        .select('*')
        .eq('orden_compra_id', odc.id)
        .order('item_numero', { ascending: true });

      if (itemsErr) throw itemsErr;

      const itemsMapeados = (items && items.length > 0) 
        ? items.map((it, idx) => ({
            id: it.id || `item_${idx}`,
            requisicion_item_id: it.requisicion_item_id || null,
            item_numero: it.item_numero || (idx + 1),
            descripcion: it.descripcion || '',
            unidad: it.unidad || 'UNID',
            cantidad: parseFloat(it.cantidad) || 0,
            precio_unitario: parseFloat(it.precio_unitario) || 0,
            total_fila: parseFloat(it.total_fila) || ((parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0)),
            origen_req: reqEncontrada?.correlativo_req || null
          }))
        : [{ id: `new_${Date.now()}`, requisicion_item_id: null, item_numero: 1, descripcion: '', unidad: 'UNID', cantidad: 1, precio_unitario: 0, total_fila: 0 }];

      setEditItems(itemsMapeados);

      // 4. Determinar IVA y construir objeto target
      const pctIva = odc.porcentaje_iva !== undefined && odc.porcentaje_iva !== null 
        ? parseFloat(odc.porcentaje_iva) 
        : (odc.iva_porcentaje !== undefined ? parseFloat(odc.iva_porcentaje) : 16);

      const aplicaIva = (pctIva > 0) && (odc.iva_monto > 0 || odc.monto_iva > 0 || pctIva > 0);

      // Cuentas bancarias del proveedor
      const provSeleccionado = (proveedoresList || []).find(p => String(p.id) === String(odc.proveedor_id));
      let ctasProv = [];
      if (provSeleccionado?.cuentas_bancarias) {
        if (Array.isArray(provSeleccionado.cuentas_bancarias)) ctasProv = provSeleccionado.cuentas_bancarias;
        else if (typeof provSeleccionado.cuentas_bancarias === 'string') {
          try { ctasProv = JSON.parse(provSeleccionado.cuentas_bancarias); } catch { ctasProv = []; }
        }
      }
      let defaultCtaStr = '';
      if (ctasProv.length > 0) {
        const c0 = ctasProv[0];
        defaultCtaStr = `${c0.banco || 'Banco'} (${c0.moneda || 'USD'}) - N° Cuenta: ${c0.nro_cuenta || 'N/A'} - Titular: ${c0.titular || 'N/A'} (${c0.rif || 'N/A'}) ${c0.tipo_cuenta ? `[${c0.tipo_cuenta}]` : ''}`;
      }

      const ctaBancariaFinal = odc.datos_bancarios || odc.cuenta_bancaria || odc.cuenta_bancaria_proveedor || defaultCtaStr;

      // Buscar coincidencia en destinos predeterminados
      const destMatch = (currentDestinos || []).find(d => 
        (odc.despachar_a_id && String(d.id) === String(odc.despachar_a_id)) ||
        (odc.destino_despacho && d.nombre && (
          odc.destino_despacho.toLowerCase().trim() === d.nombre.toLowerCase().trim() ||
          odc.destino_despacho.toLowerCase().includes(d.nombre.toLowerCase())
        )) ||
        (odc.despachar_a_direccion && d.nombre && (
          odc.despachar_a_direccion.toLowerCase().trim() === d.nombre.toLowerCase().trim() ||
          odc.despachar_a_direccion.toLowerCase().includes(d.nombre.toLowerCase())
        ))
      );

      const monActual = odc.moneda || 'USD';
      const isStandardMon = ['USD', 'BS'].includes(monActual);
      const defaultDest = currentDestinos?.find(d => d.es_predeterminado) || currentDestinos?.[0];
      const initialDestId = destMatch ? destMatch.id : (odc.despachar_a_id || (defaultDest ? defaultDest.id : ''));
      const initialDestNombre = destMatch ? destMatch.nombre : (odc.destino_despacho || (defaultDest ? defaultDest.nombre : 'Campo Boscán'));
      const initialDestDir = destMatch ? (destMatch.direccion && destMatch.direccion !== 'null' ? `${destMatch.nombre} - ${destMatch.direccion}` : destMatch.nombre) : (odc.despachar_a_direccion || initialDestNombre);

      setEditOdcTarget({
        ...odc,
        requisicion_id: resolvedReqId,
        proveedor_id: odc.proveedor_id || '',
        proveedor_nombre: odc.proveedor_nombre || '',
        proveedor_rif: odc.proveedor_rif || '',
        proveedor_contacto: odc.proveedor_contacto || '',
        proveedor_ciudad: odc.proveedor_ciudad || '',
        proveedor_direccion: odc.proveedor_direccion || '',
        datos_bancarios: ctaBancariaFinal,
        cuenta_bancaria: ctaBancariaFinal,
        cotizacion_ref: odc.cotizacion_ref || '',
        fecha_cotizacion: odc.fecha_cotizacion || '',
        fecha_despacho: odc.fecha_despacho || odc.fecha_emision || '',
        tipo_pago: odc.tipo_pago || 'CONTADO',
        dias_credito: odc.dias_credito || 0,
        moneda: monActual,
        moneda_custom: isStandardMon ? '' : monActual,
        tasa_cambio: odc.tasa_cambio || odc.tasa_bcv || 1,
        despachar_a_id: initialDestId,
        destino_despacho: initialDestNombre,
        despachar_a_direccion: initialDestDir,
        pasa_por_almacen: odc.pasa_por_almacen !== false,
        terminos_condiciones: odc.terminos_condiciones || "Precios incluyen entrega en el sitio de destino especificado. Mercancía sujeta a inspección de calidad y conteo físico.",
        observaciones: odc.observaciones || localStorage.getItem(`odc_obs_${odc.id}`) || '',
        aplica_iva: aplicaIva,
        porcentaje_iva: pctIva || 16
      });
    } catch (err) {
      console.error("Error al preparar datos de edición ODC:", err);
      toast.error("Error al cargar datos para edición de la ODC");
    } finally {
      setLoadingEditData(false);
    }
  };

  const manejarCambioProveedorEdicion = (provId) => {
    const p = proveedoresList.find(prov => String(prov.id) === String(provId));
    if (p) {
      let ctas = [];
      if (p.cuentas_bancarias) {
        if (Array.isArray(p.cuentas_bancarias)) ctas = p.cuentas_bancarias;
        else if (typeof p.cuentas_bancarias === 'string') {
          try { ctas = JSON.parse(p.cuentas_bancarias); } catch { ctas = []; }
        }
      }
      let defaultCtaStr = '';
      if (ctas.length > 0) {
        const c0 = ctas[0];
        defaultCtaStr = `${c0.banco || 'Banco'} (${c0.moneda || 'USD'}) - N° Cuenta: ${c0.nro_cuenta || 'N/A'} - Titular: ${c0.titular || 'N/A'} (${c0.rif || 'N/A'}) ${c0.tipo_cuenta ? `[${c0.tipo_cuenta}]` : ''}`;
      }

      setEditOdcTarget(prev => ({
        ...prev,
        proveedor_id: p.id,
        proveedor_nombre: p.razon_social || p.nombre || '',
        proveedor_rif: p.rif || p.rif_nit || '',
        proveedor_contacto: p.persona_contacto || p.contacto_nombre || '',
        proveedor_ciudad: p.ciudad || p.localizacion || '',
        proveedor_direccion: p.direccion || '',
        datos_bancarios: defaultCtaStr,
        cuenta_bancaria: defaultCtaStr
      }));
    } else {
      setEditOdcTarget(prev => ({ ...prev, proveedor_id: provId }));
    }
  };

  const manejarCambioRequisicionEdicion = (reqId) => {
    const reqObj = (requisicionesList || []).find(r => 
      String(r.id) === String(reqId) || 
      (r.correlativo_req && String(r.correlativo_req).trim().toUpperCase() === String(reqId).trim().toUpperCase())
    );
    setSourceReqSelected(reqObj || null);
    setEditOdcTarget(prev => ({
      ...prev,
      requisicion_id: reqObj ? String(reqObj.id) : (reqId || ''),
      requisicion_correlativo: reqObj ? reqObj.correlativo_req : null,
      numero_req: reqObj ? reqObj.correlativo_req : null
    }));
    if (reqObj) {
      toast.success(`Vínculo actualizado a la Requisición ${reqObj.correlativo_req}`);
    }
  };

  const agregarItemEdicion = () => {
    setEditItems(prev => [
      ...prev,
      { id: `new_${Date.now()}`, requisicion_item_id: null, item_numero: prev.length + 1, descripcion: '', unidad: 'UNID', cantidad: 1, precio_unitario: 0, total_fila: 0 }
    ]);
  };

  const agregarItemDesdeRequisicion = (reqItem, cantOverride = null) => {
    const desc = reqItem.descripcion || reqItem.nombre || reqItem.item || '';
    const uni = reqItem.unidad || reqItem.uni || 'UNID';
    const cantAprobada = parseFloat(reqItem.cant_aprobada || reqItem.cantidad || reqItem.cant || 1);
    const cant = cantOverride !== null ? parseFloat(cantOverride) : cantAprobada;
    const pu = parseFloat(reqItem.pu_usd || reqItem.pu_bs || reqItem.precio || 0);
    const reqItemIdStr = String(reqItem.id || desc.toLowerCase().trim());

    setEditItems(prev => {
      const existingIdx = prev.findIndex(it => 
        (it.requisicion_item_id && String(it.requisicion_item_id) === reqItemIdStr) ||
        (it.descripcion || '').toLowerCase().trim() === desc.toLowerCase().trim()
      );

      if (existingIdx >= 0) {
        const updated = [...prev];
        const prevItem = updated[existingIdx];
        const nuevaCant = (parseFloat(prevItem.cantidad) || 0) + cant;
        updated[existingIdx] = {
          ...prevItem,
          requisicion_item_id: reqItemIdStr,
          cantidad: nuevaCant,
          total_fila: nuevaCant * (parseFloat(prevItem.precio_unitario) || pu)
        };
        toast.success(`Se actualizó la cantidad de "${desc}" a ${nuevaCant} ${uni} en la ODC.`);
        return updated;
      } else {
        toast.success(`Ítem "${desc}" (${cant} ${uni}) agregado a la ODC.`);
        const prevFiltrados = prev.filter(it => (it.descripcion || '').trim() !== '' || (parseFloat(it.cantidad) || 0) > 0);
        return [
          ...prevFiltrados,
          {
            id: `req_item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            requisicion_item_id: reqItemIdStr,
            item_numero: prevFiltrados.length + 1,
            descripcion: desc,
            unidad: uni,
            cantidad: cant,
            precio_unitario: pu,
            total_fila: cant * pu,
            origen_req: sourceReqSelected?.correlativo_req || 'Requisición'
          }
        ];
      }
    });
  };

  const modificarCantidadDesdeRequisicion = (reqItem, delta) => {
    const desc = reqItem.descripcion || reqItem.nombre || reqItem.item || '';
    const reqItemIdStr = String(reqItem.id || desc.toLowerCase().trim());
    const pu = parseFloat(reqItem.pu_usd || reqItem.pu_bs || reqItem.precio || 0);

    setEditItems(prev => {
      const existingIdx = prev.findIndex(it => 
        (it.requisicion_item_id && String(it.requisicion_item_id) === reqItemIdStr) ||
        (it.descripcion || '').toLowerCase().trim() === desc.toLowerCase().trim()
      );

      if (existingIdx >= 0) {
        const updated = [...prev];
        const prevItem = updated[existingIdx];
        const nuevaCant = Math.max(0, (parseFloat(prevItem.cantidad) || 0) + delta);
        if (nuevaCant === 0) {
          toast.error(`"${desc}" removido de la ODC.`);
          return updated.filter((_, i) => i !== existingIdx);
        }
        updated[existingIdx] = {
          ...prevItem,
          cantidad: nuevaCant,
          total_fila: nuevaCant * (parseFloat(prevItem.precio_unitario) || pu)
        };
        return updated;
      } else if (delta > 0) {
        const uni = reqItem.unidad || reqItem.uni || 'UNID';
        const prevFiltrados = prev.filter(it => (it.descripcion || '').trim() !== '' || (parseFloat(it.cantidad) || 0) > 0);
        return [
          ...prevFiltrados,
          {
            id: `req_item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            requisicion_item_id: reqItemIdStr,
            item_numero: prevFiltrados.length + 1,
            descripcion: desc,
            unidad: uni,
            cantidad: delta,
            precio_unitario: pu,
            total_fila: delta * pu,
            origen_req: sourceReqSelected?.correlativo_req || 'Requisición'
          }
        ];
      }
      return prev;
    });
  };

  const establecerCantidadDesdeRequisicion = (reqItem, nuevaCantVal) => {
    const desc = reqItem.descripcion || reqItem.nombre || reqItem.item || '';
    const reqItemIdStr = String(reqItem.id || desc.toLowerCase().trim());
    const pu = parseFloat(reqItem.pu_usd || reqItem.pu_bs || reqItem.precio || 0);
    const val = Math.max(0, parseFloat(nuevaCantVal) || 0);

    setEditItems(prev => {
      const existingIdx = prev.findIndex(it => 
        (it.requisicion_item_id && String(it.requisicion_item_id) === reqItemIdStr) ||
        (it.descripcion || '').toLowerCase().trim() === desc.toLowerCase().trim()
      );

      if (existingIdx >= 0) {
        if (val === 0) {
          toast.error(`"${desc}" removido de la ODC.`);
          return prev.filter((_, i) => i !== existingIdx);
        }
        const updated = [...prev];
        const prevItem = updated[existingIdx];
        updated[existingIdx] = {
          ...prevItem,
          cantidad: val,
          total_fila: val * (parseFloat(prevItem.precio_unitario) || pu)
        };
        return updated;
      } else if (val > 0) {
        const uni = reqItem.unidad || reqItem.uni || 'UNID';
        const prevFiltrados = prev.filter(it => (it.descripcion || '').trim() !== '' || (parseFloat(it.cantidad) || 0) > 0);
        return [
          ...prevFiltrados,
          {
            id: `req_item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            requisicion_item_id: reqItemIdStr,
            item_numero: prevFiltrados.length + 1,
            descripcion: desc,
            unidad: uni,
            cantidad: val,
            precio_unitario: pu,
            total_fila: val * pu,
            origen_req: sourceReqSelected?.correlativo_req || 'Requisición'
          }
        ];
      }
      return prev;
    });
  };

  const eliminarItemEdicion = (index) => {
    if (editItems.length <= 1) {
      toast.error("La ODC debe contener al menos un renglón.");
      return;
    }
    setEditItems(prev => prev.filter((_, i) => i !== index));
  };

  const actualizarItemEdicion = (index, field, val) => {
    setEditItems(prev => {
      const copy = [...prev];
      const item = { ...copy[index] };
      item[field] = val;

      if (field === 'cantidad' || field === 'precio_unitario') {
        const cant = field === 'cantidad' ? parseFloat(val) || 0 : parseFloat(item.cantidad) || 0;
        const pu = field === 'precio_unitario' ? parseFloat(val) || 0 : parseFloat(item.precio_unitario) || 0;
        item.total_fila = cant * pu;
      }
      copy[index] = item;
      return copy;
    });
  };

  const subtotalEdit = useMemo(() => {
    return editItems.reduce((acc, it) => acc + (parseFloat(it.total_fila) || 0), 0);
  }, [editItems]);

  const porcentajeIvaEdit = editOdcTarget?.aplica_iva ? (parseFloat(editOdcTarget?.porcentaje_iva) || 16) : 0;
  const montoIvaEdit = subtotalEdit * (porcentajeIvaEdit / 100);
  const totalGeneralEdit = subtotalEdit + montoIvaEdit;

  const guardarEdicionOdc = async () => {
    if (!editOdcTarget) return;

    if (!editOdcTarget.proveedor_id) {
      toast.error("Debe seleccionar un Proveedor para la Órden de Compra.");
      return;
    }
    if (!editOdcTarget.fecha_cotizacion) {
      toast.error("Debe ingresar la Fecha de Cotización del Proveedor.");
      return;
    }
    if (editOdcTarget.tipo_pago === 'CREDITO') {
      const dias = parseInt(editOdcTarget.dias_credito, 10);
      if (isNaN(dias) || dias <= 0) {
        toast.error("Para compras a Crédito, debe ingresar los Días de Crédito (mayor a 0).");
        return;
      }
    }

    const itemsValidos = editItems.filter(it => (it.descripcion || '').trim() !== '' && (parseFloat(it.cantidad) || 0) > 0);
    if (itemsValidos.length === 0) {
      toast.error("Debe incluir al menos un renglón con descripción y cantidad válida mayores a 0.");
      return;
    }

    setGuardandoEditOdc(true);
    try {
      let fechaVenc = editOdcTarget.fecha_vencimiento_credito;
      if (editOdcTarget.tipo_pago === 'CREDITO') {
        const d = new Date();
        d.setDate(d.getDate() + (parseInt(editOdcTarget.dias_credito) || 0));
        fechaVenc = d.toISOString().split('T')[0];
      } else {
        fechaVenc = null;
      }

      const reqObjTarget = (requisicionesList || []).find(r => 
        String(r.id) === String(editOdcTarget.requisicion_id) || 
        (r.correlativo_req && String(r.correlativo_req).trim().toUpperCase() === String(editOdcTarget.requisicion_id).trim().toUpperCase())
      );

      const itemPasaAlmacen = editOdcTarget.pasa_por_almacen !== false;

      const payloadOdc = {
        requisicion_id: reqObjTarget ? reqObjTarget.id : (editOdcTarget.requisicion_id && !isNaN(parseInt(editOdcTarget.requisicion_id)) ? parseInt(editOdcTarget.requisicion_id) : null),
        proveedor_id: editOdcTarget.proveedor_id || null,
        proveedor_nombre: editOdcTarget.proveedor_nombre || null,
        proveedor_rif: editOdcTarget.proveedor_rif || null,
        proveedor_contacto: editOdcTarget.proveedor_contacto || null,
        proveedor_ciudad: editOdcTarget.proveedor_ciudad || null,
        proveedor_direccion: editOdcTarget.proveedor_direccion || null,
        cotizacion_ref: editOdcTarget.cotizacion_ref || null,
        fecha_cotizacion: editOdcTarget.fecha_cotizacion || null,
        fecha_despacho: editOdcTarget.fecha_despacho || editOdcTarget.fecha_emision || null,
        tipo_pago: editOdcTarget.tipo_pago,
        dias_credito: editOdcTarget.tipo_pago === 'CREDITO' ? (parseInt(editOdcTarget.dias_credito) || 0) : 0,
        fecha_vencimiento_credito: fechaVenc,
        fecha_vencimiento_pago: fechaVenc,
        moneda: editOdcTarget.moneda || 'USD',
        tasa_bcv: parseFloat(editOdcTarget.tasa_cambio || editOdcTarget.tasa_bcv) || 1,
        despachar_a_id: editOdcTarget.despachar_a_id || null,
        despachar_a_direccion: editOdcTarget.despachar_a_direccion || editOdcTarget.destino_despacho || null,
        destino_despacho: editOdcTarget.destino_despacho || editOdcTarget.despachar_a_direccion || null,
        pasa_por_almacen: itemPasaAlmacen,
        datos_bancarios: editOdcTarget.datos_bancarios || editOdcTarget.cuenta_bancaria || null,
        cuenta_bancaria: editOdcTarget.datos_bancarios || editOdcTarget.cuenta_bancaria || null,
        terminos_condiciones: editOdcTarget.terminos_condiciones || null,
        observaciones: editOdcTarget.observaciones || null,
        subtotal: subtotalEdit,
        iva_porcentaje: porcentajeIvaEdit,
        porcentaje_iva: porcentajeIvaEdit,
        iva_monto: montoIvaEdit,
        total: totalGeneralEdit,
        total_general: totalGeneralEdit,
        ...(editOdcTarget.estado_aprobacion_precio === 'rechazado' || editOdcTarget.estatus_orden === 'RECHAZADA' || localStorage.getItem(`odc_prio_status_${editOdcTarget.id}`) === 'rechazado' ? {
          estado_aprobacion_precio: 'pendiente',
          estatus_orden: 'EMITIDA',
          motivo_rechazo_compras: null,
          prioridad_pago: null,
          carlos_comentario_aprobacion: null
        } : {})
      };

      const fueRechazadaPreviamente = editOdcTarget.estado_aprobacion_precio === 'rechazado' || 
                                      editOdcTarget.estatus_orden === 'RECHAZADA' || 
                                      localStorage.getItem(`odc_prio_status_${editOdcTarget.id}`) === 'rechazado';

      // 1. Actualizar ordenes_compra con fallback automático de columnas
      const { error: errUpdate } = await safeSupabaseUpdate(supabase, 'ordenes_compra', payloadOdc, 'id', editOdcTarget.id);
      if (errUpdate) throw errUpdate;

      localStorage.setItem(`odc_pasa_almacen_${editOdcTarget.id}`, itemPasaAlmacen ? 'true' : 'false');
      if (editOdcTarget.numero_odc) {
        localStorage.setItem(`odc_pasa_almacen_${editOdcTarget.numero_odc}`, itemPasaAlmacen ? 'true' : 'false');
      }

      if (editOdcTarget.observaciones !== undefined) {
        localStorage.setItem(`odc_obs_${editOdcTarget.id}`, editOdcTarget.observaciones || '');
      }

      if (fueRechazadaPreviamente) {
        localStorage.removeItem(`odc_prio_status_${editOdcTarget.id}`);
        localStorage.removeItem(`odc_prio_motivo_${editOdcTarget.id}`);
        localStorage.removeItem(`odc_prio_${editOdcTarget.id}`);
      }

      // 2. Eliminar items antiguos de esta ODC
      const { error: errDel } = await supabase
        .from('ordenes_compra_items')
        .delete()
        .eq('orden_compra_id', editOdcTarget.id);

      if (errDel) {
        console.warn("Aviso al limpiar ítems anteriores ODC:", errDel.message);
      }

      // 3. Re-insertar renglones actualizados con preservación de requisicion_item_id
      const newItemsPayload = itemsValidos.map((it, idx) => ({
        orden_compra_id: editOdcTarget.id,
        requisicion_item_id: it.requisicion_item_id ? String(it.requisicion_item_id) : null,
        item_numero: idx + 1,
        descripcion: it.descripcion,
        unidad: it.unidad || 'UNID',
        cantidad: parseFloat(it.cantidad) || 0,
        precio_unitario: parseFloat(it.precio_unitario) || 0,
        subtotal: (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0),
        total_fila: (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0)
      }));

      const { error: errInsItems } = await supabase
        .from('ordenes_compra_items')
        .insert(newItemsPayload);

      if (errInsItems) throw errInsItems;

      // 3.1 Sincronizar trazabilidad en la Requisición de origen en Supabase
      if (reqObjTarget) {
        try {
          const itemsReq = Array.isArray(reqObjTarget.items) ? reqObjTarget.items : (Array.isArray(reqObjTarget.detalles) ? reqObjTarget.detalles : []);
          const itemsReqActualizados = itemsReq.map(r => {
            const itemCoincidente = itemsValidos.find(it => String(it.requisicion_item_id) === String(r.id));
            if (itemCoincidente) {
              const historialPrevio = Array.isArray(r.historial_compras) ? r.historial_compras : [];
              const yaExiste = historialPrevio.some(h => String(h.odc_id) === String(editOdcTarget.id) || h.odc_numero === editOdcTarget.numero_odc);
              let historialActualizado = [];
              if (yaExiste) {
                historialActualizado = historialPrevio.map(h => {
                  if (String(h.odc_id) === String(editOdcTarget.id) || h.odc_numero === editOdcTarget.numero_odc) {
                    return {
                      ...h,
                      proveedor_nombre: editOdcTarget.proveedor_nombre || h.proveedor_nombre || 'Proveedor',
                      cantidad: parseFloat(itemCoincidente.cantidad) || 0,
                      cant: parseFloat(itemCoincidente.cantidad) || 0,
                      pu: parseFloat(itemCoincidente.precio_unitario) || 0,
                      pasa_por_almacen: itemPasaAlmacen,
                      estatus_almacen: itemPasaAlmacen ? (h.estatus_almacen === 'no_aplica' ? 'Por_Clasificar_Almacen' : (h.estatus_almacen || 'Por_Clasificar_Almacen')) : 'no_aplica',
                      ubicacion_almacen: itemPasaAlmacen ? (h.ubicacion_almacen === 'ENTREGA DIRECTA (Sin paso por almacén)' ? null : h.ubicacion_almacen) : 'ENTREGA DIRECTA (Sin paso por almacén)',
                      usuario: `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim()
                    };
                  }
                  return h;
                });
              } else {
                historialActualizado = [
                  ...historialPrevio,
                  {
                    fecha: new Date().toISOString(),
                    tipo: 'ODC',
                    odc_numero: editOdcTarget.numero_odc,
                    odc_id: editOdcTarget.id,
                    proveedor_nombre: editOdcTarget.proveedor_nombre || 'Proveedor',
                    cantidad: parseFloat(itemCoincidente.cantidad) || 0,
                    cant: parseFloat(itemCoincidente.cantidad) || 0,
                    pu: parseFloat(itemCoincidente.precio_unitario) || 0,
                    pasa_por_almacen: itemPasaAlmacen,
                    estatus_almacen: itemPasaAlmacen ? 'Por_Clasificar_Almacen' : 'no_aplica',
                    ubicacion_almacen: itemPasaAlmacen ? null : 'ENTREGA DIRECTA (Sin paso por almacén)',
                    usuario: `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim()
                  }
                ];
              }
              return {
                ...r,
                pasa_por_almacen: itemPasaAlmacen,
                estatus_almacen: itemPasaAlmacen ? (r.estatus_almacen === 'no_aplica' ? 'Por_Clasificar_Almacen' : (r.estatus_almacen || 'Por_Clasificar_Almacen')) : 'no_aplica',
                ubicacion_almacen: itemPasaAlmacen ? (r.ubicacion_almacen === 'ENTREGA DIRECTA (Sin paso por almacén)' ? null : r.ubicacion_almacen) : 'ENTREGA DIRECTA (Sin paso por almacén)',
                historial_compras: historialActualizado
              };
            }
            return r;
          });

          await supabase
            .from('requisiciones')
            .update({
              items: itemsReqActualizados,
              f_inicio_compras: reqObjTarget.f_inicio_compras || new Date().toISOString(),
              status_compra: 'EN_PROCESO'
            })
            .eq('id', reqObjTarget.id);
        } catch (syncErr) {
          console.warn("Aviso al sincronizar requisición de origen:", syncErr);
        }
      }

      // 4. Refrescar estado local
      const reqObjNuevo = reqObjTarget || (requisicionesList || []).find(r => String(r.id) === String(editOdcTarget.requisicion_id));
      let descResumenEdit = '';
      if (newItemsPayload.length === 1) {
        const it = newItemsPayload[0];
        descResumenEdit = `${it.cantidad ? it.cantidad + ' ' + (it.unidad || 'UND') + ' - ' : ''}${it.descripcion || ''}`.trim();
      } else if (newItemsPayload.length > 1) {
        descResumenEdit = newItemsPayload.map(it => `${it.cantidad ? it.cantidad + ' ' + (it.unidad || 'UND') + ' - ' : ''}${it.descripcion}`).join(', ');
      } else {
        descResumenEdit = payloadOdc.observaciones || 'Sin descripción detallada';
      }

      const odcRefrescada = {
        ...editOdcTarget,
        ...payloadOdc,
        requisicion_correlativo: reqObjNuevo?.correlativo_req || null,
        requisicion_obj: reqObjNuevo || null,
        items: newItemsPayload,
        items_count: newItemsPayload.length,
        descripcion_resumen: descResumenEdit
      };

      setOrdenes(prev => prev.map(o => o.id === editOdcTarget.id ? odcRefrescada : o));
      if (odcSeleccionada && odcSeleccionada.id === editOdcTarget.id) {
        setOdcSeleccionada(odcRefrescada);
        setOdcItems(newItemsPayload);
      }

      setShowEditModal(false);
      if (fueRechazadaPreviamente) {
        toast.success(`🎉 ODC ${editOdcTarget.numero_odc} modificada con éxito. Ha sido enviada nuevamente a revisión para su aprobación.`);
      } else {
        toast.success(`Órden de Compra ${editOdcTarget.numero_odc} editada y actualizada con éxito.`);
      }
    } catch (err) {
      console.error("Error al guardar edición de ODC:", err);
      toast.error(`Error al guardar edición: ${err.message || 'Error en servidor'}`);
    } finally {
      setGuardandoEditOdc(false);
    }
  };

  // Trazabilidad y Cálculo de Semáforo de Crédito
  const calcularSemaforoCredito = (odc) => {
    if (odc.estatus_pago === 'ANULADA' || odc.status_pago === 'ANULADA' || odc.estatus_recepcion === 'ANULADA') {
      return { nivel: 'anulada', label: '🚫 ANULADA', badgeClass: 'rojo', diasRestantes: -999 };
    }
    if (odc.estatus_pago === 'PAGADO' || odc.status_pago === 'PAGADO') {
      return { nivel: 'verde', label: '✅ PAGADO', badgeClass: 'verde', diasRestantes: 999 };
    }
    if (odc.tipo_pago !== 'CREDITO') {
      return { nivel: 'contado', label: '💵 CONTADO', badgeClass: 'verde', diasRestantes: 999 };
    }
    if (odc.estatus_recepcion !== 'RECIBIDO' && !odc.fecha_recepcion) {
      return { nivel: 'transito', label: '📦 EN TRÁNSITO (PENDIENTE RECEPCIÓN)', badgeClass: 'ambar', diasRestantes: 999 };
    }

    const fechaVenc = odc.fecha_vencimiento_credito || odc.fecha_vencimiento_pago;
    if (!fechaVenc) {
      return { nivel: 'sin_fecha', label: 'Sin Fecha Venc.', badgeClass: 'ambar', diasRestantes: 0 };
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const vencimiento = new Date(fechaVenc + 'T00:00:00');
    const diffTime = vencimiento.getTime() - hoy.getTime();
    const diasRestantes = Math.ceil(diffTime / (1000 * 3600 * 24));

    if (diasRestantes > 10) {
      return { nivel: 'verde', label: `🟢 ${diasRestantes} días restantes`, badgeClass: 'verde', diasRestantes };
    } else if (diasRestantes >= 1) {
      return { nivel: 'ambar', label: `🟡 ${diasRestantes} días restantes`, badgeClass: 'ambar', diasRestantes };
    } else {
      return { nivel: 'rojo', label: `🔴 ${diasRestantes < 0 ? 'VENCIDO (' + Math.abs(diasRestantes) + 'd)' : 'VENCE HOY'}`, badgeClass: 'rojo', diasRestantes };
    }
  };

  // Abrir modal de confirmación y selección de motivo de anulación
  const abrirModalAnularOdc = (odcTarget = odcSeleccionada) => {
    if (!odcTarget) return;
    if (!esUsuarioCompras) {
      toast.error("Solo el personal del departamento de Compras o Administración tiene autorización para anular Órdenes de Compra.");
      return;
    }
    setOdcParaAnular(odcTarget);
    setMotivoAnulacionSelect('Error en montos, precios unitarios o cotización');
    setMotivoAnulacionDetalle('');
    setModalAnularOpen(true);
  };

  // Ejecutar anulación oficial de la ODC persistiendo motivo y liberando saldo en requisición
  const ejecutarAnulacionOdc = async () => {
    if (!odcParaAnular) return;
    if (!motivoAnulacionSelect) {
      toast.error("Debe seleccionar un motivo de anulación de la lista.");
      return;
    }
    if (motivoAnulacionSelect === 'Otro motivo (especificar en detalle)' && !motivoAnulacionDetalle.trim()) {
      toast.error("Por favor detalle el motivo de la anulación en el campo de texto.");
      return;
    }

    setGuardandoAnulacion(true);
    try {
      const usuarioNombre = currentUser ? `${currentUser.nombre || ''} ${currentUser.apellido || ''}`.trim() || 'Compras' : 'Compras';
      const usuarioId = currentUser?.id || null;
      const nowIso = new Date().toISOString();

      const motivoCompleto = motivoAnulacionSelect === 'Otro motivo (especificar en detalle)'
        ? `Otro: ${motivoAnulacionDetalle.trim()}`
        : (motivoAnulacionDetalle.trim() ? `${motivoAnulacionSelect} - ${motivoAnulacionDetalle.trim()}` : motivoAnulacionSelect);

      // 1. Actualizar estado de la ODC a ANULADA en base de datos
      const dbPayload = {
        estatus_orden: 'ANULADA',
        estatus_pago: 'ANULADA',
        status_pago: 'ANULADA',
        estatus_recepcion: 'ANULADA',
        estado_aprobacion_precio: 'anulada',
        prioridad_pago: null,
        motivo_anulacion: motivoCompleto,
        motivo_rechazo_compras: motivoCompleto,
        carlos_comentario_aprobacion: `[ANULADA]: ${motivoCompleto}`,
        anulado_por: usuarioNombre,
        anulado_por_id: usuarioId,
        fecha_anulacion: nowIso,
        anulado: true
      };

      const { error } = await safeSupabaseUpdate(supabase, 'ordenes_compra', dbPayload, 'id', odcParaAnular.id);
      if (error) throw error;

      localStorage.setItem(`odc_prio_status_${odcParaAnular.id}`, 'anulada');
      localStorage.setItem(`odc_prio_motivo_${odcParaAnular.id}`, motivoCompleto);
      localStorage.removeItem(`odc_prio_${odcParaAnular.id}`);

      // 2. Sincronizar Requisición asociada para registrar la anulación en el historial y liberar cantidades
      const rawReqId = odcParaAnular.requisicion_id || odcParaAnular.requisicion_correlativo;
      if (rawReqId) {
        let numOnly = String(rawReqId).replace(/^REQ-?/i, '').trim();
        let q = supabase.from('requisiciones').select('id, items, correlativo_req');
        if (!isNaN(Number(numOnly)) && Number(numOnly) > 0) {
          q = q.or(`id.eq.${Number(numOnly)},correlativo_req.eq.${rawReqId}`);
        } else {
          q = q.eq('correlativo_req', rawReqId);
        }
        const { data: reqData } = await q.maybeSingle();

        if (reqData && Array.isArray(reqData.items)) {
          const odcIdStr = String(odcParaAnular.id);
          const odcNumStr = String(odcParaAnular.numero_odc).trim().toUpperCase();

          const updatedItems = reqData.items.map(it => {
            const hist = Array.isArray(it.historial_compras) ? it.historial_compras : [];
            let itemModificado = false;

            const newHist = hist.map(h => {
              const matchOdc = (h.odc_id && String(h.odc_id) === odcIdStr) ||
                               (h.odc_numero && String(h.odc_numero).trim().toUpperCase() === odcNumStr) ||
                               (h.doc_numero && String(h.doc_numero).trim().toUpperCase() === odcNumStr);
              if (matchOdc && h.tipo !== 'ANULACION') {
                itemModificado = true;
                return {
                  ...h,
                  tipo: 'ANULACION',
                  doc_tipo: 'ANULACION_ODC',
                  motivo: `ODC ${odcParaAnular.numero_odc} Anulada: ${motivoCompleto}`,
                  comentario: `Órden de Compra ${odcParaAnular.numero_odc} anulada (${motivoCompleto}). Saldo liberado para re-compra.`,
                  fecha_anulacion: nowIso,
                  usuario_anulo_nombre: usuarioNombre,
                  usuario_anulo_id: usuarioId,
                  anulado: true
                };
              }
              return h;
            });

            if (!itemModificado) return it;

            // Recalcular cantidad comprada activa
            const comprasActivas = newHist.filter(h => h.tipo !== 'JUSTIFICACION' && h.tipo !== 'ANULACION' && h.tipo !== 'DIRECTRIZ' && !h.anulado);
            const totalComprado = comprasActivas.reduce((acc, h) => acc + (parseFloat(h.cant) || 0), 0);
            const cantPedida = parseFloat(it.cantidad_pedida ?? it.cant) || 0;
            const nuevaPendiente = Math.max(0, cantPedida - totalComprado);

            return {
              ...it,
              historial_compras: newHist,
              cantidad_comprada: totalComprado,
              cantidad_pendiente: nuevaPendiente,
              estado_item: nuevaPendiente > 0 ? 'pendiente' : (totalComprado > 0 ? 'comprado' : 'pendiente'),
              estatus_almacen: totalComprado > 0 ? (it.estatus_almacen || 'no_aplica') : 'pendiente_asignar'
            };
          });

          await supabase
            .from('requisiciones')
            .update({ items: updatedItems })
            .eq('id', reqData.id);
        }
      }

      const odcActualizada = { 
        ...odcParaAnular, 
        ...dbPayload, 
        estatus_pago: 'ANULADA', 
        status_pago: 'ANULADA', 
        estatus_recepcion: 'ANULADA', 
        estatus_orden: 'ANULADA', 
        estado_aprobacion_precio: 'anulada' 
      };

      if (odcSeleccionada && odcSeleccionada.id === odcParaAnular.id) {
        setOdcSeleccionada(odcActualizada);
      }
      setOrdenes(prev => prev.map(o => o.id === odcParaAnular.id ? odcActualizada : o));
      setModalAnularOpen(false);
      setOdcParaAnular(null);
      toast.success(`🚫 Órden de Compra ${odcParaAnular.numero_odc} ANULADA y saldo liberado a la requisición.`);
    } catch (err) {
      console.error("Error al anular ODC:", err);
      toast.error("Error al anular la Órden de Compra: " + err.message);
    } finally {
      setGuardandoAnulacion(false);
    }
  };

  // Alternar Firma Digital Remota de Carlos Vega
  const toggleFirmaDigitalCarlos = async (activa) => {
    if (!puedeActivarFirmaCarlos) {
      toast.error("Acceso no autorizado: solo el Super Admin o la Gerencia General pueden activar la Firma Digital.");
      return;
    }
    if (!odcSeleccionada) return;
    setGuardandoFirmaCarlos(true);
    try {
      const hoyIso = new Date().toISOString();
      const payload = {
        carlos_firma_digital_activa: activa,
        carlos_firma_fecha: activa ? hoyIso : null
      };

      const { error } = await supabase
        .from('ordenes_compra')
        .update(payload)
        .eq('id', odcSeleccionada.id);

      if (error) throw error;

      const odcActualizada = { ...odcSeleccionada, ...payload };
      setOdcSeleccionada(odcActualizada);
      setOrdenes(prev => prev.map(o => o.id === odcSeleccionada.id ? odcActualizada : o));

      toast.success(activa
        ? "Firma Digital de Carlos Vega activada correctamente."
        : "Firma Digital de Carlos Vega desactivada."
      );
    } catch (err) {
      console.error("Error al actualizar firma digital de Carlos Vega:", err);
      toast.error("Error al actualizar la firma digital: " + err.message);
    } finally {
      setGuardandoFirmaCarlos(false);
    }
  };

  // Alternar Firma Digital Remota de Ricardo Herrera (Gerente de Compras)
  const toggleFirmaDigitalRicardo = async (activa) => {
    if (!puedeActivarFirmaRicardo) {
      toast.error("Acceso no autorizado: solo el Super Admin o el Gerente de Compras pueden activar el Aval Digital.");
      return;
    }
    if (!odcSeleccionada) return;
    setGuardandoFirmaRicardo(true);
    try {
      const hoyIso = new Date().toISOString();
      const payload = {
        ricardo_firma_digital_activa: activa,
        ricardo_firma_fecha: activa ? hoyIso : null,
        ricardo_firma_por: activa ? (currentUser?.nombre ? `${currentUser.nombre} ${currentUser.apellido || ''}`.trim() : 'Ricardo Herrera') : null
      };

      const { error } = await supabase
        .from('ordenes_compra')
        .update(payload)
        .eq('id', odcSeleccionada.id);

      if (error) {
        console.warn("Aviso al guardar en Supabase (campo ricardo_firma_digital_activa):", error.message);
        localStorage.setItem(`odc_ricardo_firma_${odcSeleccionada.id}`, activa ? 'true' : 'false');
      }

      const odcActualizada = { ...odcSeleccionada, ...payload };
      setOdcSeleccionada(odcActualizada);
      setOrdenes(prev => prev.map(o => o.id === odcSeleccionada.id ? odcActualizada : o));

      toast.success(activa
        ? "Aval Digital de Ricardo Herrera (Gerente de Compras) activado correctamente."
        : "Aval Digital de Ricardo Herrera desactivado."
      );
    } catch (err) {
      console.error("Error al actualizar aval digital de Ricardo Herrera:", err);
      toast.error("Error al actualizar el aval digital: " + err.message);
    } finally {
      setGuardandoFirmaRicardo(false);
    }
  };

  // Eliminar Órden de Compra (Exclusivo Administrador Principal - José)
  const manejarEliminarOdc = async (odcTarget = odcSeleccionada) => {
    if (!odcTarget) return;
    if (!esAdminSuper) {
      toast.error("Solo el Administrador Principal (jcontreras.totalclean@gmail.com) tiene permisos para eliminar Órdenes de Compra.");
      return;
    }

    const confirmar = window.confirm(`⚠️ ¡ATENCIÓN! ¿Está seguro de ELIMINAR PERMANENTEMENTE la Órden de Compra ${odcTarget.numero_odc}? Esta acción borrará el expediente y limpiará por completo el historial de la requisición.`);
    if (!confirmar) return;

    try {
      // 1. Borrar renglones asociados de la tabla ordenes_compra_items
      await supabase
        .from('ordenes_compra_items')
        .delete()
        .eq('orden_compra_id', odcTarget.id);

      // 2. Limpiar del historial_compras de la requisición asociada (borrado definitivo)
      const rawReqId = odcTarget.requisicion_id || odcTarget.requisicion_correlativo;
      if (rawReqId) {
        let numOnly = String(rawReqId).replace(/^REQ-?/i, '').trim();
        let q = supabase.from('requisiciones').select('id, items, correlativo_req');
        if (!isNaN(Number(numOnly)) && Number(numOnly) > 0) {
          q = q.or(`id.eq.${Number(numOnly)},correlativo_req.eq.${rawReqId}`);
        } else {
          q = q.eq('correlativo_req', rawReqId);
        }
        const { data: reqData } = await q.maybeSingle();

        if (reqData && Array.isArray(reqData.items)) {
          const odcIdStr = String(odcTarget.id);
          const odcNumStr = String(odcTarget.numero_odc).trim().toUpperCase();

          const updatedItems = reqData.items.map(it => {
            const hist = Array.isArray(it.historial_compras) ? it.historial_compras : [];
            const newHist = hist.filter(h => {
              const matchOdc = (h.odc_id && String(h.odc_id) === odcIdStr) ||
                               (h.odc_numero && String(h.odc_numero).trim().toUpperCase() === odcNumStr) ||
                               (h.doc_numero && String(h.doc_numero).trim().toUpperCase() === odcNumStr);
              return !matchOdc;
            });

            // Recalcular cantidad comprada activa
            const comprasActivas = newHist.filter(h => h.tipo !== 'JUSTIFICACION' && h.tipo !== 'ANULACION' && h.tipo !== 'DIRECTRIZ' && !h.anulado);
            const totalComprado = comprasActivas.reduce((acc, h) => acc + (parseFloat(h.cant) || 0), 0);
            const cantPedida = parseFloat(it.cantidad_pedida ?? it.cant) || 0;
            const nuevaPendiente = Math.max(0, cantPedida - totalComprado);

            return {
              ...it,
              historial_compras: newHist,
              cantidad_comprada: totalComprado,
              cantidad_pendiente: nuevaPendiente,
              estado_item: nuevaPendiente > 0 ? 'pendiente' : (totalComprado > 0 ? 'comprado' : 'pendiente')
            };
          });

          await supabase
            .from('requisiciones')
            .update({ items: updatedItems })
            .eq('id', reqData.id);
        }
      }

      // 3. Borrar la ODC principal
      const { error } = await supabase
        .from('ordenes_compra')
        .delete()
        .eq('id', odcTarget.id);

      if (error) throw error;

      if (odcSeleccionada && odcSeleccionada.id === odcTarget.id) {
        setModalOpen(false);
        setOdcSeleccionada(null);
      }
      setOrdenes(prev => prev.filter(o => o.id !== odcTarget.id));
      toast.success(`Órden de Compra ${odcTarget.numero_odc} eliminada y retirada del historial de la requisición.`);
    } catch (err) {
      console.error("Error al eliminar ODC:", err);
      toast.error("Error al eliminar la Órden de Compra: " + err.message);
    }
  };

  // =========================================================================
  // GESTIÓN DE ASIGNACIÓN DE PRIORIDAD Y APROBACIÓN DE PRECIOS ODC
  // =========================================================================

  // Abrir Modal de Revisión y Aprobación de Prioridad ODC
  const abrirModalAprobacionPrioridad = async (odc) => {
    let target = { ...odc };
    if (!target.datos_bancarios && !target.cuenta_bancaria) {
      const provMatch = (proveedoresList || []).find(p => String(p.id) === String(target.proveedor_id));
      let ctas = [];
      if (provMatch?.cuentas_bancarias) {
        if (Array.isArray(provMatch.cuentas_bancarias)) ctas = provMatch.cuentas_bancarias;
        else if (typeof provMatch.cuentas_bancarias === 'string') {
          try { ctas = JSON.parse(provMatch.cuentas_bancarias); } catch { ctas = []; }
        }
      }
      if (ctas.length > 0) {
        const c0 = ctas[0];
        const ctaStr = `${c0.banco || 'Banco'} (${c0.moneda || 'USD'}) - N° Cuenta: ${c0.nro_cuenta || 'N/A'} - Titular: ${c0.titular || 'N/A'} (${c0.rif || 'N/A'}) ${c0.tipo_cuenta ? `[${c0.tipo_cuenta}]` : ''}`.trim();
        target.datos_bancarios = ctaStr;
        target.cuenta_bancaria = ctaStr;
      }
    }

    setOdcPrioridadTarget(target);
    setPrioridadSeleccionada(odc.prioridad_pago ? Number(odc.prioridad_pago) : (odc.requisicion_es_emergencia ? 1 : 2));
    setMotivoRechazoInput(odc.motivo_rechazo_compras || '');
    setMostrarRechazoInput(false);
    setModalPrioridadOpen(true);
    setLoadingItemsPrioridad(true);

    try {
      const { data: items, error } = await supabase
        .from('ordenes_compra_items')
        .select('*')
        .eq('orden_compra_id', odc.id)
        .order('item_numero', { ascending: true });

      if (error) throw error;

      let reqItems = [];
      if (odc.requisicion_obj?.items) {
        reqItems = parsearJsonSeguro(odc.requisicion_obj.items);
      } else if (odc.requisicion_id) {
        const cleanReqId = String(odc.requisicion_id).replace(/^REQ-?/i, '').trim();
        const foundReq = (requisicionesList || []).find(r => 
          String(r.id) === cleanReqId || 
          String(r.id) === String(odc.requisicion_id) ||
          (r.correlativo_req && String(r.correlativo_req).trim().toUpperCase() === String(odc.requisicion_id).trim().toUpperCase())
        );
        if (foundReq?.items) {
          reqItems = parsearJsonSeguro(foundReq.items);
        }
      }

      const itemsConComparativa = (items || []).map(it => {
        const reqMatch = reqItems.find(r => 
          (it.requisicion_item_id && String(r.id) === String(it.requisicion_item_id)) ||
          (r.descripcion && it.descripcion && r.descripcion.trim().toLowerCase() === it.descripcion.trim().toLowerCase())
        );

        const puEstimado = reqMatch ? (parseFloat(reqMatch.pu || reqMatch.precio_estimado || reqMatch.costo_estimado || reqMatch.monto_estimado) || 0) : 0;
        const puCotizado = parseFloat(it.precio_unitario) || 0;
        const diffPu = puEstimado > 0 ? (puCotizado - puEstimado) : 0;
        const diffPct = (puEstimado > 0 && diffPu !== 0) ? ((diffPu / puEstimado) * 100) : 0;

        return {
          ...it,
          precio_estimado_req: puEstimado,
          diferencia_pu: diffPu,
          diferencia_pct: diffPct
        };
      });

      setItemsOdcPrioridad(itemsConComparativa);
    } catch (err) {
      console.error("Error al cargar renglones para revisión de prioridad:", err);
      toast.error("Error al cargar los renglones de la ODC");
    } finally {
      setLoadingItemsPrioridad(false);
    }
  };

  // Aprobar Precio de Orden de Compra y Asignar Prioridad (Nivel 1 o 2)
  const ejecutarAprobacionPrecioYPrioridad = async (nivel) => {
    if (!odcPrioridadTarget) return;
    const nivelFinal = Number(nivel || prioridadSeleccionada || 1);
    if (nivelFinal !== 1 && nivelFinal !== 2) {
      toast.error("Debe seleccionar un nivel de prioridad válido (Nivel 1 o Nivel 2).");
      return;
    }

    setGuardandoPrioridadOdc(true);
    try {
      const nombreAprobador = `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim() || currentUser?.correo || 'Gerencia de Compras';
      const fechaNow = new Date().toISOString();

      const payload = {
        estado_aprobacion_precio: 'aprobado',
        estatus_orden: 'APROBADA',
        prioridad_pago: nivelFinal,
        aprobado_compras_por: nombreAprobador,
        aprobado_por_nombre: nombreAprobador,
        fecha_aprobacion_compras: fechaNow,
        motivo_rechazo_compras: null,
        carlos_comentario_aprobacion: null
      };

      const { error: resError } = await safeSupabaseUpdate(supabase, 'ordenes_compra', payload, 'id', odcPrioridadTarget.id);
      if (resError) throw resError;

      localStorage.setItem(`odc_prio_${odcPrioridadTarget.id}`, String(nivelFinal));
      localStorage.setItem(`odc_prio_status_${odcPrioridadTarget.id}`, 'aprobado');
      localStorage.setItem(`odc_prio_user_${odcPrioridadTarget.id}`, nombreAprobador);
      localStorage.removeItem(`odc_prio_motivo_${odcPrioridadTarget.id}`);

      const odcActualizada = {
        ...odcPrioridadTarget,
        ...payload
      };

      setOrdenes(prev => prev.map(o => o.id === odcPrioridadTarget.id ? odcActualizada : o));
      if (odcSeleccionada && odcSeleccionada.id === odcPrioridadTarget.id) {
        setOdcSeleccionada(odcActualizada);
      }
      setOdcPrioridadTarget(odcActualizada);
      setModalPrioridadOpen(false);

      toast.success(`🎉 ODC ${odcPrioridadTarget.numero_odc} APROBADA con Prioridad Nivel ${nivelFinal}. Ahora está disponible en Cuentas por Pagar.`);
    } catch (err) {
      console.error("Error al aprobar precio y prioridad ODC:", err);
      toast.error(`Error al aprobar ODC: ${err.message || 'Error en servidor'}`);
    } finally {
      setGuardandoPrioridadOdc(false);
    }
  };

  // Rechazar Orden de Compra con Motivo
  const ejecutarRechazoPrecioODC = async () => {
    if (!odcPrioridadTarget) return;
    if (!motivoRechazoInput.trim()) {
      toast.error("Debe ingresar el motivo de rechazo o ajustes necesarios para Compras.");
      return;
    }

    setGuardandoPrioridadOdc(true);
    try {
      const nombreAprobador = `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim() || currentUser?.correo || 'Gerencia de Compras';
      const fechaNow = new Date().toISOString();
      const motivoLimpio = motivoRechazoInput.trim();

      const payload = {
        estado_aprobacion_precio: 'rechazado',
        estatus_orden: 'EMITIDA',
        prioridad_pago: null,
        motivo_rechazo_compras: motivoLimpio,
        carlos_comentario_aprobacion: `[RECHAZADO]: ${motivoLimpio}`,
        aprobado_compras_por: nombreAprobador,
        aprobado_por_nombre: nombreAprobador,
        fecha_aprobacion_compras: fechaNow
      };

      const { error: resError } = await safeSupabaseUpdate(supabase, 'ordenes_compra', payload, 'id', odcPrioridadTarget.id);
      if (resError) throw resError;

      localStorage.setItem(`odc_prio_status_${odcPrioridadTarget.id}`, 'rechazado');
      localStorage.setItem(`odc_prio_motivo_${odcPrioridadTarget.id}`, motivoLimpio);
      localStorage.removeItem(`odc_prio_${odcPrioridadTarget.id}`);

      const odcActualizada = {
        ...odcPrioridadTarget,
        ...payload
      };

      setOrdenes(prev => prev.map(o => o.id === odcPrioridadTarget.id ? odcActualizada : o));
      if (odcSeleccionada && odcSeleccionada.id === odcPrioridadTarget.id) {
        setOdcSeleccionada(odcActualizada);
      }
      setOdcPrioridadTarget(odcActualizada);
      setModalPrioridadOpen(false);

      toast.error(`❌ ODC ${odcPrioridadTarget.numero_odc} rechazada. Se devolvió a Compras para ajustes.`);
    } catch (err) {
      console.error("Error al rechazar ODC:", err);
      toast.error(`Error al rechazar ODC: ${err.message || 'Error en servidor'}`);
    } finally {
      setGuardandoPrioridadOdc(false);
    }
  };

  // Modificar Nivel de Prioridad en cualquier momento (Opción 3)
  const cambiarNivelPrioridadDirecto = async (odc, nuevoNivel) => {
    const nivelFinal = Number(nuevoNivel);
    if (nivelFinal !== 1 && nivelFinal !== 2) return;

    try {
      const nombreAprobador = `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim() || currentUser?.correo || 'Gerencia de Compras';
      const payload = {
        prioridad_pago: nivelFinal,
        estado_aprobacion_precio: 'aprobado',
        estatus_orden: 'APROBADA',
        aprobado_compras_por: nombreAprobador,
        aprobado_por_nombre: nombreAprobador
      };

      const { error: resError } = await safeSupabaseUpdate(supabase, 'ordenes_compra', payload, 'id', odc.id);
      if (resError) throw resError;

      localStorage.setItem(`odc_prio_${odc.id}`, String(nivelFinal));
      localStorage.setItem(`odc_prio_status_${odc.id}`, 'aprobado');

      const odcActualizada = { ...odc, ...payload };
      setOrdenes(prev => prev.map(o => o.id === odc.id ? odcActualizada : o));
      if (odcSeleccionada && odcSeleccionada.id === odc.id) {
        setOdcSeleccionada(odcActualizada);
      }
      toast.success(`Prioridad de ${odc.numero_odc} cambiada a Nivel ${nivelFinal}.`);
    } catch (err) {
      console.error("Error al cambiar prioridad:", err);
      toast.error("Error al actualizar prioridad: " + err.message);
    }
  };

  // Actualizar Estatus de Recepción de Mercancía
  const cambiarEstatusRecepcion = async (nuevoEstatus, odcTarget = odcSeleccionada) => {
    if (!odcTarget) return;
    try {
      const hoyStr = new Date().toISOString().split('T')[0];
      let fechaVenc = odcTarget.fecha_vencimiento_credito;

      if (nuevoEstatus === 'RECIBIDO') {
        if (odcTarget.tipo_pago === 'CREDITO') {
          const dias = parseInt(odcTarget.dias_credito) || 0;
          const d = new Date();
          d.setDate(d.getDate() + dias);
          fechaVenc = d.toISOString().split('T')[0];
        }
      } else {
        fechaVenc = null;
      }

      const payload = {
        estatus_recepcion: nuevoEstatus,
        fecha_recepcion: nuevoEstatus === 'RECIBIDO' ? hoyStr : null,
        fecha_vencimiento_credito: fechaVenc,
        fecha_vencimiento_pago: fechaVenc
      };

      try {
        await supabase
          .from('ordenes_compra')
          .update(payload)
          .eq('id', odcTarget.id);
      } catch (err) {
        console.warn("Aviso al actualizar estatus_recepcion en DB:", err.message);
      }

      const odcActualizada = { ...odcTarget, ...payload };
      if (odcSeleccionada && odcSeleccionada.id === odcTarget.id) {
        setOdcSeleccionada(odcActualizada);
      }
      setOrdenes(prev => prev.map(o => o.id === odcTarget.id ? odcActualizada : o));
      toast.success(nuevoEstatus === 'RECIBIDO' 
        ? " Mercancía / Servicio marcado como RECIBIDO. ¡Cuenta regresiva de crédito iniciada!" 
        : " Estatus cambiado a EN TRÁNSITO.");
    } catch (err) {
      console.error("Error al cambiar estatus de recepción:", err);
      toast.error("Error al cambiar estatus de recepción");
    }
  };

  // Actualizar Estatus de Pago de la ODC
  const cambiarEstatusPago = async (nuevoEstatus, odcTarget = odcSeleccionada) => {
    if (!odcTarget) return;
    try {
      const hoyStr = new Date().toISOString().split('T')[0];
      const payload = { estatus_pago: nuevoEstatus };
      if (nuevoEstatus === 'PAGADO' && odcTarget.estatus_recepcion !== 'RECIBIDO') {
        payload.estatus_recepcion = 'RECIBIDO';
        payload.fecha_recepcion = hoyStr;
      }

      const { error } = await supabase
        .from('ordenes_compra')
        .update(payload)
        .eq('id', odcTarget.id);

      if (error) throw error;

      const odcActualizada = { ...odcTarget, ...payload };
      if (odcSeleccionada && odcSeleccionada.id === odcTarget.id) {
        setOdcSeleccionada(odcActualizada);
      }
      setOrdenes(prev => prev.map(o => o.id === odcTarget.id ? odcActualizada : o));
      toast.success(`Estado de pago actualizado a: ${nuevoEstatus}`);
    } catch (err) {
      console.error("Error al cambiar estatus de pago:", err);
      toast.error("Error al cambiar estado de pago");
    }
  };

  // Cargar Imagen de Logo Institucional
  const cargarImagenLogo = () => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = '/logo.png';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
    });
  };

  // Generación de documento PDF Formato Oficial F-ADM-01-2 (3 Copias en un solo documento)
  const construirDocPDF_F_ADM_01_2 = async () => {
    if (!odcSeleccionada) return null;

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const logoImg = await cargarImagenLogo();

      const copias = [
        "original para el cliente",
        "Copia para cuenta por pagar",
        "copia para control de compras"
      ];

      let rawReqOrigen = odcSeleccionada.requisicion_correlativo || 
                         odcSeleccionada.requisicion_obj?.correlativo_req || 
                         odcSeleccionada.numero_req || 
                         odcSeleccionada.correlativo_req;

      if (!rawReqOrigen || rawReqOrigen.startsWith('REQ-') || !isNaN(Number(rawReqOrigen))) {
        const numOnly = String(odcSeleccionada.requisicion_id || '').replace(/^REQ-?/i, '').trim();
        const found = (requisicionesList || []).find(r => 
          String(r.id) === numOnly || 
          (r.correlativo_req && String(r.correlativo_req).trim().toUpperCase() === String(odcSeleccionada.requisicion_id || '').trim().toUpperCase())
        );
        if (found?.correlativo_req) {
          rawReqOrigen = found.correlativo_req;
        }
      }

      if (!rawReqOrigen || rawReqOrigen === 'null') {
        rawReqOrigen = odcSeleccionada.requisicion_id ? (String(odcSeleccionada.requisicion_id).startsWith('REQ-') ? odcSeleccionada.requisicion_id : `REQ-${odcSeleccionada.requisicion_id}`) : 'N/A';
      }

      const rawCentroCosto = odcSeleccionada.requisicion_obj?.centro_costo || 
                             odcSeleccionada.requisicion_obj?.obra || 
                             odcSeleccionada.centro_costo || 
                             'No especificado';
      const centroCostoLimpio = String(rawCentroCosto || '').replace(/\s*-\s*null/gi, '').replace(/\bnull\b/gi, '').trim() || 'No especificado';

      const rawDestino = odcSeleccionada.destino_despacho || 
                         odcSeleccionada.despachar_a_direccion || 
                         odcSeleccionada.despachar_a || 
                         'Galpones Riese - Av. Los Haticos';
      const destinoEntregaLimpio = String(rawDestino || '').replace(/\s*-\s*null/gi, '').replace(/\bnull\b/gi, '').trim() || 'Galpones Riese - Av. Los Haticos';

      const solicitanteNombre = odcSeleccionada.requisicion_obj?.solicitante || 
                                odcSeleccionada.solicitante || 
                                odcSeleccionada.solicitado_por || 
                                'Total Clean C.A.';

      const fechaEmisionStr = odcSeleccionada.fecha_emision 
        ? new Date(odcSeleccionada.fecha_emision).toLocaleDateString('es-VE') 
        : (odcSeleccionada.created_at ? new Date(odcSeleccionada.created_at).toLocaleDateString('es-VE') : new Date().toLocaleDateString('es-VE'));

      const fechaCotizacionStr = odcSeleccionada.fecha_cotizacion 
        ? new Date(odcSeleccionada.fecha_cotizacion).toLocaleDateString('es-VE') 
        : '';

      const monedaCode = odcSeleccionada.moneda || 'USD';
      const formaPagoTexto = odcSeleccionada.tipo_pago === 'CREDITO'
        ? `Crédito (${odcSeleccionada.dias_credito || 0} días)`
        : 'Contado';

      const subtotal = Number(odcSeleccionada.subtotal || 0);
      const percentageIva = Number(odcSeleccionada.porcentaje_iva !== undefined && odcSeleccionada.porcentaje_iva !== null ? odcSeleccionada.porcentaje_iva : (odcSeleccionada.iva_porcentaje || 16));
      const montoIva = odcSeleccionada.iva_monto !== undefined && odcSeleccionada.iva_monto !== null 
        ? Number(odcSeleccionada.iva_monto) 
        : (subtotal * (percentageIva / 100));
      const totalGeneral = Number(odcSeleccionada.total_general || (subtotal + montoIva));

      const correlativoNum = odcSeleccionada.numero_odc 
        ? odcSeleccionada.numero_odc.replace('ODC-2026-', '').replace('ODC-', '') 
        : '000106';

      copias.forEach((copiaLabel, pageIndex) => {
        if (pageIndex > 0) {
          doc.addPage();
        }

        const marginX = 12;
        const usableWidth = pageWidth - (marginX * 2);

        // --- ENCABEZADO SUPERIOR ---
        // Izquierda: Título y Correlativo en Rojo
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16.5);
        doc.setTextColor(30, 58, 138); // Azul corporativo
        doc.text("Orden de Compra", marginX, 9.5);

        doc.setFontSize(13.5);
        doc.setTextColor(220, 38, 38); // Rojo
        doc.text(`No. ${correlativoNum}`, marginX, 15.0);

        // Derecha: Logo y Datos de Empresa
        let headerTextY = 10.5;
        if (logoImg) {
          const logoW = 32;
          const logoH = (logoImg.height / logoImg.width) * logoW;
          doc.addImage(logoImg, 'PNG', pageWidth - marginX - logoW, 3.5, logoW, logoH);
          headerTextY = 3.5 + logoH + 1.2;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.2);
        doc.setTextColor(15, 23, 42);
        doc.text("TOTAL CLEAN C.A.", pageWidth - marginX, headerTextY, { align: 'right' });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.4);
        doc.text("Dirección Fiscal: AV 61 ENTRE CALLE 147 Y TAPÓN PARCELA CI-19 SECTOR I,", pageWidth - marginX, headerTextY + 2.8, { align: 'right' });
        doc.text("LOCAL GALPÓN NRO 147-113, ZONA INDUSTRIAL DE MARACAIBO SUR.", pageWidth - marginX, headerTextY + 5.0, { align: 'right' });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.2);
        doc.text("Telf.: 0414-8101155 / 0414-643-1203", pageWidth - marginX, headerTextY + 7.4, { align: 'right' });
        doc.text("R.I.F.: J-30365868-7", pageWidth - marginX, headerTextY + 9.8, { align: 'right' });

        const barY = Math.max(headerTextY + 12.5, 24.0);

        // --- REQUISICIÓN DE ORIGEN ENCIMA DE FECHA ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.8);
        doc.setTextColor(30, 58, 138);
        doc.text("Requisición:", marginX, barY - 1.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(`${rawReqOrigen}`, marginX + 16.5, barY - 1.5);

        // --- BARRA DE METADATOS ---
        doc.setDrawColor(30, 58, 138);
        doc.setLineWidth(0.3);
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, barY, usableWidth, 6.8, 'FD');

        doc.setFontSize(7.8);
        const colW = usableWidth / 4;
        
        // Col 1: Fecha
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 58, 138);
        doc.text("Fecha:", marginX + 2, barY + 4.6);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0);
        doc.text(fechaEmisionStr, marginX + 12, barY + 4.6);
        doc.line(marginX + colW, barY, marginX + colW, barY + 6.8);

        // Col 2: Cotización
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 58, 138);
        doc.text("Cotización:", marginX + colW + 2, barY + 4.6);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0);
        doc.text(odcSeleccionada.cotizacion_ref || '', marginX + colW + 18, barY + 4.6);
        doc.line(marginX + colW * 2, barY, marginX + colW * 2, barY + 6.8);

        // Col 3: Aprobada por (Vacío para llenado manual)
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 58, 138);
        doc.text("Aprobada por:", marginX + colW * 2 + 2, barY + 4.6);
        doc.line(marginX + colW * 3, barY, marginX + colW * 3, barY + 6.8);

        // Col 4: Fecha de Cotización
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 58, 138);
        doc.text("Fecha Cotiz.:", marginX + colW * 3 + 2, barY + 4.6);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0);
        doc.text(fechaCotizacionStr || '', marginX + colW * 3 + 19, barY + 4.6);

        // --- BANNER DATOS DEL PROVEEDOR ---
        const bannerY = barY + 7.8;
        doc.setFillColor(241, 245, 249);
        doc.rect(marginX, bannerY, usableWidth, 5.2, 'FD');
        doc.setFont("helvetica", "bolditalic");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 58, 138);
        doc.text("DATOS DEL PROVEEDOR", marginX + (usableWidth / 2), bannerY + 3.7, { align: 'center' });

        // --- TABLA DE DATOS DEL PROVEEDOR ---
        const datosBancariosTexto = odcSeleccionada.datos_bancarios || odcSeleccionada.cuenta_bancaria || 'Ver datos bancarios registrados';
        const provDataY = bannerY + 5.2;
        const tablaProvBody = [
          [`Nombre: ${odcSeleccionada.proveedor_nombre || 'N/A'}`, `Contacto: ${odcSeleccionada.proveedor_contacto || 'N/A'}`],
          [`Dirección: ${odcSeleccionada.proveedor_direccion || 'N/A'}`, `País: ${odcSeleccionada.proveedor_pais || 'Venezuela'}`],
          [`Teléfono: ${odcSeleccionada.proveedor_telefono || 'N/A'}`, `Fecha de Despacho:`],
          [`R.I.F.: ${odcSeleccionada.proveedor_rif || 'N/A'}`, `Forma de Pago: ${formaPagoTexto}`],
          [`Ciudad: ${odcSeleccionada.proveedor_ciudad || 'N/A'}`, `Cuenta / Pago Prov: ${datosBancariosTexto}`],
          [`Lugar de Entrega: ${destinoEntregaLimpio}`, `Centro de Costo: ${centroCostoLimpio}`],
          [`Solicitado por: ${solicitanteNombre}`, ``]
        ];

        autoTable(doc, {
          startY: provDataY,
          margin: { left: marginX, right: marginX },
          body: tablaProvBody,
          theme: 'plain',
          styles: {
            fontSize: 7.8,
            cellPadding: { top: 1.1, bottom: 1.1, left: 3, right: 3 },
            textColor: [0, 0, 0],
            lineWidth: 0
          },
          columnStyles: {
            0: { cellWidth: usableWidth * 0.54 },
            1: { cellWidth: usableWidth * 0.46 }
          }
        });

        const tablaProvEndY = doc.lastAutoTable.finalY;
        doc.setDrawColor(30, 58, 138);
        doc.setLineWidth(0.3);
        doc.rect(marginX, provDataY, usableWidth, tablaProvEndY - provDataY);

        // --- TABLA DE RENGLONES / ITEMS (CON COLUMNA UNID) ---
        const itemsHead = [["CANT.", "UNID.", "DESCRIPCIÓN", "PRECIO UNITARIO", "TOTAL"]];
        const itemsBody = (odcItems && odcItems.length > 0)
          ? odcItems.map(it => [
              Number(it.cantidad || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }),
              it.unidad || 'UNID',
              it.descripcion || 'Sin descripción',
              Number(it.precio_unitario || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }),
              Number(it.total_fila || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })
            ])
          : [["1.00", "UNID", "Renglón general de compra", Number(subtotal).toLocaleString('de-DE', { minimumFractionDigits: 2 }), Number(subtotal).toLocaleString('de-DE', { minimumFractionDigits: 2 })]];

        autoTable(doc, {
          startY: tablaProvEndY + 2.5,
          margin: { left: marginX, right: marginX },
          head: itemsHead,
          body: itemsBody,
          theme: 'grid',
          styles: { fontSize: 8.0, cellPadding: 2.0, textColor: [0, 0, 0], lineWidth: 0.2, lineColor: [30, 58, 138] },
          headStyles: { fillColor: [241, 245, 249], textColor: [30, 58, 138], fontStyle: 'bold', halign: 'center', fontSize: 8.2, lineWidth: 0.2, lineColor: [30, 58, 138] },
          columnStyles: {
            0: { halign: 'center', cellWidth: 16 },
            1: { halign: 'center', cellWidth: 15 },
            2: { cellWidth: usableWidth - 16 - 15 - 32 - 32 },
            3: { halign: 'right', cellWidth: 32 },
            4: { halign: 'right', cellWidth: 32 }
          }
        });

        let itemsEndY = doc.lastAutoTable.finalY;

        // --- CUADRO DE TOTALES (SUB-TOTAL, IVA, TOTAL SIN DECIR USD) ---
        const totBoxW = 68;
        const totBoxH = 15.5;
        const totBoxX = pageWidth - marginX - totBoxW;
        const totBoxY = itemsEndY;

        doc.setDrawColor(30, 58, 138);
        doc.setLineWidth(0.3);
        doc.rect(totBoxX, totBoxY, totBoxW, totBoxH);

        doc.setFontSize(7.8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text("Sub-Total:", totBoxX + 2.5, totBoxY + 4.2);
        doc.setFont("helvetica", "normal");
        doc.text(subtotal.toLocaleString('de-DE', { minimumFractionDigits: 2 }), pageWidth - marginX - 3, totBoxY + 4.2, { align: 'right' });

        doc.setFont("helvetica", "bold");
        doc.text(`IVA ${percentageIva}%:`, totBoxX + 2.5, totBoxY + 8.6);
        doc.setFont("helvetica", "normal");
        doc.text(montoIva.toLocaleString('de-DE', { minimumFractionDigits: 2 }), pageWidth - marginX - 3, totBoxY + 8.6, { align: 'right' });

        doc.line(totBoxX, totBoxY + 10.2, pageWidth - marginX, totBoxY + 10.2);
        doc.setFont("helvetica", "bold");
        doc.text("TOTAL:", totBoxX + 2.5, totBoxY + 13.8);
        doc.text(totalGeneral.toLocaleString('de-DE', { minimumFractionDigits: 2 }), pageWidth - marginX - 3, totBoxY + 13.8, { align: 'right' });

        // --- BLOQUE INFERIOR SIEMPRE EN LA PARTE DE ABAJO (FIJO AL PIE) ---
        const bottomBlockTopY = Math.max(totBoxY + totBoxH + 2.5, pageHeight - 69);

        // 1. Aviso de Documentos Exigidos
        doc.setFont("helvetica", "italic");
        doc.setFontSize(6.8);
        doc.setTextColor(30, 58, 138);
        doc.text("Favor comunicarnos de inmediato si existen problemas para el despacho exacto esta orden, Enviar los siguientes documentos:", marginX, bottomBlockTopY + 2.0);

        // 2. Checklist de Documentos Exigidos
        const docBoxY = bottomBlockTopY + 3.0;
        const docBoxH = 9.5;
        doc.setDrawColor(30, 58, 138);
        doc.setLineWidth(0.3);
        doc.setFillColor(255, 255, 255);
        doc.rect(marginX, docBoxY, usableWidth, docBoxH, 'FD');

        const docColW = usableWidth / 4;
        const docCols = [
          { title: "Nota de Entrega" },
          { title: "Factura" },
          { title: "Con. de Embarque:" },
          { title: "Otros:" }
        ];

        docCols.forEach((dCol, dIdx) => {
          const dX = marginX + (dIdx * docColW);
          if (dIdx > 0) {
            doc.line(dX, docBoxY, dX, docBoxY + docBoxH);
          }
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.4);
          doc.setTextColor(30, 58, 138);
          doc.text(dCol.title, dX + (docColW / 2), docBoxY + 3.2, { align: 'center' });

          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.4);
          doc.setTextColor(0);
          doc.text("No. _________  Copias: ____", dX + (docColW / 2), docBoxY + 7.2, { align: 'center' });
        });

        // 3. Leyes y Condiciones Comerciales
        const terminosBoxY = docBoxY + docBoxH + 1.6;
        const terminosBoxH = 9.0;
        doc.setDrawColor(30, 58, 138);
        doc.setLineWidth(0.3);
        doc.rect(marginX, terminosBoxY, usableWidth, terminosBoxH);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.0);
        doc.setTextColor(30, 58, 138);
        doc.text("Leyes, Términos & Condiciones Comerciales:", marginX + 2.5, terminosBoxY + 3.0);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.4);
        doc.setTextColor(0);
        const textoTerminosStr = odcSeleccionada.terminos_condiciones || "Precios incluyen entrega en el sitio de destino especificado. Mercancía sujeta a inspección de calidad y conteo físico.";
        const splitTerms = doc.splitTextToSize(textoTerminosStr, usableWidth - 5);
        doc.text(splitTerms, marginX + 2.5, terminosBoxY + 6.3);

        // 4. Campo de Observaciones
        const obsBoxY = terminosBoxY + terminosBoxH + 1.6;
        const obsBoxH = 11.5;
        doc.setDrawColor(30, 58, 138);
        doc.setLineWidth(0.3);
        doc.rect(marginX, obsBoxY, usableWidth, obsBoxH);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.4);
        doc.setTextColor(30, 58, 138);
        doc.text("OBSERVACIONES", marginX + (usableWidth / 2), obsBoxY + 3.2, { align: 'center' });

        const textoObs = odcSeleccionada.observaciones || "";
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.6);
        doc.setTextColor(0);
        if (textoObs.trim()) {
          const splitObs = doc.splitTextToSize(textoObs, usableWidth - 6);
          doc.text(splitObs, marginX + 3, obsBoxY + 6.8);
        } else {
          doc.setDrawColor(226, 232, 240);
          doc.line(marginX + 4, obsBoxY + 6.8, marginX + usableWidth - 4, obsBoxY + 6.8);
          doc.line(marginX + 4, obsBoxY + 9.5, marginX + usableWidth - 4, obsBoxY + 9.5);
        }

        // 5. Cuadros de Firmas / Elaboradores (Compactos)
        const sigY = obsBoxY + obsBoxH + 1.6;
        const sigH = 18.5;
        const sigW = usableWidth / 3;

        const compradorNombre = odcSeleccionada.comprador_nombre || currentUser?.nombre || 'José';

        // 1. Elaborado por
        doc.setDrawColor(30, 58, 138);
        doc.setLineWidth(0.3);
        doc.rect(marginX, sigY, sigW, sigH);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.2);
        doc.setTextColor(30, 58, 138);
        doc.text("Elaborado por (nombre y firma)", marginX + sigW / 2, sigY + 3.2, { align: 'center' });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.2);
        doc.text("Departamento de Compras", marginX + sigW / 2, sigY + 6.0, { align: 'center' });
        doc.line(marginX + 6, sigY + 12.0, marginX + sigW - 6, sigY + 12.0);
        doc.setFontSize(6.2);
        doc.text(compradorNombre, marginX + sigW / 2, sigY + 15.8, { align: 'center' });

        // 2. Revisado y avalado por Ricardo Herrera
        doc.rect(marginX + sigW, sigY, sigW, sigH);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.2);
        doc.text("Revisado y avalado por (nombre y firma)", marginX + sigW + sigW / 2, sigY + 3.2, { align: 'center' });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.2);
        doc.text("Gerente de Compras", marginX + sigW + sigW / 2, sigY + 6.0, { align: 'center' });

        if (odcSeleccionada.ricardo_firma_digital_activa) {
          doc.setFillColor(240, 253, 244);
          doc.setDrawColor(22, 101, 52);
          doc.roundedRect(marginX + sigW + 3, sigY + 7.5, sigW - 6, 9.2, 1, 1, 'FD');
          doc.setFont("helvetica", "bold");
          doc.setFontSize(5.6);
          doc.setTextColor(4, 120, 87);
          doc.text("AVALADO DIGITALMENTE", marginX + sigW + sigW / 2, sigY + 11.0, { align: 'center' });
          doc.setFontSize(5.2);
          doc.text("Ricardo Herrera (Gerente de Compras)", marginX + sigW + sigW / 2, sigY + 14.8, { align: 'center' });
        } else {
          doc.line(marginX + sigW + 6, sigY + 12.0, marginX + sigW * 2 - 6, sigY + 12.0);
          doc.setFontSize(6.2);
          doc.text("Ricardo Herrera (Gerente de Compras)", marginX + sigW + sigW / 2, sigY + 15.8, { align: 'center' });
        }

        // 3. Autorizado por Carlos Vega
        doc.rect(marginX + sigW * 2, sigY, sigW, sigH);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.2);
        doc.text("Autorizado por (nombre y firma)", marginX + sigW * 2 + sigW / 2, sigY + 3.2, { align: 'center' });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.2);
        doc.text("Personal Autorizado", marginX + sigW * 2 + sigW / 2, sigY + 6.0, { align: 'center' });

        if (odcSeleccionada.carlos_firma_digital_activa) {
          doc.setFillColor(240, 253, 244);
          doc.setDrawColor(22, 101, 52);
          doc.roundedRect(marginX + sigW * 2 + 3, sigY + 7.5, sigW - 6, 9.2, 1, 1, 'FD');
          doc.setFont("helvetica", "bold");
          doc.setFontSize(5.6);
          doc.setTextColor(4, 120, 87);
          doc.text("FIRMADO DIGITALMENTE", marginX + sigW * 2 + sigW / 2, sigY + 11.0, { align: 'center' });
          doc.setFontSize(5.2);
          doc.text("Carlos Vega (Gerencia General)", marginX + sigW * 2 + sigW / 2, sigY + 14.8, { align: 'center' });
        } else {
          doc.line(marginX + sigW * 2 + 6, sigY + 12.0, marginX + usableWidth - 6, sigY + 12.0);
          doc.setFontSize(6.2);
          doc.text("Carlos Vega (Gerencia General)", marginX + sigW * 2 + sigW / 2, sigY + 15.8, { align: 'center' });
        }

        // Texto pie a la derecha: "Verificado datos de compra por proveedor"
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.2);
        doc.setTextColor(30, 58, 138);
        doc.text("Verificado datos de compra por proveedor", pageWidth - marginX, sigY + sigH + 3.8, { align: 'right' });

        // --- IDENTIFICADOR DE COPIA EN EL PIE DE PÁGINA (ESTILIZADO Y ELEGANTE) ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.8);
        doc.setTextColor(30, 58, 138);
        doc.text(`— ${copiaLabel.toUpperCase()} —`, pageWidth / 2, pageHeight - 5.0, { align: 'center' });
      });

      return doc;
    } catch (err) {
      console.error("Error al generar PDF de ODC:", err);
      toast.error("Error al generar PDF de la ODC: " + err.message, { id: 'pdf-odc' });
      throw err;
    }
  };

  // Abrir Modal de Vista Previa Interactiva de PDF
  const abrirVistaPreviaPDF = async () => {
    if (!odcSeleccionada) return;
    if (!puedeExportarODCOriginal) {
      toast.error("Acceso restringido: Solo Gerencia y Compras pueden exportar la ODC");
      return;
    }

    try {
      setGenerandoPdfPreview(true);
      setShowPdfPreviewModal(true);
      toast.loading("Cargando vista previa oficial de Orden de Compra...", { id: 'pdf-preview-load' });
      
      const doc = await construirDocPDF_F_ADM_01_2();
      if (!doc) throw new Error("No se pudo generar el formato PDF.");
      
      const blobUrl = doc.output('bloburl');
      setPdfDocInstance(doc);
      setPdfPreviewUrl(blobUrl);
      toast.success("Vista previa lista.", { id: 'pdf-preview-load' });
    } catch (err) {
      console.error("Error al generar vista previa de PDF:", err);
      toast.error("Error al generar vista previa: " + err.message, { id: 'pdf-preview-load' });
      setShowPdfPreviewModal(false);
    } finally {
      setGenerandoPdfPreview(false);
    }
  };

  // Imprimir desde la Vista Previa
  const imprimirPDFActual = () => {
    if (pdfIframeRef.current && pdfIframeRef.current.contentWindow) {
      try {
        pdfIframeRef.current.contentWindow.focus();
        pdfIframeRef.current.contentWindow.print();
        return;
      } catch (e) {
        console.warn("Iframe print directo no disponible, abriendo blobUrl con autoPrint:", e);
      }
    }
    if (pdfDocInstance) {
      pdfDocInstance.autoPrint();
      const printUrl = pdfDocInstance.output('bloburl');
      const win = window.open(printUrl, '_blank');
      if (win) {
        win.focus();
      }
    }
  };

  // Descargar PDF desde la Vista Previa
  const descargarPDFActual = () => {
    if (pdfDocInstance && odcSeleccionada) {
      pdfDocInstance.save(`Orden_Compra_${odcSeleccionada.numero_odc || 'ODC'}.pdf`);
      toast.success("Descarga de PDF iniciada con éxito.");
    }
  };

  // Cerrar Vista Previa y liberar memoria
  const cerrarVistaPreviaPDF = () => {
    setShowPdfPreviewModal(false);
    if (pdfPreviewUrl) {
      try {
        URL.revokeObjectURL(pdfPreviewUrl);
      } catch (e) {
        // ignore
      }
    }
    setPdfPreviewUrl(null);
    setPdfDocInstance(null);
  };

  // Helper para verificar si una ODC está anulada
  const esAnuladaOdc = (o) => Boolean(
    o && (
      o.estatus_orden === 'ANULADA' ||
      o.estatus_pago === 'ANULADA' ||
      o.status_pago === 'ANULADA' ||
      o.estado_aprobacion_precio === 'anulada' ||
      o.anulado === true
    )
  );

  // Subconjuntos para conteo de Prioridad ODC (excluyendo anuladas)
  const odcsPendientesPrioridad = useMemo(() => {
    return ordenes.filter(o => {
      if (esAnuladaOdc(o)) return false;
      const st = (o.estado_aprobacion_precio || '').toLowerCase();
      return st === 'pendiente' || (!st && o.estatus_pago !== 'PAGADO' && o.status_pago !== 'PAGADO');
    });
  }, [ordenes]);

  const odcsAprobadasPrioridad = useMemo(() => {
    return ordenes.filter(o => {
      if (esAnuladaOdc(o)) return false;
      const st = (o.estado_aprobacion_precio || '').toLowerCase();
      return st === 'aprobado' || (o.prioridad_pago !== null && o.prioridad_pago !== undefined);
    });
  }, [ordenes]);

  const odcsRechazadasPrioridad = useMemo(() => {
    return ordenes.filter(o => {
      if (esAnuladaOdc(o)) return false;
      const st = (o.estado_aprobacion_precio || '').toLowerCase();
      return st === 'rechazado';
    });
  }, [ordenes]);

  // Filtrado de la Lista de Órdenes
  const ordenesFiltradas = useMemo(() => {
    const bLower = (busqueda || '').toLowerCase().trim();
    return ordenes.filter(o => {
      if (bLower) {
        const itemsMatch = (o.items || []).some(it => 
          (it.descripcion || '').toLowerCase().includes(bLower)
        );
        const matchBusqueda = (o.numero_odc || '').toLowerCase().includes(bLower) ||
                              (o.proveedor_nombre || '').toLowerCase().includes(bLower) ||
                              (o.cotizacion_ref || '').toLowerCase().includes(bLower) ||
                              (o.orden_pago_ref || '').toLowerCase().includes(bLower) ||
                              (o.destino_despacho || '').toLowerCase().includes(bLower) ||
                              (o.comprador_nombre || '').toLowerCase().includes(bLower) ||
                              (o.requisicion_correlativo || '').toLowerCase().includes(bLower) ||
                              (o.descripcion_resumen || '').toLowerCase().includes(bLower) ||
                              itemsMatch;

        if (!matchBusqueda) return false;
      }

      if (tabFiltro === 'contado') {
        return o.tipo_pago === 'CONTADO' && !esAnuladaOdc(o);
      }
      if (tabFiltro === 'credito') {
        return o.tipo_pago === 'CREDITO' && !esAnuladaOdc(o);
      }
      if (tabFiltro === 'por_vencer') {
        if (o.tipo_pago !== 'CREDITO' || o.estatus_pago === 'PAGADO' || esAnuladaOdc(o)) return false;
        const sem = calcularSemaforoCredito(o);
        return sem.nivel === 'ambar' || sem.nivel === 'rojo';
      }
      if (tabFiltro === 'anuladas') {
        return esAnuladaOdc(o);
      }
      if (tabFiltro === 'prioridad') {
        if (esAnuladaOdc(o)) return false;
        const st = (o.estado_aprobacion_precio || '').toLowerCase();
        if (subtabPrioridad === 'pendientes') {
          return st === 'pendiente' || (!st && o.estatus_pago !== 'PAGADO' && o.status_pago !== 'PAGADO');
        }
        if (subtabPrioridad === 'aprobadas') {
          return st === 'aprobado' || (o.prioridad_pago !== null && o.prioridad_pago !== undefined);
        }
        if (subtabPrioridad === 'rechazadas') {
          return st === 'rechazado';
        }
        return true;
      }
      return true;
    });
  }, [ordenes, busqueda, tabFiltro, subtabPrioridad]);

  return (
    <div className="odc-container">
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderLeft: '6px solid #0ea5e9',
        paddingLeft: '16px',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <div>
          <h1 style={{ margin: 0, color: '#0f172a', fontSize: '1.8rem', fontWeight: '900', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.5px' }}>
            Órdenes de Compra
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem', fontWeight: '500', fontFamily: 'Inter, sans-serif' }}>
            Gestión centralizada de compras, proveedores y asignación de prioridad de pagos
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <motion.button
            onClick={cargarOrdenes}
            whileHover={{ scale: 1.04, boxShadow: '0 6px 20px rgba(14, 165, 233, 0.25)' }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '12px',
              backgroundColor: '#0ea5e9',
              color: 'white',
              border: 'none',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={16} /> Actualizar
          </motion.button>
        </div>
      </div>

      {/* Pestañas y Filtros Rápidos */}
      <div className="odc-tabs">
        <button 
          className={`odc-tab-btn ${tabFiltro === 'todas' ? 'active' : ''}`}
          onClick={() => setTabFiltro('todas')}
        >
          <FileText size={16} /> Todas ({ordenes.length})
        </button>
        <button 
          className={`odc-tab-btn ${tabFiltro === 'contado' ? 'active' : ''}`}
          onClick={() => setTabFiltro('contado')}
        >
          <DollarSign size={16} /> Cuentas de Contado ({ordenes.filter(o => o.tipo_pago === 'CONTADO' && o.estatus_orden !== 'ANULADA').length})
        </button>
        <button 
          className={`odc-tab-btn ${tabFiltro === 'credito' ? 'active' : ''}`}
          onClick={() => setTabFiltro('credito')}
        >
          <CreditCard size={16} /> Cuentas a Crédito ({ordenes.filter(o => o.tipo_pago === 'CREDITO' && o.estatus_orden !== 'ANULADA').length})
        </button>
        <button 
          className={`odc-tab-btn ${tabFiltro === 'por_vencer' ? 'active' : ''}`}
          onClick={() => setTabFiltro('por_vencer')}
          style={{ borderColor: '#f59e0b', color: tabFiltro === 'por_vencer' ? 'white' : '#d97706' }}
        >
          <AlertTriangle size={16} /> Créditos por Vencer / Vencidos ⚠️
        </button>
        <button 
          className={`odc-tab-btn ${tabFiltro === 'anuladas' ? 'active' : ''}`}
          onClick={() => setTabFiltro('anuladas')}
          style={{
            borderColor: tabFiltro === 'anuladas' ? '#ef4444' : '#fca5a5',
            backgroundColor: tabFiltro === 'anuladas' ? '#ef4444' : '#fef2f2',
            color: tabFiltro === 'anuladas' ? '#ffffff' : '#dc2626',
            fontWeight: '700'
          }}
        >
          <Ban size={16} /> Anuladas ({ordenes.filter(o => o.estatus_orden === 'ANULADA' || o.estatus_pago === 'ANULADA' || o.estado_aprobacion_precio === 'anulada').length})
        </button>
        {puedeAprobarPrioridadODC && (
          <button 
            className={`odc-tab-btn ${tabFiltro === 'prioridad' ? 'active' : ''}`}
            onClick={() => setTabFiltro('prioridad')}
            style={{
              borderColor: tabFiltro === 'prioridad' ? '#7c3aed' : '#c4b5fd',
              backgroundColor: tabFiltro === 'prioridad' ? '#7c3aed' : '#f5f3ff',
              color: tabFiltro === 'prioridad' ? '#ffffff' : '#6d28d9',
              fontWeight: '800'
            }}
          >
            <ShieldCheck size={16} /> ⭐ Asignación de Prioridad ODC
            <span style={{
              marginLeft: '6px',
              backgroundColor: tabFiltro === 'prioridad' ? '#ffffff' : (odcsPendientesPrioridad.length > 0 ? '#ef4444' : '#6d28d9'),
              color: tabFiltro === 'prioridad' ? '#7c3aed' : '#ffffff',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.72rem',
              fontWeight: '900'
            }}>
              {odcsPendientesPrioridad.length}
            </span>
          </button>
        )}
      </div>

      {/* Subpanel Informativo cuando está activa la pestaña de Prioridad */}
      {tabFiltro === 'prioridad' && (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1.5px solid #ddd6fe',
          padding: '20px 24px',
          marginBottom: '20px',
          boxShadow: '0 4px 15px rgba(124, 58, 237, 0.06)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.25rem' }}>⭐</span>
                <h3 style={{ margin: 0, color: '#4c1d95', fontSize: '1.15rem', fontWeight: '900' }}>
                  Panel de Aprobación de Precios y Asignación de Prioridad de Pago
                </h3>
              </div>
              <p style={{ margin: '4px 0 0 0', color: '#6d28d9', fontSize: '0.83rem', fontWeight: '500' }}>
                Exclusivo para Super Admin, Gerente de Compras y Gerente General. Solo las Órdenes de Compra con precio aprobado y prioridad asignada (Nivel 1 o Nivel 2) se liberan a Cuentas por Pagar.
              </p>
            </div>

            {/* Sub-filtros de Prioridad */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setSubtabPrioridad('pendientes')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  border: subtabPrioridad === 'pendientes' ? '1.5px solid #d97706' : '1px solid #fde68a',
                  backgroundColor: subtabPrioridad === 'pendientes' ? '#fef3c7' : '#fffbeb',
                  color: '#92400e'
                }}
              >
                ⏳ Pendientes por Aprobar ({odcsPendientesPrioridad.length})
              </button>
              <button
                type="button"
                onClick={() => setSubtabPrioridad('aprobadas')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  border: subtabPrioridad === 'aprobadas' ? '1.5px solid #16a34a' : '1px solid #bbf7d0',
                  backgroundColor: subtabPrioridad === 'aprobadas' ? '#dcfce7' : '#f0fdf4',
                  color: '#166534'
                }}
              >
                ✅ Aprobadas Nivel 1 & 2 ({odcsAprobadasPrioridad.length})
              </button>
              <button
                type="button"
                onClick={() => setSubtabPrioridad('rechazadas')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  border: subtabPrioridad === 'rechazadas' ? '1.5px solid #dc2626' : '1px solid #fca5a5',
                  backgroundColor: subtabPrioridad === 'rechazadas' ? '#fee2e2' : '#fef2f2',
                  color: '#991b1b'
                }}
              >
                ❌ Rechazadas ({odcsRechazadasPrioridad.length})
              </button>
              <button
                type="button"
                onClick={() => setSubtabPrioridad('todas')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  border: subtabPrioridad === 'todas' ? '1.5px solid #64748b' : '1px solid #cbd5e1',
                  backgroundColor: subtabPrioridad === 'todas' ? '#0f172a' : '#f8fafc',
                  color: subtabPrioridad === 'todas' ? '#ffffff' : '#475569'
                }}
              >
                📋 Todas ({ordenes.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Buscador */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '15px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input 
            type="text"
            className="input-style"
            style={{ width: '100%', paddingLeft: '42px', height: '44px', borderRadius: '12px', fontSize: '0.85rem' }}
            placeholder="Buscar por correlativo ODC, descripción de compra, proveedor, ref. cotización, requisición o destino..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {/* Tabla de Órdenes de Compra */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflowX: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <div style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto' }} />
            Cargando expedientes de Órdenes de Compra...
          </div>
        ) : ordenesFiltradas.length === 0 ? (
          <div style={{ padding: '50px', textAlign: 'center', color: '#94a3b8' }}>
            <FileText size={40} style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
            <p style={{ margin: 0, fontWeight: '600' }}>No se encontraron Órdenes de Compra con los filtros seleccionados.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', color: 'white', textAlign: 'left' }}>
                <th style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>Correlativo ODC</th>
                <th style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>Proveedor & Condición</th>
                <th style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>Requisición Origen</th>
                <th style={{ padding: '14px 16px', minWidth: '220px', maxWidth: '340px' }}>Descripción de Compra</th>
                <th style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>Tipo Pago</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>Aprobación Precio & Prioridad</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>Recepción & Pago</th>
                <th style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>Total General</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>Firmas Digitales</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ordenesFiltradas.map((odc) => {
                const sem = calcularSemaforoCredito(odc);
                const esAnuladaRow = esAnuladaOdc(odc);
                return (
                  <tr key={odc.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.2s', backgroundColor: esAnuladaRow ? '#fffbfb' : 'transparent' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <motion.span
                        onClick={() => abrirDetalleOdc(odc)}
                        whileHover={{
                          scale: 1.08,
                          x: 4,
                          color: '#2563eb',
                          textShadow: '0 0 8px rgba(37, 99, 235, 0.2)'
                        }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 10 }}
                        style={{
                          fontSize: '13px',
                          fontWeight: '900',
                          color: esAnuladaRow ? '#dc2626' : '#1e40af',
                          textDecoration: 'underline',
                          textUnderlineOffset: '3px',
                          textDecorationColor: esAnuladaRow ? 'rgba(220, 38, 38, 0.4)' : 'rgba(30, 64, 175, 0.4)',
                          cursor: 'pointer',
                          display: 'inline-block'
                        }}
                        title="Ver expediente y vista previa de esta ODC (Solo lectura)"
                      >
                        {odc.numero_odc}
                      </motion.span>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '600', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={11} color="#0284c7" />
                        <span>Emitido: <strong>{odc.elaborado_por_nombre || odc.comprador_nombre || odc.usuario_nombre || 'Comprador'}</strong></span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '700', color: '#0f172a' }}>{odc.proveedor_nombre || 'N/A'}</div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '3px' }}>
                        {odc.proveedor_es_preferencial ? (
                          <span style={{ fontSize: '0.68rem', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                            ⭐ PREFERENCIAL
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.68rem', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#64748b' }}>
                            🏢 REGULAR
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '700', color: '#0f172a' }}>
                        {odc.requisicion_correlativo || odc.requisicion_obj?.correlativo_req || odc.numero_req || (odc.requisicion_id ? (String(odc.requisicion_id).startsWith('REQ-') ? odc.requisicion_id : `REQ-${odc.requisicion_id}`) : 'N/A')}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '3px' }}>
                        {odc.requisicion_es_emergencia ? (
                          <span style={{ fontSize: '0.68rem', fontWeight: '900', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }}>
                            🚨 EMERGENCIA
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.68rem', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#64748b' }}>
                            📋 NORMAL
                          </span>
                        )}
                        {odc.pasa_por_almacen === false ? (
                          <span style={{ fontSize: '0.68rem', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }} title="Entrega directa en sitio / servicio (No pasa por almacén)">
                            🚚 DIRECTO
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.68rem', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }} title="Pasa por recepción física en Almacén">
                            📦 ALMACÉN
                          </span>
                        )}
                      </div>
                    </td>
                    {/* Descripción Breve de la Compra / Renglones */}
                    <td style={{ padding: '14px 16px', minWidth: '220px', maxWidth: '340px' }}>
                      {odc.items && odc.items.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {odc.items.slice(0, 2).map((it, idx) => (
                            <div 
                              key={it.id || idx} 
                              style={{ 
                                fontSize: '0.8rem', 
                                color: '#1e293b', 
                                lineHeight: '1.25',
                                display: 'flex',
                                alignItems: 'baseline',
                                gap: '6px'
                              }}
                            >
                              <span style={{ 
                                fontSize: '0.68rem', 
                                fontWeight: '800', 
                                color: '#0284c7', 
                                backgroundColor: '#f0f9ff', 
                                border: '1px solid #bae6fd',
                                padding: '1px 5px', 
                                borderRadius: '4px',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}>
                                {it.cantidad} {it.unidad || 'UND'}
                              </span>
                              <span 
                                style={{ 
                                  fontWeight: '600',
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis', 
                                  whiteSpace: 'nowrap',
                                  color: '#334155'
                                }}
                                title={`${it.cantidad || ''} ${it.unidad || 'UND'} - ${it.descripcion}`}
                              >
                                {it.descripcion}
                              </span>
                            </div>
                          ))}
                          {odc.items.length > 2 && (
                            <div style={{ marginTop: '2px' }}>
                              <span 
                                onClick={() => abrirDetalleOdc(odc)}
                                style={{ 
                                  fontSize: '0.72rem', 
                                  color: '#0369a1', 
                                  fontWeight: '700', 
                                  cursor: 'pointer',
                                  backgroundColor: '#f8fafc',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  border: '1px dashed #cbd5e1',
                                  display: 'inline-block'
                                }}
                                title={odc.items.map((it, i) => `${i + 1}. ${it.cantidad || ''} ${it.unidad || 'UND'} - ${it.descripcion}`).join('\n')}
                              >
                                +{odc.items.length - 2} ítem{odc.items.length - 2 > 1 ? 's' : ''} más (ver todos)
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div 
                          style={{ 
                            fontSize: '0.78rem', 
                            color: odc.descripcion_resumen && odc.descripcion_resumen !== 'Sin descripción detallada' ? '#334155' : '#94a3b8', 
                            fontWeight: odc.descripcion_resumen && odc.descripcion_resumen !== 'Sin descripción detallada' ? '600' : '500',
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap',
                            maxWidth: '320px'
                          }}
                          title={odc.descripcion_resumen || odc.observaciones || ''}
                        >
                          {odc.descripcion_resumen || odc.observaciones || 'Sin descripción'}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ 
                        padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700',
                        backgroundColor: odc.tipo_pago === 'CREDITO' ? '#eff6ff' : '#f0fdf4',
                        color: odc.tipo_pago === 'CREDITO' ? '#1d4ed8' : '#15803d'
                      }}>
                        {odc.tipo_pago} {odc.tipo_pago === 'CREDITO' ? `(${odc.dias_credito}d)` : ''}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {esAnuladaRow ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <span style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '900', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>
                            🚫 ANULADA
                          </span>
                          {odc.motivo_anulacion && (
                            <span style={{ fontSize: '0.68rem', color: '#991b1b', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`Motivo: ${odc.motivo_anulacion}`}>
                              {odc.motivo_anulacion}
                            </span>
                          )}
                        </div>
                      ) : odc.estado_aprobacion_precio === 'aprobado' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          {odc.prioridad_pago === 1 ? (
                            <span style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '900', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
                              🔴 NIVEL 1 (Urgente)
                            </span>
                          ) : (
                            <span style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '900', backgroundColor: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' }}>
                              🔵 NIVEL 2 (Normal)
                            </span>
                          )}
                          {puedeAprobarPrioridadODC && (
                            <button
                              type="button"
                              onClick={() => cambiarNivelPrioridadDirecto(odc, odc.prioridad_pago === 1 ? 2 : 1)}
                              style={{
                                padding: '2px 6px',
                                fontSize: '0.65rem',
                                fontWeight: '700',
                                borderRadius: '4px',
                                border: '1px dashed #94a3b8',
                                backgroundColor: '#f8fafc',
                                color: '#475569',
                                cursor: 'pointer'
                              }}
                              title="Cambiar entre Nivel 1 y Nivel 2 en cualquier momento"
                            >
                              🔄 Cambiar a Nivel {odc.prioridad_pago === 1 ? 2 : 1}
                            </button>
                          )}
                        </div>
                      ) : odc.estado_aprobacion_precio === 'rechazado' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <span style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '900', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }}>
                            ❌ RECHAZADA
                          </span>
                          {odc.motivo_rechazo_compras && (
                            <span style={{ fontSize: '0.68rem', color: '#991b1b', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={odc.motivo_rechazo_compras}>
                              {odc.motivo_rechazo_compras}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => abrirModalEditarOdc(odc)}
                            style={{
                              padding: '3px 8px',
                              fontSize: '0.68rem',
                              fontWeight: '800',
                              borderRadius: '6px',
                              border: '1px solid #fca5a5',
                              backgroundColor: '#ffffff',
                              color: '#dc2626',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title="Modificar esta orden de compra rechazada para corregirla"
                          >
                            <Edit2 size={11} /> Modificar ODC
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <span style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800', backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                            ⏳ PENDIENTE
                          </span>
                          {puedeAprobarPrioridadODC && (
                            <button
                              type="button"
                              onClick={() => abrirModalAprobacionPrioridad(odc)}
                              style={{
                                padding: '3px 8px',
                                fontSize: '0.7rem',
                                fontWeight: '800',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: '#7c3aed',
                                color: 'white',
                                cursor: 'pointer'
                              }}
                            >
                              ⭐ Aprobar
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {esAnuladaRow ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                          <span style={{ padding: '4px 10px', fontSize: '0.72rem', fontWeight: '800', borderRadius: '8px', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>
                            🚫 ANULADA
                          </span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => cambiarEstatusRecepcion(odc.estatus_recepcion === 'RECIBIDO' ? 'PENDIENTE' : 'RECIBIDO', odc)}
                            style={{
                              padding: '3px 8px',
                              fontSize: '0.68rem',
                              fontWeight: '800',
                              borderRadius: '6px',
                              border: 'none',
                              cursor: 'pointer',
                              backgroundColor: odc.estatus_recepcion === 'RECIBIDO' ? '#dcfce7' : '#fef3c7',
                              color: odc.estatus_recepcion === 'RECIBIDO' ? '#15803d' : '#b45309'
                            }}
                            title="Clic para registrar recepción física de mercancía"
                          >
                            {odc.estatus_recepcion === 'RECIBIDO' ? '📦 RECIBIDO' : '🚚 MARCAR RECIBIDO'}
                          </button>
                          {odc.estatus_pago === 'PAGADO' || odc.status_pago === 'PAGADO' ? (
                            <span style={{ padding: '3px 8px', fontSize: '0.68rem', fontWeight: '800', borderRadius: '6px', backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>
                              ✅ PAGADO
                            </span>
                          ) : (
                            <span style={{ padding: '3px 8px', fontSize: '0.68rem', fontWeight: '700', borderRadius: '6px', backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }} title="El pago es procesado por el departamento de Cuentas por Pagar">
                              ⏳ PAGO PENDIENTE
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                      $ {Number(odc.total_general || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                        {odc.ricardo_firma_digital_activa ? (
                          <span style={{ color: '#16a34a', fontSize: '0.68rem', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '3px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 6px', borderRadius: '6px' }} title="Aval Digital Gerente de Compras (Ricardo Herrera) Activo">
                            <ShieldCheck size={12} /> Compras
                          </span>
                        ) : null}
                        {odc.carlos_firma_digital_activa ? (
                          <span style={{ color: '#16a34a', fontSize: '0.68rem', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '3px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 6px', borderRadius: '6px' }} title="Firma Digital Gerente General (Carlos Vega) Activa">
                            <ShieldCheck size={12} /> Gerencia
                          </span>
                        ) : null}
                        {!odc.ricardo_firma_digital_activa && !odc.carlos_firma_digital_activa && (
                          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Física</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                        {esUsuarioCompras && !esAnuladaRow && (
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => abrirModalEditarOdc(odc)}
                            style={{ 
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              border: '1px solid #fed7aa',
                              backgroundColor: '#fff7ed',
                              color: '#ea580c',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Editar ODC (proveedor, precios, renglones, destino)"
                          >
                            <Edit2 size={16} />
                          </motion.button>
                        )}
                        {esUsuarioCompras && !esAnuladaRow && (
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => abrirModalAnularOdc(odc)}
                            style={{ 
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              border: '1px solid #fca5a5',
                              backgroundColor: '#fef2f2',
                              color: '#dc2626',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Anular esta Órden de Compra"
                          >
                            <Ban size={16} />
                          </motion.button>
                        )}
                        {esSuperAdmin && (
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => manejarEliminarOdc(odc)}
                            style={{ 
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              border: 'none',
                              backgroundColor: '#991b1b',
                              color: 'white',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Eliminar permanentemente esta Órden de Compra (Super Admin)"
                          >
                            <Trash2 size={16} />
                          </motion.button>
                        )}
                        {esAnuladaRow && !esSuperAdmin && (
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
                            —
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Expediente Detalle y Formato F-ADM-01-2 */}
      {modalOpen && odcSeleccionada && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', width: '100%', maxWidth: '950px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)', padding: '28px', position: 'relative' }}>
            
            {/* Botón Cerrar en la esquina superior derecha */}
            <motion.button 
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              style={{ 
                position: 'absolute', 
                top: '20px', 
                right: '20px', 
                background: '#f1f5f9', 
                border: 'none', 
                borderRadius: '50%', 
                width: '36px', 
                height: '36px', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                zIndex: 20
              }}
              onClick={() => setModalOpen(false)}
              title="Cerrar ventana"
            >
              <XCircle size={22} color="#64748b" />
            </motion.button>

            {/* Cabecera Acciones Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '18px', paddingRight: '45px', flexWrap: 'wrap', gap: '16px' }}>
              
              {/* Columna Izquierda: Título, Emitido por y Badges debajo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Expediente de Órden de Compra
                </span>
                
                <h2 style={{ margin: '2px 0 2px 0', fontSize: '1.5rem', fontWeight: '900', color: '#0f172a' }}>
                  {odcSeleccionada.numero_odc}
                </h2>
                
                <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                  <User size={14} color="#0284c7" />
                  <span>Emitido por: <strong style={{ color: '#0f172a' }}>{odcSeleccionada.elaborado_por_nombre || odcSeleccionada.comprador_nombre || odcSeleccionada.usuario_nombre || 'Departamento de Compras'}</strong></span>
                </div>

                {/* Badges de Requisición Origen y Entrega Directa / Almacén debajo de Emitido por */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                  {esAnuladaOdc(odcSeleccionada) && (
                    <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '4px 12px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: '900', border: '1px solid #fecaca', display: 'inline-flex', alignItems: 'center', gap: '5px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                      🚫 ODC ANULADA (Solo Lectura)
                    </span>
                  )}
                  {(odcSeleccionada.requisicion_correlativo || odcSeleccionada.requisicion_id) && (
                    <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '4px 12px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: '800', border: '1px solid #bae6fd', display: 'inline-flex', alignItems: 'center', gap: '5px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                      📋 Requisición Origen: {odcSeleccionada.requisicion_correlativo || `REQ-${odcSeleccionada.requisicion_id}`}
                    </span>
                  )}
                  {odcSeleccionada.pasa_por_almacen === false ? (
                    <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: '800', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: '5px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                      🚚 Entrega Directa en Obra (Sin paso por almacén)
                    </span>
                  ) : (
                    <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '4px 12px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: '800', border: '1px solid #bbf7d0', display: 'inline-flex', alignItems: 'center', gap: '5px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                      📦 Recepción Física en Almacén
                    </span>
                  )}
                </div>
              </div>

              {/* Columna Derecha: Botones de Acción en armonía */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', alignSelf: 'center', flexWrap: 'wrap' }}>
                {esUsuarioCompras && !esAnuladaOdc(odcSeleccionada) && (
                  <motion.button
                    type="button"
                    onClick={() => abrirModalEditarOdc(odcSeleccionada)}
                    whileHover={{ scale: 1.04, y: -2, boxShadow: '0 6px 16px rgba(2, 132, 199, 0.2)' }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    style={{
                      padding: '9px 18px',
                      fontSize: '0.82rem',
                      fontWeight: '800',
                      borderRadius: '12px',
                      border: '1.5px solid #cbd5e1',
                      cursor: 'pointer',
                      background: '#ffffff',
                      color: '#0284c7',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                    }}
                    title="Editar datos, proveedor, ítems y montos de esta Órden de Compra"
                  >
                    <Edit2 size={16} /> ✏️ Editar ODC
                  </motion.button>
                )}

                {/* CONTROL RBAC DE IMPRESIÓN EXCLUSIVO PARA SUPERADMIN, GERENTE GENERAL Y GERENTE DE COMPRAS */}
                {puedeExportarODCOriginal ? (
                  <motion.button 
                    type="button"
                    whileHover={{ scale: 1.04, y: -2, boxShadow: '0 8px 20px rgba(2, 132, 199, 0.35)' }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    style={{ 
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', 
                      color: 'white',
                      border: 'none',
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      padding: '10px 20px', 
                      borderRadius: '12px', 
                      fontSize: '0.82rem', 
                      fontWeight: '800',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
                    }}
                    onClick={abrirVistaPreviaPDF}
                    title="Abrir vista previa interactiva antes de exportar o imprimir (F-ADM-01-2)"
                  >
                    <Printer size={16} /> Exportar / Imprimir F-ADM-01-2
                  </motion.button>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={14} /> Impresión exclusiva de Gerencia y Compras
                  </div>
                )}
              </div>
            </div>

            {/* Banner de Órden de Compra ANULADA */}
            {esAnuladaOdc(odcSeleccionada) && (
              <div style={{ backgroundColor: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: '16px', padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 2px 8px rgba(220, 38, 38, 0.08)' }}>
                <div style={{ backgroundColor: '#fee2e2', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', flexShrink: 0 }}>
                  <Ban size={26} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991b1b', fontWeight: '900', fontSize: '0.95rem' }}>
                    🚫 ESTA ÓRDEN DE COMPRA SE ENCUENTRA ANULADA
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#7f1d1d', marginTop: '3px' }}>
                    <strong>Motivo de anulación:</strong> {odcSeleccionada.motivo_anulacion || odcSeleccionada.motivo_rechazo_compras || 'Orden de compra cancelada / anulada en Compras.'}
                  </div>
                  {(odcSeleccionada.anulado_por || odcSeleccionada.fecha_anulacion) && (
                    <div style={{ fontSize: '0.75rem', color: '#991b1b', marginTop: '3px', fontWeight: '600' }}>
                      {odcSeleccionada.anulado_por ? `Anulada por: ${odcSeleccionada.anulado_por}` : ''}
                      {odcSeleccionada.fecha_anulacion ? ` • Fecha: ${new Date(odcSeleccionada.fecha_anulacion).toLocaleString('es-VE')}` : ''}
                    </div>
                  )}
                  <div style={{ fontSize: '0.73rem', color: '#b91c1c', marginTop: '2px', fontStyle: 'italic' }}>
                    ℹ️ Visualización en modo solo lectura. Todas las opciones de edición y modificación se encuentran deshabilitadas.
                  </div>
                </div>
              </div>
            )}

            {/* Banner de ODC Rechazada con botón para modificar */}
            {!esAnuladaOdc(odcSeleccionada) && odcSeleccionada.estado_aprobacion_precio === 'rechazado' && (
              <div style={{ backgroundColor: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: '16px', padding: '16px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                <div style={{ flex: 1, minWidth: '260px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991b1b', fontWeight: '900', fontSize: '0.92rem' }}>
                    <AlertTriangle size={20} color="#dc2626" /> Esta Órden de Compra fue RECHAZADA por Compras / Gerencia
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#7f1d1d', marginTop: '4px' }}>
                    <strong>Motivo de ajustes:</strong> {odcSeleccionada.motivo_rechazo_compras || 'Ajustes en precios, condiciones o proveedor requeridos.'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#991b1b', marginTop: '2px', fontStyle: 'italic' }}>
                    Por favor modifique los datos según las observaciones y guarde para reenviar a aprobación.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    abrirModalEditarOdc(odcSeleccionada);
                  }}
                  style={{
                    padding: '10px 18px',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    fontWeight: '800',
                    fontSize: '0.82rem',
                    borderRadius: '10px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 10px rgba(220, 38, 38, 0.25)'
                  }}
                >
                  <Edit2 size={16} /> ✏️ Modificar y Reenviar ODC
                </button>
              </div>
            )}

            {/* Panel de Control de Gobernanza (Switch de Ricardo Herrera - Gerencia de Compras) */}
            {esRicardoHerrera && !esAnuladaOdc(odcSeleccionada) && (
              <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '16px', padding: '16px 20px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 6px rgba(2, 132, 199, 0.06)' }}>
                <div>
                  <span style={{ fontWeight: '800', color: '#0369a1', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={18} /> Gobernanza de Aval Digital - Ricardo Herrera (Gerencia de Compras)
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#0284c7', display: 'block', marginTop: '2px' }}>
                    Al activar esta opción se estampará automáticamente tu aval digital en el casillero de Gerente de Compras en el formato F-ADM-01-2.
                  </span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem', color: '#0369a1' }}>
                  <input 
                    type="checkbox" 
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                    checked={odcSeleccionada.ricardo_firma_digital_activa === true}
                    disabled={guardandoFirmaRicardo}
                    onChange={(e) => toggleFirmaDigitalRicardo(e.target.checked)}
                  />
                  Aval Digital Activo
                </label>
              </div>
            )}

            {/* Panel de Control de Gobernanza (Switch de Carlos Vega - Gerencia General) */}
            {esCarlosVega && !esAnuladaOdc(odcSeleccionada) && (
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '16px', padding: '16px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 6px rgba(22, 101, 52, 0.06)' }}>
                <div>
                  <span style={{ fontWeight: '800', color: '#166534', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={18} /> Gobernanza de Firma Remota - Carlos Vega (Gerencia General)
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#15803d', display: 'block', marginTop: '2px' }}>
                    Al activar esta opción se estampará automáticamente tu firma digital y leyenda de verificación en el PDF oficial F-ADM-01-2.
                  </span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem', color: '#14532d' }}>
                  <input 
                    type="checkbox" 
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                    checked={odcSeleccionada.carlos_firma_digital_activa === true}
                    disabled={guardandoFirmaCarlos}
                    onChange={(e) => toggleFirmaDigitalCarlos(e.target.checked)}
                  />
                  Firma Digital Activa
                </label>
              </div>
            )}

            {/* Paneles de Edición de Observaciones y Leyes/Condiciones (Lado a Lado) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              
              {/* Panel de Edición de Observaciones de la ODC */}
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileText size={16} color="#0ea5e9" /> Observaciones de la Órden de Compra
                    </span>
                    {!esAnuladaOdc(odcSeleccionada) && (
                      <button 
                        type="button" 
                        onClick={() => setEditandoObservaciones(!editandoObservaciones)}
                        style={{ padding: '5px 10px', fontSize: '0.72rem', fontWeight: '700', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', cursor: 'pointer' }}
                      >
                        {editandoObservaciones ? 'Ocultar' : '✏️ Editar Observaciones'}
                      </button>
                    )}
                  </div>

                  {editandoObservaciones && !esAnuladaOdc(odcSeleccionada) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <textarea
                        rows={3}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #0ea5e9', fontSize: '0.8rem', fontFamily: 'inherit', resize: 'vertical' }}
                        value={textoObservaciones}
                        onChange={(e) => setTextoObservaciones(e.target.value)}
                        placeholder="Escriba aquí las observaciones especiales para esta orden de compra..."
                      />
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          disabled={guardandoObservaciones}
                          onClick={() => guardarObservacionesOdc(textoObservaciones)}
                          style={{ padding: '6px 14px', fontSize: '0.75rem', fontWeight: '800', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                        >
                          {guardandoObservaciones ? 'Guardando...' : '💾 Guardar Observaciones'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: '#334155', lineHeight: '1.4' }}>
                      {odcSeleccionada.observaciones || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sin observaciones registradas (se mostrarán líneas para llenado manual).</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Panel de Edición de Leyes y Condiciones Comerciales */}
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileText size={16} color="#0ea5e9" /> Leyes, Términos & Condiciones Comerciales
                    </span>
                    {!esAnuladaOdc(odcSeleccionada) && (
                      <button 
                        type="button" 
                        onClick={() => setEditandoTerminos(!editandoTerminos)}
                        style={{ padding: '5px 10px', fontSize: '0.72rem', fontWeight: '700', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', cursor: 'pointer' }}
                      >
                        {editandoTerminos ? 'Ocultar' : '✏️ Editar Leyes / Condiciones'}
                      </button>
                    )}
                  </div>

                  {editandoTerminos && !esAnuladaOdc(odcSeleccionada) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <textarea
                        rows={3}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #0ea5e9', fontSize: '0.8rem', fontFamily: 'inherit', resize: 'vertical' }}
                        value={textoTerminos}
                        onChange={(e) => setTextoTerminos(e.target.value)}
                        placeholder="Escriba aquí los términos, leyes y condiciones comerciales..."
                      />
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => guardarTerminosPredeterminados(textoTerminos)}
                          style={{ padding: '5px 12px', fontSize: '0.72rem', fontWeight: '700', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                        >
                          ⭐ Predeterminado Global
                        </button>
                        <button
                          type="button"
                          disabled={guardandoTerminos}
                          onClick={() => guardarTerminosOdc(textoTerminos)}
                          style={{ padding: '5px 14px', fontSize: '0.75rem', fontWeight: '800', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                        >
                          {guardandoTerminos ? 'Guardando...' : '💾 Guardar para esta ODC'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: '#334155', lineHeight: '1.4' }}>
                      {odcSeleccionada.terminos_condiciones || "Precios incluyen entrega en el sitio de destino especificado. Mercancía sujeta a inspección de calidad y conteo físico."}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* HOJA IMPRIMIBLE F-ADM-01-2 (Formato Físico de Referencia) */}
            <div ref={printRef} className="f-adm-01-2-sheet f-adm-sheet-printable">
              
              {/* Header Imprimible */}
              <div className="f-adm-header-img3">
                <div className="f-adm-header-left">
                  <h1 className="f-adm-title">Orden de Compra</h1>
                  <div className="f-adm-no">
                    No. {odcSeleccionada.numero_odc ? odcSeleccionada.numero_odc.replace('ODC-2026-', '').replace('ODC-', '') : '000106'}
                  </div>
                </div>

                <div className="f-adm-header-right">
                  <img src="/logo.png" alt="TOTAL CLEAN" className="f-adm-logo-img3" onError={(e) => { e.target.style.display = 'none'; }} />
                  <div className="f-adm-company-name-img3">TOTAL CLEAN C.A.</div>
                  <div className="f-adm-company-details-img3" style={{ fontSize: '0.62rem', maxWidth: '380px', lineHeight: '1.2' }}>Dirección Fiscal: AV 61 ENTRE CALLE 147 Y TAPÓN PARCELA CI-19 SECTOR I, LOCAL GALPÓN NRO 147-113, ZONA INDUSTRIAL DE MARACAIBO SUR.</div>
                  <div className="f-adm-company-details-img3" style={{ fontWeight: '800' }}>Telf.: 0414-8101155 / 0414-643-1203</div>
                  <div className="f-adm-rif-img3">R.I.F.: J-30365868-7</div>
                </div>
              </div>

              <hr className="f-adm-divider" />

              {/* Requisición de Origen justo encima de Fecha */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontSize: '0.80rem' }}>
                <strong style={{ color: '#1e3a8a' }}>Requisición:</strong>
                <strong style={{ color: '#0f172a' }}>
                  {odcSeleccionada.requisicion_correlativo || 
                   odcSeleccionada.requisicion_obj?.correlativo_req || 
                   ((requisicionesList || []).find(r => String(r.id) === String(odcSeleccionada.requisicion_id || '').replace(/^REQ-?/i, '') || (r.correlativo_req && String(r.correlativo_req).trim().toUpperCase() === String(odcSeleccionada.requisicion_id || '').trim().toUpperCase()))?.correlativo_req) ||
                   odcSeleccionada.numero_req || 
                   (odcSeleccionada.requisicion_id ? (String(odcSeleccionada.requisicion_id).startsWith('REQ-') ? odcSeleccionada.requisicion_id : `REQ-${odcSeleccionada.requisicion_id}`) : 'N/A')}
                </strong>
              </div>

              {/* Barra de Metadatos */}
              <div className="f-adm-metadata-bar">
                <div className="f-adm-meta-item">
                  <span className="f-adm-meta-label">Fecha:</span>
                  <span className="f-adm-meta-val">
                    {odcSeleccionada.fecha_emision ? new Date(odcSeleccionada.fecha_emision).toLocaleDateString('es-VE') : (odcSeleccionada.created_at ? new Date(odcSeleccionada.created_at).toLocaleDateString('es-VE') : new Date().toLocaleDateString('es-VE'))}
                  </span>
                </div>
                <div className="f-adm-meta-item">
                  <span className="f-adm-meta-label">Cotización:</span>
                  <span className="f-adm-meta-val">{odcSeleccionada.cotizacion_ref || ''}</span>
                </div>
                <div className="f-adm-meta-item">
                  <span className="f-adm-meta-label">Aprobada por:</span>
                  <span className="f-adm-meta-val"></span>
                </div>
                <div className="f-adm-meta-item">
                  <span className="f-adm-meta-label">Fecha Cotiz.:</span>
                  <span className="f-adm-meta-val">
                    {odcSeleccionada.fecha_cotizacion ? new Date(odcSeleccionada.fecha_cotizacion).toLocaleDateString('es-VE') : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Sección DATOS DEL PROVEEDOR */}
              <div className="f-adm-section-header-datos-prov">
                DATOS DEL PROVEEDOR
              </div>
              <table className="f-adm-table-datos-prov">
                <tbody>
                  <tr>
                    <td style={{ width: '56%', padding: '6px 10px', lineHeight: '1.45' }}>
                      <div><strong>Nombre:</strong> {odcSeleccionada.proveedor_nombre || 'N/A'}</div>
                      <div><strong>Dirección:</strong> {odcSeleccionada.proveedor_direccion || 'N/A'}</div>
                      <div><strong>Teléfono:</strong> {odcSeleccionada.proveedor_telefono || 'N/A'}</div>
                      <div><strong>R.I.F.:</strong> {odcSeleccionada.proveedor_rif || 'N/A'}</div>
                      <div><strong>Ciudad:</strong> {odcSeleccionada.proveedor_ciudad || 'N/A'}</div>
                      <div><strong>Lugar de Entrega (Destino):</strong> {String(odcSeleccionada.destino_despacho || odcSeleccionada.despachar_a_direccion || odcSeleccionada.despachar_a || 'Galpones Riese - Av. Los Haticos').replace(/\s*-\s*null/gi, '').replace(/\bnull\b/gi, '').trim()}</div>
                      <div><strong>Centro de Costo:</strong> {odcSeleccionada.requisicion_obj?.centro_costo || odcSeleccionada.requisicion_obj?.obra || odcSeleccionada.centro_costo || 'No especificado'}</div>
                      <div><strong>Solicitado por:</strong> {odcSeleccionada.requisicion_obj?.solicitante || odcSeleccionada.solicitante || odcSeleccionada.solicitado_por || 'Total Clean C.A.'}</div>
                    </td>
                    <td style={{ width: '44%', padding: '6px 10px', lineHeight: '1.45' }}>
                      <div><strong>Contacto:</strong> {odcSeleccionada.proveedor_contacto || 'N/A'}</div>
                      <div><strong>País:</strong> {odcSeleccionada.proveedor_pais || 'Venezuela'}</div>
                      <div><strong>Fecha de Despacho:</strong> </div>
                      <div><strong>Forma de Pago:</strong> {odcSeleccionada.tipo_pago === 'CREDITO' ? `Crédito (${odcSeleccionada.dias_credito || 0} días)` : 'Contado'}</div>
                      <div><strong>Cuenta / Pago Prov:</strong> {odcSeleccionada.datos_bancarios || odcSeleccionada.cuenta_bancaria || 'Ver datos bancarios registrados'}</div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Tabla 2: Renglones de Productos */}
              <table className="f-adm-table">
                <thead>
                  <tr>
                    <th style={{ width: '10%', textAlign: 'center' }}>CANT.</th>
                    <th style={{ width: '10%', textAlign: 'center' }}>UNID.</th>
                    <th style={{ width: '46%' }}>DESCRIPCIÓN</th>
                    <th style={{ width: '17%', textAlign: 'right' }}>PRECIO UNITARIO</th>
                    <th style={{ width: '17%', textAlign: 'right' }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingItems ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Cargando renglones...</td>
                    </tr>
                  ) : (odcItems && odcItems.length > 0) ? odcItems.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{Number(it.cantidad || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'center' }}>{it.unidad || 'UNID'}</td>
                      <td>{it.descripcion || 'Sin descripción'}</td>
                      <td style={{ textAlign: 'right' }}>{Number(it.precio_unitario || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(it.total_fila || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>1.00</td>
                      <td style={{ textAlign: 'center' }}>UNID</td>
                      <td>Renglón general de compra</td>
                      <td style={{ textAlign: 'right' }}>{Number(odcSeleccionada.subtotal || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(odcSeleccionada.subtotal || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Totales alineados a la derecha */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                <div style={{ width: '260px', border: '1.5px solid #1e3a8a', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '4px', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontWeight: '700', color: '#1e3a8a' }}>Sub-Total:</span>
                    <strong>{Number(odcSeleccionada.subtotal || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontWeight: '700', color: '#1e3a8a' }}>IVA {odcSeleccionada.porcentaje_iva !== undefined ? odcSeleccionada.porcentaje_iva : 16}%:</span>
                    <span>{(Number(odcSeleccionada.iva_monto !== undefined && odcSeleccionada.iva_monto !== null ? odcSeleccionada.iva_monto : ((Number(odcSeleccionada.subtotal || 0)) * ((odcSeleccionada.porcentaje_iva || 16) / 100)))).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px solid #1e3a8a', paddingTop: '4px', fontSize: '0.90rem' }}>
                    <strong style={{ color: '#1e3a8a' }}>TOTAL:</strong>
                    <strong style={{ color: '#0f172a' }}>{Number(odcSeleccionada.total_general || ((Number(odcSeleccionada.subtotal || 0)) * 1.16)).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>
              </div>

              {/* Checklist de Documentos Exigidos */}
              <div className="f-adm-doc-notice">
                Favor comunicarnos de inmediato si existen problemas para el despacho exacto esta orden, Enviar los siguientes documentos:
              </div>
              <div className="f-adm-doc-checklist-box">
                <div className="f-adm-doc-col">
                  <div className="f-adm-doc-title">Nota de Entrega</div>
                  <div className="f-adm-doc-fields">No. _________ Copias: ____</div>
                </div>
                <div className="f-adm-doc-col">
                  <div className="f-adm-doc-title">Factura</div>
                  <div className="f-adm-doc-fields">No. _________ Copias: ____</div>
                </div>
                <div className="f-adm-doc-col">
                  <div className="f-adm-doc-title">Con. de Embarque:</div>
                  <div className="f-adm-doc-fields">No. _________ Copias: ____</div>
                </div>
                <div className="f-adm-doc-col">
                  <div className="f-adm-doc-title">Otros:</div>
                  <div className="f-adm-doc-fields">No. _________ Copias: ____</div>
                </div>
              </div>

              {/* Cuadro de Leyes, Términos & Condiciones Comerciales */}
              <div className="f-adm-terminos-box">
                <div className="f-adm-terminos-title">Leyes, Términos & Condiciones Comerciales:</div>
                <div className="f-adm-terminos-content">
                  {odcSeleccionada.terminos_condiciones || "Precios incluyen entrega en el sitio de destino especificado. Mercancía sujeta a inspección de calidad y conteo físico."}
                </div>
              </div>

              {/* Cuadro de Observaciones */}
              <div className="f-adm-observaciones-box">
                <div className="f-adm-observaciones-title">OBSERVACIONES</div>
                <div className="f-adm-observaciones-content">
                  {odcSeleccionada.observaciones ? odcSeleccionada.observaciones : (
                    <div style={{ color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '4px' }}>
                      (Espacio reservado para observaciones manuscritas o notas del comprador)
                    </div>
                  )}
                </div>
              </div>

              {/* Matriz de Firmas 3-Vías F-ADM-01-2 (Compacta) */}
              <div className="f-adm-signatures-container-compact">
                
                {/* 1. Comprador Gestor */}
                <div className="f-adm-sig-box-compact">
                  <div>
                    <div className="f-adm-sig-header-compact">Elaborado por (nombre y firma)</div>
                    <div className="f-adm-sig-sub-compact">Departamento de Compras</div>
                  </div>
                  <div className="f-adm-sig-name-compact">
                    {odcSeleccionada.comprador_nombre || currentUser?.nombre || 'José'}
                  </div>
                </div>

                {/* 2. Ricardo Herrera - Gerente de Compras */}
                <div className="f-adm-sig-box-compact">
                  <div>
                    <div className="f-adm-sig-header-compact">Revisado y avalado por (nombre y firma)</div>
                    <div className="f-adm-sig-sub-compact">Gerente de Compras</div>
                  </div>
                  {odcSeleccionada.ricardo_firma_digital_activa ? (
                    <div className="f-adm-digital-seal-img1" style={{ padding: '4px' }}>
                      <div style={{ color: '#047857', fontWeight: '800', fontSize: '0.62rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                        <ShieldCheck size={11} color="#047857" /> AVALADO DIGITALMENTE
                      </div>
                      <div style={{ color: '#0f766e', fontWeight: '700', fontSize: '0.60rem' }}>
                        Ricardo Herrera (Gerente de Compras)
                      </div>
                    </div>
                  ) : (
                    <div className="f-adm-sig-name-compact">
                      Ricardo Herrera (Gerente de Compras)
                    </div>
                  )}
                </div>

                {/* 3. Carlos Vega - Gerente General */}
                <div className="f-adm-sig-box-compact">
                  <div>
                    <div className="f-adm-sig-header-compact">Autorizado por (nombre y firma)</div>
                    <div className="f-adm-sig-sub-compact">Personal Autorizado</div>
                  </div>
                  {odcSeleccionada.carlos_firma_digital_activa ? (
                    <div className="f-adm-digital-seal-img1" style={{ padding: '4px' }}>
                      <div style={{ color: '#047857', fontWeight: '800', fontSize: '0.62rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                        <ShieldCheck size={11} color="#047857" /> FIRMADO DIGITALMENTE
                      </div>
                      <div style={{ color: '#0f766e', fontWeight: '700', fontSize: '0.60rem' }}>
                        Carlos Vega (Gerencia General)
                      </div>
                    </div>
                  ) : (
                    <div className="f-adm-sig-name-compact">
                      Carlos Vega (Gerencia General)
                    </div>
                  )}
                </div>

              </div>

              {/* Nota inferior a la derecha */}
              <div className="f-adm-verified-prov-note">
                Verificado datos de compra por proveedor
              </div>

              {/* Identificador de Copias al Pie */}
              <div className="f-adm-copy-footer-label">
                &mdash; ORIGINAL PARA EL CLIENTE &bull; COPIA PARA CUENTA POR PAGAR &bull; COPIA PARA CONTROL DE COMPRAS &mdash;
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Modal de Edición Completa de Órden de Compra */}
      {showEditModal && editOdcTarget && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', width: '100%', maxWidth: '980px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid #cbd5e1' }}>
            
            {/* Header Modal */}
            <div style={{ padding: '20px 28px', backgroundColor: '#0f172a', color: 'white', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ backgroundColor: '#0284c7', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit2 size={22} color="white" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'white' }}>
                    Editar Órden de Compra: <span style={{ color: '#38bdf8' }}>{editOdcTarget.numero_odc}</span>
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                    Corrija el proveedor, condiciones de pago, renglones de productos, precios o destino de despacho
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <XCircle size={22} />
              </button>
            </div>

            {loadingEditData ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
                Cargando expediente y renglones de la ODC...
              </div>
            ) : (
              <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Banner si la ODC fue rechazada */}
                {(editOdcTarget.motivo_rechazo_compras || editOdcTarget.estado_aprobacion_precio === 'rechazado' || editOdcTarget.estatus_orden === 'RECHAZADA') && (
                  <div style={{ backgroundColor: '#fef2f2', border: '1.5px solid #fca5a5', padding: '16px 20px', borderRadius: '16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <AlertTriangle size={22} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <div style={{ fontWeight: '900', color: '#991b1b', fontSize: '0.9rem' }}>
                        Modificación de Órden de Compra Rechazada
                      </div>
                      {editOdcTarget.motivo_rechazo_compras && (
                        <div style={{ fontSize: '0.82rem', color: '#7f1d1d', marginTop: '4px' }}>
                          <strong>Motivo de rechazo indicado por Compras:</strong> "{editOdcTarget.motivo_rechazo_compras}"
                        </div>
                      )}
                      <div style={{ fontSize: '0.78rem', color: '#b91c1c', marginTop: '4px', fontStyle: 'italic' }}>
                        💡 Modifique los precios, renglones o datos de proveedor según las observaciones. Al guardar, el estatus volverá a <strong>PENDIENTE</strong> para que Compras / Gerencia la evalúe y apruebe para Cuentas por Pagar.
                      </div>
                    </div>
                  </div>
                )}

                {/* Sección 1: Encabezado y Datos del Proveedor */}
                <div style={{ backgroundColor: '#ffffff', padding: '18px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                  <h4 style={{ margin: '0 0 14px 0', fontSize: '0.88rem', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building2 size={16} color="#0284c7" /> Datos del Proveedor & Encabezado ODC
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                    
                    {/* Requisición de Origen */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                        📌 Requisición de Origen (Vínculo)
                      </label>
                      <div style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', backgroundColor: '#f8fafc', fontWeight: '700', color: '#1e293b' }}>
                        {sourceReqSelected ? `${sourceReqSelected.correlativo_req} - ${sourceReqSelected.solicitante || 'Sin solicitante'}` : (editOdcTarget?.requisicion_correlativo || (editOdcTarget?.requisicion_id ? `REQ-${editOdcTarget.requisicion_id}` : 'Sin Requisición Vinculada'))}
                      </div>
                    </div>

                    {/* Subcuadro Dedicado: Centro de Costo */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                        🏢 Centro de Costo (Requisición)
                      </label>
                      <div style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', backgroundColor: '#f8fafc', fontWeight: '700', color: '#1e293b' }}>
                        {editOdcTarget.requisicion_obj?.centro_costo || editOdcTarget.centro_costo || sourceReqSelected?.centro_costo || 'No especificado'}
                      </div>
                    </div>

                    {/* Categoría de Proveedor (Bloqueado / No Modificable) */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>
                        🔍 Categoría de Proveedor
                      </label>
                      <input
                        type="text"
                        readOnly
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '700', cursor: 'not-allowed' }}
                        value={filtroCategoriaProveedor !== 'TODAS' ? filtroCategoriaProveedor : (proveedoresList.find(p => String(p.id) === String(editOdcTarget.proveedor_id))?.categoria || 'General / Preestablecida')}
                      />
                    </div>

                    {/* Proveedor Seleccionado (Bloqueado / No Modificable) */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>
                        Proveedor Seleccionado
                      </label>
                      <input
                        type="text"
                        readOnly
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: '700', cursor: 'not-allowed' }}
                        value={editOdcTarget.proveedor_nombre || (proveedoresList.find(p => String(p.id) === String(editOdcTarget.proveedor_id))?.razon_social || 'Proveedor asignado')}
                      />
                    </div>

                    {/* Cuenta Bancaria de Destino del Proveedor */}
                    {(() => {
                      const provSeleccionado = proveedoresList.find(p => String(p.id) === String(editOdcTarget.proveedor_id));
                      let ctasProv = [];
                      if (provSeleccionado?.cuentas_bancarias) {
                        if (Array.isArray(provSeleccionado.cuentas_bancarias)) ctasProv = provSeleccionado.cuentas_bancarias;
                        else if (typeof provSeleccionado.cuentas_bancarias === 'string') {
                          try { ctasProv = JSON.parse(provSeleccionado.cuentas_bancarias); } catch { ctasProv = []; }
                        }
                      }

                      return (
                        <div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                            <Landmark size={13} color="#0284c7" /> Cuenta Bancaria de Destino para Pago
                          </label>
                          <select
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', backgroundColor: '#ffffff', color: '#0f172a', fontWeight: '600' }}
                            value={editOdcTarget.datos_bancarios || editOdcTarget.cuenta_bancaria || ''}
                            onChange={(e) => setEditOdcTarget(prev => ({ ...prev, datos_bancarios: e.target.value, cuenta_bancaria: e.target.value }))}
                          >
                            <option value="">-- Seleccionar Cuenta Bancaria de Pago --</option>
                            {Boolean(editOdcTarget.datos_bancarios || editOdcTarget.cuenta_bancaria) && !ctasProv.some(c => {
                              const label = `${c.banco || 'Banco'} (${c.moneda || 'USD'}) - N° Cuenta: ${c.nro_cuenta || 'N/A'} - Titular: ${c.titular || 'N/A'} (${c.rif || 'N/A'}) ${c.tipo_cuenta ? `[${c.tipo_cuenta}]` : ''}`;
                              return label === (editOdcTarget.datos_bancarios || editOdcTarget.cuenta_bancaria);
                            }) && (
                              <option value={editOdcTarget.datos_bancarios || editOdcTarget.cuenta_bancaria}>
                                {editOdcTarget.datos_bancarios || editOdcTarget.cuenta_bancaria} (Guardada)
                              </option>
                            )}
                            {ctasProv.map((c, idx) => {
                              const label = `${c.banco || 'Banco'} (${c.moneda || 'USD'}) - N° Cuenta: ${c.nro_cuenta || 'N/A'} - Titular: ${c.titular || 'N/A'} (${c.rif || 'N/A'}) ${c.tipo_cuenta ? `[${c.tipo_cuenta}]` : ''}`;
                              return <option key={idx} value={label}>{label}</option>;
                            })}
                            {ctasProv.length === 0 && !editOdcTarget.datos_bancarios && !editOdcTarget.cuenta_bancaria && (
                              <option value="" disabled>Sin cuentas de banco guardadas</option>
                            )}
                          </select>
                        </div>
                      );
                    })()}

                    {/* Razón Social (Bloqueado / No Modificable) */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>
                        Razón Social / Nombre Proveedor
                      </label>
                      <input
                        type="text"
                        readOnly
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', backgroundColor: '#f1f5f9', color: '#334155', fontWeight: '600', cursor: 'not-allowed' }}
                        value={editOdcTarget.proveedor_nombre || ''}
                        placeholder="Nombre o Razón Social"
                      />
                    </div>

                    {/* RIF Proveedor (Bloqueado / No Modificable) */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>
                        RIF Proveedor
                      </label>
                      <input
                        type="text"
                        readOnly
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', backgroundColor: '#f1f5f9', color: '#334155', fontWeight: '600', cursor: 'not-allowed' }}
                        value={editOdcTarget.proveedor_rif || ''}
                        placeholder="J-12345678-0"
                      />
                    </div>

                    {/* Persona de Contacto (Bloqueado / No Modificable) */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>
                        Persona de Contacto
                      </label>
                      <input
                        type="text"
                        readOnly
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', backgroundColor: '#f1f5f9', color: '#334155', fontWeight: '600', cursor: 'not-allowed' }}
                        value={editOdcTarget.proveedor_contacto || ''}
                        placeholder="Persona de Contacto"
                      />
                    </div>

                    {/* Ref. Cotización Proveedor */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                        Ref. Cotización Proveedor
                      </label>
                      <input
                        type="text"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                        value={editOdcTarget.cotizacion_ref || ''}
                        onChange={(e) => setEditOdcTarget(prev => ({ ...prev, cotizacion_ref: e.target.value }))}
                        placeholder="COT-2026-001"
                      />
                    </div>

                    {/* Fecha de Despacho Estimada (Modificable) */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                        📅 Fecha de Despacho Estimada
                      </label>
                      <input
                        type="date"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', backgroundColor: 'white', fontWeight: '600', color: '#0f172a' }}
                        value={editOdcTarget.fecha_despacho || ''}
                        onChange={(e) => setEditOdcTarget(prev => ({ ...prev, fecha_despacho: e.target.value }))}
                      />
                    </div>

                    {/* Despachar a (Sincronizado con Compras y Base de Datos) */}
                    <div style={{ gridColumn: 'span 2' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569' }}>DESPACHAR A *</label>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          {editOdcTarget.despachar_a_id && (
                            <button
                              type="button"
                              onClick={() => eliminarDestino(editOdcTarget.despachar_a_id)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                              title="Eliminar este destino de entrega"
                            >
                              <Trash2 size={13} /> Eliminar Destino
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowNuevoDestinoModal(true)}
                            style={{ background: 'none', border: 'none', color: '#0ea5e9', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer' }}
                          >
                            + Nuevo Destino
                          </button>
                        </div>
                      </div>
                      <select
                        className="input-tc"
                        style={{ width: '100%', padding: '10px', fontWeight: '700', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a' }}
                        value={editOdcTarget.despachar_a_id || ''}
                        onChange={(e) => {
                          const destId = e.target.value;
                          const dest = destinosDespacho.find(d => String(d.id) === String(destId));
                          setEditOdcTarget(prev => ({
                            ...prev,
                            despachar_a_id: destId,
                            destino_despacho: dest ? dest.nombre : '',
                            despachar_a_direccion: dest ? (dest.direccion && dest.direccion !== 'null' ? `${dest.nombre} - ${dest.direccion}` : dest.nombre) : ''
                          }));
                        }}
                      >
                        <option value="">Seleccione Destino de Entrega...</option>
                        {destinosDespacho.map(d => (
                          <option key={d.id} value={d.id}>{d.nombre}{d.direccion && d.direccion !== 'null' ? ` (${d.direccion})` : ''}</option>
                        ))}
                        {Boolean(editOdcTarget.despachar_a_id) && !destinosDespacho.some(d => String(d.id) === String(editOdcTarget.despachar_a_id)) && (
                          <option value={editOdcTarget.despachar_a_id}>{editOdcTarget.destino_despacho || 'Destino Actual'}</option>
                        )}
                      </select>
                    </div>

                  </div>
                </div>

                {/* Sección 2: Términos Comerciales, Pago e Impuestos */}
                <div style={{ backgroundColor: '#f8fafc', padding: '18px 20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 14px 0', fontSize: '0.88rem', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CreditCard size={16} color="#0ea5e9" /> Condiciones Comerciales & Moneda
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', alignItems: 'end' }}>
                    
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                        Tipo de Pago
                      </label>
                      <select
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', backgroundColor: 'white' }}
                        value={editOdcTarget.tipo_pago || 'CONTADO'}
                        onChange={(e) => setEditOdcTarget(prev => ({ ...prev, tipo_pago: e.target.value }))}
                      >
                        <option value="CONTADO">CONTADO / DEPOSITO</option>
                        <option value="CREDITO">CREDITO (DÍAS DE CRÉDITO)</option>
                      </select>
                    </div>

                    {editOdcTarget.tipo_pago === 'CREDITO' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                          Días de Crédito
                        </label>
                        <input
                          type="number"
                          min="1"
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                          value={editOdcTarget.dias_credito || ''}
                          onChange={(e) => setEditOdcTarget(prev => ({ ...prev, dias_credito: e.target.value }))}
                          placeholder="Ej: 15, 30"
                        />
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '6px' }}>
                        MONEDA
                      </label>
                      <select
                        className="input-tc"
                        style={{ width: '100%', padding: '8px 12px', fontWeight: '800', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}
                        value={['USD', 'BS'].includes(editOdcTarget.moneda) ? editOdcTarget.moneda : 'OTRA'}
                        onChange={(e) => {
                          const mon = e.target.value;
                          setEditOdcTarget(prev => ({
                            ...prev,
                            moneda: mon === 'OTRA' ? (prev.moneda_custom || 'OTRA') : mon,
                            tasa_cambio: mon === 'USD' ? 1 : prev.tasa_cambio
                          }));
                        }}
                      >
                        <option value="USD">USD ($)</option>
                        <option value="BS">VES (Bs)</option>
                        <option value="OTRA">+ Nuevo / Otra moneda...</option>
                      </select>
                    </div>

                    {(!['USD', 'BS'].includes(editOdcTarget.moneda) || editOdcTarget.moneda === 'OTRA') && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#0284c7', marginBottom: '6px' }}>
                          NOMBRE DE MONEDA *
                        </label>
                        <input
                          type="text"
                          className="input-tc"
                          placeholder="Ej: EUR, COP, BRL..."
                          style={{ width: '100%', padding: '8px 12px', fontWeight: '800', borderRadius: '8px', border: '1px solid #0284c7', backgroundColor: '#f0f9ff' }}
                          value={editOdcTarget.moneda_custom || (['USD', 'BS'].includes(editOdcTarget.moneda) ? '' : editOdcTarget.moneda)}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setEditOdcTarget(prev => ({ ...prev, moneda_custom: val, moneda: val || 'OTRA' }));
                          }}
                        />
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: '700', color: '#0f172a', cursor: 'pointer', height: '36px' }}>
                        <input
                          type="checkbox"
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                          checked={editOdcTarget.aplica_iva === true}
                          onChange={(e) => setEditOdcTarget(prev => ({ ...prev, aplica_iva: e.target.checked }))}
                        />
                        Aplica IVA (16%)
                      </label>
                    </div>

                  </div>
                </div>

                {/* Configuración de Paso por Almacén en Edición */}
                <div style={{
                  backgroundColor: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  padding: '16px',
                  borderRadius: '16px'
                }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: '800', color: '#1e293b', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <span>🚚 Logística & Recepción Física</span>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: '900',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      backgroundColor: editOdcTarget.pasa_por_almacen !== false ? '#dcfce7' : '#fef3c7',
                      color: editOdcTarget.pasa_por_almacen !== false ? '#15803d' : '#92400e',
                      border: `1px solid ${editOdcTarget.pasa_por_almacen !== false ? '#bbf7d0' : '#fde68a'}`
                    }}>
                      {editOdcTarget.pasa_por_almacen !== false ? '📦 PASA POR ALMACÉN' : '⚡ ENTREGA DIRECTA (NO PASA POR ALMACÉN)'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                    {/* Opción 1: Pasa por Almacén */}
                    <button
                      type="button"
                      onClick={() => setEditOdcTarget(prev => ({ ...prev, pasa_por_almacen: true }))}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: editOdcTarget.pasa_por_almacen !== false ? '2px solid #16a34a' : '1.5px solid #cbd5e1',
                        backgroundColor: editOdcTarget.pasa_por_almacen !== false ? '#f0fdf4' : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                        boxShadow: editOdcTarget.pasa_por_almacen !== false ? '0 2px 8px rgba(22, 163, 74, 0.15)' : 'none'
                      }}
                    >
                      <input
                        type="radio"
                        name="edit_pasa_almacen_radio"
                        checked={editOdcTarget.pasa_por_almacen !== false}
                        onChange={() => setEditOdcTarget(prev => ({ ...prev, pasa_por_almacen: true }))}
                        style={{ marginTop: '3px', cursor: 'pointer', accentColor: '#16a34a' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: '800', color: editOdcTarget.pasa_por_almacen !== false ? '#166534' : '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          📦 Pasa por Almacén
                        </div>
                        <div style={{ fontSize: '0.72rem', color: editOdcTarget.pasa_por_almacen !== false ? '#15803d' : '#64748b', marginTop: '3px', lineHeight: '1.3' }}>
                          La mercancía ingresa físicamente a Almacén, requiere inspección, clasificación y entrega formal del almacenista.
                        </div>
                      </div>
                    </button>

                    {/* Opción 2: No pasa por Almacén */}
                    <button
                      type="button"
                      onClick={() => setEditOdcTarget(prev => ({ ...prev, pasa_por_almacen: false }))}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: editOdcTarget.pasa_por_almacen === false ? '2px solid #d97706' : '1.5px solid #cbd5e1',
                        backgroundColor: editOdcTarget.pasa_por_almacen === false ? '#fffbeb' : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                        boxShadow: editOdcTarget.pasa_por_almacen === false ? '0 2px 8px rgba(217, 119, 6, 0.15)' : 'none'
                      }}
                    >
                      <input
                        type="radio"
                        name="edit_pasa_almacen_radio"
                        checked={editOdcTarget.pasa_por_almacen === false}
                        onChange={() => setEditOdcTarget(prev => ({ ...prev, pasa_por_almacen: false }))}
                        style={{ marginTop: '3px', cursor: 'pointer', accentColor: '#d97706' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: '800', color: editOdcTarget.pasa_por_almacen === false ? '#92400e' : '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          🚚 No pasa por Almacén (Entrega Directa)
                        </div>
                        <div style={{ fontSize: '0.72rem', color: editOdcTarget.pasa_por_almacen === false ? '#b45309' : '#64748b', marginTop: '3px', lineHeight: '1.3' }}>
                          Entrega directa en sitio, obra o servicio. No requiere recepción ni registro pendiente en Almacén.
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Sección 3: Tabla de Renglones / Ítems de la ODC */}
                {(() => {
                  const symMoneda = editOdcTarget.moneda === 'BS' ? 'Bs' : (editOdcTarget.moneda === 'EUR' ? '€' : (editOdcTarget.moneda === 'USD' ? '$' : (editOdcTarget.moneda || '$')));
                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileText size={16} color="#0ea5e9" /> Renglones de Productos / Servicios ({editItems.length})
                        </h4>
                      </div>

                      <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '12px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#0f172a', color: 'white', textAlign: 'left' }}>
                              <th style={{ padding: '10px', width: '4%', textAlign: 'center' }}>#</th>
                              <th style={{ padding: '10px', width: '46%' }}>DESCRIPCIÓN / ESPECIFICACIÓN TÉCNICA</th>
                              <th style={{ padding: '10px', width: '12%', textAlign: 'center' }}>UNIDAD</th>
                              <th style={{ padding: '10px', width: '12%', textAlign: 'center' }}>CANTIDAD</th>
                              <th style={{ padding: '10px', width: '13%', textAlign: 'right' }}>P. UNIT ({symMoneda})</th>
                              <th style={{ padding: '10px', width: '13%', textAlign: 'right' }}>TOTAL ({symMoneda})</th>
                            </tr>
                          </thead>
                          <tbody>
                            {editItems.map((it, idx) => (
                              <tr key={it.id || idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                                <td style={{ padding: '10px', textAlign: 'center', fontWeight: '700', color: '#64748b' }}>
                                  {idx + 1}
                                </td>
                                {/* Descripción Bloqueada */}
                                <td style={{ padding: '8px 10px' }}>
                                  <div
                                    style={{
                                      width: '100%',
                                      padding: '7px 12px',
                                      borderRadius: '8px',
                                      border: '1px solid #e2e8f0',
                                      fontSize: '0.82rem',
                                      fontWeight: '700',
                                      color: '#0f172a',
                                      backgroundColor: '#ffffff',
                                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
                                    }}
                                  >
                                    {it.descripcion || 'Sin descripción'}
                                  </div>
                                </td>
                                {/* Unidad Bloqueada */}
                                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                  <div
                                    style={{
                                      display: 'inline-block',
                                      minWidth: '55px',
                                      padding: '6px 10px',
                                      borderRadius: '8px',
                                      border: '1.5px solid #334155',
                                      fontSize: '0.8rem',
                                      fontWeight: '800',
                                      textAlign: 'center',
                                      color: '#0f172a',
                                      backgroundColor: '#ffffff'
                                    }}
                                  >
                                    {it.unidad || 'UNID'}
                                  </div>
                                </td>
                                {/* Cantidad Bloqueada */}
                                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                  <div
                                    style={{
                                      display: 'inline-block',
                                      minWidth: '60px',
                                      padding: '6px 12px',
                                      borderRadius: '8px',
                                      border: '1px solid #cbd5e1',
                                      fontSize: '0.85rem',
                                      fontWeight: '800',
                                      textAlign: 'center',
                                      color: '#0f172a',
                                      backgroundColor: '#ffffff'
                                    }}
                                  >
                                    {Number(it.cantidad !== undefined ? it.cantidad : 1).toLocaleString('de-DE')}
                                  </div>
                                </td>
                                {/* Precio Unitario Editable */}
                                <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                    <span style={{ fontWeight: '800', color: '#0284c7', fontSize: '0.85rem' }}>{symMoneda}</span>
                                    <input
                                      type="number"
                                      step="any"
                                      min="0"
                                      value={it.precio_unitario !== undefined ? it.precio_unitario : 0}
                                      onChange={(e) => actualizarItemEdicion(idx, 'precio_unitario', e.target.value)}
                                      placeholder="0.00"
                                      style={{
                                        width: '100px',
                                        padding: '6px 8px',
                                        borderRadius: '8px',
                                        border: '1.5px solid #0284c7',
                                        fontSize: '0.85rem',
                                        fontWeight: '900',
                                        textAlign: 'right',
                                        color: '#0369a1',
                                        backgroundColor: '#f0f9ff'
                                      }}
                                    />
                                  </div>
                                </td>
                                {/* Total Fila Recalculado */}
                                <td style={{ padding: '10px', textAlign: 'right', fontWeight: '900', color: '#0f172a' }}>
                                  {symMoneda} {Number((parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0)).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Cuadro de Totales Recalculados */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                        <div style={{ width: '280px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '12px 16px', borderRadius: '12px', fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#475569' }}>
                            <span>Subtotal Renglones:</span>
                            <strong>{symMoneda} {subtotalEdit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#475569' }}>
                            <span>IVA ({porcentajeIvaEdit}%):</span>
                            <span>{symMoneda} {montoIvaEdit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', paddingTop: '6px', fontSize: '0.95rem', fontWeight: '900', color: '#0f172a' }}>
                            <span>TOTAL GENERAL:</span>
                            <span style={{ color: '#0284c7' }}>{symMoneda} {totalGeneralEdit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Sección 4: Observaciones, Leyes & Términos */}
                <div style={{ backgroundColor: '#f8fafc', padding: '18px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>
                      📝 Observaciones de la Órden de Compra
                    </label>
                    <textarea
                      rows={2}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.8rem', resize: 'vertical' }}
                      value={editOdcTarget.observaciones || ''}
                      onChange={(e) => setEditOdcTarget(prev => ({ ...prev, observaciones: e.target.value }))}
                      placeholder="Observaciones especiales, notas de entrega, instrucciones..."
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>
                      ⚖️ Leyes & Términos Comerciales Impresos en la ODC
                    </label>
                    <textarea
                      rows={2}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.8rem', resize: 'vertical' }}
                      value={editOdcTarget.terminos_condiciones || ''}
                      onChange={(e) => setEditOdcTarget(prev => ({ ...prev, terminos_condiciones: e.target.value }))}
                      placeholder="Términos y condiciones comerciales impresos..."
                    />
                  </div>
                </div>

                {/* Botones de Acción Modal Edición */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    style={{ padding: '10px 20px', fontSize: '0.85rem', fontWeight: '700', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: 'white', cursor: 'pointer', color: '#64748b' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={guardandoEditOdc}
                    onClick={guardarEdicionOdc}
                    style={{ padding: '10px 24px', fontSize: '0.85rem', fontWeight: '800', borderRadius: '10px', border: 'none', backgroundColor: '#0284c7', color: 'white', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.3)' }}
                  >
                    {guardandoEditOdc ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" /> Guardando Cambios...
                      </>
                    ) : (
                      <>
                        <Save size={16} /> 💾 Guardar Cambios ODC
                      </>
                    )}
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

      {/* Modal Selector para Importar Ítems de Requisición */}
      {showReqItemsPicker && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 11000, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '20px', width: '100%', maxWidth: '820px', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', padding: '24px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Importar Renglones de Requisición</span>
                <h3 style={{ margin: '2px 0 0 0', fontSize: '1.2rem', fontWeight: '900', color: '#0f172a' }}>
                  {sourceReqSelected ? `${sourceReqSelected.correlativo_req} — ${sourceReqSelected.solicitante || 'Solicitante'}` : 'Seleccione Requisición de Origen'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReqItemsPicker(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <XCircle size={18} color="#64748b" />
              </button>
            </div>

            {/* Requisición de Origen fija (no modificable) */}
            <div style={{ marginBottom: '18px', backgroundColor: '#f0f9ff', padding: '14px 16px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#0369a1', marginBottom: '4px' }}>
                📌 Requisición de Origen (Vínculo):
              </label>
              <div style={{ fontSize: '0.95rem', fontWeight: '900', color: '#0284c7' }}>
                {sourceReqSelected ? `${sourceReqSelected.correlativo_req} — ${sourceReqSelected.solicitante || 'Solicitante'} (${sourceReqSelected.gerencia || 'General'}) [${parsearJsonSeguro(sourceReqSelected.items).length} ítems]` : (editOdcTarget?.requisicion_correlativo || 'Sin Requisición Vinculada')}
              </div>
            </div>

            {!sourceReqSelected ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', marginBottom: '20px' }}>
                <FileText size={32} style={{ margin: '0 auto 10px auto', color: '#94a3b8' }} />
                <p style={{ margin: 0, fontWeight: '700', fontSize: '0.9rem' }}>
                  Seleccione una Requisición en el menú superior para desplegar sus productos y agregarlos a la ODC.
                </p>
              </div>
            ) : (!sourceReqSelected.items || sourceReqSelected.items.length === 0) ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', backgroundColor: '#f8fafc', borderRadius: '12px', marginBottom: '20px' }}>
                La Requisición {sourceReqSelected.correlativo_req} no contiene renglones de productos registrados.
              </div>
            ) : (
              <>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '14px' }}>
                  Haga clic en <strong>+ Agregar a ODC</strong> en los renglones requeridos para sumarlos a esta Órden de Compra con trazabilidad de origen:
                </p>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: '20px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0f172a', color: 'white', textAlign: 'left' }}>
                      <th style={{ padding: '10px', width: '5%', textAlign: 'center' }}>#</th>
                      <th style={{ padding: '10px', width: '35%' }}>Descripción del Ítem</th>
                      <th style={{ padding: '10px', width: '10%', textAlign: 'center' }}>Unidad</th>
                      <th style={{ padding: '10px', width: '12%', textAlign: 'right' }}>Cant. Aprobada</th>
                      <th style={{ padding: '10px', width: '12%', textAlign: 'right' }}>P. Ref ($)</th>
                      <th style={{ padding: '10px', width: '26%', textAlign: 'center' }}>Cant. en ODC / Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sourceReqSelected.items || []).map((reqIt, idx) => {
                      const desc = reqIt.descripcion || reqIt.nombre || reqIt.item || 'Sin descripción';
                      const cantAprobada = parseFloat(reqIt.cant_aprobada || reqIt.cantidad || reqIt.cant || 1);
                      const uni = reqIt.unidad || reqIt.uni || 'UNID';
                      const pu = reqIt.pu_usd || reqIt.pu_bs || reqIt.precio || 0;
                      const reqItemIdStr = String(reqIt.id || desc.toLowerCase().trim());
                      
                      const itemEnOdc = editItems.find(it => 
                        (it.requisicion_item_id && String(it.requisicion_item_id) === reqItemIdStr) ||
                        (it.descripcion || '').toLowerCase().trim() === desc.toLowerCase().trim()
                      );
                      const cantEnOdc = itemEnOdc ? (parseFloat(itemEnOdc.cantidad) || 0) : 0;

                      return (
                        <tr key={reqIt.id || idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: cantEnOdc > 0 ? '#f0f9ff' : (idx % 2 === 0 ? 'white' : '#f8fafc') }}>
                          <td style={{ padding: '10px', textAlign: 'center', fontWeight: '700', color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ padding: '10px', fontWeight: '600', color: '#0f172a' }}>{desc}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>{uni}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', color: '#0ea5e9' }}>{cantAprobada}</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>$ {Number(pu).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            {cantEnOdc > 0 ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => modificarCantidadDesdeRequisicion(reqIt, -1)}
                                  style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #bae6fd', backgroundColor: '#e0f2fe', color: '#0369a1', fontWeight: '900', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  title="Disminuir cantidad en ODC (-1)"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={cantEnOdc}
                                  onChange={(e) => establecerCantidadDesdeRequisicion(reqIt, e.target.value)}
                                  style={{ width: '56px', textAlign: 'center', fontWeight: '800', fontSize: '0.85rem', border: '1px solid #0284c7', borderRadius: '6px', padding: '4px', backgroundColor: 'white', color: '#0369a1' }}
                                  title="Modificar cantidad directa del renglón en ODC"
                                />
                                <button
                                  type="button"
                                  onClick={() => modificarCantidadDesdeRequisicion(reqIt, 1)}
                                  style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: '#0284c7', color: 'white', fontWeight: '900', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  title="Aumentar cantidad en ODC (+1)"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => agregarItemDesdeRequisicion(reqIt)}
                                style={{ padding: '6px 14px', fontSize: '0.75rem', fontWeight: '800', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)' }}
                                title={`Agregar ${cantAprobada} ${uni} a la Órden de Compra`}
                              >
                                + Agregar a ODC ({cantAprobada} {uni})
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>
                Renglones activos en ODC: {editItems.length}
              </span>
              <button
                type="button"
                onClick={() => setShowReqItemsPicker(false)}
                style={{ padding: '8px 18px', fontSize: '0.8rem', fontWeight: '700', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                Listo / Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal de Revisión y Asignación de Prioridad de ODC */}
      {modalPrioridadOpen && odcPrioridadTarget && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 12000, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', width: '100%', maxWidth: '960px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 60px -12px rgba(0,0,0,0.5)', padding: '28px' }}>
            
            {/* Cabecera del Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Aprobación de Precio & Prioridad de Pago
                </span>
                <h2 style={{ margin: '3px 0 0 0', fontSize: '1.4rem', fontWeight: '900', color: '#0f172a' }}>
                  {odcPrioridadTarget.numero_odc}
                </h2>
                
                {/* Badges de Estado */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {odcPrioridadTarget.requisicion_es_emergencia ? (
                    <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '900', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}>
                      🚨 REQUISICIÓN DE EMERGENCIA
                    </span>
                  ) : (
                    <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '800', backgroundColor: '#f1f5f9', color: '#475569' }}>
                      📋 REQUISICIÓN NORMAL
                    </span>
                  )}

                  {odcPrioridadTarget.proveedor_es_preferencial ? (
                    <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '900', backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                      ⭐ PROVEEDOR PREFERENCIAL ({odcPrioridadTarget.proveedor_nivel_preferencial || 'TIER 1'})
                    </span>
                  ) : (
                    <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '800', backgroundColor: '#f1f5f9', color: '#475569' }}>
                      🏢 PROVEEDOR REGULAR
                    </span>
                  )}

                  <span style={{ 
                    padding: '3px 10px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '800',
                    backgroundColor: odcPrioridadTarget.tipo_pago === 'CREDITO' ? '#eff6ff' : '#f0fdf4',
                    color: odcPrioridadTarget.tipo_pago === 'CREDITO' ? '#1d4ed8' : '#15803d',
                    border: odcPrioridadTarget.tipo_pago === 'CREDITO' ? '1px solid #bfdbfe' : '1px solid #bbf7d0'
                  }}>
                    {odcPrioridadTarget.tipo_pago === 'CREDITO' ? `💳 CRÉDITO (${odcPrioridadTarget.dias_credito || 0} DÍAS)` : '💵 CONTADO'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalPrioridadOpen(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <XCircle size={20} color="#64748b" />
              </button>
            </div>

            {/* Metadatos Resumen Proveedor y Requisición */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '20px' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Datos del Proveedor
                </div>
                <div style={{ fontWeight: '900', color: '#0f172a', fontSize: '0.92rem' }}>
                  {odcPrioridadTarget.proveedor_nombre || 'N/A'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px' }}>
                  <strong>RIF:</strong> {odcPrioridadTarget.proveedor_rif || 'N/A'} | <strong>Contacto:</strong> {odcPrioridadTarget.proveedor_contacto || 'N/A'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#334155', marginTop: '4px' }}>
                  <strong style={{ color: '#0f172a' }}>Cuenta Bancaria / Pago:</strong>{' '}
                  {(() => {
                    const cta = odcPrioridadTarget.datos_bancarios || odcPrioridadTarget.cuenta_bancaria;
                    if (cta) return <span style={{ color: '#0284c7', fontWeight: '700' }}>{cta}</span>;

                    const provMatch = (proveedoresList || []).find(p => String(p.id) === String(odcPrioridadTarget.proveedor_id));
                    let ctas = [];
                    if (provMatch?.cuentas_bancarias) {
                      if (Array.isArray(provMatch.cuentas_bancarias)) ctas = provMatch.cuentas_bancarias;
                      else if (typeof provMatch.cuentas_bancarias === 'string') {
                        try { ctas = JSON.parse(provMatch.cuentas_bancarias); } catch { ctas = []; }
                      }
                    }
                    if (ctas.length > 0) {
                      const c0 = ctas[0];
                      const lbl = `${c0.banco || 'Banco'} (${c0.moneda || 'USD'}) - N° Cuenta: ${c0.nro_cuenta || 'N/A'} - Titular: ${c0.titular || 'N/A'} (${c0.rif || 'N/A'}) ${c0.tipo_cuenta ? `[${c0.tipo_cuenta}]` : ''}`.trim();
                      return <span style={{ color: '#0284c7', fontWeight: '700' }}>{lbl}</span>;
                    }
                    return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No especificada</span>;
                  })()}
                </div>
              </div>

              <div style={{ backgroundColor: '#f0fdf4', padding: '14px 16px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#166534', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Requisición de Origen & Destino
                </div>
                <div style={{ fontWeight: '900', color: '#14532d', fontSize: '0.92rem' }}>
                  {odcPrioridadTarget.requisicion_correlativo || (odcPrioridadTarget.requisicion_id ? `REQ-${odcPrioridadTarget.requisicion_id}` : 'Sin correlativo')}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#166534', marginTop: '2px' }}>
                  <strong>Solicitante:</strong> {odcPrioridadTarget.solicitante || odcPrioridadTarget.requisicion_obj?.solicitante || 'Total Clean C.A.'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: '3px' }}>
                  <strong>Centro de Costo:</strong> {odcPrioridadTarget.requisicion_obj?.centro_costo || odcPrioridadTarget.requisicion_obj?.obra || odcPrioridadTarget.centro_costo || 'No especificado'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: '2px' }}>
                  <strong>Lugar de Entrega (Destino):</strong> {String(odcPrioridadTarget.destino_despacho || odcPrioridadTarget.despachar_a_direccion || odcPrioridadTarget.despachar_a || 'Galpones Riese - Av. Los Haticos').replace(/\s*-\s*null/gi, '').replace(/\bnull\b/gi, '').trim()}
                </div>
              </div>
            </div>

            {/* Comparativa de Precios y Renglones (Opción 5) */}
            <div style={{ marginBottom: '22px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DollarSign size={16} color="#7c3aed" /> Comparativa de Precios Cotizados vs Estimados de Requisición
              </h4>

              {loadingItemsPrioridad ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                  <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
                  Cargando renglones y análisis de precios...
                </div>
              ) : itemsOdcPrioridad.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                  No se encontraron renglones para esta Órden de Compra.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#0f172a', color: 'white', textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px', width: '4%', textAlign: 'center' }}>#</th>
                        <th style={{ padding: '10px 12px', width: '36%' }}>Descripción del Ítem</th>
                        <th style={{ padding: '10px 12px', width: '10%', textAlign: 'center' }}>Cant. & Unidad</th>
                        <th style={{ padding: '10px 12px', width: '14%', textAlign: 'right' }}>PU Cotizado ODC ($)</th>
                        <th style={{ padding: '10px 12px', width: '14%', textAlign: 'right' }}>Total Fila ($)</th>
                        <th style={{ padding: '10px 12px', width: '12%', textAlign: 'right' }}>PU Estimado Req</th>
                        <th style={{ padding: '10px 12px', width: '10%', textAlign: 'center' }}>Variación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsOdcPrioridad.map((it, idx) => {
                        const puCot = parseFloat(it.precio_unitario) || 0;
                        const puEst = parseFloat(it.precio_estimado_req) || 0;
                        const diff = it.diferencia_pu || 0;
                        const pct = it.diferencia_pct || 0;
                        return (
                          <tr key={it.id || idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#64748b' }}>{idx + 1}</td>
                            <td style={{ padding: '10px 12px', fontWeight: '600', color: '#0f172a' }}>{it.descripcion}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#475569' }}>
                              {it.cantidad} {it.unidad || 'UNID'}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                              $ {puCot.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '900', color: '#0369a1' }}>
                              $ {(Number(it.total_fila || (it.cantidad * puCot))).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>
                              {puEst > 0 ? `$ ${puEst.toLocaleString('de-DE', { minimumFractionDigits: 2 })}` : 'N/A'}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              {puEst > 0 ? (
                                diff < 0 ? (
                                  <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>
                                    {pct.toFixed(1)}% (Ahorro)
                                  </span>
                                ) : diff > 0 ? (
                                  <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#dc2626', backgroundColor: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>
                                    +{pct.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#0284c7', backgroundColor: '#e0f2fe', padding: '2px 6px', borderRadius: '4px' }}>
                                    = Igual
                                  </span>
                                )
                              ) : (
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Total General Banner */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px', gap: '20px' }}>
                <div style={{ backgroundColor: '#0f172a', color: 'white', padding: '10px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#94a3b8' }}>TOTAL GENERAL ODC:</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#38bdf8' }}>
                    $ {Number(odcPrioridadTarget.total_general || odcPrioridadTarget.total || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Selector de Nivel de Prioridad (1 y 2) */}
            <div style={{ marginBottom: '22px', backgroundColor: '#faf5ff', padding: '20px', borderRadius: '16px', border: '1.5px solid #e9d5ff' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '900', color: '#581c87', marginBottom: '12px' }}>
                ⚡ Seleccione el Nivel de Prioridad de Aprobación para Pago:
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                
                {/* Opción Nivel 1 */}
                <div
                  onClick={() => setPrioridadSeleccionada(1)}
                  style={{
                    padding: '16px',
                    borderRadius: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: prioridadSeleccionada === 1 ? '2.5px solid #dc2626' : '1.5px solid #cbd5e1',
                    backgroundColor: prioridadSeleccionada === 1 ? '#fef2f2' : '#ffffff',
                    boxShadow: prioridadSeleccionada === 1 ? '0 4px 12px rgba(220, 38, 38, 0.15)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: '900', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🔴 NIVEL 1 — Prioridad Máxima de Pago
                    </span>
                    <input
                      type="radio"
                      name="prioridad_odc"
                      checked={prioridadSeleccionada === 1}
                      onChange={() => setPrioridadSeleccionada(1)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#dc2626' }}
                    />
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#7f1d1d', fontWeight: '500', lineHeight: 1.4 }}>
                    Pago prioritario inmediato. Recomendado para requisiciones de <strong>EMERGENCIA</strong>, proveedores críticos o acuerdos que exigen desembolso urgente.
                  </p>
                </div>

                {/* Opción Nivel 2 */}
                <div
                  onClick={() => setPrioridadSeleccionada(2)}
                  style={{
                    padding: '16px',
                    borderRadius: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: prioridadSeleccionada === 2 ? '2.5px solid #2563eb' : '1.5px solid #cbd5e1',
                    backgroundColor: prioridadSeleccionada === 2 ? '#eff6ff' : '#ffffff',
                    boxShadow: prioridadSeleccionada === 2 ? '0 4px 12px rgba(37, 99, 235, 0.15)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: '900', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🔵 NIVEL 2 — Prioridad Normal / Programable
                    </span>
                    <input
                      type="radio"
                      name="prioridad_odc"
                      checked={prioridadSeleccionada === 2}
                      onChange={() => setPrioridadSeleccionada(2)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2563eb' }}
                    />
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#1e3a8a', fontWeight: '500', lineHeight: 1.4 }}>
                    Pago regular programado. Para compras ordinarias bajo plazos normales de crédito o flujo estándar de caja.
                  </p>
                </div>

              </div>
            </div>

            {/* Formulario de Rechazo (Opción 6) */}
            {mostrarRechazoInput && (
              <div style={{ backgroundColor: '#fef2f2', border: '1.5px solid #fca5a5', padding: '16px 20px', borderRadius: '14px', marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#991b1b', marginBottom: '6px' }}>
                  Motivo de Rechazo / Ajustes requeridos para Compras (Precios, Días de Crédito, Proveedor) *
                </label>
                <textarea
                  rows={3}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #f87171', fontSize: '0.82rem', resize: 'vertical' }}
                  placeholder="Explique el motivo por el cual se rechaza el precio o condición y qué ajustes debe realizar Compras antes de volver a enviarla..."
                  value={motivoRechazoInput}
                  onChange={(e) => setMotivoRechazoInput(e.target.value)}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setMostrarRechazoInput(false)}
                    style={{ padding: '8px 16px', fontSize: '0.78rem', fontWeight: '700', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', cursor: 'pointer' }}
                  >
                    Cancelar Rechazo
                  </button>
                  <button
                    type="button"
                    disabled={guardandoPrioridadOdc}
                    onClick={ejecutarRechazoPrecioODC}
                    style={{ padding: '8px 18px', fontSize: '0.78rem', fontWeight: '800', borderRadius: '8px', border: 'none', backgroundColor: '#dc2626', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Ban size={15} /> Confirmar Rechazo de ODC
                  </button>
                </div>
              </div>
            )}

            {/* Botones Principales de Acción */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '18px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                {!mostrarRechazoInput && (
                  <button
                    type="button"
                    onClick={() => setMostrarRechazoInput(true)}
                    style={{
                      padding: '10px 18px',
                      fontSize: '0.82rem',
                      fontWeight: '800',
                      borderRadius: '10px',
                      border: '1px solid #fca5a5',
                      backgroundColor: '#fff',
                      color: '#dc2626',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Ban size={15} /> Rechazar Orden de Compra
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setModalPrioridadOpen(false)}
                  style={{
                    padding: '10px 20px',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f8fafc',
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                >
                  Cerrar
                </button>

                <button
                  type="button"
                  disabled={guardandoPrioridadOdc}
                  onClick={() => ejecutarAprobacionPrecioYPrioridad(prioridadSeleccionada)}
                  style={{
                    padding: '10px 24px',
                    fontSize: '0.85rem',
                    fontWeight: '900',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: prioridadSeleccionada === 1 ? '#dc2626' : '#16a34a',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)'
                  }}
                >
                  <CheckCircle2 size={16} />
                  {guardandoPrioridadOdc ? 'Guardando...' : `Aprobar Precio de ODC (Nivel ${prioridadSeleccionada})`}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL DE VISTA PREVIA INTERACTIVA F-ADM-01-2 */}
      {showPdfPreviewModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 100000,
          padding: '16px'
        }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '1100px',
              height: '94vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden'
            }}
          >
            {/* Header de Vista Previa */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Printer size={20} color="#0284c7" />
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: '#0f172a' }}>
                    Vista Previa de Impresión — {odcSeleccionada?.numero_odc || 'Órden de Compra'}
                  </h3>
                </div>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b', fontWeight: '600' }}>
                  Formato oficial <strong>F-ADM-01-2</strong> con 3 copias automáticas (Original Cliente, Cuentas por Pagar, Control Compras)
                </p>
              </div>

              {/* Botones de acción en la Vista Previa */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <motion.button
                  type="button"
                  onClick={imprimirPDFActual}
                  whileHover={{ scale: 1.05, y: -1, boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)' }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 18px',
                    backgroundColor: '#0284c7',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.2)'
                  }}
                  title="Abrir cuadro de diálogo de impresión"
                >
                  <Printer size={16} /> 🖨️ Imprimir
                </motion.button>

                <motion.button
                  type="button"
                  onClick={descargarPDFActual}
                  whileHover={{ scale: 1.05, y: -1, boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)' }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 18px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(16, 185, 129, 0.2)'
                  }}
                  title="Descargar archivo PDF en su computadora"
                >
                  <Download size={16} /> 📥 Descargar PDF
                </motion.button>

                <motion.button
                  type="button"
                  onClick={cerrarVistaPreviaPDF}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  style={{
                    background: '#e2e8f0',
                    border: 'none',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#475569',
                    marginLeft: '8px'
                  }}
                  title="Cerrar vista previa"
                >
                  <XCircle size={20} />
                </motion.button>
              </div>
            </div>

            {/* Contenido del PDF en iframe */}
            <div style={{ flex: 1, backgroundColor: '#525659', position: 'relative' }}>
              {generandoPdfPreview ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'white', gap: '12px' }}>
                  <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: '0.95rem', fontWeight: '700' }}>Generando las 3 copias oficiales del documento...</span>
                </div>
              ) : pdfPreviewUrl ? (
                <iframe
                  ref={pdfIframeRef}
                  src={pdfPreviewUrl}
                  title="Vista Previa de Orden de Compra F-ADM-01-2"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'white' }}>
                  No se pudo cargar la vista previa.
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal Interactivo de Anulación de Órden de Compra con Selección de Motivo */}
      {modalAnularOpen && odcParaAnular && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '560px',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              border: '1.5px solid #fecaca',
              position: 'relative'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Ban size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: '#991b1b' }}>
                  Anular Órden de Compra
                </h3>
                <span style={{ fontSize: '0.85rem', color: '#dc2626', fontWeight: '700' }}>
                  {odcParaAnular.numero_odc} {odcParaAnular.proveedor_nombre ? `• ${odcParaAnular.proveedor_nombre}` : ''}
                </span>
              </div>
            </div>

            {/* Warning note */}
            <div style={{
              backgroundColor: '#fff1f2',
              border: '1px solid #fecdd3',
              borderRadius: '12px',
              padding: '12px 14px',
              fontSize: '0.8rem',
              color: '#9f1239',
              lineHeight: '1.45',
              marginBottom: '18px'
            }}>
              ⚠️ <strong>Atención:</strong> Esta acción cambiará el estado de la ODC a <strong>ANULADA</strong> y liberará automáticamente los renglones y cantidades en la requisición vinculada para permitir su cotización y re-compra.
            </div>

            {/* Dropdown de Motivos */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: '#334155', marginBottom: '6px' }}>
                Motivo de Anulación <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={motivoAnulacionSelect}
                onChange={(e) => setMotivoAnulacionSelect(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  color: '#1e293b',
                  backgroundColor: '#f8fafc',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="Error en montos, precios unitarios o cotización">Error en montos, precios unitarios o cotización</option>
                <option value="Cambio de proveedor seleccionado">Cambio de proveedor seleccionado</option>
                <option value="Requisición cancelada o modificada por el solicitante">Requisición cancelada o modificada por el solicitante</option>
                <option value="Duplicidad de orden de compra">Duplicidad de orden de compra</option>
                <option value="Proveedor sin disponibilidad / tiempo de entrega no viable">Proveedor sin disponibilidad / tiempo de entrega no viable</option>
                <option value="Condiciones comerciales o de pago no acordadas">Condiciones comerciales o de pago no acordadas</option>
                <option value="Material o servicio no requerido / Desestimado">Material o servicio no requerido / Desestimado</option>
                <option value="Otro motivo (especificar en detalle)">Otro motivo (especificar en detalle)</option>
              </select>
            </div>

            {/* Textarea detalles adicionales */}
            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: '#334155', marginBottom: '6px' }}>
                Detalles u Observaciones Adicionales {motivoAnulacionSelect === 'Otro motivo (especificar en detalle)' ? <span style={{ color: '#dc2626' }}>* (Obligatorio)</span> : <span style={{ color: '#94a3b8', fontWeight: '500' }}>(Opcional)</span>}
              </label>
              <textarea
                rows={3}
                value={motivoAnulacionDetalle}
                onChange={(e) => setMotivoAnulacionDetalle(e.target.value)}
                placeholder="Indique cualquier detalle adicional sobre las causas de anulación..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.82rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Botones de acción */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                disabled={guardandoAnulacion}
                onClick={() => {
                  setModalAnularOpen(false);
                  setOdcParaAnular(null);
                }}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardandoAnulacion}
                onClick={ejecutarAnulacionOdc}
                style={{
                  padding: '10px 22px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {guardandoAnulacion ? (
                  <>
                    <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Anulando...
                  </>
                ) : (
                  <>
                    <Ban size={15} /> Confirmar Anulación
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal para Agregar Nuevo Destino de Despacho Predeterminado */}
      {showNuevoDestinoModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 12000, padding: '20px' }}>
          <div style={{ maxWidth: '520px', width: '100%', padding: '25px', backgroundColor: '#ffffff', borderRadius: '18px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: '1.15rem', fontWeight: '800' }}>
              📍 Agregar Nuevo Destino de Despacho
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '22px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '6px' }}>
                  NOMBRE DEL LUGAR / SEDE *
                </label>
                <input
                  type="text"
                  className="input-tc"
                  placeholder="Ej: Campo Boscán, Planta Sur, Galpón Principal..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '600' }}
                  value={nuevoDestinoForm.nombre}
                  onChange={(e) => setNuevoDestinoForm(prev => ({ ...prev, nombre: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '6px' }}>
                  DIRECCIÓN COMPLETA *
                </label>
                <textarea
                  className="input-tc"
                  placeholder="Ej: Av 61 entre calle 147, Km 12..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '70px', fontSize: '0.85rem', resize: 'vertical' }}
                  value={nuevoDestinoForm.direccion}
                  onChange={(e) => setNuevoDestinoForm(prev => ({ ...prev, direccion: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '6px' }}>
                    PERSONA DE CONTACTO
                  </label>
                  <input
                    type="text"
                    className="input-tc"
                    placeholder="Nombre del receptor"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    value={nuevoDestinoForm.contacto_nombre}
                    onChange={(e) => setNuevoDestinoForm(prev => ({ ...prev, contacto_nombre: e.target.value }))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '6px' }}>
                    TELÉFONO DE CONTACTO
                  </label>
                  <input
                    type="text"
                    className="input-tc"
                    placeholder="0414-XXXXXXX"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    value={nuevoDestinoForm.contacto_telefono}
                    onChange={(e) => setNuevoDestinoForm(prev => ({ ...prev, contacto_telefono: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="btn-tc btn-tc-secondary"
                onClick={() => setShowNuevoDestinoModal(false)}
                style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '700', cursor: 'pointer' }}
              >
                CANCELAR
              </button>
              <button
                type="button"
                className="btn-tc btn-tc-success"
                onClick={guardarNuevoDestino}
                style={{ backgroundColor: '#0ea5e9', color: '#ffffff', padding: '9px 20px', borderRadius: '8px', border: 'none', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                ✓ GUARDAR DESTINO
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default OrdenesCompra;
