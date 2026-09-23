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
  ArrowRight,
  Landmark,
  Plus,
  Trash2,
  Save,
  Edit3,
  RefreshCw
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
  const [subtabCxp, setSubtabCxp] = useState('todas'); // 'todas', 'facturas', 'odc_credito', 'odc_contado', 'historico'
  const [filtroSemaforo, setFiltroSemaforo] = useState('Todos'); // 'Todos', 'En Plazo', 'Por Vencer', 'Vencidos'

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

  // --- SUBMÓDULO GESTIÓN DE BANCOS (CUENTAS DE ORIGEN DE LA EMPRESA) ---
  const [showModalBancos, setShowModalBancos] = useState(false);
  const [bancoEditandoId, setBancoEditandoId] = useState(null);
  const [guardandoBanco, setGuardandoBanco] = useState(false);
  const [bancoForm, setBancoForm] = useState({
    nombre: '',
    cbu: '',
    tipo: 'Corriente',
    moneda: 'USD',
    activo: true
  });

  const abrirCrearBanco = () => {
    setBancoEditandoId(null);
    setBancoForm({
      nombre: '',
      cbu: '',
      tipo: 'Corriente',
      moneda: 'USD',
      activo: true
    });
  };

  const abrirEditarBanco = (banco) => {
    setBancoEditandoId(banco.id);
    setBancoForm({
      nombre: banco.nombre || '',
      cbu: banco.cbu || '',
      tipo: banco.tipo || 'Corriente',
      moneda: banco.moneda || 'USD',
      activo: banco.activo !== false
    });
  };

  const handleGuardarBanco = async (e) => {
    e?.preventDefault();
    if (!bancoForm.nombre.trim()) {
      return toast.error('El nombre del banco es obligatorio.');
    }

    setGuardandoBanco(true);
    try {
      if (bancoEditandoId) {
        const { error } = await supabase
          .from('bancos')
          .update({
            nombre: bancoForm.nombre.trim(),
            cbu: bancoForm.cbu.trim() || null,
            tipo: bancoForm.tipo,
            moneda: bancoForm.moneda,
            activo: bancoForm.activo
          })
          .eq('id', bancoEditandoId);

        if (error) throw error;
        toast.success('Banco actualizado correctamente.');
      } else {
        const { error } = await supabase
          .from('bancos')
          .insert([{
            nombre: bancoForm.nombre.trim(),
            cbu: bancoForm.cbu.trim() || null,
            tipo: bancoForm.tipo,
            moneda: bancoForm.moneda,
            activo: bancoForm.activo
          }]);

        if (error) throw error;
        toast.success('Banco creado exitosamente.');
      }

      const { data: bData } = await supabase.from('bancos').select('*').order('nombre');
      if (bData) setBancos(bData);

      abrirCrearBanco();
    } catch (err) {
      console.error('Error al guardar banco:', err);
      toast.error('Error al guardar banco: ' + err.message);
    } finally {
      setGuardandoBanco(false);
    }
  };

  const toggleActivoBanco = async (banco) => {
    try {
      const nuevoEstado = !banco.activo;
      const { error } = await supabase
        .from('bancos')
        .update({ activo: nuevoEstado })
        .eq('id', banco.id);

      if (error) throw error;

      toast.success(`Banco "${banco.nombre}" ${nuevoEstado ? 'activado' : 'desactivado'}.`);
      setBancos(prev => prev.map(b => b.id === banco.id ? { ...b, activo: nuevoEstado } : b));
    } catch (err) {
      toast.error('Error al cambiar estatus: ' + err.message);
    }
  };

  const eliminarBancoModal = async (bancoId, bancoNombre) => {
    if (!window.confirm(`¿Está seguro de eliminar el banco "${bancoNombre}"?`)) return;

    try {
      const { error } = await supabase
        .from('bancos')
        .delete()
        .eq('id', bancoId);

      if (error) throw error;

      toast.success(`Banco "${bancoNombre}" eliminado.`);
      setBancos(prev => prev.filter(b => b.id !== bancoId));
    } catch (err) {
      toast.error('Error al eliminar banco: ' + err.message);
    }
  };

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

      // 2. Fetch bancos to populate selector & management
      const { data: bancoData, error: bancoError } = await supabase
        .from('bancos')
        .select('*')
        .order('nombre');
      if (!bancoError) {
        setBancos(bancoData || []);
      }

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

  // Helper de Semaforización de Vencimiento de Crédito (Aging)
  const calcularSemaforoCredito = useCallback((odc) => {
    if (odc.tipo_pago !== 'CREDITO') return { nivel: 'verde', texto: 'Contado', color: '#16a34a', bg: '#dcfce7', dias: null };
    const st = (odc.estatus_pago || odc.status_pago || 'PENDIENTE').toUpperCase();
    if (st === 'PAGADO') return { nivel: 'verde', texto: 'Pagado', color: '#166534', bg: '#dcfce7', dias: null };

    const fechaVencStr = odc.fecha_vencimiento_credito || odc.fecha_vencimiento_pago;
    if (!fechaVencStr) return { nivel: 'verde', texto: 'En Plazo', color: '#0369a1', bg: '#e0f2fe', dias: null };

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fVenc = new Date(fechaVencStr);
    fVenc.setHours(0, 0, 0, 0);

    const diffTime = fVenc.getTime() - hoy.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const diasMora = Math.abs(diffDays);
      if (diasMora > 15) return { nivel: 'morado', texto: `Mora Crítica (${diasMora}d)`, color: '#6b21a8', bg: '#f3e8ff', dias: diffDays };
      return { nivel: 'rojo', texto: `Vencido (${diasMora}d)`, color: '#991b1b', bg: '#fee2e2', dias: diffDays };
    } else if (diffDays <= 5) {
      return { nivel: 'amarillo', texto: `Por Vencer (${diffDays}d)`, color: '#854d0e', bg: '#fef9c3', dias: diffDays };
    } else {
      return { nivel: 'verde', texto: `En Plazo (${diffDays}d)`, color: '#065f46', bg: '#d1fae5', dias: diffDays };
    }
  }, []);

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

  // Órdenes de Compra a Contado para CxP
  const odcsContado = useMemo(() => {
    return ordenesCompra.filter(o => o.tipo_pago !== 'CREDITO');
  }, [ordenesCompra]);

  const odcsContadoPendientes = useMemo(() => {
    return odcsContado.filter(o => {
      const st = (o.estatus_pago || o.status_pago || 'PENDIENTE').toUpperCase();
      return st !== 'PAGADO';
    });
  }, [odcsContado]);

  const totalOdcContadoMonto = useMemo(() => {
    return odcsContadoPendientes.reduce((sum, o) => sum + (Number(o.total_general ?? o.total) || 0), 0);
  }, [odcsContadoPendientes]);

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
  const odcsCreditoFiltradas = useMemo(() => {
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
        (filtroEstatus === 'PAGADO PARCIAL' && st === 'PAGADO PARCIAL');

      const sem = calcularSemaforoCredito(odc);
      const matchesSemaforo =
        filtroSemaforo === 'Todos' ||
        (filtroSemaforo === 'En Plazo' && sem.nivel === 'verde') ||
        (filtroSemaforo === 'Por Vencer' && sem.nivel === 'amarillo') ||
        (filtroSemaforo === 'Vencidos' && (sem.nivel === 'rojo' || sem.nivel === 'morado'));

      const matchesProv =
        filtroProveedor === 'Todos' ||
        (odc.proveedor_nombre || '').trim().toUpperCase() === filtroProveedor.trim().toUpperCase();

      return matchesSearch && matchesStatus && matchesSemaforo && matchesProv;
    });
  }, [odcsCredito, filtroBusqueda, filtroEstatus, filtroSemaforo, filtroProveedor, calcularSemaforoCredito]);

  // Órdenes de Compra a Contado Filtradas para la vista CxP
  const odcsContadoFiltradas = useMemo(() => {
    const q = filtroBusqueda.toLowerCase().trim();
    return odcsContado.filter(odc => {
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
        (filtroEstatus === 'PAGADO PARCIAL' && st === 'PAGADO PARCIAL');

      const matchesProv =
        filtroProveedor === 'Todos' ||
        (odc.proveedor_nombre || '').trim().toUpperCase() === filtroProveedor.trim().toUpperCase();

      return matchesSearch && matchesStatus && matchesProv;
    });
  }, [odcsContado, filtroBusqueda, filtroEstatus, filtroProveedor]);

  // Histórico de Pagos Realizados (Totalmente Liquidados o Pagados)
  const pagadosConsolidados = useMemo(() => {
    const q = filtroBusqueda.toLowerCase().trim();

    const facturasPagadas = facturasAgrupadas.filter(f => {
      const isPag = f.estatus === 'PAGADO' || f.estatus_general === 'PAGADO' || f.saldo_pendiente <= 0.01;
      if (!isPag) return false;
      const matchesSearch = !q ||
        (f.doc_numero || '').toLowerCase().includes(q) ||
        (f.proveedor_nombre || '').toLowerCase().includes(q);
      const matchesProv = filtroProveedor === 'Todos' || (f.proveedor_nombre || '').trim().toUpperCase() === filtroProveedor.trim().toUpperCase();
      return matchesSearch && matchesProv;
    });

    const odcsPagadas = ordenesCompra.filter(o => {
      const st = (o.estatus_pago || o.status_pago || '').toUpperCase();
      const isPag = st === 'PAGADO';
      if (!isPag) return false;
      const matchesSearch = !q ||
        (o.numero_odc || '').toLowerCase().includes(q) ||
        (o.proveedor_nombre || '').toLowerCase().includes(q);
      const matchesProv = filtroProveedor === 'Todos' || (o.proveedor_nombre || '').trim().toUpperCase() === filtroProveedor.trim().toUpperCase();
      return matchesSearch && matchesProv;
    });

    return {
      facturas: facturasPagadas,
      odcs: odcsPagadas,
      total: facturasPagadas.length + odcsPagadas.length
    };
  }, [facturasAgrupadas, ordenesCompra, filtroBusqueda, filtroProveedor]);

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

    const totalPendienteGlobal = totalPendiente + totalOdcCreditoMonto + totalOdcContadoMonto;

    return { 
      totalFacturas, 
      totalAbonado, 
      totalPendiente, 
      totalOdcCreditoMonto,
      totalOdcContadoMonto,
      totalPendienteGlobal,
      emitidos, 
      parciales, 
      pagados,
      odcsPendientesCount: odcsCreditoPendientes.length + odcsContadoPendientes.length
    };
  }, [facturasAgrupadas, totalOdcCreditoMonto, totalOdcContadoMonto, odcsCreditoPendientes, odcsContadoPendientes]);

  // Prepare and open abono registration modal for Facturas
  const abrirRegistrarAbono = (invoice) => {
    setAbonoForm({
      es_odc: false,
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

  // Prepare and open abono registration modal for ODC
  const abrirRegistrarAbonoOdc = (odc) => {
    const totalVal = Number(odc.total_general ?? odc.total ?? 0);
    const abonosExistentes = parsearItems(odc.detalles_pago || odc.datos_pago || []);
    const sumaAbonos = abonosExistentes.reduce((sum, a) => sum + (Number(a.monto) || 0), 0);
    const saldoPend = Math.max(0, totalVal - sumaAbonos);

    setAbonoForm({
      es_odc: true,
      odc_id: odc.id,
      numero_odc: odc.numero_odc,
      factura_num: odc.numero_odc,
      proveedor_nombre: odc.proveedor_nombre || 'Proveedor',
      monto: (saldoPend > 0 ? saldoPend : totalVal).toFixed(2),
      referencia: '',
      banco_id: '',
      moneda: odc.moneda === 'BS' ? '$ / BS' : '$ / $',
      files: []
    });
    setShowAbonoModal(true);
  };

  const uploadSoporteUnificado = useCallback(async (fileObj, prefix = 'abono') => {
    const file = fileObj.file;
    if (!file) return { name: fileObj.label || 'Soporte', url: fileObj.url || '' };
    const fileExt = file.name ? file.name.split('.').pop() : 'png';
    const storageFileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${fileExt}`;

    try {
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
    } catch (err) {
      try {
        const compressedFile = await compressImage(file);
        const { error: uploadError2 } = await supabase.storage
          .from('tickets-evidencia')
          .upload(`soportes/${storageFileName}`, compressedFile);
        if (uploadError2) throw uploadError2;
        const { data: { publicUrl: publicUrl2 } } = supabase.storage.from('tickets-evidencia').getPublicUrl(`soportes/${storageFileName}`);
        return {
          name: fileObj.label || file.name.split('.')[0],
          url: publicUrl2
        };
      } catch (err2) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve({
              name: fileObj.label || file.name.split('.')[0],
              url: reader.result
            });
          };
          reader.readAsDataURL(file);
        });
      }
    }
  }, []);

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
      // 1. Upload all transfer proofs with fallback
      const uploadPromises = abonoForm.files.map(fileObj => uploadSoporteUnificado(fileObj, 'abono'));
      const uploadedFiles = await Promise.all(uploadPromises);

      // 2. Build abono object
      const abonoId = `ab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const bancoNombre = bancos.find(b => b.id === abonoForm.banco_id)?.nombre || 'Desconocido';
      const nuevoAbono = {
        abono_id: abonoId,
        url: uploadedFiles[0]?.url || null,
        urls: uploadedFiles,
        name: uploadedFiles.map(f => f.name).join(', '),
        tipo: 'abono',
        monto: montoNum,
        fecha: new Date().toISOString(),
        banco_id: abonoForm.banco_id,
        banco_nombre: bancoNombre,
        moneda: abonoForm.moneda,
        referencia: abonoForm.referencia.trim(),
        factura_num: abonoForm.factura_num.trim(),
        proveedor_nombre: abonoForm.proveedor_nombre.trim(),
        usuario_nombre: currentUser ? `${currentUser.nombre} ${currentUser.apellido}` : 'Administración'
      };

      // Si es un abono/pago de ODC
      if (abonoForm.es_odc) {
        const targetOdc = ordenesCompra.find(o => String(o.id) === String(abonoForm.odc_id));
        if (!targetOdc) throw new Error('No se encontró la Órden de Compra a abonar.');

        const abonosExistentes = parsearItems(targetOdc.detalles_pago || targetOdc.datos_pago || []);
        const nuevosAbonos = [...abonosExistentes, nuevoAbono];
        const sumaTotalAbonos = nuevosAbonos.reduce((sum, a) => sum + (Number(a.monto) || 0), 0);
        const totalOdcVal = Number(targetOdc.total_general ?? targetOdc.total ?? 0);
        const saldoRemanente = totalOdcVal - sumaTotalAbonos;

        const estatusFinal = saldoRemanente <= 0.01 ? 'PAGADO' : 'PAGADO PARCIAL';

        const { error: errUpdateOdc } = await supabase
          .from('ordenes_compra')
          .update({
            estatus_pago: estatusFinal,
            status_pago: estatusFinal,
            detalles_pago: nuevosAbonos,
            datos_pago: nuevosAbonos,
            banco_destino: bancoNombre,
            banco: bancoNombre,
            orden_pago_ref: abonoForm.referencia.trim()
          })
          .eq('id', targetOdc.id);

        if (errUpdateOdc) throw errUpdateOdc;

        toast.success(`Pago de $ ${montoNum.toLocaleString('de-DE', { minimumFractionDigits: 2 })} registrado exitosamente para la ODC ${targetOdc.numero_odc}`);
        
        if (showOdcPreviewModal && odcPreviewSeleccionada && String(odcPreviewSeleccionada.id) === String(targetOdc.id)) {
          setOdcPreviewSeleccionada(prev => ({
            ...prev,
            estatus_pago: estatusFinal,
            status_pago: estatusFinal,
            detalles_pago: nuevosAbonos,
            datos_pago: nuevosAbonos,
            banco_destino: bancoNombre,
            banco: bancoNombre,
            orden_pago_ref: abonoForm.referencia.trim()
          }));
        }

        await fetchData();
        setShowAbonoModal(false);
        return;
      }

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

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => {
              setShowModalBancos(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '800',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
              transition: 'transform 0.1s ease'
            }}
          >
            <Landmark size={16} />
            <span>🏦 Gestionar Bancos</span>
          </button>

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
          🔍 Cuentas por Pagar Consolidadas ({facturasFiltradas.length + odcsCreditoFiltradas.length + odcsContadoFiltradas.length})
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
          💳 Órdenes a Crédito ({odcsCreditoFiltradas.length})
        </button>
        <button
          style={{ fontWeight: '800', backgroundColor: subtabCxp === 'odc_contado' ? '#16a34a' : '#ffffff', color: subtabCxp === 'odc_contado' ? 'white' : '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '10px 18px', cursor: 'pointer', fontSize: '0.85rem' }}
          onClick={() => setSubtabCxp('odc_contado')}
        >
          💵 Órdenes a Contado ({odcsContadoFiltradas.length})
        </button>
        <button
          style={{ fontWeight: '800', backgroundColor: subtabCxp === 'historico' ? '#7c3aed' : '#ffffff', color: subtabCxp === 'historico' ? 'white' : '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '10px 18px', cursor: 'pointer', fontSize: '0.85rem' }}
          onClick={() => setSubtabCxp('historico')}
        >
          ✅ Histórico de Pagos Realizados ({pagadosConsolidados.total})
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
          {/* Filtro Semáforo de Crédito */}
          {(subtabCxp === 'todas' || subtabCxp === 'odc_credito') && (
            <select
              className="liquidacion-select-filter"
              style={{ border: '1.5px solid #f59e0b', backgroundColor: '#fffbeb', fontWeight: '700', color: '#b45309' }}
              value={filtroSemaforo}
              onChange={(e) => setFiltroSemaforo(e.target.value)}
            >
              <option value="Todos">Todos los Plazos</option>
              <option value="En Plazo">🟢 En Plazo</option>
              <option value="Por Vencer">🟡 Por Vencer (≤5d)</option>
              <option value="Vencidos">🔴 Vencidos / En Mora</option>
            </select>
          )}

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
          <div style={{ padding: '16px 20px', backgroundColor: '#f0f9ff', borderBottom: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '900', color: '#0369a1', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={18} /> Órdenes de Compra a Crédito por Pagar ({odcsCreditoFiltradas.length})
            </span>
            <span style={{ fontWeight: '900', color: '#0284c7', fontSize: '0.9rem' }}>
              Total Crédito ODC: $ {totalOdcCreditoMonto.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {odcsCreditoFiltradas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '700' }}>
              No hay Órdenes de Compra a crédito pendientes registradas con los filtros aplicados.
            </div>
          ) : (
            <table className="liquidacion-table">
              <thead>
                <tr>
                  <th>Correlativo ODC</th>
                  <th>Proveedor</th>
                  <th>Plazo / Semaforización Crédito</th>
                  <th>Total ODC</th>
                  <th>Estatus Pago</th>
                  <th style={{ textAlign: 'center' }}>Gestión de Pago</th>
                </tr>
              </thead>
              <tbody>
                {odcsCreditoFiltradas.map(odc => {
                  const statusActual = (odc.estatus_pago || odc.status_pago || 'PENDIENTE').toUpperCase();
                  const isPagado = statusActual === 'PAGADO';
                  const sem = calcularSemaforoCredito(odc);
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
                      <td>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: '800',
                          backgroundColor: sem.bg,
                          color: sem.color,
                          display: 'inline-block',
                          marginBottom: '4px'
                        }}>
                          {sem.texto}
                        </span>
                        <div style={{ color: '#64748b', fontSize: '0.78rem' }}>
                          <strong>{odc.dias_credito || 0} Días</strong> ({odc.fecha_vencimiento_credito || odc.fecha_emision || 'N/A'})
                        </div>
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
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <button
                            className="liquidacion-action-btn view"
                            title="Ver Detalles y Renglones ODC"
                            onClick={() => abrirDetalleOdcPreview(odc)}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            className="liquidacion-action-btn pay"
                            title="Registrar Pago / Abono ODC"
                            onClick={() => abrirRegistrarAbonoOdc(odc)}
                          >
                            <CreditCard size={15} />
                          </button>
                          <select
                            style={{ padding: '5px 8px', fontSize: '0.72rem', fontWeight: '800', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer', backgroundColor: '#f8fafc' }}
                            value={statusActual}
                            onChange={(e) => cambiarEstatusPagoOdc(odc.id, e.target.value)}
                          >
                            <option value="PENDIENTE">⏳ PENDIENTE</option>
                            <option value="PAGADO PARCIAL">🟡 PARCIAL</option>
                            <option value="PAGADO">✅ PAGADO</option>
                            <option value="VENCIDO">🔴 VENCIDO</option>
                          </select>
                        </div>
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

      {(subtabCxp === 'todas' || subtabCxp === 'odc_contado') && (
        <div className="liquidacion-table-wrapper" style={{ marginBottom: '25px', marginTop: '25px' }}>
          <div style={{ padding: '16px 20px', backgroundColor: '#f0f9ff', borderBottom: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '900', color: '#0369a1', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={18} /> Órdenes de Compra a Contado por Rendir / Liquidar ({odcsContadoFiltradas.length})
            </span>
            <span style={{ fontWeight: '900', color: '#0284c7', fontSize: '0.9rem' }}>
              Total Contado ODC: $ {totalOdcContadoMonto.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {odcsContadoFiltradas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '700' }}>
              No hay Órdenes de Compra a contado pendientes registradas con los filtros aplicados.
            </div>
          ) : (
            <table className="liquidacion-table">
              <thead>
                <tr>
                  <th>Correlativo ODC</th>
                  <th>Proveedor</th>
                  <th>Fecha Emisión</th>
                  <th>Total ODC</th>
                  <th>Condición</th>
                  <th>Estatus Pago</th>
                  <th style={{ textAlign: 'center' }}>Gestión de Pago</th>
                </tr>
              </thead>
              <tbody>
                {odcsContadoFiltradas.map(odc => {
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
                          title="Ver detalle y renglones ODC"
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
                        {odc.fecha_emision ? new Date(odc.fecha_emision).toLocaleDateString() : 'N/A'}
                      </td>
                      <td style={{ fontWeight: '900', color: '#0f172a' }}>
                        $ {Number(odc.total_general ?? odc.total ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '800', backgroundColor: '#dcfce7', color: '#15803d' }}>
                          💵 CONTADO
                        </span>
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
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <button
                            className="liquidacion-action-btn view"
                            title="Ver Detalles y Renglones ODC"
                            onClick={() => abrirDetalleOdcPreview(odc)}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            className="liquidacion-action-btn pay"
                            title="Registrar Pago / Abono ODC"
                            onClick={() => abrirRegistrarAbonoOdc(odc)}
                          >
                            <CreditCard size={15} />
                          </button>
                          <select
                            style={{ padding: '5px 8px', fontSize: '0.72rem', fontWeight: '800', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer', backgroundColor: '#f8fafc' }}
                            value={statusActual}
                            onChange={(e) => cambiarEstatusPagoOdc(odc.id, e.target.value)}
                          >
                            <option value="PENDIENTE">⏳ PENDIENTE</option>
                            <option value="PAGADO PARCIAL">🟡 PARCIAL</option>
                            <option value="PAGADO">✅ PAGADO</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {subtabCxp === 'historico' && (
        <div className="liquidacion-table-wrapper" style={{ marginTop: '10px' }}>
          <div style={{ padding: '16px 20px', backgroundColor: '#f0f9ff', borderBottom: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '900', color: '#0369a1', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} /> Histórico de Pagos y Liquidaciones Completadas ({pagadosConsolidados.total})
            </span>
            <span style={{ fontWeight: '900', color: '#0284c7', fontSize: '0.9rem' }}>
              Registros Consolidados: {pagadosConsolidados.total}
            </span>
          </div>

          {pagadosConsolidados.total === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '700' }}>
              No hay pagos o liquidaciones finalizadas registradas con los filtros seleccionados.
            </div>
          ) : (
            <table className="liquidacion-table">
              <thead>
                <tr>
                  <th>Tipo / Documento</th>
                  <th>Proveedor</th>
                  <th>Fecha Registro</th>
                  <th>Monto Total Pagado</th>
                  <th>Estatus Finanzas</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pagadosConsolidados.facturas.map(fac => (
                  <tr key={`fac_${fac.key}`} style={{ backgroundColor: '#faf5ff' }}>
                    <td>
                      <span style={{ fontSize: '11px', backgroundColor: '#f3e8ff', color: '#7e22ce', padding: '3px 8px', borderRadius: '5px', fontWeight: '800', border: '1px solid #d8b4fe' }}>
                        📜 FACTURA: {fac.doc_numero}
                      </span>
                    </td>
                    <td style={{ fontWeight: '700' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Building2 size={16} color="#64748b" />
                        {fac.proveedor_nombre}
                      </div>
                    </td>
                    <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                      {fac.fecha_compra ? new Date(fac.fecha_compra).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{ fontWeight: '900', color: '#16a34a' }}>
                      $ {fac.total_factura.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '900', backgroundColor: '#dcfce7', color: '#15803d' }}>
                        ✅ LIQUIDADO
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="liquidacion-action-btn view"
                        title="Ver Comprobantes y Abonos"
                        onClick={() => setInvoiceSeleccionada(fac)}
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}

                {pagadosConsolidados.odcs.map(odc => (
                  <tr key={`odc_${odc.id}`} style={{ backgroundColor: '#faf5ff' }}>
                    <td>
                      <button
                        type="button"
                        onClick={() => abrirDetalleOdcPreview(odc)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#7e22ce',
                          fontWeight: '900',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline'
                        }}
                      >
                        🛍️ ODC ({odc.tipo_pago}): {odc.numero_odc}
                      </button>
                    </td>
                    <td style={{ fontWeight: '700' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Building2 size={16} color="#64748b" />
                        {odc.proveedor_nombre || 'N/A'}
                      </div>
                    </td>
                    <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                      {odc.fecha_emision ? new Date(odc.fecha_emision).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{ fontWeight: '900', color: '#16a34a' }}>
                      $ {Number(odc.total_general ?? odc.total ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '900', backgroundColor: '#dcfce7', color: '#15803d' }}>
                        ✅ PAGADO TOTAL
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="liquidacion-action-btn view"
                        title="Ver Vista Previa ODC"
                        onClick={() => abrirDetalleOdcPreview(odc)}
                      >
                        <Eye size={15} />
                      </button>
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

        // Parse ODC payment records
        let abonosOdc = parsearItems(odcPreviewSeleccionada.detalles_pago || odcPreviewSeleccionada.datos_pago || []);
        if (abonosOdc.length === 0 && (odcPreviewSeleccionada.orden_pago_ref || odcPreviewSeleccionada.banco_destino || odcPreviewSeleccionada.banco)) {
          abonosOdc = [{
            abono_id: `legacy_${odcPreviewSeleccionada.id}`,
            monto: Number(odcPreviewSeleccionada.total_general ?? odcPreviewSeleccionada.total ?? 0),
            referencia: odcPreviewSeleccionada.orden_pago_ref || 'REGISTRO PREVIO',
            banco_nombre: odcPreviewSeleccionada.banco_destino || odcPreviewSeleccionada.banco || 'Banco Empresa',
            moneda: odcPreviewSeleccionada.moneda || '$ / $',
            fecha: odcPreviewSeleccionada.fecha_emision,
            usuario_nombre: 'Finanzas'
          }];
        }
        const totalAbonadoOdc = abonosOdc.reduce((sum, a) => sum + (Number(a.monto) || 0), 0);
        const totalOdcMonto = Number(odcPreviewSeleccionada.total_general ?? odcPreviewSeleccionada.total ?? 0);
        const saldoPendienteOdc = Math.max(0, totalOdcMonto - totalAbonadoOdc);
        const estatusPagoOdc = (odcPreviewSeleccionada.estatus_pago || odcPreviewSeleccionada.status_pago || 'PENDIENTE').toUpperCase();

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

                  {/* HISTORIAL Y COMPROBANTES DE PAGOS REGISTRADOS DE LA ODC */}
                  <div>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
                      HISTORIAL Y COMPROBANTES DE PAGOS REGISTRADOS ({abonosOdc.length})
                    </h4>

                    {abonosOdc.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem', fontStyle: 'italic', border: '1px dashed #cbd5e1', borderRadius: '12px', backgroundColor: '#f8fafc' }}>
                        No se han registrado pagos o abonos para esta Órden de Compra todavía.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {abonosOdc.map((ab, idx) => (
                          <div key={ab.abono_id || idx} style={{ padding: '12px 14px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ fontSize: '1.05rem', fontWeight: '900', color: '#10b981' }}>
                                + $ {(Number(ab.monto) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: '#475569', display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: '800', color: '#0f172a' }}>Ref: {ab.referencia || 'Sin Referencia'}</span>
                                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                  <strong>Banco:</strong> {ab.banco_nombre || 'Banco Empresa'} | <strong>Moneda:</strong> {ab.moneda || 'USD'}
                                </span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ fontSize: '0.72rem', color: '#64748b', textAlign: 'right' }}>
                                <div style={{ fontWeight: '700', color: '#334155' }}>Por: {ab.usuario_nombre || 'Finanzas'}</div>
                                <div>{ab.fecha ? new Date(ab.fecha).toLocaleDateString() : 'N/A'}</div>
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
                                        color: '#0284c7',
                                        backgroundColor: '#e0f2fe',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        fontSize: '0.72rem',
                                        fontWeight: '800',
                                        border: '1px solid #bae6fd'
                                      }}
                                      title={u.name}
                                    >
                                      <FileText size={12} />
                                      Comprobante
                                    </a>
                                  ))}
                                </div>
                              ) : ab.url ? (
                                <a
                                  href={ab.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    textDecoration: 'none',
                                    color: '#0284c7',
                                    backgroundColor: '#e0f2fe',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.72rem',
                                    fontWeight: '800',
                                    border: '1px solid #bae6fd'
                                  }}
                                >
                                  <FileText size={12} />
                                  Comprobante
                                </a>
                              ) : (
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>Sin comprobante</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
                        <span style={{ fontWeight: '800', color: '#475569' }}>Total Abonado:</span>
                        <span style={{ fontWeight: '800', color: '#10b981' }}>
                          $ {totalAbonadoOdc.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span style={{ fontWeight: '800', color: '#475569' }}>Saldo Remanente:</span>
                        <span style={{ fontWeight: '900', color: saldoPendienteOdc <= 0.01 ? '#10b981' : '#f59e0b' }}>
                          $ {saldoPendienteOdc.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
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
                          backgroundColor: estatusPagoOdc === 'PAGADO' ? '#dcfce7' : (estatusPagoOdc === 'PAGADO PARCIAL' ? '#fef9c3' : '#fef3c7'),
                          color: estatusPagoOdc === 'PAGADO' ? '#166534' : (estatusPagoOdc === 'PAGADO PARCIAL' ? '#854d0e' : '#92400e')
                        }}>
                          {estatusPagoOdc === 'PAGADO' ? '✅ PAGADO' : (estatusPagoOdc === 'PAGADO PARCIAL' ? '🟡 PARCIAL' : '⏳ PENDIENTE')}
                        </span>
                      </div>

                      {odcPreviewSeleccionada.fecha_vencimiento_credito && (
                        <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'right', fontWeight: '700' }}>
                          Vencimiento Crédito: {odcPreviewSeleccionada.fecha_vencimiento_credito}
                        </div>
                      )}

                      <button
                        className="liquidacion-btn liquidacion-btn-primary"
                        style={{ width: '100%', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '0.85rem' }}
                        onClick={() => abrirRegistrarAbonoOdc(odcPreviewSeleccionada)}
                      >
                        <CreditCard size={16} />
                        Registrar Pago / Abono ODC
                      </button>
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
              <h3>{abonoForm.es_odc ? `Registrar Pago / Abono — ODC ${abonoForm.numero_odc || abonoForm.factura_num}` : `Registrar Abono de Factura: ${abonoForm.factura_num}`}</h3>
              <button className="liquidacion-modal-close" onClick={() => setShowAbonoModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="liquidacion-modal-body">
              <div className="liquidacion-form-grid">
                <div className="liquidacion-form-row-2">
                  <div className="liquidacion-form-group">
                    <label className="liquidacion-form-label">{abonoForm.es_odc ? 'N° ODC' : 'N° Factura'}</label>
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

      {/* MODAL GESTIÓN DE BANCOS DE LA EMPRESA */}
      {showModalBancos && (
        <div className="sf-modal-overlay" style={{ zIndex: 9999 }}>
          <div className="sf-modal-container" style={{ maxWidth: '900px', width: '92%', borderRadius: '24px', padding: '28px', backgroundColor: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🏦</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '950', color: '#0f172a' }}>Gestión de Bancos y Cuentas de Origen</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Configure las cuentas bancarias de la empresa para pagos de Cuentas por Pagar</p>
                </div>
              </div>
              <button onClick={() => setShowModalBancos(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} color="#64748b" />
              </button>
            </div>

            {/* FORMULARIO DE BANCO */}
            <form onSubmit={handleGuardarBanco} style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: '900', color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{bancoEditandoId ? '✏️ Editar Banco' : '➕ Agregar Nuevo Banco / Cuenta de Origen'}</span>
                {bancoEditandoId && (
                  <button type="button" onClick={abrirCrearBanco} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline', fontWeight: '700' }}>
                    + Nuevo registro
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '6px' }}>NOMBRE DEL BANCO / MÉTODO *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Banco Mercantil, Banplus, Morgan Stanley, Zelle..."
                    value={bancoForm.nombre}
                    onChange={(e) => setBancoForm({ ...bancoForm, nombre: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: '700', color: '#0f172a', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '6px' }}>N° CUENTA / CBU / REFERENCIA</label>
                  <input
                    type="text"
                    placeholder="Ej: 01050149191149098414..."
                    value={bancoForm.cbu}
                    onChange={(e) => setBancoForm({ ...bancoForm, cbu: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontFamily: 'monospace', color: '#0f172a', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '6px' }}>MONEDA *</label>
                  <select
                    value={bancoForm.moneda}
                    onChange={(e) => setBancoForm({ ...bancoForm, moneda: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: '700', color: '#0f172a', boxSizing: 'border-box', backgroundColor: 'white' }}
                  >
                    <option value="USD">USD ($ Dólares)</option>
                    <option value="VES">VES (Bs. Bolívares)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '6px' }}>TIPO DE CUENTA</label>
                  <select
                    value={bancoForm.tipo}
                    onChange={(e) => setBancoForm({ ...bancoForm, tipo: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: '700', color: '#0f172a', boxSizing: 'border-box', backgroundColor: 'white' }}
                  >
                    <option value="Corriente">Corriente</option>
                    <option value="Ahorro">Ahorro</option>
                    <option value="Zelle">Zelle / Digital</option>
                    <option value="Custodia">Custodia USD</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>
                  <input
                    type="checkbox"
                    checked={bancoForm.activo}
                    onChange={(e) => setBancoForm({ ...bancoForm, activo: e.target.checked })}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span>Banco Activo para Operaciones</span>
                </label>

                <div style={{ display: 'flex', gap: '10px' }}>
                  {bancoEditandoId && (
                    <button type="button" onClick={abrirCrearBanco} style={{ padding: '8px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  )}
                  <button type="submit" disabled={guardandoBanco} style={{ padding: '9px 22px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: 'white', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)' }}>
                    {guardandoBanco ? 'Guardando...' : (bancoEditandoId ? '💾 Actualizar Banco' : '💾 Guardar Banco')}
                  </button>
                </div>
              </div>
            </form>

            {/* TABLA DE BANCOS REGISTRADOS */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: '900', color: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🏛️ Cuentas Bancarias Registradas ({bancos.length})</span>
              </h4>

              <div style={{ maxHeight: '300px', overflowY: 'auto', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead style={{ backgroundColor: '#1e293b', color: 'white', fontWeight: '800', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ padding: '10px 14px' }}>BANCO / MÉTODO</th>
                      <th style={{ padding: '10px 14px' }}>MONEDA</th>
                      <th style={{ padding: '10px 14px' }}>N° CUENTA / CBU</th>
                      <th style={{ padding: '10px 14px' }}>TIPO</th>
                      <th style={{ padding: '10px 14px' }}>ESTATUS</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center' }}>ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bancos.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ padding: '25px', textAlign: 'center', color: '#94a3b8' }}>No hay bancos o cuentas de origen registradas.</td>
                      </tr>
                    ) : (
                      bancos.map((b, idx) => {
                        const isActivo = b.activo !== false;
                        return (
                          <tr key={b.id || idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: isActivo ? 'white' : '#f8fafc' }}>
                            <td style={{ padding: '10px 14px', fontWeight: '800', color: '#0f172a' }}>
                              {b.nombre}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ fontSize: '10px', fontWeight: '900', padding: '2px 8px', borderRadius: '6px', backgroundColor: b.moneda === 'USD' ? '#dcfce7' : '#eff6ff', color: b.moneda === 'USD' ? '#15803d' : '#1d4ed8', border: `1px solid ${b.moneda === 'USD' ? '#bbf7d0' : '#bfdbfe'}` }}>
                                {b.moneda || 'USD'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#334155', fontWeight: '700' }}>
                              {b.cbu || '—'}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#64748b', fontWeight: '600' }}>
                              {b.tipo || 'Corriente'}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px', backgroundColor: isActivo ? '#dcfce7' : '#fee2e2', color: isActivo ? '#166534' : '#991b1b' }}>
                                {isActivo ? '✅ ACTIVO' : '🚫 INACTIVO'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => abrirEditarBanco(b)}
                                  style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0284c7', cursor: 'pointer', fontWeight: '800' }}
                                  title="Editar Banco"
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleActivoBanco(b)}
                                  style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', color: isActivo ? '#d97706' : '#16a34a', cursor: 'pointer', fontWeight: '800' }}
                                  title={isActivo ? 'Desactivar Banco' : 'Activar Banco'}
                                >
                                  <RefreshCw size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => eliminarBancoModal(b.id, b.nombre)}
                                  style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontWeight: '800' }}
                                  title="Eliminar Banco"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => setShowModalBancos(false)} style={{ padding: '9px 24px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#475569', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer' }}>
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
