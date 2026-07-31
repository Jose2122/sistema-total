import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { motion } from 'framer-motion';
import { 
    Users, 
    FileText, 
    DollarSign, 
    Clock, 
    TrendingUp, 
    PieChart as PieChartIcon,
    ArrowRight,
    Briefcase,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { 
    ResponsiveContainer, 
    PieChart, 
    Pie, 
    Cell,
    Tooltip
} from 'recharts';

const COLORS = ['#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

const reqStatusLabels = {
    'borrador': 'BORRADOR',
    'pendiente_proyecto': 'GERENTE PROYECTO',
    'pendiente_area': 'GERENTE ÁREA',
    'enviada_area': 'GERENTE ÁREA',
    'enviada_general': 'GERENTE GENERAL',
    'aprobado_final': 'APROBADA',
    'completado': 'APROBADA',
    'rechazada': 'RECHAZADA',
    'rechazado': 'RECHAZADA',
    'anulada': 'ANULADA',
    'ANULADA': 'ANULADA'
};

const reqStatusColors = {
    'borrador': '#64748b',
    'pendiente_proyecto': '#1e40af',
    'pendiente_area': '#1e40af',
    'enviada_area': '#1e40af',
    'enviada_general': '#1e40af',
    'aprobado_final': '#10b981',
    'completado': '#10b981',
    'rechazada': '#ef4444',
    'rechazado': '#ef4444',
    'anulada': '#64748b',
    'ANULADA': '#64748b'
};

const ResumenSesion = ({ currentUser, setActiveSeccion }) => {
    const [loading, setLoading] = useState(true);
    const [myReqsExpanded, setMyReqsExpanded] = useState(false);
    const [spentExpanded, setSpentExpanded] = useState(false);
    const [pendingExpanded, setPendingExpanded] = useState(false);
    const [teamExpanded, setTeamExpanded] = useState(false);
    const [activeActivityTab, setActiveActivityTab] = useState('mine');

    const [data, setData] = useState({
        myReqs: [],
        subordinates: [],
        pendingList: [],
        otherReqs: [],
        pendingApprovals: 0,
        totalSpent: 0,
        approvedSpent: 0,
        pendingSpent: 0,
        categoryStats: []
    });

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!currentUser?.id) return;
            setLoading(true);
            try {
                // 1. Requisiciones propias
                const { data: myReqs } = await supabase
                    .from('requisiciones')
                    .select('*')
                    .or(`solicitante.eq."${currentUser.nombre}",solicitante.eq."${currentUser.nombre} ${currentUser.apellido}"`)
                    .order('created_at', { ascending: false });

                // 2. Personal a cargo (Subordinados en la misma gerencia)
                let subs = [];
                if (currentUser.gerencia_id) {
                    const { data: subsData } = await supabase
                        .from('perfiles')
                        .select('*')
                        .eq('gerencia_id', currentUser.gerencia_id)
                        .neq('id', currentUser.id);
                    subs = subsData || [];
                }

                // 3. Aprobaciones pendientes
                let queryPending = supabase.from('requisiciones').select('id, correlativo_req, solicitante, estado_aprobacion, justificacion, gerencia, centro_costo');
                
                const rolUpper = (currentUser.rol || '').toUpperCase();
                const deptoUpper = (currentUser.departamento || '').toUpperCase();
                const emailLower = (currentUser.correo || '').toLowerCase();
                
                const esGG = rolUpper.includes('GENERAL') || rolUpper.includes('ADMIN') || emailLower === 'cvega@totalclean.com' || emailLower === 'cvega.totalclean@gmail.com';
                const esGP = rolUpper.includes('PROYECTO');
                const esGA = rolUpper.includes('ÁREA') || rolUpper.includes('AREA') || emailLower === 'karincmm1@gmail.com' || rolUpper.includes('CONTROL INTERNO') || deptoUpper.includes('ESTIMAC');

                if (rolUpper.includes('ANALISTA')) {
                    queryPending = queryPending
                        .or(`solicitante.eq."${currentUser.nombre}",solicitante.eq."${currentUser.nombre} ${currentUser.apellido}"`)
                        .in('estado_aprobacion', ['pendiente_proyecto', 'pendiente_area', 'enviada_general']);
                } else if (esGP) {
                    queryPending = queryPending.eq('estado_aprobacion', 'pendiente_proyecto');
                } else if (esGA) {
                    queryPending = queryPending.eq('estado_aprobacion', 'pendiente_area');
                } else if (esGG) {
                    queryPending = queryPending.eq('estado_aprobacion', 'enviada_general');
                } else {
                    queryPending = queryPending.eq('id', '00000000-0000-0000-0000-000000000000');
                }
                const { data: pendingData } = await queryPending;

                // Filtrar aprobaciones pendientes en frontend según el rol y departamento para evitar ver las de otros departamentos
                let filteredPending = pendingData || [];
                if (esGP) {
                    const misObras = currentUser.obras_asignadas || [];
                    if (misObras.length > 0) {
                        filteredPending = filteredPending.filter(r => misObras.includes(r.centro_costo));
                    }
                } else if (esGA) {
                    const myDepto = (currentUser.departamento || '').toLowerCase().trim();
                    if (myDepto) {
                        filteredPending = filteredPending.filter(r => {
                            const reqDepto = (r.gerencia || '').toLowerCase().trim();
                            return reqDepto.includes(myDepto) || myDepto.includes(reqDepto);
                        });
                    }
                }

                // 4. Procesar estadísticas de categorías y gasto
                const stats = {};
                let totalSpent = 0;
                let approvedSpent = 0;
                let pendingSpent = 0;

                (myReqs || []).forEach(r => {
                    const items = r.items || [];
                    let reqMonto = 0;
                    items.forEach(it => {
                        const cat = it.categoria || 'Sin Categoría';
                        const monto = (Number(it.cant) || 0) * (Number(it.pu) || 0);
                        stats[cat] = (stats[cat] || 0) + monto;
                        totalSpent += monto;
                        reqMonto += monto;
                    });
                    
                    if (r.estado_aprobacion === 'completado') {
                        approvedSpent += reqMonto;
                    } else if (['pendiente_proyecto', 'pendiente_area', 'enviada_general'].includes(r.estado_aprobacion)) {
                        pendingSpent += reqMonto;
                    }
                });

                // 5. Últimas requisiciones de otros usuarios DE LA MISMA GERENCIA (para seguimiento general)
                const peerNames = [];
                (subs || []).forEach(s => {
                    if (s.nombre) {
                        peerNames.push(s.nombre.trim());
                        if (s.apellido) {
                            peerNames.push(`${s.nombre.trim()} ${s.apellido.trim()}`);
                        }
                    }
                });

                let otherReqs = [];
                if (peerNames.length > 0) {
                    const { data: oReqs } = await supabase
                        .from('requisiciones')
                        .select('id, correlativo_req, solicitante, estado_aprobacion, justificacion, centro_costo, items')
                        .in('solicitante', peerNames)
                        .order('created_at', { ascending: false })
                        .limit(3);
                    otherReqs = oReqs || [];
                }

                // Ordenar por volumen de gasto descendente (la que más consume a la que menos)
                const categoryStats = Object.entries(stats)
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value);

                setData({
                    myReqs: myReqs || [],
                    subordinates: subs || [],
                    pendingList: filteredPending,
                    otherReqs: otherReqs || [],
                    pendingApprovals: filteredPending.length,
                    totalSpent,
                    approvedSpent,
                    pendingSpent,
                    categoryStats
                });
            } catch (error) {
                console.error("Error cargando resumen:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [currentUser]);

    const myReqsBreakdown = useMemo(() => {
        const stats = {};
        (data.myReqs || []).forEach(r => {
            const status = r.estado_aprobacion || 'borrador';
            stats[status] = (stats[status] || 0) + 1;
        });
        return Object.entries(stats).map(([status, count]) => ({ status, count }));
    }, [data.myReqs]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                    <TrendingUp size={40} />
                </motion.div>
            </div>
        );
    }

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="resumen-container" 
            style={{ padding: '20px', fontFamily: '"Inter", sans-serif' }}
        >
            {/* Cabecera de Bienvenida */}
            <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ borderLeft: '6px solid #0ea5e9', paddingLeft: '16px' }}>
                    <h1 style={{ margin: 0, color: '#0f172a', fontSize: '1.8rem', fontWeight: '900', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.5px' }}>
                        ¡Hola, {currentUser.nombre}! 👋
                    </h1>
                    <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem', fontWeight: '500', fontFamily: 'Inter, sans-serif' }}>
                        Aquí tienes un vistazo rápido de tu sesión y actividades actuales.
                    </p>
                </div>
            </div>

            {/* Grid de KPIs Principales */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
                gap: '20px', 
                marginBottom: '30px',
                alignItems: 'start'
            }}>
                {/* KPI: Mis Requisiciones */}
                <KPICard 
                    icon={<FileText size={22} />} 
                    label="Mis Requisiciones" 
                    value={data.myReqs.length} 
                    color="#0ea5e9" 
                    bg="#e0f2fe"
                    isExpanded={myReqsExpanded}
                    onToggle={() => setMyReqsExpanded(!myReqsExpanded)}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                            POR ESTADO / NIVEL
                        </div>
                        {myReqsBreakdown.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontWeight: '500' }}>
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: reqStatusColors[item.status] || '#64748b' }}></div>
                                    {reqStatusLabels[item.status] || item.status}
                                </span>
                                <span style={{ fontWeight: '800', color: '#1e293b' }}>
                                    {item.count} Reqs
                                </span>
                            </div>
                        ))}
                        {myReqsBreakdown.length === 0 && (
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>
                                Sin requisiciones
                            </div>
                        )}
                    </div>
                </KPICard>

                {/* KPI: Gasto Acumulado */}
                <KPICard 
                    icon={<DollarSign size={22} />} 
                    label="Gasto Acumulado" 
                    value={`$ ${data.totalSpent.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`} 
                    color="#10b981" 
                    bg="#dcfce7"
                    isExpanded={spentExpanded}
                    onToggle={() => setSpentExpanded(!spentExpanded)}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                            DISTRIBUCIÓN DE GASTO
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontWeight: '500' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                                Real (Aprobado Final)
                            </span>
                            <span style={{ fontWeight: '800', color: '#1e293b' }}>
                                $ {data.approvedSpent.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontWeight: '500' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></div>
                                Comprometido (En Firma)
                            </span>
                            <span style={{ fontWeight: '800', color: '#1e293b' }}>
                                $ {data.pendingSpent.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                            </span>
                        </div>
                    </div>
                </KPICard>

                {/* KPI: Pendientes Aprobación */}
                <KPICard 
                    icon={<Clock size={22} />} 
                    label="Pendientes Aprobación" 
                    value={data.pendingApprovals} 
                    color="#f59e0b" 
                    bg="#fef9c3"
                    alert={data.pendingApprovals > 0}
                    isExpanded={pendingExpanded}
                    onToggle={() => setPendingExpanded(!pendingExpanded)}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                            DETALLE DE PENDIENTES
                        </div>
                        {data.pendingList && data.pendingList.length > 0 ? (
                            data.pendingList.map((req, idx) => (
                                <div key={idx} style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '2px', 
                                    padding: '6px 8px', 
                                    borderRadius: '8px', 
                                    backgroundColor: '#f8fafc',
                                    border: '1px solid #f1f5f9'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#1e293b' }}>
                                            {req.correlativo_req || `REQ-${req.id.slice(0,5)}`}
                                        </span>
                                        <span style={{ 
                                            fontSize: '0.6rem', 
                                            fontWeight: '800', 
                                            color: reqStatusColors[req.estado_aprobacion] || '#f59e0b',
                                            backgroundColor: `${reqStatusColors[req.estado_aprobacion] || '#f59e0b'}15`,
                                            padding: '2px 6px',
                                            borderRadius: '4px'
                                        }}>
                                            {reqStatusLabels[req.estado_aprobacion] || req.estado_aprobacion}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                        Solicita: <span style={{ fontWeight: '600' }}>{req.solicitante}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>
                                No hay requisiciones pendientes
                            </div>
                        )}
                    </div>
                </KPICard>

                {/* KPI: Equipo de Trabajo */}
                <KPICard 
                    icon={<Users size={22} />} 
                    label="Equipo de Trabajo" 
                    value={data.subordinates.length} 
                    color="#6366f1" 
                    bg="#eef2ff"
                    isExpanded={teamExpanded}
                    onToggle={() => setTeamExpanded(!teamExpanded)}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                            MIEMBROS DEL EQUIPO
                        </div>
                        {data.subordinates && data.subordinates.length > 0 ? (
                            data.subordinates.map((sub, idx) => (
                                <div key={idx} style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center', 
                                    fontSize: '0.8rem',
                                    padding: '6px 0',
                                    borderBottom: idx < data.subordinates.length - 1 ? '1px solid #f1f5f9' : 'none'
                                }}>
                                    <span style={{ fontWeight: '600', color: '#334155' }}>
                                        {sub.nombre} {sub.apellido}
                                    </span>
                                    <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                                        {sub.rol || 'Analista'}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>
                                No hay miembros registrados
                            </div>
                        )}
                    </div>
                </KPICard>
            </div>

            {/* Gráficos y Listas Rápidas */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
                gap: '25px' 
            }}>
                {/* Gastos por Categoría */}
                <div style={cardStyle}>
                    <div style={cardHeaderStyle}>
                        <PieChartIcon size={18} style={{ color: '#64748b' }} />
                        <h3 style={cardTitleStyle}>Gastos por Categoría</h3>
                    </div>
                    {data.categoryStats.length > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '30px', height: '250px' }}>
                            <div style={{ flex: 0.8, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={data.categoryStats}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={55}
                                            outerRadius={75}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            {data.categoryStats.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(v) => `$ ${v.toLocaleString('de-DE')}`} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            
                            {/* Legend Panel */}
                            <div style={{ 
                                flex: 1.5, 
                                maxHeight: '220px', 
                                overflowY: 'auto', 
                                paddingRight: '5px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                            }}>
                                {data.categoryStats.map((entry, index) => {
                                    const totalSum = data.categoryStats.reduce((acc, curr) => acc + curr.value, 0) || 1;
                                    const pct = ((entry.value / totalSum) * 100).toFixed(1);
                                    const color = COLORS[index % COLORS.length];
                                    return (
                                        <div key={index} style={{ 
                                            display: 'flex', 
                                            flexDirection: 'column', 
                                            gap: '4px',
                                            padding: '8px 12px',
                                            borderRadius: '12px',
                                            backgroundColor: '#f8fafc',
                                            border: '1px solid #f1f5f9'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color, flexShrink: 0 }}></div>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#334155' }} title={entry.name}>
                                                        {entry.name}
                                                    </span>
                                                </div>
                                                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '6px', flexShrink: 0 }}>
                                                    {pct}%
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.8rem', fontWeight: '850', color: '#0f172a', paddingLeft: '16px' }}>
                                                $ {entry.value.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div style={{ ...emptyStateStyle, height: '250px' }}>No hay gastos registrados en tus requisiciones</div>
                    )}
                </div>

                {/* Seguimiento de Actividades (Tabbed Card) */}
                <div style={cardStyle}>
                    <div style={{ ...cardHeaderStyle, justifyContent: 'space-between', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Briefcase size={18} style={{ color: '#64748b' }} />
                            <h3 style={cardTitleStyle}>Seguimiento de Actividades</h3>
                        </div>
                        {/* Tab Toggle buttons */}
                        <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '10px', gap: '2px' }}>
                            <button 
                                onClick={() => setActiveActivityTab('mine')}
                                style={{
                                    border: 'none',
                                    backgroundColor: activeActivityTab === 'mine' ? '#ffffff' : 'transparent',
                                    color: activeActivityTab === 'mine' ? '#0f172a' : '#64748b',
                                    fontSize: '0.72rem',
                                    fontWeight: '800',
                                    padding: '5px 12px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    boxShadow: activeActivityTab === 'mine' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                                    transition: 'all 0.15s'
                                }}
                            >
                                Mis Requisiciones
                            </button>
                            <button 
                                onClick={() => setActiveActivityTab('peers')}
                                style={{
                                    border: 'none',
                                    backgroundColor: activeActivityTab === 'peers' ? '#ffffff' : 'transparent',
                                    color: activeActivityTab === 'peers' ? '#0f172a' : '#64748b',
                                    fontSize: '0.72rem',
                                    fontWeight: '800',
                                    padding: '5px 12px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    boxShadow: activeActivityTab === 'peers' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                                    transition: 'all 0.15s'
                                }}
                            >
                                Colegas (Gerencia)
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '380px', overflowY: 'auto', paddingRight: '5px' }}>
                        {activeActivityTab === 'mine' ? (
                            <>
                                {data.myReqs.slice(0, 4).map((req, idx) => (
                                    <div key={idx} style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px',
                                        padding: '12px 14px',
                                        borderRadius: '16px',
                                        backgroundColor: '#f8fafc',
                                        border: '1px solid #f1f5f9',
                                        fontSize: '0.78rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: '800', color: '#1e293b' }}>
                                                {req.correlativo_req || `REQ-${req.id.slice(0,5)}`}
                                            </span>
                                            <span style={{ 
                                                fontSize: '0.65rem', 
                                                fontWeight: '800', 
                                                color: getStatusColor(req.estado_aprobacion),
                                                backgroundColor: `${getStatusColor(req.estado_aprobacion)}15`,
                                                padding: '2px 6px',
                                                borderRadius: '4px'
                                            }}>
                                                {reqStatusLabels[req.estado_aprobacion] || req.estado_aprobacion?.toUpperCase()}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ 
                                                fontSize: '0.7rem', 
                                                fontWeight: '700', 
                                                color: '#4f46e5', 
                                                backgroundColor: '#eef2ff', 
                                                padding: '2px 8px', 
                                                borderRadius: '6px',
                                                maxWidth: '220px',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }} title={req.centro_costo}>
                                                📍 {req.centro_costo || 'Sin Centro de Costo'}
                                            </span>
                                            <span style={{ fontWeight: '850', color: '#0f172a' }}>
                                                $ {(req.items || []).reduce((acc, it) => acc + (Number(it.cant) * Number(it.pu) || 0), 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                                            </span>
                                        </div>
                                        {req.justificacion && (
                                            <div style={{ 
                                                fontSize: '0.72rem', 
                                                color: '#64748b', 
                                                backgroundColor: '#ffffff',
                                                padding: '6px 10px',
                                                borderRadius: '8px',
                                                border: '1px solid #f1f5f9',
                                                lineHeight: '1.2'
                                            }}>
                                                {req.justificacion}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {data.myReqs.length === 0 && (
                                    <div style={emptyStateStyle}>Sin actividad reciente registrada</div>
                                )}
                                {data.myReqs.length > 4 && (
                                    <button 
                                        onClick={() => setActiveSeccion('requisiciones')}
                                        style={viewMoreButtonStyle}
                                    >
                                        Ver todas mis requisiciones <ArrowRight size={14} />
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                {data.otherReqs && data.otherReqs.length > 0 ? (
                                    data.otherReqs.map((req, idx) => (
                                        <div key={idx} style={{ 
                                            display: 'flex', 
                                            flexDirection: 'column', 
                                            gap: '6px',
                                            padding: '12px 14px',
                                            borderRadius: '16px',
                                            backgroundColor: '#f8fafc',
                                            border: '1px solid #f1f5f9',
                                            fontSize: '0.78rem'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ 
                                                        width: '6px', 
                                                        height: '6px', 
                                                        borderRadius: '50%', 
                                                        backgroundColor: getStatusColor(req.estado_aprobacion) 
                                                    }}></div>
                                                    <span style={{ fontWeight: '800', color: '#1e293b' }}>
                                                        {req.correlativo_req || `REQ-${req.id.slice(0,5)}`}
                                                    </span>
                                                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                                        • {req.solicitante}
                                                    </span>
                                                </div>
                                                <span style={{ 
                                                    fontSize: '0.65rem', 
                                                    fontWeight: '800', 
                                                    color: getStatusColor(req.estado_aprobacion),
                                                    backgroundColor: `${getStatusColor(req.estado_aprobacion)}15`,
                                                    padding: '2px 6px',
                                                    borderRadius: '4px'
                                                }}>
                                                    {reqStatusLabels[req.estado_aprobacion] || req.estado_aprobacion?.toUpperCase()}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ 
                                                    fontSize: '0.7rem', 
                                                    fontWeight: '700', 
                                                    color: '#4f46e5', 
                                                    backgroundColor: '#eef2ff', 
                                                    padding: '2px 8px', 
                                                    borderRadius: '6px',
                                                    maxWidth: '220px',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                }} title={req.centro_costo}>
                                                    📍 {req.centro_costo || 'Sin Centro de Costo'}
                                                </span>
                                                <span style={{ fontWeight: '850', color: '#0f172a' }}>
                                                    $ {(req.items || []).reduce((acc, it) => acc + (Number(it.cant) * Number(it.pu) || 0), 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                                                </span>
                                            </div>
                                            {req.justificacion && (
                                                <div style={{ 
                                                    fontSize: '0.72rem', 
                                                    color: '#64748b', 
                                                    backgroundColor: '#ffffff',
                                                    padding: '6px 10px',
                                                    borderRadius: '8px',
                                                    border: '1px solid #f1f5f9',
                                                    lineHeight: '1.2'
                                                }}>
                                                    {req.justificacion}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', padding: '40px 0', textAlign: 'center' }}>
                                        No hay requisiciones recientes de colegas en tu gerencia
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const KPICard = ({ icon, label, value, color, bg, alert, isExpanded, onToggle, children }) => (
    <motion.div 
        layout
        whileHover={isExpanded ? {} : { translateY: -3 }}
        style={{
            background: 'white',
            padding: '24px',
            borderRadius: '24px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
            boxShadow: alert ? `0 0 0 2px ${color}40` : '0 4px 6px -1px rgba(0,0,0,0.02)',
            cursor: onToggle ? 'pointer' : 'default',
            transition: 'box-shadow 0.2s',
            overflow: 'hidden'
        }}
        onClick={onToggle}
    >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '16px',
                    backgroundColor: bg,
                    color: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                }}>
                    {icon}
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {label}
                    </label>
                    <h3 style={{ margin: '4px 0 0 0', fontSize: '1.4rem', fontWeight: '900', color: '#0f172a' }}>
                        {value}
                    </h3>
                </div>
            </div>
            {onToggle && (
                <div style={{ color: '#94a3b8', padding: '4px', borderRadius: '50%' }}>
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
            )}
        </div>

        {isExpanded && children && (
            <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.2 }}
                style={{ 
                    borderTop: '1px solid #f1f5f9', 
                    paddingTop: '15px',
                    marginTop: '5px'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </motion.div>
        )}
    </motion.div>
);

// Estilos Reutilizables
const cardStyle = {
    background: 'white',
    padding: '25px',
    borderRadius: '24px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.04)'
};

const cardHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '20px'
};

const cardTitleStyle = {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: '800',
    color: '#1e293b'
};

const activityItemStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    borderRadius: '12px',
    backgroundColor: '#f8fafc',
    border: '1px solid #f1f5f9',
    transition: 'all 0.2s'
};

const dotStyle = (status) => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: getStatusColor(status)
});

const getStatusColor = (status) => {
    if (status?.includes('aprobado') || status?.includes('completado')) return '#10b981';
    if (status?.includes('rechazado') || status?.includes('anulada')) return '#ef4444';
    if (status?.includes('pendiente') || status?.includes('enviada')) return '#f59e0b';
    return '#64748b';
};

const emptyStateStyle = {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94a3b8',
    fontSize: '0.85rem',
    fontStyle: 'italic',
    padding: '40px 0'
};

const viewMoreButtonStyle = {
    marginTop: '15px',
    background: 'none',
    border: 'none',
    color: '#0ea5e9',
    fontSize: '0.8rem',
    fontWeight: '800',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: 0
};

export default ResumenSesion;
