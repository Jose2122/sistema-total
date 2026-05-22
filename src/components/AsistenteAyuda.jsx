import React, { useState, useEffect } from 'react';
import { HelpCircle, Search, Sparkles, BookOpen, AlertCircle, X, ChevronRight } from 'lucide-react';
import { helpDatabase } from '../constants/helpDatabase';
import CentroAyuda from './CentroAyuda';

export default function AsistenteAyuda() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  // Cerrar el panel flotante si se presiona la tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsPanelOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const categories = [
    'Todos',
    'Solicitud de Fondos',
    'Requisiciones',
    'Tickets de pago',
    'Compras',
    'Usuarios',
    'Errores Comunes'
  ];

  // Filtrado en tiempo real utilizando .filter() e .includes()
  const filteredArticles = helpDatabase.filter(article => {
    const query = searchQuery.toLowerCase().trim();
    
    // Validar coincidencia de categoría
    const matchesCategory = selectedCategory === 'Todos' || article.categoria === selectedCategory;
    
    if (query === '') return matchesCategory;

    // Buscar en título, categoría y palabras clave (keywords)
    const matchesTitle = article.titulo.toLowerCase().includes(query);
    const matchesCatText = article.categoria.toLowerCase().includes(query);
    const matchesKeywords = article.keywords.some(keyword => keyword.toLowerCase().includes(query));

    return matchesCategory && (matchesTitle || matchesCatText || matchesKeywords);
  });

  const handleSelectArticle = (article) => {
    setSelectedArticle(article);
    setIsDrawerOpen(true);
    setIsPanelOpen(false); // Cierra el panel de acceso rápido para no obstruir
  };

  const handleOpenDrawerDirectly = () => {
    // Por defecto, carga la guía de Solicitud de Fondos al presionar ver ayuda completa
    const defaultArticle = helpDatabase.find(a => a.id === 'solicitud-fondos') || helpDatabase[0];
    handleSelectArticle(defaultArticle);
  };

  const handleBackToSearch = () => {
    setIsDrawerOpen(false);
    setIsPanelOpen(true);
  };

  const styles = {
    container: {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 99999,
      fontFamily: '"Inter", sans-serif',
      boxSizing: 'border-box',
    },
    // Botón Flotante Principal
    floatBtn: {
      width: '54px',
      height: '54px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35), 0 2px 6px rgba(0, 0, 0, 0.1)',
      border: '2px solid rgba(255, 255, 255, 0.2)',
      outline: 'none',
      transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      position: 'relative',
    },
    pulseRing: {
      position: 'absolute',
      top: '-4px',
      left: '-4px',
      right: '-4px',
      bottom: '-4px',
      border: '2px solid #0ea5e9',
      borderRadius: '50%',
      opacity: 0,
      animation: 'pulse 2s infinite',
      pointerEvents: 'none',
    },
    // Panel de Asistencia Rápida
    panel: {
      position: 'absolute',
      bottom: '68px',
      right: 0,
      width: '350px',
      height: '520px',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderRadius: '24px',
      boxShadow: '0 20px 40px rgba(15, 23, 42, 0.15), 0 1px 3px rgba(0, 0, 0, 0.05)',
      border: '1px solid rgba(226, 232, 240, 0.8)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transformOrigin: 'bottom right',
      animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
    },
    panelHeader: {
      padding: '16px 20px',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    panelTitleContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    panelTitle: {
      fontSize: '12px',
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      margin: 0,
    },
    panelSubtitle: {
      fontSize: '10px',
      color: '#38bdf8',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      margin: '2px 0 0 0',
    },
    panelClose: {
      background: 'none',
      border: 'none',
      color: '#94a3b8',
      cursor: 'pointer',
      padding: '4px',
      borderRadius: '6px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s',
    },
    searchContainer: {
      padding: '12px 16px',
      backgroundColor: '#f8fafc',
      borderBottom: '1px solid #f1f5f9',
      position: 'relative',
    },
    searchInput: {
      width: '100%',
      padding: '10px 12px 10px 36px',
      fontSize: '12px',
      color: '#1e293b',
      backgroundColor: '#ffffff',
      border: '1px solid #cbd5e1',
      borderRadius: '12px',
      outline: 'none',
      transition: 'all 0.2s',
      boxSizing: 'border-box',
    },
    searchIcon: {
      position: 'absolute',
      left: '26px',
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#94a3b8',
    },
    // Categorías en Pills
    categorySection: {
      padding: '10px 16px 6px 16px',
      backgroundColor: '#ffffff',
    },
    sectionLabel: {
      fontSize: '11px',
      textTransform: 'uppercase',
      fontWeight: '800',
      letterSpacing: '0.8px',
      color: '#64748b',
      marginBottom: '8px',
      display: 'block',
    },
    categoryList: {
      display: 'flex',
      gap: '6px',
      overflowX: 'auto',
      paddingBottom: '6px',
      scrollbarWidth: 'none', // Firefox
      msOverflowStyle: 'none',  // IE
    },
    categoryPill: (active) => ({
      padding: '5px 10px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: '700',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      transition: 'all 0.2s',
      backgroundColor: active ? '#eff6ff' : '#f1f5f9',
      color: active ? '#2563eb' : '#475569',
      border: active ? '1px solid #bfdbfe' : '1px solid transparent',
    }),
    // Lista de Resultados
    resultsSection: {
      flex: 1,
      overflowY: 'auto',
      padding: '8px 16px',
      backgroundColor: '#ffffff',
    },
    articleCard: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px',
      borderRadius: '12px',
      border: '1px solid #f1f5f9',
      marginBottom: '8px',
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
    articleMeta: {
      fontSize: '10px',
      textTransform: 'uppercase',
      fontWeight: '800',
      letterSpacing: '0.5px',
      color: '#38bdf8',
      marginBottom: '2px',
    },
    articleTitle: {
      fontSize: '12px',
      fontWeight: '700',
      color: '#1e293b',
      margin: 0,
    },
    articleDesc: {
      fontSize: '11px',
      color: '#64748b',
      margin: '4px 0 0 0',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      maxWidth: '260px',
    },
    noResults: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 10px',
      textAlign: 'center',
      color: '#94a3b8',
    },
    panelFooter: {
      padding: '12px 16px',
      borderTop: '1px solid #f1f5f9',
      backgroundColor: '#f8fafc',
      textAlign: 'center',
    },
    footerBtn: {
      width: '100%',
      padding: '10px 16px',
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      color: '#ffffff',
      border: 'none',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '800',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      boxShadow: '0 4px 10px rgba(15, 23, 42, 0.1)',
      transition: 'all 0.2s',
    },
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.5; }
          50% { transform: scale(1.15); opacity: 0; }
          100% { transform: scale(0.95); opacity: 0; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .category-scroll::-webkit-scrollbar {
          display: none;
        }
        .article-card-hover:hover {
          border-color: #bfdbfe !important;
          background-color: #f0f7ff !important;
          transform: translateX(2px);
        }
        .footer-btn-hover:hover {
          filter: brightness(1.15);
          transform: translateY(-1px);
        }
        .float-btn-hover:hover {
          transform: scale(1.05);
          filter: brightness(1.1);
        }
      `}</style>

      {/* Panel Flotante */}
      {isPanelOpen && (
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div style={styles.panelTitleContainer}>
              <Sparkles size={16} style={{ color: '#38bdf8' }} />
              <div>
                <h3 style={styles.panelTitle}>Asistencia SITC</h3>
                <p style={styles.panelSubtitle}>Soporte Virtual</p>
              </div>
            </div>
            <button 
              onClick={() => setIsPanelOpen(false)} 
              style={styles.panelClose}
              onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
            >
              <X size={16} />
            </button>
          </div>

          {/* Buscador */}
          <div style={styles.searchContainer}>
            <Search size={14} style={styles.searchIcon} />
            <input
              type="text"
              placeholder="Buscar guías (ej. fondos, dinero, ticket)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
              onFocus={(e) => e.currentTarget.style.borderColor = '#0ea5e9'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
            />
          </div>

          {/* Categorías Rápidas */}
          <div style={styles.categorySection}>
            <span style={styles.sectionLabel}>Categorías Rápidas</span>
            <div style={styles.categoryList} className="category-scroll">
              {categories.map(cat => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    style={styles.categoryPill(active)}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resultados de Búsqueda */}
          <div style={styles.resultsSection}>
            <span style={styles.sectionLabel}>
              {searchQuery.trim() !== '' ? 'Resultados de Búsqueda' : 'Guías Disponibles'} ({filteredArticles.length})
            </span>
            {filteredArticles.length === 0 ? (
              <div style={styles.noResults}>
                <AlertCircle size={28} style={{ strokeWidth: 1.5, marginBottom: '8px', color: '#cbd5e1' }} />
                <span style={{ fontSize: '11px', fontWeight: 'bold' }}>No se encontraron guías</span>
                <p style={{ fontSize: '10px', color: '#94a3b8', margin: '4px 0 0 0' }}>Prueba con palabras clave como "fondos", "anular", "soporte" o cambia de categoría.</p>
              </div>
            ) : (
              filteredArticles.map(article => (
                <div
                  key={article.id}
                  style={styles.articleCard}
                  className="article-card-hover"
                  onClick={() => handleSelectArticle(article)}
                >
                  <div style={{ flex: 1, paddingRight: '8px' }}>
                    <span style={styles.articleMeta}>{article.categoria}</span>
                    <h4 style={styles.articleTitle}>{article.titulo}</h4>
                    <p style={styles.articleDesc}>{article.descripcion}</p>
                  </div>
                  <ChevronRight size={14} style={{ color: '#cbd5e1', flexShrink: 0 }} />
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div style={styles.panelFooter}>
            <button 
              onClick={handleOpenDrawerDirectly} 
              style={styles.footerBtn}
              className="footer-btn-hover"
            >
              <BookOpen size={14} />
              <span>Ver Centro de Ayuda Completo</span>
            </button>
          </div>
        </div>
      )}

      {/* Botón Flotante */}
      <button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        style={styles.floatBtn}
        className="float-btn-hover"
        title="Asistente de Ayuda SITC"
      >
        <div style={styles.pulseRing}></div>
        {isPanelOpen ? <X size={22} /> : <HelpCircle size={22} />}
      </button>

      {/* Drawer Lateral del Centro de Ayuda */}
      <CentroAyuda
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        selectedArticle={selectedArticle}
        onBackToSearch={handleBackToSearch}
      />
    </div>
  );
}
