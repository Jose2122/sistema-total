import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import {
  FileSpreadsheet,
  Calendar,
  Filter,
  Clock,
  Search,
  ChevronDown,
  LayoutDashboard,
  Tag,
  AlertCircle,
  TrendingDown,
  MessageSquare,
  Paperclip,
  DollarSign,
  BarChart3
} from 'lucide-react';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import './Reportes.css';
import './ReportesMaestro.css';

const Reportes = () => {
  const [loading, setLoading] = useState(false);
  const [dataRaw, setDataRaw] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [tabActiva, setTabActiva] = useState('operativo'); // 'operativo' | 'lead_times'

  // Auxiliares de seguridad para formateo de fechas
  const safeFormatDate = (d, fmt = 'dd/MM/yyyy') => {
    if (!d) return '-';
    try {
      const parsed = typeof d === 'string' ? parseISO(d) : new Date(d);
      if (isNaN(parsed.getTime())) return '-';
      return format(parsed, fmt);
    } catch (e) {
      return '-';
    }
  };
  const [expandirHistorial, setExpandirHistorial] = useState({}); // { rowID: boolean }

  const toggleExpandirHistorial = (idReq, index) => {
    const key = `${idReq}-${index}`;
    setExpandirHistorial(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // --- FILTROS ---
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [filtroCC, setFiltroCC] = useState('Todos');
  const [filtroGerencia, setFiltroGerencia] = useState('Todos');
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  const [filtroPrioridad, setFiltroPrioridad] = useState('Todos');
  const [busqueda, setBusqueda] = useState('');
  const [filtroJustificacion, setFiltroJustificacion] = useState('Todos');
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [filtroAlmacen, setFiltroAlmacen] = useState('Todos');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [listaCentrosCostos, setListaCentrosCostos] = useState([]);

  // --- TABLAS DE REFERENCIA (Sincronizadas con Requisiciones.jsx) ---
  // Se cargarán dinámicamente

  const [listaGerencias, setListaGerencias] = useState([]);

  const categoriasUnicas = useMemo(() => {
    const cats = new Set();
    dataRaw.forEach(req => {
      (req.items || []).forEach(item => {
        if (item.categoria) cats.add(item.categoria);
      });
    });
    return Array.from(cats).sort();
  }, [dataRaw]);

  // --- CARGA DE DATOS ---
  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [resReq, resTickets, resCC, resGer] = await Promise.all([
        supabase
          .from('requisiciones')
          .select('*')
          .eq('estado_aprobacion', 'aprobado_final')
          .order('fecha_emision', { ascending: false }),
        supabase
          .from('tickets_directos')
          .select('*')
          .order('fecha_emision', { ascending: false }),
        supabase
          .from('maestros_centros_costo')
          .select('id, nombre')
          .eq('activo', true)
          .order('nombre'),
        supabase
          .from('cat_gerencias')
          .select('nombre')
          .order('nombre')
      ]);

      if (resReq.error) throw resReq.error;
      if (resTickets.error) throw resTickets.error;
      if (resCC.data) setListaCentrosCostos(resCC.data);
      if (resGer.data) setListaGerencias(resGer.data.map(g => g.nombre));

      const combined = [
        ...(resReq.data || []).map(r => ({ ...r, _tipoDoc: 'requisicion' }))
      ];

      setDataRaw(combined);
    } catch (err) {
      console.error("Error cargando reportes:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleAlmacenSubRow = async (requisicionId, itemIdx, historyIndex, valor) => {
    // 1. Actualización local
    setDataRaw(prev => prev.map(doc => {
      if (doc._tipoDoc === 'requisicion' && doc.id === requisicionId) {
        const nuevosItems = [...(doc.items || [])];
        if (nuevosItems[itemIdx]) {
          const item = { ...nuevosItems[itemIdx] };
          const nuevoHistorial = [...(item.historial_compras || [])];
          if (nuevoHistorial[historyIndex]) {
            nuevoHistorial[historyIndex] = { ...nuevoHistorial[historyIndex], enviado_almacen: valor };
          }
          item.historial_compras = nuevoHistorial;
          nuevosItems[itemIdx] = item;
        }
        return { ...doc, items: nuevosItems };
      }
      return doc;
    }));

    // 2. Actualización en DB
    try {
      const doc = dataRaw.find(d => d._tipoDoc === 'requisicion' && d.id === requisicionId);
      if (!doc) return;

      const nuevosItems = [...(doc.items || [])];
      if (nuevosItems[itemIdx]) {
        const item = { ...nuevosItems[itemIdx] };
        const nuevoHistorial = [...(item.historial_compras || [])];
        if (nuevoHistorial[historyIndex]) {
          nuevoHistorial[historyIndex] = { ...nuevoHistorial[historyIndex], enviado_almacen: valor };
        }
        item.historial_compras = nuevoHistorial;
        nuevosItems[itemIdx] = item;

        const { error } = await supabase
          .from('requisiciones')
          .update({ items: nuevosItems })
          .eq('id', requisicionId);
        if (error) throw error;
        toast.success(valor ? "Sub-ítem: En Almacén" : "Sub-ítem: Pendiente");
      }
    } catch (err) {
      toast.error("Error al actualizar sub-fila: " + err.message);
    }
  };

  useEffect(() => {
    cargarDatos();

    const channel = supabase
      .channel('reportes_realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'requisiciones'
      }, (payload) => {
        setDataRaw(prev => prev.map(doc => {
          if (doc._tipoDoc === 'requisicion' && doc.id === payload.new.id) {
            return {
              ...doc,
              observaciones: payload.new.observaciones,
              facturas_url: payload.new.facturas_url,
              items: payload.new.items
            };
          }
          return doc;
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cargarDatos]);

  // --- LÓGICA DE APLANAMIENTO Y FILTRADO ---
  const rows = useMemo(() => {
    const allRows = [];
    dataRaw.forEach(doc => {
      if (doc._tipoDoc === 'requisicion') {
        (doc.items || []).forEach((item, itemIdx) => {
          const historial = item.historial_compras || [];
          const compras = historial.filter(h => h.tipo !== 'JUSTIFICACION');
          const ultimoPU = compras.length > 0 ? compras[compras.length - 1].pu : 0;

          const cantPendiente = Number(item.cantidad_pendiente ?? item.cant) || 0;
          const puEstimado = Number(item.pu_estimado || item.pu || 0);
          const totalEstimadoRemanente = cantPendiente * puEstimado;
          const totalEjecutadoReal = compras.reduce((sum, h) => sum + ((Number(h.cant) || 0) * (Number(h.pu) || 0)), 0);
          const totalDinamicoItem = totalEjecutadoReal + totalEstimadoRemanente;
          const cantOriginal = Number(item.cantidad_pedida || item.cant || 0);
          const totalEstimadoPuro = cantOriginal * puEstimado;

          allRows.push({
            idReq: doc.correlativo_req || `REQ-${String(doc.id).padStart(3, '0')}`,
            fechaSolicitud: doc.fecha_emision ? doc.fecha_emision.split('T')[0] : 'N/A',
            fechaPago: compras.length > 0 ? compras[compras.length - 1].fecha.split('T')[0] : (doc.status_compra === 'Completado' ? (doc.fecha_emision ? doc.fecha_emision.split('T')[0] : 'N/A') : 'Pendiente'),
            descripcion: item.descripcion,
            centroCosto: doc.centro_costo,
            gerencia: doc.gerencia || 'No asignada',
            cantPedida: Number(item.cantidad_pedida || item.cant || 0),
            cantComprada: Number(item.cantidad_comprada || 0),
            puReal: Number(ultimoPU || item.pu || 0),
            categoria: item.categoria || 'S/C',
            prioridad: doc.prioridad || 'Normal',
            totalEstimado: totalEstimadoPuro,
            totalEjecutado: totalEjecutadoReal,
            total: totalDinamicoItem,
            rawItem: item,
            tipoDoc: 'REQUISICIÓN',
            metodoPago: compras.length > 0 ? compras[compras.length - 1].metodo_pago : 'N/A',
            statusCompra: doc.status_compra || 'En espera',
            historial_compras: historial,
            observaciones: doc.observaciones || '',
            facturas_url: doc.facturas_url || [],
            solicitante: doc.solicitante || 'N/A',
            comprador: doc.asignado_nombre || 'Sin Asignar',
            nroFactura: compras.map(c => c.doc_numero).filter(Boolean).join(', ') || 'N/A',
            almacen: item.enviado_almacen || (historial.length > 0 && historial.every(h => h.enviado_almacen)),
            idReal: doc.id,
            itemIdx: itemIdx,
            cantPendiente: cantPendiente
          });
        });
      } else {
        // Tickets Directos
        (doc.items || []).forEach(item => {
          allRows.push({
            idReq: doc.codigo_control || `TP-${String(doc.id).padStart(4, '0')}`,
            fechaSolicitud: doc.fecha_emision ? doc.fecha_emision.split('T')[0] : 'N/A',
            fechaPago: doc.fecha_emision ? doc.fecha_emision.split('T')[0] : 'N/A',
            descripcion: item.desc || item.descripcion,
            centroCosto: item.cc || doc.centro_costo || 'N/A',
            gerencia: doc.departamento || 'No asignada',
            cantPedida: Number(item.cant || 1),
            cantComprada: Number(item.cant || 1),
            puReal: Number(item.pu || 0),
            categoria: item.cat || item.categoria || 'S/C',
            prioridad: doc.prioridad || 'Normal',
            totalEstimado: Number(item.total || (Number(item.cant || 1) * Number(item.pu || 0))),
            totalEjecutado: Number(item.total || (Number(item.cant || 1) * Number(item.pu || 0))),
            total: Number(item.total || (Number(item.cant || 1) * Number(item.pu || 0))),
            rawItem: item,
            tipoDoc: 'TICKET PAGO',
            metodoPago: '$ / BS', // Por defecto en tickets directos
            statusCompra: 'Completado',
            historial_compras: [],
            observaciones: doc.observaciones || '',
            facturas_url: doc.facturas_url || [],
            solicitante: doc.responsable_nombre || 'N/A',
            comprador: doc.responsable_nombre || 'Directo',
            nroFactura: doc.ref_pago || 'N/A',
            almacen: false,
            cantPendiente: 0
          });
        });
      }
    });

    return allRows.filter(r => {
      const matchBusqueda = r.descripcion.toLowerCase().includes(busqueda.toLowerCase()) || r.idReq.toLowerCase().includes(busqueda.toLowerCase());
      const matchCC = filtroCC === 'Todos' || r.centroCosto.includes(filtroCC);
      const matchGerencia = filtroGerencia === 'Todos' || r.gerencia === filtroGerencia;
      const matchCat = filtroCategoria === 'Todos' || r.categoria === filtroCategoria;
      const matchPrio = filtroPrioridad === 'Todos' || r.prioridad === filtroPrioridad;

      const matchJustif = filtroJustificacion === 'Todos' || r.historial_compras.some(h => h.tipo === 'JUSTIFICACION' && h.motivo === filtroJustificacion);
      const matchStatus = filtroStatus === 'Todos' || r.statusCompra === filtroStatus;

      let matchFecha = true;
      if (fechaDesde && r.fechaPago < fechaDesde) matchFecha = false;
      if (fechaHasta && r.fechaPago > fechaHasta) matchFecha = false;

      const matchAlmacen = filtroAlmacen === 'Todos' || (filtroAlmacen === 'Si' ? r.almacen : !r.almacen);
      return matchBusqueda && matchCC && matchGerencia && matchCat && matchPrio && matchFecha && matchJustif && matchStatus && matchAlmacen;
    });
  }, [dataRaw, busqueda, filtroCC, filtroGerencia, filtroCategoria, filtroPrioridad, fechaDesde, fechaHasta, filtroJustificacion, filtroStatus, filtroAlmacen, listaCentrosCostos]);

  const totals = useMemo(() => {
    return rows.reduce((acc, r) => {
      if (r.metodoPago === '$ / BS') {
        acc.bsTotal += r.total;
      } else if (r.metodoPago === '$ / $') {
        acc.usdTotal += r.total;
      }
      acc.generalTotal += r.total;
      return acc;
    }, { bsTotal: 0, usdTotal: 0, generalTotal: 0 });
  }, [rows]);

  const gastoTotal = totals.generalTotal;

  // --- REPORTE DE LEAD TIMES & SLA (18 COLUMNAS EXACTAS) ---
  const slaRows = useMemo(() => {
    const list = [];

    dataRaw.forEach(doc => {
      if (doc._tipoDoc === 'requisicion') {
        const fechaEmision = doc.fecha_emision ? doc.fecha_emision.split('T')[0] : (doc.created_at ? doc.created_at.split('T')[0] : '');
        const fechaAprobGteGtl = doc.f_aprobacion_general ? doc.f_aprobacion_general.split('T')[0] : (doc.fecha_aprobacion_gerente ? doc.fecha_aprobacion_gerente.split('T')[0] : (doc.trazabilidad?.fecha_aprobacion_general ? doc.trazabilidad.fecha_aprobacion_general.split('T')[0] : ''));
        const asignacionGCompras = doc.f_inicio_compras ? doc.f_inicio_compras.split('T')[0] : (doc.fecha_asignacion ? doc.fecha_asignacion.split('T')[0] : (doc.comprador_asignado_fecha ? doc.comprador_asignado_fecha.split('T')[0] : ''));

        const items = Array.isArray(doc.items) ? doc.items : [];
        items.forEach((item, itemIdx) => {
          const historial = Array.isArray(item.historial_compras) ? item.historial_compras : [];
          const compras = historial.filter(h => h.tipo !== 'JUSTIFICACION' && h.tipo !== 'ANULACION' && h.tipo !== 'DIRECTRIZ');

          const cantPedida = Number(item.cantidad_pedida || item.cant || 0);
          const cantComprada = Number(item.cantidad_comprada || 0) || compras.reduce((sum, h) => sum + (Number(h.cant) || 0), 0);

          let statusText = 'Pendiente';
          if (cantComprada > 0) {
            if (cantComprada < cantPedida) {
              statusText = 'Parcial';
            } else {
              statusText = 'Comprado';
            }
          }

          const isAlmacen = Boolean(item.enviado_almacen || item.almacenable || item.aplica_almacen || (compras.length > 0 && compras.some(h => h.enviado_almacen || h.estatus_almacen === 'Ubicado')));
          const nroFactura = compras.map(c => c.doc_numero).filter(Boolean).join(', ') || '0';

          // Fecha de Compra / Pago / Finalización
          const ultimaCompra = compras.length > 0 ? compras[compras.length - 1] : null;
          const fechaCompra = ultimaCompra?.fecha ? ultimaCompra.fecha.split('T')[0] : (doc.status_compra === 'Completado' ? (fechaEmision || null) : null);

          // Cálculo de TE Order Sys (días transcurridos)
          let teOrderSys = null;
          const fechaBaseCalculo = asignacionGCompras || fechaAprobGteGtl || fechaEmision;
          if (fechaBaseCalculo) {
            const tInicio = new Date(fechaBaseCalculo + 'T00:00:00');
            if (fechaCompra) {
              const tFin = new Date(fechaCompra + 'T00:00:00');
              const diffTime = tFin - tInicio;
              teOrderSys = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
            } else {
              const tHoy = new Date();
              const diffTime = tHoy - tInicio;
              teOrderSys = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
            }
          }

          // TE Order según Proveedor (días prometidos)
          const teOrderProveedor = Number(ultimaCompra?.tiempo_entrega_dias || item.tiempo_entrega_dias || doc.tiempo_entrega_dias || ultimaCompra?.dias_entrega || 0);

          // Fecha Entrega Almacén
          const fechaEntregaAlmacen = ultimaCompra?.fecha_entrega_almacen ? ultimaCompra.fecha_entrega_almacen.split('T')[0] : (item.fecha_recepcion_almacen ? item.fecha_recepcion_almacen.split('T')[0] : (isAlmacen && fechaCompra ? fechaCompra : ''));

          // Moneda de pago
          let monedaPago = ultimaCompra?.metodo_pago || item.metodo_pago_actual || '$/BS';
          if (monedaPago === 'N/A' || !monedaPago) monedaPago = '$/BS';

          // Total
          const puEstimado = Number(item.pu_estimado || item.pu || 0);
          const totalEjecutadoReal = compras.reduce((sum, h) => sum + ((Number(h.cant) || 0) * (Number(h.pu) || 0)), 0);
          const totalEstimadoPuro = cantPedida * puEstimado;
          const totalItem = totalEjecutadoReal > 0 ? totalEjecutadoReal : totalEstimadoPuro;

          list.push({
            correlativo: doc.correlativo_req || `REQ-${String(doc.id).padStart(3, '0')}`,
            almacen: isAlmacen ? 'SÍ' : 'NO',
            almacenBool: isAlmacen,
            descripcion: item.descripcion || '—',
            nroFactura: nroFactura,
            fecha: fechaEmision,
            fechaAprobGteGtl: fechaAprobGteGtl,
            asignacionGCompras: asignacionGCompras,
            teOrderSys: teOrderSys,
            teOrderProveedor: teOrderProveedor,
            fechaEntregaAlmacen: fechaEntregaAlmacen,
            solicitante: doc.solicitante || '—',
            categoria: item.categoria || doc.categoria || 'S/C',
            gerencia: doc.gerencia || 'No asignada',
            centroCosto: doc.centro_costo || '—',
            monedaPago: monedaPago,
            status: statusText,
            cantidadComprada: cantComprada,
            cantPedida: cantPedida,
            total: totalItem,
            idReal: doc.id,
            itemIdx: itemIdx
          });
        });
      } else {
        // Tickets directos
        const items = Array.isArray(doc.items) ? doc.items : [];
        items.forEach((item, itemIdx) => {
          const fecha = doc.fecha_emision ? doc.fecha_emision.split('T')[0] : '';
          list.push({
            correlativo: doc.codigo_control || `TP-${String(doc.id).padStart(4, '0')}`,
            almacen: 'NO',
            almacenBool: false,
            descripcion: item.desc || item.descripcion || '—',
            nroFactura: doc.ref_pago || '0',
            fecha: fecha,
            fechaAprobGteGtl: doc.f_aprobacion_general ? doc.f_aprobacion_general.split('T')[0] : fecha,
            asignacionGCompras: fecha,
            teOrderSys: 0,
            teOrderProveedor: 0,
            fechaEntregaAlmacen: '',
            solicitante: doc.responsable_nombre || '—',
            categoria: item.cat || item.categoria || 'S/C',
            gerencia: doc.departamento || 'No asignada',
            centroCosto: item.cc || doc.centro_costo || '—',
            monedaPago: '$/BS',
            status: 'Comprado',
            cantidadComprada: Number(item.cant || 1),
            cantPedida: Number(item.cant || 1),
            total: Number(item.total || (Number(item.cant || 1) * Number(item.pu || 0))),
            idReal: doc.id,
            itemIdx: itemIdx
          });
        });
      }
    });

    return list.filter(r => {
      const matchBusqueda = r.descripcion.toLowerCase().includes(busqueda.toLowerCase()) || r.correlativo.toLowerCase().includes(busqueda.toLowerCase()) || r.nroFactura.toLowerCase().includes(busqueda.toLowerCase()) || r.solicitante.toLowerCase().includes(busqueda.toLowerCase());
      const matchCC = filtroCC === 'Todos' || r.centroCosto.includes(filtroCC);
      const matchGerencia = filtroGerencia === 'Todos' || r.gerencia === filtroGerencia;
      const matchCat = filtroCategoria === 'Todos' || r.categoria === filtroCategoria;
      const matchStatus = filtroStatus === 'Todos' || r.status === filtroStatus;
      const matchAlmacen = filtroAlmacen === 'Todos' || (filtroAlmacen === 'Si' ? r.almacenBool : !r.almacenBool);

      let matchFecha = true;
      if (fechaDesde && r.fecha && r.fecha < fechaDesde) matchFecha = false;
      if (fechaHasta && r.fecha && r.fecha > fechaHasta) matchFecha = false;

      return matchBusqueda && matchCC && matchGerencia && matchCat && matchStatus && matchAlmacen && matchFecha;
    });
  }, [dataRaw, busqueda, filtroCC, filtroGerencia, filtroCategoria, filtroStatus, filtroAlmacen, fechaDesde, fechaHasta]);

  const slaKpis = useMemo(() => {
    const totalItems = slaRows.length;
    const itemsConSys = slaRows.filter(r => typeof r.teOrderSys === 'number');
    const promedioSys = itemsConSys.length > 0 ? Math.round((itemsConSys.reduce((sum, r) => sum + r.teOrderSys, 0) / itemsConSys.length) * 10) / 10 : 0;

    const itemsConProv = slaRows.filter(r => r.teOrderProveedor > 0);
    const promedioProv = itemsConProv.length > 0 ? Math.round((itemsConProv.reduce((sum, r) => sum + r.teOrderProveedor, 0) / itemsConProv.length) * 10) / 10 : 0;

    const almacenCount = slaRows.filter(r => r.almacenBool).length;
    const totalGasto = slaRows.reduce((sum, r) => sum + r.total, 0);

    return {
      totalItems,
      promedioSys,
      promedioProv,
      almacenCount,
      totalGasto
    };
  }, [slaRows]);

  // --- EXPORTACIÓN A EXCEL ---
  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte Operativo');

    // Logo/Header Row
    worksheet.mergeCells('A1:M1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'TOTAL CLEAN C.A. - REPORTE DE GESTIÓN OPERATIVA';
    titleCell.font = { name: 'Arial Black', size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0EA5E9' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 40;

    // Encabezados según solicitud
    const headers = [
      'CORRELATIVO #',
      'ALMACÉN',
      'DESCRIPCIÓN',
      'NRO DE FACTURA',
      'FECHA',
      'SOLICITANTE',
      'CATEGORÍA',
      'GERENCIA',
      'CENTRO DE COSTO',
      'MONEDA DE PAGO',
      'STATUS',
      'CANTIDAD COMPRADA',
      'TOTAL ($)'
    ];
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(2);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 25;

    // Datos
    rows.forEach(r => {
      const cantPedida = Number(r.cantPedida) || 0;
      const cantComprada = Number(r.cantComprada) || 0;
      let statusText = 'Pendiente';
      if (cantComprada > 0) {
        if (cantComprada < cantPedida) {
          statusText = 'Parcial';
        } else {
          statusText = 'Comprado';
        }
      }

      let monedaPago = r.metodoPago || '—';
      if (monedaPago === 'N/A' || !monedaPago || monedaPago === '—') {
        monedaPago = r.rawItem?.metodo_pago_actual || '—';
      }

      const row = worksheet.addRow([
        r.idReq,
        r.almacen ? 'SÍ' : 'NO',
        r.descripcion,
        r.nroFactura,
        r.fechaPago !== 'Pendiente' && r.fechaPago !== 'N/A' ? new Date(r.fechaPago + 'T12:00:00') : r.fechaPago,
        r.solicitante,
        r.categoria,
        r.gerencia,
        r.centroCosto,
        monedaPago,
        statusText,
        r.cantComprada,
        r.total
      ]);

      // Aplicar formato de fecha
      if (r.fechaPago !== 'Pendiente' && r.fechaPago !== 'N/A') {
        row.getCell(5).numFmt = 'dd/mm/yyyy';
      }

      // Format ID as text
      row.getCell(1).numFmt = '@';
      row.getCell(13).numFmt = '"$"#,##0.00;[Red]"$"#,##0.00';

      // Alignment & borders
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(5).alignment = { horizontal: 'center' };
      row.getCell(10).alignment = { horizontal: 'center' };
      row.getCell(11).alignment = { horizontal: 'center' };
      row.getCell(12).alignment = { horizontal: 'right' };
      row.getCell(13).alignment = { horizontal: 'right' };

      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    });

    // Ajuste de columnas
    worksheet.columns = [
      { width: 16 }, // CORRELATIVO #
      { width: 12 }, // ALMACÉN
      { width: 40 }, // DESCRIPCIÓN
      { width: 20 }, // NRO DE FACTURA
      { width: 15 }, // FECHA
      { width: 25 }, // SOLICITANTE
      { width: 20 }, // CATEGORÍA
      { width: 25 }, // GERENCIA
      { width: 25 }, // CENTRO DE COSTO
      { width: 20 }, // MONEDA DE PAGO
      { width: 15 }, // STATUS
      { width: 22 }, // CANTIDAD COMPRADA
      { width: 18 }  // TOTAL ($)
    ];

    // Totales
    const lastRowNum = rows.length + 3;
    worksheet.mergeCells(`A${lastRowNum}:L${lastRowNum}`);
    const totalLabel = worksheet.getCell(`A${lastRowNum}`);
    totalLabel.value = 'TOTAL GENERAL EXPENDIDO ($):';
    totalLabel.font = { bold: true };
    totalLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    const totalVal = worksheet.getCell(`M${lastRowNum}`);
    totalVal.value = gastoTotal;
    totalVal.font = { bold: true, color: { argb: 'FF15803D' } };
    totalVal.numFmt = '"$"#,##0.00';
    totalVal.alignment = { horizontal: 'right', vertical: 'middle' };

    // Apply border to total row
    const totalRow = worksheet.getRow(lastRowNum);
    totalRow.height = 25;
    totalRow.eachCell(cell => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF94A3B8' } }
      };
    });

    // Generar Archivo
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Reporte_Compras_TC_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportPendingToExcel = async () => {
    const faltantes = rows.filter(r => r.cantComprada < r.cantPedida);
    if (faltantes.length === 0) {
      toast.error("No hay compras faltantes (pendientes/parciales) en la selección actual.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Compras Faltantes');

    // Logo/Header Row
    worksheet.mergeCells('A1:L1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'TOTAL CLEAN C.A. - REPORTE DE COMPRAS FALTANTES';
    titleCell.font = { name: 'Arial Black', size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } }; // Orange/Yellow
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 40;

    // Encabezados según solicitud
    const headers = [
      'CORRELATIVO #',
      'DESCRIPCIÓN',
      'SOLICITANTE',
      'COMPRADOR',
      'CATEGORÍA',
      'GERENCIA',
      'CENTRO DE COSTO',
      'STATUS',
      'CANTIDAD PEDIDA',
      'CANTIDAD COMPRADA',
      'CANTIDAD PENDIENTE',
      'TOTAL ($)'
    ];
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(2);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 25;

    // Datos
    faltantes.forEach(r => {
      const cantPedida = Number(r.cantPedida) || 0;
      const cantComprada = Number(r.cantComprada) || 0;
      let statusText = 'Pendiente';
      if (cantComprada > 0) {
        if (cantComprada < cantPedida) {
          statusText = 'Parcial';
        } else {
          statusText = 'Comprado';
        }
      }

      const row = worksheet.addRow([
        r.idReq,
        r.descripcion,
        r.solicitante,
        r.comprador || 'Sin Asignar',
        r.categoria,
        r.gerencia,
        r.centroCosto,
        statusText,
        r.cantPedida,
        r.cantComprada,
        r.cantPendiente,
        r.total
      ]);

      // Format ID as text
      row.getCell(1).numFmt = '@';
      row.getCell(12).numFmt = '"$"#,##0.00;[Red]"$"#,##0.00';

      // Alignment & borders
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(8).alignment = { horizontal: 'center' };
      row.getCell(9).alignment = { horizontal: 'right' };
      row.getCell(10).alignment = { horizontal: 'right' };
      row.getCell(11).alignment = { horizontal: 'right' };
      row.getCell(12).alignment = { horizontal: 'right' };

      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    });

    // Ajuste de columnas
    worksheet.columns = [
      { width: 18 }, // CORRELATIVO #
      { width: 40 }, // DESCRIPCIÓN
      { width: 25 }, // SOLICITANTE
      { width: 25 }, // COMPRADOR
      { width: 20 }, // CATEGORÍA
      { width: 25 }, // GERENCIA
      { width: 25 }, // CENTRO DE COSTO
      { width: 15 }, // STATUS
      { width: 18 }, // CANTIDAD PEDIDA
      { width: 22 }, // CANTIDAD COMPRADA
      { width: 22 }, // CANTIDAD PENDIENTE
      { width: 18 }  // TOTAL ($)
    ];

    // Totales
    const totalGastoFaltantes = faltantes.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
    const lastRowNum = faltantes.length + 3;
    worksheet.mergeCells(`A${lastRowNum}:K${lastRowNum}`);
    const totalLabel = worksheet.getCell(`A${lastRowNum}`);
    totalLabel.value = 'TOTAL ESTIMADO FALTANTES ($):';
    totalLabel.font = { bold: true };
    totalLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    const totalVal = worksheet.getCell(`L${lastRowNum}`);
    totalVal.value = totalGastoFaltantes;
    totalVal.font = { bold: true, color: { argb: 'FF15803D' } };
    totalVal.numFmt = '"$"#,##0.00';
    totalVal.alignment = { horizontal: 'right', vertical: 'middle' };

    // Apply border to total row
    const totalRow = worksheet.getRow(lastRowNum);
    totalRow.height = 25;
    totalRow.eachCell(cell => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF94A3B8' } }
      };
    });

    // Generar Archivo
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Compras_Faltantes_TC_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Excel de compras faltantes generado.");
  };

  const exportByInvoicesToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte por Factura');

    // Logo/Header Row
    worksheet.mergeCells('A1:N1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'TOTAL CLEAN C.A. - REPORTE DETALLADO POR FACTURA';
    titleCell.font = { name: 'Arial Black', size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }; // Blue Header
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 40;

    const headers = [
      'CORRELATIVO #',
      'FACTURA / DOC',
      'PROVEEDOR',
      'DESCRIPCIÓN',
      'CANTIDAD',
      'P. UNITARIO ($)',
      'TOTAL ($)',
      'FECHA PAGO',
      'SOLICITANTE',
      'CATEGORÍA',
      'GERENCIA',
      'CENTRO DE COSTO',
      'MONEDA DE PAGO',
      'ALMACÉN'
    ];
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(2);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 25;

    let totalGastoFacturas = 0;

    rows.forEach(r => {
      if (r.tipoDoc === 'REQUISICIÓN') {
        const trans = (r.historial_compras || []).filter(h => h.tipo !== 'JUSTIFICACION' && h.tipo !== 'ANULACION' && h.tipo !== 'DIRECTRIZ');
        trans.forEach(h => {
          const cant = Number(h.cant) || 0;
          const pu = Number(h.pu) || 0;
          const totalRow = cant * pu;
          totalGastoFacturas += totalRow;

          const row = worksheet.addRow([
            r.idReq,
            h.doc_numero || 'S/N',
            h.proveedor_nombre || 'Desconocido',
            r.descripcion,
            cant,
            pu,
            totalRow,
            h.fecha ? new Date(h.fecha.split('T')[0] + 'T12:00:00') : '—',
            r.solicitante,
            r.categoria,
            r.gerencia,
            r.centroCosto,
            h.metodo_pago || '—',
            h.enviado_almacen || h.estatus_almacen === 'Ubicado' ? 'SÍ' : 'NO'
          ]);

          if (h.fecha) {
            row.getCell(8).numFmt = 'dd/mm/yyyy';
          }
          row.getCell(1).numFmt = '@';
          row.getCell(2).numFmt = '@';
          row.getCell(6).numFmt = '"$"#,##0.00';
          row.getCell(7).numFmt = '"$"#,##0.00;[Red]"$"#,##0.00';

          row.getCell(1).alignment = { horizontal: 'center' };
          row.getCell(2).alignment = { horizontal: 'center' };
          row.getCell(5).alignment = { horizontal: 'right' };
          row.getCell(6).alignment = { horizontal: 'right' };
          row.getCell(7).alignment = { horizontal: 'right' };
          row.getCell(8).alignment = { horizontal: 'center' };
          row.getCell(13).alignment = { horizontal: 'center' };
          row.getCell(14).alignment = { horizontal: 'center' };

          row.eachCell(cell => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
          });
        });
      } else {
        // Tickets Directos
        const totalRow = r.total;
        totalGastoFacturas += totalRow;

        const row = worksheet.addRow([
          r.idReq,
          r.nroFactura,
          r.rawItem?.proveedor || 'N/A',
          r.descripcion,
          r.cantPedida,
          r.puReal,
          totalRow,
          r.fechaPago !== 'Pendiente' && r.fechaPago !== 'N/A' ? new Date(r.fechaPago + 'T12:00:00') : r.fechaPago,
          r.solicitante,
          r.categoria,
          r.gerencia,
          r.centroCosto,
          r.metodoPago,
          r.almacen ? 'SÍ' : 'NO'
        ]);

        if (r.fechaPago !== 'Pendiente' && r.fechaPago !== 'N/A') {
          row.getCell(8).numFmt = 'dd/mm/yyyy';
        }
        row.getCell(1).numFmt = '@';
        row.getCell(2).numFmt = '@';
        row.getCell(6).numFmt = '"$"#,##0.00';
        row.getCell(7).numFmt = '"$"#,##0.00;[Red]"$"#,##0.00';

        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(2).alignment = { horizontal: 'center' };
        row.getCell(5).alignment = { horizontal: 'right' };
        row.getCell(6).alignment = { horizontal: 'right' };
        row.getCell(7).alignment = { horizontal: 'right' };
        row.getCell(8).alignment = { horizontal: 'center' };
        row.getCell(13).alignment = { horizontal: 'center' };
        row.getCell(14).alignment = { horizontal: 'center' };

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

    worksheet.columns = [
      { width: 16 }, // CORRELATIVO #
      { width: 18 }, // FACTURA / DOC
      { width: 25 }, // PROVEEDOR
      { width: 40 }, // DESCRIPCIÓN
      { width: 12 }, // CANTIDAD
      { width: 15 }, // P. UNITARIO ($)
      { width: 15 }, // TOTAL ($)
      { width: 15 }, // FECHA PAGO
      { width: 25 }, // SOLICITANTE
      { width: 20 }, // CATEGORÍA
      { width: 25 }, // GERENCIA
      { width: 25 }, // CENTRO DE COSTO
      { width: 18 }, // MONEDA DE PAGO
      { width: 12 }  // ALMACÉN
    ];

    const lastRowNum = worksheet.rowCount + 2;
    worksheet.mergeCells(`A${lastRowNum}:F${lastRowNum}`);
    const totalLabel = worksheet.getCell(`A${lastRowNum}`);
    totalLabel.value = 'TOTAL POR FACTURA ($):';
    totalLabel.font = { bold: true };
    totalLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    const totalVal = worksheet.getCell(`G${lastRowNum}`);
    totalVal.value = totalGastoFacturas;
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
    saveAs(new Blob([buffer]), `Reporte_Facturas_TC_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Excel por factura generado.");
  };


  const exportCompletedToExcel = async () => {
    const completadas = rows.filter(r => r.cantComprada >= r.cantPedida && r.cantPedida > 0);
    if (completadas.length === 0) {
      toast.error("No hay ítems completados en la selección actual.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Compras Completadas');

    // Logo/Header Row
    worksheet.mergeCells('A1:M1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'TOTAL CLEAN C.A. - REPORTE DE COMPRAS COMPLETADAS';
    titleCell.font = { name: 'Arial Black', size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 40;

    // Encabezados según solicitud
    const headers = [
      'CORRELATIVO #',
      'ALMACÉN',
      'DESCRIPCIÓN',
      'NRO DE FACTURA',
      'FECHA',
      'SOLICITANTE',
      'CATEGORÍA',
      'GERENCIA',
      'CENTRO DE COSTO',
      'MONEDA DE PAGO',
      'STATUS',
      'CANTIDAD COMPRADA',
      'TOTAL ($)'
    ];
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(2);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 25;

    // Datos
    completadas.forEach(r => {
      const cantPedida = Number(r.cantPedida) || 0;
      const cantComprada = Number(r.cantComprada) || 0;
      let statusText = 'Comprado';

      let monedaPago = r.metodoPago || '—';
      if (monedaPago === 'N/A' || !monedaPago || monedaPago === '—') {
        monedaPago = r.rawItem?.metodo_pago_actual || '—';
      }

      const row = worksheet.addRow([
        r.idReq,
        r.almacen ? 'SÍ' : 'NO',
        r.descripcion,
        r.nroFactura,
        r.fechaPago !== 'Pendiente' && r.fechaPago !== 'N/A' ? new Date(r.fechaPago + 'T12:00:00') : r.fechaPago,
        r.solicitante,
        r.categoria,
        r.gerencia,
        r.centroCosto,
        monedaPago,
        statusText,
        r.cantComprada,
        r.total
      ]);

      // Aplicar formato de fecha
      if (r.fechaPago !== 'Pendiente' && r.fechaPago !== 'N/A') {
        row.getCell(5).numFmt = 'dd/mm/yyyy';
      }

      // Format ID as text
      row.getCell(1).numFmt = '@';
      row.getCell(13).numFmt = '"$"#,##0.00;[Red]"$"#,##0.00';

      // Alignment & borders
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(5).alignment = { horizontal: 'center' };
      row.getCell(10).alignment = { horizontal: 'center' };
      row.getCell(11).alignment = { horizontal: 'center' };
      row.getCell(12).alignment = { horizontal: 'right' };
      row.getCell(13).alignment = { horizontal: 'right' };

      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    });

    // Ajuste de columnas
    worksheet.columns = [
      { width: 16 }, // CORRELATIVO #
      { width: 12 }, // ALMACÉN
      { width: 40 }, // DESCRIPCIÓN
      { width: 20 }, // NRO DE FACTURA
      { width: 15 }, // FECHA
      { width: 25 }, // SOLICITANTE
      { width: 20 }, // CATEGORÍA
      { width: 25 }, // GERENCIA
      { width: 25 }, // CENTRO DE COSTO
      { width: 20 }, // MONEDA DE PAGO
      { width: 15 }, // STATUS
      { width: 22 }, // CANTIDAD COMPRADA
      { width: 18 }  // TOTAL ($)
    ];

    // Totales
    const totalGastoCompletadas = completadas.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
    const lastRowNum = completadas.length + 3;
    worksheet.mergeCells(`A${lastRowNum}:L${lastRowNum}`);
    const totalLabel = worksheet.getCell(`A${lastRowNum}`);
    totalLabel.value = 'TOTAL GENERAL COMPLETADO ($):';
    totalLabel.font = { bold: true };
    totalLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    const totalVal = worksheet.getCell(`M${lastRowNum}`);
    totalVal.value = totalGastoCompletadas;
    totalVal.font = { bold: true, color: { argb: 'FF15803D' } };
    totalVal.numFmt = '"$"#,##0.00';
    totalVal.alignment = { horizontal: 'right', vertical: 'middle' };

    // Apply border to total row
    const totalRow = worksheet.getRow(lastRowNum);
    totalRow.height = 25;
    totalRow.eachCell(cell => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF94A3B8' } }
      };
    });

    // Generar Archivo
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Compras_Completadas_TC_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // --- EXPORTACIÓN A EXCEL: LEAD TIMES & SLA (18 COLUMNAS EXACTAS) ---
  const exportSLAToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Lead Times & SLA');

    // Title Row
    worksheet.mergeCells('A1:R1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'TOTAL CLEAN C.A. - REPORTE DE GESTIÓN Y LEAD TIMES DE COMPRAS (SLA)';
    titleCell.font = { name: 'Arial Black', size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 40;

    // Encabezados exactos a la imagen de referencia
    const headers = [
      'CORRELATIVO #',
      'ALMACÉN',
      'DESCRIPCIÓN',
      'NRO DE FACTURA',
      'FECHA',
      'Fecha Aprob Gte Gtl',
      'Asignacion G Compras',
      'TE Order (SUM Lapso Tiempo Gestion Segun Sys)',
      'TE Order Segun Proveedor',
      'Fecha Entrega Almacen',
      'SOLICITANTE',
      'CATEGORÍA',
      'GERENCIA',
      'CENTRO DE COSTO',
      'MONEDA DE PAGO',
      'STATUS',
      'CANTIDAD COMPRADA',
      'TOTAL ($)'
    ];
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(2);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    worksheet.getRow(2).height = 32;

    let totalGastoSLA = 0;

    slaRows.forEach(r => {
      totalGastoSLA += Number(r.total) || 0;

      const row = worksheet.addRow([
        r.correlativo,
        r.almacen,
        r.descripcion,
        r.nroFactura,
        r.fecha ? new Date(r.fecha + 'T12:00:00') : '—',
        r.fechaAprobGteGtl ? new Date(r.fechaAprobGteGtl + 'T12:00:00') : '—',
        r.asignacionGCompras ? new Date(r.asignacionGCompras + 'T12:00:00') : '—',
        r.teOrderSys !== null ? r.teOrderSys : '—',
        r.teOrderProveedor > 0 ? r.teOrderProveedor : '—',
        r.fechaEntregaAlmacen ? new Date(r.fechaEntregaAlmacen + 'T12:00:00') : '—',
        r.solicitante,
        r.categoria,
        r.gerencia,
        r.centroCosto,
        r.monedaPago,
        r.status,
        r.cantidadComprada,
        r.total
      ]);

      // Aplicar formatos
      if (r.fecha) row.getCell(5).numFmt = 'dd/mm/yyyy';
      if (r.fechaAprobGteGtl) row.getCell(6).numFmt = 'dd/mm/yyyy';
      if (r.asignacionGCompras) row.getCell(7).numFmt = 'dd/mm/yyyy';
      if (r.fechaEntregaAlmacen) row.getCell(10).numFmt = 'dd/mm/yyyy';

      row.getCell(1).numFmt = '@';
      row.getCell(4).numFmt = '@';
      if (typeof r.teOrderSys === 'number') row.getCell(8).numFmt = '#,##0';
      if (typeof r.teOrderProveedor === 'number') row.getCell(9).numFmt = '#,##0';
      row.getCell(17).numFmt = '#,##0';
      row.getCell(18).numFmt = '"$"#,##0.00;[Red]"$"#,##0.00';

      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(5).alignment = { horizontal: 'center' };
      row.getCell(6).alignment = { horizontal: 'center' };
      row.getCell(7).alignment = { horizontal: 'center' };
      row.getCell(8).alignment = { horizontal: 'center' };
      row.getCell(9).alignment = { horizontal: 'center' };
      row.getCell(10).alignment = { horizontal: 'center' };
      row.getCell(15).alignment = { horizontal: 'center' };
      row.getCell(16).alignment = { horizontal: 'center' };
      row.getCell(17).alignment = { horizontal: 'right' };
      row.getCell(18).alignment = { horizontal: 'right' };

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
      { width: 18 }, // CORRELATIVO #
      { width: 12 }, // ALMACÉN
      { width: 42 }, // DESCRIPCIÓN
      { width: 18 }, // NRO DE FACTURA
      { width: 14 }, // FECHA
      { width: 18 }, // Fecha Aprob Gte Gtl
      { width: 20 }, // Asignacion G Compras
      { width: 22 }, // TE Order (SUM Lapso Tiempo Gestion Segun Sys)
      { width: 22 }, // TE Order Segun Proveedor
      { width: 20 }, // Fecha Entrega Almacen
      { width: 22 }, // SOLICITANTE
      { width: 22 }, // CATEGORÍA
      { width: 22 }, // GERENCIA
      { width: 22 }, // CENTRO DE COSTO
      { width: 16 }, // MONEDA DE PAGO
      { width: 14 }, // STATUS
      { width: 18 }, // CANTIDAD COMPRADA
      { width: 18 }  // TOTAL ($)
    ];

    const lastRowNum = slaRows.length + 3;
    worksheet.mergeCells(`A${lastRowNum}:Q${lastRowNum}`);
    const totalLabel = worksheet.getCell(`A${lastRowNum}`);
    totalLabel.value = 'TOTAL GENERAL ($):';
    totalLabel.font = { bold: true };
    totalLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    const totalVal = worksheet.getCell(`R${lastRowNum}`);
    totalVal.value = totalGastoSLA;
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
    saveAs(new Blob([buffer]), `Reporte_LeadTimes_SLA_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Excel de Lead Times & SLA generado exitosamente.");
  };

  return (
    <motion.div
      className="reports-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' }}>
        <div style={{ borderLeft: '6px solid #0ea5e9', paddingLeft: '16px' }}>
          <h1 style={{ margin: 0, color: '#0f172a', fontSize: '1.8rem', fontWeight: '900', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.5px' }}>
            Reportes de Compras
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem', fontWeight: '500', fontFamily: 'Inter, sans-serif' }}>
            Gestión operativa, financiera y análisis de tiempos de respuesta (SLA)
          </p>
        </div>

        {/* SELECTOR DE PESTAÑAS PRINCIPALES */}
        <div className="rep-tab-nav" style={{ margin: 0 }}>
          <button
            type="button"
            className={`rep-tab-btn ${tabActiva === 'operativo' ? 'active' : ''}`}
            onClick={() => setTabActiva('operativo')}
          >
            <LayoutDashboard size={15} />
            Reporte Operativo & Financiero
          </button>
          <button
            type="button"
            className={`rep-tab-btn ${tabActiva === 'lead_times' ? 'active' : ''}`}
            onClick={() => setTabActiva('lead_times')}
          >
            <Clock size={15} />
            Gestión y Lead Times (SLA)
          </button>
        </div>

        <div className="rm-export-group" style={{ marginTop: '0px' }}>
          {tabActiva === 'lead_times' ? (
            <button className="btn-export" style={{ background: '#0f172a' }} onClick={exportSLAToExcel} title="Exportar Reporte Lead Times (SLA) a Excel">
              <FileSpreadsheet size={14} />
              <span style={{ fontSize: '10px', marginLeft: '5px' }}>Exportar Lead Times (SLA)</span>
            </button>
          ) : (
            <>
              <button className="btn-export" onClick={exportToExcel} title="Exportar Todo">
                <FileSpreadsheet size={14} />
                <span style={{ fontSize: '10px', marginLeft: '5px' }}>Excel General</span>
              </button>
              <button className="btn-export" style={{ background: '#f59e0b' }} onClick={exportPendingToExcel} title="Faltantes">
                <TrendingDown size={14} />
                <span style={{ fontSize: '10px', marginLeft: '5px' }}>Faltantes</span>
              </button>
              <button className="btn-export" style={{ background: '#16a34a' }} onClick={exportCompletedToExcel} title="Completadas">
                <FileSpreadsheet size={14} />
                <span style={{ fontSize: '10px', marginLeft: '5px' }}>Completadas</span>
              </button>
              <button className="btn-export" style={{ background: '#2563eb' }} onClick={exportByInvoicesToExcel} title="Por Factura">
                <FileSpreadsheet size={14} />
                <span style={{ fontSize: '10px', marginLeft: '5px' }}>Por Factura</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* --- DASHBOARD DE ESTADÍSTICAS SEGÚN LA PESTAÑA ACTIVA --- */}
      {tabActiva === 'operativo' ? (
        <div className="rm-stats-grid" style={{ marginBottom: '30px' }}>
          <div className="rm-stat-card primary">
            <div className="rm-stat-info">
              <label>Dólares pagaderos en Bolívares</label>
              <h3>$ {totals.bsTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="rm-stat-icon"><Clock size={20} /></div>
          </div>

          <div className="rm-stat-card primary">
            <div className="rm-stat-info">
              <label>Dólares pagaderos en divisas</label>
              <h3>$ {totals.usdTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="rm-stat-icon"><BarChart3 size={20} /></div>
          </div>

          <div className="rm-stat-card primary">
            <div className="rm-stat-info">
              <label>Total General ($)</label>
              <h3 style={{ fontSize: '1.8rem' }}>$ {totals.generalTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="rm-stat-icon"><DollarSign size={22} /></div>
          </div>
        </div>
      ) : (
        <div className="rm-stats-grid" style={{ marginBottom: '30px' }}>
          <div className="rm-stat-card primary" style={{ borderLeftColor: '#0ea5e9' }}>
            <div className="rm-stat-info">
              <label>⏱️ Tiempo Promedio Gestión (Sys)</label>
              <h3>{slaKpis.promedioSys} Días</h3>
            </div>
          </div>

          <div className="rm-stat-card primary" style={{ borderLeftColor: '#8b5cf6' }}>
            <div className="rm-stat-info">
              <label>🚚 Tiempo Promedio Proveedor</label>
              <h3>{slaKpis.promedioProv > 0 ? `${slaKpis.promedioProv} Días` : 'En proceso'}</h3>
            </div>
          </div>

          <div className="rm-stat-card primary" style={{ borderLeftColor: '#10b981' }}>
            <div className="rm-stat-info">
              <label>📦 Recepción en Almacén</label>
              <h3>{slaKpis.almacenCount} ítems <span style={{ fontSize: '0.85rem', color: '#64748b' }}>({slaKpis.totalItems > 0 ? Math.round((slaKpis.almacenCount / slaKpis.totalItems) * 100) : 0}%)</span></h3>
            </div>
          </div>

          <div className="rm-stat-card primary" style={{ borderLeftColor: '#1e293b' }}>
            <div className="rm-stat-info">
              <label>💵 Total Gestionado ($)</label>
              <h3 style={{ fontSize: '1.5rem' }}>$ {slaKpis.totalGasto.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</h3>
            </div>
          </div>
        </div>
      )}

      {/* --- SECCIÓN DE FILTROS --- */}
      <div className="rm-filter-section-premium">
        <div className="rm-filter-grid-layout main-filters">
          <div className="filter-item-premium">
            <label className="filter-label-premium">Fechas</label>
            <div className="date-input-group">
              <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
              <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
            </div>
          </div>

          <div className="filter-item-premium">
            <label className="filter-label-premium">Status</label>
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              <option value="Todos">Todos</option>
              <option value="En espera">En Espera</option>
              <option value="Parcial">Parcial</option>
              <option value="Completado">Completado</option>
              {tabActiva === 'lead_times' && <option value="Comprado">Comprado</option>}
              {tabActiva === 'lead_times' && <option value="Pendiente">Pendiente</option>}
            </select>
          </div>

          <div className="filter-item-premium">
            <label className="filter-label-premium">Cat.</label>
            <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
              <option value="Todos">Todas</option>
              {categoriasUnicas.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="filter-item-premium" style={{ maxWidth: '150px' }}>
            <label className="filter-label-premium">C. Costo</label>
            <select value={filtroCC} onChange={e => setFiltroCC(e.target.value)}>
              <option value="Todos">Todos</option>
              {listaCentrosCostos.map(cc => <option key={cc.id} value={cc.nombre}>{cc.nombre}</option>)}
            </select>
          </div>

          <div className="filter-item-premium" style={{ maxWidth: '150px' }}>
            <label className="filter-label-premium">Gerencia</label>
            <select value={filtroGerencia} onChange={e => setFiltroGerencia(e.target.value)}>
              <option value="Todos">Todas</option>
              {listaGerencias.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div className="filter-item-premium">
            <label className="filter-label-premium">ALM.</label>
            <select value={filtroAlmacen} onChange={e => setFiltroAlmacen(e.target.value)}>
              <option value="Todos">Todos</option>
              <option value="Si">Si 📦</option>
              <option value="No">No 📥</option>
            </select>
          </div>

          <div className="filter-item-premium" style={{ flex: 1, minWidth: '150px' }}>
            <label className="filter-label-premium">Búsqueda</label>
            <div className="search-input-wrapper" style={{ display: 'flex', gap: '5px' }}>
              <input
                type="text"
                placeholder="Item / ID..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className={`btn-toggle-filters ${showMoreFilters ? 'active' : ''}`}
                onClick={() => setShowMoreFilters(!showMoreFilters)}
                title="Más Filtros"
                style={{
                  padding: '0 10px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: showMoreFilters ? '#0ea5e9' : '#fff',
                  color: showMoreFilters ? '#fff' : '#64748b',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <Filter size={14} />
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showMoreFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="rm-filter-grid-layout secondary-filters"
              style={{ overflow: 'hidden', borderTop: '1px dashed #e2e8f0', paddingTop: '10px' }}
            >
              <div className="filter-item-premium">
                <label className="filter-label-premium">Prioridad</label>
                <select value={filtroPrioridad} onChange={e => setFiltroPrioridad(e.target.value)}>
                  <option value="Todos">Todas</option>
                  <option value="Normal">Normal</option>
                  <option value="Emergencia">Emergencia</option>
                </select>
              </div>

              <div className="filter-item-premium">
                <label className="filter-label-premium">Justificaciones</label>
                <select value={filtroJustificacion} onChange={e => setFiltroJustificacion(e.target.value)}>
                  <option value="Todos">Todas</option>
                  <option value="Disponibilidad Presupuestaria">Disp. Presup.</option>
                  <option value="Ítem no Localizado">No Localizado</option>
                  <option value="Definición Técnica Insuficiente">Def. Técnica</option>
                  <option value="En Espera de Aprobación Precios">Espera Aprob.</option>
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* --- VISTA 1: REPORTE OPERATIVO TRADICIONAL --- */}
      {tabActiva === 'operativo' && (
        <table className="audit-table-premium" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <thead>
            <tr style={{ background: '#1e293b', color: '#fff' }}>
              <th style={{ width: '130px', padding: '12px 15px', borderRadius: '8px 0 0 8px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CORRELATIVO #</th>
              <th style={{ width: '60px', padding: '12px 10px', textAlign: 'center', fontSize: '0.75rem' }}>ALM.</th>
              <th style={{ padding: '12px 15px', textAlign: 'left', fontSize: '0.75rem' }}>PRODUCTO / CATEGORÍA</th>
              <th style={{ width: '140px', padding: '12px 15px', textAlign: 'left', fontSize: '0.75rem' }}>SOPORTE / FECHA</th>
              <th style={{ width: '180px', padding: '12px 15px', textAlign: 'left', fontSize: '0.75rem' }}>ORIGEN (SOLICITANTE)</th>
              <th style={{ width: '220px', padding: '12px 15px', textAlign: 'left', fontSize: '0.75rem' }}>DESTINO (G / CC)</th>
              <th style={{ width: '80px', padding: '12px 15px', textAlign: 'right', fontSize: '0.75rem' }}>CANT.</th>
              <th style={{ width: '140px', padding: '12px 15px', textAlign: 'right', borderRadius: '0 8px 8px 0', fontSize: '0.75rem' }}>FINANCIERO ($)</th>
            </tr>
          </thead>
          <tbody style={{ background: 'transparent' }}>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '100px', color: '#94a3b8', background: '#fff', borderRadius: '12px' }}>
                  No se encontraron registros con los filtros aplicados.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <React.Fragment key={`${r.idReq}-${i}`}>
                  <motion.tr
                    key={`${r.idReq}-${i}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => toggleExpandirHistorial(r.idReq, i)}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '10px 15px', borderLeft: r.tipoDoc === 'REQUISICIÓN' ? '4px solid #3b82f6' : '4px solid #f59e0b' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '900', color: r.tipoDoc === 'REQUISICIÓN' ? '#1e40af' : '#b45309', fontSize: '0.85rem' }}>{r.idReq}</span>
                        {r.justificada && <span title="Justificación especial" style={{ cursor: 'help', color: '#f59e0b', fontSize: '1rem' }}>⚠️</span>}
                      </div>
                    </td>

                    <td style={{ textAlign: 'center', padding: '15px' }}>
                      <div style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: r.almacen ? '#eff6ff' : '#f8fafc',
                        border: '1px solid',
                        borderColor: r.almacen ? '#bfdbfe' : '#e2e8f0',
                        color: r.almacen ? '#2563eb' : '#94a3b8',
                        opacity: r.almacen ? 1 : 0.4
                      }}>
                        {r.almacen ? '📦' : '📥'}
                      </div>
                    </td>

                    <td style={{ padding: '15px' }}>
                      <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.85rem', lineHeight: '1.2' }}>
                        {r.descripcion}
                      </div>
                      <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b', marginTop: '4px', textTransform: 'uppercase' }}>
                        {r.categoria}
                      </div>
                    </td>

                    <td style={{ padding: '15px' }}>
                      <div style={{ fontWeight: '800', color: '#2563eb', fontSize: '0.8rem' }}>
                        {r.nroFactura}
                      </div>
                      <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#94a3b8', marginTop: '2px' }}>
                        {r.fechaPago !== 'Pendiente' && r.fechaPago !== 'N/A' ? format(new Date(r.fechaPago + 'T12:00:00'), 'dd/MM/yyyy') : r.fechaPago}
                      </div>
                    </td>

                    <td style={{ padding: '15px', fontSize: '0.85rem', color: '#334155', fontWeight: '700' }}>
                      {r.solicitante}
                    </td>

                    <td style={{ padding: '15px' }}>
                      <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '0.85rem' }}>
                        {r.gerencia}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '600', marginTop: '2px' }}>
                        {r.centroCosto.split('(')[0]}
                      </div>
                    </td>

                    <td style={{ textAlign: 'right', padding: '15px', fontWeight: '900', fontSize: '1rem', color: '#16a34a' }}>
                      {r.cantComprada}
                    </td>

                    <td style={{ textAlign: 'right', padding: '15px', borderRadius: '0 12px 12px 0' }}>
                      <div style={{ fontWeight: '900', fontSize: '1.05rem', color: '#0ea5e9', letterSpacing: '-0.5px' }}>
                        $ {r.total.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                  </motion.tr>

                  {/* HISTORIAL EXPANDIBLE (ESTILO COMPRAS) */}
                  {expandirHistorial[`${r.idReq}-${i}`] && r.historial_compras?.length > 0 && (
                    <tr className="rm-expanded-row">
                      <td colSpan="8" style={{ padding: '0 20px 20px 20px' }}>
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          style={{
                            background: '#f8fafc',
                            borderRadius: '12px',
                            padding: '15px',
                            border: '1px solid #e2e8f0',
                            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                            overflow: 'hidden'
                          }}
                        >
                          <div style={{ fontSize: '0.65rem', fontWeight: '900', color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Trazabilidad y Registros de Compra</span>
                            <span style={{ color: '#0ea5e9' }}>{r.historial_compras.length} EVENTOS</span>
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#f1f5f9', color: '#475569', fontSize: '0.65rem' }}>
                                <th style={{ textAlign: 'left', padding: '10px 8px', color: '#94a3b8' }}>FECHA</th>
                                <th style={{ textAlign: 'left', padding: '10px 8px', color: '#94a3b8' }}>EVENTO</th>
                                <th style={{ textAlign: 'left', padding: '10px 8px', color: '#94a3b8' }}>PROVEEDOR</th>
                                <th style={{ textAlign: 'left', padding: '10px 8px', color: '#94a3b8' }}>DETALLE / DOCUMENTO</th>
                                <th style={{ textAlign: 'center', padding: '10px 8px', color: '#94a3b8' }}>CANT.</th>
                                <th style={{ textAlign: 'right', padding: '10px 8px', color: '#94a3b8' }}>P.U. REAL ($)</th>
                                <th style={{ textAlign: 'right', padding: '10px 8px', color: '#94a3b8' }}>TOTAL / COMENTARIO ($)</th>
                                <th style={{ textAlign: 'center', padding: '10px 8px', color: '#94a3b8' }}>ALM.</th>
                                <th style={{ textAlign: 'right', padding: '10px 8px', color: '#94a3b8' }}>USUARIO</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.historial_compras.map((h, hIdx) => (
                                <tr key={hIdx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: h.tipo === 'JUSTIFICACION' ? '#fffbeb' : 'transparent' }}>
                                  <td style={{ padding: '10px 8px', fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>
                                    {h.tipo === 'JUSTIFICACION' ? safeFormatDate(h.fecha) : safeFormatDate(h.fecha_pago || h.created_at)}
                                  </td>
                                  <td style={{ padding: '10px 8px', fontSize: '0.75rem', fontWeight: '800', color: h.tipo === 'JUSTIFICACION' ? '#d97706' : (h.doc_tipo === 'NC' ? '#f59e0b' : '#16a34a') }}>
                                    {h.tipo === 'JUSTIFICACION' ? '⚠️ JUSTIFICACIÓN' : (h.doc_tipo === 'NC' ? '💳 A CRÉDITO' : '✅ COMPRADO')}
                                  </td>
                                  <td style={{ padding: '10px 8px', fontSize: '0.7rem', color: '#334155', fontWeight: '700' }}>
                                    {h.tipo !== 'JUSTIFICACION' ? (h.proveedor_nombre || 'No asignado') : '-'}
                                  </td>
                                  <td style={{ padding: '10px 8px' }}>
                                    {h.tipo === 'JUSTIFICACION' ? (
                                      <div style={{ fontStyle: 'italic', color: '#92400e', fontWeight: '600', fontSize: '0.7rem' }}>{h.motivo}</div>
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {h.metodo_pago && (
                                          <span style={{ fontSize: '0.55rem', backgroundColor: '#e2e8f0', color: '#475569', padding: '2px 5px', borderRadius: '4px', fontWeight: '900' }}>
                                            {h.metodo_pago}
                                          </span>
                                        )}
                                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#2563eb' }}>
                                          {h.doc_tipo || 'FAC'}: {h.doc_numero || 'S/D'}
                                          {h.factura_url && (
                                            <a href={h.factura_url} target="_blank" rel="noreferrer" title="Ver Soporte" style={{ marginLeft: '8px', textDecoration: 'none', cursor: 'pointer', fontSize: '1rem' }}>
                                              📎
                                            </a>
                                          )}
                                        </span>
                                        {h.fecha_pago && (
                                          <span style={{ fontSize: '8px', color: '#16a34a', fontWeight: '800', textTransform: 'uppercase', marginLeft: '5px' }}>
                                            📅 PAGADO
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: '10px 8px', fontSize: '0.75rem', textAlign: 'center', fontWeight: '700', color: '#1e293b' }}>
                                    {h.cant || '-'}
                                  </td>
                                  <td style={{ padding: '10px 8px', fontSize: '0.75rem', textAlign: 'right', fontWeight: '700', color: '#1e293b' }}>
                                    {h.tipo !== 'JUSTIFICACION' ? `$ ${(Number(h.pu) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}` : '-'}
                                  </td>
                                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                                    {h.tipo === 'JUSTIFICACION' ? (
                                      <div style={{ fontSize: '0.7rem', color: '#475569', whiteSpace: 'pre-wrap', textAlign: 'left', backgroundColor: '#fef3c7', padding: '6px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                                        {h.comentario}
                                      </div>
                                    ) : (
                                      <span style={{ fontWeight: '800', fontSize: '0.8rem', color: '#0ea5e9' }}>
                                        $ {((Number(h.cant) || 0) * (Number(h.pu) || 0)).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                    {h.tipo !== 'JUSTIFICACION' && (
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleAlmacenSubRow(r.idReal, r.itemIdx, hIdx, !h.enviado_almacen);
                                        }}
                                        style={{
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          width: '22px',
                                          height: '22px',
                                          borderRadius: '5px',
                                          backgroundColor: h.enviado_almacen ? '#e0f2fe' : '#f1f5f9',
                                          border: '1px solid',
                                          borderColor: h.enviado_almacen ? '#0ea5e9' : '#e2e8f0',
                                          color: h.enviado_almacen ? '#0369a1' : '#94a3b8',
                                          fontSize: '0.7rem'
                                        }}
                                      >
                                        {h.enviado_almacen ? '📦' : '📥'}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: '0.65rem', color: '#94a3b8', fontWeight: '600' }}>
                                    {h.usuario_nombre?.split(' ')[0] || 'S/U'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </motion.div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      )}

      {/* --- VISTA 2: REPORTE DE LEAD TIMES & SLA (18 COLUMNAS EXACTAS SEGÚN IMAGEN) --- */}
      {tabActiva === 'lead_times' && (
        <div className="sla-table-wrapper">
          <table className="sla-table">
            <thead>
              <tr>
                <th style={{ minWidth: '130px' }}>CORRELATIVO #</th>
                <th style={{ minWidth: '80px' }}>ALMACÉN</th>
                <th style={{ minWidth: '260px', textAlign: 'left' }}>DESCRIPCIÓN</th>
                <th style={{ minWidth: '120px' }}>NRO DE FACTURA</th>
                <th style={{ minWidth: '100px' }}>FECHA</th>
                <th style={{ minWidth: '130px' }}>Fecha Aprob Gte Gtl</th>
                <th style={{ minWidth: '140px' }}>Asignación G Compras</th>
                <th style={{ minWidth: '180px' }}>TE Order (SUM Lapso Gestión Sys)</th>
                <th style={{ minWidth: '160px' }}>TE Order Según Prov.</th>
                <th style={{ minWidth: '130px' }}>Fecha Entrega Almacén</th>
                <th style={{ minWidth: '150px', textAlign: 'left' }}>SOLICITANTE</th>
                <th style={{ minWidth: '150px', textAlign: 'left' }}>CATEGORÍA</th>
                <th style={{ minWidth: '150px', textAlign: 'left' }}>GERENCIA</th>
                <th style={{ minWidth: '160px', textAlign: 'left' }}>CENTRO DE COSTO</th>
                <th style={{ minWidth: '110px' }}>MONEDA DE PAGO</th>
                <th style={{ minWidth: '100px' }}>STATUS</th>
                <th style={{ minWidth: '110px', textAlign: 'right' }}>CANTIDAD COMPRADA</th>
                <th style={{ minWidth: '120px', textAlign: 'right' }}>TOTAL ($)</th>
              </tr>
            </thead>
            <tbody>
              {slaRows.length === 0 ? (
                <tr>
                  <td colSpan="18" style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', fontStyle: 'italic' }}>
                    No se encontraron registros de adquisiciones con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                slaRows.map((r, idx) => {
                  let teBadgeClass = 'fast';
                  if (r.teOrderSys > 7) teBadgeClass = 'slow';
                  else if (r.teOrderSys > 3) teBadgeClass = 'medium';

                  return (
                    <tr key={`${r.correlativo}-${idx}`}>
                      <td style={{ textAlign: 'center', fontWeight: '900', color: '#1e40af', backgroundColor: '#f8fafc' }}>
                        {r.correlativo}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.65rem',
                          fontWeight: '900',
                          backgroundColor: r.almacenBool ? '#eff6ff' : '#f8fafc',
                          color: r.almacenBool ? '#1d4ed8' : '#64748b',
                          border: `1px solid ${r.almacenBool ? '#bfdbfe' : '#e2e8f0'}`
                        }}>
                          {r.almacen}
                        </span>
                      </td>
                      <td style={{ textAlign: 'left', fontWeight: '700', color: '#0f172a', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.descripcion}>
                        {r.descripcion}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: '700', color: '#2563eb' }}>
                        {r.nroFactura}
                      </td>
                      <td style={{ textAlign: 'center', color: '#64748b' }}>
                        {r.fecha ? r.fecha.split('-').reverse().join('/') : '—'}
                      </td>
                      <td style={{ textAlign: 'center', color: '#334155', fontWeight: '600' }}>
                        {r.fechaAprobGteGtl ? r.fechaAprobGteGtl.split('-').reverse().join('/') : '—'}
                      </td>
                      <td style={{ textAlign: 'center', color: '#334155', fontWeight: '600' }}>
                        {r.asignacionGCompras ? r.asignacionGCompras.split('-').reverse().join('/') : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {r.teOrderSys !== null ? (
                          <span className={`sla-badge-te ${teBadgeClass}`}>
                            ⏱️ {r.teOrderSys} {r.teOrderSys === 1 ? 'día' : 'días'}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {r.teOrderProveedor > 0 ? (
                          <span style={{ backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: '700', color: '#334155' }}>
                            🚚 {r.teOrderProveedor} días
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', color: '#64748b' }}>
                        {r.fechaEntregaAlmacen ? r.fechaEntregaAlmacen.split('-').reverse().join('/') : '—'}
                      </td>
                      <td style={{ textAlign: 'left', fontWeight: '600', color: '#334155' }}>
                        {r.solicitante}
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        <span style={{ backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: '800', color: '#475569', border: '1px solid #e2e8f0' }}>
                          {r.categoria}
                        </span>
                      </td>
                      <td style={{ textAlign: 'left', fontWeight: '600', color: '#475569' }}>
                        {r.gerencia}
                      </td>
                      <td style={{ textAlign: 'left', color: '#64748b', fontSize: '0.7rem' }}>
                        {r.centroCosto}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ backgroundColor: '#f8fafc', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.65rem', fontWeight: '800', color: '#0f172a' }}>
                          {r.monedaPago}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.65rem',
                          fontWeight: '900',
                          backgroundColor: r.status === 'Comprado' ? '#dcfce7' : (r.status === 'Parcial' ? '#fef3c7' : '#f1f5f9'),
                          color: r.status === 'Comprado' ? '#15803d' : (r.status === 'Parcial' ? '#b45309' : '#64748b'),
                          border: `1px solid ${r.status === 'Comprado' ? '#bbf7d0' : (r.status === 'Parcial' ? '#fde68a' : '#e2e8f0')}`
                        }}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '900', color: '#0f172a' }}>
                        {r.cantidadComprada}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '900', color: '#0ea5e9' }}>
                        $ {r.total.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {rows.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
          <LayoutDashboard size={48} style={{ opacity: 0.2, marginBottom: '10px' }} />
          <p>No se encontraron registros activos para los filtros seleccionados.</p>
        </div>
      )}
    </motion.div>
  );
};

export default Reportes;
