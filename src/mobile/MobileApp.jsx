import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import MobileRequisiciones from './MobileRequisiciones';
import MobileTickets from './MobileTickets';
import { FileText, Ticket, User, Monitor, LogOut, CheckCircle2, Shield, Building2, Smartphone, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import './mobile.css';

export default function MobileApp() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [activeTab, setActiveTab] = useState('requisiciones'); // 'requisiciones' | 'tickets' | 'perfil'
  const [pendingReqCount, setPendingReqCount] = useState(0);
  const [pendingTicketCount, setPendingTicketCount] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Detectar si ya está corriendo instalada (standalone)
    const isStandalone = (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) || 
                         (typeof window !== 'undefined' && window.navigator.standalone === true);
    setIsInstalled(isStandalone);

    // Detectar iOS Safari
    if (typeof window !== 'undefined') {
      const ua = window.navigator.userAgent.toLowerCase();
      setIsIOS(/iphone|ipad|ipod/.test(ua));
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstalarApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        toast.success('¡SITC Móvil agregado con éxito!');
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSInstructions(true);
    } else {
      toast('Toca el menú de tu navegador ⋮ y pulsa "Instalar aplicación" o "Agregar a pantalla principal"', { icon: '📲', duration: 6000 });
    }
  };

  useEffect(() => {
    const cargarUsuario = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/');
          return;
        }

        const { data: perfil } = await supabase
          .from('perfiles')
          .select('*')
          .eq('id', user.id)
          .single();

        const emailLower = (user.email || '').toLowerCase();
        const esAdminReal = emailLower === 'jcontreras.totalclean@gmail.com' ||
                            emailLower === 'cvega@totalclean.com.ve' ||
                            emailLower === 'karincmm1@gmail.com' ||
                            (perfil?.rol || '').toUpperCase().includes('ADMIN') ||
                            (perfil?.rol || '').toUpperCase().includes('SUPERADMIN');

        setCurrentUser({
          ...(perfil || {}),
          id: user.id,
          email: user.email,
          correo: perfil?.correo || user.email,
          nombre: perfil?.nombre || user.email.split('@')[0],
          apellido: perfil?.apellido || '',
          rol: perfil?.rol || 'Usuario',
          departamento: perfil?.departamento || 'Total Clean',
          esAdminReal
        });
      } catch (err) {
        console.error('Error al cargar perfil en móvil:', err);
      } finally {
        setLoadingUser(false);
      }
    };

    cargarUsuario();
  }, [navigate]);

  const handleCerrarSesion = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const getInitials = (n, a) => {
    if (!n) return 'TC';
    return `${n.charAt(0)}${a ? a.charAt(0) : ''}`.toUpperCase();
  };

  const primerNombre = (currentUser?.nombre || '').split(' ')[0] || 'Usuario';

  if (loadingUser) {
    return (
      <div className="m-app-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <img 
          src="/logo-tc-white.png" 
          alt="Total Clean" 
          style={{ height: '48px', width: 'auto', objectFit: 'contain', marginBottom: '16px', filter: 'drop-shadow(0 4px 12px rgba(56, 189, 248, 0.3))' }} 
        />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
          SITC<span style={{ color: '#38bdf8' }}>.</span> Móvil
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 500, margin: 0 }}>Cargando sistema...</p>
      </div>
    );
  }

  return (
    <div className="m-app-container">
      {/* TopBar */}
      <header className="m-topbar">
        <div className="m-brand">
          <img 
            src="/logo-tc-white.png" 
            alt="Total Clean" 
            className="m-brand-logo-img" 
          />
          <div className="m-brand-title">
            <div className="m-brand-header-row">
              <h1>SITC<span style={{ color: '#38bdf8' }}>.</span></h1>
              <span className="m-brand-badge">Móvil</span>
            </div>
            <div className="m-brand-greeting">
              <span className="m-pulse-dot"></span>
              <span>Hola, {primerNombre} 👋</span>
            </div>
          </div>
        </div>

        <div className="m-topbar-actions">
          {/* Botón para cambiar a versión de escritorio */}
          <button
            className="m-btn-icon"
            onClick={() => navigate('/dashboard')}
            title="Cambiar a Versión Completa (PC)"
          >
            <Monitor size={18} />
          </button>

          {/* Iniciales / Avatar */}
          <div
            onClick={() => setActiveTab('perfil')}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '14px',
              backgroundColor: '#0284c7',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              border: activeTab === 'perfil' ? '2px solid #38bdf8' : '2px solid rgba(255,255,255,0.1)',
              boxShadow: '0 4px 10px rgba(2, 132, 199, 0.3)'
            }}
          >
            {getInitials(currentUser?.nombre, currentUser?.apellido)}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1 }}>
        {activeTab === 'requisiciones' && (
          <MobileRequisiciones
            currentUser={currentUser}
            onPendingCountChange={setPendingReqCount}
          />
        )}

        {activeTab === 'tickets' && (
          <MobileTickets
            currentUser={currentUser}
            onPendingCountChange={setPendingTicketCount}
          />
        )}

        {activeTab === 'perfil' && (
          <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="m-card" style={{ alignItems: 'center', textAlign: 'center', padding: '24px 16px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '20px',
                  backgroundColor: '#0284c7',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.4rem',
                  marginBottom: '12px'
                }}
              >
                {getInitials(currentUser?.nombre, currentUser?.apellido)}
              </div>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', color: '#ffffff' }}>
                {currentUser?.nombre} {currentUser?.apellido}
              </h2>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{currentUser?.correo}</span>
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span className="m-status-pill m-status-info">
                  <Shield size={12} /> {currentUser?.rol}
                </span>
                <span className="m-status-pill m-status-warning">
                  <Building2 size={12} /> {currentUser?.departamento}
                </span>
              </div>
            </div>

            {/* Tarjeta de Instalación PWA en Pantalla de Inicio */}
            <div className="m-card" style={{ background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)', borderColor: 'rgba(56, 189, 248, 0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Smartphone size={22} color="#38bdf8" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', color: '#ffffff', fontWeight: 800 }}>
                    {isInstalled ? 'SITC Instalado' : 'Instalar en este Teléfono'}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    {isInstalled ? 'Estás disfrutando la versión de pantalla completa' : 'Acceso instantáneo con ícono directo en tu pantalla'}
                  </span>
                </div>
              </div>

              {!isInstalled ? (
                <>
                  <button
                    className="m-btn m-btn-approve"
                    style={{ minHeight: '44px', fontSize: '0.84rem' }}
                    onClick={handleInstalarApp}
                  >
                    <Download size={16} />
                    <span>Agregar a Pantalla de Inicio</span>
                  </button>

                  {showIOSInstructions && (
                    <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.35)', padding: '10px 12px', borderRadius: '12px', fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.45', border: '1px solid rgba(255,255,255,0.08)' }}>
                      📱 <strong>En iPhone / Safari:</strong><br />
                      1. Toca el botón <strong>Compartir</strong> (ícono de cuadro con flecha hacia arriba).<br />
                      2. Desliza hacia abajo y selecciona <strong>"Agregar a pantalla de inicio ＋"</strong>.
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#34d399', fontWeight: 700 }}>
                  <CheckCircle2 size={16} />
                  <span>Aplicación PWA agregada a tu pantalla de inicio</span>
                </div>
              )}
            </div>

            {/* Accesos rápidos */}
            <div className="m-card">
              <h3 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#f8fafc', fontWeight: 700 }}>
                Opciones del Sistema
              </h3>

              <button
                className="m-btn"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#38bdf8',
                  marginBottom: '8px'
                }}
                onClick={() => navigate('/dashboard')}
              >
                <Monitor size={18} />
                <span>Ir a la Versión Completa (PC)</span>
              </button>

              <button
                className="m-btn m-btn-reject"
                onClick={handleCerrarSesion}
              >
                <LogOut size={18} />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="m-bottom-nav">
        <button
          className={`m-nav-item ${activeTab === 'requisiciones' ? 'active' : ''}`}
          onClick={() => setActiveTab('requisiciones')}
        >
          <FileText size={22} />
          <span>Requisiciones</span>
          {pendingReqCount > 0 && <span className="m-nav-badge">{pendingReqCount}</span>}
        </button>

        <button
          className={`m-nav-item ${activeTab === 'tickets' ? 'active' : ''}`}
          onClick={() => setActiveTab('tickets')}
        >
          <Ticket size={22} />
          <span>Tickets Pago</span>
          {pendingTicketCount > 0 && <span className="m-nav-badge">{pendingTicketCount}</span>}
        </button>

        <button
          className={`m-nav-item ${activeTab === 'perfil' ? 'active' : ''}`}
          onClick={() => setActiveTab('perfil')}
        >
          <User size={22} />
          <span>Mi Perfil</span>
        </button>
      </nav>
    </div>
  );
}

