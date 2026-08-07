import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env.local manually
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

function safeArray(arr) {
  if (!arr) return [];
  if (Array.isArray(arr)) return arr;
  try {
    if (typeof arr === 'string') return JSON.parse(arr);
  } catch (e) {}
  return [];
}

const esRequisicionCompletada = (requisicion) => {
  if (!requisicion) return false;
  if (requisicion.status_compra === 'Comprado' || requisicion.status_compra === 'Recibido en Almacén') {
    return true;
  }
  const items = safeArray(requisicion.items);
  if (items.length === 0) return false;
  return items.every(item => {
    const cantPedida = parseFloat(item.cantidad_pedida ?? item.cant) || 0;
    const cantComprada = parseFloat(item.cantidad_comprada || 0);
    if (item.anulado) return true;
    return cantComprada >= cantPedida;
  });
};

async function inspect() {
  console.log("Fetching solicitud ADM-MCBO-SEM27-26 or similar...");
  // Let's search by codigo_control
  const { data: sols, error: solError } = await supabase
    .from('solicitudes_fondos')
    .select('*')
    .ilike('codigo_control', '%SEM27-26%');

  if (solError) {
    console.error("Sol fetch error:", solError.message);
    return;
  }

  console.log(`Found ${sols.length} matching solicitudes:`);
  for (const sol of sols) {
    console.log(`\n--- SOLICITUD ID: ${sol.id} | Codigo: ${sol.codigo_control} | Estado DB: ${sol.estado} | is_culminada DB: ${sol.is_culminada} ---`);
    
    // Fetch partidas
    const { data: partidas, error: pError } = await supabase
      .from('partidas_fondos')
      .select('*, requisiciones(id, items, status_compra, estado_aprobacion)')
      .eq('solicitud_id', sol.id);

    if (pError) {
      console.error("Partidas fetch error:", pError.message);
      continue;
    }

    console.log(`Partidas found: ${partidas.length}`);

    // Fetch tickets involved
    const ticketIds = partidas.map(p => p.ticket_id).filter(Boolean);
    const ticketCodigos = partidas.map(p => p.codigo_ticket).filter(c => c && c.startsWith('TP-'));
    let tickets = [];
    if (ticketIds.length > 0 || ticketCodigos.length > 0) {
      let query = supabase.from('tickets_directos').select('*');
      if (ticketIds.length > 0 && ticketCodigos.length > 0) {
        query = query.or(`id.in.(${ticketIds.join(',')}),codigo_control.in.(${ticketCodigos.map(c => `"${c}"`).join(',')})`);
      } else if (ticketIds.length > 0) {
        query = query.in('id', ticketIds);
      } else {
        query = query.in('codigo_control', ticketCodigos);
      }
      const { data: tData } = await query;
      if (tData) tickets = tData;
    }
    console.log(`Tickets involved found: ${tickets.length}`);

    // Simulate getEstadoSolicitud pending calculations
    let totalMontoReal = 0;
    let totalPendingBs = 0;
    let totalPendingUsd = 0;

    partidas.forEach(p => {
      if (p.status === 'ANULADO_POR_USUARIO') return;

      let mReal = 0;
      let mPendingBs = (parseFloat(p.pu_bs) || 0) * (p.cantidad || 1);
      let mPendingUsd = (parseFloat(p.pu_usd) || 0) * (p.cantidad || 1);

      const isReqComp = p.requisiciones ? esRequisicionCompletada(p.requisiciones) : false;

      if (p.pago_realizado) {
        mReal = (parseFloat(p.pu_bs) || parseFloat(p.pu_usd) || 0) * (p.cantidad || 1);
        mPendingBs = 0;
        mPendingUsd = 0;
      } else if (p.requisicion_id && p.requisiciones && p.requisiciones.items) {
        const normPDesc = (p.descripcion || '').trim().toLowerCase();
        const pCant = Number(p.cantidad) || 1;
        const itemsArr = safeArray(p.requisiciones.items);

        let itemReq = itemsArr.find(item => {
          const normItemDesc = (item.descripcion || item.desc || '').trim().toLowerCase();
          const descMatch = normItemDesc === normPDesc || (normItemDesc && normPDesc && (normItemDesc.includes(normPDesc) || normPDesc.includes(normItemDesc)));
          const cantMatch = Number(item.cantidad_pedida ?? item.cant ?? item.cantidad) === pCant;
          return descMatch && cantMatch;
        }) || itemsArr.find(item => {
          const normItemDesc = (item.descripcion || item.desc || '').trim().toLowerCase();
          return normItemDesc === normPDesc || (normItemDesc && normPDesc && (normItemDesc.includes(normPDesc) || normPDesc.includes(normItemDesc)));
        });

        if (itemReq) {
          mReal = (itemReq.historial_compras || []).reduce((sum, h) => {
            if (h.tipo === 'JUSTIFICACION') return sum;
            return sum + ((parseFloat(h.cant) || 0) * (parseFloat(h.pu) || 0));
          }, 0);

          const cantPendiente = parseFloat(itemReq.cantidad_pendiente ?? itemReq.cant) || 0;
          const puEst = parseFloat(itemReq.pu_estimado ?? itemReq.pu) || 0;
          
          if (mReal === 0 && isReqComp) {
            mReal = (parseFloat(p.pu_bs) || parseFloat(p.pu_usd) || 0) * (p.cantidad || 1);
            mPendingBs = 0;
            mPendingUsd = 0;
          } else {
            if (p.pu_bs > 0) {
              mPendingBs = cantPendiente * puEst;
              mPendingUsd = 0;
            } else {
              mPendingBs = 0;
              mPendingUsd = cantPendiente * puEst;
            }
          }
        } else if (isReqComp) {
          mReal = (parseFloat(p.pu_bs) || parseFloat(p.pu_usd) || 0) * (p.cantidad || 1);
          mPendingBs = 0;
          mPendingUsd = 0;
        }
      } else {
        const ticketAsociado = tickets.find(t =>
          t.id === p.ticket_id ||
          (p.codigo_ticket && t.codigo_control === p.codigo_ticket)
        );
        if (ticketAsociado) {
          if (ticketAsociado.items && ticketAsociado.items.length > 0) {
            const normPDesc = (p.descripcion || '').trim().toLowerCase();
            const it = ticketAsociado.items.find(item =>
              (item.desc || item.descripcion || '').trim().toLowerCase() === normPDesc
            );
            if (it) {
              mReal = (parseFloat(it.cant_pagada || 0) * (parseFloat(it.pu) || 0));
              const cantPendiente = (parseFloat(it.cant) || 1) - (parseFloat(it.cant_pagada) || 0);
              const puEst = parseFloat(it.pu) || 0;
              if (p.pu_bs > 0) {
                mPendingBs = cantPendiente * puEst;
                mPendingUsd = 0;
              } else {
                mPendingBs = 0;
                mPendingUsd = cantPendiente * puEst;
              }
            }
          } else if (ticketAsociado.status === 'Pagado' || ticketAsociado.status === 'COMPLETADO') {
            mReal = (parseFloat(p.pu_bs) || parseFloat(p.pu_usd) || 0) * (p.cantidad || 1);
            mPendingBs = 0;
            mPendingUsd = 0;
          }
        }
      }

      totalMontoReal += mReal;
      totalPendingBs += mPendingBs;
      totalPendingUsd += mPendingUsd;
    });

    console.log(`Pending calculations: pendingBs = ${totalPendingBs} | pendingUsd = ${totalPendingUsd}`);

    // Let's run checkIsCulminada step-by-step
    const activePartidas = partidas.filter(p => p.status !== 'ANULADO_POR_USUARIO');
    console.log(`Active partidas count: ${activePartidas.length}`);

    let allEveryMatch = true;
    activePartidas.forEach((p, idx) => {
      console.log(`\nEvaluating Partida ${idx+1} (ID: ${p.id} | Desc: ${p.descripcion}):`);
      
      let isReq = p.requisicion_id || p.codigo_ref?.startsWith('RR-');
      let isTicket = p.ticket_id || p.codigo_ticket?.startsWith('TP-') || p.codigo_ref?.startsWith('TP-');

      console.log(`  - Link type: isReq = ${isReq} | isTicket = ${isTicket}`);

      if (isReq) {
        if (p.requisiciones) {
          const isComp = esRequisicionCompletada(p.requisiciones);
          console.log(`  - Requisicion Status: ${p.requisiciones.status_compra} | Approved: ${p.requisiciones.estado_aprobacion} | esRequisicionCompletada = ${isComp}`);
          if (!isComp) allEveryMatch = false;
        } else {
          console.log(`  - Requisiciones relation is NULL! (RLS or missing record)`);
          allEveryMatch = false;
        }
      } else if (isTicket) {
        const tk = tickets.find(t =>
          t.id === p.ticket_id ||
          t.codigo_control === p.codigo_ticket ||
          t.codigo_control === p.codigo_ref
        );
        if (tk) {
          const statusUpper = (tk.status || '').toUpperCase();
          let matchedTk = false;
          if (statusUpper === 'PAGADO' || statusUpper === 'COMPLETADO' || statusUpper === 'ANULADO' || statusUpper === 'RECHAZADO') {
            console.log(`  - Ticket status is ${statusUpper} (Matched fully)`);
            matchedTk = true;
          } else {
            const tkItems = safeArray(tk.items);
            console.log(`  - Ticket status is ${statusUpper} (Not fully matched). Items length: ${tkItems.length}`);
            if (tkItems.length > 0) {
              const it = tkItems.find(item =>
                (item.desc || item.descripcion || '').trim().toUpperCase() === (p.descripcion || '').trim().toUpperCase() &&
                (Number(item.cantidad_pedida || item.cant) === Number(p.cantidad))
              );
              if (it) {
                console.log(`    - Item found: cant_pendiente = ${it.cantidad_pendiente}`);
                if (Number(it.cantidad_pendiente) === 0) matchedTk = true;
              } else {
                console.log(`    - Item not matched by description and quantity!`);
              }
            }
          }
          if (!matchedTk) allEveryMatch = false;
        } else {
          console.log(`  - Ticket relation is NULL or not found in tickets list!`);
          allEveryMatch = false;
        }
      } else {
        const isPaid = p.pago_realizado === true;
        console.log(`  - Manual/Transferencia: pago_realizado = ${isPaid}`);
        if (!isPaid) allEveryMatch = false;
      }
    });

    console.log(`\nFinal checkIsCulminada result: ${allEveryMatch && totalPendingBs <= 0.01 && totalPendingUsd <= 0.01}`);
  }
}

inspect();
