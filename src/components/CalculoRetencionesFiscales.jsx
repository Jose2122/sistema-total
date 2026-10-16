import React, { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Calculator,
  DollarSign,
  Euro,
  RefreshCw,
  FileText,
  Printer,
  Save,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  Layers,
  Search,
  ExternalLink,
  Percent,
  TrendingDown,
  Info,
  BookOpen,
  X,
  Check,
  HelpCircle
} from 'lucide-react';
import {
  calcularLiquidacionFiscal,
  guardarRetencionFiscal,
  obtenerRetencionesFiscales,
  anularRetencionFiscal
} from '../services/retencionesService';
import {
  obtenerTasasBCV,
  guardarTasaPreferencialLocal,
  obtenerTasaPreferencialLocal
} from '../services/tasasService';
import {
  TIPOS_PERSONA_ISLR,
  CONCEPTOS_RETENCION_ISLR,
  detectarTipoPersonaPorRif,
  VALOR_UT_DEFAULT,
  FACTOR_SUSTRAENDO_UT,
  calcularMontoMinimoSustraendoBs
} from '../constants/tablaRetencionesIslr';
import './CalculoRetencionesFiscales.css';

/**
 * Componente Especializado: Cálculo de Retenciones (IVA e ISLR) y Tipos de Cambio
 * Módulo Cuentas por Pagar - SITC (Total Clean C.A.)
 */
