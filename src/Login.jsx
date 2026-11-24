import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Warehouse, LogIn, Eye, EyeOff, Lock, Mail, Smartphone } from 'lucide-react';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import './Auth.css';

const MENSAJES_POSITIVOS = [
  "Conectando con el servidor central...",
  "Preparando tu panel personalizado...",
  "¡Que tengas un excelente y productivo día!",
  "Cargando módulos de seguridad...",
  "Estableciendo conexión cifrada...",
  "Sincronizando tus configuraciones...",
  "Todo listo, iniciando tu espacio de trabajo..."
];

const Auth = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mensajeIdx, setMensajeIdx] = useState(0);
  const [modoMovil, setModoMovil] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sitc_preferred_view');
      if (saved) return saved === 'movil';
      return window.innerWidth <= 768;
    }
    return false;
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) return;
    setMensajeIdx(0); // Reset index when loading starts
    const interval = setInterval(() => {
      setMensajeIdx((prev) => (prev + 1) % MENSAJES_POSITIVOS.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [loading]);

  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  const handleChange = (e) => setLoginData({ ...loginData, [e.target.name]: e.target.value });

  const logAuthAttempt = async (email, exitoso) => {
    try {
      let ip = 'Desconocida';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          ip = ipData.ip || 'Desconocida';
        }
      } catch (ipErr) {
        console.warn("No se pudo obtener la IP:", ipErr.message);
      }

      await supabase.from('user_auth_logs').insert([{
        correo: email,
        exitoso: exitoso,
        ip_address: ip,
        device_info: navigator.userAgent || 'Desconocido'
      }]);
    } catch (err) {
      console.error("Error al registrar auditoría de sesión:", err);
    }
  };

  const ejecutarLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginData.email,
      password: loginData.password,
    });

    if (error) {
      toast.error("Credenciales incorrectas: " + error.message);
      await logAuthAttempt(loginData.email, false);
      setLoading(false);
      return;
    }

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (perfil && perfil.activo === false) {
      await supabase.auth.signOut();
      toast.error("Acceso restringido. Contacte a sistemas.");
      await logAuthAttempt(loginData.email, false);
      setLoading(false);
      return;
    }

    await logAuthAttempt(loginData.email, true);

    localStorage.setItem('user_totalclean_session', JSON.stringify(data.user));
    localStorage.setItem('user_profile', JSON.stringify(perfil));
    localStorage.setItem('sitc_preferred_view', modoMovil ? 'movil' : 'desktop');
    
    if (modoMovil) {
      navigate('/movil');
    } else {
      navigate('/dashboard');
    }
    setLoading(false);
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-background-shape"></div>
      <div className="auth-card animate-fade-in" style={{ position: 'relative' }}>
        {/* Acceso rápido / Botón Modo Móvil */}
        <button
          type="button"
          onClick={() => {
            const nuevo = !modoMovil;
            setModoMovil(nuevo);
            localStorage.setItem('sitc_preferred_view', nuevo ? 'movil' : 'desktop');
          }}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: modoMovil ? 'rgba(2, 132, 199, 0.12)' : 'rgba(241, 245, 249, 0.8)',
            border: modoMovil ? '1px solid #38bdf8' : '1px solid #e2e8f0',
            color: modoMovil ? '#0284c7' : '#64748b',
            borderRadius: '10px',
            padding: '6px 10px',
            fontSize: '0.72rem',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: modoMovil ? '0 2px 8px rgba(2, 132, 199, 0.2)' : 'none'
          }}
          title="Alternar Modo Móvil"
        >
          <Smartphone size={14} color={modoMovil ? '#0284c7' : '#64748b'} />
          <span>{modoMovil ? '📱 Móvil: Activo' : '📱 Modo Móvil'}</span>
        </button>

        {loading && (
          <div className="auth-loading-overlay">
            <div className="auth-loading-content">
              <div className="spinner-modern"></div>
              <p className="loading-message-main">Iniciando sesión</p>
              <p className="loading-message-sub">{MENSAJES_POSITIVOS[mensajeIdx]}</p>
            </div>
          </div>
        )}
        
        <div className="auth-header">
          <div className="logo-container">
            <Warehouse size={40} color="#0ea5e9" strokeWidth={1.5} />
          </div>
          <h2>SITC</h2>
          <p>Gestión de Compras y Pagos</p>
        </div>

        <form onSubmit={ejecutarLogin} className="auth-form">
          <div className="input-group">
            <label>Correo Electrónico</label>
            <div className="input-wrapper">
              <Mail className="input-icon" size={18} />
              <input 
                type="email" 
                name="email" 
                value={loginData.email} 
                onChange={handleChange} 
                required 
              />
            </div>
          </div>

          <div className="input-group">
            <label>Contraseña</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={18} />
              <input 
                type={showPassword ? "text" : "password"} 
                name="password" 
                onChange={handleChange} 
                required 
              />
              <span onClick={() => setShowPassword(!showPassword)} className="eye-toggle">
                {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
              </span>
            </div>
          </div>

          <div className="form-options" style={{ margin: '8px 0 16px 0' }}>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: '600',
                color: modoMovil ? '#0284c7' : '#64748b',
                userSelect: 'none'
              }}
            >
              <input
                type="checkbox"
                checked={modoMovil}
                onChange={(e) => {
                  setModoMovil(e.target.checked);
                  localStorage.setItem('sitc_preferred_view', e.target.checked ? 'movil' : 'desktop');
                }}
                style={{
                  accentColor: '#0284c7',
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer'
                }}
              />
              <Smartphone size={15} color={modoMovil ? '#0284c7' : '#64748b'} />
              <span>Iniciar directamente en SITC Móvil</span>
            </label>
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? <span className="loader"></span> : <>Entrar al Sistema <LogIn size={18}/></>}
          </button>
        </form>

        <footer className="auth-footer">
         
        </footer>
      </div>
    </div>
  );
};

export default Auth;