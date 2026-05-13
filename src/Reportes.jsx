import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
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
  const [expandirHistorial, setExpandirHistorial] = useState({}); // { rowID: boolean }

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

  // --- TABLAS DE REFERENCIA (Sincronizadas con Requisiciones.jsx) ---
  const listaCentrosCostos = [
    { id: '1.00.2', nombre: 'MTTO MAYOR-BOSCAN' },
    { id: '1.00.8', nombre: 'MTTO MAYOR-BAJO GRANDE' },
    { id: '1.00.7', nombre: 'EXCELENCIA OPERACIONAL' },
    { id: '1.01.0', nombre: 'CAMIONES DE VACÍO-BOSCAN' },
    { id: '1.01.1', nombre: 'CAMIONES DE VACÍO-BAJO G.' },
    { id: '1.00.9', nombre: 'PROYECTOS MENORES' },
    { id: '2.00.1', nombre: 'SUCURSAL EL TIGRE' },
    { id: '1.00.1', nombre: 'OFICINA PRINCIPAL MCBO' }
  ];

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
      const [resReq, resTickets] = await Promise.all([
        supabase
          .from('requisiciones')
          .select('*')
          .eq('estado_aprobacion', 'aprobado_final')
          .order('fecha_emision', { ascending: false }),
        supabase
          .from('tickets_directos')
          .select('*')
          .order('fecha_emision', { ascending: false })
      ]);

      if (resReq.error) throw resReq.error;
      if (resTickets.error) throw resTickets.error;

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
        (doc.items || []).forEach(item => {
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
            nroFactura: compras.map(c => c.doc_numero).filter(Boolean).join(', ') || 'N/A'
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
            nroFactura: doc.ref_pago || 'N/A'
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

      return matchBusqueda && matchCC && matchGerencia && matchCat && matchPrio && matchFecha && matchJustif && matchStatus;
    });
  }, [dataRaw, busqueda, filtroCC, filtroGerencia, filtroCategoria, filtroPrioridad, fechaDesde, fechaHasta, filtroJustificacion, filtroStatus]);

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
      'ID', 
      'FECHA DE SOLICITUD', 
      'STATUS', 
      'CATEGORÍA', 
      'DESCRIPCIÓN', 
      'CENTRO DE COSTO', 
      'GERENCIA', 
      'CANTIDAD PEDIDA', 
      'CANTIDAD COMPRADA', 
      'MONEDA', 
      'TOTAL ESTIMADO ($)', 
      'TOTAL EJECUTADO ($)'
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
        r.fechaSolicitud !== 'N/A' ? new Date(r.fechaSolicitud + 'T12:00:00') : 'N/A',
        (r.statusCompra || 'En espera').toUpperCase(),
        r.categoria,
        r.descripcion,
        r.centroCosto,
        r.gerencia,
        r.cantPedida,
        r.cantComprada,
        r.metodoPago || 'N/A',
        r.totalEstimado,
        r.totalEjecutado
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
      'ID', 
      'SOLICITANTE', 
      'NRO DE FACTURA', 
      'FECHA', 
      'CATEGORÍA', 
      'DESCRIPCIÓN', 
      'CENTRO DE COSTO', 
      'GERENCIA', 
      'CANTIDAD COMPRADA', 
      'TOTAL'
    ];
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(2);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    headerRow.alignment = { horizontal: 'center' };

    completadas.forEach(r => {
      const row = worksheet.addRow([
        r.idReq,
        r.solicitante,
        r.nroFactura,
        r.fechaPago !== 'Pendiente' && r.fechaPago !== 'N/A' ? new Date(r.fechaPago + 'T12:00:00') : r.fechaPago,
        r.categoria,
        r.descripcion,
        r.centroCosto,
        r.gerencia,
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '900', color: '#0f172a', letterSpacing: '-1px' }}>Reporte de Compras</h1>
          <p style={{ color: '#64748b', fontSize: '1rem', fontWeight: '500' }}>Gestión financiera y operativa de adquisiciones</p>
        </div>
      </div>

      {/* --- DASHBOARD DE ESTADÍSTICAS (FILA INDEPENDIENTE) --- */}
      <div className="rm-stats-grid" style={{ marginBottom: '30px' }}>
        <div className="rm-stat-card secondary">
          <div className="rm-stat-info">
            <label>Dólares pagaderos en Bolívares</label>
            <h3 style={{ color: '#0ea5e9' }}>$ {totals.bsTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</h3>
          </div>
          <div className="rm-stat-icon"><Clock size={20} /></div>
        </div>

        <div className="rm-stat-card highlight">
          <div className="rm-stat-info">
            <label>Dólares pagaderos en divisas</label>
            <h3 style={{ color: '#8b5cf6' }}>$ {totals.usdTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</h3>
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

      <div className="filters-overlap" style={{ position: 'relative' }}>
        {/* Botones de Exportación en la parte superior derecha */}
        <div style={{ position: 'absolute', top: '15px', right: '20px', display: 'flex', gap: '10px', zIndex: 10 }}>
          <button className="btn-export" onClick={exportToExcel} style={{ height: '36px', fontSize: '0.7rem', padding: '0 15px' }}>
            <FileSpreadsheet size={14} />
            EXPORTAR MOVIMIENTOS DE COMPRAS
          </button>
          <button className="btn-export" onClick={exportPendingToExcel} style={{ backgroundColor: '#f59e0b', borderColor: '#d97706', height: '36px', fontSize: '0.7rem', padding: '0 15px' }}>
            <TrendingDown size={14} />
            EXPORTAR FALTANTES
          </button>
          <button className="btn-export" onClick={exportCompletedToExcel} style={{ backgroundColor: '#16a34a', borderColor: '#15803d', height: '36px', fontSize: '0.7rem', padding: '0 15px' }}>
            <FileSpreadsheet size={14} />
            EXPORTAR COMPLETADAS
          </button>
        </div>

        {/* BLOQUE VERTICAL STACKED PARA FECHAS Y JUSTIFICACIONES */}
        <div className="filter-group stacked-group">
          <div className="sub-filter">
            <label className="filter-label"><Calendar size={12} style={{ marginRight: '5px' }} /> Rango de Fechas</label>
            <div style={{ display: 'flex', gap: '5px' }}>
              <input type="date" className="report-input small" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
              <input type="date" className="report-input small" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
            </div>
          </div>

          <div className="sub-filter">
            <label className="filter-label">Filtro de Justificaciones</label>
            <select
              className="report-input small"
              value={filtroJustificacion}
              onChange={e => setFiltroJustificacion(e.target.value)}
            >
              <option value="Todos">Todas las justificaciones</option>
              <option value="Disponibilidad Presupuestaria">Disponibilidad Presupuestaria</option>
              <option value="Ítem no Localizado">Ítem no Localizado</option>
              <option value="Definición Técnica Insuficiente">Definición Técnica Insuficiente</option>
              <option value="En Espera de Aprobación Precios">En Espera de Aprobación Precios</option>
            </select>
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-label">Centro de Costo</label>
          <select className="report-input" value={filtroCC} onChange={e => setFiltroCC(e.target.value)}>
            <option value="Todos">Todos</option>
            {listaCentrosCostos.map(cc => <option key={cc.id} value={cc.nombre}>{cc.nombre}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Gerencia</label>
          <select className="report-input" value={filtroGerencia} onChange={e => setFiltroGerencia(e.target.value)}>
            <option value="Todos">Todas las áreas</option>
            {listaGerencias.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Categoría</label>
          <select className="report-input" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
            <option value="Todos">Todas</option>
            {categoriasUnicas.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Status Compra</label>
          <select className="report-input" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="Todos">Todos los estados</option>
            <option value="En espera">En Espera</option>
            <option value="Parcial">Parcial</option>
            <option value="Completado">Completado</option>
          </select>
        </div>

        <div className="filter-group" style={{ flex: 2 }}>
          <label className="filter-label"><Search size={12} style={{ marginRight: '5px' }} /> Buscar por Item / ID</label>
          <input
            type="text"
            className="report-input"
            placeholder="Ej: Bombas, Filtros, REQ-001..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      <div className="audit-table-wrapper">
        <table className="audit-table">
          <thead>
            <tr>
              <th style={{ width: '130px' }}>IDENTIFICACIÓN</th>
              <th style={{ width: '100px' }}>FECHAS</th>
              <th>DETALLES DEL ÍTEM</th>
              <th>UBICACIÓN</th>
              <th style={{ textAlign: 'center', width: '100px' }}>CANT (P/C)</th>
              <th style={{ textAlign: 'center' }}>MONEDA</th>
              <th style={{ textAlign: 'right', width: '120px' }}>TOTAL ($)</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {rows.map((r, i) => (
                <React.Fragment key={`${r.idReq}-${i}`}>
                  <motion.tr
                    className={r.cantComprada === 0 ? 'row-pending' : ''}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => setExpandirHistorial(prev => ({ ...prev, [`${r.idReq}-${i}`]: !prev[`${r.idReq}-${i}`] }))}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: '800', color: r.tipoDoc === 'REQUISICIÓN' ? '#0ea5e9' : '#d97706' }}>{r.idReq}</span>
                        {r.justificada && <span title="Tiene justificación" style={{ cursor: 'help', color: '#d97706' }}>⚠️</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#1e293b' }}>
                        {r.fechaPago !== 'Pendiente' && r.fechaPago !== 'N/A' ? format(new Date(r.fechaPago + 'T12:00:00'), 'dd/MM/yyyy') : r.fechaPago}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '2px' }}>
                        Solic: {r.fechaSolicitud !== 'N/A' ? format(new Date(r.fechaSolicitud + 'T12:00:00'), 'dd/MM/yyyy') : 'N/A'}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.85rem' }}>
                        {r.descripcion}
                      </div>
                      <div style={{ fontSize: '0.7rem', fontWeight: '600', color: '#64748b' }}>
                        {r.categoria}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: '600', color: '#334155', fontSize: '0.8rem' }}>
                        {r.centroCosto.split('(')[0]}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                        {r.gerencia}
                      </div>
                    </td>

                    <td style={{ textAlign: 'center', fontWeight: '700', fontSize: '0.85rem' }}>
                      <span style={{ color: '#64748b' }}>{r.cantPedida}</span>
                      <span style={{ margin: '0 4px', color: '#cbd5e1' }}>/</span>
                      <span style={{ color: '#16a34a' }}>{r.cantComprada}</span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.65rem', backgroundColor: '#e2e8f0', padding: '3px 7px', borderRadius: '4px', fontWeight: 'bold' }}>
                        {r.metodoPago || '-'}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right', fontWeight: '800', fontSize: '0.9rem', color: '#0ea5e9' }}>
                      $ {r.total.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </td>
                  </motion.tr>

                  {/* HISTORIAL EXPANDIBLE (ESTILO COMPRAS) */}
                  {expandirHistorial[`${r.idReq}-${i}`] && r.historial_compras?.length > 0 && (
                    <tr>
                      <td colSpan="7" style={{ padding: '0 0 15px 40px' }}>
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                        >
                          <div style={{ padding: '8px 12px', backgroundColor: '#f8fafc', fontSize: '0.7rem', fontWeight: '900', color: '#475569', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0' }}>
                            <span>HISTORIAL DE COMPRAS / MODIFICACIONES</span>
                            <span style={{ color: '#0ea5e9' }}>{r.historial_compras.length} EVENTOS</span>
                          </div>
                          <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '0.65rem' }}>
                                <th style={{ padding: '8px', textAlign: 'left' }}>FECHA</th>
                                <th style={{ padding: '8px', textAlign: 'left' }}>TIPO</th>
                                <th style={{ padding: '8px', textAlign: 'left' }}>DETALLE / MOTIVO</th>
                                <th style={{ padding: '8px', textAlign: 'center' }}>CANT.</th>
                                <th style={{ padding: '8px', textAlign: 'right' }}>P.U. REAL</th>
                                <th style={{ padding: '8px', textAlign: 'right' }}>TOTAL / COMENTARIO</th>
                                <th style={{ padding: '8px', textAlign: 'right' }}>USUARIO</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.historial_compras.map((h, idx) => (
                                <tr key={idx} style={{
                                  borderBottom: idx < r.historial_compras.length - 1 ? '1px solid #f1f5f9' : 'none',
                                  backgroundColor: h.tipo === 'JUSTIFICACION' ? '#fffbeb' : 'transparent'
                                }}>
                                  <td style={{ padding: '8px', color: '#64748b' }}>{new Date(h.fecha).toLocaleDateString()}</td>
                                  <td style={{ padding: '8px', fontWeight: 'bold', color: h.tipo === 'JUSTIFICACION' ? '#d97706' : '#16a34a' }}>
                                    {h.tipo === 'JUSTIFICACION' ? '⚠️ JUSTIFICACIÓN' : '✅ COMPRA'}
                                  </td>
                                  <td style={{ padding: '8px' }}>
                                    {h.tipo === 'JUSTIFICACION' ? (
                                      <span style={{ fontStyle: 'italic', color: '#92400e', fontWeight: '600' }}>{h.motivo}</span>
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <span style={{ fontSize: '0.65rem', backgroundColor: '#e2e8f0', padding: '2px 5px', borderRadius: '4px' }}>{h.metodo_pago}</span>
                                        PROCESADO
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700' }}>{h.cant || '-'}</td>
                                  <td style={{ padding: '8px', textAlign: 'right' }}>{h.pu ? `$ ${h.pu.toLocaleString('de-DE')}` : '-'}</td>
                                  <td style={{ padding: '8px', textAlign: 'right' }}>
                                    {h.tipo === 'JUSTIFICACION' ? (
                                      <div style={{ fontSize: '0.7rem', color: '#475569', whiteSpace: 'pre-wrap', textAlign: 'left', backgroundColor: '#fef3c7', padding: '6px', borderRadius: '4px' }}>
                                        {h.comentario}
                                      </div>
                                    ) : <span style={{ fontWeight: 'bold' }}>$ {(h.cant * h.pu).toLocaleString('de-DE')}</span>}
                                  </td>
                                  <td style={{ padding: '8px', textAlign: 'right', color: '#64748b', fontSize: '0.65rem' }}>{h.usuario_nombre}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </motion.div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </AnimatePresence>
          </tbody>
        </table>

        {rows.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
            <LayoutDashboard size={48} style={{ opacity: 0.2, marginBottom: '10px' }} />
            <p>No se encontraron registros activos para los filtros seleccionados.</p>
          </div>
        )}
      </div>


    </motion.div>
  );
};

export default Reportes;
