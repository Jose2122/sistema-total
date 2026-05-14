/* Atributos.jsx */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import { 
  Database, 
  Search, 
  Plus, 
  Edit2, 
  ToggleLeft, 
  ToggleRight, 
  ChevronRight,
  LayoutGrid,
  Tags,
  Truck,
  Check,
  ChevronDown,
  ChevronUp,
  Trash2,
  Trash,
  ShieldCheck,
  UserSquare2,
  Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import './Atributos.css';

const Atributos = () => {
  const [listaActiva, setListaActiva] = useState('centros_costo');
  const [datos, setDatos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoItem, setEditandoItem] = useState(null);
  const [formData, setFormData] = useState({ 
    nombre: '', 
    padre_ids: [],
    nivel: 99,
    permisos_default: {}
  });
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [clasificaciones, setClasificaciones] = useState([]);
  const [gruposExpandidos, setGruposExpandidos] = useState({});
  const [recienAgregados, setRecienAgregados] = useState([]);
  const [filtroCC, setFiltroCC] = useState('');
  const [filasExpandidas, setFilasExpandidas] = useState({});
  const [seleccionados, setSeleccionados] = useState([]); // Array de IDs seleccionados para borrar
  const [modalCopiarAbierto, setModalCopiarAbierto] = useState(false);
  const [copiaOrigen, setCopiaOrigen] = useState('');
  const [copiaDestino, setCopiaDestino] = useState('');
  const inputNombreRef = useRef(null);

  const PERMISOS_DISPONIBLES = [
    { id: 'ver_global', label: 'Ver Historial Global (Todas las Sedes)', desc: 'Registros de todos los departamentos sin restricciones.' },
    { id: 'ver_departamento', label: 'Ver Historial de Departamento', desc: 'Registros del propio departamento.' },
    { id: 'puede_aprobar_area', label: 'Aprobación Nivel 1 (Gerente de Área)', desc: 'Primera aprobación a requisiciones.' },
    { id: 'puede_aprobar_final', label: 'Aprobación Final (Gerencia General)', desc: 'Validación final del gasto.' },
    { id: 'gestionar_usuarios', label: 'Gestión de Usuarios', desc: 'Cerrar sesión, editar y dar de baja usuarios.' },
    { id: 'acceso_compras', label: 'Módulo de Compras', desc: 'Procesamiento de compras y trazabilidad.' },
    { id: 'gestionar_atributos', label: 'Configuración de Atributos', desc: 'Modificar listas maestras y permisos.' }
  ];

  const LISTAS = [
    { id: 'centros_costo', label: 'Centros de Costo', icon: <LayoutGrid size={20} />, table: 'maestros_centros_costo' },
    { id: 'gerencias', label: 'Gerencias / Depto.', icon: <Database size={20} />, table: 'cat_gerencias' },
    { id: 'clasificaciones', label: 'Clasificaciones', icon: <Tags size={20} />, table: 'maestros_clasificaciones' },
    { id: 'categorias', label: 'Categorías / Equipos', icon: <Truck size={20} />, table: 'maestros_sub_clasificaciones' },
    { id: 'cargos', label: 'Cargos y Roles', icon: <ShieldCheck size={20} />, table: 'cat_cargos' }
  ];

  const GRUPOS_ATRIBUTOS = [
    { titulo: 'Estructura de Costos', listas: ['centros_costo', 'clasificaciones', 'categorias'] },
    { titulo: 'Estructura Organizativa', listas: ['gerencias'] },
    { titulo: 'Seguridad y Accesos', listas: ['cargos'] }
  ];

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    const config = LISTAS.find(l => l.id === listaActiva);
    
    try {
      let query = supabase.from(config.table).select('*').order('nombre');
      
      // Si cargamos clasificaciones o categorías, traemos datos del padre para mostrar nombres
      if (listaActiva === 'clasificaciones') {
        query = supabase.from(config.table).select('*, maestros_centros_costo!centro_costo_id(nombre)').order('nombre');
      } else if (listaActiva === 'categorias') {
        query = supabase.from(config.table).select('*, maestros_clasificaciones(nombre)').order('nombre');
      } else if (listaActiva === 'cargos') {
        query = supabase.from(config.table).select('*').order('nivel');
      }

      const { data, error } = await query;
      if (error) throw error;
      setDatos(data || []);

      // Cargar auxiliares para formularios
      if (listaActiva === 'clasificaciones') {
        const { data: cc } = await supabase.from('maestros_centros_costo').select('id, nombre').eq('activo', true);
        setCentrosCosto(cc || []);
      } else if (listaActiva === 'categorias') {
        const { data: cl } = await supabase
          .from('maestros_clasificaciones')
          .select('id, nombre, maestros_centros_costo!centro_costo_id(nombre)')
          .eq('activo', true);
        setClasificaciones(cl || []);
      }

    } catch (err) {
      toast.error('Error al cargar datos: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [listaActiva]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const handleToggleEstado = async (item) => {
    const config = LISTAS.find(l => l.id === listaActiva);
    try {
      const { error } = await supabase
        .from(config.table)
        .update({ activo: !(item.activo !== false) }) // Trata undefined/null como true (activo)
        .eq('id', item.id);
      
      if (error) throw error;
      toast.success(`Ítem ${item.activo ? 'desactivado' : 'activado'} correctamente`);
      cargarDatos();
    } catch (err) {
      toast.error('Error al actualizar estado');
    }
  };

  const handleEliminarItem = async (id, nombre, padreNombre) => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>¿Seguro que deseas eliminar "{nombre}" de "{padreNombre}"? Esta acción no se puede deshacer.</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button 
            onClick={() => { toast.dismiss(t.id); ejecutarEliminacionItem(id, nombre); }}
            style={{ padding: '4px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            ELIMINAR
          </button>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 12px', background: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>CANCELAR</button>
        </div>
      </div>
    ), { duration: 5000 });
  };

  const ejecutarEliminacionItem = async (id, nombre) => {
    const config = LISTAS.find(l => l.id === listaActiva);
    try {
      setLoading(true);
      const { error } = await supabase.from(config.table).delete().eq('id', id);
      if (error) throw error;
      toast.success(`Eliminado: ${nombre}`);
      cargarDatos();
    } catch (err) {
      toast.error('Error al eliminar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarGrupo = async (nombre, items) => {
    const total = items.length;
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold', color: '#ef4444' }}>⚠️ ADVERTENCIA: Vas a eliminar "{nombre}" de las {total} sedes donde existe. ¿Estás COMPLETAMENTE seguro?</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button 
            onClick={() => { toast.dismiss(t.id); ejecutarEliminacionGrupo(nombre, items); }}
            style={{ padding: '4px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            ELIMINAR EN TODAS
          </button>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 12px', background: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>CANCELAR</button>
        </div>
      </div>
    ), { duration: 7000 });
  };

  const ejecutarEliminacionGrupo = async (nombre, items) => {
    const total = items.length;
    const config = LISTAS.find(l => l.id === listaActiva);
    try {
      setLoading(true);
      const ids = items.map(it => it.id);
      const { error } = await supabase.from(config.table).delete().in('id', ids);
      if (error) throw error;
      toast.success(`Se eliminaron ${total} registros de "${nombre}"`);
      cargarDatos();
    } catch (err) {
      toast.error('Error al eliminar grupo');
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarSeleccionados = async () => {
    const total = seleccionados.length;
    if (total === 0) return;
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold', color: '#ef4444' }}>⚠️ ¿Estás seguro de eliminar los {total} ítems seleccionados? Esta acción es irreversible.</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button 
            onClick={() => { toast.dismiss(t.id); ejecutarEliminacionMasiva(); }}
            style={{ padding: '4px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            SÍ, ELIMINAR MASIVAMENTE
          </button>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 12px', background: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>CANCELAR</button>
        </div>
      </div>
    ), { duration: 7000 });
  };

  const ejecutarEliminacionMasiva = async () => {
    const total = seleccionados.length;
    const config = LISTAS.find(l => l.id === listaActiva);
    try {
      setLoading(true);
      const { error } = await supabase.from(config.table).delete().in('id', seleccionados);
      if (error) throw error;

      toast.success(`Se eliminaron ${total} registros correctamente`);
      setSeleccionados([]);
      cargarDatos();
    } catch (err) {
      toast.error('Error al realizar la eliminación masiva');
    } finally {
      setLoading(false);
    }
  };

  const toggleSeleccion = (id) => {
    setSeleccionados(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const seleccionarTodo = () => {
    const datosVisibles = filtrarYAgruparDatos();
    const todosIds = [];
    datosVisibles.forEach(di => {
      if (listaActiva === 'centros_costo') {
        todosIds.push(di.id);
      } else {
        di.items.forEach(it => todosIds.push(it.id));
      }
    });

    if (seleccionados.length === todosIds.length && todosIds.length > 0) {
      setSeleccionados([]);
    } else {
      setSeleccionados(todosIds);
    }
  };

  const ejecutarMigracionClasificaciones = async () => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>¿Deseas iniciar la migración de Clasificaciones? Se asignarán los IDs numéricos basados en los nombres actuales.</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button 
            onClick={() => { toast.dismiss(t.id); realizarMigracion(); }}
            style={{ padding: '4px 12px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            INICIAR MIGRACIÓN
          </button>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 12px', background: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>CANCELAR</button>
        </div>
      </div>
    ), { duration: 8000 });
  };

  const ejecutarCopiaConfiguracion = async () => {
    if (!copiaOrigen || !copiaDestino) return toast.error('Debe seleccionar origen y destino');
    if (copiaOrigen === copiaDestino) return toast.error('El origen y destino no pueden ser iguales');

    setLoading(true);
    try {
      // 1. Obtener todas las clasificaciones del origen
      const { data: clasificacionesOrigen, error: errCl } = await supabase
        .from('maestros_clasificaciones')
        .select('*')
        .eq('centro_costo_id', copiaOrigen);
      
      if (errCl) throw errCl;
      if (!clasificacionesOrigen || clasificacionesOrigen.length === 0) {
        toast.error('El centro de costo origen no tiene clasificaciones para copiar.');
        setLoading(false);
        return;
      }

      // 2. Obtener clasificaciones existentes en el destino para evitar duplicados exactos por nombre (opcional, pero recomendado)
      const { data: clasificacionesDestinoExistentes } = await supabase
        .from('maestros_clasificaciones')
        .select('nombre')
        .eq('centro_costo_id', copiaDestino);
      
      const nombresExistentes = (clasificacionesDestinoExistentes || []).map(c => c.nombre.toLowerCase());

      let insertadosCont = 0;
      let saltadosCont = 0;

      for (const cl of clasificacionesOrigen) {
        if (nombresExistentes.includes(cl.nombre.toLowerCase())) {
          saltadosCont++;
          continue;
        }

        // 3. Crear clasificación en el destino
        const { data: nuevaCl, error: errNewCl } = await supabase
          .from('maestros_clasificaciones')
          .insert([{ nombre: cl.nombre, centro_costo_id: copiaDestino, activo: true }])
          .select()
          .single();
        
        if (errNewCl) throw errNewCl;

        // 4. Obtener sub-clasificaciones (equipos) de esta clasificación original
        const { data: subClOrigen, error: errSub } = await supabase
          .from('maestros_sub_clasificaciones')
          .select('*')
          .eq('clasificacion_id', cl.id);
        
        if (errSub) throw errSub;

        if (subClOrigen && subClOrigen.length > 0) {
          const subToInsert = subClOrigen.map(s => ({
            nombre: s.nombre,
            clasificacion_id: nuevaCl.id,
            activo: true
          }));

          const { error: errInsSub } = await supabase
            .from('maestros_sub_clasificaciones')
            .insert(subToInsert);
          
          if (errInsSub) throw errInsSub;
        }
        insertadosCont++;
      }

      if (insertadosCont > 0) {
        toast.success(`Copiado exitoso: ${insertadosCont} clasificaciones y sus equipos clonados.`);
      }
      if (saltadosCont > 0) {
        toast.error(`${saltadosCont} clasificaciones ya existían en el destino y se omitieron.`);
      }
      
      setModalCopiarAbierto(false);
      setCopiaOrigen('');
      setCopiaDestino('');
      cargarDatos();
    } catch (err) {
      toast.error('Error durante el proceso de copiado: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const realizarMigracion = async () => {
    setLoading(true);
    try {
      const { data: centrosCosto } = await supabase.from('maestros_centros_costo').select('id, nombre');
      const { data: clasificaciones } = await supabase.from('maestros_clasificaciones').select('*');
      
      let actualizados = 0;
      let noEncontrados = [];

      for (const clasif of clasificaciones) {
        const nombreBuscado = (clasif.maestros_centros_costo || "").trim().toLowerCase();
        const padre = centrosCosto.find(cc => cc.nombre.trim().toLowerCase() === nombreBuscado);
        
        if (padre) {
          const { error } = await supabase.from('maestros_clasificaciones').update({ centro_costo_id: padre.id }).eq('id', clasif.id);
          if (!error) actualizados++;
        } else {
          noEncontrados.push(`"${clasif.nombre}" (Padre: ${clasif.maestros_centros_costo || 'VACÍO'})`);
        }
      }

      if (noEncontrados.length > 0) {
        console.warn("Registros sin padre encontrado:", noEncontrados);
        toast.error(`Migración parcial: ${actualizados} actualizados. ${noEncontrados.length} no tenían coincidencia exacta. Revisa la consola.`);
      } else {
        toast.success(`Migración completada con éxito: ${actualizados} registros actualizados.`);
      }
      cargarDatos();
    } catch (err) {
      toast.error("Error en migración: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const guardarItem = async (e, cerrarDespues = true) => {
    if (e) e.preventDefault();
    if (!formData.nombre.trim()) return toast.error('El nombre es obligatorio');
    
    const config = LISTAS.find(l => l.id === listaActiva);
    
    // Validar duplicados (case insensitive)
    const duplicado = datos.find(d => 
      d.nombre.toLowerCase() === formData.nombre.toLowerCase() && d.id !== editandoItem?.id
    );
    if (duplicado) return toast.error('Ya existe un ítem con ese nombre en esta lista');

    try {
      setLoading(true);
      const idColumn = listaActiva === 'clasificaciones' ? 'centro_costo_id' : 
                      listaActiva === 'categorias' ? 'clasificacion_id' : null;
      
      const textColumn = null; 
      const itemsAux = listaActiva === 'clasificaciones' ? centrosCosto : clasificaciones;

      const nombreGuardado = formData.nombre.trim();

      if (editandoItem) {
        const payload = { 
          nombre: nombreGuardado,
          activo: true
        };
        
        if (listaActiva === 'cargos') {
          payload.nivel = formData.nivel;
          payload.permisos_default = formData.permisos_default;
        }

        if (idColumn && formData.padre_ids.length > 0) {
          payload[idColumn] = formData.padre_ids[0];
        }
        
        const { error } = await supabase.from(config.table).update(payload).eq('id', editandoItem.id);
        if (error) throw error;
      } else {
        const itemsToInsert = formData.padre_ids.length > 0 
          ? formData.padre_ids.map(pid => ({
              nombre: nombreGuardado,
              activo: true,
              [idColumn]: pid
            }))
          : [{ 
              nombre: nombreGuardado, 
              activo: true,
              ...(listaActiva === 'cargos' ? { 
                nivel: formData.nivel, 
                permisos_default: formData.permisos_default 
              } : {})
            }];

        const { error } = await supabase.from(config.table).insert(itemsToInsert);
        if (error) throw error;
      }
      
      toast.success(editandoItem ? 'Actualizado con éxito' : 'Guardado con éxito');
      
      // Historial de la sesión actual del modal
      setRecienAgregados(prev => [nombreGuardado, ...prev.slice(0, 4)]);

      if (cerrarDespues) {
        setModalAbierto(false);
        setEditandoItem(null);
        setFormData({ nombre: '', padre_ids: [], nivel: 99, permisos_default: {} });
        setRecienAgregados([]);
      } else {
        setFormData(prev => ({ ...prev, nombre: '' }));
        // Devolver el foco
        setTimeout(() => inputNombreRef.current?.focus(), 100);
      }
      
      cargarDatos();
    } catch (err) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filtrarYAgruparDatos = () => {
    // 1. Filtrado inicial por búsqueda y por CC
    let filtrados = datos.filter(d => {
      const matchBusqueda = d.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                          (d.maestros_centros_costo?.nombre || '').toLowerCase().includes(busqueda.toLowerCase()) ||
                          (d.maestros_clasificaciones?.nombre || '').toLowerCase().includes(busqueda.toLowerCase());
      
      const matchCC = !filtroCC || 
                     (listaActiva === 'centros_costo' && d.id.toString() === filtroCC) ||
                     (listaActiva === 'clasificaciones' && d.centro_costo_id?.toString() === filtroCC) ||
                     (listaActiva === 'categorias' && d.maestros_clasificaciones?.centro_costo_id?.toString() === filtroCC);

      return matchBusqueda && matchCC;
    });

    if (listaActiva === 'centros_costo') return filtrados;

    // 2. Agrupamiento por nombre
    const grupos = {};
    filtrados.forEach(item => {
      if (!grupos[item.nombre]) {
        grupos[item.nombre] = {
          nombre: item.nombre,
          items: [],
          todosActivos: true
        };
      }
      grupos[item.nombre].items.push(item);
      if (!item.activo) grupos[item.nombre].todosActivos = false;
    });

    return Object.values(grupos);
  };

  return (
    <div className="atributos-container">
      <div className="atributos-header">
        <div>
          <h1 className="atributos-title">Configuración de Atributos</h1>
          <p className="atributos-subtitle">Gestiona las listas maestras y parámetros globales del sistema de compras.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {listaActiva === 'centros_costo' && (
            <button 
              className="btn-add" 
              style={{ backgroundColor: '#6366f1' }} 
              onClick={async () => {
                const { data } = await supabase.from('maestros_centros_costo').select('id, nombre').eq('activo', true);
                setCentrosCosto(data || []);
                setModalCopiarAbierto(true);
              }}
            >
              <Users size={18} /> COPIAR CONFIGURACIÓN
            </button>
          )}
          {listaActiva === 'clasificaciones' && (
            <button key="btn-migrar" className="btn-add" style={{ backgroundColor: '#f59e0b' }} onClick={ejecutarMigracionClasificaciones}>
              ⚙️ MIGRAR DATOS
            </button>
          )}
          <button key="btn-add-new" className="btn-add" onClick={() => {
            setEditandoItem(null);
            setFormData({ nombre: '', padre_ids: [], nivel: 99, permisos_default: {} });
            setModalAbierto(true);
          }}>
            <Plus size={18} /> AGREGAR NUEVO
          </button>
        </div>
      </div>

      <div className="config-grid">
        {/* Selector de Listas */}
        <div className="selector-panel">
          {GRUPOS_ATRIBUTOS.map((grupo, idx) => (
            <div key={idx} style={{ marginBottom: '25px' }}>
              <label style={{ fontSize: '0.65rem', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px', display: 'block', letterSpacing: '0.05em' }}>
                {grupo.titulo}
              </label>
              {grupo.listas.map(idLista => {
                const lista = LISTAS.find(l => l.id === idLista);
                if (!lista) return null;
                return (
                  <div 
                    key={lista.id} 
                    className={`selector-item ${listaActiva === lista.id ? 'active' : ''}`}
                    onClick={() => {
                      setListaActiva(lista.id);
                      setBusqueda('');
                    }}
                  >
                    {lista.icon}
                    <span style={{ flex: 1 }}>{lista.label}</span>
                    <ChevronRight size={16} opacity={listaActiva === lista.id ? 1 : 0.3} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Panel de Contenido */}
        <div className="main-content-panel">
          <div className="table-controls" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <div className="search-input-wrapper" style={{ flex: 2 }}>
              <Search className="search-icon" size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
              <input 
                type="text" 
                className="search-input" 
                placeholder={`Buscar en ${LISTAS.find(l => l.id === listaActiva).label}...`}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            {(listaActiva === 'clasificaciones' || listaActiva === 'categorias') && (
              <select 
                className="form-input" 
                style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }}
                value={filtroCC}
                onChange={(e) => setFiltroCC(e.target.value)}
              >
                <option value="">Filtrar por Centro de Costo...</option>
                {centrosCosto.map(cc => (
                  <option key={cc.id} value={cc.id}>{cc.nombre}</option>
                ))}
              </select>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <div className="custom-checkbox" onClick={seleccionarTodo}>
                      {seleccionados.length > 0 && <Check size={14} className="custom-checkbox-mark" strokeWidth={3} />}
                    </div>
                  </th>
                  <th>Nombre del Atributo</th>
                  {listaActiva === 'cargos' && (
                    <>
                      <th style={{ width: '80px', textAlign: 'center' }}>Nivel</th>
                      <th style={{ width: '35%' }}>Privilegios Asignados</th>
                    </>
                  )}
                  {(listaActiva === 'clasificaciones' || listaActiva === 'categorias') && (
                    <th style={{ width: '40%' }}>{listaActiva === 'clasificaciones' ? 'Vinculado a Sedes' : 'Vinculado a Padres / Sedes'}</th>
                  )}
                  <th style={{ textAlign: 'center' }}>Estado</th>
                  <th style={{ textAlign: 'right' }}>ID(s)</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={listaActiva === 'centros_costo' ? 4 : listaActiva === 'cargos' ? 6 : 5} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Cargando datos...</td></tr>
                ) : filtrarYAgruparDatos().length === 0 ? (
                  <tr><td colSpan={listaActiva === 'centros_costo' ? 4 : listaActiva === 'cargos' ? 6 : 5} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No se encontraron resultados</td></tr>
                ) : filtrarYAgruparDatos().map((grupoOrItem) => {
                  const isGrupo = listaActiva !== 'centros_costo';
                  const nombre = grupoOrItem.nombre;
                  const items = isGrupo ? grupoOrItem.items : [grupoOrItem];
                  const esExpandido = filasExpandidas[nombre];

                  return (
                    <React.Fragment key={nombre}>
                      <tr 
                        className={`row-hover ${esExpandido ? 'row-expanded-parent' : ''}`}
                        onClick={() => isGrupo && items.length > 1 && setFilasExpandidas({...filasExpandidas, [nombre]: !esExpandido})}
                        style={{ cursor: isGrupo && items.length > 1 ? 'pointer' : 'default' }}
                      >
                        <td style={{ textAlign: 'center' }}>
                          <div 
                            className={`custom-checkbox ${items.every(it => seleccionados.includes(it.id)) ? 'checked' : ''}`} 
                            onClick={(e) => {
                              e.stopPropagation();
                              const groupIds = items.map(it => it.id);
                              const allIn = groupIds.every(id => seleccionados.includes(id));
                              if (allIn) {
                                setSeleccionados(prev => prev.filter(id => !groupIds.includes(id)));
                              } else {
                                setSeleccionados(prev => Array.from(new Set([...prev, ...groupIds])));
                              }
                            }}
                          >
                            {items.every(it => seleccionados.includes(it.id)) && <Check size={14} className="custom-checkbox-mark" strokeWidth={3} />}
                            {!items.every(it => seleccionados.includes(it.id)) && items.some(it => seleccionados.includes(it.id)) && <div style={{ width: '8px', height: '2px', backgroundColor: '#0ea5e9' }} />}
                          </div>
                        </td>
                        <td style={{ fontWeight: '700', color: '#1e293b' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {isGrupo && items.length > 1 && (
                              <ChevronRight 
                                size={14} 
                                style={{ 
                                  transform: esExpandido ? 'rotate(90deg)' : 'rotate(0deg)', 
                                  transition: 'transform 0.2s',
                                  color: '#0ea5e9'
                                }} 
                              />
                            )}
                            {nombre}
                          </div>
                        </td>
                        
                        {listaActiva === 'cargos' && (
                          <>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ 
                                backgroundColor: items[0].nivel <= 2 ? '#eff6ff' : '#f8fafc',
                                color: items[0].nivel <= 2 ? '#3b82f6' : '#64748b',
                                padding: '4px 10px',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                                border: '1px solid',
                                borderColor: items[0].nivel <= 2 ? '#bfdbfe' : '#e2e8f0'
                              }}>
                                L{items[0].nivel || 99}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {PERMISOS_DISPONIBLES.filter(p => items[0].permisos_default?.[p.id]).length > 0 ? (
                                  PERMISOS_DISPONIBLES.filter(p => items[0].permisos_default?.[p.id]).map(p => (
                                    <span key={p.id} style={{ fontSize: '0.65rem', backgroundColor: '#f0fdf4', color: '#15803d', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', border: '1px solid #dcfce7' }}>
                                      {p.label.split('(')[0]}
                                    </span>
                                  ))
                                ) : (
                                  <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontStyle: 'italic' }}>Sin privilegios especiales</span>
                                )}
                              </div>
                            </td>
                          </>
                        )}

                        {(listaActiva === 'clasificaciones' || listaActiva === 'categorias') && (
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {items.length === centrosCosto.length && centrosCosto.length > 0 ? (
                                <span className="badge-sede all">TODAS LAS SEDES</span>
                              ) : (
                                items.slice(0, 5).map(it => {
                                  const textPadre = listaActiva === 'clasificaciones' 
                                    ? (it.maestros_centros_costo?.nombre || 'General')
                                    : (it.maestros_clasificaciones?.nombre || 'General');
                                  return (
                                    <span key={it.id} className="badge-sede">
                                      {textPadre}
                                    </span>
                                  );
                                })
                              )}
                              {items.length > 5 && items.length !== centrosCosto.length && (
                                <span className="badge-sede more">+{items.length - 5} más</span>
                              )}
                            </div>
                          </td>
                        )}

                        <td style={{ textAlign: 'center' }}>
                          <span className={`status-pill ${items.every(i => i.activo !== false) ? 'status-active' : items.some(i => i.activo !== false) ? 'status-partial' : 'status-inactive'}`}>
                            {items.every(i => i.activo !== false) ? 'Activo' : items.some(i => i.activo !== false) ? 'Parcial' : 'Inactivo'}
                          </span>
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'monospace', fontWeight: 'bold' }}>
                              {items.length === 1 ? `#${items[0].id}` : `${items.length} IDs`}
                            </span>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button 
                                className="action-btn edit"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditandoItem(items[0]);
                                  setFormData({
                                    nombre: nombre,
                                    padre_ids: items.map(i => i.id),
                                    nivel: items[0].nivel || 99,
                                    permisos_default: items[0].permisos_default || {}
                                  });
                                  setModalAbierto(true);
                                }}
                                title="Editar nombre"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                className="action-btn toggle"
                                style={{ color: '#ef4444' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEliminarGrupo(nombre, items);
                                }}
                                title="Eliminar de todas las sedes"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Fila de Detalle (Accordion) */}
                      {esExpandido && items.length > 1 && (
                        <tr className="row-detail-content">
                          <td colSpan={listaActiva === 'centros_costo' ? 4 : listaActiva === 'cargos' ? 6 : 5} style={{ padding: '0px' }}>
                            <div style={{ padding: '15px 15px 15px 45px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                                {items.map(it => {
                                  const padreActual = listaActiva === 'clasificaciones' ? it.maestros_centros_costo?.nombre : it.maestros_clasificaciones?.nombre;
                                  const isSelected = seleccionados.includes(it.id);
                                  return (
                                    <div 
                                      key={it.id} 
                                      style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center', 
                                        padding: '8px 12px', 
                                        backgroundColor: isSelected ? '#eff6ff' : 'white', 
                                        borderRadius: '8px', 
                                        border: isSelected ? '1px solid #bfdbfe' : '1px solid #e2e8f0' 
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div className="custom-checkbox" style={{ width: '18px', height: '18px' }} onClick={() => toggleSeleccion(it.id)}>
                                          {isSelected && <Check size={12} className="custom-checkbox-mark" strokeWidth={3} />}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569' }}>
                                            {padreActual}
                                          </span>
                                          <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>ID DB: #{it.id}</span>
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', gap: '4px' }}>
                                        <button 
                                          className="action-btn toggle" 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleEstado(it);
                                          }}
                                          title={it.activo ? 'Desactivar' : 'Activar'}
                                        >
                                          {it.activo !== false ? <ToggleRight size={20} color="#10b981" /> : <ToggleLeft size={20} color="#94a3b8" />}
                                        </button>
                                        <button 
                                          className="action-btn toggle" 
                                          style={{ color: '#94a3b8' }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleEliminarItem(it.id, nombre, padreActual);
                                          }}
                                          title="Eliminar este vínculo"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {seleccionados.length > 0 && (
        <div className="bulk-action-bar animate-slide-up">
          <div className="bulk-info">
            <div className="selection-count">
              {seleccionados.length}
            </div>
            <span style={{ fontWeight: '600', color: '#1e293b' }}>
              {seleccionados.length === 1 ? 'Ítem seleccionado' : 'Ítems seleccionados'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="bulk-btn cancel" onClick={() => setSeleccionados([])}>
              Descartar
            </button>
            <button className="bulk-btn delete" onClick={handleEliminarSeleccionados}>
              <Trash2 size={18} /> Eliminar Seleccionados
            </button>
          </div>
        </div>
      )}

      {/* Modal de Creación / Edición */}
      {modalAbierto && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">{editandoItem ? 'Editar Ítem' : `Agregar a ${LISTAS.find(l => l.id === listaActiva).label}`}</h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '5px' }}>
                Complete los campos para {editandoItem ? 'modificar' : 'crear'} el registro.
              </p>
            </div>

            <form onSubmit={guardarItem}>
              <div className="form-group">
                <label className="form-label">Nombre del Atributo</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Escriba el nombre..."
                  value={formData.nombre}
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      guardarItem(null, false);
                    }
                  }}
                  ref={inputNombreRef}
                  autoFocus
                />
              </div>

              {listaActiva === 'cargos' && (
                <div style={{ marginTop: '20px' }}>
                  <div className="form-group">
                    <label className="form-label">Nivel Jerárquico (1: Máximo, 99: Base)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={formData.nivel} 
                      onChange={e => setFormData({...formData, nivel: parseInt(e.target.value) || 99})} 
                    />
                  </div>

                  <label className="form-label" style={{ marginTop: '20px', display: 'block' }}>Capacidades y Privilegios</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                    {PERMISOS_DISPONIBLES.map(p => (
                      <div 
                        key={p.id} 
                        onClick={() => setFormData({
                          ...formData, 
                          permisos_default: {
                            ...formData.permisos_default,
                            [p.id]: !formData.permisos_default[p.id]
                          }
                        })}
                        style={{ 
                          padding: '12px', 
                          borderRadius: '10px', 
                          border: '1px solid #e2e8f0', 
                          cursor: 'pointer',
                          backgroundColor: formData.permisos_default[p.id] ? '#eff6ff' : 'white',
                          borderColor: formData.permisos_default[p.id] ? '#3b82f6' : '#e2e8f0'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className={`custom-checkbox ${formData.permisos_default[p.id] ? 'checked' : ''}`} style={{ width: '18px', height: '18px' }}>
                            {formData.permisos_default[p.id] && <Check size={12} strokeWidth={3} color="white" />}
                          </div>
                          <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#1e293b' }}>{p.label}</span>
                        </div>
                        <p style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '4px', marginLeft: '28px' }}>{p.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {listaActiva !== 'centros_costo' && (
                <div className="form-group" style={{ marginTop: '25px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <label className="form-label" style={{ margin: 0 }}>
                      {editandoItem ? 'Vincular a Padre' : 'Vincular a varios Padres (Multiselección)'}
                    </label>
                    {!editandoItem && (
                      <button 
                        type="button" 
                        className="btn-text-action"
                        onClick={() => {
                          const options = listaActiva === 'clasificaciones' ? centrosCosto : clasificaciones;
                          const allIds = options.map(o => o.id);
                          const areAllSelected = formData.padre_ids.length === allIds.length;
                          setFormData({ ...formData, padre_ids: areAllSelected ? [] : allIds });
                        }}
                      >
                        {formData.padre_ids.length === (listaActiva === 'clasificaciones' ? centrosCosto : clasificaciones).length ? 'Limpiar Todo' : 'Seleccionar Todos'}
                      </button>
                    )}
                  </div>
                  
                  <div className="parent-selection-container">
                    {(() => {
                      const options = listaActiva === 'clasificaciones' ? centrosCosto : clasificaciones;
                      const groups = {};
                      options.forEach(op => {
                        if (!groups[op.nombre]) groups[op.nombre] = [];
                        groups[op.nombre].push(op);
                      });

                      return Object.entries(groups).map(([nombre, items]) => {
                        const allIds = items.map(i => i.id);
                        const estanTodosSeleccionados = allIds.every(id => formData.padre_ids.includes(id));
                        const estaExpandido = gruposExpandidos[nombre];
                        const tieneHijos = items.some(i => i.maestros_centros_costo?.nombre);

                        return (
                          <div key={nombre} className="parent-group-wrapper" style={{ marginBottom: '8px' }}>
                            <div 
                              className={`parent-card ${estanTodosSeleccionados ? 'selected' : ''}`}
                              style={{ padding: '12px 16px' }}
                            >
                              <div className="custom-checkbox" onClick={(e) => {
                                e.stopPropagation();
                                if (editandoItem) {
                                  // En edición no permitimos grupos
                                  setFormData({...formData, padre_ids: [items[0].id]});
                                } else {
                                  let nuevas;
                                  if (estanTodosSeleccionados) {
                                    nuevas = formData.padre_ids.filter(id => !allIds.includes(id));
                                  } else {
                                    nuevas = Array.from(new Set([...formData.padre_ids, ...allIds]));
                                  }
                                  setFormData({...formData, padre_ids: nuevas});
                                }
                              }}>
                                {estanTodosSeleccionados && <Check size={14} className="custom-checkbox-mark" strokeWidth={3} />}
                              </div>
                              
                              <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => setGruposExpandidos({...gruposExpandidos, [nombre]: !estaExpandido})}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span className="parent-name">{nombre}</span>
                                  <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '500' }}>
                                    {items.length} {items.length === 1 ? 'Sede / Padre' : 'Sedes / Padres'}
                                  </span>
                                </div>
                                {items.length > 1 && (
                                  <div style={{ color: '#94a3b8' }}>
                                    {estaExpandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Sub-listado Expandido */}
                            {estaExpandido && items.length > 1 && (
                              <div style={{ marginLeft: '20px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '2px solid #e2e8f0', paddingLeft: '12px' }}>
                                {items.map(subItem => {
                                  const subSeleccionado = formData.padre_ids.includes(subItem.id);
                                  return (
                                    <div 
                                      key={subItem.id} 
                                      className={`parent-card sub-card ${subSeleccionado ? 'selected' : ''}`}
                                      onClick={() => {
                                        if (editandoItem) {
                                          setFormData({...formData, padre_ids: [subItem.id]});
                                        } else {
                                          const nuevas = subSeleccionado 
                                            ? formData.padre_ids.filter(id => id !== subItem.id)
                                            : [...formData.padre_ids, subItem.id];
                                          setFormData({...formData, padre_ids: nuevas});
                                        }
                                      }}
                                      style={{ padding: '6px 12px', borderRadius: '10px' }}
                                    >
                                      <div className="custom-checkbox" style={{ width: '18px', height: '18px' }}>
                                        {subSeleccionado && <Check size={12} className="custom-checkbox-mark" strokeWidth={3} />}
                                      </div>
                                      <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>
                                        {subItem.maestros_centros_costo?.nombre || 'General'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                  {!editandoItem && (
                    <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '6px' }}>
                      * Al seleccionar varios, se creará una copia del atributo para cada uno automáticamente.
                    </p>
                  )}
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => {
                  setModalAbierto(false);
                  setRecienAgregados([]);
                }}>Cancelar</button>
                
                {!editandoItem && (
                  <button 
                    type="button" 
                    className="btn-save" 
                    style={{ backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}
                    onClick={(e) => guardarItem(e, false)}
                    disabled={loading}
                  >
                    {loading ? '...' : 'Guardar y Añadir Otro'}
                  </button>
                )}

                <button 
                  type="submit" 
                  className="btn-save"
                  disabled={loading}
                  onClick={(e) => guardarItem(e, true)}
                >
                  {loading ? 'Guardando...' : editandoItem ? 'Guardar Cambios' : 'Guardar y Cerrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal de Copiado de Configuración */}
      {modalCopiarAbierto && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Copiar Configuración de Centro de Costo</h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '5px' }}>
                Esta herramienta clonará todas las clasificaciones y equipos de un centro de costo a otro.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
              <div className="form-group">
                <label className="form-label">Centro de Costo ORIGEN (Desde donde se copia)</label>
                <select 
                  className="form-input"
                  value={copiaOrigen}
                  onChange={(e) => setCopiaOrigen(e.target.value)}
                >
                  <option value="">Seleccione origen...</option>
                  {centrosCosto.map(cc => (
                    <option key={cc.id} value={cc.id}>{cc.nombre}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <ChevronDown size={24} color="#94a3b8" />
              </div>

              <div className="form-group">
                <label className="form-label">Centro de Costo DESTINO (Hacia donde se copia)</label>
                <select 
                  className="form-input"
                  value={copiaDestino}
                  onChange={(e) => setCopiaDestino(e.target.value)}
                >
                  <option value="">Seleccione destino...</option>
                  {centrosCosto.map(cc => (
                    <option key={cc.id} value={cc.id}>{cc.nombre}</option>
                  ))}
                </select>
              </div>

              <div style={{ 
                padding: '15px', 
                backgroundColor: '#fef2f2', 
                border: '1px solid #fecaca', 
                borderRadius: '12px',
                color: '#991b1b',
                fontSize: '0.75rem',
                lineHeight: '1.4'
              }}>
                <strong>Nota:</strong> Se crearán nuevos registros. Si ya existen clasificaciones con el mismo nombre en el destino, se omitirán para evitar duplicidad.
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '30px' }}>
              <button 
                type="button" 
                className="btn-cancel" 
                onClick={() => setModalCopiarAbierto(false)}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn-save"
                style={{ backgroundColor: '#6366f1' }}
                disabled={loading || !copiaOrigen || !copiaDestino}
                onClick={ejecutarCopiaConfiguracion}
              >
                {loading ? 'Copiando...' : 'Iniciar Copiado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Atributos;
