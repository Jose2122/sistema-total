import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from './supabaseClient';
// eslint-disable-next-line no-unused-vars
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
import { format, parseISO } from 'date-fns';
import './ReportesMaestro.css';

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
                    // Ignore JSON parsing errors for malformed string entries
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

const COLORS = ['#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#64748b'];

const ReportesMaestro = () => {
    const [activeTab, setActiveTab] = useState('costos');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({ tickets: [], requisiciones: [], solicitudes: [], partidas: [] });
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
    const [filtroAlmacen, setFiltroAlmacen] = useState('Todos');
    const [listaCentrosCostos, setListaCentrosCostos] = useState([]);
    const [showMoreFilters, setShowMoreFilters] = useState(false);

    // Filtros por Pestaña (Nuevos)
    const [filtroCategoria, setFiltroCategoria] = useState('Todos');
    const [filtroCC_Tab, setFiltroCC_Tab] = useState('Todos');

    const [busqueda, setBusqueda] = useState('');
    const [reqSeleccionada, setReqSeleccionada] = useState(null); // Para modal detalle
    const [tickSeleccionado, setTickSeleccionado] = useState(null); // Para modal ticket
    const [extendedTicketData, setExtendedTicketData] = useState(null);
    const [extendedLoading, setExtendedLoading] = useState(false);
    const [selectedFileIndex, setSelectedFileIndex] = useState(0);
    const [gerenciaDetalle, setGerenciaDetalle] = useState(null); // Para drill-down

    // Auxiliares de seguridad
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
            const [resReq, resTickets, resCC, resBancos, resSols, resParts] = await Promise.all([
                supabase.from('requisiciones').select('*').order('fecha_emision', { ascending: false }),
                supabase.from('tickets_directos').select('*').order('fecha_emision', { ascending: false }),
                supabase.from('maestros_centros_costo').select('id, nombre').eq('activo', true).order('nombre'),
                supabase.from('bancos').select('*').eq('activo', true),
                supabase.from('solicitudes_fondos').select('*').order('fecha_operativa', { ascending: false }),
                supabase.from('partidas_fondos').select('*')
            ]);

            if (resReq.error || resTickets.error) throw new Error("Error en la descarga de datos");
            if (resCC.data) setListaCentrosCostos(resCC.data);

            setData({
                tickets: resTickets.data || [],
                requisiciones: resReq.error ? [] : resReq.data,
                solicitudes: resSols.data || [],
                partidas: resParts.data || []
            });
            setBancos(resBancos.data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, []);

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
            console.error("Error al actualizar sub-fila:", err);
        }
    };

    useEffect(() => {
        cargarDatos();
    }, [cargarDatos]);

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
            // 1. Fetch exact latest record from Supabase
            const { data: ticketData, error } = await supabase
                .from('tickets_directos')
                .select('*')
                .eq('id', found.id)
                .single();
            if (error) throw error;

            // 2. Fetch related requisition if solicitud_ref is valid
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
            // Fallback to local ticket data if fetch fails
            setExtendedTicketData({ ticket: found, req: null });
        } finally {
            setExtendedLoading(false);
        }
    }, [data.tickets]);

    // --- PROCESAMIENTO: VISTA 1 - RELACIÓN DE COSTOS (FLATTENED) ---
    const costosRows = useMemo(() => {
        const rows = [];

        // 1. Procesar Tickets Directos
        data.tickets.forEach(t => {
            const items = Array.isArray(t.items) ? t.items : [];
            items.forEach(item => {
                const rowDate = t.fecha_emision ? t.fecha_emision.split('T')[0] : '';

                // Buscar requisición por correlativo_req o id
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

        // 2. Procesar Requisiciones (Historial de Compras sólamente para Relación de Costos)
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

        return rows.sort((a, b) => b.fecha.localeCompare(a.fecha)).filter(row => {
            const matchBusqueda = row.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
                row.ref.toLowerCase().includes(busqueda.toLowerCase()) ||
                row.proyecto.toLowerCase().includes(busqueda.toLowerCase());
            const matchCC = filtroCC === 'Todos' || row.cc === filtroCC;
            const matchGerencia = filtroGerencia === 'Todos' || row.gerencia === filtroGerencia;
            const matchSemana = !filtroSemana || String(row.semana) === String(filtroSemana);
            let matchFecha = true;
            if (fechaDesde && row.fecha < fechaDesde) matchFecha = false;
            if (fechaHasta && row.fecha > fechaHasta) matchFecha = false;

            const matchAlmacen = filtroAlmacen === 'Todos' || (filtroAlmacen === 'Si' ? row.almacen : !row.almacen);
            const matchCategoria = filtroCategoria === 'Todos' || row.categoria === filtroCategoria;
            return matchBusqueda && matchCC && matchGerencia && matchSemana && matchFecha && matchAlmacen && matchCategoria;
        });
    }, [data, busqueda, filtroCC, filtroGerencia, filtroSemana, fechaDesde, fechaHasta, filtroAlmacen, filtroCategoria]);

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
            const statusDisplay = (status === 'PAGADO' || status === 'COMPLETADO' || status === 'COMPLETADA') ? 'Completada' : 'Pendiente';

            // Banco de pago
            const bancoNombre = bancos.find(b => b.id === t.banco_pago_id)?.nombre
                || t.banco_origen
                || (items.flatMap(r => (r.historial_compras || []).map(h => h.banco_nombre)).filter(Boolean)[0])
                || '-';

            // Método / Tipo pago
            const metodoRaw = t.metodo_pago
                || (items.flatMap(r => (r.historial_compras || []).map(h => h.metodo_pago)).filter(Boolean)[0])
                || '$/$';
            const metodoPago = parseMonedaPago(metodoRaw);

            return {
                ...t,
                statusDisplay,
                itemsCount: items.length,
                montoTotal: Number(t.total_usd || 0),
                fechaEmision: t.fecha_emision || t.created_at,
                fechaPago: (status === 'PAGADO' || status === 'COMPLETADO' || status === 'COMPLETADA') ? (t.fecha_pago || t.updated_at) : null,
                banco: bancoNombre,
                metodo: metodoPago
            };
        }).filter(t => {
            const matchBusqueda = (t.codigo_control || '').toLowerCase().includes(busqueda.toLowerCase()) ||
                (t.responsable_nombre || '').toLowerCase().includes(busqueda.toLowerCase()) ||
                (t.gerente_nombre || '').toLowerCase().includes(busqueda.toLowerCase());
            const matchStatus = filtroEstadoTick === 'Todos' || t.statusDisplay === filtroEstadoTick;
            const matchGerencia = filtroGerencia === 'Todos' || t.departamento === filtroGerencia;
            const matchCC = filtroCC_Tab === 'Todos' || t.centro_costo === filtroCC_Tab;
            const matchCat = filtroCategoria === 'Todos' || t.clasificacion_admin === filtroCategoria;

            let matchFecha = true;
            const tFecha = t.fechaEmision?.split('T')[0];
            if (fechaDesde && tFecha < fechaDesde) matchFecha = false;
            if (fechaHasta && tFecha > fechaHasta) matchFecha = false;

            return matchBusqueda && matchStatus && matchGerencia && matchCC && matchCat && matchFecha;
        });
    }, [data.tickets, bancos, busqueda, filtroEstadoTick, filtroGerencia, filtroCC_Tab, filtroCategoria, fechaDesde, fechaHasta]);

    /* Commented out unused memos to satisfy ESLint:
    const consumoGerencial = useMemo(() => {
        const stats = {};
        const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

        const procesar = (registros, esTicket) => {
            registros.forEach(r => {
                const fechaStr = r.fecha_emision || r.created_at || r.fecha_operativa;
                if (!fechaStr) return;
                const date = parseISO(fechaStr);
                const mIndex = date.getMonth();
                const mName = meses[mIndex];
                const wNum = getWeekNumber(fechaStr);

                if (filtroMes !== 'Todos' && mName !== filtroMes) return;
                if (filtroSemana && String(wNum) !== String(filtroSemana)) return;

                const gName = (esTicket ? r.departamento : r.gerencia) || 'S/G';
                if (!stats[gName]) {
                    stats[gName] = { name: gName, cant: 0, solicitado: 0, ejecutado: 0, items: [], categories: {} };
                }

                const items = Array.isArray(r.items) ? r.items : [];
                stats[gName].cant += 1;

                if (esTicket) {
                    const monto = Number(r.total_usd || 0);
                    stats[gName].solicitado += monto;
                    stats[gName].ejecutado += (r.status?.toUpperCase() === 'PAGADO' ? monto : 0);

                    const cat = r.clasificacion_admin || 'Directo';
                    if (!stats[gName].categories[cat]) stats[gName].categories[cat] = 0;
                    stats[gName].categories[cat] += (r.status?.toUpperCase() === 'PAGADO' ? monto : 0);

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
                        const cat = it.categoria || 'S/C';
                        if (!stats[gName].categories[cat]) stats[gName].categories[cat] = 0;
                        const h = Array.isArray(it.historial_compras) ? it.historial_compras : [];
                        const itEjec = h.reduce((acc, comp) => acc + (Number(comp.cant) * (Number(comp.pu) || 0)), 0);
                        stats[gName].categories[cat] += itEjec;

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

        return Object.values(stats).map(g => {
            const topCategories = Object.entries(g.categories)
                .map(([name, total]) => ({ name, total }))
                .sort((a, b) => b.total - a.total)
                .slice(0, 5);

            return {
                ...g,
                porcentaje: g.solicitado > 0 ? ((g.ejecutado / g.solicitado) * 100).toFixed(1) : 0,
                items: g.items.sort((a, b) => b.costo - a.costo),
                topCategories
            };
        }).sort((a, b) => b.ejecutado - a.ejecutado);
    }, [data, filtroMes, filtroSemana, incluirReqs, incluirTickets]);

    const kpis = useMemo(() => {
        const listReqs = requisicionesControl || [];
        const listTickets = ticketsControl || [];

        let totBs = 0;
        let totUsd = 0;

        listTickets.forEach(t => {
            const b = bancos.find(bank => bank.nombre === t.banco_origen);
            const monto = Number(t.montoTotal) || 0;
            if (b?.moneda === 'Bs') totBs += monto;
            else totUsd += monto;
        });

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
        const filteredRows = costosRows; 
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
    */

    const reporteOperacionesRows = useMemo(() => {
        return costosRows.filter(r => r.gerencia === 'Operaciones');
    }, [costosRows]);

    /*
    const dashBarData = useMemo(() => {
        const weeks = {};

        requisicionesControl.forEach(r => {
            if (filtroGerenciaDash && r.gerencia !== filtroGerenciaDash) return;
            const w = getWeekNumber(r.fecha_emision);
            const wKey = `Sem ${w || '?'}`;
            if (!weeks[wKey]) weeks[wKey] = { name: wKey, est: 0, real: 0 };
            weeks[wKey].est += (Number(r.montoEstimado) || 0);
            weeks[wKey].real += (Number(r.totalEjecutado) || 0);
        });

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
    */

    // --- NUEVAS MÉTRICAS BI DE ALTO IMPACTO ---

    const metricsBI = useMemo(() => {
        const reqs = data.requisiciones || [];

        // 1. EFICIENCIA OPERATIVA (TIEMPOS PROMEDIO)
        let sumProj = 0, countProj = 0;
        let sumArea = 0, countArea = 0;
        let sumGen = 0, countGen = 0;
        let sumCom = 0, countCom = 0;

        reqs.forEach(r => {
            const t0 = new Date(r.created_at || r.fecha_emision);
            if (r.f_aprobacion_proyecto) {
                sumProj += (new Date(r.f_aprobacion_proyecto) - t0);
                countProj++;
            }
            if (r.f_aprobacion_area && r.f_aprobacion_proyecto) {
                sumArea += (new Date(r.f_aprobacion_area) - new Date(r.f_aprobacion_proyecto));
                countArea++;
            }
            if (r.f_aprobacion_general && r.f_aprobacion_area) {
                sumGen += (new Date(r.f_aprobacion_general) - new Date(r.f_aprobacion_area));
                countGen++;
            }
            if (r.f_finalizado && r.f_inicio_compras) {
                sumCom += (new Date(r.f_finalizado) - new Date(r.f_inicio_compras));
                countCom++;
            }
        });

        const msToDays = (ms) => (ms / (1000 * 60 * 60 * 24)).toFixed(1);

        const funnelData = [
            { stage: 'PROYECTO', dias: Number(msToDays(sumProj / countProj || 0)), color: '#0ea5e9' },
            { stage: 'ÁREA', dias: Number(msToDays(sumArea / countArea || 0)), color: '#8b5cf6' },
            { stage: 'GENERAL', dias: Number(msToDays(sumGen / countGen || 0)), color: '#ec4899' },
            { stage: 'COMPRAS', dias: Number(msToDays(sumCom / countCom || 0)), color: '#10b981' },
        ];

        // 2. SALUD FINANCIERA (AHORRO POR CC)
        const budgetByCC = {};
        reqs.filter(r => r.estado_aprobacion === 'aprobado_final').forEach(r => {
            const cc = r.centro_costo || 'N/A';
            if (!budgetByCC[cc]) budgetByCC[cc] = { name: cc.split('(')[0], presupuesto: 0, real: 0, ahorro: 0 };

            const items = r.items || [];
            const est = items.reduce((s, i) => s + (Number(i.cant) * (Number(i.pu) || 0)), 0);
            const real = items.reduce((s, i) => {
                const h = i.historial_compras || [];
                return s + h.reduce((acc, comp) => acc + (Number(comp.cant) * (Number(comp.pu) || 0)), 0);
            }, 0);

            budgetByCC[cc].presupuesto += est;
            budgetByCC[cc].real += real;
            budgetByCC[cc].ahorro += (est - real);
        });

        const financialData = Object.values(budgetByCC)
            .sort((a, b) => b.presupuesto - a.presupuesto)
            .slice(0, 8);

        const ahorroTotal = financialData.reduce((s, c) => s + c.ahorro, 0);

        // 3. AUDITORÍA (RECIENTES)
        const auditLog = reqs
            .filter(r => r.f_aprobacion_general || r.f_aprobacion_area)
            .sort((a, b) => new Date(b.f_aprobacion_general || b.f_aprobacion_area) - new Date(a.f_aprobacion_general || a.f_aprobacion_area))
            .slice(0, 5)
            .map(r => ({
                id: r.correlativo_req || r.id,
                fecha: r.f_aprobacion_general || r.f_aprobacion_area,
                accion: 'Aprobación Final',
                usuario: r.n_aprobacion_general || r.n_aprobacion_area
            }));

        return { funnelData, financialData, ahorroTotal, auditLog };
    }, [data.requisiciones]);

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
            { header: 'CORRELATIVO #', key: 'ref', width: 15 },
            { header: 'ALMACÉN', key: 'almacen', width: 12 },
            { header: 'PRODUCTO / DESCRIPCIÓN', key: 'descripcion', width: 45 },
            { header: 'SOPORTE / FACTURA', key: 'factura', width: 18 },
            { header: 'FECHA', key: 'fecha', width: 15 },
            { header: 'ORIGEN (SOLICITANTE)', key: 'solicitante', width: 25 },
            { header: 'CLASIFICACIÓN (CAT.)', key: 'categoria', width: 25 },
            { header: 'DESTINO (GERENCIA / CC)', key: 'gerencia_cc', width: 40 },
            { header: 'FINANCIERO ($)', key: 'monto', width: 18 }
        ];

        worksheet.columns = columns;
        worksheet.getRow(1).eachCell((cell) => { Object.assign(cell, headerStyle); });
        worksheet.getRow(1).height = 30;

        costosRows.forEach(r => {
            const row = worksheet.addRow({
                ref: r.ref,
                almacen: r.almacen ? 'SÍ' : 'NO',
                descripcion: r.descripcion,
                factura: r.factura,
                fecha: r.fecha,
                solicitante: r.solicitante || 'N/A',
                categoria: r.categoria,
                gerencia_cc: `${r.gerencia} / ${r.cc?.split('(')[0]}`,
                monto: Number(r.monto) || 0
            });
            if (r.fecha) {
                try {
                    const d = parseISO(r.fecha);
                    if (!isNaN(d.getTime())) {
                        row.getCell(5).value = new Date(r.fecha + 'T12:00:00');
                        row.getCell(5).numFmt = 'dd/mm/yyyy';
                    }
                } catch {
                    // Ignore parsing errors
                }
            }
            row.getCell(9).numFmt = '"$"#,##0.00';
        });

        const totalRowIdx = costosRows.length + 2;
        worksheet.getCell(`H${totalRowIdx}`).value = 'TOTAL FILTRADO:';
        worksheet.getCell(`H${totalRowIdx}`).font = { bold: true };
        worksheet.getCell(`I${totalRowIdx}`).value = totalGasto;
        worksheet.getCell(`I${totalRowIdx}`).font = { bold: true, color: { argb: 'FF15803D' } };
        worksheet.getCell(`I${totalRowIdx}`).numFmt = '"$"#,##0.00';

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Relacion_Costos_TC_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    const exportExcelByProject = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Relación por Proyecto');

        const headerStyle = {
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } }, // Purple header
            font: { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } }
        };

        const columns = [
            { header: 'ID REF. PROYECTO / CONTRATO', key: 'proyecto', width: 30 },
            { header: 'ALMACÉN', key: 'almacen', width: 12 },
            { header: 'PRODUCTO / DESCRIPCIÓN', key: 'descripcion', width: 45 },
            { header: 'SOPORTE / FACTURA', key: 'factura', width: 18 },
            { header: 'FECHA', key: 'fecha', width: 15 },
            { header: 'ORIGEN (SOLICITANTE)', key: 'solicitante', width: 25 },
            { header: 'CLASIFICACIÓN (CAT.)', key: 'categoria', width: 25 },
            { header: 'DESTINO (GERENCIA / CC)', key: 'gerencia_cc', width: 40 },
            { header: 'MONEDA DE PAGO', key: 'moneda_pago', width: 18 },
            { header: 'FINANCIERO ($)', key: 'monto', width: 18 }
        ];

        worksheet.columns = columns;
        worksheet.getRow(1).eachCell((cell) => { Object.assign(cell, headerStyle); });
        worksheet.getRow(1).height = 30;

        costosRows.forEach(r => {
            const row = worksheet.addRow({
                proyecto: r.proyecto,
                almacen: r.almacen ? 'SÍ' : 'NO',
                descripcion: r.descripcion,
                factura: r.factura,
                fecha: r.fecha,
                solicitante: r.solicitante || 'N/A',
                categoria: r.categoria,
                gerencia_cc: `${r.gerencia} / ${r.cc?.split('(')[0]}`,
                moneda_pago: r.moneda_pago,
                monto: Number(r.monto) || 0
            });
            if (r.fecha) {
                try {
                    const d = parseISO(r.fecha);
                    if (!isNaN(d.getTime())) {
                        row.getCell(5).value = new Date(r.fecha + 'T12:00:00');
                        row.getCell(5).numFmt = 'dd/mm/yyyy';
                    }
                } catch {
                    // Ignore parsing errors
                }
            }
            row.getCell(10).numFmt = '"$"#,##0.00';
        });

        const totalRowIdx = costosRows.length + 2;
        worksheet.getCell(`I${totalRowIdx}`).value = 'TOTAL FILTRADO:';
        worksheet.getCell(`I${totalRowIdx}`).font = { bold: true };
        worksheet.getCell(`J${totalRowIdx}`).value = totalGasto;
        worksheet.getCell(`J${totalRowIdx}`).font = { bold: true, color: { argb: 'FF15803D' } };
        worksheet.getCell(`J${totalRowIdx}`).numFmt = '"$"#,##0.00';

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Relacion_Costos_Por_Proyecto_TC_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
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
            r.factura,
            r.almacen ? 'SÍ' : 'NO'
        ]);

        doc.autoTable({
            head: [['FECHA', 'SEM', 'CATEGORÍA', 'DESCRIPCIÓN', 'MONTO ($)', 'PROYECTO', 'GERENCIA', 'REF', 'FACTURA', 'ALM.']],
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
                    <button className="rm-btn rm-btn-outline" style={{ borderColor: '#8b5cf6', color: '#8b5cf6' }} onClick={exportExcelByProject}><FileSpreadsheet size={18} /> EXCEL POR PROYECTO</button>
                    <button className="rm-btn rm-btn-gradient" onClick={exportPDF}><Printer size={18} /> IMPRIMIR CIERRE</button>
                </div>
            </div>

            <div className="rm-stats-grid">
                <div className="rm-stat-card primary">
                    <div className="rm-stat-info"><label>Gasto Total ($)</label><h3>$ {totalGasto.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</h3></div>
                </div>
                <div className="rm-stat-card primary">
                    <div className="rm-stat-info"><label>Movimientos Registrados</label><h3>{costosRows.length} Renglones</h3></div>
                </div>
                <div className="rm-stat-card primary">
                    <div className="rm-stat-info"><label>Semanas Activas</label><h3>{new Set(costosRows.map(r => r.semana)).size} Semanas</h3></div>
                </div>
            </div>

            <div className="rm-filter-section-premium">
                <div className="rm-filter-grid-layout main-filters">
                    <div className="filter-item-premium">
                        <label className="filter-label-premium">Fechas</label>
                        <div className="date-input-group">
                            <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
                            <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
                        </div>
                    </div>

                    <div className="filter-item-premium" style={{ maxWidth: '120px' }}>
                        <label className="filter-label-premium">Mes</label>
                        <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
                            <option value="Todos">Todos</option>
                            {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map(m => <option key={m} value={m}>{m}</option>)}
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
                        <select
                            value={activeTab === 'operaciones' ? 'Operaciones' : filtroGerencia}
                            onChange={e => setFiltroGerencia(e.target.value)}
                            disabled={activeTab === 'operaciones'}
                        >
                            <option value="Todos">Todas</option>
                            {["Administración Maracaibo", "Operaciones", "Mantenimiento", "Seguridad", "Recursos Humanos", "Gerencia General"].map(g => <option key={g} value={g}>{g}</option>)}
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
                        <div className="search-input-wrapper">
                            <input type="text" placeholder="ID, Descripción..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                        </div>
                    </div>

                    <div className="filter-item-premium" style={{ alignSelf: 'flex-end', display: 'flex', gap: '8px' }}>
                        <button
                            className={`btn-toggle-filters ${showMoreFilters ? 'active' : ''}`}
                            onClick={() => setShowMoreFilters(!showMoreFilters)}
                            title="Más Filtros"
                        >
                            <Filter size={14} />
                        </button>
                    </div>
                </div>

                <AnimatePresence>
                    {showMoreFilters && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="rm-filter-grid-layout secondary-filters"
                            style={{ overflow: 'hidden', borderTop: '1px dashed #e2e8f0', paddingTop: '10px', marginTop: '10px' }}
                        >
                            <div className="filter-item-premium">
                                <label className="filter-label-premium">Categoría</label>
                                <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
                                    <option value="Todos">Todas</option>
                                    {Array.from(new Set([
                                        ...data.requisiciones.flatMap(r => (r.items || []).map(it => it.categoria || it.cat)),
                                        ...data.tickets.flatMap(t => (t.items || []).map(it => it.categoria || it.cat))
                                    ].filter(Boolean))).map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="filter-item-premium">
                                <label className="filter-label-premium">Semana</label>
                                <input type="number" placeholder="Ej: 15" value={filtroSemana} onChange={e => setFiltroSemana(e.target.value)} />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="rm-tabs">
                <button className={`rm-tab ${activeTab === 'costos' ? 'active' : ''}`} onClick={() => setActiveTab('costos')}>RELACIÓN DE GASTOS</button>
                <button className={`rm-tab ${activeTab === 'reqs' ? 'active' : ''}`} onClick={() => setActiveTab('reqs')}>CONTROL DE REQUISICIONES</button>
                <button className={`rm-tab ${activeTab === 'tickets_ctrl' ? 'active' : ''}`} onClick={() => setActiveTab('tickets_ctrl')}>CONTROL DE TICKETS</button>
                <button className={`rm-tab ${activeTab === 'operaciones' ? 'active' : ''}`} onClick={() => { setActiveTab('operaciones'); setFiltroGerencia('Operaciones'); }}>REPORTE OPERACIONES</button>
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
                                                <th style={{ width: '220px' }}>ID REQUISICIÓN</th>
                                                <th>FECHA SOLICITUD</th>
                                                <th>PROYECTO (CC)</th>
                                                <th>JUSTIFICACIÓN</th>
                                                <th style={{ textAlign: 'center', fontSize: '0.65rem' }}>APROB. PROYECTO</th>
                                                <th style={{ textAlign: 'center', fontSize: '0.65rem' }}>APROB. ÁREA</th>
                                                <th style={{ textAlign: 'center', fontSize: '0.65rem' }}>APROB. GENERAL</th>
                                                <th style={{ textAlign: 'center', fontSize: '0.65rem' }}>INICIO COMPRAS</th>
                                                <th style={{ textAlign: 'center', fontSize: '0.65rem' }}>DURACIÓN TOTAL</th>
                                                <th style={{ textAlign: 'center' }}>ALMACÉN</th>
                                                <th style={{ textAlign: 'center' }}>ESTATUS</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {requisicionesControl.map((r) => {
                                                const sla = calcularSLA(r);
                                                return (
                                                    <tr key={r.id} style={sla.alerta ? { backgroundColor: '#fff7ed', borderLeft: '4px solid #f97316' } : {}}>
                                                        <td>
                                                            <motion.span
                                                                whileHover={{
                                                                    scale: 1.1,
                                                                    x: 5,
                                                                    color: '#2563eb',
                                                                    textShadow: '0 0 8px rgba(37, 99, 235, 0.2)'
                                                                }}
                                                                whileTap={{ scale: 0.95 }}
                                                                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                                                                onClick={() => setReqSeleccionada(r)}
                                                                style={{
                                                                    fontSize: '12px',
                                                                    fontWeight: '900',
                                                                    color: '#1e40af',
                                                                    textDecoration: 'underline',
                                                                    textUnderlineOffset: '3px',
                                                                    textDecorationColor: 'rgba(30, 64, 175, 0.4)',
                                                                    cursor: 'pointer',
                                                                    display: 'inline-block'
                                                                }}
                                                            >
                                                                {r.correlativo_req || `REQ-${r.id}`}
                                                            </motion.span>
                                                        </td>
                                                        <td>{safeFormatDate(r.fecha_emision)}</td>
                                                        <td className="rm-td-cc">{r.centro_costo?.split('(')[0]}</td>
                                                        <td className="rm-td-justif">
                                                            <div style={{ fontWeight: '700', color: '#334155' }}>{r.justificacion}</div>
                                                            {r.items?.length > 1 && (
                                                                <div
                                                                    style={{ fontSize: '10px', color: '#0ea5e9', fontWeight: 'bold', cursor: 'help', marginTop: '2px' }}
                                                                    title={r.items.slice(1).map(it => `- ${it.descripcion}`).join('\n')}
                                                                >
                                                                    (+ {r.items.length - 1} más)
                                                                </div>
                                                            )}
                                                        </td>

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
                                                            {(() => {
                                                                const items = r.items || [];
                                                                const enAlmacen = items.filter(it => it.enviado_almacen || (it.historial_compras?.length > 0 && it.historial_compras.every(h => h.enviado_almacen))).length;
                                                                const total = items.length;
                                                                if (total === 0) return <span style={{ color: '#94a3b8', fontSize: '10px' }}>-</span>;
                                                                if (enAlmacen === total) return <div style={{ color: '#10b981', fontWeight: '900', fontSize: '11px' }}>RECIBIDO 📦</div>;
                                                                if (enAlmacen > 0) return <div style={{ color: '#f59e0b', fontWeight: '900', fontSize: '11px' }}>{enAlmacen}/{total} 📥</div>;
                                                                return <div style={{ color: '#94a3b8', fontWeight: '600', fontSize: '11px' }}>PENDIENTE</div>;
                                                            })()}
                                                        </td>

                                                        <td style={{ textAlign: 'center' }}>
                                                            <span className={`rm-badge-status ${r.statusDisplay.toLowerCase()}`}>
                                                                {r.statusDisplay}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
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
                                                <th style={{ width: '180px' }}>REFERENCIA</th>
                                                <th>FECHA EMISIÓN</th>
                                                <th>FECHA PAGO</th>
                                                <th>MÉTODO</th>
                                                <th>BANCO</th>
                                                <th>RESPONSABLE / CONCEPTO</th>
                                                <th style={{ textAlign: 'right' }}>MONTO ($)</th>
                                                <th style={{ textAlign: 'center' }}>ESTATUS</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ticketsControl.map((t) => (
                                                <tr
                                                    key={t.id}
                                                    onClick={() => handleOpenTicket(t.codigo_control, `TK-${t.id}`)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <td>
                                                        <span className="rm-table-link">
                                                            {t.codigo_control || `TX-${String(t.id).padStart(4, '0')}`}
                                                        </span>
                                                    </td>
                                                    <td className="rm-td-date">{safeFormatDate(t.fechaEmision)}</td>
                                                    <td>
                                                        {t.statusDisplay === 'Completada' ? (
                                                            <span className="rm-td-date">{safeFormatDate(t.fechaPago)}</span>
                                                        ) : (
                                                            <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 500 }}>Pendiente</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <span className={`rm-badge-pago ${t.metodo === 'Bs/$' ? 'bs' : 'usd'}`}>
                                                            Pago {t.metodo}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontSize: '11px', fontWeight: 'normal', color: '#64748b' }}>
                                                        {t.banco || '-'}
                                                    </td>
                                                    <td className="rm-td-justif">
                                                        <div style={{ fontWeight: '700', color: '#334155' }}>{t.responsable_nombre || t.gerente_nombre} - {t.clasificacion_admin || 'S/C'}</div>
                                                        {t.itemsCount > 1 && (
                                                            <div
                                                                style={{ fontSize: '10px', color: '#0ea5e9', fontWeight: 'bold', cursor: 'help', marginTop: '2px' }}
                                                                title={t.items?.slice(1).map(it => `- ${it.descripcion || it.desc}`).join('\n')}
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                (+ {t.itemsCount - 1} más)
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td
                                                        className="rm-td-amount"
                                                        style={t.montoTotal === 0 ? { color: '#cbd5e1', fontWeight: 'normal' } : { color: '#0f172a', fontWeight: 'bold' }}
                                                    >
                                                        $ {t.montoTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <span className={`rm-badge-status ${t.statusDisplay.toLowerCase()}`}>
                                                            {t.statusDisplay.toUpperCase()}
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
                                            <tr>
                                                <th>REF #</th>
                                                <th style={{ textAlign: 'center' }}>ALM.</th>
                                                <th>PRODUCTO</th>
                                                <th>FACTURA</th>
                                                <th>FECHA</th>
                                                <th>SOLICITANTE</th>
                                                <th>CAT.</th>
                                                <th>DESTINO (G/CC)</th>
                                                <th style={{ textAlign: 'right' }}>TOTAL ($)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {costosRows.map((r) => (
                                                <tr key={r.uId}>
                                                    <td>
                                                        <span
                                                            className="rm-table-link"
                                                            onClick={() => r.tipo === 'REQUISICIÓN' ? handleOpenRequisicion(r.ref, r.requisicionIdReal) : handleOpenTicket(r.ref, r.uId)}
                                                        >
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
                                                                    borderColor: r.almacen ? '#0ea5e9' : '#e2e8f0',
                                                                    color: r.almacen ? '#0369a1' : '#94a3b8',
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
                                                    <td className="rm-td-desc">{r.descripcion}</td>
                                                    <td className="rm-td-invoice">{r.factura}</td>
                                                    <td className="rm-td-date">{safeFormatDate(r.fecha)}</td>
                                                    <td className="rm-td-solicitante">{r.solicitante || 'N/A'}</td>
                                                    <td><span className="rm-badge-type">{r.categoria}</span></td>
                                                    <td>
                                                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>{r.gerencia}</span>
                                                        <span className="rm-table-subtext">{r.cc?.split('(')[0]}</span>
                                                    </td>
                                                    <td className="rm-td-amount">$ {(r.monto || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
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
                                <div className="rm-table-card">
                                    <table className="rm-table">
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
                                            {reporteOperacionesRows.map((r) => (
                                                <tr key={r.uId}>
                                                    <td>
                                                        <span
                                                            className="rm-table-link"
                                                            onClick={() => r.tipo === 'REQUISICIÓN' ? handleOpenRequisicion(r.ref, r.requisicionIdReal) : handleOpenTicket(r.ref, r.uId)}
                                                        >
                                                            {r.proyecto}
                                                        </span>
                                                        <span className="rm-table-subtext">{safeFormatDate(r.fecha)}</span>
                                                    </td>
                                                    <td>
                                                        <span
                                                            className="rm-table-link"
                                                            onClick={() => r.tipo === 'REQUISICIÓN' ? handleOpenRequisicion(r.ref, r.requisicionIdReal) : handleOpenTicket(r.ref, r.uId)}
                                                        >
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
                                                                    borderColor: r.almacen ? '#0ea5e9' : '#e2e8f0',
                                                                    color: r.almacen ? '#0369a1' : '#94a3b8',
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
                                                    <td className="rm-td-desc">{r.descripcion}</td>
                                                    <td className="rm-td-invoice">{r.factura}</td>
                                                    <td className="rm-td-solicitante">{r.solicitante || 'N/A'}</td>
                                                    <td>
                                                        <span className={`rm-badge-pago ${r.moneda_pago === 'Bs/$' ? 'bs' : 'usd'}`}>
                                                            Pago {r.moneda_pago}
                                                        </span>
                                                    </td>
                                                    <td><span className="rm-badge-type">{r.categoria}</span></td>
                                                    <td>
                                                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>{r.cc?.split('(')[0]}</span>
                                                        <span className="rm-table-subtext">{r.gerencia}</span>
                                                    </td>
                                                    <td className="rm-td-amount">$ {(r.monto || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {reporteOperacionesRows.length === 0 && (
                                        <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                                            No se encontraron proyectos de Operaciones.
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'dashboard' && (
                            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rm-view-wrapper">
                                {/* --- SECCIÓN 1: EFICIENCIA OPERATIVA (TRAZABILIDAD) --- */}
                                <div style={{ marginBottom: '40px' }}>
                                    <div className="rm-section-header-bi">
                                        <div className="rm-bi-title-box">
                                            <Clock className="rm-bi-icon-blue" />
                                            <div>
                                                <h3>Eficiencia Operativa</h3>
                                                <p>Tiempos de respuesta y trazabilidad por nivel de aprobación</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="rm-bi-grid">
                                        <div className="rm-bi-card-main">
                                            <h4 className="rm-chart-title">Embudo de Aprobación (SLA Promedio)</h4>
                                            <ResponsiveContainer width="100%" height={300}>
                                                <BarChart data={metricsBI.funnelData} layout="vertical">
                                                    <XAxis type="number" hide />
                                                    <YAxis dataKey="stage" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700 }} />
                                                    <Tooltip cursor={{ fill: 'transparent' }} formatter={(v) => `${v} Días`} />
                                                    <Bar dataKey="dias" radius={[0, 4, 4, 0]} barSize={25}>
                                                        {metricsBI.funnelData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                            <div className="rm-bi-footer-info">
                                                <span>* Tiempo promedio desde la creación hasta el cierre final.</span>
                                            </div>
                                        </div>
                                        <div className="rm-bi-card-side">
                                            <h4>KPIs de Eficiencia</h4>
                                            <div className="rm-kpi-small">
                                                <label>Lead Time Total</label>
                                                <div className="val">{tiempoPromedioCierre} <small>Días</small></div>
                                            </div>
                                            <div className="rm-kpi-small">
                                                <label>Respuesta Gerencial</label>
                                                <div className="val">{tiempoRespuestaGerencial} <small>Días</small></div>
                                            </div>
                                            <div className="rm-kpi-small alert">
                                                <label>Reqs Estancadas (&gt;48h)</label>
                                                <div className="val">{requisicionesControl.filter(r => !r.f_finalizado && calcularSLA(r).alerta).length}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* --- SECCIÓN 2: SALUD FINANCIERA (BUDGET VS REAL) --- */}
                                <div style={{ marginBottom: '40px' }}>
                                    <div className="rm-section-header-bi">
                                        <div className="rm-bi-title-box">
                                            <DollarSign className="rm-bi-icon-green" />
                                            <div>
                                                <h3>Salud Financiera</h3>
                                                <p>Análisis de varianza: Presupuesto vs Gasto Real</p>
                                            </div>
                                        </div>
                                        <div className="rm-saving-badge">
                                            <label>Ahorro Total</label>
                                            <span>$ {metricsBI.ahorroTotal.toLocaleString('de-DE')}</span>
                                        </div>
                                    </div>
                                    <div className="rm-bi-grid-alt">
                                        <div className="rm-bi-card-main full">
                                            <h4 className="rm-chart-title">Presupuesto vs Real por Centro de Costo</h4>
                                            <ResponsiveContainer width="100%" height={350}>
                                                <BarChart data={metricsBI.financialData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v / 1000}k`} />
                                                    <Tooltip formatter={(v) => `$ ${Number(v).toLocaleString('de-DE')}`} />
                                                    <Legend />
                                                    <Bar dataKey="presupuesto" name="Presupuesto" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={20} />
                                                    <Bar dataKey="real" name="Gasto Real" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>

                                {/* --- SECCIÓN 3: AUDITORÍA (LOG DE EVENTOS) --- */}
                                <div>
                                    <div className="rm-section-header-bi">
                                        <div className="rm-bi-title-box">
                                            <CheckCircle2 className="rm-bi-icon-purple" />
                                            <div>
                                                <h3>Auditoría y Trazabilidad</h3>
                                                <p>Registro cronológico de aprobaciones recientes</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="rm-audit-timeline">
                                        {metricsBI.auditLog.map((log, idx) => (
                                            <div key={idx} className="rm-audit-item">
                                                <div className="rm-audit-dot"></div>
                                                <div className="rm-audit-content">
                                                    <div className="rm-audit-meta">
                                                        <span className="id">{log.id}</span>
                                                        <span className="date">{safeFormatDate(log.fecha, 'dd/MM/yyyy HH:mm')}</span>
                                                    </div>
                                                    <div className="rm-audit-text">
                                                        <strong>{log.accion}</strong> por {log.usuario}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
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
                    <div className="rm-modal-overlay" onClick={() => { setTickSeleccionado(null); setExtendedTicketData(null); }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="rm-detail-modal"
                            style={{ maxWidth: '1100px', width: '95%' }}
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
                                        <div className="rm-modal-header" style={{ background: '#1e293b' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <h2 style={{ margin: 0 }}>Referencia: {ticket.codigo_control || `TX-${String(ticket.id).padStart(4, '0')}`}</h2>
                                                <span className={`rm-badge-status ${statusDisplay.toLowerCase()}`}>
                                                    {statusDisplay.toUpperCase()}
                                                </span>
                                            </div>
                                            <button onClick={() => { setTickSeleccionado(null); setExtendedTicketData(null); }}>×</button>
                                        </div>
                                        <div className="rm-modal-body">
                                            {extendedLoading ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '15px' }}>
                                                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                                                        <DollarSign size={40} color="#3b82f6" />
                                                    </motion.div>
                                                    <span style={{ color: '#64748b', fontWeight: '600', fontSize: '0.9rem' }}>Cargando información extendida y comprobantes...</span>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px' }}>
                                                    {/* Left Panel: Info & Items & Signatures */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                                        <div>
                                                            <h3 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Información General</h3>
                                                            <div className="rm-modal-info-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: 0 }}>
                                                                <div className="rm-min-card"><strong>Responsable:</strong> {ticket.responsable_nombre || ticket.gerente_nombre || 'N/A'}</div>
                                                                <div className="rm-min-card"><strong>Gerencia:</strong> {ticket.departamento || 'N/A'}</div>
                                                                <div className="rm-min-card"><strong>Centro de Costo:</strong> {ticket.centro_costo || 'N/A'}</div>
                                                                <div className="rm-min-card"><strong>Monto Total:</strong> $ {(Number(ticket.total_usd) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <h3 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Trazabilidad Temporal</h3>
                                                            <div className="rm-modal-info-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: 0 }}>
                                                                <div className="rm-min-card"><strong>F. Emisión:</strong> {safeFormatDate(ticket.fecha_emision || ticket.created_at)}</div>
                                                                <div className="rm-min-card"><strong>F. Pago:</strong> {statusDisplay === 'Completada' ? safeFormatDate(ticket.fecha_pago || ticket.updated_at) : 'Pendiente'}</div>
                                                                <div className="rm-min-card"><strong>Banco Liquidación:</strong> {bancoNombre}</div>
                                                                <div className="rm-min-card"><strong>Método de Pago:</strong> Pago {metodoPago}</div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <h3 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Conceptos y Renglones</h3>
                                                            <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                                                                <table className="rm-mini-table">
                                                                    <thead>
                                                                        <tr>
                                                                            <th>Descripción</th>
                                                                            <th style={{ textAlign: 'right' }}>Total</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {ticket.items?.map((it, idx) => (
                                                                            <tr key={idx}>
                                                                                <td style={{ fontSize: '0.8rem' }}>{it.descripcion || it.desc}</td>
                                                                                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.85rem' }}>$ {(Number(it.total) || (Number(it.pu) * Number(it.cant))).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>

                                                        {ticket.justificacion && (
                                                            <div>
                                                                <h3 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notas de Auditoría</h3>
                                                                <div style={{ padding: '12px 15px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '12px', fontSize: '0.82rem', color: '#78350f', whiteSpace: 'pre-line', fontWeight: '500', lineHeight: '1.4' }}>
                                                                    {ticket.justificacion}
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div>
                                                            <h3 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Firmas y Aprobaciones</h3>
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
                                                                                    <div style={{ fontSize: '0.7rem', color: '#334155', fontWeight: 600 }}>{bancoNombre}</div>
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
                                                        <h3 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Visor de Soportes Digitales</h3>
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
                                                                                    borderColor: selectedFileIndex === idx ? '#3b82f6' : '#e2e8f0',
                                                                                    background: selectedFileIndex === idx ? '#eff6ff' : 'white',
                                                                                    color: selectedFileIndex === idx ? '#2563eb' : '#475569',
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
                                                                    {invoiceFiles[selectedFileIndex]?.url.split('?')[0].toLowerCase().endsWith('.pdf') ? (
                                                                        <iframe
                                                                            src={invoiceFiles[selectedFileIndex].url}
                                                                            width="100%"
                                                                            height="430px"
                                                                            style={{ border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}
                                                                        />
                                                                    ) : (
                                                                        <div style={{ display: 'flex', justifyContent: 'center', background: '#f8fafc', padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                                                            <img
                                                                                src={invoiceFiles[selectedFileIndex].url}
                                                                                alt="Soporte Factura"
                                                                                style={{ maxWidth: '100%', maxHeight: '410px', objectFit: 'contain', borderRadius: '8px' }}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                    <div style={{ marginTop: '8px', textAlign: 'right' }}>
                                                                        <a
                                                                            href={invoiceFiles[selectedFileIndex].url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: '700', textDecoration: 'underline' }}
                                                                        >
                                                                            Ver en pestaña nueva ↗
                                                                        </a>
                                                                    </div>
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
                                            )}
                                        </div>
                                    </>
                                );
                            })()}
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

