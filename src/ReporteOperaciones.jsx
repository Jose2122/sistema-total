import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart3,
    FileSpreadsheet,
    Calendar,
    Filter,
    Search,
    Printer,
    DollarSign,
    Briefcase,
    Users,
    Clock,
    CheckCircle2,
    AlertCircle,
    RotateCcw,
    FileText,
    TrendingUp,
    Package
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
    AreaChart,
    Area
} from 'recharts';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import './ReporteOperaciones.css';

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
                            name: obj.name || (obj.url.split('/').pop().split('?')[0])
                        };
                    }
                } catch {
                    // ignore
                }
            }
            return {
                url: trimmed,
                name: trimmed.split('/').pop().split('?')[0]
            };
        } else if (typeof item === 'object' && item !== null && item.url) {
            return {
                url: item.url,
                name: item.name || (item.url.split('/').pop().split('?')[0])
            };
        }
        return null;
    }).filter(item => item && typeof item.url === 'string' && item.url.trim().length > 10);
};

const COLORS = ['#2563eb', '#10b981', '#a855f7', '#f97316', '#0ea5e9', '#ec4899', '#f59e0b', '#64748b'];

const ReporteOperaciones = ({ currentUser }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({ tickets: [], requisiciones: [], solicitudes: [], partidas: [] });
    const [bancos, setBancos] = useState([]);

    // Filtros
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');
    const [filtroSemana, setFiltroSemana] = useState('');
    const [filtroCC, setFiltroCC] = useState('Todos');
    const [filtroAlmacen, setFiltroAlmacen] = useState('Todos');
    const [filtroCategoria, setFiltroCategoria] = useState('Todos');
    const [filtroMes, setFiltroMes] = useState('Todos');
    const [busqueda, setBusqueda] = useState('');

    const [activeTab, setActiveTab] = useState('costos'); // 'costos' | 'graficos'
    
    // Centros de costo filtrados
    const [listaCentrosCostos, setListaCentrosCostos] = useState([]);

    // Modals
    const [reqSeleccionada, setReqSeleccionada] = useState(null);
    const [tickSeleccionado, setTickSeleccionado] = useState(null);
    const [extendedTicketData, setExtendedTicketData] = useState(null);
    const [extendedLoading, setExtendedLoading] = useState(false);
    const [selectedFileIndex, setSelectedFileIndex] = useState(0);

    const safeFormatDate = (d, fmt = 'dd/MM/yyyy') => {
        if (!d) return '-';
        try {
            const parsed = parseISO(d);
            if (isNaN(parsed.getTime())) return '-';
            return format(parsed, fmt);
        } catch {
            return '-';
        }
    };

    const getWeekNumber = (d) => {
        if (!d) return 0;
        try {
            const date = new Date(d);
            if (isNaN(date.getTime())) return 0;
            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
            const week1 = new Date(date.getFullYear(), 0, 4);
            return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
        } catch { return 0; }
    };

    const parseMonedaPago = (metodo) => {
        if (!metodo) return '$/$';
        const str = String(metodo).toUpperCase();
        if (str.includes('BS') || str.includes('B/S')) {
            return 'Bs/$';
        }
        return '$/$';
    };

    const getMetodoPagoForTicketItem = (item) => {
        if (Array.isArray(item.historial_compras) && item.historial_compras.length > 0) {
            const metodos = item.historial_compras.map(h => h.metodo_pago).filter(Boolean);
            if (metodos.length > 0) {
                return metodos[metodos.length - 1];
            }
        }
        return item.metodo_pago_actual || '$ / BS';
    };

    const cargarDatos = useCallback(async () => {
        setLoading(true);
        try {
            const [resReq, resTickets, resCC, resBancos, resSols, resParts] = await Promise.all([
                supabase.from('requisiciones').select('*').eq('gerencia', 'Operaciones').order('fecha_emision', { ascending: false }),
                supabase.from('tickets_directos').select('*').eq('departamento', 'Operaciones').order('fecha_emision', { ascending: false }),
                supabase.from('maestros_centros_costo').select('id, nombre').eq('activo', true).order('nombre'),
                supabase.from('bancos').select('*').eq('activo', true),
                supabase.from('solicitudes_fondos').select('*').order('fecha_operativa', { ascending: false }),
                supabase.from('partidas_fondos').select('*')
            ]);

            if (resReq.error || resTickets.error) throw new Error("Error en la descarga de datos");
            
            if (resCC.data) {
                setListaCentrosCostos(resCC.data);
            }

            setData({
                tickets: resTickets.data || [],
                requisiciones: resReq.data || [],
                solicitudes: resSols.data || [],
                partidas: resParts.data || []
            });
            setBancos(resBancos.data || []);
        } catch (error) {
            console.error("Error cargando datos de Operaciones:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        cargarDatos();
    }, [cargarDatos]);

    // Registro de Almacén uno por uno
    const toggleAlmacenSubRow = async (requisicionId, itemIdx, historyIndex, valor) => {
        // 1. Actualización local
        setData(prev => {
            const nuevasReqs = prev.requisiciones.map(r => {
                if (r.id === requisicionId) {
                    const nuevosItems = [...(r.items || [])];
                    if (nuevosItems[itemIdx]) {
                        const item = { ...nuevosItems[itemIdx] };
                        const nuevoHistorial = [...(item.historial_compras || [])];
                        if (nuevoHistorial[historyIndex]) {
                            nuevoHistorial[historyIndex] = { ...nuevoHistorial[historyIndex], enviado_almacen: valor };
                        }
                        item.historial_compras = nuevoHistorial;
                        nuevosItems[itemIdx] = item;
                    }
                    return { ...r, items: nuevosItems };
                }
                return r;
            });
            return { ...prev, requisiciones: nuevasReqs };
        });

        // 2. Actualización en DB
        try {
            const req = data.requisiciones.find(r => r.id === requisicionId);
            if (!req) return;

            const nuevosItems = [...(req.items || [])];
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
            }
        } catch (err) {
            console.error("Error al actualizar almacén en sub-fila:", err);
        }
    };

    const handleOpenRequisicion = useCallback((ref, realId) => {
        const found = data.requisiciones.find(r => r.correlativo_req === ref || r.id === realId);
        if (found) {
            const items = Array.isArray(found.items) ? found.items : [];
            const montoEstimado = items.reduce((sum, i) => sum + (Number(i.cant) * (Number(i.pu) || 0)), 0);
            setReqSeleccionada({ ...found, montoEstimado });
        }
    }, [data.requisiciones]);

    const handleOpenTicket = useCallback(async (ref, uId) => {
        const ticketId = uId ? uId.split('-')[1] : null;
        const found = data.tickets.find(t => t.codigo_control === ref || (ticketId && String(t.id) === String(ticketId)));
        if (!found) return;

        setTickSeleccionado({
            ...found,
            montoTotal: Number(found.total_usd || 0),
            statusDisplay: (found.status?.toUpperCase() === 'PAGADO' || found.status?.toUpperCase() === 'COMPLETADO' || found.status?.toUpperCase() === 'COMPLETADA') ? 'Completada' : 'Pendiente'
        });
        setExtendedLoading(true);
        setSelectedFileIndex(0);
        setExtendedTicketData(null);

        try {
            const { data: ticketData, error } = await supabase
                .from('tickets_directos')
                .select('*')
                .eq('id', found.id)
                .single();
            if (error) throw error;

            let reqData = null;
            if (ticketData.solicitud_ref) {
                const { data: rData } = await supabase
                    .from('requisiciones')
                    .select('*')
                    .or(`id.eq.${ticketData.solicitud_ref},correlativo_req.eq.${ticketData.solicitud_ref}`)
                    .limit(1);
                if (rData && rData.length > 0) reqData = rData[0];
            }

            setExtendedTicketData({ ticket: ticketData, req: reqData });
        } catch (err) {
            console.error('Error fetching extended ticket data:', err);
            setExtendedTicketData({ ticket: found, req: null });
        } finally {
            setExtendedLoading(false);
        }
    }, [data.tickets]);

    // Mapeo dinámico y filtros del reporte de costos (Aplanado)
    const costosRows = useMemo(() => {
        const rows = [];

        // 1. Tickets Directos (Operaciones)
        data.tickets.forEach(t => {
            const items = Array.isArray(t.items) ? t.items : [];
            items.forEach(item => {
                const rowDate = t.fecha_emision ? t.fecha_emision.split('T')[0] : '';
                const reqMatch = data.requisiciones.find(r => r.correlativo_req === t.solicitud_ref || r.id === t.solicitud_ref);
                const proyectoRef = reqMatch ? (reqMatch.id_referencia_proyecto || 'Sin ID Proyecto') : 'Directo / Sin Proyecto';
                const metodo = getMetodoPagoForTicketItem(item);
                const monedaPago = parseMonedaPago(metodo);
                const docNumero = (item.historial_compras || []).map(h => h.doc_numero).filter(Boolean).join(', ') || '-';

                rows.push({
                    uId: `TK-${t.id}-${item.id || Math.random()}`,
                    fecha: rowDate,
                    semana: getWeekNumber(rowDate),
                    categoria: item.cat || item.categoria || t.clasificacion_admin || 'Directo',
                    descripcion: item.desc || item.descripcion || 'Sin descripción',
                    monto: Number(item.total || item.pu * item.cant || 0),
                    cc: item.cc || t.centro_costo || 'N/A',
                    gerencia: t.departamento || 'N/A',
                    tipo: 'TICKET',
                    ref: t.codigo_control || `TK-${t.id}`,
                    proyecto: proyectoRef,
                    moneda_pago: monedaPago,
                    solicitante: t.responsable_nombre || 'N/A',
                    factura: docNumero,
                    almacen: false
                });
            });
        });

        // 2. Requisiciones de Operaciones aprobadas
        data.requisiciones.filter(r => r.estado_aprobacion === 'aprobado_final').forEach(r => {
            const items = Array.isArray(r.items) ? r.items : [];
            items.forEach(item => {
                const historial = Array.isArray(item.historial_compras) ? item.historial_compras : [];
                historial.filter(h => h.tipo !== 'JUSTIFICACION').forEach((h, hIdx) => {
                    const rowDate = h.fecha ? h.fecha.split('T')[0] : '';
                    const monedaPago = parseMonedaPago(h.metodo_pago);
                    rows.push({
                        uId: `REQ-${r.id}-${item.id || Math.random()}-${hIdx}`,
                        fecha: rowDate,
                        semana: getWeekNumber(rowDate),
                        categoria: item.categoria || 'Compra',
                        descripcion: item.descripcion,
                        monto: (Number(h.cant) || 0) * (Number(h.pu) || 0),
                        cc: r.centro_costo,
                        gerencia: r.gerencia,
                        tipo: 'REQUISICIÓN',
                        ref: r.correlativo_req || `REQ-${r.id}`,
                        factura: h.doc_numero || '-',
                        almacen: r.enviado_almacen || h.enviado_almacen || false,
                        requisicionIdReal: r.id,
                        itemIdx: (r.items || []).indexOf(item),
                        historyIdx: hIdx,
                        solicitante: r.solicitante,
                        proyecto: r.id_referencia_proyecto || 'Sin ID Proyecto',
                        moneda_pago: monedaPago
                    });
                });
            });
        });

        // Aplicación de filtros
        return rows.sort((a, b) => b.fecha.localeCompare(a.fecha)).filter(row => {
            const matchBusqueda = row.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
                row.ref.toLowerCase().includes(busqueda.toLowerCase()) ||
                row.proyecto.toLowerCase().includes(busqueda.toLowerCase());
            
            const matchCC = filtroCC === 'Todos' || row.cc === filtroCC;
            const matchSemana = !filtroSemana || String(row.semana) === String(filtroSemana);
            
            let matchFecha = true;
            if (fechaDesde && row.fecha < fechaDesde) matchFecha = false;
            if (fechaHasta && row.fecha > fechaHasta) matchFecha = false;

            const matchAlmacen = filtroAlmacen === 'Todos' || (filtroAlmacen === 'Si' ? row.almacen : !row.almacen);
            const matchCategoria = filtroCategoria === 'Todos' || row.categoria === filtroCategoria;

            let matchMes = true;
            if (filtroMes !== 'Todos' && row.fecha) {
                const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
                const mIdx = new Date(row.fecha + 'T12:00:00').getMonth();
                matchMes = meses[mIdx] === filtroMes;
            }

            return matchBusqueda && matchCC && matchSemana && matchFecha && matchAlmacen && matchCategoria && matchMes;
        });
    }, [data, busqueda, filtroCC, filtroSemana, fechaDesde, fechaHasta, filtroAlmacen, filtroCategoria, filtroMes]);

    // KPI 1: Gasto Total
    const totalGasto = useMemo(() => {
        return costosRows.reduce((sum, r) => sum + (Number(r.monto) || 0), 0);
    }, [costosRows]);

    // KPI 2: Cantidad de Registros
    const totalMovimientos = costosRows.length;

    // KPI 3: Tasa de Eficiencia de Almacén (% de ítems de requisiciones que ya llegaron a almacén)
    const statsAlmacen = useMemo(() => {
        const reqRows = costosRows.filter(r => r.tipo === 'REQUISICIÓN');
        if (reqRows.length === 0) return { pct: 0, count: 0, total: 0 };
        const enAlmacen = reqRows.filter(r => r.almacen).length;
        const total = reqRows.length;
        return {
            pct: Math.round((enAlmacen / total) * 100) || 0,
            count: enAlmacen,
            total
        };
    }, [costosRows]);

    // KPI 4: SLA Promedio de entrega
    const statsSLA = useMemo(() => {
        const reqs = data.requisiciones.filter(r => r.fecha_emision);
        if (reqs.length === 0) return 0;
        let sumDays = 0;
        let count = 0;
        reqs.forEach(r => {
            const start = new Date(r.fecha_emision);
            const end = r.f_finalizado ? new Date(r.f_finalizado) : new Date();
            const diff = end - start;
            if (diff >= 0) {
                sumDays += diff / (1000 * 60 * 60 * 24);
                count++;
            }
        });
        return count > 0 ? (sumDays / count).toFixed(1) : 0;
    }, [data.requisiciones]);

    // --- GRÁFICOS COMPONENTES ---
    // Gráfico de Barras Horizontal: Gastos por Proyecto
    const chartGastosPorProyecto = useMemo(() => {
        const projs = {};
        costosRows.forEach(r => {
            const p = r.proyecto || 'Sin ID Proyecto';
            projs[p] = (projs[p] || 0) + Number(r.monto);
        });
        return Object.entries(projs).map(([name, value]) => ({
            name: name.length > 20 ? name.substring(0, 20) + '...' : name,
            value: Number(value.toFixed(2))
        })).sort((a, b) => b.value - a.value).slice(0, 8);
    }, [costosRows]);

    // Gráfico Doughnut: Gastos por Categoría
    const chartGastosPorCategoria = useMemo(() => {
        const cats = {};
        costosRows.forEach(r => {
            const c = r.categoria || 'Otros';
            cats[c] = (cats[c] || 0) + Number(r.monto);
        });
        const total = Object.values(cats).reduce((a, b) => a + b, 0);
        return Object.entries(cats).map(([name, value]) => ({
            name,
            value: Number(value.toFixed(2)),
            pct: total > 0 ? ((value / total) * 100).toFixed(1) : 0
        })).sort((a, b) => b.value - a.value).slice(0, 6);
    }, [costosRows]);

    // Gráfico de Área: Tendencia Semanal de Gastos
    const chartTendenciaSemanal = useMemo(() => {
        const weeks = {};
        costosRows.forEach(r => {
            const wKey = `Sem ${r.semana}`;
            weeks[wKey] = (weeks[wKey] || 0) + Number(r.monto);
        });
        return Object.entries(weeks).map(([name, total]) => {
            const num = parseInt(name.split(' ')[1]) || 0;
            return { name, total, num };
        }).sort((a, b) => a.num - b.num);
    }, [costosRows]);

    // --- EXPORTAR EXCEL ---
    const exportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reporte de Operaciones');

        const headerStyle = {
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } },
            font: { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 },
            alignment: { horizontal: 'center', vertical: 'middle' }
        };

        const columns = [
            { header: 'PROYECTO', key: 'proyecto', width: 28 },
            { header: 'CORRELATIVO #', key: 'ref', width: 18 },
            { header: 'ALMACÉN', key: 'almacen', width: 12 },
            { header: 'PRODUCTO / DESCRIPCIÓN', key: 'descripcion', width: 45 },
            { header: 'SOPORTE / FACTURA', key: 'factura', width: 18 },
            { header: 'FECHA', key: 'fecha', width: 15 },
            { header: 'ORIGEN (SOLICITANTE)', key: 'solicitante', width: 25 },
            { header: 'CLASIFICACIÓN (CAT.)', key: 'categoria', width: 22 },
            { header: 'MONEDA DE PAGO', key: 'moneda_pago', width: 15 },
            { header: 'FINANCIERO ($)', key: 'monto', width: 18 }
        ];

        worksheet.columns = columns;
        worksheet.getRow(1).eachCell((cell) => { Object.assign(cell, headerStyle); });
        worksheet.getRow(1).height = 30;

        costosRows.forEach(r => {
            const row = worksheet.addRow({
                proyecto: r.proyecto,
                ref: r.ref,
                almacen: r.almacen ? 'SÍ' : 'NO',
                descripcion: r.descripcion,
                factura: r.factura,
                fecha: r.fecha,
                solicitante: r.solicitante || 'N/A',
                categoria: r.categoria,
                moneda_pago: r.moneda_pago,
                monto: Number(r.monto) || 0
            });
            if (r.fecha) {
                try {
                    row.getCell(6).value = new Date(r.fecha + 'T12:00:00');
                    row.getCell(6).numFmt = 'dd/mm/yyyy';
                } catch {
                    // ignore
                }
            }
            row.getCell(10).numFmt = '"$"#,##0.00';
        });

        const totalRowIdx = costosRows.length + 2;
        worksheet.getCell(`I${totalRowIdx}`).value = 'TOTAL FILTRADO:';
        worksheet.getCell(`I${totalRowIdx}`).font = { bold: true };
        worksheet.getCell(`J${totalRowIdx}`).value = totalGasto;
        worksheet.getCell(`J${totalRowIdx}`).font = { bold: true, color: { argb: 'FF16A34A' } };
        worksheet.getCell(`J${totalRowIdx}`).numFmt = '"$"#,##0.00';

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Reporte_Costos_Operaciones_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    // --- EXPORTAR PDF ---
    const exportPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4');
        doc.setFillColor(15, 23, 42); // Charcoal background header
        doc.rect(0, 0, 297, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text("TOTAL CLEAN C.A. - REPORTE DE OPERACIONES", 15, 17);
        doc.setFontSize(10);
        doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 240, 17);

        const tableData = costosRows.map(r => [
            r.proyecto,
            safeFormatDate(r.fecha),
            r.ref,
            r.descripcion,
            `$ ${(Number(r.monto) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`,
            r.solicitante || 'N/A',
            r.categoria,
            r.factura,
            r.almacen ? 'SÍ' : 'NO'
        ]);

        autoTable(doc, {
            head: [['PROYECTO', 'FECHA', 'REF', 'DESCRIPCIÓN', 'MONTO ($)', 'SOLICITANTE', 'CATEGORÍA', 'FACTURA', 'ALM.']],
            body: tableData,
            startY: 35,
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42], fontSize: 8 },
            styles: { fontSize: 7, cellPadding: 2 },
            columnStyles: {
                4: { halign: 'right', fontStyle: 'bold' }
            },
            foot: [['', '', '', 'TOTAL GENERAL FILTRADO', `$ ${(Number(totalGasto) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`, '', '']],
            footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: 'bold' }
        });

        doc.save(`Reporte_Operaciones_TC_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    return (
        <div className="ro-container">
            {/* Header Module Card */}
            <div className="ro-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div className="ro-icon-main"><TrendingUp size={30} /></div>
                    <div>
                        <h1 className="ro-title">Reporte Especializado de Operaciones</h1>
                        <p className="ro-subtitle">Centro de Control de Costos y Recepciones de la Gerencia Operativa</p>
                    </div>
                </div>
                <div className="ro-actions">
                    <button className="ro-btn ro-btn-outline" onClick={exportExcel}><FileSpreadsheet size={16} /> EXCEL</button>
                    <button className="ro-btn ro-btn-gradient" onClick={exportPDF}><Printer size={16} /> IMPRIMIR CIERRE</button>
                </div>
            </div>

            {/* KPI Row (Glassmorphic look) */}
            <div className="ro-stats-grid">
                <div className="ro-stat-card blue">
                    <div className="ro-stat-info">
                        <label>Gasto Operaciones ($)</label>
                        <h3>$ {totalGasto.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</h3>
                    </div>
                    <div className="ro-stat-icon"><DollarSign size={20} /></div>
                </div>
                <div className="ro-stat-card purple">
                    <div className="ro-stat-info">
                        <label>Movimientos Totales</label>
                        <h3>{totalMovimientos} Renglones</h3>
                    </div>
                    <div className="ro-stat-icon"><Briefcase size={20} /></div>
                </div>
                <div className="ro-stat-card green">
                    <div className="ro-stat-info">
                        <label>Eficiencia Almacén</label>
                        <h3>{statsAlmacen.pct}% <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '500' }}>({statsAlmacen.count}/{statsAlmacen.total})</span></h3>
                    </div>
                    <div className="ro-stat-icon"><Package size={20} /></div>
                </div>
                <div className="ro-stat-card orange">
                    <div className="ro-stat-info">
                        <label>SLA Promedio Trámites</label>
                        <h3>{statsSLA} Días</h3>
                    </div>
                    <div className="ro-stat-icon"><Clock size={20} /></div>
                </div>
            </div>

            {/* Advanced Filters */}
            <div className="ro-filter-bar">
                <div className="ro-filter-item search">
                    <label>Búsqueda</label>
                    <div style={{ position: 'relative', width: '100%' }}>
                        <Search size={16} className="ro-search-icon" />
                        <input type="text" placeholder="ID, Descripción, Proyecto..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                    </div>
                </div>
                <div className="ro-filter-item" style={{ minWidth: '150px' }}>
                    <label>Fechas</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.8rem' }} />
                        <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.8rem' }} />
                    </div>
                </div>
                <div className="ro-filter-item" style={{ minWidth: '120px' }}>
                    <label>Proyecto (CC)</label>
                    <select value={filtroCC} onChange={e => setFiltroCC(e.target.value)}>
                        <option value="Todos">Todos</option>
                        {listaCentrosCostos.map(cc => <option key={cc.id} value={cc.nombre}>{cc.nombre}</option>)}
                    </select>
                </div>
                <div className="ro-filter-item" style={{ minWidth: '120px' }}>
                    <label>Mes</label>
                    <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
                        <option value="Todos">Todos</option>
                        {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                <div className="ro-filter-item" style={{ minWidth: '110px' }}>
                    <label>Almacén</label>
                    <select value={filtroAlmacen} onChange={e => setFiltroAlmacen(e.target.value)}>
                        <option value="Todos">Todos</option>
                        <option value="Si">Sí 📦</option>
                        <option value="No">No 📥</option>
                    </select>
                </div>
            </div>

            {/* Tabs de Vistas */}
            <div className="ro-tabs">
                <button className={`ro-tab ${activeTab === 'costos' ? 'active' : ''}`} onClick={() => setActiveTab('costos')}>RELACIÓN DE GASTOS</button>
                <button className={`ro-tab ${activeTab === 'graficos' ? 'active' : ''}`} onClick={() => setActiveTab('graficos')}>ESTADÍSTICAS Y GRÁFICOS</button>
            </div>

            {/* Loading / Content Render */}
            {loading ? (
                <div className="ro-loader-wrapper">
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><DollarSign size={40} color="#2563eb" /></motion.div>
                    <span>Cargando reportes del área de Operaciones...</span>
                </div>
            ) : (
                <AnimatePresence mode="wait">
                    {activeTab === 'costos' && (
                        <motion.div key="costos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="ro-table-card">
                            <table className="ro-table">
                                <thead>
                                    <tr>
                                        <th>PROYECTO / FECHA</th>
                                        <th>REF #</th>
                                        <th style={{ textAlign: 'center' }}>ALM.</th>
                                        <th>PRODUCTO</th>
                                        <th>FACTURA</th>
                                        <th>SOLICITANTE</th>
                                        <th>TIPO PAGO</th>
                                        <th>CAT.</th>
                                        <th>DESTINO (G/CC)</th>
                                        <th style={{ textAlign: 'right' }}>TOTAL ($)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {costosRows.map((r) => (
                                        <tr key={r.uId}>
                                            <td>
                                                <span className="ro-table-link" onClick={() => r.tipo === 'REQUISICIÓN' ? handleOpenRequisicion(r.ref, r.requisicionIdReal) : handleOpenTicket(r.ref, r.uId)}>
                                                    {r.proyecto}
                                                </span>
                                                <span className="ro-table-subtext">{safeFormatDate(r.fecha)}</span>
                                            </td>
                                            <td>
                                                <span className="ro-table-link" onClick={() => r.tipo === 'REQUISICIÓN' ? handleOpenRequisicion(r.ref, r.requisicionIdReal) : handleOpenTicket(r.ref, r.uId)}>
                                                    {r.ref}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {r.tipo === 'REQUISICIÓN' ? (
                                                    <div
                                                        onClick={() => toggleAlmacenSubRow(r.requisicionIdReal, r.itemIdx, r.historyIdx, !r.almacen)}
                                                        style={{
                                                            cursor: 'pointer',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            width: '24px',
                                                            height: '24px',
                                                            borderRadius: '6px',
                                                            backgroundColor: r.almacen ? '#e0f2fe' : '#f1f5f9',
                                                            border: '1px solid',
                                                            borderColor: r.almacen ? '#2563eb' : '#e2e8f0',
                                                            color: r.almacen ? '#1d4ed8' : '#94a3b8',
                                                            transition: 'all 0.2s',
                                                            fontSize: '0.8rem'
                                                        }}
                                                        title={r.almacen ? 'Registrado en Almacén' : 'Marcar como enviado a Almacén'}
                                                    >
                                                        {r.almacen ? '📦' : '📥'}
                                                    </div>
                                                ) : (
                                                    <span style={{ fontSize: '1.1rem', opacity: 0.1 }}>📦</span>
                                                )}
                                            </td>
                                            <td className="ro-td-desc">{r.descripcion}</td>
                                            <td className="ro-td-invoice">{r.factura}</td>
                                            <td className="ro-td-solicitante">{r.solicitante || 'N/A'}</td>
                                            <td>
                                                <span className={`ro-badge-pago ${r.moneda_pago === 'Bs/$' ? 'bs' : 'usd'}`}>
                                                    Pago {r.moneda_pago}
                                                </span>
                                            </td>
                                            <td><span className="ro-badge-type">{r.categoria}</span></td>
                                            <td>
                                                <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>{r.cc?.split('(')[0]}</span>
                                                <span className="ro-table-subtext">{r.gerencia}</span>
                                            </td>
                                            <td className="ro-td-amount">$ {(r.monto || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {costosRows.length === 0 && (
                                <div className="ro-empty-state">
                                    No se encontraron movimientos registrados con los filtros aplicados.
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'graficos' && (
                        <motion.div key="graficos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="ro-charts-row">
                            {/* Gráfico 1: Gastos por Proyecto */}
                            <div className="ro-chart-box">
                                <div className="ro-chart-header">
                                    <h3>Gastos por Proyecto / Centro de Costo</h3>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#2563eb' }}>Top Proyectos</span>
                                </div>
                                <div style={{ height: '300px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartGastosPorProyecto} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                                            <XAxis type="number" stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `$${v}`} />
                                            <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} width={110} />
                                            <Tooltip formatter={(value) => [`$ ${value.toLocaleString('de-DE')}`, 'Gasto']} />
                                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                                                {chartGastosPorProyecto.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Gráfico 2: Distribución por Categoría */}
                            <div className="ro-chart-box">
                                <div className="ro-chart-header">
                                    <h3>Distribución por Categorías</h3>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#10b981' }}>Gastos en %</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', alignItems: 'center', height: '300px' }}>
                                    <div style={{ height: '240px' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={chartGastosPorCategoria}
                                                    dataKey="value"
                                                    innerRadius={50}
                                                    outerRadius={80}
                                                    paddingAngle={3}
                                                >
                                                    {chartGastosPorCategoria.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(value) => [`$ ${value.toLocaleString('de-DE')}`, 'Monto']} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <ul className="ro-chart-legend">
                                        {chartGastosPorCategoria.map((entry, index) => (
                                            <li key={entry.name}>
                                                <span className="dot" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                                                <span style={{ display: 'inline-block', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.name}>{entry.name}</span>
                                                <span className="val">{entry.pct}%</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Gráfico 3: Historial Semanal (Full width) */}
                            <div className="ro-chart-box full">
                                <div className="ro-chart-header">
                                    <h3>Historial Semanal de Gastos Operativos</h3>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#a855f7' }}>Tendencia en Tiempo</span>
                                </div>
                                <div style={{ height: '260px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartTendenciaSemanal}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                                            <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `$${v}`} />
                                            <Tooltip formatter={(value) => [`$ ${value.toLocaleString('de-DE')}`, 'Monto']} />
                                            <Area type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2.5} fillOpacity={0.15} fill="url(#colorTotal)" />
                                            <defs>
                                                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                                                </linearGradient>
                                            </defs>
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}

            {/* DETAIL MODALS (REUSED HIGH FIDELITY LAYOUTS) */}
            <AnimatePresence>
                {reqSeleccionada && (
                    <div className="ro-modal-overlay" onClick={() => setReqSeleccionada(null)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="ro-detail-modal"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="ro-modal-header">
                                <h2>Detalle de Requisición: {reqSeleccionada.correlativo_req || reqSeleccionada.id}</h2>
                                <button onClick={() => setReqSeleccionada(null)}>×</button>
                            </div>
                            <div className="ro-modal-body">
                                <div className="ro-modal-info-grid">
                                    <div className="ro-min-card"><strong>Solicitante:</strong> {reqSeleccionada.solicitante}</div>
                                    <div className="ro-min-card"><strong>Gerencia:</strong> {reqSeleccionada.gerencia}</div>
                                    <div className="ro-min-card"><strong>Prioridad:</strong> {reqSeleccionada.prioridad}</div>
                                    <div className="ro-min-card"><strong>Monto Total Estimado:</strong> $ {(reqSeleccionada.montoEstimado || 0).toLocaleString('de-DE')}</div>
                                </div>
                                <div className="ro-modal-table-box" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                                    <table className="ro-mini-table">
                                        <thead>
                                            <tr><th>Ítem</th><th>Cant</th><th>Categoría</th><th>Estado</th></tr>
                                        </thead>
                                        <tbody>
                                            {reqSeleccionada.items?.map((it, idx) => (
                                                <tr key={idx}>
                                                    <td>{it.descripcion}</td>
                                                    <td>{it.cant} {it.uni || it.unidad || ''}</td>
                                                    <td>{it.categoria || 'S/C'}</td>
                                                    <td><span className="ro-badge-type">{it.historial_compras?.length > 0 ? 'Procesado' : 'Pendiente'}</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {tickSeleccionado && (
                    <div className="ro-modal-overlay" onClick={() => { setTickSeleccionado(null); setExtendedTicketData(null); }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="ro-detail-modal"
                            style={{ maxWidth: '1000px', width: '95%' }}
                            onClick={e => e.stopPropagation()}
                        >
                            {(() => {
                                const ticket = extendedTicketData?.ticket || tickSeleccionado;
                                const req = extendedTicketData?.req;
                                const status = ticket.status?.toUpperCase() || 'EMITIDO';
                                const statusDisplay = (status === 'PAGADO' || status === 'COMPLETADO' || status === 'COMPLETADA') ? 'Completada' : 'Pendiente';
                                const bancoNombre = bancos.find(b => b.id === ticket.banco_pago_id)?.nombre
                                    || ticket.banco_origen
                                    || (ticket.items || []).flatMap(r => (r.historial_compras || []).map(h => h.banco_nombre)).filter(Boolean)[0]
                                    || '-';
                                const metodoRaw = ticket.metodo_pago
                                    || (ticket.items || []).flatMap(r => (r.historial_compras || []).map(h => h.metodo_pago)).filter(Boolean)[0]
                                    || '$/$';
                                const metodoPago = parseMonedaPago(metodoRaw);
                                const invoiceFiles = parsearFacturaUrls(ticket.factura_url);

                                return (
                                    <>
                                        <div className="ro-modal-header">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <h2 style={{ margin: 0 }}>Referencia: {ticket.codigo_control || `TX-${String(ticket.id).padStart(4, '0')}`}</h2>
                                                <span className={`ro-badge-status ${statusDisplay.toLowerCase()}`}>
                                                    {statusDisplay.toUpperCase()}
                                                </span>
                                            </div>
                                            <button onClick={() => { setTickSeleccionado(null); setExtendedTicketData(null); }}>×</button>
                                        </div>
                                        <div className="ro-modal-body">
                                            {extendedLoading ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '350px', gap: '12px' }}>
                                                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                                                        <DollarSign size={36} color="#2563eb" />
                                                    </motion.div>
                                                    <span style={{ color: '#64748b', fontWeight: '600', fontSize: '0.85rem' }}>Cargando comprobantes y firmas...</span>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
                                                    {/* Left Panel */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                        <div>
                                                            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>Detalles Generales</h4>
                                                            <div className="ro-modal-info-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: 0 }}>
                                                                <div className="ro-min-card"><strong>Responsable:</strong> {ticket.responsable_nombre || ticket.gerente_nombre || 'N/A'}</div>
                                                                <div className="ro-min-card"><strong>Proyecto CC:</strong> {ticket.centro_costo || 'N/A'}</div>
                                                                <div className="ro-min-card"><strong>Monto:</strong> $ {(Number(ticket.total_usd) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</div>
                                                                <div className="ro-min-card"><strong>Tipo de Pago:</strong> Pago {metodoPago}</div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>Tiempos y Liquidación</h4>
                                                            <div className="ro-modal-info-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: 0 }}>
                                                                <div className="ro-min-card"><strong>F. Emisión:</strong> {safeFormatDate(ticket.fecha_emision || ticket.created_at)}</div>
                                                                <div className="ro-min-card"><strong>F. Pago:</strong> {statusDisplay === 'Completada' ? safeFormatDate(ticket.fecha_pago || ticket.updated_at) : 'Pendiente'}</div>
                                                                <div className="ro-min-card" style={{ gridColumn: 'span 2' }}><strong>Banco Liquidación:</strong> {bancoNombre}</div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>Ítems Solicitados</h4>
                                                            <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                                                                <table className="ro-mini-table">
                                                                    <thead>
                                                                        <tr><th>Descripción</th><th style={{ textAlign: 'right' }}>Total</th></tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {ticket.items?.map((it, idx) => (
                                                                            <tr key={idx}>
                                                                                <td style={{ fontSize: '0.75rem' }}>{it.descripcion || it.desc}</td>
                                                                                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.8rem' }}>$ {(Number(it.total) || (Number(it.pu) * Number(it.cant))).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>

                                                        {ticket.justificacion && (
                                                            <div>
                                                                <h4 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>Notas / Observaciones</h4>
                                                                <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '10px', fontSize: '0.8rem', color: '#78350f', whiteSpace: 'pre-line', lineHeight: '1.4' }}>
                                                                    {ticket.justificacion}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Right Panel: Signatures & Invoices */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                        <div>
                                                            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>Aprobaciones (Requisición Asoc.)</h4>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                                                <div style={{ padding: '8px', border: '1px dashed #cbd5e1', borderRadius: '10px', background: '#f8fafc', textAlign: 'center', fontSize: '0.7rem' }}>
                                                                    <div style={{ fontWeight: '800', color: '#64748b' }}>Proyecto (N0)</div>
                                                                    {req?.f_aprobacion_proyecto ? (
                                                                        <>
                                                                            <div style={{ color: '#16a34a', fontWeight: 'bold', margin: '2px 0' }}>✓</div>
                                                                            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.n_aprobacion_proyecto?.split(' ')[0]}</div>
                                                                        </>
                                                                    ) : <div style={{ color: '#94a3b8', margin: '4px 0' }}>N/A</div>}
                                                                </div>
                                                                <div style={{ padding: '8px', border: '1px dashed #cbd5e1', borderRadius: '10px', background: '#f8fafc', textAlign: 'center', fontSize: '0.7rem' }}>
                                                                    <div style={{ fontWeight: '800', color: '#64748b' }}>Área (N1)</div>
                                                                    {req?.f_aprobacion_area ? (
                                                                        <>
                                                                            <div style={{ color: '#16a34a', fontWeight: 'bold', margin: '2px 0' }}>✓</div>
                                                                            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.n_aprobacion_area?.split(' ')[0]}</div>
                                                                        </>
                                                                    ) : <div style={{ color: '#94a3b8', margin: '4px 0' }}>N/A</div>}
                                                                </div>
                                                                <div style={{ padding: '8px', border: '1px dashed #cbd5e1', borderRadius: '10px', background: '#f8fafc', textAlign: 'center', fontSize: '0.7rem' }}>
                                                                    <div style={{ fontWeight: '800', color: '#64748b' }}>General (N2)</div>
                                                                    {req?.f_aprobacion_general ? (
                                                                        <>
                                                                            <div style={{ color: '#16a34a', fontWeight: 'bold', margin: '2px 0' }}>✓</div>
                                                                            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.n_aprobacion_general?.split(' ')[0]}</div>
                                                                        </>
                                                                    ) : <div style={{ color: '#94a3b8', margin: '4px 0' }}>N/A</div>}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>Comprobantes / Facturas</h4>
                                                            {invoiceFiles.length === 0 ? (
                                                                <div style={{ padding: '30px 10px', textAlign: 'center', border: '1px dashed #cbd5e1', borderRadius: '12px', color: '#94a3b8', fontSize: '0.8rem' }}>
                                                                    No hay comprobantes cargados para este ticket.
                                                                </div>
                                                            ) : (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                                        {invoiceFiles.map((file, fIdx) => (
                                                                            <button
                                                                                key={fIdx}
                                                                                className={`ro-file-badge ${selectedFileIndex === fIdx ? 'active' : ''}`}
                                                                                onClick={() => setSelectedFileIndex(fIdx)}
                                                                            >
                                                                                <FileText size={12} /> Doc {fIdx + 1}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                            <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#475569', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                                {invoiceFiles[selectedFileIndex]?.name || 'documento'}
                                                                            </span>
                                                                            <a
                                                                                href={invoiceFiles[selectedFileIndex]?.url}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 'bold', textDecoration: 'none' }}
                                                                            >
                                                                                ABRIR ENLACE ↗
                                                                            </a>
                                                                        </div>
                                                                        {(() => {
                                                                            const fileUrl = invoiceFiles[selectedFileIndex]?.url || '';
                                                                            const lowerUrl = fileUrl.toLowerCase();
                                                                            if (lowerUrl.includes('.pdf')) {
                                                                                return <iframe src={fileUrl} style={{ width: '100%', height: '240px', border: 'none', borderRadius: '8px' }} title="PDF Viewer" />;
                                                                            } else if (lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg') || lowerUrl.includes('.png') || lowerUrl.includes('.webp') || lowerUrl.includes('.gif')) {
                                                                                return <img src={fileUrl} style={{ width: '100%', maxHeight: '240px', objectFit: 'contain', borderRadius: '8px' }} alt="Comprobante Factura" />;
                                                                            }
                                                                            return <div style={{ padding: '20px', textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>Previsualización no disponible para este formato. Haga clic en abrir enlace.</div>;
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                );
                            })()}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ReporteOperaciones;
