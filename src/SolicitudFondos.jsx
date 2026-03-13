import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient'; 
import Requisiciones from './Requisiciones'; 
import './SolicitudFondos.css';

const StockSmartTotalClean = () => {
  const [showModal, setShowModal] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  
  // --- ESTADOS PARA CONTROLAR EL MODAL DE REQUISICIONES ---
  const [abrirReq, setAbrirReq] = useState(false);
  const [dataParaReq, setDataParaReq] = useState(null);

  // --- ESTADOS DE DATA MAESTRA ---
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [todasClasificaciones, setTodasClasificaciones] = useState([]); 
  const [todasCategorias, setTodasCategorias] = useState([]);           

  // --- DATOS MAESTROS ESTÁTICOS ---
  const gerenciasData = {
    "Operaciones": ["Hilda Colina"],
    "Mantenimiento": ["José Cohen"],
    "Seguridad": ["Xiomara Acevedo"],
    "Recursos Humanos": ["Ider Marín"],
    "Estimación": ["Karin Machado"],
    "Almacén": ["Diana García"],
    "Servicios Generales": ["Luis Fallica"],
    "Administración Maracaibo": ["Perla Delgado"],
    "Administración El Tigre": ["Zuleika Lara"],
    "Gerencia General": ["Carlos Vega"],
    "Contabilidad": ["Jorge Urdaneta"]
  };

  const unidades = ["UNID", "KG", "LTS", "SERV", "SG", "VIAJES"];

  // --- ESTADO INICIAL DEL FORMULARIO ---
  const [form, setForm] = useState({
    id: '', 
    fecha: new Date().toISOString().split('T')[0],
    sede: 'MARACAIBO', 
    gerencia: '',    
    responsable: '', 
    partidas: [{ id: Date.now(), selected: false, cc: '', clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', puBs: '', puUsd: '' }]
  });


  // --- ESTADO PARA FILTROS ---
const [busqueda, setBusqueda] = useState("");

// --- FUNCIÓN PARA ELIMINAR ---
const eliminarSolicitud = async (id_db) => {
  if (window.confirm("¿Estás seguro de que deseas eliminar esta solicitud? Esta acción no se puede deshacer.")) {
    try {
      // Primero eliminamos las partidas relacionadas (por la integridad referencial)
      await supabase.from('partidas_fondos').delete().eq('solicitud_id', id_db);
      // Luego eliminamos la cabecera
      const { error } = await supabase.from('solicitudes_fondos').delete().eq('id', id_db);
      
      if (error) throw error;
      
      alert("Solicitud eliminada correctamente");
      setHistorial(historial.filter(h => h.id_db !== id_db));
    } catch (err) {
      alert("Error al eliminar: " + err.message);
    }
  }
};

// --- LÓGICA DE FILTRADO ---
const historialFiltrado = historial.filter(h => 
  h.id.toLowerCase().includes(busqueda.toLowerCase()) ||
  h.responsable.toLowerCase().includes(busqueda.toLowerCase()) ||
  h.gerencia.toLowerCase().includes(busqueda.toLowerCase())
);

  // --- EFECTO DE CARGA INICIAL ---
  useEffect(() => {
    const cargarTodo = async () => {
      const { data: dataHist } = await supabase
        .from('solicitudes_fondos')
        .select('*')
        .order('created_at', { ascending: false });

      if (dataHist) {
        setHistorial(dataHist.map(h => ({
          ...h,
          id_db: h.id,
          id: h.codigo_control,
          total: parseFloat(h.total_usd || 0) + parseFloat(h.total_bs || 0),
          responsable: h.responsable_nombre,
          gerencia: h.gerencia_nombre
        })));
      }

      const { data: dataCC } = await supabase.from('maestros_centros_costo').select('nombre').eq('activo', true).order('nombre');
      if (dataCC) setCentrosCosto(dataCC.map(c => c.nombre));

      const { data: dataClas } = await supabase
        .from('maestros_clasificaciones')
        .select('nombre, maestros_centros_costo(nombre)')
        .eq('activo', true);

      if (dataClas) {
        setTodasClasificaciones(dataClas.filter(c => c.maestros_centros_costo).map(c => ({
          nombre: c.nombre,
          padre: c.maestros_centros_costo.nombre
        })));
      }

      const { data: dataSub } = await supabase
        .from('maestros_sub_clasificaciones') 
        .select('nombre, maestros_clasificaciones(nombre)')
        .eq('activo', true);

      if (dataSub) {
        setTodasCategorias(dataSub.filter(s => s.maestros_clasificaciones).map(s => ({
          nombre: s.nombre,
          padre: s.maestros_clasificaciones.nombre
        })));
      }
    };
    cargarTodo();
  }, []);

  // --- FUNCIONES DE LÓGICA ---
  const cargarDetallesYEditar = async (solicitud) => {
    try {
      const targetId = solicitud.id_db || solicitud.id;
      const { data: partidasRaw } = await supabase.from('partidas_fondos').select('*').eq('solicitud_id', targetId); 

      setForm({
        ...solicitud,
        id: solicitud.codigo_control || solicitud.id,
        id_db: solicitud.id_db,
        fecha: solicitud.fecha_operativa,
        gerencia: solicitud.gerencia, 
        responsable: solicitud.responsable,
        partidas: partidasRaw.map(p => ({
          id: p.id, 
          cc: p.centro_costo, 
          clasif: p.clasificacion, 
          cat: p.categoria,
          cant: p.cantidad, 
          uni: p.unidad, 
          desc: p.descripcion, 
          ben: p.beneficiario,
          puBs: p.pu_bs, 
          puUsd: p.pu_usd, 
          selected: false 
        }))
      });
      setIsEditing(true);
      setShowModal(true);
    } catch (err) { alert("Error cargando detalles."); }
  };

  const manejarCambioPartida = (index, campo, valor) => {
    const nuevas = [...form.partidas];
    nuevas[index][campo] = valor;
    if (campo === 'cc') { nuevas[index].clasif = ''; nuevas[index].cat = ''; }
    if (campo === 'clasif') { nuevas[index].cat = ''; }
    if (campo === 'puBs' && valor > 0) nuevas[index].puUsd = '';
    if (campo === 'puUsd' && valor > 0) nuevas[index].puBs = '';
    setForm({ ...form, partidas: nuevas });
  };

  const getWeekNumber = (d) => {
    const date = new Date(d);
    date.setHours(0,0,0,0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  };

  const numSemana = getWeekNumber(form.fecha);
  const idDinamico = isEditing ? form.id : `${form.gerencia ? form.gerencia.split(' ').map(w => w[0]).join('') : '---'} - SEMANA ${numSemana}`;

  const sumas = form.partidas.reduce((acc, p) => {
    acc.bs += (parseFloat(p.puBs) || 0) * (p.cant || 1);
    acc.usd += (parseFloat(p.puUsd) || 0) * (p.cant || 1);
    return acc;
  }, { bs: 0, usd: 0 });

  const registrarOActualizar = async () => {
    try {
      const cabecera = {
        codigo_control: idDinamico, 
        fecha_operativa: form.fecha, 
        sede: form.sede,
        gerencia_nombre: form.gerencia, 
        responsable_nombre: form.responsable,
        total_bs: sumas.bs, 
        total_usd: sumas.usd
      };

      let cabeceraId;
      if (isEditing) {
        const { error: errorUpdate } = await supabase.from('solicitudes_fondos').update(cabecera).eq('id', form.id_db);
        if (errorUpdate) throw errorUpdate;
        cabeceraId = form.id_db;
        await supabase.from('partidas_fondos').delete().eq('solicitud_id', cabeceraId);
      } else {
        const { data: newCab, error: errorInsert } = await supabase.from('solicitudes_fondos').insert([cabecera]).select().single();
        if (errorInsert) throw errorInsert;
        cabeceraId = newCab.id;
      }

      // --- CORRECCIÓN AQUÍ: Aseguramos que se envíen 'centro_costo', 'clasificacion' y 'categoria' correctamente ---
      const renglones = form.partidas.map((p, i) => ({
        solicitud_id: cabeceraId, 
        n_renglon: i + 1, 
        centro_costo: p.cc,
        clasificacion: p.clasif, // Cambiado de p.clasificacion a p.clasif para que coincida con el estado 'form'
        categoria: p.cat,       // Cambiado de p.categoria a p.cat para que coincida con el estado 'form'
        cantidad: parseFloat(p.cant) || 0, 
        unidad: p.uni,
        descripcion: p.desc, 
        beneficiario: p.ben, 
        pu_bs: parseFloat(p.puBs) || 0, 
        pu_usd: parseFloat(p.puUsd) || 0
      }));

      const { error: errorPartidas } = await supabase.from('partidas_fondos').insert(renglones);
      if (errorPartidas) throw errorPartidas;

      alert("¡Guardado con éxito!");
      window.location.reload(); 
    } catch (err) { 
      alert("Error al guardar: " + err.message); 
    }
  };

  const handleCrearRequisicion = () => {
    const seleccionadas = form.partidas.filter(p => p.selected);
    if (seleccionadas.length === 0) return alert("Selecciona al menos una partida");
    setDataParaReq({
      id_control: idDinamico, responsable: form.responsable, gerencia: form.gerencia,
      centro_costo: seleccionadas[0].cc, origen_proceso: `Generado desde Fondos: ${idDinamico}`,
      justificacion: "", partidasSeleccionadas: seleccionadas
    });
    setAbrirReq(true); 
  };

  return (
    <div style={{ padding: '25px', backgroundColor: '#f1f5f9', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      
      {/* DASHBOARD HEADERS */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
        {[
          { label: 'TOTAL PROYECTADO', val: `$ ${historial.reduce((a, b) => a + b.total, 0).toLocaleString('de-DE')}`, col: '#0ea5e9' },
          { label: 'SOLICITUDES', val: historial.length, col: '#facc15' },
          { label: 'ITEMS MARCADOS', val: form.partidas.filter(p => p.selected).length, col: '#22c55e' }
        ].map((x, i) => (
          <div key={i} style={{ flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '15px', borderLeft: `6px solid ${x.col}`, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 'bold' }}>{x.label}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#1e293b' }}>{x.val}</div>
          </div>
        ))}
      </div>

      {/* TABLA DE HISTORIAL */}

      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px', alignItems: 'center' }}>
    <h2 style={{ fontSize: '1.3rem', color: '#1e293b', margin: 0 }}>Gestión de Solicitudes de fondo TotalClean</h2>
    
    <div style={{ display: 'flex', gap: '15px' }}>
      {/* INPUT DE FILTRO */}
      <input 
        type="text" 
        placeholder="🔍 Buscar por ID, Responsable o Gerencia..." 
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{ padding: '10px 15px', borderRadius: '10px', border: '1px solid #e2e8f0', width: '300px', fontSize: '13px' }}
      />
      
      <button onClick={() => { 
        setIsEditing(false); 
        setForm({
          id: '', fecha: new Date().toISOString().split('T')[0], sede: 'MARACAIBO', 
          gerencia: '', responsable: '', 
          partidas: [{ id: Date.now(), selected: false, cc: '', clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', puBs: '', puUsd: '' }]
        }); 
        setShowModal(true); 
      }} style={{ padding: '12px 25px', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>+ Nueva Solicitud</button>
    </div>
  </div>

  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
    <thead>
      <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontSize: '0.75rem' }}>
        <th style={{ padding: '15px' }}>ID CONTROL</th>
        <th>RESPONSABLE</th>
        <th>GERENCIA</th>
        <th>TOTAL ($)</th>
        <th style={{ textAlign: 'center' }}>ACCIONES</th>
      </tr>
    </thead>
    <tbody>
      {historialFiltrado.map((h, i) => (
        <tr key={i} style={{ borderBottom: '1px solid #f8fafc', fontSize: '0.85rem' }}>
          <td style={{ padding: '15px', fontWeight: 'bold', color: '#0ea5e9' }}>{h.id}</td>
          <td>{h.responsable}</td>
          <td>{h.gerencia}</td>
          <td style={{ fontWeight: 'bold' }}>$ {h.total.toLocaleString('de-DE')}</td>
          <td style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button 
                onClick={() => cargarDetallesYEditar(h)} 
                style={{ color: '#0ea5e9', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Ver / Editar
              </button>
              <button 
                onClick={() => eliminarSolicitud(h.id_db)} 
                style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}
                title="Eliminar Solicitud"
              >
                🗑️
              </button>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
  {historialFiltrado.length === 0 && (
    <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No se encontraron resultados para "{busqueda}"</div>
  )}
</div>

      {/* MODAL DE REGISTRO */}
      {showModal && (
        <div className="sf-modal-overlay">
          <div className="sf-modal-container">
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px' }}>
              <div>
                <h2 style={{ margin: 0, fontWeight: '900' }}>{isEditing ? 'Editar Registro' : 'Registro de Fondos'}</h2>
                <div style={{ background: '#0f172a', color: 'white', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', display: 'inline-block', marginTop: '8px', fontWeight: 'bold' }}>ID: {idDinamico}</div>
              </div>
              <div style={{ display: 'flex', gap: '40px', textAlign: 'right' }}>
                <div><label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>SUB-TOTAL BS.</label><div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#b45309' }}>Bs. {sumas.bs.toLocaleString('de-DE')}</div></div>
                <div><label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>SUB-TOTAL USD</label><div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#15803d' }}>$ {sumas.usd.toLocaleString('de-DE')}</div></div>
                <div style={{ borderLeft: '2px solid #e2e8f0', paddingLeft: '30px' }}><label style={{ fontSize: '10px', fontWeight: '900', color: '#64748b' }}>TOTAL GENERAL</label><div style={{ fontSize: '2rem', fontWeight: '950', color: '#0f172a' }}>$ {(sumas.bs + sumas.usd).toLocaleString('de-DE')}</div></div>
              </div>
            </div>

            {/* FORM CABECERA */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', background: 'white', padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#363636', marginBottom: '5px' }}>FECHA OPERATIVA</label>
                <input type="date" className="sf-input" value={form.fecha} onChange={(e) => setForm({...form, fecha: e.target.value})} />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#363636', marginBottom: '5px' }}>GERENCIA SOLICITANTE</label>
                <select 
                  className="sf-input"
                  value={form.gerencia} 
                  onChange={(e) => {
                    const nuevaGerencia = e.target.value;
                    const primerResponsable = gerenciasData[nuevaGerencia] ? gerenciasData[nuevaGerencia][0] : '';
                    setForm({ ...form, gerencia: nuevaGerencia, responsable: primerResponsable });
                  }} 
                >
                  <option value="">Seleccione Gerencia...</option>
                  {Object.keys(gerenciasData).map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#363636', marginBottom: '5px' }}>RESPONSABLE DE GASTO</label>
                <select 
                  className="sf-input"
                  value={form.responsable} 
                  onChange={(e) => setForm({...form, responsable: e.target.value})} 
                >
                  <option value="">Seleccione Responsable...</option>
                  {gerenciasData[form.gerencia]?.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            {/* TABLA DE RENGLONES */}
            <div className="sf-table-wrapper">
              <div className="sf-table-header">
                <div style={{ width: '40px', padding: '12px', textAlign: 'center' }}>SEL</div>
                <div style={{ width: '45px', padding: '12px' }}>N°</div>
                <div style={{ width: '200px', padding: '12px' }}>C. COSTO</div>
                <div style={{ width: '215px', padding: '12px' }}>CLASIFICACIÓN</div>
                <div style={{ width: '215px', padding: '12px' }}>CATEGORÍA</div>
                <div style={{ width: '80px', padding: '12px'}}>CANT</div>
                <div style={{ width: '90px', padding: '12px' }}>UNID</div>
                <div style={{ width: '460px', padding: '12px' }}>DESCRIPCIÓN DEL GASTO</div>
                <div style={{ width: '200px', padding: '12px' }}>BENEFICIARIO</div>
                <div style={{ width: '120px', padding: '12px', textAlign: 'center' }}>P.U BS</div>
                <div style={{ width: '120px', padding: '12px', textAlign: 'center' }}>P.U USD</div>
                <div style={{ width: '120px', padding: '12px', textAlign: 'center' }}>TOTAL $</div>
              </div>
              
              <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
                {form.partidas.map((p, i) => (
                  <div key={p.id} className="sf-table-row" style={{ background: p.selected ? '#e0f2fe' : 'transparent' }}>
                    <div style={{ width: '40px', textAlign: 'center' }}>
                        <input type="checkbox" checked={p.selected || false} onChange={(e) => manejarCambioPartida(i, 'selected', e.target.checked)} style={{ cursor: 'pointer', transform: 'scale(1.2)' }} />
                    </div>
                    <div style={{ width: '45px', textAlign: 'center', fontWeight: 'bold', color: '#94a3b8' }}>{i + 1}</div>
                    <div style={{ width: '200px', padding: '6px' }}>
                      <select className="sf-table-input" value={p.cc} onChange={(e) => manejarCambioPartida(i, 'cc', e.target.value)} style={{ fontWeight: 'bold' }}>
                        <option value="">Seleccione C.C...</option>
                        {centrosCosto.map(op => <option key={op} value={op}>{op}</option>)}
                      </select>
                    </div>
                    <div style={{ width: '215px', padding: '6px' }}>
                      <select className="sf-table-input" value={p.clasif} onChange={(e) => manejarCambioPartida(i, 'clasif', e.target.value)} disabled={!p.cc}>
                        <option value="">Clasificación...</option>
                        {todasClasificaciones.filter(cl => cl.padre === p.cc).map(op => <option key={op.nombre} value={op.nombre}>{op.nombre}</option>)}
                      </select>
                    </div>
                    <div style={{ width: '215px', padding: '6px' }}>
                      <select className="sf-table-input" value={p.cat} onChange={(e) => manejarCambioPartida(i, 'cat', e.target.value)} disabled={!p.clasif}>
                        <option value="">Categoría...</option>
                        {[...new Set(todasCategorias.filter(ct => ct.padre === p.clasif).map(ct => ct.nombre))].map(nombre => (
                          <option key={nombre} value={nombre}>{nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ width: '80px', padding: '6px' }}><input className="sf-table-input" type="number" value={p.cant} onChange={(e) => manejarCambioPartida(i, 'cant', e.target.value)} style={{ textAlign: 'center' }} /></div>
                    <div style={{ width: '90px', padding: '6px' }}><select className="sf-table-input" value={p.uni} onChange={(e) => manejarCambioPartida(i, 'uni', e.target.value)}>{unidades.map(u => <option key={u}>{u}</option>)}</select></div>
                    <div style={{ width: '460px', padding: '10px' }}><textarea className="sf-table-input" value={p.desc} onChange={(e) => manejarCambioPartida(i, 'desc', e.target.value)} style={{ resize: 'none' }} rows="1" /></div>
                    <div style={{ width: '200px', padding: '6px' }}><input className="sf-table-input" value={p.ben} onChange={(e) => manejarCambioPartida(i, 'ben', e.target.value)} /></div>
                    <div style={{ width: '120px', padding: '6px' }}><input className="sf-table-input" type="number" value={p.puBs} onChange={(e) => manejarCambioPartida(i, 'puBs', e.target.value)} style={{ textAlign: 'right' }} disabled={p.puUsd > 0} /></div>
                    <div style={{ width: '120px', padding: '6px' }}><input className="sf-table-input" type="number" value={p.puUsd} onChange={(e) => manejarCambioPartida(i, 'puUsd', e.target.value)} style={{ textAlign: 'right' }} disabled={p.puBs > 0} /></div>
                    <div style={{ width: '120px', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>{((parseFloat(p.puBs) || parseFloat(p.puUsd) || 0) * (p.cant || 0)).toLocaleString('de-DE')}</div>
                    <div style={{ width: '40px', textAlign: 'center' }}><button onClick={() => setForm({...form, partidas: form.partidas.filter((_, idx) => idx !== i)})} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }}>🗑️</button></div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="sf-btn sf-btn-add" onClick={() => setForm({...form, partidas: [...form.partidas, { id: Date.now(), selected: false, cc: '', clasif: '', cat: '', cant: 1, uni: 'UNID', desc: '', ben: '', puBs: '', puUsd: '' }]})}>+ AÑADIR RENGLÓN</button>
                <button className="sf-btn sf-btn-success" onClick={handleCrearRequisicion}>📝 CREAR REQUISICIÓN</button>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="sf-btn sf-btn-close" onClick={() => setShowModal(false)}>CERRAR</button>
                <button className="sf-btn sf-btn-primary" onClick={registrarOActualizar}>{isEditing ? 'ACTUALIZAR' : 'REGISTRAR'}</button>
              </div>
            </div>
          </div>

          {abrirReq && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
              <div style={{ width: '90%', maxWidth: '1200px' }}>
                <Requisiciones isOpen={abrirReq} onClose={() => setAbrirReq(false)} datosPredefinidos={dataParaReq} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StockSmartTotalClean;