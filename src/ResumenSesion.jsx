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
    Briefcase
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
    Cell 
} from 'recharts';

const COLORS = ['#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

const ResumenSesion = ({ currentUser, setActiveSeccion }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({
        myReqs: [],
        subordinates: [],
        pendingApprovals: 0,
        totalSpent: 0,
        categoryStats: []
    });

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!currentUser?.id) return;
            setLoading(true);
            try {
                // 1. Requisiciones propias (Buscamos por nombre de solicitante o perfiles vinculados)
                const { data: myReqs } = await supabase
                    .from('requisiciones')
                    .select('*')
                    .or(`solicitante.eq."${currentUser.nombre}",solicitante.eq."${currentUser.nombre} ${currentUser.apellido}"`)
                    .order('created_at', { ascending: false });

                // 2. Personal a cargo (Subordinados en la misma gerencia)
                const { data: subs } = await supabase
                    .from('perfiles')
                    .select('*')
                    .eq('gerencia_id', currentUser.gerencia_id)
                    .neq('id', currentUser.id);

                // 3. Aprobaciones pendientes (Lógica simplificada según rol)
                let queryPending = supabase.from('requisiciones').select('id', { count: 'exact' });
                if (currentUser.rol === 'Gerente de Proyecto') {
                    queryPending = queryPending.eq('estado_aprobacion', 'pendiente_proyecto');
                } else if (currentUser.rol === 'Gerente de Área') {
                    queryPending = queryPending.eq('estado_aprobacion', 'pendiente_area');
                } else if (currentUser.rol === 'Gerente General') {
                    queryPending = queryPending.eq('estado_aprobacion', 'enviada_general');
                } else {
                    queryPending = queryPending.eq('id', '00000000-0000-0000-0000-000000000000'); // Nada para usuarios normales
                }
                const { count: pendingCount } = await queryPending;

                // 4. Procesar estadísticas de categorías y gasto
                const stats = {};
                let totalSpent = 0;
                (myReqs || []).forEach(r => {
                    const items = r.items || [];
                    items.forEach(it => {
                        const cat = it.categoria || 'Sin Categoría';
                        const monto = (Number(it.cant) || 0) * (Number(it.pu) || 0);
                        stats[cat] = (stats[cat] || 0) + monto;
                        totalSpent += monto;
                    });
                });

                const categoryStats = Object.entries(stats).map(([name, value]) => ({ name, value }));

                setData({
                    myReqs: myReqs || [],
                    subordinates: subs || [],
                    pendingApprovals: pendingCount || 0,
                    totalSpent,
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
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '900', color: '#0f172a' }}>
                        ¡Hola, {currentUser.nombre}! 👋
                    </h1>
                    <p style={{ margin: '5px 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                        Aquí tienes un vistazo rápido de tu sesión y actividades actuales.
                    </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>ESTADO DE SESIÓN</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: '700', fontSize: '0.85rem' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                        ACTIVA
                    </div>
                </div>
            </div>

            {/* Grid de KPIs Principales */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
                gap: '20px', 
                marginBottom: '30px' 
            }}>
                <KPICard 
                    icon={<FileText size={22} />} 
                    label="Mis Requisiciones" 
                    value={data.myReqs.length} 
                    color="#0ea5e9" 
                    bg="#e0f2fe"
                />
                <KPICard 
                    icon={<DollarSign size={22} />} 
                    label="Gasto Acumulado" 
                    value={`$ ${data.totalSpent.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`} 
                    color="#10b981" 
                    bg="#dcfce7"
                />
                <KPICard 
                    icon={<Clock size={22} />} 
                    label="Pendientes Aprobación" 
                    value={data.pendingApprovals} 
                    color="#f59e0b" 
                    bg="#fef9c3"
                    alert={data.pendingApprovals > 0}
                />
                <KPICard 
                    icon={<Users size={22} />} 
                    label="Equipo de Trabajo" 
                    value={data.subordinates.length} 
                    color="#6366f1" 
                    bg="#eef2ff"
                />
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
                    <div style={{ height: '250px' }}>
                        {data.categoryStats.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data.categoryStats}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {data.categoryStats.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(v) => `$ ${v.toLocaleString('de-DE')}`} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={emptyStateStyle}>No hay gastos registrados en tus requisiciones</div>
                        )}
                    </div>
                </div>

                {/* Últimas Actividades */}
                <div style={cardStyle}>
                    <div style={cardHeaderStyle}>
                        <Briefcase size={18} style={{ color: '#64748b' }} />
                        <h3 style={cardTitleStyle}>Estado de Actividades</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {data.myReqs.slice(0, 5).map((req, idx) => (
                            <div key={idx} style={activityItemStyle}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={dotStyle(req.estado_aprobacion)}></div>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b' }}>
                                            {req.correlativo_req || `REQ-${req.id.slice(0,5)}`}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                            {req.justificacion?.substring(0, 40)}...
                                        </div>
                                    </div>
                                </div>
                                <div style={{ 
                                    fontSize: '0.65rem', 
                                    fontWeight: '800', 
                                    color: getStatusColor(req.estado_aprobacion),
                                    backgroundColor: `${getStatusColor(req.estado_aprobacion)}15`,
                                    padding: '4px 8px',
                                    borderRadius: '6px'
                                }}>
                                    {req.estado_aprobacion?.replace('_', ' ').toUpperCase()}
                                </div>
                            </div>
                        ))}
                        {data.myReqs.length === 0 && (
                            <div style={emptyStateStyle}>Sin actividad reciente registrada</div>
                        )}
                    </div>
                    {data.myReqs.length > 5 && (
                        <button 
                            onClick={() => setActiveSeccion('requisiciones')}
                            style={viewMoreButtonStyle}
                        >
                            Ver todas mis requisiciones <ArrowRight size={14} />
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

const KPICard = ({ icon, label, value, color, bg, alert }) => (
    <motion.div 
        whileHover={{ translateY: -5 }}
        style={{
            background: 'white',
            padding: '24px',
            borderRadius: '20px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            boxShadow: alert ? `0 0 0 2px ${color}40` : '0 4px 6px -1px rgba(0,0,0,0.02)'
        }}
    >
        <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '14px',
            backgroundColor: bg,
            color: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
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
    if (status?.includes('aprobado')) return '#10b981';
    if (status?.includes('rechazado') || status?.includes('anulada')) return '#ef4444';
    if (status?.includes('pendiente')) return '#f59e0b';
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
