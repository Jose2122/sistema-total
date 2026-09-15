/**
 * delegationUtils.js
 * Utilidades para verificación de estado de vacaciones, inhabilitación temporal
 * y escalación automática de aprobaciones al cargo superior / Gerente General.
 */

/**
 * Determina si un perfil de usuario se encuentra actualmente de vacaciones.
 * @param {Object} perfil - Perfil del usuario.
 * @returns {boolean} True si está de vacaciones o en período de delegación activa.
 */
export const estaEnVacaciones = (perfil) => {
  if (!perfil) return false;

  // Si tiene el flag explícito de vacaciones activado (nivel superior o dentro de capacidades JSONB)
  if (
    perfil.en_vacaciones === true || 
    perfil.en_vacaciones === 'true' ||
    perfil.capacidades?.en_vacaciones === true ||
    perfil.capacidades?.en_vacaciones === 'true'
  ) {
    return true;
  }

  // Si tiene fechas de delegación / vacaciones configuradas
  if (perfil.delegacion_desde && perfil.delegacion_hasta) {
    const hoyStr = new Date().toISOString().split('T')[0];
    const desdeStr = String(perfil.delegacion_desde).split('T')[0];
    const hastaStr = String(perfil.delegacion_hasta).split('T')[0];

    if (hoyStr >= desdeStr && hoyStr <= hastaStr) {
      return true;
    }
  }

  return false;
};

/**
 * Encuentra al Gerente General en una lista de usuarios.
 * @param {Array} usuariosList 
 * @returns {Object|null}
 */
export const obtenerGerenteGeneral = (usuariosList = []) => {
  if (!Array.isArray(usuariosList)) return null;
  return usuariosList.find(u => {
    if (u.activo === false) return false;
    const rol = (u.rol || '').toLowerCase();
    const dept = (u.departamento || '').toLowerCase();
    const correo = (u.correo || '').toLowerCase();
    const nombre = `${u.nombre || ''} ${u.apellido || ''}`.toLowerCase();
    return (
      rol.includes('gerente general') ||
      dept.includes('gerencia general') ||
      correo.includes('cvega') ||
      nombre.includes('carlos vega') ||
      correo === 'karincmm1@gmail.com'
    );
  }) || null;
};

/**
 * Resuelve recursivamente el aprobador efectivo cuando un usuario está de vacaciones.
 * @param {string|Object} target - ID o Perfil del usuario asignado originalmente como aprobador.
 * @param {Array} usuariosList - Lista completa de perfiles de usuario.
 * @param {number} depth - Control de profundidad para evitar bucles infinitos.
 * @returns {Object} { id, perfil, fueEscalado: boolean, motivo: string }
 */
export const obtenerAprobadorEfectivo = (target, usuariosList = [], depth = 0) => {
  if (!target || depth > 5) {
    const gg = obtenerGerenteGeneral(usuariosList);
    return {
      id: gg?.id || null,
      perfil: gg,
      fueEscalado: true,
      motivo: 'Aprobación derivada al Gerente General por límite de escalación o usuario no encontrado'
    };
  }

  const targetId = typeof target === 'object' ? target.id : target;
  const perfil = typeof target === 'object' ? target : usuariosList.find(u => u.id === targetId);

  if (!perfil) {
    const gg = obtenerGerenteGeneral(usuariosList);
    return {
      id: gg?.id || null,
      perfil: gg,
      fueEscalado: true,
      motivo: 'Aprobación derivada al Gerente General (Perfil origen no encontrado)'
    };
  }

  // Si el usuario NO está de vacaciones, es el aprobador válido
  if (!estaEnVacaciones(perfil)) {
    return {
      id: perfil.id,
      perfil,
      fueEscalado: depth > 0,
      motivo: depth > 0 ? 'Aprobador resuelto por escalación superior' : 'Aprobador asignado directamente'
    };
  }

  // Si el usuario ESTÁ de vacaciones:
  // 1. Si tiene un delegado directo configurado y ese delegado NO está de vacaciones
  if (perfil.delegado_id && perfil.delegado_id !== perfil.id) {
    const delegado = usuariosList.find(u => u.id === perfil.delegado_id);
    if (delegado && !estaEnVacaciones(delegado)) {
      return {
        id: delegado.id,
        perfil: delegado,
        fueEscalado: true,
        motivo: `Aprobación derivada al encargado delegado ${delegado.nombre || ''} ${delegado.apellido || ''} por vacaciones de ${perfil.nombre || ''}`
      };
    }
  }

  // 2. Si no hay delegado (o también está en vacaciones), elevar al Gerente Directo (Cargo Superior)
  if (perfil.gerente_directo_id && perfil.gerente_directo_id !== perfil.id) {
    return obtenerAprobadorEfectivo(perfil.gerente_directo_id, usuariosList, depth + 1);
  }

  // 3. Si no tiene gerente directo asignado, elevar al Gerente General
  const gg = obtenerGerenteGeneral(usuariosList);
  if (gg && gg.id !== perfil.id) {
    return obtenerAprobadorEfectivo(gg.id, usuariosList, depth + 1);
  }

  return {
    id: perfil.id,
    perfil,
    fueEscalado: true,
    motivo: 'Usuario en vacaciones sin aprobador superior disponible'
  };
};
