import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { safeSupabaseUpdate } from '../utils/helpers';
import MobileOrdenCard from './MobileOrdenCard';
import { vibrateHaptic } from './haptics';
import { Search, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MobileOrdenesCompra({ currentUser, onPendingCountChange }) {
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [filtroTab, setFiltroTab] = useState(() => {
    const emailInit = (currentUser?.correo || currentUser?.email || '').toLowerCase();
    const rolInit = (currentUser?.rol || '').toLowerCase();
    const nomInit = `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.toLowerCase();
    const esCarlosInit = emailInit.includes('cvega') || nomInit.includes('carlos vega') || rolInit.includes('gerente general');
    return esCarlosInit ? 'sin_firma' : 'por_aprobar';
  }); // 'por_aprobar' | 'aprobadas' | 'sin_firma' | 'todas'
  const [busqueda, setBusqueda] = useState('');

  const deptoUser = (currentUser?.departamento || '').toLowerCase().trim();
  const rolUser = (currentUser?.rol || '').toLowerCase().trim();
  const emailUser = (currentUser?.correo || currentUser?.email || '').toLowerCase().trim();
  const nombreUser = (currentUser?.nombre || '').toLowerCase().trim();
  const apellidoUser = (currentUser?.apellido || '').toLowerCase().trim();
  const cargoUser = (currentUser?.cargo || '').toLowerCase().trim();

  const esSuperAdmin = emailUser === 'jcontreras.totalclean@gmail.com' ||
                       currentUser?.esAdminReal ||
                       rolUser === 'superadmin' ||
                       rolUser === 'admin' ||
                       (rolUser.includes('admin') && !rolUser.includes('analista'));

  const esGerenteGeneral = emailUser === 'cvega@totalclean.com.ve' ||
                           emailUser === 'cvega.totalclean@gmail.com' ||
                           emailUser === 'cvega@totalclean.com' ||
                           emailUser.includes('cvega') ||
                           (nombreUser.includes('carlos') && apellidoUser.includes('vega')) ||
                           rolUser.includes('gerente general') ||
                           cargoUser.includes('gerente general');

  const esGerenteCompras = (nombreUser.includes('ricardo') && apellidoUser.includes('herrera')) ||
                           emailUser.includes('rherrera') ||
                           rolUser === 'gerente de compras' ||
                           rolUser === 'gerente compras' ||
                           cargoUser === 'gerente de compras' ||
                           cargoUser === 'gerente compras' ||
                           (rolUser.includes('gerente') && deptoUser.includes('compra') && !rolUser.includes('analista'));

  const puedeAprobarOdc = esSuperAdmin || esGerenteGeneral || esGerenteCompras;
  const puedeFirmarCarlos = esSuperAdmin || esGerenteGeneral;
  const puedeFirmarRicardo = esSuperAdmin || esGerenteCompras;

  const esAnuladaOdc = (o) => {
    const eo = (o.estatus_orden || '').toUpperCase();
    const ep = (o.estatus_pago || o.status_pago || '').toUpperCase();
    const eap = (o.estado_aprobacion_precio || '').toLowerCase();
    return eo === 'ANULADA' || ep === 'ANULADA' || eap === 'anulada';
  };

  const esPendienteAprobacion = useCallback((o) => {
    if (esAnuladaOdc(o)) return false;
    const eap = (o.estado_aprobacion_precio || '').toLowerCase();
    const eo = (o.estatus_orden || '').toUpperCase();
    if (eap === 'aprobado' || eo === 'APROBADA' || eap === 'rechazado' || eo === 'RECHAZADA') {
      return false;
    }
    return true;
  }, []);

  const cargarOrdenes = useCallback(async () => {
    setLoading(true);
    try {
      const [resOrdenes, resItems] = await Promise.all([
        supabase
          .from('ordenes_compra')
          .select('*')
          .order('id', { ascending: false })
          .limit(300),
        supabase
          .from('ordenes_compra_items')
          .select('*')
          .order('id', { ascending: true })
          .limit(1500)
      ]);

      if (resOrdenes.error) throw resOrdenes.error;

      const itemsPorOdc = {};
      (resItems.data || []).forEach(it => {
        const key = String(it.orden_compra_id);
        if (!itemsPorOdc[key]) itemsPorOdc[key] = [];
        itemsPorOdc[key].push(it);
      });

      const mapeadas = (resOrdenes.data || []).map(o => ({
        ...o,
        items_detalle: itemsPorOdc[String(o.id)] || (Array.isArray(o.items) ? o.items : [])
      }));

      setOrdenes(mapeadas);
    } catch (err) {
      console.error('Error al cargar órdenes de compra en móvil:', err);
      toast.error('No se pudieron cargar las órdenes de compra');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarOrdenes();
  }, [cargarOrdenes]);

  const pendientesCount = useMemo(() => {
    if (!puedeAprobarOdc) return 0;
    return ordenes.filter(esPendienteAprobacion).length;
  }, [ordenes, puedeAprobarOdc, esPendienteAprobacion]);

  const sinFirmaCarlosCount = useMemo(() => {
    return ordenes.filter(o => !esAnuladaOdc(o) && !o.carlos_firma_digital_activa).length;
  }, [ordenes]);

  useEffect(() => {
    if (onPendingCountChange) {
      onPendingCountChange(pendientesCount);
    }
  }, [pendientesCount, onPendingCountChange]);

  const ordenesFiltradas = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return ordenes.filter(o => {
      if (filtroTab === 'por_aprobar') {
        if (!esPendienteAprobacion(o)) return false;
      } else if (filtroTab === 'aprobadas') {
        if (esAnuladaOdc(o)) return false;
        const eap = (o.estado_aprobacion_precio || '').toLowerCase();
        const eo = (o.estatus_orden || '').toUpperCase();
        if (eap !== 'aprobado' && eo !== 'APROBADA') return false;
      } else if (filtroTab === 'sin_firma') {
        if (esAnuladaOdc(o) || o.carlos_firma_digital_activa) return false;
      }

      if (q) {
        const num = (o.numero_odc || '').toLowerCase();
        const prov = (o.proveedor_nombre || '').toLowerCase();
        const req = (o.requisicion_correlativo || o.correlativo_req || '').toLowerCase();
        const comp = (o.elaborado_por_nombre || o.comprador_nombre || '').toLowerCase();
        return num.includes(q) || prov.includes(q) || req.includes(q) || comp.includes(q);
      }
      return true;
    });
  }, [ordenes, filtroTab, busqueda, esPendienteAprobacion]);

  const handleAprobarOdc = async (odc, nivelPrioridad = 2) => {
    if (!puedeAprobarOdc) {
      toast.error('No tienes permiso para aprobar Órdenes de Compra');
      return;
    }
    setLoadingAction(true);
    vibrateHaptic('success');
    const toastId = toast.loading(`Aprobando ${odc.numero_odc}...`);
    try {
      const nombreAprobador = `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim() || currentUser?.correo || 'Gerencia';
      const fechaNow = new Date().toISOString();

      const payload = {
        estado_aprobacion_precio: 'aprobado',
        estatus_orden: 'APROBADA',
        prioridad_pago: Number(nivelPrioridad) || 2,
        aprobado_compras_por: nombreAprobador,
        aprobado_por_nombre: nombreAprobador,
        fecha_aprobacion_compras: fechaNow,
        motivo_rechazo_compras: null,
        carlos_comentario_aprobacion: null
      };

      // Si quien aprueba es Carlos Vega o Ricardo Herrera, estampar su firma digital automáticamente
      if (esGerenteGeneral) {
        payload.carlos_firma_digital_activa = true;
        payload.carlos_firma_fecha = fechaNow;
      }
      if (esGerenteCompras) {
        payload.ricardo_firma_digital_activa = true;
        payload.ricardo_firma_fecha = fechaNow;
        payload.ricardo_firma_por = nombreAprobador;
      }

      const { error } = await safeSupabaseUpdate(supabase, 'ordenes_compra', payload, 'id', odc.id);
      if (error) throw error;

      localStorage.setItem(`odc_prio_${odc.id}`, String(payload.prioridad_pago));
      localStorage.setItem(`odc_prio_status_${odc.id}`, 'aprobado');
      localStorage.setItem(`odc_prio_user_${odc.id}`, nombreAprobador);
      localStorage.removeItem(`odc_prio_motivo_${odc.id}`);

      setOrdenes(prev => prev.map(o => o.id === odc.id ? { ...o, ...payload } : o));
      toast.success(`ODC ${odc.numero_odc} aprobada (Nivel ${payload.prioridad_pago})`, { id: toastId });
    } catch (err) {
      console.error('Error al aprobar ODC desde móvil:', err);
      toast.error(`Error al aprobar: ${err.message}`, { id: toastId });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRechazarOdc = async (odc, motivo) => {
    if (!puedeAprobarOdc) {
      toast.error('No tienes permiso para rechazar Órdenes de Compra');
      return;
    }
    setLoadingAction(true);
    vibrateHaptic('error');
    const toastId = toast.loading(`Rechazando ${odc.numero_odc}...`);
    try {
      const nombreAprobador = `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim() || currentUser?.correo || 'Gerencia';
      const fechaNow = new Date().toISOString();

      const payload = {
        estado_aprobacion_precio: 'rechazado',
        estatus_orden: 'EMITIDA',
        prioridad_pago: null,
        motivo_rechazo_compras: motivo,
        carlos_comentario_aprobacion: `[RECHAZADO]: ${motivo}`,
        aprobado_compras_por: nombreAprobador,
        aprobado_por_nombre: nombreAprobador,
        fecha_aprobacion_compras: fechaNow
      };

      const { error } = await safeSupabaseUpdate(supabase, 'ordenes_compra', payload, 'id', odc.id);
      if (error) throw error;

      localStorage.setItem(`odc_prio_status_${odc.id}`, 'rechazado');
      localStorage.setItem(`odc_prio_motivo_${odc.id}`, motivo);
      localStorage.removeItem(`odc_prio_${odc.id}`);

      setOrdenes(prev => prev.map(o => o.id === odc.id ? { ...o, ...payload } : o));
      toast.success(`ODC ${odc.numero_odc} rechazada y devuelta a Compras`, { id: toastId });
    } catch (err) {
      console.error('Error al rechazar ODC desde móvil:', err);
      toast.error(`Error al rechazar: ${err.message}`, { id: toastId });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleToggleFirma = async (odc, tipoFirma, activa) => {
    setLoadingAction(true);
    vibrateHaptic('light');
    try {
      const hoyIso = new Date().toISOString();
      const nombreFirmante = `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim() || 'Gerencia';
      const payload = tipoFirma === 'carlos'
        ? { carlos_firma_digital_activa: activa, carlos_firma_fecha: activa ? hoyIso : null }
        : { ricardo_firma_digital_activa: activa, ricardo_firma_fecha: activa ? hoyIso : null, ricardo_firma_por: activa ? nombreFirmante : null };

      const { error } = await safeSupabaseUpdate(supabase, 'ordenes_compra', payload, 'id', odc.id);
      if (error) throw error;

      setOrdenes(prev => prev.map(o => o.id === odc.id ? { ...o, ...payload } : o));
      toast.success(activa ? 'Firma digital activada' : 'Firma digital retirada');
    } catch (err) {
      console.error('Error al cambiar firma ODC:', err);
      toast.error('Error al actualizar firma: ' + err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {/* Barra de Búsqueda */}
      <div className="m-search-bar">
        <div className="m-search-input-wrap" style={{ flex: 1 }}>
          <Search size={18} color="#94a3b8" />
          <input
            type="text"
            className="m-search-input"
            placeholder="Buscar ODC, proveedor o requisición..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <button
          className="m-btn-icon"
          onClick={() => {
            vibrateHaptic('light');
            cargarOrdenes();
          }}
          title="Actualizar Órdenes de Compra"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filtros en Pills */}
      <div className="m-filter-pills">
        {puedeFirmarCarlos && (
          <button
            className={`m-pill-btn ${filtroTab === 'sin_firma' ? 'active' : ''}`}
            onClick={() => setFiltroTab('sin_firma')}
          >
            <span>Sin Firma Carlos</span>
            {sinFirmaCarlosCount > 0 && <span className="m-pill-count">{sinFirmaCarlosCount}</span>}
          </button>
        )}

        <button
          className={`m-pill-btn ${filtroTab === 'por_aprobar' ? 'active' : ''}`}
          onClick={() => setFiltroTab('por_aprobar')}
        >
          <span>Por Aprobar</span>
          {pendientesCount > 0 && <span className="m-pill-count">{pendientesCount}</span>}
        </button>

        <button
          className={`m-pill-btn ${filtroTab === 'aprobadas' ? 'active' : ''}`}
          onClick={() => setFiltroTab('aprobadas')}
        >
          <span>Aprobadas</span>
        </button>

        <button
          className={`m-pill-btn ${filtroTab === 'todas' ? 'active' : ''}`}
          onClick={() => setFiltroTab('todas')}
        >
          <span>Todas</span>
        </button>
      </div>

      {/* Lista de Tarjetas */}
      <div className="m-list-container">
        {loading ? (
          <div className="m-empty-state">
            <Loader2 size={36} className="animate-spin" color="#38bdf8" />
            <p style={{ margin: 0, fontWeight: 600 }}>Cargando órdenes de compra...</p>
          </div>
        ) : ordenesFiltradas.length === 0 ? (
          <div className="m-empty-state">
            <CheckCircle2 size={44} color="#10b981" style={{ opacity: 0.7 }} />
            <h3 style={{ margin: '8px 0 4px 0', color: '#f8fafc', fontSize: '1.05rem' }}>
              Sin órdenes pendientes
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', maxWidth: '260px' }}>
              {filtroTab === 'por_aprobar'
                ? '¡Excelente! No tienes órdenes de compra pendientes por aprobar.'
                : 'No se encontraron órdenes con los criterios seleccionados.'}
            </p>
          </div>
        ) : (
          ordenesFiltradas.map(odc => (
            <MobileOrdenCard
              key={odc.id}
              odc={odc}
              puedeAprobar={puedeAprobarOdc}
              puedeFirmarCarlos={puedeFirmarCarlos}
              puedeFirmarRicardo={puedeFirmarRicardo}
              onAprobar={handleAprobarOdc}
              onRechazar={handleRechazarOdc}
              onToggleFirma={handleToggleFirma}
              loadingAction={loadingAction}
            />
          ))
        )}
      </div>
    </div>
  );
}
