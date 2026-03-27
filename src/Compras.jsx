import React, { useState, useEffect, useCallback, useMemo } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from './supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Upload, FileText } from 'lucide-react';
import './Requisiciones.css';

const Compras = () => {
  const [historial, setHistorial] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  // --- FILTROS ---
  const [busqueda, setBusqueda] = useState('');
  const [filtroGerencia, setFiltroGerencia] = useState('Todos');

  // --- ESTADOS DEL FORMULARIO (PARA PROCESAMIENTO) ---
  const [requisicionActiva, setRequisicionActiva] = useState(null);
  const [renglones, setRenglones] = useState([]);
  const [facturasUrls, setFacturasUrls] = useState([]);

  const obtenerSesionUsuario = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email) {
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('*')
        .eq('correo', session.user.email)
        .single();

      setCurrentUser(perfil);
    }
  }, []);

  const cargarRequisicionesAprobadas = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('requisiciones')
        .select('*')
        .eq('estado_aprobacion', 'aprobado_final')
        .order('fecha_emision', { ascending: false });

      if (error) throw error;
      setHistorial(data.map(db => ({
        ...db,
        correlativo: db.correlativo_req,
        total: db.total_bs,
        detalles: db.items,
        fecha: db.fecha_emision ? db.fecha_emision.split('T')[0] : ''
      })));
    } catch (err) {
      console.error("Error cargando compras:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { obtenerSesionUsuario(); }, [obtenerSesionUsuario]);
  useEffect(() => { cargarRequisicionesAprobadas(); }, [cargarRequisicionesAprobadas]);

  const historialFiltrado = useMemo(() => {
    return historial.filter(req => {
      const matchTexto =
        req.solicitante.toLowerCase().includes(busqueda.toLowerCase()) ||
        req.correlativo.toLowerCase().includes(busqueda.toLowerCase());
      const matchGerencia = filtroGerencia === 'Todos' || req.gerencia === filtroGerencia;
      return matchTexto && matchGerencia;
    });
  }, [historial, busqueda, filtroGerencia]);

  const abrirProcesamiento = (req) => {
    setRequisicionActiva(req);
    setEditandoId(req.id);
    setRenglones(req.detalles || []);
    setFacturasUrls(req.facturas_url || []);
    setShowModal(true);
  };

  const liberarPartidasFondos = async (requisicionId) => {
    try {
      const { error } = await supabase
        .from('partidas_fondos')
        .update({ status: 'Disponible', requisicion_id: null })
        .eq('requisicion_id', requisicionId);
      if (error) throw error;
    } catch (err) {
      console.error("Error al liberar partidas:", err.message);
    }
  };

  const anularRequisicion = async (id) => {
    if (!window.confirm('¿Estás seguro de ANULAR esta requisición? Los renglones asociados en Fondos quedarán disponibles nuevamente.')) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('requisiciones')
        .update({ estado_aprobacion: 'ANULADA', aprobacion_nombre: 'REQ. ANULADA' })
        .eq('id', id);
      if (error) throw error;

      await liberarPartidasFondos(id);
      
      setHistorial(prev => prev.filter(req => req.id !== id));
      alert('Requisición ANULADA correctamente.');
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const actualizarFila = (id, campo, valor) => {
    setRenglones(prev => prev.map(f => {
      if (f.id === id) {
        let v = valor;
        if (campo === 'pu') v = Math.max(0, Number(valor) || 0);
        const act = { ...f, [campo]: v };
        act.total = act.cant * (act.pu || 0);
        return act;
      }
      return f;
    }));
  };

  const subirFactura = async (event) => {
    try {
      setUploading(true);
      const file = event.target.files[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `factura_${editandoId}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('facturas')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('facturas').getPublicUrl(fileName);
      const nuevaUrl = data.publicUrl;

      const nuevasUrls = [...facturasUrls, nuevaUrl];
      setFacturasUrls(nuevasUrls);

      // Actualizar inmediatamente en la BD
      await supabase
        .from('requisiciones')
        .update({ facturas_url: nuevasUrls })
        .eq('id', editandoId);

      alert("Factura cargada correctamente.");
    } catch (error) {
      alert("Error al subir factura: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const guardarCambiosProcesamiento = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const todosCompletos = renglones.every(r => r.status === 'Completado');
      const nuevoStatusCompra = todosCompletos ? 'Completado' : 'Parcial';

      const subTotal = renglones.reduce((acc, r) => acc + (Number(r.total) || 0), 0);
      const totalG = subTotal * 1.16;

      const { error } = await supabase
        .from('requisiciones')
        .update({
          items: renglones,
          total_bs: totalG,
          status_compra: nuevoStatusCompra
        })
        .eq('id', editandoId);

      if (error) throw error;

      alert(todosCompletos ? "Requisición Finalizada / Comprada." : "Cambios guardados con éxito.");
      await cargarRequisicionesAprobadas();
      setShowModal(false);
    } catch (err) {
      alert("Error guardando cambios: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const { subTotalCalculado, totalCalculado } = useMemo(() => {
    const s = renglones.reduce((acc, r) => acc + (Number(r.total) || 0), 0);
    return { subTotalCalculado: s, totalCalculado: s * 1.16 };
  }, [renglones]);

  const getInitials = (nombre, apellido) => {
    return `${nombre?.charAt(0) || ''}${apellido?.charAt(0) || ''}`.toUpperCase();
  };

  // --- RESTRICCIÓN DE ACCESO (VISTA) ---
  const esDeCompras = currentUser?.departamento === 'Compras' || currentUser?.departamento === 'Administración Maracaibo' || currentUser?.departamento === 'Administración El Tigre' || currentUser?.esAdminReal || currentUser?.rol === 'Gerente General';

  if (!esDeCompras && currentUser) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>No tiene permisos para acceder al módulo de Compras.</div>;
  }

  return (
    <motion.div
      className="animate-main"
      style={{ padding: '25px', backgroundColor: '#f1f5f9', minHeight: '100vh', boxSizing: 'border-box' }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="table-container" style={{ marginBottom: '15px', padding: '15px' }}>
        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', color: '#1e293b' }}>Procesamiento de Compras</h2>
        <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Gestión de requisiciones con aprobación de Gerencia General</p>

        <div style={{ marginTop: '15px', display: 'flex', gap: '15px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔍</span>
            <input
              className="input-tc"
              style={{ width: '100%', paddingLeft: '35px', margin: 0, backgroundColor: 'white', boxSizing: 'border-box' }}
              placeholder="Filtrar por solicitante o folio..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="tc-table">
          <thead>
            <tr>
              <th>ID REQ</th>
              <th>SOLICITANTE</th>
              <th>C. COSTOS</th>
              <th>GERENCIA</th>
              <th>PRIORIDAD</th>
              <th>TOTAL $</th>
              <th>STATUS</th>
              <th style={{ textAlign: 'center' }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {(loading && historial.length === 0) ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}><Loader2 className="animate-spin" /> Cargando...</td></tr>
            ) : historialFiltrado.map(req => (
              <tr key={req.id}>
                <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{req.correlativo}</td>
                <td>{req.solicitante}</td>
                <td>{req.centro_costo}</td>
                <td>{req.gerencia}</td>
                <td><span style={{ color: req.prioridad === 'Alta' ? '#ef4444' : '#0ea5e9', fontWeight: 'bold' }}>{req.prioridad}</span></td>
                <td style={{ fontWeight: 'bold' }}>Bs. {req.total?.toLocaleString('de-DE')}</td>
                <td>
                  <span style={{
                    backgroundColor: req.status_compra === 'Completado' ? '#dcfce7' : '#fef9c3',
                    color: req.status_compra === 'Completado' ? '#166534' : '#854d0e',
                    padding: '4px 10px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 'bold'
                  }}>
                    {req.status_compra || 'Pendiente'}
                  </span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button onClick={() => abrirProcesamiento(req)} className="btn-tc btn-tc-primary" style={{ padding: '8px 12px', fontSize: '0.65rem' }}>
                      PROCESAR
                    </button>
                    <button onClick={() => anularRequisicion(req.id)} className="btn-tc btn-tc-secondary" style={{ padding: '8px 10px', fontSize: '0.65rem', color: '#64748b' }} title="Anular">
                      🚫
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {historialFiltrado.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No hay requisiciones pendientes por comprar.</div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card animate-modal" style={{ maxWidth: '1150px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0 }}>Gestión de Compra: {requisicionActiva?.correlativo}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      backgroundColor: '#1e293b', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.85rem', fontWeight: 'bold'
                    }}>
                      {getInitials(currentUser?.nombre, currentUser?.apellido)}
                    </div>
                    <span style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1e293b' }}>
                      {requisicionActiva?.solicitante}
                    </span>
                  </div>
                  <div style={{
                    backgroundColor: '#334155', color: 'white',
                    padding: '6px 14px', borderRadius: '8px',
                    fontSize: '0.95rem', fontWeight: 'bold',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>CC:</span>
                    {requisicionActiva?.centro_costo}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>Estado Operativo</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '900', color: requisicionActiva?.status_compra === 'Completado' ? '#15803d' : '#854d0e' }}>
                  {requisicionActiva?.status_compra || 'PENDIENTE'}
                </div>
              </div>
            </div>

            <div className="req-header-line" style={{ margin: '20px 0 15px 0' }}></div>

            <div style={{
              backgroundColor: '#f1f5f9',
              padding: '12px 18px',
              borderRadius: '10px',
              borderLeft: '4px solid #94a3b8',
              marginBottom: '20px'
            }}>
              <label style={{
                fontSize: '0.65rem',
                fontWeight: '900',
                color: '#475569',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: '4px'
              }}>
                Justificación Operativa
              </label>
              <p style={{
                margin: 0,
                color: '#1e293b',
                fontSize: '0.95rem',
                fontWeight: '500',
                lineHeight: '1.4'
              }}>
                {requisicionActiva?.justificacion || 'Sin justificación registrada'}
              </p>
            </div>

            <table className="tc-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th>RENG.</th>
                  <th>DESCRIPCIÓN</th>
                  <th>CANT.</th>
                  <th>UNI.</th>
                  <th style={{ textAlign: 'right', width: '130px' }}>P.U. (EDITABLE)</th>
                  <th style={{ textAlign: 'right' }}>TOTAL $</th>
                  <th>STATUS ÍTEM</th>
                </tr>
              </thead>
              <tbody>
                {renglones.map((f, i) => (
                  <tr key={f.id}>
                    <td>{i + 1}</td>
                    <td style={{ fontSize: '0.75rem' }}>{f.descripcion}</td>
                    <td>{f.cant}</td>
                    <td>{f.uni}</td>
                    <td>
                      <input
                        className="input-tc"
                        type="number"
                        value={f.pu}
                        style={{ textAlign: 'right', fontWeight: 'bold' }}
                        onChange={(e) => actualizarFila(f.id, 'pu', e.target.value)}
                      />
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{f.total?.toLocaleString('de-DE')}</td>
                    <td>
                      <select
                        className="input-tc"
                        value={f.status}
                        onChange={(e) => actualizarFila(f.id, 'status', e.target.value)}
                        style={{
                          fontSize: '0.75rem', fontWeight: 'bold',
                          backgroundColor: f.status === 'Completado' ? '#f0fdf4' : f.status === 'Parcial' ? '#fffbeb' : 'white',
                          color: f.status === 'Completado' ? '#15803d' : f.status === 'Parcial' ? '#d97706' : '#64748b'
                        }}
                      >
                        <option value="En Espera">En Espera</option>
                        <option value="Parcial">Parcial</option>
                        <option value="Completado">Completado</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: '40px' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 15px 0', fontSize: '0.9rem', color: '#1e293b' }}>🧾 Soporte de Documentos</h4>
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
                  {facturasUrls.map((url, idx) => {
                    const isImg = /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(url.split('?')[0]);
                    return (
                      <div key={idx} style={{ position: 'relative', group: 'true' }}>
                        <a href={url} target="_blank" rel="noreferrer" style={{
                          display: 'block',
                          width: '80px', height: '80px',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          border: '2px solid #e2e8f0',
                          backgroundColor: 'white',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}>
                          {isImg ? (
                            <img src={url} alt={`Preview ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{
                              width: '100%', height: '100%',
                              display: 'flex', flexDirection: 'column',
                              alignItems: 'center', justifyContent: 'center',
                              backgroundColor: '#f8fafc', color: '#ef4444'
                            }}>
                              <FileText size={32} />
                              <span style={{ fontSize: '0.5rem', fontWeight: 'bold', marginTop: '4px', color: '#64748b' }}>PDF</span>
                            </div>
                          )}
                        </a>
                      </div>
                    );
                  })}
                </div>
                <label className="btn-tc btn-tc-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}>
                  {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                  <span>{uploading ? 'Subiendo...' : 'Adjuntar Documento'}</span>
                  <input type="file" hidden onChange={subirFactura} disabled={uploading} />
                </label>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div className="totals-container" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label">SUB-TOTAL:</span>
                    <span style={{ fontWeight: 'bold' }}>$ {subTotalCalculado.toLocaleString('de-DE')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #e2e8f0', paddingTop: '10px' }}>
                    <span style={{ fontWeight: '900', color: '#1e293b' }}>TOTAL FINAL:</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: '900', color: '#0ea5e9' }}>$ {totalCalculado.toLocaleString('de-DE')}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '25px' }}>
                  <button className="btn-tc btn-tc-secondary" onClick={() => setShowModal(false)} style={{ padding: '12px 25px' }}>Cancelar</button>
                  <button className="btn-tc btn-tc-primary" onClick={guardarCambiosProcesamiento} disabled={loading} style={{ padding: '12px 30px' }}>
                    {loading ? <Loader2 className="animate-spin" size={16} /> : 'Cerrar Ciclo Operativo'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default Compras;
