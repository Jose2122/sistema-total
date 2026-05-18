import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  Eye, EyeOff, UserPlus, Save, X, Shield, Trash2, UserCircle, 
  Settings, ShieldCheck, Layout, Activity, Key
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

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

  const [formData, setFormData] = useState({ 
    id: null, nombre: '', apellido: '', correo: '', 
    rol: '', departamento: '', gerencia_id: '', 
    foto_url: '', contrato: '', activo: true,
    password: '', 
    permisos_modulos: ["requisiciones", "fondos", "tickets", "usuarios"],
    capacidades: {},
    delegado_id: '',
    delegacion_desde: '',
    delegacion_hasta: '',
    obras_asignadas: []
  });

  const [userLogs, setUserLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  const MODULOS_DISPONIBLES = [
    { id: 'requisiciones', label: 'Requisiciones' },
    { id: 'fondos', label: 'Solicitud de Fondos' },
    { id: 'tickets', label: 'Ticket de Pago' },
    { id: 'almacen', label: 'Almacén' },
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
    { id: 'puede_aprobar_proyecto', label: 'Aprobación Nivel 0 (Proyecto)', desc: 'Gerente de Proyecto' },
    { id: 'puede_aprobar_area', label: 'Aprobación Nivel 1 (Área)', desc: 'Gerente de Área' },
    { id: 'puede_aprobar_final', label: 'Aprobación Nivel 2 (General)', desc: 'Gerencia General' },
    { id: 'gestionar_usuarios', label: 'Gestión de Usuarios', desc: 'Crear/Editar personal' },
    { id: 'acceso_compras', label: 'Módulo de Compras', desc: 'Procesamiento de órdenes' },
    { id: 'gestionar_atributos', label: 'Configuración de Atributos', desc: 'Listas maestras' }
  ];

  const obtenerMaestros = async () => {
    try {
      const { data: g } = await supabase.from('cat_gerencias').select('*').order('nombre');
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
      if (!userEmail) return;

      // 1. Obtener mi propio perfil primero
      const { data: miPerfilLocal } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single();
      const emailLower = (userEmail || '').toLowerCase();
      // José (System Admin), Carlos (Gerente General), Karin (Control Interno)
      const esJose = emailLower === 'jcontreras.totalclean@gmail.com';
      const esAdminReal = esJose || 
                          emailLower === 'cvega.totalclean@gmail.com' || 
                          emailLower === 'cvega@totalclean.com' || 
                          emailLower === 'karincmm1@gmail.com';
      
      const rolUpper = (miPerfilLocal?.rol || '').trim().toUpperCase();
      const deptoUpper = (miPerfilLocal?.departamento || '').trim().toUpperCase();
      
      // Acceso Total: Admins, Gerencia General, o equipo de Administración
      const esGlobalAdmin = esAdminReal || 
                            rolUpper === 'ADMIN' || 
                            rolUpper === 'GERENTE GENERAL' || 
                            rolUpper === 'GERENCIA GENERAL' || 
                            deptoUpper.includes('ADMINISTRACIÓN');

      // Si falla la carga del perfil por RLS, creamos una sesión mínima para no romper la UI
      if (!miPerfilLocal && session?.user) {
        setCurrentUser({ id: session.user.id, correo: session.user.email, nombre: 'Usuario', apellido: '', esAdminReal });
      } else {
        setCurrentUser({ ...miPerfilLocal, esAdminReal });
      }

      let dataFinal = [];

      if (esGlobalAdmin) {
        // ADMINS: Siguen viendo todo directamente
        const { data: allUsers } = await supabase.from('perfiles').select('*').order('apellido', { ascending: true });
        dataFinal = allUsers || [];
      } else {
        // NO-ADMINS: Usar el PUENTE (Edge Function) para evitar bloqueos de RLS
        console.log("[OBTENER USUARIOS] Usando Puente de Visibilidad (Edge Function)...");
        const { data: fnData, error: fnError } = await supabase.functions.invoke('admin-user-manager', {
          body: { action: 'get_department_users' }
        });

        if (fnError || fnData?.error) {
          console.error("[OBTENER USUARIOS] Error en puente:", fnError || fnData?.error);
          // Fallback a solo yo si falla el puente
          dataFinal = miPerfilLocal ? [miPerfilLocal] : [];
        } else {
          dataFinal = fnData.users || [];
        }
      }

      if (dataFinal.length > 0) {
        // Mapeo dinámico para rellenar gerencia_id basado en el nombre del departamento si está vacío
        const listaConIDs = dataFinal.map(u => {
          if (u.gerencia_id) return u;
          const matchingG = gerencias.find(g => (g.nombre || '').trim().toUpperCase() === (u.departamento || '').trim().toUpperCase());
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

  const registrarActividad = async (accion, detalle = "") => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      await supabase.from('logs_actividad').insert([{
        usuario_id: session.user.id,
        usuario_nombre: currentUser?.nombre ? `${currentUser.nombre} ${currentUser.apellido}` : session.user.email,
        corredor_id: formData.id,
        accion: accion,
        modulo: 'Usuarios',
        detalle: detalle,
        metadata: { target_email: formData.correo }
      }]);
    } catch (e) {
      console.error("Error registrando log:", e);
    }
  };

  const obtenerLogsUsuario = async (userId) => {
    if (!userId) return;
    setLoadingLogs(true);
    try {
      const { data } = await supabase
        .from('logs_actividad')
        .select('*')
        .or(`usuario_id.eq.${userId},corredor_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(20);
      setUserLogs(data || []);
    } catch (e) { console.error(e); }
    finally { setLoadingLogs(false); }
  };

  // Efecto para heredar permisos cuando cambia el cargo
  useEffect(() => {
    if (!formData.id && formData.rol) { // Solo si es nuevo usuario
      const r = cargos.find(c => c.nombre === formData.rol);
      if (r && r.permisos_default) {
        let sugeridos = ['requisiciones', 'fondos', 'tickets', 'usuarios']; // Básicos preasignados por defecto
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
    const isAdmin = currentUser?.esAdminReal || 
                   ['ADMIN', 'GERENTE GENERAL', 'GERENCIA GENERAL'].includes((currentUser?.rol || '').toUpperCase()) ||
                   (currentUser?.departamento || '').toUpperCase().includes('ADMINISTRACIÓN');

    let resultado = usuarios.filter(u => {
      // 1. FILTRO DE SEGURIDAD: Solo ve su departamento si no es admin
      if (!isAdmin && u.departamento !== currentUser?.departamento) return false;

      // 2. FILTROS DE BÚSQUEDA Y SELECCIÓN
      const nombreCompleto = `${u.nombre} ${u.apellido}`.toLowerCase();
      const coincideNombre = nombreCompleto.includes(busqueda.toLowerCase());
      const coincideDepto = filtroDpto === 'Todos' || u.departamento === filtroDpto;
      const coincideCargo = filtroCargo === 'Todos' || u.rol === filtroCargo;
      return coincideNombre && coincideDepto && coincideCargo;
    });
    setUsuariosFiltrados(resultado);
  }, [busqueda, filtroDpto, filtroCargo, usuarios, currentUser]);

  const guardarUsuario = async () => {
    const rolUpper = (currentUser?.rol || '').toUpperCase();
    if (!currentUser?.esAdminReal && rolUpper !== 'GERENTE GENERAL' && rolUpper !== 'ADMIN') return;
    if(!formData.rol || !formData.gerencia_id) return toast.error("Asigne Cargo y Gerencia.");
    
    setLoading(true);
    try {
      const { password, ...datosForm } = formData;
      const gerenciaObj = gerencias.find(g => g.id === formData.gerencia_id);
      
      // Limpieza del payload para evitar errores 400 (Bad Request) en PostgREST
      // Eliminamos campos que no pertenecen a la tabla 'perfiles' o que son redundantes
      const payloadPerfil = {
        nombre: datosForm.nombre,
        apellido: datosForm.apellido,
        correo: datosForm.correo,
        rol: datosForm.rol,
        departamento: gerenciaObj?.nombre || datosForm.departamento,
        gerencia_id: datosForm.gerencia_id,
        contrato: datosForm.contrato,
        foto_url: datosForm.foto_url,
        activo: datosForm.activo !== false,
        permisos_modulos: datosForm.permisos_modulos,
        capacidades: datosForm.capacidades,
        delegado_id: datosForm.delegado_id || null,
        delegacion_desde: datosForm.delegacion_desde || null,
        delegacion_hasta: datosForm.delegacion_hasta || null,
        obras_asignadas: datosForm.obras_asignadas || []
      };

      if (formData.id) {
        // --- MODO ACTUALIZAR ---
        if (password && password.length >= 6) {
           console.log("[USUARIOS] Actualizando contraseña...");
           const { data: fnData, error: fnError } = await supabase.functions.invoke('admin-user-manager', {
             body: { action: 'update_password', data: { id: formData.id, password } }
           });
           
           if (fnError || fnData?.error) {
             const detailedMsg = fnData?.error || fnError?.message || "Error al actualizar contraseña";
             throw new Error(detailedMsg);
           }
           toast.success("Contraseña actualizada vía Admin");
        }

        // ACTUALIZAR PERFIL (Excluimos gerencia_id si falla, por compatibilidad)
        const { error } = await supabase.from('perfiles').update(payloadPerfil).eq('id', formData.id);
        
        if (error) {
            // Manejo de error de columna inexistente (fallback)
            if (error.code === '42703') {
                const { gerencia_id, ...payloadSafe } = payloadPerfil;
                const { error: retryError } = await supabase.from('perfiles').update(payloadSafe).eq('id', formData.id);
                if (retryError) throw retryError;
            } else throw error;
        }
        toast.success("Perfil actualizado con éxito");
        await registrarActividad('UPDATE_PROFILE', `Cambios en perfil de ${formData.nombre}`);
      } else {
        // --- MODO CREAR ---
        console.log("[USUARIOS] Creando cuenta en Auth vía Edge Function...");
        const { data: fnData, error: fnError } = await supabase.functions.invoke('admin-user-manager', {
          body: { 
            action: 'create_user', 
            data: { 
              email: formData.correo, 
              password: password || '123456'
            } 
          }
        });
        
        if (fnError || (fnData && fnData.error)) {
          const detail = fnData?.error || fnError?.message || "Error desconocido en servidor";
          throw new Error(`Error en Acceso Auth: ${detail}`);
        }

        if (!fnData?.user?.id) throw new Error("La función no devolvió un ID de usuario válido.");

        // INSERTAR PERFIL DESPUÉS DE CREAR EL AUTH
        console.log("[USUARIOS] Insertando perfil para ID:", fnData.user.id);
        const { error: profileError } = await supabase.from('perfiles').insert([{ 
          ...payloadPerfil, 
          id: fnData.user.id 
        }]);

        if (profileError) {
             if (profileError.code === '42703') {
                const { gerencia_id, ...payloadSafe } = payloadPerfil;
                const { error: retryError } = await supabase.from('perfiles').insert([{ ...payloadSafe, id: fnData.user.id }]);
                if (retryError) throw retryError;
             } else throw profileError;
        }
        toast.success("Usuario creado exitosamente");
        await registrarActividad('CREATE_USER', `Creado nuevo usuario: ${formData.correo}`);
      }

      obtenerUsuarios();
      
      // SOLO CERRAR SI ES EDICIÓN. SI ES CREACIÓN, PERMITIR SEGUIR CREANDO.
      if (formData.id) {
        setShowModal(false);
      } else {
        toast.success("Puedes registrar otro integrante ahora.");
      }

      setFormData({ 
        id: null, nombre: '', apellido: '', correo: '', rol: '', departamento: '', gerencia_id: '',
        foto_url: '', contrato: '', activo: true, password: '', 
        permisos_modulos: ["requisiciones", "fondos", "tickets", "usuarios"],
        capacidades: {}
      });
      setVerPassword(false);
      setTabActiva('general');
      setUserLogs([]);
    } catch (err) { 
      console.error("[USUARIOS] Error Fatal:", err);
      toast.error(err.message, { duration: 6000 }); 
    } finally { 
      setLoading(false); 
    }
  };

  const formatearUltimaConexion = (fechaIso) => {
    if (!fechaIso) return <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Nunca</span>;
    const fecha = new Date(fechaIso);
    const ahora = new Date();
    const diffMinutos = (ahora - fecha) / 1000 / 60;
    
    if (diffMinutos < 10) return (
      <span style={{ color: '#10b981', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%', boxShadow: '0 0 8px #10b981' }}></span>
        En línea
      </span>
    );
    
    return <span style={{ color: '#64748b' }}>{formatDistanceToNow(fecha, { addSuffix: true, locale: es })}</span>;
  };

  const manejarToggleActivo = async (id, estadoActual) => {
    const nuevoEstado = !estadoActual;
    const toastId = toast.loading(nuevoEstado ? "Activando usuario..." : "Desactivando usuario...");
    try {
      const { error } = await supabase.from('perfiles').update({ activo: nuevoEstado }).eq('id', id);
      if (error) throw error;
      toast.success(`Usuario ${nuevoEstado ? 'activado' : 'desactivado'} con éxito`, { id: toastId });
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, activo: nuevoEstado } : u));
    } catch (err) {
      toast.error(err.message, { id: toastId });
    }
  };

  const manejarResetPassword = async (id, correo) => {
    if (!currentUser?.esAdminReal) return;
    toast((t) => (
      <div>
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold', color: '#f59e0b' }}>⚠️ ¿Seguro que deseas restablecer la contraseña para {correo}?</p>
        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '8px 0' }}>Se asignará una contraseña temporal genérica (<b>TotalClean123!</b>).</p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button 
            style={{ padding: '6px 12px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            onClick={async () => {
              toast.dismiss(t.id);
              const toastLoading = toast.loading('Restableciendo contraseña...');
              const { data, error } = await supabase.functions.invoke('admin-user-manager', {
                body: { action: 'reset_password', userId: id, newPassword: 'TotalClean123!' }
              });
              if (error || data?.error) {
                toast.error(error?.message || data?.error, { id: toastLoading });
              } else {
                toast.success('Contraseña restablecida a TotalClean123!', { id: toastLoading, duration: 6000 });
              }
            }}
          >
            Confirmar Restablecimiento
          </button>
          <button 
            style={{ padding: '6px 12px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            onClick={() => toast.dismiss(t.id)}
          >Cancelar</button>
        </div>
      </div>
    ), { duration: Infinity });
  };


  const eliminarUsuarioTotal = async (id, correo) => {
    if (!currentUser?.esAdminReal) return;
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold', color: '#ef4444' }}>⚠️ ¡PELIGRO! Esta acción eliminará PERMANENTEMENTE a {correo} de todo el sistema. Esta acción no se puede deshacer.</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button 
            onClick={() => { toast.dismiss(t.id); ejecutarEliminacionDefinitiva(id); }}
            style={{ padding: '4px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            SÍ, ELIMINAR TODO
          </button>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 12px', background: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>CANCELAR</button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  const ejecutarEliminacionDefinitiva = async (id) => {
    setLoading(true);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('admin-user-manager', {
        body: { action: 'delete_user', data: { id } }
      });
      if (fnError || fnData?.error) throw new Error(fnError?.message || fnData?.error || "Error eliminando acceso");

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
    th: { textAlign: 'left', padding: '18px 16px', color: '#64748b', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' },
    td: { padding: '18px 16px', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem', color: '#1e293b' },
    badge: (rol) => ({ padding: '6px 14px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', backgroundColor: rol?.includes('Gerente') ? '#e0f2fe' : '#f1f5f9', color: rol?.includes('Gerente') ? '#0284c7' : '#475569' }),
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
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#1e293b' }}>{new Set(usuariosFiltrados.map(u => u.departamento).filter(Boolean)).size}</div>
        </div>
      </div>

      <div style={estilos.tarjeta}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <h2 style={{ fontSize: '1.4rem', color: '#0f172a', margin: 0 }}>Gestión de Usuarios</h2>
          {(currentUser?.esAdminReal || (currentUser?.rol || '').toUpperCase() === 'GERENTE GENERAL' || (currentUser?.rol || '').toUpperCase() === 'ADMIN') && (
            <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => { setFormData({id:null, nombre:'', apellido:'', correo:'', rol:'', departamento:'', gerencia_id:'', contrato:'', activo: true, foto_url:'', password: '', permisos_modulos: ["requisiciones", "fondos", "tickets", "usuarios"], capacidades: {}, delegado_id: '', delegacion_desde: '', delegacion_hasta: ''}); setShowModal(true); setTabActiva('general'); setUserLogs([]); }}>
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
                <th style={estilos.th}>Estado</th>
                <th style={estilos.th}>Colaborador</th>
                <th style={estilos.th}>Cargo</th>
                <th style={estilos.th}>Departamento</th>
                <th style={estilos.th}>C. Costos Asignados</th>
                <th style={estilos.th}>Última Conexión</th>
                <th style={estilos.th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.map(u => (
                <tr key={u.id} className="row-hover" style={{ opacity: u.activo ? 1 : 0.5, backgroundColor: u.activo ? 'transparent' : '#f8fafc', transition: 'all 0.3s' }}>
                  <td style={estilos.td}>
                    {/* Switch de Estado */}
                    <div 
                      onClick={() => currentUser?.esAdminReal && manejarToggleActivo(u.id, u.activo)}
                      style={{
                        width: '40px', height: '22px', borderRadius: '11px', 
                        backgroundColor: u.activo ? '#10b981' : '#cbd5e1',
                        position: 'relative', cursor: currentUser?.esAdminReal ? 'pointer' : 'default',
                        transition: 'background-color 0.3s'
                      }}
                      title={u.activo ? 'Usuario Activo' : 'Usuario Inactivo (Bloqueado)'}
                    >
                      <div style={{
                        width: '18px', height: '18px', backgroundColor: 'white', borderRadius: '50%',
                        position: 'absolute', top: '2px', left: u.activo ? '20px' : '2px',
                        transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }} />
                    </div>
                  </td>
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
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxWidth: '280px' }}>
                      {u.obras_asignadas && u.obras_asignadas.length > 0 ? (
                        u.obras_asignadas.map((obra, idx) => (
                          <span key={idx} style={{ fontSize: '0.65rem', backgroundColor: '#f8fafc', color: '#475569', padding: '4px 8px', borderRadius: '8px', fontWeight: 'bold', border: '1px solid #e2e8f0' }}>
                            {obra}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: '#0ea5e9', fontWeight: 'bold', fontSize: '0.75rem' }}>{u.contrato || 'General'}</span>
                      )}
                    </div>
                  </td>
                  <td style={estilos.td}>
                    {formatearUltimaConexion(u.last_login)}
                  </td>
                  <td style={estilos.td}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      {/* Solo Admins o Gerentes pueden editar */}
                      {(currentUser?.esAdminReal || 
                        ['ADMIN', 'GERENTE GENERAL', 'GERENCIA GENERAL'].includes((currentUser?.rol || '').toUpperCase()) ||
                        (currentUser?.departamento || '').toUpperCase().includes('ADMINISTRACIÓN')) && (
                        <button onClick={() => { 
                          setFormData({ 
                            ...u, 
                            capacidades: u.capacidades || {},
                            delegado_id: u.delegado_id || '',
                            delegacion_desde: u.delegacion_desde || '',
                            delegacion_hasta: u.delegacion_hasta || ''
                          });
                          setVerPassword(false);
                          setTabActiva('general');
                          obtenerLogsUsuario(u.id);
                          setShowModal(true); 
                        }} style={{ color: '#0ea5e9', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Editar</button>
                      )}
                      
                      {currentUser?.esAdminReal && (
                        <>
                          <Key size={16} color="#f59e0b" style={{ cursor: 'pointer' }} onClick={() => manejarResetPassword(u.id, u.correo)} title="Restablecer Contraseña" />
                          <Trash2 size={16} color="#ef4444" style={{ cursor: 'pointer' }} onClick={() => eliminarUsuarioTotal(u.id, u.correo)} title="Eliminar Usuario" />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Panel de Resumen de Usuarios Totales */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginTop: '20px', 
          padding: '14px 20px', 
          backgroundColor: '#f8fafc', 
          borderRadius: '16px', 
          border: '1px solid #f1f5f9',
          fontSize: '0.82rem',
          color: '#64748b',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div>
            Mostrando <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{usuariosFiltrados.length}</span> de <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{usuarios.length}</span> colaboradores.
          </div>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%' }}></span>
              Activos: <b style={{ color: '#1e293b' }}>{usuarios.filter(u => u.activo).length}</b>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: '#cbd5e1', borderRadius: '50%' }}></span>
              Inactivos: <b style={{ color: '#1e293b' }}>{usuarios.filter(u => !u.activo).length}</b>
            </span>
            <span style={{ borderLeft: '1px solid #e2e8f0', height: '14px' }}></span>
            <span style={{ fontWeight: 'bold', color: '#0ea5e9' }}>
              Total General: {usuarios.length} Usuarios
            </span>
          </div>
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
              <div style={estilos.tab(tabActiva === 'seguridad')} onClick={() => setTabActiva('seguridad')}>
                <Shield size={18} /> Seguridad
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
                        {cargos
                          .filter(c => c.nombre !== "Gerente de Proyecto")
                          .map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)
                        }
                        <option value="Gerente de Proyecto">Gerente de Proyecto</option>
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
                    <label style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '10px' }}>ASIGNACIÓN DE COSTOS (OBRA PRINCIPAL)</label>
                    <select className="input-style" style={{ width: '100%' }} value={formData.contrato} onChange={e => setFormData({...formData, contrato: e.target.value})}>
                      <option value="">Centro de Costo...</option>
                      {centrosCosto.map(cc => <option key={cc.id} value={cc.nombre}>{cc.nombre}</option>)}
                    </select>

                    <label style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', display: 'block', marginTop: '20px', marginBottom: '10px' }}>OBRAS BAJO SU CARGO (MULTI-SELECCIÓN)</label>
                    <div style={{
                      maxHeight: '150px',
                      overflowY: 'auto',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '10px',
                      backgroundColor: 'white'
                    }}>
                      {centrosCosto.map(cc => (
                        <label key={cc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px', fontSize: '0.8rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={formData.obras_asignadas?.includes(cc.nombre)}
                            onChange={(e) => {
                              const list = formData.obras_asignadas || [];
                              const updated = e.target.checked
                                ? [...list, cc.nombre]
                                : list.filter(name => name !== cc.nombre);
                              setFormData({ ...formData, obras_asignadas: updated });
                            }}
                          />
                          {cc.nombre}
                        </label>
                      ))}
                    </div>

                    <div style={{ marginTop: '25px', padding: '20px', borderRadius: '15px', backgroundColor: '#f8fafc', border: '1.5px dashed #cbd5e1', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <div style={{ position: 'relative', width: '70px', height: '70px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid #e2e8f0' }}>
                        {formData.foto_url ? (
                          <img src={formData.foto_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar Preview" />
                        ) : (
                          <UserCircle size={45} color="#94a3b8" />
                        )}
                        {uploadingFoto && (
                          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.65rem', fontWeight: 'bold' }}>
                            Subiendo...
                          </div>
                        )}
                      </div>
                      <div>
                        <input
                          type="file"
                          id="avatar-upload"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploadingFoto(true);
                            const toastId = toast.loading("Subiendo foto de perfil...");
                            try {
                              const fileExt = file.name.split('.').pop();
                              const fileName = `avatar-${Date.now()}.${fileExt}`;
                              const filePath = `avatars/${fileName}`;
                              
                              const { error: uploadError } = await supabase.storage
                                .from('facturas')
                                .upload(filePath, file);

                              if (uploadError) throw uploadError;

                              const { data: { publicUrl } } = supabase.storage
                                .from('facturas')
                                .getPublicUrl(filePath);

                              setFormData(prev => ({ ...prev, foto_url: publicUrl }));

                              // Si ya existe el usuario, actualizar directamente en la base de datos
                              if (formData.id) {
                                const { error: dbError } = await supabase
                                  .from('perfiles')
                                  .update({ foto_url: publicUrl })
                                  .eq('id', formData.id);
                                if (dbError) throw dbError;
                                toast.success("Foto de perfil actualizada en el sistema", { id: toastId });
                                // Actualizar la lista local de usuarios
                                setUsuarios(prev => prev.map(u => u.id === formData.id ? { ...u, foto_url: publicUrl } : u));
                              } else {
                                toast.success("Foto de perfil cargada para el nuevo usuario", { id: toastId });
                              }
                            } catch (err) {
                              console.error("Error subiendo avatar:", err);
                              toast.error("Error al subir foto: " + err.message, { id: toastId });
                            } finally {
                              setUploadingFoto(false);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => document.getElementById('avatar-upload')?.click()}
                          disabled={uploadingFoto}
                          style={{
                            padding: '6px 14px',
                            backgroundColor: '#0ea5e9',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: '0.2s'
                          }}
                        >
                          {formData.foto_url ? 'Cambiar Foto' : 'Subir Foto'}
                        </button>
                      </div>
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

              {tabActiva === 'seguridad' && (
                <div className="tab-content">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                    {/* Delegación */}
                    <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '24px', border: '1px solid #f1f5f9' }}>
                      <h4 style={{ margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b' }}>
                        <UserCircle size={20} color="#3b82f6" /> Delegación Temporal
                      </h4>
                      <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '20px' }}>
                        Selecciona a un colaborador del departamento para que quede como encargado.
                      </p>
                      
                      <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>ENCARGADO (Mismo Depto.)</label>
                      <select 
                        className="input-style" 
                        style={{ width: '100%', marginBottom: '20px' }}
                        value={formData.delegado_id}
                        onChange={e => setFormData({...formData, delegado_id: e.target.value})}
                      >
                        <option value="">Ninguno</option>
                        {usuarios
                          .filter(u => u.departamento === formData.departamento && u.id !== formData.id)
                          .map(u => (
                            <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>
                          ))
                        }
                      </select>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div>
                          <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>DESDE</label>
                          <input type="date" className="input-style" style={{ width: '100%' }} value={formData.delegacion_desde} onChange={e => setFormData({...formData, delegacion_desde: e.target.value})} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>HASTA</label>
                          <input type="date" className="input-style" style={{ width: '100%' }} value={formData.delegacion_hasta} onChange={e => setFormData({...formData, delegacion_hasta: e.target.value})} />
                        </div>
                      </div>
                    </div>

                    {/*Logs de Actividad */}
                    <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '24px', border: '1px solid #f1f5f9' }}>
                      <h4 style={{ margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b' }}>
                        <Activity size={20} color="#8b5cf6" /> Actividad Reciente
                      </h4>
                      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {loadingLogs ? (
                          <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '0.8rem' }}>Cargando registros...</div>
                        ) : userLogs.length > 0 ? (
                          userLogs.map(log => (
                            <div key={log.id} style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>{log.accion}</span>
                                <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{new Date(log.created_at).toLocaleString()}</span>
                              </div>
                              <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b' }}>{log.detalle || 'Acción realizada en el sistema'}</p>
                              {log.usuario_nombre && (
                                <div style={{ fontSize: '0.6rem', color: '#3b82f6', marginTop: '4px', fontWeight: '600' }}>Por: {log.usuario_nombre}</div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div style={{ textAlign: 'center', padding: '30px', color: '#cbd5e1', fontSize: '0.75rem' }}>No hay actividad registrada.</div>
                        )}
                      </div>
                    </div>
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