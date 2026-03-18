import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { 
  Plus, 
  Trash2, 
  FileText, 
  Upload, 
  ArrowLeft, 
  CheckCircle2, 
  Search, 
  Filter, 
  User, 
  History, 
  FileImage,
  Loader2,
  Eye
} from 'lucide-react';
import './TicketExpress.css';

const TicketExpress = ({ isOpen = false, onClose = null, datosPredefinidos = null }) => {
  // --- ESTADOS DE CONTROL ---
  const [showModal, setShowModal] = useState(isOpen);
  const [loading, setLoading] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [verTodos, setVerTodos] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // --- LÓGICA DE SIGLAS GERENCIA ---
  const obtenerSiglas = (nombreGerencia) => {
    if (!nombreGerencia) return '---';
    const mapeo = {
      "Operaciones": "O",
      "Mantenimiento": "M",
      "Seguridad": "S",
      "Recursos Humanos": "RRHH",
      "Estimación": "E",
      "Almacén": "ALM",
      "Servicios Generales": "SG",
      "Administración Maracaibo": "ADM-MCBO",
      "Administración El Tigre": "ADM-ET",
      "Gerencia General": "GG",
      "Contabilidad": "C"
    };
    return mapeo[nombreGerencia] || nombreGerencia.split(' ').map(w => w[0]).join('').toUpperCase();
  };

  const getWeekNumber = (d) => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  };

  // --- DATA MAESTRA ---
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [todasClasificaciones, setTodasClasificaciones] = useState([]);
  const [todasCategorias, setTodasCategorias] = useState([]);

  // --- FORMULARIO ---
  const [form, setForm] = useState({
    id: '',
    fecha: new Date().toISOString().split('T')[0],
    gerente: '',
    departamento: '',
    usuario_id: '',
    partidas: [{ id: Date.now(), cc: '', clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', pu: '', total: 0 }],
    factura_url: '',
    id_control: '',
    solicitud_ref: ''
  });

  const numSemana = getWeekNumber(form.fecha);
  const siglasGerencia = obtenerSiglas(currentUser?.departamento || form.departamento);
  const idControlAutomatico = `${siglasGerencia} - SEMANA ${numSemana}`;

  useEffect(() => {
    if (isOpen) setShowModal(true);
  }, [isOpen]);

  useEffect(() => {
    if (!showModal && onClose) onClose();
  }, [showModal, onClose]);

  useEffect(() => {
    if (datosPredefinidos && showModal) {
      setForm(prev => ({
        ...prev,
        fecha: datosPredefinidos.fecha || prev.fecha,
        departamento: datosPredefinidos.gerencia || prev.departamento,
        solicitud_ref: datosPredefinidos.solicitud_ref || '',
        partidas: datosPredefinidos.partidasSeleccionadas ? datosPredefinidos.partidasSeleccionadas.map(p => ({
          ...p,
          pago_realizado: false,
          pu: p.puUsd || p.puBs || 0,
          total: (p.puUsd || p.puBs || 0) * (p.cant || 1)
        })) : prev.partidas
      }));
    }
  }, [datosPredefinidos, showModal]);

  const unidades = ["UNID", "KG", "LTS", "SERV", "SG", "BOLSAS", "PZA"];

  // --- CARGAR SESIÓN Y PERFIL ---
  const cargarUsuario = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      const adminEmails = ['jcontreras.totalclean@gmail.com'];
      const userInfo = {
        id: user.id,
        nombre: perfil ? `${perfil.nombre} ${perfil.apellido}` : user.email.split('@')[0],
        departamento: perfil ? perfil.departamento : 'General',
        rol: perfil ? perfil.rol : 'Gerente',
        esAdminGlobal: adminEmails.includes(user.email) || perfil?.rol === 'Gerente General'
      };
      
      setCurrentUser(userInfo);
      setForm(prev => ({ 
        ...prev, 
        gerente: userInfo.nombre, 
        departamento: userInfo.departamento,
        usuario_id: userInfo.id
      }));
    }
  }, []);

  // --- CARGAR DATA MAESTRA ---
  const cargarDataMaestra = useCallback(async () => {
    const { data: dataCC } = await supabase.from('maestros_centros_costo').select('nombre').eq('activo', true).order('nombre');
    if (dataCC) setCentrosCosto(dataCC.map(c => c.nombre));

    const { data: dataClas } = await supabase.from('maestros_clasificaciones').select('nombre, maestros_centros_costo(nombre)').eq('activo', true);
    if (dataClas) {
      setTodasClasificaciones(dataClas.map(c => ({ nombre: c.nombre, padre: c.maestros_centros_costo?.nombre })));
    }

    const { data: dataSub } = await supabase.from('maestros_sub_clasificaciones').select('nombre, maestros_clasificaciones(nombre)').eq('activo', true);
    if (dataSub) {
      setTodasCategorias(dataSub.map(s => ({ nombre: s.nombre, padre: s.maestros_clasificaciones?.nombre })));
    }
  }, []);

  // --- CARGAR HISTORIAL ---
  const cargarHistorial = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      let query = supabase.from('tickets_directos').select('id, gerente_nombre, departamento, fecha_emision, codigo_control, total_usd, status, factura_url, fecha, items, solicitud_ref');
      
      if (!currentUser.esAdminGlobal || !verTodos) {
        if (currentUser.rol === 'Gerente') {
          // Obtener IDs de subalternos (Coordinadores y Analistas) en el mismo departamento
          const { data: subalternos } = await supabase
            .from('perfiles')
            .select('id')
            .eq('departamento', currentUser.departamento)
            .in('rol', ['Coordinador', 'Analista']);

          const idsPermitidos = [
            currentUser.id,
            ...(subalternos || []).map(s => s.id)
          ];

          query = query.in('usuario_id', idsPermitidos);
        } else {
          // Coordinador / Analista: Solo lo propio
          query = query.eq('usuario_id', currentUser.id);
        }
      }

      const { data, error } = await query.order('fecha', { ascending: false });
      if (error) throw error;
      setHistorial(data || []);
    } catch (err) {
      console.error("Error historial:", err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    cargarUsuario();
    cargarDataMaestra();
  }, [cargarUsuario, cargarDataMaestra]);

  useEffect(() => {
    if (currentUser) cargarHistorial();
  }, [currentUser, cargarHistorial, verTodos]);

  // --- MANEJADORES DE FORMULARIO ---
  const manejarCambioPartida = (index, campo, valor) => {
    const nuevas = [...form.partidas];
    nuevas[index][campo] = valor;
    
    if (campo === 'cc') { nuevas[index].clasif = ''; nuevas[index].cat = ''; }
    if (campo === 'clasif') { nuevas[index].cat = ''; }
    
    // Recalcular total de la fila
    const cant = parseFloat(nuevas[index].cant) || 0;
    const pu = parseFloat(nuevas[index].pu) || 0;
    nuevas[index].total = cant * pu;

    setForm({ ...form, partidas: nuevas });
  };

  const manejarCambioPago = (index, valor) => {
    const nuevas = [...form.partidas];
    nuevas[index].pago_realizado = valor;
    setForm({ ...form, partidas: nuevas });
  };

  const añadirRenglón = () => {
    setForm({
      ...form,
      partidas: [...form.partidas, { id: Date.now(), cc: '', clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', pu: '', total: 0 }]
    });
  };

  const eliminarRenglón = (id) => {
    if (form.partidas.length > 1) {
      setForm({ ...form, partidas: form.partidas.filter(p => p.id !== id) });
    }
  };

  // --- ADJUNTAR FACTURA ---
  const manejarSubidaFactura = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setLoading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `tickets/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('facturas')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('facturas')
        .getPublicUrl(filePath);

      setForm(prev => ({ ...prev, factura_url: publicUrl }));

      // Si estamos en modo "Ver Detalle" (isEditing), actualizamos la BD de inmediato
      if (isEditing && form.id) {
        const { error: updateError } = await supabase
          .from('tickets_directos')
          .update({ factura_url: publicUrl })
          .eq('id', form.id);
        
        if (updateError) throw updateError;
        alert("Factura actualizada en la base de datos");
        cargarHistorial(); // Refrescar tabla de fondo
      } else {
        alert("Factura adjuntada con éxito");
      }
    } catch (err) {
      alert("Error subiendo factura: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- CALCULAR TOTALES ---
  const subtotalTotal = useMemo(() => {
    return form.partidas.reduce((acc, p) => acc + (parseFloat(p.total) || 0), 0);
  }, [form.partidas]);

  // --- EMITIR TICKET ---
  const emitirTicket = async () => {
    if (!form.partidas.every(p => p.cc && p.clasif && p.desc)) {
      return alert("Por favor complete los campos obligatorios de las partidas.");
    }

    setLoading(true);
    try {
      const payload = {
        usuario_id: currentUser.id,
        gerente_nombre: currentUser.nombre,
        departamento: currentUser.departamento,
        fecha_emision: form.fecha,
        codigo_control: idControlAutomatico,
        total_usd: subtotalTotal,
        items: form.partidas.map(p => ({ ...p, pago_realizado: p.pago_realizado || false })),
        factura_url: form.factura_url,
        status: 'EMITIDO',
        solicitud_ref: form.solicitud_ref || null
      };

      const { error } = await supabase.from('tickets_directos').insert([payload]);
      if (error) throw error;

      alert("🎟️ Ticket EMITIDO con éxito.");
      setShowModal(false);
      cargarHistorial();
      // Reset form
      setForm({
        ...form,
        partidas: [{ id: Date.now(), cc: '', clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', pu: '', total: 0 }],
        factura_url: ''
      });
    } catch (err) {
      alert("Error al emitir ticket: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const actualizarTicket = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('tickets_directos')
        .update({
          items: form.partidas,
          total_usd: subtotalTotal,
          factura_url: form.factura_url
        })
        .eq('id', form.id);

      if (error) throw error;
      alert("✅ Cambios guardados con éxito.");
      cargarHistorial();
    } catch (err) {
      alert("Error al actualizar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerDetalle = (t) => {
    setIsEditing(true); // Usamos isEditing para modo "Ver/Solo Lectura"
    setForm({
      id: t.id,
      fecha: t.fecha_emision,
      gerente: t.gerente_nombre,
      departamento: t.departamento,
      usuario_id: t.usuario_id,
      partidas: t.items || [],
      factura_url: t.factura_url || '',
      id_control: t.codigo_control,
      solicitud_ref: t.solicitud_ref || ''
    });
    setShowModal(true);
  };

  // --- FILTRADO HISTORIAL ---
  const historialFiltrado = useMemo(() => {
    return historial.filter(t => 
      t.gerente_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      t.departamento?.toLowerCase().includes(busqueda.toLowerCase())
    );
  }, [historial, busqueda]);

  return (
    <div className="te-container animate-fade-in">
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 className="te-title">Ticket de Pago</h1>
          <p className="te-subtitle">Emisión de pagos directos sin aprobación - SmartTC</p>
        </div>
        <button className="te-btn te-btn-primary" onClick={() => { setIsEditing(false); setForm({ ...form, id_control: '', partidas: [{ id: Date.now(), cc: '', clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', pu: '', total: 0 }], factura_url: '' }); setShowModal(true); }}>
          <Plus size={18} /> Nueva Solicitud de Ticket
        </button>
      </div>

      {/* STATS CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="te-card te-card-premium">
          <div className="te-label">Mis Tickets Emitidos</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', marginTop: '8px' }}>{historial.length}</div>
        </div>
        <div className="te-card" style={{ borderLeft: '6px solid #10b981' }}>
          <div className="te-label">Total en Tickets ($)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', marginTop: '8px', color: '#10b981' }}>
            $ {historial.reduce((acc, t) => acc + (t.total_usd || 0), 0).toLocaleString('de-DE')}
          </div>
        </div>
        <div className="te-card" style={{ borderLeft: '6px solid #6366f1' }}>
          <div className="te-label">Usuario Activo</div>
          <div style={{ fontSize: '1rem', fontWeight: '700', marginTop: '8px' }}>{currentUser?.nombre}</div>
          <div className="te-badge te-badge-warn" style={{ marginTop: '8px', display: 'inline-block' }}>{currentUser?.rol}</div>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="te-card" style={{ padding: '16px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input 
            className="te-input" 
            placeholder="Buscar por gerente o departamento..." 
            style={{ width: '100%', paddingLeft: '40px' }}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        {currentUser?.esAdminGlobal && (
          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              className={`te-btn ${verTodos ? 'te-btn-primary' : 'te-btn-outline'}`} 
              onClick={() => setVerTodos(!verTodos)}
              style={{ fontSize: '0.75rem' }}
            >
              <Filter size={14} /> {verTodos ? 'Viendo Todos los Tickets' : 'Ver Todos los Tickets (Admin)'}
            </button>
          </div>
        )}
      </div>

      {/* HISTORY TABLE */}
      <div className="te-table-wrapper">
        <table className="te-table">
          <thead className="te-thead">
            <tr>
              <th className="te-th">ID</th>
              <th className="te-th">FECHA</th>
              <th className="te-th">GERENTE</th>
              <th className="te-th">DEPARTAMENTO</th>
              <th className="te-th">TOTAL ($)</th>
              <th className="te-th">STATUS</th>
              <th className="te-th" style={{ textAlign: 'center' }}>FACTURA</th>
              <th className="te-th" style={{ textAlign: 'center' }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody className="te-tbody">
            {loading ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="animate-spin" size={24} /> Cargando...</td></tr>
            ) : historialFiltrado.map(t => (
              <tr key={t.id}>
                <td className="te-td" style={{ fontWeight: '700', color: '#d97706' }}>{t.codigo_control || `TX-${String(t.id).padStart(4, '0')}`}</td>
                <td className="te-td">{new Date(t.fecha_emision).toLocaleDateString()}</td>
                <td className="te-td">{t.gerente_nombre}</td>
                <td className="te-td">{t.departamento}</td>
                <td className="te-td" style={{ fontWeight: 'bold' }}>$ {t.total_usd?.toLocaleString('de-DE')}</td>
                <td className="te-td">
                  <span className="te-badge te-badge-success">{t.status}</span>
                </td>
                <td className="te-td" style={{ textAlign: 'center' }}>
                  {t.factura_url && (
                    <a href={t.factura_url} target="_blank" rel="noopener noreferrer" style={{ color: '#d97706' }}>
                      <FileImage size={18} />
                    </a>
                  )}
                </td>
                <td className="te-td" style={{ textAlign: 'center' }}>
                  <button className="te-btn te-btn-outline" style={{ padding: '6px' }} onClick={() => handleVerDetalle(t)} title="Ver Detalle">
                    <Eye size={16} color="#d97706" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL EMISIÓN TICKET */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="te-card animate-fade-in" style={{ width: '95%', maxWidth: '1400px', maxHeight: '90vh', overflowY: 'auto', background: 'white' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <h2 className="te-title">{isEditing ? 'Detalle de Ticket' : 'Nuevos Tickets de Pago'}</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ background: '#0f172a', color: 'white', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', display: 'inline-block', marginTop: '8px', fontWeight: 'bold' }}>ID: {isEditing ? form.id_control : idControlAutomatico}</div>
                  {form.solicitud_ref && (
                    <div style={{ background: '#f59e0b', color: 'white', padding: '4px 12px', borderRadius: '6px', fontSize: '11px', display: 'inline-block', marginTop: '8px', fontWeight: 'bold' }}>REF: {form.solicitud_ref}</div>
                  )}
                </div>
              </div>
              <button className="te-btn te-btn-outline" onClick={() => setShowModal(false)}><ArrowLeft size={16} /> Volver</button>
            </div>

            {/* HEADER FORM */}
            <div className="te-header-grid">
              <div className="te-input-group">
                <label className="te-label">Fecha Emisión</label>
                <input className="te-input" type="date" value={form.fecha} onChange={(e) => setForm({...form, fecha: e.target.value})} />
              </div>
              <div className="te-input-group">
                <label className="te-label">Gerente Responsable</label>
                <input className="te-input" value={form.gerente} readOnly />
              </div>
              <div className="te-input-group">
                <label className="te-label">Departamento</label>
                <input className="te-input" value={form.departamento} readOnly />
              </div>
            </div>

            {/* ITEMS TABLE */}
            <div className="te-table-wrapper" style={{ marginBottom: '24px' }}>
              <table className="te-table">
                <thead className="te-thead">
                  <tr>
                    <th className="te-th">N°</th>
                    <th className="te-th" style={{ width: '200px' }}>C. COSTO</th>
                    <th className="te-th" style={{ width: '200px' }}>CLASIFICACIÓN</th>
                    <th className="te-th" style={{ width: '200px' }}>CATEGORÍA</th>
                    <th className="te-th" style={{ width: '80px' }}>CANT</th>
                    <th className="te-th" style={{ width: '100px' }}>UNID</th>
                    <th className="te-th">DESCRIPCIÓN</th>
                     <th className="te-th" style={{ width: '150px' }}>BENEFICIARIO</th>
                    <th className="te-th" style={{ width: '100px' }}>P.U ($)</th>
                    <th className="te-th" style={{ width: '100px' }}>TOTAL ($)</th>
                    <th className="te-th" style={{ width: '60px', textAlign: 'center' }}>PAGO</th>
                    <th className="te-th"></th>
                  </tr>
                </thead>
                <tbody className="te-tbody">
                  {form.partidas.map((p, i) => (
                    <tr key={p.id}>
                      <td className="te-td" style={{ fontWeight: '800', color: '#94a3b8', textAlign: 'center' }}>{i + 1}</td>
                      <td className="te-td">
                        <select className="te-cell-input" style={{fontWeight:'700'}} value={p.cc} onChange={(e) => manejarCambioPartida(i, 'cc', e.target.value)} disabled={isEditing}>
                          <option value="">C.C...</option>
                          {centrosCosto.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="te-td">
                        <select className="te-cell-input" value={p.clasif} onChange={(e) => manejarCambioPartida(i, 'clasif', e.target.value)} disabled={!p.cc || isEditing}>
                          <option value="">Clasificación...</option>
                          {todasClasificaciones.filter(c => c.padre === p.cc).map(c => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
                        </select>
                      </td>
                      <td className="te-td">
                        <select className="te-cell-input" value={p.cat} onChange={(e) => manejarCambioPartida(i, 'cat', e.target.value)} disabled={!p.clasif || isEditing}>
                          <option value="">Categoría...</option>
                          {todasCategorias.filter(c => c.padre === p.clasif).map(c => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
                        </select>
                      </td>
                      <td className="te-td"><input className="te-cell-input" type="number" value={p.cant} onChange={(e) => manejarCambioPartida(i, 'cant', e.target.value)} style={{ textAlign: 'center' }} disabled={isEditing} /></td>
                      <td className="te-td">
                        <select className="te-cell-input" value={p.uni} onChange={(e) => manejarCambioPartida(i, 'uni', e.target.value)} disabled={isEditing}>
                          {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="te-td"><input className="te-cell-input" value={p.desc} onChange={(e) => manejarCambioPartida(i, 'desc', e.target.value)} placeholder="¿En qué se gastará?" disabled={isEditing} /></td>
                      <td className="te-td"><input className="te-cell-input" value={p.ben} onChange={(e) => manejarCambioPartida(i, 'ben', e.target.value)} placeholder="Beneficiario" disabled={isEditing} /></td>
                      <td className="te-td"><input className="te-cell-input" type="number" value={p.pu} onChange={(e) => manejarCambioPartida(i, 'pu', e.target.value)} style={{ textAlign: 'right', fontWeight: 'bold', color: isEditing ? '#2563eb' : 'inherit' }} placeholder="0.00" /></td>
                      <td className="te-td" style={{ textAlign: 'right', fontWeight: '800', color: '#b45309' }}>$ {p.total.toLocaleString('de-DE')}</td>
                      <td className="te-td" style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={p.pago_realizado || false} onChange={(e) => manejarCambioPago(i, e.target.checked)} style={{ cursor: 'pointer', transform: 'scale(1.3)' }} />
                      </td>
                      <td className="te-td">
                        {!isEditing && <button onClick={() => eliminarRenglón(p.id)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!isEditing && (
                <div style={{ padding: '12px', background: '#f8fafc', borderTop: '1px solid #e2e880' }}>
                  <button className="te-btn te-btn-outline" onClick={añadirRenglón} style={{ fontSize: '0.75rem' }}><Plus size={14} /> Añadir otro renglón</button>
                </div>
              )}
            </div>

            {/* FOOTER ACTIONS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <label className="te-btn te-btn-outline" style={{ cursor: 'pointer' }}>
                  <Upload size={16} /> {form.factura_url ? 'Cambiar Factura' : 'Adjuntar Factura'}
                  <input type="file" hidden accept="image/*,application/pdf" onChange={manejarSubidaFactura} />
                </label>
                {form.factura_url && (
                  <a href={form.factura_url} target="_blank" rel="noopener noreferrer" className="te-btn te-btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', borderColor: '#10b981' }}>
                    <FileImage size={16} /> Ver Factura
                  </a>
                )}
              </div>

              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                  <div className="te-label" style={{ fontSize: '0.6rem' }}>Total General del Ticket</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#0f172a' }}>$ {subtotalTotal.toLocaleString('de-DE')}</div>
                </div>
                {!isEditing ? (
                  <button className="te-btn te-btn-primary" style={{ padding: '16px 32px' }} onClick={emitirTicket} disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />} Emitir Ticket Directo
                  </button>
                ) : (
                  <button className="te-btn" style={{ padding: '16px 32px', background: '#0f172a', color: 'white' }} onClick={actualizarTicket} disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />} Guardar Cambios
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default TicketExpress;
