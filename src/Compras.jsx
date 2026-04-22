import React, { useState, useEffect, useCallback, useMemo } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Upload, FileText, MessageSquare, Paperclip, Clock, CheckCircle2, AlertCircle, ShoppingBag } from 'lucide-react';
import './Requisiciones.css';
import './ReportesMaestro.css';

const Compras = () => {
  const [historial, setHistorial] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [expandirHistorial, setExpandirHistorial] = useState({}); // { itemID: boolean }
  const [editandoObs, setEditandoObs] = useState(false);
  const [obsTemporal, setObsTemporal] = useState('');
  const inputRefs = React.useRef({}); // { itemId: { doc_numero, proveedor, cant, pu, save } }

  // --- FILTROS ---
  const [busqueda, setBusqueda] = useState('');
  const [filtroGerencia, setFiltroGerencia] = useState('Todos');
  const [filtroStatusCompra, setFiltroStatusCompra] = useState('Todos');
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  const [filtroCentroCosto, setFiltroCentroCosto] = useState('Todos');
  const [proveedores, setProveedores] = useState([]);

  const categoriasUnicas = useMemo(() => {
    const cats = new Set();
    historial.forEach(req => {
      (req.items || []).forEach(it => { if (it.categoria) cats.add(it.categoria); });
    });
    return ['Todos', ...Array.from(cats).sort()];
  }, [historial]);

  const centrosCostoUnicos = useMemo(() => {
    const ccs = new Set(historial.map(r => r.centro_costo).filter(Boolean));
    return ['Todos', ...Array.from(ccs).sort()];
  }, [historial]);

  const gerenciasUnicas = useMemo(() => {
    const gs = new Set(historial.map(r => r.gerencia).filter(Boolean));
    return ['Todos', ...Array.from(gs).sort()];
  }, [historial]);

  // --- ESTADOS DEL FORMULARIO (PARA PROCESAMIENTO) ---
  const [requisicionActiva, setRequisicionActiva] = useState(null);
  const [renglones, setRenglones] = useState([]);
  const [facturasUrls, setFacturasUrls] = useState([]);
  const [showJustificacionModal, setShowJustificacionModal] = useState(false);
  const [itemParaJustificar, setItemParaJustificar] = useState(null);
  const [motivoRetraso, setMotivoRetraso] = useState('');
  const [comentarioRetraso, setComentarioRetraso] = useState('');
  const [preciosReferencia, setPreciosReferencia] = useState({}); // { descripcion: ultimoPrecio }

  const obtenerSesionUsuario = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email) {
      const email = session.user.email.toLowerCase();
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('*')
        .eq('correo', session.user.email)
        .single();

      if (perfil) {
        const esAdminReal = email === 'jcontreras.totalclean@gmail.com' || email === 'cvega.totalclean@gmail.com';
        setCurrentUser({ ...perfil, esAdminReal });
      }
    }
  }, []);

  const cargarRequisicionesAprobadas = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('requisiciones')
        .select('*')
        .eq('estado_aprobacion', 'aprobado_final')
        .order('fecha_emision', { ascending: false });

      if (error) throw error;
      setHistorial(data.map(db => ({
        ...db,
        correlativo: db.correlativo_req,
        total: db.total_bs,
        detalles: db.items,
        fecha: db.fecha_emision ? db.fecha_emision.split('T')[0] : ''
      })));
    } catch (err) {
      console.error("Error cargando compras:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const cargarProveedores = useCallback(async () => {
    const { data, error } = await supabase
      .from('proveedores')
      .select('*')
      .eq('status', true)
      .order('razon_social', { ascending: true });
    if (!error) setProveedores(data);
  }, []);

  useEffect(() => { obtenerSesionUsuario(); }, [obtenerSesionUsuario]);
  useEffect(() => {
    cargarRequisicionesAprobadas();
    cargarProveedores();

    const channel = supabase
      .channel('compras_realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'requisiciones' }, (payload) => {
        setHistorial(prev => prev.map(req => {
          if (req.id === payload.new.id) {
            return {
              ...req,
              observaciones: payload.new.observaciones || '',
              facturas_url: payload.new.facturas_url || []
            };
          }
          return req;
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cargarRequisicionesAprobadas, cargarProveedores]);

  const historialFiltrado = useMemo(() => {
    return historial.filter(req => {
      const matchTexto =
        req.solicitante.toLowerCase().includes(busqueda.toLowerCase()) ||
        req.correlativo.toLowerCase().includes(busqueda.toLowerCase());
      const matchGerencia = filtroGerencia === 'Todos' || req.gerencia === filtroGerencia;
      const matchStatus = filtroStatusCompra === 'Todos' || (req.status_compra || 'En espera') === filtroStatusCompra;
      const matchCC = filtroCentroCosto === 'Todos' || req.centro_costo === filtroCentroCosto;
      const matchCat = filtroCategoria === 'Todos' || (req.items || []).some(it => it.categoria === filtroCategoria);
      
      return matchTexto && matchGerencia && matchStatus && matchCC && matchCat;
    });
  }, [historial, busqueda, filtroGerencia, filtroStatusCompra, filtroCentroCosto, filtroCategoria]);

  const abrirProcesamiento = async (req) => {
    setRequisicionActiva(req);
    setEditandoId(req.id);

    // Silenciosamente marcar como leído
    if (req.leido_compras_at === null) {
      await supabase
        .from('requisiciones')
        .update({ leido_compras_at: new Date().toISOString() })
        .eq('id', req.id)
        .select();

      // Update local state temporarily to reflect it instantly
      req.leido_compras_at = new Date().toISOString();
      setHistorial(prev => prev.map(h => h.id === req.id ? { ...h, leido_compras_at: req.leido_compras_at } : h));
    }

    // Inicializar campos de control para compras fraccionadas si no existen
    const renglonesIniciados = (req.detalles || []).map(item => {
      const cantidad_pedida = item.cantidad_pedida || item.cant || 0;
      const cantidad_comprada = item.cantidad_comprada || 0;
      const cantidad_pendiente = Math.max(0, cantidad_pedida - cantidad_comprada);

      return {
        ...item,
        cantidad_pedida,
        cantidad_comprada,
        cantidad_pendiente,
        historial_compras: item.historial_compras || [],
        compra_actual_cant: 0,
        compra_actual_pu: item.pu || 0, // Iniciamos con el último PU sugerido
        doc_tipo_actual: item.doc_tipo || 'FAC',
        doc_numero_actual: '', // Siempre vacío por defecto para evitar errores
        proveedor_seleccionado_id: '' // Siempre vacío por defecto
      };
    });

    setRenglones(renglonesIniciados);
    setFacturasUrls(req.facturas_url || []);
    setShowModal(true);
    setExpandirHistorial({});
    obtenerPreciosReferencia(renglonesIniciados);
  };

  const obtenerPreciosReferencia = async (itemsActuales) => {
    try {
      // Buscar en las últimas 50 requisiciones completadas/aprobadas
      const { data, error } = await supabase
        .from('requisiciones')
        .select('items')
        .eq('estado_aprobacion', 'aprobado_final')
        .order('fecha_emision', { ascending: false })
        .limit(50);

      if (error) throw error;

      const referencias = {};
      // Escanear de más vieja a más nueva para que la última (más reciente) prevalezca
      data.reverse().forEach(req => {
        (req.items || []).forEach(item => {
          if (item.historial_compras?.length > 0) {
            // Obtener el último precio real registrado en el historial de ese ítem
            const compras = item.historial_compras.filter(h => h.tipo !== 'JUSTIFICACION');
            if (compras.length > 0) {
              referencias[item.descripcion.trim().toUpperCase()] = compras[compras.length - 1].pu;
            }
          }
        });
      });

      setPreciosReferencia(referencias);
    } catch (err) {
      console.error("Error obteniendo precios de referencia:", err.message);
    }
  };

  const liquidarNC = async (idRenglon, indexHistorial) => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '500' }}>¿Confirmar el pago de esta Nota de Crédito? El documento pasará a estado PAGADO.</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => { toast.dismiss(t.id); ejecutarLiquidacionNC(idRenglon, indexHistorial); }}
            style={{ padding: '4px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            SÍ, PAGAR
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            style={{ padding: '4px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            NO
          </button>
        </div>
      </div>
    ), { duration: 5000, position: 'top-center' });
  };

  const ejecutarLiquidacionNC = async (idRenglon, indexHistorial) => {
    setLoading(true);
    try {
      const renglonesActualizados = renglones.map(r => {
        if (r.id === idRenglon) {
          const nuevoHistorial = [...r.historial_compras];
          const entrada = { ...nuevoHistorial[indexHistorial] };
          entrada.metodo_pago = 'PAGADO (NC)';
          entrada.doc_tipo = 'FAC'; // Se convierte en factura al pagarse
          entrada.fecha_pago = new Date().toISOString();
          nuevoHistorial[indexHistorial] = entrada;

          const tieneCreditos = nuevoHistorial.some(h => h.doc_tipo === 'NC' || h.metodo_pago?.includes('CRÉDITO'));
          let nuevoStatus = r.status;
          if (!tieneCreditos && r.cantidad_pendiente === 0) nuevoStatus = 'Completado';

          return { ...r, historial_compras: nuevoHistorial, status: nuevoStatus };
        }
        return r;
      });

      const { error } = await supabase
        .from('requisiciones')
        .update({ items: renglonesActualizados })
        .eq('id', editandoId);

      if (error) throw error;
      setRenglones(renglonesActualizados);
      toast.success("NC Liquidada correctamente.");
    } catch (err) {
      toast.error("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const eliminarEntradaHistorial = async (idRenglon, indexHistorial) => {
    const rolUpper = (currentUser?.rol || '').toUpperCase();
    const deptoUpper = (currentUser?.departamento || '').toUpperCase();
    const esCompras = deptoUpper.includes('COMPRAS') ||
      deptoUpper.includes('ADMINISTRACIÓN') ||
      currentUser?.esAdminReal ||
      rolUpper === 'ADMIN' ||
      rolUpper === 'GERENTE GENERAL';
    if (!esCompras) return toast.error("Solo el personal de Compras / Administración puede eliminar registros del historial.");

    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>¿Está seguro de eliminar esta entrada? El saldo pendiente se restaurará automáticamente.</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => { toast.dismiss(t.id); ejecutarEliminacionHistorial(idRenglon, indexHistorial); }}
            style={{ padding: '4px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            ELIMINAR
          </button>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 12px', background: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>CANCELAR</button>
        </div>
      </div>
    ), { duration: 5000 });
  };

  const ejecutarEliminacionHistorial = async (idRenglon, indexHistorial) => {
    const renglonesActualizados = renglones.map(r => {
      if (r.id === idRenglon) {
        const entrada = r.historial_compras[indexHistorial];
        let nuevaCantComprada = r.cantidad_comprada;
        let nuevaCantPendiente = r.cantidad_pendiente;

        if (entrada.tipo !== 'JUSTIFICACION') {
          nuevaCantComprada -= (entrada.cant || 0);
          nuevaCantPendiente += (entrada.cant || 0);
        }

        const nuevoHistorial = [...r.historial_compras];
        nuevoHistorial.splice(indexHistorial, 1);

        return {
          ...r,
          cantidad_comprada: Math.max(0, nuevaCantComprada),
          cantidad_pendiente: Math.max(0, nuevaCantPendiente),
          historial_compras: nuevoHistorial,
          status: nuevaCantComprada === 0 ? 'En Espera' : 'Parcial'
        };
      }
      return r;
    });

    setRenglones(renglonesActualizados);
    try {
      await supabase
        .from('requisiciones')
        .update({ items: renglonesActualizados })
        .eq('id', editandoId);
      toast.success("Entrada eliminada y saldos restaurados.");
    } catch (err) {
      toast.error("Error al persistir eliminación: " + err.message);
    }
  };

  const generarMinutaPDF = () => {
    const doc = new jsPDF('p', 'pt', 'letter');
    const margins = 40;
    let y = 50;

    // --- HEADER ---
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text("MINUTA DE GESTIÓN DE COMPRA", margins, y);
    y += 25;

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`REQUISICIÓN: ${requisicionActiva.correlativo}`, margins, y);
    doc.text(`FECHA REPORTE: ${new Date().toLocaleDateString()}`, doc.internal.pageSize.width - margins, y, { align: 'right' });
    y += 15;
    doc.text(`GERENCIA: ${requisicionActiva.gerencia}`, margins, y);
    y += 30;

    // --- TABLA DE SALDOS ---
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text("Resumen de Cantidades", margins, y);
    y += 15;

    const headersResumen = [["ITEM", "PEDIDA", "COMPRADA", "PENDIENTE"]];
    const dataResumen = renglones.map(r => [
      r.descripcion.substring(0, 40),
      r.cantidad_pedida,
      r.cantidad_comprada,
      r.cantidad_pendiente
    ]);

    doc.autoTable({
      startY: y,
      head: headersResumen,
      body: dataResumen,
      theme: 'grid',
      headStyles: { fillOver: [14, 165, 233], textColor: 255 },
      styles: { fontSize: 8 }
    });
    y = doc.lastAutoTable.finalY + 30;

    // --- HISTORIAL DETALLADO ---
    doc.text("Historial Detallado de Transacciones", margins, y);
    y += 15;

    const headersHistorial = [["FECHA", "TIPO", "DETALLE", "CANT", "P.U.", "TOTAL", "PAGO", "USUARIO"]];
    const dataHistorial = [];
    renglones.forEach(r => {
      (r.historial_compras || []).forEach(h => {
        dataHistorial.push([
          new Date(h.fecha).toLocaleDateString(),
          h.tipo === 'JUSTIFICACION' ? 'JUSTIF.' : 'COMPRA',
          h.tipo === 'JUSTIFICACION' ? (h.motivo || '').substring(0, 20) : r.descripcion.substring(0, 20),
          h.cant || '-',
          h.pu ? `$ ${h.pu.toLocaleString()}` : '-',
          h.cant && h.pu ? `$ ${(h.cant * h.pu).toLocaleString()}` : '-',
          h.metodo_pago || '-',
          (h.usuario_nombre || '').split(' ')[0]
        ]);
      });
    });

    doc.autoTable({
      startY: y,
      head: headersHistorial,
      body: dataHistorial,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      styles: { fontSize: 7 }
    });
    y = doc.lastAutoTable.finalY + 80;

    // --- FIRMAS ---
    const pageHeight = doc.internal.pageSize.height;
    if (y > pageHeight - 100) { doc.addPage(); y = 50; }

    doc.line(margins, y, margins + 180, y);
    doc.line(doc.internal.pageSize.width - margins - 180, y, doc.internal.pageSize.width - margins, y);
    y += 15;
    doc.setFontSize(9);
    doc.text("FIRMA COMPRAS", margins + 90, y, { align: 'center' });
    doc.text("FIRMA ADMINISTRACIÓN", doc.internal.pageSize.width - margins - 90, y, { align: 'center' });

    doc.save(`Minuta_Compra_${requisicionActiva.correlativo}.pdf`);
  };

  const liberarPartidasFondos = async (requisicionId) => {
    try {
      const { error } = await supabase
        .from('partidas_fondos')
        .update({ status: 'Disponible', requisicion_id: null })
        .eq('requisicion_id', requisicionId);
      if (error) throw error;
    } catch (err) {
      console.error("Error al liberar partidas:", err.message);
    }
  };

  const actualizarTotalesSolicitud = async (requisicionId) => {
    try {
      // 1. Buscar la solicitud vinculada a esta requisición
      const { data: partidasRel } = await supabase
        .from('partidas_fondos')
        .select('solicitud_id')
        .eq('requisicion_id', requisicionId)
        .limit(1);

      if (!partidasRel || partidasRel.length === 0) return;
      const solicitudId = partidasRel[0].solicitud_id;

      // 2. Obtener todas las partidas de esa solicitud con su data de compra
      const { data: todasLasPartidas } = await supabase
        .from('partidas_fondos')
        .select('*, requisiciones(items)')
        .eq('solicitud_id', solicitudId);

      if (!todasLasPartidas) return;

      let montoEstimado = 0;
      let montoEjecutado = 0;
      let montoPendiente = 0;

      todasLasPartidas.forEach(p => {
        const estRow = (parseFloat(p.pu_bs) || parseFloat(p.pu_usd) || 0) * (parseFloat(p.cantidad) || 1);
        montoEstimado += estRow;

        let ejecutadoRow = 0;
        let pendienteRow = estRow;

        if (p.requisiciones && p.requisiciones.items) {
          const itemReq = p.requisiciones.items.find(item =>
            item.descripcion === p.descripcion &&
            (item.cantidad_pedida === p.cantidad || item.cant === p.cantidad)
          );

          if (itemReq) {
            ejecutadoRow = (itemReq.historial_compras || []).reduce((sum, h) => {
              if (h.tipo === 'JUSTIFICACION') return sum;
              return sum + ((parseFloat(h.cant) || 0) * (parseFloat(h.pu) || 0));
            }, 0);

            const cantPend = parseFloat(itemReq.cantidad_pendiente ?? itemReq.cant) || 0;
            const puEst = parseFloat(itemReq.pu_estimado ?? itemReq.pu) || 0;
            pendienteRow = cantPend * puEst;
          }
        }

        montoEjecutado += ejecutadoRow;
        montoPendiente += pendienteRow;
      });

      // 3. Persistir en la tabla solicitudes_fondos
      const payload = {
        monto_estimado: montoEstimado,
        monto_ejecutado: montoEjecutado,
        monto_pendiente: montoPendiente,
        diferencia_final: montoEstimado - montoEjecutado,
        status: montoPendiente === 0 ? 'FINALIZADA' : 'ACTIVA'
      };

      await supabase.from('solicitudes_fondos').update(payload).eq('id', solicitudId);

    } catch (err) {
      console.error("Error sincronizando totales de solicitud:", err.message);
    }
  };

  const anularRequisicion = async (id) => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>¿Estás seguro de ANULAR esta requisición? Los renglones asociados en Fondos quedarán disponibles nuevamente.</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => { toast.dismiss(t.id); ejecutarAnulacion(id); }}
            style={{ padding: '4px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            ANULAR
          </button>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 12px', background: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>CANCELAR</button>
        </div>
      </div>
    ), { duration: 6000 });
  };

  const ejecutarAnulacion = async (id) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('requisiciones')
        .update({ estado_aprobacion: 'ANULADA', aprobacion_nombre: 'REQ. ANULADA' })
        .eq('id', id);
      if (error) throw error;

      await liberarPartidasFondos(id);

      // NOTIFICAR AL SOLICITANTE
      const reqAnulada = historial.find(h => h.id === id);
      if (reqAnulada?.user_id) {
        await enviarNotificacion(reqAnulada.user_id, `Tu Requisición ${reqAnulada.correlativo} ha sido ANULADA.`, 'Anulación');
      }

      setHistorial(prev => prev.filter(req => req.id !== id));
      toast.success('Requisición ANULADA correctamente.');
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  const actualizarFila = (id, campo, valor) => {
    setRenglones(prev => prev.map(f => {
      if (f.id === id) {
        let v = valor;
        if (campo === 'compra_actual_pu') v = Math.max(0, Number(valor) || 0);
        if (campo === 'compra_actual_cant') {
          v = Math.max(0, Number(valor) || 0);
        }

        const act = { ...f, [campo]: v };

        // CÁLCULO EN TIEMPO REAL: TOTAL $
        const c = campo === 'compra_actual_cant' ? v : (act.compra_actual_cant || 0);
        const p = campo === 'compra_actual_pu' ? v : (act.compra_actual_pu || 0);
        act.total = Number(c) * Number(p);

        // Alerta de precio si existe referencia
        const descKey = (f.descripcion || '').trim().toUpperCase();
        const ref = descKey ? preciosReferencia[descKey] : null;
        if (campo === 'compra_actual_pu' && v > 0 && ref) {
          const variacion = ((v - ref) / ref) * 100;
          act.variacion_precio = variacion;
          act.precio_ref_encontrado = ref;
        }

        return { ...act, hasChanges: true };
      }
      return f;
    }));
  };

  const handleKeyDown = (e, id, currentField) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const sequence = ['doc_numero', 'proveedor', 'cant', 'pu', 'save'];
      const nextIdx = sequence.indexOf(currentField) + 1;

      if (nextIdx < sequence.length) {
        const nextField = sequence[nextIdx];
        inputRefs.current[id]?.[nextField]?.focus();
      } else if (currentField === 'save') {
        guardarUnicoRenglon(id);
      }
    }
  };

  const guardarUnicoRenglon = async (id) => {
    if (loading) return;
    const item = renglones.find(r => r.id === id);
    if (!item || !item.hasChanges) return;

    // VALIDACIÓN: Si está comprando, debe tener Factura y Proveedor
    if (item.compra_actual_cant > 0) {
      if (item.compra_actual_cant > item.cantidad_pendiente) {
        toast.error(`No puede comprar más de la cantidad pendiente (${item.cantidad_pendiente})`, { id: 'error-cantidad' });
        return;
      }
      if (!item.doc_numero_actual?.trim() || !item.proveedor_seleccionado_id) {
        toast.error("Debe indicar Número de Factura y Proveedor para procesar este ítem.", { id: 'error-campos' });
        return;
      }
    }

    setLoading(true);
    try {
      // VALIDACIÓN DE DATOS OBLIGATORIOS (NÚMERO, CANTIDAD Y PROVEEDOR)
      if (!item.doc_numero_actual || !item.doc_numero_actual.trim()) {
        toast.error("Error: El número de " + (item.doc_tipo_actual || 'FAC/NC') + " es obligatorio para procesar la compra.");
        setLoading(false);
        return;
      }
      if (Number(item.compra_actual_cant || 0) <= 0) {
        toast.error("Error: Debe ingresar una CANTIDAD REAL mayor a 0 para procesar la compra.");
        setLoading(false);
        return;
      }
      if (!item.proveedor_seleccionado_id) {
        toast.error("Error: Debe seleccionar un PROVEEDOR para procesar la compra.");
        setLoading(false);
        return;
      }

      // 1. Preparar la nueva transacción si hay cantidad
      const nuevaTransaccion = item.compra_actual_cant > 0 ? {
        fecha: new Date().toISOString(),
        cant: item.compra_actual_cant,
        pu: item.compra_actual_pu,
        metodo_pago: item.metodo_pago_actual || '$ / BS',
        proveedor_id: item.proveedor_seleccionado_id || null,
        proveedor_nombre: proveedores.find(p => p.id === item.proveedor_seleccionado_id)?.razon_social || 'Desconocido',
        usuario_id: currentUser?.id,
        usuario_nombre: `${currentUser?.nombre} ${currentUser?.apellido}`,
        doc_tipo: item.doc_tipo_actual,
        doc_numero: item.doc_numero_actual
      } : null;

      const nuevaCantComprada = (item.cantidad_comprada || 0) + (item.compra_actual_cant || 0);
      const nuevaCantPendiente = Math.max(0, item.cantidad_pedida - nuevaCantComprada);

      // LÓGICA DE STATUS CON CRÉDITO (NC)
      let nuevoStatus = item.status;
      const esCredito = item.doc_tipo_actual === 'NC';

      if (esCredito) {
        nuevoStatus = 'POR PAGAR (NC)';
      } else {
        const tieneCreditosPrevios = (item.historial_compras || []).some(h => h.doc_tipo === 'NC' || h.metodo_pago?.includes('CRÉDITO'));
        if (nuevaCantPendiente === 0) {
          nuevoStatus = tieneCreditosPrevios ? 'POR PAGAR (NC)' : 'Completado';
        } else if (nuevaCantComprada > 0) {
          nuevoStatus = 'Parcial';
        }
      }

      if (nuevaTransaccion && esCredito) {
        nuevaTransaccion.metodo_pago = 'CRÉDITO (NC)';
      }

      const renglonProcesado = {
        ...item,
        cantidad_comprada: nuevaCantComprada,
        cantidad_pendiente: nuevaCantPendiente,
        historial_compras: nuevaTransaccion ? [...(item.historial_compras || []), nuevaTransaccion] : (item.historial_compras || []),
        status: nuevoStatus,
        pu: item.compra_actual_pu || item.pu,
        compra_actual_cant: 0,
        doc_tipo: item.doc_tipo_actual,
        doc_numero: item.doc_numero_actual,
        doc_numero_actual: '', // LIMPIAR DESPUÉS DE GUARDAR
        proveedor_seleccionado_id: '', // LIMPIAR DESPUÉS DE GUARDAR
        hasChanges: false
      };

      // 2. Actualizar en el estado local todos los renglones
      const nuevosRenglones = renglones.map(r => r.id === id ? renglonProcesado : r);

      // 3. Recalcular Totales de la Requisición (para la DB)
      const totalDinamicoReal = nuevosRenglones.reduce((acc, r) => {
        const ejecutadoItem = (r.historial_compras || []).reduce((sum, t) => sum + ((Number(t.cant) || 0) * (Number(t.pu) || 0)), 0);
        const estimadoPendiente = (Number(r.cantidad_pendiente) || 0) * Number(r.pu_estimado || 0);
        return acc + ejecutadoItem + estimadoPendiente;
      }, 0);

      const { error } = await supabase
        .from('requisiciones')
        .update({
          items: nuevosRenglones,
          total_bs: totalDinamicoReal * 1.16
        })
        .eq('id', editandoId);

      if (error) throw error;

      setRenglones(nuevosRenglones);
      await actualizarTotalesSolicitud(editandoId);
      toast.success("Ítem guardado con éxito.");
    } catch (err) {
      toast.error("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const renombrarAdjunto = async (idx, nuevoNombre) => {
    const nuevasUrls = [...facturasUrls];
    const item = nuevasUrls[idx];

    // Si es un string (viejo formato), convertir a objeto
    if (typeof item === 'string') {
      nuevasUrls[idx] = { url: item, etiqueta: nuevoNombre };
    } else {
      nuevasUrls[idx] = { ...item, etiqueta: nuevoNombre };
    }

    setFacturasUrls(nuevasUrls);
    try {
      await supabase.from('requisiciones').update({ facturas_url: nuevasUrls }).eq('id', editandoId);
    } catch (err) { console.error(err); }
  };

  const eliminarSoporteReal = async (idx, url) => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>¿Está seguro de eliminar permanentemente este soporte? Se borrará tanto del registro como del servidor.</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => { toast.dismiss(t.id); ejecutarEliminacionSoporte(idx, url); }}
            style={{ padding: '4px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            ELIMINAR
          </button>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 12px', background: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>CANCELAR</button>
        </div>
      </div>
    ), { duration: 5000 });
  };

  const ejecutarEliminacionSoporte = async (idx, url) => {
    try {
      setUploading(true);
      let bucketName = '';
      if (url.includes('comprobantes')) bucketName = 'comprobantes';
      else if (url.includes('facturas')) bucketName = 'facturas';

      let filePath = '';
      if (bucketName) {
        const searchStr = bucketName + '/';
        const bIndex = url.indexOf(searchStr);
        if (bIndex !== -1) {
          filePath = url.substring(bIndex + searchStr.length).split('?')[0];
        } else {
          filePath = url.split('?')[0];
        }
      }

      if (bucketName && filePath) {
        const { error: storageError } = await supabase.storage
          .from(bucketName)
          .remove([filePath]);

        if (storageError) console.warn("Aviso: El archivo físico no se pudo borrar (puede que no exista):", storageError.message);
      }

      const nuevasUrls = facturasUrls.filter((_, i) => i !== idx);
      const { error: dbError } = await supabase
        .from('requisiciones')
        .update({ facturas_url: nuevasUrls })
        .eq('id', editandoId);

      if (dbError) throw dbError;

      setFacturasUrls(nuevasUrls);
      toast.success("Soporte eliminado físicamente.");
    } catch (err) {
      toast.error("Error al eliminar soporte: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const subirFactura = async (event) => {
    try {
      setUploading(true);
      const files = Array.from(event.target.files);
      if (!files || files.length === 0) return;

      const uploadPromises = files.map(async (file, index) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `factura_${editandoId}_${Date.now()}_${index}.${fileExt}`;
        const filePath = `${fileName}`; // Subir a la raíz para máxima compatibilidad publicUrl

        const { error: uploadError } = await supabase.storage
          .from('facturas')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // OBTENER LA URL PÚBLICA CORRECTAMENTE
        const { data: { publicUrl } } = supabase.storage.from('facturas').getPublicUrl(filePath);
        return publicUrl;
      });

      const nuevasDescargas = await Promise.all(uploadPromises);

      // RECARGAR DATA ACTUAL PARA EVITAR SOBREESCRIBIR
      const { data: currentReq } = await supabase.from('requisiciones').select('facturas_url').eq('id', editandoId).single();
      const urlsActuales = currentReq?.facturas_url || [];
      const nuevasUrls = [...urlsActuales, ...nuevasDescargas.map(url => ({ url, etiqueta: 'Archivo sin etiqueta' }))];

      setFacturasUrls(nuevasUrls);

      // Actualizar inmediatamente en la BD
      const { error: updateError } = await supabase
        .from('requisiciones')
        .update({ facturas_url: nuevasUrls })
        .eq('id', editandoId);

      if (updateError) throw updateError;

      toast.success("Facturas/Soportes cargados y guardados correctamente.");
      event.target.value = ''; // Limpiar el input
    } catch (error) {
      toast.error("Error al subir facturas: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const enviarNotificacion = async (usuario_id, mensaje, tipo = 'Sistema') => {
    if (!usuario_id || usuario_id === currentUser?.id) return;
    try {
      await supabase.from('notificaciones').insert([{
        usuario_id,
        mensaje,
        tipo,
        leido: false
      }]);
    } catch (err) {
      console.error("Error enviando notificación:", err);
    }
  };

  const guardarObservacionesDirecto = async () => {
    if (!editandoId) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('requisiciones')
        .update({ observaciones: obsTemporal, leido_compras_at: new Date().toISOString() })
        .eq('id', editandoId)
        .select();
      if (error) throw error;

      // NOTIFICAR AL SOLICITANTE
      if (requisicionActiva?.user_id) {
        await enviarNotificacion(requisicionActiva.user_id, `Compras dejó una observación en tu REQ ${requisicionActiva.correlativo}`, 'Observación');
      }

      setRequisicionActiva(prev => ({ ...prev, observaciones: obsTemporal }));
      setHistorial(prev => prev.map(req => req.id === editandoId ? { ...req, observaciones: obsTemporal } : req));
      setEditandoObs(false);
      toast.success('Observaciones actualizadas correctamente.');
    } catch (err) {
      toast.error("Error al actualizar observaciones: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const guardarJustificacion = async () => {
    if (!motivoRetraso || !comentarioRetraso) return toast.error("Por favor complete el motivo y el comentario.");

    setLoading(true);
    try {
      const nuevaJustificacion = {
        fecha: new Date().toISOString(),
        tipo: 'JUSTIFICACION',
        motivo: motivoRetraso,
        comentario: comentarioRetraso,
        usuario_id: currentUser?.id,
        usuario_nombre: `${currentUser?.nombre} ${currentUser?.apellido}`
      };

      const renglonesActualizados = renglones.map(r => {
        if (r.id === itemParaJustificar.id) {
          return {
            ...r,
            historial_compras: [...(r.historial_compras || []), nuevaJustificacion]
          };
        }
        return r;
      });

      // Guardar inmediatamente en la base de datos para que sea visible en tiempo real
      console.log("Intentando guardar justificación para ID:", editandoId, "Items:", renglonesActualizados);

      const { data, error } = await supabase
        .from('requisiciones')
        .update({ items: renglonesActualizados })
        .eq('id', editandoId)
        .select();

      if (error) {
        console.error("Error de Supabase:", error);
        throw error;
      }

      console.log("Respuesta de guardado:", data);

      setRenglones(renglonesActualizados);
      setShowJustificacionModal(false);
      setMotivoRetraso('');
      setComentarioRetraso('');
      toast.success("Justificación guardada correctamente.");
    } catch (err) {
      toast.error("Error guardando justificación: " + err.message);
    } finally {
      setLoading(false);
    }
  };
  const intentarCerrarModal = () => {
    const hayCambios = renglones.some(r => r.hasChanges);
    if (hayCambios) {
      toast((t) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b' }}>
            ⚠️ Tienes cambios sin guardar
          </p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
            Si sales ahora, perderás los datos ingresados en la tabla. ¿Deseas salir de todos modos?
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '5px' }}>
            <button
              onClick={() => { toast.dismiss(t.id); setShowModal(false); }}
              style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
            >
              SALIR SIN GUARDAR
            </button>
            <button
              onClick={() => toast.dismiss(t.id)}
              style={{ padding: '6px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}
            >
              CONTINUAR EDITANDO
            </button>
          </div>
        </div>
      ), { duration: 6000, position: 'top-center' });
    } else {
      setShowModal(false);
    }
  };

  const guardarCambiosProcesamiento = async (esBorrador = false) => {
    if (loading) return;

    // Validación de seguridad adicional si no es borrador
    if (!esBorrador) {
      const excedeCant = renglones.find(r => r.compra_actual_cant > r.cantidad_pendiente);
      if (excedeCant) {
        toast.error(`El ítem ${excedeCant.descripcion} excede la cantidad pendiente.`, { id: 'error-cantidad' });
        return;
      }
      const faltanDatos = renglones.some(r => r.compra_actual_cant > 0 && (!r.doc_numero_actual?.trim() || !r.proveedor_seleccionado_id));
      if (faltanDatos) {
        toast.error("Debe completar Factura y Proveedor en todos los ítems que está comprando.", { id: 'error-campos' });
        return;
      }
    }

    setLoading(true);
    try {
      const renglonesProcesados = renglones.map(r => {
        // Combinar datos temporales si hay compra actual o si estamos guardando Doc/N° Doc
        if (r.compra_actual_cant > 0 || esBorrador) {
          const nuevaTransaccion = r.compra_actual_cant > 0 ? {
            fecha: new Date().toISOString(),
            cant: r.compra_actual_cant,
            pu: r.compra_actual_pu,
            metodo_pago: r.metodo_pago_actual || '$ / BS',
            proveedor_id: r.proveedor_seleccionado_id || null,
            proveedor_nombre: proveedores.find(p => p.id === r.proveedor_seleccionado_id)?.razon_social || 'Desconocido',
            usuario_id: currentUser?.id,
            usuario_nombre: `${currentUser?.nombre} ${currentUser?.apellido}`,
            doc_tipo: r.doc_tipo_actual,
            doc_numero: r.doc_numero_actual
          } : null;

          const nuevaCantComprada = (r.cantidad_comprada || 0) + (r.compra_actual_cant || 0);
          const nuevaCantPendiente = Math.max(0, r.cantidad_pedida - nuevaCantComprada);

          let nuevoStatus = r.status;
          if (nuevaCantPendiente === 0) nuevoStatus = 'Completado';
          else if (nuevaCantComprada > 0) nuevoStatus = 'Parcial';

          return {
            ...r,
            cantidad_comprada: nuevaCantComprada,
            cantidad_pendiente: nuevaCantPendiente,
            historial_compras: nuevaTransaccion ? [...(r.historial_compras || []), nuevaTransaccion] : (r.historial_compras || []),
            status: nuevoStatus,
            pu_estimado: Number(r.pu_estimado || r.pu || 0),
            pu: r.compra_actual_pu || r.pu,
            compra_actual_cant: 0,
            doc_tipo: r.doc_tipo_actual,
            doc_numero: r.doc_numero_actual
          };
        }
        return r;
      });

      const algunoComprado = renglonesProcesados.some(r => (r.cantidad_comprada || 0) > 0);
      const todasCompletas = renglonesProcesados.every(r => r.cantidad_pendiente === 0);

      let nuevoStatusCompra = requisicionActiva.status_compra || 'En espera';
      if (!esBorrador) {
        if (todasCompletas) nuevoStatusCompra = 'Completado';
        else if (algunoComprado) nuevoStatusCompra = 'Parcial';
      }

      const totalDinamicoReal = renglonesProcesados.reduce((acc, r) => {
        const ejecutadoItem = (r.historial_compras || []).reduce((sum, t) => {
          if (t.tipo === 'JUSTIFICACION') return sum;
          return sum + ((Number(t.cant) || 0) * (Number(t.pu) || 0));
        }, 0);
        const estimadoPendiente = (Number(r.cantidad_pendiente ?? r.cant) || 0) * Number(r.pu_estimado || r.pu || 0);
        return acc + ejecutadoItem + estimadoPendiente;
      }, 0);

      const totalConIVA = totalDinamicoReal * 1.16;

      const { error } = await supabase
        .from('requisiciones')
        .update({
          items: renglonesProcesados,
          total_bs: totalConIVA,
          status_compra: nuevoStatusCompra
        })
        .eq('id', editandoId);

      if (error) throw error;

      await actualizarTotalesSolicitud(editandoId);

      if (esBorrador) {
        toast.success("Borrador guardado correctamente.");
        setRequisicionActiva(prev => ({ ...prev, items: renglonesProcesados }));
      } else {
        toast.success(todasCompletas ? "Requisición Finalizada / Comprada al 100%." : "Compra parcial registrada con éxito.");
        
        // NOTIFICAR AL SOLICITANTE SI SE COMPLETÓ
        if (todasCompletas && requisicionActiva?.user_id) {
          await enviarNotificacion(requisicionActiva.user_id, `¡Tu Requisición ${requisicionActiva.correlativo} ha sido COMPLETADA! Todos los ítems fueron procesados.`, 'Compra Lista');
        }

        await cargarRequisicionesAprobadas();
        setShowModal(false);
      }
    } catch (err) {
      toast.error("Error guardando cambios: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const { subTotalCalculado, totalCalculado, montoPagadoF, montoPendienteNE } = useMemo(() => {
    const totals = (renglones || []).reduce((acc, r) => {
      const yaComprado = (r.historial_compras || []).reduce((sum, t) => {
        if (t.tipo === 'JUSTIFICACION') return sum;
        const val = (Number(t.cant) || 0) * (Number(t.pu) || 0);
        if (t.doc_tipo === 'NC') acc.totalNE += val;
        else acc.totalF += val; // FAC o por defecto
        return sum + val;
      }, 0);

      const comprandoAhora = (Number(r.compra_actual_cant) || 0) * (Number(r.compra_actual_pu) || 0);
      if ((r.compra_actual_cant || 0) > 0) {
        if (r.doc_tipo_actual === 'NC') acc.totalNE += comprandoAhora;
        else acc.totalF += comprandoAhora;
      }

      const cantPendientePre = Number(r.cantidad_pendiente ?? r.cant) || 0;
      const cantPendienteRemanente = Math.max(0, cantPendientePre - (Number(r.compra_actual_cant) || 0));
      const estimadoRemanente = cantPendienteRemanente * Number(r.pu_estimado || r.pu || 0);

      acc.subTotal += yaComprado + comprandoAhora + estimadoRemanente;
      return acc;
    }, { subTotal: 0, totalF: 0, totalNE: 0 });

    return {
      subTotalCalculado: totals.subTotal,
      totalCalculado: totals.subTotal * 1.16,
      montoPagadoF: totals.totalF,
      montoPendienteNE: totals.totalNE
    };
  }, [renglones]);

  const getInitials = (nombre, apellido) => {
    return `${nombre?.charAt(0) || ''}${apellido?.charAt(0) || ''}`.toUpperCase();
  };

  // --- RESTRICCIÓN DE ACCESO (VISTA) ---
  const rolUpperFinal = (currentUser?.rol || '').toUpperCase();
  const deptoUpperFinal = (currentUser?.departamento || '').toUpperCase();

  const esDeCompras = deptoUpperFinal.includes('COMPRAS') ||
    deptoUpperFinal.includes('ADMINISTRACIÓN') ||
    currentUser?.esAdminReal ||
    rolUpperFinal === 'GERENTE GENERAL' ||
    rolUpperFinal === 'ADMIN';

  if (!esDeCompras && currentUser) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>No tiene permisos para acceder al módulo de Compras.</div>;
  }

  return (
    <motion.div
      className="animate-main"
      style={{ padding: '25px', backgroundColor: '#f1f5f9', minHeight: '100vh', boxSizing: 'border-box' }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' }}>
        {[
          { label: 'REQUISICIONES EN ESPERA', val: `${historial.filter(r => (r.status_compra || 'En espera') === 'En espera').length} No leídas`, col: '#030712', filter: 'En espera' },
          { label: 'COMPRAS EN PROCESO', val: `${historial.filter(r => r.status_compra === 'Parcial').length} Parciales`, col: '#030712', filter: 'Parcial' },
          { label: 'COMPRAS FINALIZADAS', val: `${historial.filter(r => r.status_compra === 'Completado').length} Completas`, col: '#030712', filter: 'Completado' },
        ].map((x, i) => (
          <div
            key={i}
            className="stat-card"
            onClick={() => setFiltroStatusCompra(x.filter)}
            style={{
              cursor: 'pointer',
              backgroundColor: filtroStatusCompra === x.filter ? '#f8fafc' : 'white',
              padding: '18px',
              borderRadius: '12px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              transition: 'all 0.2s ease',
              border: '1px solid #e2e8f0',
              borderLeft: `6px solid ${x.col}`
            }}
          >
            <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>{x.label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#1e293b', marginTop: '5px' }}>{x.val}</div>
          </div>
        ))}
      </div>

      <div className="table-container" style={{ marginBottom: '10px', padding: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', color: '#1e293b' }}>Procesamiento de Compras</h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Gestión de requisiciones con aprobación de Gerencia General</p>
          </div>
          {filtroStatusCompra !== 'Todos' && (
            <button
              onClick={() => setFiltroStatusCompra('Todos')}
              style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#0ea5e9', border: '1px solid #0ea5e9', padding: '4px 10px', borderRadius: '8px', background: 'white' }}
            >
              Ver Todas
            </button>
          )}
        </div>

        <div style={{ marginTop: '15px', display: 'flex', gap: '15px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔍</span>
            <input
              className="input-tc"
              style={{ width: '100%', paddingLeft: '35px', margin: 0, backgroundColor: 'white', boxSizing: 'border-box' }}
              placeholder="Filtrar por solicitante o folio..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          
          <select 
            className="input-tc" 
            style={{ width: '180px', margin: 0 }}
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
          >
            <option value="Todos">Todas las Categorías</option>
            {categoriasUnicas.filter(c => c !== 'Todos').map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select 
            className="input-tc" 
            style={{ width: '180px', margin: 0 }}
            value={filtroCentroCosto}
            onChange={(e) => setFiltroCentroCosto(e.target.value)}
          >
            <option value="Todos">Centro de Costo</option>
            {centrosCostoUnicos.filter(c => c !== 'Todos').map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select 
            className="input-tc" 
            style={{ width: '180px', margin: 0 }}
            value={filtroGerencia}
            onChange={(e) => setFiltroGerencia(e.target.value)}
          >
            <option value="Todos">Gerencia</option>
            {gerenciasUnicas.filter(g => g !== 'Todos').map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      <div className="table-container" style={{ padding: 0, overflow: 'hidden', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
        <table className="tc-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '150px', padding: '12px 15px' }}>ID REQ</th>
              <th style={{ padding: '12px 15px' }}>CATEGORÍA</th>
              <th style={{ padding: '12px 15px' }}>SOLICITANTE</th>
              <th style={{ padding: '12px 15px' }}>C. COSTOS</th>
              <th style={{ padding: '12px 15px' }}>GERENCIA</th>
              <th style={{ textAlign: 'center', width: '120px', padding: '12px 15px' }}>PRIORIDAD</th>
              <th style={{ textAlign: 'right', padding: '12px 15px' }}>TOTAL $</th>
              <th style={{ textAlign: 'center', width: '140px', padding: '12px 15px' }}>ESTATUS</th>
            </tr>
          </thead>
          <tbody>
            {(loading && historial.length === 0) ? (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px' }}><Loader2 className="animate-spin" /> Cargando...</td></tr>
            ) : historialFiltrado.map(req => (
              <tr key={req.id} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td
                  style={{ fontWeight: 'bold', color: 'var(--primary)', cursor: 'pointer', padding: '8px 15px' }}
                  onClick={() => abrirProcesamiento(req)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ textDecoration: 'underline' }}>{req.correlativo}</span>
                    {req.observaciones && (
                      <MessageSquare
                        size={14}
                        style={{
                          color: req.leido_compras_at === null ? '#f59e0b' : '#16a34a',
                          fill: req.leido_compras_at === null ? '#fef3c7' : '#dcfce7'
                        }}
                      />
                    )}
                    {(req.facturas_url || []).length > 0 && (
                      <Paperclip size={14} style={{ color: '#0ea5e9' }} />
                    )}
                  </div>
                </td>

                <td style={{ padding: '8px 15px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={req.items?.[0]?.descripcion}>
                    {req.items?.[0]?.descripcion || 'Sin descripción'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '500' }}>
                    {req.items?.[0]?.categoria || 'N/A'} {req.items?.length > 1 ? <span style={{ color: '#0ea5e9' }}>(+{req.items.length - 1} más)</span> : ''}
                  </div>
                </td>
                <td style={{ padding: '8px 15px', color: '#475569', fontSize: '0.9rem' }}>{req.solicitante}</td>
                <td style={{ padding: '8px 15px', color: '#475569', fontSize: '0.85rem' }}>{req.centro_costo}</td>
                <td style={{ padding: '8px 15px', color: '#475569', fontSize: '0.85rem' }}>{req.gerencia}</td>
                <td style={{ textAlign: 'center', padding: '8px 15px' }}>
                  {req.prioridad === 'Alta' ? (
                    <span style={{ color: '#ef4444', fontSize: '0.65rem', fontWeight: '900' }}>⚠️ ALTA</span>
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: '0.65rem', fontWeight: '700' }}>NORMAL</span>
                  )}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#1e293b', padding: '8px 15px' }}>
                  $ {(req.total || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ textAlign: 'center', padding: '8px 15px' }}>
                  {(() => {
                    const status = req.status_compra || 'En espera';
                    let bg = '#f1f5f9';
                    let color = '#475569';
                    if (status === 'Completado') { bg = '#dcfce7'; color = '#15803d'; }
                    else if (status === 'Parcial') { bg = '#ffedd5'; color = '#c2410c'; }
                    else if (status === 'En espera') { bg = '#fef9c3'; color = '#a16207'; }
                    
                    return (
                      <span style={{
                        backgroundColor: bg,
                        color: color,
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.65rem',
                        fontWeight: '900',
                        textTransform: 'uppercase',
                        display: 'inline-block',
                        minWidth: '85px'
                      }}>
                        {status}
                      </span>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {historialFiltrado.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No hay requisiciones pendientes por comprar.</div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card animate-modal" style={{ maxWidth: '1450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0 }}>Gestión de Compra: {requisicionActiva?.correlativo}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      backgroundColor: '#1e293b', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.85rem', fontWeight: 'bold'
                    }}>
                      {getInitials(currentUser?.nombre, currentUser?.apellido)}
                    </div>
                    <span style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1e293b' }}>
                      {requisicionActiva?.solicitante}
                    </span>
                  </div>
                  <div style={{
                    backgroundColor: '#334155', color: 'white',
                    padding: '6px 14px', borderRadius: '8px',
                    fontSize: '0.95rem', fontWeight: 'bold',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>CC:</span>
                    {requisicionActiva?.centro_costo}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>Status de Compra</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '900', color: requisicionActiva?.status_compra === 'Completado' ? '#15803d' : '#854d0e' }}>
                  {requisicionActiva?.status_compra || 'EN ESPERA'}
                </div>
              </div>
            </div>

            <div className="req-header-line" style={{ margin: '20px 0 15px 0' }}></div>

            <div style={{
              backgroundColor: '#f1f5f9',
              padding: '12px 18px',
              borderRadius: '10px',
              borderLeft: '4px solid #94a3b8',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <label style={{
                  fontSize: '0.65rem',
                  fontWeight: '900',
                  color: '#475569',
                  textTransform: 'uppercase',
                  display: 'block',
                  margin: 0
                }}>
                  Justificación Operativa
                </label>
              </div>
              <p style={{
                margin: 0,
                color: '#1e293b',
                fontSize: '0.95rem',
                fontWeight: '500',
                lineHeight: '1.4'
              }}>
                {requisicionActiva?.justificacion || 'Sin justificación registrada'}
              </p>
            </div>

            <div style={{
              backgroundColor: '#fffbeb',
              padding: '12px 18px',
              borderRadius: '10px',
              borderLeft: '4px solid #f59e0b',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <label style={{
                  fontSize: '0.65rem',
                  fontWeight: '900',
                  color: '#92400e',
                  textTransform: 'uppercase',
                  display: 'block',
                  margin: 0
                }}>
                  Observaciones
                </label>
                {!editandoObs && (
                  <button
                    onClick={() => {
                      setObsTemporal(requisicionActiva?.observaciones || '');
                      setEditandoObs(true);
                    }}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
                    title="Editar Observaciones"
                  >
                    ✏️
                  </button>
                )}
              </div>
              {editandoObs ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <textarea
                    className="input-tc"
                    style={{ minHeight: '80px', paddingTop: '10px' }}
                    value={obsTemporal}
                    onChange={(e) => setObsTemporal(e.target.value)}
                    placeholder="Actualice las observaciones aquí..."
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn-tc btn-tc-success"
                      style={{ padding: '4px 12px', fontSize: '0.7rem' }}
                      onClick={guardarObservacionesDirecto}
                    >
                      ✓ GUARDAR
                    </button>
                    <button
                      className="btn-tc btn-tc-secondary"
                      style={{ padding: '4px 12px', fontSize: '0.7rem' }}
                      onClick={() => setEditandoObs(false)}
                    >
                      CANCELAR
                    </button>
                  </div>
                </div>
              ) : (
                <p style={{
                  margin: 0,
                  color: '#1e293b',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  lineHeight: '1.4'
                }}>
                  {requisicionActiva?.observaciones || 'Sin observaciones registradas'}
                </p>
              )}
            </div>

            <table className="tc-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={{ width: '40px' }}>N°</th>
                  <th style={{ width: '120px' }}>PRODUCTO</th>
                  <th style={{ textAlign: 'center', width: '60px' }}>PED.</th>
                  <th style={{ textAlign: 'center', width: '60px' }}>COMP.</th>
                  <th style={{ textAlign: 'center', width: '60px' }}>PEND.</th>
                  <th style={{ textAlign: 'center', width: '320px' }}>DETALLE PAGO / PROVEEDOR</th>
                  <th style={{ textAlign: 'right', width: '100px' }}>CANT. REAL</th>
                  <th style={{ textAlign: 'right', width: '110px' }}>P.U. REAL</th>
                  <th style={{ textAlign: 'right', width: '100px' }}>TOTAL $</th>
                  <th style={{ textAlign: 'center', width: '130px' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {renglones.map((f, i) => (
                  <React.Fragment key={f.id}>
                    <tr style={{
                      backgroundColor: (Number(f.cantidad_comprada || 0) + Number(f.compra_actual_cant || 0)) >= Number(f.cantidad_pedida) ? '#f0fdf4' : 'transparent',
                      borderLeft: (Number(f.cantidad_comprada || 0) + Number(f.compra_actual_cant || 0)) >= Number(f.cantidad_pedida) ? '4px solid #16a34a' : 'none',
                      transition: 'all 0.3s ease'
                    }}>
                      <td style={{ fontWeight: 'bold' }}>{i + 1}</td>
                      <td style={{ verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '0.9rem' }}>{f.descripcion}</div>
                        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>{f.categoria}</div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: '650', color: '#64748b' }}>{f.cantidad_pedida}</td>
                      <td style={{ textAlign: 'center', color: '#16a34a', fontWeight: '800' }}>{f.cantidad_comprada}</td>
                      <td style={{
                        textAlign: 'center',
                        fontWeight: '800',
                        color: f.cantidad_pendiente > 0 ? '#f97316' : '#94a3b8'
                      }}>{f.cantidad_pendiente}</td>

                      {/* CELDA COMPACTA PAGO / PROVEEDOR */}
                      <td>
                        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px', alignItems: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '9px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase' }}>Documento / #</span>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <select
                                className="input-tc focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                style={{ fontSize: '10px', padding: '2px', width: '50px', border: '1px solid #cbd5e1', height: '32px' }}
                                value={f.doc_tipo_actual || 'FAC'}
                                onChange={(e) => actualizarFila(f.id, 'doc_tipo_actual', e.target.value)}
                              >
                                <option value="FAC">FAC</option>
                                <option value="NC">NC</option>
                              </select>
                              <input
                                className="input-tc focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                style={{ fontSize: '11px', padding: '4px 8px', width: '65px', border: '1px solid #cbd5e1', fontWeight: 'bold', height: '32px' }}
                                value={f.doc_numero_actual || ''}
                                onChange={(e) => actualizarFila(f.id, 'doc_numero_actual', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, f.id, 'doc_numero')}
                                ref={el => { if (!inputRefs.current[f.id]) inputRefs.current[f.id] = {}; inputRefs.current[f.id].doc_numero = el; }}
                                placeholder="000"
                              />
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '9px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase' }}>Proveedor y Moneda de Pago</span>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <select
                                className="input-tc focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                style={{ flex: 1, fontSize: '11px', padding: '4px', fontWeight: 'bold', border: '1px solid #cbd5e1', height: '32px' }}
                                value={f.proveedor_seleccionado_id || ''}
                                onChange={(e) => actualizarFila(f.id, 'proveedor_seleccionado_id', Number(e.target.value))}
                                onKeyDown={(e) => handleKeyDown(e, f.id, 'proveedor')}
                                ref={el => { if (!inputRefs.current[f.id]) inputRefs.current[f.id] = {}; inputRefs.current[f.id].proveedor = el; }}
                                disabled={f.cantidad_pendiente === 0}
                              >
                                <option value="">Proveedor</option>
                                {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
                              </select>
                              <select
                                className="input-tc focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                style={{ width: '65px', fontSize: '10px', padding: '2px', height: '32px', border: '1px solid #cbd5e1', fontWeight: '800' }}
                                value={f.metodo_pago_actual || '$ / BS'}
                                onChange={(e) => actualizarFila(f.id, 'metodo_pago_actual', e.target.value)}
                              >
                                <option value="$ / BS">$ / BS</option>
                                <option value="$ / $">$ / $</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', textAlign: 'right' }}>COMPRAR</span>
                          <input
                            className="input-tc focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            type="number"
                            value={f.compra_actual_cant}
                            disabled={f.cantidad_pendiente === 0}
                            style={{
                              textAlign: 'right',
                              fontWeight: '900',
                              fontSize: '13px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                            }}
                            onChange={(e) => actualizarFila(f.id, 'compra_actual_cant', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, f.id, 'cant')}
                            ref={el => { if (!inputRefs.current[f.id]) inputRefs.current[f.id] = {}; inputRefs.current[f.id].cant = el; }}
                          />
                        </div>
                      </td>

                      <td style={{ verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', textAlign: 'right' }}>P.U. REAL</span>
                          <div style={{ position: 'relative' }}>
                            <input
                              className="input-tc focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                              type="number"
                              value={f.compra_actual_pu}
                              disabled={f.cantidad_pendiente === 0}
                              style={{
                                textAlign: 'right',
                                fontWeight: '900',
                                fontSize: '13px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                              }}
                              onChange={(e) => actualizarFila(f.id, 'compra_actual_pu', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, f.id, 'pu')}
                              ref={el => { if (!inputRefs.current[f.id]) inputRefs.current[f.id] = {}; inputRefs.current[f.id].pu = el; }}
                            />
                            {f.variacion_precio >= 15 && (
                              <div style={{ position: 'absolute', top: '-15px', right: 0, fontSize: '8px', color: '#ef4444', fontWeight: '900' }}>
                                ▲ {f.variacion_precio.toFixed(0)}%
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: '900', color: '#0f172a', fontSize: '1rem' }}>
                        $ {f.total?.toLocaleString('de-DE')}
                        {(Number(f.cantidad_comprada || 0) + Number(f.compra_actual_cant || 0)) >= Number(f.cantidad_pedida) ? (
                          <div style={{ fontSize: '9px', color: '#14532d', fontWeight: '900' }}>COMPLETO ✓</div>
                        ) : (Number(f.cantidad_comprada || 0) + Number(f.compra_actual_cant || 0)) > 0 ? (
                          <div style={{ fontSize: '9px', color: '#f97316', fontWeight: '900' }}>PARCIAL</div>
                        ) : null}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          {f.hasChanges && !loading && (
                            <button
                              onClick={() => guardarUnicoRenglon(f.id)}
                              onKeyDown={(e) => handleKeyDown(e, f.id, 'save')}
                              ref={el => { if (!inputRefs.current[f.id]) inputRefs.current[f.id] = {}; inputRefs.current[f.id].save = el; }}
                              className="btn-tc btn-tc-primary focus:ring-2 focus:ring-green-500 outline-none transition-all"
                              style={{ padding: '6px 10px', fontSize: '0.65rem', fontWeight: 'bold', background: '#22c55e', border: 'none' }}
                              title="Guardar este renglón"
                            >
                              💾 GUARDAR
                            </button>
                          )}
                          <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '2px', backgroundColor: '#f1f5f9' }}>
                            <button
                              onClick={() => {
                                setItemParaJustificar(f);
                                setShowJustificacionModal(true);
                              }}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', fontSize: '1.1rem' }}
                              title="Agregar Comentario / Justificación"
                            >
                              💬
                            </button>
                            <button
                              onClick={() => setExpandirHistorial(prev => ({ ...prev, [f.id]: !prev[f.id] }))}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', fontSize: '1.1rem', opacity: (f.historial_compras?.length > 0) ? 1 : 0.3 }}
                              title="Ver Historial"
                              disabled={!f.historial_compras?.length}
                            >
                              {expandirHistorial[f.id] ? '🔼' : '🕒'}
                            </button>
                            <button
                              onClick={() => {
                                toast((t) => (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <p style={{ margin: 0, fontSize: '0.85rem' }}>¿Anular este renglón?</p>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                      <button
                                        onClick={() => { toast.dismiss(t.id); actualizarFila(f.id, 'status', 'ANULADO'); }}
                                        style={{ padding: '2px 8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                                      >
                                        ANULAR
                                      </button>
                                      <button onClick={() => toast.dismiss(t.id)} style={{ padding: '2px 8px', background: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>NO</button>
                                    </div>
                                  </div>
                                ));
                              }}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', fontSize: '1.1rem' }}
                              title="Anular Renglón"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                    {expandirHistorial[f.id] && f.historial_compras?.length > 0 && (
                      <tr>
                        <td colSpan="10" style={{ padding: '0 0 15px 50px' }}>
                          <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                            <div style={{ padding: '8px 12px', backgroundColor: '#f1f5f9', fontSize: '0.7rem', fontWeight: 'bold', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                              <span>HISTORIAL DE COMPRAS REALIZADAS</span>
                              <span>{f.historial_compras.length} transacciones</span>
                            </div>
                            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                                  <th style={{ padding: '8px', textAlign: 'left' }}>FECHA</th><th style={{ padding: '8px', textAlign: 'left' }}>TIPO</th><th style={{ padding: '8px', textAlign: 'left' }}>PROVEEDOR</th>
                                  <th style={{ padding: '8px', textAlign: 'left' }}>DETALLE / MOTIVO</th>
                                  <th style={{ padding: '8px', textAlign: 'center' }}>CANT.</th>
                                  <th style={{ padding: '8px', textAlign: 'right' }}>P.U. REAL</th>
                                  <th style={{ padding: '8px', textAlign: 'right' }}>TOTAL / COMENTARIO</th>
                                  <th style={{ padding: '8px', textAlign: 'right' }}>COMPRADOR</th>
                                  <th style={{ padding: '8px', textAlign: 'center' }}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {f.historial_compras.map((h, idx) => (
                                  <tr key={idx} style={{
                                    borderBottom: idx < f.historial_compras.length - 1 ? '1px solid #f1f5f9' : 'none',
                                    backgroundColor: h.tipo === 'JUSTIFICACION' ? '#fffbeb' : 'transparent'
                                  }}>
                                    <td style={{ padding: '8px' }}>{new Date(h.fecha).toLocaleDateString()}</td>
                                    <td style={{ padding: '8px', fontWeight: 'bold', color: h.tipo === 'JUSTIFICACION' ? '#d97706' : (h.doc_tipo === 'NC' ? '#f59e0b' : '#1e293b') }}>
                                      {h.tipo === 'JUSTIFICACION' ? '⚠️ JUSTIFICACIÓN' : (h.doc_tipo === 'NC' ? '💳 A CRÉDITO' : '✅ COMPRADO')}
                                    </td>
                                    <td style={{ padding: '8px', fontSize: '0.65rem', fontWeight: 'bold', color: '#64748b' }}>
                                      {h.tipo !== 'JUSTIFICACION' ? (h.proveedor_nombre || 'No asignado') : '-'}
                                    </td>
                                    <td style={{ padding: '8px' }}>
                                      {h.tipo === 'JUSTIFICACION' ? (
                                        <div style={{ fontStyle: 'italic', color: '#92400e' }}>Motivo: {h.motivo}</div>
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <span style={{ fontSize: '0.65rem', backgroundColor: '#e2e8f0', padding: '2px 5px', borderRadius: '4px', fontWeight: 'bold' }}>{h.metodo_pago}</span>
                                            <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#475569' }}>{h.doc_tipo}: {h.doc_numero}</span>
                                          </div>
                                          {h.fecha_pago && (
                                            <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: '700' }}>
                                              📅 PAGADO EL: {new Date(h.fecha_pago).toLocaleDateString()}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>{h.cant || '-'}</td>
                                    <td style={{ padding: '8px', textAlign: 'right' }}>{h.pu ? `$ ${h.pu.toLocaleString('de-DE')}` : '-'}</td>
                                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                                      {h.tipo === 'JUSTIFICACION' ? (
                                        <div style={{ fontSize: '0.7rem', color: '#64748b', whiteSpace: 'pre-wrap', textAlign: 'left' }}>
                                          {h.comentario}
                                        </div>
                                      ) : `$ ${(h.cant * h.pu).toLocaleString('de-DE')}`}
                                    </td>
                                    <td style={{ padding: '8px', textAlign: 'right', color: '#64748b' }}>{h.usuario_nombre}</td>
                                    <td style={{ padding: '8px', textAlign: 'center' }}>
                                      {(deptoUpperFinal.includes('COMPRAS') || currentUser?.esAdminReal || rolUpperFinal === 'ADMIN' || rolUpperFinal === 'GERENTE GENERAL') && (
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                          {(h.doc_tipo === 'NC' || h.metodo_pago?.includes('CRÉDITO')) && h.metodo_pago !== 'PAGADO (NC)' && (
                                            <button
                                              onClick={() => liquidarNC(f.id, idx)}
                                              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#0ea5e9' }}
                                              title="Confirmar Pago NC"
                                            >
                                              💸
                                            </button>
                                          )}
                                          <button
                                            onClick={() => eliminarEntradaHistorial(f.id, idx)}
                                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}
                                            title="Eliminar Registro"
                                          >
                                            🗑️
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: '40px' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 15px 0', fontSize: '0.9rem', color: '#1e293b' }}>🧾 Soporte de Documentos</h4>
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
                  {facturasUrls.map((item, idx) => {
                    const url = typeof item === 'string' ? item : item?.url;
                    const etiqueta = typeof item === 'string' ? 'Archivo' : (item?.etiqueta || 'Sin etiqueta');
                    if (!url || url.length < 5) return null;
                    
                    const isImg = /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(url.split('?')[0]);
                    return (
                      <div key={idx} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '5px', width: '80px' }}>
                        <a href={url} target="_blank" rel="noreferrer" style={{
                          display: 'block',
                          width: '80px', height: '80px',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          border: '2px solid #e2e8f0',
                          backgroundColor: 'white',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}>
                          {isImg ? (
                            <img src={url} alt={`Preview ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{
                              width: '100%', height: '100%',
                              display: 'flex', flexDirection: 'column',
                              alignItems: 'center', justifyContent: 'center',
                              backgroundColor: '#f8fafc', color: '#ef4444'
                            }}>
                              <FileText size={32} />
                            </div>
                          )}
                        </a>
                        <input 
                          type="text" 
                          placeholder="Nombre..."
                          value={etiqueta}
                          onChange={(e) => renombrarAdjunto(idx, e.target.value)}
                          style={{
                            fontSize: '0.6rem',
                            padding: '2px 4px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            width: '100%',
                            boxSizing: 'border-box',
                            backgroundColor: 'white',
                            textAlign: 'center'
                          }}
                        />
                        <button
                          onClick={() => eliminarSoporteReal(idx, url)}
                          style={{ position: 'absolute', top: '-8px', right: '-8px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '22px', height: '22px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', fontWeight: 'bold', zIndex: 10 }}
                          title="Eliminar Soporte Definitivamente"
                        >
                          X
                        </button>
                      </div>
                    );
                  })}
                </div>
                <label className="btn-tc btn-tc-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}>
                  {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                  <span>{uploading ? 'Subiendo...' : 'Adjuntar Documento'}</span>
                  <input type="file" multiple hidden onChange={subirFactura} disabled={uploading} />
                </label>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div className="financial-summary-grid">
                  <div className="financial-item">
                    <span className="financial-label">Facturado (Pagado/FAC)</span>
                    <span className="financial-val" style={{ color: '#16a34a' }}>$ {montoPagadoF.toLocaleString('de-DE')}</span>
                  </div>
                  <div className="financial-item">
                    <span className="financial-label">Nota de Crédito (CRÉDITO)</span>
                    <span className="financial-val" style={{ color: '#f59e0b' }}>$ {montoPendienteNE.toLocaleString('de-DE')}</span>
                  </div>
                </div>

                <div className="totals-container" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '1rem' }}>SUB-TOTAL ($ / BS):</span>
                    <span style={{ fontWeight: 'bold', fontSize: '1.4rem' }}>$ {subTotalCalculado.toLocaleString('de-DE')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #e2e8f0', paddingTop: '10px' }}>
                    <span style={{ fontWeight: '900', color: '#1e293b', fontSize: '1.2rem' }}>TOTAL FINAL (C/IVA):</span>
                    <span style={{ fontSize: '2rem', fontWeight: '900', color: '#0ea5e9' }}>$ {totalCalculado.toLocaleString('de-DE')}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '25px' }}>
                  <button
                    className="btn-tc btn-tc-secondary"
                    onClick={intentarCerrarModal}
                    style={{ padding: '12px 25px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}
                  >
                    CERRAR
                  </button>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      className="btn-tc"
                      onClick={() => guardarCambiosProcesamiento(true)}
                      disabled={loading}
                      style={{ padding: '12px 25px', backgroundColor: 'transparent', border: '2px solid #1e293b', color: '#1e293b', fontWeight: 'bold' }}
                    >
                      {loading ? <Loader2 className="animate-spin" size={16} /> : 'GUARDAR BORRADOR'}
                    </button>
                    <button
                      className="btn-tc btn-tc-success"
                      onClick={() => guardarCambiosProcesamiento(false)}
                      disabled={loading || !renglones.every(r => r.compra_actual_cant > 0 ? (r.doc_numero_actual?.trim() && r.proveedor_seleccionado_id) : true)}
                      style={{ padding: '12px 30px', backgroundColor: '#16a34a', color: 'white', fontWeight: '900', boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)' }}
                    >
                      {loading ? <Loader2 className="animate-spin" size={16} /> : 'PROCESAR COMPRA'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

      {/* --- MODAL DE JUSTIFICACIÓN DE RETRASO --- */}
      {showJustificacionModal && (
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
          <div className="modal-card animate-modal" style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#1e293b' }}>Justificación de Retraso / Avance</h3>
              <button onClick={() => setShowJustificacionModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '5px' }}>
                ÍTEM: {itemParaJustificar?.descripcion}
              </label>
              <select
                className="input-tc"
                value={motivoRetraso}
                onChange={(e) => setMotivoRetraso(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">Seleccione un motivo...</option>
                <option value="Disponibilidad Presupuestaria">Disponibilidad Presupuestaria</option>
                <option value="Ítem no Localizado">Ítem no Localizado</option>
                <option value="Definición Técnica Insuficiente">Definición Técnica Insuficiente</option>
                <option value="En Espera de Aprobación Precios">En Espera de Aprobación Precios</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '5px' }}>
                COMENTARIO DETALLADO  (OBLIGATORIO)
              </label>
              <textarea
                className="input-tc"
                style={{ width: '100%', minHeight: '120px', paddingTop: '10px' }}
                placeholder="Explique el estado o problema específico..."
                value={comentarioRetraso}
                onChange={(e) => setComentarioRetraso(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn-tc btn-tc-secondary" onClick={() => setShowJustificacionModal(false)}>Cancelar</button>
              <button
                className="btn-tc btn-tc-primary"
                onClick={guardarJustificacion}
                disabled={loading}
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : 'Guardar Justificación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default Compras;
