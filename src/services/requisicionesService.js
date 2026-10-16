import { supabase } from '../supabaseClient';

export const requisicionesService = {
  async getAllRequisiciones(userContext) {
    let query = supabase.from('requisiciones').select('*');
    // Implementación simplificada para el dashboard
    const { data, error } = await query.order('fecha_emision', { ascending: false });
    if (error) throw error;
    return (data || []).map(req => ({
      ...req,
      items: this.sanitizeItems(req.items)
    }));
  },

  sanitizeItems(items) {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    try {
      let parsed = typeof items === 'string' ? JSON.parse(items) : items;
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  },

  async updateStatus(id, nuevoEstado, metadata = {}) {
    const { error } = await supabase.from('requisiciones').update({ estado_aprobacion: nuevoEstado, ...metadata }).eq('id', id);
    if (error) throw error;
    return true;
  },

  async saveRequisicion(data, isEditing) {
    const payload = { ...data, items: JSON.stringify(data.items) };
    if (isEditing) {
      const { error } = await supabase.from('requisiciones').update(payload).eq('id', data.id);
      if (error) throw error;
      return data.id;
    } else {
      const { data: newReq, error } = await supabase.from('requisiciones').insert([payload]).select().single();
      if (error) throw error;
      return newReq.id;
    }
  }
};

/**
 * Consolida todos los soportes y facturas de una requisición, unificando los cargados
 * a nivel de cabecera con los adjuntados en el historial de compras de los renglones individuales.
 */
export const consolidarSoportesRequisicion = (facturas_url, items) => {
  const soportesMap = new Map();

  // 1. Soportes a nivel de cabecera / generales de la requisición
  const arrayFacturas = Array.isArray(facturas_url) 
    ? facturas_url 
    : (facturas_url ? [facturas_url] : []);

  arrayFacturas.forEach((item) => {
    let url = '';
    let etiqueta = 'Archivo';
    if (typeof item === 'string') {
      if (item.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(item);
          url = parsed.url;
          etiqueta = parsed.etiqueta || 'Archivo';
        } catch {
          url = item;
        }
      } else {
        url = item;
      }
    } else if (item && typeof item === 'object') {
      url = item.url;
      etiqueta = item.etiqueta || 'Archivo';
    }

    if (url && typeof url === 'string' && url.length > 5) {
      let cleanEtiq = etiqueta || 'Soporte';
      if (cleanEtiq.startsWith('data:') || cleanEtiq === 'Archivo sin etiqueta') {
        cleanEtiq = url.startsWith('data:image/') ? 'Soporte (Imagen)' : 'Soporte';
      }
      soportesMap.set(url, { url, etiqueta: cleanEtiq });
    }
  });

  // 2. Soportes adjuntados a los renglones individuales durante compras
  let safeItems = items;
  if (typeof safeItems === 'string') {
    try { safeItems = JSON.parse(safeItems); } catch { safeItems = []; }
  }
  (Array.isArray(safeItems) ? safeItems : []).forEach(it => {
    const itemDirectUrl = it?.factura_adjunto || it?.adjunto || it?.comprobante;
    if (itemDirectUrl && typeof itemDirectUrl === 'string' && itemDirectUrl.length > 5) {
      if (!soportesMap.has(itemDirectUrl)) {
        soportesMap.set(itemDirectUrl, {
          url: itemDirectUrl,
          etiqueta: `${it.codigo || it.nombre || it.descripcion || 'Ítem'}`.slice(0, 40)
        });
      }
    }

    (it?.historial_compras || []).forEach(h => {
      if (h.factura_url && typeof h.factura_url === 'string' && h.factura_url.length > 5) {
        const url = h.factura_url;
        if (!soportesMap.has(url)) {
          const docLabel = `${h.doc_tipo || 'FAC'}: ${h.doc_numero || ''}${h.proveedor_nombre ? ` (${h.proveedor_nombre})` : ''}`.trim();
          soportesMap.set(url, {
            url,
            etiqueta: docLabel || 'Factura / Comprobante'
          });
        }
      }
    });
  });

  return Array.from(soportesMap.values());
};
