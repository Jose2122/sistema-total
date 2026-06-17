import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { motion } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, ComposedChart, Legend
} from 'recharts';
import {
    TrendingUp, TrendingDown, Clock, ShieldCheck, AlertTriangle,
    Zap, Target, Calendar, BarChart3, Filter, Download, DollarSign,
    CheckCircle2, AlertCircle, ChevronDown, Briefcase, Users, FileText
} from 'lucide-react';
import { format, getWeek, parseISO as dateFnsParseISO } from 'date-fns';

const parseISO = (dateStr) => {
    if (!dateStr) return new Date();
    try {
        return dateFnsParseISO(dateStr);
    } catch (e) {
        return new Date();
    }
};

const getWeeksForMonth = (monthVal, year = 2026) => {
    const weeksMap = new Map();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    
    let current = new Date(start);
    while (current <= end) {
        const m = current.getMonth(); // 0-indexed
        const w = getWeek(current);
        
        if (!weeksMap.has(w)) {
            weeksMap.set(w, {
                weekNum: w,
                minDate: new Date(current),
                maxDate: new Date(current),
                months: new Set()
            });
        }
        
        const wObj = weeksMap.get(w);
        wObj.months.add(m);
        if (current < wObj.minDate) wObj.minDate = new Date(current);
        if (current > wObj.maxDate) wObj.maxDate = new Date(current);
        
        current.setDate(current.getDate() + 1);
    }
    
    const weeksList = Array.from(weeksMap.values()).map(wObj => {
        const dStartStr = format(wObj.minDate, 'dd/MM');
        const dEndStr = format(wObj.maxDate, 'dd/MM');
        return {
            weekNum: wObj.weekNum.toString(),
            label: `Semana ${wObj.weekNum} (${dStartStr} - ${dEndStr})`,
            months: Array.from(wObj.months)
        };
    });
    
    if (!monthVal || monthVal === 'Todos') {
        return weeksList;
    } else {
        const targetMonth = parseInt(monthVal, 10);
        return weeksList.filter(w => w.months.includes(targetMonth));
    }
};

const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

