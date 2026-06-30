import React from 'react';
import { supabase } from './supabaseClient';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ERROR BOUNDARY] Capturado error de renderizado:", error, errorInfo);
    this.logRenderError(error, errorInfo);
  }

  async logRenderError(error, errorInfo) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let userId = session?.user?.id || null;
      let userRol = 'Anon';

      if (userId) {
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', userId)
          .single();
        if (perfil) userRol = perfil.rol || 'Usuario';
      }

      const stackMessage = errorInfo?.componentStack || '';
      const fullError = `${error.name || 'Error'}: ${error.message || 'Error desconocido'}\nStack: ${stackMessage}`;

      await supabase.from('system_errors').insert([{
        componente: `React Component: ${this.props.componentName || 'Global'}`,
        error_mensaje: fullError.substring(0, 800),
        status_code: 500,
        usuario_id: userId,
        usuario_rol: userRol
      }]);
    } catch (err) {
      console.error("Error al registrar error en system_errors:", err);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '30px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '16px',
          margin: '24px',
          textAlign: 'center',
          fontFamily: "'Inter', sans-serif",
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '15px' }}>⚠️</div>
          <h2 style={{ color: '#991b1b', margin: '0 0 10px 0', fontSize: '1.25rem', fontWeight: '800' }}>
            Algo no salió como esperábamos
          </h2>
          <p style={{ color: '#7f1d1d', fontSize: '0.9rem', margin: '0 auto', maxWidth: '500px', lineHeight: '1.5' }}>
            Se ha producido un error inesperado de renderizado en esta sección del sistema. 
            El fallo ha sido reportado automáticamente al equipo de soporte.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'background-color 0.2s',
              boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#dc2626'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#ef4444'}
          >
            Recargar Aplicación
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
