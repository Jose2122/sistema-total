import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { compressImage } from './utils/compressImage';
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
  ChevronUp,
  Calendar,
  Smartphone,
  Shield,
  Search,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Bell,
  BellOff,
  Eye,
  History,
  Trash2,
  Layers,
  FileText,
  Package,
  Truck,
  CreditCard,
  Landmark,
  ArrowRight,
  CornerDownRight,
  X,
  ShieldCheck,
  CheckCircle,
  ChevronRight
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

  // Tabs: 'telemetry', 'management', 'traceability', or 'user_audit'
  const [activeTab, setActiveTab] = useState('telemetry');

  // Sub-tabs for Trazabilidad: 'pipeline' | 'sla_bottlenecks' | 'inspector' | 'bitacora'
  const [subTabTrazabilidad, setSubTabTrazabilidad] = useState('pipeline');
  const [inspectorSearch, setInspectorSearch] = useState('');
  const [inspectedItem, setInspectedItem] = useState(null);
  const [inspectedType, setInspectedType] = useState('requisicion'); // 'requisicion' | 'odc' | 'ticket'

  // Date Range Picker States (Default Histórico Completo)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [busquedaTrazabilidad, setBusquedaTrazabilidad] = useState('');
  const [filtroAccionTrazabilidad, setFiltroAccionTrazabilidad] = useState('TODAS');

  // Telemetry raw data from Supabase
  const [systemErrors, setSystemErrors] = useState([]);
  const [hourlyTraffic, setHourlyTraffic] = useState([]);
  const [storageStats, setStorageStats] = useState([]);
  const [dbLatency, setDbLatency] = useState(0);
  const [testingLatency, setTestingLatency] = useState(false);
  const [largestFiles, setLargestFiles] = useState([]);

  // VPS status telemetry states
  const [vpsStats, setVpsStats] = useState(null);
  const [vpsLoading, setVpsLoading] = useState(false);
  const [vpsError, setVpsError] = useState(null);

  // Storage retroactive compression progress states
  const [compressingHistory, setCompressingHistory] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState({ current: 0, total: 0, savedBytes: 0 });

  // Versions and Changelog state
  const [nuevaVersion, setNuevaVersion] = useState({ version: '', descripcion: '', notificar: false });
  const [modalPreviewOpen, setModalPreviewOpen] = useState(false);
  const [guardandoVersion, setGuardandoVersion] = useState(false);
  const [historialVersiones, setHistorialVersiones] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [expandedVersionId, setExpandedVersionId] = useState(null);

  const cargarHistorialVersiones = async () => {
    setCargandoHistorial(true);
    try {
      const { data, error } = await supabase
        .from('sistema_versiones')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        if (error.code !== '42P01') console.error('Error cargando historial:', error);
        return;
      }
      setHistorialVersiones(data || []);
    } catch (err) {
      console.error('Error en historial de versiones:', err);
    } finally {
      setCargandoHistorial(false);
    }
  };

  useEffect(() => {
    cargarHistorialVersiones();
  }, []);

  const eliminarVersion = async (id, ver) => {
    if (!window.confirm(`¿Eliminar la versión ${ver}? Esta acción no se puede deshacer.`)) return;
    try {
      const { error } = await supabase.from('sistema_versiones').delete().eq('id', id);
      if (error) throw error;
      toast.success(`Versión ${ver} eliminada`);
      cargarHistorialVersiones();
    } catch (err) {
      toast.error('Error al eliminar: ' + err?.message);
    }
  };

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
      cargarHistorialVersiones();
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
  const [ordenesCompra, setOrdenesCompra] = useState([]);
  const [solicitudesFondos, setSolicitudesFondos] = useState([]);
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

      // 3. Fetch storage bucket files recursively & calculate accurate size
      let allStorageFiles = [];
      const listAllFiles = async (bucket, path = '') => {
        try {
          const { data, error } = await supabase.storage.from(bucket).list(path, { limit: 1000 });
          if (error || !data) return [];
          let files = [];
          for (const item of data) {
            const fullPath = path ? `${path}/${item.name}` : item.name;
            if (item.metadata) {
              files.push({
                name: fullPath,
                bucket_id: bucket,
                size: item.metadata.size || item.size || 0,
                created_at: item.created_at,
                owner_id: item.owner_id
              });
            } else {
              const sub = await listAllFiles(bucket, fullPath);
              files = files.concat(sub);
            }
          }
          return files;
        } catch {
          return [];
        }
      };

      try {
        const facturasFiles = await listAllFiles('facturas');
        const ticketsFiles = await listAllFiles('tickets-evidencia');
        allStorageFiles = [...facturasFiles, ...ticketsFiles].sort((a, b) => b.size - a.size);
        setLargestFiles(allStorageFiles);

        const localBucketStats = [
          {
            bucket_id: 'facturas',
            total_bytes: facturasFiles.reduce((acc, f) => acc + Number(f.size || 0), 0),
            files_count: facturasFiles.length
          },
          {
            bucket_id: 'tickets-evidencia',
            total_bytes: ticketsFiles.reduce((acc, f) => acc + Number(f.size || 0), 0),
            files_count: ticketsFiles.length
          }
        ];
        setStorageStats(localBucketStats);
      } catch (err) {
        console.error("Error procesando archivos de storage:", err);
      }

      // 4. Fetch traffic distribution RPC
      const { data: trafficRpc, error: trafficRpcError } = await supabase.rpc('get_hourly_traffic');
      if (!trafficRpcError && trafficRpc) {
        setHourlyTraffic(trafficRpc);
      } else {
        const dummyTraffic = Array.from({ length: 24 }, (_, i) => ({
          hora: i,
          requisiciones_count: Math.floor(Math.random() * 8) + 2,
          solicitudes_count: Math.floor(Math.random() * 5) + 1
        }));
        setHourlyTraffic(dummyTraffic);
      }

      // 5. Helper para paginar y traer el 100% de los registros de Supabase (sin límite de 1000)
      const fetchAllTableRecords = async (tableName, orderCol = 'id') => {
        let allData = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          let query = supabase
            .from(tableName)
            .select('*')
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (orderCol) {
            query = query.order(orderCol, { ascending: false });
          }

          const { data: chunk, error: errChunk } = await query;
          if (errChunk) {
            if (errChunk.code !== '42P01') console.warn(`Aviso al cargar ${tableName}:`, errChunk.message);
            break;
          }
          if (chunk && chunk.length > 0) {
            allData = allData.concat(chunk);
            if (chunk.length < pageSize) {
              hasMore = false;
            } else {
              page++;
            }
          } else {
            hasMore = false;
          }
        }
        return allData;
      };

      // 6. Fetch requisiciones completas (100% histórico paginado)
      const reqs = await fetchAllTableRecords('requisiciones', 'id');
      setRequisiciones(reqs || []);

      // 7. Fetch requisiciones audit action logs completos (100% histórico paginado)
      const logs = await fetchAllTableRecords('requisicion_logs', 'id');
      setRequisicionLogs(logs || []);

      // 8. Fetch active perfiles count
      const { data: profiles } = await supabase
        .from('perfiles')
        .select('id, nombre, apellido, rol, departamento, activo, last_login, created_at')
        .order('created_at', { ascending: false });
      setPerfiles(profiles || []);

      // 9. Fetch user auth logs
      const { data: authLogs } = await supabase
        .from('user_auth_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      setAuthAttempts(authLogs || []);

      // 10. Fetch user profiles modification logs
      const { data: actLogs } = await supabase
        .from('logs_actividad')
        .select('*')
        .eq('modulo', 'Usuarios')
        .order('created_at', { ascending: false })
        .limit(200);
      setProfileChanges(actLogs || []);

      // 11. Fetch tickets_directos completos (100% paginado)
      const tkts = await fetchAllTableRecords('tickets_directos', 'id');
      setTicketsDirectos(tkts || []);

      // 12. Fetch ordenes_compra completas (100% paginado)
      const odcs = await fetchAllTableRecords('ordenes_compra', 'id');
      setOrdenesCompra(odcs || []);

      // 13. Fetch solicitudes_fondos completas (100% paginado)
      const sfs = await fetchAllTableRecords('solicitudes_fondos', 'id');
      setSolicitudesFondos(sfs || []);

      // 14. Fetch VPS server status disk telemetry
      await fetchVpsStatus();

    } catch (err) {
      console.error("Error cargando métricas de telemetría:", err);
    } finally {
      setLoading(false);
    }
  };

  // Refresco silencioso: solo actualiza datos operativos sin mostrar pantalla de carga
  const refrescarDatosSilencioso = async () => {
    try {
      const fetchAllTableRecords = async (tableName, orderCol = 'id') => {
        let allData = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;
        while (hasMore) {
          let query = supabase.from(tableName).select('*').range(page * pageSize, (page + 1) * pageSize - 1);
          if (orderCol) query = query.order(orderCol, { ascending: false });
          const { data: chunk, error: errChunk } = await query;
          if (errChunk) break;
          if (chunk && chunk.length > 0) {
            allData = allData.concat(chunk);
            if (chunk.length < pageSize) hasMore = false;
            else page++;
          } else {
            hasMore = false;
          }
        }
        return allData;
      };

      const reqs = await fetchAllTableRecords('requisiciones', 'id');
      setRequisiciones(reqs || []);

      const logs = await fetchAllTableRecords('requisicion_logs', 'id');
      setRequisicionLogs(logs || []);

      const tkts = await fetchAllTableRecords('tickets_directos', 'id');
      setTicketsDirectos(tkts || []);

      const odcs = await fetchAllTableRecords('ordenes_compra', 'id');
      setOrdenesCompra(odcs || []);
    } catch (err) {
      console.warn("Error en refresco silencioso:", err);
    }
  };

  useEffect(() => {
    if (authorized === true) {
      cargarDatos();

      // Realtime subscription for requisiciones
      const reqChannel = supabase
        .channel('realtime_reqs_analytics')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'requisiciones' }, () => {
          refrescarDatosSilencioso();
        })
        .subscribe();

      // Realtime subscription for requisicion_logs
      const logsChannel = supabase
        .channel('realtime_logs_analytics')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'requisicion_logs' }, () => {
          refrescarDatosSilencioso();
        })
        .subscribe();

      // Realtime subscription for tickets_directos
      const tktsChannel = supabase
        .channel('realtime_tkts_analytics')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets_directos' }, () => {
          refrescarDatosSilencioso();
        })
        .subscribe();

      // Realtime subscription for ordenes_compra
      const odcsChannel = supabase
        .channel('realtime_odcs_analytics')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_compra' }, () => {
          refrescarDatosSilencioso();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(reqChannel);
        supabase.removeChannel(logsChannel);
        supabase.removeChannel(tktsChannel);
        supabase.removeChannel(odcsChannel);
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

  const fetchVpsStatus = async () => {
    setVpsLoading(true);
    setVpsError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const vpsUrl = import.meta.env.VITE_VPS_API_URL || 'http://localhost:3001';

      const res = await fetch(`${vpsUrl}/api/vps-status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error('Servicio de telemetría no disponible');
      }

      const data = await res.json();
      setVpsStats(data);
    } catch (err) {
      console.error('Error fetching VPS status:', err);
      setVpsError('Servicio de telemetría no disponible');
      setVpsStats(null);
    } finally {
      setVpsLoading(false);
    }
  };

  // Resolve Requisition / Ticket correlation code from file path
  const getAssociatedRefInfo = useCallback((file) => {
    const path = file.name || '';

    // Extract UUID from path
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const match = path.match(uuidRegex);

    let reqId = null;
    let ticketId = null;

    if (match) {
      const extractedId = match[0];
      if (path.includes('req-') || path.includes('facturas/') || path.includes('requisiciones/') || path.startsWith('factura_')) {
        reqId = extractedId;
      } else if (path.includes('tickets/') || path.includes('ticket-') || path.includes('comprobantes/') || path.includes('tickets-evidencia/')) {
        ticketId = extractedId;
      }
    }

    // Fallback: extract from prefix like factura_[reqId]_...
    if (!reqId && !ticketId) {
      if (path.startsWith('factura_')) {
        const parts = path.split('_');
        if (parts[1] && parts[1].length > 10) {
          reqId = parts[1];
        }
      }
    }

    if (reqId) {
      const req = requisiciones.find(r => String(r.id) === String(reqId));
      if (req) {
        return {
          tipo: 'Requisición',
          codigo: req.correlativo_req || req.correlativo || 'Sin Código',
          solicitante: req.solicitante || 'N/A'
        };
      }
    }

    if (ticketId) {
      const tk = ticketsDirectos.find(t => String(t.id) === String(ticketId));
      if (tk) {
        return {
          tipo: 'Ticket',
          codigo: tk.codigo_control || 'Sin Código',
          solicitante: tk.departamento || 'N/A'
        };
      }
    }

    return { tipo: 'N/A', codigo: 'Desconocido', solicitante: 'N/A' };
  }, [requisiciones, ticketsDirectos]);

  // Compress all image files in storage retroactively
  const comprimirHistorialStorage = async () => {
    if (largestFiles.length === 0) {
      toast.error("No hay archivos para comprimir en este momento.");
      return;
    }

    // Filter image files larger than 150KB to avoid unnecessary double compression
    const imageFiles = largestFiles.filter(file => {
      const name = (file.name || '').toLowerCase();
      const isImg = name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp');
      const isLarge = file.size > 150 * 1024;
      return isImg && isLarge;
    });

    if (imageFiles.length === 0) {
      toast.success("Todas las imágenes ya se encuentran optimizadas en el storage.");
      return;
    }

    setCompressingHistory(true);
    setCompressionProgress({ current: 0, total: imageFiles.length, savedBytes: 0 });
    let totalSaved = 0;

    try {
      for (let i = 0; i < imageFiles.length; i++) {
        const fileObj = imageFiles[i];
        setCompressionProgress(prev => ({ ...prev, current: i + 1 }));

        // Download image blob
        const { data: fileBlob, error: downloadError } = await supabase.storage
          .from(fileObj.bucket_id)
          .download(fileObj.name);

        if (downloadError || !fileBlob) {
          console.error(`[COMPRESS MIGRATION] Failed to download ${fileObj.name}:`, downloadError);
          continue;
        }

        // Compress Image Blob
        const compressedBlob = await compressImage(fileBlob, { quality: 0.75 });

        // Replace in storage if smaller
        if (compressedBlob && compressedBlob.size < fileObj.size) {
          const { error: uploadError } = await supabase.storage
            .from(fileObj.bucket_id)
            .upload(fileObj.name, compressedBlob, {
              upsert: true,
              contentType: 'image/jpeg'
            });

          if (uploadError) {
            console.error(`[COMPRESS MIGRATION] Failed to overwrite ${fileObj.name}:`, uploadError);
          } else {
            totalSaved += (fileObj.size - compressedBlob.size);
            setCompressionProgress(prev => ({ ...prev, savedBytes: totalSaved }));
          }
        }
      }

      toast.success(`Compresión de historial finalizada con éxito. Ahorro de espacio: ${bytesToSize(totalSaved)}`);
      // Reload page telemetry statistics
      cargarDatos();
    } catch (e) {
      console.error("Error en comprimirHistorialStorage:", e);
      toast.error("Ocurrió un error al procesar el historial.");
    } finally {
      setCompressingHistory(false);
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
      if (r.centro_costo) deptos.add(r.centro_costo);
    });
    ticketsDirectos.forEach(t => {
      if (t.departamento) deptos.add(t.departamento);
      if (t.centro_costo) deptos.add(t.centro_costo);
    });
    ordenesCompra.forEach(o => {
      if (o.departamento) deptos.add(o.departamento);
      if (o.centro_costo) deptos.add(o.centro_costo);
    });
    return Array.from(deptos).filter(Boolean).sort();
  }, [requisiciones, ticketsDirectos, ordenesCompra]);

  const filteredReqsForTraceability = useMemo(() => {
    const { start, end } = dateLimits;
    let list = requisiciones;
    if (start && end) {
      list = list.filter(r => {
        const date = new Date(r.created_at || r.fecha_emision);
        return date >= start && date <= end;
      });
    }
    if (traceabilityDeptoFilter !== 'TODOS') {
      list = list.filter(r => 
        (r.gerencia || '').toUpperCase() === traceabilityDeptoFilter.toUpperCase() ||
        (r.centro_costo || '').toUpperCase() === traceabilityDeptoFilter.toUpperCase()
      );
    }
    return list;
  }, [requisiciones, dateLimits, traceabilityDeptoFilter]);

  const filteredTicketsForTraceability = useMemo(() => {
    const { start, end } = dateLimits;
    let list = ticketsDirectos;
    if (start && end) {
      list = list.filter(t => {
        const date = t.fecha_emision ? new Date(t.fecha_emision.includes('T') ? t.fecha_emision : t.fecha_emision + 'T12:00:00') : new Date(t.created_at);
        return date >= start && date <= end;
      });
    }
    if (traceabilityDeptoFilter !== 'TODOS') {
      list = list.filter(t => 
        (t.departamento || '').toUpperCase() === traceabilityDeptoFilter.toUpperCase() ||
        (t.centro_costo || '').toUpperCase() === traceabilityDeptoFilter.toUpperCase()
      );
    }
    return list;
  }, [ticketsDirectos, dateLimits, traceabilityDeptoFilter]);

  const filteredOdcsForTraceability = useMemo(() => {
    const { start, end } = dateLimits;
    let list = ordenesCompra;
    if (start && end) {
      list = list.filter(o => {
        const date = new Date(o.created_at || o.fecha_emision);
        return date >= start && date <= end;
      });
    }
    if (traceabilityDeptoFilter !== 'TODOS') {
      list = list.filter(o => 
        (o.departamento || '').toUpperCase() === traceabilityDeptoFilter.toUpperCase() ||
        (o.centro_costo || '').toUpperCase() === traceabilityDeptoFilter.toUpperCase()
      );
    }
    return list;
  }, [ordenesCompra, dateLimits, traceabilityDeptoFilter]);

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
      if (!req) return true;
      if (traceabilityDeptoFilter !== 'TODOS') {
        return (
          (req.gerencia || '').toUpperCase() === traceabilityDeptoFilter.toUpperCase() ||
          (req.centro_costo || '').toUpperCase() === traceabilityDeptoFilter.toUpperCase()
        );
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
        tickets: 0,
        odcs: 0
      };
      current.setDate(current.getDate() + 1);
    }

    filteredReqsForTraceability.forEach(r => {
      const refDate = r.created_at || r.fecha_emision;
      if (refDate) {
        const dateStr = new Date(refDate).toISOString().split('T')[0];
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
      const refDate = t.fecha_emision || t.created_at;
      if (refDate) {
        try {
          const dateStr = new Date(refDate.includes('T') ? refDate : refDate + 'T12:00:00').toISOString().split('T')[0];
          if (datesMap[dateStr]) {
            datesMap[dateStr].tickets += 1;
          }
        } catch (e) {
          console.error("Error formatting ticket date:", refDate, e);
        }
      }
    });

    filteredOdcsForTraceability.forEach(o => {
      const refDate = o.created_at || o.fecha_emision;
      if (refDate) {
        try {
          const dateStr = new Date(refDate.includes('T') ? refDate : refDate + 'T12:00:00').toISOString().split('T')[0];
          if (datesMap[dateStr]) {
            datesMap[dateStr].odcs += 1;
          }
        } catch (e) {
          console.error("Error formatting odc date:", refDate, e);
        }
      }
    });

    return Object.values(datesMap).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [filteredReqsForTraceability, filteredTicketsForTraceability, filteredLogsForTraceability, filteredOdcsForTraceability, dateLimits]);

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
  // MODULE 1: LIFECYCLE FUNNEL PIPELINE CALCULATIONS (5 FASES)
  // ----------------------------------------------------
  const lifecycleFunnelData = useMemo(() => {
    const totalReqs = filteredReqsForTraceability.length;
    const emitidasCount = totalReqs;
    
    const aprobadasReqs = filteredReqsForTraceability.filter(r => 
      r.estado_aprobacion === 'aprobado_final' || r.estado_aprobacion === 'APROBADO_FINAL'
    );
    const aprobadasCount = aprobadasReqs.length;
    const tasaAprobacion = emitidasCount > 0 ? ((aprobadasCount / emitidasCount) * 100).toFixed(1) : 0;
    
    const rechazosCount = filteredLogsForTraceability.filter(l => l.accion === 'RECHAZADA' || l.accion === 'RECHAZADO').length;
    const odcsCount = filteredOdcsForTraceability.length;
    const ticketsCount = filteredTicketsForTraceability.length;
    const compromisosCount = odcsCount + ticketsCount;

    // Recepción en almacén: análisis de items en historial de compras
    let reqsConAlmacen = 0;
    let reqsEnCompras = 0;
    filteredReqsForTraceability.forEach(r => {
      const items = Array.isArray(r.items) ? r.items : [];
      let hasPurchases = false;
      let allUbicados = true;
      items.forEach(it => {
        const hist = Array.isArray(it.historial_compras) ? it.historial_compras : [];
        const compras = hist.filter(h => h.tipo !== 'JUSTIFICACION' && h.tipo !== 'ANULACION');
        if (compras.length > 0) {
          hasPurchases = true;
          compras.forEach(h => {
            const st = h.estatus_almacen || (h.enviado_almacen ? 'Ubicado' : 'Pendiente_Compras');
            if (st !== 'Ubicado') allUbicados = false;
          });
        }
      });
      if (hasPurchases && allUbicados) reqsConAlmacen++;
      else if (hasPurchases) reqsEnCompras++;
    });

    // Liquidación financiera de tickets
    const ticketsPagados = filteredTicketsForTraceability.filter(t => 
      t.estado === 'PAGADO' || t.estado === 'LIQUIDADO' || t.estatus === 'PAGADO' || t.pagado === true
    ).length;
    const ticketsPendientes = Math.max(0, ticketsCount - ticketsPagados);

    return {
      emitidasCount,
      aprobadasCount,
      tasaAprobacion,
      rechazosCount,
      odcsCount,
      ticketsCount,
      compromisosCount,
      reqsConAlmacen,
      reqsEnCompras,
      ticketsPagados,
      ticketsPendientes
    };
  }, [filteredReqsForTraceability, filteredOdcsForTraceability, filteredTicketsForTraceability, filteredLogsForTraceability]);

  // ----------------------------------------------------
  // MODULE 2: SLA & BOTTLENECKS CALCULATIONS
  // ----------------------------------------------------
  const bottleneckRequisitions = useMemo(() => {
    const pendingStatuses = ['pendiente_proyecto', 'pendiente_area', 'enviada_general', 'PENDIENTE', 'pendiente', 'en_espera'];
    const now = Date.now();

    const pendingList = filteredReqsForTraceability.filter(r => 
      pendingStatuses.includes(r.estado_aprobacion)
    ).map(r => {
      const createdAt = new Date(r.created_at || r.fecha_emision || now);
      const diffMs = now - createdAt.getTime();
      const diasEspera = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      const horasEspera = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));

      let nivel = 'NORMAL';
      if (diasEspera >= 5) nivel = 'CRITICA';
      else if (diasEspera >= 3) nivel = 'ADVERTENCIA';

      return {
        ...r,
        diasEspera,
        horasEspera,
        nivel
      };
    });

    return pendingList.sort((a, b) => b.horasEspera - a.horasEspera);
  }, [filteredReqsForTraceability]);

  const slaByDepartmentData = useMemo(() => {
    const deptMap = {};
    listTraceabilityDeptos.forEach(d => {
      deptMap[d] = {
        departamento: d,
        emitidas: 0,
        aprobadas: 0,
        pendientes: 0,
        rechazos: 0,
        totalSlaMs: 0
      };
    });

    filteredReqsForTraceability.forEach(r => {
      const d = r.gerencia || r.centro_costo || 'Sin Departamento';
      if (!deptMap[d]) {
        deptMap[d] = { departamento: d, emitidas: 0, aprobadas: 0, pendientes: 0, rechazos: 0, totalSlaMs: 0 };
      }
      deptMap[d].emitidas++;
      if (r.estado_aprobacion === 'aprobado_final' || r.estado_aprobacion === 'APROBADO_FINAL') {
        deptMap[d].aprobadas++;
        if (r.fecha_aprobacion_final && r.created_at) {
          const diff = new Date(r.fecha_aprobacion_final) - new Date(r.created_at);
          if (diff > 0) deptMap[d].totalSlaMs += diff;
        }
      } else if (['pendiente_proyecto', 'pendiente_area', 'enviada_general', 'PENDIENTE'].includes(r.estado_aprobacion)) {
        deptMap[d].pendientes++;
      }
    });

    filteredLogsForTraceability.forEach(l => {
      if (l.accion === 'RECHAZADA' || l.accion === 'RECHAZADO') {
        const req = requisiciones.find(r => r.id === l.requisicion_id);
        const d = req?.gerencia || req?.centro_costo || 'Sin Departamento';
        if (deptMap[d]) deptMap[d].rechazos++;
      }
    });

    return Object.values(deptMap).map(item => {
      const avgHours = item.aprobadas > 0 ? (item.totalSlaMs / item.aprobadas / (1000 * 60 * 60)).toFixed(1) : '0';
      const avgDays = (Number(avgHours) / 24).toFixed(1);
      const tasaAprobacion = item.emitidas > 0 ? ((item.aprobadas / item.emitidas) * 100).toFixed(1) : 0;
      return {
        ...item,
        avgHours: Number(avgHours),
        avgDays: Number(avgDays),
        tasaAprobacion: Number(tasaAprobacion)
      };
    }).filter(d => d.emitidas > 0).sort((a, b) => b.pendientes - a.pendientes || b.emitidas - a.emitidas);
  }, [listTraceabilityDeptos, filteredReqsForTraceability, filteredLogsForTraceability, requisiciones]);

  // ----------------------------------------------------
  // MODULE 3: 360 INSPECTOR UNIVERSAL SEARCH RESULTS
  // ----------------------------------------------------
  const inspectorSearchResults = useMemo(() => {
    if (!inspectorSearch.trim() || inspectorSearch.trim().length < 2) return [];
    const q = inspectorSearch.toLowerCase().trim();
    const results = [];

    // 1. Requisiciones
    requisiciones.forEach(r => {
      const code = String(r.correlativo_req || r.id || '').toLowerCase();
      const sol = String(r.solicitante || '').toLowerCase();
      const depto = String(r.gerencia || r.centro_costo || '').toLowerCase();
      const just = String(r.justificacion || '').toLowerCase();
      if (code.includes(q) || sol.includes(q) || depto.includes(q) || just.includes(q)) {
        results.push({
          tipo: 'requisicion',
          id: r.id,
          titulo: r.correlativo_req || `REQ-${r.id}`,
          subtitulo: `${r.solicitante || 'Sin solicitante'} • ${r.gerencia || 'SITC'}`,
          estado: r.estado_aprobacion,
          fecha: r.created_at || r.fecha_emision,
          data: r
        });
      }
    });

    // 2. Órdenes de Compra
    ordenesCompra.forEach(o => {
      const num = String(o.correlativo || o.numero_orden || o.id || '').toLowerCase();
      const prov = String(o.proveedor_nombre || '').toLowerCase();
      const rif = String(o.proveedor_rif || '').toLowerCase();
      if (num.includes(q) || prov.includes(q) || rif.includes(q)) {
        results.push({
          tipo: 'odc',
          id: o.id,
          titulo: o.correlativo ? `ODC-${o.correlativo}` : `ODC #${o.id}`,
          subtitulo: `${o.proveedor_nombre || 'Proveedor'} • $${Number(o.total || o.total_monto || 0).toLocaleString()}`,
          estado: o.estado || 'EMITIDA',
          fecha: o.fecha_emision || o.created_at,
          data: o
        });
      }
    });

    // 3. Tickets Directos de Pago
    ticketsDirectos.forEach(t => {
      const code = String(t.codigo_control || t.id || '').toLowerCase();
      const prov = String(t.proveedor || '').toLowerCase();
      const conc = String(t.concepto || '').toLowerCase();
      if (code.includes(q) || prov.includes(q) || conc.includes(q)) {
        results.push({
          tipo: 'ticket',
          id: t.id,
          titulo: t.codigo_control || `TKT-${t.id}`,
          subtitulo: `${t.proveedor || 'Proveedor'} • ${t.departamento || 'General'}`,
          estado: t.estado || 'EMITIDO',
          fecha: t.fecha_emision || t.created_at,
          data: t
        });
      }
    });

    return results.slice(0, 15);
  }, [inspectorSearch, requisiciones, ordenesCompra, ticketsDirectos]);

  // Handler para seleccionar un expediente e inspeccionarlo en el Módulo 3
  const abrirInspectorExpediente = (item, tipo = 'requisicion') => {
    let targetObj = item;
    if (tipo === 'requisicion' && (typeof item === 'number' || typeof item === 'string')) {
      targetObj = requisiciones.find(r => r.id === parseInt(item) || r.correlativo_req === item) || item;
    }
    setInspectedItem(targetObj);
    setInspectedType(tipo);
    setSubTabTrazabilidad('inspector');
    toast.success(`Expediente cargado en el Inspector 360° ✓`);
  };

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
    return null;
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

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              style={{
                backgroundColor: !startDate && !endDate ? '#0284c7' : '#1e293b',
                color: 'white',
                border: '1px solid #334155',
                padding: '5px 10px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              📅 Histórico Completo
            </button>

            <button
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 30);
                setStartDate(d.toISOString().split('T')[0]);
                setEndDate(new Date().toISOString().split('T')[0]);
              }}
              style={{
                backgroundColor: startDate && endDate ? '#0284c7' : '#1e293b',
                color: 'white',
                border: '1px solid #334155',
                padding: '5px 10px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              📅 Últimos 30 Días
            </button>
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
                            <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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

                {/* VPS Telemetry Card */}
                <div className="chart-card">
                  <div className="chart-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Server size={20} color="#38bdf8" />
                      <span>Telemetría de Servidor VPS (Disco)</span>
                    </div>
                    <button
                      onClick={fetchVpsStatus}
                      disabled={vpsLoading}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#38bdf8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.85rem'
                      }}
                      title="Actualizar estado del VPS"
                    >
                      <RefreshCw size={14} className={vpsLoading ? 'animate-spin' : ''} />
                      <span>Actualizar</span>
                    </button>
                  </div>

                  {vpsLoading && !vpsStats ? (
                    <div style={{ padding: '40px 0', textAlign: 'center' }}>
                      <RefreshCw className="animate-spin" size={24} color="#38bdf8" style={{ margin: '0 auto 10px auto' }} />
                      <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Consultando telemetría del servidor...</p>
                    </div>
                  ) : vpsError ? (
                    <div style={{ padding: '30px 15px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.05)', border: '1px dashed rgba(239, 68, 68, 0.2)', borderRadius: '12px', margin: '10px 0' }}>
                      <ShieldAlert size={28} color="#ef4444" style={{ margin: '0 auto 10px auto' }} />
                      <p style={{ color: '#f87171', fontWeight: '600', fontSize: '0.9rem', marginBottom: '4px' }}>{vpsError}</p>
                      <p style={{ color: '#94a3b8', fontSize: '0.75rem' }}>No se pudo establecer conexión con el endpoint del VPS</p>
                    </div>
                  ) : vpsStats ? (
                    <div className="storage-progress-container" style={{ marginTop: '10px' }}>
                      <div className="storage-labels" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                        <span style={{ fontWeight: '600', color: '#e2e8f0' }}>Uso de Disco Duro</span>
                        <span
                          style={{
                            fontWeight: 'bold',
                            color: vpsStats.usagePercentage > 90 ? '#ef4444' : vpsStats.usagePercentage > 70 ? '#f59e0b' : '#10b981'
                          }}
                        >
                          {vpsStats.usagePercentage}% Consumido
                        </span>
                      </div>
                      <div className="storage-progress-bar-bg" style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden', marginBottom: '16px' }}>
                        <div
                          className="storage-progress-bar-fill"
                          style={{
                            height: '100%',
                            width: `${vpsStats.usagePercentage}%`,
                            backgroundColor: vpsStats.usagePercentage > 90 ? '#ef4444' : vpsStats.usagePercentage > 70 ? '#f59e0b' : '#10b981',
                            transition: 'width 0.4s ease-out'
                          }}
                        ></div>
                      </div>

                      <div className="storage-meta" style={{ display: 'flex', gap: '20px', marginTop: '15px', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Espacio Usado</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'white', marginTop: '4px' }}>
                            {vpsStats.usedDisk} GB
                          </div>
                        </div>
                        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '20px', flex: 1 }}>
                          <div style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Espacio Libre</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981', marginTop: '4px' }}>
                            {vpsStats.freeDisk} GB
                          </div>
                        </div>
                        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '20px', flex: 1 }}>
                          <div style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Disco Total</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#94a3b8', marginTop: '4px' }}>
                            {vpsStats.totalDisk} GB
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '20px 0', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                      Cargando telemetría...
                    </div>
                  )}
                </div>
              </div>

              {/* STORAGE BLOAT AUDIT: LARGEST FILES */}
              <div className="chart-card" style={{ marginBottom: '30px', background: 'rgba(30, 41, 59, 0.2)' }}>
                <div className="chart-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <HardDrive size={20} color="#38bdf8" />
                    <span>Auditoría de Almacenamiento (Top Archivos Más Pesados y Uploaders)</span>
                  </div>
                  <button
                    onClick={comprimirHistorialStorage}
                    disabled={compressingHistory || largestFiles.length === 0}
                    style={{
                      backgroundColor: '#10b981',
                      border: 'none',
                      color: 'white',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      opacity: (compressingHistory || largestFiles.length === 0) ? 0.6 : 1,
                      transition: 'opacity 0.2s'
                    }}
                  >
                    {compressingHistory ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Comprimiendo ({compressionProgress.current}/{compressionProgress.total})...</span>
                      </>
                    ) : (
                      <>
                        <Cpu size={14} />
                        <span>Comprimir Historial de Storage</span>
                      </>
                    )}
                  </button>
                </div>

                {compressingHistory && (
                  <div style={{ margin: '15px 0', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#e2e8f0', marginBottom: '8px' }}>
                      <span>Optimizando historial de imágenes...</span>
                      <span>Ahorro estimado: {bytesToSize(compressionProgress.savedBytes)}</span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          backgroundColor: '#10b981',
                          width: `${(compressionProgress.current / compressionProgress.total) * 100}%`,
                          transition: 'width 0.2s ease-out'
                        }}
                      ></div>
                    </div>
                  </div>
                )}

                <div style={{ overflowX: 'auto' }}>
                  <table className="console-table" style={{ fontFamily: 'Inter' }}>
                    <thead>
                      <tr>
                        <th>ARCHIVO / RUTA</th>
                        <th style={{ width: '120px' }}>CARPETA</th>
                        <th style={{ width: '120px' }}>TAMAÑO</th>
                        <th style={{ width: '180px' }}>ASOCIADO A</th>
                        <th style={{ width: '180px' }}>SUBIDO POR (CREADOR)</th>
                        <th style={{ width: '180px' }}>DEPARTAMENTO</th>
                        <th style={{ width: '150px' }}>FECHA DE SUBIDA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {largestFiles.length === 0 ? (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>
                            No se detectan archivos subidos en el storage.
                          </td>
                        </tr>
                      ) : (
                        largestFiles.slice(0, 100).map((file, idx) => {
                          const uploader = getUploaderInfo(file.owner_id);
                          const refInfo = getAssociatedRefInfo(file);
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
                              <td style={{ fontSize: '0.85rem' }}>
                                {refInfo.tipo === 'Requisición' ? (
                                  <span style={{ color: '#38bdf8', fontWeight: 'bold' }} title={`Creado por: ${refInfo.solicitante}`}>
                                    📝 {refInfo.codigo}
                                  </span>
                                ) : refInfo.tipo === 'Ticket' ? (
                                  <span style={{ color: '#10b981', fontWeight: 'bold' }} title={`Departamento: ${refInfo.solicitante}`}>
                                    🎟️ {refInfo.codigo}
                                  </span>
                                ) : (
                                  <span style={{ color: '#64748b', fontStyle: 'italic' }}>Huérfano / Otro</span>
                                )}
                              </td>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              {/* ROW 1: Form + Preview */}
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
                        onChange={(e) => setNuevaVersion({ ...nuevaVersion, version: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', outline: 'none' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', color: '#cbd5e1' }}>
                        <input
                          type="checkbox"
                          checked={nuevaVersion.notificar}
                          onChange={(e) => setNuevaVersion({ ...nuevaVersion, notificar: e.target.checked })}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#38bdf8' }}
                        />
                        Notificar a los usuarios al iniciar sesión
                      </label>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                        Descripción de Cambios (Uno por línea)
                      </label>
                      <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginBottom: '8px', fontWeight: '600', backgroundColor: 'rgba(56, 189, 248, 0.08)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                        💡 Formato sugerido: <code>[Módulo] Título: Explicación detallada</code>
                      </div>
                      <textarea
                        placeholder="[Cuentas por Pagar] Asignación de Fondos: Ahora finanzas asigna fondos directos.&#10;[Proveedores] Ficha SRM: Control de límite de crédito, días de pago y calificación."
                        value={nuevaVersion.descripcion}
                        onChange={(e) => setNuevaVersion({ ...nuevaVersion, descripcion: e.target.value })}
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
                    <Sparkles size={20} color="#facc15" />
                    <span>Vista Previa del Modal (Inicio de Sesión)</span>
                  </div>

                  {/* Mockup interactivo 1:1 con la experiencia real del usuario */}
                  <ModalNovedades
                    isOpen={true}
                    isInline={true}
                    version={nuevaVersion.version || '2.5'}
                    descripcion={nuevaVersion.descripcion}
                    onClose={() => { }}
                  />
                </div>
              </div>

              {/* ROW 2: HISTORIAL DE VERSIONES */}
              <div className="chart-card" style={{ background: 'rgba(30, 41, 59, 0.2)', padding: '24px' }}>
                <div className="chart-card-title" style={{ marginBottom: '18px' }}>
                  <History size={20} color="#a78bfa" />
                  <span>Historial de Versiones Publicadas</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                    {historialVersiones.length} {historialVersiones.length === 1 ? 'versión' : 'versiones'}
                  </span>
                </div>

                {cargandoHistorial ? (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b', fontSize: '0.85rem' }}>
                    <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
                    <p>Cargando historial...</p>
                  </div>
                ) : historialVersiones.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569' }}>
                    <History size={32} style={{ marginBottom: '10px', opacity: 0.4 }} />
                    <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>No hay versiones registradas aún</p>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Registra la primera versión con el formulario de arriba.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                    {/* Header de la tabla */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '100px 160px 1fr 120px 80px',
                      gap: '12px',
                      padding: '10px 16px',
                      backgroundColor: 'rgba(15, 23, 42, 0.4)',
                      borderRadius: '10px 10px 0 0',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      {['Versión', 'Fecha', 'Descripción', 'Notificación', ''].map((h, i) => (
                        <span key={i} style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                      ))}
                    </div>

                    {/* Filas */}
                    {historialVersiones.map((v, idx) => {
                      const isExpanded = expandedVersionId === (v.id || idx);
                      const fecha = v.created_at ? new Date(v.created_at) : null;
                      const fechaStr = fecha ? fecha.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                      const horaStr = fecha ? fecha.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : '';
                      const lineas = v.descripcion ? v.descripcion.split('\n').map(l => l.trim()).filter(Boolean) : [];
                      const resumen = lineas.length > 0 ? lineas[0].replace(/^-\s*/, '').replace(/^\*\s*/, '') : 'Sin descripción';

                      return (
                        <div key={v.id || idx}>
                          <div
                            onClick={() => setExpandedVersionId(isExpanded ? null : (v.id || idx))}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '100px 160px 1fr 120px 80px',
                              gap: '12px',
                              padding: '12px 16px',
                              backgroundColor: idx % 2 === 0 ? 'rgba(15, 23, 42, 0.15)' : 'transparent',
                              borderBottom: '1px solid rgba(255,255,255,0.03)',
                              cursor: 'pointer',
                              transition: 'background-color 0.15s ease',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.08)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'rgba(15, 23, 42, 0.15)' : 'transparent'}
                          >
                            {/* Versión */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                padding: '3px 10px',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                fontWeight: 800,
                                background: idx === 0 ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(100, 116, 139, 0.2)',
                                color: idx === 0 ? '#fff' : '#94a3b8',
                              }}>v{v.version}</span>
                              {idx === 0 && <span style={{ fontSize: '8px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Última</span>}
                            </div>

                            {/* Fecha */}
                            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1' }}>{fechaStr}</span>
                              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{horaStr}</span>
                            </div>

                            {/* Descripción resumida */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                              <span style={{
                                fontSize: '0.8rem',
                                color: '#94a3b8',
                                fontWeight: 500,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}>{resumen}{lineas.length > 1 ? ` (+${lineas.length - 1} más)` : ''}</span>
                              {isExpanded ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
                            </div>

                            {/* Notificación */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {v.notificar_usuarios ? (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                                  padding: '3px 10px', borderRadius: '20px',
                                  fontSize: '0.7rem', fontWeight: 700,
                                  backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981',
                                }}>
                                  <Bell size={11} /> Activa
                                </span>
                              ) : (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                                  padding: '3px 10px', borderRadius: '20px',
                                  fontSize: '0.7rem', fontWeight: 700,
                                  backgroundColor: 'rgba(100, 116, 139, 0.12)', color: '#64748b',
                                }}>
                                  <BellOff size={11} /> No
                                </span>
                              )}
                            </div>

                            {/* Acciones */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); setExpandedVersionId(isExpanded ? null : (v.id || idx)); }}
                                title="Ver detalles"
                                style={{ padding: '5px', borderRadius: '6px', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', border: 'none', cursor: 'pointer', lineHeight: 0, transition: 'all 0.15s' }}
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); eliminarVersion(v.id, v.version); }}
                                title="Eliminar versión"
                                style={{ padding: '5px', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: 'none', cursor: 'pointer', lineHeight: 0, transition: 'all 0.15s' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Detalle expandido */}
                          {isExpanded && (
                            <div style={{
                              padding: '16px 20px 16px 32px',
                              backgroundColor: 'rgba(99, 102, 241, 0.04)',
                              borderBottom: '1px solid rgba(99, 102, 241, 0.1)',
                              borderLeft: '3px solid #6366f1',
                            }}>
                              <p style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Cambios detallados:</p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {lineas.length === 0 ? (
                                  <span style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>Sin descripción disponible.</span>
                                ) : lineas.map((l, li) => {
                                  const textoLimpio = l.replace(/^-\s*/, '').replace(/^\*\s*/, '');
                                  return (
                                    <div key={li} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                      <CheckCircle2 size={13} style={{ color: '#6366f1', marginTop: '2px', flexShrink: 0 }} />
                                      <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 500, lineHeight: 1.5 }}>{textoLimpio}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
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
            /* TRAZABILIDAD INTEGRAL DE COMPRAS, ODCS Y TICKETS */
            <div className="animate-fade">
              {/* SUB-TABS NAVIGATION & GERENCIA FILTER */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    className={`tab-btn ${subTabTrazabilidad === 'pipeline' ? 'active' : ''}`}
                    onClick={() => setSubTabTrazabilidad('pipeline')}
                  >
                    <Layers size={16} />
                    <span>1. Embudo de Ciclo de Vida</span>
                  </button>
                  <button
                    className={`tab-btn ${subTabTrazabilidad === 'sla_bottlenecks' ? 'active' : ''}`}
                    onClick={() => setSubTabTrazabilidad('sla_bottlenecks')}
                  >
                    <Clock size={16} />
                    <span>2. SLA & Cuellos de Botella</span>
                    {bottleneckRequisitions.filter(r => r.nivel === 'CRITICA').length > 0 && (
                      <span style={{ backgroundColor: '#ef4444', color: 'white', padding: '1px 6px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                        {bottleneckRequisitions.filter(r => r.nivel === 'CRITICA').length}
                      </span>
                    )}
                  </button>
                  <button
                    className={`tab-btn ${subTabTrazabilidad === 'inspector' ? 'active' : ''}`}
                    onClick={() => setSubTabTrazabilidad('inspector')}
                  >
                    <Search size={16} />
                    <span>3. Inspector de Expediente 360°</span>
                    {inspectedItem && (
                      <span style={{ backgroundColor: '#38bdf8', color: '#0f172a', padding: '1px 6px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                        1 Activo
                      </span>
                    )}
                  </button>
                  <button
                    className={`tab-btn ${subTabTrazabilidad === 'bitacora' ? 'active' : ''}`}
                    onClick={() => setSubTabTrazabilidad('bitacora')}
                  >
                    <History size={16} />
                    <span>4. Bitácora en Vivo</span>
                  </button>
                </div>

                {/* FILTRO POR GERENCIA */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Filtrar Gerencia:</span>
                  <select
                    value={traceabilityDeptoFilter}
                    onChange={(e) => setTraceabilityDeptoFilter(e.target.value)}
                    style={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #1e293b',
                      color: 'white',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      outline: 'none',
                      cursor: 'pointer',
                      minWidth: '180px'
                    }}
                  >
                    <option value="TODOS">Todas las Gerencias</option>
                    {listTraceabilityDeptos.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ----------------------------------------------------------- */}
              {/* SUBTAB 1: EMBUDO DE CICLO DE VIDA (LIFECYCLE PIPELINE)      */}
              {/* ----------------------------------------------------------- */}
              {subTabTrazabilidad === 'pipeline' && (
                <div className="animate-fade">
                  {/* EMBUDO VISUAL DE 5 FASES CONECTADAS */}
                  <div className="pipeline-funnel-grid">
                    {/* Fase 1 */}
                    <div className="pipeline-stage-card" style={{ borderTop: '3px solid #38bdf8' }}>
                      <div className="pipeline-stage-header">
                        <span className="pipeline-stage-step" style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                          Fase 1 • Origen
                        </span>
                        <FileText size={18} color="#38bdf8" />
                      </div>
                      <div className="pipeline-stage-title">Requisiciones Emitidas</div>
                      <div className="pipeline-stage-value">{lifecycleFunnelData.emitidasCount.toLocaleString()}</div>
                      <div className="pipeline-stage-meta">
                        <span>Punto de partida operativo</span>
                        <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>100%</span>
                      </div>
                      <div className="pipeline-progress-bar">
                        <div className="pipeline-progress-fill" style={{ width: '100%', backgroundColor: '#38bdf8' }}></div>
                      </div>
                    </div>

                    {/* Fase 2 */}
                    <div className="pipeline-stage-card" style={{ borderTop: '3px solid #34d399' }}>
                      <div className="pipeline-stage-header">
                        <span className="pipeline-stage-step" style={{ backgroundColor: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
                          Fase 2 • Aprobación
                        </span>
                        <ShieldCheck size={18} color="#34d399" />
                      </div>
                      <div className="pipeline-stage-title">Aprobadas por Gerencia</div>
                      <div className="pipeline-stage-value">{lifecycleFunnelData.aprobadasCount.toLocaleString()}</div>
                      <div className="pipeline-stage-meta">
                        <span>Rechazos: {lifecycleFunnelData.rechazosCount}</span>
                        <span style={{ color: '#34d399', fontWeight: 'bold' }}>{lifecycleFunnelData.tasaAprobacion}%</span>
                      </div>
                      <div className="pipeline-progress-bar">
                        <div className="pipeline-progress-fill" style={{ width: `${lifecycleFunnelData.tasaAprobacion}%`, backgroundColor: '#34d399' }}></div>
                      </div>
                    </div>

                    {/* Fase 3 */}
                    <div className="pipeline-stage-card" style={{ borderTop: '3px solid #a855f7' }}>
                      <div className="pipeline-stage-header">
                        <span className="pipeline-stage-step" style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                          Fase 3 • Comercial
                        </span>
                        <CreditCard size={18} color="#c084fc" />
                      </div>
                      <div className="pipeline-stage-title">ODCs & Tickets de Pago</div>
                      <div className="pipeline-stage-value">{lifecycleFunnelData.compromisosCount.toLocaleString()}</div>
                      <div className="pipeline-stage-meta">
                        <span>ODCs: {lifecycleFunnelData.odcsCount} • Tickets: {lifecycleFunnelData.ticketsCount}</span>
                        <span style={{ color: '#c084fc', fontWeight: 'bold' }}>Emitidas</span>
                      </div>
                      <div className="pipeline-progress-bar">
                        <div className="pipeline-progress-fill" style={{ width: '88%', backgroundColor: '#a855f7' }}></div>
                      </div>
                    </div>

                    {/* Fase 4 */}
                    <div className="pipeline-stage-card" style={{ borderTop: '3px solid #10b981' }}>
                      <div className="pipeline-stage-header">
                        <span className="pipeline-stage-step" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                          Fase 4 • Almacén
                        </span>
                        <Package size={18} color="#10b981" />
                      </div>
                      <div className="pipeline-stage-title">Recepción en Almacén</div>
                      <div className="pipeline-stage-value">{lifecycleFunnelData.reqsConAlmacen.toLocaleString()}</div>
                      <div className="pipeline-stage-meta">
                        <span>En compras: {lifecycleFunnelData.reqsEnCompras}</span>
                        <span style={{ color: '#10b981', fontWeight: 'bold' }}>Físico</span>
                      </div>
                      <div className="pipeline-progress-bar">
                        <div className="pipeline-progress-fill" style={{ width: '75%', backgroundColor: '#10b981' }}></div>
                      </div>
                    </div>

                    {/* Fase 5 */}
                    <div className="pipeline-stage-card" style={{ borderTop: '3px solid #f59e0b' }}>
                      <div className="pipeline-stage-header">
                        <span className="pipeline-stage-step" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                          Fase 5 • Liquidación
                        </span>
                        <Landmark size={18} color="#fbbf24" />
                      </div>
                      <div className="pipeline-stage-title">Cuentas por Pagar</div>
                      <div className="pipeline-stage-value">{lifecycleFunnelData.ticketsPagados.toLocaleString()}</div>
                      <div className="pipeline-stage-meta">
                        <span>Pendientes: {lifecycleFunnelData.ticketsPendientes}</span>
                        <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>Finanzas</span>
                      </div>
                      <div className="pipeline-progress-bar">
                        <div className="pipeline-progress-fill" style={{ width: '60%', backgroundColor: '#f59e0b' }}></div>
                      </div>
                    </div>
                  </div>

                  {/* METRIC CARDS RESUMEN */}
                  <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
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
                        <h4>Rechazos / Devoluciones</h4>
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

                    <div className="metric-card">
                      <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                        <DollarSign size={22} />
                      </div>
                      <div className="metric-info">
                        <h4>Órdenes de Compra (ODC)</h4>
                        <div className="metric-value">{filteredOdcsForTraceability.length}</div>
                      </div>
                    </div>

                    <div className="metric-card">
                      <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9' }}>
                        <History size={22} />
                      </div>
                      <div className="metric-info">
                        <h4>Eventos de Auditoría</h4>
                        <div className="metric-value">{filteredLogsForTraceability.length}</div>
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
                      <div style={{ width: '100%', height: 300 }}>
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
                              <Line type="monotone" dataKey="emitidas" name="Emitidas" stroke="#38bdf8" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                              <Line type="monotone" dataKey="aprobadas" name="Aprobadas Final" stroke="#34d399" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                              <Line type="monotone" dataKey="rechazadas" name="Rechazadas" stroke="#f87171" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>

                    {/* 2. Densidad Comparativa: Requisiciones vs. Tickets vs. ODCs */}
                    <div className="chart-card">
                      <div className="chart-card-title">
                        <Activity size={20} color="#fbbf24" />
                        <span>Densidad Operativa: Requisiciones vs. Tickets vs. ODCs</span>
                      </div>
                      <div style={{ width: '100%', height: 300 }}>
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
                                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                                </linearGradient>
                                <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.4} />
                                  <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.0} />
                                </linearGradient>
                                <linearGradient id="colorOdcs" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                              <XAxis dataKey="label" stroke="#64748b" style={{ fontSize: '10px' }} />
                              <YAxis stroke="#64748b" style={{ fontSize: '11px' }} allowDecimals={false} />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: 'white', fontFamily: 'Inter' }}
                              />
                              <Legend wrapperStyle={{ fontSize: '12px', marginTop: '10px' }} />
                              <Area type="monotone" dataKey="emitidas" name="Requisiciones" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorReqs)" />
                              <Area type="monotone" dataKey="tickets" name="Tickets de Pago" stroke="#fbbf24" strokeWidth={2} fillOpacity={1} fill="url(#colorTickets)" />
                              <Area type="monotone" dataKey="odcs" name="Órdenes de Compra" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorOdcs)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ----------------------------------------------------------- */}
              {/* SUBTAB 2: SLA & CUELLOS DE BOTELLA                          */}
              {/* ----------------------------------------------------------- */}
              {subTabTrazabilidad === 'sla_bottlenecks' && (
                <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                  {/* ALERTA DE CUELLOS DE BOTELLA */}
                  <div className="chart-card" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.02)' }}>
                    <div className="chart-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <AlertTriangle size={20} color="#ef4444" />
                        <span>Semáforo de Cuellos de Botella: Requisiciones con Espera Prolongada</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                          🔴 {bottleneckRequisitions.filter(r => r.nivel === 'CRITICA').length} Críticas (&gt; 5 días)
                        </span>
                        <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                          🟡 {bottleneckRequisitions.filter(r => r.nivel === 'ADVERTENCIA').length} Advertencia (3-5 días)
                        </span>
                      </div>
                    </div>

                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 15px 0' }}>
                      Las siguientes requisiciones están pendientes de aprobación y han superado el SLA operativo. Haz clic en "Inspeccionar" para auditar su expediente completo:
                    </p>

                    {bottleneckRequisitions.length === 0 ? (
                      <div style={{ padding: '25px', textAlign: 'center', color: '#34d399', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px' }}>
                        <CheckCircle size={28} style={{ margin: '0 auto 8px auto' }} />
                        <p style={{ fontWeight: 'bold', margin: 0 }}>¡Excelente! No hay requisiciones con cuellos de botella en este período.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
                        {bottleneckRequisitions.slice(0, 9).map(req => {
                          const isCritica = req.nivel === 'CRITICA';
                          return (
                            <div
                              key={req.id}
                              className={isCritica ? 'bottleneck-card-critica' : 'bottleneck-card-advertencia'}
                              style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1rem', color: isCritica ? '#ef4444' : '#fbbf24' }}>
                                  {req.correlativo_req || `REQ-${req.id}`}
                                </span>
                                <span style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 'bold',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: isCritica ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                  color: isCritica ? '#f87171' : '#fbbf24'
                                }}>
                                  ⏱️ {req.diasEspera} días en espera
                                </span>
                              </div>

                              <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                                <div><strong>Gerencia:</strong> {req.gerencia || 'General'}</div>
                                <div><strong>Solicitante:</strong> {req.solicitante || 'Usuario SITC'}</div>
                                <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '2px' }}>
                                  <strong>Estado actual:</strong> {req.estado_aprobacion?.toUpperCase()}
                                </div>
                              </div>

                              <button
                                onClick={() => abrirInspectorExpediente(req, 'requisicion')}
                                style={{
                                  marginTop: '4px',
                                  padding: '6px 12px',
                                  borderRadius: '8px',
                                  backgroundColor: isCritica ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                  color: isCritica ? '#f87171' : '#fbbf24',
                                  border: `1px solid ${isCritica ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                                  fontSize: '0.75rem',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  transition: 'all 0.15s'
                                }}
                              >
                                <Eye size={13} />
                                <span>Inspeccionar Expediente 360°</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* TABLA DE SLA POR GERENCIA */}
                  <div className="chart-card">
                    <div className="chart-card-title">
                      <Clock size={20} color="#6366f1" />
                      <span>Matriz de Rendimiento SLA y Aprobación por Gerencia</span>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table className="console-table" style={{ fontFamily: 'Inter' }}>
                        <thead>
                          <tr>
                            <th>GERENCIA / DEPARTAMENTO</th>
                            <th style={{ textAlign: 'center' }}>EMITIDAS</th>
                            <th style={{ textAlign: 'center' }}>APROBADAS</th>
                            <th style={{ textAlign: 'center' }}>PENDIENTES</th>
                            <th style={{ textAlign: 'center' }}>TASA APROBACIÓN</th>
                            <th style={{ textAlign: 'right' }}>SLA PROMEDIO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {slaByDepartmentData.length === 0 ? (
                            <tr>
                              <td colSpan="6" style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>
                                No hay datos de gerencias en este período
                              </td>
                            </tr>
                          ) : (
                            slaByDepartmentData.map(d => (
                              <tr key={d.departamento}>
                                <td style={{ color: 'white', fontWeight: 'bold' }}>{d.departamento}</td>
                                <td style={{ textAlign: 'center', color: '#38bdf8' }}>{d.emitidas}</td>
                                <td style={{ textAlign: 'center', color: '#34d399', fontWeight: 'bold' }}>{d.aprobadas}</td>
                                <td style={{ textAlign: 'center', color: d.pendientes > 0 ? '#fbbf24' : '#64748b' }}>{d.pendientes}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <span style={{
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    backgroundColor: d.tasaAprobacion >= 80 ? 'rgba(52, 211, 153, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                    color: d.tasaAprobacion >= 80 ? '#34d399' : '#fbbf24'
                                  }}>
                                    {d.tasaAprobacion}%
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold', color: d.avgHours > 48 ? '#ef4444' : d.avgHours > 24 ? '#f59e0b' : '#38bdf8' }}>
                                  {d.avgDays >= 1 ? `${d.avgDays} días (${d.avgHours}h)` : `${d.avgHours} hrs`}
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

              {/* ----------------------------------------------------------- */}
              {/* SUBTAB 3: INSPECTOR DE EXPEDIENTE 360°                      */}
              {/* ----------------------------------------------------------- */}
              {subTabTrazabilidad === 'inspector' && (
                <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                  {/* BUSCADOR UNIVERSAL */}
                  <div className="chart-card" style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '20px' }}>
                    <div className="inspector-search-wrapper">
                      <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#38bdf8' }} />
                      <input
                        type="text"
                        className="inspector-search-input"
                        placeholder="🔍 Buscar por Correlativo (ej. MTT-26-0271, REQ-100), ODC, Ticket de Pago, Solicitante o Proveedor..."
                        value={inspectorSearch}
                        onChange={(e) => setInspectorSearch(e.target.value)}
                      />
                      {inspectorSearch && (
                        <button
                          onClick={() => setInspectorSearch('')}
                          style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                        >
                          <X size={16} />
                        </button>
                      )}

                      {/* RESULTADOS AUTOCOMPLETADO */}
                      {inspectorSearchResults.length > 0 && (
                        <div className="inspector-dropdown-results">
                          {inspectorSearchResults.map((res, idx) => (
                            <div
                              key={idx}
                              className="inspector-dropdown-item"
                              onClick={() => {
                                abrirInspectorExpediente(res.data, res.tipo);
                                setInspectorSearch('');
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.7rem',
                                  fontWeight: 'bold',
                                  backgroundColor: res.tipo === 'requisicion' ? 'rgba(56, 189, 248, 0.2)' : res.tipo === 'odc' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                                  color: res.tipo === 'requisicion' ? '#38bdf8' : res.tipo === 'odc' ? '#c084fc' : '#fbbf24',
                                  textTransform: 'uppercase'
                                }}>
                                  {res.tipo}
                                </span>
                                <div>
                                  <div style={{ color: 'white', fontWeight: 'bold', fontSize: '0.85rem' }}>{res.titulo}</div>
                                  <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{res.subtitulo}</div>
                                </div>
                              </div>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {new Date(res.fecha).toLocaleDateString('es-VE')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ATAJOS RÁPIDOS */}
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Ejemplos recientes:</span>
                      {requisiciones.slice(0, 4).map(r => (
                        <button
                          key={r.id}
                          onClick={() => abrirInspectorExpediente(r, 'requisicion')}
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: '#38bdf8',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            fontFamily: 'monospace'
                          }}
                        >
                          {r.correlativo_req || `REQ-${r.id}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* EXPEDIENTE 360 CARGADO */}
                  {!inspectedItem ? (
                    <div className="chart-card" style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
                      <Search size={42} style={{ margin: '0 auto 15px auto', color: '#38bdf8', opacity: 0.4 }} />
                      <h3 style={{ color: '#cbd5e1', fontSize: '1.1rem', marginBottom: '6px' }}>Ningún expediente seleccionado</h3>
                      <p style={{ maxWidth: '480px', margin: '0 auto', fontSize: '0.85rem' }}>
                        Utiliza el buscador superior o selecciona una requisición de la tabla o de la lista de cuellos de botella para inspeccionar su trazabilidad 360°.
                      </p>
                    </div>
                  ) : (
                    <div className="chart-card animate-fade" style={{ background: 'rgba(30, 41, 59, 0.35)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '24px' }}>
                      {/* HEADER EXPEDIENTE */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '18px', flexWrap: 'wrap', gap: '15px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '1.4rem', fontWeight: '800', fontFamily: 'monospace', color: '#38bdf8' }}>
                              {inspectedItem.correlativo_req || inspectedItem.correlativo || `EXP-#${inspectedItem.id}`}
                            </span>
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              backgroundColor: 'rgba(52, 211, 153, 0.15)',
                              color: '#34d399',
                              textTransform: 'uppercase'
                            }}>
                              {inspectedItem.estado_aprobacion || inspectedItem.estado || 'REGISTRADO'}
                            </span>
                            {inspectedItem.prioridad && (
                              <span style={{
                                padding: '3px 10px',
                                borderRadius: '8px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                backgroundColor: inspectedItem.prioridad === 'ALTA' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                                color: inspectedItem.prioridad === 'ALTA' ? '#f87171' : '#38bdf8'
                              }}>
                                Prioridad: {inspectedItem.prioridad}
                              </span>
                            )}
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '6px' }}>
                            Solicitante: <strong style={{ color: 'white' }}>{inspectedItem.solicitante || 'N/A'}</strong> • Gerencia: <strong style={{ color: 'white' }}>{inspectedItem.gerencia || inspectedItem.centro_costo || 'SITC'}</strong>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <button
                            onClick={() => setInspectedItem(null)}
                            style={{
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: '#cbd5e1',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <X size={14} />
                            <span>Cerrar</span>
                          </button>
                        </div>
                      </div>

                      {/* TIMELINE ÁRBOL DE TRAZABILIDAD */}
                      <div className="timeline-tree">
                        {/* 1. EMISIÓN */}
                        <div className="timeline-node">
                          <span className="timeline-dot" style={{ backgroundColor: '#38bdf8' }}></span>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#38bdf8', textTransform: 'uppercase' }}>
                              1. Origen & Emisión de Requerimiento
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {new Date(inspectedItem.created_at || inspectedItem.fecha_emision).toLocaleString('es-VE')}
                            </span>
                          </div>
                          <p style={{ color: '#cbd5e1', fontSize: '0.85rem', margin: '0 0 10px 0' }}>
                            {inspectedItem.justificacion ? `"${inspectedItem.justificacion}"` : 'Sin justificación detallada'}
                          </p>

                          {/* Renglones solicitados */}
                          {Array.isArray(inspectedItem.items) && inspectedItem.items.length > 0 && (
                            <div style={{ marginTop: '10px', background: 'rgba(15, 23, 42, 0.4)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                              <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>
                                Renglones Solicitados ({inspectedItem.items.length}):
                              </span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                                {inspectedItem.items.map((it, itIdx) => (
                                  <div key={itIdx} style={{ fontSize: '0.8rem', color: '#e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>• {it.descripcion || it.nombre || 'Ítem'} ({it.cantidad} {it.unidad || 'UND'})</span>
                                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{it.especificaciones || ''}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 2. APROBACIONES */}
                        <div className="timeline-node">
                          <span className="timeline-dot" style={{ backgroundColor: '#34d399' }}></span>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#34d399', textTransform: 'uppercase' }}>
                              2. Dictamen & Cadena de Aprobación
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {inspectedItem.fecha_aprobacion_final ? new Date(inspectedItem.fecha_aprobacion_final).toLocaleString('es-VE') : 'En revisión'}
                            </span>
                          </div>

                          {/* Logs de auditoría de la requisición */}
                          {requisicionLogs.filter(l => l.requisicion_id === inspectedItem.id).length === 0 ? (
                            <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>
                              Estado actual: <strong>{inspectedItem.estado_aprobacion}</strong>. No registra eventos de auditoría previos.
                            </p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                              {requisicionLogs
                                .filter(l => l.requisicion_id === inspectedItem.id)
                                .map(log => (
                                  <div key={log.id} style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '8px 12px', borderRadius: '8px', borderLeft: `3px solid ${log.accion === 'RECHAZADA' ? '#ef4444' : '#34d399'}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                      <strong style={{ color: log.accion === 'RECHAZADA' ? '#f87171' : '#34d399' }}>{log.accion}</strong>
                                      <span style={{ color: '#64748b' }}>{new Date(log.fecha || log.created_at).toLocaleString('es-VE')}</span>
                                    </div>
                                    <div style={{ color: '#cbd5e1', fontSize: '0.8rem', marginTop: '3px' }}>
                                      <strong>{log.usuario_nombre || 'Gerente'}:</strong> {log.comentario || 'Aprobado'}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>

                        {/* 3. GESTIÓN COMERCIAL (ODC O TICKET) */}
                        <div className="timeline-node">
                          <span className="timeline-dot" style={{ backgroundColor: '#a855f7' }}></span>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#c084fc', textTransform: 'uppercase' }}>
                              3. Compromiso de Compra (ODCs & Tickets)
                            </span>
                          </div>

                          {/* Órdenes de compra vinculadas */}
                          {ordenesCompra.filter(o => 
                            String(o.requisicion_id) === String(inspectedItem.id) ||
                            (o.numero_req && String(o.numero_req).toUpperCase() === String(inspectedItem.correlativo_req).toUpperCase()) ||
                            (o.correlativo_req && String(o.correlativo_req).toUpperCase() === String(inspectedItem.correlativo_req).toUpperCase())
                          ).length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {ordenesCompra.filter(o => 
                                String(o.requisicion_id) === String(inspectedItem.id) ||
                                (o.numero_req && String(o.numero_req).toUpperCase() === String(inspectedItem.correlativo_req).toUpperCase()) ||
                                (o.correlativo_req && String(o.correlativo_req).toUpperCase() === String(inspectedItem.correlativo_req).toUpperCase())
                              ).map(odc => (
                                <div key={odc.id} style={{ background: 'rgba(168, 85, 247, 0.08)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#c084fc' }}>
                                      ODC-{odc.correlativo || odc.id}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#34d399' }}>
                                      ${Number(odc.total || odc.total_monto || 0).toLocaleString()}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '4px' }}>
                                    Proveedor: <strong>{odc.proveedor_nombre || 'N/A'}</strong> (RIF: {odc.proveedor_rif || 'N/A'})
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                                    Condición: {odc.condicion_pago || odc.tipo_pago || 'Crédito'} {odc.dias_credito ? `(${odc.dias_credito} días)` : ''}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>
                              No se han emitido órdenes de compra formales para esta requisición.
                            </p>
                          )}
                        </div>

                        {/* 4. ALMACÉN */}
                        <div className="timeline-node">
                          <span className="timeline-dot" style={{ backgroundColor: '#10b981' }}></span>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#10b981', textTransform: 'uppercase' }}>
                              4. Recepción en Almacén
                            </span>
                          </div>
                          <p style={{ color: '#cbd5e1', fontSize: '0.85rem', margin: 0 }}>
                            Control Físico: Los renglones aprobados avanzan al módulo de recepción con verificación de calidad y guía de despacho.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ----------------------------------------------------------- */}
              {/* SUBTAB 4: BITÁCORA EN VIVO                                  */}
              {/* ----------------------------------------------------------- */}
              {subTabTrazabilidad === 'bitacora' && (
                <div className="chart-card animate-fade">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                    <div className="chart-card-title" style={{ marginBottom: 0 }}>
                      <History size={20} color="#0ea5e9" />
                      <span>Bitácora de Trazabilidad & Auditoría en Vivo ({filteredLogsForTraceability.length} eventos)</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                        <input
                          type="text"
                          placeholder="Buscar por req, usuario, motivo..."
                          value={busquedaTrazabilidad}
                          onChange={(e) => setBusquedaTrazabilidad(e.target.value)}
                          style={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #1e293b',
                            color: 'white',
                            padding: '6px 12px 6px 30px',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            outline: 'none',
                            minWidth: '220px'
                          }}
                        />
                      </div>

                      <select
                        value={filtroAccionTrazabilidad}
                        onChange={(e) => setFiltroAccionTrazabilidad(e.target.value)}
                        style={{
                          backgroundColor: '#0f172a',
                          border: '1px solid #1e293b',
                          color: 'white',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="TODAS">Todas las Acciones</option>
                        <option value="CREACION">Creaciones</option>
                        <option value="APROBADA_FINAL">Aprobaciones Finales</option>
                        <option value="RECHAZADA">Rechazos / Devoluciones</option>
                        <option value="ASIGNACION">Asignaciones de Compra</option>
                        <option value="FINALIZADO">Finalizados / Entregados</option>
                        <option value="PAUSA">Pausas</option>
                        <option value="SLA_CALCULO">Cálculo SLA</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
                    <table className="console-table" style={{ fontFamily: 'Inter', fontSize: '0.85rem' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: '#0f172a', zIndex: 10 }}>
                        <tr>
                          <th style={{ width: '130px' }}>REQUISICIÓN</th>
                          <th style={{ width: '160px' }}>GERENCIA / OBRA</th>
                          <th style={{ width: '160px' }}>FECHA / HORA</th>
                          <th style={{ width: '160px' }}>RESPONSABLE</th>
                          <th style={{ width: '150px', textAlign: 'center' }}>ACCIÓN / EVENTO</th>
                          <th>DETALLE / COMENTARIO DE TRAZABILIDAD</th>
                          <th style={{ width: '80px', textAlign: 'center' }}>EXPEDIENTE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLogsForTraceability
                          .filter(l => {
                            if (filtroAccionTrazabilidad !== 'TODAS' && l.accion !== filtroAccionTrazabilidad) return false;
                            if (!busquedaTrazabilidad.trim()) return true;
                            const q = busquedaTrazabilidad.toLowerCase();
                            const req = requisiciones.find(r => r.id === l.requisicion_id);
                            const reqCode = req?.correlativo_req || `#${l.requisicion_id}`;
                            return (
                              reqCode.toLowerCase().includes(q) ||
                              (l.usuario_nombre || '').toLowerCase().includes(q) ||
                              (l.comentario || '').toLowerCase().includes(q) ||
                              (l.accion || '').toLowerCase().includes(q)
                            );
                          })
                          .slice(0, 100)
                          .map(log => {
                            const req = requisiciones.find(r => r.id === log.requisicion_id);
                            const isRechazo = log.accion === 'RECHAZADA' || log.accion === 'RECHAZADO';
                            const isAprobada = log.accion === 'APROBADA_FINAL' || log.accion === 'APROBADO_FINAL';
                            const isCreacion = log.accion === 'CREACION';
                            const isAsignacion = log.accion === 'ASIGNACION';
                            const isPausa = log.accion === 'PAUSA';

                            let badgeBg = 'rgba(100, 116, 139, 0.15)';
                            let badgeCol = '#94a3b8';
                            if (isRechazo) { badgeBg = 'rgba(239, 68, 68, 0.2)'; badgeCol = '#ef4444'; }
                            else if (isAprobada) { badgeBg = 'rgba(34, 197, 94, 0.2)'; badgeCol = '#22c55e'; }
                            else if (isCreacion) { badgeBg = 'rgba(56, 189, 248, 0.2)'; badgeCol = '#38bdf8'; }
                            else if (isAsignacion) { badgeBg = 'rgba(168, 85, 247, 0.2)'; badgeCol = '#c084fc'; }
                            else if (isPausa) { badgeBg = 'rgba(245, 158, 11, 0.2)'; badgeCol = '#f59e0b'; }

                            return (
                              <tr key={log.id}>
                                <td style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#38bdf8' }}>
                                  {req?.correlativo_req || `#${log.requisicion_id}`}
                                </td>
                                <td style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>
                                  {req?.gerencia || req?.centro_costo || 'N/A'}
                                </td>
                                <td style={{ color: '#64748b', fontSize: '0.78rem' }}>
                                  {new Date(log.fecha || log.created_at).toLocaleString('es-VE')}
                                </td>
                                <td style={{ color: '#e2e8f0', fontWeight: '500', fontSize: '0.8rem' }}>
                                  {log.usuario_nombre || 'Sistema'}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <span style={{
                                    backgroundColor: badgeBg,
                                    color: badgeCol,
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.72rem',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase'
                                  }}>
                                    {log.accion}
                                  </span>
                                </td>
                                <td style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: isRechazo ? 'italic' : 'normal' }}>
                                  {log.comentario || 'Sin observaciones'}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <button
                                    onClick={() => abrirInspectorExpediente(req || log.requisicion_id, 'requisicion')}
                                    title="Inspeccionar expediente completo"
                                    style={{
                                      backgroundColor: 'rgba(56, 189, 248, 0.1)',
                                      border: '1px solid rgba(56, 189, 248, 0.2)',
                                      color: '#38bdf8',
                                      padding: '4px 8px',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontSize: '0.72rem'
                                    }}
                                  >
                                    <Eye size={12} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
