import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
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

  const [renglones, setRenglones] = useState([
    { id: Date.now(), nro: 1, cc: '', clasificacion: '', categoria: '', cant: 1, unid: 'UNID', desc: '', beneficiario: '', puBs: '', puUsd: '' }
  ]);

  const [editandoObs, setEditandoObs] = useState(false);
  const [obsTemporal, setObsTemporal] = useState('');
  const [imagenesArchivos, setImagenesArchivos] = useState([]); // Soporte para múltiples archivos
  const [imagenesUrlsPreview, setImagenesUrlsPreview] = useState([]);

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
      if (perfil) {
        setCurrentUser(perfil);
        setResponsableText(`${perfil.nombre} ${perfil.apellido} - ${perfil.departamento}`);
      }
    }

    // 2. Fetch de todas las solicitudes de fondo existentes
    const { data: sData } = await supabase.from('solicitudes_fondos').select('id, codigo_control, fecha_operativa, responsable_nombre').order('created_at', { ascending: false });
    if (sData) setSolicitudes(sData);

    // 3. Fetch de Bancos de Origen
    const { data: bData } = await supabase.from('bancos').select('*').eq('activo', true).order('nombre');
    if (bData) setBancos(bData);

    // 4. Fetch Historial
    await fetchHistorial();
  };

  // ==========================================
  // KPI DASHBOARD 
  // ==========================================
  const totals = useMemo(() => {
    const list = historialTickets || [];
    const totalMonto = list.reduce((acc, t) => acc + (Number(t.total_usd) || 0), 0);
    const pagados = list.filter(t => t.status === 'Pagado').length;
    const pendientes = list.filter(t => t.status !== 'Pagado' && t.status !== 'Anulado').length;
    const totalRegistros = list.length;

    return { totalMonto, pagados, pendientes, totalRegistros };
  }, [historialTickets]);

  const fetchHistorial = async () => {
    setCargandoHistorial(true);
    try {
      const { data, error } = await supabase
        .from('tickets_directos')
        .select('*')
        .order('fecha_emision', { ascending: false });

      if (error) throw error;
      setHistorialTickets(data || []);
    } catch (err) {
      console.error('Error al cargar historial:', err.message);
    } finally {
      setCargandoHistorial(false);
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
      return alert("Debe adjuntar al menos una imagen o comprobante antes de registrar y procesar el pago.");
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

      const { error } = await supabase.from('tickets_directos').update({
        factura_url: finalUrls,
        status: 'Pagado',
        observaciones: ticketSeleccionado.observaciones,
        items: ticketSeleccionado.items,
        clasificacion_admin: ticketSeleccionado.clasificacion_admin
      }).eq('id', ticketSeleccionado.id);

      if (error) throw error;

      alert('Pago registrado correctamente.');

      setBancoOrigen('');
      setRefPago('');
      setImagenesArchivos([]);
      setImagenesUrlsPreview([]);
      setTicketSeleccionado(null);
      await fetchHistorial();
      setVistaActual('historial');
    } catch (err) {
      alert("Error al actualizar pago: " + err.message);
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
      alert("Observaciones actualizadas.");
    } catch (err) {
      alert("Error al guardar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const borrarComprobanteDB = async (url) => {
    if (!window.confirm("¿Está seguro de eliminar permanentemente este soporte? Se borrará tanto del registro como del servidor.")) return;

    try {
      setLoading(true);
      // 1. Detección dinámica y robusta del bucket desde la URL
      let bucketName = '';
      if (url.includes('comprobantes')) bucketName = 'comprobantes';
      else if (url.includes('facturas')) bucketName = 'facturas';

      // 2. Extraer el path del archivo
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

      // 3. Eliminar del Storage si es posible
      if (bucketName && filePath) {
        const { error: storageError } = await supabase.storage
          .from(bucketName)
          .remove([filePath]);

        if (storageError) console.warn("Aviso: El archivo físico no se pudo borrar (puede que no exista en el servidor):", storageError.message);
      }

      // 3. Actualizar la DB
      const nuevasUrls = (ticketSeleccionado.factura_url || []).filter(u => u !== url);
      const { error: dbError } = await supabase
        .from('tickets_directos')
        .update({ factura_url: nuevasUrls })
        .eq('id', ticketSeleccionado.id);

      if (dbError) throw dbError;

      setTicketSeleccionado({ ...ticketSeleccionado, factura_url: nuevasUrls });
      alert("Soporte eliminado físicamente del servidor.");
      await fetchHistorial();
    } catch (err) {
      alert("Error al eliminar soporte: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const rechazarTicket = async () => {
    const motivo = window.prompt("Indique el motivo del rechazo:");
    if (motivo === null) return; // Cancelado

    setLoading(true);
    try {
      const { error } = await supabase.from('tickets_directos').update({
        status: 'Rechazado',
        observaciones: ticketSeleccionado.observaciones ? `${ticketSeleccionado.observaciones}\n\nRECHAZO: ${motivo}` : `RECHAZO: ${motivo}`
      }).eq('id', ticketSeleccionado.id);

      if (error) throw error;
      alert("Ticket rechazado.");
      setTicketSeleccionado(null);
      setVistaActual('historial');
      await fetchHistorial();
    } catch (err) {
      alert("Error al rechazar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const actualizarItemTicket = (index, campo, valor) => {
    const nuevosItems = [...ticketSeleccionado.items];
    nuevosItems[index] = { ...nuevosItems[index], [campo]: valor };
    setTicketSeleccionado({ ...ticketSeleccionado, items: nuevosItems });
  };

  const manejarEliminarTicket = async (id) => {
    if (!window.confirm("¿Está seguro de eliminar permanentemente este ticket de pago? Esta acción no se puede deshacer.")) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('tickets_directos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      alert("Ticket eliminado correctamente.");
      await fetchHistorial();
    } catch (err) {
      alert("Error al eliminar: " + err.message);
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

        {/* --- DASHBOARD DE ESTADÍSTICAS PREMIUM --- */}
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
          <select
            value={filtroBancos}
            onChange={(e) => setFiltroBancos(e.target.value)}
            style={{ padding: '12px 15px', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none', backgroundColor: '#f8fafc', minWidth: '180px' }}
          >
            <option value="">Cualquier Banco</option>
            {bancos.map(b => (
              <option key={b.nombre} value={b.nombre}>{b.nombre}</option>
            ))}
          </select>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            style={{ padding: '12px 15px', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none', backgroundColor: '#f8fafc', minWidth: '150px' }}
          >
            <option value="Todos">Todos (Estatus)</option>
            <option value="Emitido">Emitido</option>
            <option value="Pagado">Pagado</option>
            <option value="Rechazado">Rechazado</option>
          </select>
          <button onClick={fetchHistorial} style={{ backgroundColor: '#f1f5f9', color: '#475569', border: 'none', padding: '0 15px', borderRadius: '10px', cursor: 'pointer' }}>
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
                      onClick={() => {
                        setTicketSeleccionado(ticket);
                        setBancoOrigen(ticket.banco_origen || '');
                        setRefPago(ticket.codigo_control || '');
                        setImagenUrlpreview(ticket.factura_url || '');
                        setVistaActual('detalle');
                      }}
                    >
                      {ticket.codigo_control}
                    </td>
                    <td
                      style={{ fontWeight: '700', color: '#0ea5e9', cursor: 'pointer' }}
                      className="clickable-cell"
                      onClick={() => {
                        setTicketSeleccionado(ticket);
                        setBancoOrigen(ticket.banco_origen || '');
                        setRefPago(ticket.codigo_control || '');
                        setImagenUrlpreview(ticket.factura_url || '');
                        setVistaActual('detalle');
                      }}
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
                          onClick={() => {
                            setTicketSeleccionado(ticket);
                            setBancoOrigen(ticket.banco_origen || '');
                            setRefPago(ticket.codigo_control || '');
                            setImagenUrlpreview(ticket.factura_url || '');
                            setVistaActual('detalle');
                          }}
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




  // ==========================================
  // RENDER: VISTA DETALLE TICKET (REDISEÑO ESTILO REQUISICIONES + MODAL OVERLAY)
  // ==========================================
  const renderDetalle = () => {
    if (!ticketSeleccionado) return null;
    const t = ticketSeleccionado;
    const items = t.items || [];
    const bancoActual = bancos.find(b => b.nombre === (t.banco_origen || bancoOrigen));
    const monedaSimbolo = bancoActual?.moneda === 'Bs' ? 'Bs.' : '$';

    return (
      <div className="modal-overlay" onClick={() => { setVistaActual('historial'); setTicketSeleccionado(null); }}>
        <motion.div
          className="modal-card animate-modal"
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()} // Evitar cierre al hacer clic dentro
        >
          {/* --- CABECERA ESTILO REQUISICIÓN --- */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.5rem', fontWeight: '800' }}>Detalle de Emisión de Fondos</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px' }}>
                <div style={{ background: '#0f172a', color: 'white', padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                  ID: {t.codigo_control}
                </div>
                {t.solicitud_ref && (
                  <div style={{ background: '#f59e0b', color: 'white', padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                    REF: {t.solicitud_ref}
                  </div>
                )}
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

          {/* --- CUADRÍCULA DE DATOS OPERATIVOS --- */}
          <div className="metadata-box" style={{ marginBottom: '30px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '25px' }}>
              <div>
                <label className="stat-label">FECHA DE EMISIÓN</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px', color: '#1e293b', fontWeight: '600' }}>
                  <Calendar size={18} color="#94a3b8" />
                  {t.fecha_emision ? new Date(t.fecha_emision).toLocaleDateString() : 'N/A'}
                </div>
              </div>

              <div>
                <label className="stat-label">RESPONSABLE / BENEFICIARIO</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    backgroundColor: 'var(--primary)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', fontWeight: 'bold'
                  }}>
                    <User size={16} />
                  </div>
                  <span style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--slate-800)' }}>
                    {t.gerente_nombre || 'Varios Beneficiarios'}
                  </span>
                </div>
              </div>

              <div>
                <label className="stat-label">FONDO ORIGINAL (PADRE)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px', color: '#0ea5e9', fontWeight: '700' }}>
                  <Hash size={18} color="#0ea5e9" />
                  {t.solicitud_ref || 'Sin referencia'}
                </div>
              </div>

              <div>
                <label className="stat-label">CLASIFICACIÓN ADMIN</label>
                <div style={{ marginTop: '5px' }}>
                  <select
                    className="editable-cell-input"
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', fontWeight: '700', fontSize: '0.85rem' }}
                    value={t.clasificacion_admin || ''}
                    onChange={(e) => setTicketSeleccionado({ ...t, clasificacion_admin: e.target.value })}
                  >
                    <option value="">Seleccione...</option>
                    {["Tea", "Nómina", "Pólizas", "Pago Eventuales"].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* --- OBSERVACIONES / JUSTIFICACIÓN --- */}
          <div style={{ marginBottom: '35px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
              <label className="stat-label" style={{ marginBottom: 0 }}>OBSERVACIONES / JUSTIFICACIÓN</label>
              {!editandoObs && (
                <button
                  onClick={() => { setObsTemporal(t.observaciones || ''); setEditandoObs(true); }}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
                  title="Editar Observaciones"
                >
                  ✏️
                </button>
              )}
            </div>

            {editandoObs ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <textarea
                  className="input-tc"
                  style={{ height: '80px', resize: 'vertical', paddingTop: '10px', backgroundColor: 'white' }}
                  value={obsTemporal}
                  onChange={(e) => setObsTemporal(e.target.value)}
                  placeholder="Actualice sus observaciones aquí..."
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={guardarObservacionesTicket} className="btn-tc btn-tc-success" style={{ padding: '6px 12px', fontSize: '0.7rem' }}>
                    ✓ GUARDAR
                  </button>
                  <button onClick={() => setEditandoObs(false)} className="btn-tc btn-tc-secondary" style={{ padding: '6px 12px', fontSize: '0.7rem' }}>
                    CANCELAR
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="input-tc"
                style={{ minHeight: '60px', padding: '12px', background: '#f8fafc', color: t.observaciones ? '#334155' : '#94a3b8', cursor: 'pointer' }}
                onClick={() => { setObsTemporal(t.observaciones || ''); setEditandoObs(true); }}
              >
                {t.observaciones || 'Sin observaciones registradas.'}
              </div>
            )}
          </div>

          {/* --- TABLA DE RENGLONES ESTILO TC --- */}
          <div style={{ marginBottom: '35px' }}>
            <label className="stat-label" style={{ marginBottom: '15px', fontSize: '0.75rem' }}>DESGLOSE DE RENGLONES OPERATIVOS</label>
            <div className="te-table-wrapper" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table className="tc-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px', textAlign: 'center' }}>N°</th>
                    <th style={{ width: '150px' }}>C. COSTO</th>
                    <th style={{ width: '150px' }}>CLASIFICACIÓN</th>
                    <th style={{ width: '150px' }}>CATEGORÍA</th>
                    <th style={{ width: '110px' }}>MONEDA</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>CANT.</th>
                    <th style={{ minWidth: '150px' }}>BENEFICIARIO</th>
                    <th>DESCRIPCIÓN</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>TOTAL $</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length > 0 ? items.map((r, i) => (
                    <tr key={r.id || i}>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#94a3b8' }}>{i + 1}</td>
                      <td style={{ fontWeight: '600', color: '#334155' }}>{r.cc || 'N/A'}</td>
                      <td>
                        <input
                          type="text"
                          className="editable-cell-input"
                          value={r.clasificacion || ''}
                          onChange={(e) => actualizarItemTicket(i, 'clasificacion', e.target.value)}
                          placeholder="Clasificación..."
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="editable-cell-input"
                          value={r.categoria || ''}
                          onChange={(e) => actualizarItemTicket(i, 'categoria', e.target.value)}
                          placeholder="Categoría..."
                        />
                      </td>
                      <td>
                        <select
                          className="editable-cell-input"
                          style={{ width: '100%', fontSize: '0.75rem', fontWeight: 'bold' }}
                          value={r.moneda || '$ / Bs.'}
                          onChange={(e) => actualizarItemTicket(i, 'moneda', e.target.value)}
                        >
                          <option value="$ / Bs.">$ / Bs.</option>
                          <option value="$">$</option>
                        </select>
                      </td>
                      <td style={{ textAlign: 'center', color: '#64748b', fontWeight: '600' }}>
                        {r.cant || r.cantidad || 1} {r.unid || r.unidad || 'U'}
                      </td>
                      <td style={{ fontWeight: '600' }}>{r.beneficiario || 'N/A'}</td>
                      <td style={{ color: '#475569', fontSize: '0.8rem' }}>{r.desc || r.descripcion || 'Sin descripción'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#0f172a' }}>
                        $ {(() => {
                          const cant = parseFloat(r.cant || r.cantidad) || 0;
                          const puUsd = parseFloat(r.puUsd || r.pu_usd || r.pu) || 0;
                          const puBs = parseFloat(r.puBs || r.pu_bs) || 0;
                          return ((puUsd + puBs) * cant).toLocaleString('de-DE', { minimumFractionDigits: 2 });
                        })()}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontStyle: 'italic' }}>
                        Este ticket no reporta desglose de renglones en su carga original.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* --- SECCIÓN DE PAGO (INTEGRADA) --- */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: '30px' }}>
            <div style={{ backgroundColor: '#f8fafc', padding: '25px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <DollarSign size={20} color="#10b981" /> DETALLES Y PROCESAMIENTO DE PAGO
              </h3>
              {/* FUNCIONALIDADES TEMPORALMENTE DESCARTADAS
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label className="stat-label">BANCO EJECUTOR</label>
                  <select className="input-tc" value={bancoOrigen} onChange={(e) => setBancoOrigen(e.target.value)}>
                    <option value="">Seleccione Cuenta...</option>
                    {bancos.map(b => (
                      <option key={b.id} value={b.nombre}>{b.nombre} - {b.moneda}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="stat-label">REF. BANCARIA / CONFIRMACIÓN</label>
                  <input className="input-tc" type="text" value={refPago} onChange={(e) => setRefPago(e.target.value)} placeholder="Nº de Referencia" />
                </div>
              </div>
              */}

              {/* --- SOPORTES DE DOCUMENTOS --- */}
              <div style={{ marginBottom: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <label className="stat-label" style={{ marginBottom: 0 }}>DOCUMENTOS Y SOPORTES VINCULADOS</label>
                  <label className="btn-tc btn-tc-primary" style={{ cursor: 'pointer', padding: '6px 12px', fontSize: '0.7rem' }}>
                    <Upload size={14} /> ADJUNTAR SOPORTE
                    <input 
                      type="file" 
                      multiple 
                      style={{ display: 'none' }} 
                      accept="image/*,application/pdf" 
                      onChange={handleImagenChange} 
                      capture="environment"
                    />
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  {/* YA EXISTENTES EN DB */}
                  {(Array.isArray(t.factura_url) ? t.factura_url : (t.factura_url ? [t.factura_url] : []))
                    .filter(url => url && url.length > 5)
                    .map((url, idx) => {
                      const isImg = /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(url.split('?')[0]);
                      return (
                        <div key={`db-${idx}`} style={{ position: 'relative' }}>
                          <a href={url} target="_blank" rel="noreferrer" style={{ display: 'block', width: '90px', height: '90px', borderRadius: '12px', overflow: 'hidden', border: '2px solid #e2e8f0', backgroundColor: 'white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                            {isImg ? (
                              <img src={url} alt={`Soporte ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', color: '#334155' }}>
                                <FileText size={24} />
                              </div>
                            )}
                          </a>
                          <button
                            onClick={() => borrarComprobanteDB(url)}
                            style={{ position: 'absolute', top: '-8px', right: '-8px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '22px', height: '22px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', fontWeight: 'bold' }}
                            title="Eliminar Soportete Definitivamente"
                          >
                            X
                          </button>
                        </div>
                      );
                    })}

                  {/* TEMPORALES (POR SUBIR) */}
                  {imagenesUrlsPreview.map((url, idx) => (
                    <div key={`temp-${idx}`} style={{ position: 'relative' }}>
                      <div style={{ width: '90px', height: '90px', borderRadius: '12px', overflow: 'hidden', border: '2px dashed #0284c7', backgroundColor: '#f0f9ff', opacity: 0.8 }}>
                        <img src={url} alt="Previsualización" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          onClick={() => quitarArchivoTemporal(idx)}
                          style={{ position: 'absolute', top: '-5px', right: '-5px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >X</button>
                      </div>
                    </div>
                  ))}

                  {(!t.factura_url?.length && !imagenesUrlsPreview.length) && (
                    <div style={{ width: '100%', textAlign: 'center', padding: '10px', color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>
                      No hay soportes vinculados a este ticket.
                    </div>
                  )}
                </div>
              </div>


              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
                {(t.status?.toLowerCase() === 'emitido' || !t.status) && (
                  <>
                    <button
                      onClick={rechazarTicket}
                      disabled={loading}
                      className="btn-tc btn-tc-danger"
                      style={{ flex: 1, padding: '15px', fontSize: '0.9rem' }}
                    >
                      RECHAZAR TICKET
                    </button>
                    <button
                      onClick={actualizarPago}
                      disabled={loading || subiendoImagen}
                      className="btn-tc btn-tc-success"
                      style={{ flex: 2, padding: '15px', fontSize: '0.9rem' }}
                    >
                      {subiendoImagen || loading ? (
                        <RefreshCw className="animate-spin" size={20} />
                      ) : (
                        <><Save size={20} /> CONFIRMAR Y PROCESAR PAGO</>
                      )}
                    </button>
                  </>
                )}
                {t.status?.toLowerCase() === 'pagado' && (
                  <button
                    onClick={actualizarPago}
                    disabled={loading || subiendoImagen}
                    className="btn-tc btn-tc-primary"
                    style={{ width: '100%', padding: '15px', fontSize: '0.9rem' }}
                  >
                    {subiendoImagen || loading ? (
                      <RefreshCw className="animate-spin" size={20} />
                    ) : (
                      <><Save size={20} /> ACTUALIZAR DATOS DE PAGO</>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* --- TOTALES --- */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
              <div className="totals-compact highlighted-total">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#64748b' }}>
                  <span className="stat-label" style={{ marginBottom: 0 }}>SUB-TOTAL (BASE):</span>
                  <span style={{ fontWeight: 'bold' }}>{monedaSimbolo} {(Number(t.total_usd) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', color: '#64748b' }}>
                  <span className="stat-label" style={{ marginBottom: 0 }}>IVA (16%):</span>
                  <span style={{ fontWeight: 'bold' }}>{monedaSimbolo} {((Number(t.total_usd) || 0) * 0.16).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #86efac', paddingTop: '15px' }}>
                  <span style={{ fontWeight: '900', fontSize: '1rem', color: '#166534' }}>TOTAL CON IVA:</span>
                  <span style={{ fontSize: '1.8rem', fontWeight: '900', color: '#064e3b' }}>
                    {monedaSimbolo} {((Number(t.total_usd) || 0) * 1.16).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <p style={{ marginTop: '20px', fontSize: '0.75rem', color: '#94a3b8', textAlign: 'right', maxWidth: '300px' }}>
                Este ticket representa un desembolso directo asociado a la solicitud {t.solicitud_ref}.
              </p>
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
      <AnimatePresence>
        {showConfirmacionPago && null}
      </AnimatePresence>
    </>
  );
};

export default ModuloTicketsPago;
