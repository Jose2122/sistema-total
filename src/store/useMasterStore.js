import { create } from 'zustand';
import { supabase } from '../supabaseClient';

export const useMasterStore = create((set, get) => ({
  centrosCosto: [],
  todasClasificaciones: [],
  todasCategorias: [],
  gerencias: [],
  cargos: [],
  loading: false,
  lastFetched: null,

  fetchMasters: async (force = false) => {
    const { loading } = get();
    if (loading && !force) return;

    // Si ya tenemos datos y no han pasado más de 10 minutos, no volvemos a pedir (caché básica)
    const now = Date.now();
    const { lastFetched, centrosCosto } = get();
    if (!force && centrosCosto.length > 0 && lastFetched && (now - lastFetched < 600000)) {
      return;
    }

    set({ loading: true });
    try {
      // Timeout de 3 segundos para maestros
      const fetchPromise = Promise.all([
        supabase.from('maestros_centros_costo').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('maestros_clasificaciones').select('id, nombre, centro_costo_id').eq('activo', true),
        supabase.from('maestros_sub_clasificaciones').select('id, nombre, clasificacion_id').eq('activo', true),
        supabase.from('cat_gerencias').select('*').order('nombre'),
        supabase.from('cat_cargos').select('*').eq('activo', true).order('nivel')
      ]);

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout cargando maestros")), 3000)
      );

      const [ccRes, clasRes, subRes, gerRes, carRes] = await Promise.race([fetchPromise, timeoutPromise]);

      if (ccRes.error) throw ccRes.error;
      if (clasRes.error) throw clasRes.error;
      if (subRes.error) throw subRes.error;
      if (gerRes.error) throw gerRes.error;
      if (carRes.error) throw carRes.error;

      set({
        centrosCosto: ccRes.data || [],
        todasClasificaciones: (clasRes.data || []).map(c => ({ 
          id: c.id, 
          nombre: c.nombre, 
          padreId: c.centro_costo_id 
        })),
        todasCategorias: (subRes.data || []).map(s => ({ 
          id: s.id, 
          nombre: s.nombre, 
          padreId: s.clasificacion_id 
        })),
        gerencias: gerRes.data || [],
        cargos: carRes.data || [],
        loading: false,
        lastFetched: Date.now()
      });
    } catch (err) {
      console.error("[MASTER STORE] Error:", err.message);
      set({ loading: false });
    }
  }
}));
