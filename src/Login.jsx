import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Warehouse, LogIn, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import './Auth.css';

const Auth = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  const handleChange = (e) => setLoginData({ ...loginData, [e.target.name]: e.target.value });

  const ejecutarLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginData.email,
      password: loginData.password,
    });

    if (error) {
      toast.error("Credenciales incorrectas: " + error.message);
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
      setLoading(false);
      return;
    }

    localStorage.setItem('user_totalclean_session', JSON.stringify(data.user));
    localStorage.setItem('user_profile', JSON.stringify(perfil));
    
    navigate('/dashboard');
    setLoading(false);
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-background-shape"></div>
      <div className="auth-card animate-fade-in">
        
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
                placeholder="ejemplo@totalclean.com" 
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
                placeholder="••••••••" 
                onChange={handleChange} 
                required 
              />
              <span onClick={() => setShowPassword(!showPassword)} className="eye-toggle">
                {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
              </span>
            </div>
          </div>

          <div className="form-options">
           
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? <span className="loader"></span> : <>Entrar al Sistema <LogIn size={18}/></>}
          </button>
        </form>

        <footer className="auth-footer">
          Total Clean C.A. &copy; 2026 
        </footer>
      </div>
    </div>
  );
};

export default Auth;