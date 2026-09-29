import React, { useState, useEffect, useMemo, useRef } from 'react';
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

  // Verificación RBAC para Impresión y Gestión (Exclusivo Compras / Admins)
  const deptoUser = (currentUser?.departamento || '').toLowerCase().trim();
  const rolUser = (currentUser?.rol || '').toLowerCase().trim();
  const emailUser = (currentUser?.correo || '').toLowerCase().trim();

  const esAdmin = currentUser?.esAdminReal || 
                  currentUser?.rol === 'Admin' || 
                  currentUser?.rol === 'Gerente General' ||
                  deptoUser.includes('administra') ||
                  emailUser === 'jcontreras.totalclean@gmail.com' ||
                  emailUser === 'cvega@totalclean.com.ve';
  
  // Capacidad de Eliminación Exclusiva para Administrador Principal (José)
  const esAdminSuper = emailUser === 'jcontreras.totalclean@gmail.com' || currentUser?.esAdminReal || (currentUser?.rol || '').toUpperCase() === 'SUPERADMIN';

  const esUsuarioCompras = esAdmin || deptoUser.includes('compra') || rolUser.includes('compra');

  // Es Gerente General (Carlos Vega)
  const esCarlosVega = esAdmin || 
                       rolUser.includes('gerente general') || 
                       emailUser === 'cvega@totalclean.com.ve';

  useEffect(() => {
    cargarOrdenes();

    const channel = supabase
      .channel('ordenes_compra_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_compra' }, () => {
        cargarOrdenes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const cargarOrdenes = async () => {
    setLoading(true);
    try {
      // 1. Cargar catálogo de proveedores de forma independiente
      const { data: provsData } = await supabase
        .from('proveedores')
        .select('*');
      
      const provMap = {};
      (provsData || []).forEach(p => {
        if (p.id !== undefined && p.id !== null) {
          provMap[String(p.id)] = p;
        }
      });

      // 2. Cargar requisiciones de origen para vinculación directa (Paginación completa)
      let reqsData = [];
      let pageReq = 0;
      let keepReq = true;
      while (keepReq) {
        const { data: chunk, error: reqErr } = await supabase
          .from('requisiciones')
          .select('id, correlativo_req, solicitante, gerencia, centro_costo')
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

        return {
          ...o,
          requisicion_id: reqIdResolved || o.requisicion_id || (reqObj ? reqObj.id : null),
          proveedor_nombre: nombreVal,
          proveedor_rif: rifVal,
          proveedor_contacto: contactoVal,
          proveedor_ciudad: ciudadVal,
          proveedor_direccion: direccionVal,
          fecha_despacho: o.fecha_despacho || o.fecha_emision || 'N/A',
          requisicion_correlativo: correlativoReq,
          requisicion_obj: reqObj || null,
          solicitante: (reqObj?.solicitante && (!o.solicitante || o.solicitante === 'Total Clean C.A.')) ? reqObj.solicitante : (o.solicitante || reqObj?.solicitante || 'Total Clean C.A.')
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
          if (foundReq.centro_costo || foundReq.obra) {
            odcCompleta.destino_despacho = foundReq.centro_costo || foundReq.obra;
          }
        }
      } catch (e) {
        console.error("Error al buscar requisición vinculada:", e);
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
  // FUNCIONALIDAD DE EDICIÓN COMPLETA DE ORDEN DE COMPRA (ODC)
  // -------------------------------------------------------------
  const abrirModalEditarOdc = async (odc) => {
    if (!esUsuarioCompras) {
      toast.error("No tiene permisos para editar Órdenes de Compra.");
      return;
    }
    setLoadingEditData(true);
    setShowEditModal(true);

    try {
      // 1. Cargar lista de proveedores para el selector
      const { data: provs } = await supabase
        .from('proveedores')
        .select('*')
        .order('razon_social', { ascending: true });
      setProveedoresList(provs || []);

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

      setEditOdcTarget({
        ...odc,
        requisicion_id: resolvedReqId,
        proveedor_id: odc.proveedor_id || '',
        proveedor_nombre: odc.proveedor_nombre || '',
        proveedor_rif: odc.proveedor_rif || '',
        proveedor_contacto: odc.proveedor_contacto || '',
        proveedor_ciudad: odc.proveedor_ciudad || '',
        proveedor_direccion: odc.proveedor_direccion || '',
        cotizacion_ref: odc.cotizacion_ref || '',
        fecha_cotizacion: odc.fecha_cotizacion || '',
        fecha_despacho: odc.fecha_despacho || odc.fecha_emision || '',
        tipo_pago: odc.tipo_pago || 'CONTADO',
        dias_credito: odc.dias_credito || 0,
        moneda: odc.moneda || 'USD',
        tasa_cambio: odc.tasa_cambio || odc.tasa_bcv || 1,
        destino_despacho: odc.destino_despacho || odc.despachar_a_direccion || 'Galpones Riese - Av. Los Haticos',
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
        despachar_a_direccion: editOdcTarget.destino_despacho || null,
        destino_despacho: editOdcTarget.destino_despacho || null,
        datos_bancarios: editOdcTarget.datos_bancarios || editOdcTarget.cuenta_bancaria || null,
        cuenta_bancaria: editOdcTarget.datos_bancarios || editOdcTarget.cuenta_bancaria || null,
        terminos_condiciones: editOdcTarget.terminos_condiciones || null,
        observaciones: editOdcTarget.observaciones || null,
        subtotal: subtotalEdit,
        iva_porcentaje: porcentajeIvaEdit,
        porcentaje_iva: porcentajeIvaEdit,
        iva_monto: montoIvaEdit,
        total: totalGeneralEdit,
        total_general: totalGeneralEdit
      };

      // 1. Actualizar ordenes_compra (con fallback en caso de que la columna observaciones no esté en DB)
      let errUpdate = null;
      try {
        const { error } = await supabase
          .from('ordenes_compra')
          .update(payloadOdc)
          .eq('id', editOdcTarget.id);
        errUpdate = error;
      } catch (e) {
        errUpdate = e;
      }

      if (errUpdate && errUpdate.message && errUpdate.message.toLowerCase().includes('observaciones')) {
        const { observaciones, ...payloadSinObs } = payloadOdc;
        const { error: retryErr } = await supabase
          .from('ordenes_compra')
          .update(payloadSinObs)
          .eq('id', editOdcTarget.id);
        if (retryErr) throw retryErr;
      } else if (errUpdate) {
        throw errUpdate;
      }

      if (editOdcTarget.observaciones !== undefined) {
        localStorage.setItem(`odc_obs_${editOdcTarget.id}`, editOdcTarget.observaciones || '');
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
              const yaExiste = historialPrevio.some(h => h.odc_id === editOdcTarget.id || h.odc_numero === editOdcTarget.numero_odc);
              if (!yaExiste) {
                return {
                  ...r,
                  historial_compras: [
                    ...historialPrevio,
                    {
                      fecha: new Date().toISOString(),
                      tipo: 'ODC',
                      odc_numero: editOdcTarget.numero_odc,
                      odc_id: editOdcTarget.id,
                      proveedor_nombre: editOdcTarget.proveedor_nombre || 'Proveedor',
                      cantidad: parseFloat(itemCoincidente.cantidad) || 0,
                      pu: parseFloat(itemCoincidente.precio_unitario) || 0,
                      usuario: `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim()
                    }
                  ]
                };
              }
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
      const odcRefrescada = {
        ...editOdcTarget,
        ...payloadOdc,
        requisicion_correlativo: reqObjNuevo?.correlativo_req || null,
        requisicion_obj: reqObjNuevo || null
      };

      setOrdenes(prev => prev.map(o => o.id === editOdcTarget.id ? odcRefrescada : o));
      if (odcSeleccionada && odcSeleccionada.id === editOdcTarget.id) {
        setOdcSeleccionada(odcRefrescada);
        setOdcItems(newItemsPayload);
      }

      setShowEditModal(false);
      toast.success(`Órden de Compra ${editOdcTarget.numero_odc} editada y actualizada con éxito.`);
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

  // Anular Órden de Compra (Exclusivo Compras / Admin)
  const manejarAnularOdc = async (odcTarget = odcSeleccionada) => {
    if (!odcTarget) return;
    if (!esUsuarioCompras) {
      toast.error("Solo el personal del departamento de Compras tiene autorización para anular Órdenes de Compra.");
      return;
    }

    const confirmar = window.confirm(`¿Está seguro de ANULAR la Órden de Compra ${odcTarget.numero_odc}?`);
    if (!confirmar) return;

    try {
      const dbPayload = {
        estatus_pago: 'ANULADO',
        status_pago: 'ANULADO'
      };

      const { error } = await supabase
        .from('ordenes_compra')
        .update(dbPayload)
        .eq('id', odcTarget.id);

      if (error) throw error;

      const odcActualizada = { ...odcTarget, ...dbPayload, estatus_pago: 'ANULADA', status_pago: 'ANULADA', estatus_recepcion: 'ANULADA' };
      if (odcSeleccionada && odcSeleccionada.id === odcTarget.id) {
        setOdcSeleccionada(odcActualizada);
      }
      setOrdenes(prev => prev.map(o => o.id === odcTarget.id ? odcActualizada : o));
      toast.success(`Órden de Compra ${odcTarget.numero_odc} ANULADA correctamente.`);
    } catch (err) {
      console.error("Error al anular ODC:", err);
      toast.error("Error al anular la Órden de Compra: " + err.message);
    }
  };

  // Alternar Firma Digital Remota de Carlos Vega
  const toggleFirmaDigitalCarlos = async (activa) => {
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

  // Eliminar Órden de Compra (Exclusivo Administrador Principal - José)
  const manejarEliminarOdc = async (odcTarget = odcSeleccionada) => {
    if (!odcTarget) return;
    if (!esAdminSuper) {
      toast.error("Solo el Administrador Principal (jcontreras.totalclean@gmail.com) tiene permisos para eliminar Órdenes de Compra.");
      return;
    }

    const confirmar = window.confirm(`⚠️ ¡ATENCIÓN! ¿Está seguro de ELIMINAR PERMANENTEMENTE la Órden de Compra ${odcTarget.numero_odc}? Esta acción borra todos sus renglones y expediente.`);
    if (!confirmar) return;

    try {
      // 1. Borrar renglones asociados
      await supabase
        .from('ordenes_compra_items')
        .delete()
        .eq('orden_compra_id', odcTarget.id);

      // 2. Borrar la ODC principal
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
      toast.success(`Órden de Compra ${odcTarget.numero_odc} eliminada permanentemente.`);
    } catch (err) {
      console.error("Error al eliminar ODC:", err);
      toast.error("Error al eliminar la Órden de Compra: " + err.message);
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

  // Generación de PDF Formato Oficial F-ADM-01-2 (3 Copias en un solo documento)
  const exportarPDF_F_ADM_01_2 = async () => {
    if (!odcSeleccionada) return;
    if (!esUsuarioCompras) {
      toast.error("Acceso restringido: Solo el personal de Compras puede exportar la ODC");
      return;
    }

    try {
      toast.loading("Generando documento oficial de Orden de Compra (3 copias)...", { id: 'pdf-odc' });
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

      const rawDestino = odcSeleccionada.requisicion_obj?.centro_costo || 
                         odcSeleccionada.requisicion_obj?.obra || 
                         odcSeleccionada.destino_despacho || 
                         odcSeleccionada.despachar_a_direccion || 
                         'Galpones Riese - Av. Los Haticos';
      const destinoObraLimpio = String(rawDestino || '').replace(/\s*-\s*null/gi, '').replace(/null/gi, '').trim() || 'Galpones Riese - Av. Los Haticos';

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
          [`Despachar a: ${odcSeleccionada.despachar_a || 'Total Clean C.A.'}`, ``],
          [`Solicitado por: ${solicitanteNombre}`, ``],
          [`Destino a obra: ${destinoObraLimpio}`, ``]
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
        doc.line(marginX + sigW + 6, sigY + 12.0, marginX + sigW * 2 - 6, sigY + 12.0);
        doc.setFontSize(6.2);
        doc.text("Ricardo Herrera (Gerente de Compras)", marginX + sigW + sigW / 2, sigY + 15.8, { align: 'center' });

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

      doc.save(`Orden_Compra_${odcSeleccionada.numero_odc || 'ODC'}.pdf`);
      toast.success("Documento oficial (3 copias) generado con éxito.", { id: 'pdf-odc' });
    } catch (err) {
      console.error("Error al exportar PDF de ODC:", err);
      toast.error("Error al generar PDF de la ODC: " + err.message, { id: 'pdf-odc' });
    }
  };

  // Filtrado de la Lista de Órdenes
  const ordenesFiltradas = useMemo(() => {
    return ordenes.filter(o => {
      const matchBusqueda = (o.numero_odc || '').toLowerCase().includes(busqueda.toLowerCase()) ||
                            (o.proveedor_nombre || '').toLowerCase().includes(busqueda.toLowerCase()) ||
                            (o.cotizacion_ref || '').toLowerCase().includes(busqueda.toLowerCase()) ||
                            (o.orden_pago_ref || '').toLowerCase().includes(busqueda.toLowerCase()) ||
                            (o.destino_despacho || '').toLowerCase().includes(busqueda.toLowerCase()) ||
                            (o.comprador_nombre || '').toLowerCase().includes(busqueda.toLowerCase());

      if (!matchBusqueda) return false;

      if (tabFiltro === 'contado') {
        return o.tipo_pago === 'CONTADO';
      }
      if (tabFiltro === 'credito') {
        return o.tipo_pago === 'CREDITO';
      }
      if (tabFiltro === 'por_vencer') {
        if (o.tipo_pago !== 'CREDITO' || o.estatus_pago === 'PAGADO') return false;
        const sem = calcularSemaforoCredito(o);
        return sem.nivel === 'ambar' || sem.nivel === 'rojo';
      }
      return true;
    });
  }, [ordenes, busqueda, tabFiltro]);

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
            Gestión centralizada de compras y proveedores
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
          <DollarSign size={16} /> Cuentas de Contado ({ordenes.filter(o => o.tipo_pago === 'CONTADO').length})
        </button>
        <button 
          className={`odc-tab-btn ${tabFiltro === 'credito' ? 'active' : ''}`}
          onClick={() => setTabFiltro('credito')}
        >
          <CreditCard size={16} /> Cuentas a Crédito ({ordenes.filter(o => o.tipo_pago === 'CREDITO').length})
        </button>
        <button 
          className={`odc-tab-btn ${tabFiltro === 'por_vencer' ? 'active' : ''}`}
          onClick={() => setTabFiltro('por_vencer')}
          style={{ borderColor: '#f59e0b', color: tabFiltro === 'por_vencer' ? 'white' : '#d97706' }}
        >
          <AlertTriangle size={16} /> Créditos por Vencer / Vencidos ⚠️
        </button>
      </div>

      {/* Buscador */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '15px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input 
            type="text"
            className="input-style"
            style={{ width: '100%', paddingLeft: '42px', height: '44px', borderRadius: '12px', fontSize: '0.85rem' }}
            placeholder="Buscar por correlativo ODC, orden de pago, proveedor, ref. cotización o destino..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {/* Tabla de Órdenes de Compra */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <div style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto' }} />
            Cargando expedientes de Órdenes de Compra...
          </div>
        ) : ordenesFiltradas.length === 0 ? (
          <div style={{ padding: '50px', textAlign: 'center', color: '#94a3b8' }}>
            <FileText size={40} style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
            <p style={{ margin: 0, fontWeight: '600' }}>No se encontraron Órdenes de Compra registradas.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', color: 'white', textAlign: 'left' }}>
                <th style={{ padding: '14px 16px' }}>Correlativo ODC</th>
                <th style={{ padding: '14px 16px' }}>Proveedor</th>
                <th style={{ padding: '14px 16px' }}>Requisición Origen</th>
                <th style={{ padding: '14px 16px' }}>Tipo Pago</th>
                <th style={{ padding: '14px 16px' }}>Semáforo Crédito</th>
                <th style={{ padding: '14px 16px', textAlign: 'center' }}>Recepción & Pago</th>
                <th style={{ padding: '14px 16px', textAlign: 'right' }}>Total General</th>
                <th style={{ padding: '14px 16px', textAlign: 'center' }}>Firma Carlos</th>
                <th style={{ padding: '14px 16px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ordenesFiltradas.map((odc) => {
                const sem = calcularSemaforoCredito(odc);
                return (
                  <tr key={odc.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.2s' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <motion.span
                        onClick={() => abrirDetalleOdc(odc)}
                        whileHover={{
                          scale: 1.1,
                          x: 5,
                          color: '#2563eb',
                          textShadow: '0 0 8px rgba(37, 99, 235, 0.2)'
                        }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 10 }}
                        style={{
                          fontSize: '13px',
                          fontWeight: '900',
                          color: '#1e40af',
                          textDecoration: 'underline',
                          textUnderlineOffset: '3px',
                          textDecorationColor: 'rgba(30, 64, 175, 0.4)',
                          cursor: 'pointer',
                          display: 'inline-block'
                        }}
                        title="Ver expediente y vista previa de esta ODC"
                      >
                        {odc.numero_odc}
                      </motion.span>
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: '600', color: '#0f172a' }}>
                      {odc.proveedor_nombre || 'N/A'}
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: '600', color: '#0f172a' }}>
                      {odc.requisicion_correlativo || odc.requisicion_obj?.correlativo_req || odc.numero_req || (odc.requisicion_id ? (String(odc.requisicion_id).startsWith('REQ-') ? odc.requisicion_id : `REQ-${odc.requisicion_id}`) : 'N/A')}
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
                    <td style={{ padding: '14px 16px' }}>
                      <span className={`badge-semaforo ${sem.badgeClass}`}>
                        {sem.label}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
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
                          title="Clic para cambiar recepción (desencadena cuenta regresiva de crédito)"
                        >
                          {odc.estatus_recepcion === 'RECIBIDO' ? '📦 RECIBIDO' : '🚚 MARCAR RECIBIDO'}
                        </button>
                        <button
                          type="button"
                          onClick={() => cambiarEstatusPago(odc.estatus_pago === 'PAGADO' ? 'PENDIENTE' : 'PAGADO', odc)}
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.68rem',
                            fontWeight: '800',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: odc.estatus_pago === 'PAGADO' ? '#e0f2fe' : '#f1f5f9',
                            color: odc.estatus_pago === 'PAGADO' ? '#0369a1' : '#64748b'
                          }}
                          title="Clic para cambiar estatus de pago"
                        >
                          {odc.estatus_pago === 'PAGADO' ? '✅ PAGADO' : '💳 MARCAR PAGADO'}
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                      $ {Number(odc.total_general || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {odc.carlos_firma_digital_activa ? (
                        <span style={{ color: '#16a34a', fontSize: '0.75rem', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          <ShieldCheck size={14} /> Digital
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Física</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                        <motion.button 
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            border: '1px solid #bae6fd',
                            backgroundColor: '#f0f9ff',
                            color: '#0284c7',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onClick={() => abrirDetalleOdc(odc)}
                          title="Ver Expediente / Formato F-ADM-01-2"
                        >
                          <Eye size={16} />
                        </motion.button>
                        {esUsuarioCompras && (
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
                        {esUsuarioCompras && odc.estatus_pago !== 'ANULADA' && (
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => manejarAnularOdc(odc)}
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
                        {esAdminSuper && (
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
                            title="Eliminar permanentemente esta Órden de Compra"
                          >
                            <Trash2 size={16} />
                          </motion.button>
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
          <div style={{ backgroundColor: 'white', borderRadius: '24px', width: '100%', maxWidth: '950px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)', padding: '28px' }}>
            
            {/* Cabecera Acciones Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '1px' }}>Expediente de Órden de Compra</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px' }}>
                  <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800' }}>{odcSeleccionada.numero_odc}</h2>
                  {(odcSeleccionada.requisicion_correlativo || odcSeleccionada.requisicion_id) && (
                    <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '4px 12px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: '800', border: '1px solid #bae6fd', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      📋 Requisición Origen: {odcSeleccionada.requisicion_correlativo || `REQ-${odcSeleccionada.requisicion_id}`}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {esUsuarioCompras && (
                  <button
                    type="button"
                    onClick={() => abrirModalEditarOdc(odcSeleccionada)}
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.8rem',
                      fontWeight: '800',
                      borderRadius: '10px',
                      border: '1px solid #38bdf8',
                      cursor: 'pointer',
                      backgroundColor: '#f0f9ff',
                      color: '#0284c7',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title="Editar datos, proveedor, ítems y montos de esta Órden de Compra"
                  >
                    <Edit2 size={15} /> ✏️ Editar ODC
                  </button>
                )}

                {/* CONTROL RBAC DE IMPRESIÓN EXCLUSIVO PARA COMPRAS / ADMINS */}
                {esUsuarioCompras ? (
                  <button 
                    className="btn-primary" 
                    style={{ backgroundColor: '#0284c7', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '800' }}
                    onClick={exportarPDF_F_ADM_01_2}
                  >
                    <Printer size={16} /> Exportar / Imprimir F-ADM-01-2
                  </button>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={14} /> Impresión exclusiva de Compras
                  </div>
                )}

                <button 
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => setModalOpen(false)}
                >
                  <XCircle size={20} color="#64748b" />
                </button>
              </div>
            </div>

            {/* Panel de Control de Gobernanza (Switch de Carlos Vega) */}
            {esCarlosVega && (
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '16px', padding: '16px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

            {/* Panel de Edición de Observaciones de la ODC */}
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '16px 20px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={16} color="#0ea5e9" /> Observaciones de la Órden de Compra
                </span>
                <button 
                  type="button" 
                  onClick={() => setEditandoObservaciones(!editandoObservaciones)}
                  style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: '700', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', cursor: 'pointer' }}
                >
                  {editandoObservaciones ? 'Ocultar Editor' : '✏️ Editar Observaciones'}
                </button>
              </div>

              {editandoObservaciones ? (
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
                      style={{ padding: '6px 16px', fontSize: '0.75rem', fontWeight: '800', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
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

            {/* Panel de Edición de Leyes y Condiciones Comerciales */}
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '16px 20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={16} color="#0ea5e9" /> Leyes, Términos & Condiciones Comerciales
                </span>
                <button 
                  type="button" 
                  onClick={() => setEditandoTerminos(!editandoTerminos)}
                  style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: '700', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', cursor: 'pointer' }}
                >
                  {editandoTerminos ? 'Ocultar Editor' : '✏️ Editar Leyes / Condiciones'}
                </button>
              </div>

              {editandoTerminos ? (
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
                      style={{ padding: '6px 14px', fontSize: '0.75rem', fontWeight: '700', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      ⭐ Establecer Predeterminado Global
                    </button>
                    <button
                      type="button"
                      disabled={guardandoTerminos}
                      onClick={() => guardarTerminosOdc(textoTerminos)}
                      style={{ padding: '6px 16px', fontSize: '0.75rem', fontWeight: '800', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
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
                      <div><strong>Despachar a:</strong> {odcSeleccionada.despachar_a || 'Total Clean C.A.'}</div>
                      <div><strong>Solicitado por:</strong> {odcSeleccionada.requisicion_obj?.solicitante || odcSeleccionada.solicitante || odcSeleccionada.solicitado_por || 'Total Clean C.A.'}</div>
                      <div><strong>Destino a obra:</strong> {(odcSeleccionada.requisicion_obj?.centro_costo || odcSeleccionada.requisicion_obj?.obra || odcSeleccionada.destino_despacho || odcSeleccionada.despachar_a_direccion || 'Galpones Riese - Av. Los Haticos').replace(/\s*-\s*null/gi, '').replace(/null/gi, '').trim()}</div>
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
                  <div className="f-adm-sig-name-compact">
                    Ricardo Herrera (Gerente de Compras)
                  </div>
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
                
                {/* Sección 1: Encabezado y Datos del Proveedor */}
                <div style={{ backgroundColor: '#f8fafc', padding: '18px 20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 14px 0', fontSize: '0.88rem', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building2 size={16} color="#0ea5e9" /> Datos del Proveedor & Encabezado ODC
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                    
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#0369a1', marginBottom: '4px' }}>
                        📌 Requisición de Origen (Vínculo)
                      </label>
                      <div style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #0284c7', fontSize: '0.82rem', backgroundColor: '#f0f9ff', fontWeight: '700', color: '#0369a1' }}>
                        {sourceReqSelected ? `${sourceReqSelected.correlativo_req} - ${sourceReqSelected.solicitante || 'Sin solicitante'}` : (editOdcTarget?.requisicion_correlativo || (editOdcTarget?.requisicion_id ? `REQ-${editOdcTarget.requisicion_id}` : 'Sin Requisición Vinculada'))}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#0ea5e9', marginBottom: '4px' }}>
                        🔍 Categoría de Proveedor
                      </label>
                      <select
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #38bdf8', fontSize: '0.82rem', backgroundColor: '#f0f9ff', fontWeight: '700', color: '#0284c7' }}
                        value={filtroCategoriaProveedor}
                        onChange={(e) => setFiltroCategoriaProveedor(e.target.value)}
                      >
                        <option value="TODAS">-- Todas las Categorías ({proveedoresList.length}) --</option>
                        {categoriasDisponibles.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                        Seleccionar Proveedor ({proveedoresFiltradosPorCategoria.length})
                      </label>
                      <select
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', backgroundColor: 'white' }}
                        value={editOdcTarget.proveedor_id || ''}
                        onChange={(e) => manejarCambioProveedorEdicion(e.target.value)}
                      >
                        <option value="">-- Proveedor Personalizado --</option>
                        {proveedoresFiltradosPorCategoria.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.razon_social || p.nombre} ({p.rif || 'Sin RIF'})
                          </option>
                        ))}
                      </select>
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
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: '700', color: '#0ea5e9', marginBottom: '4px' }}>
                            <Landmark size={13} /> Cuenta Bancaria de Destino para Pago
                          </label>
                          <select
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #0ea5e9', fontSize: '0.82rem', backgroundColor: ctasProv.length > 0 ? '#f0f9ff' : 'white', fontWeight: '600' }}
                            value={editOdcTarget.datos_bancarios || editOdcTarget.cuenta_bancaria || ''}
                            onChange={(e) => setEditOdcTarget(prev => ({ ...prev, datos_bancarios: e.target.value, cuenta_bancaria: e.target.value }))}
                          >
                            <option value="">-- Seleccionar Cuenta Bancaria de Pago --</option>
                            {ctasProv.map((c, idx) => {
                              const label = `${c.banco || 'Banco'} (${c.moneda || 'USD'}) - N° Cuenta: ${c.nro_cuenta || 'N/A'} - Titular: ${c.titular || 'N/A'} (${c.rif || 'N/A'}) ${c.tipo_cuenta ? `[${c.tipo_cuenta}]` : ''}`;
                              return <option key={idx} value={label}>{label}</option>;
                            })}
                            {ctasProv.length === 0 && (
                              <option value="" disabled>Sin cuentas de banco guardadas</option>
                            )}
                          </select>
                        </div>
                      );
                    })()}

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                        Razón Social / Nombre Proveedor *
                      </label>
                      <input
                        type="text"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                        value={editOdcTarget.proveedor_nombre || ''}
                        onChange={(e) => setEditOdcTarget(prev => ({ ...prev, proveedor_nombre: e.target.value }))}
                        placeholder="Nombre o Razón Social"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                        RIF Proveedor
                      </label>
                      <input
                        type="text"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                        value={editOdcTarget.proveedor_rif || ''}
                        onChange={(e) => setEditOdcTarget(prev => ({ ...prev, proveedor_rif: e.target.value }))}
                        placeholder="J-12345678-0"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                        Persona de Contacto
                      </label>
                      <input
                        type="text"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                        value={editOdcTarget.proveedor_contacto || ''}
                        onChange={(e) => setEditOdcTarget(prev => ({ ...prev, proveedor_contacto: e.target.value }))}
                        placeholder="Persona de Contacto"
                      />
                    </div>

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

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                        Fecha de Despacho Estimada
                      </label>
                      <input
                        type="date"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                        value={editOdcTarget.fecha_despacho || ''}
                        onChange={(e) => setEditOdcTarget(prev => ({ ...prev, fecha_despacho: e.target.value }))}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                        Destino a Obra / Dirección de Despacho
                      </label>
                      <input
                        type="text"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                        value={editOdcTarget.destino_despacho || ''}
                        onChange={(e) => setEditOdcTarget(prev => ({ ...prev, destino_despacho: e.target.value }))}
                        placeholder="Lugar de entrega / Galpones"
                      />
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
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                        Moneda de Facturación
                      </label>
                      <select
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', backgroundColor: 'white' }}
                        value={['USD', 'BS', 'EUR'].includes(editOdcTarget.moneda) ? editOdcTarget.moneda : 'OTRA'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'OTRA') {
                            setEditOdcTarget(prev => ({ ...prev, moneda: 'OTRA', moneda_custom: prev.moneda_custom || '' }));
                          } else {
                            setEditOdcTarget(prev => ({ ...prev, moneda: val, tasa_cambio: val === 'USD' ? 1 : prev.tasa_cambio }));
                          }
                        }}
                      >
                        <option value="USD">💵 Dólares ($ / USD)</option>
                        <option value="BS">🇻🇪 Bolívares (Bs / VES)</option>
                        <option value="EUR">💶 Euros (€ / EUR)</option>
                        <option value="OTRA">➕ Nuevo / Otra moneda...</option>
                      </select>
                    </div>

                    {(!['USD', 'BS', 'EUR'].includes(editOdcTarget.moneda) || editOdcTarget.moneda === 'OTRA') && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#0369a1', marginBottom: '4px' }}>
                          Especifique Moneda Personalizada *
                        </label>
                        <input
                          type="text"
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #0284c7', fontSize: '0.82rem', textTransform: 'uppercase' }}
                          value={editOdcTarget.moneda_custom !== undefined ? editOdcTarget.moneda_custom : (['USD', 'BS', 'EUR'].includes(editOdcTarget.moneda) ? '' : editOdcTarget.moneda)}
                          onChange={(e) => {
                            const customVal = e.target.value.toUpperCase();
                            setEditOdcTarget(prev => ({ ...prev, moneda_custom: customVal, moneda: customVal || 'OTRA' }));
                          }}
                          placeholder="Ej: COP, BRL, MXN"
                        />
                      </div>
                    )}

                    {editOdcTarget.moneda !== 'USD' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#b45309', marginBottom: '4px' }}>
                          {editOdcTarget.moneda === 'BS' ? 'Tasa BCV (Bs/$)' : `Tasa Cambio (${editOdcTarget.moneda || 'MONEDA'}/$)`}
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #f59e0b', fontSize: '0.82rem', backgroundColor: '#fffbeb', fontWeight: '700' }}
                          value={editOdcTarget.tasa_cambio || 1}
                          onChange={(e) => setEditOdcTarget(prev => ({ ...prev, tasa_cambio: e.target.value }))}
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

                {/* Sección 3: Tabla de Renglones / Ítems de la ODC */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={16} color="#0ea5e9" /> Renglones de Productos / Servicios ({editItems.length})
                    </h4>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!sourceReqSelected && editOdcTarget?.requisicion_id) {
                            const match = (requisicionesList || []).find(r => 
                              String(r.id) === String(editOdcTarget.requisicion_id) || 
                              (r.correlativo_req && String(r.correlativo_req).trim().toUpperCase() === String(editOdcTarget.requisicion_id).trim().toUpperCase())
                            );
                            if (match) setSourceReqSelected(match);
                          }
                          setShowReqItemsPicker(true);
                        }}
                        style={{ padding: '6px 14px', fontSize: '0.75rem', fontWeight: '800', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)' }}
                        title="Importar productos de la Requisición de Origen"
                      >
                        📋 Importar Renglones de Requisición
                      </button>
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '12px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#0f172a', color: 'white', textAlign: 'left' }}>
                          <th style={{ padding: '10px', width: '5%', textAlign: 'center' }}>#</th>
                          <th style={{ padding: '10px', width: '45%' }}>Descripción / Especificación Técnica</th>
                          <th style={{ padding: '10px', width: '12%', textAlign: 'center' }}>Unidad</th>
                          <th style={{ padding: '10px', width: '12%', textAlign: 'right' }}>Cantidad</th>
                          <th style={{ padding: '10px', width: '14%', textAlign: 'right' }}>P. Unit ($)</th>
                          <th style={{ padding: '10px', width: '14%', textAlign: 'right' }}>Total ($)</th>
                          <th style={{ padding: '10px', width: '6%', textAlign: 'center' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {editItems.map((it, idx) => (
                          <tr key={it.id || idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '700', color: '#64748b' }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <input
                                type="text"
                                style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                                value={it.descripcion || ''}
                                onChange={(e) => actualizarItemEdicion(idx, 'descripcion', e.target.value)}
                                placeholder="Nombre o especificación del ítem"
                              />
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <input
                                type="text"
                                style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', textAlign: 'center' }}
                                value={it.unidad || 'UNID'}
                                onChange={(e) => actualizarItemEdicion(idx, 'unidad', e.target.value)}
                              />
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', textAlign: 'right', fontWeight: '700' }}
                                value={it.cantidad}
                                onChange={(e) => actualizarItemEdicion(idx, 'cantidad', e.target.value)}
                              />
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', textAlign: 'right' }}
                                value={it.precio_unitario}
                                onChange={(e) => actualizarItemEdicion(idx, 'precio_unitario', e.target.value)}
                              />
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                              $ {Number(it.total_fila || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => eliminarItemEdicion(idx)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                title="Eliminar renglón"
                              >
                                <Trash2 size={16} />
                              </button>
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
                        <strong>$ {subtotalEdit.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#475569' }}>
                        <span>IVA ({porcentajeIvaEdit}%):</span>
                        <span>$ {montoIvaEdit.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', paddingTop: '6px', fontSize: '0.95rem', fontWeight: '900', color: '#0f172a' }}>
                        <span>TOTAL GENERAL:</span>
                        <span style={{ color: '#0284c7' }}>$ {totalGeneralEdit.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                </div>

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

    </div>
  );
};

export default OrdenesCompra;
