import { supabase } from '../supabaseClient';

export const fondosService = {
  async getAllSolicitudes(userContext) {
    let query = supabase.from('solicitudes_fondos').select('*');
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getSolicitudDetails(solicitudId) {
    const { data, error } = await supabase
      .from('partidas_fondos')
      .select('*, requisiciones(id, correlativo_req, items)')
      .eq('solicitud_id', solicitudId);
    if (error) throw error;
    return data;
  },

  async saveSolicitud(cabecera, renglones, isEditing, solicitudId = null) {
    let cabeceraId = solicitudId;
    if (isEditing) {
      const { error } = await supabase.from('solicitudes_fondos').update(cabecera).eq('id', solicitudId);
      if (error) throw error;
      await supabase.from('partidas_fondos').delete().eq('solicitud_id', solicitudId);
    } else {
      const { data, error } = await supabase.from('solicitudes_fondos').insert([cabecera]).select().single();
      if (error) throw error;
      cabeceraId = data.id;
    }
    const finalRows = renglones.map(r => ({ ...r, solicitud_id: cabeceraId }));
    const { error: errRows } = await supabase.from('partidas_fondos').insert(finalRows);
    if (errRows) throw errRows;
    return cabeceraId;
  },

  async checkWeeklyAvailability(depto, startDate, endDate) {
    const { data, error } = await supabase.from('solicitudes_fondos').select('*').eq('gerencia_nombre', depto).gte('fecha_operativa', startDate).lte('fecha_operativa', endDate).limit(1);
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  },

  async getMasters() {
    const [cc, clas, sub] = await Promise.all([
      supabase.from('maestros_centros_costo').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('maestros_clasificaciones').select('id, nombre, centro_costo_id').eq('activo', true),
      supabase.from('maestros_sub_clasificaciones').select('id, nombre, clasificacion_id').eq('activo', true)
    ]);
    return {
      centrosCosto: cc.data || [],
      clasificaciones: (clas.data || []).map(c => ({ id: c.id, nombre: c.nombre, padreId: c.centro_costo_id })),
      categorias: (sub.data || []).map(s => ({ id: s.id, nombre: s.nombre, padreId: s.clasificacion_id }))
    };
  }
};