const COLORS_PARETO = ['#1e3a8a', '#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];
const COLORS_STATUS = {
    'aprobado_final': '#10b981',
    'anulada': '#ef4444',
    'en_espera': '#f59e0b',
    'rechazada': '#991b1b'
};

const ResumenEjecutivo = ({ currentUser }) => {
    const [loading, setLoading] = useState(true);
    const [rawReqs, setRawReqs] = useState([]);
    const [rawFunds, setRawFunds] = useState([]);
    const [rawPartidas, setRawPartidas] = useState([]);
    const [rawTickets, setRawTickets] = useState([]);
    const [filtroGerenciaCC, setFiltroGerenciaCC] = useState('Todas');
    const [filtroGerenciaGlobal, setFiltroGerenciaGlobal] = useState('Todas');
    const [filtroMes, setFiltroMes] = useState(new Date().getMonth().toString());
    const [filtroSemana, setFiltroSemana] = useState('Todas');
    const [activeTab, setActiveTab] = useState('financiero'); // 'financiero' | 'operativo'

    // --- RESTRICCIÓN DE GERENTES ---
    const userDept = currentUser?.departamento || '';
    const userRole = currentUser?.rol || '';
    const esPerlaDelgado = currentUser?.esPerlaDelgado || 
        ((currentUser?.nombre || '').trim().toLowerCase() === 'perla' && 
         (currentUser?.apellido || '').trim().toLowerCase() === 'delgado');

    const esAdminGlobal = currentUser?.correo === 'jcontreras.totalclean@gmail.com' ||
        currentUser?.correo === 'cvega.totalclean@gmail.com' ||
        currentUser?.esAdminReal ||
        userRole === 'Admin' ||
        userRole === 'Gerente General' ||
        esPerlaDelgado;
    const restrictToDept = !esAdminGlobal;
    const userDeptoName = userDept.trim();

    // Datasets restringidos o globales según rol/capacidades
    const myReqs = useMemo(() => {
        const canViewGlobalReqs = esAdminGlobal || currentUser?.capacidades?.ver_requisiciones_global === true;
        if (canViewGlobalReqs || !userDeptoName) return rawReqs;
        return rawReqs.filter(r => (r.gerencia || '').toLowerCase().includes(userDeptoName.toLowerCase()));
    }, [rawReqs, esAdminGlobal, currentUser, userDeptoName]);

    const myFunds = useMemo(() => {
        const canViewGlobalFunds = esAdminGlobal || currentUser?.capacidades?.ver_solicitudes_global === true;
        if (canViewGlobalFunds || !userDeptoName) return rawFunds;
        return rawFunds.filter(s => (s.gerencia_nombre || '').toLowerCase().includes(userDeptoName.toLowerCase()));
    }, [rawFunds, esAdminGlobal, currentUser, userDeptoName]);

    const myTickets = useMemo(() => {
        const canViewGlobalTickets = esAdminGlobal || currentUser?.capacidades?.ver_tickets_global === true;
        if (canViewGlobalTickets || !userDeptoName) return rawTickets;
        return rawTickets.filter(t => (t.departamento || '').toLowerCase().includes(userDeptoName.toLowerCase()));
    }, [rawTickets, esAdminGlobal, currentUser, userDeptoName]);

    const gerenciasDisponibles = useMemo(() => {
        const setGerencias = new Set();
        myReqs.forEach(r => { if (r.gerencia) setGerencias.add(r.gerencia); });
        myFunds.forEach(s => { if (s.gerencia_nombre) setGerencias.add(s.gerencia_nombre); });
        myTickets.forEach(t => { if (t.departamento) setGerencias.add(t.departamento); });
        return Array.from(setGerencias).sort();
    }, [myReqs, myFunds, myTickets]);

    const availableWeeks = useMemo(() => {
        return getWeeksForMonth(filtroMes, 2026);
    }, [filtroMes]);

    const handleMonthChange = (newMonth) => {
        setFiltroMes(newMonth);
        if (filtroSemana !== 'Todas') {
            const validWeeks = getWeeksForMonth(newMonth, 2026);
            const isValid = validWeeks.some(w => w.weekNum === filtroSemana);
            if (!isValid) {
                setFiltroSemana('Todas');
            }
        }
    };

    const fetchData = useCallback(async () => {
        try {
            const [resReq, resFund, resPart, resTicket] = await Promise.all([
                supabase.from('requisiciones').select('*'),
                supabase.from('solicitudes_fondos').select('*'),
                supabase.from('partidas_fondos').select('*'),
                supabase.from('tickets_directos').select('*')
            ]);
            
            setRawReqs(resReq.data || []);
            setRawFunds(resFund.data || []);
            setRawPartidas(resPart.data || []);
            setRawTickets(resTicket.data || []);
        } catch (err) {
            console.error("Error cargando datos ejecutivos:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        setLoading(true);
        fetchData();

        // Suscribirse a cambios en tiempo real en las cuatro tablas
        const channel = supabase
            .channel('resumen_ejecutivo_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'requisiciones' }, () => {
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_fondos' }, () => {
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'partidas_fondos' }, () => {
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets_directos' }, () => {
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchData]);

    const getWeekNumber = (date) => {
        if (!date) return 0;
        return getWeek(typeof date === 'string' ? parseISO(date) : date);
    };

    // --- MOTOR ANALÍTICO FINANCIERO CONSOLIDADO ---
    const stats = useMemo(() => {
        if (!myReqs || !myReqs.length) return {
            gastoActual: 0,
            gastoConsolidadoReal: 0,
            totalTicketsGlobal: 0,
            ahorroTotal: 0,
            solicitudesAnalisis: [],
            funnel: { proyecto: 0, area: 0, general: 0, compras: 0, completado: 0 },
            stagnantCount: 0,
            topCC: [],
            recentApprovals: [],
            slaFunnelData: [],
            topDelayed: [],
            healthScore: 0,
            avgLeadTime: 0,
            emergencyRatio: 0,
            plannedRatio: 0,
            totalEstimadoGlobal: 0,
            topCategoriesGlobal: [],
            topStagnantGerencias: [],
            delayTrend: [],
            paretoChartData: [],
            heatmap: [],
            stagnant: [],
            reqsCount: 0,
            ticketsCount: 0,
            emergenciesCount: 0,
            approvedReqsCount: 0,
            approvedTicketsCount: 0,
            pendingTicketsCount: 0,
            drilldownData: () => ({ cc: [], mat: [] })
        };

        const meses_n = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

        // --- FILTRADO DE DATOS CON ALINEACIÓN TEMPORAL ---
        const filteredFunds = myFunds.filter(s => {
            const fechaStr = s.fecha_operativa || s.created_at;
            if (!fechaStr) return false;
            const date = parseISO(fechaStr);
            const mMatch = filtroMes === 'Todos' || date.getMonth().toString() === filtroMes;
            const wMatch = filtroSemana === 'Todas' || getWeek(date).toString() === filtroSemana;
            const gMatch = filtroGerenciaGlobal === 'Todas' || s.gerencia_nombre === filtroGerenciaGlobal;
            return mMatch && wMatch && gMatch;
        });

        const filteredReqs = myReqs.filter(r => {
            const fechaStr = r.created_at || r.fecha_emision;
            if (!fechaStr) return false;
            const date = parseISO(fechaStr);
            const mMatch = filtroMes === 'Todos' || date.getMonth().toString() === filtroMes;
            const wMatch = filtroSemana === 'Todas' || getWeek(date).toString() === filtroSemana;
            const gMatch = filtroGerenciaGlobal === 'Todas' || r.gerencia === filtroGerenciaGlobal;
            return mMatch && wMatch && gMatch;
        });

        const filteredTickets = myTickets.filter(t => {
            const fechaStr = t.fecha_emision || t.fecha || t.created_at;
            if (!fechaStr) return false;
            const date = parseISO(fechaStr);
            const mMatch = filtroMes === 'Todos' || date.getMonth().toString() === filtroMes;
            const wMatch = filtroSemana === 'Todas' || getWeek(date).toString() === filtroSemana;
            const gMatch = filtroGerenciaGlobal === 'Todas' || t.departamento === filtroGerenciaGlobal;
            return mMatch && wMatch && gMatch && (t.status || '').toLowerCase() !== 'rechazado';
        });

        // Helper seguro para calcular el monto real de un ticket (prioriza total_usd y monto de cabecera)
        const getTicketTotal = (t) => {
            if (Number(t.total_usd) > 0) return Number(t.total_usd);
            if (Number(t.monto) > 0) return Number(t.monto);
            const items = Array.isArray(t.items) ? t.items : [];
            if (items.length > 0) {
                return items.reduce((sum, item) => sum + (Number(item.total) || (Number(item.cant || 1) * Number(item.puUsd || item.puBs || item.pu || 0))), 0);
            }
            return 0;
        };

        // --- AGREGACIÓN CONSOLIDADA POR GERENCIA ---
        const aggregated = {};

        // 1. Incorporar Planificación y Fondos (Budget)
        filteredFunds.forEach(s => {
            const gName = s.gerencia_nombre || 'S/G';
            if (!aggregated[gName]) {
                aggregated[gName] = { name: gName, estimado: 0, gastado: 0, count: 0, topCategories: {}, reqCount: 0, ticketCount: 0, gastoReqs: 0, gastoTickets: 0 };
            }

            const estimado = (Number(s.total_usd) || 0) + (Number(s.total_bs) || 0);
            aggregated[gName].estimado += estimado;
            aggregated[gName].count += 1;
        });

        // 2. Incorporar Requisiciones en el Gasto Real (Spend)
        filteredReqs.forEach(r => {
            const gName = r.gerencia || 'S/G';
            if (!aggregated[gName]) {
                aggregated[gName] = { name: gName, estimado: 0, gastado: 0, count: 0, topCategories: {}, reqCount: 0, ticketCount: 0, gastoReqs: 0, gastoTickets: 0 };
            }

            const items = Array.isArray(r.items) ? r.items : [];
            const ejec = Number(r.total_ejecutado) || items.reduce((s, i) => {
                const h = Array.isArray(i.historial_compras) ? i.historial_compras : [];
                return s + h.reduce((acc, comp) => acc + ((Number(comp.cant) || 0) * (Number(comp.pu) || 0)), 0);
            }, 0) * (r.con_iva !== false ? 1.16 : 1.00);

            aggregated[gName].gastado += ejec;
            aggregated[gName].gastoReqs += ejec;
            aggregated[gName].reqCount += 1;
            aggregated[gName].count += 1;

            items.forEach(i => {
                const cat = i.categoria || 'S/C';
                const h = Array.isArray(i.historial_compras) ? i.historial_compras : [];
                const m_it = h.reduce((acc, comp) => acc + (Number(comp.cant) * (Number(comp.pu) || 0)), 0);
                aggregated[gName].topCategories[cat] = (aggregated[gName].topCategories[cat] || 0) + m_it;
            });
        });

        // 3. Incorporar Tickets Directos en el Gasto Real (Gasto sin orden previa)
        filteredTickets.forEach(t => {
            const gName = t.departamento || 'No asignada';
            if (!aggregated[gName]) {
                aggregated[gName] = { name: gName, estimado: 0, gastado: 0, count: 0, topCategories: {}, reqCount: 0, ticketCount: 0, gastoReqs: 0, gastoTickets: 0 };
            }

            const ticketTotal = getTicketTotal(t);
            aggregated[gName].gastado += ticketTotal;
            aggregated[gName].gastoTickets += ticketTotal;
            aggregated[gName].ticketCount += 1;
            aggregated[gName].count += 1;

            // Desglosar ítems de tickets en las categorías del departamento
            const items = Array.isArray(t.items) ? t.items : [];
            items.forEach(item => {
                const cat = item.cat || item.categoria || 'S/C';
                const totalItem = Number(item.total) || (Number(item.cant || 1) * Number(item.pu || 0));
                aggregated[gName].topCategories[cat] = (aggregated[gName].topCategories[cat] || 0) + totalItem;
            });
        });

        const solicitudesAnalisis = Object.values(aggregated).map(item => {
            const est = Number(item.estimado) || 0;
            const gas = Number(item.gastado) || 0;
            const gr = Number(item.gastoReqs) || 0;
            const gt = Number(item.gastoTickets) || 0;
            return {
                ...item,
                estimado: est,
                gastado: gas,
                gastoReqs: gr,
                gastoTickets: gt,
                porcentaje: est > 0 ? Math.round((gas / est) * 100) : 0,
                topCategories: Object.entries(item.topCategories)
                    .map(([name, total]) => ({ name, total: Number(total) || 0 }))
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 3)
            };
        }).sort((a, b) => b.estimado - a.estimado);

        // --- TRAZABILIDAD Y SLA ---
        const funnel = { proyecto: 0, area: 0, general: 0, compras: 0, completado: 0 };
        const stagnant = [];
        const byCC = {};
        let totalEjecutadoGlobal = 0;

        filteredReqs.forEach(r => {
            const status = (r.estado_aprobacion || '').toLowerCase();
            if (status.includes('proyecto')) funnel.proyecto++;
            else if (status.includes('area')) funnel.area++;
            else if (status.includes('general')) funnel.general++;
            if (status === 'aprobado_final' || status === 'aprobado_compras') {
                const sComp = (r.status_compra || '').toLowerCase();
                if (sComp === 'entregado' || sComp === 'facturado' || sComp === 'completado') funnel.completado++;
                else funnel.compras++;
            }

            if (status !== 'aprobado_final' && status !== 'rechazada' && status !== 'anulada') {
                const created = parseISO(r.created_at || r.fecha_emision);
                const diffDays = Math.floor((new Date() - created) / (1000 * 60 * 60 * 24));
                if (diffDays > 5) stagnant.push(r);
            }

            const cc = r.centro_costo?.split('(')[0]?.trim() || 'S/CC';
            if (!byCC[cc]) byCC[cc] = 0;
            const items = Array.isArray(r.items) ? r.items : [];
            const ejec = Number(r.total_ejecutado) || items.reduce((s, i) => {
                const h = Array.isArray(i.historial_compras) ? i.historial_compras : [];
                return s + h.reduce((acc, comp) => acc + ((Number(comp.cant) || 0) * (Number(comp.pu) || 0)), 0);
            }, 0) * (r.con_iva !== false ? 1.16 : 1.00);
            
            byCC[cc] += ejec;
            totalEjecutadoGlobal += ejec;
        });

        // Sumar e integrar los Tickets de Pago en el análisis por centro de costo
        let totalTicketsGlobal = 0;
        filteredTickets.forEach(t => {
            const ticketTotal = getTicketTotal(t);
            totalTicketsGlobal += ticketTotal;

            const items = Array.isArray(t.items) ? t.items : [];
            items.forEach(item => {
                const cc = item.cc || t.centro_costo?.split('(')[0]?.trim() || 'S/CC';
                const totalItem = Number(item.total) || (Number(item.cant || 1) * Number(item.pu || 0));
                if (!byCC[cc]) byCC[cc] = 0;
                byCC[cc] += totalItem;
            });

            if (items.length === 0) {
                const cc = t.centro_costo?.split('(')[0]?.trim() || 'S/CC';
                if (!byCC[cc]) byCC[cc] = 0;
                byCC[cc] += ticketTotal;
            }
        });

        // Alinear totalEstimadoGlobal con la suma de la planificación en filteredFunds
        const totalEstimadoGlobal = filteredFunds.reduce((sum, s) => sum + (Number(s.total_usd) || 0) + (Number(s.total_bs) || 0), 0);

        const gastoConsolidadoReal = totalEjecutadoGlobal + totalTicketsGlobal;

        const recentApprovals = filteredReqs
            .filter(r => r.f_aprobacion_general)
            .sort((a, b) => new Date(b.f_aprobacion_general) - new Date(a.f_aprobacion_general))
            .slice(0, 4)
            .map(r => ({
                id: r.id,
                correlativo: r.correlativo_req || `REQ-${r.id}`,
                usuario: r.n_aprobacion_general || 'Sistema',
                fecha: r.f_aprobacion_general
            }));

        const slaStats = { proyecto: [], area: [], general: [], compras: [] };
        filteredReqs.forEach(r => {
            const created = parseISO(r.created_at || r.fecha_emision);
            if (r.f_aprobacion_proyecto) slaStats.proyecto.push(Math.max(0, (parseISO(r.f_aprobacion_proyecto) - created) / (1000 * 60 * 60 * 24)));
            if (r.f_aprobacion_area && r.f_aprobacion_proyecto) slaStats.area.push(Math.max(0, (parseISO(r.f_aprobacion_area) - parseISO(r.f_aprobacion_proyecto)) / (1000 * 60 * 60 * 24)));
            if (r.f_aprobacion_general && r.f_aprobacion_area) slaStats.general.push(Math.max(0, (parseISO(r.f_aprobacion_general) - parseISO(r.f_aprobacion_area)) / (1000 * 60 * 60 * 24)));
            if (r.f_inicio_compras && r.f_aprobacion_general) slaStats.compras.push(Math.max(0, (parseISO(r.f_inicio_compras) - parseISO(r.f_aprobacion_general)) / (1000 * 60 * 60 * 24)));
        });

        const avg_f = (arr) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : 0;
        const slaFunnelData = [
            { name: 'PROYECTO', valor: Number(avg_f(slaStats.proyecto)), fill: '#0ea5e9' },
            { name: 'ÁREA', valor: Number(avg_f(slaStats.area)), fill: '#6366f1' },
            { name: 'GENERAL', valor: Number(avg_f(slaStats.general)), fill: '#8b5cf6' },
            { name: 'COMPRAS', valor: Number(avg_f(slaStats.compras)), fill: '#f59e0b' }
        ];

        // --- COMPILACIÓN DE CATEGORÍAS GLOBALES ---
        const globalCategories = {};
        filteredReqs.forEach(r => {
            const items = Array.isArray(r.items) ? r.items : [];
            items.forEach(i => {
                const cat = i.categoria || 'S/C';
                const h = Array.isArray(i.historial_compras) ? i.historial_compras : [];
                const m_it = h.reduce((acc, comp) => acc + (Number(comp.cant) * (Number(comp.pu) || 0)), 0);
                globalCategories[cat] = (globalCategories[cat] || 0) + m_it;
            });
        });

        filteredTickets.forEach(t => {
            const items = Array.isArray(t.items) ? t.items : [];
            items.forEach(item => {
                const cat = item.cat || item.categoria || 'S/C';
                const totalItem = Number(item.total) || (Number(item.cant || 1) * Number(item.pu || 0));
                globalCategories[cat] = (globalCategories[cat] || 0) + totalItem;
            });
        });

        const topCategoriesGlobal = Object.entries(globalCategories)
            .map(([name, total]) => ({ name, total: Number(total) || 0 }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        const stagnantByGerencia = {};
        stagnant.forEach(r => {
            const ger = r.gerencia || 'S/G';
            stagnantByGerencia[ger] = (stagnantByGerencia[ger] || 0) + 1;
        });
        const topStagnantGerencias = Object.entries(stagnantByGerencia)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return {
            gastoActual: totalEjecutadoGlobal,
            gastoConsolidadoReal,
            totalTicketsGlobal,
            ahorroTotal: totalEstimadoGlobal - totalEjecutadoGlobal,
            solicitudesAnalisis,
            funnel,
            stagnantCount: stagnant.length,
            topCC: Object.entries(byCC).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 5),
            recentApprovals,
            slaFunnelData,
            emergencyRatio: Math.round((filteredReqs.filter(r => (r.prioridad || '').toLowerCase() === 'emergencia').length / (filteredReqs.length || 1)) * 100),
            plannedRatio: 100 - Math.round((filteredReqs.filter(r => (r.prioridad || '').toLowerCase() === 'emergencia').length / (filteredReqs.length || 1)) * 100),
            avgLeadTime: avg_f([...slaStats.proyecto, ...slaStats.area, ...slaStats.general]),
            totalEstimadoGlobal,
            topCategoriesGlobal,
            topStagnantGerencias,
            reqsCount: filteredReqs.length,
            ticketsCount: filteredTickets.length,
            emergenciesCount: filteredReqs.filter(r => (r.prioridad || '').toLowerCase() === 'emergencia').length,
            approvedReqsCount: filteredReqs.filter(r => (r.estado_aprobacion || '').toLowerCase() === 'aprobado_final').length,
            approvedTicketsCount: filteredTickets.filter(t => (t.status || '').toLowerCase() === 'aprobado_final' || (t.status || '').toLowerCase() === 'pagado').length,
            pendingTicketsCount: filteredTickets.filter(t => (t.status || '').toLowerCase() === 'en_espera').length,
            topDelayed: (() => {
                return filteredReqs
                    .filter(r => {
                        const sComp = (r.status_compra || '').toLowerCase();
                        const isCompleted = sComp === 'completado' || sComp === 'entregado' || sComp === 'facturado';
                        const status = (r.estado_aprobacion || '').toLowerCase();
                        return status !== 'anulada' && status !== 'rechazada' && !isCompleted;
                    })
                    .map(r => {
                        const dateStr = r.created_at || r.fecha_emision;
                        const created = parseISO(dateStr);
                        const diffDays = Math.max(0, Math.floor((new Date() - created) / (1000 * 60 * 60 * 24)));
                        return {
                            correlativo: r.correlativo_req || `REQ-${r.id}`,
                            dias: diffDays,
                            analista: r.asignado_nombre || 'Sin Asignar'
                        };
                    })
                    .sort((a, b) => b.dias - a.dias)
                    .slice(0, 3);
            })(),
            delayTrend: (() => {
                const now = new Date();
                const trend = [];
                if (filtroMes === 'Todos') {
                    // Mostrar los últimos 6 meses de forma dinámica
                    for (let i = 5; i >= 0; i--) {
                        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                        const mIdx = d.getMonth();
                        const y = d.getFullYear();
                        const reqsInMonth = myReqs.filter(r => {
                            const dateStr = r.created_at || r.fecha_emision;
                            if (!dateStr) return false;
                            const rd = parseISO(dateStr);
                            return rd.getMonth() === mIdx && rd.getFullYear() === y;
                        });
                        const pCount = reqsInMonth.filter(r => {
                            const sAprob = (r.estado_aprobacion || '').toLowerCase();
                            return sAprob !== 'aprobado_final' && sAprob !== 'anulada' && sAprob !== 'rechazada';
                        }).length;

                        const procCount = reqsInMonth.filter(r => {
                            const sComp = (r.status_compra || '').toLowerCase();
                            return sComp === 'parcial' || (r.estado_aprobacion === 'aprobado_final' && sComp !== 'completado');
                        }).length;

                        const compCount = reqsInMonth.filter(r => {
                            const sComp = (r.status_compra || '').toLowerCase();
                            return sComp === 'completado' || sComp === 'entregado' || sComp === 'facturado';
                        }).length;

                        trend.push({
                            month: meses_n[mIdx].substring(0, 3),
                            Pendientes: pCount,
                            Proceso: procCount,
                            Completas: compCount
                        });
                    }
                } else {
                    // Mostrar las semanas del mes seleccionado reactivamente
                    const targetWeeks = getWeeksForMonth(filtroMes, 2026);
                    targetWeeks.forEach(wObj => {
                        const reqsInWeek = myReqs.filter(r => {
                            const dateStr = r.created_at || r.fecha_emision;
                            if (!dateStr) return false;
                            const rd = parseISO(dateStr);
                            return getWeek(rd).toString() === wObj.weekNum && rd.getFullYear() === 2026;
                        });

                        const pCount = reqsInWeek.filter(r => {
                            const sAprob = (r.estado_aprobacion || '').toLowerCase();
                            return sAprob !== 'aprobado_final' && sAprob !== 'anulada' && sAprob !== 'rechazada';
                        }).length;

                        const procCount = reqsInWeek.filter(r => {
                            const sComp = (r.status_compra || '').toLowerCase();
                            return sComp === 'parcial' || (r.estado_aprobacion === 'aprobado_final' && sComp !== 'completado');
                        }).length;

                        const compCount = reqsInWeek.filter(r => {
                            const sComp = (r.status_compra || '').toLowerCase();
                            return sComp === 'completado' || sComp === 'entregado' || sComp === 'facturado';
                        }).length;

                        trend.push({
                            month: `Sem ${wObj.weekNum}`,
                            Pendientes: pCount,
                            Proceso: procCount,
                            Completas: compCount
                        });
                    });
                }
                return trend;
            })(),
            paretoChartData: Object.entries(byCC)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .reduce((acc, d, i, arr) => {
                    const total = arr.reduce((s, x) => s + x.value, 0);
                    const cumulative = (acc.length ? acc[acc.length - 1].cumulative : 0) + d.value;
                    acc.push({ ...d, pareto: Number(((cumulative / total) * 100).toFixed(1)), cumulative });
                    return acc;
                }, []),
            stagnant,
            drilldownData: () => {
                let dataCC = [];
                let dataMat = [];

                if (filtroGerenciaCC === 'Todas') {
                    dataCC = Object.entries(byCC)
                        .map(([name, value]) => ({ name, value: Number(value) || 0 }))
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 5);

                    // Global categories
                    const allCats = {};
                    filteredReqs.forEach(r => {
                        const items = Array.isArray(r.items) ? r.items : [];
                        items.forEach(i => {
                            const cat = i.categoria || 'S/C';
                            const m_it = (Array.isArray(i.historial_compras) ? i.historial_compras : [])
                                .reduce((acc, comp) => acc + ((Number(comp.cant) || 0) * (Number(comp.pu) || 0)), 0);
                            allCats[cat] = (allCats[cat] || 0) + m_it;
                        });
                    });

                    filteredTickets.forEach(t => {
                        const items = Array.isArray(t.items) ? t.items : [];
                        items.forEach(i => {
                            const cat = i.cat || i.categoria || 'S/C';
                            const m_it = Number(i.total) || (Number(i.cant || 1) * Number(i.pu || 0));
                            allCats[cat] = (allCats[cat] || 0) + m_it;
                        });
                    });

                    dataMat = Object.entries(allCats)
                        .map(([name, value]) => ({ name, value }))
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 5);
                } else {
                    const gData = aggregated[filtroGerenciaCC];
                    if (!gData) return { cc: [], mat: [] };

                    const gCCs = {};
                    filteredReqs.filter(r => (r.gerencia || r.departamento) === filtroGerenciaCC).forEach(r => {
                        const cc = r.centro_costo?.split('(')[0]?.trim() || 'S/CC';
                        const items = Array.isArray(r.items) ? r.items : [];
                        const ejec = items.reduce((s, i) => {
                            const h = Array.isArray(i.historial_compras) ? i.historial_compras : [];
                            return s + h.reduce((acc, comp) => acc + ((Number(comp.cant) || 0) * (Number(comp.pu) || 0)), 0);
                        }, 0);
                        gCCs[cc] = (gCCs[cc] || 0) + ejec;
                    });

                    filteredTickets.filter(t => (t.departamento || t.gerencia_departamento) === filtroGerenciaCC).forEach(t => {
                        const items = Array.isArray(t.items) ? t.items : [];
                        items.forEach(i => {
                            const cc = i.cc || t.centro_costo?.split('(')[0]?.trim() || 'S/CC';
                            const totalItem = Number(i.total) || (Number(i.cant || 1) * Number(i.pu || 0));
                            gCCs[cc] = (gCCs[cc] || 0) + totalItem;
                        });
                    });

                    dataCC = Object.entries(gCCs)
                        .map(([name, value]) => ({ name, value }))
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 5);

                    dataMat = Object.entries(gData.topCategories)
                        .map(([name, value]) => ({ name, value: Number(value) || 0 }))
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 5);
                }
                return {
                    cc: dataCC.filter(d => d.value > 0),
                    mat: dataMat.filter(d => d.value > 0)
                };
            }
        };
    }, [myReqs, myFunds, rawPartidas, myTickets, filtroGerenciaCC, filtroGerenciaGlobal, filtroMes, filtroSemana]);

    if (loading) return <div style={loaderStyle}>Analizando estructuras de Supabase...</div>;

    return (
        <div className="executive-summary" style={containerStyle}>
            {/* HEADER EJECUTIVO GLASSMORPHIC */}
            <div style={headerStyle}>
                <div style={{ borderLeft: '6px solid #0ea5e9', paddingLeft: '16px' }}>
                    <h1 style={{ margin: 0, color: '#0f172a', fontSize: '1.8rem', fontWeight: '900', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.5px' }}>
                        Resumen Ejecutivo SITC
                    </h1>
                    <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem', fontWeight: '500', fontFamily: 'Inter, sans-serif' }}>
                        Métricas de Procura, Control de Fondos y Gasto Operativo Consolidado
                    </p>
                </div>
                <div style={headerActionsStyle}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <select 
                            value={filtroGerenciaGlobal} 
                            onChange={(e) => setFiltroGerenciaGlobal(e.target.value)}
                            style={periodoBadgeStyle}
                        >
                            <option value="Todas">Todas las Gerencias</option>
                            {gerenciasDisponibles.map(g => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>

                        <select 
                            value={filtroMes} 
                            onChange={(e) => handleMonthChange(e.target.value)}
                            style={periodoBadgeStyle}
                        >
                            <option value="Todos">Todos los Meses</option>
                            {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((m, i) => (
                                <option key={i} value={i.toString()}>{m}</option>
                            ))}
                        </select>

                        <select 
                            value={filtroSemana} 
                            onChange={(e) => setFiltroSemana(e.target.value)}
                            style={periodoBadgeStyle}
                        >
                            <option value="Todas">Todas las Semanas</option>
                            {availableWeeks.map(w => (
                                <option key={w.weekNum} value={w.weekNum}>{w.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* TABS DE SECCIÓN PREMIUM */}
            <div style={tabContainerStyle}>
                <button 
                    style={{
                        ...tabButtonStyle, 
                        ...(activeTab === 'financiero' ? { 
                            backgroundColor: '#10b981', 
                            color: 'white',
                            boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.4)'
                        } : {})
                    }}
                    onClick={() => setActiveTab('financiero')}
                >
                    <DollarSign size={16} />
                    <span>Análisis Financiero y Presupuestario</span>
                </button>
                <button 
                    style={{
                        ...tabButtonStyle, 
                        ...(activeTab === 'operativo' ? { 
                            backgroundColor: '#6366f1', 
                            color: 'white',
                            boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.4)'
                        } : {})
                    }}
                    onClick={() => setActiveTab('operativo')}
                >
                    <Clock size={16} />
                    <span>Volumen Operativo y Eficiencia</span>
                </button>
            </div>

            {/* CONTENIDO CONDICIONAL POR TAB */}
            {activeTab === 'financiero' ? (
                <motion.div
                    key="financiero"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    {/* GRID DE KPIs FINANCIEROS */}
                    <div style={kpiGridStyle}>
                        <ExecutiveKPI 
                            label="Gasto Real Consolidado" 
                            value={`$ ${formatCurrency(stats.gastoConsolidadoReal)}`} 
                            sub={`Reqs: $${formatCurrency(stats.gastoActual)} + Tickets: $${formatCurrency(stats.totalTicketsGlobal)}`} 
                            icon={<TrendingUp />} 
                            color="#10b981"
                            trend={stats.totalEstimadoGlobal > 0 ? `${((stats.gastoConsolidadoReal / stats.totalEstimadoGlobal) * 100).toFixed(0)}% de Ejecución` : null}
                            details={
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>Consumo Consolidado por Categoría</div>
                                    {stats.topCategoriesGlobal.map((cat, ci) => (
                                        <div key={ci} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
                                            <span style={{ fontSize: '0.7rem', color: '#1e293b', fontWeight: 800 }}>$ {formatCurrency(cat.total)}</span>
                                        </div>
                                    ))}
                                </div>
                            }
                        />

                        <ExecutiveKPI 
                            label="Presupuesto de Fondos" 
                            value={`$ ${formatCurrency(stats.totalEstimadoGlobal)}`} 
                            sub="Presupuesto Solicitado en Período" 
                            icon={<DollarSign />} 
                            color="#0ea5e9"
                            details={
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>Presupuesto por Gerencia</div>
                                    {stats.solicitudesAnalisis.map((g, gi) => (
                                        <div key={gi} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                                            <span style={{ fontSize: '0.7rem', color: '#1e293b', fontWeight: 800 }}>$ {formatCurrency(g.estimado)}</span>
                                        </div>
                                    ))}
                                </div>
                            }
                        />

                        <ExecutiveKPI
                            label="Tickets de Pago Directo"
                            value={`$ ${formatCurrency(stats.totalTicketsGlobal)}`}
                            sub="Egresos directos por canal rápido"
                            icon={<FileText />}
                            color="#f59e0b"
                            details={
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>Gasto Directo por Departamento</div>
                                    {stats.solicitudesAnalisis.filter(g => g.gastoTickets > 0).map((g, gi) => {
                                        return (
                                            <div key={gi} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                                                <span style={{ fontSize: '0.7rem', color: '#1e293b', fontWeight: 800 }}>$ {formatCurrency(g.gastoTickets)} ({g.ticketCount} tk)</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            }
                        />
                    </div>

                    {/* CUERPO FINANCIERO */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                        {/* BALANCE FINANCIERO CONSOLIDADO POR GERENCIA */}
                        <div style={chartBoxStyle}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <div>
                                    <h3 style={{ ...chartTitleStyle, margin: 0, fontSize: '1.1rem' }}>Balance de Presupuesto Consolidado</h3>
                                    <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Planificado (Fondos Solicitados) vs Gasto Real en USD (Requisiciones y Tickets)</p>
                                </div>
                            </div>

                            {/* Barra de Totales Premium */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                gap: '15px',
                                padding: '15px',
                                backgroundColor: '#f8fafc',
                                borderRadius: '16px',
                                border: '1px solid #e2e8f0',
                                marginBottom: '20px'
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Planificado (Presupuesto)</span>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#64748b' }}>$ {formatCurrency(stats.totalEstimadoGlobal)}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Requisiciones</span>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#10b981' }}>$ {formatCurrency(stats.gastoActual)}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Tickets</span>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f59e0b' }}>$ {formatCurrency(stats.totalTicketsGlobal)}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Gasto Consolidado Real</span>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 950, color: '#0f172a' }}>$ {formatCurrency(stats.gastoConsolidadoReal)}</span>
                                </div>
                            </div>

                            <div style={{ height: '320px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.solicitudesAnalisis} margin={{ top: 10, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#1e293b' }} interval={0} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} tickFormatter={(v) => `$${v}`} />
                                        <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '0.85rem' }} />
                                        <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '0.8rem', fontWeight: 800, paddingBottom: '20px' }} />
                                        <Bar name="Fondos Planificados" dataKey="estimado" fill="#64748b" radius={[4, 4, 0, 0]} barSize={20} />
                                        <Bar name="Gasto en Requisiciones" dataKey="gastoReqs" stackId="gasto" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                                        <Bar name="Gasto en Tickets" dataKey="gastoTickets" stackId="gasto" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* DISTRIBUCIÓN POR CC Y MATERIALES */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
                            {/* CONSUMO POR CENTRO DE COSTO */}
                            <div style={{ ...chartBoxStyle, padding: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                    <h3 style={{ ...chartTitleStyle, margin: 0, fontSize: '0.9rem' }}>Consumo por Centro de Costo (Consolidado)</h3>
                                    <select
                                        value={filtroGerenciaCC}
                                        onChange={(e) => setFiltroGerenciaCC(e.target.value)}
                                        style={{ padding: '4px 10px', borderRadius: '10px', fontSize: '0.7rem', border: '1px solid #e2e8f0', fontWeight: 700, backgroundColor: '#f8fafc' }}
                                    >
                                        <option value="Todas">Todas las Gerencias</option>
                                        {stats.solicitudesAnalisis.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                                    </select>
                                </div>
                                <div style={{ height: '180px', display: 'flex', alignItems: 'center' }}>
                                    <div style={{ flex: 1, height: '100%' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={stats.drilldownData().cc}
                                                    cx="50%" cy="50%" innerRadius={45} outerRadius={65}
                                                    paddingAngle={8} dataKey="value" stroke="none"
                                                >
                                                    {stats.drilldownData().cc.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={['#1e3a8a', '#3b82f6', '#f59e0b', '#10b981', '#ef4444'][index % 5]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(v) => `$ ${formatCurrency(v)}`} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {stats.drilldownData().cc.map((entry, index) => (
                                            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: ['#1e3a8a', '#3b82f6', '#f59e0b', '#10b981', '#ef4444'][index % 5] }} />
                                                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{entry.name}</span>
                                                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#1e293b', marginLeft: 'auto' }}>${formatCurrency(entry.value)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* CONSUMO POR TIPO DE MATERIAL */}
                            <div style={{ ...chartBoxStyle, padding: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                    <h3 style={{ ...chartTitleStyle, margin: 0, fontSize: '0.9rem' }}>Consumo por Tipo de Material (Consolidado)</h3>
                                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700 }}>Categorías</span>
                                </div>
                                <div style={{ height: '180px', display: 'flex', alignItems: 'center' }}>
                                    <div style={{ flex: 1, height: '100%' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={stats.drilldownData().mat}
                                                    cx="50%" cy="50%" innerRadius={45} outerRadius={65}
                                                    paddingAngle={8} dataKey="value" stroke="none"
                                                >
                                                    {stats.drilldownData().mat.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'][index % 5]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(v) => `$ ${formatCurrency(v)}`} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {stats.drilldownData().mat.map((entry, index) => (
                                            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'][index % 5] }} />
                                                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{entry.name}</span>
                                                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#1e293b', marginLeft: 'auto' }}>${formatCurrency(entry.value)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* TABLA DE CONSUMO DETALLADO POR GERENCIA */}
                        <div style={{ ...chartBoxStyle, padding: '25px' }}>
                            <h3 style={{ ...chartTitleStyle, fontSize: '1rem', marginBottom: '20px' }}>Consumo Consolidado Detallado por Gerencia</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left' }}>
                                            <th style={{ padding: '12px', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>GERENCIA</th>
                                            <th style={{ padding: '12px', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>TOP CATEGORÍAS DE GASTO</th>
                                            <th style={{ padding: '12px', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', textAlign: 'right' }}>FONDOS ASIGNADOS</th>
                                            <th style={{ padding: '12px', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', textAlign: 'right' }}>GASTO REAL EJECUTADO</th>
                                            <th style={{ padding: '12px', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', textAlign: 'center' }}>% EJECUCION</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.solicitudesAnalisis.map((g, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                <td style={{ padding: '14px 12px', fontSize: '0.8rem', fontWeight: 750, color: '#1e293b' }}>{g.name}</td>
                                                <td style={{ padding: '14px 12px' }}>
                                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                        {g.topCategories.map((c, ci) => (
                                                            <span key={ci} style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem', color: '#475569', fontWeight: 600 }}>{c.name}</span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '14px 12px', textAlign: 'right', fontSize: '0.8rem', color: '#64748b' }}>$ {formatCurrency(g.estimado)}</td>
                                                <td style={{ padding: '14px 12px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 850, color: g.gastado > 0 ? '#10b981' : '#cbd5e1' }}>$ {formatCurrency(g.gastado)}</td>
                                                <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 900, color: g.porcentaje > 100 ? '#ef4444' : '#10b981' }}>{g.porcentaje}%</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </motion.div>
            ) : (
                <motion.div
                    key="operativo"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    {/* GRID DE KPIs OPERATIVOS */}
                    <div style={kpiGridStyle}>
                        <ExecutiveKPI
                            label="Salud y Lead Time"
                            value={`${stats.avgLeadTime} días`}
                            sub={`Ratio Emergencias: ${stats.emergencyRatio}%`}
                            icon={<Clock />}
                            color="#8b5cf6"
                            trend={stats.emergencyRatio > 30 ? "Planeación Crítica" : stats.emergencyRatio > 15 ? "Monitorear" : "Planeación Óptima"}
                            details={
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>SLA de Procura por Fase</div>
                                    {stats.slaFunnelData.map((fase, fi) => (
                                        <div key={fi} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600 }}>Fase: {fase.name}</span>
                                            <span style={{ fontSize: '0.7rem', color: '#1e293b', fontWeight: 800 }}>{fase.valor} días promedio</span>
                                        </div>
                                    ))}
                                </div>
                            }
                        />

                        <ExecutiveKPI
                            label="Requisiciones Solicitadas"
                            value={`${stats.reqsCount} Reqs`}
                            sub={`Eficiencia de Compras: ${stats.reqsCount > 0 ? Math.round((stats.funnel.completado / stats.reqsCount) * 100) : 0}%`}
                            icon={<Zap />}
                            color="#6366f1"
                            details={
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>Detalle de Requisiciones</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '0.7rem', color: '#475569' }}>Total de Emergencias</span>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ef4444' }}>{stats.emergenciesCount}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '0.7rem', color: '#475569' }}>Total de Aprobadas</span>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#10b981' }}>{stats.approvedReqsCount}</span>
                                    </div>
                                </div>
                            }
                        />

                        <ExecutiveKPI
                            label="Tickets de Pago Procesados"
                            value={`${stats.ticketsCount} Tickets`}
                            sub="Registros rápidos en período"
                            icon={<FileText />}
                            color="#f59e0b"
                            details={
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>Detalle de Tickets</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '0.7rem', color: '#475569' }}>Tickets Aprobados</span>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#10b981' }}>{stats.approvedTicketsCount}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '0.7rem', color: '#475569' }}>Tickets en Proceso</span>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f59e0b' }}>{stats.pendingTicketsCount}</span>
                                    </div>
                                </div>
                            }
                        />
                    </div>

                    {/* CUERPO OPERATIVO */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                        {/* VOLUMEN OPERATIVO POR GERENCIA */}
                        <div style={chartBoxStyle}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <div>
                                    <h3 style={{ ...chartTitleStyle, margin: 0, fontSize: '1.1rem' }}>Volumen Operativo por Gerencia</h3>
                                    <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Cantidad de Requisiciones y Tickets de Pago Procesados</p>
                                </div>
                            </div>
                            <div style={{ height: '320px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.solicitudesAnalisis} margin={{ top: 10, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#1e293b' }} interval={0} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} />
                                        <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '0.85rem' }} />
                                        <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '0.8rem', fontWeight: 800, paddingBottom: '20px' }} />
                                        <Bar name="Requisiciones" dataKey="reqCount" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
                                        <Bar name="Tickets de Pago" dataKey="ticketCount" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* METRICAS OPERATIVAS DETALLADAS EN GRID DE 4 COLUMNAS */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                            {/* ESTADO OPERATIVO */}
                            <div style={{ ...chartBoxStyle, padding: '20px' }}>
                                <h3 style={{ ...chartTitleStyle, fontSize: '0.9rem', marginBottom: '15px' }}>Embudo Operativo</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {[
                                        { label: 'PENDIENTES', val: stats.funnel.proyecto + stats.funnel.area + stats.funnel.general, color: '#3b82f6' },
                                        { label: 'EN PROCESO', val: stats.funnel.compras, color: '#f59e0b' },
                                        { label: 'COMPLETADAS', val: stats.funnel.completado, color: '#10b981' }
                                    ].map((s, i) => (
                                        <div key={i}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.65rem', fontWeight: 800 }}>
                                                <span style={{ color: '#64748b' }}>{s.label}</span>
                                                <span style={{ color: s.color }}>{s.val}</span>
                                            </div>
                                            <div style={{ height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                                                <motion.div initial={{ width: 0 }} animate={{ width: `${(s.val / (stats.reqsCount || 1)) * 100}%` }} style={{ height: '100%', backgroundColor: s.color }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* SALUD DE PLANEACIÓN */}
                            <div style={{ ...chartBoxStyle, padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <h3 style={{ ...chartTitleStyle, fontSize: '0.9rem', marginBottom: '10px', textAlign: 'center' }}>Salud de Planeación</h3>
                                <div style={{ height: '100px', width: '100%', position: 'relative' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { name: 'Emergencia', value: stats.emergencyRatio, fill: stats.emergencyRatio > 30 ? '#ef4444' : stats.emergencyRatio > 15 ? '#f59e0b' : '#10b981' },
                                                    { name: 'Planificadas', value: stats.plannedRatio, fill: '#f1f5f9' }
                                                ]}
                                                cx="50%" cy="100%" startAngle={180} endAngle={0}
                                                innerRadius={45} outerRadius={65} paddingAngle={0} dataKey="value" stroke="none"
                                            >
                                                <Cell key="emergencia" />
                                                <Cell key="planificadas" />
                                            </Pie>
                                            <Tooltip formatter={(v, name) => [`${v}%`, name]} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div style={{ position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e293b' }}>{stats.emergencyRatio}%</div>
                                        <div style={{ fontSize: '0.55rem', fontWeight: 800, color: '#94a3b8' }}>EMERGENCIAS</div>
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.6rem', fontWeight: 700, color: stats.emergencyRatio > 30 ? '#ef4444' : '#64748b', marginTop: '10px' }}>
                                    {stats.emergencyRatio > 30 ? 'CRÍTICO: Baja planeación' : stats.emergencyRatio > 15 ? 'RIESGO: Monitorear' : 'ÓPTIMO: Planeación sólida'}
                                </div>
                            </div>

                            {/* TENDENCIA DE FLUJO */}
                            <div style={{ ...chartBoxStyle, padding: '20px' }}>
                                <h3 style={{ ...chartTitleStyle, fontSize: '0.9rem', marginBottom: '15px' }}>Tendencia de Flujo</h3>
                                <div style={{ height: '110px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={stats.delayTrend}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 700 }} />
                                            <Tooltip contentStyle={{ fontSize: '0.65rem' }} />
                                            <Area type="monotone" dataKey="Pendientes" stackId="1" stroke="#ef4444" fill="#fee2e2" />
                                            <Area type="monotone" dataKey="Proceso" stackId="1" stroke="#f59e0b" fill="#fef3c7" />
                                            <Area type="monotone" dataKey="Completas" stackId="1" stroke="#10b981" fill="#dcfce7" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* REQUISICIONES CRÍTICAS CON MAYOR RETRASO */}
                            <div style={{ ...chartBoxStyle, padding: '20px' }}>
                                <h3 style={{ ...chartTitleStyle, fontSize: '0.9rem', marginBottom: '15px', color: '#ef4444' }}>Requisiciones Críticas</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '110px', justifyContent: 'center' }}>
                                    {stats.topDelayed && stats.topDelayed.length > 0 ? (
                                        stats.topDelayed.map((req, idx) => (
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', padding: '6px 0', borderBottom: idx < 2 ? '1px solid #f1f5f9' : 'none' }}>
                                                <span style={{ fontWeight: 800, color: '#ef4444' }}>{req.correlativo}</span>
                                                <span style={{ color: '#475569', fontWeight: 700, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.analista}</span>
                                                <span style={{ fontWeight: 900, color: '#b91c1c', backgroundColor: '#fee2e2', padding: '2px 6px', borderRadius: '6px', fontSize: '0.65rem' }}>{req.dias}d</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#94a3b8' }}>
                                            No hay requisiciones críticas con retraso en el período
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* AUDITORÍA DE APROBACIONES RECIENTES */}
                        <div style={{ ...chartBoxStyle, padding: '25px' }}>
                            <h3 style={{ ...chartTitleStyle, fontSize: '1rem', marginBottom: '20px' }}>Auditoría de Aprobaciones de Procura Recientes</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
                                {stats.recentApprovals.map((app, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#6366f115', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <ShieldCheck size={18} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#6366f1' }}>{app.correlativo}</div>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>{app.usuario}</div>
                                        </div>
                                    </div>
                                ))}
                                {stats.recentApprovals.length === 0 && (
                                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '0.85rem' }}>
                                        No hay aprobaciones recientes registradas en el período seleccionado.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
};

const ExecutiveKPI = ({ label, value, sub, icon, color, trend, details }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    return (
        <motion.div 
            whileHover={{ y: -2 }} 
            style={{ 
                ...kpiCardStyle, 
                flexDirection: 'column', 
                alignItems: 'stretch',
                cursor: details ? 'pointer' : 'default',
                transition: 'all 0.3s ease',
                borderLeft: `5px solid ${color}`
            }}
            onClick={() => details && setIsOpen(!isOpen)}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ ...iconBoxStyle, backgroundColor: `${color}15`, color: color }}>
                    {icon}
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={kpiLabelStyle}>{label}</label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {trend && (
                                <span style={{ 
                                    fontSize: '0.65rem', 
                                    fontWeight: 900, 
                                    color: trend.includes('Crítica') || trend.includes('Baja') ? '#ef4444' : '#10b981',
                                    backgroundColor: trend.includes('Crítica') || trend.includes('Baja') ? '#fee2e2' : '#dcfce7',
                                    padding: '2px 6px',
                                    borderRadius: '6px'
                                }}>
                                    {trend}
                                </span>
                            )}
                            {details && (
                                <ChevronDown 
                                    size={14} 
                                    style={{ 
                                        color: '#94a3b8',
                                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', 
                                        transition: 'transform 0.3s ease' 
                                    }} 
                                />
                            )}
                        </div>
                    </div>
                    <h2 style={kpiValueStyle}>{value}</h2>
                    <span style={kpiSubStyle}>{sub}</span>
                </div>
            </div>
            
            {isOpen && details && (
                <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #f1f5f9', overflow: 'hidden' }}
                >
                    {details}
                </motion.div>
            )}
        </motion.div>
    );
};

// --- ESTILOS ---
const containerStyle = {
    padding: '25px',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    fontFamily: "'Inter', sans-serif"
};

const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '35px'
};

const titleStyle = { margin: 0, fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' };
const subtitleStyle = { margin: '5px 0 0 0', color: '#64748b', fontSize: '0.95rem', fontWeight: 500 };

const headerActionsStyle = { display: 'flex', gap: '15px' };
const periodoBadgeStyle = {
    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 15px',
    backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '10px',
    fontSize: '0.8rem', fontWeight: 700, color: '#1e293b'
};

const kpiGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '20px',
    marginBottom: '35px'
};

const kpiCardStyle = {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '24px',
    border: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
};

const iconBoxStyle = {
    width: '60px',
    height: '60px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const kpiLabelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' };
const kpiValueStyle = { margin: '4px 0', fontSize: '1.75rem', fontWeight: 950, color: '#0f172a' };
const kpiSubStyle = { fontSize: '0.75rem', color: '#64748b', fontWeight: 500 };

const chartBoxStyle = {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '24px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
};

const chartTitleStyle = { margin: '0 0 5px 0', fontSize: '1.1rem', fontWeight: 850, color: '#1e293b', letterSpacing: '-0.3px' };

const loaderStyle = {
    height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1rem', fontWeight: 800, color: '#1e3a8a'
};

const tabContainerStyle = {
    display: 'flex',
    gap: '12px',
    marginBottom: '35px',
    padding: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(226, 232, 240, 0.8)',
    borderRadius: '16px',
    width: 'fit-content',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.01)'
};

const tabButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#64748b',
    fontSize: '0.85rem',
    fontWeight: 800,
    cursor: 'pointer',
    transition: 'all 0.3s ease'
};

export default ResumenEjecutivo;
