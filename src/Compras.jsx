import React, { useState, useEffect, useCallback, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Upload, FileText, MessageSquare, Paperclip, Clock, CheckCircle2, AlertCircle, ShoppingBag, ChevronDown, X } from 'lucide-react';
import './Requisiciones.css';
import './ReportesMaestro.css';

const FormularioAdjuntoToast = ({ cantProcesar, onConfirm, onCancel }) => {
  const [docNumero, setDocNumero] = useState('');
  const [docTipo, setDocTipo] = useState('FAC');
  const [fileName, setFileName] = useState('Soporte Compra');
  const [file, setFile] = useState(null);
  const [duplicateUrl, setDuplicateUrl] = useState(null);
  const [loadingCheck, setLoadingCheck] = useState(false);
  const [alertaVisual, setAlertaVisual] = useState('');

  // Debounce check for duplicate invoice
  useEffect(() => {
    if (!docNumero.trim()) {
      setDuplicateUrl(null);
      setAlertaVisual('');
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoadingCheck(true);
      try {
        const { data, error } = await supabase
          .from('requisiciones')
          .select('items')
          .not('items', 'is', null);

        if (error) throw error;

        let foundUrl = null;
        if (data) {
          for (const req of data) {
            if (Array.isArray(req.items)) {
              for (const it of req.items) {
                if (Array.isArray(it.historial_compras)) {
                  for (const h of it.historial_compras) {
                    if (h.doc_numero && String(h.doc_numero).trim().toUpperCase() === docNumero.trim().toUpperCase()) {
                      if (h.factura_url) {
                        foundUrl = h.factura_url;
                        break;
                      }
                    }
                  }
                }
                if (foundUrl) break;
              }
            }
            if (foundUrl) break;
          }
        }

        if (foundUrl) {
          setDuplicateUrl(foundUrl);
          setAlertaVisual('Factura existente detectada. Soporte vinculado automáticamente');
          setFile(null); // Clear manual file if any
        } else {
          setDuplicateUrl(null);
          setAlertaVisual('');
        }
      } catch (err) {
        console.error("Error al buscar factura duplicada:", err);
      } finally {
        setLoadingCheck(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [docNumero]);

  const inputStyle = {
    padding: '8px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '12px',
    width: '100%',
    outline: 'none',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    backgroundColor: '#f8fafc',
    boxSizing: 'border-box',
    color: '#1e293b'
  };

  const labelStyle = {
    fontSize: '11px',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '4px',
    display: 'block'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '5px', minWidth: '280px' }}>
      <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <FileText size={16} color="#22c55e" />
        Adjuntar Soporte de Compra
      </p>

      {/* Info de la compra */}
      <div style={{ fontSize: '11px', color: '#475569', backgroundColor: '#f1f5f9', padding: '8px', borderRadius: '6px' }}>
        <strong>Cant a Procesar:</strong> {cantProcesar}
      </div>

      {/* Factura / Documento */}
      <div>
        <label style={labelStyle}>Factura # / Documento <span style={{ color: '#ef4444' }}>*</span></label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            value={docTipo}
            onChange={(e) => setDocTipo(e.target.value)}
            style={{ ...inputStyle, width: '70px', padding: '6px' }}
          >
            <option value="FAC">FAC</option>
            <option value="NC">NC</option>
          </select>
          <input
            type="text"
            value={docNumero}
            onChange={(e) => setDocNumero(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
            placeholder="Número de Factura"
          />
        </div>
      </div>

      {/* Alerta de duplicado */}
      {loadingCheck && (
        <div style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic' }}>
          Verificando factura en el sistema...
        </div>
      )}
      {alertaVisual && (
        <div style={{
          fontSize: '11px',
          color: '#15803d',
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          padding: '6px 10px',
          borderRadius: '6px',
          fontWeight: 'bold',
          lineHeight: '1.2'
        }}>
          {alertaVisual}
        </div>
      )}

      {/* Adjuntar Soporte File Input */}
      {!duplicateUrl && (
        <div>
          <label style={labelStyle}>Adjuntar Soporte (Obligatorio) <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            type="file"
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                const selectedFile = e.target.files[0];
                if (selectedFile.size > 5 * 1024 * 1024) {
                  toast.error("El archivo supera el límite de 5MB. Por favor, redúzcalo antes de subirlo.");
                  e.target.value = '';
                  setFile(null);
                  return;
                }
                setFile(selectedFile);
                const cleanName = selectedFile.name.split('.')[0];
                setFileName(cleanName);
              }
            }}
            style={{ ...inputStyle, padding: '6px', cursor: 'pointer', backgroundColor: 'white' }}
          />
        </div>
      )}

      {/* Nombre del Soporte */}
      {!duplicateUrl && (
        <div>
          <label style={labelStyle}>Nombre del Documento <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            style={inputStyle}
            placeholder="Ej: Factura Compra, Recibo..."
          />
        </div>
      )}

      {/* Acciones */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
        <button
          onClick={() => {
            if (!docNumero.trim()) {
              toast.error('Debe ingresar el número de factura/documento.');
              return;
            }
            if (!duplicateUrl && !file) {
              toast.error('Debe adjuntar el documento de soporte.');
              return;
            }
            if (!duplicateUrl && !fileName.trim()) {
              toast.error('Debe ingresar un nombre para el soporte.');
              return;
            }
            onConfirm({
              file,
              fileName: duplicateUrl ? 'Soporte Factura Existente' : fileName.trim(),
              docNumero: docNumero.trim(),
              docTipo,
              duplicateUrl
            });
          }}
          style={{
            padding: '6px 14px',
            backgroundColor: '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(34, 197, 94, 0.2)'
          }}
        >
          CONFIRMAR
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '6px 12px',
            backgroundColor: '#f1f5f9',
            color: '#64748b',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.75rem'
          }}
        >
          CANCELAR
        </button>
      </div>
    </div>
  );
};

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

  const categoriasProveedores = useMemo(() => {
    const cats = new Set();
    proveedores.forEach(p => {
      if (p.categoria) {
        const pCats = String(p.categoria).split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
        pCats.forEach(c => cats.add(c));
      }
    });
    return Array.from(cats).sort();
  }, [proveedores]);

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
  const [expandirSoportes, setExpandirSoportes] = useState(false);
  const [preciosReferencia, setPreciosReferencia] = useState({}); // { descripcion: ultimoPrecio }
  
  // --- ANULACIÓN DE FILA ---
  const [showAnulacionModal, setShowAnulacionModal] = useState(false);
  const [itemParaAnular, setItemParaAnular] = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [comentarioAnulacion, setComentarioAnulacion] = useState('');

  // --- SLA & POSTERGACIÓN ---
  const [showPostergarModal, setShowPostergarModal] = useState(false);
  const [motivoPostergacion, setMotivoPostergacion] = useState('');
  const [motivoCategoria, setMotivoCategoria] = useState('');
  const [comentarioPostergacion, setComentarioPostergacion] = useState('');

  // --- ASIGNACIÓN DE COMPRAS ---
  const [analistas, setAnalistas] = useState([]);
  const [filtroAnalista, setFiltroAnalista] = useState('Todos');
  const [verSoloMisAsignadas, setVerSoloMisAsignadas] = useState(true);
  const [loadingAsignacion, setLoadingAsignacion] = useState(false);

  const proveedoresFiltradosPorFila = (f) => {
    if (!f.categoria_proveedor) return proveedores;
    return proveedores.filter(p => {
      if (!p.categoria) return false;
      const pCats = String(p.categoria).split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
      return pCats.includes(f.categoria_proveedor.toUpperCase());
    });
  };

  // --- ROLES & PERMISOS COMPUTADOS ---
  const rolUpperFinal = (currentUser?.rol || '').toUpperCase();
  const deptoUpperFinal = (currentUser?.departamento || '').toUpperCase();

  const esDeCompras = deptoUpperFinal.includes('COMPRAS') ||
    deptoUpperFinal.includes('ADMINISTRACIÓN') ||
    !!currentUser?.esAdminReal ||
    rolUpperFinal === 'GERENTE GENERAL' ||
    rolUpperFinal === 'ADMIN';

  const esGerenteDeCompras = 
    (rolUpperFinal === 'GERENTE' && deptoUpperFinal.includes('COMPRAS')) ||
    (currentUser?.nombre === 'Ricardo' && currentUser?.apellido === 'Herrera') ||
    !!currentUser?.esAdminReal ||
    rolUpperFinal === 'GERENTE GENERAL' ||
    rolUpperFinal === 'ADMIN';

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

  const cargarAnalistasCompras = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('id, nombre, apellido, rol, departamento')
        .eq('activo', true)
        .eq('departamento', 'Compras');
      if (error) throw error;
      setAnalistas(data || []);
    } catch (err) {
      console.error("Error cargando analistas:", err.message);
    }
  }, []);

  const ejecutarAsignacion = async (reqId, analistaId, analistaNombre) => {
    setLoadingAsignacion(true);
    try {
      const { error } = await supabase
        .from('requisiciones')
        .update({
          asignado_a: analistaId || null,
          asignado_nombre: analistaNombre || null
        })
        .eq('id', reqId);

      if (error) throw error;

      // Registrar en logs de auditoría
      const nombreUsuario = `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim() || 'Gerente';
      await supabase.from('requisicion_logs').insert({
        requisicion_id: reqId,
        usuario_id: currentUser?.id || null,
        usuario_nombre: nombreUsuario,
        accion: 'ASIGNACION',
        comentario: analistaNombre
          ? `Requisición asignada a ${analistaNombre} por ${nombreUsuario}`
          : `Requisición desasignada (devuelta a cola) por ${nombreUsuario}`
      });

      // Actualizar el historial localmente
      setHistorial(prev =>
        prev.map(r =>
          r.id === reqId
            ? { ...r, asignado_a: analistaId, asignado_nombre: analistaNombre }
            : r
        )
      );

      if (analistaId) {
        const req = historial.find(r => r.id === reqId);
        const correlativoStr = req?.correlativo || req?.correlativo_req || 'N/A';
        await enviarNotificacion(
          analistaId,
          `Se te ha asignado la Requisición ${correlativoStr} para realizar su compra.`,
          'Asignación Compra',
          reqId
        );
      }

      toast.success(
        analistaNombre
          ? `Requisición asignada a ${analistaNombre}`
          : "Requisición devuelta a la cola (sin asignar)"
      );
    } catch (err) {
      console.error("Error al asignar requisición:", err.message);
      toast.error("Error al asignar: " + err.message);
    } finally {
      setLoadingAsignacion(false);
    }
  };

  useEffect(() => { obtenerSesionUsuario(); }, [obtenerSesionUsuario]);
  useEffect(() => {
    cargarRequisicionesAprobadas();
    cargarProveedores();
    cargarAnalistasCompras();

    const channel = supabase
      .channel('compras_realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'requisiciones' }, (payload) => {
        setHistorial(prev => prev.map(req => {
          if (req.id === payload.new.id) {
            return {
              ...req,
              ...payload.new,
              correlativo: payload.new.correlativo_req,
              total: payload.new.total_bs,
              detalles: payload.new.items,
              fecha: payload.new.fecha_emision ? payload.new.fecha_emision.split('T')[0] : '',
              observaciones: payload.new.observaciones || '',
              observaciones_direccion: payload.new.observaciones_direccion || '',
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
  }, [cargarRequisicionesAprobadas, cargarProveedores, cargarAnalistasCompras]);

  const historialFiltrado = useMemo(() => {
    return historial.filter(req => {
      const matchTexto =
        req.solicitante.toLowerCase().includes(busqueda.toLowerCase()) ||
        req.correlativo.toLowerCase().includes(busqueda.toLowerCase());
      const matchGerencia = filtroGerencia === 'Todos' || req.gerencia === filtroGerencia;
      const matchStatus = filtroStatusCompra === 'Todos' || (req.status_compra || 'En espera') === filtroStatusCompra;
      const matchCC = filtroCentroCosto === 'Todos' || req.centro_costo === filtroCentroCosto;
      const matchCat = filtroCategoria === 'Todos' || (req.items || []).some(it => it.categoria === filtroCategoria);

      // Filtro por analista seleccionado en la barra
      const matchAnalista =
        filtroAnalista === 'Todos' ||
        (filtroAnalista === 'Sin Asignar' && !req.asignado_a) ||
        req.asignado_a === filtroAnalista;

      // Filtro para analistas: solo ver sus asignaciones si el toggle está activo
      const matchMisAsignadas =
        !verSoloMisAsignadas ||
        esGerenteDeCompras || // El gerente ve todo
        req.asignado_a === currentUser?.id;

      return matchTexto && matchGerencia && matchStatus && matchCC && matchCat && matchAnalista && matchMisAsignadas;
    });
  }, [historial, busqueda, filtroGerencia, filtroStatusCompra, filtroCentroCosto, filtroCategoria, filtroAnalista, verSoloMisAsignadas, esGerenteDeCompras, currentUser]);

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

    const renglonesIniciados = (req.detalles || []).map(item => {
      const cantidad_pedida = item.cantidad_pedida || item.cant || 0;
      const cantidad_comprada = item.cantidad_comprada || 0;
      const cantidad_pendiente = item.anulado ? 0 : Math.max(0, cantidad_pedida - cantidad_comprada);

      return {
        ...item,
        cantidad_pedida,
        cantidad_comprada,
        cantidad_pendiente,
        anulado: item.anulado || false,
        historial_compras: item.historial_compras || [],
        compra_actual_cant: 0,
        compra_actual_pu: item.pu || 0, // Iniciamos con el último PU sugerido
        doc_tipo_actual: item.doc_tipo || 'FAC',
         doc_numero_actual: '', // Siempre vacío por defecto para evitar errores
        proveedor_seleccionado_id: '', // Siempre vacío por defecto
        categoria_proveedor: ''
      };
    });

    setRenglones(renglonesIniciados);
    const fUrl = req.facturas_url || req.factura_url || [];
    setFacturasUrls(Array.isArray(fUrl) ? fUrl : [fUrl].filter(Boolean));
    setExpandirSoportes((Array.isArray(fUrl) ? fUrl : [fUrl].filter(Boolean)).length > 0);
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

  const manejarPostergacion = async (req) => {
    if (!req.is_pausada) {
      // Abrir modal para pedir comentario
      setShowPostergarModal(true);
    } else {
      // Reanudar directamente
      ejecutarCambioPausa(req, false, 'Reanudación de tiempos');
    }
  };

  const ejecutarCambioPausa = async (req, nuevaPausa, comentario) => {
    try {
      setLoading(true);
      const now = new Date().toISOString();
      const fullComentario = nuevaPausa ? `[${motivoCategoria}] ${comentario}` : comentario;
      
      const updatePayload = {
        is_pausada: nuevaPausa,
        motivo_postergacion: nuevaPausa ? fullComentario : req.motivo_postergacion
      };

      if (nuevaPausa) {
        updatePayload.paused_at = now;
      } else {
        // Manual resume - calculate SLA compensation
        updatePayload.resumed_at = now;
        if (req.paused_at) {
          const pausedAt = new Date(req.paused_at);
          const deltaMs = new Date(now).getTime() - pausedAt.getTime();
          
          let baseDeadline = req.fecha_limite_compra;
          if (!baseDeadline && req.fecha_emision) {
            const base = new Date(req.fecha_emision);
            const dias = req.prioridad === 'Emergencia' ? 2 : 5;
            baseDeadline = new Date(base.getTime() + (dias * 24 * 60 * 60 * 1000)).toISOString();
          }
          
          if (baseDeadline) {
            updatePayload.fecha_limite_compra = new Date(new Date(baseDeadline).getTime() + deltaMs).toISOString();
          }
        }
      }

      const { error } = await supabase
        .from('requisiciones')
        .update(updatePayload)
        .eq('id', req.id);

      if (error) throw error;

      // Registrar en logs de auditoría
      const nombreUsuario = `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim() || 'Comprador';
      await supabase.from('requisicion_logs').insert({
        requisicion_id: req.id,
        usuario_id: currentUser?.id,
        usuario_nombre: nombreUsuario,
        accion: nuevaPausa ? 'PAUSA' : 'REANUDACIÓN',
        comentario: nuevaPausa ? fullComentario : `SLA reactivado manualmente. Comentario: ${comentario}`
      });

      toast.success(nuevaPausa ? 'Tiempos pausados correctamente' : 'Tiempos reanudados');
      
      const updatedReq = { 
        ...req, 
        is_pausada: nuevaPausa, 
        motivo_postergacion: nuevaPausa ? fullComentario : req.motivo_postergacion,
        ...(nuevaPausa ? { paused_at: now } : { resumed_at: now, fecha_limite_compra: updatePayload.fecha_limite_compra || req.fecha_limite_compra })
      };
      setRequisicionActiva(updatedReq);
      
      cargarRequisicionesAprobadas();
      setShowPostergarModal(false);
      setMotivoCategoria('');
      setComentarioPostergacion('');
    } catch (err) {
      toast.error("Error al cambiar estado de pausa: " + err.message);
    } finally {
      setLoading(false);
    }
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
    const r = renglones.find(x => x.id === idRenglon);
    const entrada = r ? r.historial_compras[indexHistorial] : null;
    const esAutorizado = 
      currentUser?.correo?.toLowerCase() === 'jcontreras.totalclean@gmail.com' ||
      (entrada && entrada.usuario_id === currentUser?.id);

    if (!esAutorizado) return toast.error("Solo el Administrador jcontreras.totalclean@gmail.com o el autor de esta transacción tienen permisos para eliminarla.");

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
    const r = renglones.find(x => x.id === idRenglon);
    const entrada = r ? r.historial_compras[indexHistorial] : null;
    const esAutorizado = 
      currentUser?.correo?.toLowerCase() === 'jcontreras.totalclean@gmail.com' ||
      (entrada && entrada.usuario_id === currentUser?.id);

    if (!esAutorizado) {
      toast.error("Solo el Administrador jcontreras.totalclean@gmail.com o el autor de esta transacción tienen permisos para eliminarla.");
      return;
    }
    setLoading(true);
    try {
      const renglonesActualizados = renglones.map(r => {
        if (r.id === idRenglon) {
          const entrada = r.historial_compras[indexHistorial];
          let nuevaCantComprada = r.cantidad_comprada;
          let nuevaCantPendiente = r.cantidad_pendiente;
          let esAnulado = r.anulado || false;

          if (entrada.tipo === 'ANULACION') {
            esAnulado = false;
            nuevaCantPendiente = Math.max(0, r.cantidad_pedida - nuevaCantComprada);
          } else if (entrada.tipo !== 'JUSTIFICACION') {
            nuevaCantComprada -= (entrada.cant || 0);
            if (!esAnulado) {
              nuevaCantPendiente = Math.max(0, r.cantidad_pedida - nuevaCantComprada);
            }
          }

          const nuevoHistorial = [...r.historial_compras];
          nuevoHistorial.splice(indexHistorial, 1);

          let nuevoStatus = r.status;
          if (esAnulado) {
            nuevoStatus = 'Completado';
          } else {
            nuevoStatus = nuevaCantComprada === 0 ? 'En Espera' : (nuevaCantPendiente === 0 ? 'Completado' : 'Parcial');
          }

          return {
            ...r,
            anulado: esAnulado,
            cantidad_comprada: Math.max(0, nuevaCantComprada),
            cantidad_pendiente: Math.max(0, nuevaCantPendiente),
            historial_compras: nuevoHistorial,
            status: nuevoStatus
          };
        }
        return r;
      });

      // Recalcular Totales de la Requisición
      const totalDinamicoReal = renglonesActualizados.reduce((acc, r) => {
        const ejecutadoItem = (r.historial_compras || []).reduce((sum, t) => {
          if (t.tipo === 'JUSTIFICACION' || t.tipo === 'ANULACION') return sum;
          return sum + ((Number(t.cant) || 0) * (Number(t.pu) || 0));
        }, 0);
        const estimadoPendiente = (Number(r.cantidad_pendiente) || 0) * Number(r.pu_estimado || r.pu || 0);
        return acc + ejecutadoItem + estimadoPendiente;
      }, 0);

      const totalEjecutadoReal = renglonesActualizados.reduce((acc, r) => {
        const ejecutadoItem = (r.historial_compras || []).reduce((sum, t) => {
          if (t.tipo === 'JUSTIFICACION' || t.tipo === 'ANULACION') return sum;
          return sum + ((Number(t.cant) || 0) * (Number(t.pu) || 0));
        }, 0);
        return acc + ejecutadoItem;
      }, 0);

      const totalConIVA = totalDinamicoReal * (requisicionActiva?.con_iva !== false ? 1.16 : 1.00);
      const ejecutadoConIVA = totalEjecutadoReal * (requisicionActiva?.con_iva !== false ? 1.16 : 1.00);

      // Determinar si toda la requisición quedó completa después de esto
      const algunoComprado = renglonesActualizados.some(r => (r.cantidad_comprada || 0) > 0);
      const todasCompletas = renglonesActualizados.every(r => r.cantidad_pendiente === 0);

      let nuevoStatusCompra = requisicionActiva.status_compra || 'En espera';
      if (todasCompletas) nuevoStatusCompra = 'Completado';
      else if (algunoComprado) nuevoStatusCompra = 'Parcial';
      else nuevoStatusCompra = 'En espera';

      const updatePayload = {
        items: renglonesActualizados,
        total_bs: totalConIVA,
        total_ejecutado: ejecutadoConIVA,
        status_compra: nuevoStatusCompra
      };

      if (nuevoStatusCompra === 'Completado' || nuevoStatusCompra === 'COMPLETADO') {
        updatePayload.f_finalizado = new Date().toISOString();
      } else {
        updatePayload.f_finalizado = null; // Restaurar si se reabre
      }

      const { error } = await supabase
        .from('requisiciones')
        .update(updatePayload)
        .eq('id', editandoId);

      if (error) throw error;

      setRenglones(renglonesActualizados);
      setRequisicionActiva(prev => ({ 
        ...prev, 
        items: renglonesActualizados,
        status_compra: nuevoStatusCompra,
        f_finalizado: nuevoStatusCompra === 'Completado' ? updatePayload.f_finalizado : null
      }));

      // Sincronizar con el historial en la lista principal
      setHistorial(prev => prev.map(h => h.id === editandoId ? {
        ...h,
        items: renglonesActualizados,
        detalles: renglonesActualizados,
        status_compra: nuevoStatusCompra,
        f_finalizado: nuevoStatusCompra === 'Completado' ? updatePayload.f_finalizado : null
      } : h));

      await actualizarTotalesSolicitud(editandoId);
      toast.success("Entrada eliminada y saldos restaurados.");
    } catch (err) {
      toast.error("Error al eliminar entrada del historial: " + err.message);
    } finally {
      setLoading(false);
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
      `${r.cantidad_pedida} ${r.uni || r.unidad || ''}`,
      `${r.cantidad_comprada} ${r.uni || r.unidad || ''}`,
      `${r.cantidad_pendiente} ${r.uni || r.unidad || ''}`
    ]);

    autoTable(doc, {
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

    autoTable(doc, {
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

  const obtenerTextoObservaciones = (obsRaw) => {
    if (!obsRaw) return "Sin observaciones.";
    const trimmed = obsRaw.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const arr = JSON.parse(trimmed);
        if (Array.isArray(arr)) {
          return arr.map(c => `[${c.author || c.autor || 'Usuario'} (${c.rol || 'Rol'})]: ${c.text || c.texto || ''}`).join('\n');
        }
      } catch (e) {
        console.error("Error parsing observations JSON:", e);
      }
    }
    return obsRaw;
  };

  const parsearObservaciones = (obsRaw) => {
    if (!obsRaw) return [];
    const trimmed = obsRaw.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error("Error al parsear observaciones:", e);
      }
    }
    return [{
      author: 'Sistema',
      rol: 'Histórico',
      text: obsRaw,
      date: new Date().toISOString()
    }];
  };

  const generarRequisicionPDF = () => {
    if (!requisicionActiva) {
      toast.error("No se encontraron datos para exportar.");
      return;
    }

    // Inicializar jsPDF (A4 en mm)
    const pdf = new jsPDF('p', 'mm', 'a4');
    const fontPrimary = 'helvetica';
    
    // --- CABECERA ---
    pdf.setFont(fontPrimary, 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(15, 23, 42); // Slate-900
    pdf.text("TOTAL CLEAN C.A.", 15, 20);
    
    pdf.setFont(fontPrimary, 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105); // Slate-600
    pdf.text("J-303658587-0", 15, 25);
    
    // Derecha: Fecha y Solicitud #
    const fechaEmision = requisicionActiva.fecha 
      ? format(new Date(requisicionActiva.fecha + 'T12:00:00'), 'dd/MM/yyyy hh:mm a') 
      : format(new Date(), 'dd/MM/yyyy hh:mm a');
    
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`Fecha : ${fechaEmision}`, 195, 20, { align: 'right' });
    pdf.text("Solicitud 1 de 1", 195, 25, { align: 'right' });
    
    // --- TÍTULO CENTRAL ---
    const correlativoStr = requisicionActiva.correlativo || `REQ-${String(requisicionActiva.id).padStart(3, '0')}`;
    pdf.setFont(fontPrimary, 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    const titulo = `REQUISICIÓN DE RECURSOS: ${correlativoStr}`;
    const textWidth = pdf.getTextWidth(titulo);
    const posX = (210 - textWidth) / 2;
    pdf.text(titulo, posX, 38);
    
    // Línea subrayada del título
    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(0.4);
    pdf.line(posX, 40, posX + textWidth, 40);
    
    // --- CUADRO DE METADATA ---
    const startY = 46;
    pdf.setDrawColor(226, 232, 240); // Borde gris claro
    pdf.setFillColor(248, 250, 252); // Fondo gris muy claro
    pdf.setLineWidth(0.3);
    pdf.roundedRect(15, startY, 180, 22, 2, 2, 'FD');
    
    // Texto dentro de la Metadata
    pdf.setFontSize(9.5);
    pdf.setTextColor(15, 23, 42);
    
    // Columna Izquierda
    pdf.setFont(fontPrimary, 'bold');
    pdf.text("Gerencia: ", 20, startY + 8);
    pdf.setFont(fontPrimary, 'normal');
    pdf.setTextColor(51, 65, 85);
    pdf.text(requisicionActiva.gerencia || 'N/A', 38, startY + 8);
    
    pdf.setFont(fontPrimary, 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text("Responsable: ", 20, startY + 15);
    pdf.setFont(fontPrimary, 'normal');
    pdf.setTextColor(51, 65, 85);
    pdf.text(requisicionActiva.solicitante || 'N/A', 43, startY + 15);
    
    // Columna Derecha
    const fechaEmisionMeta = requisicionActiva.fecha 
      ? format(new Date(requisicionActiva.fecha + 'T12:00:00'), 'dd/MM/yyyy') 
      : 'N/A';
      
    pdf.setFont(fontPrimary, 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text("Fecha Emisión: ", 125, startY + 8);
    pdf.setFont(fontPrimary, 'normal');
    pdf.setTextColor(51, 65, 85);
    pdf.text(fechaEmisionMeta, 151, startY + 8);
    
    // --- TABLA DE ITEMS ---
    const tableY = startY + 30;
    
    // Cabecera de la tabla
    pdf.setFont(fontPrimary, 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(15, 23, 42);
    
    // Dibujar líneas superior e inferior de la cabecera de la tabla
    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(0.5);
    pdf.line(15, tableY, 195, tableY);
    
    pdf.text("C.COSTO", 16, tableY + 5);
    pdf.text("CLASIF.", 46, tableY + 5);
    pdf.text("DESCRIPCIÓN", 76, tableY + 5);
    pdf.text("CANT.", 145, tableY + 5, { align: 'right' });
    pdf.text("PAGO Bs ($)", 170, tableY + 5, { align: 'right' });
    pdf.text("PAGO USD ($)", 194, tableY + 5, { align: 'right' });
    
    pdf.line(15, tableY + 8, 195, tableY + 8);
    
    // Renglones de la tabla
    pdf.setFont(fontPrimary, 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(51, 65, 85);
    
    let currentY = tableY + 13;
    
    // Renglones de la requisición activa
    const items = renglones || [];
    
    items.forEach((item, idx) => {
      // Ajuste de descripción si es muy larga
      const descText = item.descripcion || 'N/A';
      const descLines = pdf.splitTextToSize(descText, 60);
      
      // Mostrar Centro de Costo de la req
      const ccText = requisicionActiva.centro_costo || requisicionActiva.centroCosto || 'N/A';
      const ccLines = pdf.splitTextToSize(ccText, 28);
      
      // Mostrar Clasificación del renglón
      const clasifText = item.clasificacion || 'N/A';
      const clasifLines = pdf.splitTextToSize(clasifText, 28);
      
      // Altura requerida para este renglón
      const linesCount = Math.max(descLines.length, ccLines.length, clasifLines.length);
      const rowHeight = linesCount * 4 + 4;
      
      // Renderizar columnas de texto multilínea
      pdf.text(ccLines, 16, currentY);
      pdf.text(clasifLines, 46, currentY);
      pdf.text(descLines, 76, currentY);
      
      // Renderizar columnas simples
      pdf.text(`${item.cantidad_pedida || item.cant || 1} ${item.uni || item.unidad || ''}`, 145, currentY, { align: 'right' });
      
      // Calcular valores acumulados de pago (Bs o USD) para el ítem
      const hCompras = Array.isArray(item.historial_compras) ? item.historial_compras : [];
      const tieneCompras = hCompras.some(h => h.tipo !== 'JUSTIFICACION' && h.tipo !== 'ANULACION');
      
      let totalPaidBs = 0;
      let totalPaidUsd = 0;
      
      if (tieneCompras) {
        hCompras.forEach(h => {
          if (h.tipo === 'JUSTIFICACION' || h.tipo === 'ANULACION') return;
          const monto = (Number(h.cant) || 0) * (Number(h.pu) || 0);
          const esBs = h.metodo_pago && (h.metodo_pago.toUpperCase().includes('BS') || h.metodo_pago.toUpperCase().includes('B/S'));
          if (esBs) {
            totalPaidBs += monto;
          } else {
            totalPaidUsd += monto;
          }
        });
      } else {
        const cantOri = Number(item.cantidad_pedida ?? item.cant) || 1;
        const puEst = Number(item.pu_estimado ?? item.precio_unitario ?? item.pu) || 0;
        totalPaidUsd = cantOri * puEst;
      }
      
      if (totalPaidBs > 0) {
        pdf.text(`$ ${totalPaidBs.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 170, currentY, { align: 'right' });
      } else {
        pdf.text("-", 170, currentY, { align: 'right' });
      }
      
      if (totalPaidUsd > 0) {
        pdf.text(`$ ${totalPaidUsd.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 194, currentY, { align: 'right' });
      } else {
        pdf.text("-", 194, currentY, { align: 'right' });
      }
      
      // Beneficiario si existe
      if (item.beneficiario) {
        pdf.setFont(fontPrimary, 'italic');
        pdf.setFontSize(7.5);
        pdf.setTextColor(100, 116, 139); // Slate-500
        pdf.text(`Benef: ${item.beneficiario}`, 76, currentY + (descLines.length * 4));
        pdf.setFont(fontPrimary, 'normal');
        pdf.setFontSize(8.5);
        pdf.setTextColor(51, 65, 85);
      }
      
      currentY += rowHeight;
      
      // Dibujar una sutil línea divisoria
      pdf.setDrawColor(241, 245, 249);
      pdf.setLineWidth(0.2);
      pdf.line(15, currentY - 1, 195, currentY - 1);
    });
    
    // --- CUADRO DE TOTALES ---
    let totalPagoBs = 0;
    let totalPagoUsd = 0;
    
    items.forEach(item => {
      const hCompras = Array.isArray(item.historial_compras) ? item.historial_compras : [];
      const tieneCompras = hCompras.some(h => h.tipo !== 'JUSTIFICACION' && h.tipo !== 'ANULACION');
      
      let itemBs = 0;
      let itemUsd = 0;
      
      if (tieneCompras) {
        hCompras.forEach(h => {
          if (h.tipo === 'JUSTIFICACION' || h.tipo === 'ANULACION') return;
          const monto = (Number(h.cant) || 0) * (Number(h.pu) || 0);
          const esBs = h.metodo_pago && (h.metodo_pago.toUpperCase().includes('BS') || h.metodo_pago.toUpperCase().includes('B/S'));
          if (esBs) {
            itemBs += monto;
          } else {
            itemUsd += monto;
          }
        });
      } else {
        const cantOri = Number(item.cantidad_pedida ?? item.cant) || 1;
        const puEst = Number(item.pu_estimado ?? item.precio_unitario ?? item.pu) || 0;
        itemUsd = cantOri * puEst;
      }
      
      totalPagoBs += itemBs;
      totalPagoUsd += itemUsd;
    });

    const aplicaIva = requisicionActiva.con_iva !== false;
    const labelIva = aplicaIva ? "(Con IVA)" : "(Sin IVA)";
    const totalPagoBsConIva = totalPagoBs * (aplicaIva ? 1.16 : 1.00);
    const totalPagoUsdConIva = totalPagoUsd * (aplicaIva ? 1.16 : 1.00);
    
    let finalPagoBs = totalPagoBsConIva;
    let finalPagoUsd = totalPagoUsdConIva;
    
    if (totalPagoBs > 0 && totalPagoUsd === 0) {
      finalPagoBs = Number(requisicionActiva.total) || totalPagoBsConIva;
      finalPagoUsd = 0;
    } else if (totalPagoUsd > 0 && totalPagoBs === 0) {
      finalPagoUsd = Number(requisicionActiva.total) || totalPagoUsdConIva;
      finalPagoBs = 0;
    }
    
    const finalTotal = finalPagoBs + finalPagoUsd;

    currentY += 5;
    const boxWidth = 70;
    const boxHeight = 18;
    const boxX = 195 - boxWidth;
    
    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(0.4);
    pdf.rect(boxX, currentY, boxWidth, boxHeight);
    
    pdf.setFont(fontPrimary, 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(15, 23, 42);
    
    // Fila 1: Pago Bs
    pdf.text(`Pago Bs ${labelIva}`, boxX + 3, currentY + 5);
    pdf.text(`$ ${finalPagoBs.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 192, currentY + 5, { align: 'right' });
    
    // Fila 2: Pago USD
    pdf.text(`Pago USD ${labelIva}`, boxX + 3, currentY + 10);
    pdf.text(`$ ${finalPagoUsd.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 192, currentY + 10, { align: 'right' });
    
    // Línea divisoria interna
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.2);
    pdf.line(boxX, currentY + 12, 195, currentY + 12);
    
    // Fila 3: Total General
    pdf.setFont(fontPrimary, 'bold');
    pdf.text(`TOTAL ${labelIva}`, boxX + 3, currentY + 15);
    pdf.text(`$ ${finalTotal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 192, currentY + 15, { align: 'right' });
    
    // Guardar el PDF
    pdf.save(`REQ_${correlativoStr}.pdf`);
  };

  const generarGuiaChoferPDF = () => {
    if (!requisicionActiva) return;
    const doc = new jsPDF('p', 'pt', 'letter');
    const margins = 40;
    const pageWidth = doc.internal.pageSize.width;
    let y = 50;

    // --- LOGO / NOMBRE EMPRESA ---
    doc.setFontSize(14);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("TOTAL CLEAN C.A.", margins, y);
    doc.setFontSize(9);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    y += 12;
    doc.text("J-303658587-0", margins, y);

    // FECHA AL LADO DERECHO
    doc.setFontSize(9);
    doc.setFont("Helvetica", "normal");
    doc.text(`Fecha: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, pageWidth - margins, 50, { align: 'right' });
    y += 35;

    // --- TÍTULO PRINCIPAL CENTRADO ---
    doc.setFontSize(16);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("GUÍA DE COMPRA PARA CHOFER", pageWidth / 2, y, { align: 'center' });
    y += 22;

    // --- NÚMERO DE REQUISICIÓN CENTRADO Y DESTAQUED ---
    doc.setFontSize(20);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(14, 165, 233); // Azul sky
    doc.text(requisicionActiva.correlativo || '', pageWidth / 2, y, { align: 'center' });
    y += 22;

    // --- PRIORIDAD DESTACADA Y CENTRADA ---
    const esEmergencia = requisicionActiva.prioridad === 'Emergencia';
    if (esEmergencia) {
      doc.setFontSize(11);
      doc.setTextColor(239, 68, 68); // Rojo
      doc.setFont("Helvetica", "bold");
      doc.text("🚨 COMPRA DE EMERGENCIA (ATENCIÓN INMEDIATA) 🚨", pageWidth / 2, y, { align: 'center' });
    } else {
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // Gris
      doc.setFont("Helvetica", "normal");
      doc.text("Prioridad: Normal", pageWidth / 2, y, { align: 'center' });
    }

    y += 15;
    doc.setDrawColor(226, 232, 240);
    doc.line(margins, y, pageWidth - margins, y);
    y += 20;

    // --- RECUADRO DE DATOS ---
    doc.setFillColor(248, 250, 252);
    doc.rect(margins, y, pageWidth - (margins * 2), 65, "F");
    doc.setDrawColor(226, 232, 240);
    doc.rect(margins, y, pageWidth - (margins * 2), 65, "S");

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.setFont("Helvetica", "bold");
    
    // Fila 1 del recuadro
    doc.text("GERENCIA / DEPTO:", margins + 15, y + 20);
    doc.text("SOLICITANTE:", margins + 280, y + 20);
    
    // Fila 2 del recuadro
    doc.text("RESPONSABLE COMPRA:", margins + 15, y + 45);
    doc.text("CENTRO DE COSTO:", margins + 280, y + 45);

    doc.setFont("Helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(requisicionActiva.gerencia || 'Compras', margins + 130, y + 20);
    doc.text(requisicionActiva.solicitante || '---', margins + 380, y + 20);
    doc.text(requisicionActiva.asignado_nombre || 'Sin asignar', margins + 150, y + 45);
    doc.text(requisicionActiva.centro_costo || '---', margins + 395, y + 45);

    y += 95;

    // --- TABLA DE ITEMS ---
    doc.setFontSize(11);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Listado de Materiales por Comprar", margins, y);
    y += 15;

    const headers = [["C.COSTO", "CATEGORÍA", "DESCRIPCIÓN", "SOLICITADA", "COMPRADA", "PENDIENTE"]];
    const data = renglones.map(r => [
      requisicionActiva.centro_costo || '---',
      r.categoria || 'Generales',
      r.descripcion || '',
      `${r.cantidad_pedida} ${r.uni || r.unidad || ''}`,
      `${r.cantidad_comprada || 0} ${r.uni || r.unidad || ''}`,
      `${r.cantidad_pendiente || 0} ${r.uni || r.unidad || ''}`
    ]);

    autoTable(doc, {
      startY: y,
      head: headers,
      body: data,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 100 },
        2: { cellWidth: 200 },
        3: { cellWidth: 60, halign: 'center' },
        4: { cellWidth: 60, halign: 'center' },
        5: { cellWidth: 60, halign: 'center', fontStyle: 'bold' }
      }
    });

    y = doc.lastAutoTable.finalY + 30;

    // --- SECCIÓN DE OBSERVACIONES ---
    const textObs = obtenerTextoObservaciones(requisicionActiva.observaciones);
    doc.setFontSize(10);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Observaciones de la Requisición:", margins, y);
    y += 15;
    
    doc.setFontSize(8);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    
    // Ajustar texto multilínea al ancho de página
    const splitObs = doc.splitTextToSize(textObs, pageWidth - (margins * 2));
    doc.text(splitObs, margins, y);
    
    // Ajustar altura dinámica según cantidad de líneas de observaciones
    y += splitObs.length * 11 + 45;

    // --- SECCIÓN DE FIRMAS ---
    doc.setDrawColor(203, 213, 225);
    doc.line(margins + 50, y, margins + 200, y);
    doc.line(pageWidth - margins - 200, y, pageWidth - margins - 50, y);
    y += 15;
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("ENTREGADO POR (COMPRAS)", margins + 125, y, { align: 'center' });
    doc.text("RECIBIDO POR (CHOFER)", pageWidth - margins - 125, y, { align: 'center' });

    doc.save(`Guia_Chofer_${requisicionActiva.correlativo}.pdf`);
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
        if (campo === 'compra_actual_pu' || campo === 'compra_actual_cant') {
          if (valor === '') v = '';
          else v = Math.max(0, Number(valor) || 0);
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

  const toggleAlmacen = async (id, currentStatus) => {
    const nuevoEstado = currentStatus === 'Por_Clasificar_Almacen' || currentStatus === 'Ubicado' 
      ? 'Pendiente_Compras' 
      : 'Por_Clasificar_Almacen';
      
    const nuevosRenglones = renglones.map(r => {
      if (r.id === id) {
        const nuevoHistorial = Array.isArray(r.historial_compras)
          ? r.historial_compras.map(h => {
              if (h.tipo === 'JUSTIFICACION' || h.tipo === 'ANULACION' || h.tipo === 'DIRECTRIZ') return h;
              const currentSubStatus = h.estatus_almacen || (h.enviado_almacen ? 'Ubicado' : 'Pendiente_Compras');
              if (currentSubStatus !== 'Ubicado') {
                return {
                  ...h,
                  estatus_almacen: nuevoEstado,
                  ubicacion_almacen: nuevoEstado === 'Pendiente_Compras' ? null : h.ubicacion_almacen
                };
              }
              return h;
            })
          : r.historial_compras;

        return { 
          ...r, 
          estatus_almacen: nuevoEstado,
          ubicacion_almacen: nuevoEstado === 'Pendiente_Compras' ? null : r.ubicacion_almacen,
          historial_compras: nuevoHistorial
        };
      }
      return r;
    });
    setRenglones(nuevosRenglones);

    try {
      const { error } = await supabase
        .from('requisiciones')
        .update({ items: nuevosRenglones })
        .eq('id', editandoId);
      if (error) throw error;
      toast.success(nuevoEstado === 'Por_Clasificar_Almacen' ? "Enviado a Clasificación de Almacén" : "Devuelto a Pendiente en Compras");
    } catch (err) {
      toast.error("Error al actualizar estado de almacén: " + err.message);
    }
  };

  const toggleAlmacenSubRow = async (renglonId, historyIndex, currentStatus) => {
    const nuevoEstado = currentStatus === 'Por_Clasificar_Almacen' || currentStatus === 'Ubicado' 
      ? 'Pendiente_Compras' 
      : 'Por_Clasificar_Almacen';

    const nuevosRenglones = renglones.map(r => {
      if (r.id === renglonId) {
        const nuevoHistorial = [...(r.historial_compras || [])];
        if (nuevoHistorial[historyIndex]) {
          nuevoHistorial[historyIndex] = { 
            ...nuevoHistorial[historyIndex], 
            estatus_almacen: nuevoEstado,
            ubicacion_almacen: nuevoEstado === 'Pendiente_Compras' ? null : nuevoHistorial[historyIndex].ubicacion_almacen
          };
        }
        return { ...r, historial_compras: nuevoHistorial };
      }
      return r;
    });
    setRenglones(nuevosRenglones);

    try {
      const { error } = await supabase
        .from('requisiciones')
        .update({ items: nuevosRenglones })
        .eq('id', editandoId);
      if (error) throw error;
      toast.success(nuevoEstado === 'Por_Clasificar_Almacen' ? "Enviado a Clasificación de Almacén" : "Devuelto a Pendiente en Compras");
    } catch (err) {
      toast.error("Error al actualizar sub-fila: " + err.message);
    }
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

  const guardarUnicoRenglon = async (id, overrideValues = null) => {
    if (loading) return;
    const item = renglones.find(r => r.id === id);
    if (!item) return;
    if (!overrideValues && !item.hasChanges) return;

    // VALIDACIÓN DE DATOS OBLIGATORIOS (CANTIDAD, NÚMERO Y PROVEEDOR)
    const cantProcesar = Number(item.compra_actual_cant || 0);
    if (cantProcesar <= 0) {
      toast.error("Error: Debe ingresar una CANTIDAD REAL mayor a 0 para procesar la compra.");
      return;
    }
    if (cantProcesar > item.cantidad_pendiente) {
      toast.error(`No puede comprar más de la cantidad pendiente (${item.cantidad_pendiente})`, { id: 'error-cantidad' });
      return;
    }
    if (!item.proveedor_seleccionado_id) {
      toast.error("Error: Debe seleccionar un PROVEEDOR para procesar la compra.");
      return;
    }

    if (overrideValues) {
      if (!overrideValues.docNumero || !overrideValues.docNumero.trim()) {
        toast.error("Error: El número de documento es obligatorio para procesar la compra.");
        return;
      }
    }

    // Si no tenemos el soporte adjunto ni su nombre/etiqueta, lo pedimos con un toast interactivo
    if (!overrideValues) {
      toast((t) => (
        <FormularioAdjuntoToast
          t={t}
          item={item}
          cantProcesar={cantProcesar}
          onConfirm={(values) => {
            toast.dismiss(t.id);
            guardarUnicoRenglon(id, values);
          }}
          onCancel={() => toast.dismiss(t.id)}
        />
      ), { duration: 60000 });
      return;
    }

    setLoading(true);
    try {
      // SUBIR SOPORTE AL STORAGE BUCKET facturas o vincular duplicado
      let uploadedFileObj = null;
      if (overrideValues?.duplicateUrl) {
        uploadedFileObj = {
          url: overrideValues.duplicateUrl,
          etiqueta: overrideValues.fileName || 'Soporte Factura Existente'
        };
      } else if (overrideValues?.file) {
        const file = overrideValues.file;
        const customName = overrideValues.fileName || file.name.split('.')[0] || 'Soporte';
        const fileExt = file.name.split('.').pop();
        
        // Sanitizar variables del renglón para la nomenclatura mandatoria
        const cleanCorrelativo = (requisicionActiva?.correlativo || '').replace(/[^a-zA-Z0-9_-]/g, '');
        const cleanDoc = (overrideValues.docNumero || 'SINDOC').replace(/[^a-zA-Z0-9]/g, '');
        const cleanDesc = (item.descripcion || 'Articulo').replace(/[^a-zA-Z0-9]/g, '').slice(0, 30);
        const fileName = `${cleanCorrelativo}_${cleanDoc}_${cleanDesc}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('facturas')
          .upload(filePath, file);

        if (uploadError) {
          console.error("Error al subir archivo:", uploadError);
          toast.error(`Error al subir el soporte: ${uploadError.message}`);
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage.from('facturas').getPublicUrl(filePath);
        uploadedFileObj = {
          url: publicUrl,
          etiqueta: customName
        };
      }

      // Preparar la nueva transacción
      const uuidTransaccion = (typeof self !== 'undefined' && self.crypto && typeof self.crypto.randomUUID === 'function')
        ? self.crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
      const nuevaTransaccion = {
        id: uuidTransaccion,
        fecha: new Date().toISOString(),
        cant: cantProcesar,
        pu: item.compra_actual_pu,
        metodo_pago: item.metodo_pago_actual || '$ / BS',
        proveedor_id: item.proveedor_seleccionado_id || null,
        proveedor_nombre: proveedores.find(p => p.id === item.proveedor_seleccionado_id)?.razon_social || 'Desconocido',
        usuario_id: currentUser?.id,
        usuario_nombre: `${currentUser?.nombre} ${currentUser?.apellido}`,
        doc_tipo: overrideValues?.docTipo || item.doc_tipo_actual || 'FAC',
        doc_numero: overrideValues?.docNumero || item.doc_numero_actual || '',
        estatus_almacen: 'Pendiente_Compras',
        ubicacion_almacen: null,
        factura_url: uploadedFileObj?.url || overrideValues?.duplicateUrl || null
      };

      const nuevaCantComprada = (item.cantidad_comprada || 0) + cantProcesar;
      const nuevaCantPendiente = Math.max(0, item.cantidad_pedida - nuevaCantComprada);

      // LÓGICA DE STATUS CON CRÉDITO (NC)
      let nuevoStatus = item.status;
      const esCredito = (overrideValues?.docTipo || item.doc_tipo_actual) === 'NC';

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

      if (esCredito) {
        nuevaTransaccion.metodo_pago = 'CRÉDITO (NC)';
      }

      const renglonProcesado = {
        ...item,
        cantidad_comprada: nuevaCantComprada,
        cantidad_pendiente: nuevaCantPendiente,
        historial_compras: [...(item.historial_compras || []), nuevaTransaccion],
        status: nuevoStatus,
        pu: item.compra_actual_pu || item.pu,
        compra_actual_cant: 0,
        doc_tipo: overrideValues?.docTipo || item.doc_tipo_actual || 'FAC',
        doc_numero: overrideValues?.docNumero || item.doc_numero_actual || '',
        doc_numero_actual: '', // LIMPIAR DESPUÉS DE GUARDAR
        proveedor_seleccionado_id: '', // LIMPIAR DESPUÉS DE GUARDAR
        hasChanges: false
      };

      // Actualizar en el estado local todos los renglones
      const nuevosRenglones = renglones.map(r => r.id === id ? renglonProcesado : r);

      // Recalcular Totales de la Requisición (para la DB)
      const totalDinamicoReal = nuevosRenglones.reduce((acc, r) => {
        const ejecutadoItem = (r.historial_compras || []).reduce((sum, t) => sum + ((Number(t.cant) || 0) * (Number(t.pu) || 0)), 0);
        const estimadoPendiente = (Number(r.cantidad_pendiente) || 0) * Number(r.pu_estimado || 0);
        return acc + ejecutadoItem + estimadoPendiente;
      }, 0);

      const totalEjecutadoReal = nuevosRenglones.reduce((acc, r) => {
        const ejecutadoItem = (r.historial_compras || []).reduce((sum, t) => {
          if (t.tipo === 'JUSTIFICACION') return sum;
          return sum + ((Number(t.cant) || 0) * (Number(t.pu) || 0));
        }, 0);
        return acc + ejecutadoItem;
      }, 0);

      // Obtener facturas existentes y añadir la nueva
      let nuevasUrls = [...facturasUrls];
      if (uploadedFileObj) {
        const { data: currentReq } = await supabase.from('requisiciones').select('facturas_url').eq('id', editandoId).single();
        const urlsActuales = currentReq?.facturas_url || [];
        nuevasUrls = [...urlsActuales, uploadedFileObj];
        setFacturasUrls(nuevasUrls);
      }

      const updatePayload = {
        items: nuevosRenglones,
        total_bs: totalDinamicoReal * (requisicionActiva?.con_iva !== false ? 1.16 : 1.00),
        total_ejecutado: totalEjecutadoReal * (requisicionActiva?.con_iva !== false ? 1.16 : 1.00)
      };
      if (uploadedFileObj) {
        updatePayload.facturas_url = nuevasUrls;
      }

      const { error } = await supabase
        .from('requisiciones')
        .update(updatePayload)
        .eq('id', editandoId);

      if (error) throw error;

      setRenglones(nuevosRenglones);

      // Sincronizar en historial y requisicionActiva
      setHistorial(prev => prev.map(req => {
        if (req.id === editandoId) {
          return {
            ...req,
            items: nuevosRenglones,
            facturas_url: nuevasUrls,
            total_bs: totalDinamicoReal * (requisicionActiva?.con_iva !== false ? 1.16 : 1.00),
            total_ejecutado: totalEjecutadoReal * (requisicionActiva?.con_iva !== false ? 1.16 : 1.00)
          };
        }
        return req;
      }));

      if (requisicionActiva) {
        setRequisicionActiva(prev => prev ? {
          ...prev,
          items: nuevosRenglones,
          facturas_url: nuevasUrls,
          total_bs: totalDinamicoReal * (requisicionActiva?.con_iva !== false ? 1.16 : 1.00),
          total_ejecutado: totalEjecutadoReal * (requisicionActiva?.con_iva !== false ? 1.16 : 1.00)
        } : null);
      }

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
      setHistorial(prev => prev.map(req => {
        if (req.id === editandoId) {
          return {
            ...req,
            facturas_url: nuevasUrls
          };
        }
        return req;
      }));
      setRequisicionActiva(prev => prev ? {
        ...prev,
        facturas_url: nuevasUrls
      } : null);
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
      setHistorial(prev => prev.map(req => {
        if (req.id === editandoId) {
          return {
            ...req,
            facturas_url: nuevasUrls
          };
        }
        return req;
      }));
      setRequisicionActiva(prev => prev ? {
        ...prev,
        facturas_url: nuevasUrls
      } : null);
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

      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`El archivo "${file.name}" supera el límite de 5MB. Por favor, redúzcalo antes de subirlo.`);
          setUploading(false);
          event.target.value = '';
          return;
        }
      }

      const uploadPromises = files.map(async (file, index) => {
        const fileExt = file.name.split('.').pop();
        const cleanCorrelativo = (requisicionActiva?.correlativo || '').replace(/[^a-zA-Z0-9_-]/g, '');
        const firstItem = renglones.find(r => r.compra_actual_cant > 0) || renglones[0] || {};
        const cleanDoc = (firstItem.doc_numero_actual || 'SOPORTE').replace(/[^a-zA-Z0-9]/g, '');
        const cleanDesc = (firstItem.descripcion || 'General').replace(/[^a-zA-Z0-9]/g, '').slice(0, 30);
        const fileName = `${cleanCorrelativo}_${cleanDoc}_${cleanDesc}_${index}_${Date.now()}.${fileExt}`;
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

      setHistorial(prev => prev.map(req => {
        if (req.id === editandoId) {
          return {
            ...req,
            facturas_url: nuevasUrls
          };
        }
        return req;
      }));
      setRequisicionActiva(prev => prev ? {
        ...prev,
        facturas_url: nuevasUrls
      } : null);

      toast.success("Facturas/Soportes cargados y guardados correctamente.");
      event.target.value = ''; // Limpiar el input
    } catch (error) {
      toast.error("Error al subir facturas: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const enviarNotificacion = async (usuario_id, mensaje, tipo = 'Sistema', requisicion_id = null) => {
    if (!usuario_id || usuario_id === currentUser?.id) return;
    try {
      await supabase.from('notificaciones').insert([{
        usuario_id,
        mensaje,
        tipo,
        leido: false,
        requisicion_id
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

      // Registrar en logs de auditoría
      const nombreUsuario = `${currentUser?.nombre || ''} ${currentUser?.apellido || ''}`.trim() || 'Compras';
      await supabase.from('requisicion_logs').insert({
        requisicion_id: editandoId,
        usuario_id: currentUser?.id || null,
        usuario_nombre: nombreUsuario,
        accion: 'OBSERVACION',
        comentario: `Observación registrada: "${obsTemporal}"`
      });

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

  const ejecutarAnulacionFila = async () => {
    if (!motivoAnulacion || !comentarioAnulacion) return toast.error("Por favor complete el motivo y el comentario de la anulación.");

    setLoading(true);
    try {
      const nuevaAnulacion = {
        fecha: new Date().toISOString(),
        tipo: 'ANULACION',
        motivo: motivoAnulacion,
        comentario: comentarioAnulacion,
        cant: itemParaAnular.cantidad_pendiente,
        usuario_id: currentUser?.id,
        usuario_nombre: `${currentUser?.nombre} ${currentUser?.apellido}`
      };

      const renglonesActualizados = renglones.map(r => {
        if (r.id === itemParaAnular.id) {
          return {
            ...r,
            anulado: true,
            cantidad_pendiente: 0,
            status: 'Completado',
            historial_compras: [...(r.historial_compras || []), nuevaAnulacion]
          };
        }
        return r;
      });

      // Recalcular Totales de la Requisición
      const totalDinamicoReal = renglonesActualizados.reduce((acc, r) => {
        const ejecutadoItem = (r.historial_compras || []).reduce((sum, t) => {
          if (t.tipo === 'JUSTIFICACION' || t.tipo === 'ANULACION') return sum;
          return sum + ((Number(t.cant) || 0) * (Number(t.pu) || 0));
        }, 0);
        const estimadoPendiente = (Number(r.cantidad_pendiente) || 0) * Number(r.pu_estimado || r.pu || 0);
        return acc + ejecutadoItem + estimadoPendiente;
      }, 0);

      const totalEjecutadoReal = renglonesActualizados.reduce((acc, r) => {
        const ejecutadoItem = (r.historial_compras || []).reduce((sum, t) => {
          if (t.tipo === 'JUSTIFICACION' || t.tipo === 'ANULACION') return sum;
          return sum + ((Number(t.cant) || 0) * (Number(t.pu) || 0));
        }, 0);
        return acc + ejecutadoItem;
      }, 0);

      const totalConIVA = totalDinamicoReal * (requisicionActiva?.con_iva !== false ? 1.16 : 1.00);
      const ejecutadoConIVA = totalEjecutadoReal * (requisicionActiva?.con_iva !== false ? 1.16 : 1.00);

      // Determinar si toda la requisición quedó completa después de esto
      const algunoComprado = renglonesActualizados.some(r => (r.cantidad_comprada || 0) > 0);
      const todasCompletas = renglonesActualizados.every(r => r.cantidad_pendiente === 0);

      let nuevoStatusCompra = requisicionActiva.status_compra || 'En espera';
      if (todasCompletas) nuevoStatusCompra = 'Completado';
      else if (algunoComprado) nuevoStatusCompra = 'Parcial';

      const updatePayload = {
        items: renglonesActualizados,
        total_bs: totalConIVA,
        total_ejecutado: ejecutadoConIVA,
        status_compra: nuevoStatusCompra
      };

      if (nuevoStatusCompra === 'Completado' || nuevoStatusCompra === 'COMPLETADO') {
        updatePayload.f_finalizado = new Date().toISOString();
      }

      const { error } = await supabase
        .from('requisiciones')
        .update(updatePayload)
        .eq('id', editandoId);

      if (error) throw error;

      setRenglones(renglonesActualizados);
      setRequisicionActiva(prev => ({ 
        ...prev, 
        items: renglonesActualizados,
        status_compra: nuevoStatusCompra,
        f_finalizado: nuevoStatusCompra === 'Completado' ? updatePayload.f_finalizado : prev.f_finalizado
      }));

      // Sincronizar con el historial en la lista principal
      setHistorial(prev => prev.map(h => h.id === editandoId ? {
        ...h,
        items: renglonesActualizados,
        detalles: renglonesActualizados,
        status_compra: nuevoStatusCompra,
        f_finalizado: nuevoStatusCompra === 'Completado' ? updatePayload.f_finalizado : h.f_finalizado
      } : h));

      await actualizarTotalesSolicitud(editandoId);

      setShowAnulacionModal(false);
      setMotivoAnulacion('');
      setComentarioAnulacion('');
      toast.success("Renglón anulado / dejado sin efecto.");

      if (todasCompletas && requisicionActiva?.user_id) {
        await enviarNotificacion(requisicionActiva.user_id, `¡Tu Requisición ${requisicionActiva.correlativo} ha sido COMPLETADA! Todos los ítems fueron procesados o anulados.`, 'Compra Lista');
      }
    } catch (err) {
      toast.error("Error al anular renglón: " + err.message);
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
            doc_numero: r.doc_numero_actual,
            enviado_almacen: false
          } : null;

          const nuevaCantComprada = (r.cantidad_comprada || 0) + (r.compra_actual_cant || 0);
          const nuevaCantPendiente = r.anulado ? 0 : Math.max(0, r.cantidad_pedida - nuevaCantComprada);

          let nuevoStatus = r.status;
          if (r.anulado) nuevoStatus = 'Completado';
          else if (nuevaCantPendiente === 0) nuevoStatus = 'Completado';
          else if (nuevaCantComprada > 0) nuevoStatus = 'Parcial';

          return {
            ...r,
            anulado: r.anulado || false,
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
          if (t.tipo === 'JUSTIFICACION' || t.tipo === 'ANULACION') return sum;
          return sum + ((Number(t.cant) || 0) * (Number(t.pu) || 0));
        }, 0);
        const estimadoPendiente = (Number(r.cantidad_pendiente ?? r.cant) || 0) * Number(r.pu_estimado || r.pu || 0);
        return acc + ejecutadoItem + estimadoPendiente;
      }, 0);

      const totalEjecutadoReal = renglonesProcesados.reduce((acc, r) => {
        const ejecutadoItem = (r.historial_compras || []).reduce((sum, t) => {
          if (t.tipo === 'JUSTIFICACION' || t.tipo === 'ANULACION') return sum;
          return sum + ((Number(t.cant) || 0) * (Number(t.pu) || 0));
        }, 0);
        return acc + ejecutadoItem;
      }, 0);

      const totalConIVA = totalDinamicoReal * (requisicionActiva?.con_iva !== false ? 1.16 : 1.00);
      const ejecutadoConIVA = totalEjecutadoReal * (requisicionActiva?.con_iva !== false ? 1.16 : 1.00);

      const updatePayload = {
        items: renglonesProcesados,
        total_bs: totalConIVA,
        total_ejecutado: ejecutadoConIVA,
        status_compra: nuevoStatusCompra
      };

      if (nuevoStatusCompra === 'Completado' || nuevoStatusCompra === 'COMPLETADO') {
        updatePayload.f_finalizado = new Date().toISOString();
      }

      // SLA Reactivation / Compensation logic
      let resumedAt = null;
      let newDeadline = requisicionActiva?.fecha_limite_compra;
      const isPurchasedNow = !esBorrador && renglones.some(r => r.compra_actual_cant > 0);
      
      if (isPurchasedNow && requisicionActiva?.is_pausada) {
        resumedAt = new Date().toISOString();
        const pausedAt = requisicionActiva.paused_at ? new Date(requisicionActiva.paused_at) : new Date(requisicionActiva.fecha_emision);
        const deltaMs = new Date(resumedAt).getTime() - pausedAt.getTime();
        
        let baseDeadline = requisicionActiva.fecha_limite_compra;
        if (!baseDeadline && requisicionActiva.fecha_emision) {
          const base = new Date(requisicionActiva.fecha_emision);
          const dias = requisicionActiva.prioridad === 'Emergencia' ? 2 : 5;
          baseDeadline = new Date(base.getTime() + (dias * 24 * 60 * 60 * 1000)).toISOString();
        }
        
        if (baseDeadline) {
          newDeadline = new Date(new Date(baseDeadline).getTime() + deltaMs).toISOString();
        }
        
        updatePayload.is_pausada = false;
        updatePayload.resumed_at = resumedAt;
        updatePayload.fecha_limite_compra = newDeadline;
        
        // Log reactivation in background
        supabase.from('requisicion_logs').insert({
          requisicion_id: editandoId,
          usuario_id: currentUser?.id,
          usuario_nombre: `${currentUser?.nombre} ${currentUser?.apellido}`.trim(),
          accion: 'REANUDACIÓN',
          comentario: `SLA reactivado por COMPRADO. Compensación de ${Math.round(deltaMs / (1000 * 60 * 60))} horas aplicada.`
        }).then();
      }

      const { error } = await supabase
        .from('requisiciones')
        .update(updatePayload)
        .eq('id', editandoId);

      if (error) throw error;

      await actualizarTotalesSolicitud(editandoId);

      if (esBorrador) {
        toast.success("Borrador guardado correctamente.");
        setRequisicionActiva(prev => ({ 
          ...prev, 
          items: renglonesProcesados,
          ...(resumedAt ? {
            is_pausada: false,
            resumed_at: resumedAt,
            fecha_limite_compra: newDeadline
          } : {})
        }));
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
      totalCalculado: totals.subTotal * (requisicionActiva?.con_iva !== false ? 1.16 : 1.00),
      montoPagadoF: totals.totalF,
      montoPendienteNE: totals.totalNE
    };
  }, [renglones, requisicionActiva]);

  const getInitials = (nombre, apellido) => {
    return `${nombre?.charAt(0) || ''}${apellido?.charAt(0) || ''}`.toUpperCase();
  };

  // --- RESTRICCIÓN DE ACCESO (VISTA) ---

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
      {/* --- ENCABECERA UNIFICADA PREMIUM --- */}
      <div style={{
        borderLeft: '6px solid #0ea5e9',
        paddingLeft: '16px',
        marginBottom: '30px'
      }}>
        <h1 style={{ margin: 0, color: '#0f172a', fontSize: '1.8rem', fontWeight: '900', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.5px' }}>
          Gestión de Compras
        </h1>
        <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem', fontWeight: '500', fontFamily: 'Inter, sans-serif' }}>
          Procesamiento de requisiciones con aprobación de Gerencia General
        </p>
      </div>

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

          {esGerenteDeCompras && (
            <select
              className="input-tc"
              style={{ width: '180px', margin: 0, backgroundColor: '#f0fdf4', color: '#15803d', fontWeight: 'bold' }}
              value={filtroAnalista}
              onChange={(e) => setFiltroAnalista(e.target.value)}
            >
              <option value="Todos">👤 Todos los Analistas</option>
              <option value="Sin Asignar">⚠️ Sin Asignar</option>
              {analistas.map(a => (
                <option key={a.id} value={a.id}>
                  👤 {a.nombre} {a.apellido}
                </option>
              ))}
            </select>
          )}

          {!esGerenteDeCompras && esDeCompras && (
            <button
              onClick={() => setVerSoloMisAsignadas(prev => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: verSoloMisAsignadas ? '#e0f2fe' : 'white',
                color: verSoloMisAsignadas ? '#0369a1' : '#475569',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: verSoloMisAsignadas ? '0 1px 2px rgba(14, 165, 233, 0.15)' : 'none'
              }}
            >
              {verSoloMisAsignadas ? '👤 Ver Solo Mis Asignaciones' : '👥 Ver Todas'}
            </button>
          )}
        </div>
      </div>

      <div className="table-container" style={{ padding: 0, overflow: 'hidden', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
        <table className="tc-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '220px', padding: '12px 15px' }}>ID REQ</th>
              <th style={{ padding: '12px 15px' }}>CATEGORÍA</th>
              <th style={{ padding: '12px 15px' }}>SOLICITANTE / GERENCIA</th>
              <th style={{ padding: '12px 15px' }}>C. COSTOS</th>
              <th style={{ textAlign: 'center', width: '120px', padding: '12px 15px' }}>PRIORIDAD</th>
              <th style={{ textAlign: 'center', width: '130px', padding: '12px 15px' }}>SLA / TIEMPO</th>
              <th style={{ textAlign: 'right', padding: '12px 15px' }}>TOTAL $</th>
              <th style={{ textAlign: 'center', width: '160px', padding: '12px 15px' }}>RESPONSABLE</th>
              <th style={{ textAlign: 'center', width: '140px', padding: '12px 15px' }}>ESTATUS</th>
            </tr>
          </thead>
          <tbody>
            {(loading && historial.length === 0) ? (
              <tr><td colSpan="10" style={{ textAlign: 'center', padding: '30px' }}><Loader2 className="animate-spin" /> Cargando...</td></tr>
            ) : historialFiltrado.map(req => (
              <tr key={req.id} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td
                  style={{ padding: '8px 15px' }}
                  onClick={() => abrirProcesamiento(req)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <motion.span
                      whileHover={{
                        scale: 1.1,
                        x: 5,
                        color: '#2563eb',
                        textShadow: '0 0 8px rgba(37, 99, 235, 0.2)'
                      }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 10 }}
                      style={{
                        fontSize: '12px',
                        fontWeight: '900',
                        color: '#1e40af',
                        textDecoration: 'underline',
                        textUnderlineOffset: '3px',
                        textDecorationColor: 'rgba(30, 64, 175, 0.4)',
                        cursor: 'pointer',
                        display: 'inline-block'
                      }}
                    >
                      {req.correlativo}
                    </motion.span>
                    {req.observaciones && (
                      <MessageSquare
                        size={14}
                        style={{
                          color: req.leido_compras_at === null ? '#f59e0b' : '#16a34a',
                          fill: req.leido_compras_at === null ? '#fef3c7' : '#dcfce7'
                        }}
                      />
                    )}
                    {(req.facturas_url || req.factura_url || []).length > 0 && (
                      <Paperclip size={14} style={{ color: '#0ea5e9' }} />
                    )}
                  </div>
                </td>

                <td style={{ padding: '8px 15px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={req.items?.[0]?.descripcion}>
                    {req.items?.[0]?.descripcion || 'Sin descripción'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '500' }}>
                    {req.items?.[0]?.categoria || 'N/A'} {req.items?.length > 1 ? (
                      <span
                        style={{ color: '#0ea5e9', cursor: 'help', fontWeight: '800' }}
                        title={req.items.slice(1).map(it => `- ${it.descripcion}`).join('\n')}
                      >
                        (+{req.items.length - 1} más)
                      </span>
                    ) : ''}
                  </div>
                </td>
                <td style={{ padding: '8px 15px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b', lineHeight: '1.2' }}>{req.solicitante}</div>
                  <div style={{ fontSize: '0.7rem', fontWeight: '500', color: '#64748b', marginTop: '1px', lineHeight: '1.2' }}>{req.gerencia}</div>
                </td>
                <td style={{ padding: '8px 15px', color: '#475569', fontSize: '0.85rem', fontWeight: '500' }}>{req.centro_costo}</td>
                <td style={{ textAlign: 'center', padding: '8px 15px' }}>
                  {req.prioridad === 'Emergencia' ? (
                    <span style={{ color: '#ef4444', fontSize: '0.65rem', fontWeight: '900' }}>🔥 EMERGENCIA</span>
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: '0.65rem', fontWeight: '700' }}>NORMAL</span>
                  )}
                </td>
                <td style={{ textAlign: 'center', padding: '8px 15px' }}>
                  {(() => {
                    const isJustificada = req.items?.some(it => 
                      it.historial_compras?.some(h => h.tipo === 'JUSTIFICACION')
                    );

                    let deadline = req.fecha_limite_compra;
                    if (!deadline && req.fecha_emision) {
                      const base = new Date(req.fecha_emision);
                      const dias = req.prioridad === 'Emergencia' ? 2 : 5;
                      deadline = new Date(base.getTime() + (dias * 24 * 60 * 60 * 1000)).toISOString();
                    }

                    if (deadline && req.status_compra !== 'Completado') {
                      const limite = new Date(deadline);
                      const hoy = new Date();
                      const diff = limite.getTime() - hoy.getTime();
                      const isPausada = req.is_pausada;

                      if (isJustificada) return (
                        <div style={{
                          fontSize: '0.65rem',
                          fontWeight: '800',
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          display: 'inline-block',
                          whiteSpace: 'nowrap'
                        }}>
                          ⏸️ SLA Pausado - Justificado
                        </div>
                      );

                      if (isPausada) return (
                        <div style={{
                          fontSize: '0.65rem',
                          fontWeight: '800',
                          backgroundColor: '#fef3c7',
                          color: '#d97706',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid #fde68a',
                          display: 'inline-block',
                          whiteSpace: 'nowrap'
                        }}>
                          ⏸️ SLA Pausado - Espera de Precios
                        </div>
                      );

                      const horasTotales = Math.floor(diff / (1000 * 60 * 60));
                      const color = horasTotales < 0 ? '#ef4444' : (horasTotales < 24 ? '#f59e0b' : '#16a34a');

                      const dias = Math.floor(horasTotales / 24);
                      const horasRestantes = horasTotales % 24;
                      const label = horasTotales < 0 ? 'VENCIDO' : (dias > 0 ? `${dias}d ${horasRestantes}h` : `${horasRestantes}h`);

                      const msCreationDiff = hoy.getTime() - new Date(req.fecha_emision).getTime();
                      const hoursSinceCreation = msCreationDiff / (1000 * 60 * 60);
                      const isUnattendedNormal = req.prioridad !== 'Emergencia' && hoursSinceCreation >= 48 && (req.status_compra === 'En espera' || !req.status_compra) && !isJustificada;
                      const isUnattendedEmergencia = req.prioridad === 'Emergencia' && hoursSinceCreation >= 24 && (req.status_compra === 'En espera' || !req.status_compra) && !isJustificada;

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <div style={{
                            fontSize: '0.75rem',
                            fontWeight: '800',
                            backgroundColor: `${color}15`,
                            color: color,
                            padding: '4px 8px',
                            borderRadius: '6px',
                            display: 'inline-block'
                          }}>
                            {label}
                          </div>
                          {isUnattendedNormal && (
                            <span className="animate-pulse" style={{
                              fontSize: '0.65rem',
                              fontWeight: '900',
                              backgroundColor: '#fee2e2',
                              color: '#ef4444',
                              border: '1px solid #fca5a5',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              cursor: 'help'
                            }} title="Esta requisición de prioridad Normal lleva más de 48 horas sin compras ni justificaciones registradas. Requiere acción inmediata.">
                              {"⚠️ SIN ATENDER (>48h)"}
                            </span>
                          )}
                          {isUnattendedEmergencia && (
                            <span className="animate-pulse" style={{
                              fontSize: '0.65rem',
                              fontWeight: '900',
                              backgroundColor: '#fee2e2',
                              color: '#ef4444',
                              border: '1px solid #fca5a5',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              cursor: 'help'
                            }} title="Esta requisición de prioridad Emergencia lleva más de 24 horas sin compras ni justificaciones registradas. Requiere acción inmediata.">
                              {"⚠️ SIN ATENDER (>24h)"}
                            </span>
                          )}
                        </div>
                      );
                    }
                    return <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>-</span>;
                  })()}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#1e293b', padding: '8px 15px' }}>
                  $ {(req.total || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ textAlign: 'center', padding: '8px 15px' }}>
                  {esGerenteDeCompras ? (
                    <select
                      className="input-tc"
                      disabled={loadingAsignacion}
                      style={{
                        width: '100%',
                        margin: 0,
                        padding: '4px 8px',
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: req.asignado_a ? '#f0fdf4' : '#fffbeb',
                        color: req.asignado_a ? '#15803d' : '#b45309',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                      }}
                      value={req.asignado_a || ''}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const selectedAnalista = analistas.find(a => a.id === selectedId);
                        const selectedName = selectedAnalista ? `${selectedAnalista.nombre} ${selectedAnalista.apellido}` : '';
                        ejecutarAsignacion(req.id, selectedId || null, selectedName || null);
                      }}
                    >
                      <option value="" style={{ color: '#ef4444', fontWeight: 'bold' }}>⚠️ Sin Asignar</option>
                      {analistas.map(a => {
                        const workload = historial.filter(r => r.asignado_a === a.id && r.status_compra !== 'Completado').length;
                        const isSuggested = (req.items || []).some(it => {
                          const cat = it.categoria?.toLowerCase() || '';
                          const name = a.nombre.toLowerCase();
                          if (name.includes('marilyn') && cat.includes('almacen')) return true;
                          if (name.includes('ricardo') && (cat.includes('compras') || cat.includes('tecnologia') || cat.includes('ferreteria'))) return true;
                          return false;
                        });

                        return (
                          <option key={a.id} value={a.id} style={{ color: '#1e293b' }}>
                            👤 {a.nombre} {a.apellido} ({workload} act) {isSuggested ? '💡' : ''}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <div>
                      {req.asignado_a ? (
                        <span style={{
                          backgroundColor: req.asignado_a === currentUser?.id ? '#dcfce7' : '#f1f5f9',
                          color: req.asignado_a === currentUser?.id ? '#15803d' : '#475569',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: '800',
                          display: 'inline-block',
                          border: req.asignado_a === currentUser?.id ? '1px solid #bbf7d0' : '1px solid #e2e8f0'
                        }}>
                          👤 {req.asignado_a === currentUser?.id ? 'Mi Asignación' : (req.asignado_nombre || 'Asignado')}
                        </span>
                      ) : (
                        <span style={{
                          backgroundColor: '#fffbeb',
                          color: '#b45309',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '0.7rem',
                          fontWeight: '900',
                          display: 'inline-block',
                          border: '1px solid #fef3c7'
                        }}>
                          ⚠️ SIN ASIGNAR
                        </span>
                      )}
                    </div>
                  )}
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
          <div className="modal-card animate-modal" style={{ maxWidth: '1450px', height: '95vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            
            {/* CABECERA FIJA */}
            <div style={{ padding: '25px 35px 15px 35px', flexShrink: 0, borderBottom: '1px solid #e2e8f0', backgroundColor: 'white', position: 'relative' }}>
              <button 
                onClick={intentarCerrarModal}
                style={{ position: 'absolute', top: '20px', right: '20px', border: 'none', background: '#f1f5f9', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s', zIndex: 100 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
              >
                <X size={20} />
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{
                      backgroundColor: 'var(--primary)',
                      color: 'white',
                      padding: '5px 12px',
                      borderRadius: '8px',
                      fontSize: '0.7rem',
                      fontWeight: '900',
                      letterSpacing: '0.05em',
                      boxShadow: '0 4px 12px rgba(14, 165, 233, 0.2)'
                    }}>
                      GESTIÓN DE COMPRA
                    </div>
                    <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '950', color: '#0f172a', letterSpacing: '-0.5px' }}>
                      {requisicionActiva?.correlativo}
                    </h1>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '38px', height: '38px', borderRadius: '12px',
                        backgroundColor: '#f1f5f9', color: '#1e293b',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.9rem', fontWeight: 'bold', border: '1px solid #e2e8f0'
                      }}>
                        {getInitials(requisicionActiva?.solicitante?.split(' ')[0], requisicionActiva?.solicitante?.split(' ')[1])}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>SOLICITANTE</span>
                        <span style={{ fontSize: '1rem', fontWeight: '700', color: '#1e293b' }}>{requisicionActiva?.solicitante}</span>
                      </div>
                    </div>

                    <div style={{ width: '1px', height: '30px', backgroundColor: '#e2e8f0' }}></div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>CENTRO DE COSTO</span>
                      <span style={{ fontSize: '1rem', fontWeight: '700', color: '#0ea5e9' }}>{requisicionActiva?.centro_costo}</span>
                    </div>

                    {requisicionActiva?.observaciones && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        backgroundColor: '#fffbeb',
                        color: '#d97706',
                        padding: '6px 14px',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        border: '1px solid #fef3c7',
                        marginLeft: '10px'
                      }}>
                        <MessageSquare size={16} fill="#fef3c7" />
                        POSEE OBSERVACIONES
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginRight: '50px' }}>
                  {/* SLA TIMER PANEL */}
                  {(() => {
                    if (!requisicionActiva || requisicionActiva.status_compra === 'Completado') return null;

                    const isJustificada = requisicionActiva.items?.some(it => 
                      it.historial_compras?.some(h => h.tipo === 'JUSTIFICACION')
                    );

                    let limiteDate = requisicionActiva.fecha_limite_compra;
                    if (!limiteDate && requisicionActiva.fecha_emision) {
                      const base = new Date(requisicionActiva.fecha_emision);
                      const dias = requisicionActiva.prioridad === 'Emergencia' ? 2 : 5;
                      limiteDate = new Date(base.getTime() + (dias * 24 * 60 * 60 * 1000));
                    } else if (limiteDate) {
                      limiteDate = new Date(limiteDate);
                    }

                    if (!limiteDate) return null;

                    const hoy = new Date();
                    const diff = limiteDate.getTime() - hoy.getTime();
                    const isPausada = requisicionActiva.is_pausada;

                    if (isJustificada) return (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        backgroundColor: '#f1f5f9',
                        padding: '8px 15px',
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor: '#cbd5e1'
                      }}>
                        <Clock size={16} color="#475569" />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>
                            SLA Pausado
                          </span>
                          <span style={{
                            fontSize: '0.9rem',
                            fontWeight: '1000',
                            color: '#475569'
                          }}>
                            Justificación Registrada
                          </span>
                        </div>
                      </div>
                    );

                    return (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        backgroundColor: isPausada ? '#fffbeb' : '#f8fafc',
                        padding: '8px 15px',
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor: isPausada ? '#fde68a' : '#e2e8f0'
                      }}>
                        {isPausada ? <AlertCircle size={16} color="#d97706" /> : <Clock size={16} color="#64748b" />}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>
                            {isPausada ? 'SLA Pausado - Espera de Precios' : 'Tiempo Límite'}
                          </span>
                          <span style={{
                            fontSize: '0.9rem',
                            fontWeight: '1000',
                            color: (() => {
                              if (isPausada) return '#d97706';
                              return diff < 0 ? '#ef4444' : (diff < 86400000 ? '#f59e0b' : '#16a34a');
                            })()
                          }}>
                            {(() => {
                              if (diff < 0 && !isPausada) return 'PLAZO VENCIDO';
                              if (isPausada) return 'Espera de Precios';
                              const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                              const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                              return `${d}d ${h}h restantes`;
                            })()}
                          </span>
                        </div>

                        <button
                          onClick={() => manejarPostergacion(requisicionActiva)}
                          style={{
                            marginLeft: '10px',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: isPausada ? '#fef3c7' : 'white',
                            color: isPausada ? '#d97706' : '#64748b',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          {isPausada ? '▶️ REANUDAR' : '⏸️ POSTERGAR'}
                        </button>
                      </div>
                    );
                  })()}



                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>Status de Compra</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '900', color: requisicionActiva?.status_compra === 'Completado' ? '#15803d' : '#854d0e' }}>
                      {requisicionActiva?.status_compra || 'EN ESPERA'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="req-header-line" style={{ margin: '15px 0' }}></div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                {(() => {
                  const isJustificada = requisicionActiva?.items?.some(it => 
                    it.historial_compras?.some(h => h.tipo === 'JUSTIFICACION')
                  );
                  const hoy = new Date();
                  const hoursSinceCreation = requisicionActiva?.fecha_emision 
                    ? (hoy.getTime() - new Date(requisicionActiva.fecha_emision).getTime()) / (1000 * 60 * 60)
                    : 0;
                  const isUnattendedOverDay = hoursSinceCreation >= 24 && (requisicionActiva?.status_compra === 'En espera' || !requisicionActiva?.status_compra) && !isJustificada;

                  if (!isUnattendedOverDay) return null;

                  return (
                    <div className="animate-pulse" style={{
                      backgroundColor: '#fee2e2',
                      padding: '12px 18px',
                      borderRadius: '10px',
                      borderLeft: '4px solid #ef4444',
                      gridColumn: '1 / -1',
                      marginBottom: '5px'
                    }}>
                      <label style={{ fontSize: '0.65rem', fontWeight: '900', color: '#b91c1c', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', margin: 0, marginBottom: '4px' }}>
                        ⚠️ ALERTA DE INACTIVIDAD
                      </label>
                      <p style={{ margin: 0, color: '#7f1d1d', fontSize: '0.9rem', fontWeight: '700', lineHeight: '1.4' }}>
                        Esta requisición lleva más de 24 horas sin compras ni justificaciones registradas. Por favor, proceda a realizar compras o registre una justificación de retraso de inmediato.
                      </p>
                    </div>
                  );
                })()}
                {requisicionActiva?.observaciones_direccion && (
                  <div style={{
                    backgroundColor: '#faf5ff',
                    padding: '12px 18px',
                    borderRadius: '10px',
                    borderLeft: '4px solid #7c3aed',
                    gridColumn: '1 / -1',
                    marginBottom: '5px'
                  }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: '900', color: '#6d28d9', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', margin: 0, marginBottom: '4px' }}>
                      🏛️ Directrices de la Dirección
                    </label>
                    <p style={{ margin: 0, color: '#4c1d95', fontSize: '0.9rem', fontWeight: '600', lineHeight: '1.4' }}>
                      {requisicionActiva.observaciones_direccion}
                    </p>
                  </div>
                )}

                <div style={{
                  backgroundColor: '#f1f5f9',
                  padding: '12px 18px',
                  borderRadius: '10px',
                  borderLeft: '4px solid #94a3b8'
                }}>
                  <label style={{ fontSize: '0.65rem', fontWeight: '900', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Justificación Operativa
                  </label>
                  <p style={{ margin: 0, color: '#1e293b', fontSize: '0.9rem', fontWeight: '500', lineHeight: '1.4' }}>
                    {requisicionActiva?.justificacion || 'Sin justificación registrada'}
                  </p>
                </div>

                <div style={{
                  backgroundColor: '#fffbeb',
                  padding: '12px 18px',
                  borderRadius: '10px',
                  borderLeft: '4px solid #f59e0b'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: '900', color: '#92400e', textTransform: 'uppercase', display: 'block', margin: 0 }}>
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
                        style={{ minHeight: '60px', paddingTop: '10px', fontSize: '0.8rem' }}
                        value={obsTemporal}
                        onChange={(e) => setObsTemporal(e.target.value)}
                        placeholder="Actualice las observaciones aquí..."
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-tc btn-tc-success" style={{ padding: '4px 12px', fontSize: '0.65rem' }} onClick={guardarObservacionesDirecto}>✓ GUARDAR</button>
                        <button className="btn-tc btn-tc-secondary" style={{ padding: '4px 12px', fontSize: '0.65rem' }} onClick={() => setEditandoObs(false)}>CANCELAR</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                      {parsearObservaciones(requisicionActiva?.observaciones).length === 0 ? (
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>Sin observaciones registradas</span>
                      ) : (
                        parsearObservaciones(requisicionActiva?.observaciones).map((c, idx) => (
                          <div
                            key={idx}
                            style={{
                              backgroundColor: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              fontSize: '0.8rem'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', gap: '15px' }}>
                              <span style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '0.75rem' }}>
                                {c.author || c.autor || 'Usuario'} {c.rol ? `(${c.rol})` : ''}
                              </span>
                              {c.date && (
                                <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                                  {(() => {
                                    try {
                                      const d = new Date(c.date);
                                      return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) + ' - ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
                                    } catch (_e) {
                                      return '';
                                    }
                                  })()}
                                </span>
                              )}
                            </div>
                            <p style={{ margin: 0, color: '#334155', fontSize: '0.8rem', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                              {c.text || c.texto || ''}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CUERPO DESPLAZABLE */}
            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '20px 35px' }}>
              <table className="tc-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <th style={{ width: '40px' }}>N°</th>
                    <th style={{ width: '120px' }}>PRODUCTO</th>
                    <th style={{ textAlign: 'center', width: '60px' }}>PED.</th>
                    <th style={{ textAlign: 'center', width: '60px' }}>COMP.</th>
                    <th style={{ textAlign: 'center', width: '60px' }}>PEND.</th>
                    <th style={{ textAlign: 'center', width: '260px' }}>DETALLE PAGO / PROVEEDOR</th>
                    <th style={{ textAlign: 'right', width: '100px' }}>CANT. REAL</th>
                    <th style={{ textAlign: 'right', width: '110px' }}>P.U. REAL</th>
                    <th style={{ textAlign: 'right', width: '100px' }}>TOTAL $</th>
                    <th style={{ textAlign: 'center', width: '80px' }}>ALMACÉN</th>
                    <th style={{ textAlign: 'center', width: '130px' }}>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {renglones.map((f, i) => (
                    <React.Fragment key={f.id}>
                      <tr style={{
                        backgroundColor: f.anulado ? '#f8fafc' : ((Number(f.cantidad_comprada || 0) + Number(f.compra_actual_cant || 0)) >= Number(f.cantidad_pedida) ? '#f0fdf4' : 'transparent'),
                        borderLeft: f.anulado ? '4px solid #ef4444' : ((Number(f.cantidad_comprada || 0) + Number(f.compra_actual_cant || 0)) >= Number(f.cantidad_pedida) ? '4px solid #16a34a' : 'none'),
                        opacity: f.anulado ? 0.75 : 1,
                        transition: 'all 0.3s ease'
                      }}>
                        <td style={{ fontWeight: 'bold' }}>{i + 1}</td>
                        <td style={{ verticalAlign: 'middle' }}>
                          <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '0.9rem', textDecoration: f.anulado ? 'line-through' : 'none' }}>{f.descripcion}</div>
                          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>{f.categoria}</div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: '650', color: '#64748b' }}>{f.cantidad_pedida} {f.uni || f.unidad || ''}</td>
                        <td style={{ textAlign: 'center', color: '#16a34a', fontWeight: '800' }}>{f.cantidad_comprada} {f.uni || f.unidad || ''}</td>
                        <td style={{
                          textAlign: 'center',
                          fontWeight: '800',
                          color: f.cantidad_pendiente > 0 ? '#f97316' : '#94a3b8'
                        }}>{f.cantidad_pendiente} {f.uni || f.unidad || ''}</td>

                        {/* CELDA COMPACTA PAGO / PROVEEDOR */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
                            <span style={{ fontSize: '9px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase' }}>Categoría, Proveedor y Moneda</span>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%' }}>
                              <select
                                className="input-tc focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                style={{ flex: 1, minWidth: '80px', fontSize: '11px', padding: '4px', fontWeight: 'bold', border: '1px solid #cbd5e1', height: '32px' }}
                                value={f.categoria_proveedor || ''}
                                onChange={(e) => {
                                  actualizarFila(f.id, 'categoria_proveedor', e.target.value);
                                  actualizarFila(f.id, 'proveedor_seleccionado_id', '');
                                }}
                                disabled={f.cantidad_pendiente === 0 || f.anulado}
                              >
                                <option value="">Categoría</option>
                                {categoriasProveedores.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                              <select
                                className="input-tc focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                style={{ flex: 1.2, minWidth: '90px', fontSize: '11px', padding: '4px', fontWeight: 'bold', border: '1px solid #cbd5e1', height: '32px' }}
                                value={f.proveedor_seleccionado_id || ''}
                                onChange={(e) => actualizarFila(f.id, 'proveedor_seleccionado_id', Number(e.target.value))}
                                onKeyDown={(e) => handleKeyDown(e, f.id, 'proveedor')}
                                ref={el => { if (!inputRefs.current[f.id]) inputRefs.current[f.id] = {}; inputRefs.current[f.id].proveedor = el; }}
                                disabled={f.cantidad_pendiente === 0 || f.anulado}
                              >
                                <option value="">Proveedor</option>
                                {proveedoresFiltradosPorFila(f).map(p => (
                                  <option key={p.id} value={p.id}>{p.razon_social}</option>
                                ))}
                              </select>
                              <select
                                className="input-tc focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                style={{ width: '65px', fontSize: '10px', padding: '2px', height: '32px', border: '1px solid #cbd5e1', fontWeight: '800' }}
                                value={f.metodo_pago_actual || '$ / BS'}
                                onChange={(e) => actualizarFila(f.id, 'metodo_pago_actual', e.target.value)}
                                disabled={f.cantidad_pendiente === 0 || f.anulado}
                              >
                                <option value="$ / BS">$ / BS</option>
                                <option value="$ / $">$ / $</option>
                              </select>
                            </div>
                          </div>
                        </td>

                        <td style={{ verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', textAlign: 'right' }}>COMPRAR ({f.uni || f.unidad || ''})</span>
                            <input
                              className="input-tc focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                              type="number"
                              value={f.compra_actual_cant === 0 && f.compra_actual_cant !== '' ? '' : f.compra_actual_cant}
                              disabled={f.cantidad_pendiente === 0 || f.anulado}
                              style={{
                                textAlign: 'right',
                                fontWeight: '900',
                                fontSize: '13px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                              }}
                              onChange={(e) => actualizarFila(f.id, 'compra_actual_cant', e.target.value)}
                              onFocus={(e) => e.target.select()}
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
                                value={f.compra_actual_pu === 0 && f.compra_actual_pu !== '' ? '' : f.compra_actual_pu}
                                disabled={f.cantidad_pendiente === 0 || f.anulado}
                                style={{
                                  textAlign: 'right',
                                  fontWeight: '900',
                                  fontSize: '13px',
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: '#ffffff',
                                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                                }}
                                onChange={(e) => actualizarFila(f.id, 'compra_actual_pu', e.target.value)}
                                onFocus={(e) => e.target.select()}
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
                          {f.anulado ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', marginTop: '4px' }}>
                              {f.cantidad_comprada > 0 ? (
                                <span style={{ fontSize: '9px', color: '#0891b2', fontWeight: '900', backgroundColor: '#ecfeff', padding: '2px 6px', borderRadius: '4px' }}>SATISFECHO PARCIAL</span>
                              ) : (
                                <span style={{ fontSize: '9px', color: '#ef4444', fontWeight: '900', backgroundColor: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>🚫 SIN EFECTO</span>
                              )}
                            </div>
                          ) : (Number(f.cantidad_comprada || 0) + Number(f.compra_actual_cant || 0)) >= Number(f.cantidad_pedida) ? (
                            <div style={{ fontSize: '9px', color: '#14532d', fontWeight: '900' }}>COMPLETO ✓</div>
                          ) : (Number(f.cantidad_comprada || 0) + Number(f.compra_actual_cant || 0)) > 0 ? (
                            <div style={{ fontSize: '9px', color: '#f97316', fontWeight: '900' }}>PARCIAL</div>
                          ) : null}
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          {(() => {
                            let statusAlmacen = f.estatus_almacen || (f.enviado_almacen ? 'Ubicado' : 'Pendiente_Compras');
                            if (f.historial_compras?.length > 0) {
                              const trans = f.historial_compras.filter(h => h.tipo !== 'JUSTIFICACION' && h.tipo !== 'ANULACION');
                              if (trans.length > 0) {
                                const allUbicados = trans.every(h => (h.estatus_almacen || (h.enviado_almacen ? 'Ubicado' : 'Pendiente_Compras')) === 'Ubicado');
                                const anyPorClasificar = trans.some(h => (h.estatus_almacen || (h.enviado_almacen ? 'Ubicado' : 'Pendiente_Compras')) === 'Por_Clasificar_Almacen');
                                if (allUbicados) {
                                  statusAlmacen = 'Ubicado';
                                } else if (anyPorClasificar) {
                                  statusAlmacen = 'Por_Clasificar_Almacen';
                                } else {
                                  statusAlmacen = 'Pendiente_Compras';
                                }
                              }
                            }
                            const disableAlmacen = f.anulado && (f.cantidad_comprada || 0) === 0;
                            let bg = '#f1f5f9';
                            let borderCol = '#e2e8f0';
                            let textCol = '#94a3b8';
                            let titleStr = 'Pendiente en Compras';
                            let icon = '📥';

                            if (statusAlmacen === 'Por_Clasificar_Almacen') {
                              bg = '#e0f2fe';
                              borderCol = '#0ea5e9';
                              textCol = '#0369a1';
                              titleStr = 'Enviado a Clasificación de Almacén';
                              icon = '📦';
                            } else if (statusAlmacen === 'Ubicado') {
                              bg = '#dcfce7';
                              borderCol = '#22c55e';
                              textCol = '#15803d';
                              titleStr = 'Ubicado físicamente en Almacén';
                              icon = '📦';
                            }

                            return (
                              <div
                                onClick={() => { if (!disableAlmacen) toggleAlmacen(f.id, statusAlmacen); }}
                                style={{
                                  cursor: disableAlmacen ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '8px',
                                  backgroundColor: bg,
                                  border: '1px solid',
                                  borderColor: borderCol,
                                  color: textCol,
                                  transition: 'all 0.2s',
                                  fontSize: '1.1rem',
                                  opacity: disableAlmacen ? 0.3 : 1
                                }}
                                title={disableAlmacen ? 'Renglón sin efecto' : titleStr}
                              >
                                {icon}
                              </div>
                            );
                          })()}
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
                              {f.cantidad_pendiente > 0 && !f.anulado && (
                                <button
                                  onClick={() => {
                                    setItemParaAnular(f);
                                    setShowAnulacionModal(true);
                                  }}
                                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', fontSize: '1.15rem' }}
                                  title="Anular saldo pendiente (Dejar sin efecto)"
                                >
                                  🚫
                                </button>
                              )}
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
                            </div>
                          </div>
                        </td>
                      </tr>
                      {expandirHistorial[f.id] && f.historial_compras?.length > 0 && (
                        <tr>
                          <td colSpan="11" style={{ padding: '0 0 15px 50px' }}>
                            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                              <div style={{ padding: '10px 15px', backgroundColor: '#f8fafc', fontSize: '0.75rem', fontWeight: '900', color: '#334155', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0' }}>
                                <span style={{ letterSpacing: '0.05em' }}>TRAZABILIDAD Y REGISTROS DE COMPRA</span>
                                <span style={{ color: '#0ea5e9', backgroundColor: '#e0f2fe', padding: '2px 8px', borderRadius: '10px' }}>{f.historial_compras.length} EVENTOS</span>
                              </div>
                              <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '0.65rem', borderBottom: '1px solid #e2e8f0' }}>
                                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>FECHA</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>EVENTO</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>PROVEEDOR</th>
                              <th style={{ padding: '10px 12px', textAlign: 'left' }}>DETALLE / DOCUMENTO</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>CANT.</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>P.U. REAL</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>TOTAL / COMENTARIO</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>ALM.</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>USUARIO</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'center' }}></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {f.historial_compras.map((h, idx) => (
                                    <tr key={h.id || `${f.id}-h-${idx}`} style={{
                                      borderBottom: idx < f.historial_compras.length - 1 ? '1px solid #f1f5f9' : 'none',
                                      backgroundColor: h.tipo === 'ANULACION' ? '#fef2f2' : (h.tipo === 'JUSTIFICACION' ? '#fffbeb' : (h.tipo === 'DIRECTRIZ' ? '#faf5ff' : 'transparent')),
                                      transition: 'background-color 0.2s'
                                    }}>
                                      <td style={{ padding: '10px 12px', color: '#64748b', fontWeight: '600' }}>{new Date(h.fecha).toLocaleDateString()}</td>
                                      <td style={{
                                        padding: '10px 12px',
                                        fontWeight: '800',
                                        color: h.tipo === 'ANULACION' ? '#ef4444' : (h.tipo === 'JUSTIFICACION' ? '#d97706' : (h.tipo === 'DIRECTRIZ' ? '#7c3aed' : (h.doc_tipo === 'NC' ? '#f59e0b' : '#1e293b')))
                                      }}>
                                        {h.tipo === 'ANULACION' ? '🚫 ANULADO / SIN EFECTO' : (h.tipo === 'JUSTIFICACION' ? '⚠️ JUSTIFICACIÓN' : (h.tipo === 'DIRECTRIZ' ? '🏛️ DIRECTRIZ DIRECCIÓN' : (h.doc_tipo === 'NC' ? '💳 A CRÉDITO' : '✅ COMPRADO')))}
                                      </td>
                                      <td style={{ padding: '10px 12px', fontSize: '0.7rem', fontWeight: '700', color: '#334155' }}>
                                        {(h.tipo !== 'JUSTIFICACION' && h.tipo !== 'ANULACION' && h.tipo !== 'DIRECTRIZ') ? (h.proveedor_nombre || 'No asignado') : '-'}
                                      </td>
                                      <td style={{ padding: '10px 12px' }}>
                                        {h.tipo === 'ANULACION' ? (
                                          <div style={{ fontStyle: 'italic', color: '#b91c1c', fontWeight: '700', fontSize: '0.75rem' }}>
                                            Motivo: {h.motivo}
                                          </div>
                                        ) : h.tipo === 'JUSTIFICACION' ? (
                                          <div style={{ fontStyle: 'italic', color: '#92400e', fontWeight: '600', fontSize: '0.7rem' }}>{h.motivo}</div>
                                        ) : h.tipo === 'DIRECTRIZ' ? (
                                          <div style={{ fontStyle: 'italic', color: '#6d28d9', fontWeight: '600', fontSize: '0.75rem' }}>{h.motivo}</div>
                                        ) : (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <span style={{ fontSize: '0.6rem', backgroundColor: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontWeight: '900' }}>{h.metodo_pago}</span>
                                              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#1e293b' }}>
                                                {h.doc_tipo}: {h.doc_numero}
                                                {h.factura_url && (
                                                  <a href={h.factura_url} target="_blank" rel="noreferrer" title="Ver Soporte" style={{ marginLeft: '8px', textDecoration: 'none', cursor: 'pointer', fontSize: '1rem' }}>
                                                    📎
                                                  </a>
                                                )}
                                              </span>
                                            </div>
                                            {h.fecha_pago && (
                                              <div style={{ fontSize: '9px', color: '#16a34a', fontWeight: '800', textTransform: 'uppercase' }}>
                                                📅 PAGADO: {new Date(h.fecha_pago).toLocaleDateString()}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </td>
                                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '800', color: '#1e293b' }}>{(h.tipo === 'JUSTIFICACION' || h.tipo === 'ANULACION' || h.tipo === 'DIRECTRIZ') ? '-' : (h.cant || '-')}</td>
                                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#1e293b' }}>{(h.tipo === 'JUSTIFICACION' || h.tipo === 'ANULACION' || h.tipo === 'DIRECTRIZ') ? '-' : (h.pu ? `$ ${h.pu.toLocaleString('de-DE')}` : '-')}</td>
                                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                        {h.tipo === 'ANULACION' ? (
                                          <div style={{ fontSize: '0.7rem', color: '#7f1d1d', whiteSpace: 'pre-wrap', textAlign: 'left', backgroundColor: '#fee2e2', padding: '8px', borderRadius: '6px', border: '1px solid #fca5a5' }}>
                                            {h.comentario}
                                          </div>
                                        ) : h.tipo === 'JUSTIFICACION' ? (
                                          <div style={{ fontSize: '0.7rem', color: '#475569', whiteSpace: 'pre-wrap', textAlign: 'left', backgroundColor: '#fef3c7', padding: '8px', borderRadius: '6px', border: '1px solid #fde68a' }}>
                                            {h.comentario}
                                          </div>
                                        ) : h.tipo === 'DIRECTRIZ' ? (
                                          <div style={{ fontSize: '0.7rem', color: '#4c1d95', whiteSpace: 'pre-wrap', textAlign: 'left', backgroundColor: '#f3e8ff', padding: '8px', borderRadius: '6px', border: '1px solid #ddd6fe' }}>
                                            {h.comentario}
                                          </div>
                                        ) : <span style={{ fontWeight: '900', color: '#0ea5e9', fontSize: '0.85rem' }}>$ {(h.cant * h.pu).toLocaleString('de-DE')}</span>}
                                      </td>
                                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                        {h.tipo !== 'JUSTIFICACION' && h.tipo !== 'ANULACION' && h.tipo !== 'DIRECTRIZ' && (() => {
                                          const subStatus = h.estatus_almacen || (h.enviado_almacen ? 'Ubicado' : 'Pendiente_Compras');
                                          let bg = '#f1f5f9';
                                          let borderCol = '#e2e8f0';
                                          let textCol = '#94a3b8';
                                          let titleStr = 'Pendiente en Compras';
                                          let icon = '📥';
                                          
                                          if (subStatus === 'Por_Clasificar_Almacen') {
                                            bg = '#e0f2fe';
                                            borderCol = '#0ea5e9';
                                            textCol = '#0369a1';
                                            titleStr = 'Enviado a Clasificación de Almacén';
                                            icon = '📦';
                                          } else if (subStatus === 'Ubicado') {
                                            bg = '#dcfce7';
                                            borderCol = '#22c55e';
                                            textCol = '#15803d';
                                            titleStr = `Ubicado: ${h.ubicacion_almacen || 'Sin ubicación registrada'}`;
                                            icon = '📦';
                                          }
                                          
                                          return (
                                            <div
                                              onClick={() => toggleAlmacenSubRow(f.id, idx, subStatus)}
                                              style={{
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '6px',
                                                backgroundColor: bg,
                                                border: '1px solid',
                                                borderColor: borderCol,
                                                color: textCol,
                                                transition: 'all 0.2s',
                                                fontSize: '0.8rem'
                                              }}
                                              title={titleStr}
                                            >
                                              {icon}
                                            </div>
                                          );
                                        })()}
                                      </td>
                                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b', fontSize: '0.65rem', fontWeight: '600' }}>{h.usuario_nombre}</td>
                                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                        {currentUser?.correo?.toLowerCase() === 'jcontreras.totalclean@gmail.com' && (
                                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                            <button
                                              onClick={() => eliminarEntradaHistorial(f.id, idx)}
                                              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1rem', transition: 'transform 0.2s' }}
                                              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                                              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
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
                  <div
                    onClick={() => setExpandirSoportes(!expandirSoportes)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      marginBottom: '15px'
                    }}
                  >
                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      🧾 Soporte de Documentos
                      <span style={{ fontSize: '0.7rem', color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '10px' }}>
                        {facturasUrls.length} archivos
                      </span>
                    </h4>
                    <ChevronDown size={18} style={{ transform: expandirSoportes ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </div>

                  {expandirSoportes && (
                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
                      {facturasUrls.map((item, idx) => {
                        const url = (() => {
                          if (typeof item === 'string') {
                            if (item.trim().startsWith('{')) {
                              try { return JSON.parse(item).url; } catch (e) { return item; }
                            }
                            return item;
                          }
                          return item?.url;
                        })();
                        const etiqueta = (() => {
                          if (typeof item === 'string' && item.trim().startsWith('{')) {
                            try { return JSON.parse(item).etiqueta || 'Archivo'; } catch (e) { return 'Archivo'; }
                          }
                          return typeof item === 'string' ? 'Archivo' : (item?.etiqueta || 'Sin etiqueta');
                        })();
                        if (!url || url.length < 5) return null;

                        const lowerUrl = url.split('?')[0].toLowerCase();
                        const isImg = /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(lowerUrl);
                        const isPdf = lowerUrl.endsWith('.pdf');
                        const isExcel = /\.(xls|xlsx|csv)$/i.test(lowerUrl);
                        const isWord = /\.(doc|docx)$/i.test(lowerUrl);
                        const isPowerPoint = /\.(ppt|pptx)$/i.test(lowerUrl);

                        let fileInfo = { iconColor: '#64748b', bgColor: '#f8fafc', label: 'DOC' };
                        if (isPdf) {
                          fileInfo = { iconColor: '#ef4444', bgColor: '#fef2f2', label: 'PDF' };
                        } else if (isExcel) {
                          fileInfo = { iconColor: '#10b981', bgColor: '#ecfdf5', label: 'EXCEL' };
                        } else if (isWord) {
                          fileInfo = { iconColor: '#2563eb', bgColor: '#eff6ff', label: 'WORD' };
                        } else if (isPowerPoint) {
                          fileInfo = { iconColor: '#f97316', bgColor: '#fff7ed', label: 'PPT' };
                        }

                        return (
                          <div key={idx} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '5px', width: '80px' }}>
                            <a href={url} target="_blank" rel="noreferrer" style={{
                              display: 'block',
                              width: '80px', height: '80px',
                              borderRadius: '10px',
                              overflow: 'hidden',
                              border: '2px solid #cbd5e1',
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
                                  backgroundColor: fileInfo.bgColor, color: fileInfo.iconColor
                                }}>
                                  <FileText size={24} style={{ marginBottom: '4px' }} />
                                  <span style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>{fileInfo.label}</span>
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
                  )}
                  <label className="btn-tc btn-tc-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}>
                    {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                    <span>{uploading ? 'Subiendo...' : 'Adjuntar Documento'}</span>
                    <input type="file" multiple hidden onChange={subirFactura} disabled={uploading} />
                  </label>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                     <div style={{ 
                        backgroundColor: '#f0fdf4', 
                        padding: '15px 25px', 
                        borderRadius: '16px', 
                        border: '1px solid #dcfce7',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '15px',
                        marginBottom: '15px',
                        width: '100%',
                        boxShadow: '0 2px 4px rgba(22, 163, 74, 0.05)',
                        boxSizing: 'border-box'
                      }}>
                        <div style={{ 
                          backgroundColor: '#16a34a', 
                          color: 'white', 
                          width: '40px', 
                          height: '40px', 
                          borderRadius: '12px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          boxShadow: '0 4px 10px rgba(22, 163, 74, 0.2)'
                        }}>
                          <CheckCircle2 size={22} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Monto Facturado (FAC)
                          </span>
                          <span style={{ fontSize: '1.4rem', fontWeight: '1000', color: '#16a34a' }}>
                            $ {montoPagadoF.toLocaleString('de-DE')}
                          </span>
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
                </div>
              </div>
            </div>

            {/* PIE DE PÁGINA FIJO */}
            <div style={{ padding: '20px 35px 30px 35px', flexShrink: 0, borderTop: '1px solid #e2e8f0', backgroundColor: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                className="btn-tc btn-tc-secondary"
                onClick={intentarCerrarModal}
                style={{ padding: '12px 25px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}
              >
                CERRAR
              </button>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  className="btn-tc btn-tc-secondary"
                  onClick={generarGuiaChoferPDF}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Descargar Guía para el Chofer (Sin Precios)"
                >
                  📄 IMPRIMIR GUÍA CHOFER
                </button>
                <button
                  className="btn-tc btn-tc-secondary"
                  onClick={generarRequisicionPDF}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Descargar Requisición en PDF"
                >
                  📄 IMPRIMIR REQUISICIÓN
                </button>
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
                  disabled={loading || renglones.some(r => r.compra_actual_cant > 0)}
                  style={{ padding: '12px 30px', backgroundColor: '#16a34a', color: 'white', fontWeight: '900', boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)' }}
                >
                  {loading ? <Loader2 className="animate-spin" size={16} /> : 'PROCESAR COMPRA'}
                </button>
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
                <option value="Otros">Otros</option>
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
      {showPostergarModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-card animate-modal" style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ backgroundColor: '#fffbeb', padding: '10px', borderRadius: '50%' }}>
                <Clock size={24} color="#d97706" />
              </div>
              <h2 style={{ margin: 0 }}>Postergar Gestión de Compra</h2>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>
              Está a punto de <strong>pausar el tiempo de SLA</strong> para esta requisición. Esto se verá reflejado en los reportes de auditoría.
            </p>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '5px' }}>
                MOTIVO PRINCIPAL DE LA PAUSA (OBLIGATORIO)
              </label>
              <select
                className="input-tc"
                style={{ width: '100%', marginBottom: '10px' }}
                value={motivoCategoria}
                onChange={(e) => setMotivoCategoria(e.target.value)}
              >
                <option value="">Seleccione una categoría...</option>
                <option value="Espera de Proveedor">Espera de Proveedor (Cotización/Stock)</option>
                <option value="Presupuesto">Falta de Disponibilidad Presupuestaria</option>
                <option value="Definición Técnica">Aclaratoria Técnica Pendiente (Usuario)</option>
                <option value="Logística">Retraso en Logística / Importación</option>
                <option value="Otro">Otro (Especificar en comentario)</option>
              </select>

              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '5px' }}>
                DETALLE ADICIONAL
              </label>
              <textarea
                className="input-tc"
                style={{ width: '100%', minHeight: '80px', paddingTop: '10px' }}
                placeholder="Escriba detalles específicos sobre la causa de la pausa..."
                value={comentarioPostergacion}
                onChange={(e) => setComentarioPostergacion(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn-tc btn-tc-secondary" onClick={() => setShowPostergarModal(false)}>CANCELAR</button>
              <button
                className="btn-tc"
                style={{ backgroundColor: '#d97706', color: 'white', border: 'none' }}
                onClick={() => ejecutarCambioPausa(requisicionActiva, true, comentarioPostergacion)}
                disabled={loading || !motivoCategoria || !comentarioPostergacion.trim()}
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : 'PAUSAR TIEMPOS'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showAnulacionModal && itemParaAnular && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-card animate-modal" style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ backgroundColor: '#fee2e2', padding: '10px', borderRadius: '50%' }}>
                <AlertCircle size={24} color="#ef4444" />
              </div>
              <h2 style={{ margin: 0, color: '#ef4444', fontSize: '1.25rem' }}>Anular Saldo Pendiente</h2>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px', lineHeight: '1.4' }}>
              Estás a punto de anular el saldo pendiente del ítem <strong>{itemParaAnular.descripcion || itemParaAnular.desc}</strong>. Esta acción reducirá la cantidad pendiente a <strong>0</strong> y liberará cualquier fondo reservado.
            </p>

            <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.8rem', color: '#334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Cantidad Pedida:</span>
                <span style={{ fontWeight: 'bold' }}>{itemParaAnular.cantidad_pedida || itemParaAnular.cant}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Cantidad Comprada:</span>
                <span style={{ fontWeight: 'bold' }}>{itemParaAnular.cantidad_comprada || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', fontWeight: 'bold' }}>
                <span>Cantidad a Anular:</span>
                <span>{itemParaAnular.cantidad_pendiente}</span>
              </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '5px' }}>
                MOTIVO DE LA ANULACIÓN (OBLIGATORIO)
              </label>
              <select
                className="input-tc"
                style={{ width: '100%', marginBottom: '15px' }}
                value={motivoAnulacion}
                onChange={(e) => setMotivoAnulacion(e.target.value)}
              >
                <option value="">Seleccione un motivo...</option>
                <option value="Ya se encuentra en stock">Ya se encuentra en stock</option>
                <option value="Ya no hace falta / No requerido">Ya no hace falta / No requerido</option>
                <option value="Duplicado">Duplicado</option>
                <option value="Otro">Otro (Especifique en comentarios)</option>
              </select>

              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '5px' }}>
                COMENTARIO / EXPLICACIÓN DETALLADA (OBLIGATORIO)
              </label>
              <textarea
                className="input-tc"
                style={{ width: '100%', minHeight: '100px', paddingTop: '10px' }}
                placeholder="Por favor, explique la razón por la que se anula esta cantidad..."
                value={comentarioAnulacion}
                onChange={(e) => setComentarioAnulacion(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn-tc btn-tc-secondary" onClick={() => {
                setShowAnulacionModal(false);
                setMotivoAnulacion('');
                setComentarioAnulacion('');
              }}>
                Cancelar
              </button>
              <button
                className="btn-tc"
                style={{ backgroundColor: '#ef4444', color: 'white', border: 'none' }}
                onClick={ejecutarAnulacionFila}
                disabled={loading || !motivoAnulacion || comentarioAnulacion.trim().length < 5}
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : 'ANULAR SALDO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default Compras;
