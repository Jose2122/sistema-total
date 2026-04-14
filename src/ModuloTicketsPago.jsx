import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
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
  Image as ImageIcon
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
    if (!bancoOrigen) return alert("Selecciona el Banco de Origen.");
    if (!refPago) return alert("Ingresa el Número de Referencia (Código Control).");

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
        banco_origen: bancoOrigen,
        codigo_control: refPago,
        factura_url: finalImageUrl,
        status: 'Pagado'
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
                  <th>REFERENCIA</th>
                  <th>BENEFICIARIO</th>
                  <th>FECHA</th>
                  <th>CLASIFICACIÓN</th>
                  <th>BANCO</th>
                  <th>TOTAL ($)</th>
                  <th>ESTATUS</th>
                  <th style={{ textAlign: 'center' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(ticket => (
                  <tr key={ticket.id}>
                    <td style={{ fontWeight: '700', color: '#0ea5e9' }}>{ticket.solicitud_ref || ticket.codigo_control}</td>
                    <td style={{ fontWeight: '600' }}>{ticket.gerente_nombre || 'Varios Beneficiarios'}</td>
                    <td>{ticket.fecha_emision ? new Date(ticket.fecha_emision).toLocaleDateString() : 'N/A'}</td>
                    <td>{ticket.clasificacion_admin}</td>
                    <td>{ticket.banco_origen || 'Por Definir'}</td>
                    <td style={{ fontWeight: '800', color: '#0f172a' }}>$ {(Number(ticket.total_usd) || 0).toLocaleString('de-DE')}</td>
                    <td>
                      <span style={{ 
                        backgroundColor: ticket.status === 'Pagado' ? '#dcfce7' : '#fef9c3', 
                        color: ticket.status === 'Pagado' ? '#166534' : '#854d0e', 
                        padding: '4px 10px', 
                        borderRadius: '6px', 
                        fontSize: '11px', 
                        fontWeight: '800', 
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
  // RENDER: VISTA DETALLE TICKET
  // ==========================================
  const renderDetalle = () => {
    if (!ticketSeleccionado) return null;
    const t = ticketSeleccionado;
    const items = t.items || [];

    return (
      <div className="historial-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '900', color: '#0f172a' }}>Detalle de Emisión</h1>
            <p style={{ color: '#64748b', marginTop: '5px' }}>Revisión a fondo del ticket guardado en la base de datos.</p>
          </div>
          <button onClick={() => { setVistaActual('historial'); setTicketSeleccionado(null); }} style={{ backgroundColor: 'white', color: '#475569', padding: '10px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={16} /> Volver al Historial
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px', marginBottom: '20px' }}>
          <div className="footer-card">
            <h3 style={{ margin: '0 0 15px 0', color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>Datos Operativos</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Referencia/Transacción:</span> <strong style={{ color: '#0f172a' }}>{t.codigo_control}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Emisión del Ticket:</span> <strong style={{ color: '#0f172a' }}>{t.fecha_emision ? new Date(t.fecha_emision).toLocaleDateString() : 'N/A'}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Fondo Original (Padre):</span> <strong style={{ color: '#0f172a' }}>{t.solicitud_ref}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Clasificación Admin:</span> <span style={{ backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '6px', fontWeight: '700', color: '#334155' }}>{t.clasificacion_admin}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Banco Ejecutor:</span> <strong style={{ color: '#f59e0b' }}>{t.banco_origen || 'No Registrado'}</strong></div>
            </div>
          </div>

          <div className="footer-card">
            <h3 style={{ margin: '0 0 15px 0', color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>Procesamiento de Pago</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Banco Ejecutor:</label>
                <select value={bancoOrigen} onChange={(e) => setBancoOrigen(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '5px' }}>
                  <option value="">Seleccione Cuenta de Pago...</option>
                  {bancos.map(b => (
                    <option key={b.id} value={b.nombre}>{b.nombre} - {b.moneda}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Ref. Bancaria (Confirmación):</label>
                <input type="text" value={refPago} onChange={(e) => setRefPago(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '5px' }} placeholder="Nº de Referencia" />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Soporte de Evidencia:</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px', border: '2px dashed #cbd5e1', borderRadius: '8px', cursor: 'pointer', backgroundColor: '#f8fafc', marginTop: '5px', justifyContent: 'center' }}>
                  <input type="file" style={{ display: 'none' }} accept="image/*,application/pdf" onChange={handleImagenChange} />
                  <Upload size={16} color="#64748b" />
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>{imagenArchivo ? imagenArchivo.name : 'Subir archivo...'}</span>
                </label>
                {imagenUrlpreview && (
                  <div style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <a href={imagenUrlpreview} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#0ea5e9', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <ImageIcon size={14} /> Ver Soporte Actual
                    </a>
                  </div>
                )}
              </div>

              {t.status !== 'Pagado' ? (
                <button 
                  onClick={actualizarPago} 
                  disabled={loading || subiendoImagen} 
                  style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '10px' }}
                >
                  {subiendoImagen || loading ? 'Procesando...' : <><Save size={18} /> Procesar Pago</>}
                </button>
              ) : (
                <button 
                  onClick={actualizarPago} 
                  disabled={loading || subiendoImagen} 
                  style={{ backgroundColor: '#0f172a', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '10px' }}
                >
                  {subiendoImagen || loading ? 'Actualizando...' : <><RefreshCw size={18} /> Actualizar Datos de Pago</>}
                </button>
              )}

            </div>
          </div>
        </div>

        <div className="table-container" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
            <h3 style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="#64748b" /> Renglones Operativos ({items.length})
            </h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="renglones-table" style={{ margin: 0, borderTop: 'none' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px', padding: '15px' }}>N°</th>
                  <th>C. COSTO</th>
                  <th>CLASIFICACIÓN</th>
                  <th>CATEGORÍA</th>
                  <th style={{ textAlign: 'center' }}>CANT</th>
                  <th>DESCRIPCIÓN GASTO</th>
                  <th>BENEFICIARIO MÚLTIPLE</th>
                  <th style={{ textAlign: 'right', paddingRight: '20px' }}>TOTAL $</th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? items.map((r, i) => (
                  <tr key={r.id || i}>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#94a3b8', padding: '15px' }}>{r.nro || i + 1}</td>
                    <td style={{ fontWeight: '600', color: '#334155' }}>{r.cc || 'N/A'}</td>
                    <td>{r.clasificacion || 'N/A'}</td>
                    <td>{r.categoria || 'N/A'}</td>
                    <td style={{ textAlign: 'center', color: '#64748b' }}>{r.cant || r.cantidad || 1} {r.unid || r.unidad || 'U'}</td>
                    <td style={{ color: '#475569' }}>{r.desc || r.descripcion || 'Sin descripción'}</td>
                    <td style={{ fontStyle: 'italic', color: '#64748b' }}>{r.beneficiario || 'N/A'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#0f172a', paddingRight: '20px' }}>
                      $ {(() => {
                          const cant = parseFloat(r.cant || r.cantidad) || 0;
                          const puUsd = parseFloat(r.puUsd || r.pu_usd) || 0;
                          const puBs = parseFloat(r.puBs || r.pu_bs) || 0; 
                          return ((puUsd + puBs) * cant).toLocaleString('de-DE');
                      })()}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontStyle: 'italic' }}>Este ticket no reporta desglose de renglones en su carga original.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  if (vistaActual === 'detalle') return renderDetalle();
  return renderHistorial();
};

export default ModuloTicketsPago;
