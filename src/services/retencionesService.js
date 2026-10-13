// =============================================================================
// SERVICIO DE CÁLCULO Y GESTIÓN DE RETENCIONES FISCALES (IVA E ISLR) - SITC
// TOTAL CLEAN C.A. - CUENTAS POR PAGAR
// =============================================================================

import { supabase } from '../supabaseClient.js';
import { redondearDecimales } from './tasasService.js';

const LOCAL_STORAGE_RETENCIONES = 'sitc_retenciones_fiscales_offline';

/**
 * Redondeo financiero estricto a 2 decimales para evitar descuadre de céntimos
 */
export const redondear2 = (num) => {
  if (isNaN(num) || num === null || num === undefined) return 0.00;
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
};

/**
 * Función pura que calcula todas las variables de la liquidación fiscal
 */
export const calcularLiquidacionFiscal = ({
  tipo_tasa = 'BCV_USD',
  valor_tasa = 1.0000,
  monto_exento = 0,
  base_imponible = 0,
  alicuota_iva = 16.00,
  porcentaje_retencion_iva = 75.00,
  porcentaje_retencion_islr = 2.00
}) => {
  const exento = Math.max(0, redondear2(monto_exento));
  const base = Math.max(0, redondear2(base_imponible));
  const aliIva = Math.max(0, redondear2(alicuota_iva));
  const pctRetIva = Math.max(0, redondear2(porcentaje_retencion_iva));
  const pctRetIslr = Math.max(0, redondear2(porcentaje_retencion_islr));
  const tasa = Math.max(0.0001, redondearDecimales(valor_tasa, 4));

  // 1. Cálculo de IVA: base_imponible * (alicuota_iva / 100)
  const monto_iva = redondear2(base * (aliIva / 100));

  // 2. Retención de IVA: monto_iva * (porcentaje_retencion_iva / 100)
  const monto_retencion_iva = redondear2(monto_iva * (pctRetIva / 100));

  // 3. Retención de ISLR sobre base imponible: base_imponible * (porcentaje_retencion_islr / 100)
  const monto_retencion_islr = redondear2(base * (pctRetIslr / 100));

  // 4. Totales brutos y netos
  const total_factura = redondear2(base + exento + monto_iva);
  const total_retenciones = redondear2(monto_retencion_iva + monto_retencion_islr);
  const monto_neto_pagar = redondear2(total_factura - total_retenciones);

  // 5. Contravalor en Bolívares (VES)
  const equivalente_ves_neto = redondear2(monto_neto_pagar * tasa);

  // Subtotales complementarios informativos
  const equivalente_ves_bruto = redondear2(total_factura * tasa);
  const equivalente_ves_retenciones = redondear2(total_retenciones * tasa);

  return {
    tipo_tasa,
    valor_tasa: tasa,
    monto_exento: exento,
    base_imponible: base,
    alicuota_iva: aliIva,
    monto_iva,
    porcentaje_retencion_iva: pctRetIva,
    monto_retencion_iva,
    porcentaje_retencion_islr: pctRetIslr,
    monto_retencion_islr,
    total_factura,
    total_retenciones,
    monto_neto_pagar,
    equivalente_ves_neto,
    equivalente_ves_bruto,
    equivalente_ves_retenciones
  };
};

/**
 * Guarda o registra una liquidación fiscal en Supabase con fallback local resiliente
 */
