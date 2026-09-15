import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  FileText, Search, Filter, Printer, Download, Eye, CheckCircle2, 
  Clock, AlertTriangle, XCircle, ShieldCheck, Plus, Calendar, DollarSign,
  Building2, Truck, CreditCard, User, ChevronRight, RefreshCw, Lock,
  Edit2, Trash2, Save
} from 'lucide-react';
import './OrdenesCompra.css';

const DIRECCION_FISCAL_OFICIAL = "AV 61 ENTRE CALLE 147 Y TAPÓN PARCELA CI-19 SECTOR I, LOCAL GALPÓN NRO 147-113, ZONA INDUSTRIAL DE MARACAIBO SUR.";

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
  const [requisicionesList, setRequisicionesList] = useState([]);
  const [sourceReqSelected, setSourceReqSelected] = useState(null);
  const [showReqItemsPicker, setShowReqItemsPicker] = useState(false);
  
  // Edición de Términos y Condiciones / Leyes
  const [editandoTerminos, setEditandoTerminos] = useState(false);
  const [textoTerminos, setTextoTerminos] = useState('');
  const [guardandoTerminos, setGuardandoTerminos] = useState(false);
  
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

      // 2. Cargar requisiciones de origen para vinculación directa
      let reqsData = [];
      let pageReq = 0;
      let keepReq = true;
      while (keepReq) {
        const { data: chunk } = await supabase
          .from('requisiciones')
          .select('id, correlativo_req, solicitante, gerencia, departamento, items')
          .range(pageReq * 1000, (pageReq + 1) * 1000 - 1);
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
        }
        if (r.correlativo_req) {
          reqMap[String(r.correlativo_req).trim()] = r;
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
        const reqObj = reqMap[String(o.requisicion_id)] || 
                       reqMap[String(o.numero_req)] || 
                       reqMap[String(o.correlativo_req)] || 
                       reqMap[String(o.requisicion_correlativo)];

        const nombreVal = (o.proveedor_nombre && o.proveedor_nombre !== 'N/A') 
          ? o.proveedor_nombre 
          : (prov?.razon_social || prov?.nombre || 'N/A');
        const rifVal = (o.proveedor_rif && o.proveedor_rif !== 'N/A') 
          ? o.proveedor_rif 
          : (prov?.rif || 'N/A');
        const contactoVal = o.proveedor_contacto || prov?.persona_contacto || prov?.contacto_nombre || 'N/A';
        const ciudadVal = o.proveedor_ciudad || prov?.ciudad || prov?.localizacion || 'N/A';
        const direccionVal = o.proveedor_direccion || prov?.direccion || 'N/A';

        const correlativoReq = reqObj?.correlativo_req || o.numero_req || o.correlativo_req || o.requisicion_correlativo || (o.requisicion_id && String(o.requisicion_id).startsWith('REQ-') ? o.requisicion_id : null);

        return {
          ...o,
          proveedor_nombre: nombreVal,
          proveedor_rif: rifVal,
          proveedor_contacto: contactoVal,
          proveedor_ciudad: ciudadVal,
          proveedor_direccion: direccionVal,
          fecha_despacho: o.fecha_despacho || o.fecha_emision || 'N/A',
          requisicion_correlativo: correlativoReq,
          requisicion_obj: reqObj || null
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
          .select('razon_social, rif, persona_contacto, contacto_nombre, ciudad, localizacion, direccion')
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
        }
      } catch (e) {
        console.error("Error al obtener datos del proveedor:", e);
      }
    }
    const defaultGlobalTerms = localStorage.getItem('odc_global_default_terms') || "Precios incluyen entrega en el sitio de destino especificado. Mercancía sujeta a inspección de calidad y conteo físico.";
    const terminosActuales = odcCompleta.terminos_condiciones || localStorage.getItem(`odc_terms_${odcCompleta.id}`) || defaultGlobalTerms;
    odcCompleta.terminos_condiciones = terminosActuales;

    setOdcSeleccionada(odcCompleta);
    setTextoTerminos(terminosActuales);
    setEditandoTerminos(false);
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

      // 2. Cargar lista de requisiciones aprobadas/activas para vincular o importar renglones
      const { data: reqs } = await supabase
        .from('requisiciones')
        .select('id, correlativo_req, solicitante, gerencia, departamento, items, created_at')
        .order('created_at', { ascending: false });
      setRequisicionesList(reqs || []);

      // Determinar requisición de origen vinculada
      let reqEncontrada = null;
      if (odc.requisicion_id) {
        reqEncontrada = (reqs || []).find(r => String(r.id) === String(odc.requisicion_id));
      }
      if (!reqEncontrada && odc.requisicion_correlativo) {
        reqEncontrada = (reqs || []).find(r => String(r.correlativo_req) === String(odc.requisicion_correlativo));
      }
      setSourceReqSelected(reqEncontrada || null);

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
        requisicion_id: odc.requisicion_id || (reqEncontrada ? reqEncontrada.id : ''),
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
      setEditOdcTarget(prev => ({
        ...prev,
        proveedor_id: p.id,
        proveedor_nombre: p.razon_social || p.nombre || '',
        proveedor_rif: p.rif || p.rif_nit || '',
        proveedor_contacto: p.persona_contacto || p.contacto_nombre || '',
        proveedor_ciudad: p.ciudad || p.localizacion || '',
        proveedor_direccion: p.direccion || ''
      }));
    } else {
      setEditOdcTarget(prev => ({ ...prev, proveedor_id: provId }));
    }
  };

  const manejarCambioRequisicionEdicion = (reqId) => {
    const reqObj = requisicionesList.find(r => String(r.id) === String(reqId));
    setSourceReqSelected(reqObj || null);
    setEditOdcTarget(prev => ({
      ...prev,
      requisicion_id: reqId || null
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

  const agregarItemDesdeRequisicion = (reqItem) => {
    const desc = reqItem.descripcion || reqItem.nombre || reqItem.item || '';
    const uni = reqItem.unidad || reqItem.uni || 'UNID';
    const cant = parseFloat(reqItem.cant_aprobada || reqItem.cantidad || reqItem.cant || 1);
    const pu = parseFloat(reqItem.pu_usd || reqItem.pu_bs || reqItem.precio || 0);

    setEditItems(prev => [
      ...prev,
      {
        id: `req_item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        requisicion_item_id: String(reqItem.id || Date.now()),
        item_numero: prev.length + 1,
        descripcion: desc,
        unidad: uni,
        cantidad: cant,
        precio_unitario: pu,
        total_fila: cant * pu,
        origen_req: sourceReqSelected?.correlativo_req || 'Requisición'
      }
    ]);

    toast.success(`Ítem "${desc}" agregado desde ${sourceReqSelected?.correlativo_req || 'Requisición de Origen'}`);
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

      const payloadOdc = {
        requisicion_id: editOdcTarget.requisicion_id || null,
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
        tasa_bcv: parseFloat(editOdcTarget.tasa_cambio) || 1,
        tasa_cambio: parseFloat(editOdcTarget.tasa_cambio) || 1,
        despachar_a_direccion: editOdcTarget.destino_despacho || null,
        destino_despacho: editOdcTarget.destino_despacho || null,
        terminos_condiciones: editOdcTarget.terminos_condiciones || null,
        subtotal: subtotalEdit,
        iva_porcentaje: porcentajeIvaEdit,
        porcentaje_iva: porcentajeIvaEdit,
        iva_monto: montoIvaEdit,
        total: totalGeneralEdit,
        total_general: totalGeneralEdit
      };

      // 1. Actualizar ordenes_compra
      const { error: errUpdate } = await supabase
        .from('ordenes_compra')
        .update(payloadOdc)
        .eq('id', editOdcTarget.id);

      if (errUpdate) throw errUpdate;

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

      // 4. Refrescar estado local
      const reqObjNuevo = (requisicionesList || []).find(r => String(r.id) === String(editOdcTarget.requisicion_id));
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
      const payload = {
        estatus_pago: 'ANULADA',
        status_pago: 'ANULADA',
        estatus_recepcion: 'ANULADA'
      };

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
      toast.success(`Órden de Compra ${odcTarget.numero_odc} ANULADA correctamente.`);
    } catch (err) {
      console.error("Error al anular ODC:", err);
      toast.error("Error al anular la Órden de Compra: " + err.message);
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

  // Generación de PDF Formato Oficial F-ADM-01-2
  const exportarPDF_F_ADM_01_2 = async () => {
    if (!odcSeleccionada) return;
    if (!esUsuarioCompras) {
      toast.error("Acceso restringido: Solo el personal de Compras puede exportar la ODC");
      return;
    }

    try {
      toast.loading("Generando documento oficial F-ADM-01-2...", { id: 'pdf-odc' });
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Encabezado Estilo Imagen 3 (Izquierda)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Orden de Compra", 14, 16);

      doc.setFontSize(12);
      doc.text(`No. ${odcSeleccionada.numero_odc ? odcSeleccionada.numero_odc.replace('ODC-2026-', '') : '000000'}`, 14, 22);

      // Logo y Datos Institucionales Total Clean (Derecha - Posicionamiento dinámico sin solapamiento)
      const logoImg = await cargarImagenLogo();
      let headerTextY = 22;
      let lineY = 37;

      if (logoImg) {
        const logoW = 38;
        const logoH = (logoImg.height / logoImg.width) * logoW;
        doc.addImage(logoImg, 'PNG', pageWidth - 14 - logoW, 5, logoW, logoH);
        headerTextY = Math.max(5 + logoH + 3, 21);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("RIF: J-30365668-7", pageWidth - 14, headerTextY, { align: 'right' });
      
      doc.setFont("helvetica", "italic");
      doc.setFontSize(6.2);
      doc.text("Dirección Fiscal: AV 61 ENTRE CALLE 147 Y TAPÓN PARCELA CI-19 SECTOR I,", pageWidth - 14, headerTextY + 3.8, { align: 'right' });
      doc.text("LOCAL GALPÓN NRO 147-113, ZONA INDUSTRIAL DE MARACAIBO SUR.", pageWidth - 14, headerTextY + 6.8, { align: 'right' });
      doc.text("Tel. 0261-7651143 - Fax. 0261-7652555 | Cel. 0414-6245550 / 0414-8101155", pageWidth - 14, headerTextY + 9.8, { align: 'right' });

      lineY = headerTextY + 12.5;

      // Línea divisora
      doc.setLineWidth(0.6);
      doc.setDrawColor(0);
      doc.line(14, lineY, pageWidth - 14, lineY);

      // Tabla 1: DATOS DEL PROVEEDOR (Sin líneas internas de división, con marco exterior y espaciado limpio)
      const rawDestino = odcSeleccionada.destino_despacho || odcSeleccionada.despachar_a_direccion || 'Galpones Riese - Av. Los Haticos';
      const destinoObraLimpio = rawDestino.replace(/\s*-\s*null/gi, '').replace(/null/gi, '').trim();

      const tablaProvHead = [[
        { content: 'DATOS DEL PROVEEDOR', colSpan: 2, styles: { halign: 'center', fontStyle: 'bolditalic', fillColor: [241, 245, 249], textColor: [0, 0, 0], fontSize: 9 } }
      ]];
      const tablaProvBody = [
        [`Nombre: ${odcSeleccionada.proveedor_nombre || 'N/A'}`, `Contacto: ${odcSeleccionada.proveedor_contacto || 'N/A'}`],
        [`Dirección: ${odcSeleccionada.proveedor_direccion || 'N/A'}`, `Nit: ${odcSeleccionada.proveedor_nit || odcSeleccionada.proveedor_rif || 'N/A'}`],
        [`Teléfono: ${odcSeleccionada.proveedor_telefono || 'N/A'}`, `País: ${odcSeleccionada.proveedor_pais || 'Venezuela'}`],
        [`Rif: ${odcSeleccionada.proveedor_rif || 'N/A'}`, `Fecha de Despacho: ${odcSeleccionada.fecha_despacho || odcSeleccionada.fecha_emision || 'N/A'}`],
        [`Ciudad: ${odcSeleccionada.proveedor_ciudad || 'N/A'}`, `Forma de Pago: ${odcSeleccionada.tipo_pago === 'CREDITO' ? `Divisas ${odcSeleccionada.moneda || 'USD'} (Crédito ${odcSeleccionada.dias_credito}d)` : `Divisas ${odcSeleccionada.moneda || 'USD'}`}`],
        [`Despachar a: Total Clean`, ``],
        [`Solicitado por: Total Clean C.A.`, ``],
        [`Destino a Obra: ${destinoObraLimpio}`, ``]
      ];

      autoTable(doc, {
        startY: lineY + 3,
        head: tablaProvHead,
        body: tablaProvBody,
        theme: 'plain',
        styles: { 
          fontSize: 8, 
          cellPadding: { top: 2.2, bottom: 2.2, left: 4, right: 4 }, 
          textColor: [0, 0, 0], 
          lineWidth: 0
        },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 86 }
        }
      });

      // Marco contenedor exterior sin divisiones internas
      const tablaProvEndY = doc.lastAutoTable.finalY;
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.rect(14, lineY + 3, pageWidth - 28, tablaProvEndY - (lineY + 3));
      doc.line(14, lineY + 11, pageWidth - 14, lineY + 11);

      // Tabla 2: Renglones / Ítems de la ODC
      const itemsHead = [["Item", "Descripción / Especificación Técnica", "Cantidad", "Unidad", "Precio Unit.", "Total ($)"]];
      const itemsBody = odcItems.map((it, idx) => [
        (idx + 1).toString(),
        it.descripcion || 'Sin descripción',
        Number(it.cantidad || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }),
        it.unidad || 'UNID',
        Number(it.precio_unitario || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }),
        Number(it.total_fila || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })
      ]);

      autoTable(doc, {
        startY: tablaProvEndY + 4,
        head: itemsHead,
        body: itemsBody,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3, textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] },
        headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', lineWidth: 0.1, lineColor: [0, 0, 0] },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          1: { cellWidth: 90 },
          2: { halign: 'right', cellWidth: 20 },
          3: { halign: 'center', cellWidth: 16 },
          4: { halign: 'right', cellWidth: 24 },
          5: { halign: 'right', cellWidth: 26 }
        }
      });

      let finalY = doc.lastAutoTable.finalY + 4;

      // Resumen de Totales y Términos Comerciales
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Términos & Condiciones Comerciales / Leyes:", 14, finalY + 4);
      doc.setFont("helvetica", "normal");
      const splitTerms = doc.splitTextToSize(odcSeleccionada.terminos_condiciones || "Precios incluyen entrega en el sitio de destino especificado. Mercancía sujeta a inspección de calidad y conteo físico.", 110);
      doc.text(splitTerms, 14, finalY + 8);

      // Tabla de Cuadro de Totales (A la derecha)
      const subtotal = Number(odcSeleccionada.subtotal || 0);
      const percentageIva = Number(odcSeleccionada.porcentaje_iva || 16);
      const montoIva = subtotal * (percentageIva / 100);
      const totalGeneral = Number(odcSeleccionada.total_general || subtotal + montoIva);

      doc.rect(pageWidth - 75, finalY, 61, 24);
      doc.setFont("helvetica", "normal");
      doc.text("Sub-Total:", pageWidth - 72, finalY + 6);
      doc.text(`$ ${subtotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`, pageWidth - 16, finalY + 6, { align: 'right' });

      doc.text(`IVA (${percentageIva}%):`, pageWidth - 72, finalY + 12);
      doc.text(`$ ${montoIva.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`, pageWidth - 16, finalY + 12, { align: 'right' });

      doc.setFont("helvetica", "bold");
      doc.text("TOTAL GENERAL:", pageWidth - 72, finalY + 19);
      doc.text(`$ ${totalGeneral.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`, pageWidth - 16, finalY + 19, { align: 'right' });

      // Bloque de Firmas (Anclado al Pie de Página)
      const cardWidth = (pageWidth - 28 - 16) / 3;
      const cardHeight = 32;
      const bottomFooterMargin = 12;
      let sigY = pageHeight - bottomFooterMargin - cardHeight;

      // Si el cuadro de totales o términos colisiona con el pie de página
      if (finalY + 26 > sigY) {
        doc.addPage();
        sigY = pageHeight - bottomFooterMargin - cardHeight;
      }

      // Helper para renderizar recuadros de firma estilo Imagen 1
      const drawSigCard = (xPos, title, name, role, isSigned, dateStr) => {
        doc.setDrawColor(0);
        doc.setLineWidth(0.3);
        doc.roundedRect(xPos, sigY, cardWidth, cardHeight, 2, 2);

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(title, xPos + cardWidth / 2, sigY + 5, { align: 'center' });

        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.line(xPos + 4, sigY + 7, xPos + cardWidth - 4, sigY + 7);

        if (isSigned) {
          doc.setFillColor(240, 253, 244);
          doc.setDrawColor(22, 101, 52);
          doc.setLineWidth(0.3);
          doc.roundedRect(xPos + 4, sigY + 9, cardWidth - 8, 20, 1.5, 1.5, 'FD');

          doc.setFontSize(7.2);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(4, 120, 87);
          doc.text("✓ FIRMADO Y APROBADO", xPos + cardWidth / 2, sigY + 14, { align: 'center' });

          doc.setFontSize(6.8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(15, 118, 110);
          doc.text(`${name} (${role})`, xPos + cardWidth / 2, sigY + 19, { align: 'center' });

          doc.setFontSize(5.8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(21, 128, 61);
          doc.text(dateStr, xPos + cardWidth / 2, sigY + 24, { align: 'center' });
        } else {
          doc.setDrawColor(0);
          doc.setLineWidth(0.2);
          doc.line(xPos + 6, sigY + 20, xPos + cardWidth - 6, sigY + 20);

          doc.setFontSize(7.2);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0);
          doc.text(name, xPos + cardWidth / 2, sigY + 25, { align: 'center' });
          doc.setFontSize(6);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100);
          doc.text(`(${role})`, xPos + cardWidth / 2, sigY + 29, { align: 'center' });
        }
        doc.setTextColor(0);
      };

      // 1. Elaborado Por (Comprador - Firma Escrita)
      const compradorNombre = odcSeleccionada.comprador_nombre || currentUser?.nombre || 'Comprador Gestor';
      drawSigCard(14, "ELABORADO POR", compradorNombre, "Departamento de Compras", false, "");

      // 2. Revisado y Avalado Por (Ricardo Herrera - Firma Escrita)
      const gerenteComprasNombre = odcSeleccionada.gerente_compras_nombre || "Ricardo Herrera";
      drawSigCard(14 + cardWidth + 8, "REVISADO Y AVALADO POR", gerenteComprasNombre, "Gerente de Compras", false, "");

      // 3. Aprobado Por (Carlos Vega - Gerente General)
      const fCarlosStr = odcSeleccionada.carlos_firma_fecha 
        ? new Date(odcSeleccionada.carlos_firma_fecha).toLocaleString('es-ES') 
        : new Date().toLocaleString('es-ES');
      drawSigCard(14 + (cardWidth + 8) * 2, "APROBADO POR", "Carlos Vega", "Gerencia General", Boolean(odcSeleccionada.carlos_firma_digital_activa), fCarlosStr);

      // Pie de Página
      doc.setFontSize(6.5);
      doc.setTextColor(100);
      doc.text("Copia Controlada - Documento Oficial de Procesamiento de Compras | TOTAL CLEAN C.A. Formato F-ADM-01-2", pageWidth / 2, pageHeight - 6, { align: 'center' });

      doc.save(`Orden_Compra_${odcSeleccionada.numero_odc || 'ODC'}.pdf`);
      toast.success("Documento F-ADM-01-2 generado con éxito", { id: 'pdf-odc' });
    } catch (err) {
      console.error("Error al exportar PDF de ODC:", err);
      toast.error("Error al generar PDF de la ODC", { id: 'pdf-odc' });
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
      <div className="odc-header">
        <div className="odc-header-title">
          <FileText size={32} color="#38bdf8" />
          <div>
            <h1>Órdenes de Compra (ODC)</h1>
            <p>Ecosistema de Compras | Formato Institucional Oficial F-ADM-01-2</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button className="odc-tab-btn" onClick={cargarOrdenes} title="Actualizar lista">
            <RefreshCw size={16} /> Actualizar
          </button>
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
                    <td style={{ padding: '14px 16px', fontWeight: '800', color: '#0ea5e9' }}>
                      <button
                        type="button"
                        onClick={() => abrirDetalleOdc(odc)}
                        style={{ background: 'none', border: 'none', color: '#0ea5e9', fontWeight: '900', cursor: 'pointer', padding: 0, fontSize: '0.85rem', textDecoration: 'underline' }}
                        title="Ver expediente y vista previa de esta ODC"
                      >
                        {odc.numero_odc}
                      </button>
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: '600' }}>
                      {odc.proveedor_nombre || 'N/A'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {odc.requisicion_correlativo ? (
                        <span style={{ 
                          padding: '4px 10px', 
                          borderRadius: '12px', 
                          fontSize: '0.78rem', 
                          fontWeight: '800',
                          backgroundColor: '#e0f2fe', 
                          color: '#0369a1', 
                          border: '1px solid #bae6fd',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          📋 {odc.requisicion_correlativo}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontStyle: 'italic' }}>
                          Sin Requisición
                        </span>
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
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                        <button 
                          className="btn-primary" 
                          style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          onClick={() => abrirDetalleOdc(odc)}
                        >
                          <Eye size={14} /> Ver F-ADM-01-2
                        </button>
                        {esUsuarioCompras && (
                          <button
                            type="button"
                            onClick={() => abrirModalEditarOdc(odc)}
                            style={{ 
                              padding: '6px 10px', 
                              fontSize: '0.75rem', 
                              fontWeight: '700', 
                              borderRadius: '8px', 
                              border: '1px solid #cbd5e1', 
                              backgroundColor: '#f8fafc', 
                              color: '#0284c7', 
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title="Editar ODC (proveedor, precios, renglones, destino)"
                          >
                            <Edit2 size={13} /> Editar
                          </button>
                        )}
                        {esUsuarioCompras && odc.estatus_pago !== 'ANULADA' && (
                          <button
                            type="button"
                            onClick={() => manejarAnularOdc(odc)}
                            style={{ 
                              padding: '6px 10px', 
                              fontSize: '0.75rem', 
                              fontWeight: '700', 
                              borderRadius: '8px', 
                              border: '1px solid #fca5a5', 
                              backgroundColor: '#fef2f2', 
                              color: '#dc2626', 
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title="Anular esta Órden de Compra"
                          >
                            <XCircle size={13} /> Anular
                          </button>
                        )}
                        {esAdminSuper && (
                          <button
                            type="button"
                            onClick={() => manejarEliminarOdc(odc)}
                            style={{ 
                              padding: '6px 10px', 
                              fontSize: '0.75rem', 
                              fontWeight: '700', 
                              borderRadius: '8px', 
                              border: 'none', 
                              backgroundColor: '#7f1d1d', 
                              color: 'white', 
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title="Eliminar permanentemente esta Órden de Compra"
                          >
                            <Trash2 size={13} /> Eliminar
                          </button>
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
                <h2 style={{ margin: '2px 0 0 0', fontSize: '1.4rem', fontWeight: '800' }}>{odcSeleccionada.numero_odc}</h2>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {esUsuarioCompras && (
                  <button
                    type="button"
                    onClick={() => abrirModalEditarOdc(odcSeleccionada)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      borderRadius: '8px',
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
                    <Edit2 size={14} /> ✏️ Editar ODC
                  </button>
                )}

                {esUsuarioCompras && (
                  <button
                    type="button"
                    onClick={() => cambiarEstatusRecepcion(odcSeleccionada.estatus_recepcion === 'RECIBIDO' ? 'PENDIENTE' : 'RECIBIDO')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: odcSeleccionada.estatus_recepcion === 'RECIBIDO' ? '#dcfce7' : '#fef3c7',
                      color: odcSeleccionada.estatus_recepcion === 'RECIBIDO' ? '#15803d' : '#b45309'
                    }}
                    title="Marca si la mercancía ya fue recibida en almacén para iniciar la cuenta regresiva del crédito"
                  >
                    {odcSeleccionada.estatus_recepcion === 'RECIBIDO' ? '📦 RECIBIDO' : '🚚 MARCAR RECIBIDO'}
                  </button>
                )}

                {esUsuarioCompras && (
                  <select
                    style={{ padding: '6px 10px', fontSize: '0.75rem', fontWeight: '800', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer', backgroundColor: '#f8fafc' }}
                    value={odcSeleccionada.estatus_pago || 'PENDIENTE'}
                    onChange={(e) => {
                      if (e.target.value === 'ANULADA') {
                        manejarAnularOdc(odcSeleccionada);
                      } else {
                        cambiarEstatusPago(e.target.value);
                      }
                    }}
                    title="Actualizar estatus de pago de la ODC"
                  >
                    <option value="PENDIENTE">⏳ PENDIENTE</option>
                    <option value="PAGADO">✅ PAGADO</option>
                    <option value="VENCIDO">🔴 VENCIDO</option>
                    <option value="ANULADA">🚫 ANULADA</option>
                  </select>
                )}
                {esAdminSuper && (
                  <button
                    type="button"
                    onClick={() => manejarEliminarOdc(odcSeleccionada)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#991b1b',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title="Eliminar permanentemente esta Órden de Compra"
                  >
                    <Trash2 size={14} /> Eliminar ODC
                  </button>
                )}

                {/* CONTROL RBAC DE IMPRESIÓN EXCLUSIVO PARA COMPRAS / ADMINS */}
                {esUsuarioCompras ? (
                  <button 
                    className="btn-primary" 
                    style={{ backgroundColor: '#0284c7', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '12px' }}
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

            {/* HOJA IMPRIMIBLE F-ADM-01-2 */}
            <div ref={printRef} className="f-adm-01-2-sheet f-adm-sheet-printable">
              
              {/* Header Imprimible - Estilo Imagen 3 */}
              <div className="f-adm-header-img3">
                <div className="f-adm-header-left">
                  <h1 className="f-adm-title">Orden de Compra</h1>
                  <div className="f-adm-no">
                    No. {odcSeleccionada.numero_odc ? odcSeleccionada.numero_odc.replace('ODC-2026-', '') : '000000'}
                  </div>
                </div>

                <div className="f-adm-header-right">
                  <img src="/logo.png" alt="TOTAL CLEAN" className="f-adm-logo-img3" onError={(e) => { e.target.style.display = 'none'; }} />
                  <div className="f-adm-rif-img3">J-30365668-7</div>
                  <div className="f-adm-company-details-img3">
                    <strong>Dirección Fiscal:</strong> {DIRECCION_FISCAL_OFICIAL}<br/>
                    Tel. 0261-7651143 - Fax. 0261-7652555 | Cel. 0414-6245550 / 0414-8101155
                  </div>
                </div>
              </div>

              <hr className="f-adm-divider" />

              {/* Sección DATOS DEL PROVEEDOR (Estilo Referencia Imagen) */}
              <div className="f-adm-section-header-datos-prov">
                DATOS DEL PROVEEDOR
              </div>
              <table className="f-adm-table-datos-prov">
                <tbody>
                  <tr>
                    <td style={{ width: '55%', padding: '10px 14px', lineHeight: '1.6' }}>
                      <div style={{ marginBottom: '4px' }}><strong>Nombre:</strong> {odcSeleccionada.proveedor_nombre || 'N/A'}</div>
                      <div style={{ marginBottom: '4px' }}><strong>Dirección:</strong> {odcSeleccionada.proveedor_direccion || 'N/A'}</div>
                      <div style={{ marginBottom: '4px' }}><strong>Teléfono:</strong> {odcSeleccionada.proveedor_telefono || 'N/A'}</div>
                      <div style={{ marginBottom: '4px' }}><strong>Rif:</strong> {odcSeleccionada.proveedor_rif || 'N/A'}</div>
                      <div style={{ marginBottom: '4px' }}><strong>Ciudad:</strong> {odcSeleccionada.proveedor_ciudad || 'N/A'}</div>
                      <div style={{ marginBottom: '4px' }}><strong>Despachar a:</strong> Total Clean</div>
                      <div style={{ marginBottom: '4px' }}><strong>Solicitado por:</strong> Total Clean C.A.</div>
                      <div><strong>Destino a Obra:</strong> {(odcSeleccionada.destino_despacho || odcSeleccionada.despachar_a_direccion || 'Galpones Riese - Av. Los Haticos').replace(/\s*-\s*null/gi, '').replace(/null/gi, '').trim()}</div>
                    </td>
                    <td style={{ width: '45%', padding: '10px 14px', lineHeight: '1.6' }}>
                      <div style={{ marginBottom: '4px' }}><strong>Contacto:</strong> {odcSeleccionada.proveedor_contacto || 'N/A'}</div>
                      <div style={{ marginBottom: '4px' }}><strong>Nit:</strong> {odcSeleccionada.proveedor_nit || odcSeleccionada.proveedor_rif || 'N/A'}</div>
                      <div style={{ marginBottom: '4px' }}><strong>País:</strong> {odcSeleccionada.proveedor_pais || 'Venezuela'}</div>
                      <div style={{ marginBottom: '8px' }}><strong>Fecha de Despacho:</strong> {odcSeleccionada.fecha_despacho || odcSeleccionada.fecha_emision || 'N/A'}</div>
                      <div><strong>Forma de Pago:</strong> {odcSeleccionada.tipo_pago === 'CREDITO' ? `Divisas ${odcSeleccionada.moneda || 'USD'} (Crédito ${odcSeleccionada.dias_credito}d)` : `Divisas ${odcSeleccionada.moneda || 'USD'}`}</div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Tabla 2: Renglones de Productos */}
              <table className="f-adm-table">
                <thead>
                  <tr>
                    <th style={{ width: '6%', textStyle: 'center' }}>Item</th>
                    <th style={{ width: '50%' }}>Descripción / Especificación Técnica</th>
                    <th style={{ width: '12%', textAlign: 'right' }}>Cantidad</th>
                    <th style={{ width: '10%', textAlign: 'center' }}>Unidad</th>
                    <th style={{ width: '11%', textAlign: 'right' }}>P. Unit ($)</th>
                    <th style={{ width: '11%', textAlign: 'right' }}>Total ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingItems ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Cargando renglones...</td>
                    </tr>
                  ) : odcItems.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                      <td>{it.descripcion}</td>
                      <td style={{ textAlign: 'right' }}>{Number(it.cantidad || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'center' }}>{it.unidad || 'UNID'}</td>
                      <td style={{ textAlign: 'right' }}>$ {Number(it.precio_unitario || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>$ {Number(it.total_fila || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totales y Términos */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginTop: '10px' }}>
                <div style={{ flex: 1, fontSize: '0.75rem', lineHeight: '1.4' }}>
                  <strong>Términos & Condiciones Comerciales / Leyes:</strong>
                  <p style={{ margin: '4px 0 0 0', color: '#334155' }}>
                    {odcSeleccionada.terminos_condiciones || "Los precios indicados en esta órden de compra son firmes e incluyen entrega en el sitio de despacho. Mercancía sujeta a revisión física y de calidad."}
                  </p>
                </div>
                <div style={{ width: '240px', border: '1px solid #000', padding: '8px 12px', fontSize: '0.8rem', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Sub-Total:</span>
                    <strong>$ {Number(odcSeleccionada.subtotal || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>IVA ({odcSeleccionada.porcentaje_iva || 16}%):</span>
                    <span>$ {(Number(odcSeleccionada.subtotal || 0) * ((odcSeleccionada.porcentaje_iva || 16) / 100)).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #000', paddingTop: '4px', fontSize: '0.85rem' }}>
                    <strong>TOTAL GENERAL:</strong>
                    <strong style={{ color: '#000' }}>$ {Number(odcSeleccionada.total_general || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>
              </div>

              {/* Matriz de Firmas 3-Vías F-ADM-01-2 (Estilo Imagen 1) */}
              <div className="f-adm-signatures-container">
                
                {/* 1. Comprador Gestor (Firma Manuscrita Escrita) */}
                <div className="f-adm-signature-box-img1">
                  <div className="f-adm-signature-title-img1">Elaborado Por</div>
                  <div style={{ height: '55px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '80%', borderBottom: '1px solid #000', marginTop: '15px' }}></div>
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', marginTop: '4px' }}>{odcSeleccionada.comprador_nombre || currentUser?.nombre || 'Comprador Gestor'}</span>
                    <span style={{ fontSize: '0.6rem', color: '#64748b' }}>(Departamento de Compras)</span>
                  </div>
                </div>

                {/* 2. Ricardo Herrera - Gerente de Compras (Firma Manuscrita Escrita) */}
                <div className="f-adm-signature-box-img1">
                  <div className="f-adm-signature-title-img1">Revisado y Avalado Por</div>
                  <div style={{ height: '55px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '80%', borderBottom: '1px solid #000', marginTop: '15px' }}></div>
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', marginTop: '4px' }}>{odcSeleccionada.gerente_compras_nombre || 'Ricardo Herrera'}</span>
                    <span style={{ fontSize: '0.6rem', color: '#64748b' }}>(Gerente de Compras)</span>
                  </div>
                </div>

                {/* 3. Carlos Vega - Gerente General */}
                <div className="f-adm-signature-box-img1">
                  <div className="f-adm-signature-title-img1">Aprobado Por</div>
                  {odcSeleccionada.carlos_firma_digital_activa ? (
                    <div className="f-adm-digital-seal-img1">
                      <div style={{ color: '#047857', fontWeight: '800', fontSize: '0.72rem' }}>✓ FIRMADO Y APROBADO</div>
                      <div style={{ color: '#0f766e', fontWeight: '700', fontSize: '0.68rem', marginTop: '2px' }}>
                        Carlos Vega (Gerencia General)
                      </div>
                      <div style={{ color: '#15803d', fontSize: '0.58rem', marginTop: '2px' }}>
                        {odcSeleccionada.carlos_firma_fecha ? new Date(odcSeleccionada.carlos_firma_fecha).toLocaleString('es-ES') : 'Firma Digital Registrada'}
                      </div>
                    </div>
                  ) : (
                    <div style={{ height: '55px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: '80%', borderBottom: '1px solid #000', marginTop: '15px' }}></div>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', marginTop: '4px' }}>Carlos Vega</span>
                      <span style={{ fontSize: '0.6rem', color: '#64748b' }}>(Firma y Sello Manuscrito)</span>
                    </div>
                  )}
                </div>

              </div>

              {/* Pie de Documento */}
              <div style={{ textAlign: 'center', fontSize: '0.65rem', color: '#64748b', marginTop: '16px' }}>
                Formato Institucional F-ADM-01-2 | TOTAL CLEAN C.A. - Documento Oficial de Procesamiento de Compras
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
                      <select
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #0284c7', fontSize: '0.82rem', backgroundColor: '#f0f9ff', fontWeight: '700', color: '#0369a1' }}
                        value={editOdcTarget.requisicion_id || ''}
                        onChange={(e) => manejarCambioRequisicionEdicion(e.target.value)}
                      >
                        <option value="">-- Sin Requisición Vinculada --</option>
                        {requisicionesList.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.correlativo_req} - {r.solicitante || 'Sin solicitante'} ({r.gerencia || r.departamento || 'General'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                        Seleccionar Proveedor
                      </label>
                      <select
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', backgroundColor: 'white' }}
                        value={editOdcTarget.proveedor_id || ''}
                        onChange={(e) => manejarCambioProveedorEdicion(e.target.value)}
                      >
                        <option value="">-- Proveedor Personalizado --</option>
                        {proveedoresList.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.razon_social || p.nombre} ({p.rif || 'Sin RIF'})
                          </option>
                        ))}
                      </select>
                    </div>

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
                        RIF / NIT Proveedor
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
                        onClick={() => setShowReqItemsPicker(true)}
                        style={{ padding: '6px 14px', fontSize: '0.75rem', fontWeight: '800', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)' }}
                        title="Seleccionar cualquier Requisición e importar sus productos directamente a la ODC"
                      >
                        📋 Importar de Requisición {sourceReqSelected ? `(${sourceReqSelected.correlativo_req})` : ''}
                      </button>
                      <button
                        type="button"
                        onClick={agregarItemEdicion}
                        style={{ padding: '6px 14px', fontSize: '0.75rem', fontWeight: '700', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Plus size={14} /> Renglón Manual
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

                {/* Sección 4: Leyes, Términos & Condiciones */}
                <div style={{ backgroundColor: '#f8fafc', padding: '18px 20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>
                    Leyes & Términos Comerciales Impresos en la ODC
                  </label>
                  <textarea
                    rows={3}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.8rem', resize: 'vertical' }}
                    value={editOdcTarget.terminos_condiciones || ''}
                    onChange={(e) => setEditOdcTarget(prev => ({ ...prev, terminos_condiciones: e.target.value }))}
                    placeholder="Términos y condiciones comerciales impresos..."
                  />
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

            {/* Selector desplegable de Requisiciones en la ventana modal */}
            <div style={{ marginBottom: '18px', backgroundColor: '#f0f9ff', padding: '14px 16px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#0369a1', marginBottom: '6px' }}>
                📌 Seleccionar Requisición de Origen:
              </label>
              <select
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #0284c7', fontSize: '0.85rem', fontWeight: '800', color: '#0369a1', backgroundColor: 'white' }}
                value={sourceReqSelected?.id || ''}
                onChange={(e) => manejarCambioRequisicionEdicion(e.target.value)}
              >
                <option value="">-- Seleccionar Requisición --</option>
                {requisicionesList.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.correlativo_req} — {r.solicitante || 'Sin solicitante'} ({r.gerencia || r.departamento || 'General'}) [{(r.items || []).length} ítems]
                  </option>
                ))}
              </select>
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
                      <th style={{ padding: '10px', width: '45%' }}>Descripción del Ítem</th>
                      <th style={{ padding: '10px', width: '12%', textAlign: 'center' }}>Unidad</th>
                      <th style={{ padding: '10px', width: '14%', textAlign: 'right' }}>Cant. Aprobada</th>
                      <th style={{ padding: '10px', width: '14%', textAlign: 'right' }}>P. Ref ($)</th>
                      <th style={{ padding: '10px', width: '10%', textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sourceReqSelected.items || []).map((reqIt, idx) => {
                      const desc = reqIt.descripcion || reqIt.nombre || reqIt.item || 'Sin descripción';
                      const cant = reqIt.cant_aprobada || reqIt.cantidad || reqIt.cant || 1;
                      const uni = reqIt.unidad || reqIt.uni || 'UNID';
                      const pu = reqIt.pu_usd || reqIt.pu_bs || reqIt.precio || 0;
                      return (
                        <tr key={reqIt.id || idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                          <td style={{ padding: '10px', textAlign: 'center', fontWeight: '700', color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ padding: '10px', fontWeight: '600', color: '#0f172a' }}>{desc}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>{uni}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', color: '#0ea5e9' }}>{cant}</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>$ {Number(pu).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => agregarItemDesdeRequisicion(reqIt)}
                              style={{ padding: '6px 12px', fontSize: '0.72rem', fontWeight: '800', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              + Agregar a ODC
                            </button>
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