const CalculoRetencionesFiscales = ({
  currentUser = null,
  facturaInicial = null,
  odcInicial = null,
  odcsList = [],
  proveedoresList = [],
  onLiquidacionGuardada = null
}) => {
  // --- ESTADO DE TIPOS DE CAMBIO ---
  const [tipoTasa, setTipoTasa] = useState('BCV_USD'); // 'BCV_USD' | 'BCV_EUR' | 'PREFERENCIAL'
  const [tasasBCV, setTasasBCV] = useState({ BCV_USD: 46.5000, BCV_EUR: 50.1500, origen: 'default' });
  const [tasaManual, setTasaManual] = useState(obtenerTasaPreferencialLocal() || 46.5000);
  const [cargandoTasas, setCargandoTasas] = useState(false);
  const [permiteEdicionManualTasa, setPermiteEdicionManualTasa] = useState(false);

  // --- DATOS DEL DOCUMENTO / FACTURA ---
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState(null);
  const [proveedorNombre, setProveedorNombre] = useState('');
  const [proveedorRif, setProveedorRif] = useState('');
  const [numeroFactura, setNumeroFactura] = useState('');
  const [numeroControl, setNumeroControl] = useState('');
  const [fechaFactura, setFechaFactura] = useState(new Date().toISOString().split('T')[0]);
  const [odcAsociadaId, setOdcAsociadaId] = useState('');
  const [concepto, setConcepto] = useState('');

  // --- MONTOS Y BASES IMPONIBLES ---
  const [montoExento, setMontoExento] = useState(0);
  const [baseImponible, setBaseImponible] = useState(0);
  const [alicuotaIva, setAlicuotaIva] = useState(16.00); // 16% defecto, 8% reducida, 0% exenta

  // --- RETENCIÓN IVA ---
  // Opciones: 0, 75, 100
  const [porcentajeRetIva, setPorcentajeRetIva] = useState(75.00);

  // --- RETENCIÓN ISLR CON TABULADOR OFICIAL (DECRETO 1.808) ---
  const [tipoPersona, setTipoPersona] = useState('PJD'); // 'PJD' | 'PNR' | 'PJND' | 'PNNR'
  const [conceptoIslrId, setConceptoIslrId] = useState('servicios_general');
  const [unidadTributaria, setUnidadTributaria] = useState(VALOR_UT_DEFAULT);
  const [porcentajeRetIslrCustom, setPorcentajeRetIslrCustom] = useState(2.00);
  const [baseRetIslrCustom, setBaseRetIslrCustom] = useState(100);
  const [mostrarModalTabulador, setMostrarModalTabulador] = useState(false);
  const [busquedaTabulador, setBusquedaTabulador] = useState('');
  const [categoriaTabuladorFiltro, setCategoriaTabuladorFiltro] = useState('Todas');

  // --- HISTORIAL Y ESTADO GENERAL ---
  const [historialRetenciones, setHistorialRetenciones] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [busquedaHistorial, setBusquedaHistorial] = useState('');
  const [comprobanteModal, setComprobanteModal] = useState(null); // Documento para imprimir comprobante
  const [modoSelectorDoc, setModoSelectorDoc] = useState(false);

  // 1. Cargar tasas BCV al inicio
  const refrescarTasasBCV = useCallback(async () => {
    setCargandoTasas(true);
    try {
      const data = await obtenerTasasBCV();
      setTasasBCV(data);
      if (tipoTasa === 'BCV_USD') {
        setTasaManual(data.BCV_USD);
      } else if (tipoTasa === 'BCV_EUR') {
        setTasaManual(data.BCV_EUR);
      }
      toast.success('Tasas cambiarias actualizadas con éxito', { id: 'tasas-toast' });
    } catch {
      toast.error('No se pudo conectar con la tasa BCV en vivo. Usando respaldo.');
    } finally {
      setCargandoTasas(false);
    }
  }, [tipoTasa]);

  useEffect(() => {
    refrescarTasasBCV();
  }, [refrescarTasasBCV]);

  // Sincronizar valor de tasa activa según el selector pill
  useEffect(() => {
    if (tipoTasa === 'BCV_USD') {
      setTasaManual(tasasBCV.BCV_USD || 46.5000);
      setPermiteEdicionManualTasa(false);
    } else if (tipoTasa === 'BCV_EUR') {
      setTasaManual(tasasBCV.BCV_EUR || 50.1500);
      setPermiteEdicionManualTasa(false);
    } else if (tipoTasa === 'PREFERENCIAL') {
      setPermiteEdicionManualTasa(true);
      const pref = obtenerTasaPreferencialLocal();
      if (pref) setTasaManual(pref);
    }
  }, [tipoTasa, tasasBCV]);

  // 2. Pre-llenar si se pasa una factura inicial o una ODC inicial
  useEffect(() => {
    if (odcInicial) {
      setOdcAsociadaId(odcInicial.id || '');
      setProveedorNombre(odcInicial.proveedor_nombre || '');
      const rif = odcInicial.proveedor_rif || '';
      setProveedorRif(rif);
      if (rif) setTipoPersona(detectarTipoPersonaPorRif(rif));
      setNumeroFactura(odcInicial.numero_factura || odcInicial.factura_numero || odcInicial.numero_odc || '');
      setBaseImponible(Number(odcInicial.subtotal) || Number(odcInicial.total_general) || 0);
      setMontoExento(Number(odcInicial.monto_exento) || 0);
      setConcepto(`Liquidación ODC ${odcInicial.numero_odc || ''} - ${odcInicial.proveedor_nombre || ''}`);
    } else if (facturaInicial) {
      setProveedorNombre(facturaInicial.proveedor_nombre || '');
      const rif = facturaInicial.proveedor_rif || '';
      setProveedorRif(rif);
      if (rif) setTipoPersona(detectarTipoPersonaPorRif(rif));
      setNumeroFactura(facturaInicial.doc_numero || facturaInicial.factura_num || '');
      setBaseImponible(Number(facturaInicial.monto_total) || Number(facturaInicial.total) || 0);
      setConcepto(`Factura #${facturaInicial.doc_numero || ''} de ${facturaInicial.proveedor_nombre || ''}`);
    }
  }, [facturaInicial, odcInicial]);

  // 3. Cargar historial de retenciones guardadas
  const cargarHistorial = useCallback(async () => {
    setCargandoHistorial(true);
    try {
      const data = await obtenerRetencionesFiscales();
      setHistorialRetenciones(data);
    } catch (e) {
      console.warn('Error cargando historial retenciones:', e);
    } finally {
      setCargandoHistorial(false);
    }
  }, []);

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  // 4. CÁLCULO REACTIVO CON useMemo (TABULADOR OFICIAL DECRETO 1.808)
  const liquidacion = useMemo(() => {
    return calcularLiquidacionFiscal({
      tipo_tasa: tipoTasa,
      valor_tasa: tasaManual,
      monto_exento: montoExento,
      base_imponible: baseImponible,
      alicuota_iva: alicuotaIva,
      porcentaje_retencion_iva: porcentajeRetIva,
      porcentaje_retencion_islr: porcentajeRetIslrCustom,
      tipo_persona: tipoPersona,
      concepto_islr_id: conceptoIslrId,
      unidad_tributaria: unidadTributaria,
      porcentaje_base_islr: baseRetIslrCustom
    });
  }, [
    tipoTasa,
    tasaManual,
    montoExento,
    baseImponible,
    alicuotaIva,
    porcentajeRetIva,
    porcentajeRetIslrCustom,
    baseRetIslrCustom,
    tipoPersona,
    conceptoIslrId,
    unidadTributaria
  ]);

  // Simbología de moneda
  const simboloDivisa = tipoTasa === 'BCV_EUR' ? '€' : '$';

  // Helpers y listas para Tabulador ISLR (Decreto 1.808)
  const conceptoActivo = useMemo(() => {
    return CONCEPTOS_RETENCION_ISLR.find(c => c.id === conceptoIslrId) || CONCEPTOS_RETENCION_ISLR[0];
  }, [conceptoIslrId]);

  const tarifaActiva = useMemo(() => {
    if (!conceptoActivo || !conceptoActivo.tarifas) return null;
    return conceptoActivo.tarifas[tipoPersona] || conceptoActivo.tarifas.PJD;
  }, [conceptoActivo, tipoPersona]);

  const conceptosFrecuentes = useMemo(() => {
    return CONCEPTOS_RETENCION_ISLR.filter(c => c.frecuente);
  }, []);

  const categoriasDisponibles = useMemo(() => {
    const cats = new Set(['Todas']);
    CONCEPTOS_RETENCION_ISLR.forEach(c => {
      if (c.categoria) cats.add(c.categoria);
    });
    return Array.from(cats);
  }, []);

  const conceptosFiltrados = useMemo(() => {
    return CONCEPTOS_RETENCION_ISLR.filter(item => {
      const matchCat = categoriaTabuladorFiltro === 'Todas' || item.categoria === categoriaTabuladorFiltro;
      if (!matchCat) return false;
      if (!busquedaTabulador.trim()) return true;
      const q = busquedaTabulador.toLowerCase().trim();
      const t = item.tarifas?.[tipoPersona] || {};
      return (
        (item.nombre && item.nombre.toLowerCase().includes(q)) ||
        (item.numeral && item.numeral.toLowerCase().includes(q)) ||
        (item.id && item.id.toLowerCase().includes(q)) ||
        (t.codigo && t.codigo.toLowerCase().includes(q))
      );
    });
  }, [categoriaTabuladorFiltro, busquedaTabulador, tipoPersona]);

  // Manejador para guardar liquidación
  const handleGuardarLiquidacion = async () => {
    if (!proveedorNombre.trim()) {
      toast.error('Debe ingresar la Razón Social del Proveedor');
      return;
    }
    if (!numeroFactura.trim()) {
      toast.error('Debe indicar el Número de Factura');
      return;
    }
    if (liquidacion.base_imponible <= 0 && liquidacion.monto_exento <= 0) {
      toast.error('Debe ingresar una Base Imponible o Monto Exento superior a 0');
      return;
    }

    setGuardando(true);
    try {
      const payload = {
        proveedor_id: proveedorSeleccionado?.id || null,
        proveedor_nombre: proveedorNombre.trim(),
        proveedor_rif: proveedorRif.trim(),
        numero_factura: numeroFactura.trim(),
        numero_control: numeroControl.trim(),
        fecha_emision: fechaFactura,
        orden_compra_id: odcAsociadaId || null,
        concepto: concepto.trim() || `Liquidación Factura #${numeroFactura}`,
        creado_por_id: currentUser?.id || null,
        creado_por_nombre: currentUser?.user_metadata?.nombre || currentUser?.email || 'Administrador CxP',
        ...liquidacion
      };

      const resultado = await guardarRetencionFiscal(payload);

      if (resultado.warning) {
        toast(resultado.warning, { icon: '⚠️', duration: 6000 });
      } else {
        toast.success(`Liquidación fiscal guardada. Comprobante: ${resultado.data?.numero_comprobante || 'Generado'}`);
      }

      // Si fue preferencial, recordar tasa
      if (tipoTasa === 'PREFERENCIAL') {
        guardarTasaPreferencialLocal(tasaManual);
      }

      // Actualizar historial
      await cargarHistorial();

      // Abrir comprobante para imprimir/revisar
      setComprobanteModal(resultado.data);

      if (onLiquidacionGuardada) {
        onLiquidacionGuardada(resultado.data);
      }
    } catch (err) {
      console.error('Error guardando liquidación:', err);
      toast.error('Error al registrar la liquidación: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  // Limpiar formulario para nueva liquidación
  const handleLimpiarFormulario = () => {
    setProveedorSeleccionado(null);
    setProveedorNombre('');
    setProveedorRif('');
    setNumeroFactura('');
    setNumeroControl('');
    setOdcAsociadaId('');
    setConcepto('');
    setMontoExento(0);
    setBaseImponible(0);
    setAlicuotaIva(16.00);
    setPorcentajeRetIva(75.00);
    setTipoPersona('PJD');
    setConceptoIslrId('servicios_general');
    setPorcentajeRetIslrCustom(2.00);
    setBaseRetIslrCustom(100);
    toast('Formulario reiniciado', { icon: '🧹' });
  };

  // Pre-llenar desde una ODC existente
  const handleSeleccionarOdc = (odc) => {
    setOdcAsociadaId(odc.id);
    setProveedorNombre(odc.proveedor_nombre || '');
    const rif = odc.proveedor_rif || '';
    setProveedorRif(rif);
    if (rif) setTipoPersona(detectarTipoPersonaPorRif(rif));
    setNumeroFactura(odc.numero_factura || odc.numero_odc || '');
    setBaseImponible(Number(odc.subtotal) || Number(odc.total_general) || 0);
    setConcepto(`ODC ${odc.numero_odc} - ${odc.proveedor_nombre || ''}`);
    setModoSelectorDoc(false);
    toast.success(`Datos cargados desde ODC ${odc.numero_odc}`);
  };

  // Filtrado de historial
  const historialFiltrado = useMemo(() => {
    if (!busquedaHistorial.trim()) return historialRetenciones;
    const q = busquedaHistorial.toLowerCase();
    return historialRetenciones.filter(item =>
      (item.numero_comprobante || '').toLowerCase().includes(q) ||
      (item.proveedor_nombre || '').toLowerCase().includes(q) ||
      (item.numero_factura || '').toLowerCase().includes(q) ||
      (item.proveedor_rif || '').toLowerCase().includes(q)
    );
  }, [historialRetenciones, busquedaHistorial]);

  return (
    <div className="retenciones-container">
      {/* 1. Header Banner Corporativo */}
      <div className="retenciones-header-card">
        <div className="retenciones-header-title">
          <div className="retenciones-header-icon">
            <Calculator />
          </div>
          <div className="retenciones-header-text">
            <h2>Liquidación Fiscal: Retenciones (IVA e ISLR) y Tipos de Cambio</h2>
            <p>Módulo Financiero y Fiscal para Cuentas por Pagar • Total Clean C.A.</p>
          </div>
        </div>

        <div className="retenciones-header-badges">
          <span className="badge-pastel badge-pastel-blue">
            <Layers size={13} />
            SITC Fiscal v2.6
          </span>
          <button
            type="button"
            onClick={refrescarTasasBCV}
            disabled={cargandoTasas}
            className="retenciones-pill-btn"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#ffffff', borderColor: 'rgba(255,255,255,0.25)' }}
            title="Refrescar tasas de cambio oficiales desde el BCV"
          >
            <RefreshCw size={13} className={cargandoTasas ? 'animate-spin' : ''} />
            {cargandoTasas ? 'Actualizando...' : 'Refrescar BCV'}
          </button>
        </div>
      </div>

      {/* 2. Grid Principal: Entrada de Datos (Izquierda) + Live Preview (Derecha) */}
      <div className="retenciones-main-grid">
        {/* COLUMNA IZQUIERDA: FORMULARIO CONFIGURABLE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* SECCIÓN A: SELECTOR DE TASA DE CAMBIO */}
          <div className="retenciones-card">
            <div className="retenciones-section-title">
              <DollarSign size={16} color="#0284c7" />
              <span>A. Selector de Tipo de Cambio & Valor de Tasa</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label className="retenciones-label">
                <span>Régimen Cambiario de Liquidación:</span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Origen: {tasasBCV.origen === 'bcv_api' ? '🟢 BCV Oficial en vivo' : '🟡 Referencia / Caché'}
                </span>
              </label>

              {/* Botones Pill de Selector de Tasa */}
              <div className="retenciones-pill-group">
                <button
                  type="button"
                  onClick={() => setTipoTasa('BCV_USD')}
                  className={`retenciones-pill-btn ${tipoTasa === 'BCV_USD' ? 'active-blue' : ''}`}
                >
                  <DollarSign size={14} />
                  [ Tasa BCV $ ]
                  <span style={{ opacity: 0.85, fontSize: '11px', marginLeft: '4px' }}>
                    ({tasasBCV.BCV_USD?.toFixed(4)})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTipoTasa('BCV_EUR')}
                  className={`retenciones-pill-btn ${tipoTasa === 'BCV_EUR' ? 'active-green' : ''}`}
                >
                  <Euro size={14} />
                  [ Tasa BCV Euro ]
                  <span style={{ opacity: 0.85, fontSize: '11px', marginLeft: '4px' }}>
                    ({tasasBCV.BCV_EUR?.toFixed(4)})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTipoTasa('PREFERENCIAL')}
                  className={`retenciones-pill-btn ${tipoTasa === 'PREFERENCIAL' ? 'active-amber' : ''}`}
                >
                  <Percent size={14} />
                  [ Tasa Preferencial ]
                </button>
              </div>

              {/* Input Numérico con 4 decimales */}
              <div className="retenciones-form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="retenciones-label">
                    <span>Valor de Tasa Activa (VES por divisa):</span>
                  </label>
                  {tipoTasa !== 'PREFERENCIAL' && (
                    <button
                      type="button"
                      onClick={() => setPermiteEdicionManualTasa(!permiteEdicionManualTasa)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#0284c7',
                        fontSize: '11px',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        padding: 0
                      }}
                    >
                      {permiteEdicionManualTasa ? '🔒 Bloquear valor oficial' : '✏️ Ajustar manualmente'}
                    </button>
                  )}
                </div>

                <div className="retenciones-input-wrapper">
                  <span className="retenciones-input-prefix">Bs.</span>
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    value={tasaManual}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setTasaManual(isNaN(val) ? 0 : val);
                    }}
                    disabled={!permiteEdicionManualTasa && tipoTasa !== 'PREFERENCIAL'}
                    className="retenciones-input with-prefix with-suffix bold-num"
                    placeholder="Ej. 46.5230"
                  />
                  <span className="retenciones-input-suffix">/ {simboloDivisa}</span>
                </div>
                <small style={{ color: '#64748b', fontSize: '11px' }}>
                  {tipoTasa === 'PREFERENCIAL'
                    ? '💡 Modo preferencial activado: Edición manual directa con hasta 4 decimales.'
                    : permiteEdicionManualTasa
                    ? '⚠️ Tasa en modo ajuste manual. Verifique contra la fecha de emisión del comprobante.'
                    : '🔒 Tasa sincronizada automáticamente con el Banco Central de Venezuela.'}
                </small>
              </div>
            </div>
          </div>

          {/* SECCIÓN B: IDENTIFICACIÓN DEL PROVEEDOR Y DOCUMENTO */}
          <div className="retenciones-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="retenciones-section-title" style={{ border: 'none', padding: 0 }}>
                <Building2 size={16} color="#0f172a" />
                <span>Datos del Proveedor & Comprobante</span>
              </div>
              
              {/* Botón para precargar de ODC */}
              {odcsList && odcsList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setModoSelectorDoc(!modoSelectorDoc)}
                  className="retenciones-pill-btn"
                  style={{ fontSize: '11px', padding: '4px 10px' }}
                >
                  <Search size={12} />
                  {modoSelectorDoc ? 'Cerrar Selector' : 'Cargar desde ODC / Factura'}
                </button>
              )}
            </div>

            {/* Selector rápido desplegable si el usuario busca una ODC */}
            {modoSelectorDoc && (
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <label className="retenciones-label" style={{ marginBottom: '6px' }}>
                  Seleccione una Orden de Compra o Factura pendiente de CxP:
                </label>
                <select
                  className="retenciones-input"
                  onChange={(e) => {
                    const selId = e.target.value;
                    const encontrada = odcsList.find(o => String(o.id) === String(selId));
                    if (encontrada) handleSeleccionarOdc(encontrada);
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>-- Seleccionar documento existente --</option>
                  {odcsList.map(item => (
                    <option key={item.id} value={item.id}>
                      ODC: {item.numero_odc} | {item.proveedor_nombre} | $ {Number(item.total_general || item.subtotal || 0).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px' }}>
              <div className="retenciones-form-group">
                <label className="retenciones-label">Razón Social del Proveedor:</label>
                <input
                  type="text"
                  list="proveedores-datalist"
                  value={proveedorNombre}
                  onChange={(e) => {
                    const val = e.target.value;
                    setProveedorNombre(val);
                    if (proveedoresList && proveedoresList.length > 0) {
                      const matched = proveedoresList.find(p => (p.razon_social || '').toLowerCase() === val.toLowerCase());
                      if (matched) {
                        setProveedorSeleccionado(matched);
                        if (matched.rif) setProveedorRif(matched.rif);
                      }
                    }
                  }}
                  placeholder="Ej. Suministros Industriales C.A."
                  className="retenciones-input"
                />
                <datalist id="proveedores-datalist">
                  {(proveedoresList || []).map(p => (
                    <option key={p.id} value={p.razon_social}>
                      {p.rif || ''}
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="retenciones-form-group">
                <label className="retenciones-label">R.I.F. / Identificación Fiscal:</label>
                <input
                  type="text"
                  value={proveedorRif}
                  onChange={(e) => setProveedorRif(e.target.value.toUpperCase())}
                  placeholder="Ej. J-12345678-9"
                  className="retenciones-input"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div className="retenciones-form-group">
                <label className="retenciones-label">N° Factura:</label>
                <input
                  type="text"
                  value={numeroFactura}
                  onChange={(e) => setNumeroFactura(e.target.value)}
                  placeholder="Ej. 0001248"
                  className="retenciones-input bold-num"
                />
              </div>

              <div className="retenciones-form-group">
                <label className="retenciones-label">N° Control Fiscal:</label>
                <input
                  type="text"
                  value={numeroControl}
                  onChange={(e) => setNumeroControl(e.target.value)}
                  placeholder="Ej. 00-004589"
                  className="retenciones-input"
                />
              </div>

              <div className="retenciones-form-group">
                <label className="retenciones-label">Fecha de Factura:</label>
                <input
                  type="date"
                  value={fechaFactura}
                  onChange={(e) => setFechaFactura(e.target.value)}
                  className="retenciones-input"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN C: DESGLOSE DE BASES IMPONIBLES Y ALÍCUOTA IVA */}
          <div className="retenciones-card">
            <div className="retenciones-section-title">
              <FileText size={16} color="#059669" />
              <span>B. Desglose de Montos, Exento y Base Imponible</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {/* Monto Exento */}
              <div className="retenciones-form-group">
                <label className="retenciones-label">
                  <span>Monto Exento:</span>
                  <span className="badge-pastel badge-pastel-slate">0% IVA</span>
                </label>
                <div className="retenciones-input-wrapper">
                  <span className="retenciones-input-prefix">{simboloDivisa}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={montoExento || ''}
                    onChange={(e) => setMontoExento(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="retenciones-input with-prefix bold-num"
                  />
                </div>
              </div>

              {/* Base Imponible */}
              <div className="retenciones-form-group">
                <label className="retenciones-label">
                  <span>Base Imponible Gravable:</span>
                  <span className="badge-pastel badge-pastel-blue">Sujeta a IVA e ISLR</span>
                </label>
                <div className="retenciones-input-wrapper">
                  <span className="retenciones-input-prefix">{simboloDivisa}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={baseImponible || ''}
                    onChange={(e) => setBaseImponible(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="retenciones-input with-prefix bold-num"
                  />
                </div>
              </div>
            </div>

            {/* Alícuota IVA Configurable */}
            <div className="retenciones-form-group" style={{ marginTop: '4px' }}>
              <label className="retenciones-label">
                <span>Alícuota IVA Aplicable:</span>
                <span style={{ fontWeight: '800', color: '#0f172a' }}>
                  IVA Calculado: {simboloDivisa} {liquidacion.monto_iva.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </span>
              </label>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div className="retenciones-pill-group">
                  <button
                    type="button"
                    onClick={() => setAlicuotaIva(16.00)}
                    className={`retenciones-pill-btn ${alicuotaIva === 16.00 ? 'active' : ''}`}
                  >
                    16% (General)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlicuotaIva(8.00)}
                    className={`retenciones-pill-btn ${alicuotaIva === 8.00 ? 'active' : ''}`}
                  >
                    8% (Reducida)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlicuotaIva(0.00)}
                    className={`retenciones-pill-btn ${alicuotaIva === 0.00 ? 'active' : ''}`}
                  >
                    0% (Exento)
                  </button>
                </div>

                <div className="retenciones-input-wrapper" style={{ width: '130px', marginLeft: 'auto' }}>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={alicuotaIva}
                    onChange={(e) => setAlicuotaIva(parseFloat(e.target.value) || 0)}
                    className="retenciones-input with-suffix"
                    title="Alícuota personalizada"
                  />
                  <span className="retenciones-input-suffix">%</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN D: RETENCIÓN DE IVA */}
          <div className="retenciones-card">
            <div className="retenciones-section-title">
              <TrendingDown size={16} color="#dc2626" />
              <span>C. Sección de Retención de IVA</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label className="retenciones-label">
                <span>Porcentaje de Retención IVA al Proveedor:</span>
                <span className="badge-pastel badge-pastel-amber">
                  Retenido: {simboloDivisa} {liquidacion.monto_retencion_iva.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </span>
              </label>

              <div className="retenciones-pill-group">
                <button
                  type="button"
                  onClick={() => setPorcentajeRetIva(75.00)}
                  className={`retenciones-pill-btn ${porcentajeRetIva === 75.00 ? 'active-amber' : ''}`}
                >
                  [ 75% ] (Estándar Ordinario)
                </button>

                <button
                  type="button"
                  onClick={() => setPorcentajeRetIva(100.00)}
                  className={`retenciones-pill-btn ${porcentajeRetIva === 100.00 ? 'active-red' : ''}`}
                >
                  [ 100% ] (Especial / Proveedor Sujeto)
                </button>

                <button
                  type="button"
                  onClick={() => setPorcentajeRetIva(0.00)}
                  className={`retenciones-pill-btn ${porcentajeRetIva === 0.00 ? 'active' : ''}`}
                >
                  [ 0% / Exento ]
                </button>
              </div>

              <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748b', fontSize: '11.5px' }}>
                  Fórmula: IVA (${liquidacion.monto_iva.toFixed(2)}) × ({porcentajeRetIva}%)
                </span>
                <span style={{ fontWeight: '900', color: '#dc2626', fontSize: '13px' }}>
                  - {simboloDivisa} {liquidacion.monto_retencion_iva.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* SECCIÓN E: RETENCIÓN DE ISLR (TABULADOR OFICIAL DECRETO 1.808) */}
          <div className="retenciones-card">
            <div className="retenciones-section-title">
              <TrendingDown size={16} color="#7e22ce" />
              <span>D. Retención de I.S.L.R. (Tabulador Oficial Decreto 1.808 - G.O. 43.140)</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* 1. Condición Jurídica del Sujeto Retenido */}
              <div>
                <label className="retenciones-label" style={{ marginBottom: '6px' }}>
                  <span>Condición Jurídica del Sujeto Retenido (Proveedor):</span>
                  {proveedorRif && (
                    <span style={{ fontSize: '11px', color: '#6b21a8', fontWeight: '800' }}>
                      Auto-detectado por RIF: {proveedorRif}
                    </span>
                  )}
                </label>
                <div className="retenciones-pill-group">
                  {TIPOS_PERSONA_ISLR.map((tp) => (
                    <button
                      key={tp.id}
                      type="button"
                      onClick={() => setTipoPersona(tp.id)}
                      className={`retenciones-pill-btn ${tipoPersona === tp.id ? 'active-purple' : ''}`}
                      title={tp.label}
                    >
                      {tp.short}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Conceptos Rápidos y Frecuentes */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="retenciones-label" style={{ margin: 0 }}>
                    <span>Concepto de Retención Aplicable:</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setMostrarModalTabulador(true)}
                    className="retenciones-pill-btn active-slate"
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                  >
                    <BookOpen size={12} />
                    Ver Tabulador Completo (34 Conceptos)
                  </button>
                </div>

                <div className="retenciones-pill-group">
                  {conceptosFrecuentes.map((cf) => {
                    const tar = cf.tarifas?.[tipoPersona] || cf.tarifas?.PJD || {};
                    const isSelected = conceptoIslrId === cf.id;
                    return (
                      <button
                        key={cf.id}
                        type="button"
                        onClick={() => {
                          setConceptoIslrId(cf.id);
                          if (cf.id !== 'personalizado') {
                            setPorcentajeRetIslrCustom(tar.porcentaje || 0);
                            setBaseRetIslrCustom(tar.base || 100);
                          }
                        }}
                        className={`retenciones-pill-btn ${isSelected ? 'active-purple' : ''}`}
                      >
                        <span>{cf.nombreCorto || cf.numeral}</span>
                        <span style={{ opacity: 0.85, fontSize: '10.5px' }}>
                          [{tar.porcentaje !== undefined ? `${tar.porcentaje}%` : 'Var'}]
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Tarjeta Informativa del Concepto Activo */}
              <div className="tabulador-active-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="badge-pastel badge-pastel-purple" style={{ fontWeight: '900' }}>
                        Numeral {liquidacion.numeral_decreto || '9.11'}
                      </span>
                      <span className="tabulador-code-pill" title="Código de Concepto SENIAT">
                        CÓD. SENIAT: {liquidacion.codigo_concepto_seniat || '-'}
                      </span>
                      <span style={{ fontSize: '11px', color: '#475569', fontWeight: '700' }}>
                        Base Gravable: {liquidacion.porcentaje_base_islr}%
                      </span>
                      <span style={{ fontSize: '11px', color: '#7e22ce', fontWeight: '900' }}>
                        Tarifa: {liquidacion.porcentaje_retencion_islr}%
                      </span>
                    </div>
                    <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '12px', marginTop: '4px' }}>
                      {liquidacion.concepto_islr_nombre}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#6b21a8', fontWeight: '800' }}>
                      Monto Retenido ISLR
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: '950', color: '#7e22ce' }}>
                      - {simboloDivisa} {Number(liquidacion?.monto_retencion_islr || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#0284c7', fontWeight: '800' }}>
                      Bs. {Number(liquidacion?.monto_retencion_islr_ves || liquidacion?.equivalente_ves_ret_islr || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* Explicación de Sustraendo o Exención para PNR */}
                {tipoPersona === 'PNR' && (
                  <div style={{ background: '#ffffff', borderRadius: '8px', padding: '8px 10px', border: '1px solid #e9d5ff', fontSize: '11px', color: '#4c1d95', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Info size={14} color="#7e22ce" style={{ flexShrink: 0 }} />
                    {liquidacion?.aplica_sustraendo ? (
                      <span>
                        <strong>Aplica Sustraendo Legal Art. 9:</strong> Pago en Bs ({Number(liquidacion?.monto_base_ves || ((liquidacion?.base_imponible || 0) * (liquidacion?.valor_tasa || 1))).toLocaleString('de-DE', { minimumFractionDigits: 2 })}) &gt; Bs. 3.583,34 (83,3334 UT). Sustraendo descontado: <strong>Bs. {Number(liquidacion?.sustraendo_islr_bs || 0).toFixed(2)}</strong> ({simboloDivisa} {Number(liquidacion?.sustraendo_islr_usd || 0).toFixed(2)}).
                      </span>
                    ) : (
                      <span>
                        <strong>Exento por Umbral Mínimo:</strong> La base en Bolívares (Bs. {Number(liquidacion?.monto_base_ves || ((liquidacion?.base_imponible || 0) * (liquidacion?.valor_tasa || 1))).toLocaleString('de-DE', { minimumFractionDigits: 2 })}) no supera el mínimo de Bs. 3.583,34 (83,3334 UT × Bs. 43,00). Retención: Bs. 0,00.
                      </span>
                    )}
                  </div>
                )}

                {/* Si es Personalizado, mostrar inputs para tarifa y base */}
                {conceptoIslrId === 'personalizado' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px', background: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <div className="retenciones-form-group">
                      <label className="retenciones-label">Porcentaje Tarifa ISLR:</label>
                      <div className="retenciones-input-wrapper">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={porcentajeRetIslrCustom}
                          onChange={(e) => setPorcentajeRetIslrCustom(parseFloat(e.target.value) || 0)}
                          className="retenciones-input with-suffix bold-num"
                        />
                        <span className="retenciones-input-suffix">%</span>
                      </div>
                    </div>
                    <div className="retenciones-form-group">
                      <label className="retenciones-label">Base Imponible Gravable:</label>
                      <div className="retenciones-input-wrapper">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          value={baseRetIslrCustom}
                          onChange={(e) => setBaseRetIslrCustom(parseFloat(e.target.value) || 0)}
                          className="retenciones-input with-suffix bold-num"
                        />
                        <span className="retenciones-input-suffix">%</span>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#6b21a8', borderTop: '1px dashed #d8b4fe', paddingTop: '6px' }}>
                  <span>
                    Fórmula Oficial: Base (${Number(liquidacion?.base_imponible || 0).toFixed(2)}) × {liquidacion?.porcentaje_base_islr || 100}% × {liquidacion?.porcentaje_retencion_islr || 0}% {liquidacion?.aplica_sustraendo ? `- Sustraendo ($${Number(liquidacion?.sustraendo_islr_usd || 0).toFixed(2)})` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMostrarModalTabulador(true)}
                    style={{ background: 'transparent', border: 'none', color: '#7e22ce', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>Cambiar concepto</span>
                    <ExternalLink size={11} />
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* COLUMNA DERECHA: CAJA DE TOTALES & LIVE PREVIEW EXECUTIVE */}
        <div className="retenciones-preview-card">
          <div className="retenciones-preview-header">
            <h3>
              <Calculator size={18} />
              <span>Resumen de Liquidación & Pagos</span>
            </h3>
            <span className="badge-pastel badge-pastel-green">
              Live Preview
            </span>
          </div>

          <div className="retenciones-preview-body">
            {/* HERO DUAL INDICATOR: MONTO NETO DIVISAS & BOLÍVARES VES */}
            <div className="retenciones-dual-hero">
              <div className="retenciones-hero-row">
                <span className="retenciones-hero-label">Neto a Transferir (Divisas)</span>
                <span className="badge-pastel badge-pastel-blue">
                  Tasa: Bs. {Number(tasaManual).toFixed(4)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: '900', color: '#64748b' }}>{simboloDivisa}</span>
                <span className="retenciones-hero-value-main">
                  {liquidacion.monto_neto_pagar.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />

              <div className="retenciones-hero-row">
                <span className="retenciones-hero-label" style={{ color: '#0284c7' }}>Equivalente en Bolívares (VES)</span>
                <span className="badge-pastel badge-pastel-slate">
                  BCV / Ref
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '1rem', fontWeight: '900', color: '#0284c7' }}>Bs.</span>
                <span className="retenciones-hero-value-ves">
                  {liquidacion.equivalente_ves_neto.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* TABLA DE DESGLOSE FINANCIERO PASO A PASO */}
            <div className="retenciones-breakdown-table">
              <div className="retenciones-breakdown-row">
                <span style={{ color: '#64748b' }}>Monto Exento:</span>
                <span style={{ fontWeight: '700' }}>
                  {simboloDivisa} {liquidacion.monto_exento.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="retenciones-breakdown-row">
                <span style={{ color: '#64748b' }}>Base Imponible:</span>
                <span style={{ fontWeight: '700' }}>
                  {simboloDivisa} {liquidacion.base_imponible.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="retenciones-breakdown-row">
                <span style={{ color: '#64748b' }}>IVA Causado ({liquidacion.alicuota_iva}%):</span>
                <span style={{ fontWeight: '700', color: '#0284c7' }}>
                  + {simboloDivisa} {liquidacion.monto_iva.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="retenciones-breakdown-row total-row">
                <span>Total Bruto Factura:</span>
                <span style={{ fontSize: '14px', color: '#0f172a' }}>
                  {simboloDivisa} {liquidacion.total_factura.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="retenciones-breakdown-row retencion-row" style={{ marginTop: '4px' }}>
                <span>(-) Retención IVA ({liquidacion.porcentaje_retencion_iva}%):</span>
                <span>
                  - {simboloDivisa} {liquidacion.monto_retencion_iva.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="retenciones-breakdown-row retencion-row">
                <span>(-) Retención ISLR ({liquidacion.porcentaje_retencion_islr}% - Cód. {liquidacion.codigo_concepto_seniat || '-'}):</span>
                <span>
                  - {simboloDivisa} {liquidacion.monto_retencion_islr.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {liquidacion?.aplica_sustraendo && (
                <div className="retenciones-breakdown-row" style={{ fontSize: '10.5px', color: '#7e22ce', padding: '2px 0' }}>
                  <span>↳ Sustraendo Art. 9 descontado:</span>
                  <span>- Bs. {Number(liquidacion?.sustraendo_islr_bs || 0).toFixed(2)} (-{simboloDivisa} {Number(liquidacion?.sustraendo_islr_usd || 0).toFixed(2)})</span>
                </div>
              )}

              <div className="retenciones-breakdown-row" style={{ color: '#dc2626', fontWeight: '800', background: '#fef2f2', padding: '6px 8px', borderRadius: '8px' }}>
                <span>Total Retenciones Fiscales:</span>
                <span>
                  - {simboloDivisa} {liquidacion.total_retenciones.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* CAJA DE TOTAL NETO DESTACADO */}
            <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '12px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#166534', letterSpacing: '0.04em' }}>
                  Total Neto a Pagar al Proveedor:
                </span>
                <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px' }}>
                  (Factura Bruta menos Retenciones)
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '1.45rem', fontWeight: '950', color: '#166534' }}>
                  {simboloDivisa} {liquidacion.monto_neto_pagar.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={handleGuardarLiquidacion}
                disabled={guardando}
                className="retenciones-action-btn retenciones-btn-success"
                style={{ width: '100%', fontSize: '13px', padding: '12px' }}
              >
                <Save size={16} />
                {guardando ? 'Guardando Liquidación...' : '💾 Registrar Liquidación & Comprobante'}
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setComprobanteModal({
                    numero_comprobante: `RET-${new Date().getFullYear()}-VISTA`,
                    proveedor_nombre: proveedorNombre || 'PROVEEDOR POR DEFINIR',
                    proveedor_rif: proveedorRif || 'J-00000000-0',
                    numero_factura: numeroFactura || 'S/N',
                    numero_control: numeroControl || 'S/C',
                    fecha_emision: fechaFactura,
                    ...liquidacion
                  })}
                  className="retenciones-action-btn retenciones-btn-secondary"
                  title="Ver comprobante oficial imprimible para el proveedor"
                >
                  <Printer size={14} />
                  Vista Comprobante
                </button>

                <button
                  type="button"
                  onClick={handleLimpiarFormulario}
                  className="retenciones-action-btn retenciones-btn-secondary"
                  title="Limpiar campos para una nueva liquidación"
                >
                  <Trash2 size={14} />
                  Limpiar Formulario
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 3. HISTORIAL DE LIQUIDACIONES Y COMPROBANTES FISCALES */}
      <div className="retenciones-card" style={{ marginTop: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div className="retenciones-section-title" style={{ border: 'none', padding: 0 }}>
            <FileText size={16} color="#0f172a" />
            <span>Historial de Comprobantes de Retención Emitidos</span>
            <span className="badge-pastel badge-pastel-slate">
              {historialFiltrado.length} registrados
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div className="retenciones-input-wrapper" style={{ width: '260px' }}>
              <input
                type="text"
                placeholder="Buscar por proveedor, factura o RIF..."
                value={busquedaHistorial}
                onChange={(e) => setBusquedaHistorial(e.target.value)}
                className="retenciones-input"
              />
            </div>
            <button
              type="button"
              onClick={cargarHistorial}
              disabled={cargandoHistorial}
              className="retenciones-pill-btn"
            >
              <RefreshCw size={12} className={cargandoHistorial ? 'animate-spin' : ''} />
              Refrescar
            </button>
          </div>
        </div>

        <div className="retenciones-table-wrapper">
          <table className="retenciones-table">
            <thead>
              <tr>
                <th>Comprobante</th>
                <th>Fecha</th>
                <th>Proveedor / RIF</th>
                <th>Factura #</th>
                <th>Tasa BCV</th>
                <th>Total Factura</th>
                <th>Ret. IVA</th>
                <th>Ret. ISLR</th>
                <th>Neto a Pagar</th>
                <th>Equiv. VES</th>
                <th>Estatus</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {historialFiltrado.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                    {cargandoHistorial ? 'Cargando comprobantes fiscales...' : 'No hay liquidaciones fiscales registradas todavía.'}
                  </td>
                </tr>
              ) : (
                historialFiltrado.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong style={{ color: '#0f172a' }}>{item.numero_comprobante || 'RET-S/N'}</strong>
                    </td>
                    <td>{item.fecha_emision || (item.fecha_liquidacion ? item.fecha_liquidacion.split('T')[0] : '-')}</td>
                    <td>
                      <div>
                        <div style={{ fontWeight: '700' }}>{item.proveedor_nombre}</div>
                        <div style={{ fontSize: '10.5px', color: '#64748b' }}>{item.proveedor_rif || '-'}</div>
                      </div>
                    </td>
                    <td>
                      <span className="badge-pastel badge-pastel-slate">
                        #{item.numero_factura}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: '700' }}>
                        Bs. {Number(item.valor_tasa || 1).toFixed(4)}
                      </span>
                    </td>
                    <td style={{ fontWeight: '800' }}>
                      $ {Number(item.total_factura || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ color: '#dc2626', fontWeight: '700' }}>
                      $ {Number(item.monto_retencion_iva || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ color: '#7e22ce', fontWeight: '700' }}>
                      <div>$ {Number(item.monto_retencion_islr || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</div>
                      <div style={{ fontSize: '10px', color: '#9333ea', fontWeight: '600' }}>
                        {item.numeral_decreto ? `Num. ${item.numeral_decreto}` : ''} {item.codigo_concepto_seniat ? `[${item.codigo_concepto_seniat}]` : ''}
                      </div>
                    </td>
                    <td style={{ color: '#166534', fontWeight: '900', fontSize: '12.5px' }}>
                      $ {Number(item.monto_neto_pagar || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ color: '#0284c7', fontWeight: '800' }}>
                      Bs. {Number(item.equivalente_ves_neto || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span className={`badge-pastel ${item.estatus === 'ANULADO' ? 'badge-pastel-red' : 'badge-pastel-green'}`}>
                        {item.estatus || 'LIQUIDADO'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setComprobanteModal(item)}
                          className="retenciones-pill-btn"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          title="Imprimir / Ver Comprobante"
                        >
                          <Printer size={12} />
                        </button>
                        {item.estatus !== 'ANULADO' && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm(`¿Desea anular el comprobante ${item.numero_comprobante}?`)) {
                                await anularRetencionFiscal(item.id);
                                toast.success('Comprobante anulado');
                                cargarHistorial();
                              }
                            }}
                            className="retenciones-pill-btn"
                            style={{ padding: '4px 8px', fontSize: '11px', color: '#dc2626' }}
                            title="Anular comprobante"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. MODAL DEL TABULADOR OFICIAL DE RETENCIONES ISLR (DECRETO 1.808) */}
      {mostrarModalTabulador && (
        <div className="tabulador-modal-backdrop" onClick={() => setMostrarModalTabulador(false)}>
          <div className="tabulador-modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Header del Modal */}
            <div className="tabulador-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BookOpen size={20} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900' }}>
                    Tabulador Oficial de Retenciones del I.S.L.R.
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', opacity: 0.85 }}>
                    Decreto 1.808 Art. 9 - Gaceta Oficial N° 43.140 | Unidad Tributaria: Bs. {unidadTributaria.toFixed(2)} | Min. Sustraendo: Bs. {calcularMontoMinimoSustraendoBs(unidadTributaria).toFixed(2)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMostrarModalTabulador(false)}
                className="retenciones-pill-btn"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: 'none' }}
              >
                <X size={16} /> Cerrar
              </button>
            </div>

            {/* Body del Modal */}
            <div className="tabulador-modal-body">
              {/* Barra de Filtros y Búsqueda */}
              <div className="tabulador-search-bar">
                <div className="retenciones-input-wrapper" style={{ flex: 1, minWidth: '260px' }}>
                  <Search size={14} className="retenciones-input-prefix" color="#64748b" />
                  <input
                    type="text"
                    placeholder="Buscar por concepto, numeral (ej: 9.11, 9.15, 9.1.b) o código SENIAT (ej: 055)..."
                    value={busquedaTabulador}
                    onChange={(e) => setBusquedaTabulador(e.target.value)}
                    className="retenciones-input with-prefix"
                    autoFocus
                  />
                  {busquedaTabulador && (
                    <button
                      type="button"
                      onClick={() => setBusquedaTabulador('')}
                      style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>Contribuyente:</span>
                  <div className="retenciones-pill-group">
                    {TIPOS_PERSONA_ISLR.map((tp) => (
                      <button
                        key={tp.id}
                        type="button"
                        onClick={() => setTipoPersona(tp.id)}
                        className={`retenciones-pill-btn ${tipoPersona === tp.id ? 'active-purple' : ''}`}
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                      >
                        {tp.id}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Categorías Chip */}
              <div className="tabulador-filter-chips">
                {categoriasDisponibles.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoriaTabuladorFiltro(cat)}
                    className={`tabulador-chip ${categoriaTabuladorFiltro === cat ? 'active' : ''}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Tabla del Tabulador */}
              <div className="tabulador-table-wrapper">
                <table className="tabulador-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>Numeral</th>
                      <th>Concepto del Pago (Decreto 1.808)</th>
                      <th style={{ textAlign: 'center', width: '140px', background: tipoPersona === 'PNR' ? '#581c87' : undefined }}>
                        Pers. Natural Residente (PNR)
                      </th>
                      <th style={{ textAlign: 'center', width: '140px', background: tipoPersona === 'PJD' ? '#581c87' : undefined }}>
                        Pers. Jurídica Domiciliada (PJD)
                      </th>
                      <th style={{ textAlign: 'center', width: '120px', background: (tipoPersona === 'PJND' || tipoPersona === 'PNNR') ? '#581c87' : undefined }}>
                        No Domic. / No Res.
                      </th>
                      <th style={{ width: '100px', textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conceptosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                          No se encontraron conceptos para &quot;{busquedaTabulador}&quot; en la categoría seleccionada.
                        </td>
                      </tr>
                    ) : (
                      conceptosFiltrados.map((item) => {
                        const isSelected = conceptoIslrId === item.id;
                        const tPnr = item.tarifas?.PNR || {};
                        const tPjd = item.tarifas?.PJD || {};
                        const tTarifaActiva = item.tarifas?.[tipoPersona] || tPjd;

                        return (
                          <tr
                            key={item.id}
                            className={isSelected ? 'selected-row' : ''}
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                              setConceptoIslrId(item.id);
                              if (item.id !== 'personalizado') {
                                setPorcentajeRetIslrCustom(tTarifaActiva.porcentaje || 0);
                                setBaseRetIslrCustom(tTarifaActiva.base || 100);
                              }
                              setMostrarModalTabulador(false);
                              toast.success(`Concepto seleccionado: Numeral ${item.numeral || ''} - ${item.nombreCorto || item.nombre}`);
                            }}
                          >
                            <td style={{ fontWeight: '900', color: '#0f172a' }}>
                              <span className="badge-pastel badge-pastel-purple">
                                {item.numeral || 'ESP'}
                              </span>
                            </td>
                            <td>
                              <div style={{ fontWeight: '800', color: '#0f172a' }}>{item.nombre}</div>
                              <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                                Categoría: {item.categoria} {item.frecuente ? '• ★ Frecuente' : ''}
                              </div>
                            </td>
                            {/* Columna PNR */}
                            <td style={{ textAlign: 'center', background: tipoPersona === 'PNR' ? '#faf5ff' : undefined }}>
                              {tPnr.codigo ? (
                                <div>
                                  <span className="tabulador-code-pill">{tPnr.codigo}</span>
                                  <div style={{ fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                                    {tPnr.porcentaje}% <span style={{ fontSize: '10px', color: '#64748b' }}>({tPnr.base}% base)</span>
                                  </div>
                                  {tPnr.sustraendoFactor ? (
                                    <div style={{ fontSize: '9.5px', color: '#7e22ce' }}>
                                      Sust: Bs. {(tPnr.sustraendoFactor * unidadTributaria * (tPnr.porcentaje / 100)).toFixed(2)}
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>-</span>
                              )}
                            </td>
                            {/* Columna PJD */}
                            <td style={{ textAlign: 'center', background: tipoPersona === 'PJD' ? '#faf5ff' : undefined }}>
                              {tPjd.codigo ? (
                                <div>
                                  <span className="tabulador-code-pill">{tPjd.codigo}</span>
                                  <div style={{ fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                                    {tPjd.porcentaje}% <span style={{ fontSize: '10px', color: '#64748b' }}>({tPjd.base}% base)</span>
                                  </div>
                                </div>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>-</span>
                              )}
                            </td>
                            {/* Columna No Domiciliada / No Residente */}
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '10.5px' }}>
                                {item.tarifas?.PJND?.porcentaje !== undefined ? `PJND: ${item.tarifas.PJND.porcentaje}%` : ''}
                                {item.tarifas?.PNNR?.porcentaje !== undefined ? ` / PNNR: ${item.tarifas.PNNR.porcentaje}%` : ''}
                              </div>
                            </td>
                            {/* Botón Seleccionar */}
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className={`retenciones-pill-btn ${isSelected ? 'active-purple' : ''}`}
                                style={{ padding: '5px 10px', fontSize: '11px', width: '100%', justifyContent: 'center' }}
                              >
                                {isSelected ? <><Check size={12} /> Activo</> : 'Aplicar'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer con Resumen / Información Legal */}
              <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#475569' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Info size={14} color="#7e22ce" />
                  <span>
                    <strong>Fundamento Legal:</strong> Decreto 1.808 del 23/04/1997 (Reglamento de Retenciones ISLR) y Providencias SENIAT.
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span>Unidad Tributaria (U.T.):</span>
                  <div className="retenciones-input-wrapper" style={{ width: '80px' }}>
                    <input
                      type="number"
                      step="0.5"
                      value={unidadTributaria}
                      onChange={(e) => setUnidadTributaria(parseFloat(e.target.value) || VALOR_UT_DEFAULT)}
                      className="retenciones-input"
                      style={{ padding: '3px 8px', fontSize: '11.5px', fontWeight: '800' }}
                    />
                  </div>
                  <span>Bs.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL DE COMPROBANTE OFICIAL IMPRIMIBLE */}
      {comprobanteModal && (
        <div className="comprobante-modal-backdrop" onClick={() => setComprobanteModal(null)}>
          <div className="comprobante-modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }} className="no-print">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', fontSize: '13px' }}>
                <FileText size={18} color="#0f172a" />
                <span>Comprobante Oficial de Retención de IVA e ISLR</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="retenciones-action-btn retenciones-btn-primary"
                  style={{ padding: '6px 14px' }}
                >
                  <Printer size={14} /> Imprimir / PDF
                </button>
                <button
                  type="button"
                  onClick={() => setComprobanteModal(null)}
                  className="retenciones-pill-btn"
                >
                  ✕ Cerrar
                </button>
              </div>
            </div>

            {/* ÁREA IMPRIMIBLE SENIAT / FISCAL */}
            <div className="comprobante-print-area">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '16px', marginBottom: '18px' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '950', color: '#0f172a' }}>TOTAL CLEAN C.A.</h1>
                  <p style={{ margin: '3px 0 0 0', fontSize: '11px', color: '#475569' }}>R.I.F.: J-40899123-5</p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#475569' }}>Agente de Retención de Impuestos Nacionales</p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#475569' }}>Maracaibo, Edo. Zulia - Venezuela</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ background: '#0f172a', color: '#ffffff', padding: '6px 14px', borderRadius: '6px', fontWeight: '900', fontSize: '12px' }}>
                    COMPROBANTE DE RETENCIÓN
                  </div>
                  <div style={{ marginTop: '6px', fontWeight: '900', fontSize: '14px', color: '#0f172a' }}>
                    {comprobanteModal.numero_comprobante || 'RET-0000'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Fecha: {comprobanteModal.fecha_emision || new Date().toISOString().split('T')[0]}
                  </div>
                </div>
              </div>

              {/* Datos del Sujeto Retenido (Proveedor) */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '16px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Proveedor (Sujeto Retenido):</div>
                  <div style={{ fontSize: '13px', fontWeight: '900', color: '#0f172a', marginTop: '2px' }}>{comprobanteModal.proveedor_nombre}</div>
                  <div style={{ fontSize: '11px', color: '#475569' }}>RIF: {comprobanteModal.proveedor_rif || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Datos de la Factura:</div>
                  <div style={{ fontSize: '11px', color: '#0f172a', marginTop: '2px' }}><strong>Factura N°:</strong> {comprobanteModal.numero_factura}</div>
                  <div style={{ fontSize: '11px', color: '#0f172a' }}><strong>N° Control:</strong> {comprobanteModal.numero_control || 'N/A'}</div>
                  <div style={{ fontSize: '11px', color: '#0f172a' }}><strong>Tasa BCV Aplicada:</strong> Bs. {Number(comprobanteModal.valor_tasa || 1).toFixed(4)}</div>
                </div>
              </div>

              {/* Tabla de Liquidación Fiscal Detallada */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '18px' }}>
                <thead>
                  <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Concepto</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Base / Total ($)</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Alícuota</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Retención ($)</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Retención (VES)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px' }}>Monto Exento</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>$ {Number(comprobanteModal.monto_exento || 0).toFixed(2)}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>0.00%</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>$ 0.00</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>Bs. 0.00</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px' }}>Base Imponible Gravable</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>$ {Number(comprobanteModal.base_imponible || 0).toFixed(2)}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>-</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>-</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>-</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px' }}>Impuesto al Valor Agregado (IVA Causado)</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>$ {Number(comprobanteModal.monto_iva || 0).toFixed(2)}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>{comprobanteModal.alicuota_iva || 16}%</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>-</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>-</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#fffbeb' }}>
                    <td style={{ padding: '8px', fontWeight: '700' }}>Retención de IVA</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>$ {Number(comprobanteModal.monto_iva || 0).toFixed(2)}</td>
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700', color: '#b45309' }}>{comprobanteModal.porcentaje_retencion_iva}%</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: '#dc2626' }}>
                      $ {Number(comprobanteModal.monto_retencion_iva || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: '#0284c7' }}>
                      Bs. {(Number(comprobanteModal.monto_retencion_iva || 0) * Number(comprobanteModal.valor_tasa || 1)).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#faf5ff' }}>
                    <td style={{ padding: '8px' }}>
                      <div style={{ fontWeight: '700' }}>Retención de I.S.L.R.</div>
                      <div style={{ fontSize: '10px', color: '#6b21a8' }}>
                        {comprobanteModal.concepto_islr_nombre || 'Retención General ISLR'}
                        {comprobanteModal.numeral_decreto ? ` (Numeral ${comprobanteModal.numeral_decreto})` : ''}
                        {comprobanteModal.codigo_concepto_seniat ? ` - Cód. SENIAT: ${comprobanteModal.codigo_concepto_seniat}` : ''}
                      </div>
                      {comprobanteModal.sustraendo_islr_bs > 0 && (
                        <div style={{ fontSize: '9.5px', color: '#15803d' }}>
                          Sustraendo Legal Aplicado: Bs. {Number(comprobanteModal.sustraendo_islr_bs).toFixed(2)} (-${Number(comprobanteModal.sustraendo_islr_usd).toFixed(2)})
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>$ {Number(comprobanteModal.base_imponible || 0).toFixed(2)}</td>
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700', color: '#7e22ce' }}>
                      {comprobanteModal.porcentaje_retencion_islr}%
                      {comprobanteModal.porcentaje_base_islr && comprobanteModal.porcentaje_base_islr < 100 ? ` (${comprobanteModal.porcentaje_base_islr}% Base)` : ''}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: '#dc2626' }}>
                      $ {Number(comprobanteModal.monto_retencion_islr || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: '#0284c7' }}>
                      Bs. {Number(comprobanteModal.monto_retencion_islr_ves || (Number(comprobanteModal.monto_retencion_islr || 0) * Number(comprobanteModal.valor_tasa || 1))).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Resumen Final de Saldos */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
                    <span>Total Bruto Factura:</span>
                    <strong>$ {Number(comprobanteModal.total_factura || 0).toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px', color: '#dc2626' }}>
                    <span>Total Retenciones:</span>
                    <strong>- $ {Number(comprobanteModal.total_retenciones || 0).toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '900', color: '#166534', borderTop: '1px solid #cbd5e1', paddingTop: '4px' }}>
                    <span>Monto Neto a Pagar:</span>
                    <span>$ {Number(comprobanteModal.monto_neto_pagar || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '16px' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>Equivalente en Bolívares Oficiales:</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '950', color: '#0284c7', marginTop: '2px' }}>
                    Bs. {Number(comprobanteModal.equivalente_ves_neto || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                    Tasa Oficial BCV: Bs. {Number(comprobanteModal.valor_tasa || 1).toFixed(4)}
                  </div>
                </div>
              </div>

              {/* Firmas de Autorización */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '50px', textAlign: 'center' }}>
                <div>
                  <div style={{ borderTop: '1px solid #0f172a', paddingTop: '6px', fontSize: '11px', fontWeight: '800' }}>
                    TOTAL CLEAN C.A.
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Firma y Sello Agente de Retención</div>
                </div>
                <div>
                  <div style={{ borderTop: '1px solid #0f172a', paddingTop: '6px', fontSize: '11px', fontWeight: '800' }}>
                    RECIBIDO CONFORME PROVEEDOR
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Firma, RIF y Sello del Sujeto Retenido</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalculoRetencionesFiscales;