export const guardarRetencionFiscal = async (payload) => {
  const correlativoComprobante = payload.numero_comprobante || `RET-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;

  const registroCompleto = {
    ...payload,
    numero_comprobante: correlativoComprobante,
    fecha_liquidacion: payload.fecha_liquidacion || new Date().toISOString(),
    created_at: new Date().toISOString()
  };

  try {
    // Intentar insertar en la tabla compras_retenciones de Supabase
    const { data, error } = await supabase
      .from('compras_retenciones')
      .insert([registroCompleto])
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[retencionesService] Error insertando en BD (¿Falta migración?):', error.message);
      // Guardar en almacenamiento local como salvaguarda
      guardarEnCacheLocal(registroCompleto);
      return { data: registroCompleto, warning: 'Guardado en almacenamiento local (ejecute la migración SQL en Supabase para sincronizar).' };
    }

    // Si viene asociada a una ODC, sincronizar los campos de retención en ordenes_compra
    if (payload.orden_compra_id) {
      await supabase
        .from('ordenes_compra')
        .update({
          tipo_tasa: payload.tipo_tasa,
          valor_tasa: payload.valor_tasa,
          monto_exento: payload.monto_exento,
          base_imponible: payload.base_imponible,
          alicuota_iva: payload.alicuota_iva,
          monto_iva: payload.monto_iva,
          porcentaje_retencion_iva: payload.porcentaje_retencion_iva,
          monto_retencion_iva: payload.monto_retencion_iva,
          porcentaje_retencion_islr: payload.porcentaje_retencion_islr,
          monto_retencion_islr: payload.monto_retencion_islr,
          total_factura: payload.total_factura,
          total_retenciones: payload.total_retenciones,
          monto_neto_pagar: payload.monto_neto_pagar,
          equivalente_ves_neto: payload.equivalente_ves_neto,
          retencion_fiscal_id: data?.id || null
        })
        .eq('id', payload.orden_compra_id)
        .catch(err => console.warn('[retencionesService] Error sincronizando ODC:', err));
    }

    return { data: data || registroCompleto };
  } catch (err) {
    console.error('[retencionesService] Excepción al guardar retención:', err);
    guardarEnCacheLocal(registroCompleto);
    return { data: registroCompleto, warning: 'Guardado en almacenamiento local de respaldo.' };
  }
};

/**
 * Obtiene el historial de comprobantes de retención fiscal
 */
export const obtenerRetencionesFiscales = async () => {
  let registrosBD = [];
  try {
    const { data, error } = await supabase
      .from('compras_retenciones')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      registrosBD = data;
    }
  } catch (err) {
    console.warn('[retencionesService] Tabla compras_retenciones no disponible aún:', err.message);
  }

  // Leer caché local de respaldo
  const locales = obtenerCacheLocal();

  // Unificar evitando duplicados por id o numero_comprobante
  const mapUnico = new Map();
  registrosBD.forEach(r => mapUnico.set(r.id || r.numero_comprobante, r));
  locales.forEach(r => {
    const key = r.id || r.numero_comprobante;
    if (!mapUnico.has(key)) {
      mapUnico.set(key, r);
    }
  });

  return Array.from(mapUnico.values());
};

/**
 * Anula un comprobante de retención
 */
export const anularRetencionFiscal = async (id) => {
  try {
    await supabase
      .from('compras_retenciones')
      .update({ estatus: 'ANULADO' })
      .eq('id', id);
  } catch (err) {
    void err;
  }

  // Actualizar también en local
  try {
    const locales = obtenerCacheLocal();
    const actualizados = locales.map(item => item.id === id ? { ...item, estatus: 'ANULADO' } : item);
    localStorage.setItem(LOCAL_STORAGE_RETENCIONES, JSON.stringify(actualizados));
  } catch (localErr) {
    void localErr;
  }

  return true;
};

// Helpers internos para almacenamiento local resiliente
function obtenerCacheLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_RETENCIONES);
    if (raw) return JSON.parse(raw);
  } catch (readErr) {
    void readErr;
  }
  return [];
}

function guardarEnCacheLocal(registro) {
  try {
    const lista = obtenerCacheLocal();
    const id = registro.id || ('local-' + Date.now());
    const regConId = { ...registro, id };
    const filtrada = lista.filter(x => x.numero_comprobante !== registro.numero_comprobante);
    filtrada.unshift(regConId);
    localStorage.setItem(LOCAL_STORAGE_RETENCIONES, JSON.stringify(filtrada));
  } catch (writeErr) {
    void writeErr;
  }
}
