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
