import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser: usuario, session, loading } = useAuthStore();

  const location = useLocation();

  // 1. Verificar si hay sesión activa
  if (!session) {
    // Redirigir al login si no hay sesión, guardando la ubicación actual para volver después
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // 2. Si el perfil aún está cargando, podemos mostrar un spinner o simplemente esperar
  // (App.jsx suele manejar la carga inicial, pero por seguridad verificamos)
  if (!usuario && session) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0B1120' }}>
        <div style={{ color: 'white', fontWeight: 'bold' }}>Cargando perfil de seguridad...</div>
      </div>
    );
  }

  // 3. Verificar permisos por rol (si se especifican roles permitidos)
  if (allowedRoles && allowedRoles.length > 0) {
    const rolUsuario = usuario?.rol;
    const esAdmin = usuario?.esAdminReal || usuario?.rol === 'Admin' || usuario?.rol === 'Gerente General';

    // Los administradores suelen tener acceso a todo por defecto en este sistema
    if (!esAdmin && !allowedRoles.includes(rolUsuario)) {
      console.warn(`[Seguridad] Acceso denegado para el rol: ${rolUsuario} en la ruta: ${location.pathname}`);
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
