import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import { 
  Package, Truck, UserCheck, Search, FileText, CheckCircle2, Clock, Hash, ClipboardList, Loader2
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const Almacen = () => {
  const [itemsPendientes, setItemsPendientes] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [loading, setLoading] = useState(false);
  const [vista, setVista] = useState('recepcion'); 
  const [busqueda, setBusqueda] = useState('');
  const [modalRecepcion, setModalRecepcion] = useState(null);
  const [modalEntrega, setModalEntrega] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

      // 2. Cargar recepciones existentes
      const { data: recepciones, error: errR } = await supabase.from('almacen_recepcion').select('*');

      // 3. Procesar ítems individuales de cada requisición
      let todosLosItems = [];
      (reqs || []).forEach(r => {
        const items = Array.isArray(r.items) ? r.items : [];
        items.forEach((it, idx) => {
          // Solo procesar si tiene factura (indicador de que fue comprado)
          if (it.doc_numero || it.numero_factura) {
            const idUnico = `${r.id}-${idx}`;
            const recibidos = (recepciones || [])
              .filter(rec => rec.requisicion_id === r.id && rec.item_index === idx)
              .reduce((acc, curr) => acc + (curr.cantidad_recibida || 0), 0);

            const total = it.anulado ? (parseFloat(it.cantidad_comprada) || 0) : (parseFloat(it.cant) || 0);
            if (total - recibidos > 0) {
              todosLosItems.push({
                ...it,
                id_interno: idUnico,
                req_id: r.id,
                item_idx: idx,
                centro_costo: r.centro_costo,
                gerencia: r.gerencia,
                correlativo: r.correlativo_req,
                cantidad_total: total,
                cantidad_recibida: recibidos,
                cantidad_pendiente: total - recibidos,
                numero_factura: it.doc_numero || it.numero_factura,
                proveedor: it.proveedor
              });
            }
          }
        });
      });

      setItemsPendientes(todosLosItems);

      // 4. Cargar Inventario
      const { data: inv, error: errI } = await supabase
        .from('almacen_recepcion')
        .select('*')
        .gt('cantidad_recibida', 0)
        .neq('status', 'Entregado Total');
      
      setInventario(inv || []);

    } catch (err) {
      console.error("Error Almacen:", err);
      toast.error("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const handleRecepcion = async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {
      requisicion_id: modalRecepcion.req_id,
      item_index: modalRecepcion.item_idx,
      cantidad_recibida: parseFloat(form.cant.value),
      recibido_por: form.receptor.value,
      guia_proveedor: form.guia.value,
      numero_precinto: form.precinto.value,
      observaciones: form.obs.value,
      status: 'En Almacén',
      // Datos de respaldo para inventario
      descripcion_material: modalRecepcion.descripcion,
      centro_costo: modalRecepcion.centro_costo,
      gerencia: modalRecepcion.gerencia,
      proveedor: modalRecepcion.proveedor,
      numero_factura: modalRecepcion.numero_factura
    };

    setLoading(true);
    try {
      const { error } = await supabase.from('almacen_recepcion').insert([data]);
      if (error) throw error;
      toast.success("Material recibido en Almacén");
      setModalRecepcion(null);
      cargarDatos();
    } catch (err) {
      toast.error("Error al recibir: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f1f5f9', minHeight: '100vh', color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '20px', marginBottom: '30px' }}>
        {/* --- ENCABECERA UNIFICADA PREMIUM --- */}
        <div style={{
          borderLeft: '6px solid #0ea5e9',
          paddingLeft: '16px'
        }}>
          <h1 style={{ margin: 0, color: '#0f172a', fontSize: '1.8rem', fontWeight: '900', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.5px' }}>
            Gestión de Almacén
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem', fontWeight: '500', fontFamily: 'Inter, sans-serif' }}>
            Control de ingresos y actas de despacho
          </p>
        </div>

        <div style={{ display: 'flex', background: '#e2e8f0', padding: '5px', borderRadius: '12px', width: isMobile ? '100%' : 'auto' }}>
          <button onClick={() => setVista('recepcion')} style={{ flex: isMobile ? 1 : 'none', padding: '10px 15px', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: vista === 'recepcion' ? '#0ea5e9' : 'transparent', color: vista === 'recepcion' ? 'white' : '#64748b', fontWeight: 'bold', transition: 'all 0.2s', fontSize: isMobile ? '0.8rem' : '0.9rem' }}>
            <Truck size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Recepción
          </button>
          <button onClick={() => setVista('inventario')} style={{ flex: isMobile ? 1 : 'none', padding: '10px 15px', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: vista === 'inventario' ? '#0ea5e9' : 'transparent', color: vista === 'inventario' ? 'white' : '#64748b', fontWeight: 'bold', transition: 'all 0.2s', fontSize: isMobile ? '0.8rem' : '0.9rem' }}>
            <ClipboardList size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Inventario
          </button>
        </div>
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '15px', marginBottom: '30px' }}>
        <div style={{ backgroundColor: 'white', padding: isMobile ? '15px' : '25px', borderRadius: '20px', borderLeft: '6px solid #0ea5e9', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PENDIENTES POR RECIBIR</div>
          <div style={{ fontSize: isMobile ? '1.8rem' : '2.2rem', fontWeight: '900', color: '#0f172a' }}>{itemsPendientes.length}</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: isMobile ? '15px' : '25px', borderRadius: '20px', borderLeft: '6px solid #10b981', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MATERIAL EN STOCK</div>
          <div style={{ fontSize: isMobile ? '1.8rem' : '2.2rem', fontWeight: '900', color: '#0f172a' }}>{inventario.length}</div>
        </div>
      </div>

      {/* TABLA */}
      <div style={{ backgroundColor: 'white', borderRadius: '20px', overflowX: 'auto', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? '800px' : 'auto' }}>
          <thead>
            <tr>
              <th style={{ padding: '18px 15px', textAlign: 'left' }}>Material / Descripción</th>
              <th style={{ padding: '18px 15px', textAlign: 'left' }}>Obra / Gerencia</th>
              <th style={{ padding: '18px 15px', textAlign: 'center' }}>Factura / Proveedor</th>
              <th style={{ padding: '18px 15px', textAlign: 'center' }}>Cantidad</th>
              <th style={{ padding: '18px 15px', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody style={{ color: '#1e293b', fontSize: '0.9rem' }}>
            {loading ? (
              <tr><td colSpan="5" style={{ padding: '40px', textAlign: 'center' }}><Loader2 className="animate-spin" /> Cargando...</td></tr>
            ) : (vista === 'recepcion' ? itemsPendientes : inventario).map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '15px' }}>
                  <div style={{ fontWeight: 'bold' }}>{item.descripcion || item.descripcion_material}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Ref: {item.correlativo || 'N/A'}</div>
                </td>
                <td style={{ padding: '15px' }}>
                  <div>{item.centro_costo}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.gerencia}</div>
                </td>
                <td style={{ padding: '15px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 'bold', color: '#0ea5e9' }}>{item.numero_factura || 'S/F'}</div>
                  <div style={{ fontSize: '0.75rem' }}>{item.proveedor}</div>
                </td>
                <td style={{ padding: '15px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 'bold' }}>
                    {vista === 'recepcion' ? `${item.cantidad_recibida} / ${item.cantidad_total}` : item.cantidad_recibida}
                  </div>
                  <div style={{ fontSize: '0.7rem' }}>UNID</div>
                </td>
                <td style={{ padding: '15px', textAlign: 'center' }}>
                  {vista === 'recepcion' ? (
                    <button onClick={() => setModalRecepcion(item)} style={{ padding: '8px 15px', backgroundColor: '#0ea5e9', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Recibir</button>
                  ) : (
                    <button style={{ padding: '8px 15px', backgroundColor: '#10b981', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Entregar</button>
                  )}
                </td>
              </tr>
            ))}
            {(!loading && (vista === 'recepcion' ? itemsPendientes : inventario).length === 0) && (
              <tr><td colSpan="5" style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>No hay materiales pendientes por procesar</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL RECEPCIÓN */}
      {modalRecepcion && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '24px', width: isMobile ? '95%' : '500px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><Truck color="#0ea5e9" /> Ingreso a Almacén</h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{modalRecepcion.descripcion}</p>
            
            <form onSubmit={handleRecepcion} style={{ display: 'grid', gap: '15px', marginTop: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Cant. a Recibir</label>
                  <input name="cant" type="number" step="any" defaultValue={modalRecepcion.cantidad_pendiente} style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px' }} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Receptor</label>
                  <input name="receptor" type="text" placeholder="Nombre..." style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px' }} required />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Guía Proveedor</label>
                  <input name="guia" type="text" placeholder="N° Guía..." style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Precinto</label>
                  <input name="precinto" type="text" placeholder="N° Precinto..." style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Observaciones</label>
                <textarea name="obs" rows="2" style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setModalRecepcion(null)} style={{ flex: 1, padding: '12px', background: '#f1f5f9', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ flex: 2, padding: '12px', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Registrar Ingreso</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Almacen;
