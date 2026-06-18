import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';
import {
  Search,
  Eye,
  CreditCard,
  X,
  Upload,
  Calendar,
  Building2,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  FileText,
  User,
  Hash,
  ArrowRight
} from 'lucide-react';
import './LiquidacionFacturas.css';

// Helper to parse safe JSON array for items
const parsearItems = (itemsField) => {
  if (!itemsField) return [];
  if (Array.isArray(itemsField)) return itemsField;
  try {
    let parsed = typeof itemsField === 'string' ? JSON.parse(itemsField) : itemsField;
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Helper to parse safe JSON array for facturas/abonos
const parsearFacturaUrls = (facturaUrlField) => {
  if (!facturaUrlField) return [];
  if (Array.isArray(facturaUrlField)) return facturaUrlField;
  try {
    let parsed = typeof facturaUrlField === 'string' ? JSON.parse(facturaUrlField) : facturaUrlField;
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const LiquidacionFacturas = ({ currentUser }) => {
  const [requisiciones, setRequisiciones] = useState([]);
  const [bancos, setBancos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subiendoAbono, setSubiendoAbono] = useState(false);
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState('Todos');

  // Modal detailed view
  const [invoiceSeleccionada, setInvoiceSeleccionada] = useState(null);

  // Modal abono registration
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [abonoForm, setAbonoForm] = useState({
    factura_num: '',
    proveedor_nombre: '',
    monto: '',
    referencia: '',
    banco_id: '',
    moneda: '$ / $',
    file: null,
    fileLabel: ''
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch requisiciones approved (where purchases live)
      const { data: reqData, error: reqError } = await supabase
        .from('requisiciones')
        .select('*')
        .eq('estado_aprobacion', 'aprobado_final');
      if (reqError) throw reqError;
      setRequisiciones(reqData || []);

      // 2. Fetch bancos to populate selector
      const { data: bancoData, error: bancoError } = await supabase
        .from('bancos')
        .select('*')
        .eq('activo', true)
        .order('nombre');
      if (bancoError) throw bancoError;
      setBancos(bancoData || []);
    } catch (err) {
      console.error('Error al cargar datos:', err.message);
      toast.error('Error al cargar información: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Set up realtime updates
  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('liquidacion_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'requisiciones'
      }, () => {
        console.log('[REALTIME] Cambio detectado en requisiciones, recargando...');
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Extract, de-duplicate and group abonos globally
  const abonosGlobales = useMemo(() => {
    const listMap = new Map();
    requisiciones.forEach(req => {
      const docs = parsearFacturaUrls(req.facturas_url);
      docs.forEach(doc => {
        if (doc && doc.tipo === 'abono' && doc.abono_id) {
          listMap.set(doc.abono_id, doc);
        }
      });
    });
    return Array.from(listMap.values());
  }, [requisiciones]);

  // Group purchased items by Invoice and Provider
  const facturasAgrupadas = useMemo(() => {
    const grupos = {};

    requisiciones.forEach(req => {
      const items = parsearItems(req.items);
      
      items.forEach(item => {
        const compras = (item.historial_compras || []).filter(
          h => h && h.tipo !== 'JUSTIFICACION' && h.tipo !== 'ANULACION' && h.tipo !== 'DIRECTRIZ'
        );

        compras.forEach(compra => {
          const docNum = (compra.doc_numero || '').trim();
          const provNombre = (compra.proveedor_nombre || 'Desconocido').trim();
          
          if (!docNum) return; // Must have an invoice number to be grouped

          const key = `${docNum.toUpperCase()}_${provNombre.toUpperCase()}`;

          if (!grupos[key]) {
            grupos[key] = {
              key,
              doc_numero: docNum,
              proveedor_nombre: provNombre,
              proveedor_id: compra.proveedor_id || null,
              total_factura: 0,
              fecha_compra: compra.fecha || req.fecha_emision,
              items: [],
              requisiciones_asociadas: new Set(),
              abonos: []
            };
          }

          grupos[key].total_factura += (Number(compra.cant) || 0) * (Number(compra.pu) || 0);
          grupos[key].requisiciones_asociadas.add(req.id);
          grupos[key].items.push({
            id: item.id,
            descripcion: item.descripcion || 'Sin descripción',
            cant: compra.cant,
            pu: compra.pu,
            total: (Number(compra.cant) || 0) * (Number(compra.pu) || 0),
            gerencia: req.gerencia || 'No especificado',
            correlativo_req: req.correlativo_req || 'N/A',
            requisicion_id: req.id,
            fecha: compra.fecha
          });

          // Update latest date if needed
          if (new Date(compra.fecha) > new Date(grupos[key].fecha_compra)) {
            grupos[key].fecha_compra = compra.fecha;
          }
        });
      });
    });

    // Populate abonos and calculate balances
    return Object.values(grupos).map(factura => {
      // Filter abonos that match this invoice number and provider
      const abonosFactura = abonosGlobales.filter(
        ab => ab.factura_num.trim().toUpperCase() === factura.doc_numero.trim().toUpperCase() &&
              ab.proveedor_nombre.trim().toUpperCase() === factura.proveedor_nombre.trim().toUpperCase()
      ).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

      const totalAbonado = abonosFactura.reduce((sum, ab) => sum + (Number(ab.monto) || 0), 0);
      const saldoPendiente = Math.max(0, factura.total_factura - totalAbonado);
      
      let estatus = 'EMITIDO';
      if (totalAbonado > 0) {
        estatus = saldoPendiente <= 0.01 ? 'PAGADO' : 'PAGADO PARCIAL';
      }

      return {
        ...factura,
        abonos: abonosFactura,
        total_abonado: totalAbonado,
        saldo_pendiente: saldoPendiente,
        estatus
      };
    }).sort((a, b) => new Date(b.fecha_compra) - new Date(a.fecha_compra));
  }, [requisiciones, abonosGlobales]);

  // Filtered invoices for display
  const facturasFiltradas = useMemo(() => {
    return facturasAgrupadas.filter(fac => {
      const matchesSearch =
        fac.doc_numero.toLowerCase().includes(filtroBusqueda.toLowerCase()) ||
        fac.proveedor_nombre.toLowerCase().includes(filtroBusqueda.toLowerCase());

      const matchesStatus =
        filtroEstatus === 'Todos' ||
        fac.estatus === filtroEstatus;

      return matchesSearch && matchesStatus;
    });
  }, [facturasAgrupadas, filtroBusqueda, filtroEstatus]);

  // KPI calculations
  const kpis = useMemo(() => {
    let totalFacturas = 0;
    let totalAbonado = 0;
    let totalPendiente = 0;
    let emitidos = 0;
    let parciales = 0;
    let pagados = 0;

    facturasAgrupadas.forEach(f => {
      totalFacturas += f.total_factura;
      totalAbonado += f.total_abonado;
      totalPendiente += f.saldo_pendiente;

      if (f.estatus === 'EMITIDO') emitidos++;
      else if (f.estatus === 'PAGADO PARCIAL') parciales++;
      else if (f.estatus === 'PAGADO') pagados++;
    });

    return { totalFacturas, totalAbonado, totalPendiente, emitidos, parciales, pagados };
  }, [facturasAgrupadas]);

  // Prepare and open abono registration modal
  const abrirRegistrarAbono = (invoice) => {
    setAbonoForm({
      factura_num: invoice.doc_numero,
      proveedor_nombre: invoice.proveedor_nombre,
      monto: invoice.saldo_pendiente.toFixed(2), // prefill with remaining balance
      referencia: '',
      banco_id: '',
      moneda: '$ / $',
      file: null,
      fileLabel: ''
    });
    setShowAbonoModal(true);
  };

  const handleConfirmAbono = async () => {
    const montoNum = Number(abonoForm.monto);
    if (!abonoForm.referencia.trim()) {
      toast.error('El número de referencia es obligatorio.');
      return;
    }
    if (isNaN(montoNum) || montoNum <= 0) {
      toast.error('El monto del abono debe ser mayor a cero.');
      return;
    }
    if (!abonoForm.banco_id) {
      toast.error('Debe seleccionar un banco de origen.');
      return;
    }
    if (!abonoForm.file) {
      toast.error('Debe adjuntar el soporte de transferencia obligatoriamente.');
      return;
    }
    if (!abonoForm.fileLabel.trim()) {
      toast.error('Debe ingresar un nombre o etiqueta para el soporte de pago.');
      return;
    }

    setSubiendoAbono(true);
    try {
      // 1. Upload transfer proof to storage
      const file = abonoForm.file;
      const fileExt = file.name.split('.').pop();
      const storageFileName = `abono_${abonoForm.factura_num.replace(/\s+/g, '_')}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('facturas')
        .upload(storageFileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('facturas').getPublicUrl(storageFileName);

      // 2. Build abono object
      const abonoId = `ab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const nuevoAbono = {
        abono_id: abonoId,
        url: publicUrl,
        name: abonoForm.fileLabel.trim(),
        tipo: 'abono',
        monto: montoNum,
        fecha: new Date().toISOString(),
        banco_id: abonoForm.banco_id,
        banco_nombre: bancos.find(b => b.id === abonoForm.banco_id)?.nombre || 'Desconocido',
        moneda: abonoForm.moneda,
        referencia: abonoForm.referencia.trim(),
        factura_num: abonoForm.factura_num.trim(),
        proveedor_nombre: abonoForm.proveedor_nombre.trim(),
        usuario_nombre: currentUser ? `${currentUser.nombre} ${currentUser.apellido}` : 'Administración'
      };

      // 3. Find parent requisitions sharing this invoice
      const targetInvoice = facturasAgrupadas.find(
        f => f.doc_numero.trim().toUpperCase() === abonoForm.factura_num.trim().toUpperCase() &&
             f.proveedor_nombre.trim().toUpperCase() === abonoForm.proveedor_nombre.trim().toUpperCase()
      );

      if (!targetInvoice) throw new Error('No se encontró la factura a abonar.');

      const reqIds = Array.from(targetInvoice.requisiciones_asociadas);

      // 4. Update each requisition concurrently
      const promises = reqIds.map(async (reqId) => {
        // Fetch current facturas_url to avoid overriding concurrent changes
        const { data } = await supabase
          .from('requisiciones')
          .select('facturas_url')
          .eq('id', reqId)
          .single();

        const currentUrls = parsearFacturaUrls(data?.facturas_url || []);
        const updatedUrls = [...currentUrls, nuevoAbono];

        const { error: updateError } = await supabase
          .from('requisiciones')
          .update({ facturas_url: updatedUrls })
          .eq('id', reqId);

        if (updateError) throw updateError;
      });

      await Promise.all(promises);

      toast.success('Abono registrado con éxito.');
      setShowAbonoModal(false);
      
      // Auto-update selected invoice display if it is open
      if (invoiceSeleccionada && invoiceSeleccionada.doc_numero === abonoForm.factura_num && invoiceSeleccionada.proveedor_nombre === abonoForm.proveedor_nombre) {
        setInvoiceSeleccionada(prev => {
          if (!prev) return null;
          const updatedAbonos = [...prev.abonos, nuevoAbono];
          const newTotalAbonado = prev.total_abonado + montoNum;
          const newSaldo = Math.max(0, prev.total_factura - newTotalAbonado);
          return {
            ...prev,
            abonos: updatedAbonos,
            total_abonado: newTotalAbonado,
            saldo_pendiente: newSaldo,
            estatus: newSaldo <= 0.01 ? 'PAGADO' : 'PAGADO PARCIAL'
          };
        });
      }

      await fetchData();
    } catch (err) {
      console.error('Error al registrar abono:', err.message);
      toast.error('Error al guardar abono: ' + err.message);
    } finally {
      setSubiendoAbono(false);
    }
  };

  // Allow administrators to delete an abono
  const handleEliminarAbono = async (abonoId) => {
    if (!currentUser?.esAdminReal && !currentUser?.esSuperAdmin) {
      toast.error('No tiene privilegios para eliminar registros de abonos.');
      return;
    }

    if (!window.confirm('¿Está seguro de anular este abono? El saldo de la factura se restaurará.')) {
      return;
    }

    setLoading(true);
    try {
      // Find requisitions associated with this invoice (which have this abono in facturas_url)
      const reqsWithAbono = requisiciones.filter(req => {
        const docs = parsearFacturaUrls(req.facturas_url);
        return docs.some(d => d.abono_id === abonoId);
      });

      const promises = reqsWithAbono.map(async (req) => {
        const docs = parsearFacturaUrls(req.facturas_url);
        const filteredDocs = docs.filter(d => d.abono_id !== abonoId);

        const { error } = await supabase
          .from('requisiciones')
          .update({ facturas_url: filteredDocs })
          .eq('id', req.id);

        if (error) throw error;
      });

      await Promise.all(promises);

      toast.success('Abono anulado con éxito.');
      
      // Auto-update selected invoice display if open
      if (invoiceSeleccionada) {
        setInvoiceSeleccionada(prev => {
          if (!prev) return null;
          const deletedAbono = prev.abonos.find(ab => ab.abono_id === abonoId);
          const updatedAbonos = prev.abonos.filter(ab => ab.abono_id !== abonoId);
          const newTotalAbonado = Math.max(0, prev.total_abonado - (deletedAbono?.monto || 0));
          const newSaldo = prev.total_factura - newTotalAbonado;
          return {
            ...prev,
            abonos: updatedAbonos,
            total_abonado: newTotalAbonado,
            saldo_pendiente: newSaldo,
            estatus: newTotalAbonado === 0 ? 'EMITIDO' : (newSaldo <= 0.01 ? 'PAGADO' : 'PAGADO PARCIAL')
          };
        });
      }

      await fetchData();
    } catch (err) {
      console.error('Error al anular abono:', err.message);
      toast.error('Error al anular abono: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="liquidacion-container">
      {/* HEADER SECTION */}
      <div className="liquidacion-header-section">
        <div className="liquidacion-title-group">
          <h1>Liquidación de Facturas de Procura</h1>
          <p>Cuentas por Pagar, Control de Abonos e Historial Financiero</p>
        </div>
      </div>

      {/* FINANCIAL KPIS */}
      <div className="liquidacion-kpi-grid">
        <div className="liquidacion-kpi-card" style={{ borderLeft: '6px solid #2563eb' }}>
          <div>
            <span className="liquidacion-kpi-label">Total en Facturas</span>
            <h3 className="liquidacion-kpi-value">$ {kpis.totalFacturas.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</h3>
          </div>
          <div className="liquidacion-kpi-icon" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
            <FileText size={24} />
          </div>
        </div>

        <div className="liquidacion-kpi-card" style={{ borderLeft: '6px solid #10b981' }}>
          <div>
            <span className="liquidacion-kpi-label">Total Abonado</span>
            <h3 className="liquidacion-kpi-value" style={{ color: '#10b981' }}>$ {kpis.totalAbonado.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</h3>
          </div>
          <div className="liquidacion-kpi-icon" style={{ backgroundColor: '#ecfdf5', color: '#10b981' }}>
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="liquidacion-kpi-card" style={{ borderLeft: '6px solid #f59e0b' }}>
          <div>
            <span className="liquidacion-kpi-label">Saldo Pendiente</span>
            <h3 className="liquidacion-kpi-value" style={{ color: '#f59e0b' }}>$ {kpis.totalPendiente.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</h3>
          </div>
          <div className="liquidacion-kpi-icon" style={{ backgroundColor: '#fffbeb', color: '#f59e0b' }}>
            <Clock size={24} />
          </div>
        </div>

        <div className="liquidacion-kpi-card" style={{ borderLeft: '6px solid #64748b' }}>
          <div>
            <span className="liquidacion-kpi-label">Facturas / Pagadas</span>
            <h3 className="liquidacion-kpi-value">{facturasAgrupadas.length} / <span style={{ color: '#10b981' }}>{kpis.pagados}</span></h3>
          </div>
          <div className="liquidacion-kpi-icon" style={{ backgroundColor: '#f8fafc', color: '#64748b' }}>
            <CheckCircle2 size={24} />
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="liquidacion-filters-card">
        <div className="liquidacion-search-wrapper">
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="liquidacion-search-input"
            placeholder="Buscar por N° Factura o Proveedor..."
            value={filtroBusqueda}
            onChange={(e) => setFiltroBusqueda(e.target.value)}
          />
        </div>

        <select
          className="liquidacion-select-filter"
          value={filtroEstatus}
          onChange={(e) => setFiltroEstatus(e.target.value)}
        >
          <option value="Todos">Todos los Estados</option>
          <option value="EMITIDO">Emitido (Pendiente)</option>
          <option value="PAGADO PARCIAL">Pagado Parcial</option>
          <option value="PAGADO">Pagado</option>
        </select>
      </div>

      {/* MAIN DATA TABLE */}
      <div className="liquidacion-table-wrapper">
        {loading && requisiciones.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px', fontWeight: 'bold' }}>Cargando facturas...</div>
        ) : facturasFiltradas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 'bold' }}>
            No se encontraron facturas con los filtros aplicados.
          </div>
        ) : (
          <table className="liquidacion-table">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>N° Factura / Control</th>
                <th>Fecha Consolidación</th>
                <th>Total Factura</th>
                <th>Total Abonado</th>
                <th>Saldo Pendiente</th>
                <th>Estatus</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {facturasFiltradas.map(fac => (
                <tr key={fac.key}>
                  <td style={{ fontWeight: '700' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Building2 size={16} color="#64748b" />
                      {fac.proveedor_nombre}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '11px', backgroundColor: '#f1f5f9', padding: '3px 8px', borderRadius: '5px', fontWeight: '700', border: '1px solid #cbd5e1' }}>
                      {fac.doc_numero}
                    </span>
                  </td>
                  <td style={{ color: '#64748b' }}>
                    {fac.fecha_compra ? new Date(fac.fecha_compra).toLocaleDateString() : 'N/A'}
                  </td>
                  <td style={{ fontWeight: '700' }}>
                    $ {fac.total_factura.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ color: '#10b981', fontWeight: '700' }}>
                    $ {fac.total_abonado.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{
                    color: fac.saldo_pendiente <= 0.01 ? '#10b981' : '#f59e0b',
                    fontWeight: '800'
                  }}>
                    $ {fac.saldo_pendiente.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  </td>
                  <td>
                    <div className={`liquidacion-status-badge ${fac.estatus.toLowerCase().replace(/\s+/g, '')}`}>
                      {fac.estatus}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="liquidacion-action-btn view"
                      title="Ver Detalles y Abonos"
                      onClick={() => setInvoiceSeleccionada(fac)}
                    >
                      <Eye size={15} />
                    </button>
                    {fac.saldo_pendiente > 0.01 && (
                      <button
                        className="liquidacion-action-btn pay"
                        title="Registrar Abono"
                        onClick={() => abrirRegistrarAbono(fac)}
                      >
                        <CreditCard size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL DETALLES DE FACTURA */}
      {invoiceSeleccionada && (
        <div className="liquidacion-modal-overlay">
          <div className="liquidacion-modal-card">
            <div className="liquidacion-modal-header">
              <h3>Factura: {invoiceSeleccionada.doc_numero}</h3>
              <button className="liquidacion-modal-close" onClick={() => setInvoiceSeleccionada(null)}>
                <X size={18} />
              </button>
            </div>
            
            <div className="liquidacion-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px', marginBottom: '20px' }}>
                <div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>Items Comprados en esta Factura</h4>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Descripción</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Cant</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>P.U ($)</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Departamento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceSeleccionada.items.map((it, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', fontWeight: '600' }}>{it.descripcion}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>{it.cant}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>$ {it.pu.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700' }}>$ {it.total.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>
                              <span style={{ fontSize: '10px', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                {it.correlativo_req}
                              </span> - {it.gerencia}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>Resumen Financiero</h4>
                  <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ fontWeight: '600', color: '#64748b' }}>Total Factura:</span>
                      <span style={{ fontWeight: '700' }}>$ {invoiceSeleccionada.total_factura.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ fontWeight: '600', color: '#10b981' }}>Total Abonado:</span>
                      <span style={{ fontWeight: '700', color: '#10b981' }}>$ {invoiceSeleccionada.total_abonado.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ height: '1px', backgroundColor: '#e2e8f0' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ fontWeight: '800', color: '#f59e0b' }}>Saldo Pendiente:</span>
                      <span style={{ fontWeight: '900', color: '#f59e0b' }}>$ {invoiceSeleccionada.saldo_pendiente.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '6px' }}>
                      <span style={{ fontWeight: '600', color: '#64748b' }}>Estado:</span>
                      <span className={`liquidacion-status-badge ${invoiceSeleccionada.estatus.toLowerCase().replace(/\s+/g, '')}`}>
                        {invoiceSeleccionada.estatus}
                      </span>
                    </div>
                  </div>

                  {invoiceSeleccionada.saldo_pendiente > 0.01 && (
                    <button
                      className="liquidacion-btn liquidacion-btn-primary"
                      style={{ width: '100%', marginTop: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      onClick={() => abrirRegistrarAbono(invoiceSeleccionada)}
                    >
                      <CreditCard size={15} />
                      Registrar Abono
                    </button>
                  )}
                </div>
              </div>

              {/* LIST OF ABONOS HISTORY */}
              <div>
                <h4 style={{ margin: '20px 0 10px 0', fontSize: '12px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>Historial de Abonos</h4>
                {invoiceSeleccionada.abonos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '12px', border: '1px dashed #e2e8f0', borderRadius: '12px' }}>
                    No se han registrado abonos para esta factura todavía.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {invoiceSeleccionada.abonos.map((ab, idx) => (
                      <div key={ab.abono_id || idx} className="liquidacion-abono-history-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <div style={{ fontSize: '14px', fontWeight: '800', color: '#10b981' }}>
                            + $ {ab.monto.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: '700', color: '#475569' }}>Ref: {ab.referencia}</span>
                            <span>{ab.banco_nombre} ({ab.moneda})</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <span style={{ fontWeight: '700' }}>Registrado por: {ab.usuario_nombre}</span>
                            <span>{ab.fecha ? new Date(ab.fecha).toLocaleDateString() : 'N/A'}</span>
                          </div>
                          
                          {ab.url && (
                            <a
                              href={ab.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                textDecoration: 'none',
                                color: '#2563eb',
                                backgroundColor: '#eff6ff',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontSize: '11px',
                                fontWeight: '700',
                                border: '1px solid #bfdbfe'
                              }}
                            >
                              <FileText size={12} />
                              Comprobante
                            </a>
                          )}

                          {(currentUser?.esAdminReal || currentUser?.esSuperAdmin) && (
                            <button
                              onClick={() => handleEliminarAbono(ab.abono_id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#ef4444',
                                padding: '6px',
                                borderRadius: '5px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Anular Abono"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="liquidacion-modal-footer">
              <button className="liquidacion-btn liquidacion-btn-secondary" onClick={() => setInvoiceSeleccionada(null)}>
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRO DE ABONO */}
      {showAbonoModal && (
        <div className="liquidacion-modal-overlay">
          <div className="liquidacion-modal-card form-abono">
            <div className="liquidacion-modal-header">
              <h3>Registrar Abono de Factura</h3>
              <button className="liquidacion-modal-close" onClick={() => setShowAbonoModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="liquidacion-modal-body">
              <div className="liquidacion-form-grid">
                <div className="liquidacion-form-row-2">
                  <div className="liquidacion-form-group">
                    <label className="liquidacion-form-label">N° Factura</label>
                    <input type="text" className="liquidacion-form-input" value={abonoForm.factura_num} disabled />
                  </div>
                  <div className="liquidacion-form-group">
                    <label className="liquidacion-form-label">Proveedor</label>
                    <input type="text" className="liquidacion-form-input" value={abonoForm.proveedor_nombre} disabled />
                  </div>
                </div>

                <div className="liquidacion-form-row-2">
                  <div className="liquidacion-form-group">
                    <label className="liquidacion-form-label">Monto del Abono ($) *</label>
                    <input
                      type="number"
                      className="liquidacion-form-input"
                      value={abonoForm.monto}
                      step="0.01"
                      min="0.01"
                      onChange={(e) => setAbonoForm({ ...abonoForm, monto: e.target.value })}
                    />
                  </div>
                  <div className="liquidacion-form-group">
                    <label className="liquidacion-form-label">N° de Referencia *</label>
                    <input
                      type="text"
                      className="liquidacion-form-input"
                      placeholder="Ref Bancaria..."
                      value={abonoForm.referencia}
                      onChange={(e) => setAbonoForm({ ...abonoForm, referencia: e.target.value })}
                    />
                  </div>
                </div>

                <div className="liquidacion-form-row-2">
                  <div className="liquidacion-form-group">
                    <label className="liquidacion-form-label">Banco Origen *</label>
                    <select
                      className="liquidacion-form-select"
                      value={abonoForm.banco_id}
                      onChange={(e) => setAbonoForm({ ...abonoForm, banco_id: e.target.value })}
                    >
                      <option value="">— Seleccionar Banco —</option>
                      {bancos.map(b => (
                        <option key={b.id} value={b.id}>{b.nombre} ({b.moneda})</option>
                      ))}
                    </select>
                  </div>
                  <div className="liquidacion-form-group">
                    <label className="liquidacion-form-label">Moneda de Pago</label>
                    <select
                      className="liquidacion-form-select"
                      value={abonoForm.moneda}
                      onChange={(e) => setAbonoForm({ ...abonoForm, moneda: e.target.value })}
                    >
                      <option value="$ / $">$ / $ (Dólares)</option>
                      <option value="$ / BS">$ / BS (Bolívares)</option>
                    </select>
                  </div>
                </div>

                <div className="liquidacion-form-group">
                  <label className="liquidacion-form-label">Nombre del Documento Soporte *</label>
                  <input
                    type="text"
                    className="liquidacion-form-input"
                    placeholder="Ej: Transferencia Mercantil..."
                    value={abonoForm.fileLabel}
                    onChange={(e) => setAbonoForm({ ...abonoForm, fileLabel: e.target.value })}
                  />
                </div>

                <div className="liquidacion-form-group">
                  <label className="liquidacion-form-label">Soporte de Transferencia (Imagen/PDF) *</label>
                  <label className={`liquidacion-file-dropzone ${abonoForm.file ? 'has-file' : ''}`}>
                    <Upload size={16} />
                    <span>
                      {abonoForm.file ? abonoForm.file.name : 'Subir Imagen o PDF del Pago'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const fileObj = e.target.files[0];
                          if (fileObj.size > 5 * 1024 * 1024) {
                            toast.error('El archivo supera el límite de 5MB.');
                            return;
                          }
                          setAbonoForm({
                            ...abonoForm,
                            file: fileObj,
                            fileLabel: abonoForm.fileLabel || fileObj.name.split('.')[0]
                          });
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="liquidacion-modal-footer">
              <button
                className="liquidacion-btn liquidacion-btn-secondary"
                onClick={() => setShowAbonoModal(false)}
                disabled={subiendoAbono}
              >
                Cancelar
              </button>
              <button
                className="liquidacion-btn liquidacion-btn-primary"
                onClick={handleConfirmAbono}
                disabled={subiendoAbono}
              >
                {subiendoAbono ? 'Registrando...' : 'Confirmar Abono'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiquidacionFacturas;
