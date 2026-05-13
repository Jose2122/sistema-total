import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { motion } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, ComposedChart, Legend
} from 'recharts';
import {
    TrendingUp, TrendingDown, Clock, ShieldCheck, AlertTriangle,
    Zap, Target, Calendar, BarChart3, Filter, Download, DollarSign,
    CheckCircle2, AlertCircle, Clock as ClockIcon, TrendingUp as TrendingUpIcon,
    ChevronRight, ChevronDown, Briefcase, Users
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

const COLORS_PARETO = ['#1e3a8a', '#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];
const COLORS_STATUS = {
    'aprobado_final': '#10b981',
    'anulada': '#ef4444',
    'en_espera': '#f59e0b',
    'rechazada': '#991b1b'
};

const ResumenEjecutivo = () => {
    const [loading, setLoading] = useState(true);
    const [rawReqs, setRawReqs] = useState([]);
    const [rawFunds, setRawFunds] = useState([]);
    const [periodo, setPeriodo] = useState('Mes Actual');
    const [filtroGerenciaCC, setFiltroGerenciaCC] = useState('Todas');
    const [filtroMes, setFiltroMes] = useState(new Date().getMonth().toString());
    const [filtroSemana, setFiltroSemana] = useState('Todas');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const { data: reqs } = await supabase.from('requisiciones').select('*');
                const { data: funds } = await supabase.from('solicitudes_fondos').select('*');
                const { data: parts } = await supabase.from('partidas_fondos').select('*');
                setRawReqs(reqs || []);
                setRawFunds(funds || []);
                setRawPartidas(parts || []);
            } catch (err) {
                console.error("Error cargando datos ejecutivos:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const [rawPartidas, setRawPartidas] = useState([]);

    const getWeekNumber = (date) => {
        if (!date) return 0;
        return getWeek(typeof date === 'string' ? parseISO(date) : date);
    };

    // --- LÓGICA DE ANALISTA DE DATOS ---
    const stats = useMemo(() => {
        if (!rawReqs || !rawReqs.length) return {
            gastoActual: 0, ahorroTotal: 0, solicitudesAnalisis: [], funnel: { proyecto: 0, area: 0, general: 0, compras: 0, completado: 0 },
            stagnantCount: 0, topCC: [], recentApprovals: [], slaFunnelData: [], healthScore: 0, avgLeadTime: 0,
            emergencyRatio: 0, plannedRatio: 0,
            drilldownData: () => ({ cc: [], mat: [] })
        };

        // --- LÓGICA DE CONSUMO POR GERENCIA (MIGRADA) ---
        const aggregated = {};
        const meses_n = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

        // --- FILTRADO POR TIEMPO ---
        const filteredFunds = rawFunds.filter(s => {
            const fechaStr = s.fecha_operativa || s.created_at;
            if (!fechaStr) return false;
            const date = parseISO(fechaStr);
            const mMatch = filtroMes === 'Todos' || date.getMonth().toString() === filtroMes;
            const wMatch = filtroSemana === 'Todas' || getWeek(date).toString() === filtroSemana;
            return mMatch && wMatch;
        });

        const filteredReqs = rawReqs.filter(r => {
            const fechaStr = r.created_at || r.fecha_emision;
            if (!fechaStr) return false;
            const date = parseISO(fechaStr);
            const mMatch = filtroMes === 'Todos' || date.getMonth().toString() === filtroMes;
            const wMatch = filtroSemana === 'Todas' || getWeek(date).toString() === filtroSemana;
            return mMatch && wMatch;
        });

        filteredFunds.forEach(s => {
            const fechaStr = s.fecha_operativa || s.created_at;
            if (!fechaStr) return;
            const date = parseISO(fechaStr);
            const mName = meses_n[date.getMonth()];
            // Filtro de periodo si fuera necesario

            const gName = s.gerencia_nombre || 'S/G';
            if (!aggregated[gName]) {
                aggregated[gName] = { name: gName, estimado: 0, gastado: 0, count: 0, topCategories: {} };
            }

            const estimado = (Number(s.total_usd) || 0) + (Number(s.total_bs) || 0);
            const linkedPartidas = rawPartidas.filter(p => p.solicitud_id === s.id);
            const linkedReqIds = [...new Set(linkedPartidas.map(p => p.requisicion_id).filter(id => id))];

            let gastado = 0;
            linkedReqIds.forEach(reqId => {
                const req = rawReqs.find(r => r.id === reqId);
                if (req) {
                    const items = Array.isArray(req.items) ? req.items : [];
                    gastado += items.reduce((s_it, i) => {
                        const h = Array.isArray(i.historial_compras) ? i.historial_compras : [];
                        const m_it = h.reduce((acc, comp) => acc + (Number(comp.cant) * (Number(comp.pu) || 0)), 0);

                        // Track categories for this management
                        const cat = i.categoria || 'S/C';
                        aggregated[gName].topCategories[cat] = (aggregated[gName].topCategories[cat] || 0) + m_it;

                        return s_it + m_it;
                    }, 0);
                }
            });

            aggregated[gName].estimado += estimado;
            aggregated[gName].gastado += gastado;
            aggregated[gName].count += 1;
        });

        const solicitudesAnalisis = Object.values(aggregated).map(item => {
            const est = Number(item.estimado) || 0;
            const gas = Number(item.gastado) || 0;
            return {
                ...item,
                estimado: Number(est.toFixed(0)),
                gastado: Number(gas.toFixed(0)),
                porcentaje: est > 0 ? Math.round((gas / est) * 100) : 0,
                topCategories: Object.entries(item.topCategories)
                    .map(([name, total]) => ({ name, total: Number(total) || 0 }))
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 3)
            };
        }).sort((a, b) => b.estimado - a.estimado);

        // --- MÉTRICAS DE TRAZABILIDAD Y SLA ---
        const funnel = { proyecto: 0, area: 0, general: 0, compras: 0, completado: 0 };
        const stagnant = [];
        const byCC = {};
        let totalEjecutadoGlobal = 0;
        let totalEstimadoGlobal = 0;

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
            }, 0) * 1.16;
            
            byCC[cc] += ejec;
            totalEjecutadoGlobal += ejec;
            totalEstimadoGlobal += Number(r.total_bs) || (items.reduce((s, i) => s + ((Number(i.cant) || 0) * (Number(i.pu) || 0)), 0) * 1.16);
        });

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
            delayTrend: (() => {
                const now = new Date();
                const trend = [];
                for (let i = 5; i >= 0; i--) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const mIdx = d.getMonth();
                    const y = d.getFullYear();
                    const reqsInMonth = rawReqs.filter(r => {
                        const rd = parseISO(r.created_at || r.fecha_emision);
                        return rd.getMonth() === mIdx && rd.getFullYear() === y;
                    });
                    const pCount = reqsInMonth.filter(r => {
                        const sComp = (r.status_compra || '').toLowerCase();
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
                return trend;
            })(),
            // Restoring original executive metrics
            paretoChartData: Object.entries(byCC)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .reduce((acc, d, i, arr) => {
                    const total = arr.reduce((s, x) => s + x.value, 0);
                    const cumulative = (acc.length ? acc[acc.length - 1].cumulative : 0) + d.value;
                    acc.push({ ...d, pareto: Number(((cumulative / total) * 100).toFixed(1)), cumulative });
                    return acc;
                }, []),
            heatmap: Array(24).fill(0).map((_, i) => {
                const hourStr = `${i}:00`;
                const count = rawReqs.filter(r => {
                    if (!r.f_aprobacion_general) return false;
                    return new Date(r.f_aprobacion_general).getHours() === i;
                }).length;
                return { hour: hourStr, count };
            }),
            stagnant,
            // Data for CC or Category drilldown
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
                    dataMat = Object.entries(allCats)
                        .map(([name, value]) => ({ name, value }))
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 5);
                } else {
                    const gData = aggregated[filtroGerenciaCC];
                    if (!gData) return { cc: [], mat: [] };

                    // CCs for this management
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
    }, [rawReqs, rawFunds, rawPartidas, filtroGerenciaCC, filtroMes, filtroSemana]);

    if (loading) return <div style={loaderStyle}>Analizando estructuras de Supabase...</div>;

    return (
        <div className="executive-summary" style={containerStyle}>
            {/* HEADER EJECUTIVO */}
            <div style={headerStyle}>
                <div>
                    <h1 style={titleStyle}>Resumen Ejecutivo SITC</h1>
                    <p style={subtitleStyle}>Métricas Estratégicas y Control de Salud Operativa</p>
                    <p style={{ ...subtitleStyle, fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px' }}>"Lo que no se mide no se puede mejorar"</p>
                </div>
                <div style={headerActionsStyle}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <select 
                            value={filtroMes} 
                            onChange={(e) => setFiltroMes(e.target.value)}
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
                            {Array.from({ length: 53 }, (_, i) => i + 1).map(w => (
                                <option key={w} value={w.toString()}>Semana {w}</option>
                            ))}
                        </select>
                    </div>
                    <button style={downloadBtnStyle}><Download size={14} /> Exportar</button>
                </div>
            </div>

            {/* KPI GRID (TOP LEVEL) - INDICADORES DE IMPACTO FINANCIERO */}
            <div style={kpiGridStyle}>
                <ExecutiveKPI 
                    label="Ejecución de Fondos" 
                    value={`$ ${stats.gastoActual.toLocaleString('de-DE')}`} 
                    sub={`Presupuesto: $ ${stats.totalEstimadoGlobal.toLocaleString('de-DE')}`} 
                    icon={<TrendingUpIcon />} 
                    color="#0ea5e9"
                    trend={stats.totalEstimadoGlobal > 0 ? `${((stats.gastoActual / stats.totalEstimadoGlobal) * 100).toFixed(1)}%` : null}
                    details={
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>Consumo por Categoría</div>
                            {stats.topCategoriesGlobal.map((cat, ci) => (
                                <div key={ci} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
                                    <span style={{ fontSize: '0.7rem', color: '#1e293b', fontWeight: 800 }}>$ {cat.total.toLocaleString('de-DE')}</span>
                                </div>
                            ))}
                        </div>
                    }
                />
                <ExecutiveKPI
                    label="Reqs. Estancadas"
                    value={`${stats.stagnantCount}`}
                    sub="Requieren atención"
                    icon={<AlertCircle />}
                    color="#f59e0b"
                    details={
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>Por Gerencia / Depto</div>
                            {stats.topStagnantGerencias.map((g, gi) => (
                                <div key={gi} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                                    <span style={{ fontSize: '0.7rem', color: '#1e293b', fontWeight: 800 }}>{g.count} Reqs</span>
                                </div>
                            ))}
                        </div>
                    }
                />
                <ExecutiveKPI
                    label="Centros de Costo"
                    value={`${stats.topCC.length}`}
                    sub="Activos en período"
                    icon={<Briefcase />}
                    color="#8b5cf6"
                />
            </div>

            {/* MAIN DASHBOARD CONTENT */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>

                {/* 1. BALANCE FINANCIERO (CONSOLIDADO Y COMPACTO) */}
                <div style={{ ...chartBoxStyle, padding: '25px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div>
                            <h3 style={{ ...chartTitleStyle, margin: 0, fontSize: '1.1rem' }}>Balance Financiero por Gerencia</h3>
                            <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Planificado vs Ejecutado (USD)</p>
                        </div>
                    </div>
                    <div style={{ height: '250px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.solicitudesAnalisis} margin={{ top: 10, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 800, fill: '#1e293b' }} interval={0} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} tickFormatter={(v) => `$${v}`} />
                                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '0.85rem' }} />
                                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '0.8rem', fontWeight: 800, paddingBottom: '20px' }} />
                                <Bar name="Planificado" dataKey="estimado" fill="#64748b" radius={[4, 4, 0, 0]} barSize={30} />
                                <Bar name="Real" dataKey="gastado" fill="#1e3a8a" radius={[4, 4, 0, 0]} barSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. FILA DE CONTROL OPERATIVO (4 COLUMNAS) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                    {/* ESTADO DE OPERACIONES */}
                    <div style={{ ...chartBoxStyle, padding: '15px' }}>
                        <h3 style={{ ...chartTitleStyle, fontSize: '0.8rem', marginBottom: '10px' }}>Estado Operativo</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {[
                                { label: 'PENDIENTES', val: stats.funnel.proyecto + stats.funnel.area + stats.funnel.general, color: '#3b82f6' },
                                { label: 'EN PROCESO', val: stats.funnel.compras, color: '#f59e0b' },
                                { label: 'COMPLETADAS', val: stats.funnel.completado, color: '#10b981' }
                            ].map((s, i) => (
                                <div key={i}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '0.55rem', fontWeight: 800 }}>
                                        <span style={{ color: '#64748b' }}>{s.label}</span>
                                        <span style={{ color: s.color }}>{s.val}</span>
                                    </div>
                                    <div style={{ height: '5px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                                        <motion.div initial={{ width: 0 }} animate={{ width: `${(s.val / (rawReqs.length || 1)) * 100}%` }} style={{ height: '100%', backgroundColor: s.color }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* SALUD DEL PROYECTO (GAUGE) */}
                    <div style={{ ...chartBoxStyle, padding: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <h3 style={{ ...chartTitleStyle, fontSize: '0.8rem', marginBottom: '5px', textAlign: 'center' }}>Salud de Planeación</h3>
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
                            <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
                                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#1e293b' }}>{stats.emergencyRatio}%</div>
                                <div style={{ fontSize: '0.5rem', fontWeight: 800, color: '#94a3b8' }}>EMERGENCIAS</div>
                            </div>
                        </div>
                        <div style={{ fontSize: '0.55rem', fontWeight: 700, color: stats.emergencyRatio > 30 ? '#ef4444' : '#64748b', marginTop: '5px' }}>
                            {stats.emergencyRatio > 30 ? 'CRÍTICO: Baja planeación' : stats.emergencyRatio > 15 ? 'RIESGO: Monitorear' : 'ÓPTIMO: Planeación sólida'}
                        </div>
                    </div>

                    {/* TENDENCIA DE FLUJO (STACKED AREA) */}
                    <div style={{ ...chartBoxStyle, padding: '15px' }}>
                        <h3 style={{ ...chartTitleStyle, fontSize: '0.8rem', marginBottom: '10px' }}>Tendencia de Flujo</h3>
                        <ResponsiveContainer width="100%" height={100}>
                            <AreaChart data={stats.delayTrend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 7, fontWeight: 700 }} />
                                <Tooltip contentStyle={{ fontSize: '0.6rem' }} />
                                <Area type="monotone" dataKey="Pendientes" stackId="1" stroke="#ef4444" fill="#fee2e2" />
                                <Area type="monotone" dataKey="Proceso" stackId="1" stroke="#f59e0b" fill="#fef3c7" />
                                <Area type="monotone" dataKey="Completas" stackId="1" stroke="#10b981" fill="#dcfce7" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* EFICIENCIA SLA (HORIZONTAL) */}
                    <div style={{ ...chartBoxStyle, padding: '15px' }}>
                        <h3 style={{ ...chartTitleStyle, fontSize: '0.8rem', marginBottom: '10px' }}>Embudo Promedio</h3>
                        <ResponsiveContainer width="100%" height={100}>
                            <BarChart data={stats.slaFunnelData} layout="vertical" margin={{ left: -10, right: 30 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#64748b' }} width={55} />
                                <Bar dataKey="valor" radius={[0, 4, 4, 0]} barSize={10} label={{ position: 'right', fontSize: 9, fontWeight: 900, fill: '#1e293b', formatter: (v) => `${v}d` }}>
                                    {stats.slaFunnelData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. DISTRIBUCIÓN DE GASTO (CC Y MATERIAL) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {/* CONSUMO POR CENTRO DE COSTO */}
                    <div style={{ ...chartBoxStyle, padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ ...chartTitleStyle, margin: 0, fontSize: '0.9rem' }}>Consumo por Centro de Costo</h3>
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
                                        <Tooltip formatter={(v) => `$ ${Number(v).toLocaleString('de-DE')}`} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {stats.drilldownData().cc.map((entry, index) => (
                                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: ['#1e3a8a', '#3b82f6', '#f59e0b', '#10b981', '#ef4444'][index % 5] }} />
                                        <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
                                        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#1e293b', marginLeft: 'auto' }}>${Number(entry.value).toLocaleString('de-DE')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* CONSUMO POR TIPO DE MATERIAL */}
                    <div style={{ ...chartBoxStyle, padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ ...chartTitleStyle, margin: 0, fontSize: '0.9rem' }}>Consumo por Tipo de Material</h3>
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700 }}>Materiales</span>
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
                                        <Tooltip formatter={(v) => `$ ${Number(v).toLocaleString('de-DE')}`} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {stats.drilldownData().mat.map((entry, index) => (
                                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'][index % 5] }} />
                                        <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
                                        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#1e293b', marginLeft: 'auto' }}>${Number(entry.value).toLocaleString('de-DE')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. AUDITORÍA RECIENTE (ANCHO COMPLETO) */}
                <div style={{ ...chartBoxStyle, padding: '20px' }}>
                    <h3 style={{ ...chartTitleStyle, fontSize: '0.9rem', marginBottom: '15px' }}>Auditoría de Aprobaciones Recientes</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
                        {stats.recentApprovals.slice(0, 4).map((app, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '10px', backgroundColor: '#6366f115', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <ShieldCheck size={16} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#6366f1' }}>{app.correlativo}</div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e293b' }}>{app.usuario}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 4. TABLA DE CONSUMO DETALLADO */}
                <div style={{ ...chartBoxStyle, padding: '25px' }}>
                    <h3 style={{ ...chartTitleStyle, fontSize: '1rem', marginBottom: '20px' }}>Consumo Detallado por Gerencia</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left' }}>
                                    <th style={{ padding: '12px', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>GERENCIA</th>
                                    <th style={{ padding: '12px', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>TOP CATEGORÍAS</th>
                                    <th style={{ padding: '12px', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', textAlign: 'right' }}>SOLICITADO</th>
                                    <th style={{ padding: '12px', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', textAlign: 'right' }}>EJECUTADO</th>
                                    <th style={{ padding: '12px', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', textAlign: 'center' }}>%</th>
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
                                        <td style={{ padding: '14px 12px', textAlign: 'right', fontSize: '0.8rem', color: '#64748b' }}>$ {g.estimado.toLocaleString('de-DE')}</td>
                                        <td style={{ padding: '14px 12px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 850, color: g.gastado > 0 ? '#10b981' : '#cbd5e1' }}>$ {g.gastado.toLocaleString('de-DE')}</td>
                                        <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 900, color: g.porcentaje > 100 ? '#ef4444' : '#64748b' }}>{g.porcentaje}%</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
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
                transition: 'all 0.3s ease'
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
                                    color: trend.startsWith('-') ? '#ef4444' : '#10b981',
                                    backgroundColor: trend.startsWith('-') ? '#fee2e2' : '#dcfce7',
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

const downloadBtnStyle = {
    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px',
    backgroundColor: '#1e3a8a', color: 'white', border: 'none', borderRadius: '10px',
    fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
};

const kpiGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
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

const mainContentGrid = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '25px'
};

const chartBoxStyle = {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '24px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
};

const chartTitleStyle = { margin: '0 0 25px 0', fontSize: '1.1rem', fontWeight: 850, color: '#1e293b', letterSpacing: '-0.3px' };

const tableStyle = { width: '100%' };
const tableHeaderStyle = {
    display: 'flex', padding: '12px 20px', backgroundColor: '#f8fafc', borderRadius: '10px',
    fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase'
};
const tableRowStyle = {
    display: 'flex', padding: '18px 20px', borderBottom: '1px solid #f1f5f9', alignItems: 'center'
};

const badgeStyle = (status) => ({
    padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 900,
    backgroundColor: `${COLORS_STATUS[status] || '#64748b'}15`,
    color: COLORS_STATUS[status] || '#64748b',
    textTransform: 'uppercase'
});

const trafficLightStyle = (days) => {
    let color = '#10b981';
    if (days > 3) color = '#f59e0b';
    if (days > 7) color = '#ef4444';
    return {
        width: '12px', height: '12px', borderRadius: '50%', backgroundColor: color,
        boxShadow: `0 0 10px ${color}80`, margin: '0 auto'
    };
};

const alertBadgeStyle = {
    display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px',
    backgroundColor: '#fff7ed', color: '#c2410c', borderRadius: '8px',
    fontSize: '0.75rem', fontWeight: 800
};

const loaderStyle = {
    height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1rem', fontWeight: 800, color: '#1e3a8a'
};

export default ResumenEjecutivo;
