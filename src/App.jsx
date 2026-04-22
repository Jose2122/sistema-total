import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Toaster } from 'react-hot-toast';
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
      <Toaster 
        position="top-right" 
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
      </Routes>
    </Router>
  );
}

export default App;