import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import { 
  Search, FileText, Loader2, FileSpreadsheet, Trash2, ShieldAlert
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const UBICACIONES_AUTORIZADAS = [
  "Almacén Maracaibo",
  "Almacén Campo Boscán",
  "Almacén Bajo Grande"
];

const cleanAccents = (str) => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};


const Almacen = () => {
  const [comprasRaw, setComprasRaw] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroAlmacen, setFiltroAlmacen] = useState('Todos'); // 'Todos', 'Si', 'No'
  const [filtroDestino, setFiltroDestino] = useState('Todos'); // 'Todos', 'Almacen Campo Boscan', 'Almacen Maracaibo', 'Almacen Bajo Grande'
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [vistaTab, setVistaTab] = useState('todos'); // 'todos', 'recibidos', 'pendientes'
  
  // Para llevar el control de qué almacén se selecciona para cada compra antes de recibir
  const [selectedAlmacenes, setSelectedAlmacenes] = useState({}); // { [compraId]: 'Almacen ...' }
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const formatFecha = (fechaStr) => {
    if (!fechaStr) return '—';
    try {
      const d = new Date(fechaStr);
      if (isNaN(d.getTime())) return '—';
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const anio = d.getFullYear();
      return `${dia}/${mes}/${anio}`;
    } catch {
      return '—';
    }
  };

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Cargar Requisiciones Aprobadas con Ítems (donde reside la data de compra)
      const { data: reqs, error: errC } = await supabase
        .from('requisiciones')
        .select('*')
        .eq('estado_aprobacion', 'aprobado_final')
        .order('fecha_emision', { ascending: false });

      if (errC) throw errC;

      // 2. Mapear compras completadas (del historial de compras o del ítem legado)
      let list = [];
      (reqs || []).forEach(r => {
        const items = Array.isArray(r.items) ? r.items : [];
        items.forEach((it, itIdx) => {
          const historial = Array.isArray(it.historial_compras) ? it.historial_compras : [];
          const compras = historial.filter(h => h.tipo !== 'JUSTIFICACION' && h.tipo !== 'ANULACION');
          
          if (compras.length > 0) {
            // Formato multitransacción: cada transacción en el historial es una compra
            compras.forEach((h) => {
              const statusAlmacen = h.estatus_almacen || (h.enviado_almacen ? 'Ubicado' : 'Pendiente_Compras');
              // Only load items that are ready for or already classified in the warehouse
              if (statusAlmacen === 'Por_Clasificar_Almacen' || statusAlmacen === 'Ubicado') {
                // Buscar índice real en el historial de compras original
                const realHIdx = it.historial_compras.findIndex(itemH => itemH === h);
                list.push({
                  id: `${r.id}-${itIdx}-${realHIdx}`,
                  transaction_id: h.id || `${r.id}-${itIdx}-${realHIdx}`,
                  req_id: r.id,
                  correlativo: r.correlativo_req || `REQ-${String(r.id).padStart(3, '0')}`,
                  item_idx: itIdx,
                  history_idx: realHIdx,
                  is_legacy: false,
                  
                  descripcion: it.descripcion || 'Sin descripción',
                  proveedor: h.proveedor_nombre || 'Desconocido',
                  numero_factura: h.doc_numero || 'S/N',
                  fecha_compra: h.fecha,
                  solicitante: r.solicitante || 'N/A',
                  gerencia: r.gerencia || 'No asignada',
                  centro_costo: r.centro_costo || 'N/A',
                  moneda_pago: h.metodo_pago || '$ / BS',
                  cantidad_comprada: parseFloat(h.cant) || 0,
                  precio_unitario: parseFloat(h.pu) || 0,
                  total: (parseFloat(h.cant) || 0) * (parseFloat(h.pu) || 0),
                  
                  recibido: statusAlmacen === 'Ubicado',
                  estatus_almacen: statusAlmacen,
                  ubicacion_almacen: h.ubicacion_almacen || h.almacen_destino || '',
                  fecha_entrada_almacen: h.fecha_entrada_almacen || ''
                });
              }
            });
          } else if (it.doc_numero || it.numero_factura) {
            // Formato legado: el ítem mismo es una compra única
            const statusAlmacen = it.estatus_almacen || (it.enviado_almacen ? 'Ubicado' : 'Pendiente_Compras');
            if (statusAlmacen === 'Por_Clasificar_Almacen' || statusAlmacen === 'Ubicado') {
              list.push({
                id: `${r.id}-${itIdx}-legacy`,
                transaction_id: `${r.id}-${itIdx}-legacy`,
                req_id: r.id,
                correlativo: r.correlativo_req || `REQ-${String(r.id).padStart(3, '0')}`,
                item_idx: itIdx,
                history_idx: -1,
                is_legacy: true,
                
                descripcion: it.descripcion || 'Sin descripción',
                proveedor: it.proveedor || 'Desconocido',
                numero_factura: it.doc_numero || it.numero_factura || 'S/N',
                fecha_compra: r.fecha_emision || r.created_at,
                solicitante: r.solicitante || 'N/A',
                gerencia: r.gerencia || 'No asignada',
                centro_costo: r.centro_costo || 'N/A',
                moneda_pago: it.metodo_pago || '$ / BS',
                cantidad_comprada: parseFloat(it.cantidad_comprada || it.cant) || 0,
                precio_unitario: parseFloat(it.pu) || 0,
                total: (parseFloat(it.cantidad_comprada || it.cant) || 0) * (parseFloat(it.pu) || 0),
                
                recibido: statusAlmacen === 'Ubicado',
                estatus_almacen: statusAlmacen,
                ubicacion_almacen: it.ubicacion_almacen || it.almacen_destino || '',
                fecha_entrada_almacen: it.fecha_entrada_almacen || ''
              });
            }
          }
        });
      });

      setComprasRaw(list);
    } catch (err) {
      console.error("Error Almacen:", err);
      toast.error("Error al cargar compras: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();

    // SUSCRIPCIÓN REALTIME PARA ALMACÉN
    const channel = supabase
      .channel('almacen_realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'requisiciones'
      }, (payload) => {
        cargarDatos();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'requisiciones'
      }, (payload) => {
        cargarDatos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cargarDatos]);

  // Filtrado de las compras
  const filteredCompras = useMemo(() => {
    return comprasRaw.filter(c => {
      // Filtro por pestaña (todos, recibidos, pendientes)
      if (vistaTab === 'recibidos' && !c.recibido) return false;
      if (vistaTab === 'pendientes' && c.recibido) return false;

      const matchBusqueda = 
        c.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.proveedor.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.numero_factura.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.solicitante.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.centro_costo.toLowerCase().includes(busqueda.toLowerCase());

      const matchAlmacen = 
        filtroAlmacen === 'Todos' ||
        (filtroAlmacen === 'Si' ? c.recibido : !c.recibido);

      const matchDestino = 
        filtroDestino === 'Todos' ||
        (c.ubicacion_almacen && cleanAccents(c.ubicacion_almacen).includes(cleanAccents(filtroDestino)));

      let matchFecha = true;
      const fPago = c.fecha_entrada_almacen ? c.fecha_entrada_almacen.split('T')[0] : '';
      if (fechaDesde && fPago < fechaDesde) matchFecha = false;
      if (fechaHasta && fPago > fechaHasta) matchFecha = false;

      return matchBusqueda && matchAlmacen && matchDestino && matchFecha;
    });
  }, [comprasRaw, busqueda, filtroAlmacen, filtroDestino, fechaDesde, fechaHasta, vistaTab]);

  // Totales
  const totalGeneralFiltrado = useMemo(() => {
    return filteredCompras.reduce((sum, c) => sum + (c.total || 0), 0);
  }, [filteredCompras]);

  const stats = useMemo(() => {
    const total = comprasRaw.length;
    const recibidos = comprasRaw.filter(c => c.recibido).length;
    const pendientes = total - recibidos;
    const boscan = comprasRaw.filter(c => c.ubicacion_almacen && cleanAccents(c.ubicacion_almacen).includes('boscan')).length;
    const maracaibo = comprasRaw.filter(c => c.ubicacion_almacen && cleanAccents(c.ubicacion_almacen).includes('maracaibo')).length;
    const bajoGrande = comprasRaw.filter(c => c.ubicacion_almacen && cleanAccents(c.ubicacion_almacen).includes('grande')).length;

    return { total, recibidos, pendientes, boscan, maracaibo, bajoGrande };
  }, [comprasRaw]);

  const handleRecibir = async (compra) => {
    const destinoSel = selectedAlmacenes[compra.id];
    if (!destinoSel) {
      toast.error("Por favor, seleccione un almacén de destino antes de recibir.");
      return;
    }

    setLoading(true);
    try {
      const { data: req, error: fetchErr } = await supabase
        .from('requisiciones')
        .select('items')
        .eq('id', compra.req_id)
        .single();
      
      if (fetchErr) throw fetchErr;
      
      const items = [...(req.items || [])];
      const item = items[compra.item_idx];
      if (!item) throw new Error("Material no encontrado.");

      const nowIso = new Date().toISOString();

      if (compra.is_legacy) {
        item.estatus_almacen = 'Ubicado';
        item.ubicacion_almacen = destinoSel;
        item.enviado_almacen = true;
        item.almacen_destino = destinoSel;
        item.fecha_entrada_almacen = nowIso;
      } else {
        const hist = [...(item.historial_compras || [])];
        if (hist[compra.history_idx]) {
          hist[compra.history_idx] = {
            ...hist[compra.history_idx],
            estatus_almacen: 'Ubicado',
            ubicacion_almacen: destinoSel,
            enviado_almacen: true,
            almacen_destino: destinoSel,
            fecha_entrada_almacen: nowIso
          };
          item.historial_compras = hist;
          // Si todos los ítems válidos fueron procesados a almacén
          const valid = hist.filter(h => h.tipo !== 'JUSTIFICACION' && h.tipo !== 'ANULACION');
          const allLocated = valid.every(c => c.estatus_almacen === 'Ubicado' || c.enviado_almacen === true);
          item.estatus_almacen = allLocated ? 'Ubicado' : 'Por_Clasificar_Almacen';
          item.ubicacion_almacen = destinoSel;
          item.enviado_almacen = allLocated;
          item.almacen_destino = destinoSel;
          item.fecha_entrada_almacen = nowIso;
        } else {
          throw new Error("Transacción no encontrada.");
        }
      }

      items[compra.item_idx] = item;

      const { error: updateErr } = await supabase
        .from('requisiciones')
        .update({ items })
        .eq('id', compra.req_id);
      
      if (updateErr) throw updateErr;

      toast.success("Ingreso registrado exitosamente.");

      // Notificaciones entre almacenes
      try {
        const { data: perfilesAlmacen } = await supabase
          .from('perfiles')
          .select('id')
          .or("departamento.ilike.%almacen%,rol.ilike.%almacen%");
        
        const { data: userData } = await supabase.auth.getUser();
        const currentUserId = userData?.user?.id;
        
        if (perfilesAlmacen && perfilesAlmacen.length > 0) {
          const notifs = perfilesAlmacen
            .filter(p => p.id !== currentUserId)
            .map(p => ({
              usuario_id: p.id,
              mensaje: `El material de Requisición ${compra.correlativo} (${compra.descripcion.substring(0, 30)}...) fue recibido en: ${destinoSel}`,
              tipo: 'Almacén',
              leido: false,
              requisicion_id: compra.req_id
            }));
          
          if (notifs.length > 0) {
            await supabase.from('notificaciones').insert(notifs);
          }
        }
      } catch (notifErr) {
        console.error("Error al notificar al personal de almacén:", notifErr);
      }

      setSelectedAlmacenes(prev => {
        const copy = { ...prev };
        delete copy[compra.id];
        return copy;
      });
      cargarDatos();
    } catch (err) {
      console.error(err);
      toast.error("Error al recibir: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeshacer = async (compra) => {
    setLoading(true);
    try {
      const { data: req, error: fetchErr } = await supabase
        .from('requisiciones')
        .select('items')
        .eq('id', compra.req_id)
        .single();
      
      if (fetchErr) throw fetchErr;
      
      const items = [...(req.items || [])];
      const item = items[compra.item_idx];
      if (!item) throw new Error("Material no encontrado.");

      if (compra.is_legacy) {
        item.estatus_almacen = 'Por_Clasificar_Almacen';
        item.ubicacion_almacen = null;
        item.enviado_almacen = false;
        item.almacen_destino = null;
        item.fecha_entrada_almacen = null;
      } else {
        const hist = [...(item.historial_compras || [])];
        if (hist[compra.history_idx]) {
          hist[compra.history_idx] = {
            ...hist[compra.history_idx],
            estatus_almacen: 'Por_Clasificar_Almacen',
            ubicacion_almacen: null,
            enviado_almacen: false,
            almacen_destino: null,
            fecha_entrada_almacen: null
          };
          item.historial_compras = hist;
          item.estatus_almacen = 'Por_Clasificar_Almacen';
          item.ubicacion_almacen = null;
          item.enviado_almacen = false;
          item.almacen_destino = null;
          item.fecha_entrada_almacen = null;
        } else {
          throw new Error("Transacción no encontrada.");
        }
      }

      items[compra.item_idx] = item;

      const { error: updateErr } = await supabase
        .from('requisiciones')
        .update({ items })
        .eq('id', compra.req_id);
      
      if (updateErr) throw updateErr;

      toast.success("Recepción revertida exitosamente.");
      cargarDatos();
    } catch (err) {
      console.error(err);
      toast.error("Error al deshacer: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Exportar Excel
  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte Almacén');

    // Title Row
    worksheet.mergeCells('A1:L1');
    const titleCell = worksheet.getCell('A1');
    const titleValStr = vistaTab === 'todos' 
      ? 'TOTAL CLEAN C.A. - REPORTE DE COMPRAS COMPLETADAS'
      : vistaTab === 'recibidos'
        ? 'TOTAL CLEAN C.A. - REPORTE DE COMPRAS INGRESADAS A ALMACÉN'
        : 'TOTAL CLEAN C.A. - REPORTE DE COMPRAS PENDIENTES EN ALMACÉN';
    titleCell.value = titleValStr;
    titleCell.font = { name: 'Arial Black', size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } }; // Green header
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 40;

    const headers = [
      'ALMACÉN',
      'REQUISICIÓN',
      'DESCRIPCIÓN',
      'PROVEEDOR',
      'NRO DE FACTURA',
      'A ENTRADA ALM.',
      'ALMACÉN DESTINO',
      'SOLICITANTE',
      'GERENCIA',
      'CENTRO DE COSTO',
      'MONEDA DE PAGO',
      'CANTIDAD COMPRADA',
      'TOTAL ($)'
    ];
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(2);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 25;

    filteredCompras.forEach(c => {
      const row = worksheet.addRow([
        c.recibido ? 'SÍ' : 'NO',
        c.correlativo,
        c.descripcion,
        c.proveedor,
        c.numero_factura,
        c.fecha_entrada_almacen ? formatFecha(c.fecha_entrada_almacen) : '—',
        c.ubicacion_almacen || 'PENDIENTE',
        c.solicitante,
        c.gerencia,
        c.centro_costo,
        c.moneda_pago,
        c.cantidad_comprada,
        c.total
      ]);

      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(5).alignment = { horizontal: 'center' };
      row.getCell(6).alignment = { horizontal: 'center' };
      row.getCell(7).alignment = { horizontal: 'center' };
      row.getCell(11).alignment = { horizontal: 'center' };
      row.getCell(12).alignment = { horizontal: 'right' };
      row.getCell(13).alignment = { horizontal: 'right' };

      row.getCell(13).numFmt = '"$"#,##0.00;[Red]"$"#,##0.00';

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
      { width: 12 }, // ALMACÉN
      { width: 18 }, // REQUISICIÓN
      { width: 35 }, // DESCRIPCIÓN
      { width: 25 }, // PROVEEDOR
      { width: 18 }, // NRO DE FACTURA
      { width: 15 }, // A ENTRADA ALM.
      { width: 25 }, // ALMACÉN DESTINO
      { width: 22 }, // SOLICITANTE
      { width: 22 }, // GERENCIA
      { width: 25 }, // CENTRO DE COSTO
      { width: 18 }, // MONEDA DE PAGO
      { width: 22 }, // CANTIDAD COMPRADA
      { width: 18 }  // TOTAL ($)
    ];

    const lastRowNum = filteredCompras.length + 3;
    worksheet.mergeCells(`A${lastRowNum}:L${lastRowNum}`);
    const totalLabel = worksheet.getCell(`A${lastRowNum}`);
    totalLabel.value = 'TOTAL GENERAL COMPLETADO ($):';
    totalLabel.font = { bold: true };
    totalLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    const totalVal = worksheet.getCell(`M${lastRowNum}`);
    totalVal.value = totalGeneralFiltrado;
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
    saveAs(new Blob([buffer]), `Reporte_Almacen_TC_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Archivo Excel exportado con éxito.");
  };

  // Exportar PDF
  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFillColor(22, 163, 74); // Vibrant Green background
    doc.rect(0, 0, 297, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    
    const titleValStr = vistaTab === 'todos' 
      ? 'TOTAL CLEAN C.A. - REPORTE DE COMPRAS COMPLETADAS'
      : vistaTab === 'recibidos'
        ? 'TOTAL CLEAN C.A. - REPORTE DE COMPRAS INGRESADAS A ALMACÉN'
        : 'TOTAL CLEAN C.A. - REPORTE DE COMPRAS PENDIENTES EN ALMACÉN';
        
    doc.text(titleValStr, 15, 17);
    doc.setFontSize(9);
    doc.text(`Generado: ${new Date().toLocaleString()}`, 240, 17);

    const tableData = filteredCompras.map(c => [
      c.recibido ? 'SÍ' : 'NO',
      c.correlativo,
      c.descripcion.substring(0, 30),
      c.proveedor.substring(0, 15),
      c.numero_factura,
      c.fecha_entrada_almacen ? formatFecha(c.fecha_entrada_almacen) : '—',
      c.ubicacion_almacen || 'PENDIENTE',
      c.solicitante.substring(0, 12),
      c.gerencia.substring(0, 12),
      c.centro_costo.substring(0, 12),
      c.moneda_pago,
      c.cantidad_comprada,
      `$ ${(c.total || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      head: [['ALM', 'REQUISICIÓN', 'DESCRIPCIÓN', 'PROVEEDOR', 'FACTURA', 'FECHA ALM', 'ALM. DESTINO', 'SOLICITANTE', 'GERENCIA', 'C. COSTO', 'MONEDA', 'CANT', 'TOTAL ($)']],
      body: tableData,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], fontSize: 6.5, halign: 'center' },
      styles: { fontSize: 6, cellPadding: 1 },
      columnStyles: {
        0: { halign: 'center' },
        1: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'center' },
        10: { halign: 'center' },
        11: { halign: 'right' },
        12: { halign: 'right', fontStyle: 'bold' }
      },
      foot: [['', '', '', '', '', '', '', '', '', '', 'TOTAL GRAL.', '', `$ ${(totalGeneralFiltrado || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`]],
      footStyles: { fillColor: [240, 253, 244], textColor: [22, 163, 74], fontStyle: 'bold' }
    });

    doc.save(`Reporte_Compras_Completadas_TC_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success("Documento PDF exportado con éxito.");
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f8fafc', minHeight: '100vh', color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>
      
      {/* HEADER PRINCIPAL */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '20px', marginBottom: '30px' }}>
        <div style={{ borderLeft: '6px solid #16a34a', paddingLeft: '16px' }}>
          <h1 style={{ margin: 0, color: '#0f172a', fontSize: '1.8rem', fontWeight: '900', letterSpacing: '-0.5px' }}>
            Reportes e Ingresos de Almacén
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem', fontWeight: '500' }}>
            Visualización y control de recepción física de materiales comprados
          </p>
        </div>

        {/* ACCIONES EXPORTACIÓN */}
        <div style={{ display: 'flex', gap: '10px', width: isMobile ? '100%' : 'auto' }}>
          <button onClick={exportToExcel} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 18px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.2)' }}>
            <FileSpreadsheet size={16} /> Excel Reporte
          </button>
          <button onClick={exportToPDF} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 18px', backgroundColor: '#334155', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}>
            <FileText size={16} /> PDF Cierre
          </button>
        </div>
      </div>

      {/* TARJETAS ESTADÍSTICAS KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(6, 1fr)', gap: '15px', marginBottom: '25px' }}>
        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '16px', borderLeft: '4px solid #3b82f6', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>Compras Totales</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#1e293b', marginTop: '5px' }}>{stats.total}</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '16px', borderLeft: '4px solid #16a34a', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.65rem', color: '#16a34a', fontWeight: '800', textTransform: 'uppercase' }}>Recibido Almacén</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#1e293b', marginTop: '5px' }}>{stats.recibidos}</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '16px', borderLeft: '4px solid #f59e0b', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.65rem', color: '#f59e0b', fontWeight: '800', textTransform: 'uppercase' }}>Pendiente por Ingresar</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#1e293b', marginTop: '5px' }}>{stats.pendientes}</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '16px', borderLeft: '4px solid #06b6d4', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.65rem', color: '#06b6d4', fontWeight: '800', textTransform: 'uppercase' }}>Campo Boscán</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#1e293b', marginTop: '5px' }}>{stats.boscan}</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '16px', borderLeft: '4px solid #8b5cf6', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.65rem', color: '#8b5cf6', fontWeight: '800', textTransform: 'uppercase' }}>Maracaibo</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#1e293b', marginTop: '5px' }}>{stats.maracaibo}</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '16px', borderLeft: '4px solid #ec4899', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.65rem', color: '#ec4899', fontWeight: '800', textTransform: 'uppercase' }}>Bajo Grande</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#1e293b', marginTop: '5px' }}>{stats.bajoGrande}</div>
        </div>
      </div>

      {/* FILTROS E BUSQUEDAS */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', marginBottom: '25px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr 1fr 1fr', gap: '15px', alignItems: 'center' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Búsqueda de Compra</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Buscar descripción, factura, proveedor..." 
                value={busqueda} 
                onChange={e => setBusqueda(e.target.value)} 
                style={{ width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '0.85rem', boxSizing: 'border-box', outline: 'none' }}
              />
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Estado de Ingreso</label>
            <select 
              value={filtroAlmacen} 
              onChange={e => setFiltroAlmacen(e.target.value)} 
              style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '0.85rem', outline: 'none', backgroundColor: 'white' }}
            >
              <option value="Todos">Todos</option>
              <option value="Si">Recibido en Almacén (SÍ)</option>
              <option value="No">Pendiente de Ingreso (NO)</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Almacén Físico</label>
            <select 
              value={filtroDestino} 
              onChange={e => setFiltroDestino(e.target.value)} 
              style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '0.85rem', outline: 'none', backgroundColor: 'white' }}
            >
              <option value="Todos">Todos los Almacenes</option>
              <option value="Almacen Campo Boscan">Campo Boscán</option>
              <option value="Almacen Maracaibo">Maracaibo</option>
              <option value="Almacen Bajo Grande">Bajo Grande</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Rango de Fechas Recepción</label>
            <div style={{ display: 'flex', gap: '5px' }}>
              <input 
                type="date" 
                value={fechaDesde} 
                onChange={e => setFechaDesde(e.target.value)} 
                style={{ width: '50%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '0.8rem', outline: 'none' }}
              />
              <input 
                type="date" 
                value={fechaHasta} 
                onChange={e => setFechaHasta(e.target.value)} 
                style={{ width: '50%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '0.8rem', outline: 'none' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* TABS DE VISTA RAPIDA */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setVistaTab('todos')} 
          style={{
            padding: '10px 20px', 
            borderRadius: '12px', 
            cursor: 'pointer', 
            backgroundColor: vistaTab === 'todos' ? '#16a34a' : 'white', 
            color: vistaTab === 'todos' ? 'white' : '#64748b', 
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
            border: vistaTab === 'todos' ? '1px solid #16a34a' : '1px solid #cbd5e1',
            transition: 'all 0.2s'
          }}
        >
          Relación General
        </button>
        <button 
          onClick={() => setVistaTab('recibidos')} 
          style={{
            padding: '10px 20px', 
            borderRadius: '12px', 
            cursor: 'pointer', 
            backgroundColor: vistaTab === 'recibidos' ? '#16a34a' : 'white', 
            color: vistaTab === 'recibidos' ? 'white' : '#64748b', 
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
            border: vistaTab === 'recibidos' ? '1px solid #16a34a' : '1px solid #cbd5e1',
            transition: 'all 0.2s'
          }}
        >
          Ingresados a Almacén (SÍ) 📦
        </button>
        <button 
          onClick={() => setVistaTab('pendientes')} 
          style={{
            padding: '10px 20px', 
            borderRadius: '12px', 
            cursor: 'pointer', 
            backgroundColor: vistaTab === 'pendientes' ? '#16a34a' : 'white', 
            color: vistaTab === 'pendientes' ? 'white' : '#64748b', 
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
            border: vistaTab === 'pendientes' ? '1px solid #16a34a' : '1px solid #cbd5e1',
            transition: 'all 0.2s'
          }}
        >
          Pendientes de Ingreso (NO) 📥
        </button>
      </div>

      {/* TABLA PRINCIPAL DEL REPORTE */}
      <div style={{ backgroundColor: 'white', borderRadius: '24px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
        
        {/* ENCABECERA VERDE EXCEL-STYLE */}
        <div style={{ backgroundColor: '#16a34a', color: 'white', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '900', letterSpacing: '0.5px' }}>
            {vistaTab === 'todos' 
              ? 'TOTAL CLEAN C.A. - REPORTE DE COMPRAS COMPLETADAS'
              : vistaTab === 'recibidos'
                ? 'TOTAL CLEAN C.A. - REPORTE DE COMPRAS INGRESADAS A ALMACÉN'
                : 'TOTAL CLEAN C.A. - REPORTE DE COMPRAS PENDIENTES EN ALMACÉN'}
          </h3>
          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', opacity: 0.9 }}>
            Filtradas: {filteredCompras.length} de {comprasRaw.length}
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', color: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                <th style={{ padding: '12px 10px', textAlign: 'center', width: '80px' }}>ALMACÉN</th>
                <th style={{ padding: '12px 10px', textAlign: 'center', width: '120px' }}>REQUISICIÓN</th>
                <th style={{ padding: '12px 10px', textAlign: 'left', minWidth: '220px' }}>DESCRIPCIÓN</th>
                <th style={{ padding: '12px 10px', textAlign: 'left' }}>PROVEEDOR</th>
                <th style={{ padding: '12px 10px', textAlign: 'center' }}>NRO DE FACTURA</th>
                <th style={{ padding: '12px 10px', textAlign: 'center' }}>A ENTRADA ALM.</th>
                <th style={{ padding: '12px 10px', textAlign: 'center', minWidth: '210px' }}>ALMACÉN DESTINO / INGRESO</th>
                <th style={{ padding: '12px 10px', textAlign: 'left' }}>SOLICITANTE</th>
                <th style={{ padding: '12px 10px', textAlign: 'left' }}>GERENCIA</th>
                <th style={{ padding: '12px 10px', textAlign: 'left' }}>CENTRO DE COSTO</th>
                <th style={{ padding: '12px 10px', textAlign: 'center' }}>MONEDA DE PAGO</th>
                <th style={{ padding: '12px 10px', textAlign: 'right' }}>CANTIDAD COMPRADA</th>
                <th style={{ padding: '12px 10px', textAlign: 'right' }}>TOTAL ($)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="13" style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                      <Loader2 className="animate-spin" /> Cargando compras completadas...
                    </div>
                  </td>
                </tr>
              ) : filteredCompras.length === 0 ? (
                <tr>
                  <td colSpan="13" style={{ padding: '50px', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>
                    <ShieldAlert size={24} style={{ display: 'block', margin: '0 auto 10px auto', color: '#94a3b8' }} />
                    No se encontraron registros de compras bajo los filtros actuales.
                  </td>
                </tr>
              ) : filteredCompras.map((compra) => {
                const isRecibida = compra.recibido;
                const selectedLoc = selectedAlmacenes[compra.id] || '';

                return (
                  <tr key={compra.transaction_id || compra.id} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background-color 0.2s', backgroundColor: isRecibida ? '#f0fdf4' : 'transparent' }} className="row-hover">
                    {/* ALMACÉN */}
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {isRecibida ? (
                        <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: '6px', backgroundColor: '#16a34a', color: 'white', fontWeight: '900', fontSize: '0.7rem' }}>SÍ</span>
                      ) : (
                        <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: '6px', backgroundColor: '#94a3b8', color: 'white', fontWeight: '900', fontSize: '0.7rem' }}>NO</span>
                      )}
                    </td>
                    
                    {/* REQUISICIÓN */}
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#1e40af' }}>
                      {compra.correlativo}
                    </td>

                    {/* DESCRIPCIÓN */}
                    <td style={{ padding: '10px', fontWeight: '600', color: '#0f172a' }}>
                      {compra.descripcion}
                    </td>

                    {/* PROVEEDOR */}
                    <td style={{ padding: '10px', color: '#475569' }}>
                      {compra.proveedor}
                    </td>

                    {/* NRO DE FACTURA */}
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: '700', color: '#2563eb' }}>
                      {compra.numero_factura}
                    </td>

                    {/* A ENTRADA ALM. */}
                    <td style={{ padding: '10px', textAlign: 'center', color: '#334155', fontWeight: '500' }}>
                      {isRecibida ? formatFecha(compra.fecha_entrada_almacen) : '—'}
                    </td>

                    {/* ALMACÉN DESTINO / REGISTRO INGRESO */}
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {isRecibida ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '700', color: '#16a34a', fontSize: '0.8rem' }}>
                            {compra.ubicacion_almacen}
                          </span>
                          <button 
                            onClick={() => handleDeshacer(compra)} 
                            title="Revertir Ingreso"
                            style={{ padding: '4px 8px', backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', alignItems: 'center' }}>
                          <select 
                            value={selectedLoc}
                            onChange={(e) => setSelectedAlmacenes(prev => ({ ...prev, [compra.id]: e.target.value }))}
                            style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', maxWidth: '180px' }}
                          >
                            <option value="">Clasificar ubicación...</option>
                            {UBICACIONES_AUTORIZADAS.map(loc => (
                              <option key={loc} value={loc}>{loc}</option>
                            ))}
                          </select>
                          <button 
                            onClick={() => handleRecibir(compra)}
                            disabled={!selectedLoc}
                            style={{ 
                              padding: '6px 12px', 
                              backgroundColor: selectedLoc ? '#16a34a' : '#94a3b8', 
                              color: 'white', 
                              border: 'none', 
                              borderRadius: '8px', 
                              fontWeight: 'bold', 
                              cursor: selectedLoc ? 'pointer' : 'not-allowed',
                              transition: 'all 0.2s'
                            }}
                          >
                            Recibir
                          </button>
                        </div>
                      )}
                    </td>

                    {/* SOLICITANTE */}
                    <td style={{ padding: '10px', color: '#475569' }}>
                      {compra.solicitante}
                    </td>

                    {/* GERENCIA */}
                    <td style={{ padding: '10px', color: '#475569' }}>
                      {compra.gerencia}
                    </td>

                    {/* CENTRO DE COSTO */}
                    <td style={{ padding: '10px', color: '#475569', fontSize: '0.8rem' }}>
                      {compra.centro_costo}
                    </td>

                    {/* MONEDA DE PAGO */}
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: '500' }}>
                      {compra.moneda_pago}
                    </td>

                    {/* CANTIDAD COMPRADA */}
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>
                      {compra.cantidad_comprada}
                    </td>

                    {/* TOTAL ($) */}
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', color: '#16a34a' }}>
                      $ {(compra.total || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            
            {/* PIE DE PÁGINA TOTALES */}
            {!loading && filteredCompras.length > 0 && (
              <tfoot>
                <tr style={{ backgroundColor: '#f1f5f9', borderTop: '2px solid #cbd5e1', fontWeight: '900', color: '#0f172a' }}>
                  <td colSpan="12" style={{ padding: '15px 20px', textAlign: 'right', fontSize: '0.9rem' }}>
                    TOTAL GENERAL COMPLETADO ($):
                  </td>
                  <td style={{ padding: '15px 10px', textAlign: 'right', fontSize: '1rem', color: '#16a34a' }}>
                    $ {totalGeneralFiltrado.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      
      {/* Estilos adicionales */}
      <style>{`
        .row-hover:hover {
          background-color: #f1f5f9 !important;
        }
      `}</style>
    </div>
  );
};

export default Almacen;
