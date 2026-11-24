import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import MobileTicketCard from './MobileTicketCard';
import PullToRefresh from './PullToRefresh';
import { vibrateHaptic } from './haptics';
import { Search, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MobileTickets({ currentUser, onPendingCountChange }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [filtroTab, setFiltroTab] = useState('por_aprobar'); // 'por_aprobar' | 'mis_tickets' | 'emitidos' | 'todos'
  const [busqueda, setBusqueda] = useState('');

  const rolUpper = (currentUser?.rol || '').toUpperCase();
  const esAdmin = currentUser?.esAdminReal || currentUser?.esSuperAdmin || currentUser?.esAdminGlobal || rolUpper.includes('ADMIN') || rolUpper.includes('GERENTE GENERAL') || (currentUser?.correo || '').toLowerCase().includes('cvega');
  const esGerente = esAdmin || rolUpper.includes('GERENTE') || rolUpper.includes('DIRECTOR') || rolUpper.includes('COORDINADOR');

  const cargarTickets = useCallback(async () => {
    setLoading(true);
    try {
      // Cargar los últimos 250 tickets
      const { data, error } = await supabase
        .from('tickets_directos')
        .select('*')
        .order('id', { ascending: false })
        .limit(250);

      if (error) throw error;
      setTickets(data || []);
    } catch (err) {
      console.error('Error al cargar tickets:', err);
      toast.error('No se pudieron cargar los tickets de pago');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarTickets();
  }, [cargarTickets]);

  // Verificar si un ticket requiere mi aprobación
  const requiereMiAprobacion = useCallback((ticket) => {
    const statusLower = (ticket.status || '').toLowerCase();
    const esPendiente = statusLower === 'pendiente aprobación' || statusLower === 'por aprobar';
    if (!esPendiente) return false;

    const esSolicitante = ticket.usuario_id === currentUser?.id || ticket.solicitante === `${currentUser?.nombre} ${currentUser?.apellido}`.trim();
    if (esSolicitante && !esAdmin) return false;

    if (esAdmin) return true;

    if (!esGerente) return false;

    const esAprobadorAsignado = ticket.aprobador_id && ticket.aprobador_id === currentUser?.id;
    const coincideDepto = ticket.departamento && currentUser?.departamento && ticket.departamento.toLowerCase().trim() === currentUser?.departamento.toLowerCase().trim();
    const obrasAsignadas = currentUser?.obras_asignadas || [];
    const coincideObra = ticket.centro_costo && obrasAsignadas.some(o => o.toLowerCase().trim() === (ticket.centro_costo || '').toLowerCase().trim());
    const sinAprobadorAsignado = !ticket.aprobador_id;

    return esAprobadorAsignado || coincideDepto || coincideObra || sinAprobadorAsignado;
  }, [currentUser, esAdmin, esGerente]);

  // Contador de pendientes
  const pendientesCount = useMemo(() => {
    return tickets.filter(requiereMiAprobacion).length;
  }, [tickets, requiereMiAprobacion]);

  useEffect(() => {
    if (onPendingCountChange) {
      onPendingCountChange(pendientesCount);
    }
  }, [pendientesCount, onPendingCountChange]);

  // Filtrado de la lista
  const ticketsFiltrados = useMemo(() => {
    return tickets.filter(t => {
      // Filtro de pestaña
      if (filtroTab === 'por_aprobar') {
        if (!requiereMiAprobacion(t)) return false;
      } else if (filtroTab === 'mis_tickets') {
        const esMio = t.usuario_id === currentUser?.id || (t.solicitante || '').toLowerCase().includes((currentUser?.nombre || '').toLowerCase());
        if (!esMio) return false;
      } else if (filtroTab === 'emitidos') {
        const s = (t.status || '').toLowerCase();
        if (s !== 'emitido' && s !== 'pagado' && s !== 'parcial') return false;
      }

      // Filtro de texto de búsqueda
      if (busqueda.trim()) {
        const query = busqueda.toLowerCase().trim();
        const cod = (t.codigo_ticket || t.codigo_control || '').toLowerCase();
        const prov = (t.proveedor_nombre || t.beneficiario || '').toLowerCase();
        const sol = (t.solicitante || '').toLowerCase();
        const just = (t.justificacion || '').toLowerCase();
        const cc = (t.centro_costo || t.departamento || '').toLowerCase();

        if (!cod.includes(query) && !prov.includes(query) && !sol.includes(query) && !just.includes(query) && !cc.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [tickets, filtroTab, busqueda, requiereMiAprobacion, currentUser]);

  // Handler de Aprobación de Ticket
  const handleAprobarTicket = async (ticket) => {
    setLoadingAction(true);
    const toastId = toast.loading('Aprobando ticket...');

    try {
      const updatePayload = {
        aprobado_gerente_area: true,
        n_aprobacion_area: currentUser?.nombre || 'Gerente',
        f_aprobacion_area: new Date().toISOString(),
        aprobado_gerente_general: true,
        n_aprobacion_general: 'Aprobación Nivel 1 (Directa)',
        f_aprobacion_general: new Date().toISOString(),
        status: 'EMITIDO',
        aprobado_por: currentUser?.id,
        fecha_aprobacion: new Date().toISOString(),
        aprobador_id: null
      };

      const { data: updatedData, error } = await supabase
        .from('tickets_directos')
        .update(updatePayload)
        .eq('id', ticket.id)
        .select('id');

      if (error) throw error;
      if (!updatedData || updatedData.length === 0) {
        throw new Error('No se pudo actualizar el ticket por restricciones de permisos.');
      }

      // Notificar a administración
      try {
        const idControl = ticket.codigo_control || ticket.codigo_ticket || `#${ticket.id}`;
        const { data: perfiles } = await supabase
          .from('perfiles')
          .select('id, rol, departamento');

        if (perfiles) {
          const admins = perfiles.filter(p => {
            const depto = (p.departamento || '').toLowerCase().trim();
            const rol = (p.rol || '').toLowerCase().trim();
            return depto.includes('administración maracaibo') ||
                   depto.includes('administracion maracaibo') ||
                   depto === 'adm-mcb' ||
                   ((rol.includes('cajero') || rol.includes('pagador')) && depto.includes('maracaibo'));
          });

          const notifs = admins.map(adm => ({
            usuario_id: adm.id,
            titulo: 'Nuevo Ticket de Pago Aprobado',
            mensaje: `Ticket ${idControl} - Solicitante: ${ticket.solicitante || 'Usuario'}`,
            tipo: 'Pago / Finanzas',
            leido: false,
            ticket_id: ticket.id
          }));

          if (notifs.length > 0) {
            await supabase.from('notificaciones').insert(notifs);
          }
        }
      } catch (errNotif) {
        console.warn('Error al enviar notificaciones de ticket:', errNotif);
      }

      vibrateHaptic('success');
      toast.success(`Ticket ${ticket.codigo_ticket || ticket.codigo_control || ''} aprobado exitosamente`, { id: toastId });
      await cargarTickets();
    } catch (err) {
      console.error('Error al aprobar ticket:', err);
      toast.error(`Error al aprobar: ${err.message}`, { id: toastId });
    } finally {
      setLoadingAction(false);
    }
  };

  // Handler de Rechazo de Ticket
  const handleRechazarTicket = async (ticket, motivo) => {
    setLoadingAction(true);
    const toastId = toast.loading('Rechazando ticket...');

    try {
      const { data: updatedData, error } = await supabase
        .from('tickets_directos')
        .update({
          status: 'Rechazado',
          motivo_rechazo: motivo,
          justificacion: ticket.justificacion ? `${ticket.justificacion}\n\nRECHAZO: ${motivo}` : `RECHAZO: ${motivo}`
        })
        .eq('id', ticket.id)
        .select('id');

      if (error) throw error;
      if (!updatedData || updatedData.length === 0) {
        throw new Error('No se pudo rechazar el ticket por restricciones de permisos.');
      }

      // Notificar al solicitante
      try {
        if (ticket.usuario_id) {
          await supabase.from('notificaciones').insert([{
            usuario_id: ticket.usuario_id,
            titulo: 'Ticket de Pago Rechazado',
            mensaje: `Su ticket ${ticket.codigo_ticket || ticket.codigo_control || ''} fue RECHAZADO. Motivo: ${motivo}`,
            tipo: 'Rechazo',
            leido: false,
            ticket_id: ticket.id
          }]);
        }
      } catch (errNotif) {
        console.warn('Error al notificar rechazo de ticket:', errNotif);
      }

      vibrateHaptic('reject');
      toast.success(`Ticket ${ticket.codigo_ticket || ticket.codigo_control || ''} rechazado`, { id: toastId });
      await cargarTickets();
    } catch (err) {
      console.error('Error al rechazar ticket:', err);
      toast.error(`Error al rechazar: ${err.message}`, { id: toastId });
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <PullToRefresh onRefresh={cargarTickets}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Sub-navegación por tabs */}
      <div className="m-subnav">
        <button
          className={`m-pill-btn ${filtroTab === 'por_aprobar' ? 'active' : ''}`}
          onClick={() => setFiltroTab('por_aprobar')}
        >
          <span>Por Aprobar</span>
          {pendientesCount > 0 && <span className="m-badge-count">{pendientesCount}</span>}
        </button>

        <button
          className={`m-pill-btn ${filtroTab === 'mis_tickets' ? 'active' : ''}`}
          onClick={() => setFiltroTab('mis_tickets')}
        >
          <span>Mis Tickets</span>
        </button>

        <button
          className={`m-pill-btn ${filtroTab === 'emitidos' ? 'active' : ''}`}
          onClick={() => setFiltroTab('emitidos')}
        >
          <span>Emitidos / Pagados</span>
        </button>

        <button
          className={`m-pill-btn ${filtroTab === 'todos' ? 'active' : ''}`}
          onClick={() => setFiltroTab('todos')}
        >
          <span>Todos ({tickets.length})</span>
        </button>
      </div>

      {/* Buscador */}
      <div className="m-search-box">
        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="m-input-wrapper" style={{ flex: 1 }}>
            <Search size={18} />
            <input
              type="text"
              className="m-search-input"
              placeholder="Buscar por código, beneficiario o concepto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <button
            className="m-btn-icon"
            title="Refrescar lista"
            onClick={cargarTickets}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Lista de Tickets */}
      {loading ? (
        <div className="m-empty-state">
          <Loader2 size={36} className="animate-spin" color="#38bdf8" />
          <p>Cargando tickets de pago...</p>
        </div>
      ) : ticketsFiltrados.length === 0 ? (
        <div className="m-empty-state">
          <CheckCircle2 size={42} color="#10b981" />
          <p>
            {filtroTab === 'por_aprobar'
              ? '¡Excelente! No tienes tickets de pago pendientes por aprobar.'
              : 'No se encontraron tickets con los filtros seleccionados.'}
          </p>
        </div>
      ) : (
        <div className="m-card-list">
          {ticketsFiltrados.map(ticket => (
            <MobileTicketCard
              key={ticket.id}
              ticket={ticket}
              currentUser={currentUser}
              onAprobar={handleAprobarTicket}
              onRechazar={handleRechazarTicket}
              loadingAction={loadingAction}
            />
          ))}
        </div>
      )}
    </div>
  </PullToRefresh>
  );
}

