import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Login'; 
import Dashboard from './Dashboard'; 
import SolicitudFondos from './SolicitudFondos';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Revisar sesión actual al cargar la app
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 2. Escuchar cambios en la autenticación (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div style={{display: 'flex', justifyContent: 'center', marginTop: '50px'}}>Cargando sistema de Total Clean...</div>;

  return (
    <Router>
      <Routes>
        {/* Si hay sesión, al entrar a "/" te manda al Dashboard automáticamente */}
        <Route path="/" element={!session ? <Auth /> : <Navigate to="/dashboard" />} />
        
        {/* Rutas protegidas: Si no hay sesión, te mandan al Login "/" */}
        <Route path="/dashboard" element={session ? <Dashboard /> : <Navigate to="/" />} />
        <Route path="/SolicitudFondos" element={session ? <SolicitudFondos /> : <Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;