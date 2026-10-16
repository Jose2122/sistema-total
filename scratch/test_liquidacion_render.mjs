import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Helper to simulate various ODC shapes
const testOdcs = [
  { id: 1, numero_odc: 'ODC-001', tipo_pago: 'CREDITO', total: 100, total_general: 100, estatus_pago: 'PENDIENTE' },
  { id: 2, numero_odc: 'ODC-002', tipo_pago: 'CONTADO', total: 250, total_general: 250, estatus_pago: 'PAGADO', orden_pago_ref: 'REF-123' },
  { id: 3, numero_odc: 'ODC-003', tipo_pago: 'CREDITO', total: null, total_general: undefined, detalles_pago: null },
  { id: 4, numero_odc: null, tipo_pago: undefined, total: 50, detalles_pago: '[{"monto": 25, "fecha": "2026-10-14T10:00:00Z"}]' },
  { id: 5, numero_odc: 'ODC-005', tipo_pago: 'CREDITO', total_general: '300.50', detalles_pago: [{ monto: '150.25', referencia: 'REF-999' }] },
  { id: 6, numero_odc: 'ODC-006', tipo_pago: 'CONTADO', total_general: 0, estatus_pago: 'PAGADO PARCIAL', detalles_pago: [{ monto: null }] },
  { id: 7, numero_odc: 'ODC-007', tipo_pago: 'CREDITO', fecha_vencimiento_credito: 'invalid-date', total: 100 },
  { id: 8, numero_odc: 'ODC-008', tipo_pago: 'CREDITO', fecha_vencimiento_credito: null, total: 100 }
];

