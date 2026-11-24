/**
 * Utilidad para Feedback Háptico en teléfonos móviles (Vibración nativa)
 */
export const vibrateHaptic = (type = 'success') => {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (type === 'success') {
        // Vibración corta y precisa de éxito
        navigator.vibrate([40]);
      } else if (type === 'error' || type === 'reject') {
        // Doble pulso para rechazo o error
        navigator.vibrate([50, 40, 50]);
      } else if (type === 'tap') {
        // Micro pulso al tocar botones
        navigator.vibrate([18]);
      } else if (type === 'refresh') {
        // Pulso al activar pull-to-refresh
        navigator.vibrate([25]);
      }
    } catch {
      // Si el navegador bloquea vibraciones, ignorar silenciosamente
    }
  }
};

