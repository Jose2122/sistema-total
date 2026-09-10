import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { estaEnVacaciones } from '../utils/delegationUtils';

let currentUser = null;
let currentSession = null;
let loading = false;
let error = null;
const listeners = new Set();

const notify = () => {
  listeners.forEach(fn => fn());
};

const setCurrentUser = (user) => {
  currentUser = user;
  notify();
};

const setSession = (sess) => {
  currentSession = sess;
  notify();
};

const fetchUser = async () => {
  if (loading) return;

  loading = true;
  error = null;
  notify();

  try {
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Tiempo de espera agotado (Supabase no responde)")), 3000)
    );

    const { data: { session }, error: sessionError } = await Promise.race([sessionPromise, timeoutPromise]);
    
    if (sessionError) throw sessionError;

    if (!session?.user) {
      currentUser = null;
      currentSession = null;
      loading = false;
      notify();
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

    currentUser = userData;
    currentSession = session;
    loading = false;
    notify();
    return userData;
  } catch (err) {
    console.error("[AUTH STORE] Error:", err.message);
    error = err.message;
    loading = false;
    notify();
    return null;
  }
};

const logout = async () => {
  await supabase.auth.signOut();
  currentUser = null;
  currentSession = null;
  notify();
};

export const useAuthStore = (selector) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick(t => t + 1);
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);

  const state = {
    currentUser,
    session: currentSession,
    loading,
    error,
    setCurrentUser,
    setSession,
    fetchUser,
    logout
  };

  return selector ? selector(state) : state;
};

useAuthStore.getState = () => ({
  currentUser,
  session: currentSession,
  loading,
  error,
  setCurrentUser,
  setSession,
  fetchUser,
  logout
});
