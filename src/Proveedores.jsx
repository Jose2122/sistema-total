import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { Loader2, Plus, Search, Mail, Phone, MapPin, XCircle, Edit, Trash2, ShoppingBag, FileSpreadsheet, Users, BarChart3, TrendingUp, DollarSign, Package, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import './Proveedores.css';

const LISTA_CATEGORIAS = [
  "SERVICIO", "REPUESTO", "ALIMENTACIÓN", "TECNOLOGÍA", "PAPELERÍA", 
  "LIMPIEZA", "MANTENIMIENTO", "FERRETERÍA", "CONSUMIBLE", "EQUIPO",
  "TRANSPORTE", "OTROS"
];

const Proveedores = () => {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  const [saving, setSaving] = useState(false);
  const [sessionCategories, setSessionCategories] = useState([]);
  const [nuevaCategoriaText, setNuevaCategoriaText] = useState('');

  const [formData, setFormData] = useState({
    id: null,
    rif: '',
    razon_social: '',
    correo: '',
    telefono: '',
    direccion: '',
    categoria: [], // Cambiado a array
    status: true
  });

  const [historialCompras, setHistorialCompras] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [provSeleccionado, setProvSeleccionado] = useState(null);

  const [tabActiva, setTabActiva] = useState('directorio');
  const [todasLasCompras, setTodasLasCompras] = useState([]);
  const [rankingProveedores, setRankingProveedores] = useState([]);
  const [loadingReportes, setLoadingReportes] = useState(false);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'totalGastado', direction: 'descending' });

  useEffect(() => {
    obtenerProveedores();
  }, []);

  const obtenerProveedores = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('proveedores')
        .select('*')
        .order('razon_social', { ascending: true });

      if (error) throw error;
      setProveedores(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error.message);
      toast.error('Error al cargar proveedores. Asegúrate de haber ejecutado el SQL de la tabla.');
    } finally {
      setLoading(false);
    }
  };

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

    if (!formData.razon_social) {
      return toast.error('La Razón Social es obligatoria');
    }

    setSaving(true);
    try {
      if (formData.id) {
        const { error } = await supabase
          .from('proveedores')
          .update({
            rif: formData.rif,
            razon_social: formData.razon_social,
            correo: formData.correo,
            telefono: formData.telefono,
            direccion: formData.direccion,
            categoria: Array.isArray(formData.categoria) ? formData.categoria.join(', ') : formData.categoria,
            status: formData.status
          })
          .eq('id', formData.id);
        if (error) throw error;
        toast.success('Proveedor actualizado con éxito');
      } else {
        const { error } = await supabase
          .from('proveedores')
          .insert([{
            rif: formData.rif,
            razon_social: formData.razon_social,
            correo: formData.correo,
            telefono: formData.telefono,
            direccion: formData.direccion,
            categoria: Array.isArray(formData.categoria) ? formData.categoria.join(', ') : formData.categoria,
            status: formData.status
          }]);
        if (error) throw error;
        toast.success('Proveedor registrado con éxito');
      }
      setShowModal(false);
      resetForm();
      obtenerProveedores();
    } catch (error) {
      toast.error('Error al guardar: ' + error.message);
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
      const { error } = await supabase.from('proveedores').delete().eq('id', id);
      if (error) throw error;
      toast.success('Proveedor eliminado');
      obtenerProveedores();
    } catch (error) {
      toast.error('Error al eliminar: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      id: null,
      rif: '',
      razon_social: '',
      correo: '',
      telefono: '',
      direccion: '',
      categoria: [],
      status: true
    });
    setNuevaCategoriaText('');
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

  const cargarHistorialCompras = async (p) => {
    setProvSeleccionado(p);
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
            const matchesId = h.proveedor_id === p.id;
            const matchesName = h.proveedor_nombre && h.proveedor_nombre.trim().toLowerCase() === p.razon_social.trim().toLowerCase();
            
            if (matchesId || matchesName) {
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

      const agrupado = {};
      comprasConsolidadas.forEach(c => {
        const key = c.proveedor_id || c.proveedor_nombre.trim().toUpperCase();
        if (!agrupado[key]) {
          agrupado[key] = {
            id: c.proveedor_id,
            nombre: c.proveedor_nombre,
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
        const provOriginal = proveedores.find(p => p.id === agg.id || p.razon_social.trim().toUpperCase() === agg.nombre.trim().toUpperCase());
        return {
          id: agg.id || (provOriginal ? provOriginal.id : null),
          rif: provOriginal ? provOriginal.rif : 'N/A',
          razon_social: provOriginal ? provOriginal.razon_social : agg.nombre,
          categoria: provOriginal ? provOriginal.categoria : 'OTROS',
          comprasCount: agg.comprasCount,
          unidadesCompradas: agg.unidadesCompradas,
          totalGastado: agg.totalGastado,
          promedioCompra: agg.totalGastado / agg.comprasCount
        };
      });

      rankingList.sort((a, b) => b.totalGastado - a.totalGastado);
      setRankingProveedores(rankingList);
    } catch (err) {
      console.error("Error cargando reportes:", err);
      toast.error("Error al cargar reportes: " + err.message);
    } finally {
      setLoadingReportes(false);
    }
  };

  const exportRankingToExcel = async () => {
    if (rankingProveedores.length === 0) {
      toast.error("No hay datos de ranking para exportar.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ranking Proveedores');

    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'TOTAL CLEAN C.A. - RANKING GENERAL DE PROVEEDORES';
    titleCell.font = { name: 'Arial Black', size: 12, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 40;

    const headers = [
      'RIF',
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
      const row = worksheet.addRow([
        p.rif,
        p.razon_social,
        p.categoria,
        p.comprasCount,
        p.unidadesCompradas,
        p.totalGastado,
        p.promedioCompra
      ]);

      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'right' };
      row.getCell(5).alignment = { horizontal: 'right' };
      row.getCell(6).alignment = { horizontal: 'right' };
      row.getCell(7).alignment = { horizontal: 'right' };

      row.getCell(6).numFmt = '"$"#,##0.00';
      row.getCell(7).numFmt = '"$"#,##0.00';

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
    return todasLasCompras.filter(c => 
      c.descripcion.toLowerCase().includes(busquedaProducto.toLowerCase())
    );
  }, [busquedaProducto, todasLasCompras]);

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
    if (historialCompras.length === 0) {
      toast.error("No hay compras registradas para este proveedor.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Historial Compras');

    // Title Row
    worksheet.mergeCells('A1:J1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `TOTAL CLEAN C.A. - HISTORIAL DE COMPRAS: ${p.razon_social}`;
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

    historialCompras.forEach(c => {
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

    const lastRowNum = historialCompras.length + 3;
    worksheet.mergeCells(`A${lastRowNum}:E${lastRowNum}`);
    const totalLabel = worksheet.getCell(`A${lastRowNum}`);
    totalLabel.value = 'TOTAL GASTADO ($):';
    totalLabel.font = { bold: true };
    totalLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    const totalVal = worksheet.getCell(`F${lastRowNum}`);
    const totalSpent = historialCompras.reduce((sum, c) => sum + c.total, 0);
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
    setFormData({
        ...p,
        categoria: p.categoria ? p.categoria.split(', ').filter(c => c) : []
    });
    setShowModal(true);
  };

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

  const proveedoresFiltrados = proveedores.filter(p => {
    const matchTexto = p.razon_social?.toLowerCase().includes(busqueda.toLowerCase()) ||
                       p.rif?.toLowerCase().includes(busqueda.toLowerCase());
    
    const pCats = p.categoria ? p.categoria.split(', ').filter(c => c) : [];
    const matchCat = filtroCategoria === 'Todos' || pCats.includes(filtroCategoria);
    
    return matchTexto && matchCat;
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
            {/* Buscador */}
            <div className="prov-search-wrapper">
              <Search className="prov-search-icon" size={20} />
              <input 
                type="text"
                placeholder="Buscar por RIF o Razón Social..."
                className="prov-search-input"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              <select 
                className="prov-cat-select"
                style={{ 
                  padding: '10px 15px', 
                  borderRadius: '12px', 
                  border: '1px solid #e2e8f0', 
                  marginLeft: '15px',
                  fontSize: '0.85rem',
                  color: '#475569',
                  fontWeight: '600',
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
            </div>

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
                  <th>CONTACTO</th>
                  <th>DIRECCIÓN</th>
                  <th style={{ textAlign: 'center', width: '100px' }}>ESTADO</th>
                  <th style={{ textAlign: 'center', width: '100px' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {proveedoresFiltrados.map((p) => (
                  <tr key={p.id}>
                    <td className="rif-cell">{p.rif}</td>
                    <td className="name-cell">{p.razon_social}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {p.categoria ? p.categoria.split(', ').map((cat, i) => (
                          <span key={i} style={{ backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '6px', fontSize: '0.6rem', fontWeight: '800', color: '#475569', border: '1px solid #e2e8f0' }}>
                            {cat}
                          </span>
                        )) : <span style={{ color: '#cbd5e1' }}>-</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {p.correo && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#475569', fontWeight: '500' }}><Mail size={12} style={{ color: '#3b82f6' }} /> {p.correo}</div>}
                        {p.telefono && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#475569', fontWeight: '500' }}><Phone size={12} style={{ color: '#f97316' }} /> {p.telefono}</div>}
                        {(!p.correo && !p.telefono) && <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.7rem' }}>Sin datos</span>}
                      </div>
                    </td>
                    <td style={{ maxWidth: '250px' }}>
                      {p.direccion ? (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>
                          <MapPin size={12} style={{ color: '#94a3b8', marginTop: '2px', flexShrink: 0 }} /> 
                          <span>{p.direccion}</span>
                        </div>
                      ) : (
                        <span style={{ fontStyle: 'italic', color: '#cbd5e1', fontSize: '0.75rem' }}>No registrada</span>
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
                        <button onClick={() => handleEdit(p)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '5px', transition: 'transform 0.2s' }} title="Editar" className="action-hover">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => eliminarProveedor(p.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '5px', transition: 'transform 0.2s' }} title="Eliminar" className="action-hover">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {proveedoresFiltrados.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8', background: 'white' }}>
                <Search size={32} style={{ marginBottom: '15px', opacity: 0.2 }} />
                <p style={{ margin: 0, fontWeight: '600', fontSize: '0.9rem' }}>No se encontraron proveedores activos con ese criterio.</p>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }} className="animate-fade">
            {/* KPI Cards */}
            <div className="prov-analytics-grid">
              <div className="prov-analytic-card" style={{ borderLeftColor: '#1e3a8a' }}>
                <div className="prov-card-header">
                  <span className="prov-card-title">Gasto Total Acumulado</span>
                  <DollarSign className="prov-card-icon" size={20} style={{ color: '#1e3a8a' }} />
                </div>
                <div className="prov-card-value">
                  $ {rankingProveedores.reduce((sum, p) => sum + p.totalGastado, 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </div>
                <div className="prov-card-desc">En requisiciones aprobadas</div>
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

              <div className="prov-analytic-card" style={{ borderLeftColor: '#f59e0b' }}>
                <div className="prov-card-header">
                  <span className="prov-card-title">Total Transacciones</span>
                  <Package className="prov-card-icon" size={20} style={{ color: '#f59e0b' }} />
                </div>
                <div className="prov-card-value">
                  {todasLasCompras.length} compras
                </div>
                <div className="prov-card-desc">Artículos individuales procesados</div>
              </div>
            </div>

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
                      rankingOrdenado.map((p, idx) => (
                        <tr key={idx}>
                          <td className="rif-cell">{p.rif}</td>
                          <td className="name-cell">{p.razon_social}</td>
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
                      ))
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
              <div className="prov-modal-header">
                <h2 className="prov-modal-title">
                  {formData.id ? 'Editar Proveedor' : 'Agregar Proveedor'}
                </h2>
                <button onClick={() => setShowModal(false)} className="prov-modal-close">
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={guardarProveedor} className="prov-form prov-form-grid">
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
                    <label className="prov-label">Correo  (OPCIONAL)</label>
                    <input 
                      type="email"
                      className="prov-input"
                      placeholder="ejemplo@empresa.com"
                      value={formData.correo}
                      onChange={e => setFormData({...formData, correo: e.target.value})}
                    />
                  </div>
                  <div className="prov-field">
                    <label className="prov-label">Teléfono (OPCIONAL)</label>
                    <input 
                      className="prov-input"
                      placeholder="0414-XXXXXXX"
                      value={formData.telefono}
                      onChange={e => setFormData({...formData, telefono: e.target.value})}
                    />
                  </div>

                <div className="prov-field prov-form-full">
                  <label className="prov-label">Dirección</label>
                  <textarea 
                    className="prov-input prov-textarea"
                    placeholder="Dirección fiscal completa..."
                    value={formData.direccion}
                    onChange={e => setFormData({...formData, direccion: e.target.value})}
                  />
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

        {/* Modal Historial de Compras */}
        {showHistoryModal && provSeleccionado && (
          <div className="prov-modal-overlay" style={{ zIndex: 1000 }}>
            <div className="prov-modal" style={{ maxWidth: '950px', width: '90%' }}>
              <div className="prov-modal-header" style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '15px' }}>
                <div>
                  <h2 className="prov-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                    <ShoppingBag size={24} style={{ color: '#0ea5e9' }} />
                    Historial de Adquisiciones
                  </h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>
                    Proveedor: <strong style={{ color: '#1e293b' }}>{provSeleccionado.razon_social}</strong> | RIF: {provSeleccionado.rif}
                  </p>
                </div>
                <button onClick={() => setShowHistoryModal(false)} className="prov-modal-close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', transition: 'color 0.2s' }}>
                  <XCircle size={24} />
                </button>
              </div>

              {loadingHistorial ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '50px 0', gap: '15px' }}>
                  <Loader2 className="animate-spin" size={32} style={{ color: '#0ea5e9' }} />
                  <p style={{ color: '#64748b', fontWeight: 'bold', fontSize: '0.85rem', textTransform: 'uppercase' }}>Cargando transacciones...</p>
                </div>
              ) : (
                <div style={{ marginTop: '20px' }}>
                  {/* KPI Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', borderLeft: '4px solid #0ea5e9', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>Total Facturado</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#0f172a', marginTop: '4px' }}>
                        $ {historialCompras.reduce((sum, c) => sum + c.total, 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', borderLeft: '4px solid #16a34a', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>Cantidad de Compras</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#0f172a', marginTop: '4px' }}>
                        {historialCompras.length} transacciones
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', borderLeft: '4px solid #f59e0b', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>Items Adquiridos</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#0f172a', marginTop: '4px' }}>
                        {historialCompras.reduce((sum, c) => sum + c.cantidad, 0)} unidades
                      </div>
                    </div>
                  </div>

                  {/* Acciones de exportación */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
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
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(22,163,74,0.15)',
                        transition: 'all 0.2s'
                      }}
                    >
                      <FileSpreadsheet size={14} />
                      Exportar Historial
                    </button>
                  </div>

                  {/* Tabla de Historial */}
                  <div style={{ overflowY: 'auto', maxHeight: '350px', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#1e293b', color: '#f8fafc', position: 'sticky', top: 0 }}>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>FECHA</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>REQUISICIÓN</th>
                          <th style={{ padding: '10px 12px' }}>DESCRIPCIÓN</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>CANTIDAD</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>P. UNITARIO</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>TOTAL</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>FACTURA</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>MÉTODO PAGO</th>
                          <th style={{ padding: '10px 12px' }}>SOLICITANTE / GERENCIA</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>SOPORTE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historialCompras.length === 0 ? (
                          <tr>
                            <td colSpan="10" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontWeight: 'bold' }}>
                              No se registran compras para este proveedor en requisiciones finalizadas.
                            </td>
                          </tr>
                        ) : (
                          historialCompras.map((c, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '10px 12px', textAlign: 'center', color: '#475569', fontWeight: '500' }}>
                                {c.fecha !== '—' ? c.fecha.split('-').reverse().join('/') : '—'}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 'bold', color: '#1e40af' }}>{c.requisicion}</td>
                              <td style={{ padding: '10px 12px', color: '#0f172a', fontWeight: '600' }}>{c.descripcion}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold' }}>{c.cantidad}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>$ {c.pu.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '800', color: '#16a34a' }}>$ {c.total.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#2563eb' }}>{c.factura}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>{c.metodoPago}</td>
                              <td style={{ padding: '10px 12px' }}>
                                <div style={{ fontWeight: '500', color: '#1e293b' }}>{c.solicitante}</div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{c.gerencia}</div>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                {c.facturaUrl ? (
                                  <a
                                    href={c.facturaUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      display: 'inline-block',
                                      padding: '4px 8px',
                                      backgroundColor: '#eff6ff',
                                      color: '#2563eb',
                                      borderRadius: '6px',
                                      fontWeight: 'bold',
                                      fontSize: '0.7rem',
                                      textDecoration: 'none',
                                      border: '1px solid #bfdbfe'
                                    }}
                                  >
                                    Ver 📄
                                  </a>
                                ) : (
                                  <span style={{ color: '#cbd5e1', fontSize: '0.7rem' }}>S/S</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="prov-modal-footer" style={{ borderTop: '1px solid #e2e8f0', marginTop: '20px', paddingTop: '15px' }}>
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(false)}
                  className="btn-cancel"
                  style={{ padding: '8px 20px', fontSize: '0.8rem', fontWeight: 'bold' }}
                >
                  Cerrar Historial
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