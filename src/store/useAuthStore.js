import { create } from 'zustand';
import { supabase } from '../supabaseClient';

import { estaEnVacaciones } from '../utils/delegationUtils';

export const useAuthStore = create((set, get) => ({
  currentUser: null,
  session: null,
  loading: false,
  error: null,

  setCurrentUser: (user) => set({ currentUser: user }),

  fetchUser: async () => {
    const { loading } = get();
    if (loading) return; // Si ya está cargando, no hacer nada

    set({ loading: true, error: null });
    try {
      // Timeout de 3 segundos para la sesión
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Tiempo de espera agotado (Supabase no responde)")), 3000)
      );

      const { data: { session }, error: sessionError } = await Promise.race([sessionPromise, timeoutPromise]);
      
      if (sessionError) throw sessionError;

      if (!session?.user) {
        set({ currentUser: null, session: null, loading: false });
        return null;
      }

      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (perfilError) throw perfilError;

      const emailLower = (session.user.email || '').toLowerCase();
      const esJose = emailLower === 'jcontreras.totalclean@gmail.com';
      const esAdminReal = esJose ||
        emailLower === 'cvega@totalclean.com.ve' ||
        emailLower === 'karincmm1@gmail.com';

      const vacacionesActivas = estaEnVacaciones(perfil);

      const userData = {
        ...perfil,
        esAdminReal,
        enVacacionesBloqueado: vacacionesActivas && !esAdminReal,
        correo: emailLower,
        departamento: (perfil.departamento || '').trim(),
        rol: (perfil.rol || '').trim()
      };

      set({ currentUser: userData, session, loading: false });
      return userData;
    } catch (err) {
      console.error("[AUTH STORE] Error:", err.message);
      set({ error: err.message, loading: false });
      return null;
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ currentUser: null });
  }
}));
