import React, { useState, useEffect, useCallback, useMemo } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from './supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Upload, FileText, MessageSquare, Paperclip } from 'lucide-react';
import './Requisiciones.css';

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

  // --- FILTROS ---
  const [busqueda, setBusqueda] = useState('');
  const [filtroGerencia, setFiltroGerencia] = useState('Todos');
  const [filtroStatusCompra, setFiltroStatusCompra] = useState('Todos');
  const [proveedores, setProveedores] = useState([]);

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
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('*')
        .eq('correo', session.user.email)
        .single();

      setCurrentUser(perfil);
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
      return matchTexto && matchGerencia && matchStatus;
    });
  }, [historial, busqueda, filtroGerencia, filtroStatusCompra]);

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
        compra_actual_pu: item.pu || 0 // Iniciamos con el último PU sugerido
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

  const eliminarEntradaHistorial = async (idRenglon, indexHistorial) => {
    const esCompras = currentUser?.departamento?.includes('Compras') || currentUser?.departamento?.includes('Administración') || currentUser?.esAdminReal;
    if (!esCompras) return alert("Solo el personal de Compras / Administración puede eliminar registros del historial.");

    if (!window.confirm("¿Está seguro de eliminar esta entrada? El saldo pendiente se restaurará automáticamente.")) return;

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
    // Persistir cambios
    try {
      await supabase
        .from('requisiciones')
        .update({ items: renglonesActualizados })
        .eq('id', editandoId);
      alert("Entrada eliminada y saldos restaurados.");
    } catch (err) {
      alert("Error al persistir eliminación: " + err.message);
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

  const anularRequisicion = async (id) => {
    if (!window.confirm('¿Estás seguro de ANULAR esta requisición? Los renglones asociados en Fondos quedarán disponibles nuevamente.')) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('requisiciones')
        .update({ estado_aprobacion: 'ANULADA', aprobacion_nombre: 'REQ. ANULADA' })
        .eq('id', id);
      if (error) throw error;

      await liberarPartidasFondos(id);

      setHistorial(prev => prev.filter(req => req.id !== id));
      alert('Requisición ANULADA correctamente.');
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const actualizarFila = (id, campo, valor) => {
    setRenglones(prev => prev.map(f => {
      if (f.id === id) {
        let v = valor;
        if (campo === 'compra_actual_pu') v = Math.max(0, Number(valor) || 0);
        if (campo === 'compra_actual_cant') {
          v = Math.max(0, Number(valor) || 0);
          if (v > f.cantidad_pendiente) {
            alert(`No puede comprar más de la cantidad pendiente (${f.cantidad_pendiente})`);
            v = f.cantidad_pendiente;
          }
        }
        const act = { ...f, [campo]: v };

        // Alerta de precio si existe referencia
        const ref = preciosReferencia[f.descripcion.trim().toUpperCase()];
        if (campo === 'compra_actual_pu' && v > 0 && ref) {
          const variacion = ((v - ref) / ref) * 100;
          act.variacion_precio = variacion;
          act.precio_ref_encontrado = ref;
        }

        // El total de esta fila en el modal es lo que se está comprando ahora
        act.total = act.compra_actual_cant * (act.compra_actual_pu || 0);
        return act;
      }
      return f;
    }));
  };

  const subirFactura = async (event) => {
    try {
      setUploading(true);
      const files = Array.from(event.target.files);
      if (!files || files.length === 0) return;

      const uploadPromises = files.map(async (file, index) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `factura_${editandoId}_${Date.now()}_${index}.${fileExt}`;
        const filePath = `private/${fileName}`;

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
      const nuevasUrls = [...urlsActuales, ...nuevasDescargas];

      setFacturasUrls(nuevasUrls);

      // Actualizar inmediatamente en la BD
      const { error: updateError } = await supabase
        .from('requisiciones')
        .update({ facturas_url: nuevasUrls })
        .eq('id', editandoId);

      if (updateError) throw updateError;

      alert("Facturas/Soportes cargados y guardados correctamente.");
      event.target.value = ''; // Limpiar el input
    } catch (error) {
      alert("Error al subir facturas: " + error.message);
    } finally {
      setUploading(false);
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

      setRequisicionActiva(prev => ({ ...prev, observaciones: obsTemporal }));
      setHistorial(prev => prev.map(req => req.id === editandoId ? { ...req, observaciones: obsTemporal } : req));
      setEditandoObs(false);
      alert('Observaciones actualizadas correctamente.');
    } catch (err) {
      alert("Error al actualizar observaciones: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const guardarJustificacion = async () => {
    if (!motivoRetraso || !comentarioRetraso) return alert("Por favor complete el motivo y el comentario.");

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
      alert("Justificación guardada correctamente.");
    } catch (err) {
      alert("Error guardando justificación: " + err.message);
    } finally {
      setLoading(false);
    }
  };
  const guardarCambiosProcesamiento = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const renglonesProcesados = renglones.map(r => {
        if (r.compra_actual_cant > 0) {
          const nuevaTransaccion = {
            fecha: new Date().toISOString(),
            cant: r.compra_actual_cant,
            pu: r.compra_actual_pu,
            metodo_pago: r.metodo_pago_actual || '$ / BS',
            proveedor_id: r.proveedor_seleccionado_id || null,
            proveedor_nombre: proveedores.find(p => p.id === r.proveedor_seleccionado_id)?.razon_social || 'Desconocido',
            usuario_id: currentUser?.id,
            usuario_nombre: `${currentUser?.nombre} ${currentUser?.apellido}`
          };

          const nuevaCantComprada = (r.cantidad_comprada || 0) + r.compra_actual_cant;
          const nuevaCantPendiente = Math.max(0, r.cantidad_pedida - nuevaCantComprada);

          let nuevoStatus = r.status;
          if (nuevaCantPendiente === 0) nuevoStatus = 'Completado';
          else if (nuevaCantComprada > 0) nuevoStatus = 'Parcial';

          return {
            ...r,
            cantidad_comprada: nuevaCantComprada,
            cantidad_pendiente: nuevaCantPendiente,
            historial_compras: [...(r.historial_compras || []), nuevaTransaccion],
            status: nuevoStatus,
            pu_estimado: Number(r.pu_estimado || r.pu || 0), // Guardar el estimado original
            pu: r.compra_actual_pu, // El P.U. principal queda como el último precio real
            compra_actual_cant: 0 // Resetear para la próxima vez
          };
        }
        return r;
      });

      const algunoComprado = renglonesProcesados.some(r => (r.cantidad_comprada || 0) > 0);
      const todasCompletas = renglonesProcesados.every(r => r.cantidad_pendiente === 0);

      let nuevoStatusCompra = 'En espera';
      if (todasCompletas) nuevoStatusCompra = 'Completado';
      else if (algunoComprado) nuevoStatusCompra = 'Parcial';

      // Total Dinámico de la Requisición (Comprado Real + Pendiente Estimado)
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

      alert(todasCompletas ? "Requisición Finalizada / Comprada al 100%." : "Compra parcial registrada con éxito.");
      await cargarRequisicionesAprobadas();
      setShowModal(false);
    } catch (err) {
      alert("Error guardando cambios: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const { subTotalCalculado, totalCalculado } = useMemo(() => {
    // El total del modal debe mostrar el acumulado histórico + cantidad pendiente estimada + la compra actual temporal
    const totalDinamicoModal = (renglones || []).reduce((acc, r) => {
      const yaComprado = (r.historial_compras || []).reduce((sum, t) => {
        if (t.tipo === 'JUSTIFICACION') return sum;
        return sum + (Number(t.cant) || 0) * (Number(t.pu) || 0);
      }, 0);
      const comprandoAhora = (Number(r.compra_actual_cant) || 0) * (Number(r.compra_actual_pu) || 0);

      const cantPendientePre = Number(r.cantidad_pendiente ?? r.cant) || 0;
      const cantPendienteRemanente = Math.max(0, cantPendientePre - (Number(r.compra_actual_cant) || 0));
      const estimadoRemanente = cantPendienteRemanente * Number(r.pu_estimado || r.pu || 0);

      return acc + yaComprado + comprandoAhora + estimadoRemanente;
    }, 0);

    return { subTotalCalculado: totalDinamicoModal, totalCalculado: totalDinamicoModal * 1.16 };
  }, [renglones]);

  const getInitials = (nombre, apellido) => {
    return `${nombre?.charAt(0) || ''}${apellido?.charAt(0) || ''}`.toUpperCase();
  };

  // --- RESTRICCIÓN DE ACCESO (VISTA) ---
  const esDeCompras = currentUser?.departamento === 'Compras' || currentUser?.departamento === 'Administración Maracaibo' || currentUser?.departamento === 'Administración El Tigre' || currentUser?.esAdminReal || currentUser?.rol === 'Gerente General';

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
      <div className="stats-grid" style={{ marginBottom: '25px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        {[
          { label: 'Compras en Espera', val: historial.filter(r => (r.status_compra || 'En espera') === 'En espera').length, status: 'En espera', color: '#64748b', bg: '#f1f5f9' },
          { label: 'Compras Parciales', val: historial.filter(r => r.status_compra === 'Parcial').length, status: 'Parcial', color: '#f59e0b', bg: '#fffbeb' },
          { label: 'Compras Completadas', val: historial.filter(r => r.status_compra === 'Completado').length, status: 'Completado', color: '#16a34a', bg: '#f0fdf4' }
        ].map((s, i) => (
          <motion.div
            key={i}
            whileHover={{ scale: 1.02, translateY: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setFiltroStatusCompra(s.status)}
            style={{
              backgroundColor: s.bg,
              padding: '20px',
              borderRadius: '20px',
              border: `2px solid ${filtroStatusCompra === s.status ? s.color : 'transparent'}`,
              cursor: 'pointer',
              boxShadow: filtroStatusCompra === s.status ? `0 10px 15px -3px ${s.color}20` : 'none',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ fontSize: '0.7rem', fontWeight: '800', color: s.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
            <div style={{ fontSize: '2rem', fontWeight: '900', color: '#1e293b', marginTop: '5px' }}>{s.val}</div>
          </motion.div>
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

        <div style={{ marginTop: '15px', display: 'flex', gap: '15px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔍</span>
            <input
              className="input-tc"
              style={{ width: '100%', paddingLeft: '35px', margin: 0, backgroundColor: 'white', boxSizing: 'border-box' }}
              placeholder="Filtrar por solicitante o folio..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="tc-table">
          <thead>
            <tr>
              <th>ID REQ</th>
              <th>CATEGORÍA</th>
              <th>SOLICITANTE</th>
              <th>C. COSTOS</th>
              <th>GERENCIA</th>
              <th>PRIORIDAD</th>
              <th>TOTAL $</th>
              <th>STATUS DE COMPRA</th>
            </tr>
          </thead>
          <tbody>
            {(loading && historial.length === 0) ? (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px' }}><Loader2 className="animate-spin" /> Cargando...</td></tr>
            ) : historialFiltrado.map(req => (
              <tr key={req.id}>
                <td
                  style={{ fontWeight: 'bold', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => abrirProcesamiento(req)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {req.correlativo}
                    {req.observaciones && (
                      <MessageSquare
                        size={14}
                        style={{
                          color: req.leido_compras_at === null ? '#f59e0b' : '#16a34a',
                          fill: req.leido_compras_at === null ? '#fef3c7' : '#dcfce7'
                        }}
                        title={`Observaciones: ${req.observaciones} ${req.leido_compras_at === null ? '(Nueva)' : '(Leída)'}`}
                      />
                    )}
                    {(req.facturas_url || []).length > 0 && (
                      <Paperclip size={14} style={{ color: '#0ea5e9' }} title="Tiene adjuntos" />
                    )}
                  </div>
                </td>
             
                <td style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b' }}>
                  {req.detalles?.[0]?.categoria || 'N/A'}
                </td>
                <td>{req.solicitante}</td>
                <td>{req.centro_costo}</td>
                <td>{req.gerencia}</td>
                <td><span style={{ color: req.prioridad === 'Alta' ? '#ef4444' : '#0ea5e9', fontWeight: 'bold' }}>{req.prioridad}</span></td>
                <td style={{ fontWeight: 'bold' }}>$ {req.total?.toLocaleString('de-DE')}</td>
                <td>
                  <span style={{
                    backgroundColor: req.status_compra === 'Completado' ? '#dcfce7' : '#fef9c3',
                    color: req.status_compra === 'Completado' ? '#166534' : '#854d0e',
                    padding: '4px 10px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 'bold'
                  }}>
                    {req.status_compra || 'Pendiente'}
                  </span>
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
          <div className="modal-card animate-modal" style={{ maxWidth: '1150px' }}>
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
                  <th>RENG.</th>
                  <th>CATEGORÍA</th>
                  <th>DESCRIPCIÓN</th>
                  <th style={{ textAlign: 'center' }}>PEDIDA</th>
                  <th style={{ textAlign: 'center' }}>COMPRADA</th>
                  <th style={{ textAlign: 'center' }}>PENDIENTE</th>
                  <th style={{ textAlign: 'center', width: '100px' }}>MONEDA</th>
                  <th style={{ textAlign: 'center', width: '150px' }}>PROVEEDOR</th>
                  <th style={{ textAlign: 'right', width: '110px' }}>A COMPRAR</th>
                  <th style={{ textAlign: 'right', width: '120px' }}>P.U. REAL</th>
                  <th style={{ textAlign: 'right' }}>TOTAL $</th>
                  <th>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {renglones.map((f, i) => (
                  <React.Fragment key={f.id}>
                    <tr>
                      <td>{i + 1}</td>
                      <td style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b' }}>{f.categoria || 'N/A'}</td>
                      <td style={{ fontSize: '0.75rem' }}>{f.descripcion}</td>
                      <td style={{ textAlign: 'center', fontWeight: '600' }}>{f.cantidad_pedida}</td>
                      <td style={{ textAlign: 'center', color: '#16a34a', fontWeight: 'bold' }}>{f.cantidad_comprada}</td>
                      <td style={{ textAlign: 'center', color: f.cantidad_pendiente > 0 ? '#ef4444' : '#94a3b8', fontWeight: 'bold' }}>
                        {f.cantidad_pendiente}
                      </td>
                      <td>
                        <select
                          className="input-tc"
                          style={{ fontSize: '0.7rem', padding: '4px' }}
                          value={f.metodo_pago_actual || '$ / BS'}
                          onChange={(e) => actualizarFila(f.id, 'metodo_pago_actual', e.target.value)}
                        >
                          <option value="$ / BS">$ / BS</option>
                          <option value="$ / $">$ / $</option>
                        </select>
                      </td>
                      <td>
                        <select
                          className="input-tc"
                          style={{ fontSize: '0.7rem', padding: '4px', border: f.compra_actual_cant > 0 && !f.proveedor_seleccionado_id ? '2px solid #ef4444' : '' }}
                          value={f.proveedor_seleccionado_id || ''}
                          onChange={(e) => actualizarFila(f.id, 'proveedor_seleccionado_id', Number(e.target.value))}
                          disabled={f.cantidad_pendiente === 0}
                        >
                          <option value="">Seleccione...</option>
                          {proveedores.map(p => (
                            <option key={p.id} value={p.id}>{p.razon_social}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          className="input-tc"
                          type="number"
                          value={f.compra_actual_cant}
                          disabled={f.cantidad_pendiente === 0}
                          style={{ textAlign: 'right', fontWeight: 'bold', border: f.compra_actual_cant > 0 ? '2px solid #0ea5e9' : '' }}
                          onChange={(e) => actualizarFila(f.id, 'compra_actual_cant', e.target.value)}
                        />
                      </td>
                      <td>
                        <div style={{ position: 'relative' }}>
                          <input
                            className="input-tc"
                            type="number"
                            value={f.compra_actual_pu}
                            disabled={f.cantidad_pendiente === 0}
                            style={{
                              textAlign: 'right',
                              fontWeight: 'bold',
                              backgroundColor: (f.variacion_precio >= 15) ? '#fffbeb' : '',
                              borderColor: (f.variacion_precio >= 15) ? '#f59e0b' : ''
                            }}
                            onChange={(e) => actualizarFila(f.id, 'compra_actual_pu', e.target.value)}
                          />
                          {f.variacion_precio >= 15 && (
                            <div style={{
                              position: 'absolute', top: '100%', right: 0,
                              fontSize: '0.6rem', color: '#b45309', fontWeight: 'bold',
                              backgroundColor: '#fffbeb', padding: '2px 5px', borderRadius: '4px',
                              zIndex: 10, border: '1px solid #f59e0b', whiteSpace: 'nowrap'
                            }}>
                              ⚠️ Sube un {f.variacion_precio.toFixed(1)}% (Ref: ${f.precio_ref_encontrado?.toLocaleString()})
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{f.total?.toLocaleString('de-DE')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => {
                              setItemParaJustificar(f);
                              setShowJustificacionModal(true);
                            }}
                            className="btn-tc btn-tc-secondary"
                            style={{ padding: '6px', border: 'none', background: 'none' }}
                            title="Justificar Retraso"
                          >
                            💬
                          </button>
                          <button
                            onClick={() => setExpandirHistorial(prev => ({ ...prev, [f.id]: !prev[f.id] }))}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: (f.historial_compras?.length > 0) ? 1 : 0.3 }}
                            title="Ver Trazabilidad"
                            disabled={!f.historial_compras?.length}
                          >
                            {expandirHistorial[f.id] ? '🔼' : '🕒'}
                          </button>
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
                                    <td style={{ padding: '8px', fontWeight: 'bold', color: h.tipo === 'JUSTIFICACION' ? '#d97706' : '#1e293b' }}>
                                      {h.tipo === 'JUSTIFICACION' ? '⚠️ JUSTIFICACIÓN' : '✅ COMPRADO'}
                                    </td>
                                    <td style={{ padding: '8px', fontSize: '0.65rem', fontWeight: 'bold', color: '#64748b' }}>
                                      {h.tipo !== 'JUSTIFICACION' ? (h.proveedor_nombre || 'No asignado') : '-'}
                                    </td>
                                    <td style={{ padding: '8px' }}>
                                      {h.tipo === 'JUSTIFICACION' ? (
                                        <div style={{ fontStyle: 'italic', color: '#92400e' }}>Motivo: {h.motivo}</div>
                                      ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                          <span style={{ fontSize: '0.65rem', backgroundColor: '#e2e8f0', padding: '2px 5px', borderRadius: '4px' }}>{h.metodo_pago}</span>
                                          PROCESADO
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
                                      {(currentUser?.departamento?.includes('Compras') || currentUser?.esAdminReal) && (
                                        <button
                                          onClick={() => eliminarEntradaHistorial(f.id, idx)}
                                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}
                                          title="Eliminar Registro"
                                        >
                                          🗑️
                                        </button>
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
                  {facturasUrls.map((url, idx) => {
                    const isImg = /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(url.split('?')[0]);
                    return (
                      <div key={idx} style={{ position: 'relative', group: 'true' }}>
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
                              <span style={{ fontSize: '0.5rem', fontWeight: 'bold', marginTop: '4px', color: '#64748b' }}>PDF</span>
                            </div>
                          )}
                        </a>
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
                <div className="totals-container" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '1rem' }}>SUB-TOTAL:</span>
                    <span style={{ fontWeight: 'bold', fontSize: '1.4rem' }}>$ {subTotalCalculado.toLocaleString('de-DE')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #e2e8f0', paddingTop: '10px' }}>
                    <span style={{ fontWeight: '900', color: '#1e293b', fontSize: '1.2rem' }}>TOTAL FINAL (C/IVA):</span>
                    <span style={{ fontSize: '2rem', fontWeight: '900', color: '#0ea5e9' }}>$ {totalCalculado.toLocaleString('de-DE')}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '25px' }}>

                  <button className="btn-tc btn-tc-secondary" onClick={() => setShowModal(false)} style={{ padding: '12px 25px' }}>Cancelar</button>
                  <button className="btn-tc btn-tc-primary" onClick={guardarCambiosProcesamiento} disabled={loading} style={{ padding: '12px 30px' }}>
                    {loading ? <Loader2 className="animate-spin" size={16} /> : 'Actualizar'}
                  </button>
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
