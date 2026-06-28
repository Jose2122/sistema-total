import React, { useState } from 'react';
import { X, CheckCircle, ChevronDown, ChevronRight, BookOpen, AlertCircle, ArrowLeft } from 'lucide-react';

export default function CentroAyuda({ isOpen, onClose, selectedArticle, onBackToSearch }) {
  const [completedSteps, setCompletedSteps] = useState({});
  const [expandedFaq, setExpandedFaq] = useState(null);

  if (!isOpen) return null;

  const toggleStep = (stepNumber) => {
    setCompletedSteps(prev => ({
      ...prev,
      [stepNumber]: !prev[stepNumber]
    }));
  };

  const toggleFaq = (index) => {
    setExpandedFaq(prev => (prev === index ? null : index));
  };

  const styles = {
    overlay: {
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
      zIndex: 9999,
      display: 'flex',
      justifyContent: 'flex-end',
      transition: 'opacity 0.3s ease',
    },
    drawer: {
      width: '100%',
      maxWidth: '460px',
      height: '100vh',
      backgroundColor: '#ffffff',
      boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '"Inter", sans-serif',
      boxSizing: 'border-box',
      animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
    },
    header: {
      padding: '16px 20px',
      borderBottom: '1px solid #f1f5f9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#0f172a',
      color: '#ffffff',
    },
    headerTitleContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    headerTitle: {
      fontSize: '13px',
      fontWeight: '900',
      letterSpacing: '1px',
      textTransform: 'uppercase',
      margin: 0,
    },
    backBtn: {
      background: 'none',
      border: 'none',
      color: '#94a3b8',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '11px',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      padding: '4px 8px',
      borderRadius: '6px',
      transition: 'all 0.2s',
    },
    closeBtn: {
      background: 'rgba(255,255,255,0.08)',
      border: 'none',
      borderRadius: '8px',
      color: '#94a3b8',
      cursor: 'pointer',
      width: '28px',
      height: '28px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s',
    },
    content: {
      flex: 1,
      overflowY: 'auto',
      padding: '24px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
    },
    metaLabel: {
      fontSize: '11px',
      textTransform: 'uppercase',
      fontWeight: '700',
      letterSpacing: '0.8px',
      color: '#64748b',
      marginBottom: '4px',
    },
    articleTitle: {
      fontSize: '18px',
      fontWeight: '800',
      color: '#0f172a',
      margin: '0 0 8px 0',
      lineHeight: '1.2',
    },
    categoryTag: {
      display: 'inline-block',
      padding: '4px 8px',
      borderRadius: '6px',
      backgroundColor: '#f1f5f9',
      color: '#475569',
      fontSize: '11px',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      marginBottom: '12px',
    },
    description: {
      fontSize: '12px',
      color: '#475569',
      lineHeight: '1.5',
      margin: 0,
      backgroundColor: '#f8fafc',
      padding: '12px',
      borderRadius: '10px',
      borderLeft: '3px solid #3b82f6',
    },
    sectionContainer: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    sectionTitle: {
      fontSize: '11px',
      textTransform: 'uppercase',
      fontWeight: '800',
      letterSpacing: '1px',
      color: '#0f172a',
      borderBottom: '2px solid #e2e8f0',
      paddingBottom: '6px',
      margin: 0,
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
    // Status Flow UI
    statusGrid: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
    statusCard: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '8px 12px',
      borderRadius: '10px',
      border: '1px solid #f1f5f9',
      transition: 'all 0.2s',
    },
    statusBadge: (bg, col) => ({
      padding: '4px 8px',
      borderRadius: '6px',
      fontSize: '10px',
      fontWeight: '900',
      backgroundColor: bg,
      color: col,
      minWidth: '130px',
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
    }),
    statusDesc: {
      fontSize: '12px',
      color: '#64748b',
      margin: 0,
      flex: 1,
      lineHeight: '1.3',
    },
    // Steps Interactive UI
    stepCard: (isCompleted) => ({
      display: 'flex',
      gap: '12px',
      padding: '12px 14px',
      borderRadius: '12px',
      border: isCompleted ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
      backgroundColor: isCompleted ? '#f0fdf4' : '#ffffff',
      transition: 'all 0.2s ease',
      cursor: 'pointer',
    }),
    checkboxContainer: {
      display: 'flex',
      alignItems: 'flex-start',
      paddingTop: '2px',
    },
    checkbox: (isCompleted) => ({
      width: '16px',
      height: '16px',
      borderRadius: '4px',
      border: isCompleted ? '2px solid #10b981' : '2px solid #cbd5e1',
      backgroundColor: isCompleted ? '#10b981' : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      cursor: 'pointer',
      transition: 'all 0.2s',
    }),
    stepNum: {
      fontSize: '11px',
      textTransform: 'uppercase',
      fontWeight: '900',
      letterSpacing: '0.5px',
      color: '#94a3b8',
      marginBottom: '2px',
    },
    stepTitle: (isCompleted) => ({
      fontSize: '12px',
      fontWeight: '700',
      color: isCompleted ? '#166534' : '#1e293b',
      margin: '0 0 4px 0',
    }),
    stepDetail: (isCompleted) => ({
      fontSize: '12px',
      color: isCompleted ? '#2f6846' : '#475569',
      lineHeight: '1.4',
      margin: 0,
    }),
    // FAQ UI
    faqItem: {
      border: '1px solid #e2e8f0',
      borderRadius: '10px',
      overflow: 'hidden',
      marginBottom: '8px',
      transition: 'all 0.2s',
    },
    faqHeader: {
      padding: '12px 16px',
      backgroundColor: '#f8fafc',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      cursor: 'pointer',
      gap: '10px',
    },
    faqQuestion: {
      fontSize: '12px',
      fontWeight: '700',
      color: '#1e293b',
      margin: 0,
      lineHeight: '1.4',
    },
    faqBody: {
      padding: '12px 16px',
      backgroundColor: '#ffffff',
      borderTop: '1px solid #e2e8f0',
      fontSize: '12px',
      color: '#475569',
      lineHeight: '1.5',
      margin: 0,
    },
    noArticle: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '40px 20px',
      textAlign: 'center',
      color: '#94a3b8',
    },
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .step-checkbox:hover {
          border-color: #3b82f6 !important;
        }
        .faq-item-hover:hover {
          border-color: #cbd5e1 !important;
        }
      `}</style>

      <div style={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={styles.headerTitleContainer}>
            {onBackToSearch && (
              <button 
                onClick={onBackToSearch} 
                style={styles.backBtn}
                onMouseEnter={(e) => e.currentTarget.style.color = '#38bdf8'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
              >
                <ArrowLeft size={14} />
                <span>Volver</span>
              </button>
            )}
            {!onBackToSearch && <BookOpen size={16} style={{ color: '#38bdf8' }} />}
            <h2 style={styles.headerTitle}>Guía Interactiva</h2>
          </div>
          <button 
            onClick={onClose} 
            style={styles.closeBtn}
            onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
          >
            <X size={18} />
          </button>
        </div>

        {selectedArticle ? (
          <div style={styles.content}>
            {/* Header del artículo */}
            <div>
              <span style={styles.categoryTag}>{selectedArticle.categoria}</span>
              <h1 style={styles.articleTitle}>{selectedArticle.titulo}</h1>
              <p style={styles.description}>{selectedArticle.descripcion}</p>
            </div>

            {/* Ciclo de Estados */}
            {selectedArticle.flujoEstatus && selectedArticle.flujoEstatus.length > 0 && (
              <div style={styles.sectionContainer}>
                <h3 style={styles.sectionTitle}>
                  <AlertCircle size={14} style={{ color: '#0ea5e9' }} />
                  <span>Flujo de Estados Explicado</span>
                </h3>
                <div style={styles.statusGrid}>
                  {selectedArticle.flujoEstatus.map((est, idx) => (
                    <div key={idx} style={styles.statusCard}>
                      <span style={styles.statusBadge(est.bg, est.col)}>
                        {est.nombre}
                      </span>
                      <p style={styles.statusDesc}>{est.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Procedimiento paso a paso */}
            {selectedArticle.pasos && selectedArticle.pasos.length > 0 && (
              <div style={styles.sectionContainer}>
                <h3 style={styles.sectionTitle}>
                  <CheckCircle size={14} style={{ color: '#10b981' }} />
                  <span>Procedimiento Interactivo</span>
                </h3>
                <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 4px 0', fontStyle: 'italic' }}>
                  Marca cada paso completado para llevar el control visual de tu avance:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selectedArticle.pasos.map((step) => {
                    const isCompleted = !!completedSteps[step.paso];
                    return (
                      <div 
                        key={step.paso} 
                        style={styles.stepCard(isCompleted)} 
                        onClick={() => toggleStep(step.paso)}
                      >
                        <div style={styles.checkboxContainer}>
                          <div style={styles.checkbox(isCompleted)} className="step-checkbox">
                            {isCompleted && <span style={{ fontSize: '10px' }}>✓</span>}
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={styles.stepNum}>PASO {step.paso < 10 ? `0${step.paso}` : step.paso}</span>
                          <h4 style={styles.stepTitle(isCompleted)}>{step.titulo}</h4>
                          <p style={styles.stepDetail(isCompleted)}>{step.detalle}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* FAQs */}
            {selectedArticle.faq && selectedArticle.faq.length > 0 && (
              <div style={styles.sectionContainer}>
                <h3 style={styles.sectionTitle}>
                  <BookOpen size={14} style={{ color: '#8b5cf6' }} />
                  <span>Preguntas Frecuentes (FAQ)</span>
                </h3>
                <div>
                  {selectedArticle.faq.map((f, idx) => {
                    const isExpanded = expandedFaq === idx;
                    return (
                      <div key={idx} style={styles.faqItem} className="faq-item-hover">
                        <div 
                          style={styles.faqHeader} 
                          onClick={() => toggleFaq(idx)}
                        >
                          <h4 style={styles.faqQuestion}>{f.pregunta}</h4>
                          {isExpanded ? (
                            <ChevronDown size={14} style={{ color: '#64748b' }} />
                          ) : (
                            <ChevronRight size={14} style={{ color: '#64748b' }} />
                          )}
                        </div>
                        {isExpanded && (
                          <div style={styles.faqBody}>
                            {f.respuesta}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={styles.noArticle}>
            <BookOpen size={48} style={{ strokeWidth: 1, marginBottom: '16px', color: '#cbd5e1' }} />
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Ningún tema seleccionado</span>
            <p style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0 0 0' }}>Por favor haz clic en algún tema desde el widget de asistencia.</p>
          </div>
        )}
      </div>
    </div>
  );
}
