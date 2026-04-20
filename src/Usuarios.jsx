import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { 
  Eye, EyeOff, UserPlus, Save, X, Shield, Trash2, UserCircle, 
  Settings, ShieldCheck, Layout, Activity 
} from 'lucide-react';
import toast from 'react-hot-toast';

const Usuarios = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosFiltrados, setUsuariosFiltrados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroDpto, setFiltroDpto] = useState('Todos');
  const [filtroCargo, setFiltroCargo] = useState('Todos');
  const [showModal, setShowModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [verPassword, setVerPassword] = useState(false);
  const [gerencias, setGerencias] = useState([]);
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [tabActiva, setTabActiva] = useState('general');

  // Cliente de administración para gestionar usuarios sin cerrar sesión ni sobrescribir claves
  const adminClient = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const [formData, setFormData] = useState({ 
    id: null, nombre: '', apellido: '', correo: '', 
    rol: '', departamento: '', gerencia_id: '', 
    foto_url: '', contrato: '', activo: true,
    password: '', 
    permisos_modulos: ["requisiciones", "fondos", "tickets", "usuarios"],
    capacidades: {}
  });

  const MODULOS_DISPONIBLES = [
    { id: 'requisiciones', label: 'Requisiciones' },
    { id: 'fondos', label: 'Solicitud de Fondos' },
    { id: 'tickets', label: 'Ticket de Pago' },
    { id: 'compras', label: 'Compras' },
    { id: 'reportes', label: 'Reporte de Compras' },
    { id: 'proveedores', label: 'Proveedores' },
    { id: 'usuarios', label: 'Gestión de Usuarios' },
    { id: 'administracion', label: 'Administración' }
  ];

  const ADMIN_EMAIL = 'jcontreras.totalclean@gmail.com';


  const CAPACIDADES_DISPONIBLES = [
    { id: 'ver_global', label: 'Ver Historial Global', desc: 'Acceso a todas las sedes' },
    { id: 'ver_departamento', label: 'Ver Historial de Depto.', desc: 'Acceso a su propio departamento' },
    { id: 'puede_aprobar_area', label: 'Aprobación Nivel 1', desc: 'Gerente de Área' },
    { id: 'puede_aprobar_final', label: 'Aprobación Nivel 2', desc: 'Gerencia General' },
    { id: 'gestionar_usuarios', label: 'Gestión de Usuarios', desc: 'Crear/Editar personal' },
    { id: 'acceso_compras', label: 'Módulo de Compras', desc: 'Procesamiento de órdenes' },
    { id: 'gestionar_atributos', label: 'Configuración de Atributos', desc: 'Listas maestras' }
  ];

  const obtenerMaestros = async () => {
    try {
      const { data: g } = await adminClient.from('cat_gerencias').select('*').order('nombre');
      if (g) setGerencias(g);

      const { data: cc } = await supabase.from('maestros_centros_costo').select('*').eq('activo', true).order('nombre');
      if (cc) setCentrosCosto(cc);

      const { data: cr } = await supabase.from('cat_cargos').select('*').eq('activo', true).order('nivel');
      if (cr) setCargos(cr);
    } catch (e) {
      console.error("Error cargando maestros:", e);
    }
  };

  const obtenerUsuarios = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email;
      const { data, error } = await supabase.from('perfiles').select('*').order('apellido', { ascending: true });

      if (!error) {
        const miPerfil = data.find(u => u.correo === userEmail);
        const esAdminReal = userEmail === ADMIN_EMAIL;
        setCurrentUser({ ...miPerfil, esAdminReal });
        const lista = (esAdminReal || miPerfil?.rol === 'Gerente General') ? data : data.filter(u => u.departamento === miPerfil?.departamento);
        
        // Mapeo dinámico para rellenar gerencia_id basado en el nombre del departamento si está vacío
        const listaConIDs = lista.map(u => {
          if (u.gerencia_id) return u;
          const matchingG = gerencias.find(g => g.nombre === u.departamento);
          return { ...u, gerencia_id: matchingG?.id || '' };
        });

        setUsuarios(listaConIDs);
      }
    } catch (e) {
      console.error("Error cargando usuarios:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    obtenerUsuarios(); 
    obtenerMaestros();
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes slideUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
      .animate-main { animation: slideUp 0.4s ease-out; }
      .row-hover:hover { background-color: #f1f5f9 !important; transition: 0.2s; }
      .input-style { padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 0.85rem; outline: none; transition: 0.2s; background: white; }
      .input-style:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1); }
      .btn-primary { background: #0ea5e9; color: white; border: none; padding: 10px 20px; border-radius: 12px; font-weight: 600; cursor: pointer; transition: 0.2s; }
      .btn-primary:hover { background: #0284c7; transform: translateY(-1px); }
      .stat-card-new { 
        background: white; padding: 20px; border-radius: 16px; 
        box-shadow: 0 2px 10px rgba(0,0,0,0.03); flex: 1; min-width: 200px; 
        position: relative; overflow: hidden; border: 1px solid #f1f5f9;
      }
      .stat-card-new::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 5px; }
      .stat-total::before { background-color: #0ea5e9; }
      .stat-gerente::before { background-color: #f59e0b; }
    `;
    document.head.appendChild(style);
  }, []);

  // Efecto para heredar permisos cuando cambia el cargo
  useEffect(() => {
    if (!formData.id && formData.rol) { // Solo si es nuevo usuario
      const r = cargos.find(c => c.nombre === formData.rol);
      if (r && r.permisos_default) {
        let sugeridos = ['requisiciones', 'fondos', 'tickets']; // Básicos
        if (r.permisos_default.gestionar_usuarios) sugeridos.push('usuarios');
        if (r.permisos_default.acceso_compras) sugeridos.push('compras', 'reportes', 'proveedores');
        if (r.permisos_default.gestionar_atributos) sugeridos.push('administracion');
        
        setFormData(prev => ({
          ...prev, 
          permisos_modulos: [...new Set(sugeridos)],
          capacidades: r.permisos_default || {}
        }));
      }
    }
  }, [formData.rol, cargos]);

  useEffect(() => {
    let resultado = usuarios.filter(u => {
      const nombreCompleto = `${u.nombre} ${u.apellido}`.toLowerCase();
      const coincideNombre = nombreCompleto.includes(busqueda.toLowerCase());
      const coincideDepto = filtroDpto === 'Todos' || u.departamento === filtroDpto;
      const coincideCargo = filtroCargo === 'Todos' || u.rol === filtroCargo;
      return coincideNombre && coincideDepto && coincideCargo;
    });
    setUsuariosFiltrados(resultado);
  }, [busqueda, filtroDpto, filtroCargo, usuarios]);

  const guardarUsuario = async () => {
    if (!currentUser?.esAdminReal && currentUser?.rol !== 'Gerente General') return;
    if(!formData.rol || !formData.gerencia_id) return toast.error("Asigne Cargo y Gerencia.");
    
    setLoading(true);
    try {
      const { password, ...datosRestantes } = formData;
      const gerenciaObj = gerencias.find(g => g.id === formData.gerencia_id);
      
      const payload = {
        ...datosRestantes,
        departamento: gerenciaObj?.nombre || formData.departamento,
        activo: formData.activo !== false,
        gerencia_id: formData.gerencia_id
      };

      if (formData.id) {
        if (password && password.length >= 6) {
           const { error: authError } = await adminClient.auth.admin.updateUserById(formData.id, { password: password });
           if (authError) throw new Error("Error en Auth: " + authError.message);
           toast.success("Contraseña actualizada");
        }
        const { error } = await supabase.from('perfiles').update(payload).eq('id', formData.id);
        if (error) {
            if (error.code === '42703') { // Columna no existe en DB
                const { gerencia_id, ...payloadSafe } = payload;
                const { error: retryError } = await supabase.from('perfiles').update(payloadSafe).eq('id', formData.id);
                if (retryError) throw retryError;
            } else throw error;
        }
        toast.success("Perfil actualizado con éxito");
      } else {
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({ 
          email: formData.correo, 
          password: password || '123456',
          email_confirm: true 
        });
        if (authError) throw authError;

        const { error: profileError } = await supabase.from('perfiles').insert([{ 
          ...payload, id: authData.user.id 
        }]);
        if (profileError) {
             if (profileError.code === '42703') {
                const { gerencia_id, ...payloadSafe } = payload;
                const { error: retryError } = await supabase.from('perfiles').insert([{ ...payloadSafe, id: authData.user.id }]);
                if (retryError) throw retryError;
             } else throw profileError;
        }
        toast.success("Usuario creado exitosamente");
      }

      obtenerUsuarios();
      setShowModal(false);
      setFormData({ 
        id: null, nombre: '', apellido: '', correo: '', rol: '', departamento: '', gerencia_id: '',
        foto_url: '', contrato: '', activo: true, password: '', 
        permisos_modulos: ["requisiciones", "fondos", "tickets", "usuarios"],
        capacidades: {}
      });
      setVerPassword(false);
      setTabActiva('general');
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  const eliminarUsuarioTotal = async (id, correo) => {
    if (!currentUser?.esAdminReal) return;
    if (!window.confirm(`¿PELIGRO! Esta acción eliminará PERMANENTEMENTE a ${correo} de todo el sistema. Esta acción no se puede deshacer. ¿Deseas continuar?`)) return;

    setLoading(true);
    try {
      const { error: authError } = await adminClient.auth.admin.deleteUser(id);
      if (authError) throw new Error("Error eliminando acceso: " + authError.message);
      const { error } = await supabase.from('perfiles').delete().eq('id', id);
      if (error) throw error;
      toast.success("Usuario eliminado definitivamente");
      obtenerUsuarios();
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };

  const estilos = {
    contenedor: { padding: '30px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: "'Outfit', sans-serif" },
    tarjeta: { backgroundColor: 'white', padding: '30px', borderRadius: '30px', boxShadow: '0 10px 40px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' },
    modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 },
    modalContent: { backgroundColor: 'white', width: '900px', maxWidth: '95vw', borderRadius: '32px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', animation: 'slideUp 0.3s ease-out' },
    panelLeft: { padding: '40px', borderRight: '1px solid #f1f5f9' },
    panelRight: { padding: '40px', backgroundColor: '#f8fafc' },
    th: { textAlign: 'left', padding: '16px', color: '#64748b', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' },
    td: { padding: '16px', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem', color: '#1e293b' },
    badge: (rol) => ({ padding: '5px 12px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '600', backgroundColor: rol?.includes('Gerente') ? '#eff6ff' : '#f1f5f9', color: rol?.includes('Gerente') ? '#3b82f6' : '#64748b' }),
    tab: (active) => ({ flex: 1, padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', borderBottom: active ? '3px solid #3b82f6' : '3px solid transparent', backgroundColor: active ? '#f8fafc' : 'white', transition: '0.3s', color: active ? '#3b82f6' : '#94a3b8', fontWeight: active ? 'bold' : 'normal' }),
  };

  return (
    <div className="animate-main" style={estilos.contenedor}>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '25px', flexWrap: 'wrap' }}>
        <div className="stat-card-new stat-total">
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' }}>Personal Total</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#1e293b' }}>{usuariosFiltrados.length}</div>
        </div>
        <div className="stat-card-new stat-gerente">
          <div style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: '800', textTransform: 'uppercase' }}>Departamentos</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#1e293b' }}>{usuariosFiltrados.filter(u => u.rol?.includes('Gerente')).length}</div>
        </div>
      </div>

      <div style={estilos.tarjeta}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <h2 style={{ fontSize: '1.4rem', color: '#0f172a', margin: 0 }}>Gestión de Usuarios</h2>
          {(currentUser?.esAdminReal || currentUser?.rol === 'Gerente General') && (
            <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => { setFormData({id:null, nombre:'', apellido:'', correo:'', rol:'', departamento:'', gerencia_id:'', contrato:'', activo: true, foto_url:'', password: '', permisos_modulos: ["requisiciones", "fondos", "tickets", "usuarios"], capacidades: {}}); setShowModal(true); }}>
              <UserPlus size={18} /> Nuevo Integrante
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '15px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', marginBottom: '25px' }}>
          <input className="input-style" style={{ flex: 2 }} placeholder="Buscar por nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <select className="input-style" style={{ flex: 1 }} value={filtroDpto} onChange={e => setFiltroDpto(e.target.value)}>
            <option value="Todos">Todos los Departamentos</option>
            {gerencias.map(g => <option key={g.id} value={g.nombre}>{g.nombre}</option>)}
          </select>
          <select className="input-style" style={{ flex: 1 }} value={filtroCargo} onChange={e => setFiltroCargo(e.target.value)}>
            <option value="Todos">Todos los Cargos</option>
            {cargos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={estilos.th}>Colaborador</th>
                <th style={estilos.th}>Cargo</th>
                <th style={estilos.th}>Departamento</th>
                <th style={estilos.th}>Atribuciones</th>
                <th style={estilos.th}>C. Costo</th>
                <th style={estilos.th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.map(u => (
                <tr key={u.id} className="row-hover">
                  <td style={estilos.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {u.foto_url ? <img src={u.foto_url} style={{ width: '100%' }} /> : <UserCircle color="#cbd5e1" />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{u.nombre} {u.apellido}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{u.correo}</div>
                      </div>
                    </div>
                  </td>
                  <td style={estilos.td}><span style={estilos.badge(u.rol)}>{u.rol}</span></td>
                  <td style={estilos.td}>{u.departamento || 'Sin asignar'}</td>
                  <td style={estilos.td}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '300px' }}>
                      {/* Capacidades Especiales */}
                      {CAPACIDADES_DISPONIBLES.filter(p => u.capacidades?.[p.id]).map(p => (
                        <span key={p.id} style={{ fontSize: '0.6rem', backgroundColor: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', border: '1px solid #dcfce7' }}>
                          {p.label}
                        </span>
                      ))}
                      {/* Resumen de Módulos (si son muchos, mostramos contador) */}
                      {u.permisos_modulos?.length > 0 && (
                        <span style={{ fontSize: '0.6rem', backgroundColor: '#eff6ff', color: '#3b82f6', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', border: '1px solid #dbeafe' }}>
                          {u.permisos_modulos.length} Módulos
                        </span>
                      )}
                      {!u.permisos_modulos?.length && !Object.values(u.capacidades || {}).some(v => v) && (
                        <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontStyle: 'italic' }}>Sin atribuciones</span>
                      )}
                    </div>
                  </td>
                  <td style={estilos.td}><span style={{ color: '#0ea5e9', fontWeight: 'bold' }}>{u.contrato}</span></td>
                  <td style={estilos.td}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <button onClick={() => { 
                        setFormData({ 
                          ...u, 
                          password: '',
                          capacidades: u.capacidades || {}
                        });
                        setVerPassword(false);
                        setTabActiva('general');
                        setShowModal(true); 
                      }} style={{ color: '#0ea5e9', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Editar</button>
                      <Trash2 size={16} color="#ef4444" style={{ cursor: 'pointer' }} onClick={() => eliminarUsuarioTotal(u.id, u.correo)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div style={estilos.modalOverlay}>
          <div style={estilos.modalContent}>
            {/* Header del Modal */}
            <div style={{ padding: '25px 40px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '45px', height: '45px', borderRadius: '14px', backgroundColor: '#3b82f615', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                  <UserPlus size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>{formData.id ? 'Editar Integrante' : 'Nuevo Integrante'}</h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>Asegúrate de asignar los permisos y cargos correctamente.</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ border: 'none', background: '#f1f5f9', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            {/* Tabs de Navegación */}
            <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9' }}>
              <div style={estilos.tab(tabActiva === 'general')} onClick={() => setTabActiva('general')}>
                <Layout size={18} /> General
              </div>
              <div style={estilos.tab(tabActiva === 'modulos')} onClick={() => setTabActiva('modulos')}>
                <Activity size={18} /> Módulos
              </div>
              <div style={estilos.tab(tabActiva === 'privilegios')} onClick={() => setTabActiva('privilegios')}>
                <ShieldCheck size={18} /> Privilegios
              </div>
            </div>

            <div style={{ padding: '40px', maxHeight: '60vh', overflowY: 'auto' }}>
              {tabActiva === 'general' && (
                <div className="tab-content" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px' }}>
                  <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '10px' }}>INFORMACIÓN PERSONAL</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <input className="input-style" placeholder="Nombre" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                      <input className="input-style" placeholder="Apellido" value={formData.apellido} onChange={e => setFormData({...formData, apellido: e.target.value})} />
                    </div>
                    <input className="input-style" style={{ width: '100%', marginBottom: '25px' }} placeholder="Correo Electrónico" value={formData.correo} onChange={e => setFormData({...formData, correo: e.target.value})} />

                    <label style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '10px' }}>ESTRUCTURA Y CARGO</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <select className="input-style" style={{ width: '100%' }} value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value})}>
                        <option value="">Seleccione Cargo...</option>
                        {cargos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                      </select>
                      <select className="input-style" value={formData.gerencia_id} onChange={e => setFormData({...formData, gerencia_id: e.target.value})}>
                        <option value="">Departamento...</option>
                        {gerencias.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                      </select>
                    </div>

                    <div style={{ marginTop: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <label style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b' }}>ACCESO AL SISTEMA</label>
                        <span style={{ fontSize: '0.65rem', color: '#3b82f6', fontWeight: 'bold' }}>Seguridad</span>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <input type={verPassword ? "text" : "password"} className="input-style" style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #3b82f6' }} placeholder={formData.id ? "Nueva contraseña" : "Contraseña inicial"} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                        <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#94a3b8' }} onClick={() => setVerPassword(!verPassword)}>
                          {verPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '10px' }}>ASIGNACIÓN DE COSTOS</label>
                    <select className="input-style" style={{ width: '100%' }} value={formData.contrato} onChange={e => setFormData({...formData, contrato: e.target.value})}>
                      <option value="">Centro de Costo...</option>
                      {centrosCosto.map(cc => <option key={cc.id} value={cc.nombre}>{cc.nombre}</option>)}
                    </select>

                    <div style={{ marginTop: '25px', padding: '20px', borderRadius: '15px', backgroundColor: '#f8fafc', border: '1.5px dashed #e2e8f0', textAlign: 'center' }}>
                      <UserCircle size={40} color="#94a3b8" />
                      <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '10px' }}>La foto de perfil se puede actualizar una vez registrado el usuario.</p>
                    </div>
                  </div>
                </div>
              )}

              {tabActiva === 'modulos' && (
                <div className="tab-content">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                    {MODULOS_DISPONIBLES.map(m => (
                      <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px 20px', backgroundColor: formData.permisos_modulos?.includes(m.id) ? '#eff6ff' : 'white', borderRadius: '16px', border: '1.5px solid', borderColor: formData.permisos_modulos?.includes(m.id) ? '#3b82f6' : '#e2e8f0', cursor: 'pointer', transition: '0.3s' }}>
                        <div className={`custom-checkbox ${formData.permisos_modulos?.includes(m.id) ? 'checked' : ''}`} style={{ width: '20px', height: '20px' }}>
                          <input type="checkbox" style={{ display: 'none' }} checked={formData.permisos_modulos?.includes(m.id)} onChange={(e) => {
                            const list = formData.permisos_modulos || [];
                            const updated = e.target.checked ? [...list, m.id] : list.filter(id => id !== m.id);
                            setFormData({...formData, permisos_modulos: updated});
                          }} />
                          {formData.permisos_modulos?.includes(m.id) && <Shield size={12} color="white" />}
                        </div>
                        <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1e293b' }}>{m.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {tabActiva === 'privilegios' && (
                <div className="tab-content">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                    {CAPACIDADES_DISPONIBLES.map(p => (
                      <div 
                        key={p.id} 
                        onClick={() => setFormData({
                          ...formData, 
                          capacidades: {
                            ...formData.capacidades,
                            [p.id]: !formData.capacidades?.[p.id]
                          }
                        })}
                        style={{ 
                          padding: '15px', 
                          borderRadius: '16px', 
                          border: '1.5px solid', 
                          cursor: 'pointer',
                          backgroundColor: formData.capacidades?.[p.id] ? '#f0fdf4' : 'white',
                          borderColor: formData.capacidades?.[p.id] ? '#22c55e' : '#e2e8f0'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className={`custom-checkbox ${formData.capacidades?.[p.id] ? 'checked' : ''}`} style={{ width: '18px', height: '18px', backgroundColor: formData.capacidades?.[p.id] ? '#22c55e' : '#e2e8f0' }}>
                            {formData.capacidades?.[p.id] && <ShieldCheck size={12} color="white" />}
                          </div>
                          <div>
                            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b' }}>{p.label}</span>
                            <p style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px', margin: 0 }}>{p.desc}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fffbeb', borderRadius: '12px', border: '1px solid #fef3c7', color: '#92400e', fontSize: '0.75rem' }}>
                    ⚠️ Los privilegios marcados en verde son los que el usuario tiene activos. Por defecto se cargan desde su cargo, pero puedes personalizarlos individualmente aquí.
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '25px 40px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 'bold', cursor: 'pointer' }}>Cerrar</button>
              <button 
                onClick={guardarUsuario} 
                className="btn-primary" 
                style={{ 
                  padding: '10px 30px', 
                  borderRadius: '12px', 
                  backgroundColor: '#3b82f6', 
                  color: 'white', 
                  border: 'none', 
                  fontWeight: 'bold', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <Save size={18} /> {formData.id ? 'Guardar Cambios' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Usuarios;