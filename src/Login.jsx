import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Warehouse, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import { supabase } from './supabaseClient'; 
import './Auth.css';

const Auth = () => {
  const [isRightPanelActive, setIsRightPanelActive] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [loginData, setLoginData] = useState({
    email: 'jcontreras.totalclean@gmail.com',
    password: ''
  });

  const [registerData, setRegisterData] = useState({
    nombre: '', apellido: '', email: '', password: ''
  });

  const handleLoginChange = (e) => setLoginData({ ...loginData, [e.target.name]: e.target.value });
  const handleRegisterChange = (e) => setRegisterData({ ...registerData, [e.target.name]: e.target.value });

  // --- LOGIN REAL CON SUPABASE + VINCULACIÓN DE PERFIL ---
  const ejecutarLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // 1. Validar autenticación
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginData.email,
      password: loginData.password,
    });

    if (error) {
      alert("Error de acceso: " + error.message);
      setLoading(false);
      return;
    }

    // --- NUEVO: RECUPERAR DATOS DEL PERFIL (Rol, Depto, Firma) ---
    const { data: perfil, error: profileError } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.error("Error al obtener perfil:", profileError.message);
    }

    // --- VERIFICACIÓN DE ESTADO ACTIVO (BAJA LÓGICA) ---
    if (perfil && perfil.activo === false) {
      await supabase.auth.signOut();
      alert("Sesión Inactiva. Por favor, contacte al administrador.");
      setLoading(false);
      return;
    }

    // Guardamos la sesión de Auth y los datos del perfil de la tabla
    localStorage.setItem('user_totalclean_session', JSON.stringify(data.user));
    localStorage.setItem('user_profile', JSON.stringify(perfil)); // <--- Vital para filtros
    
    alert(`¡Bienvenido, ${perfil?.nombre || 'Usuario'}!`);
    navigate('/dashboard');
    setLoading(false);
  };

  // --- REGISTRO REAL CON SUPABASE + CREACIÓN DE PERFIL ---
  const ejecutarRegistro = async (e) => {
    e.preventDefault();
    setLoading(true);

    // 1. Registro en la sección de Autenticación
    const { data, error } = await supabase.auth.signUp({
      email: registerData.email,
      password: registerData.password,
      options: {
        data: {
          first_name: registerData.nombre,
          last_name: registerData.apellido,
        }
      }
    });

    if (error) {
      alert("Error en registro: " + error.message);
    } else {
      // 2. CREACIÓN DEL PERFIL EN LA TABLA 'perfiles'
      if (data.user) {
        const { error: profileError } = await supabase
          .from('perfiles')
          .insert([
            { 
              id: data.user.id, 
              nombre: registerData.nombre, 
              apellido: registerData.apellido,
              correo: registerData.email,
              rol: 'Por asignar', 
              departamento: 'Por asignar'
            }
          ]);

        if (profileError) {
          console.error("Error al crear perfil:", profileError.message);
        }
      }
      
      alert("Registro exitoso. Ahora puedes iniciar sesión.");
    }
    setLoading(false);
  };

  return (
    <div className="auth-body">
      <div className={`container ${isRightPanelActive ? "active" : ""}`} id="container">
        
        {/* FORMULARIO REGISTRO */}
        <div className="form-container sign-up">
          <form onSubmit={ejecutarRegistro}>
            <h1 className="title-black">Crear Cuenta</h1>
            <div className="social-icons"><Warehouse size={28} color="#0070e0" /></div>
            <span>Solicita acceso corporativo</span>
            <div className="row-inputs">
              <input type="text" name="nombre" placeholder="Nombre" onChange={handleRegisterChange} required />
              <input type="text" name="apellido" placeholder="Apellido" onChange={handleRegisterChange} required />
            </div>
            <input type="email" name="email" placeholder="Email @totalclean.com" onChange={handleRegisterChange} required />
            <input type="password" name="password" placeholder="Contraseña" onChange={handleRegisterChange} required />
            <button type="submit" className="btn-solid" disabled={loading}>
              {loading ? "Procesando..." : "Registrar"} <UserPlus size={16}/>
            </button>
          </form>
        </div>

        {/* FORMULARIO LOGIN */}
        <div className="form-container sign-in">
          <form onSubmit={ejecutarLogin}>
            <h1 className="title-black">Inicio de sesión</h1>
            <div className="social-icons"><Warehouse size={28} color="#0070e0" /></div>
            <span>SIS-REQUISICIONES</span>
            
            <input type="email" name="email" value={loginData.email} placeholder="Email" onChange={handleLoginChange} required />
            
            <div className="password-wrapper" style={{width: '100%', position: 'relative'}}>
              <input 
                type={showPassword ? "text" : "password"} 
                name="password" 
                placeholder="Contraseña" 
                onChange={handleLoginChange} 
                required 
                style={{width: '100%'}}
              />
              <span onClick={() => setShowPassword(!showPassword)} className="eye-icon">
                {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
              </span>
            </div>
            
            <a href="#" className="forgot">¿Olvidaste tu contraseña?</a>
            <button type="submit" className="btn-solid" disabled={loading}>
              {loading ? "Validando..." : "Entrar"} <LogIn size={15}/></button>
          </form>
        </div>

        {/* PANELES LATERALES */}
        <div className="toggle-container">
          <div className="toggle">
            <div className="toggle-panel toggle-left">
              <h1 className="title-white">¡Bienvenido!</h1>
              <p>Accede para gestionar tus requisiciones.</p>
              <button className="hidden" onClick={() => setIsRightPanelActive(false)}>Inicio de sesión</button>
            </div>
            <div className="toggle-panel toggle-right">
              <h1 className="title-white">¿Nuevo aquí?</h1>
              <p>Solicita tu acceso al ecosistema de TOTAL CLEAN C.A.</p>
              <button className="hidden" onClick={() => setIsRightPanelActive(true)}>Regístrate</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;