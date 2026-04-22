import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Upload,
  Save,
  FileText,
  DollarSign,
  Building2,
  Menu,
  Activity,
  History,
  Eye,
  RefreshCw,
  Search,
  AlertCircle,
  Image as ImageIcon,
  ArrowLeft,
  Calendar,
  User,
  Hash,
  CheckCircle2,
  CreditCard,
  Ticket,
  Clock
} from 'lucide-react';
import './ModuloTicketsPago.css';

const ModuloTicketsPago = () => {
  const [vistaActual, setVistaActual] = useState('historial'); // 'historial' | 'nuevo' | 'detalle'
  const [ticketSeleccionado, setTicketSeleccionado] = useState(null);

  // ==========================================
  // ESTADOS DEL HISTORIAL
  // ==========================================
  const [historialTickets, setHistorialTickets] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroBancos, setFiltroBancos] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('Todos');

  // ==========================================
  // ESTADOS DEL FORMULARIO DE NUEVO TICKET
  // ==========================================
  const [currentUser, setCurrentUser] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [bancos, setBancos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [showConfirmacionPago, setShowConfirmacionPago] = useState(false);

  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState('');
  const [bancoOrigen, setBancoOrigen] = useState('');
  const [refPago, setRefPago] = useState('');
  const [imagenArchivo, setImagenArchivo] = useState(null);
  const [imagenUrlpreview, setImagenUrlpreview] = useState('');
  const [responsableText, setResponsableText] = useState('');

  const [renglones, setRenglones] = useState([]);

  const [editandoObs, setEditandoObs] = useState(false);
  const [obsTemporal, setObsTemporal] = useState('');
  const [imagenesArchivos, setImagenesArchivos] = useState([]); // Soporte para múltiples archivos
  const [imagenesUrlsPreview, setImagenesUrlsPreview] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [preciosReferencia, setPreciosReferencia] = useState({});
  const [expandirHistorial, setExpandirHistorial] = useState({}); // { itemID: boolean }

  const getInitials = (nombre, apellido) => {
    return `${nombre?.charAt(0) || ''}${apellido?.charAt(0) || ''}`.toUpperCase();
  };

  // ==========================================
  // EFECTOS Y FETCH
  // ==========================================
  useEffect(() => {
    cargarInitialData();
  }, []);

  const cargarInitialData = async () => {
    // 1. Cargar Usuario
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: perfil } = await supabase.from('perfiles').select('*').eq('id', user.id).single();
      const emailLower = (user.email || '').toLowerCase();
      const esSuperAdmin = emailLower === 'jcontreras.totalclean@gmail.com';
      const esAdminReal = esSuperAdmin || 
                          emailLower === 'cvega.totalclean@gmail.com' || 
                          emailLower === 'cvega@totalclean.com' || 
                          emailLower === 'karincmm1@gmail.com';

      const userInfo = {
        id: user.id,
        nombre: perfil ? `${perfil.nombre} ${perfil.apellido}` : emailLower.split('@')[0],
        correo: emailLower,
        departamento: perfil ? perfil.departamento : 'General',
        rol: perfil ? perfil.rol : 'Gerente',
        esSuperAdmin,
        esAdminReal,
        esAdminGlobal: esAdminReal || perfil?.rol === 'Gerente General' || perfil?.rol === 'Administrador'
      };

      setCurrentUser(userInfo);
      
      if (perfil) {
        setResponsableText(`${perfil.nombre} ${perfil.apellido} - ${perfil.departamento}`);
      }
    }

    // 2. Fetch de todas las solicitudes de fondo existentes
    const { data: sData } = await supabase.from('solicitudes_fondos').select('id, codigo_control, fecha_operativa, responsable_nombre').order('created_at', { ascending: false });
    if (sData) setSolicitudes(sData);

    // 3. Fetch de Bancos de Origen
    const { data: bData } = await supabase.from('bancos').select('*').eq('activo', true).order('nombre');
    if (bData) setBancos(bData);

    // 3.5 Fetch de Proveedores
    const { data: pData } = await supabase.from('proveedores').select('*').eq('status', true).order('razon_social', { ascending: true });
    if (pData) setProveedores(pData);

    // 4. Fetch Historial
    await fetchHistorial();
  };

  const totals = useMemo(() => {
    const list = historialTickets || [];
    const totalMonto = list.reduce((acc, t) => acc + (Number(t.total_usd) || 0), 0);
    const pagados = list.filter(t => t.status === 'Pagado').length;
    const pendientes = list.filter(t => t.status !== 'Pagado' && t.status !== 'Rechazado').length;
    const totalRegistros = list.length;

    return { totalMonto, pagados, pendientes, totalRegistros };
  }, [historialTickets]);

  const esPrivilegiado = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.esAdminGlobal;
  }, [currentUser]);

  const fetchHistorial = async () => {
    setCargandoHistorial(true);
    try {
      let query = supabase.from('tickets_directos').select('*');
      
      // FILTRADO POR DEPARTAMENTO (REGLA DE NEGOCIO)
      if (!esPrivilegiado && currentUser?.departamento) {
          query = query.eq('departamento', currentUser.departamento);
      }

      const { data, error } = await query.order('fecha_emision', { ascending: false });
      if (error) throw error;
      setHistorialTickets(data || []);
    } catch (err) {
      console.error('Error al cargar historial:', err.message);
    } finally {
      setCargandoHistorial(false);
    }
  };

  const obtenerPreciosReferencia = async (itemsActuales) => {
    try {
      const { data, error } = await supabase
        .from('requisiciones')
        .select('items')
        .eq('estado_aprobacion', 'aprobado_final')
        .order('fecha_emision', { ascending: false })
        .limit(50);
      if (error) throw error;
      const referencias = {};
      data.reverse().forEach(req => {
        (req.items || []).forEach(item => {
          if (item.historial_compras?.length > 0) {
            const compras = item.historial_compras.filter(h => h.tipo !== 'JUSTIFICACION');
            if (compras.length > 0) {
              referencias[item.descripcion.trim().toUpperCase()] = compras[compras.length - 1].pu;
            }
          }
        });
      });
      setPreciosReferencia(referencias);
    } catch (err) {
      console.error("Error obteniendo precios de referencia:", err.message);
    }
  };

  const abrirDetalleTicket = async (ticket) => {
    setLoading(true);
    try {
      const renglonesIniciados = (ticket.items || []).map(item => {
        const cantidad_pedida = item.cantidad_pedida || item.cant || item.cantidad || 0;
        const cantidad_comprada = item.cantidad_comprada || 0;
        const cantidad_pendiente = Math.max(0, cantidad_pedida - cantidad_comprada);
        return {
          ...item,
          cantidad_pedida,
          cantidad_comprada,
          cantidad_pendiente,
          historial_compras: item.historial_compras || [],
          compra_actual_cant: 0,
          compra_actual_pu: item.pu || item.puUsd || item.puBs || 0,
          doc_tipo_actual: item.doc_tipo || 'FAC',
          doc_numero_actual: '',
          proveedor_seleccionado_id: ''
        };
      });
      setRenglones(renglonesIniciados);
      setTicketSeleccionado(ticket);
      setBancoOrigen(ticket.banco_origen || '');
      setRefPago(ticket.codigo_control || '');
      setImagenUrlpreview(ticket.factura_url || '');
      setVistaActual('detalle');
      setExpandirHistorial({});
      await obtenerPreciosReferencia(renglonesIniciados);
    } catch (err) {
      console.error("Error al abrir detalle:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const actualizarFila = (id, campo, valor) => {
    setRenglones(prev => prev.map(f => {
      if (f.id === id) {
        let v = valor;
        if (campo === 'compra_actual_pu') v = Math.max(0, Number(valor) || 0);
        if (campo === 'compra_actual_cant') {
          v = Math.max(0, Number(valor) || 0);
          if (v > f.cantidad_pendiente) {
            toast.error(`No puede pagar más de la cantidad pendiente (${f.cantidad_pendiente})`);
            v = f.cantidad_pendiente;
          }
        }
        const act = { ...f, [campo]: v };
        act.total = act.compra_actual_cant * (act.compra_actual_pu || 0);
        const ref = preciosReferencia[f.descripcion.trim().toUpperCase()];
        if (campo === 'compra_actual_pu' && v > 0 && ref) {
          const variacion = ((v - ref) / ref) * 100;
          act.variacion_precio = variacion;
          act.precio_ref_encontrado = ref;
        }
        return { ...act, hasChanges: true };
      }
      return f;
    }));
  };

  const guardarPagoRenglon = async (id) => {
    if (loading) return;
    const item = renglones.find(r => r.id === id);
    if (!item || !item.hasChanges) return;
    setLoading(true);
    try {
      if (!item.doc_numero_actual || !item.doc_numero_actual.trim()) {
        toast.error("Error: El número de documento es obligatorio.");
        setLoading(false);
        return;
      }
      if (Number(item.compra_actual_cant || 0) <= 0) {
        toast.error("Error: Ingrese una cantidad mayor a 0.");
        setLoading(false);
        return;
      }
      // El proveedor ahora es opcional para impuestos/servicios
      const proveedorSelec = proveedores.find(p => p.id === item.proveedor_seleccionado_id);
      
      const nuevaTransaccion = {
        fecha: new Date().toISOString(),
        cant: item.compra_actual_cant,
        pu: item.compra_actual_pu,
        metodo_pago: item.metodo_pago_actual || '$ / BS',
        proveedor_id: item.proveedor_seleccionado_id || null,
        proveedor_nombre: proveedorSelec?.razon_social || 'Pago Directo / Sin Proveedor',
        usuario_id: currentUser?.id,
        usuario_nombre: `${currentUser?.nombre} ${currentUser?.apellido}`,
        doc_tipo: item.doc_tipo_actual,
        doc_numero: item.doc_numero_actual
      };
      const nuevaCantComprada = (item.cantidad_comprada || 0) + (item.compra_actual_cant || 0);
      const nuevaCantPendiente = Math.max(0, item.cantidad_pedida - nuevaCantComprada);
      let nuevoStatus = item.status;
      if (nuevaCantPendiente === 0) nuevoStatus = 'Completado';
      else if (nuevaCantComprada > 0) nuevoStatus = 'Parcial';
      const renglonProcesado = {
        ...item,
        cantidad_comprada: nuevaCantComprada,
        cantidad_pendiente: nuevaCantPendiente,
        historial_compras: [...(item.historial_compras || []), nuevaTransaccion],
        status: nuevoStatus,
        pu: item.compra_actual_pu || item.pu,
        compra_actual_cant: 0,
        doc_numero_actual: '',
        proveedor_seleccionado_id: '',
        hasChanges: false
      };
      const nuevosRenglones = renglones.map(r => r.id === id ? renglonProcesado : r);
      const totalDinamicoReal = nuevosRenglones.reduce((acc, r) => {
        const ejecutadoItem = (r.historial_compras || []).reduce((sum, t) => sum + ((Number(t.cant) || 0) * (Number(t.pu) || 0)), 0);
        const estimadoPendiente = (Number(r.cantidad_pendiente) || 0) * Number(r.pu_estimado || r.pu || 0);
        return acc + ejecutadoItem + estimadoPendiente;
      }, 0);
      const { error } = await supabase
        .from('tickets_directos')
        .update({
          items: nuevosRenglones,
          total_usd: totalDinamicoReal * 1.16
        })
        .eq('id', ticketSeleccionado.id);
      if (error) throw error;
      setRenglones(nuevosRenglones);
      toast.success("Ítem guardado con éxito.");
      await fetchHistorial();
    } catch (err) {
      toast.error("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const eliminarEntradaHistorial = async (idRenglon, indexHistorial) => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>¿Está seguro de eliminar esta entrada? El saldo pendiente se restaurará automáticamente.</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button 
            onClick={() => { toast.dismiss(t.id); ejecutarEliminacionHistorial(idRenglon, indexHistorial); }}
            style={{ padding: '4px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            ELIMINAR
          </button>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 12px', background: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>CANCELAR</button>
        </div>
      </div>
    ), { duration: 5000 });
  };

  const ejecutarEliminacionHistorial = async (idRenglon, indexHistorial) => {
    const renglonesActualizados = renglones.map(r => {
      if (r.id === idRenglon) {
        const entrada = r.historial_compras[indexHistorial];
        let nuevaCantComprada = r.cantidad_comprada - (entrada.cant || 0);
        let nuevaCantPendiente = r.cantidad_pendiente + (entrada.cant || 0);
        const nuevoHistorial = [...r.historial_compras];
        nuevoHistorial.splice(indexHistorial, 1);
        return {
          ...r,
          cantidad_comprada: Math.max(0, nuevaCantComprada),
          cantidad_pendiente: Math.max(0, nuevaCantPendiente),
          historial_compras: nuevoHistorial,
          status: nuevaCantComprada === 0 ? 'En Espera' : 'Parcial'
        };
      }
      return r;
    });
    try {
      setLoading(true);
      const totalDinamicoReal = renglonesActualizados.reduce((acc, r) => {
        const ejecutadoItem = (r.historial_compras || []).reduce((sum, t) => sum + ((Number(t.cant) || 0) * (Number(t.pu) || 0)), 0);
        const estimadoPendiente = (Number(r.cantidad_pendiente) || 0) * Number(r.pu_estimado || r.pu || 0);
        return acc + ejecutadoItem + estimadoPendiente;
      }, 0);
      const { error } = await supabase
        .from('tickets_directos')
        .update({ items: renglonesActualizados, total_usd: totalDinamicoReal * 1.16 })
        .eq('id', ticketSeleccionado.id);
      if (error) throw error;
      setRenglones(renglonesActualizados);
      toast.success("Entrada eliminada y saldos restaurados.");
    } catch (err) {
      toast.error("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // LÓGICA DE ACTUALIZACIÓN DE PAGO
  // ==========================================
  const handleImagenChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setImagenesArchivos(prev => [...prev, ...files]);
      const newUrls = files.map(file => URL.createObjectURL(file));
      setImagenesUrlsPreview(prev => [...prev, ...newUrls]);
    }
  };

  const quitarArchivoTemporal = (index) => {
    setImagenesArchivos(prev => prev.filter((_, i) => i !== index));
    setImagenesUrlsPreview(prev => prev.filter((_, i) => i !== index));
  };

  const actualizarPago = async () => {
    if (!imagenesArchivos.length && (!ticketSeleccionado.factura_url || ticketSeleccionado.factura_url.length === 0)) {
      return toast.error("Debe adjuntar al menos una imagen o comprobante antes de registrar y procesar el pago.");
    }
    setLoading(true);
    try {
      let finalUrls = Array.isArray(ticketSeleccionado.factura_url) ? [...ticketSeleccionado.factura_url] : (ticketSeleccionado.factura_url ? [ticketSeleccionado.factura_url] : []);

      if (imagenesArchivos.length > 0) {
        setSubiendoImagen(true);
        for (const file of imagenesArchivos) {
          const fileName = `recibos/${Date.now()}_${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from('comprobantes')
            .upload(fileName, file);

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage.from('comprobantes').getPublicUrl(fileName);
            finalUrls.push(publicUrlData.publicUrl);
          }
        }
        setSubiendoImagen(false);
      }

      // El estatus global del ticket depende de si hay saldos pendientes
      const tienePendientes = renglones.some(r => r.cantidad_pendiente > 0);
      const estatusFinal = tienePendientes ? 'Parcial' : 'Pagado';

      const { error } = await supabase.from('tickets_directos').update({
        factura_url: finalUrls,
        status: estatusFinal,
        items: renglones
      }).eq('id', ticketSeleccionado.id);

      if (error) throw error;

      toast.success('Registros actualizados correctamente.');

      setImagenesArchivos([]);
      setImagenesUrlsPreview([]);
      setTicketSeleccionado(null);
      await fetchHistorial();
      setVistaActual('historial');
    } catch (err) {
      toast.error("Error al actualizar pago: " + err.message);
    } finally {
      setLoading(false);
      setSubiendoImagen(false);
      setShowConfirmacionPago(false);
    }
  };

  const guardarObservacionesTicket = async () => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('tickets_directos')
        .update({ observaciones: obsTemporal })
        .eq('id', ticketSeleccionado.id);

      if (error) throw error;
      setTicketSeleccionado({ ...ticketSeleccionado, observaciones: obsTemporal });
      setEditandoObs(false);
      toast.success("Observaciones actualizadas.");
    } catch (err) {
      toast.error("Error al guardar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const borrarComprobanteDB = async (url) => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>¿Está seguro de eliminar permanentemente este soporte? Se borrará tanto del registro como del servidor.</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button 
            onClick={() => { toast.dismiss(t.id); ejecutarBorradoSoporte(url); }}
            style={{ padding: '4px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            ELIMINAR
          </button>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 12px', background: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>CANCELAR</button>
        </div>
      </div>
    ), { duration: 5000 });
  };

  const ejecutarBorradoSoporte = async (url) => {
    try {
      setLoading(true);
      let bucketName = '';
      if (url.includes('comprobantes')) bucketName = 'comprobantes';
      else if (url.includes('facturas')) bucketName = 'facturas';

      let filePath = '';
      if (bucketName) {
        const searchStr = bucketName + '/';
        const bIndex = url.indexOf(searchStr);
        if (bIndex !== -1) {
          filePath = url.substring(bIndex + searchStr.length).split('?')[0];
        } else {
          filePath = url.split('?')[0];
        }
      }

      if (bucketName && filePath) {
        const { error: storageError } = await supabase.storage
          .from(bucketName)
          .remove([filePath]);

        if (storageError) console.warn("Aviso: El archivo físico no se pudo borrar:", storageError.message);
      }

      const nuevasUrls = (ticketSeleccionado.factura_url || []).filter(u => u !== url);
      const { error: dbError } = await supabase
        .from('tickets_directos')
        .update({ factura_url: nuevasUrls })
        .eq('id', ticketSeleccionado.id);

      if (dbError) throw dbError;

      setTicketSeleccionado({ ...ticketSeleccionado, factura_url: nuevasUrls });
      toast.success("Soporte eliminado físicamente del servidor.");
      await fetchHistorial();
    } catch (err) {
      toast.error("Error al eliminar soporte: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const rechazarTicket = async () => {
    const motivo = window.prompt("Indique el motivo del rechazo:");
    if (motivo === null) return; 

    setLoading(true);
    try {
      const { error } = await supabase.from('tickets_directos').update({
        status: 'Rechazado',
        observaciones: ticketSeleccionado.observaciones ? `${ticketSeleccionado.observaciones}\n\nRECHAZO: ${motivo}` : `RECHAZO: ${motivo}`
      }).eq('id', ticketSeleccionado.id);

      if (error) throw error;
      toast.success("Ticket rechazado.");
      setTicketSeleccionado(null);
      setVistaActual('historial');
      await fetchHistorial();
    } catch (err) {
      toast.error("Error al rechazar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const manejarEliminarTicket = async (id) => {
    if (currentUser?.correo?.toLowerCase() !== 'jcontreras.totalclean@gmail.com') {
      toast.error("Solo el SuperAdministrador (José) tiene permisos para eliminar tickets.");
      return;
    }
    
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>¿Está seguro de eliminar permanentemente este ticket de pago? Esta acción no se puede deshacer.</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button 
            onClick={() => { toast.dismiss(t.id); ejecutarEliminacionTicket(id); }}
            style={{ padding: '4px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            ELIMINAR TICKET
          </button>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 12px', background: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>CANCELAR</button>
        </div>
      </div>
    ), { duration: 6000 });
  };

  const ejecutarEliminacionTicket = async (id) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('tickets_directos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Ticket eliminado correctamente.");
      await fetchHistorial();
    } catch (err) {
      toast.error("Error al eliminar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // RENDER: VISTA HISTORIAL
  // ==========================================
  const renderHistorial = () => {
    const filtrados = historialTickets.filter(t => {
      const qs = busqueda.toLowerCase();
      const bMatch = (t.codigo_control || '').toLowerCase().includes(qs) || (t.gerente_nombre || '').toLowerCase().includes(qs);
      const cMatch = filtroBancos ? t.banco_origen === filtroBancos : true;
      const sMatch = filtroStatus !== 'Todos' ? (t.status || 'Emitido').toLowerCase() === filtroStatus.toLowerCase() : true;
      return bMatch && cMatch && sMatch;
    });

    return (
      <div style={{ padding: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <div>
            <h1 style={{ margin: 0, color: '#0f172a', fontSize: '1.8rem', fontWeight: '900', letterSpacing: '-1px' }}>Control de Tickets de Pago</h1>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '5px 0 0 0' }}>Gestión centralizada de emisiones y egresos</p>
          </div>
          <button
            onClick={() => setVistaActual('nuevo')}
            className="btn-tc btn-tc-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
          >
            <Plus size={18} /> Nueva Solicitud
          </button>
        </div>

        {/* --- DASHBOARD DE ESTADÍSTICAS --- */}
        <div className="rm-stats-grid" style={{ marginBottom: '32px' }}>
          <div className="rm-stat-card primary">
            <div className="rm-stat-info">
              <label>Monto Total General</label>
              <h3>$ {totals.totalMonto.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="rm-stat-icon"><DollarSign size={22} /></div>
          </div>

          <div className="rm-stat-card success">
            <div className="rm-stat-info">
              <label>Tickets Pagados</label>
              <h3 style={{ color: '#10b981' }}>{totals.pagados}</h3>
            </div>
            <div className="rm-stat-icon"><CheckCircle2 size={22} color="#10b981" /></div>
          </div>

          <div className="rm-stat-card highlight">
            <div className="rm-stat-info">
              <label>Pendientes por Procesar</label>
              <h3 style={{ color: '#8b5cf6' }}>{totals.pendientes}</h3>
            </div>
            <div className="rm-stat-icon"><Clock size={22} color="#8b5cf6" /></div>
          </div>

          <div className="rm-stat-card info">
            <div className="rm-stat-info">
              <label>Total de Tickets</label>
              <h3>{totals.totalRegistros}</h3>
            </div>
            <div className="rm-stat-icon"><Ticket size={22} /></div>
          </div>
        </div>

        <div className="filters-overlap" style={{ marginBottom: '25px', display: 'flex', gap: '15px', alignItems: 'center', backgroundColor: 'white', padding: '15px', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '15px', top: '12px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Buscar por referencia o beneficiario..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ width: '100%', padding: '12px 15px 12px 40px', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none', boxSizing: 'border-box', backgroundColor: '#f8fafc' }}
            />
          </div>
          <button onClick={fetchHistorial} style={{ backgroundColor: '#f1f5f9', color: '#475569', border: 'none', padding: '12px 15px', borderRadius: '10px', cursor: 'pointer' }}>
            <RefreshCw size={20} />
          </button>
        </div>

        {cargandoHistorial ? (
          <div style={{ textAlign: 'center', padding: '50px', color: '#64748b' }}>Cargando historial de tickets...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px', color: '#64748b', backgroundColor: 'white', borderRadius: '24px', border: '1px dashed #cbd5e1' }}>
            No se encontraron tickets emitidos.
          </div>
        ) : (
          <div className="table-container">
            <table className="tc-table">
              <thead>
                <tr>
                  <th style={{ width: '150px' }}>ID</th>
                  <th>REFERENCIA</th>
                  <th>BENEFICIARIO</th>
                  <th>FECHA</th>
                  <th>CLASIFICACIÓN</th>
                  <th>BANCO</th>
                  <th>TOTAL ($)</th>
                  <th style={{ textAlign: 'center', width: '140px' }}>ESTATUS</th>
                  <th style={{ textAlign: 'center' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(ticket => (
                  <tr key={ticket.id}>
                    <td
                      style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold', cursor: 'pointer' }}
                      className="clickable-cell"
                      onClick={() => abrirDetalleTicket(ticket)}
                    >
                      {ticket.codigo_control}
                    </td>
                    <td
                      style={{ fontWeight: '700', color: '#0ea5e9', cursor: 'pointer' }}
                      className="clickable-cell"
                      onClick={() => abrirDetalleTicket(ticket)}
                    >
                      {ticket.solicitud_ref || 'TR-Directo'}
                    </td>
                    <td style={{ fontWeight: '600' }}>{ticket.gerente_nombre || 'Varios Beneficiarios'}</td>
                    <td>{ticket.fecha_emision ? new Date(ticket.fecha_emision).toLocaleDateString() : 'N/A'}</td>
                    <td>{ticket.clasificacion_admin}</td>
                    <td>{ticket.banco_origen || 'Por Definir'}</td>
                    <td style={{ fontWeight: 'bold', color: '#0f172a', textAlign: 'right' }}>$ {(Number(ticket.total_usd) || 0).toLocaleString('de-DE')}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div className={`badge-status ${ticket.status?.toLowerCase() || 'emitido'}`}>
                        {ticket.status === 'Pagado' && <span style={{ marginRight: '4px' }}>✓</span>}
                        {ticket.status || 'Emitido'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        <button
                          onClick={() => abrirDetalleTicket(ticket)}
                          className="btn-tc btn-tc-secondary"
                          style={{ padding: '6px 12px' }}
                          title="Ver Detalle"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => manejarEliminarTicket(ticket.id)}
                          className="btn-tc btn-tc-secondary"
                          style={{ padding: '6px 12px', color: '#ef4444' }}
                          title="Eliminar Ticket"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderDetalle = () => {
    if (!ticketSeleccionado) return null;
    const t = ticketSeleccionado;

    return (
      <div className="modal-overlay" onClick={() => { setVistaActual('historial'); setTicketSeleccionado(null); }}>
        <motion.div
          className="modal-card animate-modal"
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{ maxWidth: '1400px', width: '95%' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* --- CABECERA --- */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.5rem', fontWeight: '800' }}>Gestión de Pago Detallado</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px' }}>
                <div style={{ background: '#0f172a', color: 'white', padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                  ID: {t.codigo_control}
                </div>
                <div className={`badge-status ${t.status?.toLowerCase() || 'emitido'}`} style={{ fontSize: '10px', height: '22px' }}>
                  {t.status?.toUpperCase() || 'EMITIDO'}
                </div>
              </div>
            </div>

            <button
              onClick={() => { setVistaActual('historial'); setTicketSeleccionado(null); }}
              className="btn-tc btn-tc-secondary"
              style={{ padding: '10px 20px' }}
            >
              <ArrowLeft size={16} /> Volver
            </button>
          </div>

          <div className="te-header-line" style={{ height: '1px', background: '#f1f5f9', marginBottom: '24px' }}></div>

          {/* --- METADATA --- */}
          <div className="metadata-box" style={{ marginBottom: '30px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '25px' }}>
              <div>
                <label className="stat-label">FECHA EMISIÓN</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px', color: '#1e293b', fontWeight: '600' }}>
                  <Calendar size={18} color="#94a3b8" />
                  {t.fecha_emision ? new Date(t.fecha_emision).toLocaleDateString() : 'N/A'}
                </div>
              </div>

              <div>
                <label className="stat-label">BENEFICIARIO</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px', color: '#1e293b', fontWeight: '600' }}>
                  <User size={18} color="#94a3b8" />
                  {t.gerente_nombre || 'Varios'}
                </div>
              </div>

              <div>
                <label className="stat-label">REFERENCIA FONDO</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px', color: '#0ea5e9', fontWeight: '700' }}>
                  <Hash size={18} color="#0ea5e9" />
                  {t.solicitud_ref || 'TR-Directo'}
                </div>
              </div>
            </div>
          </div>

          {/* --- TABLA DE RENGLONES --- */}
          <div style={{ marginBottom: '35px' }}>
            <label className="stat-label" style={{ marginBottom: '15px' }}>DESGLOSE Y CONTROL DE SALDOS</label>
            <div className="te-table-wrapper" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table className="tc-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}></th>
                    <th>DESCRIPCIÓN</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>PEDIDA</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>PAGADA</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>PEND.</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>CANT. PAGO</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>P.U. REAL</th>
                    <th style={{ width: '150px' }}>PROVEEDOR</th>
                    <th style={{ width: '120px' }}>DOCUMENTO</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>TOTAL</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {renglones.map((r) => (
                    <React.Fragment key={r.id}>
                      <tr className={r.cantidad_pendiente === 0 ? 'row-completed' : ''}>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => setExpandirHistorial(prev => ({ ...prev, [r.id]: !prev[r.id] }))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                          >
                            <History size={16} />
                          </button>
                        </td>
                        <td>
                          <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{r.desc || r.descripcion}</div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>CC: {r.cc} | {r.categoria}</div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{r.cantidad_pedida}</td>
                        <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 'bold' }}>{r.cantidad_comprada}</td>
                        <td style={{ textAlign: 'center', color: r.cantidad_pendiente > 0 ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>
                          {r.cantidad_pendiente}
                        </td>
                        <td>
                          <input
                            type="number"
                            className="editable-cell-input"
                            value={r.compra_actual_cant || ''}
                            onChange={(e) => actualizarFila(r.id, 'compra_actual_cant', e.target.value)}
                            disabled={r.cantidad_pendiente === 0}
                          />
                        </td>
                        <td>
                          <div style={{ position: 'relative' }}>
                            <input
                              type="number"
                              className="editable-cell-input"
                              value={r.compra_actual_pu || ''}
                              onChange={(e) => actualizarFila(r.id, 'compra_actual_pu', e.target.value)}
                              disabled={r.cantidad_pendiente === 0}
                            />
                            {r.precio_ref_encontrado && (
                              <div style={{ fontSize: '0.6rem', color: r.variacion_precio > 0 ? '#ef4444' : '#10b981', position: 'absolute', bottom: '-12px', right: 0 }}>
                                Ref: ${r.precio_ref_encontrado.toLocaleString()} ({r.variacion_precio > 0 ? '+' : ''}{r.variacion_precio.toFixed(1)}%)
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <select
                            className="editable-cell-input"
                            value={r.proveedor_seleccionado_id || ''}
                            onChange={(e) => actualizarFila(r.id, 'proveedor_seleccionado_id', e.target.value)}
                            disabled={r.cantidad_pendiente === 0}
                          >
                            <option value="">Proveedor (Opcional)...</option>
                            {proveedores.map(p => (
                              <option key={p.id} value={p.id}>{p.razon_social}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <select
                              className="editable-cell-input"
                              style={{ width: '50px', padding: '2px' }}
                              value={r.doc_tipo_actual || 'FAC'}
                              onChange={(e) => actualizarFila(r.id, 'doc_tipo_actual', e.target.value)}
                              disabled={r.cantidad_pendiente === 0}
                            >
                              <option value="FAC">FAC</option>
                              <option value="NC">NC</option>
                              <option value="IMP">IMP</option>
                              <option value="SERV">SERV</option>
                              <option value="OTRO">OTRO</option>
                            </select>
                            <input
                              type="text"
                              className="editable-cell-input"
                              placeholder="N°"
                              value={r.doc_numero_actual || ''}
                              onChange={(e) => actualizarFila(r.id, 'doc_numero_actual', e.target.value)}
                              disabled={r.cantidad_pendiente === 0}
                            />
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          $ {(r.total || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => guardarPagoRenglon(r.id)}
                            className="btn-tc btn-tc-success"
                            style={{ padding: '6px', borderRadius: '8px' }}
                            disabled={!r.hasChanges || loading || !esPrivilegiado}
                            title={!esPrivilegiado ? "Solo Administración/RRHH/Contabilidad pueden procesar" : ""}
                          >
                            <Save size={16} />
                          </button>
                        </td>
                      </tr>

                      {/* --- HISTORIAL EXPANDIBLES --- */}
                      <AnimatePresence>
                        {expandirHistorial[r.id] && (
                          <motion.tr
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                          >
                            <td colSpan="11" style={{ padding: '0 0 15px 0', backgroundColor: '#f8fafc' }}>
                              <div style={{ padding: '15px' }}>
                                <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ color: '#94a3b8', textAlign: 'left' }}>
                                      <th style={{ padding: '8px' }}>FECHA</th>
                                      <th>DOC</th>
                                      <th>PROVEEDOR</th>
                                      <th style={{ textAlign: 'center' }}>CANT</th>
                                      <th style={{ textAlign: 'right' }}>P.U.</th>
                                      <th style={{ textAlign: 'right' }}>TOTAL</th>
                                      <th style={{ textAlign: 'center' }}>ACCIONES</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(r.historial_compras || []).map((h, hIdx) => (
                                      <tr key={hIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '8px' }}>{new Date(h.fecha).toLocaleDateString()}</td>
                                        <td>{h.doc_tipo} {h.doc_numero}</td>
                                        <td>{h.proveedor_nombre}</td>
                                        <td style={{ textAlign: 'center' }}>{h.cant}</td>
                                        <td style={{ textAlign: 'right' }}>$ {h.pu.toLocaleString()}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>$ {(h.cant * h.pu).toLocaleString()}</td>
                                        <td style={{ textAlign: 'center' }}>
                                          <button
                                            onClick={() => eliminarEntradaHistorial(r.id, hIdx)}
                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                    {(!r.historial_compras || r.historial_compras.length === 0) && (
                                      <tr>
                                        <td colSpan="7" style={{ textAlign: 'center', padding: '10px', color: '#94a3b8' }}>No hay registros.</td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* --- FOOTER / ADJUNTOS --- */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '30px' }}>
            <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#0f172a' }}>Soportes y Comprobantes</h3>
                <label className="btn-tc btn-tc-primary" style={{ cursor: 'pointer', padding: '6px 12px', fontSize: '0.7rem' }}>
                  <Upload size={14} /> Adjuntar
                  <input type="file" multiple style={{ display: 'none' }} onChange={handleImagenChange} />
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {(Array.isArray(t.factura_url) ? t.factura_url : (t.factura_url ? [t.factura_url] : []))
                  .filter(url => url && url.length > 5)
                  .map((url, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <a href={url} target="_blank" rel="noreferrer" style={{ display: 'block', width: '80px', height: '80px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                        <img src={url} alt="Soporte" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </a>
                      <button
                        onClick={() => borrarComprobanteDB(url)}
                        style={{ position: 'absolute', top: '-5px', right: '-5px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '10px' }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                {imagenesUrlsPreview.map((url, idx) => (
                  <div key={`preview-${idx}`} style={{ position: 'relative' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '10px', overflow: 'hidden', border: '1px dashed #94a3b8' }}>
                      <img src={url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <button
                      onClick={() => quitarArchivoTemporal(idx)}
                      style={{ position: 'absolute', top: '-5px', right: '-5px', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '10px' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ marginBottom: '15px' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>TOTAL EJECUTADO (PAGADO):</span>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#10b981' }}>
                  $ {renglones.reduce((acc, r) => acc + (r.historial_compras || []).reduce((sum, h) => sum + (h.cant * h.pu), 0), 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>SALDO PENDIENTE Estimado (Base):</span>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#ef4444' }}>
                  $ {renglones.reduce((acc, r) => acc + (r.cantidad_pendiente * (r.pu || r.puUsd || 0)), 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ marginBottom: '25px', color: '#94a3b8', fontSize: '0.75rem' }}>
                  * El estatus del ticket cambiará a "Parcial" o "Pagado" según el saldo.
              </div>
              <button 
                onClick={actualizarPago}
                className="btn-tc btn-tc-primary" 
                style={{ width: '100%', padding: '15px', fontSize: '1rem', opacity: !esPrivilegiado ? 0.6 : 1 }}
                disabled={loading || !esPrivilegiado}
              >
                {!esPrivilegiado ? 'Solo lectura (Sin permisos de proceso)' : (loading ? 'Procesando...' : 'Finalizar y Guardar Cambios')}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <>
      {renderHistorial()}
      <AnimatePresence>
        {vistaActual === 'detalle' && renderDetalle()}
      </AnimatePresence>
    </>
  );
};

export default ModuloTicketsPago;
