import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const Usuarios = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosFiltrados, setUsuariosFiltrados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroDpto, setFiltroDpto] = useState('Todos');
  const [filtroCargo, setFiltroCargo] = useState('Todos');
  const [showModal, setShowModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({ 
    id: null, nombre: '', apellido: '', correo: '', 
    rol: '', departamento: '', firma_url: '',
    foto_url: '', // Nueva columna
    password: '', 
    current_password_display: '' 
  });

  const ADMIN_EMAIL = 'jcontreras.totalclean@gmail.com';
  const CARGOS = ["Gerente General", "Gerente", "Coordinador", "Analista"];
  const DEPARTAMENTOS = [
    "Mantenimiento", "Estimación y Control Interno", "Operaciones", "Seguridad",
    "Recursos Humanos", "Almacén", "Administración Maracaibo",
    "Administración El Tigre", "Contabilidad", "Servicios Generales",
    "Compras"
  ];

  useEffect(() => {
    let resultado = usuarios.filter(u => {
      const nombreCompleto = `${u.nombre} ${u.apellido}`.toLowerCase();
      const coincideNombre = nombreCompleto.includes(busqueda.toLowerCase());
      const coincideDpto = filtroDpto === 'Todos' || u.departamento === filtroDpto;
      const coincideCargo = filtroCargo === 'Todos' || u.rol === filtroCargo;
      return coincideNombre && coincideDpto && coincideCargo;
    });
    setUsuariosFiltrados(resultado);
  }, [busqueda, filtroDpto, filtroCargo, usuarios]);

  const subirFirma = async (event) => {
    try {
      setUploading(true);
      const file = event.target.files[0];
      if (!file) return;
      const fileExt = file.name.split('.').pop();
      const fileName = `${formData.correo.split('@')[0]}_firma_${Math.random()}.${fileExt}`;
      let { error: uploadError } = await supabase.storage.from('firmas').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('firmas').getPublicUrl(fileName);
      setFormData({ ...formData, firma_url: data.publicUrl });
      alert("Firma cargada con éxito.");
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const subirFoto = async (event) => {
    try {
      setUploading(true);
      const file = event.target.files[0];
      if (!file) return;
      const fileExt = file.name.split('.').pop();
      const fileName = `${formData.correo.split('@')[0]}_foto_${Math.random()}.${fileExt}`;
      let { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setFormData({ ...formData, foto_url: data.publicUrl });
      alert("Foto de perfil cargada con éxito.");
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const obtenerUsuarios = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const userEmail = session?.user?.email;
    const { data, error } = await supabase.from('perfiles').select('*').order('apellido', { ascending: true });

    if (!error) {
      const miPerfil = data.find(u => u.correo === userEmail);
      const esAdminReal = userEmail === ADMIN_EMAIL;
      setCurrentUser({ ...miPerfil, esAdminReal });
      const lista = (esAdminReal || miPerfil?.rol === 'Gerente General') ? data : data.filter(u => u.departamento === miPerfil?.departamento);
      setUsuarios(lista);
    }
    setLoading(false);
  };

  useEffect(() => { 
    obtenerUsuarios(); 
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
      .stat-coord::before { background-color: #10b981; }
    `;
    document.head.appendChild(style);
  }, []);

  const guardarUsuario = async () => {
    if (!currentUser?.esAdminReal) return;
    if(!formData.rol || !formData.departamento) return alert("Asigne Cargo y Departamento.");
    setLoading(true);
    try {
      const { password, current_password_display, ...datosPerfil } = formData;
      if (formData.id) {
        if (password && password.length >= 6) {
           await supabase.auth.updateUser({ password: password });
        }
        const { error } = await supabase.from('perfiles').update(datosPerfil).eq('id', formData.id);
        if (error) throw error;
      } else {
        const { data: authData, error: authError } = await supabase.auth.signUp({ 
          email: formData.correo, 
          password: password || '123456' 
        });
        if (authError) throw authError;
        await supabase.from('perfiles').insert([{ ...datosPerfil, id: authData.user.id }]);
      }
      alert("Guardado exitosamente.");
      obtenerUsuarios();
      setShowModal(false);
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const estilos = {
    contenedor: { padding: '30px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: "'Plus Jakarta Sans', sans-serif" },
    tarjeta: { backgroundColor: 'white', padding: '30px', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' },
    th: { textAlign: 'left', padding: '16px', color: '#94a3b8', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' },
    td: { padding: '16px', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem', color: '#1e293b' },
    badge: (rol) => {
      let colors = { bg: '#f1f5f9', text: '#475569' };
      if (rol === 'Gerente General') colors = { bg: '#fff7ed', text: '#c2410c' };
      if (rol === 'Gerente') colors = { bg: '#f0fdf4', text: '#15803d' };
      if (rol === 'Coordinador') colors = { bg: '#f0f9ff', text: '#0369a1' };
      if (rol === 'Analista') colors = { bg: '#f5f3ff', text: '#7c3aed' };
      return { padding: '5px 12px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '600', backgroundColor: colors.bg, color: colors.text };
    }
  };

  return (
    <div className="animate-main" style={estilos.contenedor}>
      
      <div style={{ display: 'flex', gap: '20px', marginBottom: '25px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div className="stat-card-new stat-total">
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', marginBottom: '5px' }}>Personal Total</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#1e293b' }}>{usuariosFiltrados.length}</div>
        </div>
        <div className="stat-card-new stat-gerente">
          <div style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: '800', textTransform: 'uppercase', marginBottom: '5px' }}>Gerencia</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#1e293b' }}>
            {usuariosFiltrados.filter(u => u.rol?.includes('Gerente')).length}
          </div>
        </div>
        <div className="stat-card-new stat-coord">
          <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: '800', textTransform: 'uppercase', marginBottom: '5px' }}>Coordinación</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#1e293b' }}>
            {usuariosFiltrados.filter(u => u.rol === 'Coordinador').length}
          </div>
        </div>
      </div>

      <div style={estilos.tarjeta}>
        <div style={{ marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.4rem', color: '#0f172a', margin: 0 }}>Gestión de Usuarios</h2>
            {currentUser?.esAdminReal && (
              <button className="btn-primary" onClick={() => { setFormData({id:null, nombre:'', apellido:'', correo:'', rol:'', departamento:'', firma_url:'', password: '', current_password_display: ''}); setShowModal(true); }}>
                + Nuevo Integrante
              </button>
            )}
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
                className="input-style"
                style={{ width: '100%', paddingLeft: '35px', margin: 0, backgroundColor: 'white', boxSizing: 'border-box' }}
                placeholder="Buscar por nombre..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            
            <select
              className="input-style"
              style={{ flex: 1, margin: 0, backgroundColor: 'white' }}
              value={filtroDpto}
              onChange={(e) => setFiltroDpto(e.target.value)}
            >
              <option value="Todos">Todos los Departamentos</option>
              {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            
            <select
              className="input-style"
              style={{ flex: 1, margin: 0, backgroundColor: 'white' }}
              value={filtroCargo}
              onChange={(e) => setFiltroCargo(e.target.value)}
            >
              <option value="Todos">Todos los Cargos</option>
              {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={estilos.th}>Colaborador</th>
                <th style={estilos.th}>Cargo</th>
                <th style={estilos.th}>Departamento</th>
                <th style={estilos.th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.map(u => (
                <tr key={u.id} className="row-hover">
                  <td style={estilos.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{ 
                        width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#f1f5f9', 
                        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0'
                      }}>
                        {u.foto_url ? (
                          <img src={u.foto_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#94a3b8' }}>{u.nombre?.[0]}{u.apellido?.[0]}</span>
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{u.nombre} {u.apellido}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.correo}</div>
                      </div>
                    </div>
                  </td>
                  <td style={estilos.td}><span style={estilos.badge(u.rol)}>{u.rol || 'Sin Cargo'}</span></td>
                  <td style={estilos.td}><span style={{ color: '#64748b' }}>{u.departamento || 'Sin asignar'}</span></td>
                  <td style={estilos.td}>
                    {currentUser?.esAdminReal ? (
                      <button onClick={() => { setFormData({...u, password: '', current_password_display: u.password || '---'}); setShowModal(true); }} style={{ color: '#0ea5e9', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>Editar Perfil</button>
                    ) : <span style={{color:'#cbd5e1', fontSize:'0.75rem'}}>Solo lectura</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div style={{ backgroundColor: 'white', padding: '35px', borderRadius: '28px', width: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, marginBottom: '25px', color: '#0f172a' }}>{formData.id ? 'Editar Perfil' : 'Nuevo Registro'}</h3>
            
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '25px' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ 
                  width: '90px', height: '90px', borderRadius: '18px', backgroundColor: '#f8fafc', 
                  border: '2px dashed #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden' 
                }}>
                  {formData.foto_url ? (
                    <img src={formData.foto_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '2rem', color: '#cbd5e1' }}>👤</span>
                  )}
                </div>
                <input type="file" id="p-foto" accept="image/*" onChange={subirFoto} style={{ display: 'none' }} />
                <label 
                  htmlFor="p-foto" 
                  style={{ 
                    position: 'absolute', bottom: '-8px', right: '-8px', backgroundColor: '#0ea5e9', 
                    width: '32px', height: '32px', borderRadius: '10px', display: 'flex', 
                    alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '2px solid white'
                  }}
                >
                  📷
                </label>
              </div>
            </div>

            {/* Información Personal */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '10px', textTransform: 'uppercase' }}>Información Personal</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <input className="input-style" placeholder="Nombre" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                <input className="input-style" placeholder="Apellido" value={formData.apellido} onChange={e => setFormData({...formData, apellido: e.target.value})} />
              </div>
              <input className="input-style" style={{ width: '94%' }} placeholder="Correo institucional" value={formData.correo} onChange={e => setFormData({...formData, correo: e.target.value})} />
            </div>

            {/* Asignación */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '10px', textTransform: 'uppercase' }}>Asignación de Cargo</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <select className="input-style" value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value})}>
                  <option value="">Cargo...</option>
                  {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="input-style" value={formData.departamento} onChange={e => setFormData({...formData, departamento: e.target.value})}>
                  <option value="">Depto...</option>
                  {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            {/* Seguridad */}
            <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '16px', marginBottom: '20px' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '10px' }}>SEGURIDAD (CONTRASEÑA)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <input className="input-style" style={{ background: '#f1f5f9' }} readOnly value={formData.current_password_display} />
                <input className="input-style" style={{ borderColor: '#0ea5e9' }} placeholder="Nueva clave" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              </div>
            </div>

            {/* Firma Digital Dinámica */}
            {(formData.rol?.includes('Gerente') || formData.rol === 'Gerente General') && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '10px' }}>FIRMA DIGITAL</label>
                <div style={{ border: '2px dashed #e2e8f0', padding: '20px', borderRadius: '16px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                  {formData.firma_url ? (
                    <div style={{ marginBottom: '15px' }}>
                      <img src={formData.firma_url} alt="Firma" style={{ maxHeight: '60px', filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.1))' }} />
                    </div>
                  ) : (
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '10px' }}>Sin firma cargada</div>
                  )}
                  
                  <input type="file" id="f-up" accept="image/png" onChange={subirFirma} style={{ display: 'none' }} />
                  <label 
                    htmlFor="f-up" 
                    style={{ 
                      color: formData.firma_url ? '#f59e0b' : '#0ea5e9', 
                      cursor: 'pointer', 
                      fontSize: '0.85rem', 
                      fontWeight: '800',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {uploading ? '⌛ Subiendo...' : (formData.firma_url ? '📁 Cambiar Firma (PNG)' : '📁 Cargar Firma Digital')}
                  </label>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={guardarUsuario} disabled={loading} className="btn-primary">
                {loading ? 'Procesando...' : (formData.id ? 'Actualizar' : 'Guardar Cambios')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Usuarios;