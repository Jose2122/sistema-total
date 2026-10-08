import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import { 
  Search, FileText, Loader2, FileSpreadsheet, Trash2, ShieldAlert, History, X, 
  DollarSign, ShoppingBag, Eye, CheckCircle2, Clock, AlertTriangle, Truck, 
  MapPin, Building, Calendar, User, ArrowRight, CornerDownRight, Check, Package
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import './ReportesMaestro.css';

// Helpers for modal detail view
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
        } catch {
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

const safeFormatDate = (dateVal) => {
  if (!dateVal) return '-';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '-';
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  } catch {
    return '-';
  }
};

const UBICACIONES_AUTORIZADAS = [
  "Almacén Maracaibo",
  "Almacén Campo Boscán",
  "Almacén Bajo Grande"
];

const cleanAccents = (str) => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

const Almacen = ({ currentUserProp = null }) => {
  const [currentUser, setCurrentUser] = useState(currentUserProp);
  const [comprasRaw, setComprasRaw] = useState([]);
  const [ordenesCompraList, setOrdenesCompraList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroAlmacen, setFiltroAlmacen] = useState('Todos'); // 'Todos', 'Si', 'No'
  const [filtroDestino, setFiltroDestino] = useState('Todos'); // 'Todos', 'Almacen Campo Boscan', 'Almacen Maracaibo', 'Almacen Bajo Grande'
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [vistaTab, setVistaTab] = useState('todos'); // 'todos', 'recibidos', 'pendientes'
  const [activeTab, setActiveTab] = useState('recepcion'); // 'recepcion' | 'historial' | 'entregados'
  const [filtroAnalista, setFiltroAnalista] = useState('Todos'); // filtro por quien hizo el ingreso en historial
  
  // Control de qué almacén se selecciona para cada compra antes de recibir
  const [selectedAlmacenes, setSelectedAlmacenes] = useState({}); // { [compraId]: 'Almacen ...' }
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Modal de Detalles de Requisición y Soportes (Visor Digital)
  const [modalTicketData, setModalTicketData] = useState(null); // { ticket, req }
  const [modalLoading, setModalLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  // Modal de Vista Previa Breve de Orden de Compra (ODC)
  const [showOdcModal, setShowOdcModal] = useState(false);
  const [odcModalData, setOdcModalData] = useState(null); // { odc, compra, req, items }
  const [loadingOdcModal, setLoadingOdcModal] = useState(false);
  const [ubicacionModalOdc, setUbicacionModalOdc] = useState('');

  // Modal de Recepción Física Parcial y Asignación de Almacén
  const [showModalRecibir, setShowModalRecibir] = useState(false);
  const [compraParaRecibir, setCompraParaRecibir] = useState(null);
  const [cantRecibirInput, setCantRecibirInput] = useState('');
  const [almacenRecibirInput, setAlmacenRecibirInput] = useState('');
  const [opcionRestante, setOpcionRestante] = useState('esperar'); // 'esperar' | 'cerrar_liberar'
  const [motivoCierreInput, setMotivoCierreInput] = useState('');
  const [guardandoRecepcion, setGuardandoRecepcion] = useState(false);

  useEffect(() => {
    if (currentUserProp) {
      setCurrentUser(currentUserProp);
    }
  }, [currentUserProp]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: perfil } = await supabase
            .from('perfiles')
            .select('*')
            .eq('id', user.id)
            .single();
          if (perfil) {
            setCurrentUser(prev => ({
              ...(prev || {}),
              ...perfil,
              correo: perfil.correo || user.email,
              email: perfil.email || user.email
            }));
          }
        }
      } catch (err) {
        console.error("Error cargando perfil del usuario:", err);
      }
    };
    if (!currentUserProp) {
      fetchUser();
    }
  }, [currentUserProp]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const formatFechaHora = (fechaStr) => {
    if (!fechaStr) return '—';
    try {
      const d = new Date(fechaStr);
      if (isNaN(d.getTime())) return '—';
      const pad = (n) => String(n).padStart(2, '0');
      
      const dia = pad(d.getDate());
      const mes = pad(d.getMonth() + 1);
      const anio = d.getFullYear();
      
      let horas = d.getHours();
      const minutos = pad(d.getMinutes());
      const ampm = horas >= 12 ? 'PM' : 'AM';
      horas = horas % 12;
      horas = horas ? horas : 12;
      const horaStr = pad(horas);
      
      return `${dia}/${mes}/${anio} ${horaStr}:${minutos} ${ampm}`;
    } catch {
      return '—';
    }
  };

  // Carga integral de Requisiciones y Órdenes de Compra
  const cargarDatos = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // 1. Cargar TODAS las Requisiciones Aprobadas con Ítems (Paginado)
      let reqs = [];
      let pageReq = 0;
      let keepReq = true;
      while (keepReq) {
        const { data: chunk, error: errReq } = await supabase
          .from('requisiciones')
          .select('*')
          .eq('estado_aprobacion', 'aprobado_final')
          .order('fecha_emision', { ascending: false })
          .range(pageReq * 1000, (pageReq + 1) * 1000 - 1);

        if (errReq) throw errReq;
        if (chunk && chunk.length > 0) {
          reqs = reqs.concat(chunk);
          if (chunk.length < 1000) keepReq = false;
          else pageReq++;
        } else {
          keepReq = false;
        }
      }

      // 2. Cargar Catálogo de Órdenes de Compra para Vinculación Directa (Paginado)
      let odcsData = [];
      let pageOdc = 0;
      let keepOdc = true;
      while (keepOdc) {
        try {
          const { data: chunk, error: odcErr } = await supabase
            .from('ordenes_compra')
            .select('*')
            .order('created_at', { ascending: false })
            .range(pageOdc * 1000, (pageOdc + 1) * 1000 - 1);
          
          if (!odcErr && chunk && chunk.length > 0) {
            odcsData = odcsData.concat(chunk);
            if (chunk.length < 1000) keepOdc = false;
            else pageOdc++;
          } else {
            keepOdc = false;
          }
        } catch (e) {
          console.warn("Consulta a ordenes_compra:", e.message);
          keepOdc = false;
        }
      }
      setOrdenesCompraList(odcsData);

      // Mapas de indexación para ODC
      const odcMapById = {};
      const odcMapByNum = {};
      const odcMapByReq = {};

      odcsData.forEach(o => {
        if (o.id) odcMapById[String(o.id)] = o;
        if (o.numero_orden) {
          const num = String(o.numero_orden).trim().toUpperCase();
          odcMapByNum[num] = o;
        }
        if (o.numero_odc) {
          const num = String(o.numero_odc).trim().toUpperCase();
          odcMapByNum[num] = o;
        }
        if (o.requisicion_id) {
          odcMapByReq[String(o.requisicion_id)] = o;
          odcMapByReq[`REQ-${o.requisicion_id}`] = o;
        }
        const reqRef = o.requisicion_correlativo || o.correlativo_req || o.numero_req || o.requisicion_id;
        if (reqRef) {
          const rKey = String(reqRef).trim().toUpperCase();
          odcMapByReq[rKey] = o;
          odcMapByReq[rKey.replace(/^REQ-?/i, '')] = o;
        }
      });

      // 3. Mapear compras y vinculación ODC / Requisición
      let list = [];
      (reqs || []).forEach(r => {
        const items = Array.isArray(r.items) ? r.items : [];
        const totalItemsReq = items.length;
        
        // Calcular estado de completitud de la requisición (cuántos ítems faltan, deduciendo entregados y no aplica)
        const noAplicaReqCount = items.filter(it => it.estatus_almacen === 'no_aplica' || it.pasa_por_almacen === false).length;
        const entregadosReqCount = items.filter(it => it.estatus_almacen === 'entregado' || it.is_entregado === true).length;
        const ubicadosReqCount = items.filter(it => it.estatus_almacen === 'Ubicado' || it.estatus_almacen === 'asignado' || it.enviado_almacen === true).length;
        const faltantesReqCount = Math.max(0, totalItemsReq - entregadosReqCount - noAplicaReqCount);

        const reqCorrelativoStr = r.correlativo_req || `REQ-${String(r.id).padStart(3, '0')}`;
        const odcMatchReq = odcMapByReq[String(r.id)] || 
                            odcMapByReq[reqCorrelativoStr.toUpperCase()] || 
                            odcMapByReq[String(r.correlativo_req || '').toUpperCase()];

        items.forEach((it, itIdx) => {
          const historial = Array.isArray(it.historial_compras) ? it.historial_compras : [];
          const compras = historial.filter(h => h.tipo !== 'JUSTIFICACION' && h.tipo !== 'ANULACION' && h.tipo !== 'DIRECTRIZ');
          
          if (compras.length > 0) {
            // Formato multitransacción: cada transacción en el historial es una compra
            compras.forEach((h) => {
              const realHIdx = it.historial_compras.findIndex(itemH => itemH === h);
              
              // Resolver número de Orden de Compra asociada
              let odcNumero = null;
              let odcId = h.odc_id || null;
              let odcObj = null;

              if (h.odc_numero) {
                odcNumero = String(h.odc_numero).trim();
              } else if (h.doc_tipo === 'ODC' || (typeof h.doc_numero === 'string' && h.doc_numero.toUpperCase().startsWith('ODC'))) {
                odcNumero = String(h.doc_numero).trim();
              } else if (odcId && odcMapById[String(odcId)]) {
                odcObj = odcMapById[String(odcId)];
                odcNumero = odcObj.numero_orden || odcObj.numero_odc;
              } else if (odcMatchReq) {
                odcObj = odcMatchReq;
                odcNumero = odcObj.numero_orden || odcObj.numero_odc;
                odcId = odcObj.id;
              }

              if (odcNumero && !odcObj) {
                odcObj = odcMapByNum[odcNumero.toUpperCase()] || (odcId ? odcMapById[String(odcId)] : null);
              }

              const noPasaAlmacen = h.pasa_por_almacen === false || 
                                    h.estatus_almacen === 'no_aplica' || 
                                    it.pasa_por_almacen === false || 
                                    it.estatus_almacen === 'no_aplica' || 
                                    odcObj?.pasa_por_almacen === false;

              const statusAlmacen = noPasaAlmacen 
                ? 'no_aplica' 
                : (h.estatus_almacen || (h.enviado_almacen ? 'Ubicado' : 'Pendiente_Compras'));
              
              if (
                noPasaAlmacen ||
                statusAlmacen === 'Por_Clasificar_Almacen' || 
                statusAlmacen === 'pendiente_asignar' || 
                statusAlmacen === 'Ubicado' || 
                statusAlmacen === 'asignado' || 
                statusAlmacen === 'entregado'
              ) {
                list.push({
                  id: `${r.id}-${itIdx}-${realHIdx}`,
                  transaction_id: h.id || `${r.id}-${itIdx}-${realHIdx}`,
                  req_id: r.id,
                  correlativo: reqCorrelativoStr,
                  item_idx: itIdx,
                  history_idx: realHIdx,
                  is_legacy: false,
                  
                  // Vínculos y completitud
                  odc_numero: odcNumero || 'S/N',
                  odc_id: odcId,
                  odc_obj: odcObj || null,
                  req_total_items: totalItemsReq,
                  req_entregados_items: entregadosReqCount,
                  req_ubicados_items: ubicadosReqCount,
                  req_faltantes_items: faltantesReqCount,
                  req_no_aplica_items: noAplicaReqCount,
                  unidad: it.unidad || it.uni || 'UND',
                  
                  descripcion: it.descripcion || 'Sin descripción',
                  proveedor: h.proveedor_nombre || 'Desconocido',
                  numero_factura: h.doc_numero || 'S/N',
                  fecha_compra: h.fecha,
                  solicitante: r.solicitante || 'N/A',
                  gerencia: r.gerencia || 'No asignada',
                  centro_costo: r.centro_costo || 'N/A',
                  moneda_pago: h.metodo_pago || '$ / BS',
                  cantidad_comprada: parseFloat(h.cant) || 0,
                  precio_unitario: parseFloat(h.pu) || 0,
                  total: (parseFloat(h.cant) || 0) * (parseFloat(h.pu) || 0),
                  
                  pasa_por_almacen: !noPasaAlmacen,
                  is_entrega_directa: noPasaAlmacen,
                  recibido: !noPasaAlmacen && (statusAlmacen === 'Ubicado' || statusAlmacen === 'asignado'),
                  estatus_almacen: statusAlmacen,
                  is_pendiente: !noPasaAlmacen && (statusAlmacen === 'Por_Clasificar_Almacen' || statusAlmacen === 'pendiente_asignar'),
                  is_asignado: !noPasaAlmacen && (statusAlmacen === 'Ubicado' || statusAlmacen === 'asignado'),
                  is_entregado: statusAlmacen === 'entregado',
                  ubicacion_almacen: noPasaAlmacen
                    ? (h.ubicacion_almacen || (odcObj ? (odcObj.destino_despacho || odcObj.almacen_destino) : '') || 'ENTREGA DIRECTA (Sin paso por almacén)')
                    : (h.ubicacion_almacen || h.almacen_destino || it.ubicacion_almacen || (odcObj ? (odcObj.destino_despacho || odcObj.almacen_destino) : '') || ''),
                  fecha_entrada_almacen: h.fecha_entrada_almacen || it.fecha_entrada_almacen || '',
                  usuario_almacen_nombre: h.usuario_almacen_nombre || it.usuario_almacen_nombre || '',
                  fecha_salida_almacen: h.fecha_salida_almacen || it.fecha_salida_almacen || '',
                  usuario_salida_nombre: h.usuario_salida_nombre || it.usuario_salida_nombre || ''
                });
              }
            });
          } else if (it.doc_numero || it.numero_factura) {
            let odcNumero = null;
            let odcId = null;
            let odcObj = null;

            if (it.odc_numero) {
              odcNumero = String(it.odc_numero).trim();
            } else if (typeof it.doc_numero === 'string' && it.doc_numero.toUpperCase().startsWith('ODC')) {
              odcNumero = String(it.doc_numero).trim();
            } else if (odcMatchReq) {
              odcObj = odcMatchReq;
              odcNumero = odcObj.numero_orden || odcObj.numero_odc;
              odcId = odcObj.id;
            }

            if (odcNumero && !odcObj) {
              odcObj = odcMapByNum[odcNumero.toUpperCase()] || null;
            }

            const noPasaAlmacen = it.pasa_por_almacen === false || 
                                  it.estatus_almacen === 'no_aplica' || 
                                  odcObj?.pasa_por_almacen === false;

            const statusAlmacen = noPasaAlmacen 
              ? 'no_aplica' 
              : (it.estatus_almacen || (it.enviado_almacen ? 'Ubicado' : 'Pendiente_Compras'));

            if (
              noPasaAlmacen ||
              statusAlmacen === 'Por_Clasificar_Almacen' || 
              statusAlmacen === 'pendiente_asignar' || 
              statusAlmacen === 'Ubicado' || 
              statusAlmacen === 'asignado' || 
              statusAlmacen === 'entregado'
            ) {
              list.push({
                id: `${r.id}-${itIdx}-legacy`,
                transaction_id: `${r.id}-${itIdx}-legacy`,
                req_id: r.id,
                correlativo: reqCorrelativoStr,
                item_idx: itIdx,
                history_idx: -1,
                is_legacy: true,
                
                odc_numero: odcNumero || 'S/N',
                odc_id: odcId,
                odc_obj: odcObj || null,
                req_total_items: totalItemsReq,
                req_entregados_items: entregadosReqCount,
                req_ubicados_items: ubicadosReqCount,
                req_faltantes_items: faltantesReqCount,
                req_no_aplica_items: noAplicaReqCount,
                unidad: it.unidad || it.uni || 'UND',
                
                descripcion: it.descripcion || 'Sin descripción',
                proveedor: it.proveedor || 'Desconocido',
                numero_factura: it.doc_numero || it.numero_factura || 'S/N',
                fecha_compra: r.fecha_emision || r.created_at,
                solicitante: r.solicitante || 'N/A',
                gerencia: r.gerencia || 'No asignada',
                centro_costo: r.centro_costo || 'N/A',
                moneda_pago: it.metodo_pago || '$ / BS',
                cantidad_comprada: parseFloat(it.cantidad_comprada || it.cant) || 0,
                precio_unitario: parseFloat(it.pu) || 0,
                total: (parseFloat(it.cantidad_comprada || it.cant) || 0) * (parseFloat(it.pu) || 0),
                
                pasa_por_almacen: !noPasaAlmacen,
                is_entrega_directa: noPasaAlmacen,
                recibido: !noPasaAlmacen && (statusAlmacen === 'Ubicado' || statusAlmacen === 'asignado'),
                estatus_almacen: statusAlmacen,
                is_pendiente: !noPasaAlmacen && (statusAlmacen === 'Por_Clasificar_Almacen' || statusAlmacen === 'pendiente_asignar'),
                is_asignado: !noPasaAlmacen && (statusAlmacen === 'Ubicado' || statusAlmacen === 'asignado'),
                is_entregado: statusAlmacen === 'entregado',
                ubicacion_almacen: noPasaAlmacen
                  ? (it.ubicacion_almacen || (odcObj ? (odcObj.destino_despacho || odcObj.almacen_destino) : '') || 'ENTREGA DIRECTA (Sin paso por almacén)')
                  : (it.ubicacion_almacen || it.almacen_destino || (odcObj ? (odcObj.destino_despacho || odcObj.almacen_destino) : '') || ''),
                fecha_entrada_almacen: it.fecha_entrada_almacen || '',
                usuario_almacen_nombre: it.usuario_almacen_nombre || '',
                fecha_salida_almacen: it.fecha_salida_almacen || '',
                usuario_salida_nombre: it.usuario_salida_nombre || ''
              });
            }
          }
        });
      });

      setComprasRaw(list);
    } catch (err) {
      console.error("Error Almacen:", err);
      toast.error("Error al cargar compras: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();

    // SUSCRIPCIÓN REALTIME PARA ALMACÉN (Requisiciones y Órdenes de Compra)
    const channel = supabase
      .channel('almacen_realtime_stream')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'requisiciones'
      }, () => {
        cargarDatos(true);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ordenes_compra'
      }, () => {
        cargarDatos(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cargarDatos]);

  // Modal de Detalle de Requisición y Visor de Soportes
  const handleVerDetalleTicket = async (compra) => {
    setModalLoading(true);
    setShowModal(true);
    setSelectedFileIndex(0);
    try {
      const { data: tickets, error: ticketErr } = await supabase
        .from('tickets_directos')
        .select('*')
        .or(`solicitud_ref.eq.${compra.req_id},solicitud_ref.eq.${compra.correlativo}`)
        .limit(1);

      if (ticketErr) throw ticketErr;

      let ticket = null;
      if (tickets && tickets.length > 0) {
        ticket = tickets[0];
      } else {
        const { data: reqData } = await supabase
          .from('requisiciones')
          .select('*')
          .eq('id', compra.req_id)
          .single();

        ticket = {
          id: `mock-${compra.req_id}`,
          codigo_control: compra.correlativo,
          responsable_nombre: compra.solicitante,
          departamento: compra.gerencia,
          centro_costo: compra.centro_costo,
          status: compra.recibido ? 'COMPLETADA' : 'PENDIENTE',
          fecha_emision: compra.fecha_compra,
          fecha_pago: compra.fecha_entrada_almacen,
          items: reqData ? reqData.items : [{ descripcion: compra.descripcion, cant: compra.cantidad_comprada }],
          factura_url: reqData ? reqData.facturas_url : [],
          proveedor_nombre: compra.proveedor
        };
      }

      let req = null;
      if (ticket.solicitud_ref) {
        const { data: rData } = await supabase
          .from('requisiciones')
          .select('*')
          .or(`id.eq.${ticket.solicitud_ref},correlativo_req.eq.${ticket.solicitud_ref}`)
          .limit(1);
        if (rData && rData.length > 0) req = rData[0];
      } else {
        const { data: rData } = await supabase
          .from('requisiciones')
          .select('*')
          .eq('id', compra.req_id)
          .limit(1);
        if (rData && rData.length > 0) req = rData[0];
      }

      setModalTicketData({ ticket, req });
    } catch (err) {
      console.error('Error fetching ticket data for Almacen detail:', err);
      toast.error('Error al cargar detalles del ticket.');
      setShowModal(false);
    } finally {
      setModalLoading(false);
    }
  };

  // Modal de Vista Previa Breve de Orden de Compra (ODC)
  const handleVerDetalleOdc = async (compra) => {
    setLoadingOdcModal(true);
    setShowOdcModal(true);
    setUbicacionModalOdc(compra.ubicacion_almacen || selectedAlmacenes[compra.id] || UBICACIONES_AUTORIZADAS[0]);

    try {
      let odcData = compra.odc_obj;

      if (!odcData && compra.odc_id) {
        const { data } = await supabase
          .from('ordenes_compra')
          .select('*')
          .eq('id', compra.odc_id)
          .maybeSingle();
        if (data) odcData = data;
      }

      if (!odcData && compra.odc_numero && compra.odc_numero !== 'S/N') {
        const { data } = await supabase
          .from('ordenes_compra')
          .select('*')
          .or(`numero_orden.eq.${compra.odc_numero},numero_odc.eq.${compra.odc_numero}`)
          .limit(1);
        if (data && data.length > 0) odcData = data[0];
      }

      if (!odcData && compra.req_id) {
        const { data } = await supabase
          .from('ordenes_compra')
          .select('*')
          .or(`requisicion_id.eq.${compra.req_id},correlativo_req.eq.${compra.correlativo},requisicion_correlativo.eq.${compra.correlativo}`)
          .limit(1);
        if (data && data.length > 0) odcData = data[0];
      }

      // Cargar ítems de la ODC
      let odcItems = [];
      if (odcData && odcData.id) {
        const { data: itemsRes } = await supabase
          .from('ordenes_compra_items')
          .select('*')
          .eq('orden_compra_id', odcData.id)
          .order('item_numero', { ascending: true });
        if (itemsRes && itemsRes.length > 0) {
          odcItems = itemsRes;
        }
      }

      // Si no tiene renglones en tabla hija, obtener renglones de la requisición
      if (odcItems.length === 0) {
        const { data: reqData } = await supabase
          .from('requisiciones')
          .select('*')
          .eq('id', compra.req_id)
          .single();

        if (reqData && reqData.items) {
          odcItems = reqData.items.map((it, idx) => ({
            id: it.id || idx,
            item_numero: idx + 1,
            descripcion: it.descripcion,
            unidad: it.unidad || it.uni || 'UND',
            cantidad: it.cantidad_comprada || it.cant || 0,
            estatus_almacen: it.estatus_almacen || (it.enviado_almacen ? 'Ubicado' : 'Pendiente_Compras')
          }));
        }
      }

      // Proveedor info enriquecida
      let provInfo = null;
      if (odcData?.proveedor_id) {
        const { data: p } = await supabase
          .from('proveedores')
          .select('razon_social, rif, telefono, persona_contacto, direccion, ciudad')
          .eq('id', odcData.proveedor_id)
          .maybeSingle();
        if (p) provInfo = p;
      }

      setOdcModalData({
        odc: odcData || {
          numero_orden: compra.odc_numero || 'ODC-S/N',
          proveedor_nombre: compra.proveedor,
          fecha_emision: compra.fecha_compra,
          solicitante: compra.solicitante,
          departamento: compra.gerencia,
          destino_despacho: compra.ubicacion_almacen || 'Almacén Central',
          estado_aprobacion_precio: 'aprobado'
        },
        items: odcItems,
        compra,
        provInfo
      });
    } catch (err) {
      console.error("Error al cargar vista previa breve de ODC:", err);
      toast.error("Error al cargar detalles de la Orden de Compra");
    } finally {
      setLoadingOdcModal(false);
    }
  };

  // Abrir Modal de Recepción Física (permite recepción total o parcial con desglose)
  const abrirModalRecibir = (compra, defaultAlmacen = '') => {
    const sedeInicial = defaultAlmacen || selectedAlmacenes[compra.id] || compra.ubicacion_almacen || UBICACIONES_AUTORIZADAS[0];
    setCompraParaRecibir(compra);
    setCantRecibirInput(String(compra.cantidad_comprada || 1));
    setAlmacenRecibirInput(sedeInicial);
    setOpcionRestante('esperar');
    setMotivoCierreInput('');
    setShowModalRecibir(true);
  };

  // Función Principal de Ejecución de Recepción en Almacén (Total o Parcial)
  const ejecutarRecepcion = async () => {
    if (!compraParaRecibir) return;
    const cantRecibida = parseFloat(cantRecibirInput);
    const cantTotalCompra = parseFloat(compraParaRecibir.cantidad_comprada) || 0;

    if (isNaN(cantRecibida) || cantRecibida <= 0) {
      toast.error("Por favor ingrese una cantidad válida a recibir.");
      return;
    }

    if (cantRecibida > cantTotalCompra) {
      toast.error(`La cantidad a recibir no puede exceder la cantidad comprada (${cantTotalCompra} ${compraParaRecibir.unidad}).`);
      return;
    }

    if (!almacenRecibirInput) {
      toast.error("Por favor seleccione un almacén de destino.");
      return;
    }

    const esParcial = cantRecibida < cantTotalCompra;
    const cantRestante = Math.max(0, cantTotalCompra - cantRecibida);

    if (esParcial && opcionRestante === 'cerrar_liberar' && !motivoCierreInput.trim()) {
      toast.error("Por favor ingrese el motivo del cierre de orden y liberación de saldo a Compras.");
      return;
    }

    setGuardandoRecepcion(true);
    try {
      const { data: req, error: fetchErr } = await supabase
        .from('requisiciones')
        .select('id, items, correlativo_req')
        .eq('id', compraParaRecibir.req_id)
        .single();
      
      if (fetchErr) throw fetchErr;

      const items = [...(req.items || [])];
      const item = items[compraParaRecibir.item_idx];
      if (!item) throw new Error("Material no encontrado en la requisición.");

      const nowIso = new Date().toISOString();
      const userNombre = currentUser ? `${currentUser.nombre || ''} ${currentUser.apellido || ''}`.trim() || 'Personal de Almacén' : 'Personal de Almacén';
      const userId = currentUser ? currentUser.id : null;
      const destinoSel = almacenRecibirInput;

      if (compraParaRecibir.is_legacy) {
        if (!esParcial) {
          item.estatus_almacen = 'asignado';
          item.ubicacion_almacen = destinoSel;
          item.enviado_almacen = true;
          item.almacen_destino = destinoSel;
          item.fecha_entrada_almacen = nowIso;
          item.usuario_almacen_nombre = userNombre;
          item.usuario_almacen_id = userId;
        } else if (opcionRestante === 'cerrar_liberar') {
          const cantPedida = parseFloat(item.cantidad_pedida ?? item.cant) || 0;
          item.cantidad_comprada = cantRecibida;
          item.cantidad_pendiente = Math.max(0, cantPedida - cantRecibida);
          item.estado_item = item.cantidad_pendiente > 0 ? 'pendiente' : 'comprado';
          item.estatus_almacen = 'asignado';
          item.ubicacion_almacen = destinoSel;
          item.enviado_almacen = true;
          item.almacen_destino = destinoSel;
          item.fecha_entrada_almacen = nowIso;
          item.usuario_almacen_nombre = userNombre;
          item.usuario_almacen_id = userId;
        }
      } else {
        const hist = [...(item.historial_compras || [])];
        const hOriginal = hist[compraParaRecibir.history_idx];
        if (!hOriginal) throw new Error("Transacción de compra no encontrada en el historial.");

        if (!esParcial) {
          // Recepción Total
          hist[compraParaRecibir.history_idx] = {
            ...hOriginal,
            estatus_almacen: 'asignado',
            ubicacion_almacen: destinoSel,
            enviado_almacen: true,
            almacen_destino: destinoSel,
            fecha_entrada_almacen: nowIso,
            usuario_almacen_nombre: userNombre,
            usuario_almacen_id: userId
          };
        } else if (opcionRestante === 'esperar') {
          // Recepción Parcial: Dividir en Recibido (cantRecibida) y Pendiente (cantRestante)
          const entryRecibida = {
            ...hOriginal,
            id: `${hOriginal.id || Date.now()}-rec`,
            cant: cantRecibida,
            estatus_almacen: 'asignado',
            ubicacion_almacen: destinoSel,
            enviado_almacen: true,
            almacen_destino: destinoSel,
            fecha_entrada_almacen: nowIso,
            usuario_almacen_nombre: userNombre,
            usuario_almacen_id: userId,
            comentario_almacen: `Entrega parcial de ${cantRecibida} ${compraParaRecibir.unidad} recibida en ${destinoSel}.`
          };

          const entryPendiente = {
            ...hOriginal,
            id: `${hOriginal.id || Date.now()}-pend`,
            cant: cantRestante,
            estatus_almacen: 'pendiente_asignar',
            ubicacion_almacen: null,
            enviado_almacen: false,
            fecha_entrada_almacen: null,
            usuario_almacen_nombre: null,
            usuario_almacen_id: null,
            comentario_almacen: `Pendiente por recibir ${cantRestante} ${compraParaRecibir.unidad} de esta compra.`
          };

          hist.splice(compraParaRecibir.history_idx, 1, entryRecibida, entryPendiente);
        } else if (opcionRestante === 'cerrar_liberar') {
          // Recepción Parcial con Cierre de Orden y Liberación de Saldo a Compras
          const entryAjustada = {
            ...hOriginal,
            cant: cantRecibida,
            estatus_almacen: 'asignado',
            ubicacion_almacen: destinoSel,
            enviado_almacen: true,
            almacen_destino: destinoSel,
            fecha_entrada_almacen: nowIso,
            usuario_almacen_nombre: userNombre,
            usuario_almacen_id: userId,
            comentario_almacen: `Recepción final cerrada en ${cantRecibida} ${compraParaRecibir.unidad}. Saldo de ${cantRestante} ${compraParaRecibir.unidad} liberado a Compras.`
          };

          const notaJustificacion = {
            id: `cierre-alm-${Date.now()}`,
            tipo: 'JUSTIFICACION',
            fecha: nowIso,
            cant: cantRestante,
            pu: hOriginal.pu || 0,
            proveedor_nombre: hOriginal.proveedor_nombre,
            odc_numero: hOriginal.odc_numero || hOriginal.doc_numero,
            motivo: 'Cierre de Orden en Almacén (Entrega Parcial Definitiva)',
            comentario: `Cierre de recepción: se recibieron ${cantRecibida} de ${cantTotalCompra} ${compraParaRecibir.unidad}. Saldo restante (${cantRestante}) liberado a Compras para re-compra. Motivo: ${motivoCierreInput.trim()}`,
            usuario_nombre: userNombre,
            usuario_id: userId
          };

          hist[compraParaRecibir.history_idx] = entryAjustada;
          hist.push(notaJustificacion);

          // Recalcular cantidades de la requisición para liberar saldo a Compras
          const comprasActivas = hist.filter(t => t.tipo !== 'JUSTIFICACION' && t.tipo !== 'ANULACION' && t.tipo !== 'DIRECTRIZ' && !t.anulado);
          const totalComprado = comprasActivas.reduce((acc, t) => acc + (parseFloat(t.cant) || 0), 0);
          const cantPedida = parseFloat(item.cantidad_pedida ?? item.cant) || 0;
          const nuevaPendiente = Math.max(0, cantPedida - totalComprado);

          item.cantidad_comprada = totalComprado;
          item.cantidad_pendiente = nuevaPendiente;
          item.estado_item = nuevaPendiente > 0 ? 'pendiente' : 'comprado';
        }

        item.historial_compras = hist;
        const valid = hist.filter(t => t.tipo !== 'JUSTIFICACION' && t.tipo !== 'ANULACION' && t.tipo !== 'DIRECTRIZ' && !t.anulado);
        const allLocated = valid.length > 0 && valid.every(c => c.estatus_almacen === 'Ubicado' || c.estatus_almacen === 'asignado' || c.enviado_almacen === true);
        item.estatus_almacen = allLocated ? 'asignado' : 'pendiente_asignar';
        item.ubicacion_almacen = destinoSel;
        item.almacen_destino = destinoSel;
        item.fecha_entrada_almacen = nowIso;
        item.usuario_almacen_nombre = userNombre;
        item.usuario_almacen_id = userId;
      }

      items[compraParaRecibir.item_idx] = item;

      const { error: updateErr } = await supabase
        .from('requisiciones')
        .update({ items })
        .eq('id', compraParaRecibir.req_id);

      if (updateErr) throw updateErr;

      // Notificación interna
      try {
        const { data: perfilesAlmacen } = await supabase
          .from('perfiles')
          .select('id')
          .or("departamento.ilike.%almacen%,rol.ilike.%almacen%,departamento.ilike.%compra%");
        
        const { data: userData } = await supabase.auth.getUser();
        const currentUserId = userData?.user?.id;
        
        if (perfilesAlmacen && perfilesAlmacen.length > 0) {
          const notifs = perfilesAlmacen
            .filter(p => p.id !== currentUserId)
            .map(p => ({
              usuario_id: p.id,
              mensaje: esParcial
                ? `📦 Recepción Parcial en Almacén: ${cantRecibida}/${cantTotalCompra} ${compraParaRecibir.unidad} de Req ${compraParaRecibir.correlativo} (ODC: ${compraParaRecibir.odc_numero || 'S/N'}) en ${destinoSel}`
                : `📦 Material de Req ${compraParaRecibir.correlativo} (ODC: ${compraParaRecibir.odc_numero || 'S/N'}) fue RECIBIDO en: ${destinoSel}`,
              tipo: 'Almacén',
              leido: false,
              requisicion_id: compraParaRecibir.req_id
            }));
          
          if (notifs.length > 0) {
            await supabase.from('notificaciones').insert(notifs);
          }
        }
      } catch (notifErr) {
        console.warn("Notificación de almacén:", notifErr);
      }

      toast.success(
        esParcial
          ? (opcionRestante === 'cerrar_liberar'
              ? `Recepción de ${cantRecibida} ${compraParaRecibir.unidad} guardada y ${cantRestante} ${compraParaRecibir.unidad} liberadas a Compras.`
              : `Recepción parcial de ${cantRecibida} ${compraParaRecibir.unidad} guardada. Quedan ${cantRestante} pendientes por recibir.`)
          : '¡Excelente! Material MARCADO COMO RECIBIDO correctamente en almacén.'
      );

      setSelectedAlmacenes(prev => {
        const copy = { ...prev };
        delete copy[compraParaRecibir.id];
        return copy;
      });

      setShowModalRecibir(false);
      setCompraParaRecibir(null);
      if (showOdcModal) {
        setShowOdcModal(false);
      }
      await cargarDatos(true);
    } catch (err) {
      console.error("Error al ejecutar recepción:", err);
      toast.error("Error al guardar la recepción: " + err.message);
    } finally {
      setGuardandoRecepcion(false);
    }
  };

  // Helper alias
  const handleRecibir = (compra, destinoPersonalizado = null) => {
    abrirModalRecibir(compra, destinoPersonalizado);
  };

  // Función Principal de Entrega al Usuario Final (MARCAR COMO ENTREGADO)
  const handleEntregar = async (compra) => {
    const entregarPromesa = new Promise(async (resolve, reject) => {
      try {
        const { data: req, error: fetchErr } = await supabase
          .from('requisiciones')
          .select('items')
          .eq('id', compra.req_id)
          .single();
        
        if (fetchErr) throw fetchErr;
        
        const items = [...(req.items || [])];
        const item = items[compra.item_idx];
        if (!item) throw new Error("Material no encontrado.");

        const nowIso = new Date().toISOString();
        const userNombre = currentUser ? `${currentUser.nombre || ''} ${currentUser.apellido || ''}`.trim() || 'Personal de Almacén' : 'Personal de Almacén';
        const userId = currentUser ? currentUser.id : null;

        if (compra.is_legacy) {
          item.estatus_almacen = 'entregado';
          item.is_entregado = true;
          item.fecha_salida_almacen = nowIso;
          item.usuario_salida_nombre = userNombre;
          item.usuario_salida_id = userId;
        } else {
          const hist = [...(item.historial_compras || [])];
          if (hist[compra.history_idx]) {
            hist[compra.history_idx] = {
              ...hist[compra.history_idx],
              estatus_almacen: 'entregado',
              fecha_salida_almacen: nowIso,
              usuario_salida_nombre: userNombre,
              usuario_salida_id: userId
            };
            item.historial_compras = hist;
            const valid = hist.filter(h => h.tipo !== 'JUSTIFICACION' && h.tipo !== 'ANULACION' && h.tipo !== 'DIRECTRIZ');
            const allEntregados = valid.every(c => c.estatus_almacen === 'entregado');
            if (allEntregados) {
              item.estatus_almacen = 'entregado';
              item.is_entregado = true;
            }
          } else {
            throw new Error("Transacción no encontrada.");
          }
        }

        items[compra.item_idx] = item;

        const { error: updateErr } = await supabase
          .from('requisiciones')
          .update({ items })
          .eq('id', compra.req_id);
        
        if (updateErr) throw updateErr;

        resolve();
      } catch (err) {
        reject(err);
      }
    });

    toast.promise(entregarPromesa, {
      loading: 'Registrando la entrega final del material...',
      success: '¡Excelente! Material MARCADO COMO ENTREGADO exitosamente al solicitante.',
      error: (err) => `Error al registrar entrega: ${err.message}`
    });

    try {
      await entregarPromesa;
      await cargarDatos(true);
    } catch (e) {
      console.error(e);
    }
  };

  // Revertir Recepción
  const handleDeshacer = async (compra) => {
    const deshacerPromesa = new Promise(async (resolve, reject) => {
      try {
        const { data: req, error: fetchErr } = await supabase
          .from('requisiciones')
          .select('items')
          .eq('id', compra.req_id)
          .single();
        
        if (fetchErr) throw fetchErr;
        
        const items = [...(req.items || [])];
        const item = items[compra.item_idx];
        if (!item) throw new Error("Material no encontrado.");

        if (compra.is_legacy) {
          item.estatus_almacen = 'pendiente_asignar';
          item.ubicacion_almacen = null;
          item.enviado_almacen = false;
          item.almacen_destino = null;
          item.fecha_entrada_almacen = null;
          item.usuario_almacen_nombre = null;
          item.usuario_almacen_id = null;
        } else {
          const hist = [...(item.historial_compras || [])];
          if (hist[compra.history_idx]) {
            hist[compra.history_idx] = {
              ...hist[compra.history_idx],
              estatus_almacen: 'pendiente_asignar',
              ubicacion_almacen: null,
              enviado_almacen: false,
              almacen_destino: null,
              fecha_entrada_almacen: null,
              usuario_almacen_nombre: null,
              usuario_almacen_id: null
            };
            item.historial_compras = hist;
            item.estatus_almacen = 'pendiente_asignar';
            item.ubicacion_almacen = null;
            item.enviado_almacen = false;
            item.almacen_destino = null;
            item.fecha_entrada_almacen = null;
            item.usuario_almacen_nombre = null;
            item.usuario_almacen_id = null;
          } else {
            throw new Error("Transacción no encontrada.");
          }
        }

        items[compra.item_idx] = item;

        const { error: updateErr } = await supabase
          .from('requisiciones')
          .update({ items })
          .eq('id', compra.req_id);
        
        if (updateErr) throw updateErr;

        resolve();
      } catch (err) {
        reject(err);
      }
    });

    toast.promise(deshacerPromesa, {
      loading: 'Revirtiendo el registro de recepción...',
      success: 'Recepción revertida. El material vuelve a estar Pendiente de Recepción.',
      error: (err) => `Error al revertir recepción: ${err.message}`
    });

    try {
      await deshacerPromesa;
      await cargarDatos(true);
    } catch (e) {
      console.error(e);
    }
  };

  // Revertir Entrega
  const handleDeshacerEntrega = async (compra) => {
    const deshacerEntregaPromesa = new Promise(async (resolve, reject) => {
      try {
        const { data: req, error: fetchErr } = await supabase
          .from('requisiciones')
          .select('items')
          .eq('id', compra.req_id)
          .single();
        
        if (fetchErr) throw fetchErr;
        
        const items = [...(req.items || [])];
        const item = items[compra.item_idx];
        if (!item) throw new Error("Material no encontrado.");

        if (compra.is_legacy) {
          item.estatus_almacen = 'asignado';
          item.is_entregado = false;
          item.fecha_salida_almacen = null;
          item.usuario_salida_nombre = null;
          item.usuario_salida_id = null;
        } else {
          const hist = [...(item.historial_compras || [])];
          if (hist[compra.history_idx]) {
            hist[compra.history_idx] = {
              ...hist[compra.history_idx],
              estatus_almacen: 'asignado',
              fecha_salida_almacen: null,
              usuario_salida_nombre: null,
              usuario_salida_id: null
            };
            item.historial_compras = hist;
            item.estatus_almacen = 'asignado';
            item.is_entregado = false;
          } else {
            throw new Error("Transacción no encontrada.");
          }
        }

        items[compra.item_idx] = item;

        const { error: updateErr } = await supabase
          .from('requisiciones')
          .update({ items })
          .eq('id', compra.req_id);
        
        if (updateErr) throw updateErr;

        resolve();
      } catch (err) {
        reject(err);
      }
    });

    toast.promise(deshacerEntregaPromesa, {
      loading: 'Revirtiendo la entrega del material...',
      success: 'Entrega revertida. El material vuelve a estar en Almacén (Ubicado).',
      error: (err) => `Error al revertir entrega: ${err.message}`
    });

    try {
      await deshacerEntregaPromesa;
      await cargarDatos(true);
    } catch (e) {
      console.error(e);
    }
  };

  // Filtrado de las compras activas (no entregadas)
  const filteredCompras = useMemo(() => {
    return comprasRaw.filter(c => {
      if (c.is_entregado) return false;

      if (vistaTab === 'recibidos' && (!c.recibido || c.is_entrega_directa)) return false;
      if (vistaTab === 'pendientes' && (c.recibido || c.is_entrega_directa)) return false;
      if (vistaTab === 'directos' && !c.is_entrega_directa) return false;

      const q = busqueda.toLowerCase().trim();
      const matchBusqueda = !q ||
        c.descripcion.toLowerCase().includes(q) ||
        c.proveedor.toLowerCase().includes(q) ||
        c.numero_factura.toLowerCase().includes(q) ||
        c.solicitante.toLowerCase().includes(q) ||
        c.centro_costo.toLowerCase().includes(q) ||
        c.correlativo.toLowerCase().includes(q) ||
        (c.odc_numero && c.odc_numero.toLowerCase().includes(q));

      const matchAlmacen = 
        filtroAlmacen === 'Todos' ||
        (filtroAlmacen === 'Si' ? c.recibido : (!c.recibido && !c.is_entrega_directa));

      const matchDestino = 
        filtroDestino === 'Todos' ||
        (c.ubicacion_almacen && cleanAccents(c.ubicacion_almacen).includes(cleanAccents(filtroDestino)));

      let matchFecha = true;
      const fPago = c.fecha_entrada_almacen ? c.fecha_entrada_almacen.split('T')[0] : '';
      if (fechaDesde && fPago < fechaDesde) matchFecha = false;
      if (fechaHasta && fPago > fechaHasta) matchFecha = false;

      return matchBusqueda && matchAlmacen && matchDestino && matchFecha;
    });
  }, [comprasRaw, busqueda, filtroAlmacen, filtroDestino, fechaDesde, fechaHasta, vistaTab]);

  // Filtrado de las compras entregadas
  const entregadosCompras = useMemo(() => {
    return comprasRaw.filter(c => {
      if (!c.is_entregado) return false;

      const q = busqueda.toLowerCase().trim();
      const matchBusqueda = !q ||
        c.descripcion.toLowerCase().includes(q) ||
        c.proveedor.toLowerCase().includes(q) ||
        c.numero_factura.toLowerCase().includes(q) ||
        c.solicitante.toLowerCase().includes(q) ||
        c.centro_costo.toLowerCase().includes(q) ||
        c.correlativo.toLowerCase().includes(q) ||
        (c.odc_numero && c.odc_numero.toLowerCase().includes(q));

      const matchDestino = 
        filtroDestino === 'Todos' ||
        (c.ubicacion_almacen && cleanAccents(c.ubicacion_almacen).includes(cleanAccents(filtroDestino)));

      let matchFecha = true;
      const fSalida = c.fecha_salida_almacen ? c.fecha_salida_almacen.split('T')[0] : '';
      if (fechaDesde && fSalida < fechaDesde) matchFecha = false;
      if (fechaHasta && fSalida > fechaHasta) matchFecha = false;

      return matchBusqueda && matchDestino && matchFecha;
    });
  }, [comprasRaw, busqueda, filtroDestino, fechaDesde, fechaHasta]);

  const totalGeneralFiltrado = useMemo(() => {
    return filteredCompras.reduce((sum, c) => sum + (c.total || 0), 0);
  }, [filteredCompras]);

  const stats = useMemo(() => {
    const total = comprasRaw.length;
    const recibidos = comprasRaw.filter(c => c.is_asignado).length;
    const pendientes = comprasRaw.filter(c => c.is_pendiente).length;
    const directos = comprasRaw.filter(c => c.is_entrega_directa).length;
    const entregados = comprasRaw.filter(c => c.is_entregado).length;
    const boscan = comprasRaw.filter(c => c.ubicacion_almacen && cleanAccents(c.ubicacion_almacen).includes('boscan')).length;
    const maracaibo = comprasRaw.filter(c => c.ubicacion_almacen && cleanAccents(c.ubicacion_almacen).includes('maracaibo')).length;
    const bajoGrande = comprasRaw.filter(c => c.ubicacion_almacen && cleanAccents(c.ubicacion_almacen).includes('grande')).length;

    return { total, recibidos, pendientes, directos, entregados, boscan, maracaibo, bajoGrande };
  }, [comprasRaw]);

  const historialAsignaciones = useMemo(() => {
    const base = comprasRaw
      .filter(c => c.recibido && c.fecha_entrada_almacen)
      .sort((a, b) => new Date(b.fecha_entrada_almacen) - new Date(a.fecha_entrada_almacen));
    if (filtroAnalista === 'Todos') return base;
    return base.filter(c => (c.usuario_almacen_nombre || '') === filtroAnalista);
  }, [comprasRaw, filtroAnalista]);

  const listaAnalistas = useMemo(() => {
    const nombres = comprasRaw
      .filter(c => c.recibido && c.usuario_almacen_nombre)
      .map(c => c.usuario_almacen_nombre);
    return ['Todos', ...Array.from(new Set(nombres)).sort()];
  }, [comprasRaw]);

  // Exportar Excel
  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte Almacén');

    worksheet.mergeCells('A1:P1');
    const titleCell = worksheet.getCell('A1');
    const titleValStr = vistaTab === 'todos' 
      ? 'TOTAL CLEAN C.A. - REPORTE DE COMPRAS Y RECEPCIÓN EN ALMACÉN'
      : vistaTab === 'recibidos'
        ? 'TOTAL CLEAN C.A. - REPORTE DE MATERIALES UBICADOS EN ALMACÉN'
        : 'TOTAL CLEAN C.A. - REPORTE DE MATERIALES PENDIENTES EN ALMACÉN';
    titleCell.value = titleValStr;
    titleCell.font = { name: 'Arial Black', size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 40;

    const headers = [
      'ESTADO ALMACÉN',
      'ORDEN DE COMPRA',
      'REQUISICIÓN',
      'ESTADO REQ (ITEMS)',
      'DESCRIPCIÓN / MATERIAL',
      'PROVEEDOR',
      'NRO DE FACTURA',
      'FECHA COMPRA',
      'INGRESO ALMACÉN',
      'RECIBIDO POR',
      'ALMACÉN DESTINO',
      'SOLICITANTE',
      'GERENCIA',
      'CENTRO DE COSTO',
      'CANTIDAD',
      'TOTAL ($)'
    ];
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(2);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 25;

    filteredCompras.forEach(c => {
      const row = worksheet.addRow([
        c.is_entrega_directa ? 'ENTREGA DIRECTA' : (c.recibido ? 'ASIGNADO' : 'PENDIENTE'),
        c.odc_numero || 'S/N',
        c.correlativo,
        c.req_faltantes_items === 0 ? `Todos los ${c.req_total_items} listos` : `${c.req_entregados_items}/${c.req_total_items} Listos (Faltan ${c.req_faltantes_items})`,
        c.descripcion,
        c.proveedor,
        c.numero_factura,
        formatFechaHora(c.fecha_compra),
        c.is_entrega_directa ? 'Entrega Directa' : (c.recibido ? formatFechaHora(c.fecha_entrada_almacen) : '—'),
        c.is_entrega_directa ? '—' : (c.recibido ? (c.usuario_almacen_nombre || 'Desconocido') : '—'),
        c.ubicacion_almacen || (c.is_entrega_directa ? 'Entrega Directa' : 'PENDIENTE'),
        c.solicitante,
        c.gerencia,
        c.centro_costo,
        c.cantidad_comprada,
        c.total
      ]);

      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(7).alignment = { horizontal: 'center' };
      row.getCell(8).alignment = { horizontal: 'center' };
      row.getCell(9).alignment = { horizontal: 'center' };
      row.getCell(10).alignment = { horizontal: 'center' };
      row.getCell(11).alignment = { horizontal: 'center' };
      row.getCell(15).alignment = { horizontal: 'right' };
      row.getCell(16).alignment = { horizontal: 'right' };

      row.getCell(16).numFmt = '"$"#,##0.00;[Red]"$"#,##0.00';

      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    });

    worksheet.columns = [
      { width: 16 }, // ESTADO
      { width: 18 }, // ODC
      { width: 18 }, // REQUISICIÓN
      { width: 22 }, // ESTADO REQ
      { width: 35 }, // DESCRIPCIÓN
      { width: 25 }, // PROVEEDOR
      { width: 18 }, // FACTURA
      { width: 22 }, // FECHA COMPRA
      { width: 22 }, // INGRESO
      { width: 22 }, // RECIBIDO POR
      { width: 25 }, // DESTINO
      { width: 20 }, // SOLICITANTE
      { width: 20 }, // GERENCIA
      { width: 22 }, // CENTRO COSTO
      { width: 14 }, // CANTIDAD
      { width: 18 }  // TOTAL ($)
    ];

    const lastRowNum = filteredCompras.length + 3;
    worksheet.mergeCells(`A${lastRowNum}:O${lastRowNum}`);
    const totalLabel = worksheet.getCell(`A${lastRowNum}`);
    totalLabel.value = 'TOTAL GENERAL ACTIVIDAD ($):';
    totalLabel.font = { bold: true };
    totalLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    const totalVal = worksheet.getCell(`P${lastRowNum}`);
    totalVal.value = totalGeneralFiltrado;
    totalVal.font = { bold: true, color: { argb: 'FF15803D' } };
    totalVal.numFmt = '"$"#,##0.00';
    totalVal.alignment = { horizontal: 'right', vertical: 'middle' };

    const totalRow = worksheet.getRow(lastRowNum);
    totalRow.height = 25;
    totalRow.eachCell(cell => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF94A3B8' } }
      };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Reporte_Almacen_TC_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Archivo Excel exportado con éxito.");
  };

  // Exportar PDF
  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFillColor(22, 163, 74);
    doc.rect(0, 0, 297, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    
    const titleValStr = vistaTab === 'todos' 
      ? 'TOTAL CLEAN C.A. - REPORTE DE COMPRAS Y RECEPCIÓN EN ALMACÉN'
      : vistaTab === 'recibidos'
        ? 'TOTAL CLEAN C.A. - REPORTE DE MATERIALES UBICADOS EN ALMACÉN'
        : 'TOTAL CLEAN C.A. - REPORTE DE MATERIALES PENDIENTES EN ALMACÉN';
        
    doc.text(titleValStr, 15, 17);
    doc.setFontSize(9);
    doc.text(`Generado: ${new Date().toLocaleString()}`, 240, 17);

    const tableData = filteredCompras.map(c => [
      c.recibido ? 'ASIGNADO' : 'PENDIENTE',
      c.odc_numero || 'S/N',
      c.correlativo,
      c.descripcion.substring(0, 26),
      c.proveedor.substring(0, 15),
      c.numero_factura,
      formatFechaHora(c.fecha_compra),
      c.recibido ? formatFechaHora(c.fecha_entrada_almacen) : '—',
      c.ubicacion_almacen || 'PENDIENTE',
      c.solicitante.substring(0, 12),
      c.gerencia.substring(0, 12),
      c.cantidad_comprada,
      `$ ${(c.total || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      head: [['ESTADO', 'ODC', 'REQUISICIÓN', 'DESCRIPCIÓN', 'PROVEEDOR', 'FACTURA', 'COMPRA', 'INGRESO ALM', 'ALM. DESTINO', 'SOLICITANTE', 'GERENCIA', 'CANT', 'TOTAL ($)']],
      body: tableData,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], fontSize: 6.5, halign: 'center' },
      styles: { fontSize: 6, cellPadding: 1 },
      columnStyles: {
        0: { halign: 'center' },
        1: { halign: 'center', fontStyle: 'bold' },
        2: { halign: 'center', fontStyle: 'bold' },
        5: { halign: 'center' },
        6: { halign: 'center' },
        7: { halign: 'center' },
        8: { halign: 'center' },
        11: { halign: 'right' },
        12: { halign: 'right', fontStyle: 'bold' }
      },
      foot: [['', '', '', '', '', '', '', '', '', '', 'TOTAL GRAL.', '', `$ ${(totalGeneralFiltrado || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`]],
      footStyles: { fillColor: [240, 253, 244], textColor: [22, 163, 74], fontStyle: 'bold' }
    });

    doc.save(`Reporte_Compras_Almacen_TC_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success("Documento PDF exportado con éxito.");
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f8fafc', minHeight: '100vh', color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>
      
      {/* HEADER PRINCIPAL */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '20px', marginBottom: '25px' }}>
        <div style={{ borderLeft: '6px solid #16a34a', paddingLeft: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={28} color="#16a34a" />
            <h1 style={{ margin: 0, color: '#0f172a', fontSize: '1.8rem', fontWeight: '900', letterSpacing: '-0.5px' }}>
              Control y Recepción de Almacén
            </h1>
          </div>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem', fontWeight: '500' }}>
            Recepción física de compras vinculadas a Órdenes de Compra (ODC) y Requisiciones
          </p>
        </div>

        {/* ACCIONES EXPORTACIÓN */}
        <div style={{ display: 'flex', gap: '10px', width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
          <button onClick={exportToExcel} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 18px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.2)' }}>
            <FileSpreadsheet size={16} /> Excel Reporte
          </button>
          <button onClick={exportToPDF} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 18px', backgroundColor: '#334155', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}>
            <FileText size={16} /> PDF Cierre
          </button>
        </div>
      </div>

      {/* TARJETAS ESTADÍSTICAS KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(7, 1fr)', gap: '12px', marginBottom: '22px' }}>
        {[
          { label: 'Compras Totales',      value: stats.total,      sub: 'en sistema',           color: '#3b82f6' },
          { label: 'Ubicados/Asignados',  value: stats.recibidos,  sub: 'en estantería',        color: '#f59e0b' },
          { label: 'Pendiente Ubicar',    value: stats.pendientes, sub: 'por clasificar',        color: '#ef4444' },
          { label: 'Entregados Final',    value: stats.entregados, sub: 'entregados a usuario', color: '#16a34a' },
          { label: 'Campo Boscán',        value: stats.boscan,     sub: 'almacén ubicados',     color: '#06b6d4' },
          { label: 'Maracaibo',            value: stats.maracaibo,  sub: 'almacén ubicados',     color: '#8b5cf6' },
          { label: 'Bajo Grande',          value: stats.bajoGrande, sub: 'almacén ubicados',     color: '#ec4899' },
        ].map(({ label, value, sub, color }) => (
          <div
            key={label}
            style={{
              backgroundColor: 'white',
              padding: '16px 18px',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              borderLeft: `5px solid ${color}`,
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              transition: 'transform 0.2s, box-shadow 0.2s',
              cursor: 'default',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.02)'; }}
          >
            <div style={{ fontSize: '0.68rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>{label}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.02em', marginTop: '1px' }}>{value}</div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: '500' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* FILTROS Y BÚSQUEDAS */}
      <div style={{ backgroundColor: 'white', padding: '18px 20px', borderRadius: '18px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr 1fr 1fr', gap: '14px', alignItems: 'center' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Búsqueda de Compra / ODC</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Buscar por ODC, REQ, ítem, factura, proveedor..." 
                value={busqueda} 
                onChange={(e) => setBusqueda(e.target.value)}
                style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
              />
              <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Sede Almacén</label>
            <select 
              value={filtroDestino} 
              onChange={(e) => setFiltroDestino(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none', backgroundColor: 'white' }}
            >
              <option value="Todos">Todas las Sedes</option>
              {UBICACIONES_AUTORIZADAS.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>F. Desde</label>
            <input 
              type="date" 
              value={fechaDesde} 
              onChange={(e) => setFechaDesde(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>F. Hasta</label>
            <input 
              type="date" 
              value={fechaHasta} 
              onChange={(e) => setFechaHasta(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>
      </div>

      {/* PESTAÑAS PRINCIPALES */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => setActiveTab('recepcion')}
          style={{
            padding: '9px 18px', borderRadius: '12px', border: 'none', cursor: 'pointer',
            fontWeight: '800', fontSize: '0.82rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px',
            backgroundColor: activeTab === 'recepcion' ? '#16a34a' : '#f1f5f9',
            color: activeTab === 'recepcion' ? 'white' : '#475569',
            boxShadow: activeTab === 'recepcion' ? '0 4px 10px rgba(22, 163, 74, 0.25)' : 'none'
          }}
        >
          <Package size={16} /> 📥 Recepción Física de Compras
          <span style={{ backgroundColor: activeTab === 'recepcion' ? 'rgba(255,255,255,0.25)' : '#e2e8f0', padding: '2px 7px', borderRadius: '10px', fontSize: '0.72rem' }}>
            {filteredCompras.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('entregados')}
          style={{
            padding: '9px 18px', borderRadius: '12px', border: 'none', cursor: 'pointer',
            fontWeight: '800', fontSize: '0.82rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px',
            backgroundColor: activeTab === 'entregados' ? '#3b82f6' : '#f1f5f9',
            color: activeTab === 'entregados' ? 'white' : '#475569',
            boxShadow: activeTab === 'entregados' ? '0 4px 10px rgba(59, 130, 246, 0.25)' : 'none'
          }}
        >
          <Truck size={16} /> 🚚 Materiales Entregados
          <span style={{ backgroundColor: activeTab === 'entregados' ? 'rgba(255,255,255,0.25)' : '#e2e8f0', padding: '2px 7px', borderRadius: '10px', fontSize: '0.72rem' }}>
            {entregadosCompras.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('historial')}
          style={{
            padding: '9px 18px', borderRadius: '12px', border: 'none', cursor: 'pointer',
            fontWeight: '800', fontSize: '0.82rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px',
            backgroundColor: activeTab === 'historial' ? '#0f172a' : '#f1f5f9',
            color: activeTab === 'historial' ? 'white' : '#475569',
          }}
        >
          <History size={16} /> ⏱️ Bitácora de Movimientos
        </button>

        {activeTab === 'recepcion' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
            <button
              onClick={() => setVistaTab('todos')}
              style={{
                padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontWeight: '700', fontSize: '0.75rem', transition: 'all 0.2s', whiteSpace: 'nowrap',
                backgroundColor: vistaTab === 'todos' ? '#0f172a' : 'transparent',
                color: vistaTab === 'todos' ? 'white' : '#64748b',
              }}
            >
              Todos ({stats.total - stats.entregados})
            </button>
            <button
              onClick={() => setVistaTab('pendientes')}
              style={{
                padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontWeight: '700', fontSize: '0.75rem', transition: 'all 0.2s', whiteSpace: 'nowrap',
                backgroundColor: vistaTab === 'pendientes' ? '#dc2626' : 'transparent',
                color: vistaTab === 'pendientes' ? 'white' : '#64748b',
              }}
            >
              📥 Pendientes por Recibir ({stats.pendientes})
            </button>
            <button
              onClick={() => setVistaTab('recibidos')}
              style={{
                padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontWeight: '700', fontSize: '0.75rem', transition: 'all 0.2s', whiteSpace: 'nowrap',
                backgroundColor: vistaTab === 'recibidos' ? '#16a34a' : 'transparent',
                color: vistaTab === 'recibidos' ? 'white' : '#64748b',
              }}
            >
              📦 Ubicados en Almacén ({stats.recibidos})
            </button>
            <button
              onClick={() => setVistaTab('directos')}
              style={{
                padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontWeight: '700', fontSize: '0.75rem', transition: 'all 0.2s', whiteSpace: 'nowrap',
                backgroundColor: vistaTab === 'directos' ? '#d97706' : 'transparent',
                color: vistaTab === 'directos' ? 'white' : '#64748b',
              }}
            >
              🚚 Entrega Directa ({stats.directos})
            </button>
          </div>
        )}
      </div>

      {/* TABLA PRINCIPAL — solo en pestaña Recepción */}
      {activeTab === 'recepcion' && (
        <div style={{ backgroundColor: 'white', borderRadius: '20px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
          
          {/* ENCABECERA EXCEL-STYLE */}
          <div style={{ backgroundColor: '#16a34a', color: 'white', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '900', letterSpacing: '0.5px' }}>
                {vistaTab === 'todos' 
                  ? 'TOTAL CLEAN C.A. - BANDEJA DE ENTRADA Y RECEPCIÓN DE COMPRAS'
                  : vistaTab === 'recibidos'
                    ? 'TOTAL CLEAN C.A. - MATERIALES UBICADOS EN ALMACÉN'
                    : 'TOTAL CLEAN C.A. - MATERIALES PENDIENTES DE RECIBIR EN ALMACÉN'}
              </h3>
              <div style={{ fontSize: '0.72rem', opacity: 0.9, marginTop: '2px' }}>
                Haga clic en la Orden de Compra (ODC) o en la Requisición para ver la vista previa breve con sus detalles vinculados
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '8px' }}>
              Mostrando: {filteredCompras.length} de {comprasRaw.filter(c => !c.is_entregado).length}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#1e293b', color: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '12px 10px', textAlign: 'center', width: '90px' }}>ESTADO</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', minWidth: '130px' }}>ORDEN DE COMPRA</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', minWidth: '150px' }}>REQUISICIÓN VINCULADA</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', minWidth: '200px' }}>DESCRIPCIÓN / MATERIAL</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', minWidth: '160px' }}>PROVEEDOR & FACTURA</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', minWidth: '130px' }}>FECHA COMPRA</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', minWidth: '170px' }}>INGRESO ALMACÉN</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', minWidth: '240px' }}>ACCIONES / RECEPCIÓN</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', minWidth: '160px' }}>SOLICITANTE & CC</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right', minWidth: '80px' }}>CANT</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right', minWidth: '100px' }}>TOTAL ($)</th>
                </tr>
              </thead>
              <tbody>
                {loading && filteredCompras.length === 0 ? (
                  <tr>
                    <td colSpan="11" style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                        <Loader2 className="animate-spin" /> Cargando compras y órdenes de compra...
                      </div>
                    </td>
                  </tr>
                ) : filteredCompras.length === 0 ? (
                  <tr>
                    <td colSpan="11" style={{ padding: '50px', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>
                      <ShieldAlert size={26} style={{ display: 'block', margin: '0 auto 10px auto', color: '#94a3b8' }} />
                      No se encontraron registros de compras bajo los filtros actuales.
                    </td>
                  </tr>
                ) : filteredCompras.map((compra) => {
                  const isRecibida = compra.recibido;
                  const selectedLoc = selectedAlmacenes[compra.id] || compra.ubicacion_almacen || '';
                  const rowBg = isRecibida ? '#f0fdf4' : 'transparent';
                  const tieneOdc = compra.odc_numero && compra.odc_numero !== 'S/N';

                  return (
                    <tr key={compra.transaction_id || compra.id} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background-color 0.2s', backgroundColor: rowBg }} className="row-hover">
                      {/* ESTADO */}
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        {compra.is_entrega_directa ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '8px', backgroundColor: '#fef3c7', color: '#92400e', fontWeight: '900', fontSize: '0.68rem', border: '1px solid #fde68a' }} title="Esta compra fue procesada como Entrega Directa / Servicio en obra y no pasa por almacén">
                            <Truck size={12} /> DIRECTO
                          </span>
                        ) : isRecibida ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '8px', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: '900', fontSize: '0.68rem', border: '1px solid #bbf7d0' }}>
                            <Check size={12} /> ASIGNADO
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '8px', backgroundColor: '#fee2e2', color: '#b91c1c', fontWeight: '900', fontSize: '0.68rem', border: '1px solid #fecaca' }}>
                            <Clock size={12} /> PENDIENTE
                          </span>
                        )}
                      </td>
                      
                      {/* ORDEN DE COMPRA (ODC) */}
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        {tieneOdc ? (
                          <button
                            type="button"
                            onClick={() => handleVerDetalleOdc(compra)}
                            title="Haga clic para ver la Vista Previa Breve de la Orden de Compra"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '5px 10px',
                              borderRadius: '8px',
                              backgroundColor: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              fontWeight: '900',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#dbeafe'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#eff6ff'; }}
                          >
                            <ShoppingBag size={13} color="#2563eb" /> {compra.odc_numero}
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
                            Directa (S/N)
                          </span>
                        )}
                      </td>

                      {/* REQUISICIÓN VINCULADA Y PROGRESO DE COMPLETITUD */}
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <div 
                          onClick={() => handleVerDetalleTicket(compra)}
                          title="Haga clic para ver los detalles de la Requisición y soportes"
                          style={{ fontWeight: '900', color: '#0ea5e9', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.82rem' }}
                        >
                          {compra.correlativo}
                        </div>
                        <div style={{ marginTop: '3px' }}>
                          {compra.req_faltantes_items === 0 ? (
                            <span style={{ fontSize: '0.65rem', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#dcfce7', color: '#16a34a' }}>
                              ✅ {compra.req_total_items}/{compra.req_total_items} Listos
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.65rem', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#fef3c7', color: '#b45309' }}>
                              📥 {compra.req_entregados_items}/{compra.req_total_items} (Faltan {compra.req_faltantes_items})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* DESCRIPCIÓN */}
                      <td style={{ padding: '10px', fontWeight: '600', color: '#0f172a' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                          <span style={{ fontSize: '0.7rem', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', color: '#64748b' }}>
                            {compra.unidad}
                          </span>
                          <span>{compra.descripcion}</span>
                        </div>
                      </td>

                      {/* PROVEEDOR Y FACTURA */}
                      <td style={{ padding: '10px', color: '#475569' }}>
                        <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.8rem' }}>{compra.proveedor}</div>
                        <div style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: '600', marginTop: '2px' }}>
                          Doc: {compra.numero_factura}
                        </div>
                      </td>

                      {/* FECHA COMPRA */}
                      <td style={{ padding: '10px', textAlign: 'center', color: '#334155', fontWeight: '600', fontSize: '0.78rem' }}>
                        {formatFechaHora(compra.fecha_compra)}
                      </td>

                      {/* INGRESO ALMACÉN */}
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        {isRecibida ? (
                          <div>
                            <div style={{ fontWeight: '700', color: '#16a34a', fontSize: '0.78rem' }}>
                              {formatFechaHora(compra.fecha_entrada_almacen)}
                            </div>
                            {compra.usuario_almacen_nombre && (
                              <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '2px', fontWeight: 'bold' }}>
                                👤 {compra.usuario_almacen_nombre}
                              </div>
                            )}
                          </div>
                        ) : compra.is_entrega_directa ? (
                          <span style={{ color: '#d97706', fontWeight: '700', fontSize: '0.75rem' }}>Entrega Directa</span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.75rem' }}>Pendiente por ingresar</span>
                        )}
                      </td>

                      {/* ALMACÉN DESTINO & ACCIONES DE RECEPCIÓN (MARCAR COMO RECIBIDO / ENTREGAR) */}
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        {compra.is_entrega_directa ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontWeight: '800', color: '#92400e', fontSize: '0.72rem', backgroundColor: '#fef3c7', padding: '3px 10px', borderRadius: '10px', border: '1px solid #fde68a' }}>
                              🚚 Entrega Directa
                            </span>
                            <span style={{ fontSize: '0.68rem', color: '#b45309', fontWeight: '600' }}>
                              No requiere Almacén
                            </span>
                          </div>
                        ) : isRecibida ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                            <span style={{ fontWeight: '800', color: '#166534', fontSize: '0.72rem', backgroundColor: '#dcfce7', padding: '3px 8px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                              📍 {compra.ubicacion_almacen}
                            </span>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <button 
                                type="button" 
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEntregar(compra); }} 
                                title="Marcar este material como Entregado al Solicitante"
                                style={{
                                  padding: '5px 12px',
                                  backgroundColor: '#3b82f6',
                                  border: 'none',
                                  borderRadius: '8px',
                                  color: 'white',
                                  fontWeight: '800',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '0.72rem',
                                  boxShadow: '0 2px 6px rgba(59, 130, 246, 0.3)'
                                }}
                              >
                                <Truck size={13} /> Entregar
                              </button>
                              <button 
                                type="button" 
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeshacer(compra); }} 
                                title="Revertir recepción (volver a Pendiente)"
                                style={{ padding: '5px 8px', backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                            <select 
                              value={selectedLoc}
                              onChange={(e) => setSelectedAlmacenes(prev => ({ ...prev, [compra.id]: e.target.value }))}
                              style={{ padding: '6px 8px', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontSize: '0.78rem', outline: 'none', maxWidth: '140px', backgroundColor: 'white' }}
                            >
                              <option value="">Seleccionar Sede...</option>
                              {UBICACIONES_AUTORIZADAS.map(loc => (
                                <option key={loc} value={loc}>{loc}</option>
                              ))}
                            </select>
                            <button 
                              type="button" 
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRecibir(compra, selectedLoc); }} 
                              disabled={!selectedLoc}
                              style={{ 
                                padding: '6px 12px', 
                                backgroundColor: selectedLoc ? '#16a34a' : '#94a3b8', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '8px', 
                                fontWeight: '800', 
                                cursor: selectedLoc ? 'pointer' : 'not-allowed',
                                transition: 'all 0.2s',
                                fontSize: '0.75rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                boxShadow: selectedLoc ? '0 2px 6px rgba(22, 163, 74, 0.3)' : 'none'
                              }}
                            >
                              <CheckCircle2 size={13} /> Recibir
                            </button>
                          </div>
                        )}
                      </td>

                      {/* SOLICITANTE / GERENCIA */}
                      <td style={{ padding: '10px', color: '#475569' }}>
                        <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.8rem' }}>{compra.solicitante}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>🏢 {compra.gerencia}</div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>📍 {compra.centro_costo}</div>
                      </td>

                      {/* CANTIDAD COMPRADA */}
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '900', color: '#0f172a' }}>
                        {compra.cantidad_comprada}
                      </td>

                      {/* TOTAL ($) */}
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '900', color: '#16a34a' }}>
                        $ {(compra.total || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              
              {/* PIE DE PÁGINA TOTALES */}
              {!loading && filteredCompras.length > 0 && (
                <tfoot>
                  <tr style={{ backgroundColor: '#f1f5f9', borderTop: '2px solid #cbd5e1', fontWeight: '900', color: '#0f172a' }}>
                    <td colSpan="10" style={{ padding: '14px 20px', textAlign: 'right', fontSize: '0.88rem' }}>
                      TOTAL MONTO ACTIVIDAD ($):
                    </td>
                    <td style={{ padding: '14px 10px', textAlign: 'right', fontSize: '0.95rem', color: '#16a34a' }}>
                      $ {totalGeneralFiltrado.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* HISTORIAL DE ENTREGADOS — pestaña separada */}
      {activeTab === 'entregados' && (
        <div style={{ backgroundColor: 'white', borderRadius: '20px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
          
          <div style={{ backgroundColor: '#3b82f6', color: 'white', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '900', letterSpacing: '0.5px' }}>
                📦 HISTORIAL DE MATERIALES ENTREGADOS AL USUARIO FINAL
              </h3>
              <div style={{ fontSize: '0.72rem', opacity: 0.9, marginTop: '2px' }}>
                Registro formal de materiales que ya salieron de almacén y fueron recibidos por el departamento solicitante
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '8px' }}>
              Entregados: {entregadosCompras.length}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#1e293b', color: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '12px 10px', textAlign: 'center', width: '120px' }}>ORDEN / REQ</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', minWidth: '200px' }}>DESCRIPCIÓN</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left' }}>PROVEEDOR</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center' }}>NRO DE FACTURA</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', minWidth: '150px' }}>INGRESO ALMACÉN</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', minWidth: '150px' }}>ENTREGA FINAL</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', minWidth: '180px' }}>UBICACIÓN / ENTREGADO POR</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', minWidth: '160px' }}>SOLICITANTE / GERENCIA</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>CANTIDAD</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>TOTAL ($)</th>
                </tr>
              </thead>
              <tbody>
                {loading && entregadosCompras.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                        <Loader2 className="animate-spin" /> Cargando entregados...
                      </div>
                    </td>
                  </tr>
                ) : entregadosCompras.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ padding: '50px', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>
                      <ShieldAlert size={24} style={{ display: 'block', margin: '0 auto 10px auto', color: '#94a3b8' }} />
                      No hay materiales entregados registrados bajo los filtros actuales.
                    </td>
                  </tr>
                ) : entregadosCompras.map((compra) => {
                  return (
                    <tr key={compra.transaction_id || compra.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }} className="row-hover">
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <div 
                          onClick={() => handleVerDetalleTicket(compra)}
                          style={{ fontWeight: 'bold', color: '#1e40af', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          {compra.correlativo}
                        </div>
                        {compra.odc_numero && compra.odc_numero !== 'S/N' && (
                          <div 
                            onClick={() => handleVerDetalleOdc(compra)}
                            style={{ fontSize: '0.72rem', color: '#2563eb', cursor: 'pointer', marginTop: '2px', fontWeight: 'bold' }}
                          >
                            🛍️ {compra.odc_numero}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px', fontWeight: '600', color: '#0f172a' }}>{compra.descripcion}</td>
                      <td style={{ padding: '10px', color: '#475569' }}>{compra.proveedor}</td>
                      <td style={{ padding: '10px', textAlign: 'center', fontWeight: '700', color: '#2563eb' }}>{compra.numero_factura}</td>
                      <td style={{ padding: '10px', textAlign: 'center', color: '#64748b' }}>{formatFechaHora(compra.fecha_entrada_almacen)}</td>
                      <td style={{ padding: '10px', textAlign: 'center', color: '#16a34a', fontWeight: 'bold' }}>{formatFechaHora(compra.fecha_salida_almacen)}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <div>
                            <div style={{ fontWeight: '700', color: '#1e293b' }}>📍 {compra.ubicacion_almacen}</div>
                            {compra.usuario_salida_nombre && (
                              <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: '2px' }}>
                                👤 {compra.usuario_salida_nombre}
                              </div>
                            )}
                          </div>
                          <button 
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeshacerEntrega(compra); }} 
                            title="Revertir Entrega (Volver a Ubicado en Almacén)"
                            style={{ padding: '6px', backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '10px', color: '#475569' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{compra.solicitante}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>🏢 {compra.gerencia}</div>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>{compra.cantidad_comprada}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', color: '#16a34a' }}>
                        $ {(compra.total || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* HISTORIAL / BITÁCORA — pestaña separada */}
      {activeTab === 'historial' && (
        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '25px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b', fontSize: '1.05rem', fontWeight: '800' }}>
              <History size={20} color="#16a34a" /> Bitácora de Entradas al Almacén
              <span style={{ fontSize: '0.75rem', fontWeight: '600', padding: '3px 10px', borderRadius: '20px', backgroundColor: '#dcfce7', color: '#16a34a' }}>
                {historialAsignaciones.length} registros
              </span>
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Filtrar por Analista:</label>
              <select
                value={filtroAnalista}
                onChange={e => setFiltroAnalista(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '0.85rem', outline: 'none', backgroundColor: 'white', fontWeight: '600', color: '#1e293b', minWidth: '200px' }}
              >
                {listaAnalistas.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          {historialAsignaciones.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic', border: '1px dashed #cbd5e1', borderRadius: '16px' }}>
              No se han registrado asignaciones{filtroAnalista !== 'Todos' ? ` para ${filtroAnalista}` : ''} aún.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {historialAsignaciones.map((h) => {
                const fechaObj = new Date(h.fecha_entrada_almacen);
                const diaStr = fechaObj.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                const horaStr = fechaObj.toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit', hour12: true });

                return (
                  <div 
                    key={h.id}
                    style={{ 
                      padding: '16px', 
                      borderRadius: '12px', 
                      backgroundColor: '#f8fafc', 
                      borderLeft: '4px solid #16a34a', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      flexWrap: 'wrap', 
                      gap: '15px' 
                    }}
                  >
                    <div style={{ flex: 1, minWidth: '280px' }}>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#334155' }}>
                        El material <strong style={{ color: '#0f172a' }}>{h.descripcion}</strong> (Req. <strong style={{ color: '#1e40af' }}>{h.correlativo}</strong>
                        {h.odc_numero && h.odc_numero !== 'S/N' ? `, ODC: ` : ''}
                        {h.odc_numero && h.odc_numero !== 'S/N' ? <strong style={{ color: '#2563eb' }}>{h.odc_numero}</strong> : ''})
                        {' '}fue ubicado en <strong style={{ color: '#16a34a' }}>{h.ubicacion_almacen}</strong>.
                      </p>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        <span>👤 Recibido por: <strong>{h.usuario_almacen_nombre || 'Desconocido'}</strong></span>
                        <span>•</span>
                        <span>Prov: {h.proveedor}</span>
                        <span>•</span>
                        <span>Factura: {h.numero_factura}</span>
                      </span>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#16a34a', display: 'block' }}>
                        {diaStr}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {horaStr}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL VISTA PREVIA BREVE DE ORDEN DE COMPRA (ODC) */}
      {showOdcModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '15px'
          }}
          onClick={() => { setShowOdcModal(false); setOdcModalData(null); }}
        >
          <div
            style={{
              background: 'white',
              width: '95%',
              maxWidth: '920px',
              borderRadius: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh'
            }}
            onClick={e => e.stopPropagation()}
          >
            {loadingOdcModal ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '350px', gap: '15px' }}>
                <Loader2 className="animate-spin" size={36} style={{ color: '#0ea5e9' }} />
                <span style={{ color: '#64748b', fontWeight: '600', fontSize: '0.9rem' }}>
                  Cargando vista previa de la Orden de Compra...
                </span>
              </div>
            ) : odcModalData ? (() => {
              const { odc, items, compra, provInfo } = odcModalData;
              const odcNumeroDisplay = odc.numero_orden || odc.numero_odc || compra.odc_numero || 'ODC-S/N';
              const reqCorrelativoDisplay = odc.requisicion_correlativo || odc.correlativo_req || compra.correlativo;
              const totalItemsReq = compra.req_total_items || (items ? items.length : 1);
              const faltantesReq = compra.req_faltantes_items ?? 0;
              const esEmergencia = odc.requisicion_prioridad === 'EMERGENCIA' || odc.prioridad_pago === 1;

              return (
                <>
                  {/* CABECERA DE MODAL ODC */}
                  <div style={{ background: '#1e293b', padding: '18px 26px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ backgroundColor: '#0ea5e9', padding: '6px', borderRadius: '10px', display: 'flex' }}>
                        <ShoppingBag size={20} color="white" />
                      </div>
                      <div>
                        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, letterSpacing: '-0.3px' }}>
                          Orden de Compra: {odcNumeroDisplay}
                        </h2>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                          Vinculada a Requisición: <strong style={{ color: '#38bdf8' }}>{reqCorrelativoDisplay}</strong>
                        </span>
                      </div>
                      {odc.pasa_por_almacen === false || compra.pasa_por_almacen === false ? (
                        <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '900', backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                          🚚 ENTREGA DIRECTA (SIN ALMACÉN)
                        </span>
                      ) : (
                        <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '900', backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
                          📦 RECEPCIÓN EN ALMACÉN
                        </span>
                      )}
                      {esEmergencia ? (
                        <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '900', backgroundColor: '#fee2e2', color: '#b91c1c' }}>
                          🚨 PRIORIDAD 1 (MÁXIMA)
                        </span>
                      ) : (
                        <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '800', backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
                          🔵 PRIORIDAD 2 (NORMAL)
                        </span>
                      )}
                    </div>
                    <button 
                      onClick={() => { setShowOdcModal(false); setOdcModalData(null); }}
                      style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </div>

                  {/* CUERPO MODAL ODC */}
                  <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* BANNER DE VINCULACIÓN Y COMPLETITUD */}
                    <div style={{ backgroundColor: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: '16px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ backgroundColor: '#0284c7', color: 'white', padding: '6px', borderRadius: '8px', fontWeight: 'bold' }}>
                          📋
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase' }}>
                            Trazabilidad con Requisición de Origen
                          </div>
                          <div style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0c4a6e' }}>
                            {reqCorrelativoDisplay} — {odc.departamento || compra.gerencia}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {faltantesReq === 0 ? (
                          <span style={{ padding: '6px 12px', borderRadius: '10px', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: '900', fontSize: '0.78rem', border: '1px solid #bbf7d0' }}>
                            ✅ Todos los {totalItemsReq} ítems completados
                          </span>
                        ) : (
                          <span style={{ padding: '6px 12px', borderRadius: '10px', backgroundColor: '#fef3c7', color: '#b45309', fontWeight: '900', fontSize: '0.78rem', border: '1px solid #fde68a' }}>
                            ⏳ Faltan {faltantesReq} de {totalItemsReq} ítems por entregar
                          </span>
                        )}
                      </div>
                    </div>

                    {/* DATOS GENERALES DE LA ODC */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '12px' }}>
                      <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Proveedor</div>
                        <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0f172a' }}>{odc.proveedor_nombre || compra.proveedor}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                          RIF: {odc.proveedor_rif || provInfo?.rif || 'N/A'} {provInfo?.telefono ? `• Tel: ${provInfo.telefono}` : ''}
                        </div>
                      </div>

                      <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Solicitante & Gerencia</div>
                        <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0f172a' }}>{odc.solicitante || compra.solicitante}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                          {odc.departamento || compra.gerencia} • {odc.centro_costo || compra.centro_costo}
                        </div>
                      </div>

                      <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Destino & Emisión</div>
                        <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0f172a' }}>{odc.destino_despacho || compra.ubicacion_almacen || 'Almacén Central'}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                          Emitida: {safeFormatDate(odc.fecha_emision || compra.fecha_compra)}
                        </div>
                      </div>
                    </div>

                    {/* LISTADO DE ITEMS COMPRADOS DE ESTA ODC */}
                    <div>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '0.82rem', fontWeight: '900', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Materiales e Ítems de la Orden de Compra
                      </h4>

                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                              <th style={{ padding: '10px', textAlign: 'center', width: '40px' }}>#</th>
                              <th style={{ padding: '10px', textAlign: 'left' }}>Descripción del Material</th>
                              <th style={{ padding: '10px', textAlign: 'center', width: '80px' }}>Unidad</th>
                              <th style={{ padding: '10px', textAlign: 'center', width: '80px' }}>Cantidad</th>
                              <th style={{ padding: '10px', textAlign: 'center', width: '140px' }}>Estado Almacén</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items && items.length > 0 ? items.map((it, idx) => {
                              const itStatus = it.estatus_almacen || compra.estatus_almacen || 'pendiente_asignar';
                              const itRecibido = itStatus === 'Ubicado' || itStatus === 'asignado';
                              const itEntregado = itStatus === 'entregado';

                              return (
                                <tr key={it.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>
                                    {it.item_numero || idx + 1}
                                  </td>
                                  <td style={{ padding: '10px', fontWeight: '600', color: '#0f172a' }}>
                                    {it.descripcion}
                                  </td>
                                  <td style={{ padding: '10px', textAlign: 'center', color: '#64748b' }}>
                                    {it.unidad || 'UND'}
                                  </td>
                                  <td style={{ padding: '10px', textAlign: 'center', fontWeight: '800' }}>
                                    {it.cantidad || it.cant}
                                  </td>
                                  <td style={{ padding: '10px', textAlign: 'center' }}>
                                    {itEntregado ? (
                                      <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: '#dcfce7', color: '#16a34a', fontWeight: '800', fontSize: '0.7rem' }}>
                                        ✅ ENTREGADO
                                      </span>
                                    ) : itRecibido ? (
                                      <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: '#dbeafe', color: '#1d4ed8', fontWeight: '800', fontSize: '0.7rem' }}>
                                        📦 EN ALMACÉN
                                      </span>
                                    ) : (
                                      <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: '#fee2e2', color: '#dc2626', fontWeight: '800', fontSize: '0.7rem' }}>
                                        📥 POR RECIBIR
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            }) : (
                              <tr>
                                <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                                  No hay ítems detallados para esta orden de compra.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* BARRA DE RECEPCIÓN DIRECTA DESDE EL MODAL */}
                    {!compra.recibido && !compra.is_entregado && (
                      <div style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '16px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                        <div>
                          <div style={{ fontWeight: '900', color: '#166534', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Package size={18} /> Recepción Inmediata de esta Mercancía
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#15803d', marginTop: '2px' }}>
                            Seleccione la sede de destino y marque como recibido para registrar el ingreso físico a almacén
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <select 
                            value={ubicacionModalOdc}
                            onChange={(e) => setUbicacionModalOdc(e.target.value)}
                            style={{ padding: '8px 12px', border: '1.5px solid #86efac', borderRadius: '10px', fontSize: '0.82rem', outline: 'none', backgroundColor: 'white', fontWeight: '700', color: '#14532d' }}
                          >
                            {UBICACIONES_AUTORIZADAS.map(loc => (
                              <option key={loc} value={loc}>{loc}</option>
                            ))}
                          </select>

                          <button 
                            type="button"
                            onClick={() => handleRecibir(compra, ubicacionModalOdc)}
                            style={{
                              padding: '8px 18px',
                              backgroundColor: '#16a34a',
                              color: 'white',
                              border: 'none',
                              borderRadius: '10px',
                              fontWeight: '900',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.82rem',
                              boxShadow: '0 4px 10px rgba(22, 163, 74, 0.3)'
                            }}
                          >
                            <CheckCircle2 size={16} /> MARCAR COMO RECIBIDO
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              );
            })() : null}
          </div>
        </div>
      )}

      {/* MODAL DE DETALLES Y VISOR DIGITAL DE SOPORTES (REQUISICIÓN) */}
      {showModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '15px'
          }}
          onClick={() => { setShowModal(false); setModalTicketData(null); }}
        >
          <div
            style={{
              background: 'white',
              width: '95%',
              maxWidth: '1100px',
              borderRadius: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh'
            }}
            onClick={e => e.stopPropagation()}
          >
            {modalLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '15px' }}>
                <Loader2 className="animate-spin" size={40} style={{ color: '#16a34a' }} />
                <span style={{ color: '#64748b', fontWeight: '600', fontSize: '0.9rem' }}>
                  Cargando detalles y soportes...
                </span>
              </div>
            ) : modalTicketData ? (() => {
              const { ticket, req } = modalTicketData;
              const status = ticket.status?.toUpperCase() || 'EMITIDO';
              const statusDisplay = (status === 'PAGADO' || status === 'COMPLETADO' || status === 'COMPLETADA') ? 'Completada' : 'Pendiente';
              
              const rawInvoiceFiles = [
                ...parsearFacturaUrls(ticket.factura_url),
                ...parsearFacturaUrls(req?.facturas_url)
              ];
              const invoiceFiles = [];
              const seenUrls = new Set();
              rawInvoiceFiles.forEach(file => {
                if (file && file.url && !seenUrls.has(file.url)) {
                  seenUrls.add(file.url);
                  invoiceFiles.push(file);
                }
              });

              return (
                <>
                  <div style={{ background: '#1e293b', padding: '20px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                        Expediente: {ticket.codigo_control || `REQ-${String(ticket.id).padStart(4, '0')}`}
                      </h2>
                      <span 
                        style={{
                          display: 'inline-block',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          backgroundColor: statusDisplay === 'Completada' ? '#dcfce7' : '#fee2e2',
                          color: statusDisplay === 'Completada' ? '#16a34a' : '#ef4444'
                        }}
                      >
                        {statusDisplay.toUpperCase()}
                      </span>
                    </div>
                    <button 
                      onClick={() => { setShowModal(false); setModalTicketData(null); }}
                      style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </div>
                  
                  <div style={{ padding: '30px', overflowY: 'auto', flex: 1 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr', gap: '30px' }}>
                      {/* Left Panel: Info & Items */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                          <h3 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Información General
                          </h3>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                            <div className="rm-min-card"><strong>Responsable:</strong> {ticket.responsable_nombre || ticket.gerente_nombre || 'N/A'}</div>
                            <div className="rm-min-card"><strong>Gerencia:</strong> {ticket.departamento || 'N/A'}</div>
                            <div className="rm-min-card"><strong>Centro de Costo:</strong> {ticket.centro_costo || 'N/A'}</div>
                            <div className="rm-min-card"><strong>Proveedor:</strong> {ticket.proveedor_nombre || ticket.proveedor || (ticket.items || []).map(it => it.proveedor_nombre).filter(Boolean)[0] || 'N/A'}</div>
                          </div>
                        </div>

                        <div>
                          <h3 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Trazabilidad Temporal
                          </h3>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                            <div className="rm-min-card"><strong>F. Emisión:</strong> {safeFormatDate(ticket.fecha_emision || ticket.created_at)}</div>
                            <div className="rm-min-card"><strong>F. Ingreso Almacén:</strong> {safeFormatDate(ticket.fecha_pago || ticket.fecha_entrada_almacen || ticket.updated_at)}</div>
                          </div>
                        </div>

                        <div>
                          <h3 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Conceptos y Renglones
                          </h3>
                          <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                            <table className="rm-mini-table">
                              <thead>
                                <tr>
                                  <th>Descripción</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ticket.items?.map((it, idx) => (
                                  <tr key={idx}>
                                    <td style={{ fontSize: '0.8rem' }}>{it.descripcion || it.desc}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {ticket.justificacion && (
                          <div>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Notas de Auditoría
                            </h3>
                            <div style={{ padding: '12px 15px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '12px', fontSize: '0.82rem', color: '#78350f', whiteSpace: 'pre-line', fontWeight: '500', lineHeight: '1.4' }}>
                              {ticket.justificacion}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right Panel: Digital Visor */}
                      <div style={{ display: 'flex', flexDirection: 'column', borderLeft: isMobile ? 'none' : '1px solid #e2e8f0', paddingLeft: isMobile ? '0' : '25px' }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Visor de Soportes Digitales
                        </h3>
                        {invoiceFiles.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                            {invoiceFiles.length > 1 && (
                              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '5px' }}>
                                {invoiceFiles.map((file, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => setSelectedFileIndex(idx)}
                                    style={{
                                      padding: '6px 12px',
                                      borderRadius: '6px',
                                      border: '1px solid',
                                      borderColor: selectedFileIndex === idx ? '#16a34a' : '#e2e8f0',
                                      background: selectedFileIndex === idx ? '#f0fdf4' : 'white',
                                      color: selectedFileIndex === idx ? '#16a34a' : '#475569',
                                      fontSize: '0.75rem',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    Doc {idx + 1}
                                  </button>
                                ))}
                              </div>
                            )}
                            <div style={{ flex: 1, minHeight: '400px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                              {(() => {
                                const url = invoiceFiles[selectedFileIndex]?.url || '';
                                const lowerUrl = url.split('?')[0].toLowerCase();
                                const isPdf = lowerUrl.endsWith('.pdf');
                                const isImg = /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(lowerUrl);

                                if (isPdf) {
                                  return (
                                    <iframe
                                      src={url}
                                      width="100%"
                                      height="430px"
                                      style={{ border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}
                                    />
                                  );
                                }
                                if (isImg) {
                                  return (
                                    <div style={{ display: 'flex', justifyContent: 'center', background: '#f8fafc', padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                      <img
                                        src={url}
                                        alt="Soporte Factura"
                                        style={{ maxWidth: '100%', maxHeight: '410px', objectFit: 'contain', borderRadius: '8px' }}
                                      />
                                    </div>
                                  );
                                }

                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '40px 20px', borderRadius: '12px', border: '1px solid #cbd5e1', textAlign: 'center', minHeight: '300px' }}>
                                    <FileText size={48} color="#16a34a" style={{ marginBottom: '15px' }} />
                                    <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#1e293b' }}>
                                      Documento Adjunto
                                    </span>
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        marginTop: '15px',
                                        padding: '8px 18px',
                                        backgroundColor: '#16a34a',
                                        color: 'white',
                                        borderRadius: '8px',
                                        textDecoration: 'none',
                                        fontWeight: 'bold',
                                        fontSize: '0.85rem'
                                      }}
                                    >
                                      Descargar Archivo
                                    </a>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        ) : (
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '16px', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                            <span style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📁</span>
                            <strong style={{ display: 'block', marginBottom: '5px', color: '#64748b' }}>Sin archivos cargados</strong>
                            No se han adjuntado facturas o comprobantes digitalizados para esta solicitud.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              );
            })() : null}
          </div>
        </div>
      )}

      {/* MODAL DE RECEPCIÓN FÍSICA EN ALMACÉN (TOTAL O PARCIAL) */}
      {showModalRecibir && compraParaRecibir && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '15px'
          }}
          onClick={() => { if (!guardandoRecepcion) { setShowModalRecibir(false); setCompraParaRecibir(null); } }}
        >
          <div
            style={{
              background: 'white',
              width: '95%',
              maxWidth: '650px',
              borderRadius: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '92vh',
              animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Encabezado */}
            <div style={{ background: '#1e293b', padding: '18px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={22} color="white" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.3px' }}>
                    Recepción Física de Mercancía
                  </h2>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                    Req: <strong>{compraParaRecibir.correlativo}</strong> {compraParaRecibir.odc_numero && compraParaRecibir.odc_numero !== 'S/N' ? `| ODC: ${compraParaRecibir.odc_numero}` : ''}
                  </div>
                </div>
              </div>
              <button
                disabled={guardandoRecepcion}
                onClick={() => { setShowModalRecibir(false); setCompraParaRecibir(null); }}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Contenido del Formulario */}
            <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Tarjeta Resumen del Material */}
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px 18px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Ítem / Material a Recibir
                </div>
                <div style={{ fontSize: '1rem', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
                  {compraParaRecibir.descripcion}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Proveedor:</span>{' '}
                    <strong style={{ color: '#1e293b' }}>{compraParaRecibir.proveedor}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Cant. Adquirida:</span>{' '}
                    <strong style={{ color: '#16a34a', fontSize: '0.95rem' }}>{compraParaRecibir.cantidad_comprada} {compraParaRecibir.unidad}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Solicitante:</span>{' '}
                    <strong style={{ color: '#1e293b' }}>{compraParaRecibir.solicitante}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Centro de Costo:</span>{' '}
                    <strong style={{ color: '#1e293b' }}>{compraParaRecibir.centro_costo}</strong>
                  </div>
                </div>
              </div>

              {/* Input: Cantidad Física Recibida */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '6px' }}>
                  Cantidad que se está recibiendo físicamente hoy:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    max={compraParaRecibir.cantidad_comprada}
                    value={cantRecibirInput}
                    onChange={(e) => setCantRecibirInput(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      fontSize: '1.2rem',
                      fontWeight: '800',
                      borderRadius: '12px',
                      border: '2px solid #cbd5e1',
                      outline: 'none',
                      color: '#0f172a',
                      backgroundColor: 'white'
                    }}
                  />
                  <div style={{ padding: '12px 16px', backgroundColor: '#e2e8f0', borderRadius: '12px', fontWeight: '800', color: '#475569', fontSize: '0.9rem' }}>
                    {compraParaRecibir.unidad}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCantRecibirInput(String(compraParaRecibir.cantidad_comprada))}
                    style={{
                      padding: '12px 16px',
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      border: '1px solid #bfdbfe',
                      borderRadius: '12px',
                      fontWeight: '700',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Todo ({compraParaRecibir.cantidad_comprada})
                  </button>
                </div>
              </div>

              {/* Selector: Almacén de Destino */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '6px' }}>
                  Sede / Almacén de Entrada:
                </label>
                <select
                  value={almacenRecibirInput}
                  onChange={(e) => setAlmacenRecibirInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: '0.9rem',
                    fontWeight: '700',
                    borderRadius: '12px',
                    border: '2px solid #cbd5e1',
                    outline: 'none',
                    backgroundColor: 'white',
                    color: '#1e293b'
                  }}
                >
                  <option value="">Seleccione el Almacén de Entrada...</option>
                  {UBICACIONES_AUTORIZADAS.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              {/* BLOQUE CONDICIONAL: SI LA RECEPCIÓN ES PARCIAL */}
              {(() => {
                const cantRec = parseFloat(cantRecibirInput) || 0;
                const cantTotal = parseFloat(compraParaRecibir.cantidad_comprada) || 0;
                const esParcial = cantRec > 0 && cantRec < cantTotal;
                const cantRestante = Math.max(0, cantTotal - cantRec);

                if (!esParcial) return null;

                return (
                  <div style={{ backgroundColor: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '16px', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', fontWeight: '800', fontSize: '0.88rem' }}>
                      <AlertTriangle size={18} />
                      <span>Recepción Incompleta detectada: {cantRec} de {cantTotal} {compraParaRecibir.unidad} (Faltan {cantRestante})</span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#78350f', fontWeight: '600' }}>
                      ¿Qué debe ocurrir con el saldo restante de <strong>{cantRestante} {compraParaRecibir.unidad}</strong>?
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '12px 14px',
                          backgroundColor: opcionRestante === 'esperar' ? '#fef3c7' : 'white',
                          border: opcionRestante === 'esperar' ? '2px solid #d97706' : '1px solid #e2e8f0',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <input
                          type="radio"
                          name="opcionRestante"
                          value="esperar"
                          checked={opcionRestante === 'esperar'}
                          onChange={() => setOpcionRestante('esperar')}
                          style={{ marginTop: '3px' }}
                        />
                        <div style={{ fontSize: '0.82rem' }}>
                          <strong style={{ color: '#92400e', display: 'block' }}>
                            1. Recepción Parcial (Esperar entrega del resto por este mismo proveedor)
                          </strong>
                          <span style={{ color: '#78350f', fontSize: '0.74rem' }}>
                            Se ingresan {cantRec} {compraParaRecibir.unidad} a almacén y las {cantRestante} restantes seguirán como pendientes de recibir de esta misma ODC.
                          </span>
                        </div>
                      </label>

                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '12px 14px',
                          backgroundColor: opcionRestante === 'cerrar_liberar' ? '#fee2e2' : 'white',
                          border: opcionRestante === 'cerrar_liberar' ? '2px solid #ef4444' : '1px solid #e2e8f0',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <input
                          type="radio"
                          name="opcionRestante"
                          value="cerrar_liberar"
                          checked={opcionRestante === 'cerrar_liberar'}
                          onChange={() => setOpcionRestante('cerrar_liberar')}
                          style={{ marginTop: '3px' }}
                        />
                        <div style={{ fontSize: '0.82rem' }}>
                          <strong style={{ color: '#b91c1c', display: 'block' }}>
                            2. Cierre de Orden y Liberar Saldo a Compras (El proveedor no entregará el resto)
                          </strong>
                          <span style={{ color: '#991b1b', fontSize: '0.74rem' }}>
                            La orden de compra queda cerrada en {cantRec} unidades. Las {cantRestante} unidades faltantes se liberan automáticamente en la Requisición para que Compras las adquiera con otro proveedor.
                          </span>
                        </div>
                      </label>
                    </div>

                    {opcionRestante === 'cerrar_liberar' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#991b1b', marginBottom: '5px' }}>
                          Motivo del Cierre / Explicación para Compras y Requisición: *
                        </label>
                        <textarea
                          rows="2"
                          placeholder="Ej: Proveedor no tiene más stock disponible; se cierra compra con 4 unidades y quedan 2 pendientes para otro proveedor."
                          value={motivoCierreInput}
                          onChange={(e) => setMotivoCierreInput(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            fontSize: '0.82rem',
                            borderRadius: '10px',
                            border: '1.5px solid #fca5a5',
                            outline: 'none',
                            backgroundColor: 'white',
                            color: '#1e293b'
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Acciones del Modal */}
            <div style={{ padding: '16px 25px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                disabled={guardandoRecepcion}
                onClick={() => { setShowModalRecibir(false); setCompraParaRecibir(null); }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#e2e8f0',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardandoRecepcion || !almacenRecibirInput || !cantRecibirInput || parseFloat(cantRecibirInput) <= 0}
                onClick={ejecutarRecepcion}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: '800',
                  fontSize: '0.85rem',
                  cursor: (guardandoRecepcion || !almacenRecibirInput || !cantRecibirInput || parseFloat(cantRecibirInput) <= 0) ? 'not-allowed' : 'pointer',
                  opacity: (guardandoRecepcion || !almacenRecibirInput || !cantRecibirInput || parseFloat(cantRecibirInput) <= 0) ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)'
                }}
              >
                {guardandoRecepcion ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> Procesando Entrada...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} /> Confirmar Recepción
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Almacen;