const parsearItems = (itemsField) => {
  if (!itemsField) return [];
  if (Array.isArray(itemsField)) return itemsField;
  try {
    let parsed = typeof itemsField === 'string' ? JSON.parse(itemsField) : itemsField;
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const formatearFechaHora = (fechaIso) => {
  if (!fechaIso) return { fecha: 'N/A', hora: '--:--', textoCompleto: 'N/A' };
  try {
    const d = new Date(fechaIso);
    if (isNaN(d.getTime())) return { fecha: String(fechaIso), hora: '--:--', textoCompleto: String(fechaIso) };
    const fecha = d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    return { fecha, hora, textoCompleto: `${fecha} ${hora}` };
  } catch {
    return { fecha: String(fechaIso), hora: '--:--', textoCompleto: String(fechaIso) };
  }
};

const obtenerAbonosOdc = (odc) => {
  if (!odc) return [];
  const fromDb = parsearItems(odc.detalles_pago || odc.datos_pago || []);
  let fromLocal = [];
  const map = new Map();
  [...fromLocal, ...fromDb].forEach(ab => {
    if (!ab) return;
    const key = ab.abono_id || `${ab.referencia || ''}_${ab.monto || 0}_${ab.fecha || ''}`;
    map.set(key, ab);
  });
  let list = Array.from(map.values()).map(ab => ({
    ...ab,
    proveedor_nombre: ab.proveedor_nombre || odc.proveedor_nombre || '',
    tipo_pago: ab.tipo_pago || odc.tipo_pago || 'CONTADO',
    estatus: ab.estatus || odc.estatus_pago || odc.status_pago || 'PAGADO',
    usuario_nombre: ab.usuario_nombre || odc.comprador_nombre || odc.elaborado_por_nombre || 'Finanzas'
  }));

  const statusOdc = (odc.estatus_pago || odc.status_pago || '').toUpperCase();
  if (list.length === 0 && statusOdc === 'PAGADO' && (odc.orden_pago_ref || odc.banco_destino || odc.banco)) {
    list = [{
      abono_id: `legacy_${odc.id}`,
      monto: Number(odc.total_general ?? odc.total ?? 0),
      referencia: odc.orden_pago_ref || 'REGISTRO PREVIO',
      banco_nombre: odc.banco_destino || odc.banco || 'Banco Empresa',
      moneda: odc.moneda || '$ / $',
      fecha: odc.fecha_pago || odc.fecha_emision || odc.updated_at || odc.created_at,
      proveedor_nombre: odc.proveedor_nombre || '',
      tipo_pago: odc.tipo_pago || 'CONTADO',
      estatus: 'PAGADO',
      usuario_nombre: odc.comprador_nombre || odc.elaborado_por_nombre || 'Finanzas'
    }];
  }
  return list;
};

const calcularSemaforoCredito = (odc) => {
  if (odc.tipo_pago !== 'CREDITO') return { nivel: 'verde', texto: 'Contado', color: '#16a34a', bg: '#dcfce7', dias: null };
  const st = (odc.estatus_pago || odc.status_pago || 'PENDIENTE').toUpperCase();
  if (st === 'PAGADO') return { nivel: 'verde', texto: 'Pagado', color: '#166534', bg: '#dcfce7', dias: null };

  const fechaVencStr = odc.fecha_vencimiento_credito || odc.fecha_vencimiento_pago;
  if (!fechaVencStr) return { nivel: 'verde', texto: 'En Plazo', color: '#0369a1', bg: '#e0f2fe', dias: null };

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fVenc = new Date(fechaVencStr);
  fVenc.setHours(0, 0, 0, 0);

  const diffTime = fVenc.getTime() - hoy.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const diasMora = Math.abs(diffDays);
    if (diasMora > 15) return { nivel: 'morado', texto: `Mora Crítica (${diasMora}d)`, color: '#6b21a8', bg: '#f3e8ff', dias: diffDays };
    return { nivel: 'rojo', texto: `Vencido (${diasMora}d)`, color: '#991b1b', bg: '#fee2e2', dias: diffDays };
  } else if (diffDays <= 5) {
    return { nivel: 'amarillo', texto: `Por Vencer (${diffDays}d)`, color: '#854d0e', bg: '#fef9c3', dias: diffDays };
  } else {
    return { nivel: 'verde', texto: `En Plazo (${diffDays}d)`, color: '#065f46', bg: '#d1fae5', dias: diffDays };
  }
};

try {
  console.log("Processing testOdcs...");
  const odcsCredito = testOdcs.filter(o => o.tipo_pago === 'CREDITO').map(o => {
    const abonos = obtenerAbonosOdc(o);
    const totalVal = Number(o.total_general ?? o.total ?? 0);
    const totalAbonado = abonos.reduce((sum, a) => sum + (Number(a.monto) || 0), 0);
    const saldoPendiente = Math.max(0, totalVal - totalAbonado);
    let estatusCalculado = (o.estatus_pago || o.status_pago || 'PENDIENTE').toUpperCase();
    if (saldoPendiente <= 0.01 && (totalAbonado > 0 || estatusCalculado === 'PAGADO')) {
      estatusCalculado = 'PAGADO';
    } else if (totalAbonado > 0) {
      estatusCalculado = 'PAGADO PARCIAL';
    }
    return {
      ...o,
      abonos,
      total_odc: totalVal,
      total_abonado: totalAbonado,
      saldo_pendiente: saldoPendiente,
      estatus_calculado: estatusCalculado
    };
  });

  const odcsContado = testOdcs.filter(o => o.tipo_pago !== 'CREDITO').map(o => {
    const abonos = obtenerAbonosOdc(o);
    const totalVal = Number(o.total_general ?? o.total ?? 0);
    const totalAbonado = abonos.reduce((sum, a) => sum + (Number(a.monto) || 0), 0);
    const saldoPendiente = Math.max(0, totalVal - totalAbonado);
    let estatusCalculado = (o.estatus_pago || o.status_pago || 'PENDIENTE').toUpperCase();
    if (saldoPendiente <= 0.01 && (totalAbonado > 0 || estatusCalculado === 'PAGADO')) {
      estatusCalculado = 'PAGADO';
    } else if (totalAbonado > 0) {
      estatusCalculado = 'PAGADO PARCIAL';
    }
    return {
      ...o,
      abonos,
      total_odc: totalVal,
      total_abonado: totalAbonado,
      saldo_pendiente: saldoPendiente,
      estatus_calculado: estatusCalculado
    };
  });

  console.log("Testing semaforo on each odc...");
  odcsCredito.forEach(o => {
    const sem = calcularSemaforoCredito(o);
    console.log(`ODC ${o.id}: semaforo=${sem.texto}`);
  });

  console.log("Testing historialPagosRealizados on testOdcs...");
  const list = [];
  const seenKeys = new Set();
  testOdcs.forEach(o => {
    const abonos = obtenerAbonosOdc(o);
    if (abonos && abonos.length > 0) {
      abonos.forEach(ab => {
        const key = `ab_odc_${ab.abono_id || `${o.id}_${ab.fecha}_${ab.monto}`}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          const totalVal = Number(o.total_general ?? o.total ?? 0);
          const sumaAbonos = abonos.reduce((s, a) => s + (Number(a.monto) || 0), 0);
          const saldoOdc = Math.max(0, totalVal - sumaAbonos);

          list.push({
            id: key,
            abono_id: ab.abono_id,
            tipo_documento: 'ODC',
            numero_documento: o.numero_odc || `ODC-${o.id}`,
            proveedor_nombre: o.proveedor_nombre || ab.proveedor_nombre || 'N/A',
            modalidad: (o.tipo_pago || ab.tipo_pago || 'CONTADO').toUpperCase(),
            monto: Number(ab.monto) || 0,
            banco_nombre: ab.banco_nombre || o.banco_destino || o.banco || 'Banco Origen',
            referencia: ab.referencia || o.orden_pago_ref || 'N/A',
            usuario_nombre: ab.usuario_nombre || 'Finanzas',
            fecha: ab.fecha || o.updated_at || o.created_at || new Date().toISOString(),
            timestamp: new Date(ab.fecha || o.updated_at || o.created_at || 0).getTime(),
            estatus_badge: (saldoOdc <= 0.01 || (o.estatus_pago || o.status_pago || '').toUpperCase() === 'PAGADO') ? 'LIQUIDADO' : 'ABONO',
            url_soporte: ab.url || (ab.urls && ab.urls[0]?.url) || null,
            urls_soporte: ab.urls || (ab.url ? [{ url: ab.url, name: ab.name || 'Comprobante' }] : []),
            documento_ref: o,
            es_odc: true
          });
        }
      });
    } else if ((o.estatus_pago || o.status_pago || '').toUpperCase() === 'PAGADO') {
      const key = `leg_odc_${o.id}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        list.push({
          id: key,
          abono_id: null,
          tipo_documento: 'ODC',
          numero_documento: o.numero_odc || `ODC-${o.id}`,
          proveedor_nombre: o.proveedor_nombre || 'N/A',
          modalidad: (o.tipo_pago || 'CONTADO').toUpperCase(),
          monto: Number(o.total_general ?? o.total ?? 0),
          banco_nombre: o.banco_destino || o.banco || 'Banco Empresa',
          referencia: o.orden_pago_ref || 'PAGO DIRECTO',
          usuario_nombre: 'Finanzas',
          fecha: o.fecha_pago || o.updated_at || o.fecha_emision || o.created_at || new Date().toISOString(),
          timestamp: new Date(o.fecha_pago || o.updated_at || o.fecha_emision || o.created_at || 0).getTime(),
          estatus_badge: 'LIQUIDADO',
          url_soporte: null,
          urls_soporte: [],
          documento_ref: o,
          es_odc: true
        });
      }
    }
  });

  console.log(`Generated ${list.length} historical payments.`);
  list.sort((a, b) => b.timestamp - a.timestamp);
  list.forEach(p => {
    const { fecha: fStr, hora: hStr } = formatearFechaHora(p.fecha);
    const montoStr = p.monto.toLocaleString('de-DE', { minimumFractionDigits: 2 });
    console.log(`Pago: ${p.numero_documento} - ${montoStr} - ${fStr} ${hStr}`);
  });

  console.log("TEST WITH EDGE CASES COMPLETED SUCCESSFULLY!");
} catch (e) {
  console.error("CRITICAL ERROR IN EDGE CASES:", e);
}
