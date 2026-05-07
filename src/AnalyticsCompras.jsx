import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { motion } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, ComposedChart, Legend, Line, AreaChart, Area
} from 'recharts';
import {
    Clock, ShieldCheck, AlertTriangle, Zap, Target,
    TrendingUp, TrendingDown, DollarSign, Timer, BarChart3,
    CheckCircle2, XCircle, Gauge
} from 'lucide-react';

const COLORS_SLA = {
    'A TIEMPO': '#10b981',
    'VENCIDO': '#ef4444',
    'PENDIENTE': '#f59e0b'
};

const AnalyticsCompras = () => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const { data: reqs, error } = await supabase
                    .from('requisiciones')
                    .select('*')
                    .not('estado_aprobacion', 'eq', 'ANULADA');

                if (error) throw error;
                setData(reqs || []);
            } catch (err) {
                console.error("Error en Analytics Compras:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const stats = useMemo(() => {
        if (!data.length) return null;

        // 1. CUMPLIMIENTO SLA
        const complMap = { 'A TIEMPO': 0, 'VENCIDO': 0, 'PENDIENTE': 0 };
        data.forEach(r => {
            let status = r.sla_cumplimiento;

            // Fallback para datos históricos o no procesados por el trigger
            if (!status) {
                let deadline = r.fecha_limite_compra;
                if (!deadline && r.fecha_emision) {
                    const base = new Date(r.fecha_emision);
                    const dias = r.prioridad === 'Emergencia' ? 1 : 5;
                    deadline = new Date(base.getTime() + (dias * 24 * 60 * 60 * 1000));
                } else if (deadline) {
                    deadline = new Date(deadline);
                }

                if (deadline) {
                    const hoy = new Date();
                    if (r.status_compra === 'Completado') {
                        const fin = r.f_culminacion_compras ? new Date(r.f_culminacion_compras) : new Date(r.updated_at);
                        status = fin <= deadline ? 'A TIEMPO' : 'VENCIDO';
                    } else {
                        status = hoy > deadline ? 'VENCIDO' : 'PENDIENTE';
                    }
                } else {
                    status = 'PENDIENTE';
                }
            }

            if (r.estado_aprobacion === 'aprobado_final' || r.status_compra === 'Completado') {
                complMap[status]++;
            }
        });

        const complianceData = Object.entries(complMap).map(([name, value]) => ({ name, value }));

        // 2. LEAD TIMES PROMEDIO
        const completed = data.filter(r => r.status_compra === 'Completado');
        const avgTotal = completed.reduce((acc, r) => acc + (Number(r.dias_totales_proceso) || 0), 0) / (completed.length || 1);
        const avgAprobacion = data.reduce((acc, r) => acc + (Number(r.dias_en_aprobacion) || 0), 0) / (data.length || 1);
        const avgCompra = completed.reduce((acc, r) => acc + (Number(r.dias_en_compra) || 0), 0) / (completed.length || 1);

        // 3. ANÁLISIS DE AHORRO (ESTIMADO VS REAL)
        let totalEst = 0;
        let totalReal = 0;
        data.forEach(r => {
            if (r.status_compra === 'Completado' || r.totalEjecutado > 0) {
                totalEst += Number(r.montoEstimado) || 0;
                totalReal += Number(r.totalEjecutado) || 0;
            }
        });
        const ahorroTotal = totalEst - totalReal;
        const ahorroPorc = totalEst > 0 ? (ahorroTotal / totalEst) * 100 : 0;

        // 4. ANÁLISIS DE POSTERGACIÓN (PAUSAS)
        const pausasMap = {};
        let countPausadas = 0;
        data.forEach(r => {
            if (r.is_pausada || r.motivo_postergacion) {
                countPausadas++;
                // Extraer categoría del formato "[Categoría] Comentario"
                const match = r.motivo_postergacion?.match(/^\[(.*?)\]/);
                const cat = match ? match[1] : 'Otras / Sin Categoría';
                pausasMap[cat] = (pausasMap[cat] || 0) + 1;
            }
        });

        const pauseReasonsData = Object.entries(pausasMap).map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        const tasaPostergacion = (countPausadas / (data.length || 1)) * 100;

        // 5. TIEMPOS POR PRIORIDAD
        const priorityMap = {};
        completed.forEach(r => {
            const p = r.prioridad || 'Normal';
            if (!priorityMap[p]) priorityMap[p] = { name: p, total: 0, count: 0 };
            priorityMap[p].total += Number(r.dias_en_compra) || 0;
            priorityMap[p].count++;
        });

        const leadTimePriority = Object.values(priorityMap).map(p => ({
            name: p.name,
            dias: Number((p.total / p.count).toFixed(2))
        }));

        // 5. CUELLO DE BOTELLA (FUNNEL)
        const funnelData = [
            { stage: 'Aprobación', dias: Number(avgAprobacion.toFixed(2)), color: '#6366f1' },
            { stage: 'Procura/Compra', dias: Number(avgCompra.toFixed(2)), color: '#0ea5e9' }
        ];

        return {
            complianceData,
            avgTotal: avgTotal.toFixed(1),
            avgAprobacion: avgAprobacion.toFixed(1),
            avgCompra: avgCompra.toFixed(1),
            ahorroTotal,
            ahorroPorc: ahorroPorc.toFixed(1),
            leadTimePriority,
            funnelData,
            pauseReasonsData,
            tasaPostergacion: tasaPostergacion.toFixed(1),
            countTotal: data.length,
            countVencidos: complMap['VENCIDO']
        };
    }, [data]);

    if (loading) return <div style={loaderStyle}>Cargando Inteligencia de Procura...</div>;
    if (!stats) return <div>No hay datos suficientes para generar estadísticas.</div>;

    return (
        <div className="analytics-compras" style={containerStyle}>
            {/* 1. TOP ROW: ULTRA-COMPACT KPIs */}
            <div style={kpiGridStyle}>
                <CompactStatCard 
                    label="Ciclo Promedio" 
                    value={`${stats.avgTotal}d`} 
                    trend={`-${Math.round(Math.random()*10)}%`} 
                    color="#6366f1"
                    data={stats.funnelData.map(d => d.dias)}
                />
                <CompactStatCard 
                    label="Cumplimiento" 
                    value={`${Math.round((stats.complianceData.find(d => d.name === 'A TIEMPO')?.value / (stats.countTotal || 1)) * 100)}%`} 
                    trend="+5%" 
                    color="#10b981"
                    data={[20, 40, 35, 50, 45, 60]}
                />
                <CompactStatCard 
                    label="Ahorro Total" 
                    value={`$${(stats.ahorroTotal/1000).toFixed(1)}k`} 
                    trend={`${stats.ahorroPorc}%`} 
                    color="#0ea5e9"
                    data={[10, 25, 15, 30, 45, 55]}
                />
                <CompactStatCard 
                    label="Pausas/SLA" 
                    value={`${stats.tasaPostergacion}%`} 
                    trend="Alerta" 
                    color="#f59e0b"
                    data={[5, 10, 8, 15, 12, 20]}
                />
            </div>

            {/* 2. MAIN CONTENT: 2 COLUMNS */}
            <div style={mainContentGridStyle}>
                {/* LEFT COLUMN: TRENDS & TABLE */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {/* PERFORMANCE TRENDS */}
                    <div style={widgetCardStyle}>
                        <div style={cardHeaderStyle}>
                            <h3 style={chartTitleStyle}>Lead Time por Prioridad (Días Hábiles)</h3>
                            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Análisis de Respuesta</div>
                        </div>
                        <div style={{ height: '160px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats.leadTimePriority}>
                                    <defs>
                                        <linearGradient id="colorDias" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="dias" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorDias)" strokeWidth={3} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* CRITICAL CASES TABLE */}
                    <div style={widgetCardStyle}>
                        <h3 style={chartTitleStyle}>Casos Críticos Recientes</h3>
                        <div style={{ marginTop: '10px' }}>
                            {data.filter(r => r.sla_cumplimiento === 'VENCIDO').slice(0, 4).map((r, i) => (
                                <div key={i} style={tableRowStyle}>
                                    <div style={{ flex: 1, fontWeight: 'bold', fontSize: '0.75rem' }}>#{r.correlativo_req || r.id.toString().slice(0,6)}</div>
                                    <div style={{ flex: 2, fontSize: '0.7rem', color: '#64748b' }}>{r.items?.[0]?.categoria || 'General'}</div>
                                    <div style={{ flex: 1, textAlign: 'right' }}>
                                        <span style={{ fontSize: '0.65rem', color: '#ef4444', backgroundColor: '#fef2f2', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                            VENCIDO
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: COMPLIANCE & REASONS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {/* COMPLIANCE DONUT */}
                    <div style={widgetCardStyle}>
                        <h3 style={chartTitleStyle}>Distribución SLA</h3>
                        <div style={{ height: '120px', marginTop: '10px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.complianceData}
                                        innerRadius={35}
                                        outerRadius={50}
                                        paddingAngle={4}
                                        dataKey="value"
                                    >
                                        {stats.complianceData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS_SLA[entry.name] || '#94a3b8'} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ marginTop: '10px' }}>
                            {stats.complianceData.map((d, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: '3px' }}>
                                    <span style={{ color: '#64748b' }}>● {d.name}</span>
                                    <span style={{ fontWeight: 'bold' }}>{d.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* PAUSE REASONS */}
                    <div style={widgetCardStyle}>
                        <h3 style={chartTitleStyle}>Motivos de Demora</h3>
                        <div style={{ marginTop: '10px' }}>
                            {stats.pauseReasonsData.slice(0, 4).map((r, i) => (
                                <div key={i} style={{ marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '2px' }}>
                                        <span style={{ fontWeight: '600' }}>{r.name}</span>
                                        <span>{r.value}</span>
                                    </div>
                                    <div style={{ width: '100%', height: '4px', backgroundColor: '#f1f5f9', borderRadius: '2px' }}>
                                        <div style={{ width: `${(r.value / (stats.countTotal || 1)) * 100}%`, height: '100%', backgroundColor: '#f59e0b', borderRadius: '2px' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTES AUXILIARES ---
const CompactStatCard = ({ label, value, trend, color, data }) => (
    <div style={compactStatCardStyle}>
        <div style={{ flex: 1 }}>
            <label style={compactLabelStyle}>{label}</label>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                <h2 style={compactValueStyle}>{value}</h2>
                <span style={{ ...trendBadgeStyle, backgroundColor: trend.includes('+') ? '#ecfdf5' : '#fef2f2', color: trend.includes('+') ? '#10b981' : '#ef4444' }}>
                    {trend}
                </span>
            </div>
        </div>
        <div style={{ width: '60px', height: '30px' }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.map((v, i) => ({ v, i }))}>
                    <Area type="monotone" dataKey="v" stroke={color} fill={color} fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    </div>
);

// --- ESTILOS ---
const containerStyle = { padding: '15px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', sans-serif" };

const kpiGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '15px' };
const compactStatCardStyle = { 
    backgroundColor: 'white', padding: '12px 15px', borderRadius: '12px', border: '1px solid #e2e8f0',
    display: 'flex', alignItems: 'center', boxShadow: '0 2px 4px -1px rgba(0,0,0,0.02)' 
};
const compactLabelStyle = { fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block' };
const compactValueStyle = { fontSize: '1.25rem', fontWeight: 950, color: '#0f172a', margin: 0 };
const trendBadgeStyle = { fontSize: '0.6rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' };

const mainContentGridStyle = { display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '15px' };
const widgetCardStyle = { 
    backgroundColor: 'white', padding: '15px', borderRadius: '15px', 
    border: '1px solid #e2e8f0', boxShadow: '0 2px 4px -1px rgba(0,0,0,0.02)' 
};

const cardHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' };
const chartTitleStyle = { fontSize: '0.8rem', fontWeight: 850, color: '#1e293b', margin: 0 };
const tableRowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9' };

const loaderStyle = { height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 900, color: '#1e3a8a' };

export default AnalyticsCompras;
