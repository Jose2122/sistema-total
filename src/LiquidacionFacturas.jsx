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
  const [bancos, setBancos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subiendoAbono, setSubiendoAbono] = useState(false);
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState('Todos');
  const [proveedores, setProveedores] = useState([]);
  const [filtroTipoProveedor, setFiltroTipoProveedor] = useState('Todos');
  const [filtroProveedor, setFiltroProveedor] = useState('Todos');

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
        fecha_asignacion: fechaRef,
        observaciones: observacionesFondoInput || `Asignación de Fondo desde Cuentas por Pagar (${semanaCalculada})`,
        usuario_id: currentUser?.id || null,
        usuario_nombre: `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim() || 'Finanzas CxP'
      };

      const { error } = await supabase.from('presupuesto_compras').insert([payload]);
      if (error) throw error;

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
    return Array.from(provs).sort((a, b) => a.localeCompare(b));
  }, [facturasAgrupadas]);

  // Filtered invoices for display
  const facturasFiltradas = useMemo(() => {
    return facturasAgrupadas.filter(fac => {
      const matchesSearch =
        fac.doc_numero.toLowerCase().includes(filtroBusqueda.toLowerCase()) ||
        fac.proveedor_nombre.toLowerCase().includes(filtroBusqueda.toLowerCase());

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
