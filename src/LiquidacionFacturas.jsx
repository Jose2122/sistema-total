import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';
import { getSemanaInfo } from './utils/helpers';
import { compressImage } from './utils/compressImage';
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
  
  let list = [];
  if (Array.isArray(facturaUrlField)) {
    list = facturaUrlField;
  } else {
    try {
      let parsed = typeof facturaUrlField === 'string' ? JSON.parse(facturaUrlField) : facturaUrlField;
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      list = Array.isArray(parsed) ? parsed : [];
    } catch {
      list = [];
    }
  }

  return list.map(val => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    }
    return val;
  }).filter(Boolean);
};

const LiquidacionFacturas = ({ currentUser }) => {
  const [requisiciones, setRequisiciones] = useState([]);
  const [ordenesCompra, setOrdenesCompra] = useState([]);
  const [bancos, setBancos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subiendoAbono, setSubiendoAbono] = useState(false);
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState('Todos');
  const [proveedores, setProveedores] = useState([]);
  const [filtroTipoProveedor, setFiltroTipoProveedor] = useState('Todos');
  const [filtroProveedor, setFiltroProveedor] = useState('Todos');
  const [subtabCxp, setSubtabCxp] = useState('todas'); // 'todas', 'facturas', 'odc_credito'

  // Modal detailed view
  const [invoiceSeleccionada, setInvoiceSeleccionada] = useState(null);

  // Modal ODC preview view
  const [showOdcPreviewModal, setShowOdcPreviewModal] = useState(false);
  const [odcPreviewSeleccionada, setOdcPreviewSeleccionada] = useState(null);
  const [odcItemsPreview, setOdcItemsPreview] = useState([]);
  const [loadingOdcItemsPreview, setLoadingOdcItemsPreview] = useState(false);
  const [provDetallePreview, setProvDetallePreview] = useState(null);

  const abrirDetalleOdcPreview = async (odc) => {
    setOdcPreviewSeleccionada(odc);
    setShowOdcPreviewModal(true);
    setLoadingOdcItemsPreview(true);
    setProvDetallePreview(null);
    try {
      const { data, error } = await supabase
        .from('ordenes_compra_items')
        .select('*')
        .eq('orden_compra_id', odc.id)
        .order('item_numero', { ascending: true });

      if (!error && data) {
        setOdcItemsPreview(data);
      } else {
        setOdcItemsPreview([]);
      }

      // Fetch provider contact & payment details
      let provFound = null;
      if (odc.proveedor_id) {
        const { data: pData } = await supabase
          .from('proveedores')
          .select('*')
          .eq('id', odc.proveedor_id)
          .maybeSingle();
        provFound = pData;
      }
      if (!provFound && odc.proveedor_nombre) {
        const { data: pList } = await supabase
          .from('proveedores')
          .select('*')
          .ilike('razon_social', `%${odc.proveedor_nombre.trim()}%`)
          .limit(1);
        if (pList && pList.length > 0) {
          provFound = pList[0];
        }
      }
      setProvDetallePreview(provFound);
    } catch (err) {
      console.error("Error al cargar renglones/proveedor de la ODC:", err);
      setOdcItemsPreview([]);
      setProvDetallePreview(null);
    } finally {
      setLoadingOdcItemsPreview(false);
    }
  };

  // Modal abono registration
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [abonoForm, setAbonoForm] = useState({
    factura_num: '',
    proveedor_nombre: '',
    monto: '',
    referencia: '',
    banco_id: '',
    moneda: '$ / $',
    files: []
  });

  // --- SUBMÓDULO ASIGNACIÓN DE FONDOS A COMPRAS (CUENTAS POR PAGAR) ---
  const [showModalAsignarFondo, setShowModalAsignarFondo] = useState(false);
  const [montoFondoInput, setMontoFondoInput] = useState('');
  const [semanaFondoInput, setSemanaFondoInput] = useState('');
  const [fechaFondoInput, setFechaFondoInput] = useState(new Date().toISOString().split('T')[0]);
  const [observacionesFondoInput, setObservacionesFondoInput] = useState('');
  const [historialFondosCxp, setHistorialFondosCxp] = useState([]);
  const [guardandoFondoCxp, setGuardandoFondoCxp] = useState(false);

  const esAdmin = useMemo(() => {
    if (!currentUser) return false;
    const emailLower = (currentUser.correo || '').toLowerCase().trim();
    const rolUpper = (currentUser.rol || '').toUpperCase().trim();
    return (
      emailLower === 'jcontreras.totalclean@gmail.com' ||
      emailLower === 'cvega.totalclean@gmail.com' ||
      emailLower === 'cvega@totalclean.com' ||
      rolUpper === 'ADMIN' ||
      rolUpper === 'ADMINISTRADOR' ||
      rolUpper === 'DESARROLLADOR' ||
      rolUpper === 'GERENTE GENERAL' ||
      rolUpper === 'CONTABIL' ||
      rolUpper === 'ADMINISTRA' ||
      currentUser.esAdminReal === true ||
      currentUser.esSuperAdmin === true
    );
  }, [currentUser]);

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

      // 3. Fetch proveedores to map types/categories
      const { data: provData, error: provError } = await supabase
        .from('proveedores')
        .select('id, razon_social, categoria, rif');
      if (!provError) {
        setProveedores(provData || []);
      }

      // 4. Fetch Órdenes de Compra (ODC) para sincronización con Cuentas por Pagar
      const { data: odcData, error: odcError } = await supabase
        .from('ordenes_compra')
        .select('*')
        .order('fecha_emision', { ascending: false });
      if (!odcError && odcData) {
        setOrdenesCompra(odcData);
      }
    } catch (err) {
      console.error('Error al cargar datos:', err.message);
      toast.error('Error al cargar información: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistorialFondosCxp = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('presupuesto_compras')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setHistorialFondosCxp(data);
      }
    } catch (err) {
      console.warn("Tabla presupuesto_compras no disponible aún en CxP:", err.message);
    }
  }, []);

  const ejecutarAsignacionFondoCxp = async (e) => {
    e?.preventDefault();
    const monto = parseFloat(montoFondoInput);
    if (isNaN(monto) || monto <= 0) {
      return toast.error("Ingrese un monto válido mayor a $0.");
    }

    setGuardandoFondoCxp(true);
    try {
      const fechaRef = fechaFondoInput || new Date().toISOString();
      const semanaCalculada = getSemanaInfo(fechaRef)?.label || semanaFondoInput || 'SEM ACTUAL';

      const payload = {
        monto_asignado: monto,
        monto_usado: 0,
        semana_key: semanaCalculada,
        observaciones: observacionesFondoInput || `Asignación de Fondo desde Cuentas por Pagar (${semanaCalculada})`,
        usuario_id: currentUser?.id || null,
        usuario_nombre: `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim() || 'Finanzas CxP'
      };

      // Inserción segura adaptable al esquema de la DB
      let currentPayload = { ...payload };
      let resError = null;
      for (let i = 0; i < 5; i++) {
        const res = await supabase.from('presupuesto_compras').insert([currentPayload]);
        if (!res.error) {
          resError = null;
          break;
        }
        resError = res.error;
        console.warn(`Intento ${i + 1} de guardar fondo falló:`, res.error.message);
        const matchCol = res.error.message.match(/column ["']?(.*?)["']?/i);
        if (matchCol && matchCol[1] && currentPayload[matchCol[1]] !== undefined) {
          delete currentPayload[matchCol[1]];
        } else if (currentPayload.fecha_asignacion) {
          delete currentPayload.fecha_asignacion;
        } else if (currentPayload.semana_key) {
          delete currentPayload.semana_key;
        } else {
          break;
        }
      }
      if (resError) throw resError;

      toast.success(`Fondo de $ ${monto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} asignado con éxito a Compras.`);
      setMontoFondoInput('');
      setObservacionesFondoInput('');
      setShowModalAsignarFondo(false);
      await fetchHistorialFondosCxp();
    } catch (err) {
      console.error("Error al asignar fondo desde CxP:", err.message);
      toast.error("Error al registrar fondo: " + err.message);
    } finally {
      setGuardandoFondoCxp(false);
    }
  };

  // Set up realtime updates
  useEffect(() => {
    fetchData();

    const channelReq = supabase
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

    const channelOdc = supabase
      .channel('liquidacion_odc_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ordenes_compra'
      }, () => {
        console.log('[REALTIME] Cambio detectado en ordenes_compra, recargando...');
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelReq);
      supabase.removeChannel(channelOdc);
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

  // Órdenes de Compra a Crédito y sus balances para CxP
  const odcsCredito = useMemo(() => {
    return ordenesCompra.filter(o => o.tipo_pago === 'CREDITO');
  }, [ordenesCompra]);

  const odcsCreditoPendientes = useMemo(() => {
    return odcsCredito.filter(o => {
      const st = (o.estatus_pago || o.status_pago || 'PENDIENTE').toUpperCase();
      return st !== 'PAGADO';
    });
  }, [odcsCredito]);

  const totalOdcCreditoMonto = useMemo(() => {
    return odcsCreditoPendientes.reduce((sum, o) => sum + (Number(o.total_general ?? o.total) || 0), 0);
  }, [odcsCreditoPendientes]);

  // Group purchased items by Invoice and Provider
  const facturasAgrupadas = useMemo(() => {
    const grupos = {};

    requisiciones.forEach(req => {
      const items = parsearItems(req.items);
      
      items.forEach(item => {
        // Un ítem está "comprado" si estado_item === 'comprado' o si tiene historial de compras y no está 'pagado'
        const comprasValidas = (item.historial_compras || []).filter(
          h => h && h.tipo !== 'JUSTIFICACION' && h.tipo !== 'ANULACION' && h.tipo !== 'DIRECTRIZ'
        );
        const tieneComprasHistorial = comprasValidas.length > 0;
        const esComprado = item.estado_item === 'comprado' || (item.estado_item !== 'pagado' && tieneComprasHistorial);

        if (!esComprado) return;

        // Intentar obtener datos de la raíz, o del historial si es histórico
        let docNum = (item.factura_num || '').trim();
        let provNombre = (item.proveedor || '').trim();
        let provId = item.proveedor_seleccionado_id || null;
        let montoReal = Number(item.monto_real) || 0;
        let fechaCompra = item.fecha_compra || null;

        if (!docNum || !provNombre) {
          // Es un registro antiguo, extraemos del historial de compras
          const ultimaCompra = comprasValidas[comprasValidas.length - 1];
          if (ultimaCompra) {
            docNum = (ultimaCompra.doc_numero || '').trim();
            provNombre = (ultimaCompra.proveedor_nombre || 'Desconocido').trim();
            provId = ultimaCompra.proveedor_id || null;
            montoReal = (Number(ultimaCompra.cant) || 0) * (Number(ultimaCompra.pu) || 0);
            fechaCompra = ultimaCompra.fecha;
          }
        }

        if (!docNum) return; // Debe tener número de factura para ser agrupado

        const key = `${docNum.toUpperCase()}_${provNombre.toUpperCase()}`;

        if (!grupos[key]) {
          grupos[key] = {
            key,
            doc_numero: docNum,
            proveedor_nombre: provNombre,
            proveedor_id: provId,
            total_factura: 0,
            fecha_compra: fechaCompra || req.fecha_emision,
            items: [],
            requisiciones_asociadas: new Set(),
            abonos: []
          };
        }

        grupos[key].total_factura += montoReal;
        grupos[key].requisiciones_asociadas.add(req.id);
        
        // Evitar duplicar el mismo ítem en el array
        const itemExistente = grupos[key].items.find(it => it.id === item.id && it.requisicion_id === req.id);
        if (!itemExistente) {
          grupos[key].items.push({
            id: item.id,
            descripcion: item.descripcion || 'Sin descripción',
            cant: item.cantidad_comprada || item.cant,
            pu: item.pu,
            total: montoReal,
            gerencia: req.gerencia || 'No especificado',
            correlativo_req: req.correlativo_req || 'N/A',
            requisicion_id: req.id,
            fecha: fechaCompra
          });
        }

        // Update latest date if needed
        if (fechaCompra && new Date(fechaCompra) > new Date(grupos[key].fecha_compra)) {
          grupos[key].fecha_compra = fechaCompra;
        }
      });
    });

    // Populate abonos and calculate balances
    return Object.values(grupos).map(factura => {
      // Filter abonos that match this invoice number and provider
      const abonosFactura = abonosGlobales.filter(
        ab => (ab.factura_num || '').trim().toUpperCase() === factura.doc_numero.trim().toUpperCase() &&
              (ab.proveedor_nombre || '').trim().toUpperCase() === factura.proveedor_nombre.trim().toUpperCase()
      ).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

      const totalAbonado = abonosFactura.reduce((sum, ab) => sum + (Number(ab.monto) || 0), 0);
      const saldoPendiente = Math.max(0, factura.total_factura - totalAbonado);
      
      const provMatch = proveedores.find(p => p.id === factura.proveedor_id || (p.razon_social || '').trim().toUpperCase() === factura.proveedor_nombre.trim().toUpperCase());
      const diasCredito = provMatch ? (Number(provMatch.dias_credito) || 0) : 0;
      const limiteCredito = provMatch ? (Number(provMatch.monto_limite_credito) || 0) : 0;

      let fechaVencimiento = null;
      let esVencida = false;
      let diasVencida = 0;

      if (factura.fecha_compra) {
        const fComp = new Date(factura.fecha_compra + 'T12:00:00');
        if (!isNaN(fComp.getTime())) {
          fComp.setDate(fComp.getDate() + diasCredito);
          fechaVencimiento = fComp;

          const hoy = new Date();
          if (saldoPendiente > 0.01 && hoy > fComp) {
            esVencida = true;
            const diffTime = Math.abs(hoy - fComp);
            diasVencida = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }
        }
      }

      let estatus = 'EMITIDO';
      if (saldoPendiente <= 0.01 && totalAbonado > 0) {
        estatus = 'PAGADO';
      } else if (esVencida) {
        estatus = 'VENCIDO';
      } else if (totalAbonado > 0) {
        estatus = 'PAGADO PARCIAL';
      }

      return {
        ...factura,
        abonos: abonosFactura,
        total_abonado: totalAbonado,
        saldo_pendiente: saldoPendiente,
        dias_credito: diasCredito,
        limite_credito: limiteCredito,
        fecha_vencimiento: (fechaVencimiento && !isNaN(fechaVencimiento.getTime())) ? fechaVencimiento.toISOString().split('T')[0] : null,
        esVencida,
        diasVencida,
        estatus
      };
    }).sort((a, b) => {
      const aEsPagado = a.estatus === 'PAGADO';
      const bEsPagado = b.estatus === 'PAGADO';
      if (aEsPagado && !bEsPagado) return 1;
      if (!aEsPagado && bEsPagado) return -1;
      return new Date(b.fecha_compra) - new Date(a.fecha_compra);
    });
  }, [requisiciones, abonosGlobales, proveedores]);

  // Helper to obtain categories for a provider in a given grouped invoice
  const getProveedorCategorias = useCallback((fac) => {
    let prov = null;
    if (fac.proveedor_id) {
      prov = proveedores.find(p => p.id === fac.proveedor_id);
    }
    if (!prov && fac.proveedor_nombre) {
      const nameNorm = fac.proveedor_nombre.trim().toUpperCase();
      prov = proveedores.find(p => (p.razon_social || '').trim().toUpperCase() === nameNorm);
    }
    if (prov && prov.categoria) {
      return prov.categoria.split(', ').filter(Boolean).map(c => c.trim().toUpperCase());
    }
    return ['OTROS'];
  }, [proveedores]);

  // List of unique categories for providers that actually have invoices
  const categoriasDeFacturas = useMemo(() => {
    const cats = new Set();
    facturasAgrupadas.forEach(fac => {
      const pCats = getProveedorCategorias(fac);
      pCats.forEach(c => cats.add(c));
    });
    return Array.from(cats).sort();
  }, [facturasAgrupadas, getProveedorCategorias]);

  // List of unique providers that actually have invoices
  const proveedoresDeFacturas = useMemo(() => {
    const provs = new Set();
    facturasAgrupadas.forEach(fac => {
      if (fac.proveedor_nombre) {
        provs.add(fac.proveedor_nombre.trim());
      }
    });
    odcsCredito.forEach(odc => {
      if (odc.proveedor_nombre) {
        provs.add(odc.proveedor_nombre.trim());
      }
    });
    return Array.from(provs).sort((a, b) => a.localeCompare(b));
  }, [facturasAgrupadas, odcsCredito]);

  // Filtered invoices for display
  const facturasFiltradas = useMemo(() => {
    const q = filtroBusqueda.toLowerCase().trim();
    return facturasAgrupadas.filter(fac => {
      const matchesSearch = !q ||
        (fac.doc_numero || '').toLowerCase().includes(q) ||
        (fac.proveedor_nombre || '').toLowerCase().includes(q) ||
        (fac.orden_pago_ref || '').toLowerCase().includes(q);

      const matchesStatus =
        filtroEstatus === 'Todos' ||
        fac.estatus === filtroEstatus;

      // Filter by provider category (type)
      let matchesTipo = true;
      if (filtroTipoProveedor !== 'Todos') {
        const cats = getProveedorCategorias(fac);
        matchesTipo = cats.includes(filtroTipoProveedor.toUpperCase());
      }

      // Filter by specific provider
      const matchesProv =
        filtroProveedor === 'Todos' ||
        (fac.proveedor_nombre || '').trim().toUpperCase() === filtroProveedor.trim().toUpperCase();

      return matchesSearch && matchesStatus && matchesTipo && matchesProv;
    });
  }, [facturasAgrupadas, filtroBusqueda, filtroEstatus, filtroTipoProveedor, filtroProveedor, getProveedorCategorias]);

  // Órdenes de Compra a Crédito Filtradas para la vista CxP
  const odcsFiltradas = useMemo(() => {
    const q = filtroBusqueda.toLowerCase().trim();
    return odcsCredito.filter(odc => {
      const matchesSearch = !q ||
        (odc.numero_odc || '').toLowerCase().includes(q) ||
        (odc.proveedor_nombre || '').toLowerCase().includes(q) ||
        (odc.cotizacion_ref || '').toLowerCase().includes(q) ||
        (odc.orden_pago_ref || '').toLowerCase().includes(q) ||
        (odc.destino_despacho || '').toLowerCase().includes(q);

      const st = (odc.estatus_pago || odc.status_pago || 'PENDIENTE').toUpperCase();
      const matchesStatus =
        filtroEstatus === 'Todos' ||
        (filtroEstatus === 'EMITIDO' && st === 'PENDIENTE') ||
        (filtroEstatus === 'PAGADO' && st === 'PAGADO') ||
        (filtroEstatus === 'PAGADO PARCIAL' && st === 'PENDIENTE');

      const matchesProv =
        filtroProveedor === 'Todos' ||
        (odc.proveedor_nombre || '').trim().toUpperCase() === filtroProveedor.trim().toUpperCase();

      return matchesSearch && matchesStatus && matchesProv;
    });
  }, [odcsCredito, filtroBusqueda, filtroEstatus, filtroProveedor]);

  // Actualizar estatus de pago de una ODC directamente desde CxP
  const cambiarEstatusPagoOdc = async (odcId, nuevoEstatus) => {
    try {
      const { error } = await supabase
        .from('ordenes_compra')
        .update({ 
          estatus_pago: nuevoEstatus, 
          status_pago: nuevoEstatus 
        })
        .eq('id', odcId);

      if (error) throw error;

      toast.success(`Estatus de pago ODC actualizado a: ${nuevoEstatus}`);
      setOrdenesCompra(prev => prev.map(o => String(o.id) === String(odcId) ? { ...o, estatus_pago: nuevoEstatus, status_pago: nuevoEstatus } : o));
    } catch (err) {
      toast.error('Error al actualizar estatus de ODC: ' + err.message);
    }
  };

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

    const totalPendienteGlobal = totalPendiente + totalOdcCreditoMonto;

    return { 
      totalFacturas, 
      totalAbonado, 
      totalPendiente, 
      totalOdcCreditoMonto,
      totalPendienteGlobal,
      emitidos, 
      parciales, 
      pagados,
      odcsPendientesCount: odcsCreditoPendientes.length
    };
  }, [facturasAgrupadas, totalOdcCreditoMonto, odcsCreditoPendientes]);

  // Prepare and open abono registration modal
  const abrirRegistrarAbono = (invoice) => {
    setAbonoForm({
      factura_num: invoice.doc_numero,
      proveedor_nombre: invoice.proveedor_nombre,
      monto: invoice.saldo_pendiente.toFixed(2), // prefill with remaining balance
      referencia: '',
      banco_id: '',
      moneda: '$ / $',
      files: []
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
    if (!abonoForm.files || abonoForm.files.length === 0) {
      toast.error('Debe adjuntar al menos un soporte de transferencia.');
      return;
    }

    setSubiendoAbono(true);
    try {
      // 1. Upload all transfer proofs to storage concurrently
      const uploadPromises = abonoForm.files.map(async (fileObj) => {
        const file = fileObj.file;
        const fileExt = file.name.split('.').pop();
        const storageFileName = `abono_${abonoForm.factura_num.replace(/\s+/g, '_')}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${fileExt}`;
        
        const compressedFile = await compressImage(file);
        const { error: uploadError } = await supabase.storage
          .from('facturas')
          .upload(storageFileName, compressedFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('facturas').getPublicUrl(storageFileName);
        return {
          name: fileObj.label || file.name.split('.')[0],
          url: publicUrl
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);

      // 2. Build abono object
      const abonoId = `ab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const nuevoAbono = {
        abono_id: abonoId,
        url: uploadedFiles[0]?.url || null, // fallback for compatibility
        urls: uploadedFiles, // array of all uploaded files
        name: uploadedFiles.map(f => f.name).join(', '),
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
        // Fetch current facturas_url and items to avoid overriding concurrent changes
        const { data } = await supabase
          .from('requisiciones')
          .select('facturas_url, items')
          .eq('id', reqId)
          .single();

        const currentUrls = parsearFacturaUrls(data?.facturas_url || []);
        const updatedUrls = [...currentUrls, nuevoAbono];

        // Parsear items y marcar a 'pagado' si la factura queda totalmente liquidada
        const currentItems = parsearItems(data?.items || []);
        let huboCambios = false;

        const updatedItems = currentItems.map(item => {
          if (item.estado_item === 'pagado') return item;

          let itemFactura = (item.factura_num || '').trim().toUpperCase();
          let itemProveedor = (item.proveedor || '').trim().toUpperCase();

          if (!itemFactura || !itemProveedor) {
            const comprasValidas = (item.historial_compras || []).filter(
              h => h && h.tipo !== 'JUSTIFICACION' && h.tipo !== 'ANULACION' && h.tipo !== 'DIRECTRIZ'
            );
            const ultimaCompra = comprasValidas[comprasValidas.length - 1];
            if (ultimaCompra) {
              itemFactura = (ultimaCompra.doc_numero || '').trim().toUpperCase();
              itemProveedor = (ultimaCompra.proveedor_nombre || '').trim().toUpperCase();
            }
          }

          if (
            itemFactura === abonoForm.factura_num.trim().toUpperCase() &&
            itemProveedor === abonoForm.proveedor_nombre.trim().toUpperCase()
          ) {
            const totalFactura = targetInvoice.total_factura;
            const totalAbonadoPrevio = targetInvoice.total_abonado;
            const nuevoTotalAbonado = totalAbonadoPrevio + montoNum;

            if (nuevoTotalAbonado >= totalFactura - 0.01) {
              huboCambios = true;
              return { ...item, estado_item: 'pagado' };
            }
          }
          return item;
        });

        const updatePayload = { facturas_url: updatedUrls };
        if (huboCambios) {
          updatePayload.items = updatedItems;
        }

        const { error: updateError } = await supabase
          .from('requisiciones')
          .update(updatePayload)
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
    if (!esAdmin) {
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
        const { data } = await supabase
          .from('requisiciones')
          .select('facturas_url, items')
          .eq('id', req.id)
          .single();

        const docs = parsearFacturaUrls(data?.facturas_url || []);
        const filteredDocs = docs.filter(d => d.abono_id !== abonoId);

        const abonoAEliminar = docs.find(d => d.abono_id === abonoId);
        const docNum = abonoAEliminar?.factura_num;
        const provNombre = abonoAEliminar?.proveedor_nombre;

        const currentItems = parsearItems(data?.items || []);
        let huboCambios = false;

        const updatedItems = currentItems.map(item => {
          if (
            item.estado_item === 'pagado' &&
            docNum && provNombre &&
            (item.factura_num || '').trim().toUpperCase() === docNum.trim().toUpperCase() &&
            (item.proveedor || '').trim().toUpperCase() === provNombre.trim().toUpperCase()
          ) {
            huboCambios = true;
            return { ...item, estado_item: 'comprado' };
          }
          return item;
        });

        const updatePayload = { facturas_url: filteredDocs };
        if (huboCambios) {
          updatePayload.items = updatedItems;
        }

        const { error } = await supabase
          .from('requisiciones')
          .update(updatePayload)
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
      <div className="liquidacion-header-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="liquidacion-title-group">
          <h1>Liquidación de Facturas de Procura</h1>
          <p>Cuentas por Pagar, Control de Abonos e Historial Financiero</p>
        </div>

        <button
          onClick={() => {
            setShowModalAsignarFondo(true);
            fetchHistorialFondosCxp();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '800',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
            transition: 'transform 0.1s ease'
          }}
        >
          <DollarSign size={16} />
          <span>💰 Asignar Fondo a Compras</span>
        </button>
      </div>

      {/* FINANCIAL KPIS */}
      <div className="liquidacion-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="liquidacion-kpi-card" style={{ borderLeft: '6px solid #2563eb' }}>
          <div>
            <span className="liquidacion-kpi-label">Total Facturas Procura</span>
            <h3 className="liquidacion-kpi-value">$ {kpis.totalFacturas.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</h3>
          </div>
          <div className="liquidacion-kpi-icon" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
            <FileText size={24} />
          </div>
        </div>

        <div className="liquidacion-kpi-card" style={{ borderLeft: '6px solid #d97706' }}>
          <div>
            <span className="liquidacion-kpi-label">Total Crédito ODC por Pagar</span>
            <h3 className="liquidacion-kpi-value" style={{ color: '#d97706' }}>$ {kpis.totalOdcCreditoMonto.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</h3>
          </div>
          <div className="liquidacion-kpi-icon" style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>
            <CreditCard size={24} />
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

        <div className="liquidacion-kpi-card" style={{ borderLeft: '6px solid #dc2626' }}>
          <div>
            <span className="liquidacion-kpi-label">Saldo Pendiente CxP Total</span>
            <h3 className="liquidacion-kpi-value" style={{ color: '#dc2626' }}>$ {kpis.totalPendienteGlobal.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</h3>
          </div>
          <div className="liquidacion-kpi-icon" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
            <Clock size={24} />
          </div>
        </div>
      </div>

      {/* SUBTAB NAVIGATION BAR */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button
          style={{ fontWeight: '800', backgroundColor: subtabCxp === 'todas' ? '#0f172a' : '#ffffff', color: subtabCxp === 'todas' ? 'white' : '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '10px 18px', cursor: 'pointer', fontSize: '0.85rem' }}
          onClick={() => setSubtabCxp('todas')}
        >
          🔍 Cuentas por Pagar Consolidadas ({facturasFiltradas.length + odcsFiltradas.length})
        </button>
        <button
          style={{ fontWeight: '800', backgroundColor: subtabCxp === 'facturas' ? '#0284c7' : '#ffffff', color: subtabCxp === 'facturas' ? 'white' : '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '10px 18px', cursor: 'pointer', fontSize: '0.85rem' }}
          onClick={() => setSubtabCxp('facturas')}
        >
          📜 Facturas de Procura ({facturasFiltradas.length})
        </button>
        <button
          style={{ fontWeight: '800', backgroundColor: subtabCxp === 'odc_credito' ? '#d97706' : '#ffffff', color: subtabCxp === 'odc_credito' ? 'white' : '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '10px 18px', cursor: 'pointer', fontSize: '0.85rem' }}
          onClick={() => setSubtabCxp('odc_credito')}
        >
          💳 Órdenes de Compra a Crédito ({odcsFiltradas.length})
        </button>
      </div>

      {/* FILTER CONTROLS */}
      <div className="liquidacion-filters-card">
        <div className="liquidacion-search-wrapper">
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="liquidacion-search-input"
            placeholder="Buscar por N° ODC, Factura, Orden de Pago, Ref. Cotización o Proveedor..."
            value={filtroBusqueda}
            onChange={(e) => setFiltroBusqueda(e.target.value)}
          />
        </div>

        <div className="liquidacion-filters-group">
          {/* Filtro Tipo de Proveedor */}
          <select
            className="liquidacion-select-filter"
            value={filtroTipoProveedor}
            onChange={(e) => setFiltroTipoProveedor(e.target.value)}
          >
            <option value="Todos">Todos los Rubros/Tipos</option>
            {categoriasDeFacturas.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Filtro Proveedor */}
          <select
            className="liquidacion-select-filter"
            value={filtroProveedor}
            onChange={(e) => setFiltroProveedor(e.target.value)}
          >
            <option value="Todos">Todos los Proveedores</option>
            {proveedoresDeFacturas.map(prov => (
              <option key={prov} value={prov}>{prov}</option>
            ))}
          </select>

          {/* Filtro Estatus */}
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
      </div>

      {/* MAIN DATA TABLES */}
      {(subtabCxp === 'todas' || subtabCxp === 'odc_credito') && (
        <div className="liquidacion-table-wrapper" style={{ marginBottom: '25px' }}>
          <div style={{ padding: '16px 20px', backgroundColor: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '900', color: '#92400e', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={18} /> Órdenes de Compra a Crédito por Pagar ({odcsFiltradas.length})
            </span>
            <span style={{ fontWeight: '900', color: '#b45309', fontSize: '0.9rem' }}>
              Total Crédito ODC: $ {totalOdcCreditoMonto.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {odcsFiltradas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '700' }}>
              No hay Órdenes de Compra a crédito pendientes registradas.
            </div>
          ) : (
            <table className="liquidacion-table">
              <thead>
                <tr>
                  <th>Correlativo ODC</th>
                  <th>Proveedor</th>
                  <th>Plazo / Vencimiento Crédito</th>
                  <th>Total ODC</th>
                  <th>Estatus Pago</th>
                  <th style={{ textAlign: 'center' }}>Gestión de Pago</th>
                </tr>
              </thead>
              <tbody>
                {odcsFiltradas.map(odc => {
                  const statusActual = (odc.estatus_pago || odc.status_pago || 'PENDIENTE').toUpperCase();
                  const isPagado = statusActual === 'PAGADO';
                  return (
                    <tr key={odc.id} style={{ backgroundColor: isPagado ? '#f0fdf4' : 'transparent' }}>
                      <td>
                        <button
                          type="button"
                          onClick={() => abrirDetalleOdcPreview(odc)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#0ea5e9',
                            fontWeight: '900',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            padding: 0,
                            textDecoration: 'underline'
                          }}
                          title="Haga clic para abrir vista previa y renglones de la ODC"
                        >
                          {odc.numero_odc}
                        </button>
                      </td>
                      <td style={{ fontWeight: '700' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Building2 size={16} color="#64748b" />
                          {odc.proveedor_nombre || 'N/A'}
                        </div>
                      </td>
                      <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                        <strong>{odc.dias_credito || 0} Días</strong> ({odc.fecha_vencimiento_credito || odc.fecha_emision || 'N/A'})
                      </td>
                      <td style={{ fontWeight: '900', color: '#0f172a' }}>
                        $ {Number(odc.total_general ?? odc.total ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: '900',
                          backgroundColor: isPagado ? '#dcfce7' : '#fef3c7',
                          color: isPagado ? '#166534' : '#92400e'
                        }}>
                          {isPagado ? '✅ PAGADO' : '⏳ PENDIENTE'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <select
                          style={{ padding: '6px 10px', fontSize: '0.75rem', fontWeight: '800', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer', backgroundColor: '#f8fafc' }}
                          value={statusActual}
                          onChange={(e) => cambiarEstatusPagoOdc(odc.id, e.target.value)}
                        >
                          <option value="PENDIENTE">⏳ PENDIENTE</option>
                          <option value="PAGADO">✅ PAGADO</option>
                          <option value="VENCIDO">🔴 VENCIDO</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {(subtabCxp === 'todas' || subtabCxp === 'facturas') && (
        <div className="liquidacion-table-wrapper">
          <div style={{ padding: '16px 20px', backgroundColor: '#f0f9ff', borderBottom: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '900', color: '#0369a1', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} /> Facturas de Procura ({facturasFiltradas.length})
            </span>
            <span style={{ fontWeight: '900', color: '#0284c7', fontSize: '0.9rem' }}>
              Pendiente Facturas: $ {kpis.totalPendiente.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
            </span>
          </div>

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
      )}

      {/* MODAL DETALLES DE FACTURA */}
      {invoiceSeleccionada && (
        <div className="liquidacion-modal-overlay">
          <div className="liquidacion-modal-card">
            <div className="liquidacion-modal-header">
              <h3>Factura: {invoiceSeleccionada.doc_numero} — {invoiceSeleccionada.proveedor_nombre}</h3>
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
                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>$ {(Number(it.pu) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700' }}>$ {(Number(it.total) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
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
                            + $ {(Number(ab.monto) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
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
                          
                          {ab.urls && ab.urls.length > 0 ? (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {ab.urls.map((u, uIdx) => (
                                <a
                                  key={uIdx}
                                  href={u.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    textDecoration: 'none',
                                    color: '#2563eb',
                                    backgroundColor: '#eff6ff',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    border: '1px solid #bfdbfe'
                                  }}
                                  title={u.name}
                                >
                                  <FileText size={11} />
                                  {(u.name || 'Archivo').length > 15 ? `${(u.name || 'Archivo').slice(0, 12)}...` : (u.name || 'Archivo')}
                                </a>
                              ))}
                            </div>
                          ) : ab.url ? (
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
                          ) : null}

                          {esAdmin && (
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

      {/* MODAL VISTA PREVIA ODC - ESTILO REFERENCIA IMAGEN 2 */}
      {showOdcPreviewModal && odcPreviewSeleccionada && (() => {
        // Parse provider bank accounts
        let ctasBancariasProv = [];
        if (provDetallePreview && provDetallePreview.cuentas_bancarias) {
          const c = provDetallePreview.cuentas_bancarias;
          if (Array.isArray(c)) ctasBancariasProv = c;
          else if (typeof c === 'string') {
            try { ctasBancariasProv = JSON.parse(c); } catch { ctasBancariasProv = []; }
          }
        }

        const contactoNombre = provDetallePreview?.persona_contacto || provDetallePreview?.contacto_nombre || odcPreviewSeleccionada.contacto_proveedor || '—';
        const contactoTelefono = provDetallePreview?.telefono || odcPreviewSeleccionada.telefono_proveedor || '—';
        const contactoCorreo = provDetallePreview?.correo || provDetallePreview?.email || odcPreviewSeleccionada.correo_proveedor || '—';
        const ciudadProv = provDetallePreview?.ciudad || odcPreviewSeleccionada.ciudad_proveedor || '';
        const direccionProv = provDetallePreview?.direccion || odcPreviewSeleccionada.direccion_proveedor || '—';
        const rifProv = provDetallePreview?.rif || odcPreviewSeleccionada.rif_proveedor || '—';

        return (
          <div className="liquidacion-modal-overlay" style={{ zIndex: 9999 }}>
            <div className="liquidacion-modal-card" style={{ maxWidth: '940px', width: '94%', maxHeight: '90vh', overflowY: 'auto', borderRadius: '24px', padding: '28px', backgroundColor: 'white' }}>
              
              {/* CABECERA DE MODAL */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: '900', color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    EXPEDIENTES Y DETALLES DE COMPRA
                  </span>
                  <h2 style={{ margin: '4px 0 0 0', fontSize: '1.35rem', fontWeight: '950', color: '#0f172a' }}>
                    Orden de Compra: {odcPreviewSeleccionada.numero_odc} — {odcPreviewSeleccionada.proveedor_nombre || 'PROVEEDOR'}
                  </h2>
                </div>
                <button
                  className="liquidacion-modal-close"
                  onClick={() => setShowOdcPreviewModal(false)}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={20} color="#64748b" />
                </button>
              </div>

              {/* CUERPO DEL MODAL (COLUMNAS IZQ / DER) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px', alignItems: 'start' }}>
                
                {/* COLUMNA IZQUIERDA: ITEMS & CUENTAS DE PAGO */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* TABLA DE RENGLONES / ITEMS */}
                  <div>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
                      ITEMS COMPRADOS EN ESTA ÓRDEN DE COMPRA
                    </h4>

                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', backgroundColor: 'white' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#1e293b', color: 'white', textTransform: 'uppercase', fontSize: '11px' }}>
                            <th style={{ padding: '12px 14px', textAlign: 'left' }}>DESCRIPCIÓN Y CUENTA</th>
                            <th style={{ padding: '12px 10px', textAlign: 'center', width: '60px' }}>CANT</th>
                            <th style={{ padding: '12px 12px', textAlign: 'right', width: '95px' }}>P.U ($)</th>
                            <th style={{ padding: '12px 14px', textAlign: 'right', width: '105px' }}>TOTAL ($)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loadingOdcItemsPreview ? (
                            <tr>
                              <td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontWeight: '600' }}>
                                Cargando ítems de la Órden de Compra...
                              </td>
                            </tr>
                          ) : odcItemsPreview.length === 0 ? (
                            <tr>
                              <td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                                No se encontraron renglones detallados registrados para esta ODC.
                              </td>
                            </tr>
                          ) : (
                            odcItemsPreview.map((it, idx) => (
                              <tr key={it.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '12px 14px', fontWeight: '600', color: '#1e293b' }}>
                                  <div>{it.descripcion}</div>
                                  {(it.cuenta || it.departamento || odcPreviewSeleccionada.departamento) && (
                                    <span style={{ display: 'inline-block', marginTop: '3px', fontSize: '0.7rem', color: '#0284c7', backgroundColor: '#e0f2fe', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                                      🏛️ {it.cuenta || it.departamento || odcPreviewSeleccionada.departamento}
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '800', color: '#475569' }}>
                                  {Number(it.cantidad || 0).toLocaleString('de-DE')}
                                </td>
                                <td style={{ padding: '12px 12px', textAlign: 'right', color: '#475569' }}>
                                  $ {Number(it.precio_unitario || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                                </td>
                                <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '900', color: '#0f172a' }}>
                                  $ {Number(it.total_fila || (it.cantidad * it.precio_unitario) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* FORMAS DE PAGO Y CUENTAS BANCARIAS DISPONIBLES */}
                  <div>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
                      FORMAS Y CUENTAS DE PAGO DISPONIBLES DEL PROVEEDOR
                    </h4>

                    <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {ctasBancariasProv.length === 0 ? (
                        <div style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic', padding: '8px 0', textAlign: 'center' }}>
                          No hay cuentas bancarias o de pago registradas en la ficha de este proveedor.
                        </div>
                      ) : (
                        ctasBancariasProv.map((cta, idx) => (
                          <div key={idx} style={{ padding: '10px 14px', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: '900', color: '#0f172a' }}>{cta.banco || 'BANCO / METODO'}</span>
                                <span style={{ fontSize: '0.65rem', fontWeight: '900', padding: '2px 6px', borderRadius: '6px', backgroundColor: (cta.moneda || 'USD').includes('USD') || (cta.moneda || '').includes('$') ? '#dcfce7' : '#eff6ff', color: (cta.moneda || 'USD').includes('USD') || (cta.moneda || '').includes('$') ? '#15803d' : '#1d4ed8', border: `1px solid ${(cta.moneda || 'USD').includes('USD') || (cta.moneda || '').includes('$') ? '#bbf7d0' : '#bfdbfe'}` }}>
                                  {cta.moneda || 'VES/USD'}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: '700', color: '#334155', marginTop: '2px' }}>
                                {cta.nro_cuenta || cta.cuenta || 'Sin número de cuenta'}
                              </div>
                            </div>
                            {(cta.titular || cta.rif) && (
                              <div style={{ textAlign: 'right', fontSize: '0.72rem', color: '#64748b' }}>
                                <div style={{ fontWeight: '800', color: '#475569' }}>{cta.titular || ''}</div>
                                <div>RIF/CI: {cta.rif || '—'}</div>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>

                {/* COLUMNA DERECHA: RESUMEN FINANCIERO Y CONTACTO */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* RESUMEN FINANCIERO */}
                  <div>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
                      RESUMEN FINANCIERO
                    </h4>

                    <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span style={{ fontWeight: '600', color: '#64748b' }}>Total ODC:</span>
                        <span style={{ fontWeight: '900', fontSize: '1.25rem', color: '#0f172a' }}>
                          $ {Number(odcPreviewSeleccionada.total_general ?? odcPreviewSeleccionada.total ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                        <span style={{ fontWeight: '600', color: '#64748b' }}>Moneda / Tasa:</span>
                        <span style={{ fontWeight: '800', color: '#0f172a' }}>
                          {odcPreviewSeleccionada.moneda || 'USD'} {odcPreviewSeleccionada.tasa_cambio ? `(Bs. ${Number(odcPreviewSeleccionada.tasa_cambio).toLocaleString('de-DE', { minimumFractionDigits: 2 })})` : ''}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                        <span style={{ fontWeight: '600', color: '#64748b' }}>Condición de Pago:</span>
                        <span style={{ fontWeight: '800', color: '#1d4ed8', backgroundColor: '#eff6ff', padding: '3px 8px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                          {odcPreviewSeleccionada.tipo_pago || 'CRÉDITO'} ({odcPreviewSeleccionada.dias_credito || 0} Días)
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                        <span style={{ fontWeight: '600', color: '#64748b' }}>Estatus Recepción:</span>
                        <span style={{ fontWeight: '800', color: odcPreviewSeleccionada.estatus_recepcion === 'RECIBIDO' ? '#15803d' : '#b45309', backgroundColor: odcPreviewSeleccionada.estatus_recepcion === 'RECIBIDO' ? '#dcfce7' : '#fef3c7', padding: '3px 8px', borderRadius: '6px' }}>
                          {odcPreviewSeleccionada.estatus_recepcion === 'RECIBIDO' ? '📦 RECIBIDO' : '🚚 EN TRÁNSITO'}
                        </span>
                      </div>

                      <div style={{ height: '1px', backgroundColor: '#e2e8f0' }}></div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span style={{ fontWeight: '800', color: '#475569' }}>Estatus de Pago:</span>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: '900',
                          backgroundColor: (odcPreviewSeleccionada.estatus_pago || odcPreviewSeleccionada.status_pago) === 'PAGADO' ? '#dcfce7' : '#fef3c7',
                          color: (odcPreviewSeleccionada.estatus_pago || odcPreviewSeleccionada.status_pago) === 'PAGADO' ? '#166534' : '#92400e'
                        }}>
                          {(odcPreviewSeleccionada.estatus_pago || odcPreviewSeleccionada.status_pago) === 'PAGADO' ? '✅ PAGADO' : '⏳ PENDIENTE'}
                        </span>
                      </div>

                      {odcPreviewSeleccionada.fecha_vencimiento_credito && (
                        <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'right', fontWeight: '700' }}>
                          Vencimiento Crédito: {odcPreviewSeleccionada.fecha_vencimiento_credito}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CONTACTO DE PAGO Y PROVEEDOR */}
                  <div>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
                      CONTACTO DE PAGO Y PROVEEDOR
                    </h4>

                    <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.78rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b', fontWeight: '600' }}>Contacto:</span>
                        <span style={{ fontWeight: '800', color: '#0f172a' }}>{contactoNombre}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b', fontWeight: '600' }}>Teléfono:</span>
                        <span style={{ fontWeight: '800', color: '#0f172a' }}>{contactoTelefono}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b', fontWeight: '600' }}>Correo:</span>
                        <span style={{ fontWeight: '800', color: '#0284c7' }}>{contactoCorreo}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b', fontWeight: '600' }}>RIF:</span>
                        <span style={{ fontWeight: '800', color: '#0f172a' }}>{rifProv}</span>
                      </div>

                      <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '2px 0' }}></div>

                      <div>
                        <span style={{ color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '2px' }}>Dirección / Ciudad:</span>
                        <span style={{ fontWeight: '700', color: '#334155' }}>
                          {direccionProv} {ciudadProv ? `(${ciudadProv})` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>

              {/* PIE DE PAGINA MODAL */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <button
                  className="liquidacion-btn liquidacion-btn-secondary"
                  onClick={() => setShowOdcPreviewModal(false)}
                  style={{ padding: '10px 22px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '800' }}
                >
                  Cerrar Detalle
                </button>
              </div>

            </div>
          </div>
        );
      })()}

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
                    <label className="liquidacion-form-label">Soportes de Transferencia (Puedes seleccionar varios) *</label>
                  <label className="liquidacion-file-dropzone" style={{ cursor: 'pointer', border: '2px dashed #cbd5e1', padding: '15px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', backgroundColor: '#f8fafc' }}>
                    <Upload size={20} color="#64748b" />
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Subir uno o más comprobantes</span>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>Soporta Imagen o PDF de hasta 5MB c/u</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          const filesArray = Array.from(e.target.files);
                          const validFiles = [];
                          for (const fileObj of filesArray) {
                            if (fileObj.size > 5 * 1024 * 1024) {
                              toast.error(`El archivo "${fileObj.name}" supera los 5MB.`);
                            } else {
                              validFiles.push({
                                file: fileObj,
                                label: fileObj.name.split('.')[0]
                              });
                            }
                          }
                          setAbonoForm(prev => ({
                            ...prev,
                            files: [...prev.files, ...validFiles]
                          }));
                        }
                      }}
                    />
                  </label>
                </div>

                {abonoForm.files.length > 0 && (
                  <div className="liquidacion-form-group">
                    <label className="liquidacion-form-label" style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b' }}>Archivos Seleccionados ({abonoForm.files.length})</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', padding: '4px', border: '1px solid #e2e8f0', borderRadius: '10px', backgroundColor: '#ffffff' }}>
                      {abonoForm.files.map((fObj, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 10px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                          <span style={{ fontSize: '12px', color: '#1e293b', flex: '1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={fObj.file.name}>
                            📎 {fObj.file.name}
                          </span>
                          <input
                            type="text"
                            placeholder="Etiqueta / Nombre..."
                            value={fObj.label}
                            onChange={(e) => {
                              const updated = [...abonoForm.files];
                              updated[idx].label = e.target.value;
                              setAbonoForm(prev => ({ ...prev, files: updated }));
                            }}
                            style={{
                              fontSize: '11px',
                              padding: '4px 8px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              width: '180px',
                              fontWeight: '600'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const filtered = abonoForm.files.filter((_, i) => i !== idx);
                              setAbonoForm(prev => ({ ...prev, files: filtered }));
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              fontSize: '12px',
                              padding: '4px'
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
      {/* SUBMÓDULO DE ASIGNACIÓN DE FONDOS A COMPRAS (CUENTAS POR PAGAR) */}
      {showModalAsignarFondo && (
        <div className="sf-modal-overlay">
          <div className="sf-modal-container" style={{ maxWidth: '850px', width: '90%', borderRadius: '24px', padding: '30px', backgroundColor: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>💰</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '900', color: '#0f172a' }}>Asignación de Fondos a Compras</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Módulo de Cuentas por Pagar & Control Financiero</p>
                </div>
              </div>
              <button onClick={() => setShowModalAsignarFondo(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '10px', width: '32px', height: '32px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
            </div>

            {/* FORMULARIO DE ASIGNACIÓN */}
            <form onSubmit={ejecutarAsignacionFondoCxp} style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '25px' }}>
              <div style={{ fontSize: '11px', fontWeight: '900', color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '15px' }}>
                ➕ Cargar Nueva Asignación de Presupuesto
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '6px' }}>MONTO A ASIGNAR ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="Ej: 5000.00"
                    value={montoFondoInput}
                    onChange={(e) => setMontoFondoInput(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1.1rem', fontWeight: '900', color: '#0f172a', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '6px' }}>FECHA DE ASIGNACIÓN</label>
                  <input
                    type="date"
                    required
                    value={fechaFondoInput}
                    onChange={(e) => setFechaFondoInput(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '6px' }}>CONCEPTO / OBSERVACIONES</label>
                  <input
                    type="text"
                    placeholder="Ej: Presupuesto Operativo Compras Semana 30"
                    value={observacionesFondoInput}
                    onChange={(e) => setObservacionesFondoInput(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="submit" disabled={guardandoFondoCxp} style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)' }}>
                  {guardandoFondoCxp ? 'Registrando...' : '💾 Registrar Asignación a Compras'}
                </button>
              </div>
            </form>

            {/* TABLA DE HISTORIAL DE ASIGNACIONES */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: '800', color: '#1e293b' }}>
                📜 Historial de Fondos Asignados a Compras
              </h4>

              <div style={{ maxHeight: '300px', overflowY: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead style={{ backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '800', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ padding: '10px 14px' }}>FECHA</th>
                      <th style={{ padding: '10px 14px' }}>SEMANA</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>MONTO ASIGNADO</th>
                      <th style={{ padding: '10px 14px' }}>ASIGNADO POR</th>
                      <th style={{ padding: '10px 14px' }}>CONCEPTO / OBSERVACIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialFondosCxp.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ padding: '25px', textAlign: 'center', color: '#94a3b8' }}>No hay asignaciones de fondos registradas aún.</td>
                      </tr>
                    ) : (
                      historialFondosCxp.map((item, idx) => (
                        <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ padding: '10px 14px', fontWeight: '700', color: '#334155' }}>
                            {item.fecha_asignacion ? String(item.fecha_asignacion).split('T')[0] : (item.created_at ? String(item.created_at).split('T')[0] : '-')}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: '10px', fontWeight: '800', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '6px' }}>
                              {item.semana_key || 'SEM GLOBAL'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '900', color: '#16a34a', fontSize: '13px' }}>
                            $ {(parseFloat(item.monto_asignado) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: '600', color: '#475569' }}>
                            {item.usuario_nombre || 'Finanzas CxP'}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#64748b' }}>
                            {item.observaciones || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => setShowModalAsignarFondo(false)} style={{ padding: '8px 20px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#475569', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiquidacionFacturas;
