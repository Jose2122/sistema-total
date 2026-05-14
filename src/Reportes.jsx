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

  const listaGerencias = [
    "Administración Maracaibo", "Administración El Tigre", "Operaciones", "Mantenimiento",
    "Seguridad", "Recursos Humanos", "Estimación", "Almacén", "Gerencia General",
    "Servicios Generales", "Contabilidad"
  ];

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
      const [resReq, resTickets, resCC] = await Promise.all([
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
          .order('nombre')
      ]);

      if (resReq.error) throw resReq.error;
      if (resTickets.error) throw resTickets.error;
      if (resCC.data) setListaCentrosCostos(resCC.data);

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
            nroFactura: compras.map(c => c.doc_numero).filter(Boolean).join(', ') || 'N/A',
            almacen: item.enviado_almacen || (historial.length > 0 && historial.every(h => h.enviado_almacen)),
            idReal: doc.id,
            itemIdx: itemIdx
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
            prioridad: 'Normal',
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
            nroFactura: doc.ref_pago || 'N/A',
            almacen: false
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

  // --- EXPORTACIÓN A EXCEL ---
  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte Operativo');

    // Logo Placeholder
    worksheet.mergeCells('A1:K1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'TOTAL CLEAN C.A. - REPORTE DE GESTIÓN OPERATIVA';
    titleCell.font = { name: 'Arial Black', size: 16, color: { argb: 'FFFFFFFF' } };
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
      'CANTIDAD COMPRADA', 
      'TOTAL ($)'
    ];
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(2);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    headerRow.alignment = { horizontal: 'center' };

    // Datos
    rows.forEach(r => {
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
        r.cantComprada,
        r.total
      ]);

      // Aplicar formato de fecha
      if (r.fechaSolicitud !== 'N/A') {
        row.getCell(2).numFmt = 'dd/mm/yyyy';
      }

      // Format ID as text
      row.getCell(1).numFmt = '@';
    });

    // Formato de moneda para columnas de precio y total
    const colK = worksheet.getColumn(11); // TOTAL ESTIMADO
    const colL = worksheet.getColumn(12); // TOTAL EJECUTADO
    colK.numFmt = '"$"#,##0.00;[Red]"$"#,##0.00';
    colL.numFmt = '"$"#,##0.00;[Red]"$"#,##0.00';

    // Ajuste de columnas
    worksheet.columns.forEach(col => { col.width = 18; });
    worksheet.getColumn(5).width = 40; // Descripción
    worksheet.getColumn(6).width = 25; // CC
    worksheet.getColumn(7).width = 25; // Gerencia

    // Totales
    const lastRowNum = rows.length + 3;
    worksheet.mergeCells(`A${lastRowNum}:J${lastRowNum}`);
    const totalLabel = worksheet.getCell(`A${lastRowNum}`);
    totalLabel.value = 'TOTAL GENERAL EXPENDIDO ($):';
    totalLabel.font = { bold: true };
    totalLabel.alignment = { horizontal: 'right' };

    const totalVal = worksheet.getCell(`K${lastRowNum}`);
    totalVal.value = gastoTotal;
    totalVal.font = { bold: true, color: { argb: 'FF15803D' } };
    totalVal.numFmt = '"$"#,##0.00';

    // Generar Archivo
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Reporte_Compras_TC_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportPendingToExcel = async () => {
    const pendientes = rows.filter(r => r.cantComprada < r.cantPedida);
    if (pendientes.length === 0) return toast.error("No hay ítems pendientes por comprar en la selección actual.");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Pendientes por Comprar');

    worksheet.mergeCells('A1:H1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'TOTAL CLEAN C.A. - ÍTEMS PENDIENTES POR COMPRAR';
    titleCell.font = { name: 'Arial Black', size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    const headers = ['ID', 'FECHA SOLICITUD', 'CATEGORÍA', 'DESCRIPCIÓN', 'CENTRO DE COSTO', 'GERENCIA', 'CANT PEDIDA', 'CANT COMPRADA'];
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(2);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

    pendientes.forEach(r => {
      const row = worksheet.addRow([
        r.idReq,
        r.fechaSolicitud !== 'N/A' ? new Date(r.fechaSolicitud + 'T12:00:00') : 'N/A',
        r.categoria,
        r.descripcion,
        r.centroCosto,
        r.gerencia,
        r.cantPedida,
        r.cantComprada
      ]);
      if (r.fechaSolicitud !== 'N/A') row.getCell(2).numFmt = 'dd/mm/yyyy';
      row.getCell(1).numFmt = '@';
    });

    worksheet.columns.forEach(col => { col.width = 18; });
    worksheet.getColumn(4).width = 40;

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Items_Pendientes_TC_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportCompletedToExcel = async () => {
    const completadas = rows.filter(r => r.cantComprada >= r.cantPedida && r.cantPedida > 0);
    if (completadas.length === 0) return toast.error("No hay ítems completados en la selección actual.");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Compras Completadas');

    worksheet.mergeCells('A1:J1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'TOTAL CLEAN C.A. - REPORTE DE COMPRAS COMPLETADAS';
    titleCell.font = { name: 'Arial Black', size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 40;

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
      'CANTIDAD COMPRADA', 
      'TOTAL ($)'
    ];
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(2);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    headerRow.alignment = { horizontal: 'center' };

    completadas.forEach(r => {
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
        r.cantComprada,
        r.total
      ]);
      if (r.fechaPago !== 'Pendiente' && r.fechaPago !== 'N/A') {
        row.getCell(4).numFmt = 'dd/mm/yyyy';
      }
      row.getCell(1).numFmt = '@';
      row.getCell(10).numFmt = '"$"#,##0.00';
    });

    worksheet.columns.forEach(col => { col.width = 18; });
    worksheet.getColumn(6).width = 40; // Descripción
    worksheet.getColumn(2).width = 25; // Solicitante
    worksheet.getColumn(3).width = 20; // Nro Factura

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Compras_Completadas_TC_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <motion.div
      className="reports-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '900', color: '#0f172a', letterSpacing: '-1px' }}>Reporte de Compras</h1>
          <p style={{ color: '#64748b', fontSize: '1rem', fontWeight: '500' }}>Gestión financiera y operativa de adquisiciones</p>
        </div>

        <div className="rm-export-group" style={{ marginTop: '5px' }}>
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
        </div>
      </div>

      {/* --- DASHBOARD DE ESTADÍSTICAS (FILA INDEPENDIENTE) --- */}
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


      <div className="rm-filter-section-premium">
        {/* FILTROS PRINCIPALES + BOTONES EN UNA SOLA FILA COMPACTA */}
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
                  <option value="Baja">Baja</option>
                  <option value="Normal">Normal</option>
                  <option value="Alta">Alta</option>
                  <option value="Urgente">Urgente</option>
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
                              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                <th style={{ textAlign: 'left', padding: '8px', fontSize: '0.65rem', color: '#94a3b8' }}>FECHA</th>
                                <th style={{ textAlign: 'left', padding: '8px', fontSize: '0.65rem', color: '#94a3b8' }}>PROVEEDOR</th>
                                <th style={{ textAlign: 'left', padding: '8px', fontSize: '0.65rem', color: '#94a3b8' }}>DOCUMENTO</th>
                                <th style={{ textAlign: 'right', padding: '8px', fontSize: '0.65rem', color: '#94a3b8' }}>CANT.</th>
                                <th style={{ textAlign: 'right', padding: '8px', fontSize: '0.65rem', color: '#94a3b8' }}>P.U. ($)</th>
                                <th style={{ textAlign: 'right', padding: '8px', fontSize: '0.65rem', color: '#94a3b8' }}>TOTAL ($)</th>
                                <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.65rem', color: '#94a3b8' }}>ALM.</th>
                                <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.65rem', color: '#94a3b8' }}>USUARIO</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.historial_compras.map((h, hIdx) => (
                                <tr key={hIdx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: h.tipo === 'JUSTIFICACION' ? '#fffbeb' : 'transparent' }}>
                                  <td style={{ padding: '10px 8px', fontSize: '0.75rem', fontWeight: '700', color: '#475569' }}>
                                    {h.tipo === 'JUSTIFICACION' ? safeFormatDate(h.fecha) : safeFormatDate(h.fecha_pago || h.created_at)}
                                  </td>
                                  <td style={{ padding: '10px 8px', fontSize: '0.75rem', color: h.tipo === 'JUSTIFICACION' ? '#b45309' : '#334155', fontWeight: '600' }}>
                                    {h.tipo === 'JUSTIFICACION' ? '⚠️ JUSTIFICACIÓN' : (h.proveedor || 'S/P')}
                                  </td>
                                  <td style={{ padding: '10px 8px', fontSize: '0.7rem', color: h.tipo === 'JUSTIFICACION' ? '#92400e' : '#2563eb', fontWeight: '800' }}>
                                    {h.tipo === 'JUSTIFICACION' ? h.motivo : (h.doc_numero || 'S/D')}
                                  </td>
                                  <td style={{ padding: '10px 8px', fontSize: '0.75rem', textAlign: 'right', fontWeight: '700', color: '#16a34a' }}>
                                    {h.cant || '-'}
                                  </td>
                                  <td style={{ padding: '10px 8px', fontSize: '0.75rem', textAlign: 'right', color: '#64748b' }}>
                                    {h.tipo !== 'JUSTIFICACION' ? `$ ${(Number(h.pu) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}` : '-'}
                                  </td>
                                  <td style={{ padding: '10px 8px', fontSize: '0.8rem', textAlign: 'right', fontWeight: '800', color: '#0ea5e9' }}>
                                    {h.tipo === 'JUSTIFICACION' ? '-' : `$ ${((Number(h.cant) || 0) * (Number(h.pu) || 0)).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`}
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
                                  <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '0.65rem', color: '#94a3b8', fontWeight: '600' }}>
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
