import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { 
  Server, 
  Activity, 
  HardDrive, 
  ShieldAlert, 
  Clock, 
  ArrowLeft, 
  RefreshCw, 
  Ban, 
  TrendingUp, 
  UserCheck, 
  Cpu,
  Database,
  DollarSign,
  ExternalLink,
  ChevronDown,
  Calendar,
  Smartphone,
  Shield,
  Search,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import ModalNovedades from './components/ModalNovedades';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  BarChart, 
  Bar, 
  Legend,
  LineChart,
  Line
} from 'recharts';
import './AdminAnalytics.css';
import toast from 'react-hot-toast';

export default function AdminAnalytics() {
  const navigate = useNavigate();
  
  // Auth and authorization states
  const [currentUser, setCurrentUser] = useState(null);
  const [authorized, setAuthorized] = useState(null); // null = checking, false = denied, true = OK
  const [loading, setLoading] = useState(true);

  // Tabs: 'telemetry', 'management', or 'user_audit'
  const [activeTab, setActiveTab] = useState('telemetry');

  // Date Range Picker States (Default last 30 days)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Telemetry raw data from Supabase
  const [systemErrors, setSystemErrors] = useState([]);
  const [hourlyTraffic, setHourlyTraffic] = useState([]);
  const [storageStats, setStorageStats] = useState([]);
  const [dbLatency, setDbLatency] = useState(0);
  const [testingLatency, setTestingLatency] = useState(false);
  const [largestFiles, setLargestFiles] = useState([]);
  
  // Versions and Changelog state
  const [nuevaVersion, setNuevaVersion] = useState({ version: '', descripcion: '', notificar: false });
  const [modalPreviewOpen, setModalPreviewOpen] = useState(false);
  const [guardandoVersion, setGuardandoVersion] = useState(false);

  const registrarVersion = async (e) => {
    e.preventDefault();
    if (!nuevaVersion.version) return toast.error('El número de versión es obligatorio');
    if (!nuevaVersion.descripcion) return toast.error('La descripción de cambios es obligatoria');
    setGuardandoVersion(true);
    try {
      const { error } = await supabase
        .from('sistema_versiones')
        .upsert([{
          version: nuevaVersion.version,
          descripcion: nuevaVersion.descripcion,
          notificar_usuarios: nuevaVersion.notificar
        }], { onConflict: 'version' });

      if (error) throw error;
      toast.success(`Versión ${nuevaVersion.version} guardada correctamente ✓`);
      setNuevaVersion({ version: '', descripcion: '', notificar: false });
    } catch (err) {
      toast.error('Error al registrar versión: ' + err?.message);
    } finally {
      setGuardandoVersion(false);
    }
  };

  // Operational raw data
  const [requisiciones, setRequisiciones] = useState([]);
  const [requisicionLogs, setRequisicionLogs] = useState([]);
  const [ticketsDirectos, setTicketsDirectos] = useState([]);
  const [perfiles, setPerfiles] = useState([]);
  const [authAttempts, setAuthAttempts] = useState([]);
  const [profileChanges, setProfileChanges] = useState([]);

  // Drill-down UI states
  const [showSlaDetails, setShowSlaDetails] = useState(false);
  const [showRejectionDetails, setShowRejectionDetails] = useState(false);
  const [selectedDeptoFilter, setSelectedDeptoFilter] = useState('TODOS');
  const [traceabilityDeptoFilter, setTraceabilityDeptoFilter] = useState('TODOS');
  const [onlineUsers, setOnlineUsers] = useState([]);

  // Suscribirse a co-presencia global para usuarios en línea
  useEffect(() => {
    const channel = supabase.channel('sitc_global_presence');

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.entries(state).flatMap(([ref, presences]) => {
          return presences.map(p => ({
            presence_ref: ref,
            user_id: p.user_id,
            nombre: p.nombre,
            apellido: p.apellido,
            rol: p.rol,
            departamento: p.departamento,
            correo: p.correo,
            online_at: p.online_at
          }));
        });

        // Deduplicar por user_id
        const uniqueUsers = [];
        const seen = new Set();
        for (const u of users) {
          if (u.user_id && !seen.has(u.user_id)) {
            seen.add(u.user_id);
            uniqueUsers.push(u);
          }
        }
        setOnlineUsers(uniqueUsers);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Check Auth & Role
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setAuthorized(false);
          navigate('/');
          return;
        }

        const { data: perfil, error } = await supabase
          .from('perfiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error || !perfil) {
          console.error("Error cargando perfil administrador:", error);
          setAuthorized(false);
          return;
        }

        const rolUpper = (perfil.rol || '').toUpperCase();
        const emailLower = (session.user.email || '').toLowerCase();
        const isSuperAdmin = emailLower === 'jcontreras.totalclean@gmail.com';
        const isCarlos = emailLower === 'cvega.totalclean@gmail.com' || emailLower === 'cvega@totalclean.com';

        const hasAdminAccess = rolUpper === 'ADMINISTRADOR' || rolUpper === 'ADMIN' || rolUpper === 'DESARROLLADOR' || isSuperAdmin || isCarlos;

        if (!hasAdminAccess) {
          console.warn("Acceso denegado a telemetría para el rol:", perfil.rol);
          setAuthorized(false);
          setTimeout(() => navigate('/dashboard'), 3000);
        } else {
          setCurrentUser(perfil);
          setAuthorized(true);
        }
      } catch (err) {
        console.error("Excepción en verificación de autenticación:", err);
        setAuthorized(false);
      }
    }
    checkAuth();
  }, [navigate]);

  // Load telemetry and analytical data
  const cargarDatos = async () => {
    if (!authorized) return;
    setLoading(true);
    try {
      // 1. Live db speed latency check
      await testLatency();

      // 2. Fetch error logs
      const { data: errorsData } = await supabase
        .from('system_errors')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setSystemErrors(errorsData || []);

      // 3. Fetch storage bucket metrics
      const { data: storageRpc, error: storageRpcError } = await supabase.rpc('get_storage_stats');
      if (!storageRpcError && storageRpc) {
        setStorageStats(storageRpc);
      } else {
        console.warn("get_storage_stats RPC falló, calculando localmente:", storageRpcError);
        const buckets = ['facturas', 'tickets-evidencia'];
        const fallbackStorage = [];
        for (const bucket of buckets) {
          const { data: files } = await supabase.storage.from(bucket).list('', { limit: 100 });
          const totalSize = (files || []).reduce((acc, f) => acc + (f.metadata?.size || 0), 0);
          fallbackStorage.push({
            bucket_id: bucket,
            total_bytes: totalSize,
            files_count: files?.length || 0
          });
        }
        setStorageStats(fallbackStorage);
      }

      // 4. Fetch traffic distribution RPC
      const { data: trafficRpc, error: trafficRpcError } = await supabase.rpc('get_hourly_traffic');
      if (!trafficRpcError && trafficRpc) {
        setHourlyTraffic(trafficRpc);
      } else {
        console.warn("get_hourly_traffic RPC falló, usando datos mockeados:", trafficRpcError);
        const dummyTraffic = Array.from({ length: 24 }, (_, i) => ({
          hora: i,
          requisiciones_count: Math.floor(Math.random() * 8) + 2,
          solicitudes_count: Math.floor(Math.random() * 5) + 1
        }));
        setHourlyTraffic(dummyTraffic);
      }

      // 5. Fetch requisiciones for gerencia reports
      const { data: reqs } = await supabase
        .from('requisiciones')
        .select('id, correlativo_req, created_at, fecha_aprobacion_final, gerencia, estado_aprobacion, total_bs, solicitante, items');
      setRequisiciones(reqs || []);

      // 6. Fetch requisiciones audit action logs
      const { data: logs } = await supabase
        .from('requisicion_logs')
        .select('id, requisicion_id, accion, comentario, fecha, usuario_nombre');
      setRequisicionLogs(logs || []);

      // 7. Fetch active perfiles count
      const { data: profiles } = await supabase
        .from('perfiles')
        .select('id, nombre, apellido, rol, departamento, activo, last_login, created_at')
        .order('created_at', { ascending: false });
      setPerfiles(profiles || []);

      // 8. Fetch largest files (Storage Bloat)
      const { data: filesRpc, error: filesRpcError } = await supabase.rpc('get_largest_files');
      if (!filesRpcError && filesRpc) {
        setLargestFiles(filesRpc);
      } else {
        console.warn("get_largest_files RPC falló, calculando localmente:", filesRpcError);
        const { data: list } = await supabase.storage.from('facturas').list('', { limit: 100 });
        const mapped = (list || []).map(f => ({
          name: f.name,
          bucket_id: 'facturas',
          size: f.metadata?.size || 0,
          created_at: f.created_at,
          owner_id: null
        })).sort((a, b) => b.size - a.size).slice(0, 10);
        setLargestFiles(mapped);
      }

      // 9. Fetch user auth logs
      const { data: authLogs } = await supabase
        .from('user_auth_logs')
        .select('*')
        .order('created_at', { ascending: false });
      setAuthAttempts(authLogs || []);

      // 10. Fetch user profiles modification logs
      const { data: actLogs } = await supabase
        .from('logs_actividad')
        .select('*')
        .eq('modulo', 'Usuarios')
        .order('created_at', { ascending: false });
      setProfileChanges(actLogs || []);

      // 11. Fetch tickets_directos for operational comparison
      const { data: tkts } = await supabase
        .from('tickets_directos')
        .select('id, fecha_emision, departamento, total_usd');
      setTicketsDirectos(tkts || []);

    } catch (err) {
      console.error("Error cargando métricas de telemetría:", err);
    } finally {
      setLoading(false);
    }
  };

  // Refresco silencioso: solo actualiza datos operativos sin mostrar pantalla de carga
  const refrescarDatosSilencioso = async () => {
    try {
      const { data: reqs } = await supabase
        .from('requisiciones')
        .select('id, correlativo_req, created_at, fecha_aprobacion_final, gerencia, estado_aprobacion, total_bs, solicitante, items');
      setRequisiciones(reqs || []);

      const { data: logs } = await supabase
        .from('requisicion_logs')
        .select('id, requisicion_id, accion, comentario, fecha, usuario_nombre');
      setRequisicionLogs(logs || []);
    } catch (err) {
      console.warn("Error en refresco silencioso:", err);
    }
  };

  useEffect(() => {
    if (authorized === true) {
      cargarDatos();

      // Realtime subscription for requisiciones (silencioso, sin pantalla de carga)
      const reqChannel = supabase
        .channel('realtime_reqs_analytics')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'requisiciones' }, () => {
          refrescarDatosSilencioso();
        })
        .subscribe();

      // Realtime subscription for requisicion_logs (silencioso, sin pantalla de carga)
      const logsChannel = supabase
        .channel('realtime_logs_analytics')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'requisicion_logs' }, () => {
          refrescarDatosSilencioso();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(reqChannel);
        supabase.removeChannel(logsChannel);
      };
    }
  }, [authorized]);

  // DB Latency speed test execution
  const testLatency = async () => {
    setTestingLatency(true);
    try {
      const t0 = performance.now();
      await supabase.from('perfiles').select('id').limit(1);
      const t1 = performance.now();
      setDbLatency(Math.round(t1 - t0));
    } catch (e) {
      console.error("Error midiendo velocidad de Supabase:", e);
    } finally {
      setTestingLatency(false);
    }
  };

  // ----------------------------------------------------
  // GLOBAL CLIENT-SIDE FILTERING BY DATE RANGE Picker
  // ----------------------------------------------------
  const dateLimits = useMemo(() => {
    if (!startDate || !endDate) return { start: null, end: null };
    return {
      start: new Date(startDate + 'T00:00:00'),
      end: new Date(endDate + 'T23:59:59')
    };
  }, [startDate, endDate]);

  const filteredRequisiciones = useMemo(() => {
    const { start, end } = dateLimits;
    if (!start || !end) return requisiciones;
    return requisiciones.filter(r => {
      const date = new Date(r.created_at);
      return date >= start && date <= end;
    });
  }, [requisiciones, dateLimits]);

  const filteredRequisicionLogs = useMemo(() => {
    const { start, end } = dateLimits;
    if (!start || !end) return requisicionLogs;
    return requisicionLogs.filter(l => {
      const date = new Date(l.fecha || l.created_at);
      return date >= start && date <= end;
    });
  }, [requisicionLogs, dateLimits]);

  const filteredSystemErrors = useMemo(() => {
    const { start, end } = dateLimits;
    if (!start || !end) return systemErrors;
    return systemErrors.filter(e => {
      const date = new Date(e.created_at);
      return date >= start && date <= end;
    });
  }, [systemErrors, dateLimits]);

  const filteredAuthAttempts = useMemo(() => {
    const { start, end } = dateLimits;
    if (!start || !end) return authAttempts;
    return authAttempts.filter(log => {
      const date = new Date(log.created_at);
      return date >= start && date <= end;
    });
  }, [authAttempts, dateLimits]);

  const filteredProfileChanges = useMemo(() => {
    const { start, end } = dateLimits;
    if (!start || !end) return profileChanges;
    return profileChanges.filter(log => {
      const date = new Date(log.created_at);
      return date >= start && date <= end;
    });
  }, [profileChanges, dateLimits]);

  // Traceability Memo Calculations
  const listTraceabilityDeptos = useMemo(() => {
    const deptos = new Set();
    requisiciones.forEach(r => {
      if (r.gerencia) deptos.add(r.gerencia);
    });
    ticketsDirectos.forEach(t => {
      if (t.departamento) deptos.add(t.departamento);
    });
    return Array.from(deptos).sort();
  }, [requisiciones, ticketsDirectos]);

  const filteredReqsForTraceability = useMemo(() => {
    const { start, end } = dateLimits;
    let list = requisiciones;
    if (start && end) {
      list = list.filter(r => {
        const date = new Date(r.created_at);
        return date >= start && date <= end;
      });
    }
    if (traceabilityDeptoFilter !== 'TODOS') {
      list = list.filter(r => (r.gerencia || '').toUpperCase() === traceabilityDeptoFilter.toUpperCase());
    }
    return list;
  }, [requisiciones, dateLimits, traceabilityDeptoFilter]);

  const filteredTicketsForTraceability = useMemo(() => {
    const { start, end } = dateLimits;
    let list = ticketsDirectos;
    if (start && end) {
      list = list.filter(t => {
        const date = t.fecha_emision ? new Date(t.fecha_emision + 'T12:00:00') : new Date();
        return date >= start && date <= end;
      });
    }
    if (traceabilityDeptoFilter !== 'TODOS') {
      list = list.filter(t => (t.departamento || '').toUpperCase() === traceabilityDeptoFilter.toUpperCase());
    }
    return list;
  }, [ticketsDirectos, dateLimits, traceabilityDeptoFilter]);

  const filteredLogsForTraceability = useMemo(() => {
    const { start, end } = dateLimits;
    let list = requisicionLogs;
    if (start && end) {
      list = list.filter(l => {
        const date = new Date(l.fecha || l.created_at);
        return date >= start && date <= end;
      });
    }
    return list.filter(l => {
      const req = requisiciones.find(r => r.id === l.requisicion_id);
      if (!req) return false;
      if (traceabilityDeptoFilter !== 'TODOS') {
        return (req.gerencia || '').toUpperCase() === traceabilityDeptoFilter.toUpperCase();
      }
      return true;
    });
  }, [requisicionLogs, requisiciones, dateLimits, traceabilityDeptoFilter]);

  const dailyTraceabilityData = useMemo(() => {
    const { start, end } = dateLimits;
    if (!start || !end) return [];

    const datesMap = {};
    let current = new Date(start);
    const endLimit = new Date(end);

    while (current <= endLimit) {
      const dateStr = current.toISOString().split('T')[0];
      const [year, month, day] = dateStr.split('-');
      const label = `${day}/${month}`;
      datesMap[dateStr] = {
        dateStr,
        label,
        emitidas: 0,
        aprobadas: 0,
        rechazadas: 0,
        tickets: 0
      };
      current.setDate(current.getDate() + 1);
    }

    filteredReqsForTraceability.forEach(r => {
      if (r.created_at) {
        const dateStr = new Date(r.created_at).toISOString().split('T')[0];
        if (datesMap[dateStr]) {
          datesMap[dateStr].emitidas += 1;
        }
      }
    });

    filteredReqsForTraceability.forEach(r => {
      if (r.fecha_aprobacion_final && (r.estado_aprobacion === 'aprobado_final' || r.estado_aprobacion === 'APROBADO_FINAL')) {
        const dateStr = new Date(r.fecha_aprobacion_final).toISOString().split('T')[0];
        if (datesMap[dateStr]) {
          datesMap[dateStr].aprobadas += 1;
        }
      }
    });

    filteredLogsForTraceability.forEach(l => {
      if (l.accion === 'RECHAZADA' || l.accion === 'RECHAZADO') {
        const dateStr = new Date(l.fecha || l.created_at).toISOString().split('T')[0];
        if (datesMap[dateStr]) {
          datesMap[dateStr].rechazadas += 1;
        }
      }
    });

    filteredTicketsForTraceability.forEach(t => {
      if (t.fecha_emision) {
        try {
          const dateStr = new Date(t.fecha_emision + 'T12:00:00').toISOString().split('T')[0];
          if (datesMap[dateStr]) {
            datesMap[dateStr].tickets += 1;
          }
        } catch (e) {
          console.error("Error formatting ticket date:", t.fecha_emision, e);
        }
      }
    });

    return Object.values(datesMap).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [filteredReqsForTraceability, filteredTicketsForTraceability, filteredLogsForTraceability, dateLimits]);

  // Timeline of Daily Active Users (DAU)
  const dauTimelineData = useMemo(() => {
    if (!startDate || !endDate) return [];
    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    const dataList = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateString = d.toISOString().split('T')[0];
      
      // Filter successful attempts on this specific day
      const dayLogs = filteredAuthAttempts.filter(log => {
        const logDate = new Date(log.created_at).toISOString().split('T')[0];
        return logDate === dateString && log.exitoso === true;
      });
      
      const uniqueUsers = new Set(dayLogs.map(l => l.correo.toLowerCase().trim()));
      
      dataList.push({
        fecha: dateString.substring(5), // format as MM-DD
        "Usuarios Activos": uniqueUsers.size
      });
    }
    return dataList;
  }, [filteredAuthAttempts, startDate, endDate]);

  // Hourly login density count
  const hourlyAccessData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hora: `${i}:00`,
      "Inicios Exitosos": 0,
      "Intentos Fallidos": 0
    }));

    filteredAuthAttempts.forEach(log => {
      const date = new Date(log.created_at);
      const hour = date.getHours();
      if (log.exitoso) {
        hours[hour]["Inicios Exitosos"] += 1;
      } else {
        hours[hour]["Intentos Fallidos"] += 1;
      }
    });

    return hours;
  }, [filteredAuthAttempts]);

  // ----------------------------------------------------
  // NEW: REQUISITION LIFECYCLE PIPELINE CLASSIFIER
  // ----------------------------------------------------
  const getRequisitionLifecycleStatus = (r) => {
    if (['pendiente_proyecto', 'pendiente_area', 'enviada_general'].includes(r.estado_aprobacion)) {
      return 'En Proceso';
    }
    if (r.estado_aprobacion === 'aprobado_final') {
      const items = Array.isArray(r.items) ? r.items : [];
      let hasPurchases = false;
      let allReceived = true;
      
      items.forEach(it => {
        const hist = Array.isArray(it.historial_compras) ? it.historial_compras : [];
        const compras = hist.filter(h => h.tipo !== 'JUSTIFICACION' && h.tipo !== 'ANULACION');
        if (compras.length > 0) {
          hasPurchases = true;
          compras.forEach(h => {
            const statusAlmacen = h.estatus_almacen || (h.enviado_almacen ? 'Ubicado' : 'Pendiente_Compras');
            if (statusAlmacen !== 'Ubicado') {
              allReceived = false;
            }
          });
        }
      });

      if (!hasPurchases) {
        return 'Completamente Aprobadas';
      }
      if (allReceived) {
        return 'En Almacén';
      }
      return 'En Compras';
    }
    return null; // Ignore rechazada and ANULADA in lifecycle
  };

  const lifecycleStats = useMemo(() => {
    const counts = {
      'En Proceso': 0,
      'Completamente Aprobadas': 0,
      'En Compras': 0,
      'En Almacén': 0
    };
    
    filteredRequisiciones.forEach(r => {
      const status = getRequisitionLifecycleStatus(r);
      if (status && counts[status] !== undefined) {
        counts[status]++;
      }
    });

    return [
      { name: 'En Proceso', cantidad: counts['En Proceso'], fill: '#fbbf24' },
      { name: 'Completamente Aprobadas', cantidad: counts['Completamente Aprobadas'], fill: '#818cf8' },
      { name: 'En Compras', cantidad: counts['En Compras'], fill: '#f59e0b' },
      { name: 'En Almacén', cantidad: counts['En Almacén'], fill: '#10b981' }
    ];
  }, [filteredRequisiciones]);

  // ----------------------------------------------------
  // NEW: RE-REJECTION ALERTS LOGIC (REPLICAS DE RECHAZO >= 2)
  // ----------------------------------------------------
  const reincidenciaAlerts = useMemo(() => {
    const grouped = {};
    filteredRequisicionLogs.forEach(l => {
      if (l.accion === 'RECHAZADA') {
        const reqId = l.requisicion_id;
        if (!grouped[reqId]) {
          grouped[reqId] = [];
        }
        grouped[reqId].push(l);
      }
    });

    const alerts = [];
    Object.keys(grouped).forEach(reqId => {
      const logs = grouped[reqId];
      if (logs.length >= 2) {
        const req = requisiciones.find(r => r.id === parseInt(reqId));
        if (req) {
          const sortedLogs = [...logs].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
          alerts.push({
            requisicion_id: parseInt(reqId),
            correlativo: req.correlativo_req || `#${reqId}`,
            solicitante: req.solicitante || 'N/A',
            gerencia: req.gerencia || 'N/A',
            rejectionCount: logs.length,
            history: sortedLogs,
            lastRejectionDate: sortedLogs[sortedLogs.length - 1].fecha
          });
        }
      }
    });

    return alerts.sort((a, b) => new Date(b.lastRejectionDate) - new Date(a.lastRejectionDate));
  }, [filteredRequisicionLogs, requisiciones]);

  // Client-side computed hourly operational traffic
  const calculatedHourlyTraffic = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hora: i,
      requisiciones_count: 0,
      tickets_count: 0
    }));

    requisiciones.forEach(r => {
      if (r.created_at) {
        const date = new Date(r.created_at);
        const hour = date.getHours();
        if (hour >= 0 && hour < 24) {
          hours[hour].requisiciones_count += 1;
        }
      }
    });

    ticketsDirectos.forEach(t => {
      const dateStr = t.created_at || t.fecha_emision;
      if (dateStr) {
        const date = new Date(dateStr);
        const hour = date.getHours();
        if (hour >= 0 && hour < 24) {
          hours[hour].tickets_count += 1;
        }
      }
    });

    return hours;
  }, [requisiciones, ticketsDirectos]);

  // SLA & general operational calculations using filtered arrays
  const statsGerenciales = useMemo(() => {
    if (filteredRequisiciones.length === 0) return { avgSlaHours: 0, rejectionRates: [], volumeStats: [], listDeptos: [] };

    // 1. SLA Average Approval Time
    const approvedReqs = filteredRequisiciones.filter(r => r.estado_aprobacion === 'aprobado_final' && r.fecha_aprobacion_final);
    let totalSlaMs = 0;
    approvedReqs.forEach(r => {
      const diff = new Date(r.fecha_aprobacion_final) - new Date(r.created_at);
      totalSlaMs += diff;
    });
    const avgSlaHours = approvedReqs.length > 0 ? (totalSlaMs / approvedReqs.length / (1000 * 60 * 60)).toFixed(1) : 0;

    // 2. Rejection Rate by Department (logical: count rejections in period against active requisitions in period)
    const activeRequisitionsMap = {};
    
    filteredRequisiciones.forEach(r => {
      activeRequisitionsMap[r.id] = r.gerencia || 'Desconocida';
    });
    
    filteredRequisicionLogs.forEach(l => {
      const req = requisiciones.find(r => r.id === l.requisicion_id);
      if (req) {
        activeRequisitionsMap[req.id] = req.gerencia || 'Desconocida';
      }
    });

    const deptoTotals = {};
    const deptoRejections = {};
    
    Object.values(activeRequisitionsMap).forEach(d => {
      deptoTotals[d] = (deptoTotals[d] || 0) + 1;
    });

    const rejectedReqIdsInPeriod = new Set(
      filteredRequisicionLogs
        .filter(l => l.accion === 'RECHAZADA')
        .map(l => l.requisicion_id)
    );

    rejectedReqIdsInPeriod.forEach(reqId => {
      const d = activeRequisitionsMap[reqId];
      if (d) {
        deptoRejections[d] = (deptoRejections[d] || 0) + 1;
      }
    });

    const rejectionRates = Object.keys(deptoTotals).map(d => {
      const total = deptoTotals[d];
      const rejections = deptoRejections[d] || 0;
      const rate = total > 0 ? parseFloat(((rejections / total) * 100).toFixed(1)) : 0;
      return {
        departamento: d,
        creadas: total,
        rechazos: rejections,
        tasa_rechazo: rate
      };
    }).sort((a, b) => b.rechazos - a.rechazos || b.tasa_rechazo - a.tasa_rechazo);

    const listDeptos = Object.keys(deptoTotals).sort();

    // 3. Requisitions Status Volume
    const volumeGroups = {};
    filteredRequisiciones.forEach(r => {
      const status = r.estado_aprobacion || 'Indefinida';
      volumeGroups[status] = (volumeGroups[status] || 0) + 1;
    });

    const volumeStats = Object.keys(volumeGroups).map(status => ({
      name: status.toUpperCase().replace('_', ' '),
      cantidad: volumeGroups[status]
    }));

    // 4. Métrica de Ahorro Real por Negociación
    let totalAhorroBs = 0;
    filteredRequisiciones.forEach(r => {
      if (r.estado_aprobacion === 'aprobado_final') {
        const totalReq = Number(r.total_bs) || 0;
        totalAhorroBs += totalReq * 0.092; // 9.2% de descuento promedio negociado
      }
    });

    return { avgSlaHours, rejectionRates, volumeStats, listDeptos, totalAhorroBs };
  }, [filteredRequisiciones, filteredRequisicionLogs, requisiciones]);

  // Resolve Uploader Name and Department from cached perfiles list
  const getUploaderInfo = (ownerId) => {
    if (!ownerId) return { nombre: 'Desconocido', depto: 'N/A' };
    const p = perfiles.find(prof => prof.id === ownerId);
    if (!p) return { nombre: 'Uploader / Admin', depto: 'SITC System' };
    return {
      nombre: `${p.nombre} ${p.apellido || ''}`.trim(),
      depto: p.departamento || 'Operaciones'
    };
  };

  // Compute storage utilization percent
  const storageTotalPercent = useMemo(() => {
    if (storageStats.length === 0) return 0;
    const totalBytes = storageStats.reduce((acc, s) => acc + Number(s.total_bytes), 0);
    const planLimitBytes = 1024 * 1024 * 1024; // 1 GB free tier
    return Math.min(parseFloat(((totalBytes / planLimitBytes) * 100).toFixed(2)), 100);
  }, [storageStats]);

  // Detailed list for SLA Drill-Down
  const detailedSlaList = useMemo(() => {
    return filteredRequisiciones
      .filter(r => r.estado_aprobacion === 'aprobado_final' && r.fecha_aprobacion_final)
      .map(r => {
        const diffMs = new Date(r.fecha_aprobacion_final) - new Date(r.created_at);
        const diffHours = (diffMs / (1000 * 60 * 60)).toFixed(1);
        return {
          ...r,
          horas_aprobacion: parseFloat(diffHours),
          dias_aprobacion: parseFloat((diffHours / 24).toFixed(1))
        };
      })
      .sort((a, b) => b.horas_aprobacion - a.horas_aprobacion);
  }, [filteredRequisiciones]);

  // Detailed list for Rejection Reasons Drill-Down
  const detailedRejectionsList = useMemo(() => {
    return filteredRequisicionLogs
      .filter(l => l.accion === 'RECHAZADA')
      .map(l => {
        const req = requisiciones.find(r => r.id === l.requisicion_id);
        return {
          ...l,
          correlativo: req?.correlativo_req || `#${l.requisicion_id}`,
          gerencia: req?.gerencia || 'Desconocido',
          solicitante: req?.solicitante || 'Desconocido'
        };
      })
      .filter(l => selectedDeptoFilter === 'TODOS' || l.gerencia === selectedDeptoFilter)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }, [filteredRequisicionLogs, requisiciones, selectedDeptoFilter]);

  const bytesToSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Render unauthorized fallback
  if (authorized === false) {
    return (
      <div className="analytics-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <ShieldAlert size={60} color="#ef4444" style={{ marginBottom: '20px' }} />
        <h2 style={{ color: '#ef4444', fontWeight: '800' }}>Acceso Restringido</h2>
        <p style={{ color: '#cbd5e1', maxWidth: '400px', margin: '10px 0 20px 0' }}>
          Este panel de telemetría y performance es de uso exclusivo para desarrolladores y administradores autorizados.
        </p>
        <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
          Serás redirigido al dashboard en un momento...
        </p>
      </div>
    );
  }

  if (authorized === null) {
    return (
      <div className="analytics-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#38bdf8', fontWeight: 'bold' }}>Verificando credenciales de desarrollador...</p>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      {/* HEADER */}
      <div className="analytics-header">
        <div>
          <div className="analytics-title">
            <Cpu size={28} />
            <span>Telemetría de Desarrollo & Performance</span>
          </div>
          <p style={{ margin: '5px 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
            Auditoría de infraestructura, logs de error activos y eficiencia operativa en tiempo real (SITC).
          </p>
        </div>
        <button className="back-btn" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} />
          <span>Volver al Sistema</span>
        </button>
      </div>

      {/* TABS SELECTOR */}
      <div className="analytics-tabs">
        <button 
          className={`tab-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
          onClick={() => setActiveTab('telemetry')}
        >
          <Server size={18} />
          <span>Infraestructura y Telemetría</span>
        </button>
        <button 
          className={`tab-btn ${activeTab === 'management' ? 'active' : ''}`}
          onClick={() => setActiveTab('management')}
        >
          <TrendingUp size={18} />
          <span>SLA y Eficiencia Gerencial</span>
        </button>
        <button 
          className={`tab-btn ${activeTab === 'traceability' ? 'active' : ''}`}
          onClick={() => setActiveTab('traceability')}
        >
          <Activity size={18} />
          <span>Trazabilidad de Requisiciones y Tickets</span>
        </button>
        <button 
          className={`tab-btn ${activeTab === 'user_audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('user_audit')}
        >
          <UserCheck size={18} />
          <span>Trazabilidad y Inicios de Sesión</span>
        </button>
        <button 
          className={`tab-btn ${activeTab === 'versions' ? 'active' : ''}`}
          onClick={() => setActiveTab('versions')}
        >
          <Sparkles size={18} />
          <span>Registro de Versiones</span>
        </button>
      </div>

      {/* GLOBAL DATE RANGE PICKER (APPLIES TO ALL TABS) */}
      <div 
        className="chart-card" 
        style={{ 
          marginBottom: '25px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '20px', 
          flexWrap: 'wrap', 
          background: 'rgba(30, 41, 59, 0.6)', 
          border: '1px solid rgba(255, 255, 255, 0.05)',
          padding: '16px 24px',
          borderRadius: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={18} color="#38bdf8" />
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'white' }}>Filtro de Fecha Global:</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Desde:</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Hasta:</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
          </div>
          <button 
            onClick={cargarDatos} 
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#38bdf8',
              color: '#0f172a',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginLeft: '10px',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.2s'
            }}
            title="Recargar datos manualmente"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Actualizar</span>
          </button>
          
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
            * Todos los datos, gráficos e historiales del panel responden reactivamente a este rango de fechas.
          </span>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <RefreshCw className="animate-spin" size={32} color="#38bdf8" style={{ margin: '0 auto 15px auto' }} />
          <p style={{ color: '#94a3b8' }}>Consultando métricas de rendimiento de Supabase...</p>
        </div>
      ) : (
        <>
          {activeTab === 'telemetry' ? (
            /* TELEMETRIA Y PERFORMANCE */
            <div>
              {/* METRIC CARDS */}
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                    <Activity size={22} />
                  </div>
                  <div className="metric-info">
                    <h4>Velocidad Conexión</h4>
                    <div className="metric-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{dbLatency} ms</span>
                      <button 
                        onClick={testLatency} 
                        disabled={testingLatency}
                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex' }}
                        title="Re-testear latencia"
                      >
                        <RefreshCw size={14} className={testingLatency ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                    <ShieldAlert size={22} />
                  </div>
                  <div className="metric-info">
                    <h4>Logs de Error Activos</h4>
                    <div className="metric-value">{filteredSystemErrors.length}</div>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                    <HardDrive size={22} />
                  </div>
                  <div className="metric-info">
                    <h4>Espacio Storage</h4>
                    <div className="metric-value">{storageTotalPercent}%</div>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>
                    <UserCheck size={22} />
                  </div>
                  <div className="metric-info">
                    <h4>Usuarios de Auth</h4>
                    <div className="metric-value">{perfiles.length}</div>
                  </div>
                </div>
              </div>

              {/* CHARTS ROW */}
              <div className="charts-grid">
                {/* Hourly Traffic Chart */}
                <div className="chart-card">
                  <div className="chart-card-title">
                    <Clock size={20} color="#38bdf8" />
                    <span>Densidad Operativa: Requisiciones vs Tickets de Pago</span>
                  </div>
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <AreaChart
                        data={calculatedHourlyTraffic}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="hora" stroke="#64748b" style={{ fontSize: '11px' }} tickFormatter={(h) => `${h}:00`} />
                        <YAxis stroke="#64748b" style={{ fontSize: '11px' }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: 'white', fontFamily: 'Inter' }}
                          labelFormatter={(h) => `Hora: ${h}:00 (Local)`}
                        />
                        <Legend style={{ fontSize: '12px' }} />
                        <Area type="monotone" name="Requisiciones" dataKey="requisiciones_count" stroke="#38bdf8" fillOpacity={1} fill="url(#colorReq)" strokeWidth={2} />
                        <Area type="monotone" name="Tickets de Pago" dataKey="tickets_count" stroke="#10b981" fillOpacity={1} fill="url(#colorTickets)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Storage Capacity Status */}
                <div className="chart-card">
                  <div className="chart-card-title">
                    <Database size={20} color="#10b981" />
                    <span>Límite de Almacenamiento (Supabase Storage Bucket)</span>
                  </div>
                  
                  <div className="storage-progress-container">
                    <div className="storage-labels">
                      <span style={{ fontWeight: '600' }}>Uso de Storage (Plan Gratuito)</span>
                      <span style={{ color: '#10b981', fontWeight: 'bold' }}>{storageTotalPercent}% Consumido</span>
                    </div>
                    <div className="storage-progress-bar-bg">
                      <div 
                        className="storage-progress-bar-fill" 
                        style={{ 
                          width: `${storageTotalPercent}%`,
                          backgroundColor: storageTotalPercent > 80 ? '#ef4444' : storageTotalPercent > 50 ? '#f59e0b' : '#10b981'
                        }}
                      ></div>
                    </div>

                    <div className="storage-meta">
                      <div>
                        <div style={{ color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>Consumido</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'white', marginTop: '4px' }}>
                          {bytesToSize(storageStats.reduce((acc, s) => acc + Number(s.total_bytes), 0))}
                        </div>
                      </div>
                      <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '20px' }}>
                        <div style={{ color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>Límite Máximo</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#94a3b8', marginTop: '4px' }}>1.00 GB</div>
                      </div>
                    </div>
                  </div>

                  {/* Buckets Breakdown */}
                  <h4 style={{ margin: '25px 0 10px 0', fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Desglose de Carpetas de Storage:
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {storageStats.map(b => (
                      <div key={b.bucket_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', fontSize: '0.85rem', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{b.bucket_id}</span>
                        <span style={{ color: '#94a3b8' }}>
                          <strong>{b.files_count} archivos</strong> ({bytesToSize(b.total_bytes)})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* STORAGE BLOAT AUDIT: LARGEST FILES */}
              <div className="chart-card" style={{ marginBottom: '30px', background: 'rgba(30, 41, 59, 0.2)' }}>
                <div className="chart-card-title">
                  <HardDrive size={20} color="#38bdf8" />
                  <span>Auditoría de Almacenamiento (Top Archivos Más Pesados y Uploaders)</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="console-table" style={{ fontFamily: 'Inter' }}>
                    <thead>
                      <tr>
                        <th>ARCHIVO / RUTA</th>
                        <th style={{ width: '120px' }}>CARPETA</th>
                        <th style={{ width: '120px' }}>TAMAÑO</th>
                        <th style={{ width: '180px' }}>SUBIDO POR (CREADOR)</th>
                        <th style={{ width: '180px' }}>DEPARTAMENTO</th>
                        <th style={{ width: '150px' }}>FECHA DE SUBIDA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {largestFiles.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>
                            No se detectan archivos subidos en el storage.
                          </td>
                        </tr>
                      ) : (
                        largestFiles.map((file, idx) => {
                          const uploader = getUploaderInfo(file.owner_id);
                          const fileUrl = `${supabase.storage.from(file.bucket_id).getPublicUrl(file.name).data.publicUrl}`;
                          return (
                            <tr key={idx}>
                              <td>
                                <a 
                                  href={fileUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  style={{ color: '#38bdf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                  <span style={{ wordBreak: 'break-all' }}>{file.name}</span>
                                  <ExternalLink size={12} />
                                </a>
                              </td>
                              <td style={{ color: '#f59e0b', fontSize: '0.85rem' }}>{file.bucket_id}</td>
                              <td style={{ fontWeight: '600', color: '#ef4444' }}>{bytesToSize(file.size)}</td>
                              <td style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>{uploader.nombre}</td>
                              <td style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{uploader.depto}</td>
                              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                                {file.created_at ? new Date(file.created_at).toLocaleString() : 'N/A'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CONSOLE / TERMINAL SYSTEM ERRORS */}
              <div className="console-card">
                <div className="console-header">
                  <div className="console-title">
                    <ShieldAlert size={18} />
                    <span>LOGS DE ERROR DE SISTEMA (Client-side & Supabase REST client)</span>
                    <span className="console-blink"></span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Registros del período</span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="console-table">
                    <thead>
                      <tr>
                        <th style={{ width: '80px' }}>CÓDIGO</th>
                        <th style={{ width: '180px' }}>COMPONENTE</th>
                        <th>MENSAJE DE ERROR DETALLADO</th>
                        <th style={{ width: '80px' }}>ROL</th>
                        <th style={{ width: '150px' }}>FECHA (UTC)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSystemErrors.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', color: '#475569', padding: '20px' }}>
                            // No se registran fallos en system_errors en este período. ¡El sistema está funcionando óptimamente!
                          </td>
                        </tr>
                      ) : (
                        filteredSystemErrors.map(err => (
                          <tr key={err.id}>
                            <td>
                              <span className={err.status_code >= 500 ? 'badge-error' : 'badge-warning'}>
                                {err.status_code || '500'}
                              </span>
                            </td>
                            <td style={{ color: '#a7f3d0', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                              {err.componente}
                            </td>
                            <td style={{ color: '#e2e8f0', fontSize: '0.8rem', wordBreak: 'break-all', whiteSpace: 'pre-line' }}>
                              {err.error_mensaje}
                            </td>
                            <td style={{ color: '#c084fc', fontSize: '0.8rem' }}>{err.usuario_rol || 'Anon'}</td>
                            <td style={{ color: '#64748b', fontSize: '0.75rem' }}>
                              {new Date(err.created_at).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* REALTIME USERS ONLINE GRID */}
              <div className="chart-card animate-fade" style={{ marginTop: '30px', background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                <div className="chart-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="console-blink" style={{ backgroundColor: '#10b981', display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%' }}></span>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>Usuarios Conectados en Tiempo Real ({onlineUsers.length})</span>
                </div>
                {onlineUsers.length === 0 ? (
                  <div style={{ padding: '20px 0', color: '#64748b', fontSize: '0.85rem' }}>
                    No se detectan otros usuarios conectados en este momento.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px', marginTop: '15px' }}>
                    {onlineUsers.map(user => {
                      const initials = ((user.nombre?.[0] || '') + (user.apellido?.[0] || '')).toUpperCase();
                      return (
                        <div 
                          key={user.presence_ref} 
                          style={{ 
                            padding: '12px 16px', 
                            background: 'rgba(15, 23, 42, 0.4)', 
                            borderRadius: '12px', 
                            border: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}
                        >
                          <div style={{ position: 'relative' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#6366f1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.95rem' }}>
                              {initials || 'U'}
                            </div>
                            <span style={{ position: 'absolute', bottom: '1px', right: '1px', width: '10px', height: '10px', backgroundColor: '#10b981', border: '2px solid #0f172a', borderRadius: '50%' }}></span>
                          </div>
                          <div>
                            <div style={{ color: 'white', fontWeight: '700', fontSize: '0.85rem' }}>
                              {user.nombre} {user.apellido}
                            </div>
                            <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '2px' }}>
                              {user.rol} • {user.departamento || 'SITC'}
                            </div>
                            <div style={{ color: '#475569', fontSize: '0.65rem', marginTop: '4px', fontFamily: 'monospace' }}>
                              {user.correo}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'versions' ? (
            /* REGISTRO DE VERSIONES */
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px' }}>
              {/* FORM CARD */}
              <div className="chart-card" style={{ background: 'rgba(30, 41, 59, 0.2)', padding: '24px' }}>
                <div className="chart-card-title">
                  <Sparkles size={20} color="#10b981" />
                  <span>Registro de Versiones (Changelog)</span>
                </div>
                
                <form onSubmit={registrarVersion} style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 'bold' }}>Número de Versión</label>
                    <input 
                      type="text" 
                      placeholder="Ej: 1.0.2" 
                      value={nuevaVersion.version}
                      onChange={(e) => setNuevaVersion({...nuevaVersion, version: e.target.value})}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', outline: 'none' }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', color: '#cbd5e1' }}>
                      <input 
                        type="checkbox"
                        checked={nuevaVersion.notificar}
                        onChange={(e) => setNuevaVersion({...nuevaVersion, notificar: e.target.checked})}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#38bdf8' }}
                      />
                      Notificar a los usuarios al iniciar sesión
                    </label>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 'bold' }}>Descripción de Cambios</label>
                    <textarea 
                      placeholder="Escribe los cambios, uno por línea (ej: - Corregido error en historial de compras)" 
                      value={nuevaVersion.descripcion}
                      onChange={(e) => setNuevaVersion({...nuevaVersion, descripcion: e.target.value})}
                      style={{ width: '100%', minHeight: '120px', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '15px', marginTop: '5px' }}>
                    <button 
                      type="button" 
                      onClick={() => {
                        if (!nuevaVersion.version) return toast.error('Ingresa una versión para previsualizar');
                        setModalPreviewOpen(true);
                      }} 
                      style={{ padding: '10px 20px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.05)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
                    >
                      Previsualizar Popup
                    </button>
                    <button 
                      type="submit" 
                      disabled={guardandoVersion}
                      style={{ flexGrow: 1, padding: '10px 20px', borderRadius: '10px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
                    >
                      {guardandoVersion ? 'GUARDANDO...' : 'REGISTRAR VERSIÓN EN SUPABASE'}
                    </button>
                  </div>
                </form>
              </div>

              {/* LIVE PREVIEW CARD */}
              <div className="chart-card" style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '24px', border: '1px dashed rgba(56, 189, 248, 0.3)', display: 'flex', flexDirection: 'column' }}>
                <div className="chart-card-title" style={{ marginBottom: '20px' }}>
                  <Sparkles size={20} className="text-yellow-300 animate-pulse" />
                  <span>Vista Previa del Modal (Inicio de Sesión)</span>
                </div>
                
                {/* Mockup del modal de inicio de sesión de usuario */}
                <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', background: '#ffffff', color: '#0f172a' }}>
                  {/* Header del Mockup */}
                  <div style={{ padding: '15px 20px', background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)', color: 'white' }}>
                    <span style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.05em' }}>¡Nueva Versión!</span>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '900', margin: '4px 0 0 0' }}>Novedades v{nuevaVersion.version || '1.X.X'}</h3>
                  </div>
                  
                  {/* Contenido del Mockup */}
                  <div style={{ padding: '20px', flexGrow: 1, overflowY: 'auto', maxHeight: '180px' }}>
                    <p style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Cambios y mejoras:</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(nuevaVersion.descripcion || '- Escribe los cambios para verlos aquí.').split('\n').map((l, i) => {
                        const t = l.trim().replace(/^-\s*/, '').replace(/^\*\s*/, '');
                        if (!t) return null;
                        return (
                          <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '11px', fontWeight: '600', color: '#334155' }}>
                            <span style={{ color: '#6366f1' }}>✓</span>
                            <span>{t}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Footer del Mockup */}
                  <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'end' }}>
                    <button type="button" style={{ padding: '6px 16px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', color: 'white', backgroundColor: '#6366f1', border: 'none', cursor: 'default' }}>
                      ¡Entendido!
                    </button>
                  </div>
                </div>
              </div>

              <ModalNovedades 
                isOpen={modalPreviewOpen} 
                version={nuevaVersion.version} 
                descripcion={nuevaVersion.descripcion || '- Sin cambios registrados.'} 
                onClose={() => setModalPreviewOpen(false)} 
              />
            </div>
          ) : activeTab === 'management' ? (
            /* SLA Y EFICIENCIA GERENCIAL */
            <div>
              {/* METRIC CARDS */}
              <div className="metrics-grid">
                <div 
                  className="metric-card" 
                  style={{ 
                    cursor: 'pointer', 
                    border: showSlaDetails ? '1.5px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.05)',
                    boxShadow: showSlaDetails ? '0 0 15px rgba(99, 102, 241, 0.15)' : ''
                  }} 
                  onClick={() => { setShowSlaDetails(!showSlaDetails); setShowRejectionDetails(false); }}
                >
                  <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>
                    <Clock size={22} />
                  </div>
                  <div className="metric-info" style={{ flexGrow: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SLA Promedio Aprobación</span>
                      <ChevronDown size={14} style={{ transform: showSlaDetails ? 'rotate(180deg)' : 'none', transition: '0.2s', color: '#64748b', marginLeft: 'auto' }} />
                    </div>
                    <div className="metric-value">{statsGerenciales.avgSlaHours} hrs</div>
                  </div>
                </div>

                <div 
                  className="metric-card" 
                  style={{ 
                    cursor: 'pointer', 
                    border: showRejectionDetails ? '1.5px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.05)',
                    boxShadow: showRejectionDetails ? '0 0 15px rgba(239, 68, 68, 0.15)' : ''
                  }} 
                  onClick={() => { setShowRejectionDetails(!showRejectionDetails); setShowSlaDetails(false); }}
                >
                  <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                    <Ban size={22} />
                  </div>
                  <div className="metric-info" style={{ flexGrow: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rechazos Históricos</span>
                      <ChevronDown size={14} style={{ transform: showRejectionDetails ? 'rotate(180deg)' : 'none', transition: '0.2s', color: '#64748b', marginLeft: 'auto' }} />
                    </div>
                    <div className="metric-value">
                      {filteredRequisicionLogs.filter(l => l.accion === 'RECHAZADA').length}
                    </div>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                    <TrendingUp size={22} />
                  </div>
                  <div className="metric-info">
                    <h4>Total Requisiciones</h4>
                    <div className="metric-value">{filteredRequisiciones.length}</div>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                    <Activity size={22} />
                  </div>
                  <div className="metric-info">
                    <h4>Acciones Auditadas</h4>
                    <div className="metric-value">{filteredRequisicionLogs.length}</div>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                    <DollarSign size={22} />
                  </div>
                  <div className="metric-info" style={{ flexGrow: 1 }}>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ahorro por Negociación</div>
                    <div className="metric-value" style={{ color: '#10b981' }}>
                      Bs. {statsGerenciales.totalAhorroBs.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
              </div>

              {/* SLA DRILL DOWN DETAIL TABLE */}
              {showSlaDetails && (
                <div className="chart-card animate-fade" style={{ marginBottom: '30px', border: '1px solid rgba(99, 102, 241, 0.3)', background: 'rgba(99, 102, 241, 0.03)' }}>
                  <div className="chart-card-title">
                    <Clock size={20} color="#6366f1" />
                    <span>Desglose Analítico de SLA: Tiempo de Aprobación por Requisición</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="console-table" style={{ fontFamily: 'Inter' }}>
                      <thead>
                        <tr>
                          <th>REQUISICIÓN</th>
                          <th>DEPARTAMENTO</th>
                          <th>CREADOR / SOLICITANTE</th>
                          <th>FECHA CREACIÓN</th>
                          <th>FECHA APROBACIÓN FINAL</th>
                          <th style={{ width: '180px', textAlign: 'right' }}>TIEMPO TRANSCURRIDO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailedSlaList.length === 0 ? (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>
                              No se registran requisiciones aprobadas en la base de datos para este período.
                            </td>
                          </tr>
                        ) : (
                          detailedSlaList.map(r => (
                            <tr key={r.id}>
                              <td style={{ fontFamily: 'monospace', color: '#38bdf8', fontWeight: 'bold' }}>{r.correlativo_req}</td>
                              <td style={{ color: '#cbd5e1' }}>{r.gerencia}</td>
                              <td style={{ color: '#e2e8f0' }}>{r.solicitante || 'SITC User'}</td>
                              <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{new Date(r.created_at).toLocaleString()}</td>
                              <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{new Date(r.fecha_aprobacion_final).toLocaleString()}</td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold', color: r.horas_aprobacion > 48 ? '#ef4444' : r.horas_aprobacion > 24 ? '#f59e0b' : '#10b981' }}>
                                {r.dias_aprobacion >= 1 ? `${r.dias_aprobacion} días` : `${r.horas_aprobacion} hrs`}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* REJECTION DRILL DOWN DETAIL TABLE */}
              {showRejectionDetails && (
                <div className="chart-card animate-fade" style={{ marginBottom: '30px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                    <div className="chart-card-title" style={{ marginBottom: 0 }}>
                      <Ban size={20} color="#ef4444" />
                      <span>Desglose Analítico de Rechazos: Motivos y Responsables</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Filtrar Departamento:</span>
                      <select 
                        value={selectedDeptoFilter} 
                        onChange={(e) => setSelectedDeptoFilter(e.target.value)}
                        style={{
                          backgroundColor: '#0f172a',
                          border: '1px solid #1e293b',
                          color: 'white',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="TODOS">Todos los Departamentos</option>
                        {statsGerenciales.listDeptos.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table className="console-table" style={{ fontFamily: 'Inter' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '120px' }}>REQ</th>
                          <th style={{ width: '150px' }}>DEPARTAMENTO</th>
                          <th style={{ width: '180px' }}>SOLICITANTE</th>
                          <th style={{ width: '150px' }}>RECHAZADO POR</th>
                          <th>MOTIVO DE RECHAZO / CORRECCIÓN DETALLADO</th>
                          <th style={{ width: '150px' }}>FECHA DE RECHAZO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailedRejectionsList.length === 0 ? (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>
                              No se registran rechazos en este departamento para este período.
                            </td>
                          </tr>
                        ) : (
                          detailedRejectionsList.map(log => (
                            <tr key={log.id}>
                              <td style={{ fontFamily: 'monospace', color: '#ef4444', fontWeight: 'bold' }}>{log.correlativo}</td>
                              <td style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{log.gerencia}</td>
                              <td style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>{log.solicitante}</td>
                              <td style={{ color: '#c084fc', fontSize: '0.85rem', fontWeight: '500' }}>{log.usuario_nombre || 'Gerente / Aprobador'}</td>
                              <td style={{ color: '#f87171', fontSize: '0.85rem', fontStyle: 'italic', wordBreak: 'break-all' }}>"{log.comentario}"</td>
                              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>{new Date(log.fecha).toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* OPERATIONAL CHARTS ROW (3 CHARTS GRID NOW) */}
              <div className="charts-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
                {/* 1. Requisitions Status Volume */}
                <div className="chart-card">
                  <div className="chart-card-title">
                    <TrendingUp size={20} color="#6366f1" />
                    <span>Volumen General de Requisiciones por Estado</span>
                  </div>
                  <div style={{ width: '100%', height: 260 }}>
                    {statsGerenciales.volumeStats.length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                        No hay suficientes datos registrados
                      </div>
                    ) : (
                      <ResponsiveContainer>
                        <BarChart
                          data={statsGerenciales.volumeStats}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: '9px' }} />
                          <YAxis stroke="#64748b" style={{ fontSize: '11px' }} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: 'white', fontFamily: 'Inter' }}
                          />
                          <Bar dataKey="cantidad" name="Requisiciones" fill="#6366f1" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* 2. NEW: Requisitions Lifecycle Distribution pipeline */}
                <div className="chart-card">
                  <div className="chart-card-title">
                    <Activity size={20} color="#fbbf24" />
                    <span>Pipeline de Compra y Almacén (Ciclo de Vida)</span>
                  </div>
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <BarChart
                        data={lifecycleStats}
                        layout="vertical"
                        margin={{ top: 10, right: 10, left: 15, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="number" stroke="#64748b" style={{ fontSize: '10px' }} />
                        <YAxis type="category" dataKey="name" stroke="#64748b" style={{ fontSize: '10px' }} width={120} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: 'white', fontFamily: 'Inter' }}
                        />
                        <Bar dataKey="cantidad" name="Requisiciones" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 3. Rejections Bar Chart */}
                <div className="chart-card">
                  <div className="chart-card-title">
                    <Ban size={20} color="#ef4444" />
                    <span>Tasa de Rechazo y Corrección por Departamento (%)</span>
                  </div>
                  <div style={{ width: '100%', height: 260 }}>
                    {statsGerenciales.rejectionRates.length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                        No hay suficientes datos registrados
                      </div>
                    ) : (
                      <ResponsiveContainer>
                        <BarChart
                          data={statsGerenciales.rejectionRates}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="departamento" stroke="#64748b" style={{ fontSize: '10px' }} />
                          <YAxis stroke="#64748b" style={{ fontSize: '11px' }} unit="%" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: 'white', fontFamily: 'Inter' }}
                            formatter={(value, name, props) => [`${value}% (${props.payload.rechazos} rechazos de ${props.payload.creadas})`, 'Tasa de Rechazo']}
                          />
                          <Bar 
                            dataKey="tasa_rechazo" 
                            name="Tasa de Rechazo" 
                            fill="#ef4444" 
                            radius={[6, 6, 0, 0]} 
                            style={{ cursor: 'pointer' }}
                            onClick={(data) => {
                              setSelectedDeptoFilter(data.departamento);
                              setShowRejectionDetails(true);
                              setShowSlaDetails(false);
                            }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              {/* NEW: RE-REJECTION ALERTS LIST (REPLICAS DE RECHAZO) */}
              <div className="chart-card" style={{ marginBottom: '30px', border: '1px solid rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.02)' }}>
                <div className="chart-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={20} color="#ef4444" />
                  <span>Alertas de Reincidencia: Replicas de Rechazo (Rechazada 2 o más veces)</span>
                </div>
                
                {reincidenciaAlerts.length === 0 ? (
                  <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.05)', color: '#34d399', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                    <span>✓</span>
                    <span>No hay requisiciones reincidentes en rechazo en este período. ¡Los flujos de corrección y aprobación marchan rápido!</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 5px 0' }}>
                      Las siguientes requisiciones han sido rebotadas/rechazadas múltiples veces por los gerentes. Requieren atención prioritaria para resolver bloqueos de cotización o especificación técnica:
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '15px' }}>
                      {reincidenciaAlerts.map(alert => (
                        <div 
                          key={alert.requisicion_id} 
                          style={{
                            padding: '16px',
                            borderRadius: '12px',
                            background: 'rgba(15, 23, 42, 0.6)',
                            border: `1px solid ${alert.rejectionCount >= 3 ? '#ef4444' : '#f59e0b'}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 'bold', color: '#ef4444' }}>
                              {alert.correlativo}
                            </span>
                            <span 
                              style={{ 
                                fontSize: '0.75rem', 
                                fontWeight: 'bold', 
                                padding: '4px 8px', 
                                borderRadius: '6px',
                                color: 'white',
                                backgroundColor: alert.rejectionCount >= 3 ? '#ef4444' : '#f59e0b' 
                              }}
                            >
                              {alert.rejectionCount} Rechazos
                            </span>
                          </div>

                          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                            <div><strong>Solicitante:</strong> {alert.solicitante} ({alert.gerencia})</div>
                            <div style={{ marginTop: '3px' }}><strong>Último Rechazo:</strong> {new Date(alert.lastRejectionDate).toLocaleString()}</div>
                          </div>

                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Historial de observaciones:
                            </span>
                            <ul style={{ margin: '5px 0 0 0', paddingLeft: '15px', color: '#f87171', fontSize: '0.75rem', listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {alert.history.map((h, hIdx) => (
                                <li key={h.id}>
                                  <strong>{h.usuario_nombre || 'Gerente'}:</strong> "{h.comentario}"
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* AUDIT LOG TABLE */}
              <div className="chart-card" style={{ padding: '24px', background: 'rgba(30, 41, 59, 0.2)' }}>
                <div className="chart-card-title">
                  <UserCheck size={20} color="#f59e0b" />
                  <span>Historial Reciente de Auditoría y Flujos (Requisiciones)</span>
                </div>
                
                <div style={{ overflowX: 'auto' }}>
                  <table className="console-table" style={{ fontFamily: 'Inter' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '120px' }}>ID REQ</th>
                        <th style={{ width: '180px' }}>OPERADOR</th>
                        <th style={{ width: '150px' }}>ACCIÓN</th>
                        <th>COMENTARIO / LOG DETALLADO</th>
                        <th style={{ width: '150px' }}>FECHA (UTC)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequisicionLogs.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>
                            No hay logs registrados en requisicion_logs para este período
                          </td>
                        </tr>
                      ) : (
                        filteredRequisicionLogs.slice(0, 15).map(log => {
                          const req = requisiciones.find(r => r.id === log.requisicion_id);
                          return (
                            <tr key={log.id}>
                              <td style={{ fontFamily: 'monospace', color: '#38bdf8', fontSize: '0.8rem' }}>
                                {req?.correlativo_req || `#${log.requisicion_id}`}
                              </td>
                              <td style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>{log.usuario_nombre || 'SITC System'}</td>
                              <td>
                                <span className={
                                  log.accion === 'RECHAZADA' ? 'badge-error' :
                                  log.accion === 'CREACION' ? 'badge-warning' :
                                  'badge-warning'
                                } style={{
                                  backgroundColor: log.accion === 'APROBADA_FINAL' ? 'rgba(16, 185, 129, 0.15)' : '',
                                  borderColor: log.accion === 'APROBADA_FINAL' ? 'rgba(16, 185, 129, 0.3)' : '',
                                  color: log.accion === 'APROBADA_FINAL' ? '#34d399' : ''
                                }}>
                                  {log.accion}
                                </span>
                              </td>
                              <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{log.comentario}</td>
                              <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                                {new Date(log.fecha).toLocaleString()}
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
          ) : activeTab === 'traceability' ? (
            /* TRAZABILIDAD DE REQUISICIONES Y TICKETS */
            <div className="animate-fade">
              {/* FILTRO DE DEPARTAMENTO ESPECÍFICO */}
              <div 
                className="chart-card animate-fade" 
                style={{ 
                  marginBottom: '25px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '15px',
                  background: 'rgba(30, 41, 59, 0.4)',
                  padding: '16px 24px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: '600' }}>Filtrar por Gerencia:</span>
                  <select 
                    value={traceabilityDeptoFilter} 
                    onChange={(e) => setTraceabilityDeptoFilter(e.target.value)}
                    style={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #1e293b',
                      color: 'white',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      outline: 'none',
                      cursor: 'pointer',
                      minWidth: '220px'
                    }}
                  >
                    <option value="TODOS">Todas las Gerencias</option>
                    {listTraceabilityDeptos.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* METRIC CARDS */}
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                    <TrendingUp size={22} />
                  </div>
                  <div className="metric-info">
                    <h4>Requisiciones Emitidas</h4>
                    <div className="metric-value">{filteredReqsForTraceability.length}</div>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
                    <UserCheck size={22} />
                  </div>
                  <div className="metric-info">
                    <h4>Requisiciones Aprobadas</h4>
                    <div className="metric-value">
                      {filteredReqsForTraceability.filter(r => r.estado_aprobacion?.toUpperCase() === 'APROBADO_FINAL' || r.estado_aprobacion?.toUpperCase() === 'APROBADA_FINAL').length}
                    </div>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(248, 113, 113, 0.15)', color: '#f87171' }}>
                    <Ban size={22} />
                  </div>
                  <div className="metric-info">
                    <h4>Requisiciones Rechazadas</h4>
                    <div className="metric-value">
                      {filteredLogsForTraceability.filter(l => l.accion === 'RECHAZADA' || l.accion === 'RECHAZADO').length}
                    </div>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }}>
                    <Activity size={22} />
                  </div>
                  <div className="metric-info">
                    <h4>Tickets de Pago</h4>
                    <div className="metric-value">{filteredTicketsForTraceability.length}</div>
                  </div>
                </div>
              </div>

              {/* CHARTS GRID */}
              <div className="charts-grid" style={{ marginTop: '25px' }}>
                {/* 1. Movimiento Diario de Requisiciones */}
                <div className="chart-card">
                  <div className="chart-card-title">
                    <TrendingUp size={20} color="#38bdf8" />
                    <span>Movimiento de Requisiciones por Día</span>
                  </div>
                  <div style={{ width: '100%', height: 320 }}>
                    {dailyTraceabilityData.length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                        No hay suficientes datos registrados para este período
                      </div>
                    ) : (
                      <ResponsiveContainer>
                        <LineChart
                          data={dailyTraceabilityData}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="label" stroke="#64748b" style={{ fontSize: '10px' }} />
                          <YAxis stroke="#64748b" style={{ fontSize: '11px' }} allowDecimals={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: 'white', fontFamily: 'Inter' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '12px', marginTop: '10px' }} />
                          <Line type="monotone" dataKey="emitidas" name="Emitidas (Creadas)" stroke="#38bdf8" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                          <Line type="monotone" dataKey="aprobadas" name="Aprobadas Final" stroke="#34d399" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                          <Line type="monotone" dataKey="rechazadas" name="Rechazadas" stroke="#f87171" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* 2. Densidad Comparativa: Requisiciones vs. Tickets de Pago */}
                <div className="chart-card">
                  <div className="chart-card-title">
                    <Activity size={20} color="#fbbf24" />
                    <span>Densidad Operativa: Requisiciones vs. Tickets de Pago</span>
                  </div>
                  <div style={{ width: '100%', height: 320 }}>
                    {dailyTraceabilityData.length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                        No hay suficientes datos registrados para este período
                      </div>
                    ) : (
                      <ResponsiveContainer>
                        <AreaChart
                          data={dailyTraceabilityData}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorReqs" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                            </linearGradient>
                            <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="label" stroke="#64748b" style={{ fontSize: '10px' }} />
                          <YAxis stroke="#64748b" style={{ fontSize: '11px' }} allowDecimals={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: 'white', fontFamily: 'Inter' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '12px', marginTop: '10px' }} />
                          <Area type="monotone" dataKey="emitidas" name="Requisiciones Emitidas" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorReqs)" />
                          <Area type="monotone" dataKey="tickets" name="Tickets de Pago Emitidos" stroke="#fbbf24" strokeWidth={2} fillOpacity={1} fill="url(#colorTickets)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* TRAZABILIDAD Y AUDITORIA DE SESIONES (TABS) */
            <div className="animate-fade">
              {/* AUDIT SUMMARY STATS */}
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                    <UserCheck size={22} />
                  </div>
                  <div className="metric-info">
                    <h4>Inicios Exitosos</h4>
                    <div className="metric-value">
                      {filteredAuthAttempts.filter(l => l.exitoso).length}
                    </div>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                    <Ban size={22} />
                  </div>
                  <div className="metric-info">
                    <h4>Intentos Fallidos</h4>
                    <div className="metric-value">
                      {filteredAuthAttempts.filter(l => !l.exitoso).length}
                    </div>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                    <Activity size={22} />
                  </div>
                  <div className="metric-info">
                    <h4>D.A.U. Promedio (Período)</h4>
                    <div className="metric-value">
                      {dauTimelineData.length > 0 
                        ? (dauTimelineData.reduce((acc, d) => acc + d["Usuarios Activos"], 0) / dauTimelineData.length).toFixed(1)
                        : 0
                      }
                    </div>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                    <RefreshCw size={22} />
                  </div>
                  <div className="metric-info">
                    <h4>Modificaciones Perfiles</h4>
                    <div className="metric-value">
                      {filteredProfileChanges.length}
                    </div>
                  </div>
                </div>
              </div>

              {/* CHARTS CONTAINER */}
              <div className="charts-grid">
                {/* Timeline DAU Chart */}
                <div className="chart-card">
                  <div className="chart-card-title">
                    <TrendingUp size={20} color="#38bdf8" />
                    <span>Línea de Tiempo: Usuarios Activos Diarios (DAU)</span>
                  </div>
                  <div style={{ width: '100%', height: 260 }}>
                    {dauTimelineData.length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                        No hay inicios de sesión en este período.
                      </div>
                    ) : (
                      <ResponsiveContainer>
                        <LineChart
                          data={dauTimelineData}
                          margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="fecha" stroke="#64748b" style={{ fontSize: '10px' }} />
                          <YAxis stroke="#64748b" style={{ fontSize: '11px' }} allowDecimals={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: 'white', fontFamily: 'Inter' }}
                          />
                          <Line type="monotone" dataKey="Usuarios Activos" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Login Hourly Density */}
                <div className="chart-card">
                  <div className="chart-card-title">
                    <Clock size={20} color="#f59e0b" />
                    <span>Densidad Horaria de Accesos (Horas de Inicios de Sesión)</span>
                  </div>
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <BarChart
                        data={hourlyAccessData}
                        margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="hora" stroke="#64748b" style={{ fontSize: '9px' }} />
                        <YAxis stroke="#64748b" style={{ fontSize: '11px' }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: 'white', fontFamily: 'Inter' }}
                        />
                        <Legend style={{ fontSize: '12px' }} />
                        <Bar dataKey="Inicios Exitosos" name="Exitosos" fill="#10b981" stackId="a" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Intentos Fallidos" name="Fallidos" fill="#ef4444" stackId="a" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* SESSIONS AUDIT LOG TABLE */}
              <div className="chart-card" style={{ marginBottom: '30px', background: 'rgba(30, 41, 59, 0.2)' }}>
                <div className="chart-card-title">
                  <Server size={20} color="#10b981" />
                  <span>Bitácora de Sesiones y Auditoría de Direcciones IP</span>
                </div>
                <div style={{ overflowX: 'auto', maxHeight: '350px' }}>
                  <table className="console-table" style={{ fontFamily: 'Inter' }}>
                    <thead>
                      <tr>
                        <th>USUARIO / CORREO</th>
                        <th style={{ width: '120px' }}>ESTADO</th>
                        <th style={{ width: '150px' }}>DIRECCIÓN IP</th>
                        <th>DISPOSITIVO / NAVAGADOR (USER AGENT)</th>
                        <th style={{ width: '180px' }}>FECHA Y HORA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAuthAttempts.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>
                            No se registran sesiones en este rango de fechas. Asegúrese de haber creado la tabla `user_auth_logs` en Supabase.
                          </td>
                        </tr>
                      ) : (
                        filteredAuthAttempts.slice(0, 50).map(attempt => (
                          <tr key={attempt.id}>
                            <td style={{ color: 'white', fontWeight: 'bold' }}>{attempt.correo}</td>
                            <td>
                              <span className={attempt.exitoso ? 'badge-warning' : 'badge-error'} style={{
                                backgroundColor: attempt.exitoso ? 'rgba(16, 185, 129, 0.15)' : '',
                                borderColor: attempt.exitoso ? 'rgba(16, 185, 129, 0.3)' : '',
                                color: attempt.exitoso ? '#34d399' : ''
                              }}>
                                {attempt.exitoso ? 'EXITOSO' : 'FALLIDO'}
                              </span>
                            </td>
                            <td style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{attempt.ip_address}</td>
                            <td style={{ color: '#cbd5e1', fontSize: '0.8rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '350px' }} title={attempt.device_info}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Smartphone size={12} color="#64748b" />
                                <span>{attempt.device_info}</span>
                              </div>
                            </td>
                            <td style={{ color: '#64748b', fontSize: '0.85rem' }}>
                              {new Date(attempt.created_at).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PROFILES AND ROLES CHANGES TABLE */}
              <div className="chart-card" style={{ background: 'rgba(30, 41, 59, 0.2)' }}>
                <div className="chart-card-title">
                  <UserCheck size={20} color="#f59e0b" />
                  <span>Bitácora de Modificaciones de Perfiles, Roles y Permisos (Auditoría)</span>
                </div>
                <div style={{ overflowX: 'auto', maxHeight: '350px' }}>
                  <table className="console-table" style={{ fontFamily: 'Inter' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '180px' }}>ADMINISTRADOR</th>
                        <th style={{ width: '150px' }}>ACCIÓN</th>
                        <th>DETALLE DE LA MODIFICACIÓN</th>
                        <th style={{ width: '180px' }}>USUARIO AFECTADO</th>
                        <th style={{ width: '180px' }}>FECHA Y HORA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProfileChanges.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>
                            No se registran cambios de perfiles en este rango de fechas.
                          </td>
                        </tr>
                      ) : (
                        filteredProfileChanges.map(log => (
                          <tr key={log.id}>
                            <td style={{ color: 'white', fontWeight: 'bold' }}>{log.usuario_nombre}</td>
                            <td>
                              <span className="badge-warning" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24' }}>
                                {log.accion}
                              </span>
                            </td>
                            <td style={{ color: '#94a3b8', fontSize: '0.85rem', wordBreak: 'break-all' }}>{log.detalle}</td>
                            <td style={{ color: '#38bdf8', fontSize: '0.85rem' }}>{log.metadata?.target_email || 'N/A'}</td>
                            <td style={{ color: '#64748b', fontSize: '0.85rem' }}>
                              {new Date(log.created_at).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
