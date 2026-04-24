import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart3,
    FileSpreadsheet,
    Calendar,
    Filter,
    Search,
    Download,
    Printer,
    ChevronRight,
    DollarSign,
    Briefcase,
    Users,
    PieChart as PieChartIcon,
    LayoutDashboard,
    FileText,
    Clock,
    CheckCircle2,
    AlertCircle
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
    Legend
} from 'recharts';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format, getWeek, parseISO } from 'date-fns';
import './ReportesMaestro.css';

const COLORS = ['#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#64748b'];

const ReportesMaestro = () => {
    const [activeTab, setActiveTab] = useState('costos');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({ tickets: [], requisiciones: [] });
    const [bancos, setBancos] = useState([]);

    // Filtros
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');
    const [filtroSemana, setFiltroSemana] = useState('');
    const [filtroCC, setFiltroCC] = useState('Todos');
    const [filtroGerencia, setFiltroGerencia] = useState('Todos');
    const [filtroEstadoReq, setFiltroEstadoReq] = useState('Todos');
    const [filtroEstadoTick, setFiltroEstadoTick] = useState('Todos');
    const [filtroSolicitante, setFiltroSolicitante] = useState('Todos');
    const [filtroMes, setFiltroMes] = useState('Todos');

    // Filtros por Pestaña (Nuevos)
    const [filtroCategoria, setFiltroCategoria] = useState('Todos');
    const [filtroCC_Tab, setFiltroCC_Tab] = useState('Todos');

    const [filtroGerenciaDash, setFiltroGerenciaDash] = useState(null); // Para interactividad dashboard
    const [incluirTickets, setIncluirTickets] = useState(true);
    const [incluirReqs, setIncluirReqs] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [reqSeleccionada, setReqSeleccionada] = useState(null); // Para modal detalle
    const [tickSeleccionado, setTickSeleccionado] = useState(null); // Para modal ticket
    const [gerenciaDetalle, setGerenciaDetalle] = useState(null); // Para drill-down
    const [busquedaProyecto, setBusquedaProyecto] = useState(''); // Para reporte Operaciones

    // Auxiliares de seguridad
    const safeFormatDate = (d, fmt = 'dd/MM/yyyy') => {
        if (!d) return '-';
        try {
            const parsed = parseISO(d);
            if (isNaN(parsed.getTime())) return '-';
            return format(parsed, fmt);
        } catch (e) {
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
        } catch (e) { return 0; }
    };

    const calcularSLA = (req) => {
        const ahora = new Date();
        const inicio = req.fecha_emision ? new Date(req.fecha_emision) : null;
        if (!inicio) return { duracion: '-', alerta: false };

        const fin = req.f_finalizado ? new Date(req.f_finalizado) : ahora;
        
        const diffMs = Math.max(0, fin - inicio);
        const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const horas = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
        const duracionStr = dias > 0 ? `${dias}d ${horas}h` : `${horas}h`;

        let alerta = false;
        if (!req.f_finalizado) {
            const t1 = req.f_inicio_compras ? new Date(req.f_inicio_compras) :
                       req.f_aprobacion_general ? new Date(req.f_aprobacion_general) :
                       req.f_aprobacion_area ? new Date(req.f_aprobacion_area) :
                       req.f_aprobacion_proyecto ? new Date(req.f_aprobacion_proyecto) :
                       inicio;
            const diffUltimo = ahora - t1;
            const horasEstancado = diffUltimo / (1000 * 60 * 60);
            if (horasEstancado > 48) alerta = true;
        }

        return { duracion: duracionStr, alerta };
    };

    const cargarDatos = useCallback(async () => {
        setLoading(true);
        try {
            const { data: tickets, error: errT } = await supabase
                .from('tickets_directos')
                .select('*')
                .order('fecha_emision', { ascending: false });

            const { data: reqs, error: errR } = await supabase
                .from('requisiciones')
                .select('*')
                .order('fecha_emision', { ascending: false });

            const { data: bData, error: errB } = await supabase
                .from('bancos')
                .select('*')
                .eq('activo', true);

            if (errT || errR || errB) throw new Error("Error en la descarga de datos");

            setData({ tickets: tickets || [], requisiciones: reqs || [] });
            setBancos(bData || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        cargarDatos();
    }, [cargarDatos]);

    // --- PROCESAMIENTO: VISTA 1 - RELACIÓN DE COSTOS (FLATTENED) ---
    const costosRows = useMemo(() => {
        const rows = [];

        // 1. Procesar Tickets Directos
        data.tickets.forEach(t => {
            const items = Array.isArray(t.items) ? t.items : [];
            items.forEach(item => {
                const rowDate = t.fecha_emision ? t.fecha_emision.split('T')[0] : '';
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
                    ref: t.codigo_control || `TK-${t.id}`
                });
            });
        });

        // 2. Procesar Requisiciones (Historial de Compras sólamente para Relación de Costos)
        data.requisiciones.filter(r => r.estado_aprobacion === 'aprobado_final').forEach(r => {
            const items = Array.isArray(r.items) ? r.items : [];
            items.forEach(item => {
                const historial = Array.isArray(item.historial_compras) ? item.historial_compras : [];
                historial.filter(h => h.tipo !== 'JUSTIFICACION').forEach((h, hIdx) => {
                    const rowDate = h.fecha ? h.fecha.split('T')[0] : '';
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
                        factura: h.doc_numero || '-'
                    });
                });
            });
        });

        return rows.sort((a, b) => b.fecha.localeCompare(a.fecha)).filter(row => {
            const matchBusqueda = row.descripcion.toLowerCase().includes(busqueda.toLowerCase()) || row.ref.toLowerCase().includes(busqueda.toLowerCase());
            const matchCC = filtroCC === 'Todos' || row.cc === filtroCC;
            const matchGerencia = filtroGerencia === 'Todos' || row.gerencia === filtroGerencia;
            const matchSemana = !filtroSemana || String(row.semana) === String(filtroSemana);
            let matchFecha = true;
            if (fechaDesde && row.fecha < fechaDesde) matchFecha = false;
            if (fechaHasta && row.fecha > fechaHasta) matchFecha = false;

            return matchBusqueda && matchCC && matchGerencia && matchSemana && matchFecha;
        });
    }, [data, busqueda, filtroCC, filtroGerencia, filtroSemana, fechaDesde, fechaHasta]);

    const totalGasto = useMemo(() => {
        return costosRows.reduce((sum, r) => sum + (Number(r.monto) || 0), 0);
    }, [costosRows]);

    // --- PROCESAMIENTO: VISTA 2 - CONTROL DE TICKETS ---
    const ticketsFiltered = useMemo(() => {
        return data.tickets.filter(t => {
            const matchBusqueda = t.codigo_control?.toLowerCase().includes(busqueda.toLowerCase()) || t.responsable_nombre?.toLowerCase().includes(busqueda.toLowerCase());
            const matchGerencia = filtroGerencia === 'Todos' || t.departamento === filtroGerencia;
            let matchFecha = true;
            if (fechaDesde && t.fecha_emision?.split('T')[0] < fechaDesde) matchFecha = false;
            if (fechaHasta && t.fecha_emision?.split('T')[0] > fechaHasta) matchFecha = false;
            return matchBusqueda && matchGerencia && matchFecha;
        });
    }, [data.tickets, busqueda, filtroGerencia, fechaDesde, fechaHasta]);

    // --- PROCESAMIENTO: VISTA 3 - CONTROL DE REQUISICIONES ---
    const requisicionesControl = useMemo(() => {
        return data.requisiciones.map(r => {
            const items = Array.isArray(r.items) ? r.items : [];
            const montoEstimado = items.reduce((sum, i) => sum + (Number(i.cant) * (Number(i.pu) || 0)), 0);

            const totalEjecutado = items.reduce((s, i) => {
                const h = Array.isArray(i.historial_compras) ? i.historial_compras : [];
                return s + h.reduce((acc, comp) => acc + (Number(comp.cant) * (Number(comp.pu) || 0)), 0);
            }, 0);

            // Determinar status operativo
            const statusCompra = r.status_compra?.toUpperCase() || 'EN ESPERA';
            let statusDisplay = 'Pendiente';
            if (statusCompra === 'COMPLETADO') statusDisplay = 'Completada';
            else if (statusCompra === 'PARCIAL') statusDisplay = 'Procesando';

            // Calcular tiempo de cierre
            let diasCierre = null;
            if (statusCompra === 'COMPLETADO') {
                const start = new Date(r.created_at || r.fecha_emision);
                let lastPurchase = start;
                items.forEach(i => {
                    const h = Array.isArray(i.historial_compras) ? i.historial_compras : [];
                    h.forEach(compra => {
                        const d = new Date(compra.fecha);
                        if (!isNaN(d.getTime()) && d > lastPurchase) lastPurchase = d;
                    });
                });
                if (!isNaN(start.getTime()) && !isNaN(lastPurchase.getTime())) {
                    diasCierre = (lastPurchase - start) / (1000 * 60 * 60 * 24);
                }
            }

            return {
                ...r,
                montoEstimado: Number(montoEstimado) || 0,
                totalEjecutado: Number(totalEjecutado) || 0,
                statusDisplay,
                diasCierre,
                itemsCount: items.length
            };
        }).filter(r => {
            const matchBusqueda = (r.justificacion || '').toLowerCase().includes(busqueda.toLowerCase()) ||
                (r.correlativo_req || '').toLowerCase().includes(busqueda.toLowerCase());
            const matchStatus = filtroEstadoReq === 'Todos' || r.statusDisplay === filtroEstadoReq;
            const matchSolicitante = filtroSolicitante === 'Todos' || r.solicitante === filtroSolicitante;
            const matchCC = filtroCC_Tab === 'Todos' || r.centro_costo === filtroCC_Tab;
            const matchGerencia = filtroGerencia === 'Todos' || r.gerencia === filtroGerencia;

            // Filtro por categoría de los items
            const matchCat = filtroCategoria === 'Todos' || (r.items || []).some(it => it.categoria === filtroCategoria);

            let matchFecha = true;
            const rFecha = (r.fecha_emision || '').split('T')[0];
            if (fechaDesde && rFecha < fechaDesde) matchFecha = false;
            if (fechaHasta && rFecha > fechaHasta) matchFecha = false;

            return matchBusqueda && matchStatus && matchSolicitante && matchCC && matchGerencia && matchCat && matchFecha;
        });
    }, [data.requisiciones, busqueda, filtroEstadoReq, filtroSolicitante, filtroCC_Tab, filtroGerencia, filtroCategoria, fechaDesde, fechaHasta]);

    const tiempoPromedioCierre = useMemo(() => {
        const cerradas = requisicionesControl.filter(r => r.diasCierre !== null);
        if (cerradas.length === 0) return 0;
        const total = cerradas.reduce((sum, r) => sum + r.diasCierre, 0);
        return (total / cerradas.length).toFixed(1);
    }, [requisicionesControl]);

    const tiempoRespuestaGerencial = useMemo(() => {
        const aprobadas = requisicionesControl.filter(r => r.fecha_aprobacion);
        if (aprobadas.length === 0) return 0;
        const total = aprobadas.reduce((sum, r) => {
            const start = new Date(r.created_at || r.fecha_emision);
            const end = new Date(r.fecha_aprobacion);
            return sum + ((end - start) / (1000 * 60 * 60 * 24));
        }, 0);
        return (total / aprobadas.length).toFixed(1);
    }, [requisicionesControl]);

    // --- PROCESAMIENTO: VISTA 4 - CONTROL DE TICKETS ---
    const ticketsControl = useMemo(() => {
        return data.tickets.map(t => {
            const items = Array.isArray(t.items) ? t.items : [];
            const status = t.status?.toUpperCase() || 'EMITIDO';
            const statusDisplay = status === 'PAGADO' ? 'Completada' : 'Pendiente';

            return {
                ...t,
                statusDisplay,
                itemsCount: items.length,
                montoTotal: Number(t.total_usd || 0)
            };
        }).filter(t => {
            const matchBusqueda = (t.codigo_control || '').toLowerCase().includes(busqueda.toLowerCase()) ||
                (t.responsable_nombre || '').toLowerCase().includes(busqueda.toLowerCase());
            const matchStatus = filtroEstadoTick === 'Todos' || t.statusDisplay === filtroEstadoTick;
            const matchGerencia = filtroGerencia === 'Todos' || t.departamento === filtroGerencia;
            const matchCC = filtroCC_Tab === 'Todos' || t.centro_costo === filtroCC_Tab;
            const matchCat = filtroCategoria === 'Todos' || t.clasificacion_admin === filtroCategoria;

            let matchFecha = true;
            const tFecha = t.fecha_emision?.split('T')[0];
            if (fechaDesde && tFecha < fechaDesde) matchFecha = false;
            if (fechaHasta && tFecha > fechaHasta) matchFecha = false;

            return matchBusqueda && matchStatus && matchGerencia && matchCC && matchCat && matchFecha;
        });
    }, [data.tickets, busqueda, filtroEstadoTick, filtroGerencia, filtroCC_Tab, filtroCategoria, fechaDesde, fechaHasta]);

    // --- PROCESAMIENTO: VISTA 5 - CONSUMO POR GERENCIA (ANALÍTICO) ---
    const consumoGerencial = useMemo(() => {
        const stats = {};
        const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

        // Función helper para procesar registros
        const procesar = (registros, esTicket) => {
            registros.forEach(r => {
                const fechaStr = r.fecha_emision || r.created_at;
                if (!fechaStr) return;
                const date = parseISO(fechaStr);
                const mIndex = date.getMonth();
                const mName = meses[mIndex];
                const wNum = getWeekNumber(fechaStr);

                // Filtros Temporales
                if (filtroMes !== 'Todos' && mName !== filtroMes) return;
                if (filtroSemana && String(wNum) !== String(filtroSemana)) return;

                const gName = (esTicket ? r.departamento : r.gerencia) || 'S/G';
                if (!stats[gName]) {
                    stats[gName] = { name: gName, cant: 0, solicitado: 0, ejecutado: 0, items: [] };
                }

                const items = Array.isArray(r.items) ? r.items : [];
                stats[gName].cant += 1;

                if (esTicket) {
                    const monto = Number(r.total_usd || 0);
                    stats[gName].solicitado += monto;
                    stats[gName].ejecutado += (r.status?.toUpperCase() === 'PAGADO' ? monto : 0);
                    items.forEach(it => {
                        stats[gName].items.push({
                            desc: it.descripcion || it.desc,
                            costo: Number(it.total) || ((Number(it.pu) || 0) * (Number(it.cant) || 1)),
                            ref: r.codigo_control,
                            tipo: 'TICKET'
                        });
                    });
                } else {
                    const est = items.reduce((s, i) => s + (Number(i.cant) * (Number(i.pu) || 0)), 0);
                    const ejec = items.reduce((s, i) => {
                        const h = Array.isArray(i.historial_compras) ? i.historial_compras : [];
                        return s + h.reduce((acc, comp) => acc + (Number(comp.cant) * (Number(comp.pu) || 0)), 0);
                    }, 0);
                    stats[gName].solicitado += est;
                    stats[gName].ejecutado += ejec;
                    items.forEach(it => {
                        const h = Array.isArray(it.historial_compras) ? it.historial_compras : [];
                        const itEjec = h.reduce((acc, comp) => acc + (Number(comp.cant) * (Number(comp.pu) || 0)), 0);
                        stats[gName].items.push({
                            desc: it.descripcion,
                            costo: itEjec || (Number(it.cant) * (Number(it.pu) || 0)),
                            ref: r.correlativo_req || r.id,
                            tipo: 'REQ'
                        });
                    });
                }
            });
        };

        if (incluirReqs) procesar(data.requisiciones, false);
        if (incluirTickets) procesar(data.tickets, true);

        return Object.values(stats).map(g => ({
            ...g,
            porcentaje: g.solicitado > 0 ? ((g.ejecutado / g.solicitado) * 100).toFixed(1) : 0,
            items: g.items.sort((a, b) => b.costo - a.costo)
        })).sort((a, b) => b.ejecutado - a.ejecutado);
    }, [data, filtroMes, filtroSemana, incluirReqs, incluirTickets]);

    // --- PROCESAMIENTO: DASHBOARD AVANZADO (RESTAURADO) ---
    const kpis = useMemo(() => {
        const listReqs = requisicionesControl || [];
        const listTickets = ticketsControl || [];

        let totBs = 0;
        let totUsd = 0;

        // 1. Procesar Tickets
        listTickets.forEach(t => {
            const b = bancos.find(bank => bank.nombre === t.banco_origen);
            const monto = Number(t.montoTotal) || 0;
            if (b?.moneda === 'Bs') totBs += monto;
            else totUsd += monto;
        });

        // 2. Procesar Requisiciones
        listReqs.forEach(r => {
            const items = Array.isArray(r.items) ? r.items : [];
            items.forEach(it => {
                const hist = Array.isArray(it.historial_compras) ? it.historial_compras : [];
                hist.forEach(h => {
                    const monto = (Number(h.cant) || 0) * (Number(h.pu) || 0);
                    const b = bancos.find(bank => bank.nombre === h.banco || bank.nombre === r.banco_origen);
                    if (b?.moneda === 'Bs') totBs += monto;
                    else totUsd += monto;
                });
            });
        });

        const totalGeneral = totBs + totUsd;
        const ticketsPendientes = data.tickets.filter(t => t.status?.toUpperCase() === 'EMITIDO').length;

        return { totBs, totUsd, totalGeneral, ticketsPendientes };
    }, [requisicionesControl, ticketsControl, bancos, data.tickets]);

    const dashBarGerenciaData = useMemo(() => {
        const consumption = {};
        ticketsControl.forEach(t => {
            const g = t.departamento || 'S/G';
            consumption[g] = (consumption[g] || 0) + (Number(t.montoTotal) || 0);
        });
        requisicionesControl.forEach(r => {
            const g = r.gerencia || 'S/G';
            consumption[g] = (consumption[g] || 0) + (Number(r.totalEjecutado) || 0);
        });
        return Object.entries(consumption).map(([name, value]) => ({
            name,
            value: Number(value.toFixed(2))
        })).sort((a, b) => b.value - a.value);
    }, [requisicionesControl, ticketsControl]);

    const dashPieData = useMemo(() => {
        const counts = {};
        const filteredRows = costosRows; // Opcional: aplicar filtros generales
        filteredRows.forEach(r => {
            counts[r.gerencia] = (counts[r.gerencia] || 0) + r.monto;
        });
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        return Object.entries(counts).map(([name, value]) => ({
            name,
            value,
            percentage: total > 0 ? ((value / total) * 100).toFixed(1) : "0"
        })).sort((a, b) => b.value - a.value);
    }, [costosRows]);


    // --- PROCESAMIENTO: VISTA 6 - REPORTE EXCLUSIVO OPERACIONES (POR PROYECTO) ---
    const reporteOperaciones = useMemo(() => {
        const opRows = costosRows.filter(r => r.gerencia === 'Operaciones');
        const proyectos = {};

        opRows.forEach(r => {
            const projectId = r.cc || 'Sin Proyecto';
            if (!proyectos[projectId]) {
                proyectos[projectId] = {
                    id: projectId,
                    totalEjecutado: 0,
                    ticketsCount: 0,
                    reqsCount: 0,
                    montoTickets: 0,
                    montoReqs: 0,
                    lastMov: r.fecha
                };
            }
            proyectos[projectId].totalEjecutado += (Number(r.monto) || 0);
            if (r.tipo === 'TICKET') {
                proyectos[projectId].ticketsCount++;
                proyectos[projectId].montoTickets += (Number(r.monto) || 0);
            } else {
                proyectos[projectId].reqsCount++;
                proyectos[projectId].montoReqs += (Number(r.monto) || 0);
            }
            if (r.fecha > (proyectos[projectId].lastMov || '')) proyectos[projectId].lastMov = r.fecha;
        });

        return Object.values(proyectos).filter(p =>
            p.id.toLowerCase().includes(busquedaProyecto.toLowerCase())
        ).sort((a, b) => b.totalEjecutado - a.totalEjecutado);
    }, [costosRows, busquedaProyecto]);

    const dashBarData = useMemo(() => {
        const weeks = {};

        // 1. Procesar Requisiciones para Estimado vs Real
        requisicionesControl.forEach(r => {
            if (filtroGerenciaDash && r.gerencia !== filtroGerenciaDash) return;
            const w = getWeekNumber(r.fecha_emision);
            const wKey = `Sem ${w || '?'}`;
            if (!weeks[wKey]) weeks[wKey] = { name: wKey, est: 0, real: 0 };
            weeks[wKey].est += (Number(r.montoEstimado) || 0);
            weeks[wKey].real += (Number(r.totalEjecutado) || 0);
        });

        // 2. Procesar Tickets (Solo Real)
        ticketsControl.forEach(t => {
            if (filtroGerenciaDash && t.departamento !== filtroGerenciaDash) return;
            const w = getWeekNumber(t.fecha_emision);
            const wKey = `Sem ${w || '?'}`;
            if (!weeks[wKey]) weeks[wKey] = { name: wKey, est: 0, real: 0 };
            weeks[wKey].real += (Number(t.montoTotal) || 0);
        });

        return Object.values(weeks).map(w => {
            const diffValue = (w.real || 0) - (w.est || 0);
            return {
                ...w,
                diff: Number(diffValue.toFixed(2)) || 0
            };
        }).sort((a, b) => {
            const nA = parseInt(a.name.split(' ')[1]) || 0;
            const nB = parseInt(b.name.split(' ')[1]) || 0;
            return nA - nB;
        });
    }, [requisicionesControl, ticketsControl, filtroGerenciaDash]);

    // --- EXPORTACIÓN ---
    const exportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Relación Costos');

        const headerStyle = {
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } },
            font: { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } }
        };

        const columns = [
            { header: 'FECHA', key: 'fecha', width: 15 },
            { header: 'SEMANA', key: 'semana', width: 10 },
            { header: 'CATEGORÍA', key: 'categoria', width: 25 },
            { header: 'DESCRIPCIÓN', key: 'descripcion', width: 45 },
            { header: 'MONTO ($)', key: 'monto', width: 18 },
            { header: 'PROYECTO (CC)', key: 'cc', width: 25 },
            { header: 'GERENCIA', key: 'gerencia', width: 25 },
            { header: 'REF', key: 'ref', width: 15 },
            { header: 'N° FACTURA', key: 'factura', width: 18 }
        ];

        worksheet.columns = columns;
        worksheet.getRow(1).eachCell((cell) => { Object.assign(cell, headerStyle); });
        worksheet.getRow(1).height = 30;

        costosRows.forEach(r => {
            const row = worksheet.addRow({
                fecha: r.fecha,
                semana: r.semana,
                categoria: r.categoria,
                descripcion: r.descripcion,
                monto: Number(r.monto) || 0,
                cc: r.cc,
                gerencia: r.gerencia,
                ref: r.ref,
                factura: r.factura
            });
            if (r.fecha) {
                try {
                    const d = parseISO(r.fecha);
                    if (!isNaN(d.getTime())) {
                        row.getCell(1).value = new Date(r.fecha + 'T12:00:00');
                        row.getCell(1).numFmt = 'dd/mm/yyyy';
                    }
                } catch (e) { }
            }
            row.getCell(5).numFmt = '"$"#,##0.00';
        });

        const totalRowIdx = costosRows.length + 2;
        worksheet.getCell(`D${totalRowIdx}`).value = 'TOTAL FILTRADO:';
        worksheet.getCell(`D${totalRowIdx}`).font = { bold: true };
        worksheet.getCell(`E${totalRowIdx}`).value = totalGasto;
        worksheet.getCell(`E${totalRowIdx}`).font = { bold: true, color: { argb: 'FF15803D' } };
        worksheet.getCell(`E${totalRowIdx}`).numFmt = '"$"#,##0.00';

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Relacion_Costos_TC_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    const exportPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4');
        doc.setFillColor(30, 58, 138);
        doc.rect(0, 0, 297, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text("TOTAL CLEAN C.A. - REPORTE DE CIERRE OPERATIVO", 15, 17);
        doc.setFontSize(10);
        doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 240, 17);

        const tableData = costosRows.map(r => [
            safeFormatDate(r.fecha),
            r.semana,
            r.categoria,
            r.descripcion,
            `$ ${(Number(r.monto) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`,
            (r.cc || '').split('(')[0],
            r.gerencia,
            r.ref,
            r.factura
        ]);

        doc.autoTable({
            head: [['FECHA', 'SEM', 'CATEGORÍA', 'DESCRIPCIÓN', 'MONTO ($)', 'PROYECTO', 'GERENCIA', 'REF', 'FACTURA']],
            body: tableData,
            startY: 35,
            theme: 'grid',
            headStyles: { fillColor: [30, 58, 138], fontSize: 8 },
            styles: { fontSize: 7, cellPadding: 2 },
            columnStyles: {
                4: { halign: 'right', fontStyle: 'bold' },
                8: { fontStyle: 'bold', textColor: [37, 99, 235] }
            },
            foot: [['', '', '', 'TOTAL GENERAL', `$ ${(Number(totalGasto) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`, '', '']],
            footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: 'bold' }
        });

        doc.save(`Reporte_Maestro_TC_${safeFormatDate(new Date().toISOString(), 'yyyy-MM-dd')}.pdf`);
    };

    return (
        <div className="rm-container">
            <div className="rm-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div className="rm-icon-main"><BarChart3 size={32} /></div>
                    <div>
                        <h1 className="rm-title">Reportes Maestro</h1>
                        <p className="rm-subtitle">Centro de Reportes Dinámicos y Dashboards Financieros</p>
                    </div>
                </div>
                <div className="rm-actions">
                    <button className="rm-btn rm-btn-outline" onClick={exportExcel}><FileSpreadsheet size={18} /> EXCEL</button>
                    <button className="rm-btn rm-btn-gradient" onClick={exportPDF}><Printer size={18} /> IMPRIMIR CIERRE</button>
                </div>
            </div>

            <div className="rm-stats-grid">
                <div className="rm-stat-card primary">
                    <div className="rm-stat-info"><label>Gasto Total Filtrado</label><h3>$ {(Number(totalGasto) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</h3></div>
                    <div className="rm-stat-icon"><DollarSign size={24} /></div>
                </div>
                <div className="rm-stat-card secondary">
                    <div className="rm-stat-info"><label>Movimientos Registrados</label><h3>{costosRows.length} Renglones</h3></div>
                    <div className="rm-stat-icon"><Clock size={24} /></div>
                </div>
                <div className="rm-stat-card highlight">
                    <div className="rm-stat-info"><label>Semanas Activas</label><h3>{new Set(costosRows.map(r => r.semana)).size} Semanas</h3></div>
                    <div className="rm-stat-icon"><Calendar size={24} /></div>
                </div>
            </div>

            <div className="rm-filter-bar">
                <div className="rm-filter-item search">
                    <Search size={16} /><input type="text" placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                </div>
                <div className="rm-filter-item">
                    <label>Mes</label>
                    <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
                        <option value="Todos">Todos</option>
                        {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                <div className="rm-filter-item">
                    <label>Semana</label><input type="number" value={filtroSemana} onChange={e => setFiltroSemana(e.target.value)} />
                </div>
                <div className="rm-filter-item">
                    <label>Gerencia</label>
                    <select value={filtroGerencia} onChange={e => setFiltroGerencia(e.target.value)}>
                        <option value="Todos">Todas</option>
                        {["Administración Maracaibo", "Operaciones", "Mantenimiento", "Seguridad", "Recursos Humanos", "Gerencia General"].map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                </div>
                <div className="rm-filter-date-group">
                    <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
                    <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
                </div>
            </div>

            <div className="rm-tabs">
                <button className={`rm-tab ${activeTab === 'costos' ? 'active' : ''}`} onClick={() => setActiveTab('costos')}>RELACIÓN DE GASTOS</button>
                <button className={`rm-tab ${activeTab === 'reqs' ? 'active' : ''}`} onClick={() => setActiveTab('reqs')}>CONTROL DE REQUISICIONES</button>
                <button className={`rm-tab ${activeTab === 'tickets_ctrl' ? 'active' : ''}`} onClick={() => setActiveTab('tickets_ctrl')}>CONTROL DE TICKETS</button>
                <button className={`rm-tab ${activeTab === 'operaciones' ? 'active' : ''}`} onClick={() => { setActiveTab('operaciones'); setFiltroGerencia('Operaciones'); }}>REPORTE OPERACIONES</button>
                <button className={`rm-tab ${activeTab === 'consumo' ? 'active' : ''}`} onClick={() => setActiveTab('consumo')}>CONSUMO POR GERENCIA</button>
                <button className={`rm-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>DASHBOARD</button>
            </div>

            <div className="rm-content">
                {activeTab === 'reqs' && (
                    <div className="rm-metric-banner">
                        <div className="rm-metric-item">
                            <Clock size={20} />
                            <span>Cierre Operativo: <strong>{tiempoPromedioCierre} Días</strong></span>
                        </div>
                        <div className="rm-metric-item highlight-alt">
                            <CheckCircle2 size={20} />
                            <span>Respuesta Gerencial: <strong>{tiempoRespuestaGerencial} Días</strong></span>
                        </div>
                        <div className="rm-metric-filters">
                            <select value={filtroEstadoReq} onChange={e => setFiltroEstadoReq(e.target.value)}>
                                <option value="Todos">Status (Todos)</option>
                                <option value="Pendiente">Pendiente</option>
                                <option value="Procesando">Procesando</option>
                                <option value="Completada">Completada</option>
                            </select>
                            <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
                                <option value="Todos">Categoría (Todas)</option>
                                {Array.from(new Set(data.requisiciones.flatMap(r => (r.items || []).map(it => it.categoria)).filter(Boolean))).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            <select value={filtroCC_Tab} onChange={e => setFiltroCC_Tab(e.target.value)}>
                                <option value="Todos">Proyecto/CC (Todos)</option>
                                {Array.from(new Set(data.requisiciones.map(r => r.centro_costo).filter(Boolean))).map(cc => <option key={cc} value={cc}>{cc}</option>)}
                            </select>
                            <select value={filtroSolicitante} onChange={e => setFiltroSolicitante(e.target.value)}>
                                <option value="Todos">Solicitante (Todos)</option>
                                {Array.from(new Set(data.requisiciones.map(r => r.solicitante))).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                {activeTab === 'tickets_ctrl' && (
                    <div className="rm-metric-banner">
                        <div className="rm-metric-item">
                            <DollarSign size={20} />
                            <span>Monto Total Filtrado: <strong>$ {ticketsControl.reduce((s, t) => s + t.montoTotal, 0).toLocaleString('de-DE')}</strong></span>
                        </div>
                        <div className="rm-metric-filters">
                            <select value={filtroEstadoTick} onChange={e => setFiltroEstadoTick(e.target.value)}>
                                <option value="Todos">Status (Todos)</option>
                                <option value="Pendiente">Pendiente (Emitido)</option>
                                <option value="Completada">Completada (Pagado)</option>
                            </select>
                            <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
                                <option value="Todos">Categoría (Todas)</option>
                                {Array.from(new Set(data.tickets.map(t => t.clasificacion_admin).filter(Boolean))).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            <select value={filtroCC_Tab} onChange={e => setFiltroCC_Tab(e.target.value)}>
                                <option value="Todos">Proyecto/CC (Todos)</option>
                                {Array.from(new Set(data.tickets.map(t => t.centro_costo).filter(Boolean))).map(cc => <option key={cc} value={cc}>{cc}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                {activeTab === 'consumo' && (
                    <div className="rm-metric-banner">
                        <div className="rm-metric-item">
                            <PieChartIcon size={20} />
                            <span>Gerencias Activas: <strong>{consumoGerencial.length}</strong></span>
                        </div>
                        <div className="rm-metric-filters">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', cursor: 'pointer' }}>
                                <input type="checkbox" checked={incluirReqs} onChange={e => setIncluirReqs(e.target.checked)} /> Requisiciones
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', cursor: 'pointer' }}>
                                <input type="checkbox" checked={incluirTickets} onChange={e => setIncluirTickets(e.target.checked)} /> Tickets
                            </label>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="rm-loader"><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><DollarSign size={40} color="#0ea5e9" /></motion.div></div>
                ) : (
                    <AnimatePresence mode="wait">
                        {activeTab === 'reqs' && (
                            <motion.div key="reqs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rm-view-wrapper">
                                <div className="rm-table-card">
                                    <table className="rm-table">
                                        <thead>
                                            <tr>
                                                <th>ID REQUISICIÓN</th>
                                                <th>FECHA SOLICITUD</th>
                                                <th>PROYECTO (CC)</th>
                                                <th>JUSTIFICACIÓN</th>
                                                <th style={{ textAlign: 'center', fontSize: '0.65rem' }}>APROB. PROYECTO</th>
                                                <th style={{ textAlign: 'center', fontSize: '0.65rem' }}>APROB. ÁREA</th>
                                                <th style={{ textAlign: 'center', fontSize: '0.65rem' }}>APROB. GENERAL</th>
                                                <th style={{ textAlign: 'center', fontSize: '0.65rem' }}>INICIO COMPRAS</th>
                                                <th style={{ textAlign: 'center', fontSize: '0.65rem' }}>DURACIÓN TOTAL</th>
                                                <th style={{ textAlign: 'center' }}>ESTATUS</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {requisicionesControl.map((r) => {
                                                const sla = calcularSLA(r);
                                                return (
                                                <tr key={r.id} style={sla.alerta ? { backgroundColor: '#fff7ed', borderLeft: '4px solid #f97316' } : {}}>
                                                    <td>
                                                        <button onClick={() => setReqSeleccionada(r)} className="rm-link-btn">
                                                            {r.correlativo_req || `REQ-${r.id}`}
                                                        </button>
                                                    </td>
                                                    <td>{safeFormatDate(r.fecha_emision)}</td>
                                                    <td className="rm-td-cc">{r.centro_costo?.split('(')[0]}</td>
                                                    <td className="rm-td-justif">{r.justificacion}</td>
                                                    
                                                    <td style={{ textAlign: 'center', fontSize: '0.65rem' }}>
                                                        <div style={{ fontWeight: 'bold' }}>{safeFormatDate(r.f_aprobacion_proyecto, 'dd/MM HH:mm')}</div>
                                                        <div style={{ color: '#64748b' }}>{r.n_aprobacion_proyecto?.split(' ')[0] || '-'}</div>
                                                    </td>
                                                    <td style={{ textAlign: 'center', fontSize: '0.65rem' }}>
                                                        <div style={{ fontWeight: 'bold' }}>{safeFormatDate(r.f_aprobacion_area, 'dd/MM HH:mm')}</div>
                                                        <div style={{ color: '#64748b' }}>{r.n_aprobacion_area?.split(' ')[0] || '-'}</div>
                                                    </td>
                                                    <td style={{ textAlign: 'center', fontSize: '0.65rem' }}>
                                                        <div style={{ fontWeight: 'bold' }}>{safeFormatDate(r.f_aprobacion_general, 'dd/MM HH:mm')}</div>
                                                        <div style={{ color: '#64748b' }}>{r.n_aprobacion_general?.split(' ')[0] || '-'}</div>
                                                    </td>
                                                    <td style={{ textAlign: 'center', fontSize: '0.65rem', fontWeight: 'bold', color: r.f_inicio_compras ? '#0ea5e9' : '#94a3b8' }}>
                                                        {safeFormatDate(r.f_inicio_compras, 'dd/MM HH:mm')}
                                                    </td>
                                                    <td style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 'bold', color: sla.alerta ? '#ef4444' : '#10b981' }}>
                                                        {sla.duracion}
                                                    </td>

                                                    <td style={{ textAlign: 'center' }}>
                                                        <span className={`rm-badge-status ${r.statusDisplay.toLowerCase()}`}>
                                                            {r.statusDisplay}
                                                        </span>
                                                    </td>
                                                </tr>
                                            )})}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'consumo' && (
                            <motion.div key="consumo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rm-view-wrapper">
                                <div className="rm-dashboard-layout" style={{ marginBottom: '30px', gridTemplateColumns: '1fr 1fr' }}>
                                    <div className="rm-chart-box">
                                        <h3>Gastos por Gerencia (Ejecutado)</h3>
                                        <ResponsiveContainer width="100%" height={250}>
                                            <BarChart data={consumoGerencial}>
                                                <XAxis dataKey="name" hide />
                                                <YAxis hide />
                                                <Tooltip formatter={(v) => `$ ${Number(v).toLocaleString('de-DE')}`} />
                                                <Bar dataKey="ejecutado" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="rm-chart-box">
                                        <h3>Distribución de Consumo</h3>
                                        <ResponsiveContainer width="100%" height={250}>
                                            <PieChart>
                                                <Pie data={consumoGerencial} innerRadius={50} outerRadius={80} dataKey="ejecutado" nameKey="name">
                                                    {consumoGerencial.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="rm-table-card">
                                    <table className="rm-table">
                                        <thead>
                                            <tr>
                                                <th>GERENCIA</th>
                                                <th style={{ textAlign: 'center' }}>CANT. REQUISICIONES</th>
                                                <th style={{ textAlign: 'right' }}>TOTAL SOLICITADO ($)</th>
                                                <th style={{ textAlign: 'right' }}>TOTAL EJECUTADO ($)</th>
                                                <th style={{ textAlign: 'center' }}>% EJECUCIÓN</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {consumoGerencial.map((g) => (
                                                <tr key={g.name}>
                                                    <td>
                                                        <button onClick={() => setGerenciaDetalle(g)} className="rm-link-btn primary-link">
                                                            {g.name}
                                                        </button>
                                                    </td>
                                                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{g.cant}</td>
                                                    <td style={{ textAlign: 'right' }}>$ {(g.solicitado || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: '900', color: '#16a34a' }}>$ {(g.ejecutado || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <div className="rm-progress-bar">
                                                            <div className="rm-progress-fill" style={{ width: `${Math.min(g.porcentaje || 0, 100)}%` }}></div>
                                                            <span>{g.porcentaje || 0}%</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'tickets_ctrl' && (
                            <motion.div key="tickets_ctrl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rm-view-wrapper">
                                <div className="rm-table-card">
                                    <table className="rm-table">
                                        <thead>
                                            <tr>
                                                <th>REFERENCIA</th>
                                                <th>FECHA</th>
                                                <th>CENTRO DE COSTO</th>
                                                <th>RESPONSABLE / CONCEPTO</th>
                                                <th style={{ textAlign: 'right' }}>MONTO ($)</th>
                                                <th style={{ textAlign: 'center' }}>ESTATUS</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ticketsControl.map((t) => (
                                                <tr key={t.id}>
                                                    <td>
                                                        <button onClick={() => setTickSeleccionado(t)} className="rm-link-btn">
                                                            {t.codigo_control}
                                                        </button>
                                                    </td>
                                                    <td>{safeFormatDate(t.fecha_emision)}</td>
                                                    <td className="rm-td-cc">{t.centro_costo?.split('(')[0]}</td>
                                                    <td className="rm-td-justif">{t.responsable_nombre} - {t.clasificacion_admin}</td>
                                                    <td className="rm-td-amount">$ {(t.montoTotal || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <span className={`rm-badge-status ${t.statusDisplay.toLowerCase()}`}>
                                                            {t.statusDisplay}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'costos' && (
                            <motion.div key="costos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rm-view-wrapper">
                                <div className="rm-table-card">
                                    <table className="rm-table">
                                        <thead>
                                            <tr><th>FECHA</th><th>SEM</th><th>CATEGORÍA</th><th>DESCRIPCIÓN</th><th style={{ textAlign: 'right' }}>MONTO</th><th>PROYECTO</th><th>GERENCIA</th><th>N° FACTURA</th></tr>
                                        </thead>
                                        <tbody>
                                            {costosRows.map((r) => (
                                                <tr key={r.uId}>
                                                    <td className="rm-td-date">{safeFormatDate(r.fecha)}</td>
                                                    <td className="rm-td-week">{r.semana}</td>
                                                    <td><span className="rm-badge-type">{r.categoria}</span></td>
                                                    <td className="rm-td-desc">{r.descripcion}</td>
                                                    <td className="rm-td-amount">$ {(r.monto || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                                                    <td className="rm-td-cc">{r.cc?.split('(')[0]}</td>
                                                    <td className="rm-td-gerencia">{r.gerencia}</td>
                                                    <td style={{ fontSize: '10px', fontWeight: 'bold', color: '#3b82f6' }}>{r.factura}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'tickets' && (
                            <motion.div key="tickets" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rm-tickets-grid">
                                {ticketsFiltered.map(t => (
                                    <div key={t.id} className="rm-ticket-card">
                                        <div className="rm-ticket-header"><span className="rm-tk-ref">{t.codigo_control}</span><span className={`rm-tk-status ${t.status?.toLowerCase()}`}>{t.status?.toUpperCase()}</span></div>
                                        <div className="rm-tk-body">
                                            <div className="rm-tk-info-item"><Users size={14} /> <span>{t.responsable_nombre}</span></div>
                                            <div className="rm-tk-amount-main">$ {(Number(t.total_usd) || 0).toLocaleString('de-DE')}</div>
                                            <div className="rm-tk-classification">{t.clasificacion_admin || 'S/C'}</div>
                                        </div>
                                    </div>
                                ))}
                            </motion.div>
                        )}


                        {activeTab === 'operaciones' && (
                            <motion.div key="operaciones" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rm-view-wrapper">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <h2 style={{ margin: 0, fontWeight: 900, color: '#0f172a' }}>Control de Proyectos - Operaciones</h2>
                                    <div style={{ position: 'relative', width: '300px' }}>
                                        <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={16} />
                                        <input
                                            type="text"
                                            placeholder="Buscar ID Ref / Proyecto..."
                                            className="rm-input"
                                            style={{ paddingLeft: '40px', width: '100%', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff' }}
                                            value={busquedaProyecto}
                                            onChange={e => setBusquedaProyecto(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="rm-table-card">
                                    <table className="rm-table">
                                        <thead>
                                            <tr>
                                                <th>ID REF. PROYECTO / CONTRATO</th>
                                                <th style={{ textAlign: 'center' }}>TRANSACCIONES</th>
                                                <th style={{ textAlign: 'right' }}>EJE. TICKETS</th>
                                                <th style={{ textAlign: 'right' }}>EJE. COMPRAS (REQ)</th>
                                                <th style={{ textAlign: 'right' }}>TOTAL EJECUTADO</th>
                                                <th style={{ textAlign: 'center' }}>ÚLTIMO MOV.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reporteOperaciones.map(p => (
                                                <tr key={p.id}>
                                                    <td><span style={{ fontWeight: 800, color: '#0ea5e9' }}>{p.id}</span></td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                                            <span title="Tickets" style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontSize: '10px' }}>{p.ticketsCount} TK</span>
                                                            <span title="Requisiciones" style={{ background: '#f5f3ff', color: '#4338ca', padding: '2px 8px', borderRadius: '4px', fontSize: '10px' }}>{p.reqsCount} REQ</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>$ {p.montoTickets.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>$ {p.montoReqs.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>$ {p.totalEjecutado.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <span style={{ fontSize: '11px', color: '#64748b' }}>{safeFormatDate(p.lastMov)}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {reporteOperaciones.length === 0 && (
                                        <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                                            No se encontraron proyectos de Operaciones.
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'dashboard' && (
                            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rm-view-wrapper">
                                {/* --- DASHBOARD UNIFICADO PREMIUM (RESTAURADO) --- */}
                                <div className="rm-stats-grid" style={{ marginBottom: '32px' }}>
                                    <div className="rm-stat-card secondary">
                                        <div className="rm-stat-info">
                                            <label>Dólares pagaderos en Bolívares</label>
                                            <h3 style={{ color: '#0ea5e9' }}>$ {(kpis.totBs || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</h3>
                                        </div>
                                        <div className="rm-stat-icon"><Clock size={22} /></div>
                                    </div>

                                    <div className="rm-stat-card highlight">
                                        <div className="rm-stat-info">
                                            <label>Dólares pagaderos en divisas</label>
                                            <h3 style={{ color: '#8b5cf6' }}>$ {(kpis.totUsd || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</h3>
                                        </div>
                                        <div className="rm-stat-icon"><BarChart3 size={22} /></div>
                                    </div>

                                    <div className="rm-stat-card primary">
                                        <div className="rm-stat-info">
                                            <label>Total General ($)</label>
                                            <h3 style={{ fontSize: '1.8rem' }}>$ {(kpis.totalGeneral || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</h3>
                                        </div>
                                        <div className="rm-stat-icon"><DollarSign size={22} /></div>
                                    </div>
                                </div>

                                <div className="rm-dashboard-layout">
                                    <div className="rm-chart-box full">
                                        <div className="rm-chart-header">
                                            <h3>Consumo Total por Gerencia ($)</h3>
                                        </div>
                                        <ResponsiveContainer width="100%" height={350}>
                                            <BarChart data={dashBarGerenciaData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(v) => `$${v}`} />
                                                <Tooltip
                                                    cursor={{ fill: '#f8fafc' }}
                                                    formatter={(v) => `$ ${Number(v).toLocaleString('de-DE')}`}
                                                />
                                                <Bar dataKey="value" name="Consumo Real" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={40} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>

                                    <div className="rm-chart-box">
                                        <h3>Distribución por Gerencia</h3>
                                        <ResponsiveContainer width="100%" height={350}>
                                            <PieChart>
                                                <Pie
                                                    data={dashPieData}
                                                    innerRadius={80}
                                                    outerRadius={110}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                    onClick={(data) => setFiltroGerenciaDash(data.name)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    {dashPieData.map((entry, index) => (
                                                        <Cell
                                                            key={`cell-${index}`}
                                                            fill={COLORS[index % COLORS.length]}
                                                            stroke={filtroGerenciaDash === entry.name ? '#0f172a' : 'none'}
                                                            strokeWidth={3}
                                                        />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(v) => `$ ${Number(v).toLocaleString('de-DE')}`} />
                                                <Legend layout="vertical" align="right" verticalAlign="middle"
                                                    content={({ payload }) => (
                                                        <ul className="rm-pie-legend">
                                                            {payload && payload.map((entry, index) => (
                                                                <li key={`item-${index}`} onClick={() => setFiltroGerenciaDash(entry.value)}>
                                                                    <span className="dot" style={{ backgroundColor: entry.color }}></span>
                                                                    <span className="name">{entry.value}</span>
                                                                    <span className="val">{dashPieData[index]?.percentage || 0}%</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>

            {/* MODALS SECTION */}
            <AnimatePresence>
                {reqSeleccionada && (
                    <div className="rm-modal-overlay" onClick={() => setReqSeleccionada(null)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="rm-detail-modal"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="rm-modal-header">
                                <h2>Detalle de Requisición: {reqSeleccionada.correlativo_req || reqSeleccionada.id}</h2>
                                <button onClick={() => setReqSeleccionada(null)}>×</button>
                            </div>
                            <div className="rm-modal-body">
                                <div className="rm-modal-info-grid">
                                    <div className="rm-min-card"><strong>Solicitante:</strong> {reqSeleccionada.solicitante}</div>
                                    <div className="rm-min-card"><strong>Gerencia:</strong> {reqSeleccionada.gerencia}</div>
                                    <div className="rm-min-card"><strong>Prioridad:</strong> {reqSeleccionada.prioridad}</div>
                                    <div className="rm-min-card"><strong>Monto Total:</strong> $ {(reqSeleccionada.montoEstimado || 0).toLocaleString('de-DE')}</div>
                                </div>
                                <div className="rm-modal-table-box">
                                    <table className="rm-mini-table">
                                        <thead>
                                            <tr><th>Ítem</th><th>Cant</th><th>Categoría</th><th>Estado</th></tr>
                                        </thead>
                                        <tbody>
                                            {reqSeleccionada.items?.map((it, idx) => (
                                                <tr key={idx}>
                                                    <td>{it.descripcion}</td>
                                                    <td>{it.cant} {it.unidad}</td>
                                                    <td>{it.categoria || 'S/C'}</td>
                                                    <td><span className="rm-badge-type">{it.historial_compras?.length > 0 ? 'Procesado' : 'Pendiente'}</span></td>
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
                    <div className="rm-modal-overlay" onClick={() => setTickSeleccionado(null)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="rm-detail-modal"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="rm-modal-header" style={{ background: '#1e293b' }}>
                                <h2>Referencia: {tickSeleccionado.codigo_control}</h2>
                                <button onClick={() => setTickSeleccionado(null)}>×</button>
                            </div>
                            <div className="rm-modal-body">
                                <div className="rm-modal-info-grid">
                                    <div className="rm-min-card"><strong>Responsable:</strong> {tickSeleccionado.responsable_nombre}</div>
                                    <div className="rm-min-card"><strong>Depto:</strong> {tickSeleccionado.departamento}</div>
                                    <div className="rm-min-card"><strong>Estatus:</strong> {tickSeleccionado.statusDisplay}</div>
                                    <div className="rm-min-card"><strong>Monto:</strong> $ {(tickSeleccionado.montoTotal || 0).toLocaleString('de-DE')}</div>
                                </div>
                                <table className="rm-mini-table">
                                    <thead><tr><th>Concepto</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                                    <tbody>
                                        {tickSeleccionado.items?.map((it, idx) => (
                                            <tr key={idx}>
                                                <td>{it.descripcion || it.desc}</td>
                                                <td style={{ textAlign: 'right' }}>$ {(Number(it.total) || (Number(it.pu) * Number(it.cant))).toLocaleString('de-DE')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    </div>
                )}

                {gerenciaDetalle && (
                    <div className="rm-modal-overlay" onClick={() => setGerenciaDetalle(null)}>
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 50 }}
                            className="rm-detail-modal"
                            style={{ maxWidth: '1000px' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="rm-modal-header" style={{ background: '#0f172a' }}>
                                <h2>Desglose: {gerenciaDetalle.name}</h2>
                                <button onClick={() => setGerenciaDetalle(null)}>×</button>
                            </div>
                            <div className="rm-modal-body">
                                <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                                    <table className="rm-mini-table">
                                        <thead>
                                            <tr><th>Ítem</th><th>Ref.</th><th style={{ textAlign: 'right' }}>Costo Real</th><th style={{ textAlign: 'center' }}>Tipo</th></tr>
                                        </thead>
                                        <tbody>
                                            {gerenciaDetalle.items?.map((it, idx) => (
                                                <tr key={idx}>
                                                    <td>{it.desc}</td>
                                                    <td style={{ fontSize: '0.7rem' }}>{it.ref}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: '800' }}>$ {(it.costo || 0).toLocaleString('de-DE')}</td>
                                                    <td style={{ textAlign: 'center' }}>{it.tipo}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ReportesMaestro;

