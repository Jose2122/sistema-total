import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { consolidarSoportesRequisicion } from '../services/requisicionesService';
import MobileReqCard from './MobileReqCard';
import { vibrateHaptic } from './haptics';
import { Search, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MobileRequisiciones({ currentUser, onPendingCountChange }) {
  const [requisiciones, setRequisiciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [filtroTab, setFiltroTab] = useState('por_aprobar'); // 'por_aprobar' | 'mi_equipo' | 'mis_solicitudes' | 'todas'
  const [busqueda, setBusqueda] = useState('');
  const [filtroGerencia, setFiltroGerencia] = useState('Todas');
  const [gerenciasDisponibles, setGerenciasDisponibles] = useState([]);
  const [analistasIds, setAnalistasIds] = useState([]);

  const rolUpper = (currentUser?.rol || '').toUpperCase();
  const deptoUpper = (currentUser?.departamento || '').toUpperCase();
  const emailLower = (currentUser?.correo || currentUser?.email || '').toLowerCase();
  const nombreLower = (currentUser?.nombre || '').toLowerCase();
  const esFavio = (currentUser?.nombre || '').toUpperCase().includes('FAVIO') && (currentUser?.apellido || '').toUpperCase().includes('BAVUSO');
  const esJorge = nombreLower.includes('jorge');

  const esGG = currentUser?.esAdminReal || 
               currentUser?.esSuperAdmin || 
               currentUser?.esAdminGlobal || 
               rolUpper.includes('GERENTE GENERAL') || 
               rolUpper.includes('ADMIN') || 
               emailLower.includes('cvega') || 
               emailLower.includes('jcontreras') ||
               esFavio;

  const esGerenteArea = esGG || 
                        rolUpper.includes('GERENTE') || 
                        rolUpper.includes('DIRECTOR') || 
                        rolUpper.includes('COORDINADOR') || 
                        rolUpper.includes('PROYECTO') || 
                        rolUpper.includes('ÁREA') || 
                        rolUpper.includes('AREA') || 
                        rolUpper.includes('JEFE') || 
                        rolUpper.includes('LIDER') || 
                        rolUpper.includes('LÍDER') || 
                        rolUpper.includes('CONTABIL') || 
                        deptoUpper.includes('CONTABIL') || 
                        deptoUpper.includes('ADMINISTRA') || 
                        esJorge ||
                        emailLower === 'karincmm1@gmail.com';

  // Cargar IDs de analistas/subordinados directos
  useEffect(() => {
    const cargarAnalistas = async () => {
      if (!currentUser?.id) return;
      try {
        const { data: directos } = await supabase
          .from('perfiles')
          .select('id, nombre, apellido')
          .eq('gerente_directo_id', currentUser.id);

        const ids = (directos || []).map(p => p.id);

        // Si es Jorge Urdaneta, buscar también por nombre Carlos Delgado si no está ya vinculado por ID
        if (esJorge) {
          const { data: carlos } = await supabase
            .from('perfiles')
            .select('id')
            .ilike('nombre', '%carlos%')
            .ilike('apellido', '%delgado%');
          if (carlos) {
            carlos.forEach(c => { if (!ids.includes(c.id)) ids.push(c.id); });
          }
        }
        setAnalistasIds(ids);
      } catch (err) {
        console.warn('Error al cargar analistas de perfil:', err);
      }
    };
    cargarAnalistas();
  }, [currentUser, esJorge]);

  const cargarRequisiciones = useCallback(async () => {
    setLoading(true);
    try {
      // Cargamos las más recientes (últimas 500 requisiciones completas ordenadas por id desc)
      let query = supabase
        .from('requisiciones')
        .select('*')
        .neq('correlativo_req', 'SYS-PROVEEDORES-CENTRAL')
        .order('id', { ascending: false })
        .limit(500);

      const { data, error } = await query;
      if (error) throw error;

      const formateadas = (data || []).map(r => {
        let itemsParseados = [];
        try {
          itemsParseados = typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || []);
          if (typeof itemsParseados === 'string') itemsParseados = JSON.parse(itemsParseados);
        } catch {
          itemsParseados = [];
        }

        const soportes = consolidarSoportesRequisicion(r.facturas_url, itemsParseados);

        return {
          ...r,
          correlativo: r.correlativo_req || `REQ-#${r.id}`,
          items: itemsParseados,
          soportes
        };
      });

      setRequisiciones(formateadas);

      // Extraer gerencias únicas
      const gSet = new Set();
      formateadas.forEach(r => { if (r.gerencia) gSet.add(r.gerencia); });
      setGerenciasDisponibles(Array.from(gSet).sort());

    } catch (err) {
      console.error('Error al cargar requisiciones:', err);
      toast.error('No se pudieron cargar las requisiciones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarRequisiciones();
  }, [cargarRequisiciones]);

  // Verificar si una requisición es de un analista o subordinado de este usuario
  const esDeMiEquipo = useCallback((r) => {
    const sol = (r.solicitante || '').toLowerCase();
    const esCarlosDeJorge = esJorge && sol.includes('carlos delgado');
    const esSubordinadoDirecto = (r.gerente_directo_id && r.gerente_directo_id === currentUser?.id) ||
                                (r.user_id && analistasIds.includes(r.user_id));
    return Boolean(esCarlosDeJorge || esSubordinadoDirecto);
  }, [currentUser, esJorge, analistasIds]);

  // Verificar si una requisición requiere aprobación de este usuario
  const requiereMiAprobacion = useCallback((r) => {
    const estado = (r.estado_aprobacion || '').toLowerCase();
    const esPendiente = estado.includes('pendiente') || estado.includes('enviada');
    if (!esPendiente) return false;

    const miNombreCompleto = `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim().toLowerCase();
    const solNombre = (r.solicitante || '').toLowerCase();
    const esSolicitante = (currentUser?.id && r.user_id === currentUser.id) || (miNombreCompleto && solNombre.includes(miNombreCompleto));
    if (esSolicitante && !esGG) return false;

    // Si es analista o subordinado directo (ej: Carlos Delgado para Jorge Urdaneta)
    if (esDeMiEquipo(r)) {
      return true;
    }

    if (estado === 'pendiente_proyecto') {
      return esGG || rolUpper.includes('PROYECTO') || esGerenteArea;
    }
    if (estado === 'pendiente_area') {
      return esGerenteArea;
    }
    if (estado === 'enviada_general') {
      return esGG;
    }
    return esGG || esGerenteArea;
  }, [currentUser, esGG, esGerenteArea, rolUpper, esDeMiEquipo]);

  // Contador de pendientes para el badge
  const pendientesCount = useMemo(() => {
    return requisiciones.filter(requiereMiAprobacion).length;
  }, [requisiciones, requiereMiAprobacion]);

  // Contador de mi equipo
  const miEquipoCount = useMemo(() => {
    return requisiciones.filter(esDeMiEquipo).length;
  }, [requisiciones, esDeMiEquipo]);

  useEffect(() => {
    if (onPendingCountChange) {
      onPendingCountChange(pendientesCount);
    }
  }, [pendientesCount, onPendingCountChange]);

  // Filtrado de la lista
  const requisicionesFiltradas = useMemo(() => {
    return requisiciones.filter(r => {
      // Filtro de pestaña
      if (filtroTab === 'por_aprobar') {
        if (!requiereMiAprobacion(r)) return false;
      } else if (filtroTab === 'mi_equipo') {
        if (!esDeMiEquipo(r)) return false;
      } else if (filtroTab === 'mis_solicitudes') {
        const miNombre = `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim().toLowerCase();
        const sol = (r.solicitante || '').toLowerCase();
        if (!sol.includes(miNombre)) return false;
      }

      // Filtro de gerencia
      if (filtroGerencia !== 'Todas' && r.gerencia !== filtroGerencia) {
        return false;
      }

      // Filtro de texto de búsqueda
      if (busqueda.trim()) {
        const query = busqueda.toLowerCase().trim();
        const matchCorr = (r.correlativo || '').toLowerCase().includes(query);
        const matchSol = (r.solicitante || '').toLowerCase().includes(query);
        const matchCC = (r.centro_costo || '').toLowerCase().includes(query);
        const matchGer = (r.gerencia || '').toLowerCase().includes(query);
        const matchItems = (r.items || []).some(it => (it.descripcion || it.nombre || '').toLowerCase().includes(query));
        if (!matchCorr && !matchSol && !matchCC && !matchGer && !matchItems) return false;
      }

      return true;
    });
  }, [requisiciones, filtroTab, filtroGerencia, busqueda, requiereMiAprobacion, esDeMiEquipo, currentUser]);

  // Handler de Aprobación
  const handleAprobar = async (req, tipoAprobacion) => {
    const nombreCompleto = `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim();
    setLoadingAction(true);
    const toastId = toast.loading('Procesando aprobación...');

    try {
      let updatePayload = {};

      if (tipoAprobacion === 'proyecto') {
        updatePayload = {
          aprobado_gerente_proyecto: true,
          n_aprobacion_proyecto: nombreCompleto,
          f_aprobacion_proyecto: new Date().toISOString(),
          firma_gerente_proyecto: currentUser?.firma_url || null,
          estado_aprobacion: 'pendiente_area'
        };
      } else if (tipoAprobacion === 'area') {
        if (esFavio) {
          // Favio es el tope de El Tigre -> va directo a compras
          updatePayload = {
            aprobado_gerente_area: true,
            n_aprobacion_area: nombreCompleto,
            f_aprobacion_area: new Date().toISOString(),
            firma_gerente: currentUser?.firma_url || null,
            aprobado_gerente_general: true,
            n_aprobacion_general: nombreCompleto,
            f_aprobacion_general: new Date().toISOString(),
            firma_gerente_general: currentUser?.firma_url || null,
            estado_aprobacion: 'aprobado_final',
            aprobacion: true,
            aprobacion_nombre: 'Aprobado'
          };
        } else {
          updatePayload = {
            aprobado_gerente_area: true,
            n_aprobacion_area: nombreCompleto,
            f_aprobacion_area: new Date().toISOString(),
            firma_gerente: currentUser?.firma_url || null,
            estado_aprobacion: 'enviada_general'
          };
        }
      } else if (tipoAprobacion === 'general' || tipoAprobacion === 'general_directa') {
        updatePayload = {
          aprobado_gerente_area: true,
          n_aprobacion_area: req.n_aprobacion_area || nombreCompleto,
          f_aprobacion_area: req.f_aprobacion_area || new Date().toISOString(),
          firma_gerente: req.firma_gerente || currentUser?.firma_url || null,
          aprobado_gerente_general: true,
          n_aprobacion_general: nombreCompleto,
          f_aprobacion_general: new Date().toISOString(),
          firma_gerente_general: currentUser?.firma_url || null,
          estado_aprobacion: 'aprobado_final',
          aprobacion: true,
          aprobacion_nombre: 'Aprobado'
        };
      }

      const { error } = await supabase
        .from('requisiciones')
        .update(updatePayload)
        .eq('id', req.id);

      if (error) throw error;

      // Notificar al solicitante
      try {
        const msgNotif = updatePayload.estado_aprobacion === 'aprobado_final'
          ? `Su requisición ${req.correlativo} ha sido APROBADA FINALMENTE y pasa a Compras.`
          : `Su requisición ${req.correlativo} avanzó a ${updatePayload.estado_aprobacion}.`;

        const targetUserId = req.user_id || req.solicitante_id;
        if (targetUserId) {
          await supabase.from('notificaciones').insert([{
            usuario_id: targetUserId,
            mensaje: msgNotif,
            tipo: 'Aprobación',
            leido: false,
            requisicion_id: req.id
          }]);
        }
      } catch (eNotif) {
        console.warn('Error al notificar:', eNotif);
      }

      vibrateHaptic('success');
      toast.success(`Requisición ${req.correlativo} aprobada con éxito`, { id: toastId });
      await cargarRequisiciones();
    } catch (err) {
      console.error('Error al aprobar requisición:', err);
      toast.error(`Error al aprobar: ${err.message}`, { id: toastId });
    } finally {
      setLoadingAction(false);
    }
  };

  // Handler de Rechazo
  const handleRechazar = async (req, motivo) => {
    setLoadingAction(true);
    const toastId = toast.loading('Rechazando requisición...');

    try {
      const { error } = await supabase
        .from('requisiciones')
        .update({
          estado_aprobacion: 'rechazada',
          motivo_rechazo: motivo,
          aprobacion: false,
          aprobacion_nombre: 'Rechazada'
        })
        .eq('id', req.id);

      if (error) throw error;

      // Notificar al solicitante
      try {
        const targetUserId = req.user_id || req.solicitante_id;
        if (targetUserId) {
          await supabase.from('notificaciones').insert([{
            usuario_id: targetUserId,
            mensaje: `Su requisición ${req.correlativo} fue RECHAZADA. Motivo: ${motivo}`,
            tipo: 'Rechazo',
            leido: false,
            requisicion_id: req.id
          }]);
        }
      } catch (eNotif) {
        console.warn('Error al notificar:', eNotif);
      }

      vibrateHaptic('reject');
      toast.success(`Requisición ${req.correlativo} rechazada`, { id: toastId });
      await cargarRequisiciones();
    } catch (err) {
      console.error('Error al rechazar requisición:', err);
      toast.error(`Error al rechazar: ${err.message}`, { id: toastId });
    } finally {
      setLoadingAction(false);
    }
  };

  return (
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
          className={`m-pill-btn ${filtroTab === 'mi_equipo' ? 'active' : ''}`}
          onClick={() => setFiltroTab('mi_equipo')}
        >
          <span>Mi Equipo / Analistas</span>
          {miEquipoCount > 0 && <span className="m-badge-count" style={{ background: '#3b82f6' }}>{miEquipoCount}</span>}
        </button>

        <button
          className={`m-pill-btn ${filtroTab === 'mis_solicitudes' ? 'active' : ''}`}
          onClick={() => setFiltroTab('mis_solicitudes')}
        >
          <span>Mis Requisiciones</span>
        </button>

        <button
          className={`m-pill-btn ${filtroTab === 'todas' ? 'active' : ''}`}
          onClick={() => setFiltroTab('todas')}
        >
          <span>Todas ({requisiciones.length})</span>
        </button>
      </div>

      {/* Buscador y Filtro */}
      <div className="m-search-box">
        <div className="m-input-wrapper">
          <Search size={18} />
          <input
            type="text"
            className="m-search-input"
            placeholder="Buscar por correlativo, solicitante o ítem..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {gerenciasDisponibles.length > 0 && (
          <div className="m-filters-row">
            <select
              className="m-select"
              value={filtroGerencia}
              onChange={(e) => setFiltroGerencia(e.target.value)}
            >
              <option value="Todas">Todas las Gerencias</option>
              {gerenciasDisponibles.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>

            <button
              className="m-btn-icon"
              title="Refrescar lista"
              onClick={cargarRequisiciones}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        )}
      </div>

      {/* Lista de Requisiciones */}
      {loading ? (
        <div className="m-empty-state">
          <Loader2 size={36} className="animate-spin" color="#38bdf8" />
          <p>Cargando requisiciones...</p>
        </div>
      ) : requisicionesFiltradas.length === 0 ? (
        <div className="m-empty-state">
          <CheckCircle2 size={42} color="#10b981" />
          <p>
            {filtroTab === 'por_aprobar'
              ? '¡Excelente! No tienes requisiciones pendientes por aprobar.'
              : 'No se encontraron requisiciones con los filtros seleccionados.'}
          </p>
        </div>
      ) : (
        <div className="m-card-list">
          {requisicionesFiltradas.map(req => (
            <MobileReqCard
              key={req.id}
              req={req}
              currentUser={currentUser}
              onAprobar={handleAprobar}
              onRechazar={handleRechazar}
              loadingAction={loadingAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}

