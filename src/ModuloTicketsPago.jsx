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
  Hash
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

  // ==========================================
  // ESTADOS DEL FORMULARIO DE NUEVO TICKET
  // ==========================================
  const [currentUser, setCurrentUser] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [bancos, setBancos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subiendoImagen, setSubiendoImagen] = useState(false);

  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState('');
  const [bancoOrigen, setBancoOrigen] = useState('');
  const [refPago, setRefPago] = useState('');
  const [imagenArchivo, setImagenArchivo] = useState(null);
  const [imagenUrlpreview, setImagenUrlpreview] = useState('');
  const [responsableText, setResponsableText] = useState('');

  const [renglones, setRenglones] = useState([
    { id: Date.now(), nro: 1, cc: '', clasificacion: '', categoria: '', cant: 1, unid: 'UNID', desc: '', beneficiario: '', puBs: '', puUsd: '' }
  ]);

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
    const file = e.target.files[0];
    if (file) {
      setImagenArchivo(file);
      setImagenUrlpreview(URL.createObjectURL(file));
    }
  };

  const actualizarPago = async () => {
    // if (!bancoOrigen) return alert("Selecciona el Banco de Origen.");
    // if (!refPago) return alert("Ingresa el Número de Referencia (Código Control).");
    if (!imagenArchivo && !ticketSeleccionado.factura_url) {
      return alert("Debe adjuntar una imagen o comprobante antes de registrar y procesar el pago.");
    }

    setLoading(true);
    try {
      let finalImageUrl = ticketSeleccionado.factura_url;

      if (imagenArchivo) {
        setSubiendoImagen(true);
        const fileName = `recibos/${Date.now()}_${imagenArchivo.name}`;
        const { error: uploadError } = await supabase.storage
          .from('comprobantes')
          .upload(fileName, imagenArchivo);

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from('comprobantes').getPublicUrl(fileName);
          finalImageUrl = publicUrlData.publicUrl;
        }
        setSubiendoImagen(false);
      }

      const { error } = await supabase.from('tickets_directos').update({
        // banco_origen: bancoOrigen,
        // codigo_control: refPago,
        factura_url: finalImageUrl,
        status: 'Pagado',
        observaciones: ticketSeleccionado.observaciones
      }).eq('id', ticketSeleccionado.id);

      if (error) throw error;

      const logMsg = `El ticket de pago ${ticketSeleccionado.codigo_control || ticketSeleccionado.id} ha sido procesado exitosamente. Nro Ref ${refPago}`;
      await supabase.from('notificaciones').insert([{
        mensaje: logMsg,
        tipo: 'Ticket Pago',
        usuario_id: currentUser?.id,
        leido: false
      }]);

      alert('Pago registrado correctamente.');
      
      setBancoOrigen('');
      setRefPago('');
      setImagenArchivo(null);
      setImagenUrlpreview('');
      setTicketSeleccionado(null);
      
      await fetchHistorial();
      setVistaActual('historial');
    } catch (err) {
      alert("Error al actualizar pago: " + err.message);
    } finally {
      setLoading(false);
      setSubiendoImagen(false);
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
      return bMatch && cMatch;
    });

    return (
      <div className="historial-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '900', color: '#0f172a' }}>Gestión de Tickets</h1>
            <p style={{ color: '#64748b', marginTop: '5px' }}>Verifica y procesa los pagos de tickets emitidos desde Solicitud de Fondos.</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', backgroundColor: 'white', padding: '15px', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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
            style={{ padding: '12px 15px', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none', backgroundColor: '#f8fafc', minWidth: '200px' }}
          >
            <option value="">Cualquier Banco</option>
            {bancos.map(b => (
              <option key={b.nombre} value={b.nombre}>{b.nombre}</option>
            ))}
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
                    <td style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold' }}>{ticket.codigo_control}</td>
                    <td style={{ fontWeight: '700', color: '#0ea5e9' }}>{ticket.solicitud_ref || 'TR-Directo'}</td>
                    <td style={{ fontWeight: '600' }}>{ticket.gerente_nombre || 'Varios Beneficiarios'}</td>
                    <td>{ticket.fecha_emision ? new Date(ticket.fecha_emision).toLocaleDateString() : 'N/A'}</td>
                    <td>{ticket.clasificacion_admin}</td>
                    <td>{ticket.banco_origen || 'Por Definir'}</td>
                    <td style={{ fontWeight: '800', color: '#0f172a' }}>$ {(Number(ticket.total_usd) || 0).toLocaleString('de-DE')}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ 
                        color: ticket.status === 'Pagado' ? '#16a34a' : '#ca8a04', 
                        fontSize: '0.7rem', 
                        fontWeight: '900', 
                        textTransform: 'uppercase' 
                      }}>
                        {ticket.status || 'Emitido'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => { 
                          setTicketSeleccionado(ticket);
                          setBancoOrigen(ticket.banco_origen || '');
                          setRefPago(ticket.codigo_control || '');
                          setImagenUrlpreview(ticket.factura_url || '');
                          setImagenArchivo(null);
                          setVistaActual('detalle'); 
                        }} 
                        className="btn-tc btn-tc-secondary" 
                        style={{ padding: '6px 14px', margin: '0 auto' }}
                      >
                        <Eye size={16} style={{ marginRight: '6px' }} /> Detalle
                      </button>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, color: 'var(--slate-900)' }}>Detalle de Emisión de Fondos</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                <span className="status-purchase-badge">
                  <span className="stat-label" style={{ fontSize: '9px', marginBottom: 0 }}>ESTADO:</span>
                  <span style={{ 
                    fontSize: '10px', 
                    color: t.status === 'Pagado' ? '#166534' : '#854d0e',
                    fontWeight: '900' 
                  }}>
                    {t.status?.toUpperCase() || 'EMITIDO'}
                  </span>
                </span>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                  REF: {t.solicitud_ref || 'N/A'}
                </span>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <div style={{ backgroundColor: '#fef08a', padding: '10px 20px', borderRadius: '12px', fontWeight: '900', fontSize: '1.2rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                {t.codigo_control}
              </div>
              <button 
                onClick={() => { setVistaActual('historial'); setTicketSeleccionado(null); }} 
                className="btn-tc btn-tc-secondary"
              >
                <ArrowLeft size={16} /> Cerrar
              </button>
            </div>
          </div>

          <div className="req-header-line"></div>

          {/* --- CUADRÍCULA DE DATOS OPERATIVOS --- */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '25px', marginBottom: '30px' }}>
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
                <span style={{ backgroundColor: '#f1f5f9', padding: '4px 12px', borderRadius: '8px', fontWeight: '700', color: '#334155', fontSize: '0.9rem', border: '1px solid #e2e8f0' }}>
                  {t.clasificacion_admin}
                </span>
              </div>
            </div>
          </div>

          {/* --- TABLA DE RENGLONES ESTILO TC --- */}
          <div style={{ marginBottom: '35px' }}>
            <label className="stat-label" style={{ marginBottom: '15px' }}>DESGLOSE DE RENGLONES OPERATIVOS</label>
            <div style={{ borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table className="tc-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px', textAlign: 'center' }}>N°</th>
                    <th>CENTRO DE COSTO</th>
                    <th>CLASIFICACIÓN</th>
                    <th>CATEGORÍA</th>
                    <th style={{ textAlign: 'center' }}>CANT.</th>
                    <th>BENEFICIARIO</th>
                    <th>DESCRIPCIÓN DEL GASTO</th>
                    <th style={{ textAlign: 'right' }}>TOTAL $</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length > 0 ? items.map((r, i) => (
                    <tr key={r.id || i}>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#94a3b8' }}>{i + 1}</td>
                      <td style={{ fontWeight: '600', color: '#334155' }}>{r.cc || 'N/A'}</td>
                      <td>{r.clasificacion || 'N/A'}</td>
                      <td>{r.categoria || 'N/A'}</td>
                      <td style={{ textAlign: 'center', color: '#64748b', fontWeight: '600' }}>
                        {r.cant || r.cantidad || 1} {r.unid || r.unidad || 'U'}
                      </td>
                      <td style={{ fontWeight: '600' }}>{r.beneficiario || 'N/A'}</td>
                      <td style={{ color: '#475569', fontSize: '0.8rem' }}>{r.desc || r.descripcion || 'Sin descripción'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#0f172a' }}>
                        $ {(() => {
                            const cant = parseFloat(r.cant || r.cantidad) || 0;
                            const puUsd = parseFloat(r.puUsd || r.pu_usd) || 0;
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

              <div style={{ marginBottom: '25px' }}>
                <label className="stat-label">COMPROBANTE / SOPORTE DE EVIDENCIA</label>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <label className="btn-tc btn-tc-secondary" style={{ flex: 1, cursor: 'pointer', border: '2px dashed #cbd5e1' }}>
                    <input type="file" style={{ display: 'none' }} accept="image/*,application/pdf" onChange={handleImagenChange} />
                    <Upload size={16} /> 
                    <span>{imagenArchivo ? imagenArchivo.name : 'Vincular nuevo archivo...'}</span>
                  </label>
                  
                  {imagenUrlpreview && (
                    <a href={imagenUrlpreview} target="_blank" rel="noreferrer" className="btn-tc" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                      <ImageIcon size={18} /> Ver Actual
                    </a>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '25px' }}>
                <label className="stat-label">OBSERVACIONES / NOTAS ADICIONALES</label>
                <textarea 
                  className="input-tc"
                  style={{ height: '80px', resize: 'vertical', paddingTop: '10px' }}
                  value={ticketSeleccionado.observaciones || ''}
                  onChange={(e) => setTicketSeleccionado({...ticketSeleccionado, observaciones: e.target.value})}
                  placeholder="Escriba aquí cualquier observación sobre este ticket..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
                <button 
                  onClick={actualizarPago} 
                  disabled={loading || subiendoImagen} 
                  className={`btn-tc ${t.status === 'Pagado' ? 'btn-tc-secondary' : 'btn-tc-primary'}`}
                  style={{ width: '100%', padding: '15px', fontSize: '0.9rem' }}
                >
                  {subiendoImagen || loading ? (
                    <RefreshCw className="animate-spin" size={20} />
                  ) : (
                    <><Save size={20} /> {t.status === 'Pagado' ? 'ACTUALIZAR DATOS DE PAGO' : 'REGISTRAR Y PROCESAR PAGO'}</>
                  )}
                </button>
              </div>
            </div>

            {/* --- TOTALES --- */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
              <div className="totals-compact">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#64748b' }}>
                  <span className="stat-label" style={{ marginBottom: 0 }}>SUB-TOTAL:</span>
                  <span style={{ fontWeight: 'bold' }}>$ {(Number(t.total_usd) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #e2e8f0', paddingTop: '15px' }}>
                  <span style={{ fontWeight: '900', fontSize: '1rem', color: '#1e293b' }}>TOTAL TICKET:</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: '900', color: '#0f172a' }}>
                    $ {(Number(t.total_usd) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
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
    </>
  );
};

export default ModuloTicketsPago;
