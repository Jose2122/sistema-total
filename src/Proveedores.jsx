import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { Loader2, Plus, Search, Mail, Phone, MapPin, XCircle, Edit, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import './Proveedores.css';

const Proveedores = () => {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    id: null,
    rif: '',
    razon_social: '',
    correo: '',
    telefono: '',
    direccion: '',
    categoria: '',
    status: true
  });

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
            categoria: formData.categoria,
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
            categoria: formData.categoria,
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
    if (!window.confirm('¿Estás seguro de eliminar este proveedor?')) return;
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
      categoria: '',
      status: true
    });
  };

  const handleEdit = (p) => {
    setFormData(p);
    setShowModal(true);
  };

  const categoriasUnicas = useMemo(() => {
    const cats = new Set();
    proveedores.forEach(p => {
      if (p.categoria) cats.add(p.categoria);
    });
    return Array.from(cats).sort();
  }, [proveedores]);

  const proveedoresFiltrados = proveedores.filter(p => {
    const matchTexto = p.razon_social?.toLowerCase().includes(busqueda.toLowerCase()) ||
                       p.rif?.toLowerCase().includes(busqueda.toLowerCase());
    const matchCat = filtroCategoria === 'Todos' || p.categoria === filtroCategoria;
    return matchTexto && matchCat;
  });

  return (
    <div className="prov-container">
      <div className="prov-max-width">
        <div className="prov-header">
          <div>
            <h1 className="prov-title">Módulo de Proveedores</h1>
            <p className="prov-subtitle">Gestión de cartera de proveedores Total Clean</p>
          </div>
          <button 
            onClick={() => { resetForm(); setShowModal(true); }}
            className="prov-btn-new"
          >
            <Plus size={20} />
            Nuevo Proveedor
          </button>
        </div>

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
            <p style={{ color: '#64748b', fontWeight: '600' }}>Cargando proveedores...</p>
          </div>
        ) : (
          <div className="table-container" style={{ borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0', backgroundColor: 'white' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', fontSize: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '15px', width: '150px' }}>RIF</th>
                  <th>RAZÓN SOCIAL</th>
                  <th>CATEGORÍA</th>
                  <th>CONTACTO</th>
                  <th>DIRECCIÓN</th>
                  <th style={{ textAlign: 'center', width: '120px' }}>ESTADO</th>
                  <th style={{ textAlign: 'center', width: '120px' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {proveedoresFiltrados.map((p, index) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc', fontSize: '0.85rem' }}>
                    <td style={{ padding: '15px', fontWeight: 'bold', color: 'var(--prov-blue)', fontFamily: 'monospace', fontSize: '0.9rem' }}>{p.rif}</td>
                    <td style={{ fontWeight: '800', color: '#1e293b' }}>{p.razon_social}</td>
                    <td style={{ color: '#64748b' }}>
                      {p.categoria ? (
                        <span style={{ backgroundColor: '#f1f5f9', padding: '4px 10px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: '700' }}>
                          {p.categoria}
                        </span>
                      ) : '-'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {p.correo && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}><Mail size={12} style={{ color: '#3b82f6' }} /> {p.correo}</div>}
                        {p.telefono && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}><Phone size={12} style={{ color: '#f97316' }} /> {p.telefono}</div>}
                        {(!p.correo && !p.telefono) && <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.75rem' }}>Sin contacto</span>}
                      </div>
                    </td>
                    <td style={{ color: '#64748b', fontSize: '0.75rem', maxWidth: '300px' }}>
                      {p.direccion ? (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                          <MapPin size={12} style={{ color: '#94a3b8', marginTop: '2px', flexShrink: 0 }} /> 
                          <span>{p.direccion}</span>
                        </div>
                      ) : (
                        <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>No registrada</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ 
                        color: p.status ? '#16a34a' : '#ef4444',
                        fontSize: '0.7rem',
                        fontWeight: '900',
                        textTransform: 'uppercase'
                      }}>
                        {p.status ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                        <button onClick={() => handleEdit(p)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '5px' }} title="Editar">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => eliminarProveedor(p.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '5px' }} title="Eliminar">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {proveedoresFiltrados.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No se encontraron proveedores activos con ese criterio.</div>
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

              <form onSubmit={guardarProveedor} className="prov-form">
                <div className="prov-form-grid">
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
                </div>

                <div className="prov-field">
                  <label className="prov-label">Razón Social</label>
                  <input 
                    className="prov-input"
                    placeholder="NOMBRE COMERCIAL O FISCAL"
                    value={formData.razon_social}
                    onChange={e => setFormData({...formData, razon_social: e.target.value.toUpperCase()})}
                    required
                  />
                </div>

                <div className="prov-field">
                  <label className="prov-label">Categoría del Proveedor</label>
                  <input 
                    className="prov-input"
                    placeholder="Ej: SERVICIOS, REPUESTOS, ALIMENTOS..."
                    value={formData.categoria}
                    onChange={e => setFormData({...formData, categoria: e.target.value.toUpperCase()})}
                    list="cat-suggestions"
                  />
                  <datalist id="cat-suggestions">
                    {categoriasUnicas.map(cat => <option key={cat} value={cat} />)}
                  </datalist>
                </div>

                <div className="prov-form-grid">
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
                </div>

                <div className="prov-field">
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
      </div>
    </div>
  );
};

export default Proveedores;