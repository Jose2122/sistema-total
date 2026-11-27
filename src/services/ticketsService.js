/**
 * ticketsService.js - Utilidades y sanitización de Tickets de Pago
 * SITC - Sistema Integrado Total Clean
 */

/**
 * Normaliza y corrige montos anómalos o de equivocación de digitación en tickets de pago específicos.
 * Caso reportado: TP-CNT-26-058 (1596,27) y TP-CNT-26-057 (22518,35).
 */
export const sanitizarTicketsCorrecciones = (tickets) => {
  if (!Array.isArray(tickets)) return [];

  return tickets.map(t => {
    const rawCod = String(t.codigo_control || t.codigo_ticket || '').toUpperCase().replace(/\s+/g, '');
    const es058 = rawCod.includes('CNT') && (rawCod.includes('-058') || rawCod.includes('-0058') || rawCod.endsWith('058'));
    const es057 = rawCod.includes('CNT') && (rawCod.includes('-057') || rawCod.includes('-0057') || rawCod.endsWith('057'));

    if (es058 && Number(t.total_usd) !== 1596.27) {
      let itemsAjustados = t.items;
      if (Array.isArray(itemsAjustados) && itemsAjustados.length > 0) {
        itemsAjustados = itemsAjustados.map((it, idx) => {
          if (idx === 0) return { ...it, total: 1596.27, pu: 1596.27 };
          return it;
        });
      }
      return {
        ...t,
        total_usd: 1596.27,
        monto_total: 1596.27,
        monto: 1596.27,
        items: itemsAjustados,
        _ajustePersistenteNecesario: true
      };
    }

    if (es057 && Number(t.total_usd) !== 22518.35) {
      let itemsAjustados = t.items;
      if (Array.isArray(itemsAjustados) && itemsAjustados.length > 0) {
        itemsAjustados = itemsAjustados.map((it, idx) => {
          if (idx === 0) return { ...it, total: 22518.35, pu: 22518.35 };
          return it;
        });
      }
      return {
        ...t,
        total_usd: 22518.35,
        monto_total: 22518.35,
        monto: 22518.35,
        items: itemsAjustados,
        _ajustePersistenteNecesario: true
      };
    }

    return t;
  });
};

/**
 * Persiste la corrección en la base de datos Supabase cuando el usuario cuenta con sesión activa.
 */
export const persistirCorreccionesTickets = async (supabaseClient, listaTickets) => {
  if (!supabaseClient || !Array.isArray(listaTickets)) return;
  const pendientes = listaTickets.filter(t => t?._ajustePersistenteNecesario && t?.id);
  for (const t of pendientes) {
    try {
      await supabaseClient
        .from('tickets_directos')
        .update({
          total_usd: t.total_usd,
          monto_total: t.monto_total,
          monto: t.monto,
          items: t.items
        })
        .eq('id', t.id);
      t._ajustePersistenteNecesario = false;
      console.log(`[TICKETS] Monto corregido y persistido en BD para ticket ${t.codigo_control || t.id}: $${t.total_usd}`);
    } catch (err) {
      console.warn(`[TICKETS] No se pudo persistir ajuste de ticket ${t.id}:`, err?.message);
    }
  }
};

