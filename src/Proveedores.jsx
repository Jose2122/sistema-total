import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { Loader2, Plus, Search, Mail, Phone, MapPin, XCircle, Edit, Trash2, ShoppingBag, FileSpreadsheet, Users, BarChart3, TrendingUp, DollarSign, Package, ChevronUp, ChevronDown, Calendar, Filter, RotateCcw, AlertTriangle, CheckCircle2, ShieldAlert, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import './Proveedores.css';

const LISTA_CATEGORIAS = [
  "SERVICIO", "REPUESTO", "ALIMENTACIÓN", "TECNOLOGÍA", "PAPELERÍA", 
  "LIMPIEZA", "MANTENIMIENTO", "FERRETERÍA", "CONSUMIBLE", "EQUIPO",
  "TRANSPORTE", "OTROS"
];

const CIUDADES_DEFAULT = ["Maracaibo", "Caracas", "Guanare", "Valencia"];

const getStoredCiudades = () => {
  try {
    const raw = localStorage.getItem('lista_ciudades_proveedores');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  return CIUDADES_DEFAULT;
};

const Proveedores = ({ currentUser }) => {
  const usuarioActivo = currentUser || JSON.parse(localStorage.getItem('usuario_sesion') || localStorage.getItem('usuario') || '{}');
  const nombreUsuarioActual = usuarioActivo?.nombre ? `${usuarioActivo.nombre} ${usuarioActivo.apellido || ''}`.trim() : (usuarioActivo?.correo || usuarioActivo?.email || 'Analista');

  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  const [saving, setSaving] = useState(false);
  const [sessionCategories, setSessionCategories] = useState([]);
  const [nuevaCategoriaText, setNuevaCategoriaText] = useState('');
  const [ciudadesList, setCiudadesList] = useState(getStoredCiudades);
  const [creandoNuevaCiudad, setCreandoNuevaCiudad] = useState(false);
  const [nuevaCiudadText, setNuevaCiudadText] = useState('');
  const [filtroTipoPreferencial, setFiltroTipoPreferencial] = useState('todos'); // 'todos' | 'preferenciales' | 'regulares'
  const [filtroIntegridad, setFiltroIntegridad] = useState('todos'); // 'todos' | 'incompletos' | 'completos' | 'sin_rif' | 'sin_telefono' | 'sin_contacto' | 'sin_direccion' | 'sin_correo' | 'sin_bancos'
  const [mostrarPanelAuditoria, setMostrarPanelAuditoria] = useState(false);
  const [tabActiva, setTabActiva] = useState('directorio');
  const [loadingReportes, setLoadingReportes] = useState(false);
  const [todasLasCompras, setTodasLasCompras] = useState([]);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [fechaDesdeReporte, setFechaDesdeReporte] = useState('');
  const [fechaHastaReporte, setFechaHastaReporte] = useState('');
  const [fechaDesdeHistorial, setFechaDesdeHistorial] = useState('');
  const [fechaHastaHistorial, setFechaHastaHistorial] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'totalGastado', direction: 'descending' });

  const rolLimpio = String(usuarioActivo?.rol || usuarioActivo?.cargo || '').toLowerCase().trim();
  const correoLimpio = String(usuarioActivo?.correo || usuarioActivo?.email || '').toLowerCase().trim();
  const nombreLimpio = String(usuarioActivo?.nombre || '').toLowerCase().trim();

  const esSuperAdmin = Boolean(
    usuarioActivo?.esSuperAdmin ||
    usuarioActivo?.esAdminReal ||
    usuarioActivo?.es_super_admin ||
    usuarioActivo?.isSuperAdmin ||
    rolLimpio.includes('super') ||
    rolLimpio.includes('master') ||
    rolLimpio.includes('root') ||
    rolLimpio.includes('dev') ||
    correoLimpio === 'jcontreras.totalclean@gmail.com' ||
    correoLimpio.includes('admin') ||
    correoLimpio.includes('jose') ||
    nombreLimpio.includes('jose')
  );

  const puedeGestionarPreferenciales = Boolean(
    esSuperAdmin ||
    usuarioActivo?.es_admin ||
    usuarioActivo?.isAdmin ||
    rolLimpio.includes('admin') ||
    rolLimpio.includes('gerent') ||
    rolLimpio.includes('direct') ||
    rolLimpio.includes('coord') ||
    ['admin', 'administrador', 'superadmin', 'super_admin', 'gerente_compras', 'gerencia_compras', 'gerente_general', 'direccion', 'director', 'coordinador_compras'].includes(rolLimpio) ||
    correoLimpio.includes('ricardo') ||
    correoLimpio.includes('carlos') ||
    nombreLimpio.includes('ricardo') ||
    nombreLimpio.includes('carlos')
  );

  const normalizarNombreEmpresa = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[.,\-_/\\()&]/g, ' ')
      .replace(/\b(C\s*A|S\s*A|S\s*R\s*L|C\s*P\s*A|E\s*I\s*R\s*L|LLC|INC|GMBH|COMPANIA ANONIMA|SOCIEDAD ANONIMA|C\s*POR\s*A)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const sonProveedoresCoincidentes = (provObjOrNameA, provObjOrNameB) => {
    if (!provObjOrNameA || !provObjOrNameB) return false;

    const idA = typeof provObjOrNameA === 'object' ? provObjOrNameA?.id : null;
    const idB = typeof provObjOrNameB === 'object' ? provObjOrNameB?.id : null;
    if (idA && idB && String(idA) === String(idB)) return true;

    const rifA = typeof provObjOrNameA === 'object' ? (provObjOrNameA?.rif || '').replace(/[^0-9A-Z]/gi, '') : '';
    const rifB = typeof provObjOrNameB === 'object' ? (provObjOrNameB?.rif || '').replace(/[^0-9A-Z]/gi, '') : '';
    if (rifA && rifB && rifA.length >= 6 && rifA === rifB) return true;

    const nameA = typeof provObjOrNameA === 'object' ? (provObjOrNameA?.razon_social || provObjOrNameA?.nombre || '') : String(provObjOrNameA);
    const nameB = typeof provObjOrNameB === 'object' ? (provObjOrNameB?.razon_social || provObjOrNameB?.nombre || '') : String(provObjOrNameB);

    const cleanA = normalizarNombreEmpresa(nameA);
    const cleanB = normalizarNombreEmpresa(nameB);

    if (!cleanA || !cleanB) return false;
    if (cleanA === cleanB) return true;

    if (cleanA.length >= 5 && cleanB.length >= 5) {
      if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) {
        const minLen = Math.min(cleanA.length, cleanB.length);
        const maxLen = Math.max(cleanA.length, cleanB.length);
        if (minLen / maxLen >= 0.65) return true;
      }
    }

    return false;
  };

  const parseCuentasBancarias = (ctas) => {
    if (!ctas) return [];
    if (Array.isArray(ctas)) return ctas;
    if (typeof ctas === 'string') {
      try {
        const parsed = JSON.parse(ctas);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const ejecutarOperacionSegura = async (esEdicion, idProveedor, payloadInicial) => {
    let currentPayload = { ...payloadInicial };
    let iteraciones = 0;
    const maxIteraciones = 12;

    while (iteraciones < maxIteraciones) {
      iteraciones++;
      let res;
      if (esEdicion) {
        res = await supabase.from('proveedores').update(currentPayload).eq('id', idProveedor);
      } else {
        res = await supabase.from('proveedores').insert([currentPayload]);
      }

      if (!res.error) return true;

      const err = res.error;
      console.warn(`Intento ${iteraciones} de guardar proveedor falló:`, err.message);

      if (err.code === '23505' || err.message?.includes('proveedores_rif_key') || err.message?.includes('duplicate key')) {
        throw err;
      }

      let colEliminada = false;
      const matchCache = err.message.match(/Could not find the ['"](.*?)['"] column/i);
      const matchRelation = err.message.match(/column ["'](.*?)["']/i);
      const matchGeneric = err.message.match(/['"](.*?)['"] column/i);

      let colProblema = null;
      if (matchCache) colProblema = matchCache[1];
      else if (matchRelation) colProblema = matchRelation[1];
      else if (matchGeneric) colProblema = matchGeneric[1];

      if (colProblema && Object.prototype.hasOwnProperty.call(currentPayload, colProblema)) {
        delete currentPayload[colProblema];
        colEliminada = true;
      } else {
        if (currentPayload.contacto_nombre && currentPayload.persona_contacto) {
          delete currentPayload.contacto_nombre;
          colEliminada = true;
        } else if (currentPayload.localizacion && currentPayload.ciudad) {
          delete currentPayload.localizacion;
          colEliminada = true;
        } else if (currentPayload.limite_credito && currentPayload.monto_limite_credito) {
          delete currentPayload.limite_credito;
          colEliminada = true;
        } else if (currentPayload.dias_credito_habituales && currentPayload.dias_credito) {
          delete currentPayload.dias_credito_habituales;
          colEliminada = true;
        }
      }

      if (!colEliminada) {
        throw err;
      }
    }
  };

  const [formData, setFormData] = useState({
    id: null,
    rif: '',
    razon_social: '',
    persona_contacto: '',
    contacto_administrativo: '',
    ciudad: 'Maracaibo',
    correo: '',
    telefono: '',
    direccion: '',
    localizacion: 'Maracaibo',
    categoria: [], // Cambiado a array
    monto_limite_credito: 0,
    dias_credito: 0,
    condicion_pago_defecto: 'CONTADO',
    dias_credito_habituales: 0,
    calificacion_precio: 5,
    calificacion_cumplimiento: 5,
    observaciones_negociacion: '',
    es_preferencial: false,
    proveedor_preferencial: false,
    nivel_preferencial: 'Regular',
    descuento_pactado_porcentaje: 0,
    dias_credito_pactados: 0,
    tiempo_entrega_acordado_dias: '',
    vigencia_acuerdo_desde: '',
    vigencia_acuerdo_hasta: '',
    condiciones_acuerdo_nota: '',
    status: true,
    cuentas_bancarias: []
  });

  const [bancosList, setBancosList] = useState([]);
  const [nuevaCuentaForm, setNuevaCuentaForm] = useState({
    banco: '',
    moneda: 'USD',
    nro_cuenta: '',
    titular: '',
    rif: ''
  });

  const [creandoNuevoBanco, setCreandoNuevoBanco] = useState(false);
  const [nuevoBancoNombre, setNuevoBancoNombre] = useState('');

  const [historialCompras, setHistorialCompras] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [provSeleccionado, setProvSeleccionado] = useState(null);
  const [mostrarParametrosSrm, setMostrarParametrosSrm] = useState(true);
  const [subTabFicha, setSubTabFicha] = useState('credito'); // 'credito' | 'historial' | 'evaluacion'
  const [guardandoSrmProv, setGuardandoSrmProv] = useState(false);

  const getStoredSrm = (provId, provRif) => {
    try {
      const key = `prov_srm_${provId || provRif}`;
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch {
      return null;
    }
    return null;
  };

  const saveStoredSrm = (provId, provRif, data) => {
    try {
      const key = `prov_srm_${provId || provRif}`;
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      // ignore
    }
  };

  const normalizarProveedor = (p) => {
    if (!p) return null;
    const localSrm = getStoredSrm(p.id, p.rif) || {};
    const ctas = parseCuentasBancarias(p.cuentas_bancarias || localSrm.cuentas_bancarias);
    const limite = Number(p.monto_limite_credito || p.limite_credito || localSrm.monto_limite_credito || 0);
    const dias = Number(p.dias_credito || p.dias_credito_habituales || localSrm.dias_credito || 0);
    const contacto = p.persona_contacto || p.contacto_nombre || localSrm.persona_contacto || '';
    const contactoAdmin = p.contacto_administrativo || p.persona_contacto_admin || localSrm.contacto_administrativo || '';
    const ciudad = p.ciudad || p.localizacion || localSrm.ciudad || 'Maracaibo';
    const direccion = p.direccion || localSrm.direccion || '';
    const telefono = p.telefono || localSrm.telefono || '';
    const correo = p.correo || localSrm.correo || '';
    const observaciones = p.observaciones_negociacion || localSrm.observaciones_negociacion || '';
    const califPrecio = p.calificacion_precio ?? localSrm.calificacion_precio ?? 5;
    const califCumplimiento = p.calificacion_cumplimiento ?? localSrm.calificacion_cumplimiento ?? 5;
    const esPref = Boolean(p.es_preferencial ?? p.proveedor_preferencial ?? localSrm.es_preferencial ?? localSrm.proveedor_preferencial ?? false);
    const nivelPref = p.nivel_preferencial || localSrm.nivel_preferencial || (esPref ? 'Tier 1 / Oro' : 'Regular');
    const descPactado = Number(p.descuento_pactado_porcentaje ?? localSrm.descuento_pactado_porcentaje ?? 0);
    const diasCredPactados = Number(p.dias_credito_pactados ?? localSrm.dias_credito_pactados ?? dias ?? 0);
    const tiempoEntrega = p.tiempo_entrega_acordado_dias ?? localSrm.tiempo_entrega_acordado_dias ?? null;
    const vigenciaDesde = p.vigencia_acuerdo_desde || localSrm.vigencia_acuerdo_desde || '';
    const vigenciaHasta = p.vigencia_acuerdo_hasta || localSrm.vigencia_acuerdo_hasta || '';
    const condicionesNota = p.condiciones_acuerdo_nota || localSrm.condiciones_acuerdo_nota || '';
    const creadoPor = p.creado_por || localSrm.creado_por || '';
    const creadoPorNombre = p.creado_por_nombre || localSrm.creado_por_nombre || '';
    const actualizadoPor = p.actualizado_por || localSrm.actualizado_por || '';
    const actualizadoPorNombre = p.actualizado_por_nombre || localSrm.actualizado_por_nombre || '';

    return {
      ...p,
      monto_limite_credito: limite,
      limite_credito: limite,
      dias_credito: dias,
      dias_credito_habituales: dias,
      persona_contacto: contacto,
      contacto_nombre: contacto,
      contacto_administrativo: contactoAdmin,
      ciudad: ciudad,
      localizacion: ciudad,
      direccion: direccion,
      telefono: telefono,
      correo: correo,
      cuentas_bancarias: ctas,
      observaciones_negociacion: observaciones,
      calificacion_precio: califPrecio,
      calificacion_cumplimiento: califCumplimiento,
      es_preferencial: esPref,
      proveedor_preferencial: esPref,
      nivel_preferencial: nivelPref,
      descuento_pactado_porcentaje: descPactado,
      dias_credito_pactados: diasCredPactados,
      tiempo_entrega_acordado_dias: tiempoEntrega,
      vigencia_acuerdo_desde: vigenciaDesde,
      vigencia_acuerdo_hasta: vigenciaHasta,
      condiciones_acuerdo_nota: condicionesNota,
      creado_por: creadoPor,
      creado_por_nombre: creadoPorNombre,
      actualizado_por: actualizadoPor,
      actualizado_por_nombre: actualizadoPorNombre
    };
  };

  const obtenerProveedores = async () => {
    setLoading(true);
    try {
      // 1. Cargar proveedores registrados en Supabase
      let supabaseProvs = [];
      try {
        const { data, error } = await supabase
          .from('proveedores')
          .select('*')
          .order('razon_social', { ascending: true });
        if (!error && Array.isArray(data)) {
          supabaseProvs = data;
        }
      } catch (err) {
        console.warn('Error al consultar tabla proveedores de Supabase:', err);
      }

      // 2. Cargar proveedores guardados localmente
      let localProvs = [];
      try {
        const stored = localStorage.getItem('local_proveedores_registrados');
        if (stored) {
          localProvs = JSON.parse(stored);
        }
      } catch (err) {
        console.warn('Error leyendo local_proveedores_registrados:', err);
      }

      // 3. Cargar proveedores históricos de requisiciones
      let historicosReqs = [];
      try {
        const { data: reqs, error: reqsError } = await supabase
          .from('requisiciones')
          .select('items, correlativo_req, fecha_emision');
        
        if (!reqsError && reqs) {
          const mapaHist = new Map();
          reqs.forEach(r => {
            const items = Array.isArray(r.items) ? r.items : [];
            items.forEach(it => {
              const hist = Array.isArray(it.historial_compras) ? it.historial_compras : [];
              hist.forEach(h => {
                if (h.tipo === 'JUSTIFICACION' || h.tipo === 'ANULACION') return;
                const nombreLimpio = (h.proveedor_nombre || '').trim();
                if (nombreLimpio) {
                  const key = normalizarNombreEmpresa(nombreLimpio);
                  if (key && !mapaHist.has(key)) {
                    mapaHist.set(key, {
                      id: h.proveedor_id || `HIST-${key.substring(0, 15)}`,
                      razon_social: nombreLimpio,
                      rif: h.proveedor_rif || '',
                      persona_contacto: h.contacto || '',
                      contacto_nombre: h.contacto || '',
                      telefono: h.telefono || '',
                      correo: h.correo || '',
                      localizacion: h.ciudad || 'Maracaibo',
                      ciudad: h.ciudad || 'Maracaibo',
                      direccion: h.direccion || '',
                      categoria: h.categoria || 'OTROS',
                      status: true,
                      es_historico: true
                    });
                  }
                }
              });
            });
          });
          historicosReqs = Array.from(mapaHist.values());
        }
      } catch (err) {
        console.warn('Error extrayendo proveedores históricos:', err);
      }

      // 4. Fusionar todo con precedencia: Históricos < Supabase < Locales
      const mapaFinal = new Map();

      historicosReqs.forEach(p => {
        const key = normalizarNombreEmpresa(p.razon_social) || (p.rif ? p.rif.replace(/[^0-9A-Z]/gi, '') : p.id);
        mapaFinal.set(key, p);
      });

      supabaseProvs.forEach(p => {
        const key = normalizarNombreEmpresa(p.razon_social) || (p.rif ? p.rif.replace(/[^0-9A-Z]/gi, '') : p.id);
        mapaFinal.set(key, { ...(mapaFinal.get(key) || {}), ...p });
      });

      localProvs.forEach(p => {
        const key = normalizarNombreEmpresa(p.razon_social) || (p.rif ? p.rif.replace(/[^0-9A-Z]/gi, '') : p.id);
        mapaFinal.set(key, { ...(mapaFinal.get(key) || {}), ...p });
      });

      const todos = Array.from(mapaFinal.values()).map(p => normalizarProveedor(p));

      // Ordenar alfabéticamente por razón social
      todos.sort((a, b) => (a.razon_social || '').localeCompare(b.razon_social || '', 'es'));

      setProveedores(todos);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast.error('Error al cargar proveedores.');
    } finally {
      setLoading(false);
    }
  };
  const obtenerBancos = async () => {
    try {
      const { data, error } = await supabase
        .from('bancos')
        .select('nombre')
        .eq('activo', true);

      if (!error && data && data.length > 0) {
        setBancosList(data.map(b => b.nombre).sort());
      } else {
        setBancosList([
          "BANAMIGA", "BANCO DE VENEZUELA", "BANCO MERCANTIL", 
          "BANCO PROVINCIAL (BBVA)", "BANCO PLAZA", "BANCO EXTERIOR",
          "BANESCO", "BNC (BANCO NACIONAL DE CRÉDITO)", "ZELLE", "OFAC / OTRO"
        ].sort());
      }
    } catch {
      setBancosList([
        "BANAMIGA", "BANCO DE VENEZUELA", "BANCO MERCANTIL", 
        "BANCO PROVINCIAL (BBVA)", "BANCO PLAZA", "BANCO EXTERIOR",
        "BANESCO", "BNC (BANCO NACIONAL DE CRÉDITO)", "ZELLE", "OFAC / OTRO"
      ].sort());
    }
  };

  useEffect(() => {
    obtenerProveedores();
    obtenerBancos();
  }, []);

  const handleRifChange = (e) => {
    const input = e.target.value.toUpperCase();
    const firstChar = input.length > 0 ? input[0] : '';
    
    // Solo permitir letras válidas al inicio
    let validLetter = '';
    if (['V', 'J', 'E', 'G'].includes(firstChar)) {
      validLetter = firstChar;
    } else if (input.length > 0) {
      // Si el primer carácter no es válido, ignorarlo o podrías dejarlo vacío
    }

    // Extraer solo los números después de la letra inicial
    let digits = input.substring(0, 12).replace(/[^0-9]/g, '');
    if (input.length > 0 && ['V', 'J', 'E', 'G'].includes(input[0])) {
      // Si el usuario escribió la letra y luego números
      digits = input.substring(1).replace(/[^0-9]/g, '');
    }

    let formatted = '';
    if (validLetter) {
        formatted = validLetter + '-';
        if (digits.length > 0) {
            // Cuerpo central (hasta 8 dígitos)
            formatted += digits.substring(0, 8);
            if (digits.length > 8) {
                // Dígito verificador
                formatted += '-' + digits.substring(8, 9);
            }
        }
    }
    
    setFormData({ ...formData, rif: formatted });
  };

  const guardarProveedor = async (e) => {
    e.preventDefault();
    
    // Validación de formato RIF: V/J/E/G seguido de 8 dígitos, con un noveno opcional
    // Ejemplos válidos: J-12345678-0 o V-12345678
    const rifRegex = /^[VJEG]-\d{8}(-\d)?$/;
    if (!rifRegex.test(formData.rif)) {
      return toast.error('Formatos válidos: J-12345678-0 o V-12345678 (8 dígitos mínimos)');
    }

    if (!formData.razon_social || !formData.razon_social.trim()) {
      return toast.error('La Razón Social es obligatoria.');
    }

    if (!formData.persona_contacto || !formData.persona_contacto.trim()) {
      return toast.error('La Persona de Contacto es obligatoria.');
    }

    const ciudadVal = (formData.ciudad || formData.localizacion || 'Maracaibo').trim();
    if (!ciudadVal) {
      return toast.error('La Ciudad / Localización es obligatoria.');
    }

    // Validación de correo: Opcional, pero si se coloca debe tener @ y un punto .
    const correoLimpio = (formData.correo || '').trim();
    if (correoLimpio) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(correoLimpio) || !correoLimpio.includes('.')) {
        return toast.error('El correo es opcional, pero si se coloca debe ser válido y contener un punto (ej: contacto@empresa.com)');
      }
    }

    if (!formData.telefono || !formData.telefono.trim()) {
      return toast.error('El Teléfono es obligatorio.');
    }

    if (!formData.direccion || !formData.direccion.trim()) {
      return toast.error('La Dirección es obligatoria.');
    }

    setSaving(true);
    try {
      const rifLimpio = formData.rif.trim().toUpperCase();
      const idProveedor = formData.id || `PROV-${Date.now()}`;
      const esEdicion = Boolean(formData.id);

      // Validación de duplicidad de RIF en la lista activa
      if (!esEdicion) {
        const yaExisteLocal = proveedores.find(p => p.rif && p.rif.trim().toUpperCase() === rifLimpio);
        if (yaExisteLocal) {
          setSaving(false);
          return toast.error(`⚠️ El RIF ${rifLimpio} ya está registrado para "${yaExisteLocal.razon_social}".`);
        }
      } else {
        const otroConMismoRif = proveedores.find(p => p.id !== formData.id && p.rif && p.rif.trim().toUpperCase() === rifLimpio);
        if (otroConMismoRif) {
          setSaving(false);
          return toast.error(`⚠️ El RIF ${rifLimpio} ya está registrado a otro proveedor ("${otroConMismoRif.razon_social}").`);
        }
      }

      const emailUsuario = usuarioActivo?.correo || usuarioActivo?.email || 'Analista';
      const nombreUsuario = nombreUsuarioActual || 'Analista';

      const payload = {
        id: idProveedor,
        rif: rifLimpio,
        razon_social: formData.razon_social.trim(),
        persona_contacto: formData.persona_contacto?.trim() || '',
        contacto_nombre: formData.persona_contacto?.trim() || '',
        contacto_administrativo: formData.contacto_administrativo?.trim() || '',
        ciudad: ciudadVal,
        localizacion: ciudadVal,
        correo: correoLimpio,
        telefono: (formData.telefono || '').trim(),
        direccion: (formData.direccion || '').trim(),
        categoria: Array.isArray(formData.categoria) ? formData.categoria.join(', ') : (formData.categoria || 'OTROS'),
        monto_limite_credito: Number(formData.monto_limite_credito) || 0,
        limite_credito: Number(formData.monto_limite_credito) || 0,
        dias_credito: Number(formData.dias_credito) || 0,
        dias_credito_habituales: Number(formData.dias_credito) || 0,
        condicion_pago_defecto: Number(formData.dias_credito) > 0 ? 'CREDITO' : 'CONTADO',
        calificacion_precio: Number(formData.calificacion_precio) || 5,
        calificacion_cumplimiento: Number(formData.calificacion_cumplimiento) || 5,
        observaciones_negociacion: formData.observaciones_negociacion || '',
        es_preferencial: Boolean(formData.es_preferencial || formData.proveedor_preferencial),
        proveedor_preferencial: Boolean(formData.es_preferencial || formData.proveedor_preferencial),
        nivel_preferencial: (formData.es_preferencial || formData.proveedor_preferencial) ? (formData.nivel_preferencial || 'Tier 1 / Oro') : 'Regular',
        descuento_pactado_porcentaje: Number(formData.descuento_pactado_porcentaje) || 0,
        dias_credito_pactados: Number(formData.dias_credito_pactados || formData.dias_credito) || 0,
        tiempo_entrega_acordado_dias: formData.tiempo_entrega_acordado_dias ? Number(formData.tiempo_entrega_acordado_dias) : null,
        vigencia_acuerdo_desde: formData.vigencia_acuerdo_desde || null,
        vigencia_acuerdo_hasta: formData.vigencia_acuerdo_hasta || null,
        condiciones_acuerdo_nota: formData.condiciones_acuerdo_nota || '',
        status: formData.status !== undefined ? formData.status : true,
        cuentas_bancarias: formData.cuentas_bancarias || [],
        creado_por: esEdicion ? (formData.creado_por || emailUsuario) : emailUsuario,
        creado_por_nombre: esEdicion ? (formData.creado_por_nombre || nombreUsuario) : nombreUsuario,
        actualizado_por: emailUsuario,
        actualizado_por_nombre: nombreUsuario,
        created_at: esEdicion ? (formData.created_at || new Date().toISOString()) : new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Guardar en almacenamiento local persistente
      try {
        const localList = JSON.parse(localStorage.getItem('local_proveedores_registrados') || '[]');
        let updatedList;
        if (esEdicion) {
          let replaced = false;
          updatedList = localList.map(p => {
            if (p.id === idProveedor || (p.rif && p.rif === rifLimpio)) {
              replaced = true;
              return payload;
            }
            return p;
          });
          if (!replaced) updatedList.unshift(payload);
        } else {
          const sinMismoRif = localList.filter(p => p.rif !== rifLimpio && p.id !== idProveedor);
          updatedList = [payload, ...sinMismoRif];
        }
        localStorage.setItem('local_proveedores_registrados', JSON.stringify(updatedList));
      } catch (e) {
        console.warn("Error guardando en localStorage:", e);
      }

      // Guardar SRM en almacenamiento local
      saveStoredSrm(idProveedor, rifLimpio, {
        monto_limite_credito: Number(formData.monto_limite_credito) || 0,
        limite_credito: Number(formData.monto_limite_credito) || 0,
        dias_credito: Number(formData.dias_credito) || 0,
        dias_credito_habituales: Number(formData.dias_credito) || 0,
        persona_contacto: formData.persona_contacto || '',
        contacto_administrativo: formData.contacto_administrativo || '',
        ciudad: ciudadVal,
        observaciones_negociacion: formData.observaciones_negociacion || '',
        calificacion_precio: Number(formData.calificacion_precio) || 5,
        calificacion_cumplimiento: Number(formData.calificacion_cumplimiento) || 5,
        es_preferencial: payload.es_preferencial,
        proveedor_preferencial: payload.proveedor_preferencial,
        nivel_preferencial: payload.nivel_preferencial,
        descuento_pactado_porcentaje: payload.descuento_pactado_porcentaje,
        dias_credito_pactados: payload.dias_credito_pactados,
        tiempo_entrega_acordado_dias: payload.tiempo_entrega_acordado_dias,
        vigencia_acuerdo_desde: payload.vigencia_acuerdo_desde,
        vigencia_acuerdo_hasta: payload.vigencia_acuerdo_hasta,
        condiciones_acuerdo_nota: payload.condiciones_acuerdo_nota,
        cuentas_bancarias: formData.cuentas_bancarias || [],
        creado_por: payload.creado_por,
        creado_por_nombre: payload.creado_por_nombre,
        actualizado_por: payload.actualizado_por,
        actualizado_por_nombre: payload.actualizado_por_nombre,
        updated_at: new Date().toISOString()
      });

      // Actualizar estado de React inmediatamente para visualización instantánea
      const normalizadoNuevo = normalizarProveedor(payload);
      setProveedores(prev => {
        if (esEdicion) {
          return prev.map(p => (p.id === idProveedor || (p.rif && p.rif === rifLimpio)) ? normalizadoNuevo : p);
        } else {
          const sinMismoRif = prev.filter(p => p.rif !== rifLimpio && p.id !== idProveedor);
          return [normalizadoNuevo, ...sinMismoRif];
        }
      });

      // Intentar persistir en Supabase de forma segura en segundo plano
      try {
        await ejecutarOperacionSegura(esEdicion, esEdicion ? formData.id : null, payload);
      } catch (errDb) {
        console.warn("Aviso Supabase (guardado localmente activo):", errDb?.message || errDb);
      }

      toast.success(esEdicion ? 'Proveedor actualizado con éxito' : 'Proveedor registrado con éxito');
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error("Error al guardar proveedor:", error);
      if (error.code === '23505' || error.message?.includes('proveedores_rif_key') || error.message?.includes('duplicate key')) {
        toast.error(`⚠️ El RIF "${formData.rif}" ya se encuentra registrado. Verifique la lista de proveedores.`);
      } else {
        toast.error('Error al guardar: ' + (error.message || 'Verifique la conexión con la base de datos'));
      }
    } finally {
      setSaving(false);
    }
  };

  const eliminarProveedor = async (id) => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>¿Estás seguro de eliminar este proveedor?</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button 
            onClick={() => { toast.dismiss(t.id); ejecutarEliminacion(id); }}
            style={{ padding: '4px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            ELIMINAR
          </button>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '4px 12px', background: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>CANCELAR</button>
        </div>
      </div>
    ), { duration: 5000 });
  };

  const ejecutarEliminacion = async (id) => {
    try {
      try {
        const localList = JSON.parse(localStorage.getItem('local_proveedores_registrados') || '[]');
        const updated = localList.filter(p => p.id !== id);
        localStorage.setItem('local_proveedores_registrados', JSON.stringify(updated));
      } catch (e) {
        console.warn('Error eliminando de localStorage:', e);
      }

      setProveedores(prev => prev.filter(p => p.id !== id));

      try {
        await supabase.from('proveedores').delete().eq('id', id);
      } catch (err) {
        console.warn('Aviso Supabase delete:', err);
      }

      toast.success('Proveedor eliminado');
    } catch (error) {
      toast.error('Error al eliminar: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      id: null,
      rif: '',
      razon_social: '',
      persona_contacto: '',
      contacto_administrativo: '',
      ciudad: 'Maracaibo',
      correo: '',
      telefono: '',
      direccion: '',
      localizacion: 'Maracaibo',
      categoria: [],
      monto_limite_credito: 0,
      dias_credito: 0,
      condicion_pago_defecto: 'CONTADO',
      dias_credito_habituales: 0,
      calificacion_precio: 5,
      calificacion_cumplimiento: 5,
      observaciones_negociacion: '',
      es_preferencial: false,
      proveedor_preferencial: false,
      nivel_preferencial: 'Regular',
      descuento_pactado_porcentaje: 0,
      dias_credito_pactados: 0,
      tiempo_entrega_acordado_dias: '',
      vigencia_acuerdo_desde: '',
      vigencia_acuerdo_hasta: '',
      condiciones_acuerdo_nota: '',
      status: true,
      cuentas_bancarias: []
    });
    setNuevaCategoriaText('');
    setMostrarParametrosSrm(true);
    setNuevaCuentaForm({
      banco: '',
      moneda: 'USD',
      nro_cuenta: '',
      titular: '',
      rif: ''
    });
    setCreandoNuevoBanco(false);
    setNuevoBancoNombre('');
    setCreandoNuevaCiudad(false);
    setNuevaCiudadText('');
  };

  const agregarCiudad = () => {
    const nombreLimpio = nuevaCiudadText.trim();
    if (!nombreLimpio) {
      return toast.error('El nombre de la ciudad no puede estar vacío');
    }
    const ciudadFormateada = nombreLimpio.charAt(0).toUpperCase() + nombreLimpio.slice(1);
    const yaExiste = ciudadesList.some(c => c.toUpperCase() === ciudadFormateada.toUpperCase());
    if (yaExiste) {
      toast.error(`La ciudad "${ciudadFormateada}" ya está en la lista`);
      setFormData(prev => ({ ...prev, ciudad: ciudadFormateada, localizacion: ciudadFormateada }));
      setCreandoNuevaCiudad(false);
      setNuevaCiudadText('');
      return;
    }
    const updated = [...ciudadesList, ciudadFormateada];
    setCiudadesList(updated);
    localStorage.setItem('lista_ciudades_proveedores', JSON.stringify(updated));
    setFormData(prev => ({ ...prev, ciudad: ciudadFormateada, localizacion: ciudadFormateada }));
    setCreandoNuevaCiudad(false);
    setNuevaCiudadText('');
    toast.success(`Ciudad "${ciudadFormateada}" agregada a la lista`);
  };

  const eliminarCiudad = (ciudadAEliminar) => {
    if (!ciudadAEliminar) return;
    if (ciudadesList.length <= 1) {
      return toast.error('Debe haber al menos una ciudad en la lista.');
    }
    const updated = ciudadesList.filter(c => c.toUpperCase() !== ciudadAEliminar.toUpperCase());
    setCiudadesList(updated);
    localStorage.setItem('lista_ciudades_proveedores', JSON.stringify(updated));
    
    const defaultCiudad = updated.includes('Maracaibo') ? 'Maracaibo' : (updated[0] || 'Maracaibo');
    setFormData(prev => ({ ...prev, ciudad: defaultCiudad, localizacion: defaultCiudad }));
    toast.success(`Ciudad "${ciudadAEliminar}" eliminada de la lista`);
  };

  const agregarCategoriaSession = () => {
    const trimmed = nuevaCategoriaText.trim().toUpperCase();
    if (!trimmed) {
      toast.error('La categoría no puede estar vacía');
      return;
    }
    // Verificar si ya existe
    const yaExiste = categoriasUnicas.includes(trimmed);
    if (yaExiste) {
      toast.error('La categoría ya existe');
      if (!formData.categoria.includes(trimmed)) {
        setFormData(prev => ({ ...prev, categoria: [...prev.categoria, trimmed] }));
      }
      setNuevaCategoriaText('');
      return;
    }
    setSessionCategories(prev => [...prev, trimmed]);
    setFormData(prev => ({ ...prev, categoria: [...prev.categoria, trimmed] }));
    setNuevaCategoriaText('');
    toast.success(`Categoría "${trimmed}" agregada`);
  };

  const agregarCuentaBancaria = async () => {
    let bancoSeleccionado = '';
    
    if (creandoNuevoBanco) {
      if (!nuevoBancoNombre || !nuevoBancoNombre.trim()) {
        return toast.error("Debe escribir el nombre del nuevo banco.");
      }
      const cleanName = nuevoBancoNombre.trim().toUpperCase();
      
      // Validar si ya existe en la lista de bancos
      const yaExiste = bancosList.some(b => b.toUpperCase() === cleanName);
      if (!yaExiste) {
        // Insertar en la base de datos Supabase
        try {
          const { error } = await supabase
            .from('bancos')
            .insert([{ nombre: cleanName, moneda: nuevaCuentaForm.moneda, activo: true }]);
          if (error) {
            toast.error("Error al registrar banco en DB: " + error.message);
            return;
          }
          // Añadir a la lista localmente
          setBancosList(prev => [...prev, cleanName].sort());
          toast.success(`Banco "${cleanName}" registrado con éxito.`);
        } catch (err) {
          toast.error("Error al registrar banco: " + err.message);
          return;
        }
      }
      bancoSeleccionado = cleanName;
    } else {
      if (!nuevaCuentaForm.banco) {
        return toast.error("Debe seleccionar un banco.");
      }
      bancoSeleccionado = nuevaCuentaForm.banco;
    }

    if (!nuevaCuentaForm.nro_cuenta || !nuevaCuentaForm.nro_cuenta.trim()) {
      return toast.error("Debe escribir el número de cuenta.");
    }

    const titularLimpio = nuevaCuentaForm.titular.trim() || formData.razon_social;
    const rifLimpio = (nuevaCuentaForm.rif.trim() || formData.rif).toUpperCase();

    const nueva = {
      banco: bancoSeleccionado,
      moneda: nuevaCuentaForm.moneda,
      nro_cuenta: nuevaCuentaForm.nro_cuenta.trim(),
      titular: titularLimpio,
      rif: rifLimpio
    };
    const ctas = formData.cuentas_bancarias || [];
    const duplicada = ctas.some(c => c.banco === nueva.banco && c.nro_cuenta === nueva.nro_cuenta);
    if (duplicada) {
      return toast.error("Esta cuenta ya está registrada.");
    }
    setFormData({
      ...formData,
      cuentas_bancarias: [...ctas, nueva]
    });
    setNuevaCuentaForm({
      banco: '',
      moneda: 'USD',
      nro_cuenta: '',
      titular: '',
      rif: ''
    });
    setCreandoNuevoBanco(false);
    setNuevoBancoNombre('');
    toast.success("Cuenta agregada.");
  };

  const quitarCuentaBancaria = (index) => {
    const ctas = formData.cuentas_bancarias || [];
    setFormData({
      ...formData,
      cuentas_bancarias: ctas.filter((_, idx) => idx !== index)
    });
  };

  const cargarHistorialCompras = async (p) => {
    // Buscar la ficha completa del proveedor en la lista general con coincidencia inteligente para garantizar que tenga todos los datos (teléfono, ciudad, dirección, contacto, etc.)
    const provCompleto = proveedores.find(item => sonProveedoresCoincidentes(item, p)) || p;
    const merged = { ...provCompleto, ...p };
    const pNormalizado = normalizarProveedor(merged);
    setProvSeleccionado(pNormalizado);
    setLoadingHistorial(true);
    setShowHistoryModal(true);
    try {
      const { data: reqs, error } = await supabase
        .from('requisiciones')
        .select('*')
        .eq('estado_aprobacion', 'aprobado_final');
      
      if (error) throw error;

      const comprasFiltradas = [];
      (reqs || []).forEach(r => {
        const items = Array.isArray(r.items) ? r.items : [];
        items.forEach(it => {
          const hist = Array.isArray(it.historial_compras) ? it.historial_compras : [];
          hist.forEach(h => {
            if (h.tipo === 'JUSTIFICACION' || h.tipo === 'ANULACION') return;
            
            const matches = sonProveedoresCoincidentes(p, { id: h.proveedor_id, razon_social: h.proveedor_nombre }) ||
                            sonProveedoresCoincidentes(provCompleto, { id: h.proveedor_id, razon_social: h.proveedor_nombre });
            
            if (matches) {
              comprasFiltradas.push({
                requisicion: r.correlativo_req || `REQ-${r.id}`,
                fecha: h.fecha ? h.fecha.split('T')[0] : (r.fecha_emision ? r.fecha_emision.split('T')[0] : '—'),
                descripcion: it.descripcion,
                cantidad: Number(h.cant) || 0,
                pu: Number(h.pu) || 0,
                total: (Number(h.cant) || 0) * (Number(h.pu) || 0),
                metodoPago: h.metodo_pago || '—',
                factura: h.doc_numero || '—',
                facturaUrl: h.factura_url || null,
                solicitante: r.solicitante || '—',
                gerencia: r.gerencia || '—'
              });
            }
          });
        });
      });

      comprasFiltradas.sort((a, b) => b.fecha.localeCompare(a.fecha));
      setHistorialCompras(comprasFiltradas);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar historial: " + err.message);
    } finally {
      setLoadingHistorial(false);
    }
  };

  const cargarDatosReportes = async () => {
    setLoadingReportes(true);
    try {
      const { data: reqs, error } = await supabase
        .from('requisiciones')
        .select('*')
        .eq('estado_aprobacion', 'aprobado_final');
      
      if (error) throw error;

      const comprasConsolidadas = [];
      (reqs || []).forEach(r => {
        const items = Array.isArray(r.items) ? r.items : [];
        items.forEach(it => {
          const hist = Array.isArray(it.historial_compras) ? it.historial_compras : [];
          hist.forEach(h => {
            if (h.tipo === 'JUSTIFICACION' || h.tipo === 'ANULACION') return;
            comprasConsolidadas.push({
              requisicion: r.correlativo_req || `REQ-${r.id}`,
              fecha: h.fecha ? h.fecha.split('T')[0] : (r.fecha_emision ? r.fecha_emision.split('T')[0] : '—'),
              descripcion: it.descripcion || '—',
              cantidad: Number(h.cant) || 0,
              pu: Number(h.pu) || 0,
              total: (Number(h.cant) || 0) * (Number(h.pu) || 0),
              metodoPago: h.metodo_pago || '—',
              factura: h.doc_numero || '—',
              facturaUrl: h.factura_url || null,
              solicitante: r.solicitante || '—',
              gerencia: r.gerencia || '—',
              proveedor_id: h.proveedor_id,
              proveedor_nombre: h.proveedor_nombre || 'Desconocido'
            });
          });
        });
      });

      comprasConsolidadas.sort((a, b) => b.fecha.localeCompare(a.fecha));
      setTodasLasCompras(comprasConsolidadas);
    } catch (err) {
      console.error("Error cargando reportes:", err);
      toast.error("Error al cargar reportes: " + err.message);
    } finally {
      setLoadingReportes(false);
    }
  };

  const exportarReporteDeudasExcel = async () => {
    if (proveedores.length === 0) {
      toast.error("No hay proveedores registrados.");
      return;
    }

    setLoadingReportes(true);
    try {
      // 1. Obtener Requisiciones Aprobadas
      const { data: reqs, error: reqError } = await supabase
        .from('requisiciones')
        .select('*')
        .eq('estado_aprobacion', 'aprobado_final');
      if (reqError) throw reqError;

      // 2. Obtener Tickets de Pago Pendientes
      const { data: tickets, error: ticketError } = await supabase
        .from('tickets_directos')
        .select('*');
      if (ticketError) throw ticketError;

      // Filtrar los tickets activos pendientes (no completados, rechazados ni anulados)
      const ticketsPendientes = (tickets || []).filter(t => {
        const statusUpper = (t.status || '').toUpperCase().trim();
        return statusUpper !== 'PAGADO' && statusUpper !== 'RECHAZADO' && statusUpper !== 'ANULADO' && statusUpper !== 'COMPLETADO';
      });

      // 3. Inicializar agrupación por Proveedor
      const deudasAgrupadas = {};
      proveedores.forEach(p => {
        deudasAgrupadas[p.id] = {
          rif: p.rif || 'N/A',
          razon_social: p.razon_social,
          categoria: p.categoria || 'OTROS',
          limite_credito: Number(p.monto_limite_credito) || 0,
          dias_credito: Number(p.dias_credito) || 0,
          total_compras: 0,
          total_deuda: 0,
          deudas_detalle: []
        };
      });

      // 4. Procesar Requisiciones para acumular Compras y Deudas
      (reqs || []).forEach(r => {
        const items = Array.isArray(r.items) ? r.items : [];
        items.forEach(it => {
          const hist = Array.isArray(it.historial_compras) ? it.historial_compras : [];
          hist.forEach(h => {
            if (h.tipo === 'JUSTIFICACION' || h.tipo === 'ANULACION') return;
            const provId = h.proveedor_id;
            
            // Encontrar proveedor por ID o por coincidencia inteligente de Razón Social
            let provKey = provId;
            if (!provKey && h.proveedor_nombre) {
              const matched = proveedores.find(p => sonProveedoresCoincidentes(p, { id: h.proveedor_id, razon_social: h.proveedor_nombre }));
              if (matched) provKey = matched.id;
            }

            if (provKey && deudasAgrupadas[provKey]) {
              const totalTransaccion = (Number(h.cant) || 0) * (Number(h.pu) || 0);
              deudasAgrupadas[provKey].total_compras += totalTransaccion;

              // Es una deuda de crédito pendiente?
              const esNC = h.doc_tipo === 'NC' || h.metodo_pago?.includes('CRÉDITO');
              const esLiquidado = h.metodo_pago?.includes('PAGADO');
              if (esNC && !esLiquidado) {
                const totalConIva = totalTransaccion * (r.con_iva !== false ? 1.16 : 1.00);
                deudasAgrupadas[provKey].total_deuda += totalConIva;
                
                const fechaDeuda = h.fecha ? h.fecha.split('T')[0] : (r.fecha_emision ? r.fecha_emision.split('T')[0] : r.created_at?.split('T')[0]);
                deudasAgrupadas[provKey].deudas_detalle.push({
                  fecha: fechaDeuda || new Date().toISOString().split('T')[0],
                  monto: totalConIva,
                  ref: r.correlativo_req || `REQ-${r.id}`
                });
              }
            }
          });
        });
      });

      // 5. Procesar Tickets Directos Pendientes para acumular Deuda
      ticketsPendientes.forEach(t => {
        const partidas = Array.isArray(t.partidas) ? t.partidas : [];
        partidas.forEach(r => {
          const provId = r.proveedor_seleccionado_id;
          if (provId && deudasAgrupadas[provId]) {
            const montoPartida = Number(r.total) || (Number(r.cantidad_pedida || r.cant || 1) * Number(r.pu || r.puUsd || 0));
            deudasAgrupadas[provId].total_deuda += montoPartida;

            const fechaDeuda = t.fecha_emision ? t.fecha_emision.split('T')[0] : t.created_at?.split('T')[0];
            deudasAgrupadas[provId].deudas_detalle.push({
              fecha: fechaDeuda || new Date().toISOString().split('T')[0],
              monto: montoPartida,
              ref: t.codigo_control || `TCK-${t.id}`
            });
          }
        });
      });

      // 6. Preparar datos finales calculando antigüedad y alertas
      const hoy = new Date();
      const reportRows = Object.values(deudasAgrupadas).map(data => {
        let maxAntigüedad = 0;
        let oldestFecha = '—';

        if (data.total_deuda > 0 && data.deudas_detalle.length > 0) {
          const fechasValidas = data.deudas_detalle
            .map(d => new Date(d.fecha))
            .filter(f => !isNaN(f.getTime()));
          
          if (fechasValidas.length > 0) {
            const oldestDate = new Date(Math.min(...fechasValidas));
            oldestFecha = oldestDate.toISOString().split('T')[0];
            const diffTime = hoy - oldestDate;
            maxAntigüedad = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
          }
        }

        // Determinar Estado de Alerta
        let alerta = 'AL DÍA';
        if (data.total_deuda > 0) {
          if (data.limite_credito > 0 && data.total_deuda > data.limite_credito) {
            alerta = '🚨 CRÍTICA (LÍMITE EXCEDIDO)';
          } else if (maxAntigüedad > data.dias_credito + 15) {
            alerta = '🚨 CRÍTICA (>15 DÍAS VENCIDA)';
          } else if (maxAntigüedad > data.dias_credito) {
            alerta = '⚠️ VENCIDA';
          } else {
            alerta = '🟢 DENTRO DE PLAZO';
          }
        }

        return {
          rif: data.rif,
          razon_social: data.razon_social,
          categoria: data.categoria,
          total_compras: data.total_compras,
          limite_credito: data.limite_credito,
          dias_credito: data.dias_credito,
          total_deuda: data.total_deuda,
          antiguedad_dias: maxAntigüedad,
          fecha_deuda_vieja: oldestFecha,
          alerta: alerta
        };
      });

      // 7. Construir Archivo Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Reporte Deudas');

      // Título Ejecutivo
      worksheet.mergeCells('A1:J1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'TOTAL CLEAN C.A. - REPORTE DE DEUDAS Y ANTIGÜEDAD DE PROVEEDORES';
      titleCell.font = { name: 'Arial Black', size: 12, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } }; // Ámbar/Naranja
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 42;

      // Encabezados de columnas
      const headers = [
        'RIF',
        'RAZÓN SOCIAL',
        'CATEGORÍA',
        'TOTAL COMPRAS ($)',
        'LÍMITE CRÉDITO ($)',
        'PLAZO ACORDADO (DÍAS)',
        'DEUDA PENDIENTE ($)',
        'ANTIGÜEDAD (DÍAS)',
        'FECHA DEUDA MÁS VIEJA',
        'ESTADO ALERTA'
      ];
      worksheet.addRow(headers);
      const headerRow = worksheet.getRow(2);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(2).height = 28;

      // Rellenar filas
      reportRows.forEach(r => {
        const row = worksheet.addRow([
          r.rif,
          r.razon_social,
          r.categoria,
          r.total_compras,
          r.limite_credito,
          r.dias_credito,
          r.total_deuda,
          r.total_deuda > 0 ? r.antiguedad_dias : '—',
          r.fecha_deuda_vieja,
          r.alerta
        ]);

        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(4).alignment = { horizontal: 'right' };
        row.getCell(5).alignment = { horizontal: 'right' };
        row.getCell(6).alignment = { horizontal: 'center' };
        row.getCell(7).alignment = { horizontal: 'right' };
        row.getCell(8).alignment = { horizontal: 'center' };
        row.getCell(9).alignment = { horizontal: 'center' };
        row.getCell(10).alignment = { horizontal: 'center' };

        // Formatos de número/moneda
        row.getCell(4).numFmt = '"$"#,##0.00';
        row.getCell(5).numFmt = '"$"#,##0.00';
        row.getCell(6).numFmt = '#,##0';
        row.getCell(7).numFmt = '"$"#,##0.00';

        // Colores de alerta
        const cellAlerta = row.getCell(10);
        if (r.alerta.includes('CRÍTICA')) {
          cellAlerta.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
          cellAlerta.font = { color: { argb: 'FF991B1B' }, bold: true };
        } else if (r.alerta.includes('VENCIDA')) {
          cellAlerta.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF2F8' } };
          cellAlerta.font = { color: { argb: 'FF92400E' }, bold: true };
        } else if (r.alerta.includes('DENTRO')) {
          cellAlerta.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCE7E1' } };
          cellAlerta.font = { color: { argb: 'FF15803D' }, bold: true };
        }

        row.eachCell(cell => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        });
      });

      // Anchos de columna
      worksheet.columns = [
        { width: 18 }, // RIF
        { width: 35 }, // RAZÓN SOCIAL
        { width: 22 }, // CATEGORÍA
        { width: 22 }, // TOTAL COMPRAS ($)
        { width: 22 }, // LÍMITE CRÉDITO ($)
        { width: 24 }, // PLAZO ACORDADO (DÍAS)
        { width: 24 }, // DEUDA PENDIENTE ($)
        { width: 22 }, // ANTIGÜEDAD (DÍAS)
        { width: 24 }, // FECHA DEUDA MÁS VIEJA
        { width: 32 }  // ESTADO ALERTA
      ];

      // Fila de totales globales al final
      const lastRowIdx = reportRows.length + 3;
      worksheet.mergeCells(`A${lastRowIdx}:C${lastRowIdx}`);
      const labelCell = worksheet.getCell(`A${lastRowIdx}`);
      labelCell.value = 'TOTALES GENERALES';
      labelCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
      labelCell.alignment = { horizontal: 'center', vertical: 'middle' };

      const totalComprasSum = reportRows.reduce((sum, r) => sum + r.total_compras, 0);
      const totalDeudaSum = reportRows.reduce((sum, r) => sum + r.total_deuda, 0);

      const cellTotalCompras = worksheet.getCell(`D${lastRowIdx}`);
      cellTotalCompras.value = totalComprasSum;
      cellTotalCompras.font = { bold: true };
      cellTotalCompras.numFmt = '"$"#,##0.00';

      const cellTotalDeuda = worksheet.getCell(`G${lastRowIdx}`);
      cellTotalDeuda.value = totalDeudaSum;
      cellTotalDeuda.font = { bold: true };
      cellTotalDeuda.numFmt = '"$"#,##0.00';

      const totalRow = worksheet.getRow(lastRowIdx);
      totalRow.height = 26;
      totalRow.eachCell(cell => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'double', color: { argb: 'FF94A3B8' } }
        };
      });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Reporte_Deudas_Proveedores_${hoy.toISOString().split('T')[0]}.xlsx`);
      toast.success("Reporte de deudas exportado con éxito.");
    } catch (err) {
      console.error("Error al exportar reporte de deudas:", err);
      toast.error("Error al exportar reporte de deudas: " + err.message);
    } finally {
      setLoadingReportes(false);
    }
  };

  const aplicarPresetFecha = (preset) => {
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    const hoyStr = `${yyyy}-${mm}-${dd}`;

    if (preset === 'este_mes') {
      const primerDia = `${yyyy}-${mm}-01`;
      setFechaDesdeReporte(primerDia);
      setFechaHastaReporte(hoyStr);
    } else if (preset === 'ultimos_30') {
      const hace30 = new Date();
      hace30.setDate(hace30.getDate() - 30);
      const hace30Str = hace30.toISOString().split('T')[0];
      setFechaDesdeReporte(hace30Str);
      setFechaHastaReporte(hoyStr);
    } else if (preset === 'este_ano') {
      setFechaDesdeReporte(`${yyyy}-01-01`);
      setFechaHastaReporte(hoyStr);
    } else if (preset === 'todo') {
      setFechaDesdeReporte('');
      setFechaHastaReporte('');
    }
  };

  const comprasReporteFiltradas = useMemo(() => {
    return todasLasCompras.filter(c => {
      if (fechaDesdeReporte && c.fecha !== '—' && c.fecha < fechaDesdeReporte) return false;
      if (fechaHastaReporte && c.fecha !== '—' && c.fecha > fechaHastaReporte) return false;
      if ((fechaDesdeReporte || fechaHastaReporte) && c.fecha === '—') return false;
      return true;
    });
  }, [todasLasCompras, fechaDesdeReporte, fechaHastaReporte]);

  const rankingProveedores = useMemo(() => {
    const agrupado = {};
    comprasReporteFiltradas.forEach(c => {
      // Cruzar con el directorio de proveedores usando coincidencia inteligente
      const matchedProv = proveedores.find(p => sonProveedoresCoincidentes(p, { id: c.proveedor_id, razon_social: c.proveedor_nombre }));
      
      const key = matchedProv ? `prov_${matchedProv.id}` : (c.proveedor_id ? `id_${c.proveedor_id}` : `name_${normalizarNombreEmpresa(c.proveedor_nombre) || c.proveedor_nombre.trim().toUpperCase()}`);
      if (!agrupado[key]) {
        agrupado[key] = {
          id: matchedProv ? matchedProv.id : c.proveedor_id,
          nombre: matchedProv ? matchedProv.razon_social : c.proveedor_nombre,
          provOriginal: matchedProv || null,
          comprasCount: 0,
          unidadesCompradas: 0,
          totalGastado: 0,
        };
      }
      agrupado[key].comprasCount += 1;
      agrupado[key].unidadesCompradas += c.cantidad;
      agrupado[key].totalGastado += c.total;
    });

    const rankingList = Object.values(agrupado).map(agg => {
      const provOriginal = agg.provOriginal || proveedores.find(p => sonProveedoresCoincidentes(p, { id: agg.id, razon_social: agg.nombre }));
      return {
        ...(provOriginal || {}),
        id: agg.id || (provOriginal ? provOriginal.id : null),
        rif: provOriginal ? provOriginal.rif : 'N/A',
        razon_social: provOriginal ? provOriginal.razon_social : agg.nombre,
        categoria: provOriginal ? provOriginal.categoria : 'OTROS',
        comprasCount: agg.comprasCount,
        unidadesCompradas: agg.unidadesCompradas,
        totalGastado: agg.totalGastado,
        promedioCompra: agg.comprasCount > 0 ? (agg.totalGastado / agg.comprasCount) : 0
      };
    });

    rankingList.sort((a, b) => b.totalGastado - a.totalGastado);
    return rankingList;
  }, [comprasReporteFiltradas, proveedores]);

  const historialComprasFiltrado = useMemo(() => {
    return historialCompras.filter(c => {
      if (fechaDesdeHistorial && c.fecha !== '—' && c.fecha < fechaDesdeHistorial) return false;
      if (fechaHastaHistorial && c.fecha !== '—' && c.fecha > fechaHastaHistorial) return false;
      if ((fechaDesdeHistorial || fechaHastaHistorial) && c.fecha === '—') return false;
      return true;
    });
  }, [historialCompras, fechaDesdeHistorial, fechaHastaHistorial]);

  const exportRankingToExcel = async () => {
    if (rankingProveedores.length === 0) {
      toast.error("No hay datos de ranking para exportar.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ranking Proveedores');

    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    const rangoStr = (fechaDesdeReporte || fechaHastaReporte)
      ? ` (${fechaDesdeReporte ? fechaDesdeReporte.split('-').reverse().join('/') : 'INICIO'} AL ${fechaHastaReporte ? fechaHastaReporte.split('-').reverse().join('/') : 'HOY'})`
      : '';
    titleCell.value = `TOTAL CLEAN C.A. - RANKING GENERAL DE PROVEEDORES${rangoStr}`;
    titleCell.font = { name: 'Arial Black', size: 12, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 40;

    const headers = [
      'RIF',
      'CONDICIÓN',
      'RAZÓN SOCIAL',
      'CATEGORÍA',
      'N° COMPRAS',
      'UNIDADES COMPRADAS',
      'TOTAL GASTADO ($)',
      'COMPRA PROMEDIO ($)'
    ];
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(2);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 25;

    rankingProveedores.forEach(p => {
      const esPref = Boolean(p.es_preferencial || p.proveedor_preferencial);
      const condicionText = esPref ? `★ PREFERENCIAL (${(p.nivel_preferencial && p.nivel_preferencial !== 'Regular') ? p.nivel_preferencial.toUpperCase() : 'TIER 1'})` : 'REGULAR';
      const row = worksheet.addRow([
        p.rif,
        condicionText,
        p.razon_social,
        p.categoria,
        p.comprasCount,
        p.unidadesCompradas,
        p.totalGastado,
        p.promedioCompra
      ]);

      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(5).alignment = { horizontal: 'right' };
      row.getCell(6).alignment = { horizontal: 'right' };
      row.getCell(7).alignment = { horizontal: 'right' };
      row.getCell(8).alignment = { horizontal: 'right' };

      row.getCell(7).numFmt = '"$"#,##0.00';
      row.getCell(8).numFmt = '"$"#,##0.00';

      if (esPref) {
        row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        row.getCell(2).font = { color: { argb: 'FF92400E' }, bold: true };
      }

      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    });

    worksheet.columns = [
      { width: 18 }, // RIF
      { width: 26 }, // CONDICIÓN
      { width: 35 }, // RAZÓN SOCIAL
      { width: 25 }, // CATEGORÍA
      { width: 15 }, // N° COMPRAS
      { width: 22 }, // UNIDADES COMPRADAS
      { width: 20 }, // TOTAL GASTADO ($)
      { width: 22 }  // COMPRA PROMEDIO ($)
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Ranking_Proveedores_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Ranking de proveedores exportado con éxito.");
  };

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const cambiarTab = (tab) => {
    setTabActiva(tab);
    if (tab === 'reportes') {
      cargarDatosReportes();
    }
  };

  const comprasProductoFiltradas = useMemo(() => {
    if (!busquedaProducto.trim()) return [];
    return comprasReporteFiltradas.filter(c => 
      c.descripcion.toLowerCase().includes(busquedaProducto.toLowerCase())
    );
  }, [busquedaProducto, comprasReporteFiltradas]);

  const mejorPrecioUnitario = useMemo(() => {
    if (comprasProductoFiltradas.length === 0) return null;
    const preciosValidos = comprasProductoFiltradas
      .map(c => c.pu)
      .filter(p => p > 0);
    if (preciosValidos.length === 0) return null;
    return Math.min(...preciosValidos);
  }, [comprasProductoFiltradas]);

  const rankingOrdenado = useMemo(() => {
    let sortableItems = [...rankingProveedores];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        
        if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }
        
        if (valA < valB) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (valA > valB) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [rankingProveedores, sortConfig]);

  const exportHistoryToExcel = async (p) => {
    const listadoExportar = (fechaDesdeHistorial || fechaHastaHistorial) ? historialComprasFiltrado : historialCompras;
    if (listadoExportar.length === 0) {
      toast.error("No hay compras registradas para este proveedor en ese rango.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Historial Compras');

    // Title Row
    worksheet.mergeCells('A1:J1');
    const titleCell = worksheet.getCell('A1');
    const rangoHistStr = (fechaDesdeHistorial || fechaHastaHistorial)
      ? ` (${fechaDesdeHistorial ? fechaDesdeHistorial.split('-').reverse().join('/') : 'INICIO'} AL ${fechaHastaHistorial ? fechaHastaHistorial.split('-').reverse().join('/') : 'HOY'})`
      : '';
    titleCell.value = `TOTAL CLEAN C.A. - HISTORIAL DE COMPRAS: ${p.razon_social}${rangoHistStr}`;
    titleCell.font = { name: 'Arial Black', size: 12, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0EA5E9' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 40;

    // Headers
    const headers = [
      'FECHA',
      'REQUISICIÓN',
      'DESCRIPCIÓN',
      'CANTIDAD',
      'P. UNITARIO ($)',
      'TOTAL ($)',
      'FACTURA',
      'MÉTODO PAGO',
      'SOLICITANTE',
      'GERENCIA'
    ];
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(2);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 25;

    listadoExportar.forEach(c => {
      const row = worksheet.addRow([
        c.fecha !== '—' ? new Date(c.fecha + 'T12:00:00') : '—',
        c.requisicion,
        c.descripcion,
        c.cantidad,
        c.pu,
        c.total,
        c.factura,
        c.metodoPago,
        c.solicitante,
        c.gerencia
      ]);

      if (c.fecha !== '—') {
        row.getCell(1).numFmt = 'dd/mm/yyyy';
      }
      row.getCell(2).numFmt = '@';
      row.getCell(5).numFmt = '"$"#,##0.00';
      row.getCell(6).numFmt = '"$"#,##0.00;[Red]"$"#,##0.00';
      row.getCell(7).numFmt = '@';

      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'right' };
      row.getCell(5).alignment = { horizontal: 'right' };
      row.getCell(6).alignment = { horizontal: 'right' };
      row.getCell(7).alignment = { horizontal: 'center' };
      row.getCell(8).alignment = { horizontal: 'center' };

      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    });

    worksheet.columns = [
      { width: 15 }, // FECHA
      { width: 18 }, // REQUISICIÓN
      { width: 40 }, // DESCRIPCIÓN
      { width: 12 }, // CANTIDAD
      { width: 15 }, // P. UNITARIO ($)
      { width: 15 }, // TOTAL ($)
      { width: 15 }, // FACTURA
      { width: 15 }, // MÉTODO PAGO
      { width: 25 }, // SOLICITANTE
      { width: 25 }  // GERENCIA
    ];

    const lastRowNum = listadoExportar.length + 3;
    worksheet.mergeCells(`A${lastRowNum}:E${lastRowNum}`);
    const totalLabel = worksheet.getCell(`A${lastRowNum}`);
    totalLabel.value = 'TOTAL GASTADO ($):';
    totalLabel.font = { bold: true };
    totalLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    const totalVal = worksheet.getCell(`F${lastRowNum}`);
    const totalSpent = listadoExportar.reduce((sum, c) => sum + c.total, 0);
    totalVal.value = totalSpent;
    totalVal.font = { bold: true, color: { argb: 'FF15803D' } };
    totalVal.numFmt = '"$"#,##0.00';
    totalVal.alignment = { horizontal: 'right', vertical: 'middle' };

    const totalRow = worksheet.getRow(lastRowNum);
    totalRow.height = 25;
    totalRow.eachCell(cell => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF94A3B8' } }
      };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Compras_Proveedor_${p.razon_social.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Excel de historial exportado con éxito.");
  };

  const handleEdit = (p) => {
    const pNorm = normalizarProveedor(p);
    setFormData({
      ...pNorm,
      categoria: pNorm.categoria ? (Array.isArray(pNorm.categoria) ? pNorm.categoria : pNorm.categoria.split(', ').filter(c => c)) : []
    });
    setMostrarParametrosSrm(true);
    setShowModal(true);
  };

  const obtenerOpcionesLocalizacion = useMemo(() => {
    const locs = new Set(ciudadesList);
    if (formData.ciudad && formData.ciudad.trim()) locs.add(formData.ciudad.trim());
    if (formData.localizacion && formData.localizacion.trim()) locs.add(formData.localizacion.trim());
    
    const arr = Array.from(locs).filter(Boolean);
    const hasMaracaibo = arr.some(c => c.toUpperCase() === 'MARACAIBO');
    const rest = arr.filter(c => c.toUpperCase() !== 'MARACAIBO');
    return hasMaracaibo ? ['Maracaibo', ...rest] : arr;
  }, [ciudadesList, formData.ciudad, formData.localizacion]);

  const categoriasUnicas = useMemo(() => {
    const cats = new Set();
    proveedores.forEach(p => {
      if (p.categoria) {
        const pCats = p.categoria.split(', ').filter(c => c);
        pCats.forEach(c => cats.add(c.trim().toUpperCase()));
      }
    });
    // Asegurar que las categorías de la lista y de sesión estén presentes
    LISTA_CATEGORIAS.forEach(c => cats.add(c));
    sessionCategories.forEach(c => cats.add(c));
    return Array.from(cats).sort();
  }, [proveedores, sessionCategories]);

  const obtenerDiagnosticoProveedor = (p) => {
    if (!p) return { faltantes: [], esCompleto: false, porcentaje: 0, tieneRif: false, tieneTelefono: false, tieneContacto: false, tieneDireccion: false, tieneCorreo: false, tieneBancos: false };
    const faltantes = [];

    // 1. RIF válido (no vacío, no placeholder HIST-, longitud >= 6)
    const rifLimpio = String(p.rif || '').trim().toUpperCase();
    const tieneRif = Boolean(rifLimpio && !rifLimpio.startsWith('HIST-') && rifLimpio.length >= 6);
    if (!tieneRif) faltantes.push({ key: 'rif', label: 'RIF', icon: '🆔' });

    // 2. Teléfono
    const tieneTelefono = Boolean(String(p.telefono || '').trim());
    if (!tieneTelefono) faltantes.push({ key: 'telefono', label: 'Teléfono', icon: '📞' });

    // 3. Persona de Contacto
    const tieneContacto = Boolean(String(p.persona_contacto || p.contacto_nombre || '').trim());
    if (!tieneContacto) faltantes.push({ key: 'contacto', label: 'Contacto', icon: '👤' });

    // 4. Dirección
    const tieneDireccion = Boolean(String(p.direccion || '').trim());
    if (!tieneDireccion) faltantes.push({ key: 'direccion', label: 'Dirección', icon: '📍' });

    // 5. Correo (debe tener @ y .)
    const correoStr = String(p.correo || '').trim();
    const tieneCorreo = Boolean(correoStr && correoStr.includes('@') && correoStr.includes('.'));
    if (!tieneCorreo) faltantes.push({ key: 'correo', label: 'Correo', icon: '✉️' });

    // 6. Cuentas Bancarias
    const ctas = parseCuentasBancarias(p.cuentas_bancarias);
    const tieneBancos = Boolean(ctas && ctas.length > 0);
    if (!tieneBancos) faltantes.push({ key: 'bancos', label: 'Banco', icon: '🏦' });

    const totalCampos = 6;
    const camposLlenos = totalCampos - faltantes.length;
    const porcentaje = Math.round((camposLlenos / totalCampos) * 100);

    return {
      faltantes,
      esCompleto: faltantes.length === 0,
      porcentaje,
      tieneRif,
      tieneTelefono,
      tieneContacto,
      tieneDireccion,
      tieneCorreo,
      tieneBancos
    };
  };

  const estadisticasCalidad = useMemo(() => {
    let completos = 0;
    let incompletos = 0;
    let sinRif = 0;
    let sinTelefono = 0;
    let sinContacto = 0;
    let sinDireccion = 0;
    let sinCorreo = 0;
    let sinBancos = 0;

    proveedores.forEach(p => {
      const diag = obtenerDiagnosticoProveedor(p);
      if (diag.esCompleto) completos++;
      else incompletos++;

      if (!diag.tieneRif) sinRif++;
      if (!diag.tieneTelefono) sinTelefono++;
      if (!diag.tieneContacto) sinContacto++;
      if (!diag.tieneDireccion) sinDireccion++;
      if (!diag.tieneCorreo) sinCorreo++;
      if (!diag.tieneBancos) sinBancos++;
    });

    const saludGeneral = proveedores.length > 0 ? Math.round((completos / proveedores.length) * 100) : 100;

    return {
      total: proveedores.length,
      completos,
      incompletos,
      saludGeneral,
      sinRif,
      sinTelefono,
      sinContacto,
      sinDireccion,
      sinCorreo,
      sinBancos
    };
  }, [proveedores]);

  const exportarAuditoriaFaltantesExcel = async () => {
    if (proveedores.length === 0) {
      toast.error("No hay proveedores para auditar.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Auditoría Proveedores');

    worksheet.mergeCells('A1:J1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `TOTAL CLEAN C.A. - AUDITORÍA DE CALIDAD Y FALTANTES EN PROVEEDORES`;
    titleCell.font = { name: 'Arial Black', size: 12, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 40;

    const headers = [
      'RIF',
      'RAZÓN SOCIAL',
      'ESTADO EXPEDIENTE',
      '% COMPLETITUD',
      'CAMPOS FALTANTES',
      'TELÉFONO',
      'PERSONA CONTACTO',
      'CORREO',
      'DIRECCIÓN',
      'CUENTAS BANCARIAS'
    ];
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(2);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 25;

    const ordenadosAuditoria = [...proveedores].sort((a, b) => {
      const diagA = obtenerDiagnosticoProveedor(a);
      const diagB = obtenerDiagnosticoProveedor(b);
      return diagA.porcentaje - diagB.porcentaje;
    });

    ordenadosAuditoria.forEach(p => {
      const diag = obtenerDiagnosticoProveedor(p);
      const ctas = parseCuentasBancarias(p.cuentas_bancarias);
      const ctasStr = ctas.length > 0 ? `${ctas.length} cta(s) (${ctas.map(c => c.banco).join(', ')})` : 'SIN CUENTAS';
      const faltantesStr = diag.faltantes.length > 0 ? diag.faltantes.map(f => f.label).join(', ') : 'NINGUNO (COMPLETO)';

      const row = worksheet.addRow([
        diag.tieneRif ? p.rif : 'SIN RIF',
        p.razon_social,
        diag.esCompleto ? 'COMPLETO' : 'INCOMPLETO',
        `${diag.porcentaje}%`,
        faltantesStr,
        diag.tieneTelefono ? p.telefono : 'FALTANTE',
        diag.tieneContacto ? (p.persona_contacto || p.contacto_nombre) : 'FALTANTE',
        diag.tieneCorreo ? p.correo : 'FALTANTE',
        diag.tieneDireccion ? p.direccion : 'FALTANTE',
        ctasStr
      ]);

      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'center' };

      if (diag.esCompleto) {
        row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        row.getCell(3).font = { color: { argb: 'FF15803D' }, bold: true };
      } else {
        row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } };
        row.getCell(3).font = { color: { argb: 'FFE11D48' }, bold: true };
        row.getCell(5).font = { color: { argb: 'FFE11D48' }, bold: true };
      }

      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    });

    worksheet.columns = [
      { width: 16 },
      { width: 35 },
      { width: 18 },
      { width: 15 },
      { width: 32 },
      { width: 18 },
      { width: 25 },
      { width: 28 },
      { width: 35 },
      { width: 30 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Auditoria_Faltantes_Proveedores_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Reporte de auditoría de faltantes exportado con éxito.");
  };

  const proveedoresFiltrados = proveedores.filter(p => {
    const matchTexto = p.razon_social?.toLowerCase().includes(busqueda.toLowerCase()) ||
                       p.rif?.toLowerCase().includes(busqueda.toLowerCase());
    
    const pCats = p.categoria ? (Array.isArray(p.categoria) ? p.categoria : p.categoria.split(', ').filter(c => c)) : [];
    const matchCat = filtroCategoria === 'Todos' || pCats.includes(filtroCategoria);

    const esPref = Boolean(p.es_preferencial || p.proveedor_preferencial);
    let matchTipo = true;
    if (filtroTipoPreferencial === 'preferenciales') matchTipo = esPref;
    if (filtroTipoPreferencial === 'regulares') matchTipo = !esPref;

    const diag = obtenerDiagnosticoProveedor(p);
    let matchIntegridad = true;
    if (filtroIntegridad === 'incompletos') matchIntegridad = !diag.esCompleto;
    else if (filtroIntegridad === 'completos') matchIntegridad = diag.esCompleto;
    else if (filtroIntegridad === 'sin_rif') matchIntegridad = !diag.tieneRif;
    else if (filtroIntegridad === 'sin_telefono') matchIntegridad = !diag.tieneTelefono;
    else if (filtroIntegridad === 'sin_contacto') matchIntegridad = !diag.tieneContacto;
    else if (filtroIntegridad === 'sin_direccion') matchIntegridad = !diag.tieneDireccion;
    else if (filtroIntegridad === 'sin_correo') matchIntegridad = !diag.tieneCorreo;
    else if (filtroIntegridad === 'sin_bancos') matchIntegridad = !diag.tieneBancos;
    
    return matchTexto && matchCat && matchTipo && matchIntegridad;
  });

  return (
    <div className="prov-container">
      <div className="prov-max-width">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ borderLeft: '6px solid #0ea5e9', paddingLeft: '16px' }}>
            <h1 style={{ margin: 0, color: '#0f172a', fontSize: '1.8rem', fontWeight: '900', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.5px' }}>
              Módulo de Proveedores
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem', fontWeight: '500', fontFamily: 'Inter, sans-serif' }}>
              Gestión de cartera de proveedores de la empresa
            </p>
          </div>
          {tabActiva === 'directorio' && (
            <button 
              onClick={() => { resetForm(); setShowModal(true); }}
              className="prov-btn-new"
            >
              <Plus size={20} />
              Nuevo Proveedor
            </button>
          )}
        </div>

        {/* Pestañas de Navegación */}
        <div className="prov-tabs">
          <button 
            onClick={() => cambiarTab('directorio')} 
            className={`prov-tab-btn ${tabActiva === 'directorio' ? 'active' : ''}`}
          >
            <Users size={16} />
            Directorio de Proveedores
          </button>
          <button 
            onClick={() => cambiarTab('reportes')} 
            className={`prov-tab-btn ${tabActiva === 'reportes' ? 'active' : ''}`}
          >
            <BarChart3 size={16} />
            Análisis y Reportes
          </button>
        </div>

        {tabActiva === 'directorio' ? (
          <>
            {/* Buscador & Filtros Rápidos */}
            <div className="prov-search-wrapper" style={{ flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
                <Search className="prov-search-icon" size={20} />
                <input 
                  type="text"
                  placeholder="Buscar por RIF o Razón Social..."
                  className="prov-search-input"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>

              {/* Botones de Filtro Tipo Píldora para Preferenciales e Integridad */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button 
                  type="button"
                  onClick={() => { setFiltroTipoPreferencial('todos'); setFiltroIntegridad('todos'); }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    border: (filtroTipoPreferencial === 'todos' && filtroIntegridad === 'todos') ? '1px solid #0f172a' : '1px solid #cbd5e1',
                    backgroundColor: (filtroTipoPreferencial === 'todos' && filtroIntegridad === 'todos') ? '#0f172a' : '#f8fafc',
                    color: (filtroTipoPreferencial === 'todos' && filtroIntegridad === 'todos') ? '#ffffff' : '#64748b',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Todos ({proveedores.length})
                </button>
                <button 
                  type="button"
                  onClick={() => { setFiltroTipoPreferencial('preferenciales'); setFiltroIntegridad('todos'); }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    border: (filtroTipoPreferencial === 'preferenciales' && filtroIntegridad === 'todos') ? '1px solid #f59e0b' : '1px solid #fde68a',
                    backgroundColor: (filtroTipoPreferencial === 'preferenciales' && filtroIntegridad === 'todos') ? '#fef3c7' : '#fffbeb',
                    color: '#92400e',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s',
                    boxShadow: (filtroTipoPreferencial === 'preferenciales' && filtroIntegridad === 'todos') ? '0 2px 4px rgba(245, 158, 11, 0.2)' : 'none'
                  }}
                >
                  ★ Preferenciales ({proveedores.filter(p => p.es_preferencial || p.proveedor_preferencial).length})
                </button>
                <button 
                  type="button"
                  onClick={() => { setFiltroTipoPreferencial('regulares'); setFiltroIntegridad('todos'); }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    border: (filtroTipoPreferencial === 'regulares' && filtroIntegridad === 'todos') ? '1px solid #64748b' : '1px solid #cbd5e1',
                    backgroundColor: (filtroTipoPreferencial === 'regulares' && filtroIntegridad === 'todos') ? '#e2e8f0' : '#f8fafc',
                    color: (filtroTipoPreferencial === 'regulares' && filtroIntegridad === 'todos') ? '#0f172a' : '#64748b',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Regulares ({proveedores.filter(p => !p.es_preferencial && !p.proveedor_preferencial).length})
                </button>

                {/* Píldora de Faltantes / Por Completar */}
                <button 
                  type="button"
                  onClick={() => {
                    setFiltroTipoPreferencial('todos');
                    setFiltroIntegridad(filtroIntegridad === 'incompletos' ? 'todos' : 'incompletos');
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    border: (filtroIntegridad !== 'todos' && filtroIntegridad !== 'completos') ? '1px solid #e11d48' : '1px solid #fecdd3',
                    backgroundColor: (filtroIntegridad !== 'todos' && filtroIntegridad !== 'completos') ? '#ffe4e6' : '#fff1f2',
                    color: '#be123c',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.2s',
                    boxShadow: (filtroIntegridad !== 'todos' && filtroIntegridad !== 'completos') ? '0 2px 5px rgba(225, 29, 72, 0.2)' : 'none'
                  }}
                >
                  <AlertTriangle size={13} />
                  Por Completar ({estadisticasCalidad.incompletos})
                </button>

                {/* Píldora de Completos */}
                <button 
                  type="button"
                  onClick={() => {
                    setFiltroTipoPreferencial('todos');
                    setFiltroIntegridad(filtroIntegridad === 'completos' ? 'todos' : 'completos');
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    border: filtroIntegridad === 'completos' ? '1px solid #16a34a' : '1px solid #bbf7d0',
                    backgroundColor: filtroIntegridad === 'completos' ? '#dcfce7' : '#f0fdf4',
                    color: '#15803d',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.2s'
                  }}
                >
                  <CheckCircle2 size={13} />
                  100% Completos ({estadisticasCalidad.completos})
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select 
                  className="prov-cat-select"
                  style={{ 
                    padding: '8px 15px', 
                    borderRadius: '12px', 
                    border: '1px solid #e2e8f0', 
                    fontSize: '0.82rem',
                    color: '#475569',
                    fontWeight: '700',
                    outline: 'none',
                    backgroundColor: 'white'
                  }}
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                >
                  <option value="Todos">Todas las Categorías</option>
                  {categoriasUnicas.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                {/* Botón para desplegar Diagnóstico de Calidad */}
                <button
                  type="button"
                  onClick={() => setMostrarPanelAuditoria(!mostrarPanelAuditoria)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: mostrarPanelAuditoria ? '#0f172a' : 'white',
                    color: mostrarPanelAuditoria ? '#ffffff' : '#0f172a',
                    fontWeight: '800',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                  title="Ver Diagnóstico de Salud de Datos"
                >
                  <span>📊</span>
                  <span>Salud: {estadisticasCalidad.saludGeneral}%</span>
                  {mostrarPanelAuditoria ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            </div>

            {/* Sub-Barra de Filtro Específico por Campo Faltante */}
            {(filtroIntegridad !== 'todos' && filtroIntegridad !== 'completos') && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                flexWrap: 'wrap', 
                backgroundColor: '#fff1f2', 
                padding: '10px 16px', 
                borderRadius: '14px', 
                border: '1px solid #fecdd3', 
                marginTop: '10px' 
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#9f1239', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Filter size={13} /> Filtrar por dato faltante:
                </span>
                <button
                  type="button"
                  onClick={() => setFiltroIntegridad('incompletos')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.7rem',
                    fontWeight: '800',
                    border: filtroIntegridad === 'incompletos' ? '1px solid #be123c' : '1px solid #fda4af',
                    backgroundColor: filtroIntegridad === 'incompletos' ? '#be123c' : 'white',
                    color: filtroIntegridad === 'incompletos' ? 'white' : '#9f1239',
                    cursor: 'pointer'
                  }}
                >
                  Cualquier Faltante ({estadisticasCalidad.incompletos})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroIntegridad('sin_rif')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.7rem',
                    fontWeight: '800',
                    border: filtroIntegridad === 'sin_rif' ? '1px solid #be123c' : '1px solid #fda4af',
                    backgroundColor: filtroIntegridad === 'sin_rif' ? '#be123c' : 'white',
                    color: filtroIntegridad === 'sin_rif' ? 'white' : '#9f1239',
                    cursor: 'pointer'
                  }}
                >
                  🆔 Sin RIF ({estadisticasCalidad.sinRif})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroIntegridad('sin_telefono')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.7rem',
                    fontWeight: '800',
                    border: filtroIntegridad === 'sin_telefono' ? '1px solid #be123c' : '1px solid #fda4af',
                    backgroundColor: filtroIntegridad === 'sin_telefono' ? '#be123c' : 'white',
                    color: filtroIntegridad === 'sin_telefono' ? 'white' : '#9f1239',
                    cursor: 'pointer'
                  }}
                >
                  📞 Sin Teléfono ({estadisticasCalidad.sinTelefono})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroIntegridad('sin_contacto')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.7rem',
                    fontWeight: '800',
                    border: filtroIntegridad === 'sin_contacto' ? '1px solid #be123c' : '1px solid #fda4af',
                    backgroundColor: filtroIntegridad === 'sin_contacto' ? '#be123c' : 'white',
                    color: filtroIntegridad === 'sin_contacto' ? 'white' : '#9f1239',
                    cursor: 'pointer'
                  }}
                >
                  👤 Sin Contacto ({estadisticasCalidad.sinContacto})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroIntegridad('sin_direccion')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.7rem',
                    fontWeight: '800',
                    border: filtroIntegridad === 'sin_direccion' ? '1px solid #be123c' : '1px solid #fda4af',
                    backgroundColor: filtroIntegridad === 'sin_direccion' ? '#be123c' : 'white',
                    color: filtroIntegridad === 'sin_direccion' ? 'white' : '#9f1239',
                    cursor: 'pointer'
                  }}
                >
                  📍 Sin Dirección ({estadisticasCalidad.sinDireccion})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroIntegridad('sin_correo')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.7rem',
                    fontWeight: '800',
                    border: filtroIntegridad === 'sin_correo' ? '1px solid #be123c' : '1px solid #fda4af',
                    backgroundColor: filtroIntegridad === 'sin_correo' ? '#be123c' : 'white',
                    color: filtroIntegridad === 'sin_correo' ? 'white' : '#9f1239',
                    cursor: 'pointer'
                  }}
                >
                  ✉️ Sin Correo ({estadisticasCalidad.sinCorreo})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroIntegridad('sin_bancos')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.7rem',
                    fontWeight: '800',
                    border: filtroIntegridad === 'sin_bancos' ? '1px solid #be123c' : '1px solid #fda4af',
                    backgroundColor: filtroIntegridad === 'sin_bancos' ? '#be123c' : 'white',
                    color: filtroIntegridad === 'sin_bancos' ? 'white' : '#9f1239',
                    cursor: 'pointer'
                  }}
                >
                  🏦 Sin Banco ({estadisticasCalidad.sinBancos})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroIntegridad('todos')}
                  style={{
                    marginLeft: 'auto',
                    background: 'none',
                    border: 'none',
                    color: '#9f1239',
                    fontWeight: '800',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Quitar filtro
                </button>
              </div>
            )}

            {/* Panel de Diagnóstico y Salud de Datos (Colapsable) */}
            {mostrarPanelAuditoria && (
              <div style={{
                marginTop: '12px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '16px 20px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>📊</span> Diagnóstico y Auditoría de Expedientes de Proveedores
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                      Monitorea qué datos faltan en el directorio para que compras complete cada expediente
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={exportarAuditoriaFaltantesExcel}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        backgroundColor: '#0f172a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: '800',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(15, 23, 42, 0.2)'
                      }}
                    >
                      <FileSpreadsheet size={14} />
                      Exportar Auditoría a Excel
                    </button>
                  </div>
                </div>

                {/* Barra de progreso de salud */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                    <span>Salud General del Directorio: {estadisticasCalidad.completos} de {estadisticasCalidad.total} proveedores con ficha 100% completa</span>
                    <span style={{ color: estadisticasCalidad.saludGeneral >= 80 ? '#16a34a' : (estadisticasCalidad.saludGeneral >= 50 ? '#d97706' : '#e11d48') }}>
                      {estadisticasCalidad.saludGeneral}% ÓPTIMO
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '10px', backgroundColor: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${estadisticasCalidad.saludGeneral}%`,
                      height: '100%',
                      backgroundColor: estadisticasCalidad.saludGeneral >= 80 ? '#10b981' : (estadisticasCalidad.saludGeneral >= 50 ? '#f59e0b' : '#ef4444'),
                      borderRadius: '5px',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>

                {/* Grid de Métricas de Faltantes */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                  <div 
                    onClick={() => { setFiltroTipoPreferencial('todos'); setFiltroIntegridad('sin_rif'); }}
                    style={{ backgroundColor: estadisticasCalidad.sinRif > 0 ? '#fff1f2' : '#f8fafc', padding: '10px 12px', borderRadius: '12px', border: estadisticasCalidad.sinRif > 0 ? '1px solid #fecdd3' : '1px solid #e2e8f0', cursor: 'pointer', transition: 'transform 0.15s' }}
                    className="action-hover"
                  >
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700' }}>🆔 Sin RIF Válido</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '900', color: estadisticasCalidad.sinRif > 0 ? '#e11d48' : '#10b981' }}>{estadisticasCalidad.sinRif}</div>
                    <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Click para filtrar</div>
                  </div>

                  <div 
                    onClick={() => { setFiltroTipoPreferencial('todos'); setFiltroIntegridad('sin_telefono'); }}
                    style={{ backgroundColor: estadisticasCalidad.sinTelefono > 0 ? '#fff1f2' : '#f8fafc', padding: '10px 12px', borderRadius: '12px', border: estadisticasCalidad.sinTelefono > 0 ? '1px solid #fecdd3' : '1px solid #e2e8f0', cursor: 'pointer', transition: 'transform 0.15s' }}
                    className="action-hover"
                  >
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700' }}>📞 Sin Teléfono</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '900', color: estadisticasCalidad.sinTelefono > 0 ? '#e11d48' : '#10b981' }}>{estadisticasCalidad.sinTelefono}</div>
                    <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Click para filtrar</div>
                  </div>

                  <div 
                    onClick={() => { setFiltroTipoPreferencial('todos'); setFiltroIntegridad('sin_contacto'); }}
                    style={{ backgroundColor: estadisticasCalidad.sinContacto > 0 ? '#fff1f2' : '#f8fafc', padding: '10px 12px', borderRadius: '12px', border: estadisticasCalidad.sinContacto > 0 ? '1px solid #fecdd3' : '1px solid #e2e8f0', cursor: 'pointer', transition: 'transform 0.15s' }}
                    className="action-hover"
                  >
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700' }}>👤 Sin Contacto</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '900', color: estadisticasCalidad.sinContacto > 0 ? '#e11d48' : '#10b981' }}>{estadisticasCalidad.sinContacto}</div>
                    <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Click para filtrar</div>
                  </div>

                  <div 
                    onClick={() => { setFiltroTipoPreferencial('todos'); setFiltroIntegridad('sin_direccion'); }}
                    style={{ backgroundColor: estadisticasCalidad.sinDireccion > 0 ? '#fff1f2' : '#f8fafc', padding: '10px 12px', borderRadius: '12px', border: estadisticasCalidad.sinDireccion > 0 ? '1px solid #fecdd3' : '1px solid #e2e8f0', cursor: 'pointer', transition: 'transform 0.15s' }}
                    className="action-hover"
                  >
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700' }}>📍 Sin Dirección</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '900', color: estadisticasCalidad.sinDireccion > 0 ? '#e11d48' : '#10b981' }}>{estadisticasCalidad.sinDireccion}</div>
                    <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Click para filtrar</div>
                  </div>

                  <div 
                    onClick={() => { setFiltroTipoPreferencial('todos'); setFiltroIntegridad('sin_correo'); }}
                    style={{ backgroundColor: estadisticasCalidad.sinCorreo > 0 ? '#fff7ed' : '#f8fafc', padding: '10px 12px', borderRadius: '12px', border: estadisticasCalidad.sinCorreo > 0 ? '1px solid #fed7aa' : '1px solid #e2e8f0', cursor: 'pointer', transition: 'transform 0.15s' }}
                    className="action-hover"
                  >
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700' }}>✉️ Sin Correo</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '900', color: estadisticasCalidad.sinCorreo > 0 ? '#ea580c' : '#10b981' }}>{estadisticasCalidad.sinCorreo}</div>
                    <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Click para filtrar</div>
                  </div>

                  <div 
                    onClick={() => { setFiltroTipoPreferencial('todos'); setFiltroIntegridad('sin_bancos'); }}
                    style={{ backgroundColor: estadisticasCalidad.sinBancos > 0 ? '#fff1f2' : '#f8fafc', padding: '10px 12px', borderRadius: '12px', border: estadisticasCalidad.sinBancos > 0 ? '1px solid #fecdd3' : '1px solid #e2e8f0', cursor: 'pointer', transition: 'transform 0.15s' }}
                    className="action-hover"
                  >
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700' }}>🏦 Sin Banco</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '900', color: estadisticasCalidad.sinBancos > 0 ? '#e11d48' : '#10b981' }}>{estadisticasCalidad.sinBancos}</div>
                    <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Click para filtrar</div>
                  </div>
                </div>
              </div>
            )}

        {loading ? (
          <div className="prov-loading">
            <div className="spinner"></div>
            <p style={{ color: '#64748b', fontWeight: '800', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Cargando proveedores...</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="prov-table">
              <thead>
                <tr>
                  <th style={{ width: '140px' }}>RIF</th>
                  <th>RAZÓN SOCIAL</th>
                  <th>CATEGORÍA</th>
                  <th>LOCALIZACIÓN</th>
                  <th>CONTACTO</th>
                  <th>DIRECCIÓN</th>
                  <th style={{ textAlign: 'center', width: '100px' }}>ESTADO</th>
                  <th style={{ textAlign: 'center', width: '100px' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {proveedoresFiltrados.map((p) => {
                  const esPref = Boolean(p.es_preferencial || p.proveedor_preferencial);
                  const diag = obtenerDiagnosticoProveedor(p);
                  const ctas = parseCuentasBancarias(p.cuentas_bancarias);

                  return (
                    <tr key={p.id || p.rif || p.razon_social}>
                      <td className="rif-cell">
                        {diag.tieneRif ? (
                          <span>{p.rif}</span>
                        ) : (
                          <span style={{
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: '800',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            border: '1px solid #fca5a5'
                          }}>
                            ⚠️ Sin RIF
                          </span>
                        )}
                      </td>
                      <td className="name-cell">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.85rem' }}>{p.razon_social}</span>
                          {esPref && (
                            <span style={{
                              backgroundColor: '#FEF3C7',
                              color: '#92400E',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.68rem',
                              fontWeight: '900',
                              border: '1px solid #FDE68A',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              letterSpacing: '0.02em',
                              boxShadow: '0 1px 2px rgba(245, 158, 11, 0.15)'
                            }}>
                              ★ {p.nivel_preferencial && p.nivel_preferencial !== 'Regular' ? p.nivel_preferencial.toUpperCase() : 'PREFERENCIAL'}
                            </span>
                          )}

                          {/* Badge de completitud del expediente */}
                          {diag.esCompleto ? (
                            <span style={{
                              backgroundColor: '#dcfce7',
                              color: '#15803d',
                              padding: '2px 7px',
                              borderRadius: '6px',
                              fontSize: '0.62rem',
                              fontWeight: '900',
                              border: '1px solid #bbf7d0',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}>
                              ✓ 100% Completo
                            </span>
                          ) : (
                            <span style={{
                              backgroundColor: '#ffe4e6',
                              color: '#be123c',
                              padding: '2px 7px',
                              borderRadius: '6px',
                              fontSize: '0.62rem',
                              fontWeight: '800',
                              border: '1px solid #fecdd3',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                            title={`Faltan: ${diag.faltantes.map(f => f.label).join(', ')}`}
                            >
                              ⚠️ Falta ({diag.faltantes.length}): {diag.faltantes.map(f => f.label).join(', ')}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                          <span style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0', fontWeight: '600' }}>
                            👤 {p.creado_por_nombre || p.creado_por || 'Analista Compras'}
                          </span>
                          {(p.actualizado_por_nombre || p.actualizado_por) && (
                            <span style={{ backgroundColor: '#f8fafc', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0', color: '#334155', fontWeight: '600' }}>
                              ✏️ {p.actualizado_por_nombre || p.actualizado_por}
                            </span>
                          )}
                          {esPref && Number(p.descuento_pactado_porcentaje) > 0 && (
                            <span style={{ backgroundColor: '#dcfce7', padding: '2px 6px', borderRadius: '4px', border: '1px solid #bbf7d0', color: '#15803d', fontWeight: '800' }}>
                              🏷️ Dcto: {p.descuento_pactado_porcentaje}%
                            </span>
                          )}
                          {esPref && Number(p.dias_credito_pactados) > 0 && (
                            <span style={{ backgroundColor: '#eff6ff', padding: '2px 6px', borderRadius: '4px', border: '1px solid #bfdbfe', color: '#1d4ed8', fontWeight: '800' }}>
                              ⏱️ Crédito: {p.dias_credito_pactados}d
                            </span>
                          )}
                        </div>
                      </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {p.categoria ? (Array.isArray(p.categoria) ? p.categoria : p.categoria.split(', ')).map((cat, i) => (
                          <span key={i} style={{ backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '6px', fontSize: '0.6rem', fontWeight: '800', color: '#475569', border: '1px solid #e2e8f0' }}>
                            {cat}
                          </span>
                        )) : <span style={{ color: '#cbd5e1' }}>-</span>}
                      </div>
                    </td>
                    <td>
                      {p.localizacion ? (
                        <span style={{ 
                          backgroundColor: '#e0f2fe', 
                          color: '#0369a1',
                          padding: '4px 8px', 
                          borderRadius: '6px', 
                          fontSize: '0.75rem', 
                          fontWeight: '700',
                          border: '1px solid #bae6fd',
                          display: 'inline-block'
                        }}>
                          📍 {p.localizacion}
                        </span>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontStyle: 'italic', fontSize: '0.75rem' }}>No especificada</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {/* Persona Contacto */}
                        {diag.tieneContacto ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#0f172a', fontWeight: '700' }}>
                            <Users size={12} style={{ color: '#0284c7' }} /> {p.persona_contacto || p.contacto_nombre}
                          </div>
                        ) : (
                          <span style={{ color: '#ea580c', fontSize: '0.68rem', fontWeight: '700', backgroundColor: '#fff7ed', padding: '1px 6px', borderRadius: '4px', border: '1px solid #ffedd5', width: 'fit-content' }}>
                            ⚠️ Sin contacto
                          </span>
                        )}

                        {/* Teléfono */}
                        {diag.tieneTelefono ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.73rem', color: '#475569', fontWeight: '500' }}>
                            <Phone size={12} style={{ color: '#f97316' }} /> {p.telefono}
                          </div>
                        ) : (
                          <span style={{ color: '#ea580c', fontSize: '0.68rem', fontWeight: '700', backgroundColor: '#fff7ed', padding: '1px 6px', borderRadius: '4px', border: '1px solid #ffedd5', width: 'fit-content' }}>
                            ⚠️ Sin teléfono
                          </span>
                        )}

                        {/* Correo */}
                        {diag.tieneCorreo ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.73rem', color: '#475569', fontWeight: '500' }}>
                            <Mail size={12} style={{ color: '#3b82f6' }} /> {p.correo}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.68rem' }}>
                            ✉️ Sin correo
                          </span>
                        )}

                        {/* Cuenta Bancaria */}
                        {diag.tieneBancos ? (
                          <span style={{ backgroundColor: '#f0fdf4', color: '#166534', padding: '1px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '700', border: '1px solid #dcfce7', width: 'fit-content', marginTop: '1px' }}>
                            🏦 {ctas.length} Cta(s) de banco
                          </span>
                        ) : (
                          <span style={{ backgroundColor: '#fff1f2', color: '#be123c', padding: '1px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '700', border: '1px solid #fecdd3', width: 'fit-content', marginTop: '1px' }}>
                            ⚠️ Sin banco
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ maxWidth: '250px' }}>
                      {diag.tieneDireccion ? (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>
                          <MapPin size={12} style={{ color: '#94a3b8', marginTop: '2px', flexShrink: 0 }} /> 
                          <span>{p.direccion}</span>
                        </div>
                      ) : (
                        <span style={{ fontStyle: 'italic', color: '#b45309', fontSize: '0.72rem', backgroundColor: '#fffbeb', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fef3c7' }}>
                          ⚠️ Sin dirección registrada
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`status-badge ${p.status ? 'active' : 'inactive'}`}>
                        {p.status ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                        <button onClick={() => cargarHistorialCompras(p)} style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer', padding: '5px', transition: 'transform 0.2s' }} title="Ver Historial de Compras" className="action-hover">
                          <ShoppingBag size={16} />
                        </button>
                        <button onClick={() => handleEdit(p)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '5px', transition: 'transform 0.2s' }} title={diag.esCompleto ? "Editar Proveedor" : "Completar Datos Faltantes"} className="action-hover">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => eliminarProveedor(p.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '5px', transition: 'transform 0.2s' }} title="Eliminar" className="action-hover">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
            {proveedoresFiltrados.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8', background: 'white' }}>
                <Search size={32} style={{ marginBottom: '15px', opacity: 0.2 }} />
                <p style={{ margin: 0, fontWeight: '600', fontSize: '0.9rem' }}>
                  {filtroIntegridad !== 'todos' ? '¡Excelente! No hay proveedores pendientes con este criterio de datos faltantes.' : 'No se encontraron proveedores activos con ese criterio.'}
                </p>
              </div>
            )}
          </div>
        )}
      </>
    ) : (
      <div className="prov-reports-view">
        {loadingReportes ? (
          <div className="prov-loading">
            <Loader2 className="animate-spin" size={40} style={{ color: '#0ea5e9' }} />
            <p style={{ color: '#64748b', fontWeight: '800', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Consolidando transacciones...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="animate-fade">
            
            {/* BARRA DE FILTROS POR FECHA */}
            <div className="prov-filter-date-card">
              <div className="prov-filter-date-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar className="prov-filter-icon" size={18} />
                  <span style={{ fontWeight: '900', fontSize: '0.85rem', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Filtrar Compras por Rango de Fechas
                  </span>
                </div>
                {(fechaDesdeReporte || fechaHastaReporte) ? (
                  <span className="prov-filter-badge active">
                    🗓️ Filtrando: {fechaDesdeReporte ? fechaDesdeReporte.split('-').reverse().join('/') : 'Inicio'} al {fechaHastaReporte ? fechaHastaReporte.split('-').reverse().join('/') : 'Hoy'} ({comprasReporteFiltradas.length} compras)
                  </span>
                ) : (
                  <span className="prov-filter-badge">
                    🌐 Mostrando Todo el Histórico ({todasLasCompras.length} compras)
                  </span>
                )}
              </div>

              <div className="prov-filter-date-controls">
                <div className="prov-date-input-group">
                  <label>Desde</label>
                  <input
                    type="date"
                    value={fechaDesdeReporte}
                    onChange={(e) => setFechaDesdeReporte(e.target.value)}
                    className="prov-date-input"
                  />
                </div>

                <div className="prov-date-input-group">
                  <label>Hasta</label>
                  <input
                    type="date"
                    value={fechaHastaReporte}
                    onChange={(e) => setFechaHastaReporte(e.target.value)}
                    className="prov-date-input"
                  />
                </div>

                <div className="prov-date-presets">
                  <button
                    type="button"
                    className="prov-preset-btn"
                    onClick={() => aplicarPresetFecha('este_mes')}
                  >
                    Este Mes
                  </button>
                  <button
                    type="button"
                    className="prov-preset-btn"
                    onClick={() => aplicarPresetFecha('ultimos_30')}
                  >
                    Últimos 30 Días
                  </button>
                  <button
                    type="button"
                    className="prov-preset-btn"
                    onClick={() => aplicarPresetFecha('este_ano')}
                  >
                    Este Año
                  </button>
                  {(fechaDesdeReporte || fechaHastaReporte) && (
                    <button
                      type="button"
                      className="prov-preset-btn clear"
                      onClick={() => aplicarPresetFecha('todo')}
                      title="Limpiar filtro de fechas"
                    >
                      <RotateCcw size={13} />
                      Limpiar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* KPI Cards (5 Tarjetas con Tasa Preferencial) */}
            {(() => {
              const totalGastoGlobal = comprasReporteFiltradas.reduce((sum, c) => sum + c.total, 0);
              const gastoPreferencial = comprasReporteFiltradas
                .filter(c => {
                  const pMatched = proveedores.find(p => sonProveedoresCoincidentes(p, { id: c.proveedor_id, razon_social: c.proveedor_nombre }));
                  return Boolean(pMatched && (pMatched.es_preferencial || pMatched.proveedor_preferencial));
                })
                .reduce((sum, c) => sum + c.total, 0);
              const tasaPreferencialPct = totalGastoGlobal > 0 ? (gastoPreferencial / totalGastoGlobal) * 100 : 0;

              return (
                <div className="prov-analytics-grid">
                  <div className="prov-analytic-card" style={{ borderLeftColor: '#1e3a8a' }}>
                    <div className="prov-card-header">
                      <span className="prov-card-title">Gasto Total Acumulado</span>
                      <DollarSign className="prov-card-icon" size={20} style={{ color: '#1e3a8a' }} />
                    </div>
                    <div className="prov-card-value">
                      $ {totalGastoGlobal.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="prov-card-desc">
                      {(fechaDesdeReporte || fechaHastaReporte) ? 'En el período seleccionado' : 'En requisiciones aprobadas'}
                    </div>
                  </div>

                  <div className="prov-analytic-card" style={{ borderLeftColor: '#f59e0b', backgroundColor: '#fffdf5' }}>
                    <div className="prov-card-header">
                      <span className="prov-card-title" style={{ color: '#92400e', fontWeight: '800' }}>Canalización Preferencial</span>
                      <span style={{ fontSize: '18px' }}>⭐</span>
                    </div>
                    <div className="prov-card-value" style={{ color: '#b45309' }}>
                      {tasaPreferencialPct.toFixed(1)} %
                    </div>
                    <div className="prov-card-desc" style={{ fontWeight: '800', color: '#92400e' }}>
                      $ {gastoPreferencial.toLocaleString('de-DE', { minimumFractionDigits: 2 })} en convenios
                    </div>
                  </div>

                  <div className="prov-analytic-card" style={{ borderLeftColor: '#10b981' }}>
                    <div className="prov-card-header">
                      <span className="prov-card-title">Proveedor Principal</span>
                      <TrendingUp className="prov-card-icon" size={20} style={{ color: '#10b981' }} />
                    </div>
                    <div className="prov-card-value" style={{ fontSize: '1.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '10px' }} title={rankingProveedores[0]?.razon_social || 'Ninguno'}>
                      {rankingProveedores[0]?.razon_social || 'Ninguno'}
                    </div>
                    <div className="prov-card-desc" style={{ fontWeight: '800', color: '#10b981' }}>
                      $ {(rankingProveedores[0]?.totalGastado || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="prov-analytic-card" style={{ borderLeftColor: '#6366f1' }}>
                    <div className="prov-card-header">
                      <span className="prov-card-title">Total Transacciones</span>
                      <Package className="prov-card-icon" size={20} style={{ color: '#6366f1' }} />
                    </div>
                    <div className="prov-card-value">
                      {comprasReporteFiltradas.length} compras
                    </div>
                    <div className="prov-card-desc">
                      {(fechaDesdeReporte || fechaHastaReporte) ? 'Artículos en el período' : 'Artículos individuales procesados'}
                    </div>
                  </div>

                  <div className="prov-analytic-card" style={{ borderLeftColor: '#8b5cf6' }}>
                    <div className="prov-card-header">
                      <span className="prov-card-title">Proveedores Registrados</span>
                      <Users className="prov-card-icon" size={20} style={{ color: '#8b5cf6' }} />
                    </div>
                    <div className="prov-card-value">
                      {proveedores.length}
                    </div>
                    <div className="prov-card-desc">
                      {rankingProveedores.length} con compras registradas
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Section A: Comparador de Precios */}
            <div className="prov-section-card">
              <div className="prov-section-header">
                <h3 className="prov-section-title">Buscador y Comparativo de Precios por Producto</h3>
                <p className="prov-section-subtitle">Busca un artículo para ver qué proveedor lo ha vendido al menor precio histórico</p>
              </div>
              
              <div className="prov-product-search-wrapper">
                <Search className="prov-search-icon" size={18} />
                <input 
                  type="text"
                  placeholder="Escribe la descripción de un producto o servicio... (ej: papel, toner, filtro)"
                  className="prov-product-search-input"
                  value={busquedaProducto}
                  onChange={(e) => setBusquedaProducto(e.target.value)}
                />
              </div>

              {busquedaProducto.trim() !== '' && (
                <div style={{ marginTop: '15px', overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                  <table className="prov-compare-table">
                    <thead>
                      <tr>
                        <th>ARTÍCULO / DESCRIPCIÓN</th>
                        <th style={{ textAlign: 'center' }}>FECHA</th>
                        <th>PROVEEDOR</th>
                        <th style={{ textAlign: 'right' }}>CANT.</th>
                        <th style={{ textAlign: 'right' }}>P. UNITARIO ($)</th>
                        <th style={{ textAlign: 'right' }}>TOTAL ($)</th>
                        <th style={{ textAlign: 'center' }}>REQ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comprasProductoFiltradas.length === 0 ? (
                        <tr>
                          <td colSpan="7" style={{ padding: '25px', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>
                            No se encontraron compras registradas que coincidan con la descripción.
                          </td>
                        </tr>
                      ) : (
                        [...comprasProductoFiltradas]
                          .sort((a, b) => a.pu - b.pu)
                          .map((c, idx) => {
                            const esMejor = mejorPrecioUnitario && c.pu === mejorPrecioUnitario;
                            return (
                              <tr key={idx} className={esMejor ? 'best-price-row' : ''}>
                                <td style={{ fontWeight: '600' }}>
                                  {c.descripcion}
                                  {esMejor && (
                                    <span className="best-price-badge">
                                      Mejor Precio
                                    </span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'center', color: '#64748b' }}>
                                  {c.fecha !== '—' ? c.fecha.split('-').reverse().join('/') : '—'}
                                </td>
                                <td style={{ fontWeight: 'bold' }}>{c.proveedor_nombre}</td>
                                <td style={{ textAlign: 'right' }}>{c.cantidad}</td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold', color: esMejor ? '#15803d' : '#0f172a' }}>
                                  $ {c.pu.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                                </td>
                                <td style={{ textAlign: 'right' }}>$ {c.total.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                                <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#2563eb' }}>{c.requisicion}</td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {busquedaProducto.trim() === '' && (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '500' }}>
                  Escribe en el campo superior para buscar coincidencias de precios.
                </div>
              )}
            </div>

            {/* Section B: Ranking de Proveedores */}
            <div className="prov-section-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                  <h3 className="prov-section-title">Ranking y Volumen de Compras por Proveedor</h3>
                  <p className="prov-section-subtitle">Consolidado general de transacciones, cantidades y montos totales por proveedor</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={exportRankingToExcel}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '10px 18px',
                      backgroundColor: '#16a34a',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: '800',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.2)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <FileSpreadsheet size={15} />
                    Exportar Ranking a Excel
                  </button>
                  <button
                    type="button"
                    onClick={exportarReporteDeudasExcel}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '10px 18px',
                      backgroundColor: '#d97706',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: '800',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      boxShadow: '0 4px 6px -1px rgba(217, 119, 6, 0.2)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <DollarSign size={15} />
                    Reporte Deudas (Aging)
                  </button>
                </div>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
                <table className="prov-ranking-table">
                  <thead>
                    <tr>
                      <th style={{ cursor: 'pointer' }} onClick={() => requestSort('rif')}>
                        RIF {sortConfig.key === 'rif' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                      </th>
                      <th style={{ cursor: 'pointer' }} onClick={() => requestSort('razon_social')}>
                        RAZÓN SOCIAL {sortConfig.key === 'razon_social' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                      </th>
                      <th>CATEGORÍA</th>
                      <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => requestSort('comprasCount')}>
                        N° COMPRAS {sortConfig.key === 'comprasCount' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                      </th>
                      <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => requestSort('unidadesCompradas')}>
                        UNI. COMPRADAS {sortConfig.key === 'unidadesCompradas' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                      </th>
                      <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => requestSort('totalGastado')}>
                        TOTAL GASTADO ($) {sortConfig.key === 'totalGastado' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                      </th>
                      <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => requestSort('promedioCompra')}>
                        PROMEDIO ($) {sortConfig.key === 'promedioCompra' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                      </th>
                      <th style={{ textAlign: 'center' }}>ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingOrdenado.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontWeight: 'bold' }}>
                          No hay transacciones registradas para clasificar proveedores.
                        </td>
                      </tr>
                    ) : (
                      rankingOrdenado.map((p, idx) => {
                        const esPref = Boolean(p.es_preferencial || p.proveedor_preferencial);
                        return (
                          <tr key={p.id || p.rif || p.razon_social || idx}>
                            <td className="rif-cell">{p.rif}</td>
                            <td className="name-cell">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: '800' }}>{p.razon_social}</span>
                                {esPref && (
                                  <span style={{ backgroundColor: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: '900', border: '1px solid #FDE68A' }}>
                                    ★ PREFERENCIAL
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {p.categoria ? p.categoria.split(', ').map((cat, i) => (
                                  <span key={i} style={{ backgroundColor: '#f8fafc', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: '800', color: '#475569', border: '1px solid #e2e8f0' }}>
                                    {cat}
                                  </span>
                                )) : <span style={{ color: '#cbd5e1' }}>-</span>}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{p.comprasCount}</td>
                            <td style={{ textAlign: 'right' }}>{p.unidadesCompradas}</td>
                            <td style={{ textAlign: 'right', fontWeight: '800', color: '#16a34a' }}>
                              $ {p.totalGastado.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right', color: '#475569' }}>
                              $ {p.promedioCompra.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => cargarHistorialCompras(p)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '5px 10px',
                                  backgroundColor: '#eff6ff',
                                  color: '#1e40af',
                                  border: '1px solid #bfdbfe',
                                  borderRadius: '6px',
                                  fontWeight: 'bold',
                                  fontSize: '0.7rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                className="action-hover"
                              >
                                <ShoppingBag size={12} />
                                Historial
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    )}

        {/* Modal Formulario */}
        {showModal && (
          <div className="prov-modal-overlay">
            <div className="prov-modal">
              <div className="prov-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h2 className="prov-modal-title" style={{ margin: 0 }}>
                    {formData.id ? 'Editar Proveedor' : 'Agregar Proveedor'}
                  </h2>
                  {formData.id && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#f1f5f9', padding: '3px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.72rem', color: '#475569', marginTop: '6px' }}>
                      <span>👤 Registrado por: <strong style={{ color: '#0f172a' }}>{formData.creado_por_nombre || formData.creado_por || 'Analista Compras'}</strong></span>
                      {(formData.actualizado_por_nombre || formData.actualizado_por) && (
                        <span style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '8px', marginLeft: '2px' }}>
                          ✏️ Editado por: <strong style={{ color: '#0f172a' }}>{formData.actualizado_por_nombre || formData.actualizado_por}</strong>
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button onClick={() => setShowModal(false)} className="prov-modal-close">
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={guardarProveedor} className="prov-form-wrapper">
                <div className="prov-form prov-form-grid">
                  <div className="prov-field">
                    <label className="prov-label">RIF</label>
                    <input 
                      className="prov-input"
                      placeholder="J-12345678-0"
                      value={formData.rif}
                      onChange={handleRifChange}
                      maxLength={12}
                      required
                    />
                  </div>
                  <div className="prov-field">
                    <label className="prov-label">Status</label>
                    <div className="status-toggle-group">
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, status: true})}
                        className={`status-btn ${formData.status ? 'active' : ''}`}
                      >
                        Activo
                      </button>
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, status: false})}
                        className={`status-btn ${!formData.status ? 'inactive' : ''}`}
                      >
                        Inactivo
                      </button>
                    </div>
                  </div>

                <div className="prov-field prov-form-full">
                  <label className="prov-label">Razón Social</label>
                  <input 
                    className="prov-input"
                    placeholder="NOMBRE COMERCIAL O FISCAL"
                    value={formData.razon_social}
                    onChange={e => setFormData({...formData, razon_social: e.target.value.toUpperCase()})}
                    required
                  />
                </div>

                <div className="prov-field prov-form-full">
                  <label className="prov-label">Categorías del Proveedor</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* El dropdown select y nueva categoria */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <select
                        className="prov-input"
                        value=""
                        onChange={(e) => {
                          const cat = e.target.value;
                          if (cat && !formData.categoria.includes(cat)) {
                            setFormData({...formData, categoria: [...formData.categoria, cat]});
                          }
                        }}
                        style={{ flex: 1, minWidth: '200px' }}
                      >
                        <option value="">-- Seleccionar Categoría --</option>
                        {categoriasUnicas.map(cat => (
                          <option key={cat} value={cat} disabled={formData.categoria.includes(cat)}>
                            {cat} {formData.categoria.includes(cat) ? '(Ya seleccionada)' : ''}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        placeholder="NUEVA CATEGORÍA (EJ. CONSTRUCCIÓN)"
                        value={nuevaCategoriaText}
                        onChange={(e) => setNuevaCategoriaText(e.target.value.toUpperCase())}
                        style={{
                          flex: 1,
                          minWidth: '240px',
                          padding: '12px 18px',
                          borderRadius: '12px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.85rem',
                          outline: 'none',
                          backgroundColor: 'white',
                          fontWeight: '600'
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            agregarCategoriaSession();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={agregarCategoriaSession}
                        style={{
                          padding: '12px 18px',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          borderRadius: '12px',
                          border: 'none',
                          fontSize: '0.8rem',
                          fontWeight: '800',
                          cursor: 'pointer',
                          boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
                        }}
                      >
                        + AGREGAR
                      </button>
                    </div>

                    {/* Las tags/badges de las categorías seleccionadas */}
                    <div style={{ 
                      display: 'flex', 
                      flexWrap: 'wrap', 
                      gap: '6px', 
                      padding: formData.categoria.length > 0 ? '10px' : '0px', 
                      border: formData.categoria.length > 0 ? '1px solid #e2e8f0' : 'none', 
                      borderRadius: '12px',
                      backgroundColor: '#f8fafc'
                    }}>
                      {formData.categoria.map(cat => (
                        <span
                          key={cat}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '0.7rem',
                            fontWeight: '800',
                            border: '1px solid #bfdbfe'
                          }}
                        >
                          {cat}
                          <button
                            type="button"
                            onClick={() => setFormData({...formData, categoria: formData.categoria.filter(c => c !== cat)})}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#3b82f6',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              padding: '0 2px',
                              fontSize: '0.75rem',
                              lineHeight: 1
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="prov-field">
                  <label className="prov-label">Persona de Contacto Comercial / Operativo <span style={{ color: '#ef4444' }}>*</span></label>
                  <input 
                    className="prov-input"
                    placeholder="Nombre del contacto comercial"
                    value={formData.persona_contacto || ''}
                    onChange={e => setFormData({...formData, persona_contacto: e.target.value})}
                  />
                </div>

                <div className="prov-field">
                  <label className="prov-label">Persona de Contacto Administrativo / Pagos</label>
                  <input 
                    className="prov-input"
                    placeholder="Nombre del contacto de cobranza/pagos"
                    value={formData.contacto_administrativo || ''}
                    onChange={e => setFormData({...formData, contacto_administrativo: e.target.value})}
                  />
                </div>

                <div className="prov-field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label className="prov-label" style={{ margin: 0 }}>
                      Ciudad / Localización <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {!creandoNuevaCiudad ? (
                        <>
                          <button
                            type="button"
                            onClick={() => { setCreandoNuevaCiudad(true); setNuevaCiudadText(''); }}
                            style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '11px', fontWeight: '800', cursor: 'pointer', padding: 0 }}
                          >
                            + Nueva Ciudad
                          </button>
                          {ciudadesList.length > 1 && (formData.ciudad || formData.localizacion) && (
                            <button
                              type="button"
                              onClick={() => eliminarCiudad(formData.ciudad || formData.localizacion)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: '700', cursor: 'pointer', padding: 0 }}
                              title={`Eliminar "${formData.ciudad || formData.localizacion}" de la lista`}
                            >
                              🗑️ Quitar ({formData.ciudad || formData.localizacion})
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setCreandoNuevaCiudad(false); setNuevaCiudadText(''); }}
                          style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '11px', fontWeight: '700', cursor: 'pointer', padding: 0 }}
                        >
                          ← Volver a lista
                        </button>
                      )}
                    </div>
                  </div>

                  {creandoNuevaCiudad ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        className="prov-input"
                        placeholder="Nombre de la nueva ciudad (Ej: Barquisimeto)"
                        value={nuevaCiudadText}
                        onChange={e => setNuevaCiudadText(e.target.value)}
                        style={{ flex: 1, height: '38px', fontSize: '12px' }}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            agregarCiudad();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={agregarCiudad}
                        style={{
                          backgroundColor: '#0284c7',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '0 14px',
                          fontWeight: '800',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        GUARDAR
                      </button>
                      <button
                        type="button"
                        onClick={() => { setCreandoNuevaCiudad(false); setNuevaCiudadText(''); }}
                        style={{
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          padding: '0 10px',
                          fontWeight: '700',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <select 
                      className="prov-input"
                      style={{ backgroundColor: 'white', cursor: 'pointer', height: '38px', fontSize: '13px' }}
                      value={formData.ciudad || formData.localizacion || 'Maracaibo'}
                      onChange={e => {
                        if (e.target.value === '__NUEVA__') {
                          setCreandoNuevaCiudad(true);
                        } else {
                          setFormData({...formData, ciudad: e.target.value, localizacion: e.target.value});
                        }
                      }}
                    >
                      {obtenerOpcionesLocalizacion.map((loc, idx) => (
                        <option key={idx} value={loc}>{loc}</option>
                      ))}
                      <option value="__NUEVA__">+ Agregar nueva ciudad...</option>
                    </select>
                  )}
                </div>

                <div className="prov-field">
                  <label className="prov-label">Correo (OPCIONAL)</label>
                  <input 
                    type="email"
                    className="prov-input"
                    placeholder="ejemplo@empresa.com"
                    value={formData.correo || ''}
                    onChange={e => setFormData({...formData, correo: e.target.value})}
                  />
                  {Boolean(formData.correo && formData.correo.trim() && (!formData.correo.includes('.') || !formData.correo.includes('@'))) && (
                    <span style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '2px', display: 'block' }}>
                      ⚠️ Debe incluir "@" y un dominio con punto (ej: .com)
                    </span>
                  )}
                </div>
                <div className="prov-field">
                  <label className="prov-label">Teléfono <span style={{ color: '#ef4444' }}>*</span></label>
                  <input 
                    className="prov-input"
                    placeholder="0414-XXXXXXX"
                    value={formData.telefono || ''}
                    onChange={e => setFormData({...formData, telefono: e.target.value})}
                  />
                </div>

                  <div className="prov-field prov-form-full" style={{ borderTop: '1px solid #cbd5e1', paddingTop: '15px', marginTop: '10px' }}>
                    <label className="prov-label" style={{ fontSize: '11px', fontWeight: '900', color: '#1e293b', marginBottom: '10px', display: 'block' }}>
                      🏦 CUENTAS DE PAGO (BANCOS)
                    </label>

                    {/* Formulario rápido para agregar cuenta */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '10px' }}>
                      
                      {/* Fila 1: Banco, Moneda, Cuenta */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'end' }}>
                        <div style={{ flex: 2, minWidth: '150px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                            <label style={{ display: 'block', fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', margin: 0 }}>Banco</label>
                            <button
                              type="button"
                              onClick={() => {
                                setCreandoNuevoBanco(!creandoNuevoBanco);
                                setNuevoBancoNombre('');
                                setNuevaCuentaForm(prev => ({ ...prev, banco: '' }));
                              }}
                              style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '9px', fontWeight: '800', cursor: 'pointer', padding: 0 }}
                            >
                              {creandoNuevoBanco ? "<- Seleccionar" : "+ Crear Nuevo"}
                            </button>
                          </div>
                          {creandoNuevoBanco ? (
                            <input
                              type="text"
                              className="prov-input"
                              placeholder="NOMBRE DEL BANCO"
                              value={nuevoBancoNombre}
                              onChange={(e) => setNuevoBancoNombre(e.target.value.toUpperCase())}
                              style={{ width: '100%', height: '38px', padding: '0 10px', fontSize: '12px' }}
                            />
                          ) : (
                            <select
                              className="prov-input"
                              value={nuevaCuentaForm.banco}
                              onChange={(e) => setNuevaCuentaForm({ ...nuevaCuentaForm, banco: e.target.value })}
                              style={{ width: '100%', height: '38px', padding: '0 10px', fontSize: '12px', backgroundColor: 'white' }}
                            >
                              <option value="">-- Seleccionar Banco --</option>
                              {bancosList.map(b => (
                                <option key={b} value={b}>{b}</option>
                              ))}
                            </select>
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: '90px' }}>
                          <label style={{ display: 'block', fontSize: '9px', fontWeight: '800', color: '#64748b', marginBottom: '5px', textTransform: 'uppercase' }}>Moneda</label>
                          <select
                            className="prov-input"
                            value={nuevaCuentaForm.moneda}
                            onChange={(e) => setNuevaCuentaForm({ ...nuevaCuentaForm, moneda: e.target.value })}
                            style={{ width: '100%', height: '38px', padding: '0 10px', fontSize: '12px', backgroundColor: 'white' }}
                          >
                            <option value="USD">USD</option>
                            <option value="VES">VES</option>
                          </select>
                        </div>

                        <div style={{ flex: 3, minWidth: '180px' }}>
                          <label style={{ display: 'block', fontSize: '9px', fontWeight: '800', color: '#64748b', marginBottom: '5px', textTransform: 'uppercase' }}>Número de Cuenta</label>
                          <input
                            type="text"
                            className="prov-input"
                            placeholder="Ej: 0134-XXXX-XX-XXXXXXXXXX"
                            value={nuevaCuentaForm.nro_cuenta}
                            onChange={(e) => setNuevaCuentaForm({ ...nuevaCuentaForm, nro_cuenta: e.target.value.replace(/[^0-9-]/g, '') })}
                            style={{ width: '100%', height: '38px', padding: '0 10px', fontSize: '12px', fontFamily: 'monospace' }}
                          />
                        </div>
                      </div>

                      {/* Fila 2: Titular de la Cuenta, RIF/Cédula, Botón Agregar */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'end' }}>
                        <div style={{ flex: 3, minWidth: '220px' }}>
                          <label style={{ display: 'block', fontSize: '9px', fontWeight: '800', color: '#64748b', marginBottom: '5px', textTransform: 'uppercase' }}>Titular / Persona de la Cuenta <span style={{ fontWeight: '400', textTransform: 'none', color: '#94a3b8' }}>(Opcional)</span></label>
                          <input
                            type="text"
                            className="prov-input"
                            placeholder="Nombre del Titular (Ej: Elizabeth Gutierrez)"
                            value={nuevaCuentaForm.titular}
                            onChange={(e) => setNuevaCuentaForm({ ...nuevaCuentaForm, titular: e.target.value })}
                            style={{ width: '100%', height: '38px', padding: '0 10px', fontSize: '12px' }}
                          />
                        </div>

                        <div style={{ flex: 2, minWidth: '140px' }}>
                          <label style={{ display: 'block', fontSize: '9px', fontWeight: '800', color: '#64748b', marginBottom: '5px', textTransform: 'uppercase' }}>RIF / Cédula Titular <span style={{ fontWeight: '400', textTransform: 'none', color: '#94a3b8' }}>(Opcional)</span></label>
                          <input
                            type="text"
                            className="prov-input"
                            placeholder="Ej: V-12345678-0"
                            value={nuevaCuentaForm.rif}
                            onChange={(e) => setNuevaCuentaForm({ ...nuevaCuentaForm, rif: e.target.value })}
                            style={{ width: '100%', height: '38px', padding: '0 10px', fontSize: '12px' }}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={agregarCuentaBancaria}
                          style={{
                            height: '38px',
                            padding: '0 16px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            borderRadius: '10px',
                            border: 'none',
                            fontSize: '11px',
                            fontWeight: '800',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
                            flexShrink: 0
                          }}
                        >
                          <Plus size={14} /> AGREGAR
                        </button>
                      </div>

                    </div>

                    {/* Listado de cuentas agregadas */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                      {(!formData.cuentas_bancarias || formData.cuentas_bancarias.length === 0) ? (
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', padding: '6px 8px' }}>
                          No hay cuentas de pago registradas para este proveedor.
                        </p>
                      ) : (
                        formData.cuentas_bancarias.map((cta, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f1f5f9', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#1e293b' }}>{cta.banco}</span>
                              <span style={{ fontSize: '0.65rem', fontWeight: '900', padding: '1px 6px', borderRadius: '6px', backgroundColor: cta.moneda === 'USD' ? '#dcfce7' : '#eff6ff', color: cta.moneda === 'USD' ? '#15803d' : '#1d4ed8', border: `1px solid ${cta.moneda === 'USD' ? '#bbf7d0' : '#bfdbfe'}` }}>
                                {cta.moneda}
                              </span>
                              <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#475569' }}>{cta.nro_cuenta}</span>
                              {(cta.titular || cta.rif) && (
                                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600' }}>
                                  ({cta.titular || '—'} | RIF: {cta.rif || '—'})
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => quitarCuentaBancaria(idx)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px', display: 'flex', alignItems: 'center' }}
                              title="Quitar cuenta"
                            >
                              <XCircle size={15} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                <div className="prov-field prov-form-full" style={{ marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setMostrarParametrosSrm(!mostrarParametrosSrm)}
                      title="Parámetros Financieros & Evaluación SRM"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: mostrarParametrosSrm ? '4px 10px' : '4px 8px',
                        backgroundColor: mostrarParametrosSrm ? '#e0f2fe' : '#f1f5f9',
                        color: '#0284c7',
                        border: `1px solid ${mostrarParametrosSrm ? '#bae6fd' : '#e2e8f0'}`,
                        borderRadius: '8px',
                        fontSize: '0.7rem',
                        fontWeight: '800',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span>💳</span>
                      {mostrarParametrosSrm ? (
                        <>
                          <span>SRM</span>
                          <ChevronUp size={13} />
                        </>
                      ) : (
                        <>
                          <span>SRM</span>
                          <ChevronDown size={13} />
                        </>
                      )}
                    </button>
                    {!mostrarParametrosSrm && (Number(formData.monto_limite_credito) > 0 || Number(formData.dias_credito) > 0 || formData.proveedor_preferencial) && (
                      <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 7px', borderRadius: '10px', fontSize: '0.6rem', fontWeight: '900', border: '1px solid #bbf7d0' }}>
                        ✓ Configurado
                      </span>
                    )}
                  </div>

                  {mostrarParametrosSrm && (
                    <div style={{ marginTop: '10px', backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                        <div>
                          <label className="prov-label">LÍMITE DE CRÉDITO ($ USD)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="prov-input"
                            placeholder="Ej: 5000.00"
                            value={formData.monto_limite_credito}
                            onChange={e => setFormData({ ...formData, monto_limite_credito: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="prov-label">DÍAS DE CRÉDITO (PAGO)</label>
                          <input
                            type="number"
                            min="0"
                            className="prov-input"
                            placeholder="Ej: 15 (días)"
                            value={formData.dias_credito}
                            onChange={e => setFormData({ ...formData, dias_credito: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="prov-label">CALIF. PRECIO (1 AL 5)</label>
                          <select
                            className="prov-input"
                            value={formData.calificacion_precio}
                            onChange={e => setFormData({ ...formData, calificacion_precio: Number(e.target.value) })}
                          >
                            <option value={5}>⭐⭐⭐⭐⭐ (5 - Excelente)</option>
                            <option value={4}>⭐⭐⭐⭐ (4 - Bueno)</option>
                            <option value={3}>⭐⭐⭐ (3 - Regular)</option>
                            <option value={2}>⭐⭐ (2 - Costoso)</option>
                            <option value={1}>⭐ (1 - Muy Costoso)</option>
                          </select>
                        </div>

                        <div>
                          <label className="prov-label">CALIF. CUMPLIMIENTO</label>
                          <select
                            className="prov-input"
                            value={formData.calificacion_cumplimiento}
                            onChange={e => setFormData({ ...formData, calificacion_cumplimiento: Number(e.target.value) })}
                          >
                            <option value={5}>⭐⭐⭐⭐⭐ (5 - Impecable)</option>
                            <option value={4}>⭐⭐⭐⭐ (4 - Confiable)</option>
                            <option value={3}>⭐⭐⭐ (3 - Aceptable)</option>
                            <option value={2}>⭐⭐ (2 - Irregular)</option>
                            <option value={1}>⭐ (1 - Problemático)</option>
                          </select>
                        </div>
                      </div>

                      {/* ACUERDO COMERCIAL INSTITUCIONAL (PROVEEDOR PREFERENCIAL) */}
                      <div style={{ 
                        borderTop: '2px dashed #fde68a', 
                        marginTop: '15px', 
                        paddingTop: '15px',
                        backgroundColor: (formData.es_preferencial || formData.proveedor_preferencial) ? '#fffdf5' : '#f8fafc',
                        padding: '16px',
                        borderRadius: '16px',
                        border: (formData.es_preferencial || formData.proveedor_preferencial) ? '1px solid #fde68a' : '1px solid #e2e8f0'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '20px' }}>⭐</span>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '900', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                Acuerdo Comercial Institucional
                              </h4>
                              <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: '#78350f' }}>
                                Convenio formal y designación como Proveedor Preferencial
                              </p>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {!puedeGestionarPreferenciales && (
                              <span style={{ fontSize: '0.68rem', backgroundColor: '#f1f5f9', color: '#64748b', padding: '3px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: '700' }}>
                                🔒 Solo Gerencia de Compras / Dirección / Super Admin
                              </span>
                            )}
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: puedeGestionarPreferenciales ? 'pointer' : 'not-allowed', margin: 0 }}>
                              <input
                                type="checkbox"
                                checked={Boolean(formData.es_preferencial || formData.proveedor_preferencial)}
                                disabled={!puedeGestionarPreferenciales}
                                onChange={e => {
                                  const checked = e.target.checked;
                                  setFormData({
                                    ...formData,
                                    es_preferencial: checked,
                                    proveedor_preferencial: checked,
                                    nivel_preferencial: checked ? (formData.nivel_preferencial && formData.nivel_preferencial !== 'Regular' ? formData.nivel_preferencial : 'Tier 1 / Oro') : 'Regular'
                                  });
                                }}
                                style={{ width: '18px', height: '18px', cursor: puedeGestionarPreferenciales ? 'pointer' : 'not-allowed', accentColor: '#f59e0b' }}
                              />
                              <span style={{ fontSize: '0.78rem', fontWeight: '900', color: (formData.es_preferencial || formData.proveedor_preferencial) ? '#b45309' : '#64748b' }}>
                                Designar como Proveedor Preferencial
                              </span>
                            </label>
                          </div>
                        </div>

                        {(formData.es_preferencial || formData.proveedor_preferencial) && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                              <div>
                                <label className="prov-label" style={{ color: '#92400e' }}>NIVEL PREFERENCIAL</label>
                                <select
                                  className="prov-input"
                                  disabled={!puedeGestionarPreferenciales}
                                  style={{ backgroundColor: 'white', fontWeight: '700', border: '1px solid #fde68a' }}
                                  value={formData.nivel_preferencial || 'Tier 1 / Oro'}
                                  onChange={e => setFormData({ ...formData, nivel_preferencial: e.target.value })}
                                >
                                  <option value="Tier 1 / Oro">🥇 Tier 1 / Oro (Estratégico)</option>
                                  <option value="Tier 2 / Plata">🥈 Tier 2 / Plata (Recurrente)</option>
                                  <option value="Regular">⚪ Regular</option>
                                </select>
                              </div>

                              <div>
                                <label className="prov-label" style={{ color: '#92400e' }}>DESCUENTO PACTADO (%)</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  className="prov-input"
                                  disabled={!puedeGestionarPreferenciales}
                                  placeholder="Ej: 5.00"
                                  style={{ backgroundColor: 'white' }}
                                  value={formData.descuento_pactado_porcentaje}
                                  onChange={e => setFormData({ ...formData, descuento_pactado_porcentaje: e.target.value })}
                                />
                              </div>

                              <div>
                                <label className="prov-label" style={{ color: '#92400e' }}>DÍAS DE CRÉDITO PACTADOS</label>
                                <input
                                  type="number"
                                  min="0"
                                  className="prov-input"
                                  disabled={!puedeGestionarPreferenciales}
                                  placeholder="Ej: 30"
                                  style={{ backgroundColor: 'white' }}
                                  value={formData.dias_credito_pactados || formData.dias_credito || ''}
                                  onChange={e => setFormData({ ...formData, dias_credito_pactados: e.target.value, dias_credito: e.target.value })}
                                />
                              </div>

                              <div>
                                <label className="prov-label" style={{ color: '#92400e' }}>TIEMPO DE ENTREGA (DÍAS)</label>
                                <input
                                  type="number"
                                  min="0"
                                  className="prov-input"
                                  disabled={!puedeGestionarPreferenciales}
                                  placeholder="Ej: 3"
                                  style={{ backgroundColor: 'white' }}
                                  value={formData.tiempo_entrega_acordado_dias || ''}
                                  onChange={e => setFormData({ ...formData, tiempo_entrega_acordado_dias: e.target.value })}
                                />
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                              <div>
                                <label className="prov-label" style={{ color: '#92400e' }}>VIGENCIA ACUERDO: DESDE</label>
                                <input
                                  type="date"
                                  className="prov-input"
                                  disabled={!puedeGestionarPreferenciales}
                                  style={{ backgroundColor: 'white' }}
                                  value={formData.vigencia_acuerdo_desde || ''}
                                  onChange={e => setFormData({ ...formData, vigencia_acuerdo_desde: e.target.value })}
                                />
                              </div>

                              <div>
                                <label className="prov-label" style={{ color: '#92400e' }}>VIGENCIA ACUERDO: HASTA</label>
                                <input
                                  type="date"
                                  className="prov-input"
                                  disabled={!puedeGestionarPreferenciales}
                                  style={{ backgroundColor: 'white' }}
                                  value={formData.vigencia_acuerdo_hasta || ''}
                                  onChange={e => setFormData({ ...formData, vigencia_acuerdo_hasta: e.target.value })}
                                />
                              </div>
                            </div>

                            <div>
                              <label className="prov-label" style={{ color: '#92400e' }}>CLÁUSULAS / NOTAS DEL CONVENIO</label>
                              <textarea
                                rows={2}
                                className="prov-input"
                                disabled={!puedeGestionarPreferenciales}
                                placeholder="Condiciones específicas pactadas (ej: despacho sin costo a planta, garantía extendida 12 meses, etc.)..."
                                style={{ backgroundColor: 'white', resize: 'vertical' }}
                                value={formData.condiciones_acuerdo_nota || ''}
                                onChange={e => setFormData({ ...formData, condiciones_acuerdo_nota: e.target.value })}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div style={{ marginTop: '8px' }}>
                        <label className="prov-label">OBSERVACIONES DE NEGOCIACIÓN</label>
                        <textarea
                          className="prov-input"
                          rows={2}
                          placeholder="Ej: Descuento 5% por pronto pago, entregas directas en almacén Central, etc."
                          value={formData.observaciones_negociacion}
                          onChange={e => setFormData({ ...formData, observaciones_negociacion: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="prov-field prov-form-full">
                  <label className="prov-label">Dirección <span style={{ color: '#ef4444' }}>*</span></label>
                  <textarea 
                    rows={2}
                    className="prov-input prov-textarea"
                    placeholder="Dirección fiscal completa..."
                    value={formData.direccion}
                    onChange={e => setFormData({...formData, direccion: e.target.value})}
                  />
                </div>
                </div>

                <div className="prov-modal-footer">
                  <button 
                    type="button" 
                    onClick={() => setShowModal(false)}
                    className="btn-cancel"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={saving}
                    className="btn-submit"
                  >
                    {saving ? 'Guardando...' : 'Guardar Datos'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Ficha Detallada del Proveedor (SRM) con 3 Pestañas */}
        {showHistoryModal && provSeleccionado && (
          <div className="prov-modal-overlay" style={{ zIndex: 1000 }}>
            <div className="prov-modal" style={{ maxWidth: '980px', width: '92%', borderRadius: '24px', padding: '25px', backgroundColor: 'white' }}>
              
              {/* Header Ficha SRM - Estructura Espaciosa Desglosada */}
              <div style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Fila 1: Título de Empresa, Badges y Botón de Cerrar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                      🏢
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '950', color: '#0f172a', letterSpacing: '-0.02em' }}>
                          {provSeleccionado.razon_social}
                        </h2>
                        <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', fontSize: '11px', fontWeight: '900', padding: '2px 9px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                          RIF: {provSeleccionado.rif}
                        </span>
                        {provSeleccionado.categoria && (
                          <span style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: '800', padding: '2px 9px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            {provSeleccionado.categoria}
                          </span>
                        )}
                        {provSeleccionado.proveedor_preferencial && (
                          <span style={{ backgroundColor: '#fef3c7', color: '#b45309', fontSize: '10px', fontWeight: '900', padding: '3px 8px', borderRadius: '20px', border: '1px solid #fde68a', textTransform: 'uppercase' }}>
                            ⭐ PREFERENCIAL
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#f8fafc', padding: '5px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.72rem', color: '#475569' }}>
                      <span>👤 Registrado por: <strong style={{ color: '#0f172a' }}>{provSeleccionado.creado_por_nombre || provSeleccionado.creado_por || 'Analista Compras'}</strong></span>
                      {(provSeleccionado.actualizado_por_nombre || provSeleccionado.actualizado_por) && (
                        <span style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '8px', marginLeft: '2px' }}>
                          ✏️ Editado por: <strong style={{ color: '#0f172a' }}>{provSeleccionado.actualizado_por_nombre || provSeleccionado.actualizado_por}</strong>
                        </span>
                      )}
                    </div>
                    <button onClick={() => setShowHistoryModal(false)} className="prov-modal-close" style={{ background: '#f1f5f9', border: 'none', borderRadius: '12px', width: '36px', height: '36px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <XCircle size={20} />
                    </button>
                  </div>
                </div>

                {/* Fila 2: Tarjetas de Contacto y Ubicación (Evita texto encimado) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#334155' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14px' }}>👤</span>
                    <span><strong>Contacto Comercial:</strong> {provSeleccionado.persona_contacto || provSeleccionado.contacto_nombre || 'N/A'}</span>
                  </div>
                  {provSeleccionado.contacto_administrativo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '14px' }}>💼</span>
                      <span><strong>Contacto Admin:</strong> {provSeleccionado.contacto_administrativo}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14px' }}>📞</span>
                    <span><strong>Teléfono:</strong> {provSeleccionado.telefono || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14px' }}>📍</span>
                    <span><strong>Ciudad:</strong> {provSeleccionado.ciudad || provSeleccionado.localizacion || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', gridColumn: 'span 1' }}>
                    <span style={{ fontSize: '14px' }}>🏠</span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><strong>Dirección:</strong> {provSeleccionado.direccion || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Sub-Pestañas SRM */}
              <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #e2e8f0', margin: '15px 0 20px 0' }}>
                <button
                  type="button"
                  onClick={() => setSubTabFicha('credito')}
                  style={{
                    padding: '10px 18px',
                    border: 'none',
                    borderBottom: subTabFicha === 'credito' ? '3px solid #0ea5e9' : '3px solid transparent',
                    backgroundColor: subTabFicha === 'credito' ? '#f0f9ff' : 'transparent',
                    color: subTabFicha === 'credito' ? '#0369a1' : '#64748b',
                    fontWeight: '800',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    borderRadius: '8px 8px 0 0',
                    transition: 'all 0.2s'
                  }}
                >
                  💳 Datos Financieros y Crédito
                </button>
                <button
                  type="button"
                  onClick={() => setSubTabFicha('historial')}
                  style={{
                    padding: '10px 18px',
                    border: 'none',
                    borderBottom: subTabFicha === 'historial' ? '3px solid #0ea5e9' : '3px solid transparent',
                    backgroundColor: subTabFicha === 'historial' ? '#f0f9ff' : 'transparent',
                    color: subTabFicha === 'historial' ? '#0369a1' : '#64748b',
                    fontWeight: '800',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    borderRadius: '8px 8px 0 0',
                    transition: 'all 0.2s'
                  }}
                >
                  📜 Historial de Compras ({historialCompras.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSubTabFicha('evaluacion')}
                  style={{
                    padding: '10px 18px',
                    border: 'none',
                    borderBottom: subTabFicha === 'evaluacion' ? '3px solid #0ea5e9' : '3px solid transparent',
                    backgroundColor: subTabFicha === 'evaluacion' ? '#f0f9ff' : 'transparent',
                    color: subTabFicha === 'evaluacion' ? '#0369a1' : '#64748b',
                    fontWeight: '800',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    borderRadius: '8px 8px 0 0',
                    transition: 'all 0.2s'
                  }}
                >
                  🌟 Rendimiento y Precios (SRM)
                </button>
              </div>

              {loadingHistorial ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '50px 0', gap: '15px' }}>
                  <Loader2 className="animate-spin" size={32} style={{ color: '#0ea5e9' }} />
                  <p style={{ color: '#64748b', fontWeight: 'bold', fontSize: '0.85rem', textTransform: 'uppercase' }}>Cargando expediente del proveedor...</p>
                </div>
              ) : (
                <div>
                  {/* PESTAÑA 1: DATOS FINANCIEROS Y CRÉDITO */}
                  {subTabFicha === 'credito' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      {(() => {
                        const limite = Number(provSeleccionado.monto_limite_credito ?? provSeleccionado.limite_credito) || 0;
                        const dias = Number(provSeleccionado.dias_credito ?? provSeleccionado.dias_credito_habituales) || 0;
                        const ctasModal = parseCuentasBancarias(provSeleccionado.cuentas_bancarias);
                        const gastado = historialCompras.reduce((sum, c) => sum + c.total, 0);
                        const disponible = limite > 0 ? (limite - gastado) : 0;
                        const pctDisp = limite > 0 ? (disponible / limite) * 100 : 0;

                        let semaforoBg = '#f0fdf4';
                        let semaforoBorder = '#86efac';
                        let semaforoColor = '#166534';
                        let semaforoTexto = '🟢 CRÉDITO SALUDABLE Y DISPONIBLE';

                        if (limite <= 0 && dias > 0) {
                          semaforoBg = '#f0f9ff';
                          semaforoBorder = '#bae6fd';
                          semaforoColor = '#0369a1';
                          semaforoTexto = `🔵 LÍNEA DE CRÉDITO ABIERTA (PLAZO: ${dias} DÍAS - SIN MONTO LÍMITE FIJO)`;
                        } else if (limite <= 0 && dias <= 0) {
                          semaforoBg = '#f8fafc';
                          semaforoBorder = '#cbd5e1';
                          semaforoColor = '#475569';
                          semaforoTexto = '⚪ PAGO DE CONTADO (SIN LÍNEA DE CRÉDITO)';
                        } else if (disponible < 0 || pctDisp < 10) {
                          semaforoBg = '#fef2f2';
                          semaforoBorder = '#fca5a5';
                          semaforoColor = '#991b1b';
                          semaforoTexto = '🚨 SOBREGIRADO / ALERTA CRÍTICA DE CRÉDITO';
                        } else if (pctDisp <= 30) {
                          semaforoBg = '#fffbeb';
                          semaforoBorder = '#fde68a';
                          semaforoColor = '#92400e';
                          semaforoTexto = '⚠️ CRÉDITO POR AGOTARSE (< 30% DISPONIBLE)';
                        }

                        return (
                          <>
                            {/* BANNER DE SEMÁFORO DE CRÉDITO */}
                            <div style={{ backgroundColor: semaforoBg, border: `2px solid ${semaforoBorder}`, borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: '900', color: semaforoColor, letterSpacing: '0.05em' }}>
                                  {semaforoTexto}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#334155', fontWeight: '600', marginTop: '4px' }}>
                                  Plazo de Pago Acordado: <strong>{dias > 0 ? `${dias} Días Crédito` : 'Contado / Inmediato'}</strong>
                                </div>
                              </div>

                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700' }}>Crédito Disponible</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: '950', color: (limite > 0 && disponible < 0) ? '#dc2626' : '#0f172a' }}>
                                  {limite > 0 ? `$ ${disponible.toLocaleString('de-DE', { minimumFractionDigits: 2 })}` : (dias > 0 ? 'Sin límite fijo' : '$ 0,00')}
                                </div>
                              </div>
                            </div>

                            {/* GRILLA DE TARJETAS FINANCIERAS */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                              <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>Límite de Crédito Aprobado</div>
                                <div style={{ fontSize: '1.3rem', fontWeight: '900', color: '#0f172a', marginTop: '6px' }}>
                                  {limite > 0 ? `$ ${limite.toLocaleString('de-DE', { minimumFractionDigits: 2 })}` : (dias > 0 ? 'Sin límite fijo' : '$ 0,00')}
                                </div>
                              </div>

                              <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>Crédito Utilizado / Saldo</div>
                                <div style={{ fontSize: '1.3rem', fontWeight: '900', color: '#eab308', marginTop: '6px' }}>
                                  $ {gastado.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                                </div>
                              </div>

                              <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>Días de Crédito (Plazo)</div>
                                <div style={{ fontSize: '1.3rem', fontWeight: '900', color: '#0ea5e9', marginTop: '6px' }}>
                                  {dias} días
                                </div>
                              </div>
                            </div>

                            {/* EVALUACIÓN DE RENDIMIENTO SRM */}
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                              <div style={{ flex: 1, minWidth: '180px', backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>Calificación Precio</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: '900', color: '#f59e0b' }}>
                                  {'★'.repeat(provSeleccionado.calificacion_precio || 5)} ({provSeleccionado.calificacion_precio || 5}/5)
                                </span>
                              </div>
                              <div style={{ flex: 1, minWidth: '180px', backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>Calificación Cumplimiento</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: '900', color: '#f59e0b' }}>
                                  {'★'.repeat(provSeleccionado.calificacion_cumplimiento || 5)} ({provSeleccionado.calificacion_cumplimiento || 5}/5)
                                </span>
                              </div>
                            </div>

                            {/* SECCIÓN DE CUENTAS BANCARIAS */}
                            <div style={{ backgroundColor: '#f8fafc', padding: '18px', borderRadius: '16px', border: '1px solid #cbd5e1', marginTop: '2px' }}>
                              <div style={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: '900', textTransform: 'uppercase', marginBottom: '12px', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px' }}>
                                🏦 Cuentas de Pago Registradas
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {(!ctasModal || ctasModal.length === 0) ? (
                                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', padding: '4px' }}>
                                    No hay cuentas bancarias asociadas a este proveedor.
                                  </span>
                                ) : (
                                  ctasModal.map((cta, idx) => (
                                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '5px', backgroundColor: 'white', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#1e293b' }}>{cta.banco}</span>
                                        <span style={{ fontSize: '0.65rem', fontWeight: '900', padding: '2px 7px', borderRadius: '6px', backgroundColor: cta.moneda === 'USD' ? '#dcfce7' : '#eff6ff', color: cta.moneda === 'USD' ? '#15803d' : '#1d4ed8', border: `1px solid ${cta.moneda === 'USD' ? '#bbf7d0' : '#bfdbfe'}` }}>
                                          {cta.moneda}
                                        </span>
                                        <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#475569', fontWeight: '500' }}>{cta.nro_cuenta}</span>
                                      </div>
                                      {(cta.titular || cta.rif) && (
                                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>
                                          👤 Titular: <strong style={{ color: '#334155' }}>{cta.titular || '—'}</strong> | RIF: <strong style={{ color: '#334155' }}>{cta.rif || '—'}</strong>
                                        </div>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            {/* SECCIÓN DE OBSERVACIONES DE NEGOCIACIÓN */}
                            <div style={{ backgroundColor: provSeleccionado.observaciones_negociacion ? '#fffbeb' : '#f8fafc', padding: '16px', borderRadius: '14px', border: `1px solid ${provSeleccionado.observaciones_negociacion ? '#fde68a' : '#e2e8f0'}` }}>
                              <div style={{ fontSize: '0.75rem', color: provSeleccionado.observaciones_negociacion ? '#92400e' : '#64748b', fontWeight: '900', textTransform: 'uppercase', marginBottom: '4px' }}>
                                📝 Observaciones de Negociación & Acuerdos Comerciales
                              </div>
                              <div style={{ fontSize: '0.85rem', color: provSeleccionado.observaciones_negociacion ? '#451a03' : '#94a3b8', fontWeight: '500', whiteSpace: 'pre-wrap', fontStyle: provSeleccionado.observaciones_negociacion ? 'normal' : 'italic' }}>
                                {provSeleccionado.observaciones_negociacion || 'No hay notas de negociación ni acuerdos comerciales registrados para este proveedor.'}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* PESTAÑA 2: HISTORIAL DE COMPRAS Y FACTURAS */}
                  {subTabFicha === 'historial' && (
                    <div>
                      {/* FILTRO DE FECHAS EN HISTORIAL DE PROVEEDOR */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '12px', backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '800', color: '#475569' }}>
                            <Calendar size={14} style={{ color: '#0ea5e9' }} />
                            <span>Desde:</span>
                            <input
                              type="date"
                              value={fechaDesdeHistorial}
                              onChange={(e) => setFechaDesdeHistorial(e.target.value)}
                              style={{ padding: '5px 8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.75rem', fontWeight: '600', outline: 'none' }}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '800', color: '#475569' }}>
                            <span>Hasta:</span>
                            <input
                              type="date"
                              value={fechaHastaHistorial}
                              onChange={(e) => setFechaHastaHistorial(e.target.value)}
                              style={{ padding: '5px 8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.75rem', fontWeight: '600', outline: 'none' }}
                            />
                          </div>
                          {(fechaDesdeHistorial || fechaHastaHistorial) && (
                            <button
                              type="button"
                              onClick={() => { setFechaDesdeHistorial(''); setFechaHastaHistorial(''); }}
                              style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '8px', padding: '5px 10px', fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <RotateCcw size={12} /> Limpiar
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569' }}>
                            Total: <strong style={{ color: '#15803d' }}>$ {historialComprasFiltrado.reduce((sum, c) => sum + c.total, 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</strong> ({historialComprasFiltrado.length}{historialComprasFiltrado.length !== historialCompras.length ? ` de ${historialCompras.length}` : ''} transacciones)
                          </div>
                          <button
                            type="button"
                            onClick={() => exportHistoryToExcel(provSeleccionado)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 16px',
                              backgroundColor: '#16a34a',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              fontWeight: 'bold',
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            <FileSpreadsheet size={14} />
                            Exportar Excel
                          </button>
                        </div>
                      </div>

                      <div style={{ overflowY: 'auto', maxHeight: '350px', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#1e293b', color: '#f8fafc', position: 'sticky', top: 0 }}>
                              <th style={{ padding: '10px 12px', textAlign: 'center' }}>FECHA EMISIÓN</th>
                              <th style={{ padding: '10px 12px', textAlign: 'center' }}>VENCIMIENTO</th>
                              <th style={{ padding: '10px 12px', textAlign: 'center' }}>REQ</th>
                              <th style={{ padding: '10px 12px' }}>DESCRIPCIÓN</th>
                              <th style={{ padding: '10px 12px', textAlign: 'right' }}>CANT.</th>
                              <th style={{ padding: '10px 12px', textAlign: 'right' }}>P. UNIT</th>
                              <th style={{ padding: '10px 12px', textAlign: 'right' }}>TOTAL</th>
                              <th style={{ padding: '10px 12px', textAlign: 'center' }}>FACTURA</th>
                              <th style={{ padding: '10px 12px', textAlign: 'center' }}>SOPORTE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historialComprasFiltrado.length === 0 ? (
                              <tr>
                                <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontWeight: 'bold' }}>
                                  No se registran compras para este proveedor en el período seleccionado.
                                </td>
                              </tr>
                            ) : (
                              historialComprasFiltrado.map((c, i) => {
                                const diasCred = Number(provSeleccionado.dias_credito) || 0;
                                let fechaVencStr = '—';
                                if (c.fecha !== '—') {
                                  const fDate = new Date(c.fecha + 'T12:00:00');
                                  fDate.setDate(fDate.getDate() + diasCred);
                                  fechaVencStr = fDate.toISOString().split('T')[0].split('-').reverse().join('/');
                                }

                                return (
                                  <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#475569', fontWeight: '500' }}>
                                      {c.fecha !== '—' ? c.fecha.split('-').reverse().join('/') : '—'}
                                    </td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#d97706' }}>
                                      {fechaVencStr}
                                    </td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 'bold', color: '#1e40af' }}>{c.requisicion}</td>
                                    <td style={{ padding: '10px 12px', color: '#0f172a', fontWeight: '600' }}>{c.descripcion}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold' }}>{c.cantidad}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>$ {c.pu.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '800', color: '#16a34a' }}>$ {c.total.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#2563eb' }}>{c.factura}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                      {c.facturaUrl ? (
                                        <a href={c.facturaUrl} target="_blank" rel="noreferrer" style={{ padding: '4px 8px', backgroundColor: '#eff6ff', color: '#2563eb', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.7rem', textDecoration: 'none' }}>Ver 📄</a>
                                      ) : (
                                        <span style={{ color: '#cbd5e1', fontSize: '0.7rem' }}>S/S</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* PESTAÑA 3: RENDIMIENTO Y PRECIOS (SRM) */}
                  {subTabFicha === 'evaluacion' && (
                    <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        ⭐ Evaluación de Rendimiento SRM y Acuerdos Comerciales
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                        {/* Calificación Precio */}
                        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                          <label style={{ fontSize: '11px', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '6px' }}>CALIFICACIÓN DE PRECIO</label>
                          <div style={{ display: 'flex', gap: '4px', cursor: 'pointer' }}>
                            {[1, 2, 3, 4, 5].map(star => (
                              <span
                                key={star}
                                onClick={() => setProvSeleccionado({ ...provSeleccionado, calificacion_precio: star })}
                                style={{ fontSize: '24px', color: star <= (provSeleccionado.calificacion_precio || 5) ? '#f59e0b' : '#cbd5e1', transition: 'transform 0.1s' }}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', fontWeight: '600' }}>
                            {provSeleccionado.calificacion_precio || 5} de 5 Estrellas
                          </div>
                        </div>

                        {/* Calificación Cumplimiento */}
                        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                          <label style={{ fontSize: '11px', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '6px' }}>CALIFICACIÓN DE CUMPLIMIENTO</label>
                          <div style={{ display: 'flex', gap: '4px', cursor: 'pointer' }}>
                            {[1, 2, 3, 4, 5].map(star => (
                              <span
                                key={star}
                                onClick={() => setProvSeleccionado({ ...provSeleccionado, calificacion_cumplimiento: star })}
                                style={{ fontSize: '24px', color: star <= (provSeleccionado.calificacion_cumplimiento || 5) ? '#f59e0b' : '#cbd5e1', transition: 'transform 0.1s' }}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', fontWeight: '600' }}>
                            {provSeleccionado.calificacion_cumplimiento || 5} de 5 Estrellas
                          </div>
                        </div>
                      </div>

                      {/* Estatus Preferencial */}
                      <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input
                          type="checkbox"
                          id="chk-preferencial-ficha"
                          checked={Boolean(provSeleccionado.proveedor_preferencial)}
                          onChange={e => setProvSeleccionado({ ...provSeleccionado, proveedor_preferencial: e.target.checked })}
                          style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        />
                        <label htmlFor="chk-preferencial-ficha" style={{ fontSize: '0.85rem', fontWeight: '800', color: '#15803d', cursor: 'pointer' }}>
                          ⭐ Marcar este proveedor como Preferencial en Compras (Sugerencia destacada en requisiciones)
                        </label>
                      </div>

                      {/* Notas de Negociación */}
                      <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                        <label style={{ fontSize: '11px', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '6px' }}>NOTAS DE NEGOCIACIÓN & ACUERDOS COMERCIALES</label>
                        <textarea
                          rows={4}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                          placeholder="Escribe acuerdos comerciales, porcentajes de descuento por pronto pago, términos de entrega..."
                          value={provSeleccionado.observaciones_negociacion || ''}
                          onChange={e => setProvSeleccionado({ ...provSeleccionado, observaciones_negociacion: e.target.value })}
                        />
                      </div>

                      {/* Botón Guardar Cambios SRM */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          disabled={guardandoSrmProv}
                          onClick={async () => {
                            setGuardandoSrmProv(true);
                            try {
                              const srmPayload = {
                                calificacion_precio: provSeleccionado.calificacion_precio || 5,
                                calificacion_cumplimiento: provSeleccionado.calificacion_cumplimiento || 5,
                                observaciones_negociacion: provSeleccionado.observaciones_negociacion || '',
                                proveedor_preferencial: Boolean(provSeleccionado.proveedor_preferencial),
                                monto_limite_credito: Number(provSeleccionado.monto_limite_credito || provSeleccionado.limite_credito || 0),
                                limite_credito: Number(provSeleccionado.monto_limite_credito || provSeleccionado.limite_credito || 0),
                                dias_credito: Number(provSeleccionado.dias_credito || provSeleccionado.dias_credito_habituales || 0),
                                dias_credito_habituales: Number(provSeleccionado.dias_credito || provSeleccionado.dias_credito_habituales || 0)
                              };
                              await ejecutarOperacionSegura(true, provSeleccionado.id, srmPayload);
                              toast.success("Evaluación SRM y Acuerdos guardados con éxito.");
                              await obtenerProveedores();
                            } catch (err) {
                              toast.error(err.message || "Error al guardar evaluación SRM.");
                            } finally {
                              setGuardandoSrmProv(false);
                            }
                          }}
                          style={{
                            padding: '10px 24px',
                            backgroundColor: '#0f172a',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '0.85rem',
                            fontWeight: '800',
                            cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(15, 23, 42, 0.2)'
                          }}
                        >
                          {guardandoSrmProv ? 'Guardando...' : '💾 Guardar Evaluación SRM'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="prov-modal-footer" style={{ borderTop: '1px solid #e2e8f0', marginTop: '20px', paddingTop: '15px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(false)}
                  className="btn-cancel"
                  style={{ padding: '8px 20px', fontSize: '0.8rem', fontWeight: 'bold' }}
                >
                  Cerrar Ficha
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Proveedores;