import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import {
  TrendingUp, TrendingDown, Users, DollarSign, Clock, CheckCircle, AlertCircle, FileText
} from 'lucide-react';
import { requisicionesService } from './services/requisicionesService';
import { fondosService } from './services/fondosService';
import { formatCurrency } from './utils/helpers';

const COLORS = ['#0ea5e9', '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

const KPICard = ({ title, subtitle, value, trend, icon: Icon, color = '#0ea5e9' }) => (
  <div style={{
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '20px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</p>
        <p style={{ margin: '4px 0 0', fontSize: '0.65rem', color: '#94a3b8' }}>{subtitle}</p>
      </div>
      <div style={{ backgroundColor: `${color}15`, padding: '10px', borderRadius: '12px', color: color }}>
        <Icon size={20} />
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
      <h3 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '900', color: '#0f172a' }}>{value}</h3>
      {trend && (
        <span style={{
          fontSize: '0.75rem',
          fontWeight: '700',
          color: trend > 0 ? '#10b981' : '#ef4444',
          display: 'flex',
          alignItems: 'center',
          gap: '2px'
        }}>
          {trend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {Math.abs(trend)}%
        </span>
      )}
    </div>
  </div>
);

const ChartContainer = ({ title, subtitle, children }) => (
  <div style={{
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '24px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
  }}>
    <div style={{ marginBottom: '24px' }}>
      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#1e293b' }}>{title}</h4>
      <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>{subtitle}</p>
    </div>
    <div style={{ height: '300px', width: '100%' }}>
      {children}
    </div>
  </div>
);

const Analytics = ({ currentUser }) => {
  const [data, setData] = useState({ reqs: [], fondos: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reqs, fondos] = await Promise.all([
          requisicionesService.getAllRequisiciones(currentUser),
          fondosService.getAllSolicitudes(currentUser)
        ]);
        setData({ reqs, fondos });
      } catch (err) {
        console.error("Error fetching analytics data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);

  // Procesamiento de datos para los gráficos
  const stats = useMemo(() => {
    const totalGasto = data.fondos.reduce((acc, f) => acc + (f.total_usd || 0) + (f.total_bs || 0), 0);
    const reqsAprobadas = data.reqs.filter(r => r.estado_aprobacion === 'aprobado_final').length;

    // Simulación de actividad semanal (puedes mejorar esto con fechas reales)
    const porProyecto = {};
    data.reqs.forEach(r => {
      const cc = r.centro_costo || 'Otros';
      porProyecto[cc] = (porProyecto[cc] || 0) + (r.total || 0);
    });

    const chartDataProyecto = Object.keys(porProyecto).map(name => ({
      name: name.substring(0, 15),
      valor: porProyecto[name]
    })).sort((a, b) => b.valor - a.valor).slice(0, 5);

    const porCategoria = {};
    data.reqs.forEach(r => {
      const items = Array.isArray(r.items) ? r.items : [];
      items.forEach(it => {
        const cat = it.categoria || 'General';
        porCategoria[cat] = (porCategoria[cat] || 0) + (it.pu * it.cant || 0);
      });
    });

    const chartDataCategoria = Object.keys(porCategoria).map(name => ({
      name,
      value: porCategoria[name]
    })).sort((a, b) => b.value - a.value).slice(0, 6);

    return {
      totalGasto,
      reqsAprobadas,
      countReqs: data.reqs.length,
      chartDataProyecto,
      chartDataCategoria
    };
  }, [data]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#64748b' }}>Generando Reportes de Inteligencia...</div>;

  return (
    <div style={{ padding: '32px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.025em' }}>BI Analytics SITC</h2>
          <p style={{ margin: '8px 0 0', fontSize: '0.95rem', color: '#64748b' }}>Panel de Control Estratégico y Salud Financiera</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: 'white', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer' }}>Últimos 30 días</button>
          <button style={{ padding: '10px 20px', borderRadius: '12px', border: 'none', backgroundColor: '#0f172a', color: 'white', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer' }}>Descargar Reporte</button>
        </div>
      </div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        <KPICard title="Total Gastos" subtitle="SOLICITUDES DE FONDOS Y COMPRAS" value={formatCurrency(stats.totalGasto)} trend={12} icon={DollarSign} color="#0ea5e9" />
        <KPICard title="Requisiciones" subtitle="TOTAL GESTIONADO ESTE MES" value={stats.countReqs} trend={5} icon={FileText} color="#6366f1" />
        <KPICard title="Eficiencia de Aprobación" subtitle="REQS APROBADAS VS CREADAS" value={`${Math.round((stats.reqsAprobadas / (stats.countReqs || 1)) * 100)}%`} trend={-2} icon={CheckCircle} color="#10b981" />
        <KPICard title="Tiempo de Respuesta" subtitle="PROMEDIO DE APROBACIÓN (DÍAS)" value="2.4" trend={15} icon={Clock} color="#f59e0b" />
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '32px', marginBottom: '32px' }}>
        <ChartContainer title="Gasto por Proyecto" subtitle="DISTRIBUCIÓN DE PRESUPUESTO POR CENTRO DE COSTO">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.chartDataProyecto} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(val) => `$${val / 1000}k`} />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="valor" fill="#0ea5e9" radius={[6, 6, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        <ChartContainer title="Distribución por Categoría" subtitle="CONCENTRACIÓN DE GASTO OPERATIVO">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stats.chartDataCategoria}
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {stats.chartDataCategoria.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>
        <ChartContainer title="Tendencia de Gestión" subtitle="HISTÓRICO DE REQUISICIONES Y FONDOS">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={[
              { name: 'Sem 1', req: 400, fondos: 240 },
              { name: 'Sem 2', req: 300, fondos: 139 },
              { name: 'Sem 3', req: 200, fondos: 980 },
              { name: 'Sem 4', req: 278, fondos: 390 },
            ]}>
              <defs>
                <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
              <Tooltip />
              <Area type="monotone" dataKey="req" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorReq)" />
              <Area type="monotone" dataKey="fondos" stroke="#6366f1" fillOpacity={0} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

    </div>
  );
};

export default Analytics;
