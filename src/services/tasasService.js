// =============================================================================
// SERVICIO DE TIPOS DE CAMBIO (BCV / PREFERENCIAL) - SITC
// TOTAL CLEAN C.A. - Cuentas por Pagar & Liquidación Fiscal
// =============================================================================

const STORAGE_KEY_TASAS = 'sitc_tasas_cambio_cache';
const STORAGE_KEY_CUSTOM = 'sitc_tasas_preferenciales';

// Valores de referencia iniciales de respaldo seguro
const TASAS_DEFAULT = {
  BCV_USD: 46.5000,
  BCV_EUR: 50.1500,
  fecha: new Date().toISOString(),
  origen: 'default'
};

/**
 * Redondea un número con precisión financiera de N decimales
 */
export const redondearDecimales = (num, decimales = 4) => {
  if (isNaN(num) || num === null || num === undefined) return 0;
  const factor = Math.pow(10, decimales);
  return Math.round((Number(num) + Number.EPSILON) * factor) / factor;
};

/**
 * Obtiene las tasas actuales desde la API oficial/pública de BCV con timeout seguro
 * Si la red falla o está offline, retorna los valores almacenados en caché o default.
 */
export const obtenerTasasBCV = async () => {
  // 1. Intentar cargar desde caché local previo
  let cached = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TASAS);
    if (raw) {
      cached = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('[tasasService] Error leyendo caché local:', e);
  }

  // Si el caché tiene menos de 30 minutos, podemos retornar rápido o revalidar en segundo plano
  const ahora = Date.now();

  // 2. Intentar fetch en paralelo con timeout de 3 segundos
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    // Consulta en paralelo a la API pública oficial de Venezuela (dolarapi)
    const [resUsd, resEur] = await Promise.allSettled([
      fetch('https://ve.dolarapi.com/v1/dolares/oficial', { signal: controller.signal }),
      fetch('https://ve.dolarapi.com/v1/euros/oficial', { signal: controller.signal })
    ]);

    clearTimeout(timeoutId);

    let usdRate = cached?.BCV_USD || TASAS_DEFAULT.BCV_USD;
    let eurRate = cached?.BCV_EUR || TASAS_DEFAULT.BCV_EUR;
    let fetchedOk = false;

    if (resUsd.status === 'fulfilled' && resUsd.value.ok) {
      const dataUsd = await resUsd.value.json();
      if (dataUsd?.promedio && !isNaN(dataUsd.promedio)) {
        usdRate = redondearDecimales(dataUsd.promedio, 4);
        fetchedOk = true;
      }
    }

    if (resEur.status === 'fulfilled' && resEur.value.ok) {
      const dataEur = await resEur.value.json();
      if (dataEur?.promedio && !isNaN(dataEur.promedio)) {
        eurRate = redondearDecimales(dataEur.promedio, 4);
        fetchedOk = true;
      }
    }

    const payload = {
      BCV_USD: usdRate,
      BCV_EUR: eurRate,
      fecha: new Date().toISOString(),
      timestamp: ahora,
      origen: fetchedOk ? 'bcv_api' : (cached ? 'cache' : 'default')
    };

    try {
      localStorage.setItem(STORAGE_KEY_TASAS, JSON.stringify(payload));
    } catch (saveErr) {
      void saveErr;
    }

    return payload;
  } catch (err) {
    console.warn('[tasasService] No se pudo conectar con API BCV externa, usando fallback:', err.message);
    if (cached) {
      return { ...cached, origen: 'cache' };
    }
    return TASAS_DEFAULT;
  }
};

/**
 * Guarda una tasa preferencial o personalizada en almacenamiento local
 */
export const guardarTasaPreferencialLocal = (valor) => {
  try {
    const val = redondearDecimales(valor, 4);
    localStorage.setItem(STORAGE_KEY_CUSTOM, String(val));
    return val;
  } catch {
    return valor;
  }
};

/**
 * Obtiene la última tasa preferencial usada
 */
export const obtenerTasaPreferencialLocal = () => {
  try {
    const val = localStorage.getItem(STORAGE_KEY_CUSTOM);
    if (val && !isNaN(Number(val)) && Number(val) > 0) {
      return redondearDecimales(Number(val), 4);
    }
  } catch (readErr) {
    void readErr;
  }
  return 46.5000;
};
