import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { estaEnVacaciones } from './utils/delegationUtils';

const ProtectedRoute = ({ children, allowedRoles, session: sessionProp }) => {
  const storeUser = useAuthStore(state => state.currentUser);
  const storeSession = useAuthStore(state => state.session);
  const fetchUser = useAuthStore(state => state.fetchUser);
  const usuario = storeUser;
  const session = sessionProp || storeSession;

  const location = useLocation();

  useEffect(() => {
    if (session && !usuario) {
      fetchUser();
    }
  }, [session, usuario, fetchUser]);

  // 1. Si explícitamente no hay sesión
  if (sessionProp === null && !storeSession) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // 2. Verificar receso vacacional
  const emailLower = (usuario?.correo || usuario?.email || '').toLowerCase().trim();
  const esAdminReal = emailLower === 'jcontreras.totalclean@gmail.com' ||
    emailLower === 'cvega@totalclean.com.ve' ||
    emailLower === 'karincmm1@gmail.com' ||
    usuario?.esAdminReal;

  if (usuario && estaEnVacaciones(usuario) && !esAdminReal) {
    const { logout } = useAuthStore.getState();

    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        justify: 'center', 
        alignItems: 'center', 
        height: '100vh', 
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        fontFamily: "'Inter', sans-serif",
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '24px',
          padding: '40px',
          maxWidth: '520px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🌴☀️🏖️</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '0 0 12px 0', color: '#38bdf8' }}>
            ¡Sabemos que estás de vacaciones!
          </h2>
          <p style={{ fontSize: '0.95rem', color: '#e2e8f0', lineHeight: '1.6', marginBottom: '24px' }}>
            Hola, <strong>{usuario.nombre} {usuario.apellido}</strong>.<br/>
            Disfruta mucho tu descanso hasta tu llegada. Por el momento tu cuenta se encuentra temporalmente en receso vacacional y el acceso al sistema está inhabilitado.
          </p>
          <div style={{
            backgroundColor: '#0f172a',
            padding: '18px',
            borderRadius: '20px',
            border: '1px dashed #38bdf8',
            fontSize: '0.82rem',
            color: '#94a3b8',
            textAlign: 'left',
            marginBottom: '28px',
            lineHeight: '1.5'
          }}>
            ℹ️ <strong> No te preocupes por la operación:</strong><br/>
            Tus requisiciones, tickets y solicitudes de fondos pendientes han sido derivadas automáticamente a tu cargo superior para su aprobación. Tu cuenta se reactivará automáticamente al finalizar tus vacaciones.
          </div>
          <button 
            onClick={logout}
            style={{
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '14px',
              padding: '14px 28px',
              fontWeight: '700',
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 10px 15px -3px rgba(239, 68, 68, 0.4)',
              transition: 'all 0.2s ease'
            }}
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  // 3. Permisos por rol
  if (allowedRoles && allowedRoles.length > 0 && usuario) {
    const rolUsuario = usuario?.rol;
    const esAdmin = esAdminReal || usuario?.rol === 'Admin' || usuario?.rol === 'Gerente General';

    if (!esAdmin && !allowedRoles.includes(rolUsuario)) {
      console.warn(`[Seguridad] Acceso denegado para el rol: ${rolUsuario} en la ruta: ${location.pathname}`);
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
