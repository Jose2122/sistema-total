import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  Clock, MessageSquare, Eye, X, Search, FileText, CheckCircle2,
  AlertCircle, Calendar, User, Building, Landmark, Edit, Save, ListTodo, Shield
} from 'lucide-react';
import './Requisiciones.css';

const ControlPrecios = ({ currentUser }) => {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroDepto, setFiltroDepto] = useState('Todos');
  const [filtroCC, setFiltroCC] = useState('Todos');
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [requisicionSeleccionada, setRequisicionSeleccionada] = useState(null);
  const [verModalDetalle, setVerModalDetalle] = useState(false);
  
  // Estados para edición de observaciones
  const [observacionesEdit, setObservacionesEdit] = useState('');
  const [guardandoObs, setGuardandoObs] = useState(false);

  // Cargar centros de costo para el filtro
  const cargarCentrosCosto = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('maestros_centros_costo')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre');
      if (data) setCentrosCosto(data);
    } catch (err) {
      console.error("Error cargando centros de costo:", err);
    }
  }, []);

  // Cargar requisiciones que requieren control de precios
  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      // Filtros Estrictos de Carga (Backend): Aprobado final y no completado
      const { data, error } = await supabase
        .from('requisiciones')
        .select('*')
        .eq('estado_aprobacion', 'aprobado_final')
        .neq('status_compra', 'Completado')
        .order('fecha_emision', { ascending: false });

      if (error) throw error;

      if (data) {
        // Filtrado por justificaciones activas (tanto en la cabecera como en el historial de compras de los ítems)
        const filteredData = data.filter(db => {
          // 1. Verificar justificación general de la cabecera
          const mainJust = (db.justificacion || '').toLowerCase();
          const matchMain = mainJust.includes('precio') || mainJust.includes('presupuest') || mainJust.includes('disponibilidad');
          
          if (matchMain) return true;
          
          // 2. Verificar justificaciones de retraso en los ítems
          const matchItems = (db.items || []).some(item => {
            return (item.historial_compras || []).some(h => {
              if (h.tipo === 'JUSTIFICACION') {
                const motivo = (h.motivo || '').toLowerCase();
                return motivo.includes('precio') || 
                       motivo.includes('presupuest') || 
                       motivo.includes('disponibilidad');
              }
              return false;
            });
          });
          
          return matchItems;
        });

        const mapped = filteredData.map(db => ({
          id: db.id,
          correlativo: db.correlativo_req || `REQ-${String(db.id).padStart(3, '0')}`,
          solicitante: db.solicitante,
          centroCosto: db.centro_costo,
          status: db.status_compra || 'Pendiente',
          prioridad: db.prioridad || 'Normal',
          total: Number(db.total_bs) || 0,
          detalles: db.items || [],
          fecha: db.fecha_emision ? db.fecha_emision.split('T')[0] : '',
          justificacion: db.justificacion,
          gerencia: db.gerencia,
          estado_aprobacion: db.estado_aprobacion,
          observaciones: db.observaciones || '',
          observaciones_direccion: db.observaciones_direccion || '',
          fecha_emision: db.fecha_emision,
          fecha_limite_compra: db.fecha_limite_compra,
          is_pausada: db.is_pausada || false,
          paused_at: db.paused_at,
          resumed_at: db.resumed_at,
          con_iva: db.con_iva !== false
        }));
        setHistorial(mapped);
      }
    } catch (err) {
      toast.error("Error al cargar requisiciones: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarCentrosCosto();
    cargarDatos();

    // Suscripción Realtime para mantener consistencia
    const channel = supabase
      .channel('control_precios_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'requisiciones'
      }, () => {
        cargarDatos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cargarCentrosCosto, cargarDatos]);

  // Lista de departamentos para el filtro
  const listaGerencias = useMemo(() => {
    return [...new Set(historial.map(h => h.gerencia).filter(Boolean))].sort();
  }, [historial]);

  // Filtrado del historial en el cliente
  const historialFiltrado = useMemo(() => {
    return historial.filter(req => {
      const cumpleBusqueda = 
        req.correlativo.toLowerCase().includes(busqueda.toLowerCase()) ||
        (req.solicitante || '').toLowerCase().includes(busqueda.toLowerCase());

      const cumpleDepto = filtroDepto === 'Todos' || req.gerencia === filtroDepto;
      const cumpleCC = filtroCC === 'Todos' || req.centroCosto === filtroCC;

      return cumpleBusqueda && cumpleDepto && cumpleCC;
    });
  }, [historial, busqueda, filtroDepto, filtroCC]);

  // Monto total de todas las requisiciones en la lista
  const montoTotalEvaluar = useMemo(() => {
    return historial.reduce((sum, h) => sum + (h.total || 0), 0);
  }, [historial]);

  // Abrir modal de detalles y observaciones
  const abrirDetalles = (req) => {
    setRequisicionSeleccionada(req);
    setObservacionesEdit(req.observaciones_direccion || '');
    setVerModalDetalle(true);
  };

  // Guardar observaciones y pausar el SLA
  const guardarObservaciones = async () => {
    if (!requisicionSeleccionada) return;
    setGuardandoObs(true);
    try {
      const now = new Date().toISOString();
      const directorNombre = `${currentUser?.nombre} ${currentUser?.apellido}`.trim() || 'Director';

      // Preparar el evento de directriz para inyectarlo en cada ítem
      const nuevaDirectriz = {
        fecha: now,
        tipo: 'DIRECTRIZ',
        motivo: 'Directriz de Dirección',
        comentario: observacionesEdit,
        usuario_id: currentUser?.id,
        usuario_nombre: directorNombre
      };

      const itemsActualizados = (requisicionSeleccionada.detalles || []).map(item => {
        const historialActual = item.historial_compras || [];
        return {
          ...item,
          historial_compras: [...historialActual, nuevaDirectriz]
        };
      });
      
      // 1. Actualizar el registro en la base de datos (guardando en observaciones_direccion y actualizando los items)
      const { error } = await supabase
        .from('requisiciones')
        .update({
          observaciones_direccion: observacionesEdit,
          items: itemsActualizados
        })
        .eq('id', requisicionSeleccionada.id);

      if (error) throw error;

      // 2. Registrar en log de auditoría
      await supabase.from('requisicion_logs').insert({
        requisicion_id: requisicionSeleccionada.id,
        usuario_id: currentUser?.id,
        usuario_nombre: directorNombre,
        accion: 'DIRECTRIZ',
        comentario: `Directriz guardada por Dirección. Directriz: "${observacionesEdit}"`
      });

      toast.success("Directriz guardada correctamente.");
      setVerModalDetalle(false);
      setRequisicionSeleccionada(null);
      cargarDatos();
    } catch (err) {
      toast.error("Error al guardar directriz: " + err.message);
    } finally {
      setGuardandoObs(false);
    }
  };

  const formatName = (name) => {
    if (!name) return 'N/A';
    return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '15px' }}>
      
      {/* Encabezado del Módulo */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        padding: '20px 25px',
        borderRadius: '16px',
        color: 'white',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            💰 Control de Precios
          </h2>
          <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
            Gestión y anotación de requisiciones pendientes por aprobación de precios y disponibilidad.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', backgroundColor: 'rgba(56, 189, 248, 0.1)', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
          <Shield size={14} color="#38bdf8" />
          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#38bdf8' }}>Modulo Informativo y de Anotación</span>
        </div>
      </div>

      {/* Tarjetas de Métricas Rápidas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '15px'
      }}>
        <div className="stat-card" style={{ display: 'flex', gap: '15px', alignItems: 'center', backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div style={{ width: '45px', height: '45px', backgroundColor: '#e0f2fe', color: '#0284c7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyC: 'center', justifyContent: 'center' }}>
            <FileText size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Por Evaluar</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#1e293b' }}>{historial.length}</div>
          </div>
        </div>

        <div className="stat-card" style={{ display: 'flex', gap: '15px', alignItems: 'center', backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div style={{ width: '45px', height: '45px', backgroundColor: '#fffbeb', color: '#d97706', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyC: 'center', justifyContent: 'center' }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>SLA Pausados</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#1e293b' }}>{historial.filter(h => h.is_pausada).length}</div>
          </div>
        </div>

        <div className="stat-card" style={{ display: 'flex', gap: '15px', alignItems: 'center', backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div style={{ width: '45px', height: '45px', backgroundColor: '#faf5ff', color: '#7c3aed', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyC: 'center', justifyContent: 'center' }}>
            <Landmark size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Monto Total Pendiente</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#7c3aed' }}>
              $ {montoTotalEvaluar.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* --- SECCIÓN DE FILTROS --- */}
      <div className="table-container" style={{ padding: '15px' }}>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          
          <div style={{ flex: '2 1 300px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔍</span>
            <input
              className="input-tc"
              style={{ width: '100%', paddingLeft: '35px', margin: 0, backgroundColor: 'white', boxSizing: 'border-box' }}
              placeholder="Buscar por solicitante o N° REQ..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <select
            className="input-tc"
            style={{ flex: '1 1 150px', margin: 0, backgroundColor: 'white' }}
            value={filtroDepto}
            onChange={(e) => setFiltroDepto(e.target.value)}
          >
            <option value="Todos">Todas las Gerencias</option>
            {listaGerencias.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          <select
            className="input-tc"
            style={{ flex: '1 1 150px', margin: 0, backgroundColor: 'white' }}
            value={filtroCC}
            onChange={(e) => setFiltroCC(e.target.value)}
          >
            <option value="Todos">C. Costo (Todos)</option>
            {centrosCosto.map(cc => <option key={cc.id} value={cc.nombre}>{cc.nombre}</option>)}
          </select>

        </div>
      </div>

      {/* --- TABLA DE REGISTROS --- */}
      <div className="table-container" style={{ overflowX: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '50px', alignItems: 'center', gap: '10px', color: '#64748b' }}>
            <div style={{ width: '20px', height: '20px', border: '2px solid #e2e8f0', borderTopColor: '#0ea5e9', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            Cargando requisiciones...
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : historialFiltrado.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
            <AlertCircle size={36} style={{ marginBottom: '10px', color: '#cbd5e1' }} />
            <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>No hay requisiciones pendientes por control de precios</div>
            <div style={{ fontSize: '0.75rem', marginTop: '5px' }}>Las requisiciones que requieran precios aparecerán aquí automáticamente.</div>
          </div>
        ) : (
          <table className="tc-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '130px', padding: '15px' }}>ID / FECHA</th>
                <th style={{ width: '220px' }}>SOLICITANTE / GERENCIA</th>
                <th style={{ textAlign: 'center', width: '130px' }}>ESTATUS APROBACIÓN</th>
                <th style={{ width: '320px' }}>JUSTIFICACIÓN / CATEGORÍA</th>
                <th style={{ width: '180px' }}>CENTRO DE COSTO</th>
                <th style={{ width: '110px' }}>TOTAL ($)</th>
                <th style={{ textAlign: 'center', width: '180px' }}>TIEMPO SLA</th>
                <th style={{ width: '220px' }}>OBSERVACIONES</th>
                <th style={{ textAlign: 'center', width: '90px' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {historialFiltrado.map(req => (
                <tr key={req.id}>
                  {/* ID / FECHA */}
                  <td style={{ padding: '15px', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: req.prioridad === 'Emergencia' ? '#ef4444' : '#0ea5e9' }} />
                        <span style={{ fontSize: '12px', fontWeight: '900', color: '#1e40af', textDecoration: 'underline', cursor: 'pointer' }} onClick={() => abrirDetalles(req)}>
                          {req.correlativo}
                        </span>
                      </div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '14px', fontWeight: '500' }}>
                        {req.fecha ? format(new Date(req.fecha + 'T12:00:00'), 'dd/MM/yyyy') : 'N/A'}
                      </div>
                    </div>
                  </td>

                  {/* SOLICITANTE */}
                  <td style={{ verticalAlign: 'middle' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#2d2d2d', lineHeight: '1.2' }}>{formatName(req.solicitante)}</div>
                    <div style={{ fontSize: '11px', fontWeight: '400', color: '#757575', marginTop: '1px', lineHeight: '1.2' }}>{req.gerencia}</div>
                  </td>

                  {/* ESTATUS APROBACION */}
                  <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    <span style={{ fontSize: '10px', fontWeight: '700', backgroundColor: '#ecfdf5', color: '#065f46', padding: '4px 10px', borderRadius: '6px' }}>
                      APROBADA
                    </span>
                  </td>

                  {/* JUSTIFICACION / CATEGORIA */}
                  <td style={{ verticalAlign: 'middle' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#2d2d2d', textTransform: 'uppercase', maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={req.justificacion}>
                      {req.justificacion || 'SIN JUSTIFICACIÓN'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#757575', marginTop: '2px' }}>
                      {req.detalles?.[0]?.categoria || 'N/A'} {req.detalles?.length > 1 && `(+${req.detalles.length - 1} más)`}
                    </div>
                  </td>

                  {/* CENTRO COSTO */}
                  <td style={{ fontSize: '12px', color: '#2d2d2d', verticalAlign: 'middle' }}>
                    {req.centroCosto}
                  </td>

                  {/* TOTAL */}
                  <td style={{ verticalAlign: 'middle' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#2d2d2d' }}>
                      $ {req.total?.toLocaleString('de-DE')}
                    </span>
                  </td>

                  {/* SLA */}
                  <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    {(() => {
                      if (req.is_pausada) {
                        return (
                          <div style={{
                            fontSize: '0.65rem',
                            fontWeight: '800',
                            backgroundColor: '#fef3c7',
                            color: '#d97706',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid #fde68a',
                            display: 'inline-block',
                            whiteSpace: 'nowrap'
                          }}>
                            ⏸️ SLA Pausado - Espera de Precios
                          </div>
                        );
                      }

                      let deadline = req.fecha_limite_compra;
                      if (!deadline && req.fecha_emision) {
                        const base = new Date(req.fecha_emision);
                        const dias = req.prioridad === 'Emergencia' ? 2 : 5;
                        deadline = new Date(base.getTime() + (dias * 24 * 60 * 60 * 1000)).toISOString();
                      }

                      if (deadline) {
                        const limite = new Date(deadline);
                        const hoy = new Date();
                        const diff = limite.getTime() - hoy.getTime();
                        const horasTotales = Math.floor(diff / (1000 * 60 * 60));
                        const color = horasTotales < 0 ? '#ef4444' : (horasTotales < 24 ? '#f59e0b' : '#16a34a');
                        const d = Math.floor(horasTotales / 24);
                        const h = horasTotales % 24;
                        const label = horasTotales < 0 ? 'VENCIDO' : (d > 0 ? `${d}d ${h}h` : `${h}h`);

                        return (
                          <div style={{ fontSize: '0.75rem', fontWeight: '800', backgroundColor: `${color}15`, color: color, padding: '4px 8px', borderRadius: '6px', display: 'inline-block' }}>
                            {label}
                          </div>
                        );
                      }
                      return <span style={{ color: '#94a3b8', fontSize: '11px' }}>-</span>;
                    })()}
                  </td>

                  {/* OBSERVACIONES */}
                  <td style={{ verticalAlign: 'middle', fontSize: '11px', color: '#4b5563', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={req.observaciones_direccion || req.observaciones}>
                    {req.observaciones_direccion ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <MessageSquare size={12} style={{ color: '#7c3aed', flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 'bold', color: '#7c3aed' }}>
                          [Dir] {req.observaciones_direccion}
                        </span>
                      </div>
                    ) : req.observaciones ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <MessageSquare size={12} style={{ color: '#8b5cf6', flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.observaciones}</span>
                      </div>
                    ) : (
                      <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>Sin observaciones</span>
                    )}
                  </td>

                  {/* ACCIONES */}
                  <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                      <button
                        title="Ver y Comentar"
                        onClick={() => abrirDetalles(req)}
                        style={{
                          border: '1px solid #cbd5e1',
                          background: 'white',
                          cursor: 'pointer',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          color: '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.7rem',
                          fontWeight: '600',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                      >
                        <MessageSquare size={13} />
                        <span>Comentar</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* --- MODAL DETALLE Y OBSERVACIONES --- */}
      {verModalDetalle && requisicionSeleccionada && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px'
        }}>
          <div className="animate-fade" style={{
            backgroundColor: 'white',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 25px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px'
            }}>
              <div>
                <span style={{ fontSize: '0.65rem', fontWeight: '800', backgroundColor: '#dbeafe', color: '#1e40af', padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                  {requisicionSeleccionada.prioridad}
                </span>
                <h3 style={{ margin: '5px 0 0 0', fontSize: '1.2rem', fontWeight: '800', color: '#1e293b' }}>
                  Detalles de la Requisición: {requisicionSeleccionada.correlativo}
                </h3>
              </div>
              <button
                onClick={() => { setVerModalDetalle(false); setRequisicionSeleccionada(null); }}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', transition: 'color 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Metadatos en Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <User size={16} color="#64748b" />
                  <div>
                    <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>Solicitante</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#1e293b' }}>{formatName(requisicionSeleccionada.solicitante)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Building size={16} color="#64748b" />
                  <div>
                    <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>Gerencia</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#1e293b' }}>{requisicionSeleccionada.gerencia}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Landmark size={16} color="#64748b" />
                  <div>
                    <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>C. Costo</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#1e293b' }}>{requisicionSeleccionada.centroCosto}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Calendar size={16} color="#64748b" />
                  <div>
                    <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>Emisión</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#1e293b' }}>
                      {requisicionSeleccionada.fecha ? format(new Date(requisicionSeleccionada.fecha + 'T12:00:00'), 'dd/MM/yyyy') : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Justificacion */}
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Justificación de la Requisición</span>
                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', padding: '12px 15px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '600', lineHeight: '1.4' }}>
                  ⚠️ {requisicionSeleccionada.justificacion || 'Sin Justificación especificada.'}
                </div>
              </div>

              {/* Tabla de Items */}
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <ListTodo size={14} /> Artículos / Servicios Solicitados
                </span>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ textAlign: 'left', padding: '10px 12px', color: '#475569', fontWeight: '700' }}>Descripción del Artículo / Servicio</th>
                        <th style={{ width: '80px', textAlign: 'center', padding: '10px 12px', color: '#475569', fontWeight: '700' }}>Cant.</th>
                        <th style={{ width: '120px', textAlign: 'right', padding: '10px 12px', color: '#475569', fontWeight: '700' }}>P.U. Estimado</th>
                        <th style={{ width: '130px', textAlign: 'right', padding: '10px 12px', color: '#475569', fontWeight: '700' }}>Total Estimado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requisicionSeleccionada.detalles?.map((item, idx) => {
                        const cant = Number(item.cantidad_pedida ?? item.cant ?? 0);
                        const pu = Number(item.pu_estimado ?? item.pu ?? 0);
                        const total = cant * pu;

                        return (
                          <tr key={idx} style={{ borderBottom: idx < requisicionSeleccionada.detalles.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                            <td style={{ padding: '10px 12px', color: '#1e293b', fontWeight: '600' }}>{item.descripcion}</td>
                            <td style={{ textAlign: 'center', padding: '10px 12px', color: '#4b5563' }}>{cant}</td>
                            <td style={{ textAlign: 'right', padding: '10px 12px', color: '#4b5563', fontFamily: 'monospace' }}>$ {pu.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                            <td style={{ textAlign: 'right', padding: '10px 12px', color: '#1e293b', fontWeight: '700', fontFamily: 'monospace' }}>$ {total.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #e2e8f0', fontWeight: '800' }}>
                        <td colSpan="3" style={{ textAlign: 'right', padding: '10px 12px', color: '#475569' }}>
                          Monto Requisición {requisicionSeleccionada.con_iva ? '(Con IVA 16%)' : '(Sin IVA)'}:
                        </td>
                        <td style={{ textAlign: 'right', padding: '10px 12px', color: '#1e293b', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                          $ {requisicionSeleccionada.total?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Observaciones del Comprador (Solo lectura) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <MessageSquare size={13} style={{ color: '#8b5cf6' }} /> Observaciones del Comprador (Historial Usuario-Comprador)
                </span>
                <div style={{
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  color: '#475569',
                  padding: '12px 15px',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  lineHeight: '1.4',
                  whiteSpace: 'pre-wrap',
                  minHeight: '40px'
                }}>
                  {requisicionSeleccionada.observaciones || 'Sin observaciones previas del comprador.'}
                </div>
              </div>

              {/* Area de Observaciones Dirección */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Edit size={13} style={{ color: '#7c3aed' }} /> Directrices de la Dirección
                </label>
                <textarea
                  style={{
                    width: '100%',
                    height: '110px',
                    padding: '12px 15px',
                    borderRadius: '12px',
                    border: '1.5px solid #cbd5e1',
                    outline: 'none',
                    fontSize: '0.85rem',
                    color: '#1e293b',
                    fontFamily: 'inherit',
                    lineHeight: '1.5',
                    resize: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                  onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                  placeholder="Escribe aquí las directrices para la compra de estos ítems..."
                  value={observacionesEdit}
                  onChange={(e) => setObservacionesEdit(e.target.value)}
                />
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                  * Al guardar la directriz, se agregará un comentario de la dirección y se registrará en el historial de trazabilidad de todos los ítems.
                </span>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '15px 25px',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              background: '#f8fafc',
              borderBottomLeftRadius: '24px',
              borderBottomRightRadius: '24px'
            }}>
              <button
                onClick={() => { setVerModalDetalle(false); setRequisicionSeleccionada(null); }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'white',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  color: '#475569',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
              >
                Cancelar
              </button>
              <button
                onClick={guardarObservaciones}
                disabled={guardandoObs}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#0f172a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: guardandoObs ? 0.7 : 1,
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => { if(!guardandoObs) e.currentTarget.style.backgroundColor = '#1e293b'; }}
                onMouseLeave={(e) => { if(!guardandoObs) e.currentTarget.style.backgroundColor = '#0f172a'; }}
              >
                {guardandoObs ? (
                  <>
                    <div style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    <span>Guardar Directriz</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ControlPrecios;
