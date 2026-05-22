import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import {
    Clock, ShieldCheck, AlertTriangle, Zap, Target,
    TrendingUp, TrendingDown, DollarSign, Timer, BarChart3,
    CheckCircle2, XCircle, Gauge, Calendar, User, Users,
    Search, Award, MessageSquare, Plus, Activity, RefreshCw,
    Play, Pause, Trash2, ArrowRight, Layers, HelpCircle, Check
} from 'lucide-react';

const COLORS_SLA = {
    'A TIEMPO': '#10b981',
    'VENCIDO': '#ef4444',
    'PENDIENTE': '#f59e0b'
};

const AnalyticsCompras = ({ usuario }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [analistas, setAnalistas] = useState([]);
    const [logs, setLogs] = useState([]);
    const [activeTab, setActiveTab] = useState('intelligence'); // 'intelligence' | 'traceability'
    
    // Filtros de Trazabilidad
    const [filtroAnalista, setFiltroAnalista] = useState('all');
    const [filtroTiempo, setFiltroTiempo] = useState('all'); // 'all' | 'week' | 'month'
    const [busquedaReq, setBusquedaReq] = useState('');
    
    // Filtro de Inteligencia (Tab 1)
    const [filtroAnalistaIntel, setFiltroAnalistaIntel] = useState('all');
    const [filtroTiempoIntel, setFiltroTiempoIntel] = useState('all'); // 'all' | 'week' | 'month' | 'quarter'
    const [filtroPrioridadIntel, setFiltroPrioridadIntel] = useState('all'); // 'all' | 'Emergencia' | 'Normal'
    const [filtroCCIntel, setFiltroCCIntel] = useState('all');

    useEffect(() => {
        if (usuario) {
            const depto = (usuario.departamento || '').toUpperCase();
            const esGerente = usuario.nombre === 'Ricardo' && usuario.apellido === 'Herrera' ||
                              usuario.correo === 'jcontreras.totalclean@gmail.com' ||
                              usuario.correo === 'cvega.totalclean@gmail.com' ||
                              !!usuario.esAdminReal ||
                              (usuario.rol || '').toUpperCase() === 'ADMIN' ||
                              (usuario.rol || '').toUpperCase() === 'GERENTE GENERAL' ||
                              ((usuario.rol || '').toUpperCase() === 'GERENTE' && depto.includes('COMPRAS'));
            
            if (esGerente) {
                setFiltroAnalistaIntel('all');
            } else {
                setFiltroAnalistaIntel(usuario.id || 'all');
            }
        }
    }, [usuario]);
    
    // Estados Operativos para Analistas
    const [editandoReqId, setEditandoReqId] = useState(null);
    const [obsTemporal, setObsTemporal] = useState('');
    const [savingObs, setSavingObs] = useState(false);

    // 1. CARGA DE DATOS DESDE SUPABASE
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Requisiciones
            const { data: reqs, error: reqError } = await supabase
                .from('requisiciones')
                .select('*')
                .not('estado_aprobacion', 'eq', 'ANULADA');
            if (reqError) throw reqError;
            setData(reqs || []);

            // Analistas de Compras
            const { data: users, error: userError } = await supabase
                .from('perfiles')
                .select('id, nombre, apellido, rol, departamento')
                .eq('activo', true)
                .eq('departamento', 'Compras');
            if (!userError) setAnalistas(users || []);

            // Logs de Requisiciones
            const { data: logsData, error: logError } = await supabase
                .from('requisicion_logs')
                .select('*')
                .order('fecha', { ascending: false })
                .limit(50);
            if (!logError) setLogs(logsData || []);

        } catch (err) {
            console.error("Error en Trazabilidad y Estadísticas:", err);
            toast.error("Error al cargar datos del servidor");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();

        // Suscribirse a cambios en tiempo real
        const reqChannel = supabase
            .channel('compras_analytics_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'requisiciones' }, () => {
                fetchData();
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requisicion_logs' }, () => {
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(reqChannel);
        };
    }, [fetchData]);

    // 2. CÓMPUTO DE PERMISOS (GERENTE VS ANALISTA)
    const esGerenteDeCompras = useMemo(() => {
        if (!usuario) return false;
        const rol = (usuario.rol || '').toUpperCase();
        const depto = (usuario.departamento || '').toUpperCase();
        const esRicardo = usuario.nombre === 'Ricardo' && usuario.apellido === 'Herrera';
        const esAdmin = usuario.correo === 'jcontreras.totalclean@gmail.com' ||
            usuario.correo === 'cvega.totalclean@gmail.com' ||
            !!usuario.esAdminReal ||
            rol === 'ADMIN' ||
            rol === 'GERENTE GENERAL';
        
        return esAdmin || esRicardo || (rol === 'GERENTE' && depto.includes('COMPRAS'));
    }, [usuario]);

    // Centros de costo únicos para Inteligencia
    const centrosDeCostoDisponibles = useMemo(() => {
        const ccs = data.map(r => r.centro_costo).filter(Boolean);
        return Array.from(new Set(ccs)).sort();
    }, [data]);

    // 3. DATOS DE INTELIGENCIA FILTRADOS
    const dataIntelFiltrada = useMemo(() => {
        let filtradas = data;

        // 1. Filtro por Analista
        if (filtroAnalistaIntel !== 'all') {
            filtradas = filtradas.filter(r => r.asignado_a === filtroAnalistaIntel);
        }

        // 2. Filtro por Prioridad
        if (filtroPrioridadIntel !== 'all') {
            filtradas = filtradas.filter(r => r.prioridad === filtroPrioridadIntel);
        }

        // 3. Filtro por Centro de Costo
        if (filtroCCIntel !== 'all') {
            filtradas = filtradas.filter(r => r.centro_costo === filtroCCIntel);
        }

        // 4. Filtro por Tiempo
        if (filtroTiempoIntel !== 'all') {
            const hoy = new Date();
            filtradas = filtradas.filter(r => {
                const fechaStr = r.fecha_emision || r.created_at;
                if (!fechaStr) return false;
                const fecha = new Date(fechaStr);
                const diffTime = Math.abs(hoy - fecha);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (filtroTiempoIntel === 'week') return diffDays <= 7;
                if (filtroTiempoIntel === 'month') return diffDays <= 30;
                if (filtroTiempoIntel === 'quarter') return diffDays <= 90;
                return true;
            });
        }

        return filtradas;
    }, [data, filtroAnalistaIntel, filtroPrioridadIntel, filtroCCIntel, filtroTiempoIntel]);

    // 3. CÓMPUTO DE ESTADÍSTICAS GLOBALES/FILTRADAS (TAB 1)
    const stats = useMemo(() => {
        if (!dataIntelFiltrada.length) return null;

        // 1. CUMPLIMIENTO SLA
        const complMap = { 'A TIEMPO': 0, 'VENCIDO': 0, 'PENDIENTE': 0 };
        dataIntelFiltrada.forEach(r => {
            let status = (r.sla_cumplimiento || '').toUpperCase();

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
                    if (r.status_compra?.toUpperCase() === 'COMPLETADO') {
                        const fin = r.f_culminacion_compras ? new Date(r.f_culminacion_compras) : new Date(r.updated_at || r.fecha_emision);
                        status = fin <= deadline ? 'A TIEMPO' : 'VENCIDO';
                    } else {
                        status = hoy > deadline ? 'VENCIDO' : 'PENDIENTE';
                    }
                } else {
                    status = 'PENDIENTE';
                }
            }

            if (!status) status = 'PENDIENTE';

            if (r.estado_aprobacion === 'aprobado_final' || r.status_compra?.toUpperCase() === 'COMPLETADO') {
                if (complMap[status] !== undefined) {
                    complMap[status]++;
                } else {
                    complMap['PENDIENTE']++;
                }
            }
        });

        const complianceData = Object.entries(complMap).map(([name, value]) => ({ name, value }));

        // 2. LEAD TIMES PROMEDIO
        const completed = dataIntelFiltrada.filter(r => r.status_compra?.toUpperCase() === 'COMPLETADO');
        const avgTotal = completed.reduce((acc, r) => acc + (Number(r.dias_totales_proceso) || 0), 0) / (completed.length || 1);
        const avgAprobacion = dataIntelFiltrada.reduce((acc, r) => acc + (Number(r.dias_en_aprobacion) || 0), 0) / (dataIntelFiltrada.length || 1);
        const avgCompra = completed.reduce((acc, r) => acc + (Number(r.dias_en_compra) || 0), 0) / (completed.length || 1);

        // 3. ANÁLISIS DE AHORRO
        let totalEst = 0;
        let totalReal = 0;
        dataIntelFiltrada.forEach(r => {
            if (r.status_compra?.toUpperCase() === 'COMPLETADO' || (Number(r.total_ejecutado) || 0) > 0) {
                totalEst += Number(r.total_bs) || 0;
                totalReal += Number(r.total_ejecutado) || 0;
            }
        });
        const ahorroTotal = totalEst - totalReal;
        const ahorroPorc = totalEst > 0 ? (ahorroTotal / totalEst) * 100 : 0;

        // 4. ANÁLISIS DE POSTERGACIÓN (PAUSAS)
        const pausasMap = {};
        let countPausadas = 0;
        dataIntelFiltrada.forEach(r => {
            if (r.is_pausada || r.motivo_postergacion) {
                countPausadas++;
                const match = r.motivo_postergacion?.match(/^\[(.*?)\]/);
                const cat = match ? match[1] : 'Otras / Sin Categoría';
                pausasMap[cat] = (pausasMap[cat] || 0) + 1;
            }
        });

        const pauseReasonsData = Object.entries(pausasMap).map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        const tasaPostergacion = (countPausadas / (dataIntelFiltrada.length || 1)) * 100;

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
            countTotal: dataIntelFiltrada.length,
            countVencidos: complMap['VENCIDO']
        };
    }, [dataIntelFiltrada]);

    // 4. MIGRAR Y ENRIQUECER LOGS CON DETALLES DE REQUISICIÓN
    const enrichedLogs = useMemo(() => {
        return logs.map(log => {
            const req = data.find(r => r.id === log.requisicion_id);
            return {
                ...log,
                correlativo: req?.correlativo_req || `REQ-${log.requisicion_id}`,
                solicitante: req?.solicitante || 'Desconocido',
                prioridad: req?.prioridad || 'Normal',
                items: req?.items || []
            };
        });
    }, [logs, data]);

    // 5. CÓMPUTO DE MÉTRICAS INDIVIDUALES POR ANALISTA (VISTA GERENTE / DYNAMIC STATS)
    const analistasStats = useMemo(() => {
        return analistas.map(a => {
            const reqsAsignadas = data.filter(r => r.asignado_a === a.id);
            const activas = reqsAsignadas.filter(r => r.estado_aprobacion === 'aprobado_final' && r.status_compra?.toUpperCase() !== 'COMPLETADO');
            const completadas = reqsAsignadas.filter(r => r.status_compra?.toUpperCase() === 'COMPLETADO');
            
            // SLA
            let onTime = 0;
            reqsAsignadas.forEach(r => {
                if (r.sla_cumplimiento === 'A TIEMPO') onTime++;
            });
            const slaTasa = reqsAsignadas.length > 0 ? Math.round((onTime / reqsAsignadas.length) * 100) : 100;

            // Ahorros
            let ahorro = 0;
            reqsAsignadas.forEach(r => {
                if (r.status_compra?.toUpperCase() === 'COMPLETADO' && Number(r.total_ejecutado) > 0) {
                    ahorro += (Number(r.total_bs) || 0) - (Number(r.total_ejecutado) || 0);
                }
            });

            // Lead time
            const ltTotal = completadas.reduce((acc, r) => acc + (Number(r.dias_en_compra) || 0), 0);
            const leadTimePromedio = completadas.length > 0 ? (ltTotal / completadas.length).toFixed(1) : '-';

            // Última Actividad
            const ultActLog = logs.find(l => l.usuario_id === a.id);
            const ultimaActividad = ultActLog ? new Date(ultActLog.fecha).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Sin registro';

            return {
                ...a,
                activeCount: activas.length,
                completedCount: completadas.length,
                slaTasa,
                ahorro,
                leadTimePromedio,
                ultimaActividad
            };
        });
    }, [analistas, data, logs]);

    // 6. CÓMPUTO DE DATOS PERSONALES DEL ANALISTA LOGUEADO
    const miRendimiento = useMemo(() => {
        if (!usuario) return null;
        const misReqs = data.filter(r => r.asignado_a === usuario.id);
        const activas = misReqs.filter(r => r.estado_aprobacion === 'aprobado_final' && r.status_compra?.toUpperCase() !== 'COMPLETADO');
        const completadas = misReqs.filter(r => r.status_compra?.toUpperCase() === 'COMPLETADO');

        let onTime = 0;
        let pendingSLA = 0;
        let overdueSLA = 0;
        misReqs.forEach(r => {
            if (r.sla_cumplimiento === 'A TIEMPO') onTime++;
            else if (r.sla_cumplimiento === 'PENDIENTE') pendingSLA++;
            else if (r.sla_cumplimiento === 'VENCIDO') overdueSLA++;
        });

        const slaTasa = misReqs.length > 0 ? Math.round((onTime / misReqs.length) * 100) : 100;

        let ahorro = 0;
        misReqs.forEach(r => {
            if (r.status_compra?.toUpperCase() === 'COMPLETADO' && Number(r.total_ejecutado) > 0) {
                ahorro += (Number(r.total_bs) || 0) - (Number(r.total_ejecutado) || 0);
            }
        });

        const ltTotal = completadas.reduce((acc, r) => acc + (Number(r.dias_en_compra) || 0), 0);
        const leadTimePromedio = completadas.length > 0 ? (ltTotal / completadas.length).toFixed(1) : '-';

        return {
            activeCount: activas.length,
            completedCount: completadas.length,
            slaTasa,
            ahorro,
            leadTimePromedio,
            pendingSLA,
            overdueSLA,
            reqs: misReqs
        };
    }, [usuario, data]);

    // 7. CARGA SEMAFÓRICA Y CONSEJOS DE CAPACIDAD
    const getCapacidadInfo = (count) => {
        if (count <= 5) {
            return {
                color: '#10b981', // Verde
                label: 'Carga Ligera',
                porcentaje: Math.min(100, (count / 15) * 100),
                desc: '¡Excelente ritmo! Tienes capacidad libre para atender compras prioritarias de inmediato.'
            };
        } else if (count <= 12) {
            return {
                color: '#0ea5e9', // Azul
                label: 'Rendimiento Óptimo',
                porcentaje: Math.min(100, (count / 15) * 100),
                desc: '¡Buen ritmo! Mantienes un balance saludable en la atención de tus compras asignadas.'
            };
        } else {
            return {
                color: '#ef4444', // Rojo
                label: 'Carga de Trabajo Alta',
                porcentaje: 100,
                desc: '¡Carga de Trabajo Alta! Te sugerimos priorizar las requisiciones de Emergencia y coordinar apoyo.'
            };
        }
    };

    // 8. GUARDAR COMENTARIO / OBSERVACIÓN RÁPIDA DESDE EL DASHBOARD
    const guardarComentarioRapido = async (reqId) => {
        if (!obsTemporal.trim()) return;
        setSavingObs(true);
        try {
            const { error } = await supabase
                .from('requisiciones')
                .update({ observaciones: obsTemporal, leido_compras_at: new Date().toISOString() })
                .eq('id', reqId);

            if (error) throw error;

            // Log de auditoría
            const nombreUsuario = `${usuario?.nombre || ''} ${usuario?.apellido || ''}`.trim() || 'Analista';
            await supabase.from('requisicion_logs').insert({
                requisicion_id: reqId,
                usuario_id: usuario?.id || null,
                usuario_nombre: nombreUsuario,
                accion: 'OBSERVACION',
                comentario: `Nota rápida: "${obsTemporal}"`
            });

            toast.success("Comentario registrado con éxito en la trazabilidad.");
            setEditandoReqId(null);
            setObsTemporal('');
            fetchData();
        } catch (err) {
            toast.error("Error al registrar comentario: " + err.message);
        } finally {
            setSavingObs(false);
        }
    };

    // 9. FILTRAR DATOS OPERATIVOS PARA LA VISTA GERENTE
    const logsFiltrados = useMemo(() => {
        let items = enrichedLogs;
        
        // Filtro por Analista
        if (filtroAnalista !== 'all') {
            items = items.filter(l => l.usuario_id === filtroAnalista);
        }

        // Filtro por Tiempo
        if (filtroTiempo !== 'all') {
            const hoy = new Date();
            items = items.filter(l => {
                const fLog = new Date(l.fecha);
                const diffTime = Math.abs(hoy - fLog);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (filtroTiempo === 'week') return diffDays <= 7;
                if (filtroTiempo === 'month') return diffDays <= 30;
                return true;
            });
        }

        return items;
    }, [enrichedLogs, filtroAnalista, filtroTiempo]);

    const reqsActivasGerente = useMemo(() => {
        let items = data.filter(r => r.estado_aprobacion === 'aprobado_final' && r.status_compra?.toUpperCase() !== 'COMPLETADO');
        
        // Filtro analista
        if (filtroAnalista !== 'all') {
            items = items.filter(r => r.asignado_a === filtroAnalista);
        }

        // Búsqueda rápida
        if (busquedaReq.trim()) {
            const term = busquedaReq.toLowerCase();
            items = items.filter(r => 
                (r.correlativo_req || '').toLowerCase().includes(term) ||
                (r.solicitante || '').toLowerCase().includes(term) ||
                (r.justificacion || '').toLowerCase().includes(term)
            );
        }

        return items;
    }, [data, filtroAnalista, busquedaReq]);

    // RENDER DE PANTALLA DE CARGA
    if (loading) {
        return (
            <div style={styles.loaderContainer}>
                <RefreshCw className="animate-spin" size={40} color="#0ea5e9" />
                <h3 style={{ marginTop: '15px', color: '#1e293b', fontWeight: 'bold' }}>Procesando Trazabilidad de Procura...</h3>
            </div>
        );
    }

    return (
        <div style={styles.wrapper}>
            {/* ENCABEZADO Y SELECTOR DE VISTAS (TABS PREMIUM) */}
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>Estadísticas y Trazabilidad</h1>
                    <p style={styles.subtitle}>
                        {esGerenteDeCompras 
                            ? `Panel de Control de Gestión para Ricardo Herrera (Gerente de Compras)`
                            : `Mi Panel de Autogestión de Compras (Analista: ${usuario?.nombre} ${usuario?.apellido})`
                        }
                    </p>
                </div>

                <div style={styles.tabContainer}>
                    <button 
                        style={{...styles.tabButton, ...(activeTab === 'intelligence' ? styles.tabButtonActive : {})}}
                        onClick={() => setActiveTab('intelligence')}
                    >
                        <BarChart3 size={16} />
                        <span>Inteligencia de Procura</span>
                    </button>
                    <button 
                        style={{...styles.tabButton, ...(activeTab === 'traceability' ? styles.tabButtonActive : {})}}
                        onClick={() => setActiveTab('traceability')}
                    >
                        <Activity size={16} />
                        <span>Control de Gestión & Trazabilidad</span>
                    </button>
                </div>
            </div>

            {/* CONTENIDO DE TABS */}
            <AnimatePresence mode="wait">
                {activeTab === 'intelligence' && (
                    <motion.div 
                        key="intelligence"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.2 }}
                    >
                        {/* FILTRO DE INTELIGENCIA DE PROCURA */}
                        {/* FILTROS DE INTELIGENCIA DE PROCURA PREMIUM */}
                        <div style={styles.intelFilterRow}>
                            {/* Selector de Analista / Vista */}
                            {esGerenteDeCompras ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={styles.filterLabel}>Analista:</span>
                                    <select
                                        value={filtroAnalistaIntel}
                                        onChange={(e) => setFiltroAnalistaIntel(e.target.value)}
                                        style={styles.selectFilter}
                                    >
                                        <option value="all">🌐 Todos los Analistas (Global)</option>
                                        {analistas.map((a, idx) => (
                                            <option key={idx} value={a.id}>👤 {a.nombre} {a.apellido}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={styles.filterLabel}>Visualización:</span>
                                    <div style={styles.tabContainer}>
                                        <button
                                            style={{...styles.tabButton, ...(filtroAnalistaIntel === usuario?.id ? styles.tabButtonActive : {})}}
                                            onClick={() => setFiltroAnalistaIntel(usuario?.id || 'all')}
                                        >
                                            <User size={14} style={{ marginRight: '4px' }} />
                                            <span>Mis Estadísticas</span>
                                        </button>
                                        <button
                                            style={{...styles.tabButton, ...(filtroAnalistaIntel === 'all' ? styles.tabButtonActive : {})}}
                                            onClick={() => setFiltroAnalistaIntel('all')}
                                        >
                                            <Users size={14} style={{ marginRight: '4px' }} />
                                            <span>Promedio Global (Equipo)</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Filtro de Tiempo */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={styles.filterLabel}>Rango Temporal:</span>
                                <select
                                    value={filtroTiempoIntel}
                                    onChange={(e) => setFiltroTiempoIntel(e.target.value)}
                                    style={styles.selectFilter}
                                >
                                    <option value="all">🌐 Todo el Historial</option>
                                    <option value="week">📅 Últimos 7 Días</option>
                                    <option value="month">📅 Últimos 30 Días</option>
                                    <option value="quarter">📅 Últimos 90 Días</option>
                                </select>
                            </div>

                            {/* Filtro de Prioridad (Normal y Emergencia únicamente) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={styles.filterLabel}>Prioridad:</span>
                                <select
                                    value={filtroPrioridadIntel}
                                    onChange={(e) => setFiltroPrioridadIntel(e.target.value)}
                                    style={styles.selectFilter}
                                >
                                    <option value="all">⚡ Todas</option>
                                    <option value="Normal">🟢 Normal</option>
                                    <option value="Emergencia">🔴 Emergencia</option>
                                </select>
                            </div>

                            {/* Filtro de Centro de Costo */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={styles.filterLabel}>Centro de Costo:</span>
                                <select
                                    value={filtroCCIntel}
                                    onChange={(e) => setFiltroCCIntel(e.target.value)}
                                    style={styles.selectFilter}
                                >
                                    <option value="all">🏢 Todos los Proyectos</option>
                                    {centrosDeCostoDisponibles.map((cc, idx) => (
                                        <option key={idx} value={cc}>{cc}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Contador de registros */}
                            <div style={styles.filterCountBadge}>
                                Muestra: <strong>{dataIntelFiltrada.length}</strong> reqs
                            </div>

                            {/* Botón de limpiar todo */}
                            {(filtroAnalistaIntel !== 'all' || filtroTiempoIntel !== 'all' || filtroPrioridadIntel !== 'all' || filtroCCIntel !== 'all') && (
                                <button 
                                    style={styles.clearAllFiltersBtn} 
                                    onClick={() => {
                                        if (esGerenteDeCompras) {
                                            setFiltroAnalistaIntel('all');
                                        } else {
                                            setFiltroAnalistaIntel(usuario?.id || 'all');
                                        }
                                        setFiltroTiempoIntel('all');
                                        setFiltroPrioridadIntel('all');
                                        setFiltroCCIntel('all');
                                    }}
                                >
                                    Limpiar Filtros
                                </button>
                            )}
                        </div>

                        {stats === null ? (
                            <div style={styles.emptyIntelCard}>
                                <div style={{ textAlign: 'center', padding: '40px 20px', maxWidth: '450px' }}>
                                    <AlertTriangle size={36} color="#f59e0b" style={{ margin: '0 auto 12px auto' }} />
                                    <h4 style={{ margin: 0, color: '#1e293b', fontWeight: '800', fontSize: '1rem' }}>Sin estadísticas registradas</h4>
                                    <p style={{ margin: '8px 0 0 0', fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>
                                        El analista seleccionado no posee requisiciones asignadas en proceso o finalizadas en esta base de datos para generar métricas de Inteligencia.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* TOP ROW: KPIs GLOBALES */}
                                <div style={styles.kpiGrid}>
                                    <CompactStatCard 
                                        label="Ciclo Promedio" 
                                        value={`${stats.avgTotal}d`} 
                                        desc="Asignación a Entrega"
                                        trend={`${stats.avgCompra}d compra`} 
                                        color="#6366f1"
                                        icon={<Clock size={20} color="#6366f1" />}
                                    />
                                    <CompactStatCard 
                                        label="SLA de Eficiencia" 
                                        value={`${Math.round((stats.complianceData.find(d => d.name === 'A TIEMPO')?.value / (stats.countTotal || 1)) * 100)}%`} 
                                        desc="Cumplimiento de SLA"
                                        trend="Estándar: 5 días" 
                                        color="#10b981"
                                        icon={<ShieldCheck size={20} color="#10b981" />}
                                    />
                                    <CompactStatCard 
                                        label="Ahorros Negociados" 
                                        value={`$${(stats.ahorroTotal/1000).toFixed(1)}k`} 
                                        desc="Presupuestado vs Real"
                                        trend={`${stats.ahorroPorc}% ahorro`} 
                                        color="#0ea5e9"
                                        icon={<DollarSign size={20} color="#0ea5e9" />}
                                    />
                                    <CompactStatCard 
                                        label="Tasa de Demora" 
                                        value={`${stats.tasaPostergacion}%`} 
                                        desc="Casos pausados"
                                        trend={`${stats.countVencidos} vencidos`} 
                                        color="#f59e0b"
                                        icon={<AlertTriangle size={20} color="#f59e0b" />}
                                    />
                                </div>

                                {/* GRAFICOS GLOBALES */}
                                <div style={styles.mainGrid}>
                                    {/* Lead time por Prioridad */}
                                    <div style={styles.widgetCard}>
                                        <h3 style={styles.widgetTitle}>Lead Time de Procura por Prioridad (Días Hábiles)</h3>
                                        <p style={styles.widgetSubtitle}>Promedio de tiempo empleado por tipo de urgencia de compra</p>
                                        <div style={{ height: '220px', marginTop: '15px' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={stats.leadTimePriority}>
                                                    <defs>
                                                        <linearGradient id="colorDias" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#6366f1" strokeOpacity={0.3}/>
                                                            <stop offset="95%" stopColor="#6366f1" strokeOpacity={0}/>
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}d`} />
                                                    <Tooltip contentStyle={styles.tooltipStyle} />
                                                    <Area type="monotone" dataKey="dias" name="Días Hábiles" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorDias)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* SLA pie chart */}
                                    <div style={styles.widgetCard}>
                                        <h3 style={styles.widgetTitle}>Cumplimiento de Tiempos SLA</h3>
                                        <p style={styles.widgetSubtitle}>Proporción de requisiciones a tiempo, vencidas y pendientes</p>
                                        <div style={{ display: 'flex', alignItems: 'center', height: '220px', marginTop: '15px' }}>
                                            <div style={{ width: '55%', height: '100%' }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={stats.complianceData}
                                                            innerRadius={60}
                                                            outerRadius={85}
                                                            paddingAngle={3}
                                                            dataKey="value"
                                                        >
                                                            {stats.complianceData.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={COLORS_SLA[entry.name.toUpperCase()] || '#94a3b8'} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip contentStyle={styles.tooltipStyle} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                            <div style={{ width: '45%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {stats.complianceData.map((d, i) => (
                                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: COLORS_SLA[d.name.toUpperCase()] }} />
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#1e293b' }}>{d.name}</span>
                                                            <span style={{ fontSize: '0.6rem', color: '#64748b' }}>{d.value} reqs ({Math.round((d.value/(stats.countTotal || 1))*100)}%)</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Funnel de proceso */}
                                    <div style={styles.widgetCard}>
                                        <h3 style={styles.widgetTitle}>Embudo del Ciclo Operativo</h3>
                                        <p style={styles.widgetSubtitle}>Distribución del tiempo promedio en días por fase</p>
                                        <div style={{ height: '220px', marginTop: '15px' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={stats.funnelData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="stage" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}d`} />
                                                    <Tooltip contentStyle={styles.tooltipStyle} />
                                                    <Bar dataKey="dias" name="Días Promedio" radius={[8, 8, 0, 0]} maxBarSize={50}>
                                                        {stats.funnelData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Motivos de Pausa */}
                                    <div style={styles.widgetCard}>
                                        <h3 style={styles.widgetTitle}>Causas Frecuentes de Postergación</h3>
                                        <p style={styles.widgetSubtitle}>Categorías de retrasos explicadas por el equipo de procura</p>
                                        <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {stats.pauseReasonsData.length === 0 ? (
                                                <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '0.85rem' }}>
                                                    No se registran requisiciones pausadas o postergadas.
                                                </div>
                                            ) : (
                                                stats.pauseReasonsData.slice(0, 4).map((r, i) => (
                                                    <div key={i}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                                                            <span style={{ fontWeight: 'bold', color: '#334155' }}>{r.name}</span>
                                                            <span style={{ color: '#64748b', fontWeight: 'bold' }}>{r.value} compras</span>
                                                        </div>
                                                        <div style={styles.progressBarBg}>
                                                            <div style={{ ...styles.progressBarFill, width: `${(r.value / (stats.countTotal || 1)) * 100}%`, backgroundColor: '#f59e0b' }} />
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </motion.div>
                )}

                {activeTab === 'traceability' && (
                    <motion.div 
                        key="traceability"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.2 }}
                    >
                        {/* PERSPECTIVA A: VISTA DE GERENTE */}
                        {esGerenteDeCompras ? (
                            <>
                                {/* GRID DE ANALISTAS Y CARGAS DE TRABAJO */}
                                <div style={{ marginBottom: '20px' }}>
                                    <div style={styles.sectionHeader}>
                                        <h2 style={styles.sectionTitle}>Rendimiento y Carga de Analistas</h2>
                                        {filtroAnalista !== 'all' && (
                                            <button style={styles.clearFilterBtn} onClick={() => setFiltroAnalista('all')}>
                                                Mostrar Todos
                                            </button>
                                        )}
                                    </div>
                                    <div style={styles.analystGrid}>
                                        {analistasStats.map((a, i) => {
                                            const cap = getCapacidadInfo(a.activeCount);
                                            const esSeleccionado = filtroAnalista === a.id;
                                            return (
                                                <div 
                                                    key={i} 
                                                    style={{
                                                        ...styles.analystCard, 
                                                        borderColor: esSeleccionado ? '#0ea5e9' : '#e2e8f0',
                                                        boxShadow: esSeleccionado ? '0 10px 15px -3px rgba(14, 165, 233, 0.1), 0 4px 6px -4px rgba(14, 165, 233, 0.1)' : '0 2px 4px -1px rgba(0,0,0,0.02)',
                                                        backgroundColor: esSeleccionado ? '#f0f9ff' : 'white'
                                                    }}
                                                    onClick={() => setFiltroAnalista(esSeleccionado ? 'all' : a.id)}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <div>
                                                            <h3 style={styles.analystName}>{a.nombre} {a.apellido}</h3>
                                                            <span style={styles.analystRole}>{a.rol}</span>
                                                        </div>
                                                        <span style={{...styles.statusBadge, backgroundColor: `${cap.color}15`, color: cap.color}}>
                                                            {cap.label} ({a.activeCount})
                                                        </span>
                                                    </div>

                                                    {/* Workload bar */}
                                                    <div style={{ marginTop: '12px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#64748b', marginBottom: '3px' }}>
                                                            <span>Carga de Tareas</span>
                                                            <span>{a.activeCount} activas / {a.completedCount} cerradas</span>
                                                        </div>
                                                        <div style={styles.progressBarBg}>
                                                            <div style={{ ...styles.progressBarFill, width: `${cap.porcentaje}%`, backgroundColor: cap.color }} />
                                                        </div>
                                                    </div>

                                                    {/* stats grid */}
                                                    <div style={styles.analystStatsRow}>
                                                        <div style={styles.analystMiniStat}>
                                                            <span style={styles.analystMiniStatLabel}>Eficiencia SLA</span>
                                                            <span style={{...styles.analystMiniStatVal, color: a.slaTasa > 75 ? '#10b981' : '#f59e0b'}}>{a.slaTasa}%</span>
                                                        </div>
                                                        <div style={styles.analystMiniStat}>
                                                            <span style={styles.analystMiniStatLabel}>Ahorro Total</span>
                                                            <span style={{...styles.analystMiniStatVal, color: '#0ea5e9'}}>Bs. {a.ahorro.toLocaleString('es-VE')}</span>
                                                        </div>
                                                        <div style={styles.analystMiniStat}>
                                                            <span style={styles.analystMiniStatLabel}>Lead Time</span>
                                                            <span style={styles.analystMiniStatVal}>{a.leadTimePromedio === '-' ? '-' : `${a.leadTimePromedio}d`}</span>
                                                        </div>
                                                    </div>

                                                    <div style={styles.analystFooter}>
                                                        <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>Última gestión: {a.ultimaActividad}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* CONTENEDOR CENTRAL: TIMELINE FEED & LISTADO DETALLADO */}
                                <div style={styles.dualPanelGrid}>
                                    {/* PANEL IZQUIERDO: LIVE TIMELINE */}
                                    <div style={styles.widgetCard}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                            <div>
                                                <h3 style={styles.widgetTitle}>Live Traceability Feed (Timeline)</h3>
                                                <p style={styles.widgetSubtitle}>Últimas gestiones y actualizaciones de procura en tiempo real</p>
                                            </div>
                                            {/* Filtro de tiempo */}
                                            <select 
                                                style={styles.selectStyleCompact} 
                                                value={filtroTiempo}
                                                onChange={(e) => setFiltroTiempo(e.target.value)}
                                            >
                                                <option value="all">Todo el Historial</option>
                                                <option value="week">Última Semana</option>
                                                <option value="month">Último Mes</option>
                                            </select>
                                        </div>

                                        <div style={styles.timelineContainer}>
                                            {logsFiltrados.length === 0 ? (
                                                <div style={styles.emptyTimeline}>
                                                    <MessageSquare size={30} color="#cbd5e1" />
                                                    <p style={{ marginTop: '8px' }}>No se registran eventos con los filtros actuales.</p>
                                                </div>
                                            ) : (
                                                logsFiltrados.map((l, i) => (
                                                    <div key={i} style={styles.timelineItem}>
                                                        <div style={styles.timelineIndicator}>
                                                            <div style={{...styles.timelineDot, backgroundColor: l.accion === 'ASIGNACION' ? '#38bdf8' : l.accion === 'OBSERVACION' ? '#ec4899' : l.accion === 'FINALIZADO' ? '#10b981' : '#f59e0b'}} />
                                                            {i < logsFiltrados.length - 1 && <div style={styles.timelineLine} />}
                                                        </div>
                                                        <div style={styles.timelineCard}>
                                                            <div style={styles.timelineHeader}>
                                                                <span style={styles.timelineUser}>
                                                                    👤 {l.usuario_nombre || 'Sistema de Automatización'}
                                                                </span>
                                                                <span style={styles.timelineDate}>
                                                                    {new Date(l.fecha).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' })} - {new Date(l.fecha).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                                </span>
                                                            </div>
                                                            <div style={styles.timelineBody}>
                                                                <span style={{...styles.timelineActionBadge, backgroundColor: l.accion === 'ASIGNACION' ? '#f0f9ff' : l.accion === 'OBSERVACION' ? '#fdf2f8' : l.accion === 'FINALIZADO' ? '#ecfdf5' : '#fffbeb', color: l.accion === 'ASIGNACION' ? '#0369a1' : l.accion === 'OBSERVACION' ? '#be185d' : l.accion === 'FINALIZADO' ? '#047857' : '#b45309'}}>
                                                                    {l.accion}
                                                                </span>
                                                                <span style={styles.timelineText}>{l.comentario}</span>
                                                            </div>
                                                            <div style={styles.timelineFooter}>
                                                                <span style={styles.timelineReqRef}>REQ: {l.correlativo}</span>
                                                                <span style={styles.timelineReqSol}>Sol. por: {l.solicitante}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* PANEL DERECHO: SEGUIMIENTO OPERATIVO */}
                                    <div style={styles.widgetCard}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                            <div>
                                                <h3 style={styles.widgetTitle}>Cola de Compras Activas</h3>
                                                <p style={styles.widgetSubtitle}>Seguimiento detallado de requisiciones en proceso</p>
                                            </div>
                                            
                                            {/* Buscador */}
                                            <div style={styles.searchBox}>
                                                <Search size={14} color="#94a3b8" />
                                                <input 
                                                    type="text" 
                                                    placeholder="Buscar REQ..." 
                                                    style={styles.searchInput}
                                                    value={busquedaReq}
                                                    onChange={(e) => setBusquedaReq(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
                                            <table style={styles.table}>
                                                <thead>
                                                    <tr style={styles.tr}>
                                                        <th style={styles.th}>REQ</th>
                                                        <th style={styles.th}>Justificación / Prioridad</th>
                                                        <th style={styles.th}>Responsable</th>
                                                        <th style={styles.th}>Estado</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {reqsActivasGerente.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '0.85rem' }}>
                                                                No hay requisiciones activas que coincidan con la búsqueda.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        reqsActivasGerente.map((r, idx) => {
                                                            const colorPrioridad = r.prioridad === 'Emergencia' ? '#ef4444' : '#64748b';
                                                            return (
                                                                <tr key={idx} style={styles.tableRow}>
                                                                    <td style={{...styles.td, fontWeight: 'bold'}}>{r.correlativo_req || `REQ-${r.id}`}</td>
                                                                    <td style={styles.td}>
                                                                        <div style={{ fontSize: '0.75rem', fontWeight: '500', color: '#1e293b' }}>{r.justificacion || 'Sin justificación'}</div>
                                                                        <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: colorPrioridad }}>
                                                                            ● {r.prioridad || 'Normal'}
                                                                        </span>
                                                                    </td>
                                                                    <td style={styles.td}>
                                                                        <span style={styles.analystBadgeTable}>
                                                                            {r.asignado_nombre || '❌ SIN ASIGNAR'}
                                                                        </span>
                                                                    </td>
                                                                    <td style={styles.td}>
                                                                        <span style={{
                                                                            ...styles.statusPill,
                                                                            backgroundColor: r.status_compra?.includes('espera') ? '#fffbeb' : '#f0f9ff',
                                                                            color: r.status_compra?.includes('espera') ? '#b45309' : '#0269a1'
                                                                        }}>
                                                                            {r.status_compra || 'En proceso'}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            /* PERSPECTIVA B: VISTA DE ANALISTA INDIVIDUAL */
                            <>
                                {/* KPIs PERSONALES */}
                                <div style={styles.kpiGrid}>
                                    <CompactStatCard 
                                        label="Mis Compras Asignadas" 
                                        value={miRendimiento.activeCount} 
                                        desc="Tareas operativas activas"
                                        trend="Mi cola diaria" 
                                        color="#0ea5e9"
                                        icon={<Layers size={20} color="#0ea5e9" />}
                                    />
                                    <CompactStatCard 
                                        label="Mi Tasa SLA" 
                                        value={`${miRendimiento.slaTasa}%`} 
                                        desc="Cumplimiento personal"
                                        trend={`${miRendimiento.pendingSLA} por vencer`} 
                                        color="#10b981"
                                        icon={<Award size={20} color="#10b981" />}
                                    />
                                    <CompactStatCard 
                                        label="Mis Ahorros Negociados" 
                                        value={`Bs. ${miRendimiento.ahorro.toLocaleString('es-VE')}`} 
                                        desc="Aporte al presupuesto"
                                        trend="Mi rendimiento" 
                                        color="#ec4899"
                                        icon={<DollarSign size={20} color="#ec4899" />}
                                    />
                                    <CompactStatCard 
                                        label="Mi Lead Time Promedio" 
                                        value={miRendimiento.leadTimePromedio === '-' ? '-' : `${miRendimiento.leadTimePromedio}d`} 
                                        desc="Tiempo promedio de cierre"
                                        trend="Ciclo de procura" 
                                        color="#8b5cf6"
                                        icon={<Timer size={20} color="#8b5cf6" />}
                                    />
                                </div>

                                <div style={styles.dualPanelGrid}>
                                    {/* TERMÓMETRO DE CARGA E INSTRUCCIONES */}
                                    <div style={{...styles.widgetCard, display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
                                        <div>
                                            <h3 style={styles.widgetTitle}>Mi Medidor de Capacidad</h3>
                                            <p style={styles.widgetSubtitle}>Evaluación de mi carga laboral de compras activas asignadas</p>
                                        </div>

                                        {/* Velocímetro visual */}
                                        {(() => {
                                            const cap = getCapacidadInfo(miRendimiento.activeCount);
                                            return (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0' }}>
                                                    <div style={styles.gaugeContainer}>
                                                        <div style={{...styles.gaugeBackCircle, borderColor: '#f1f5f9'}} />
                                                        <div style={{
                                                            ...styles.gaugeFillCircle, 
                                                            borderColor: cap.color,
                                                            transform: `rotate(${Math.min(180, (miRendimiento.activeCount / 15) * 180)}deg)`
                                                        }} />
                                                        <div style={styles.gaugeInnerContent}>
                                                            <span style={{...styles.gaugeValue, color: cap.color}}>{miRendimiento.activeCount}</span>
                                                            <span style={styles.gaugeLabel}>Compras Activas</span>
                                                        </div>
                                                    </div>

                                                    <h4 style={{...styles.gaugeStateLabel, color: cap.color}}>{cap.label}</h4>
                                                    <p style={styles.gaugeStateDesc}>{cap.desc}</p>
                                                </div>
                                            );
                                        })()}

                                        <div style={styles.alertNoteStyle}>
                                            <HelpCircle size={16} color="#6366f1" style={{ flexShrink: 0 }} />
                                            <span style={{ fontSize: '0.65rem', color: '#475569', lineHeight: '1.4' }}>
                                                <strong>Tip Operativo:</strong> Si tu carga de compras supera las 12 requisiciones, te aconsejamos apoyarte en el Gerente de Compras (Ricardo Herrera) para delegar transacciones de prioridad Normal.
                                            </span>
                                        </div>
                                    </div>

                                    {/* TIMELINE CRONOLÓGICO INDIVIDUAL */}
                                    <div style={styles.widgetCard}>
                                        <div>
                                            <h3 style={styles.widgetTitle}>Mi Historial de Actividad</h3>
                                            <p style={styles.widgetSubtitle}>Mis últimas gestiones registradas en el sistema</p>
                                        </div>

                                        <div style={{...styles.timelineContainer, height: '290px', marginTop: '15px'}}>
                                            {(() => {
                                                const misLogs = logsFiltrados.filter(l => l.usuario_id === usuario?.id);
                                                return misLogs.length === 0 ? (
                                                    <div style={styles.emptyTimeline}>
                                                        <MessageSquare size={30} color="#cbd5e1" />
                                                        <p style={{ marginTop: '8px' }}>No has realizado acciones recientemente.</p>
                                                    </div>
                                                ) : (
                                                    misLogs.map((l, i) => (
                                                        <div key={i} style={styles.timelineItem}>
                                                            <div style={styles.timelineIndicator}>
                                                                <div style={{...styles.timelineDot, backgroundColor: l.accion === 'ASIGNACION' ? '#38bdf8' : l.accion === 'OBSERVACION' ? '#ec4899' : l.accion === 'FINALIZADO' ? '#10b981' : '#f59e0b'}} />
                                                                {i < misLogs.length - 1 && <div style={styles.timelineLine} />}
                                                            </div>
                                                            <div style={styles.timelineCard}>
                                                                <div style={styles.timelineHeader}>
                                                                    <span style={styles.timelineUser}>📝 {l.accion}</span>
                                                                    <span style={styles.timelineDate}>
                                                                        {new Date(l.fecha).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' })} - {new Date(l.fecha).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                                    </span>
                                                                </div>
                                                                <p style={{...styles.timelineText, margin: '5px 0'}}>{l.comentario}</p>
                                                                <span style={{ fontSize: '0.6rem', fontWeight: 'bold', color: '#64748b' }}>REQ: {l.correlativo}</span>
                                                            </div>
                                                        </div>
                                                    ))
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* COLA DE COMPRAS DEL ANALISTA */}
                                <div style={{...styles.widgetCard, marginTop: '20px'}}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                        <div>
                                            <h3 style={styles.widgetTitle}>Mi Cola de Trabajo Activa</h3>
                                            <p style={styles.widgetSubtitle}>Actualiza tus observaciones de procura de manera rápida</p>
                                        </div>
                                    </div>

                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={styles.table}>
                                            <thead>
                                                <tr style={styles.tr}>
                                                    <th style={styles.th}>REQ</th>
                                                    <th style={styles.th}>Solicitante</th>
                                                    <th style={styles.th}>Prioridad / SLA</th>
                                                    <th style={styles.th}>Observación Actual de Procura</th>
                                                    <th style={{...styles.th, textAlign: 'center'}}>Acciones rápidas</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {miRendimiento.reqs.filter(r => r.estado_aprobacion === 'aprobado_final' && r.status_compra?.toUpperCase() !== 'COMPLETADO').length === 0 ? (
                                                    <tr>
                                                        <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '0.85rem' }}>
                                                            ¡Felicidades! No tienes requisiciones pendientes asignadas en tu cola de trabajo.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    miRendimiento.reqs.filter(r => r.estado_aprobacion === 'aprobado_final' && r.status_compra?.toUpperCase() !== 'COMPLETADO').map((r, idx) => {
                                                        const colorPrioridad = r.prioridad === 'Emergencia' ? '#ef4444' : '#64748b';
                                                        const colorSLA = COLORS_SLA[r.sla_cumplimiento] || '#64748b';
                                                        
                                                        return (
                                                            <tr key={idx} style={styles.tableRow}>
                                                                <td style={{...styles.td, fontWeight: 'bold'}}>{r.correlativo_req || `REQ-${r.id}`}</td>
                                                                <td style={styles.td}>{r.solicitante}</td>
                                                                <td style={styles.td}>
                                                                    <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: colorPrioridad, display: 'block' }}>
                                                                        ● Prioridad: {r.prioridad || 'Normal'}
                                                                    </span>
                                                                    <span style={{ fontSize: '0.65rem', color: colorSLA, fontWeight: 'bold' }}>
                                                                        SLA: {r.sla_cumplimiento || 'PENDIENTE'}
                                                                    </span>
                                                                </td>
                                                                <td style={{...styles.td, maxWidth: '300px'}}>
                                                                    {editandoReqId === r.id ? (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                                            <textarea
                                                                                style={styles.textareaStyle}
                                                                                value={obsTemporal}
                                                                                onChange={(e) => setObsTemporal(e.target.value)}
                                                                                placeholder="Escribe un comentario..."
                                                                            />
                                                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                                                <button 
                                                                                    style={styles.saveBtnCompact}
                                                                                    onClick={() => guardarComentarioRapido(r.id)}
                                                                                    disabled={savingObs}
                                                                                >
                                                                                    {savingObs ? 'Guardando...' : <Check size={12} />}
                                                                                </button>
                                                                                <button 
                                                                                    style={styles.cancelBtnCompact}
                                                                                    onClick={() => { setEditandoReqId(null); setObsTemporal(''); }}
                                                                                    disabled={savingObs}
                                                                                >
                                                                                    <XCircle size={12} />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <span style={{ fontSize: '0.75rem', color: '#475569', fontStyle: r.observaciones ? 'normal' : 'italic' }}>
                                                                            {r.observaciones || 'Sin observaciones registradas'}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td style={{...styles.td, textAlign: 'center'}}>
                                                                    {editandoReqId !== r.id && (
                                                                        <button 
                                                                            style={styles.btnPrimaryCompact}
                                                                            onClick={() => {
                                                                                setEditandoReqId(r.id);
                                                                                setObsTemporal(r.observaciones || '');
                                                                            }}
                                                                        >
                                                                            <MessageSquare size={13} />
                                                                            <span>Comentar</span>
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// COMPONENTE AUXILIAR COMPACTSTATCARD
const CompactStatCard = ({ label, value, desc, trend, color, icon }) => (
    <div style={styles.compactStatCard}>
        <div style={{ flex: 1 }}>
            <span style={styles.compactLabel}>{label}</span>
            <h2 style={styles.compactValue}>{value}</h2>
            <p style={styles.compactDesc}>{desc}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', height: '100%' }}>
            <div style={{...styles.iconWrapper, backgroundColor: `${color}15`}}>{icon}</div>
            <span style={{...styles.trendText, color: color}}>{trend}</span>
        </div>
    </div>
);

// ESTILOS EN JAVASCRIPT OBJECTS (CURATED MODERN PALETTE & GLASSMORPHISM)
const styles = {
    wrapper: {
        padding: '20px',
        backgroundColor: '#f8fafc',
        minHeight: '100vh',
        fontFamily: "'Inter', sans-serif",
        boxSizing: 'border-box'
    },
    intelFilterRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '15px',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: '12px 20px',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        marginBottom: '20px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)'
    },
    selectFilter: {
        padding: '8px 12px',
        borderRadius: '10px',
        border: '1px solid #cbd5e1',
        backgroundColor: '#f8fafc',
        fontSize: '0.72rem',
        fontWeight: 'bold',
        color: '#334155',
        outline: 'none',
        cursor: 'pointer',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.02)',
        transition: 'all 0.2s',
        minWidth: '150px'
    },
    filterLabel: {
        fontSize: '0.72rem',
        fontWeight: '800',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: '0.3px'
    },
    filterCountBadge: {
        marginLeft: 'auto',
        backgroundColor: '#f0f9ff',
        color: '#0369a1',
        padding: '6px 12px',
        borderRadius: '8px',
        fontSize: '0.7rem',
        fontWeight: 'bold',
        border: '1px solid #b3e0ff'
    },
    clearAllFiltersBtn: {
        backgroundColor: '#f1f5f9',
        border: '1px solid #cbd5e1',
        padding: '8px 14px',
        borderRadius: '10px',
        fontSize: '0.72rem',
        fontWeight: 'bold',
        color: '#475569',
        cursor: 'pointer',
        transition: 'all 0.2s'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '15px',
        marginBottom: '20px',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '15px'
    },
    title: {
        fontSize: '1.4rem',
        fontWeight: 900,
        color: '#0f172a',
        margin: 0,
        letterSpacing: '-0.5px'
    },
    subtitle: {
        fontSize: '0.75rem',
        color: '#64748b',
        margin: '3px 0 0 0',
        fontWeight: '500'
    },
    tabContainer: {
        display: 'flex',
        backgroundColor: '#f1f5f9',
        padding: '4px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0'
    },
    tabButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        border: 'none',
        background: 'none',
        padding: '8px 16px',
        borderRadius: '10px',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        color: '#64748b',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
    },
    tabButtonActive: {
        backgroundColor: 'white',
        color: '#0ea5e9',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)'
    },
    kpiGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '15px',
        marginBottom: '20px'
    },
    compactStatCard: {
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '16px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '95px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.01), 0 2px 4px -2px rgba(0, 0, 0, 0.01)'
    },
    compactLabel: {
        fontSize: '0.65rem',
        fontWeight: 'bold',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
    },
    compactValue: {
        fontSize: '1.3rem',
        fontWeight: 950,
        color: '#0f172a',
        margin: '4px 0 0 0'
    },
    compactDesc: {
        fontSize: '0.65rem',
        color: '#64748b',
        margin: '2px 0 0 0',
        fontWeight: '500'
    },
    iconWrapper: {
        width: '36px',
        height: '36px',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    trendText: {
        fontSize: '0.65rem',
        fontWeight: 'bold',
        marginTop: '10px'
    },
    mainGrid: {
        display: 'grid',
        gridTemplateColumns: '1.3fr 1fr',
        gap: '15px',
        marginBottom: '15px'
    },
    widgetCard: {
        backgroundColor: 'white',
        borderRadius: '20px',
        padding: '20px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.01)'
    },
    widgetTitle: {
        fontSize: '0.85rem',
        fontWeight: 900,
        color: '#0f172a',
        margin: 0
    },
    widgetSubtitle: {
        fontSize: '0.68rem',
        color: '#94a3b8',
        margin: '3px 0 0 0',
        fontWeight: '500'
    },
    progressBarBg: {
        width: '100%',
        height: '6px',
        backgroundColor: '#f1f5f9',
        borderRadius: '3px',
        overflow: 'hidden'
    },
    progressBarFill: {
        height: '100%',
        borderRadius: '3px',
        transition: 'width 0.5s ease-out'
    },
    legendRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    },
    legendDot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        flexShrink: 0
    },
    legendLabel: {
        fontSize: '0.65rem',
        fontWeight: 'bold',
        color: '#64748b'
    },
    legendValue: {
        fontSize: '0.7rem',
        fontWeight: 'bold',
        color: '#0f172a'
    },
    tooltipStyle: {
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)',
        fontSize: '0.75rem',
        fontWeight: 'bold'
    },
    sectionHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
    },
    sectionTitle: {
        fontSize: '0.9rem',
        fontWeight: 900,
        color: '#0f172a',
        margin: 0
    },
    clearFilterBtn: {
        backgroundColor: '#f1f5f9',
        border: '1px solid #cbd5e1',
        padding: '5px 12px',
        borderRadius: '8px',
        fontSize: '0.65rem',
        fontWeight: 'bold',
        color: '#475569',
        cursor: 'pointer',
        transition: 'all 0.2s'
    },
    analystGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '15px'
    },
    analystCard: {
        borderWidth: '1.5px',
        borderStyle: 'solid',
        borderRadius: '20px',
        padding: '16px',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    },
    analystName: {
        fontSize: '0.85rem',
        fontWeight: 900,
        color: '#0f172a',
        margin: 0
    },
    analystRole: {
        fontSize: '0.65rem',
        color: '#94a3b8',
        fontWeight: 'bold'
    },
    statusBadge: {
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '0.6rem',
        fontWeight: 'bold'
    },
    analystStatsRow: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '10px',
        marginTop: '15px',
        borderTop: '1px solid #f1f5f9',
        paddingTop: '12px'
    },
    analystMiniStat: {
        display: 'flex',
        flexDirection: 'column'
    },
    analystMiniStatLabel: {
        fontSize: '0.55rem',
        color: '#94a3b8',
        fontWeight: 'bold',
        textTransform: 'uppercase'
    },
    analystMiniStatVal: {
        fontSize: '0.75rem',
        fontWeight: 900,
        color: '#0f172a',
        marginTop: '2px'
    },
    analystFooter: {
        marginTop: '10px',
        borderTop: '1px solid #f8fafc',
        paddingTop: '6px',
        display: 'flex',
        justifyContent: 'flex-end'
    },
    dualPanelGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '15px',
        marginTop: '20px'
    },
    selectStyleCompact: {
        padding: '6px 10px',
        borderRadius: '8px',
        border: '1px solid #cbd5e1',
        fontSize: '0.68rem',
        fontWeight: 'bold',
        color: '#475569',
        outline: 'none',
        cursor: 'pointer'
    },
    timelineContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        maxHeight: '420px',
        overflowY: 'auto',
        paddingRight: '5px'
    },
    emptyTimeline: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '200px',
        color: '#94a3b8',
        fontSize: '0.75rem'
    },
    timelineItem: {
        display: 'flex',
        gap: '12px'
    },
    timelineIndicator: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '12px'
    },
    timelineDot: {
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        zIndex: 5,
        marginTop: '5px'
    },
    timelineLine: {
        width: '2px',
        flex: 1,
        backgroundColor: '#e2e8f0',
        marginTop: '4px'
    },
    timelineCard: {
        flex: 1,
        backgroundColor: '#f8fafc',
        border: '1px solid #f1f5f9',
        borderRadius: '12px',
        padding: '10px 12px'
    },
    timelineHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.65rem'
    },
    timelineUser: {
        fontWeight: 'bold',
        color: '#1e293b'
    },
    timelineDate: {
        color: '#94a3b8',
        fontWeight: '500'
    },
    timelineBody: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '6px',
        marginTop: '6px'
    },
    timelineActionBadge: {
        fontSize: '0.55rem',
        fontWeight: 800,
        padding: '1px 5px',
        borderRadius: '4px',
        textTransform: 'uppercase'
    },
    timelineText: {
        fontSize: '0.72rem',
        color: '#475569',
        lineHeight: 1.3
    },
    timelineFooter: {
        marginTop: '8px',
        borderTop: '1px dashed #e2e8f0',
        paddingTop: '4px',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.58rem',
        color: '#94a3b8',
        fontWeight: 'bold'
    },
    timelineReqRef: {
        color: '#6366f1'
    },
    timelineReqSol: {
        color: '#64748b'
    },
    searchBox: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        padding: '4px 10px',
        width: '160px'
    },
    searchInput: {
        border: 'none',
        outline: 'none',
        fontSize: '0.7rem',
        color: '#1e293b',
        fontWeight: 'bold',
        width: '100%'
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '0.75rem',
        textAlign: 'left'
    },
    tr: {
        borderBottom: '1px solid #e2e8f0'
    },
    th: {
        padding: '8px 10px',
        color: '#94a3b8',
        fontWeight: 'bold',
        fontSize: '0.65rem',
        textTransform: 'uppercase'
    },
    tableRow: {
        borderBottom: '1px solid #f1f5f9',
        transition: 'background-color 0.2s'
    },
    td: {
        padding: '10px',
        color: '#475569'
    },
    analystBadgeTable: {
        backgroundColor: '#f1f5f9',
        color: '#334155',
        padding: '3px 8px',
        borderRadius: '6px',
        fontWeight: 'bold',
        fontSize: '0.65rem'
    },
    statusPill: {
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '0.65rem',
        fontWeight: 'bold',
        textTransform: 'uppercase'
    },
    gaugeContainer: {
        width: '110px',
        height: '55px',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'center'
    },
    gaugeBackCircle: {
        width: '100px',
        height: '100px',
        borderRadius: '50%',
        borderWidth: '10px',
        borderStyle: 'solid',
        position: 'absolute',
        bottom: 0
    },
    gaugeFillCircle: {
        width: '100px',
        height: '100px',
        borderRadius: '50%',
        borderWidth: '10px',
        borderStyle: 'solid',
        borderLeftColor: 'transparent',
        borderBottomColor: 'transparent',
        position: 'absolute',
        bottom: 0,
        transformOrigin: '50% 50%',
        transition: 'transform 0.5s ease-out'
    },
    gaugeInnerContent: {
        position: 'absolute',
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
    },
    gaugeValue: {
        fontSize: '1.4rem',
        fontWeight: 950
    },
    gaugeLabel: {
        fontSize: '0.5rem',
        color: '#94a3b8',
        textTransform: 'uppercase',
        fontWeight: 'bold'
    },
    gaugeStateLabel: {
        margin: '10px 0 0 0',
        fontSize: '0.85rem',
        fontWeight: 900
    },
    gaugeStateDesc: {
        fontSize: '0.68rem',
        color: '#64748b',
        textAlign: 'center',
        margin: '5px 15px 0 15px',
        lineHeight: 1.3,
        fontWeight: '500'
    },
    alertNoteStyle: {
        display: 'flex',
        gap: '8px',
        backgroundColor: '#e0e7ff30',
        border: '1px solid #e0e7ff',
        padding: '10px',
        borderRadius: '12px',
        marginTop: '15px'
    },
    textareaStyle: {
        width: '100%',
        height: '40px',
        borderRadius: '8px',
        border: '1px solid #cbd5e1',
        padding: '6px',
        fontSize: '0.7rem',
        outline: 'none',
        resize: 'none',
        boxSizing: 'border-box'
    },
    saveBtnCompact: {
        backgroundColor: '#10b981',
        color: 'white',
        border: 'none',
        padding: '4px 8px',
        borderRadius: '4px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    cancelBtnCompact: {
        backgroundColor: '#f1f5f9',
        color: '#64748b',
        border: '1px solid #cbd5e1',
        padding: '4px 8px',
        borderRadius: '4px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    btnPrimaryCompact: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        backgroundColor: '#0ea5e915',
        color: '#0ea5e9',
        border: 'none',
        padding: '5px 10px',
        borderRadius: '6px',
        fontSize: '0.65rem',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'all 0.2s'
    },
    loaderContainer: {
        height: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', sans-serif"
    }
};

export default AnalyticsCompras;
