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
    AlertCircle,
    User,
    X
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
import autoTable from 'jspdf-autotable';
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
    const [listaGerencias, setListaGerencias] = useState([]);
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

    // Módulo de Beneficiarios
    const [busquedaBenef, setBusquedaBenef] = useState('');
    const [debouncedBusqueda, setDebouncedBusqueda] = useState('');
    const [ccBenef, setCcBenef] = useState('Todos');
    const [fechaInicioBenef, setFechaInicioBenef] = useState('');
    const [fechaFinBenef, setFechaFinBenef] = useState('');
    const [beneficiarioSeleccionado, setBeneficiarioSeleccionado] = useState(null);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedBusqueda(busquedaBenef);
        }, 400);
        return () => clearTimeout(handler);
    }, [busquedaBenef]);

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

    const extraerDocumentoIdentidad = (texto) => {
        if (!texto) return 'N/A';
        const regexRif = /([VJEGvjeg]-\d{8}-\d|\d{7,8}|[VJEGvjeg]\d{7,9})/g;
        const match = texto.match(regexRif);
        if (match) return match[0].toUpperCase();
        
        const regexCedulaPuntos = /(\d{1,3}\.\d{3}\.\d{3})/g;
        const matchPuntos = texto.match(regexCedulaPuntos);
        if (matchPuntos) return matchPuntos[0];

        return 'N/A';
    };

    const limpiarNombreBeneficiario = (texto) => {
        if (!texto) return 'S/E';
        let clean = texto.replace(/([VJEGvjeg]-\d{8}-\d|\d{7,8}|[VJEGvjeg]\d{7,9})/g, '');
        clean = clean.replace(/(\d{1,3}\.\d{3}\.\d{3})/g, '');
        clean = clean.replace(/[()\-.,]/g, ' ').replace(/\s+/g, ' ').trim();
        return clean || texto;
    };

    const normalizedCompare = (str1, str2) => {
        if (!str1 || !str2) return false;
        const clean = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
        return clean(str1) === clean(str2);
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
            const [resReq, resTickets, resCC, resBancos, resSols, resParts, resGer] = await Promise.all([
                supabase.from('requisiciones').select('*').order('fecha_emision', { ascending: false }),
                supabase.from('tickets_directos').select('*').order('fecha_emision', { ascending: false }),
                supabase.from('maestros_centros_costo').select('id, nombre').eq('activo', true).order('nombre'),
                supabase.from('bancos').select('*').eq('activo', true),
                supabase.from('solicitudes_fondos').select('*').order('fecha_operativa', { ascending: false }),
                supabase.from('partidas_fondos').select('*'),
                supabase.from('cat_gerencias').select('nombre').order('nombre')
            ]);

            if (resReq.error || resTickets.error) throw new Error("Error en la descarga de datos");
            if (resCC.data) setListaCentrosCostos(resCC.data);
            if (resGer.data) setListaGerencias(resGer.data.map(g => g.nombre));

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
            const req = (data.requisiciones || []).find(r => r.id === requisicionId);
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
        const found = (data.requisiciones || []).find(r => r.correlativo_req === ref || r.id === realId);
        if (found) {
            const items = Array.isArray(found.items) ? found.items : [];
            const montoEstimado = items.reduce((sum, i) => sum + (Number(i.cant) * (Number(i.pu) || 0)), 0);
            setReqSeleccionada({ ...found, montoEstimado });
        }
    }, [data.requisiciones]);

    const handleOpenTicket = useCallback(async (ref, uId) => {
        const ticketId = uId ? uId.split('-')[1] : null;
        const found = (data.tickets || []).find(t => t.codigo_control === ref || (ticketId && String(t.id) === String(ticketId)));
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

    // --- PROCESAMIENTO: MÓDULO DE BENEFICIARIOS ---
    const beneficiariosList = useMemo(() => {
        const list = [];

        // 1. Requisiciones
        (data.requisiciones || []).forEach(req => {
            const items = Array.isArray(req.items) ? req.items : [];
            items.forEach((item, idx) => {
                const rawBenef = item.beneficiario || item.ben || '';
                if (rawBenef) {
                    const doc = extraerDocumentoIdentidad(rawBenef);
                    const nombreClean = limpiarNombreBeneficiario(rawBenef);
                    const totalItem = (Number(item.cant || item.cantidad) || 1) * (Number(item.pu || item.pu_estimado) || 0);
                    list.push({
                        key: `req-${req.id}-${idx}`,
                        id: req.id,
                        ref: req.correlativo_req || `REQ-${String(req.id).padStart(3, '0')}`,
                        tipo: 'Requisición',
                        fecha: req.fecha_emision ? req.fecha_emision.substring(0, 10) : '',
                        beneficiarioRaw: rawBenef,
                        beneficiario: nombreClean,
                        documento: doc,
                        centroCosto: req.centro_costo || 'N/A',
                        concepto: item.descripcion || item.desc || 'N/A',
                        monto: totalItem,
                        moneda: 'USD',
                        estado: req.estado_aprobacion || 'pendiente_area',
                        record: req,
                        itemIdx: idx
                    });
                }
            });
        });

        // 2. Solicitudes de Fondos / Partidas de Fondos
        (data.partidas || []).forEach((partida, idx) => {
            const rawBenef = partida.beneficiario || '';
            if (rawBenef) {
                const parentSol = (data.solicitudes || []).find(s => s.id === partida.solicitud_id);
                const doc = extraerDocumentoIdentidad(rawBenef);
                const nombreClean = limpiarNombreBeneficiario(rawBenef);
                const totalItem = (Number(partida.cantidad) || 1) * (Number(partida.pu_bs || partida.pu_usd || 0));
                const moneda = Number(partida.pu_bs) > 0 ? 'Bs' : 'USD';
                list.push({
                    key: `partida-${partida.id || idx}`,
                    id: parentSol ? parentSol.id : partida.solicitud_id,
                    ref: partida.codigo_ticket || (parentSol ? `SF-${String(parentSol.id).padStart(3, '0')}` : 'SF-N/A'),
                    tipo: 'Solicitud de Fondo',
                    fecha: parentSol?.fecha_operativa ? parentSol.fecha_operativa.substring(0, 10) : (partida.created_at ? partida.created_at.substring(0, 10) : ''),
                    beneficiarioRaw: rawBenef,
                    beneficiario: nombreClean,
                    documento: doc,
                    centroCosto: partida.centro_costo || 'N/A',
                    concepto: partida.descripcion || 'N/A',
                    monto: totalItem,
                    moneda: moneda,
                    estado: parentSol?.estado || parentSol?.status || 'Procesando',
                    record: parentSol || partida,
                    partidaId: partida.id
                });
            }
        });

        // 3. Tickets Directos
        (data.tickets || []).forEach(ticket => {
            const items = Array.isArray(ticket.items) ? ticket.items : [];
            items.forEach((item, idx) => {
                const rawBenef = item.beneficiario || item.ben || '';
                if (rawBenef) {
                    const doc = extraerDocumentoIdentidad(rawBenef);
                    const nombreClean = limpiarNombreBeneficiario(rawBenef);
                    const totalItem = (Number(item.cantidad_pedida || item.cant) || 1) * (Number(item.pu_estimado || item.pu) || 0);
                    list.push({
                        key: `ticket-${ticket.id}-${idx}`,
                        id: ticket.id,
                        ref: ticket.codigo_control || `TK-${String(ticket.id).padStart(3, '0')}`,
                        tipo: 'Ticket Directo',
                        fecha: ticket.fecha_emision ? ticket.fecha_emision.substring(0, 10) : '',
                        beneficiarioRaw: rawBenef,
                        beneficiario: nombreClean,
                        documento: doc,
                        centroCosto: ticket.centro_costo || 'N/A',
                        concepto: item.desc || item.descripcion || 'N/A',
                        monto: totalItem,
                        moneda: 'USD',
                        estado: ticket.status || 'Emitido',
                        record: ticket,
                        itemIdx: idx
                    });
                }
            });
        });

        return list;
    }, [data.requisiciones, data.partidas, data.solicitudes, data.tickets]);

    const beneficiariosFiltrados = useMemo(() => {
        return beneficiariosList.filter(row => {
            const term = debouncedBusqueda.toLowerCase().trim();
            let matchText = true;
            if (term) {
                matchText = 
                    row.beneficiarioRaw.toLowerCase().includes(term) ||
                    row.ref.toLowerCase().includes(term) ||
                    row.documento.toLowerCase().includes(term) ||
                    row.concepto.toLowerCase().includes(term);
            }

            let matchCc = true;
            if (ccBenef !== 'Todos') {
                matchCc = row.centroCosto.toLowerCase().includes(ccBenef.toLowerCase());
            }

            let matchDate = true;
            if (fechaInicioBenef && row.fecha && row.fecha < fechaInicioBenef) matchDate = false;
            if (fechaFinBenef && row.fecha && row.fecha > fechaFinBenef) matchDate = false;

            return matchText && matchCc && matchDate;
        }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    }, [beneficiariosList, debouncedBusqueda, ccBenef, fechaInicioBenef, fechaFinBenef]);

    const transaccionesBenefSeleccionado = useMemo(() => {
        if (!beneficiarioSeleccionado) return [];
        return beneficiariosList.filter(row => 
            normalizedCompare(row.beneficiario, beneficiarioSeleccionado) || 
            row.beneficiarioRaw.toLowerCase().includes(beneficiarioSeleccionado.toLowerCase())
        );
    }, [beneficiariosList, beneficiarioSeleccionado]);

    const kpisBenefSeleccionado = useMemo(() => {
        const totalUSD = transaccionesBenefSeleccionado.filter(t => t.moneda === 'USD').reduce((s, t) => s + t.monto, 0);
        const totalBs = transaccionesBenefSeleccionado.filter(t => t.moneda === 'Bs').reduce((s, t) => s + t.monto, 0);
        const docId = transaccionesBenefSeleccionado.find(t => t.documento && t.documento !== 'N/A')?.documento || 'N/A';
        return { totalUSD, totalBs, docId };
    }, [transaccionesBenefSeleccionado]);

    // --- PROCESAMIENTO: VISTA 1 - RELACIÓN DE COSTOS (FLATTENED) ---
    const costosRows = useMemo(() => {
        const rows = [];

        // 1. Procesar Tickets Directos
        (data.tickets || []).forEach(t => {
            const items = Array.isArray(t.items) ? t.items : [];
            items.forEach(item => {
                const rowDate = t.fecha_emision ? t.fecha_emision.split('T')[0] : '';

                // Buscar requisición por correlativo_req o id
                const reqMatch = (data.requisiciones || []).find(r => r.correlativo_req === t.solicitud_ref || r.id === t.solicitud_ref);
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
        (data.requisiciones || []).filter(r => r.estado_aprobacion === 'aprobado_final').forEach(r => {
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
        return (data.tickets || []).filter(t => {
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
        return (data.requisiciones || []).map(r => {
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
        return (data.tickets || []).map(t => {
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

        if (incluirReqs) procesar(data.requisiciones || [], false);
        if (incluirTickets) procesar(data.tickets || [], true);

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
        const ticketsPendientes = (data.tickets || []).filter(t => t.status?.toUpperCase() === 'EMITIDO').length;

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

    const exportExcelFlujo = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reporte Flujo');

        const headerStyle = {
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } },
            font: { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } }
        };

        const columns = [
            { header: 'Fecha', key: 'fecha', width: 15 },
            { header: 'Semana', key: 'semana', width: 10 },
            { header: 'Clasificación del Gasto', key: 'categoria', width: 25 },
            { header: 'Descripción', key: 'descripcion', width: 45 },
            { header: 'Monto', key: 'monto', width: 15 },
            { header: 'Proyecto', key: 'proyecto', width: 25 },
            { header: 'Gerencia', key: 'gerencia', width: 25 }
        ];

        worksheet.columns = columns;
        worksheet.getRow(1).eachCell((cell) => { Object.assign(cell, headerStyle); });
        worksheet.getRow(1).height = 25;

        costosRows.forEach(r => {
            const row = worksheet.addRow({
                fecha: '',
                semana: Number(r.semana) || '',
                categoria: r.categoria || '',
                descripcion: r.descripcion || '',
                monto: Number(r.monto) || 0,
                proyecto: r.cc ? r.cc.split('(')[0].trim() : '',
                gerencia: r.gerencia || ''
            });

            if (r.fecha) {
                try {
                    const d = parseISO(r.fecha);
                    if (!isNaN(d.getTime())) {
                        row.getCell(1).value = new Date(r.fecha + 'T12:00:00');
                        row.getCell(1).numFmt = 'dd/mm/yyyy';
                    } else {
                        row.getCell(1).value = r.fecha;
                    }
                } catch {
                    row.getCell(1).value = r.fecha;
                }
            } else {
                row.getCell(1).value = '';
            }

            row.getCell(5).numFmt = '#,##0.00';
        });

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Reporte_Flujo_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    const exportExcelMatricial = async () => {
        if (filtroCC === 'Todos') {
            toast.error("Por favor, selecciona un Centro de Costo específico en los filtros antes de exportar el reporte matricial.");
            return;
        }

        const MAPPING_CATEGORIAS = {
            "materiales instalables": "Materiales",
            "materiales consumibles": "Materiales",
            "fletes": "Materiales",
            "pintura y materiales de pintura": "Materiales",
            "depreciación eq": "Depreciación de Equipos",
            "depreciacion eq": "Depreciación de Equipos",
            "depreciación de equipos": "Depreciación de Equipos",
            "depreciacion de equipos": "Depreciación de Equipos",
            "gasoil": "Equipos Propios",
            "gasolina": "Equipos Propios",
            "aceites": "Equipos Propios",
            "refrigerante": "Equipos Propios",
            "grasa": "Equipos Propios",
            "baterías": "Equipos Propios",
            "baterias": "Equipos Propios",
            "cauchos": "Equipos Propios",
            "reparación de cauchos": "Equipos Propios",
            "reparacion de cauchos": "Equipos Propios",
            "filtros": "Equipos Propios",
            "gamusa": "Equipos Propios",
            "reparaciones/repuestos": "Equipos Propios",
            "reparaciones/mano de obra": "Equipos Propios",
            "monitoreo gps": "Equipos Propios",
            "transporte de personal": "Equipos de Terceros",
            "otros equipos de terceros": "Equipos de Terceros",
            "nóminas y salarios indirecto": "Mano de Obra Indirecta",
            "nominas y salarios indirecto": "Mano de Obra Indirecta",
            "complementos indirecto": "Mano de Obra Indirecta",
            "cesta ticket indirecto": "Mano de Obra Indirecta",
            "comidas indirecto": "Mano de Obra Indirecta",
            "préstamos indirectos": "Mano de Obra Indirecta",
            "prestamos indirectos": "Mano de Obra Indirecta",
            "vacaciones indirectos": "Mano de Obra Indirecta",
            "pres./liquidacion indirecto": "Mano de Obra Indirecta",
            "comidas sobretiempo ind.": "Mano de Obra Indirecta",
            "nóminas y salarios p. directo": "Mano de Obra Directa",
            "nominas y salarios p. directo": "Mano de Obra Directa",
            "complementos directo": "Mano de Obra Directa",
            "cesta ticket (tea) directo": "Mano de Obra Directa",
            "comidas directo": "Mano de Obra Directa",
            "préstamos directos": "Mano de Obra Directa",
            "prestamos directos": "Mano de Obra Directa",
            "vacaciones directos": "Mano de Obra Directa",
            "pres./liquidacion directos": "Mano de Obra Directa",
            "útiles escolares/nac/muerte": "Mano de Obra Directa",
            "utiles escolares/nac/muerte": "Mano de Obra Directa",
            "personal eventual": "Mano de Obra Directa",
            "implementos de seguridad": "Seguridad",
            "equipos de seguridad": "Seguridad",
            "exámenes de ingreso/egreso": "Gastos Médicos",
            "examenes de ingreso/egreso": "Gastos Médicos",
            "pólizas hcm": "Gastos Médicos",
            "polizas hcm": "Gastos Médicos",
            "reembolsos de gastos médicos": "Gastos Médicos",
            "reembolsos de gastos medicos": "Gastos Médicos",
            "sucursal agua, hielo, vasos": "Gastos Médicos",
            "certificaciones de equipos": "Gastos Adm de Obra",
            "incret y socioambiental": "Gastos Adm de Obra",
            "sucursal cursos y capacitación": "Gastos Adm de Obra",
            "sucursal cursos y capacitacion": "Gastos Adm de Obra"
        };

        const getColLetter = (colIdx) => {
            let temp = colIdx;
            let letter = "";
            while (temp > 0) {
                let modulo = (temp - 1) % 26;
                letter = String.fromCharCode(65 + modulo) + letter;
                temp = Math.floor((temp - modulo) / 26);
            }
            return letter;
        };

        const rowsFiltradas = costosRows.filter(r => r.cc === filtroCC || r.cc?.includes(filtroCC));
        if (rowsFiltradas.length === 0) {
            toast.info("No hay datos registrados para este Centro de Costo en el período seleccionado.");
            return;
        }

        // Obtener semanas únicas
        const uniqueWeeks = Array.from(new Set(rowsFiltradas.map(r => r.semana).filter(w => w > 0))).sort((a, b) => a - b);
        const W = uniqueWeeks.length;
        if (W === 0) {
            toast.error("Error al determinar las semanas del período.");
            return;
        }

        // Obtener el año de los registros (o usar el año actual)
        const sampleYear = new Date(rowsFiltradas[0].fecha || new Date()).getFullYear();

        // Estructura matricial
        const matrix = {};
        rowsFiltradas.forEach(r => {
            const catRaw = r.categoria || 'Otros';
            const categoryName = catRaw.charAt(0).toUpperCase() + catRaw.slice(1);
            const catLower = catRaw.toLowerCase().trim();
            const groupName = MAPPING_CATEGORIAS[catLower] || 'Gastos Generales';
            const week = r.semana;
            const monto = Number(r.monto) || 0;

            if (!matrix[groupName]) {
                matrix[groupName] = {};
            }
            if (!matrix[groupName][categoryName]) {
                matrix[groupName][categoryName] = {};
            }
            matrix[groupName][categoryName][week] = (matrix[groupName][categoryName][week] || 0) + monto;
        });

        // Crear Libro
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`Matricial - CC`);
        worksheet.views = [{ showGridLines: true }];

        const lastColLetter = getColLetter(4 + W);

        // Titulo principal
        worksheet.mergeCells(`A1:${lastColLetter}1`);
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'RESUMEN MATRICIAL DE COSTOS';
        titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
        worksheet.getRow(1).height = 36;

        // Subtítulo
        let periodoStr = 'Todos los registros';
        if (fechaDesde && fechaHasta) {
            periodoStr = `Período: ${safeFormatDate(fechaDesde)} al ${safeFormatDate(fechaHasta)}`;
        } else {
            const dates = rowsFiltradas.map(r => r.fecha).filter(Boolean).sort();
            if (dates.length > 0) {
                periodoStr = `Período: ${safeFormatDate(dates[0])} al ${safeFormatDate(dates[dates.length - 1])}`;
            }
        }

        worksheet.mergeCells(`A2:${lastColLetter}2`);
        const subCell = worksheet.getCell('A2');
        subCell.value = `Centro de Costo: ${filtroCC} | ${periodoStr}`;
        subCell.font = { name: 'Calibri', size: 11, italic: true, color: { argb: 'FFFFFFFF' } };
        subCell.alignment = { horizontal: 'center', vertical: 'middle' };
        subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
        worksheet.getRow(2).height = 24;

        // Fila vacía
        worksheet.getRow(3).height = 10;

        // Columnas
        const getWeekRangeString = (weekNum, year) => {
            const simple = new Date(year, 0, 1 + (weekNum - 1) * 7);
            const dow = simple.getDay();
            const ISOweekStart = simple;
            if (dow <= 4) {
                ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
            } else {
                ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
            }
            const ISOweekEnd = new Date(ISOweekStart);
            ISOweekEnd.setDate(ISOweekStart.getDate() + 6);
            
            const formatDM = (date) => {
                const d = String(date.getDate()).padStart(2, '0');
                const m = String(date.getMonth() + 1).padStart(2, '0');
                return `${d}/${m}`;
            };
            return `${formatDM(ISOweekStart)} - ${formatDM(ISOweekEnd)}`;
        };

        const headers = [
            'CLASIFICACIÓN DE GASTO',
            'TOTAL ACUMULADO ($)',
            '% SOBRE TOTAL'
        ];
        uniqueWeeks.forEach((w, idx) => {
            headers.push(`Semana ${idx + 1}\n(Sem. ${w}: ${getWeekRangeString(w, sampleYear)})`);
        });
        headers.push('TOTAL MES');

        worksheet.getRow(4).values = headers;
        worksheet.getRow(4).height = 35;

        // Formato cabeceras
        for (let colIdx = 1; colIdx <= 4 + W; colIdx++) {
            const cell = worksheet.getCell(4, colIdx);
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = {
                bottom: { style: 'medium', color: { argb: 'FF1E293B' } },
                top: { style: 'medium', color: { argb: 'FF1E293B' } }
            };
        }

        // Definir anchos
        worksheet.getColumn(1).width = 38;
        worksheet.getColumn(2).width = 24;
        worksheet.getColumn(3).width = 16;
        for (let i = 0; i < W; i++) {
            worksheet.getColumn(4 + i).width = 22;
        }
        worksheet.getColumn(4 + W).width = 22;

        let currentIdx = 5;
        const groupHeaderRowsList = [];

        // Primero calcularemos la fila del total general para poder usarla en el porcentaje de cada fila
        let totalRowsCount = 4; // 4 filas de cabecera
        Object.keys(matrix).forEach(groupName => {
            totalRowsCount += 1; // Fila de cabecera del grupo
            totalRowsCount += Object.keys(matrix[groupName]).length; // Filas de categorías
        });
        const totalGeneralRowIdx = totalRowsCount + 1; // Fila final del TOTAL GENERAL

        // Recorrer grupos y categorías
        Object.keys(matrix).forEach(groupName => {
            const categories = Object.keys(matrix[groupName]);
            const numCategories = categories.length;
            if (numCategories === 0) return;

            const groupHeaderRowIdx = currentIdx;
            groupHeaderRowsList.push(groupHeaderRowIdx);

            // 1. Agregar Fila de Cabecera del Grupo
            const groupRow = worksheet.getRow(groupHeaderRowIdx);
            groupRow.getCell(1).value = groupName;
            groupRow.getCell(2).value = { formula: `=SUM(B${groupHeaderRowIdx + 1}:B${groupHeaderRowIdx + numCategories})` };
            groupRow.getCell(3).value = { formula: `=B${groupHeaderRowIdx}/$B$${totalGeneralRowIdx}` };
            
            // Fórmulas para las semanas
            for (let i = 0; i < W; i++) {
                const colLetter = getColLetter(4 + i);
                groupRow.getCell(4 + i).value = { formula: `=SUM(${colLetter}${groupHeaderRowIdx + 1}:${colLetter}${groupHeaderRowIdx + numCategories})` };
            }
            // TOTAL MES
            const totalMesColLetter = getColLetter(4 + W);
            groupRow.getCell(4 + W).value = { formula: `=SUM(${totalMesColLetter}${groupHeaderRowIdx + 1}:${totalMesColLetter}${groupHeaderRowIdx + numCategories})` };

            // Estilo Fila Grupo
            groupRow.height = 22;
            for (let c = 1; c <= 4 + W; c++) {
                const cell = groupRow.getCell(c);
                cell.font = { name: 'Calibri', size: 10, bold: true, italic: true, color: { argb: 'FF1E293B' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                cell.border = {
                    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    top: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                };
                if (c === 1) {
                    cell.alignment = { horizontal: 'left', vertical: 'middle' };
                } else if (c === 3) {
                    cell.numFmt = '0.0%';
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                } else {
                    cell.numFmt = '"$"#,##0.00;[Red]("$"#,##0.00);"-"';
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                }
            }

            currentIdx++;

            // 2. Agregar Categorías del Grupo
            categories.forEach(categoryName => {
                const catRowIdx = currentIdx;
                const catRow = worksheet.getRow(catRowIdx);
                catRow.getCell(1).value = `  ${categoryName}`; // indentación
                
                const lastWeekLetter = getColLetter(4 + W - 1);
                catRow.getCell(2).value = { formula: `=SUM(D${catRowIdx}:${lastWeekLetter}${catRowIdx})` };
                catRow.getCell(3).value = { formula: `=B${catRowIdx}/$B$${totalGeneralRowIdx}` };

                // Valores por semana
                uniqueWeeks.forEach((w, i) => {
                    const value = matrix[groupName][categoryName][w] || 0;
                    catRow.getCell(4 + i).value = value;
                });

                // TOTAL MES
                catRow.getCell(4 + W).value = { formula: `=B${catRowIdx}` };

                // Estilo Fila Categoría
                catRow.height = 20;
                for (let c = 1; c <= 4 + W; c++) {
                    const cell = catRow.getCell(c);
                    cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF475569' } };
                    cell.border = {
                        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                    };
                    if (c === 1) {
                        cell.alignment = { horizontal: 'left', vertical: 'middle' };
                    } else if (c === 3) {
                        cell.numFmt = '0.0%';
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    } else {
                        cell.numFmt = '"$"#,##0.00;[Red]("$"#,##0.00);"-"';
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    }
                }

                currentIdx++;
            });
        });

        // 3. Fila de TOTAL GENERAL
        const totalGenRow = worksheet.getRow(totalGeneralRowIdx);
        totalGenRow.getCell(1).value = 'TOTAL GENERAL';
        
        // Sumar todos los grupos
        totalGenRow.getCell(2).value = { formula: `=${groupHeaderRowsList.map(idx => `B${idx}`).join('+')}` };
        totalGenRow.getCell(3).value = { formula: `=B${totalGeneralRowIdx}/B${totalGeneralRowIdx}` };

        for (let i = 0; i < W; i++) {
            const colLetter = getColLetter(4 + i);
            totalGenRow.getCell(4 + i).value = { formula: `=${groupHeaderRowsList.map(idx => `${colLetter}${idx}`).join('+')}` };
        }

        const totalMesColLetter = getColLetter(4 + W);
        totalGenRow.getCell(4 + W).value = { formula: `=${groupHeaderRowsList.map(idx => `${totalMesColLetter}${idx}`).join('+')}` };

        // Estilo Fila TOTAL GENERAL
        totalGenRow.height = 24;
        for (let c = 1; c <= 4 + W; c++) {
            const cell = totalGenRow.getCell(c);
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
            cell.border = {
                bottom: { style: 'double', color: { argb: 'FF0F172A' } },
                top: { style: 'thin', color: { argb: 'FF0F172A' } }
            };
            if (c === 1) {
                cell.alignment = { horizontal: 'left', vertical: 'middle' };
            } else if (c === 3) {
                cell.numFmt = '0.0%';
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
            } else {
                cell.numFmt = '"$"#,##0.00;[Red]("$"#,##0.00);"-"';
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
            }
        }

        try {
            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Resumen_Matricial_${filtroCC.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
            toast.success("Resumen matricial por Centro de Costo exportado con éxito.");
        } catch (e) {
            console.error("Error al exportar reporte matricial:", e);
            toast.error("Ocurrió un error al generar el archivo Excel: " + e.message);
        }
    };

    const exportExcelResumenCC = async () => {
        // 1. Obtener todos los gastos sin aplicar el filtro de CC (pero respetando los demás filtros de la vista)
        const getGlobalCostosRows = () => {
            const rows = [];

            // 1. Tickets
            (data.tickets || []).forEach(t => {
                const items = Array.isArray(t.items) ? t.items : [];
                items.forEach(item => {
                    const rowDate = t.fecha_emision ? t.fecha_emision.split('T')[0] : '';
                    const reqMatch = (data.requisiciones || []).find(r => r.correlativo_req === t.solicitud_ref || r.id === t.solicitud_ref);
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

            // 2. Requisiciones
            (data.requisiciones || []).filter(r => r.estado_aprobacion === 'aprobado_final').forEach(r => {
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
                            monto: Number(h.cant || 0) * Number(h.pu || 0),
                            cc: r.centro_costo || 'N/A',
                            gerencia: r.departamento || 'N/A',
                            tipo: 'REQ',
                            ref: r.correlativo_req || `REQ-${r.id}`,
                            proyecto: r.id_referencia_proyecto || 'Sin ID Proyecto',
                            moneda_pago: monedaPago,
                            solicitante: r.solicitante || 'N/A',
                            factura: h.doc_numero || '-',
                            almacen: Boolean(h.almacen)
                        });
                    });
                });
            });

            return rows.filter(row => {
                const matchBusqueda = row.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
                    row.ref.toLowerCase().includes(busqueda.toLowerCase()) ||
                    row.proyecto.toLowerCase().includes(busqueda.toLowerCase());
                const matchGerencia = filtroGerencia === 'Todos' || row.gerencia === filtroGerencia;
                const matchSemana = !filtroSemana || String(row.semana) === String(filtroSemana);
                let matchFecha = true;
                if (fechaDesde && row.fecha < fechaDesde) matchFecha = false;
                if (fechaHasta && row.fecha > fechaHasta) matchFecha = false;
                const matchAlmacen = filtroAlmacen === 'Todos' || (filtroAlmacen === 'Si' ? row.almacen : !row.almacen);
                const matchCategoria = filtroCategoria === 'Todos' || row.categoria === filtroCategoria;
                return matchBusqueda && matchGerencia && matchSemana && matchFecha && matchAlmacen && matchCategoria;
            });
        };

        const rowsGlobales = getGlobalCostosRows();
        if (rowsGlobales.length === 0) {
            toast.info("No hay datos registrados para generar el resumen global.");
            return;
        }

        const MAPPING_CATEGORIAS = {
            "materiales instalables": "Materiales",
            "materiales consumibles": "Materiales",
            "fletes": "Materiales",
            "pintura y materiales de pintura": "Materiales",
            "depreciación eq": "Depreciación de Equipos",
            "depreciacion eq": "Depreciación de Equipos",
            "depreciación de equipos": "Depreciación de Equipos",
            "depreciacion de equipos": "Depreciación de Equipos",
            "gasoil": "Equipos Propios",
            "gasolina": "Equipos Propios",
            "aceites": "Equipos Propios",
            "refrigerante": "Equipos Propios",
            "grasa": "Equipos Propios",
            "baterías": "Equipos Propios",
            "baterias": "Equipos Propios",
            "cauchos": "Equipos Propios",
            "reparación de cauchos": "Equipos Propios",
            "reparacion de cauchos": "Equipos Propios",
            "filtros": "Equipos Propios",
            "gamusa": "Equipos Propios",
            "reparaciones/repuestos": "Equipos Propios",
            "reparaciones/mano de obra": "Equipos Propios",
            "monitoreo gps": "Equipos Propios",
            "transporte de personal": "Equipos de Terceros",
            "otros equipos de terceros": "Equipos de Terceros",
            "nóminas y salarios indirecto": "Mano de Obra Indirecta",
            "nominas y salarios indirecto": "Mano de Obra Indirecta",
            "complementos indirecto": "Mano de Obra Indirecta",
            "cesta ticket indirecto": "Mano de Obra Indirecta",
            "comidas indirecto": "Mano de Obra Indirecta",
            "préstamos indirectos": "Mano de Obra Indirecta",
            "prestamos indirectos": "Mano de Obra Indirecta",
            "vacaciones indirectos": "Mano de Obra Indirecta",
            "pres./liquidacion indirecto": "Mano de Obra Indirecta",
            "comidas sobretiempo ind.": "Mano de Obra Indirecta",
            "nóminas y salarios p. directo": "Mano de Obra Directa",
            "nominas y salarios p. directo": "Mano de Obra Directa",
            "complementos directo": "Mano de Obra Directa",
            "cesta ticket (tea) directo": "Mano de Obra Directa",
            "comidas directo": "Mano de Obra Directa",
            "préstamos directos": "Mano de Obra Directa",
            "prestamos directos": "Mano de Obra Directa",
            "vacaciones directos": "Mano de Obra Directa",
            "pres./liquidacion directos": "Mano de Obra Directa",
            "útiles escolares/nac/muerte": "Mano de Obra Directa",
            "utiles escolares/nac/muerte": "Mano de Obra Directa",
            "personal eventual": "Mano de Obra Directa",
            "implementos de seguridad": "Seguridad",
            "equipos de seguridad": "Seguridad",
            "exámenes de ingreso/egreso": "Gastos Médicos",
            "examenes de ingreso/egreso": "Gastos Médicos",
            "pólizas hcm": "Gastos Médicos",
            "polizas hcm": "Gastos Médicos",
            "reembolsos de gastos médicos": "Gastos Médicos",
            "reembolsos de gastos medicos": "Gastos Médicos",
            "sucursal agua, hielo, vasos": "Gastos Médicos",
            "certificaciones de equipos": "Gastos Adm de Obra",
            "incret y socioambiental": "Gastos Adm de Obra",
            "sucursal cursos y capacitación": "Gastos Adm de Obra",
            "sucursal cursos y capacitacion": "Gastos Adm de Obra"
        };

        const getColLetter = (colIdx) => {
            let temp = colIdx;
            let letter = "";
            while (temp > 0) {
                let modulo = (temp - 1) % 26;
                letter = String.fromCharCode(65 + modulo) + letter;
                temp = Math.floor((temp - modulo) / 26);
            }
            return letter;
        };

        // Centros de Costo únicos presentes
        const uniqueCCs = Array.from(new Set(rowsGlobales.map(r => r.cc).filter(Boolean))).sort();
        const CC_count = uniqueCCs.length;

        // Estructura matricial
        const matrix = {};
        rowsGlobales.forEach(r => {
            const catRaw = r.categoria || 'Otros';
            const categoryName = catRaw.charAt(0).toUpperCase() + catRaw.slice(1);
            const catLower = catRaw.toLowerCase().trim();
            const groupName = MAPPING_CATEGORIAS[catLower] || 'Gastos Generales';
            const cc = r.cc || 'N/A';
            const monto = Number(r.monto) || 0;

            if (!matrix[groupName]) {
                matrix[groupName] = {};
            }
            if (!matrix[groupName][categoryName]) {
                matrix[groupName][categoryName] = {};
            }
            matrix[groupName][categoryName][cc] = (matrix[groupName][categoryName][cc] || 0) + monto;
        });

        // Crear Libro
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`Global CC`);
        worksheet.views = [{ showGridLines: true }];

        const lastColLetter = getColLetter(3 + CC_count);

        // Titulo principal
        worksheet.mergeCells(`A1:${lastColLetter}1`);
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'COSTOS OPERATIVOS';
        titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        worksheet.getRow(1).height = 36;

        // Subtítulo
        let periodoStr = 'Todos los registros';
        if (fechaDesde && fechaHasta) {
            periodoStr = `Período: ${safeFormatDate(fechaDesde)} al ${safeFormatDate(fechaHasta)}`;
        } else {
            const dates = rowsGlobales.map(r => r.fecha).filter(Boolean).sort();
            if (dates.length > 0) {
                periodoStr = `Período: ${safeFormatDate(dates[0])} al ${safeFormatDate(dates[dates.length - 1])}`;
            }
        }

        worksheet.mergeCells(`A2:${lastColLetter}2`);
        const subCell = worksheet.getCell('A2');
        subCell.value = periodoStr.toUpperCase();
        subCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        subCell.alignment = { horizontal: 'center', vertical: 'middle' };
        subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        worksheet.getRow(2).height = 24;

        // Columnas
        const headers = [
            'COSTOS OPERATIVOS',
            'Total'
        ];
        uniqueCCs.forEach(cc => {
            headers.push(cc.split('(')[0].trim());
        });

        worksheet.getRow(3).values = headers;
        worksheet.getRow(3).height = 28;

        // Formato cabeceras
        for (let colIdx = 1; colIdx <= 2 + CC_count; colIdx++) {
            const cell = worksheet.getCell(3, colIdx);
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
            cell.alignment = { horizontal: colIdx === 1 ? 'left' : 'right', vertical: 'middle', wrapText: true };
            cell.border = {
                bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
                top: { style: 'medium', color: { argb: 'FF0F172A' } }
            };
        }

        // Definir anchos
        worksheet.getColumn(1).width = 38;
        worksheet.getColumn(2).width = 24;
        for (let i = 0; i < CC_count; i++) {
            worksheet.getColumn(3 + i).width = 22;
        }

        let currentIdx = 4;
        const groupHeaderRowsList = [];

        // Primero calcularemos la fila del total general para poder usarla en el porcentaje de cada fila
        let totalRowsCount = 3; // 3 filas de cabecera
        Object.keys(matrix).forEach(groupName => {
            totalRowsCount += 1; // Fila de cabecera del grupo
            totalRowsCount += Object.keys(matrix[groupName]).length; // Filas de categorías
        });
        const totalGeneralRowIdx = totalRowsCount + 1; // Fila final del TOTAL GENERAL

        // Recorrer grupos y categorías
        Object.keys(matrix).forEach(groupName => {
            const categories = Object.keys(matrix[groupName]);
            const numCategories = categories.length;
            if (numCategories === 0) return;

            const groupHeaderRowIdx = currentIdx;
            groupHeaderRowsList.push(groupHeaderRowIdx);

            // 1. Agregar Fila de Cabecera del Grupo
            const groupRow = worksheet.getRow(groupHeaderRowIdx);
            groupRow.getCell(1).value = groupName;
            
            // Fórmulas para las CC columns
            const lastCCColLetter = getColLetter(2 + CC_count);
            groupRow.getCell(2).value = { formula: `=SUM(C${groupHeaderRowIdx}:${lastCCColLetter}${groupHeaderRowIdx})` };
            
            for (let i = 0; i < CC_count; i++) {
                const colLetter = getColLetter(3 + i);
                groupRow.getCell(3 + i).value = { formula: `=SUM(${colLetter}${groupHeaderRowIdx + 1}:${colLetter}${groupHeaderRowIdx + numCategories})` };
            }

            // Estilo Fila Grupo
            groupRow.height = 22;
            for (let c = 1; c <= 2 + CC_count; c++) {
                const cell = groupRow.getCell(c);
                cell.font = { name: 'Calibri', size: 10, bold: true, italic: true, color: { argb: 'FF1E293B' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                cell.border = {
                    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    top: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                };
                if (c === 1) {
                    cell.alignment = { horizontal: 'left', vertical: 'middle' };
                } else {
                    cell.numFmt = '"$"#,##0.00;[Red]("$"#,##0.00);"-"';
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                }
            }

            currentIdx++;

            // 2. Agregar Categorías del Grupo
            categories.forEach(categoryName => {
                const catRowIdx = currentIdx;
                const catRow = worksheet.getRow(catRowIdx);
                catRow.getCell(1).value = `  ${categoryName}`; // indentación
                
                const lastCCColLetter = getColLetter(2 + CC_count);
                catRow.getCell(2).value = { formula: `=SUM(C${catRowIdx}:${lastCCColLetter}${catRowIdx})` };

                // Valores por Centro de Costo
                uniqueCCs.forEach((cc, i) => {
                    const value = matrix[groupName][categoryName][cc] || 0;
                    catRow.getCell(3 + i).value = value;
                });

                // Estilo Fila Categoría
                catRow.height = 20;
                for (let c = 1; c <= 2 + CC_count; c++) {
                    const cell = catRow.getCell(c);
                    cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF475569' } };
                    cell.border = {
                        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                    };
                    if (c === 1) {
                        cell.alignment = { horizontal: 'left', vertical: 'middle' };
                    } else {
                        cell.numFmt = '"$"#,##0.00;[Red]("$"#,##0.00);"-"';
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    }
                }

                currentIdx++;
            });
        });

        // 3. Fila de TOTALES POR CENTRO DE COSTO
        const totalGenRow = worksheet.getRow(totalGeneralRowIdx);
        totalGenRow.getCell(1).value = 'TOTALES POR CENTRO DE COSTO';
        
        // Sumar todos los grupos
        const lastCCColLetter = getColLetter(2 + CC_count);
        totalGenRow.getCell(2).value = { formula: `=SUM(C${totalGeneralRowIdx}:${lastCCColLetter}${totalGeneralRowIdx})` };

        for (let i = 0; i < CC_count; i++) {
            const colLetter = getColLetter(3 + i);
            totalGenRow.getCell(3 + i).value = { formula: `=${groupHeaderRowsList.map(idx => `${colLetter}${idx}`).join('+')}` };
        }

        // Estilo Fila TOTAL GENERAL
        totalGenRow.height = 24;
        for (let c = 1; c <= 2 + CC_count; c++) {
            const cell = totalGenRow.getCell(c);
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
            cell.border = {
                bottom: { style: 'double', color: { argb: 'FF0F172A' } },
                top: { style: 'thin', color: { argb: 'FF0F172A' } }
            };
            if (c === 1) {
                cell.alignment = { horizontal: 'left', vertical: 'middle' };
            } else {
                cell.numFmt = '"$"#,##0.00;[Red]("$"#,##0.00);"-"';
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
            }
        }

        try {
            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Resumen_Global_CC_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
            toast.success("Resumen global por CC exportado con éxito.");
        } catch (e) {
            console.error("Error al exportar resumen global:", e);
            toast.error("Ocurrió un error al generar el archivo Excel: " + e.message);
        }
    };

    const exportExcelBeneficiarios = async (rowsToExport, title = "Reporte_Beneficiarios") => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Beneficiarios');

        worksheet.views = [{ showGridLines: true }];

        worksheet.mergeCells('A1:I1');
        const headerCell = worksheet.getCell('A1');
        headerCell.value = title.replace(/_/g, ' ').toUpperCase();
        headerCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        headerCell.alignment = { horizontal: 'center', vertical: 'middle' };
        headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
        worksheet.getRow(1).height = 35;

        worksheet.mergeCells('A2:I2');
        const subCell = worksheet.getCell('A2');
        subCell.value = `Generado el: ${new Date().toLocaleString()}`;
        subCell.font = { name: 'Calibri', size: 9, italic: true };
        subCell.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(2).height = 18;

        const columns = [
            { header: 'N° REF / DOCUMENTO', key: 'ref', width: 22 },
            { header: 'TIPO', key: 'tipo', width: 18 },
            { header: 'FECHA REGISTRO', key: 'fecha', width: 16 },
            { header: 'BENEFICIARIO', key: 'beneficiario', width: 32 },
            { header: 'CEDULA / RIF', key: 'documento', width: 16 },
            { header: 'CENTRO COSTO / PROYECTO', key: 'cc', width: 25 },
            { header: 'CONCEPTO / DETALLE', key: 'concepto', width: 38 },
            { header: 'MONTO', key: 'monto', width: 16 },
            { header: 'ESTADO', key: 'estado', width: 15 }
        ];

        worksheet.getRow(4).values = columns.map(c => c.header);
        worksheet.getRow(4).height = 24;

        for (let col = 1; col <= 9; col++) {
            const cell = worksheet.getCell(4, col);
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin' },
                bottom: { style: 'medium' },
                left: { style: 'thin' },
                right: { style: 'thin' }
            };
        }

        rowsToExport.forEach((r, idx) => {
            const rowIdx = 5 + idx;
            worksheet.addRow({
                ref: r.ref,
                tipo: r.tipo,
                fecha: r.fecha,
                beneficiario: r.beneficiario,
                documento: r.documento,
                cc: r.centroCosto,
                concepto: r.concepto,
                monto: r.monto,
                estado: r.estado
            });

            worksheet.getRow(rowIdx).height = 20;

            worksheet.getCell(`A${rowIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };
            worksheet.getCell(`A${rowIdx}`).font = { name: 'Calibri', size: 10, bold: true };
            worksheet.getCell(`B${rowIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };
            worksheet.getCell(`C${rowIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };
            worksheet.getCell(`D${rowIdx}`).alignment = { horizontal: 'left', vertical: 'middle' };
            worksheet.getCell(`E${rowIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };
            worksheet.getCell(`F${rowIdx}`).alignment = { horizontal: 'left', vertical: 'middle' };
            worksheet.getCell(`G${rowIdx}`).alignment = { horizontal: 'left', vertical: 'middle' };

            const cellMonto = worksheet.getCell(`H${rowIdx}`);
            cellMonto.value = Number(r.monto) || 0;
            cellMonto.numFmt = r.moneda === 'Bs' ? '"Bs."#,##0.00' : '"$"#,##0.00';
            cellMonto.alignment = { horizontal: 'right', vertical: 'middle' };
            cellMonto.font = { name: 'Calibri', size: 10, bold: true };

            worksheet.getCell(`I${rowIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };

            for (let col = 1; col <= 9; col++) {
                worksheet.getCell(rowIdx, col).border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
            }
        });

        columns.forEach((col, i) => { worksheet.getColumn(i + 1).width = col.width; });

        try {
            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `${title}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
            toast.success("Excel de beneficiarios exportado con éxito.");
        } catch (err) {
            console.error("Error al exportar beneficiarios a excel:", err);
            toast.error("Ocurrió un error al generar el archivo Excel: " + err.message);
        }
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

        autoTable(doc, {
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
                    {activeTab === 'costos' && (
                        <>
                            <button className="rm-btn rm-btn-outline" onClick={exportExcelMatricial}><FileSpreadsheet size={18} /> EXCEL POR CC</button>
                            <button className="rm-btn rm-btn-outline" onClick={exportExcelResumenCC}><FileSpreadsheet size={18} /> EXCEL GLOBAL CC</button>
                            <button className="rm-btn rm-btn-outline" onClick={exportExcel}><FileSpreadsheet size={18} /> EXCEL</button>
                            <button className="rm-btn rm-btn-outline" onClick={exportExcelByProject}><FileSpreadsheet size={18} /> EXCEL POR PROYECTO</button>
                            <button className="rm-btn rm-btn-outline" style={{ border: '1.5px solid #10b981', color: '#10b981' }} onClick={exportExcelFlujo}><FileSpreadsheet size={18} /> REPORTE FLUJO</button>
                        </>
                    )}
                    {activeTab === 'beneficiarios' && (
                        <button className="rm-btn rm-btn-outline" onClick={() => exportExcelBeneficiarios(beneficiariosFiltrados, "Consulta_Beneficiarios")}><FileSpreadsheet size={18} /> EXPORTAR EXCEL</button>
                    )}
                    {activeTab !== 'costos' && activeTab !== 'beneficiarios' && (
                        <>
                            <button className="rm-btn rm-btn-outline" onClick={exportExcel}><FileSpreadsheet size={18} /> EXCEL</button>
                            <button className="rm-btn rm-btn-outline" onClick={exportExcelByProject}><FileSpreadsheet size={18} /> EXCEL POR PROYECTO</button>
                        </>
                    )}
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
                {activeTab === 'beneficiarios' ? (
                    <div className="rm-filter-grid-layout main-filters" style={{ gridTemplateColumns: '2fr 1fr 1.5fr auto' }}>
                        <div className="filter-item-premium">
                            <label className="filter-label-premium">Búsqueda Libre</label>
                            <div className="search-input-wrapper">
                                <input
                                    type="text"
                                    placeholder="Nombre Beneficiario, Cédula / RIF, N° Requisición..."
                                    value={busquedaBenef}
                                    onChange={e => setBusquedaBenef(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="filter-item-premium">
                            <label className="filter-label-premium">Centro de Costo</label>
                            <select value={ccBenef} onChange={e => setCcBenef(e.target.value)}>
                                <option value="Todos">Todos los Centros</option>
                                {listaCentrosCostos.map(cc => <option key={cc.id} value={cc.nombre}>{cc.nombre}</option>)}
                            </select>
                        </div>

                        <div className="filter-item-premium">
                            <label className="filter-label-premium">Rango de Fechas</label>
                            <div className="date-input-group">
                                <input type="date" value={fechaInicioBenef} onChange={e => setFechaInicioBenef(e.target.value)} />
                                <input type="date" value={fechaFinBenef} onChange={e => setFechaFinBenef(e.target.value)} />
                            </div>
                        </div>

                        <div className="filter-item-premium" style={{ alignSelf: 'flex-end' }}>
                            <button
                                className="rm-btn rm-btn-outline"
                                style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                                onClick={() => {
                                    setBusquedaBenef('');
                                    setCcBenef('Todos');
                                    setFechaInicioBenef('');
                                    setFechaFinBenef('');
                                }}
                            >
                                Limpiar Filtros
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
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
                                                ...(data.requisiciones || []).flatMap(r => (r.items || []).map(it => it.categoria || it.cat)),
                                                ...(data.tickets || []).flatMap(t => (t.items || []).map(it => it.categoria || it.cat))
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
                    </>
                )}
            </div>

            <div className="rm-tabs">
                <button className={`rm-tab ${activeTab === 'costos' ? 'active' : ''}`} onClick={() => setActiveTab('costos')}>RELACIÓN DE GASTOS</button>
                <button className={`rm-tab ${activeTab === 'beneficiarios' ? 'active' : ''}`} onClick={() => setActiveTab('beneficiarios')}>CONSULTA DE BENEFICIARIOS</button>
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
                                {Array.from(new Set((data.requisiciones || []).flatMap(r => (r.items || []).map(it => it.categoria)).filter(Boolean))).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            <select value={filtroCC_Tab} onChange={e => setFiltroCC_Tab(e.target.value)}>
                                <option value="Todos">Proyecto/CC (Todos)</option>
                                {Array.from(new Set((data.requisiciones || []).map(r => r.centro_costo).filter(Boolean))).map(cc => <option key={cc} value={cc}>{cc}</option>)}
                            </select>
                            <select value={filtroSolicitante} onChange={e => setFiltroSolicitante(e.target.value)}>
                                <option value="Todos">Solicitante (Todos)</option>
                                {Array.from(new Set((data.requisiciones || []).map(r => r.solicitante).filter(Boolean))).map(s => <option key={s} value={s}>{s}</option>)}
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
                                {Array.from(new Set((data.tickets || []).map(t => t.clasificacion_admin).filter(Boolean))).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            <select value={filtroCC_Tab} onChange={e => setFiltroCC_Tab(e.target.value)}>
                                <option value="Todos">Proyecto/CC (Todos)</option>
                                {Array.from(new Set((data.tickets || []).map(t => t.centro_costo).filter(Boolean))).map(cc => <option key={cc} value={cc}>{cc}</option>)}
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

                        {activeTab === 'beneficiarios' && (
                            <motion.div key="beneficiarios" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rm-view-wrapper">
                                <div className="rm-table-card">
                                    <table className="rm-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '160px' }}>REF / CORRELATIVO</th>
                                                <th style={{ width: '150px' }}>TIPO</th>
                                                <th style={{ width: '130px' }}>FECHA</th>
                                                <th>BENEFICIARIO</th>
                                                <th style={{ width: '140px' }}>CÉDULA / RIF</th>
                                                <th>CENTRO DE COSTO</th>
                                                <th>CONCEPTO / DETALLE</th>
                                                <th style={{ textAlign: 'right', width: '150px' }}>MONTO</th>
                                                <th style={{ textAlign: 'center', width: '130px' }}>ESTADO</th>
                                                <th style={{ textAlign: 'center', width: '110px' }}>ACCIONES</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {beneficiariosFiltrados.map((row) => (
                                                <tr key={row.key}>
                                                    <td>
                                                        <span 
                                                            className="rm-table-link"
                                                            style={{ cursor: 'pointer', fontWeight: 'bold', color: '#1e40af', textDecoration: 'underline' }}
                                                            onClick={() => {
                                                                if (row.tipo === 'Requisición') handleOpenRequisicion(row.ref, `REQ-${row.id}`);
                                                                else if (row.tipo === 'Ticket Directo') handleOpenTicket(row.ref, `TK-${row.id}`);
                                                                else toast.info(`Solicitud de Fondo: ${row.ref}`);
                                                            }}
                                                        >
                                                            {row.ref}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span style={{ fontSize: '0.8rem', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', backgroundColor: row.tipo === 'Requisición' ? '#e0f2fe' : (row.tipo === 'Solicitud de Fondo' ? '#fef3c7' : '#f3e8ff'), color: row.tipo === 'Requisición' ? '#0369a1' : (row.tipo === 'Solicitud de Fondo' ? '#b45309' : '#6b21a8') }}>
                                                            {row.tipo}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontSize: '0.85rem' }}>{safeFormatDate(row.fecha)}</td>
                                                    <td>
                                                        <span 
                                                            style={{ cursor: 'pointer', fontWeight: '700', color: '#0f172a', textDecoration: 'underline', textUnderlineOffset: '3px' }}
                                                            onClick={() => setBeneficiarioSeleccionado(row.beneficiario)}
                                                            title="Ver historial completo acumulado de este beneficiario"
                                                        >
                                                            {row.beneficiario}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>
                                                            {row.documento}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span style={{ fontSize: '0.85rem', color: '#334155' }}>
                                                            {row.centroCosto}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontSize: '0.85rem', color: '#475569' }}>
                                                        {row.concepto}
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: '800', fontSize: '0.9rem', color: row.moneda === 'Bs' ? '#4f46e5' : '#059669' }}>
                                                        {row.moneda === 'Bs' ? `Bs. ${row.monto.toLocaleString('de-DE', { minimumFractionDigits: 2 })}` : `$ ${row.monto.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`}
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <span className={`rm-badge-status ${String(row.estado).toLowerCase().replace(/\s+/g, '_')}`}>
                                                            {row.estado}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <button
                                                            className="rm-btn rm-btn-outline"
                                                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                                            onClick={() => setBeneficiarioSeleccionado(row.beneficiario)}
                                                            title="Histórico del Beneficiario"
                                                        >
                                                            <User size={14} /> Auditar
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {beneficiariosFiltrados.length === 0 && (
                                        <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                                            No se encontraron beneficiarios con los criterios seleccionados.
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
                                                    <td>{it.cant} {it.uni || it.unidad || ''}</td>
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
                                                                <div className="rm-min-card"><strong>Monto Total:</strong> $ {(Number(ticket.total_usd) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</div>
                                                                <div className="rm-min-card"><strong>Prioridad:</strong> <span style={{ color: (ticket.prioridad || 'Normal').toLowerCase() === 'emergencia' ? '#ef4444' : '#0ea5e9', fontWeight: 'bold' }}>{(ticket.prioridad || 'Normal').toUpperCase()}</span></div>
                                                                <div className="rm-min-card"><strong>Centro de Costo:</strong> {ticket.centro_costo || 'N/A'}</div>
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
                                                                            fileInfo = { iconColor: '#10b981', label: 'Hoja de Cálculo Excel', desc: 'Este archivo de Excel no se puede previsualizar directamente en el navegador.' };
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
                                                                                        backgroundColor: '#2563eb',
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

            {/* MODAL / OVERLAY VISTA INVERSA (HISTORIAL DE BENEFICIARIO SELECCIONADO) */}
            <AnimatePresence>
                {beneficiarioSeleccionado && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                        onClick={() => setBeneficiarioSeleccionado(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '1100px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header Modal */}
                            <div style={{ padding: '20px 24px', backgroundColor: '#1e3a8a', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <User size={24} color="#93c5fd" />
                                        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800' }}>{beneficiarioSeleccionado}</h2>
                                    </div>
                                    <p style={{ margin: '4px 0 0 34px', fontSize: '0.85rem', color: '#bfdbfe' }}>
                                        Cédula / RIF: <strong style={{ fontFamily: 'monospace' }}>{kpisBenefSeleccionado.docId}</strong> | Histórico acumulado de transacciones
                                    </p>
                                </div>
                                <button
                                    onClick={() => setBeneficiarioSeleccionado(null)}
                                    style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* KPIs Modal */}
                            <div style={{ padding: '16px 24px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                <div style={{ backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Operaciones Registradas</span>
                                    <h3 style={{ margin: '4px 0 0 0', fontSize: '1.4rem', fontWeight: '900', color: '#0f172a' }}>{transaccionesBenefSeleccionado.length}</h3>
                                </div>
                                <div style={{ backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#059669', textTransform: 'uppercase' }}>Total Acumulado ($)</span>
                                    <h3 style={{ margin: '4px 0 0 0', fontSize: '1.4rem', fontWeight: '900', color: '#059669' }}>$ {kpisBenefSeleccionado.totalUSD.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</h3>
                                </div>
                                <div style={{ backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#4f46e5', textTransform: 'uppercase' }}>Total Acumulado (Bs)</span>
                                    <h3 style={{ margin: '4px 0 0 0', fontSize: '1.4rem', fontWeight: '900', color: '#4f46e5' }}>Bs. {kpisBenefSeleccionado.totalBs.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</h3>
                                </div>
                            </div>

                            {/* Actions Bar */}
                            <div style={{ padding: '12px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button
                                    className="rm-btn rm-btn-outline"
                                    style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                                    onClick={() => exportExcelBeneficiarios(transaccionesBenefSeleccionado, `Historial_${beneficiarioSeleccionado.replace(/\s+/g, '_')}`)}
                                >
                                    <FileSpreadsheet size={16} /> EXPORTAR HISTORIAL A EXCEL
                                </button>
                            </div>

                            {/* Table Modal */}
                            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                                <table className="rm-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '160px' }}>N° REF</th>
                                            <th style={{ width: '140px' }}>TIPO</th>
                                            <th style={{ width: '130px' }}>FECHA</th>
                                            <th>CENTRO DE COSTO</th>
                                            <th>CONCEPTO / DESCRIPCIÓN</th>
                                            <th style={{ textAlign: 'right', width: '140px' }}>MONTO</th>
                                            <th style={{ textAlign: 'center', width: '120px' }}>ESTADO</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transaccionesBenefSeleccionado.map((t) => (
                                            <tr key={t.key}>
                                                <td>
                                                    <span 
                                                        className="rm-table-link"
                                                        style={{ cursor: 'pointer', fontWeight: 'bold', color: '#1e40af' }}
                                                        onClick={() => {
                                                            setBeneficiarioSeleccionado(null);
                                                            if (t.tipo === 'Requisición') handleOpenRequisicion(t.ref, `REQ-${t.id}`);
                                                            else if (t.tipo === 'Ticket Directo') handleOpenTicket(t.ref, `TK-${t.id}`);
                                                            else toast.info(`Solicitud de Fondo: ${t.ref}`);
                                                        }}
                                                    >
                                                        {t.ref}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569' }}>
                                                        {t.tipo}
                                                    </span>
                                                </td>
                                                <td>{safeFormatDate(t.fecha)}</td>
                                                <td>{t.centroCosto}</td>
                                                <td>{t.concepto}</td>
                                                <td style={{ textAlign: 'right', fontWeight: '800', color: t.moneda === 'Bs' ? '#4f46e5' : '#059669' }}>
                                                    {t.moneda === 'Bs' ? `Bs. ${t.monto.toLocaleString('de-DE', { minimumFractionDigits: 2 })}` : `$ ${t.monto.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span className={`rm-badge-status ${String(t.estado).toLowerCase().replace(/\s+/g, '_')}`}>
                                                        {t.estado}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ReportesMaestro;

