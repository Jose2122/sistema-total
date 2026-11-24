import React, { useState, useRef } from 'react';
import { RefreshCw, ArrowDown } from 'lucide-react';
import { vibrateHaptic } from './haptics';

export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);

  const PULL_THRESHOLD = 70; // píxeles requeridos para activar el refresh

  const handleTouchStart = (e) => {
    // Solo activar si estamos en el tope superior del scroll
    if (window.scrollY <= 0) {
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    }
  };

  const handleTouchMove = (e) => {
    if (!isPullingRef.current || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    if (diff > 0 && window.scrollY <= 0) {
      // Aplicar resistencia elástica
      const distance = Math.min(diff * 0.45, 90);
      setPullDistance(distance);
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(55); // Posición fija mientras refresca
      vibrateHaptic('refresh');

      try {
        if (onRefresh) {
          await onRefresh();
        }
      } catch (err) {
        console.error('Error al refrescar:', err);
      } finally {
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
        }, 400);
      }
    } else {
      setPullDistance(0);
    }
  };

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const shouldTrigger = pullDistance >= PULL_THRESHOLD;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ position: 'relative', minHeight: '100%', width: '100%' }}
    >
      {/* Indicador flotante de Pull-to-Refresh */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          style={{
            position: 'fixed',
            top: `calc(${10 + pullDistance * 0.75}px + env(safe-area-inset-top, 0px))`,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99,
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: '#0f172a',
            border: `2px solid ${shouldTrigger || isRefreshing ? '#38bdf8' : 'rgba(255, 255, 255, 0.15)'}`,
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.5), 0 0 15px rgba(56, 189, 248, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: isPullingRef.current ? 'none' : 'all 0.25s ease-out',
            pointerEvents: 'none'
          }}
        >
          {isRefreshing ? (
            <RefreshCw size={18} className="animate-spin" color="#38bdf8" />
          ) : (
            <ArrowDown
              size={18}
              color={shouldTrigger ? '#38bdf8' : '#94a3b8'}
              style={{
                transform: `rotate(${progress * 180}deg)`,
                transition: 'transform 0.15s ease'
              }}
            />
          )}
        </div>
      )}

      {/* Contenido envuelto */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.45}px)` : 'none',
          transition: isPullingRef.current ? 'none' : 'transform 0.25s ease-out'
        }}
      >
        {children}
      </div>
    </div>
  );
}
