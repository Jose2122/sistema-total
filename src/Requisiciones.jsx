import React, { useState, useEffect, useCallback, useMemo } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from './supabaseClient'; 
import './Requisiciones.css';

const Requisiciones = ({ isOpen, onClose, datosPredefinidos }) => {
  // --- ESTADOS DEL SISTEMA ---
  const [showModal, setShowModal] = useState(false);
  const [historial, setHistorial] = useState([]); 
  const [editandoId, setEditandoId] = useState(null);
  const [loading, setLoading] = useState(false); 
  const [currentUser, setCurrentUser] = useState(null);

  // --- NUEVOS ESTADOS PARA FILTROS ---
  const [busqueda, setBusqueda] = useState('');
  const [filtroDepto, setFiltroDepto] = useState('Todos');
  const [filtroAprobacion, setFiltroAprobacion] = useState('Todos');

  // --- LÓGICA DE CARGA DE USUARIO ACTUAL ---
  const obtenerSesionUsuario = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email) {
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('*')
        .eq('correo', session.user.email)
        .single();
      
      const ADMIN_EMAIL = 'jcontreras.totalclean@gmail.com';
      setCurrentUser({ 
        ...perfil, 
        esAdminReal: session.user.email === ADMIN_EMAIL 
      });
    }
  }, []);
  
  // --- LÓGICA DE CARGA DESDE SUPABASE CON FILTROS DE JERARQUÍA ---
  const cargarHistorialDesdeBD = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      let query = supabase.from('requisiciones').select('*');

      // APLICACIÓN DE REGLAS DE JERARQUÍA
      if (!currentUser.esAdminReal && currentUser.rol !== 'Gerente General') {
        if (currentUser.rol === 'Gerente') {
          query = query.eq('gerencia', currentUser.departamento);
        } else {
          query = query.eq('solicitante', `${currentUser.nombre} ${currentUser.apellido}`);
        }
      }

      const { data, error } = await query.order('fecha_emision', { ascending: false });
      
      if (error) throw error;
      if (data) {
        const historialMapeado = data.map(db => ({
          id: db.id,
          correlativo: db.correlativo_req || `REQ-${String(db.id).padStart(3, '0')}`,
          origen: db.origen || 'Manual',
          solicitante: db.solicitante,
          centroCosto: db.centro_costo,
          aprobacion: db.aprobacion_nombre || (db.aprobacion ? 'Aprobado' : 'Pendiente'),
          status: db.status_compra || 'Pendiente',
          prioridad: db.prioridad,
          total: db.total_bs,
          detalles: db.items,
          fecha: db.fecha_emision ? db.fecha_emision.split('T')[0] : '',
          justificacion: db.justificacion,
          fecha_requerida: db.fecha_requerida,
          gerencia: db.gerencia,
          firma_gerente: db.firma_gerente,
          observaciones: db.observaciones || ''
        }));
        setHistorial(historialMapeado);
      }
    } catch (err) {
      console.error("Error cargando historial:", err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => { obtenerSesionUsuario(); }, [obtenerSesionUsuario]);
  useEffect(() => { cargarHistorialDesdeBD(); }, [cargarHistorialDesdeBD]);

  // --- LÓGICA DE FILTRADO EN TIEMPO REAL ---
  const historialFiltrado = useMemo(() => {
    return historial.filter(req => {
      const matchTexto = 
        req.solicitante.toLowerCase().includes(busqueda.toLowerCase()) || 
        req.correlativo.toLowerCase().includes(busqueda.toLowerCase());
      
      const matchDepto = filtroDepto === 'Todos' || req.gerencia === filtroDepto;
      const matchStatus = filtroAprobacion === 'Todos' || req.aprobacion === filtroAprobacion;

      return matchTexto && matchDepto && matchStatus;
    });
  }, [historial, busqueda, filtroDepto, filtroAprobacion]);

  // --- ESTADOS DEL FORMULARIO ---
  const [prioridad, setPrioridad] = useState('Normal');
  const [solicitante, setSolicitante] = useState('');
  const [centroCostoID, setCentroCostoID] = useState('1.00.2'); 
  const [centroCostoNombre, setCentroCostoNombre] = useState('MTTO MAYOR-BOSCAN');
  const [departamento, setDepartamento] = useState('Operaciones');
  const [justificacion, setJustificacion] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [fechaRequerida, setFechaRequerida] = useState(new Date().toISOString().split('T')[0]);
  const [renglones, setRenglones] = useState([
    { id: Date.now(), clasificacion: '', categoria: '', cant: 1, uni: 'UNID', descripcion: '', beneficiario: '', pu: 0, total: 0, status: 'En Espera' }
  ]);

  // --- LISTAS DE REFERENCIA ---
  const listaCentrosCostos = [
    { id: '1.00.2', nombre: 'MTTO MAYOR-BOSCAN' },
    { id: '1.00.8', nombre: 'MTTO MAYOR-BAJO GRANDE' },
    { id: '1.00.7', nombre: 'EXCELENCIA OPERACIONAL' },
    { id: '1.01.0', nombre: 'CAMIONES DE VACÍO-BOSCAN' },
    { id: '1.01.1', nombre: 'CAMIONES DE VACÍO-BAJO G.' },
    { id: '1.00.9', nombre: 'PROYECTOS MENORES' },
    { id: '2.00.1', nombre: 'SUCURSAL EL TIGRE' },
    { id: '1.00.1', nombre: 'OFICINA PRINCIPAL MCBO' },
    { id: '0', nombre: 'INVERSIONES Y OTROS' }
  ];

  const listaGerencias = [
    "Administración Maracaibo", "Administración El Tigre", "Operaciones", "Mantenimiento", 
    "Seguridad", "Recursos Humanos", "Estimación", "Almacén", "Gerencia General", 
    "Servicios Generales", "Contabilidad"
  ];

  const unidades = ["UNID", "KG", "LTS", "SERV", "SG", "BOLSAS", "BOTELLÓN", "VIAJES"];

  const calcularTotales = () => {
    const subTotal = renglones.reduce((acc, r) => acc + (Number(r.total) || 0), 0);
    const iva = subTotal * 0.16;
    const totalGeneral = subTotal + iva;
    return { subTotal, iva, totalGeneral };
  };

  const { subTotal, totalGeneral } = calcularTotales();

  const obtenerEstadoGlobal = () => {
    if (renglones.length === 0) return { texto: 'SIN ITEMS', color: '#94a3b8' };
    const todosCompletados = renglones.every(r => r.status === 'Completado');
    const algunoEnProceso = renglones.some(r => r.status === 'Parcial' || r.status === 'Completado');
    if (todosCompletados) return { texto: 'COMPLETADO', color: '#22c55e' };
    if (algunoEnProceso) return { texto: 'EN PROCESO', color: '#f59e0b' };
    return { texto: 'EN ESPERA', color: '#64748b' };
  };

  const estadoGlobal = obtenerEstadoGlobal();

  // --- EFECTOS DE SINCRONIZACIÓN ---
  useEffect(() => {
    if (isOpen) {
      if (datosPredefinidos) {
        setSolicitante(datosPredefinidos.responsable_gasto || datosPredefinidos.responsable || '');
        setDepartamento(datosPredefinidos.gerencia_solicitante || datosPredefinidos.gerencia || 'Operaciones');
        setJustificacion(datosPredefinidos.justificacion || '');
        setObservaciones(datosPredefinidos.observaciones || '');
        const encontrarCC = listaCentrosCostos.find(c => c.nombre.toUpperCase() === (datosPredefinidos.centro_costo || '').toUpperCase());
        if (encontrarCC) setCentroCostoID(encontrarCC.id);
        
        if (datosPredefinidos.partidasSeleccionadas) {
          const nuevosRenglones = datosPredefinidos.partidasSeleccionadas.map((p, idx) => ({
            id: Date.now() + idx,
            clasificacion: p.clasif || '',
            categoria: p.cat || '',
            cant: Number(p.cant) || 1,
            uni: p.uni || 'UNID',
            descripcion: p.desc || '',
            pu: Number(p.puUsd || p.puBs || 0),
            total: (Number(p.cant) || 1) * Number(p.puUsd || p.puBs || 0),
            status: 'En Espera'
          }));
          setRenglones(nuevosRenglones);
        }
      } else if (currentUser) {
        setSolicitante(`${currentUser.nombre} ${currentUser.apellido}`);
        setDepartamento(currentUser.departamento);
      }
      setShowModal(true); 
    }
  }, [isOpen, datosPredefinidos, currentUser]);

  useEffect(() => {
    const seleccionado = listaCentrosCostos.find(c => c.id === centroCostoID);
    if (seleccionado) setCentroCostoNombre(seleccionado.nombre);
  }, [centroCostoID]);

  // --- MANEJADORES DE ACCIÓN ---
  const actualizarFila = (id, campo, valor) => {
    setRenglones(prev => prev.map(f => {
      if (f.id === id) {
        let v = valor;
        if (campo === 'cant' || campo === 'pu') v = Math.max(0, Number(valor) || 0);
        const act = { ...f, [campo]: v };
        act.total = act.cant * act.pu;
        return act;
      }
      return f;
    }));
  };

  const manejarEliminar = async (id) => {
    if (!window.confirm("¿Eliminar esta requisición de forma permanente?")) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('requisiciones').delete().eq('id', id);
      if (error) throw error;
      alert("Eliminada correctamente.");
      await cargarHistorialDesdeBD();
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };
  
  const resetearFormulario = () => {
    if (currentUser) {
      setSolicitante(`${currentUser.nombre} ${currentUser.apellido}`);
      setDepartamento(currentUser.departamento);
    }
    setJustificacion('');
    setObservaciones('');
    setEditandoId(null);
    setFechaRequerida(new Date().toISOString().split('T')[0]);
    setRenglones([{ id: Date.now(), clasificacion: '', categoria: '', cant: 1, uni: 'UNID', descripcion: '', beneficiario: '', pu: 0, total: 0, status: 'En Espera' }]);
  };

  const verRequisicion = (req) => {
    setEditandoId(req.id);
    setSolicitante(req.solicitante);
    setJustificacion(req.justificacion);
    setObservaciones(req.observaciones || '');
    setPrioridad(req.prioridad);
    setFechaRequerida(req.fecha_requerida || req.fecha);
    setDepartamento(req.gerencia || 'Operaciones');
    setRenglones(req.detalles || []);
    const ccID = req.centroCosto.match(/\(([^)]+)\)/);
    if (ccID) setCentroCostoID(ccID[1]);
    setShowModal(true);
  };

  const manejarAprobar = async () => {
    if (!editandoId || currentUser?.rol !== 'Gerente General') {
      alert("Solo el Gerente General tiene permisos.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('requisiciones').update({ 
        aprobacion: true, 
        aprobacion_nombre: 'Aprobado',
        status_compra: 'Completado',
        firma_gerente: currentUser.firma_url 
      }).eq('id', editandoId);
      if (error) throw error;
      alert("Aprobada con éxito.");
      await cargarHistorialDesdeBD();
      setShowModal(false);
      resetearFormulario();
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const manejarRechazar = async () => {
    if (!editandoId || currentUser?.rol !== 'Gerente General') return;
    const motivo = window.prompt("Indique el motivo del rechazo:");
    setLoading(true);
    try {
      const { error } = await supabase.from('requisiciones').update({ 
        aprobacion: false, 
        aprobacion_nombre: 'Rechazado',
        status_compra: 'En Espera',
        justificacion: motivo ? `${justificacion} | MOTIVO RECHAZO: ${motivo}` : justificacion,
        firma_gerente: null 
      }).eq('id', editandoId);
      if (error) throw error;
      alert("Requisición rechazada.");
      await cargarHistorialDesdeBD();
      setShowModal(false);
      resetearFormulario();
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const manejarGenerar = async () => {
    setLoading(true);
    const nuevoCorrelativo = `REQ-${String(historial.length + 1).padStart(3, '0')}`;
    const nuevaReqBD = {
        correlativo_req: nuevoCorrelativo, 
        fecha_emision: new Date().toISOString(),
        fecha_requerida: fechaRequerida,
        solicitante,
        gerencia: departamento,
        centro_costo: `${centroCostoNombre} (${centroCostoID})`,
        prioridad,
        status_compra: 'Pendiente',
        aprobacion: false,
        aprobacion_nombre: 'Pendiente', 
        total_bs: totalGeneral,
        items: renglones,
        justificacion,
        observaciones,
        origen: datosPredefinidos ? 'Sistema' : 'Manual'
    };

    try {
      const { error } = await supabase.from('requisiciones').insert([nuevaReqBD]);
      if (error) throw error;
      alert("Generada y guardada.");
      await cargarHistorialDesdeBD();
      setShowModal(false);
      onClose?.();
      resetearFormulario();
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const exportarPDF = async () => {
    const input = document.getElementById('area-pdf');
    const canvas = await html2canvas(input, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.addImage(imgData, 'PNG', 0, 0, 210, (canvas.height * 210) / canvas.width);
    pdf.save(`REQ_${editandoId || 'NUEVA'}.pdf`);
  };

  return (
    <div className="animate-main" style={{ padding: '25px', backgroundColor: '#f1f5f9', minHeight: '100vh' }}>
      
      {/* --- DASHBOARD SUPERIOR --- */}
      <div className="dashboard-container">
        {[
          { label: 'REQUISICIONES', val: historial.length, col: '#0ea5e9' },
          { label: 'PENDIENTES', val: historial.filter(r => r.aprobacion === 'Pendiente').length, col: '#facc15' },
          { label: 'APROBADAS', val: historial.filter(r => r.aprobacion === 'Aprobado').length, col: '#22c55e' }
        ].map((x, i) => (
          <div key={i} className="stat-card" style={{ borderLeft: `6px solid ${x.col}` }}>
            <div className="stat-label">{x.label}</div>
            <div className="stat-value">{loading ? '...' : x.val}</div>
          </div>
        ))}
      </div>

      {/* --- SECCIÓN DE FILTROS (SIMILAR A GESTIÓN DE USUARIOS) --- */}
      <div className="table-container" style={{ marginBottom: '15px', padding: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
             <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', color: '#1e293b' }}>Historial de Requisiciones</h2>
             <button className="btn-tc btn-tc-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => { setEditandoId(null); setShowModal(true); }}>
                <span>+ Nueva Requisición</span>
             </button>
        </div>

        <div style={{ 
            display: 'flex', 
            gap: '15px', 
            backgroundColor: '#f8fafc', 
            padding: '12px', 
            borderRadius: '12px',
            border: '1px solid #e2e8f0'
        }}>
          <div style={{ flex: 1, position: 'relative' }}>
             <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔍</span>
             <input 
                className="input-tc" 
                style={{ paddingLeft: '35px', margin: 0, backgroundColor: 'white' }} 
                placeholder="Buscar por solicitante o N° REQ..." 
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
             />
          </div>
          
          <select 
            className="input-tc" 
            style={{ flex: 1, margin: 0, backgroundColor: 'white' }}
            value={filtroDepto}
            onChange={(e) => setFiltroDepto(e.target.value)}
          >
            <option value="Todos">Todas las Gerencias</option>
            {listaGerencias.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          <select 
            className="input-tc" 
            style={{ flex: 1, margin: 0, backgroundColor: 'white' }}
            value={filtroAprobacion}
            onChange={(e) => setFiltroAprobacion(e.target.value)}
          >
            <option value="Todos">Todos los Estados</option>
            <option value="Pendiente">Pendientes</option>
            <option value="Aprobado">Aprobadas</option>
            <option value="Rechazado">Rechazadas</option>
          </select>
        </div>
      </div>

      {/* --- TABLA DE HISTORIAL --- */}
      <div className="table-container">
        <table className="tc-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>FECHA</th>
              <th>SOLICITANTE</th>
              <th>CENTRO DE COSTO</th>
              <th>APROBACIÓN</th>
              <th>STATUS</th>
              <th>PRIORIDAD</th>
              <th>TOTAL (C/IVA)</th>
              <th style={{ textAlign: 'center' }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {historialFiltrado.map(req => (
              <tr key={req.id}>
                <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{req.correlativo}</td>
                <td style={{ color: 'var(--slate-400)' }}>{req.fecha}</td>
                <td style={{ fontWeight: '500' }}>{req.solicitante}</td>
                <td>{req.centroCosto}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ 
                      width: '8px', height: '8px', borderRadius: '50%',
                      backgroundColor: req.aprobacion === 'Aprobado' ? 'var(--success)' : (req.aprobacion === 'Rechazado' ? 'var(--danger)' : 'var(--warning)')
                    }}></div>
                    {req.aprobacion}
                  </div>
                </td>
                <td><span style={{ backgroundColor: '#fef9c3', color: '#854d0e', padding: '4px 10px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 'bold' }}>{req.status}</span></td>
                <td><span style={{ color: req.prioridad === 'Alta' ? 'var(--danger)' : 'var(--primary)', fontWeight: 'bold' }}>{req.prioridad}</span></td>
                <td style={{ fontWeight: 'bold' }}>Bs. {req.total?.toLocaleString('de-DE')}</td>
                <td style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
                    <button onClick={() => verRequisicion(req)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>👁️</button>
                    {currentUser?.esAdminReal && (
                      <button onClick={() => manejarEliminar(req.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>🗑️</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && historialFiltrado.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--slate-400)' }}>No se encontraron registros con esos filtros.</div>}
      </div>

      {/* --- MODAL DE FORMULARIO (NUEVA / EDITAR) --- */}
      {(isOpen || showModal) && (
        <div className="modal-overlay">
          <div className="modal-card animate-modal">
            <div id="area-pdf">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, color: 'var(--slate-900)' }}>Requisición de Recursos</h2>
                  <div className="status-purchase-badge" style={{ marginTop: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '9px' }}>STATUS COMPRA:</span>
                    <span style={{ fontSize: '10px', color: estadoGlobal.color, fontWeight: '900' }}>{estadoGlobal.texto}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className={`btn-tc ${prioridad === 'Normal' ? 'btn-tc-primary' : 'btn-tc-secondary'}`} onClick={() => setPrioridad('Normal')}>NORMAL</button>
                  <button className={`btn-tc ${prioridad === 'Alta' ? 'btn-tc-danger' : 'btn-tc-secondary'}`} onClick={() => setPrioridad('Alta')}>ALTA</button>
                  <div style={{ backgroundColor: '#fef08a', padding: '10px 15px', borderRadius: '8px', fontWeight: '900' }}>
                    N° {editandoId ? historial.find(h=>h.id===editandoId)?.correlativo.split('-')[1] : String(historial.length + 1).padStart(3, '0')}
                  </div>
                </div>
              </div>
              
              <div className="req-header-line"></div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px', marginBottom: '25px' }}>
                <div>
                  <label className="stat-label">FECHA REQUERIDA</label>
                  <input className="input-tc" type="date" value={fechaRequerida} onChange={(e) => setFechaRequerida(e.target.value)} />
                </div>
                <div>
                  <label className="stat-label">SOLICITANTE</label>
                  <input className="input-tc" type="text" value={solicitante} readOnly />
                </div>
                <div>
                  <label className="stat-label">CENTRO DE COSTOS</label>
                  <select className="input-tc" value={centroCostoID} onChange={(e) => setCentroCostoID(e.target.value)}>
                    {listaCentrosCostos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="stat-label">GERENCIA</label>
                  <select className="input-tc" value={departamento} onChange={(e) => setDepartamento(e.target.value)}>
                    {listaGerencias.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label className="stat-label">JUSTIFICACIÓN DE LA SOLICITUD</label>
                <input className="input-tc" type="text" value={justificacion} onChange={(e) => setJustificacion(e.target.value)} />
              </div>

              {/* CAMPO DE OBSERVACIONES */}
              <div style={{ marginBottom: '25px' }}>
                <label className="stat-label">OBSERVACIONES</label>
                <textarea 
                   className="input-tc" 
                   style={{ minHeight: '60px', paddingTop: '10px' }}
                   value={observaciones} 
                   onChange={(e) => setObservaciones(e.target.value)} 
                   placeholder="Notas adicionales sobre la entrega, especificaciones técnicas, etc."
                />
              </div>

              <table className="tc-table" style={{ fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--slate-50)' }}>
                    <th>RENG.</th>
                    <th>CLASIFICACIÓN</th>
                    <th>CATEGORÍA</th>
                    <th>CANT.</th>
                    <th>UNI.</th>
                    <th>DESCRIPCIÓN</th>
                    <th style={{ textAlign: 'right' }}>P.U.</th>
                    <th style={{ textAlign: 'right' }}>TOTAL</th>
                    <th>STATUS</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {renglones.map((f, index) => (
                    <tr key={f.id} className="renglon-row">
                      <td style={{ textAlign: 'center' }}>{index + 1}</td>
                      <td><input className="input-tc" value={f.clasificacion} onChange={(e) => actualizarFila(f.id, 'clasificacion', e.target.value)} /></td>
                      <td><input className="input-tc" value={f.categoria} onChange={(e) => actualizarFila(f.id, 'categoria', e.target.value)} /></td>
                      <td><input className="input-tc" type="number" value={f.cant} onChange={(e) => actualizarFila(f.id, 'cant', e.target.value)} /></td>
                      <td>
                        <select className="input-tc" value={f.uni} onChange={(e) => actualizarFila(f.id, 'uni', e.target.value)}>
                          {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td><input className="input-tc" value={f.descripcion} onChange={(e) => actualizarFila(f.id, 'descripcion', e.target.value)} /></td>
                      <td><input className="input-tc" type="number" value={f.pu} style={{ textAlign: 'right' }} onChange={(e) => actualizarFila(f.id, 'pu', e.target.value)} /></td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{f.total.toLocaleString('de-DE')}</td>
                      <td>
                        <select className="input-tc" style={{ fontSize: '10px' }} value={f.status} onChange={(e) => actualizarFila(f.id, 'status', e.target.value)}>
                          <option value="En Espera">En Espera</option>
                          <option value="Parcial">Parcial</option>
                          <option value="Completado">Completado</option>
                        </select>
                      </td>
                      <td><button onClick={() => setRenglones(renglones.filter(r => r.id !== f.id))} style={{ color: 'var(--danger)', border: 'none', background: 'none' }}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button className="btn-add-row" onClick={() => setRenglones([...renglones, { id: Date.now(), status: 'En Espera', cant: 1, uni: 'UNID', pu: 0, total: 0 }])}>
                + AÑADIR RENGLÓN
              </button>

              <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div className="signature-line">
                   {historial.find(h => h.id === editandoId)?.firma_gerente && (
                     <img src={historial.find(h => h.id === editandoId).firma_gerente} alt="Firma" style={{ width: '160px', mixBlendMode: 'darken' }} />
                   )}
                   <p style={{ margin: 0, fontWeight: '900' }}>CARLOS VEGA</p>
                   <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--slate-400)' }}>GERENTE GENERAL</p>
                   <p style={{ margin: 0, fontSize: '0.6rem', color: 'var(--primary)' }}>TOTAL CLEAN C.A.</p>
                </div>

                <div className="totals-container">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label">SUB-TOTAL:</span>
                    <span style={{ fontWeight: 'bold' }}>Bs. {subTotal.toLocaleString('de-DE')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--slate-200)', paddingTop: '10px' }}>
                    <span style={{ fontWeight: '900' }}>TOTAL GENERAL:</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--primary)' }}>Bs. {totalGeneral.toLocaleString('de-DE')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
              <button className="btn-tc btn-tc-secondary" onClick={() => { setShowModal(false); onClose?.(); resetearFormulario(); }}>Cerrar</button>
              <button className="btn-tc btn-tc-dark" onClick={exportarPDF}>📥 PDF</button>
              
            {editandoId ? (
                (currentUser?.rol === 'Gerente General' || currentUser?.esAdminReal) && (
                  <>
                    <button className="btn-tc btn-tc-danger" onClick={manejarRechazar} disabled={loading}>RECHAZAR</button>
                    <button className="btn-tc btn-tc-success" onClick={manejarAprobar} disabled={loading}>APROBAR REQUISICIÓN</button>
                  </>
                )
              ) : (
                <button className="btn-tc btn-tc-primary" onClick={manejarGenerar} disabled={loading}>GENERAR REQUISICIÓN</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Requisiciones;