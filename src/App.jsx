import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Toaster } from 'react-hot-toast';
import Auth from './Login'; 
import Dashboard from './Dashboard'; 
import SolicitudFondos from './SolicitudFondos';
import Almacen from './Almacen';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleSession = async (currentSession) => {
    if (!currentSession) {
      setSession(null);
      setLoading(false);
      return;
    }
    
    try {
      // Check if active
      const { data } = await supabase.from('perfiles').select('activo').eq('id', currentSession.user.id).single();
      
      if (data && data.activo === false) {
        await supabase.auth.signOut();
        alert("Tu cuenta ha sido desactivada. Contacta al administrador.");
        setSession(null);
      } else {
        // Update last_login
        await supabase.from('perfiles').update({ last_login: new Date().toISOString() }).eq('id', currentSession.user.id);
        setSession(currentSession);
      }
    } catch(err) {
      console.error("Error validando sesión:", err);
      setSession(currentSession); // Fallback if DB fails
    }
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED' || _event === 'INITIAL_SESSION') {
         handleSession(session);
      } else if (_event === 'SIGNED_OUT') {
         setSession(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div style={{display: 'flex', justifyContent: 'center', marginTop: '50px'}}>Cargando sistema de Total Clean...</div>;

  return (
    <Router>
      <Toaster 
        position="top-center" 
        containerStyle={{ zIndex: 999999 }}
        toastOptions={{ 
          duration: 5000,
          style: {
            background: '#ffffff',
            color: '#1e293b',
            borderRadius: '16px',
            padding: '16px 24px',
            fontSize: '14px',
            fontWeight: '600',
            fontFamily: "'Inter', sans-serif",
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            maxWidth: '450px',
          },
          success: {
            style: {
              background: '#f0fdf4',
              color: '#166534',
              border: '1px solid #bbf7d0',
            },
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            style: {
              background: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
            },
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }} 
      />

      <Routes>
        {/* Si hay sesión, al entrar a "/" te manda al Dashboard automáticamente */}
        <Route path="/" element={!session ? <Auth /> : <Navigate to="/dashboard" />} />
        
        {/* Rutas protegidas: Si no hay sesión, te mandan al Login "/" */}
        <Route path="/dashboard" element={session ? <Dashboard /> : <Navigate to="/" />} />
        <Route path="/SolicitudFondos" element={session ? <SolicitudFondos /> : <Navigate to="/" />} />
        <Route path="/almacen" element={session ? <Almacen /> : <Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
// update v2