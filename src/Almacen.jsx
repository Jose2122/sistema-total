import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import { 
  Search, FileText, Loader2, FileSpreadsheet, Trash2, ShieldAlert, History, X, DollarSign
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


const Almacen = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [comprasRaw, setComprasRaw] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroAlmacen, setFiltroAlmacen] = useState('Todos'); // 'Todos', 'Si', 'No'
  const [filtroDestino, setFiltroDestino] = useState('Todos'); // 'Todos', 'Almacen Campo Boscan', 'Almacen Maracaibo', 'Almacen Bajo Grande'
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [vistaTab, setVistaTab] = useState('todos'); // 'todos', 'recibidos', 'pendientes'
  const [activeTab, setActiveTab] = useState('recepcion'); // 'recepcion' | 'historial'
  const [filtroAnalista, setFiltroAnalista] = useState('Todos'); // filtro por quien hizo el ingreso en historial
  
  // Para llevar el control de qué almacén se selecciona para cada compra antes de recibir
  const [selectedAlmacenes, setSelectedAlmacenes] = useState({}); // { [compraId]: 'Almacen ...' }
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Modal de Detalles para Almacén (Reutilizado de ReportesMaestro pero sin precios, banco, etc.)
  const [modalTicketData, setModalTicketData] = useState(null); // { ticket, req }
  const [modalLoading, setModalLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  const handleVerDetalleTicket = async (compra) => {
    setModalLoading(true);
    setShowModal(true);
    setSelectedFileIndex(0);
    try {
      // 1. Fetch ticket matching the requisition reference
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
        // Fallback: build a mock ticket object from the requisition/compra data if no ticket is found
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

      // 2. Fetch related requisition
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
            setCurrentUser(perfil);
          }
        }
      } catch (err) {
        console.error("Error cargando perfil del usuario:", err);
      }
    };
    fetchUser();
  }, []);

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
      horas = horas ? horas : 12; // 0 should be 12
      const horaStr = pad(horas);
      
      return `${dia}/${mes}/${anio} ${horaStr}:${minutos} ${ampm}`;
    } catch {
      return '—';
    }
  };

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Cargar Requisiciones Aprobadas con Ítems (donde reside la data de compra)
      const { data: reqs, error: errC } = await supabase
        .from('requisiciones')
        .select('*')
        .eq('estado_aprobacion', 'aprobado_final')
        .order('fecha_emision', { ascending: false });

      if (errC) throw errC;

      // 2. Mapear compras completadas (del historial de compras o del ítem legado)
      let list = [];
      (reqs || []).forEach(r => {
        const items = Array.isArray(r.items) ? r.items : [];
        items.forEach((it, itIdx) => {
          const historial = Array.isArray(it.historial_compras) ? it.historial_compras : [];
          const compras = historial.filter(h => h.tipo !== 'JUSTIFICACION' && h.tipo !== 'ANULACION');
          
          if (compras.length > 0) {
            // Formato multitransacción: cada transacción en el historial es una compra
            compras.forEach((h) => {
              const statusAlmacen = h.estatus_almacen || (h.enviado_almacen ? 'Ubicado' : 'Pendiente_Compras');
              // Only load items that are ready for or already classified in the warehouse
              if (statusAlmacen === 'Por_Clasificar_Almacen' || statusAlmacen === 'Ubicado') {
                // Buscar índice real en el historial de compras original
                const realHIdx = it.historial_compras.findIndex(itemH => itemH === h);
                list.push({
                  id: `${r.id}-${itIdx}-${realHIdx}`,
                  transaction_id: h.id || `${r.id}-${itIdx}-${realHIdx}`,
                  req_id: r.id,
                  correlativo: r.correlativo_req || `REQ-${String(r.id).padStart(3, '0')}`,
                  item_idx: itIdx,
                  history_idx: realHIdx,
                  is_legacy: false,
                  
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
                  
                  recibido: statusAlmacen === 'Ubicado',
                  estatus_almacen: statusAlmacen,
                  ubicacion_almacen: h.ubicacion_almacen || h.almacen_destino || '',
                  fecha_entrada_almacen: h.fecha_entrada_almacen || '',
                  usuario_almacen_nombre: h.usuario_almacen_nombre || ''
                });
              }
            });
          } else if (it.doc_numero || it.numero_factura) {
            // Formato legado: el ítem mismo es una compra única
            const statusAlmacen = it.estatus_almacen || (it.enviado_almacen ? 'Ubicado' : 'Pendiente_Compras');
            if (statusAlmacen === 'Por_Clasificar_Almacen' || statusAlmacen === 'Ubicado') {
              list.push({
                id: `${r.id}-${itIdx}-legacy`,
                transaction_id: `${r.id}-${itIdx}-legacy`,
                req_id: r.id,
                correlativo: r.correlativo_req || `REQ-${String(r.id).padStart(3, '0')}`,
                item_idx: itIdx,
                history_idx: -1,
                is_legacy: true,
                
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
                
                recibido: statusAlmacen === 'Ubicado',
                estatus_almacen: statusAlmacen,
                ubicacion_almacen: it.ubicacion_almacen || it.almacen_destino || '',
                fecha_entrada_almacen: it.fecha_entrada_almacen || '',
                usuario_almacen_nombre: it.usuario_almacen_nombre || ''
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

    // SUSCRIPCIÓN REALTIME PARA ALMACÉN
    const channel = supabase
      .channel('almacen_realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'requisiciones'
      }, (payload) => {
        cargarDatos();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'requisiciones'
      }, (payload) => {
        cargarDatos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cargarDatos]);

  // Filtrado de las compras
  const filteredCompras = useMemo(() => {
    return comprasRaw.filter(c => {
      // Filtro por pestaña (todos, recibidos, pendientes)
      if (vistaTab === 'recibidos' && !c.recibido) return false;
      if (vistaTab === 'pendientes' && c.recibido) return false;

      const matchBusqueda = 
        c.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.proveedor.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.numero_factura.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.solicitante.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.centro_costo.toLowerCase().includes(busqueda.toLowerCase());

      const matchAlmacen = 
        filtroAlmacen === 'Todos' ||
        (filtroAlmacen === 'Si' ? c.recibido : !c.recibido);

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

  // Totales
  const totalGeneralFiltrado = useMemo(() => {
    return filteredCompras.reduce((sum, c) => sum + (c.total || 0), 0);
  }, [filteredCompras]);

  const stats = useMemo(() => {
    const total = comprasRaw.length;
    const recibidos = comprasRaw.filter(c => c.recibido).length;
    const pendientes = total - recibidos;
    const boscan = comprasRaw.filter(c => c.ubicacion_almacen && cleanAccents(c.ubicacion_almacen).includes('boscan')).length;
    const maracaibo = comprasRaw.filter(c => c.ubicacion_almacen && cleanAccents(c.ubicacion_almacen).includes('maracaibo')).length;
    const bajoGrande = comprasRaw.filter(c => c.ubicacion_almacen && cleanAccents(c.ubicacion_almacen).includes('grande')).length;

    return { total, recibidos, pendientes, boscan, maracaibo, bajoGrande };
  }, [comprasRaw]);

  // Group only the received items sorted by received date desc for history list
  const historialAsignaciones = useMemo(() => {
    const base = comprasRaw
      .filter(c => c.recibido && c.fecha_entrada_almacen)
      .sort((a, b) => new Date(b.fecha_entrada_almacen) - new Date(a.fecha_entrada_almacen));
    if (filtroAnalista === 'Todos') return base;
    return base.filter(c => (c.usuario_almacen_nombre || '') === filtroAnalista);
  }, [comprasRaw, filtroAnalista]);

  // Lista de analistas únicos para el filtro de historial
  const listaAnalistas = useMemo(() => {
    const nombres = comprasRaw
      .filter(c => c.recibido && c.usuario_almacen_nombre)
      .map(c => c.usuario_almacen_nombre);
    return ['Todos', ...Array.from(new Set(nombres)).sort()];
  }, [comprasRaw]);

  const handleRecibir = async (compra) => {
    const destinoSel = selectedAlmacenes[compra.id];
    if (!destinoSel) {
      toast.error("Por favor, seleccione un almacén de destino antes de recibir.");
      return;
    }

    setLoading(true);
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
      const userNombre = currentUser ? `${currentUser.nombre} ${currentUser.apellido}` : 'Desconocido';
      const userId = currentUser ? currentUser.id : null;

      if (compra.is_legacy) {
        item.estatus_almacen = 'Ubicado';
        item.ubicacion_almacen = destinoSel;
        item.enviado_almacen = true;
        item.almacen_destino = destinoSel;
        item.fecha_entrada_almacen = nowIso;
        item.usuario_almacen_nombre = userNombre;
        item.usuario_almacen_id = userId;
      } else {
        const hist = [...(item.historial_compras || [])];
        if (hist[compra.history_idx]) {
          hist[compra.history_idx] = {
            ...hist[compra.history_idx],
            estatus_almacen: 'Ubicado',
            ubicacion_almacen: destinoSel,
            enviado_almacen: true,
            almacen_destino: destinoSel,
            fecha_entrada_almacen: nowIso,
            usuario_almacen_nombre: userNombre,
            usuario_almacen_id: userId
          };
          item.historial_compras = hist;
          // Si todos los ítems válidos fueron procesados a almacén
          const valid = hist.filter(h => h.tipo !== 'JUSTIFICACION' && h.tipo !== 'ANULACION');
          const allLocated = valid.every(c => c.estatus_almacen === 'Ubicado' || c.enviado_almacen === true);
          item.estatus_almacen = allLocated ? 'Ubicado' : 'Por_Clasificar_Almacen';
          item.ubicacion_almacen = destinoSel;
          item.enviado_almacen = allLocated;
          item.almacen_destino = destinoSel;
          item.fecha_entrada_almacen = nowIso;
          item.usuario_almacen_nombre = userNombre;
          item.usuario_almacen_id = userId;
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

      toast.success("Ingreso registrado exitosamente.");

      // Notificaciones entre almacenes
      try {
        const { data: perfilesAlmacen } = await supabase
          .from('perfiles')
          .select('id')
          .or("departamento.ilike.%almacen%,rol.ilike.%almacen%");
        
        const { data: userData } = await supabase.auth.getUser();
        const currentUserId = userData?.user?.id;
        
        if (perfilesAlmacen && perfilesAlmacen.length > 0) {
          const notifs = perfilesAlmacen
            .filter(p => p.id !== currentUserId)
            .map(p => ({
              usuario_id: p.id,
              mensaje: `El material de Requisición ${compra.correlativo} (${compra.descripcion.substring(0, 30)}...) fue recibido en: ${destinoSel}`,
              tipo: 'Almacén',
              leido: false,
              requisicion_id: compra.req_id
            }));
          
          if (notifs.length > 0) {
            await supabase.from('notificaciones').insert(notifs);
          }
        }
      } catch (notifErr) {
        console.error("Error al notificar al personal de almacén:", notifErr);
      }

      setSelectedAlmacenes(prev => {
        const copy = { ...prev };
        delete copy[compra.id];
        return copy;
      });
      cargarDatos();
    } catch (err) {
      console.error(err);
      toast.error("Error al recibir: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeshacer = async (compra) => {
    setLoading(true);
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
        item.estatus_almacen = 'Por_Clasificar_Almacen';
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
            estatus_almacen: 'Por_Clasificar_Almacen',
            ubicacion_almacen: null,
            enviado_almacen: false,
            almacen_destino: null,
            fecha_entrada_almacen: null,
            usuario_almacen_nombre: null,
            usuario_almacen_id: null
          };
          item.historial_compras = hist;
          item.estatus_almacen = 'Por_Clasificar_Almacen';
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

      toast.success("Recepción revertida exitosamente.");
      cargarDatos();
    } catch (err) {
      console.error(err);
      toast.error("Error al deshacer: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Exportar Excel
  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte Almacén');

    // Title Row
    worksheet.mergeCells('A1:O1');
    const titleCell = worksheet.getCell('A1');
    const titleValStr = vistaTab === 'todos' 
      ? 'TOTAL CLEAN C.A. - REPORTE DE COMPRAS COMPLETADAS'
      : vistaTab === 'recibidos'
        ? 'TOTAL CLEAN C.A. - REPORTE DE COMPRAS INGRESADAS A ALMACÉN'
        : 'TOTAL CLEAN C.A. - REPORTE DE COMPRAS PENDIENTES EN ALMACÉN';
    titleCell.value = titleValStr;
    titleCell.font = { name: 'Arial Black', size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } }; // Green header
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 40;

    const headers = [
      'ALMACÉN',
      'REQUISICIÓN',
      'DESCRIPCIÓN',
      'PROVEEDOR',
      'NRO DE FACTURA',
      'LISTO PARA ALMACÉN (COMPRA)',
      'INGRESO ALMACÉN (FECHA/HORA)',
      'RECIBIDO POR',
      'ALMACÉN DESTINO',
      'SOLICITANTE',
      'GERENCIA',
      'CENTRO DE COSTO',
      'MONEDA DE PAGO',
      'CANTIDAD COMPRADA',
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
        c.recibido ? 'SÍ' : 'NO',
        c.correlativo,
        c.descripcion,
        c.proveedor,
        c.numero_factura,
        formatFechaHora(c.fecha_compra),
        c.recibido ? formatFechaHora(c.fecha_entrada_almacen) : '—',
        c.recibido ? (c.usuario_almacen_nombre || 'Desconocido') : '—',
        c.ubicacion_almacen || 'PENDIENTE',
        c.solicitante,
        c.gerencia,
        c.centro_costo,
        c.moneda_pago,
        c.cantidad_comprada,
        c.total
      ]);

      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(5).alignment = { horizontal: 'center' };
      row.getCell(6).alignment = { horizontal: 'center' };
      row.getCell(7).alignment = { horizontal: 'center' };
      row.getCell(8).alignment = { horizontal: 'center' };
      row.getCell(9).alignment = { horizontal: 'center' };
      row.getCell(13).alignment = { horizontal: 'center' };
      row.getCell(14).alignment = { horizontal: 'right' };
      row.getCell(15).alignment = { horizontal: 'right' };

      row.getCell(15).numFmt = '"$"#,##0.00;[Red]"$"#,##0.00';

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
      { width: 12 }, // ALMACÉN
      { width: 18 }, // REQUISICIÓN
      { width: 35 }, // DESCRIPCIÓN
      { width: 25 }, // PROVEEDOR
      { width: 18 }, // NRO DE FACTURA
      { width: 25 }, // LISTO PARA ALMACÉN (COMPRA)
      { width: 25 }, // INGRESO ALMACÉN (FECHA/HORA)
      { width: 22 }, // RECIBIDO POR
      { width: 25 }, // ALMACÉN DESTINO
      { width: 22 }, // SOLICITANTE
      { width: 22 }, // GERENCIA
      { width: 25 }, // CENTRO DE COSTO
      { width: 18 }, // MONEDA DE PAGO
      { width: 22 }, // CANTIDAD COMPRADA
      { width: 18 }  // TOTAL ($)
    ];

    const lastRowNum = filteredCompras.length + 3;
    worksheet.mergeCells(`A${lastRowNum}:N${lastRowNum}`);
    const totalLabel = worksheet.getCell(`A${lastRowNum}`);
    totalLabel.value = 'TOTAL GENERAL COMPLETADO ($):';
    totalLabel.font = { bold: true };
    totalLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    const totalVal = worksheet.getCell(`O${lastRowNum}`);
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
    doc.setFillColor(22, 163, 74); // Vibrant Green background
    doc.rect(0, 0, 297, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    
    const titleValStr = vistaTab === 'todos' 
      ? 'TOTAL CLEAN C.A. - REPORTE DE COMPRAS COMPLETADAS'
      : vistaTab === 'recibidos'
        ? 'TOTAL CLEAN C.A. - REPORTE DE COMPRAS INGRESADAS A ALMACÉN'
        : 'TOTAL CLEAN C.A. - REPORTE DE COMPRAS PENDIENTES EN ALMACÉN';
        
    doc.text(titleValStr, 15, 17);
    doc.setFontSize(9);
    doc.text(`Generado: ${new Date().toLocaleString()}`, 240, 17);

    const tableData = filteredCompras.map(c => [
      c.recibido ? 'SÍ' : 'NO',
      c.correlativo,
      c.descripcion.substring(0, 30),
      c.proveedor.substring(0, 15),
      c.numero_factura,
      formatFechaHora(c.fecha_compra),
      c.recibido ? formatFechaHora(c.fecha_entrada_almacen) : '—',
      c.recibido ? (c.usuario_almacen_nombre || 'Desconocido') : '—',
      c.ubicacion_almacen || 'PENDIENTE',
      c.solicitante.substring(0, 12),
      c.gerencia.substring(0, 12),
      c.centro_costo.substring(0, 12),
      c.moneda_pago,
      c.cantidad_comprada,
      `$ ${(c.total || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      head: [['ALM', 'REQUISICIÓN', 'DESCRIPCIÓN', 'PROVEEDOR', 'FACTURA', 'LISTO COMPRA', 'INGRESO ALM', 'RECIBIDO POR', 'ALM. DESTINO', 'SOLICITANTE', 'GERENCIA', 'C. COSTO', 'MONEDA', 'CANT', 'TOTAL ($)']],
      body: tableData,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], fontSize: 6.5, halign: 'center' },
      styles: { fontSize: 6, cellPadding: 1 },
      columnStyles: {
        0: { halign: 'center' },
        1: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'center' },
        7: { halign: 'center' },
        8: { halign: 'center' },
        12: { halign: 'center' },
        13: { halign: 'right' },
        14: { halign: 'right', fontStyle: 'bold' }
      },
      foot: [['', '', '', '', '', '', '', '', '', '', '', '', 'TOTAL GRAL.', '', `$ ${(totalGeneralFiltrado || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`]],
      footStyles: { fillColor: [240, 253, 244], textColor: [22, 163, 74], fontStyle: 'bold' }
    });

    doc.save(`Reporte_Compras_Completadas_TC_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success("Documento PDF exportado con éxito.");
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f8fafc', minHeight: '100vh', color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>
      
      {/* HEADER PRINCIPAL */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '20px', marginBottom: '30px' }}>
        <div style={{ borderLeft: '6px solid #16a34a', paddingLeft: '16px' }}>
          <h1 style={{ margin: 0, color: '#0f172a', fontSize: '1.8rem', fontWeight: '900', letterSpacing: '-0.5px' }}>
            Reportes e Ingresos de Almacén
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem', fontWeight: '500' }}>
            Visualización y control de recepción física de materiales comprados
          </p>
        </div>

        {/* ACCIONES EXPORTACIÓN */}
        <div style={{ display: 'flex', gap: '10px', width: isMobile ? '100%' : 'auto' }}>
          <button onClick={exportToExcel} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 18px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.2)' }}>
            <FileSpreadsheet size={16} /> Excel Reporte
          </button>
          <button onClick={exportToPDF} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 18px', backgroundColor: '#334155', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}>
            <FileText size={16} /> PDF Cierre
          </button>
        </div>
      </div>

      {/* TARJETAS ESTADÍSTICAS KPI — estilo unificado con demás módulos */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(6, 1fr)', gap: '15px', marginBottom: '25px' }}>
        {[
          { label: 'Compras Totales',      value: stats.total,      sub: 'en sistema',           color: '#3b82f6' },
          { label: 'Recibido Almacén',    value: stats.recibidos,  sub: 'ingresados',            color: '#16a34a' },
          { label: 'Pendiente Ingreso',    value: stats.pendientes, sub: 'por clasificar',        color: '#f59e0b' },
          { label: 'Campo Boscán',        value: stats.boscan,     sub: 'almacén ubicados',     color: '#06b6d4' },
          { label: 'Maracaibo',            value: stats.maracaibo,  sub: 'almacén ubicados',     color: '#8b5cf6' },
          { label: 'Bajo Grande',          value: stats.bajoGrande, sub: 'almacén ubicados',     color: '#ec4899' },
        ].map(({ label, value, sub, color }) => (
          <div
            key={label}
            style={{
              backgroundColor: 'white',
              padding: '20px 22px',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
              borderLeft: `6px solid ${color}`,
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              transition: 'transform 0.2s, box-shadow 0.2s',
              cursor: 'default',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.02)'; }}
          >
            <div style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>{label}</div>
            <div style={{ fontSize: '1.45rem', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.02em', marginTop: '2px' }}>{value}</div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '500' }}>{sub}</div>
          </div>
        ))}
      </div>



      {/* FILTROS E BUSQUEDAS */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', marginBottom: '15px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr 1fr 1fr', gap: '15px', alignItems: 'center' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Búsqueda de Compra</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Buscar descripción, factura, proveedor..." 
                value={busqueda} 
                onChange={e => setBusqueda(e.target.value)} 
                style={{ width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '0.85rem', boxSizing: 'border-box', outline: 'none' }}
              />
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Estado de Ingreso</label>
            <select 
              value={filtroAlmacen} 
              onChange={e => setFiltroAlmacen(e.target.value)} 
              style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '0.85rem', outline: 'none', backgroundColor: 'white' }}
            >
              <option value="Todos">Todos</option>
              <option value="Si">Recibido en Almacén (SÍ)</option>
              <option value="No">Pendiente de Ingreso (NO)</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Almacén Físico</label>
            <select 
              value={filtroDestino} 
              onChange={e => setFiltroDestino(e.target.value)} 
              style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '0.85rem', outline: 'none', backgroundColor: 'white' }}
            >
              <option value="Todos">Todos los Almacenes</option>
              <option value="Almacen Campo Boscan">Campo Boscán</option>
              <option value="Almacen Maracaibo">Maracaibo</option>
              <option value="Almacen Bajo Grande">Bajo Grande</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Rango de Fechas Recepción</label>
            <div style={{ display: 'flex', gap: '5px' }}>
              <input 
                type="date" 
                value={fechaDesde} 
                onChange={e => setFechaDesde(e.target.value)} 
                style={{ width: '50%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '0.8rem', outline: 'none' }}
              />
              <input 
                type="date" 
                value={fechaHasta} 
                onChange={e => setFechaHasta(e.target.value)} 
                style={{ width: '50%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '0.8rem', outline: 'none' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* BARRA UNIFICADA DE PESTAÑAS — debajo de filtros */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '15px', backgroundColor: 'white', padding: '6px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', flexWrap: 'wrap' }}>
        {/* Grupo: Recepción / Historial */}
        <button
          onClick={() => setActiveTab('recepcion')}
          style={{
            padding: '8px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            fontWeight: '800', fontSize: '0.8rem', transition: 'all 0.2s', whiteSpace: 'nowrap',
            backgroundColor: activeTab === 'recepcion' ? '#16a34a' : 'transparent',
            color: activeTab === 'recepcion' ? 'white' : '#64748b',
            boxShadow: activeTab === 'recepcion' ? '0 4px 12px rgba(22,163,74,0.35)' : 'none',
          }}
        >
          📦 Recepción
        </button>
        <button
          onClick={() => setActiveTab('historial')}
          style={{
            padding: '8px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            fontWeight: '800', fontSize: '0.8rem', transition: 'all 0.2s', whiteSpace: 'nowrap',
            backgroundColor: activeTab === 'historial' ? '#16a34a' : 'transparent',
            color: activeTab === 'historial' ? 'white' : '#64748b',
            boxShadow: activeTab === 'historial' ? '0 4px 12px rgba(22,163,74,0.35)' : 'none',
          }}
        >
          🗂️ Historial
        </button>

        {/* Divisor vertical y Grupo de vistas rápidas solo para Recepción */}
        {activeTab === 'recepcion' && (
          <>
            <div style={{ width: '1px', height: '26px', backgroundColor: '#e2e8f0', margin: '0 4px', flexShrink: 0 }} />

            <button
              onClick={() => setVistaTab('todos')}
              style={{
                padding: '7px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                fontWeight: '700', fontSize: '0.78rem', transition: 'all 0.2s', whiteSpace: 'nowrap',
                backgroundColor: vistaTab === 'todos' ? '#0f172a' : 'transparent',
                color: vistaTab === 'todos' ? 'white' : '#64748b',
              }}
            >
              Relación General
            </button>
            <button
              onClick={() => setVistaTab('recibidos')}
              style={{
                padding: '7px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                fontWeight: '700', fontSize: '0.78rem', transition: 'all 0.2s', whiteSpace: 'nowrap',
                backgroundColor: vistaTab === 'recibidos' ? '#0f172a' : 'transparent',
                color: vistaTab === 'recibidos' ? 'white' : '#64748b',
              }}
            >
              Ingresados 📦
            </button>
            <button
              onClick={() => setVistaTab('pendientes')}
              style={{
                padding: '7px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                fontWeight: '700', fontSize: '0.78rem', transition: 'all 0.2s', whiteSpace: 'nowrap',
                backgroundColor: vistaTab === 'pendientes' ? '#0f172a' : 'transparent',
                color: vistaTab === 'pendientes' ? 'white' : '#64748b',
              }}
            >
              Pendientes 📥
            </button>
          </>
        )}
      </div>

      {/* TABLA PRINCIPAL — solo en pestaña Recepción */}
      {activeTab === 'recepcion' && (
      <div style={{ backgroundColor: 'white', borderRadius: '24px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
        
        {/* ENCABECERA VERDE EXCEL-STYLE */}
        <div style={{ backgroundColor: '#16a34a', color: 'white', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '900', letterSpacing: '0.5px' }}>
            {vistaTab === 'todos' 
              ? 'TOTAL CLEAN C.A. - REPORTE DE COMPRAS COMPLETADAS'
              : vistaTab === 'recibidos'
                ? 'TOTAL CLEAN C.A. - REPORTE DE COMPRAS INGRESADAS A ALMACÉN'
                : 'TOTAL CLEAN C.A. - REPORTE DE COMPRAS PENDIENTES EN ALMACÉN'}
          </h3>
          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', opacity: 0.9 }}>
            Filtradas: {filteredCompras.length} de {comprasRaw.length}
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', color: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                <th style={{ padding: '12px 10px', textAlign: 'center', width: '80px' }}>ALMACÉN</th>
                <th style={{ padding: '12px 10px', textAlign: 'center', width: '120px' }}>REQUISICIÓN</th>
                <th style={{ padding: '12px 10px', textAlign: 'left', minWidth: '220px' }}>DESCRIPCIÓN</th>
                <th style={{ padding: '12px 10px', textAlign: 'left' }}>PROVEEDOR</th>
                <th style={{ padding: '12px 10px', textAlign: 'center' }}>NRO DE FACTURA</th>
                <th style={{ padding: '12px 10px', textAlign: 'center', minWidth: '140px' }}>LISTO PARA ALMACÉN</th>
                <th style={{ padding: '12px 10px', textAlign: 'center', minWidth: '180px' }}>INGRESO ALMACÉN (FECHA/USUARIO)</th>
                <th style={{ padding: '12px 10px', textAlign: 'center', minWidth: '210px' }}>ALMACÉN DESTINO / INGRESO</th>
                <th style={{ padding: '12px 10px', textAlign: 'left', minWidth: '180px' }}>SOLICITANTE / GERENCIA</th>
                <th style={{ padding: '12px 10px', textAlign: 'left' }}>CENTRO DE COSTO</th>
                <th style={{ padding: '12px 10px', textAlign: 'right' }}>CANTIDAD</th>
                <th style={{ padding: '12px 10px', textAlign: 'right' }}>TOTAL ($)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="12" style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                      <Loader2 className="animate-spin" /> Cargando compras completadas...
                    </div>
                  </td>
                </tr>
              ) : filteredCompras.length === 0 ? (
                <tr>
                  <td colSpan="12" style={{ padding: '50px', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>
                    <ShieldAlert size={24} style={{ display: 'block', margin: '0 auto 10px auto', color: '#94a3b8' }} />
                    No se encontraron registros de compras bajo los filtros actuales.
                  </td>
                </tr>
              ) : filteredCompras.map((compra) => {
                const isRecibida = compra.recibido;
                const selectedLoc = selectedAlmacenes[compra.id] || '';

                return (
                  <tr key={compra.transaction_id || compra.id} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background-color 0.2s', backgroundColor: isRecibida ? '#f0fdf4' : 'transparent' }} className="row-hover">
                    {/* ALMACÉN */}
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {isRecibida ? (
                        <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: '6px', backgroundColor: '#16a34a', color: 'white', fontWeight: '900', fontSize: '0.7rem' }}>SÍ</span>
                      ) : (
                        <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: '6px', backgroundColor: '#94a3b8', color: 'white', fontWeight: '900', fontSize: '0.7rem' }}>NO</span>
                      )}
                    </td>
                    
                    {/* REQUISICIÓN */}
                    <td 
                      onClick={() => handleVerDetalleTicket(compra)}
                      style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#1e40af', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      {compra.correlativo}
                    </td>

                    {/* DESCRIPCIÓN */}
                    <td style={{ padding: '10px', fontWeight: '600', color: '#0f172a' }}>
                      {compra.descripcion}
                    </td>

                    {/* PROVEEDOR */}
                    <td style={{ padding: '10px', color: '#475569' }}>
                      {compra.proveedor}
                    </td>

                    {/* NRO DE FACTURA */}
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: '700', color: '#2563eb' }}>
                      {compra.numero_factura}
                    </td>

                    {/* LISTO PARA ALMACÉN — hora en que se hizo clic en Recibir */}
                    <td style={{ padding: '10px', textAlign: 'center', color: '#334155', fontWeight: '600' }}>
                      {isRecibida ? formatFechaHora(compra.fecha_entrada_almacen) : <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.75rem' }}>Pendiente</span>}
                    </td>

                    {/* INGRESO ALMACÉN (FECHA/USUARIO) */}
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {isRecibida ? (
                        <div>
                          <div style={{ fontWeight: '700', color: '#16a34a' }}>
                            {formatFechaHora(compra.fecha_entrada_almacen)}
                          </div>
                          {compra.usuario_almacen_nombre && (
                            <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '2px', fontWeight: 'bold' }}>
                              👤 Por: {compra.usuario_almacen_nombre}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.75rem' }}>{"Pendiente de ubicar"}</span>
                      )}
                    </td>

                    {/* ALMACÉN DESTINO / REGISTRO INGRESO */}
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {isRecibida ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '700', color: '#16a34a', fontSize: '0.8rem' }}>
                            {compra.ubicacion_almacen}
                          </span>
                          <button 
                            onClick={() => handleDeshacer(compra)} 
                            title="Revertir Ingreso"
                            style={{ padding: '4px 8px', backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', alignItems: 'center' }}>
                          <select 
                            value={selectedLoc}
                            onChange={(e) => setSelectedAlmacenes(prev => ({ ...prev, [compra.id]: e.target.value }))}
                            style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', maxWidth: '180px' }}
                          >
                            <option value="">Clasificar ubicación...</option>
                            {UBICACIONES_AUTORIZADAS.map(loc => (
                              <option key={loc} value={loc}>{loc}</option>
                            ))}
                          </select>
                          <button 
                            onClick={() => handleRecibir(compra)}
                            disabled={!selectedLoc}
                            style={{ 
                              padding: '6px 12px', 
                              backgroundColor: selectedLoc ? '#16a34a' : '#94a3b8', 
                              color: 'white', 
                              border: 'none', 
                              borderRadius: '8px', 
                              fontWeight: 'bold', 
                              cursor: selectedLoc ? 'pointer' : 'not-allowed',
                              transition: 'all 0.2s'
                            }}
                          >
                            Recibir
                          </button>
                        </div>
                      )}
                    </td>

                    {/* SOLICITANTE / GERENCIA — columna unificada */}
                    <td style={{ padding: '10px', color: '#475569' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.82rem' }}>{compra.solicitante}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>🏢 {compra.gerencia}</div>
                    </td>

                    {/* CENTRO DE COSTO */}
                    <td style={{ padding: '10px', color: '#475569', fontSize: '0.8rem' }}>
                      {compra.centro_costo}
                    </td>

                    {/* CANTIDAD COMPRADA */}
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>
                      {compra.cantidad_comprada}
                    </td>

                    {/* TOTAL ($) */}
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', color: '#16a34a' }}>
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
                  <td colSpan="11" style={{ padding: '15px 20px', textAlign: 'right', fontSize: '0.9rem' }}>
                    TOTAL GENERAL COMPLETADO ($):
                  </td>
                  <td style={{ padding: '15px 10px', textAlign: 'right', fontSize: '1rem', color: '#16a34a' }}>
                    $ {totalGeneralFiltrado.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      )}

      {/* HISTORIAL / BITÁCORA — pestaña separada */}
      {activeTab === 'historial' && (
        <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '25px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
          {/* Cabecera con filtro de analista */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b', fontSize: '1.1rem', fontWeight: '800' }}>
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
                        El material <strong style={{ color: '#0f172a' }}>{h.descripcion}</strong> (Req. <strong style={{ color: '#1e40af' }}>{h.correlativo}</strong>)
                        {' '}fue ubicado en <strong style={{ color: '#16a34a' }}>{h.ubicacion_almacen}</strong>.
                      </p>
                      <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.75rem', color: '#64748b', fontWeight: '500' }}>
                        <span>👤 Analista: <strong style={{ color: '#1e293b' }}>{h.usuario_almacen_nombre || 'SITC Operator'}</strong></span>
                        <span>🧑‍💼 Solicitante: <strong style={{ color: '#1e293b' }}>{h.solicitante}</strong></span>
                        <span>🏢 {h.gerencia}</span>
                        <span>📅 {diaStr} a las {horaStr}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', padding: '4px 8px', borderRadius: '6px', backgroundColor: '#e2e8f0', color: '#475569' }}>
                        Cant: {h.cantidad_comprada}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', padding: '4px 8px', borderRadius: '6px', backgroundColor: '#dcfce7', color: '#16a34a' }}>
                        Factura: {h.numero_factura}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', padding: '4px 8px', borderRadius: '6px', backgroundColor: '#eff6ff', color: '#2563eb' }}>
                        $ {(h.total || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      
      {/* Estilos adicionales */}
      <style>{`
        .row-hover:hover {
          background-color: #f1f5f9 !important;
        }
      `}</style>

      {/* MODAL DETALLE DE COMPRA / TICKET SIN PRECIOS/BANCO (Reutilizado de ReportesMaestro) */}
      {showModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
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
            {(() => {
              if (modalLoading) {
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '15px' }}>
                    <Loader2 className="animate-spin" size={40} style={{ color: '#16a34a' }} />
                    <span style={{ color: '#64748b', fontWeight: '600', fontSize: '0.9rem' }}>
                      Cargando detalles y soportes...
                    </span>
                  </div>
                );
              }

              if (!modalTicketData) return null;

              const { ticket, req } = modalTicketData;
              const status = ticket.status?.toUpperCase() || 'EMITIDO';
              const statusDisplay = (status === 'PAGADO' || status === 'COMPLETADO' || status === 'COMPLETADA') ? 'Completada' : 'Pendiente';
              
              // Combined invoice and support URLs from ticket and requisition
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
                        Referencia: {ticket.codigo_control || `TX-${String(ticket.id).padStart(4, '0')}`}
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px' }}>
                      {/* Left Panel: Info & Items & Signatures */}
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
                            <div className="rm-min-card"><strong>F. Pago:</strong> {statusDisplay === 'Completada' ? safeFormatDate(ticket.fecha_pago || ticket.updated_at) : 'Pendiente'}</div>
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

                        <div>
                          <h3 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Firmas y Aprobaciones
                          </h3>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            {req ? (
                              <>
                                <div style={{ padding: '10px', border: '1px dashed #cbd5e1', borderRadius: '10px', background: '#f8fafc', textAlign: 'center' }}>
                                  <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Aprob. Proyecto</div>
                                  {req.f_aprobacion_proyecto ? (
                                    <>
                                      <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 'bold', margin: '4px 0' }}>✓ Aprobado</div>
                                      <div style={{ fontSize: '0.7rem', color: '#334155', fontWeight: 600 }}>{req.n_aprobacion_proyecto?.split(' ')[0]}</div>
                                      <div style={{ fontSize: '0.6rem', color: '#64748b' }}>{safeFormatDate(req.f_aprobacion_proyecto)}</div>
                                    </>
                                  ) : (
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '10px 0' }}>N/A</div>
                                  )}
                                </div>

                                <div style={{ padding: '10px', border: '1px dashed #cbd5e1', borderRadius: '10px', background: '#f8fafc', textAlign: 'center' }}>
                                  <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Aprob. Área</div>
                                  {req.f_aprobacion_area ? (
                                    <>
                                      <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 'bold', margin: '4px 0' }}>✓ Aprobado</div>
                                      <div style={{ fontSize: '0.7rem', color: '#334155', fontWeight: 600 }}>{req.n_aprobacion_area?.split(' ')[0]}</div>
                                      <div style={{ fontSize: '0.6rem', color: '#64748b' }}>{safeFormatDate(req.f_aprobacion_area)}</div>
                                    </>
                                  ) : (
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '10px 0' }}>N/A</div>
                                  )}
                                </div>

                                <div style={{ padding: '10px', border: '1px dashed #cbd5e1', borderRadius: '10px', background: '#f8fafc', textAlign: 'center' }}>
                                  <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Aprob. General</div>
                                  {req.f_aprobacion_general ? (
                                    <>
                                      <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 'bold', margin: '4px 0' }}>✓ Aprobado</div>
                                      <div style={{ fontSize: '0.7rem', color: '#334155', fontWeight: 600 }}>{req.n_aprobacion_general?.split(' ')[0]}</div>
                                      <div style={{ fontSize: '0.6rem', color: '#64748b' }}>{safeFormatDate(req.f_aprobacion_general)}</div>
                                    </>
                                  ) : (
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '10px 0' }}>N/A</div>
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                <div style={{ padding: '10px', border: '1px dashed #cbd5e1', borderRadius: '10px', background: '#f8fafc', textAlign: 'center' }}>
                                  <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Creado Por</div>
                                  <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 'bold', margin: '4px 0' }}>✓ Emitido</div>
                                  <div style={{ fontSize: '0.7rem', color: '#334155', fontWeight: 600 }}>{ticket.gerente_nombre || ticket.responsable_nombre}</div>
                                  <div style={{ fontSize: '0.6rem', color: '#64748b' }}>{safeFormatDate(ticket.fecha_emision || ticket.created_at)}</div>
                                </div>

                                <div style={{ padding: '10px', border: '1px dashed #cbd5e1', borderRadius: '10px', background: '#f8fafc', textAlign: 'center', gridColumn: 'span 2' }}>
                                  <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Liquidado Por</div>
                                  {statusDisplay === 'Completada' ? (
                                    <>
                                      <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 'bold', margin: '4px 0' }}>✓ Pagado (Liquidado)</div>
                                      <div style={{ fontSize: '0.6rem', color: '#64748b' }}>{safeFormatDate(ticket.fecha_pago || ticket.updated_at)}</div>
                                    </>
                                  ) : (
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '10px 0' }}>Pendiente de Liquidación</div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Panel: Digital Visor */}
                      <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e2e8f0', paddingLeft: '25px' }}>
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
                                const isExcel = /\.(xls|xlsx|csv)$/i.test(lowerUrl);
                                const isWord = /\.(doc|docx)$/i.test(lowerUrl);
                                const isPowerPoint = /\.(ppt|pptx)$/i.test(lowerUrl);

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

                                let fileInfo = { iconColor: '#64748b', label: 'Documento Adjunto', desc: 'Este archivo no se puede previsualizar en el navegador.' };
                                if (isExcel) {
                                  fileInfo = { iconColor: '#16a34a', label: 'Hoja de Cálculo Excel', desc: 'Este archivo de Excel no se puede previsualizar directamente en el navegador.' };
                                } else if (isWord) {
                                  fileInfo = { iconColor: '#2563eb', label: 'Documento Word', desc: 'Este documento de Word no se puede previsualizar directamente en el navegador.' };
                                } else if (isPowerPoint) {
                                  fileInfo = { iconColor: '#f97316', label: 'Presentación PowerPoint', desc: 'Esta presentación de PowerPoint no se puede previsualizar directamente en el navegador.' };
                                }

                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '40px 20px', borderRadius: '12px', border: '1px solid #cbd5e1', textAlign: 'center', minHeight: '300px' }}>
                                    <FileText size={48} color={fileInfo.iconColor} style={{ marginBottom: '15px' }} />
                                    <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#1e293b' }}>
                                      {fileInfo.label}
                                    </span>
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '8px 0 20px 0', maxWidth: '300px' }}>
                                      {fileInfo.desc} Por favor use el botón de abajo para descargarlo o abrirlo en una nueva pestaña.
                                    </p>
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
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
                              {invoiceFiles[selectedFileIndex] && (
                                <div style={{ marginTop: '8px', textAlign: 'right' }}>
                                  <a
                                    href={invoiceFiles[selectedFileIndex].url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: '700', textDecoration: 'underline' }}
                                  >
                                    Ver en pestaña nueva ↗
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '16px', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                            <span style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📁</span>
                            <strong style={{ display: 'block', marginBottom: '5px', color: '#64748b' }}>Sin archivos cargados</strong>
                            No se han adjuntado facturas o comprobantes digitalizados para este ticket.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default Almacen;
