import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Loader2, Plus, Search, Mail, Phone, MapPin, XCircle, Edit, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import './Proveedores.css';

const Proveedores = () => {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    id: null,
    rif: '',
    razon_social: '',
    correo: '',
    telefono: '',
    direccion: '',
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

  const guardarProveedor = async (e) => {
    e.preventDefault();
    if (!formData.rif || !formData.razon_social) {
      return toast.error('RIF y Razón Social son obligatorios');
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
      status: true
    });
  };

  const handleEdit = (p) => {
    setFormData(p);
    setShowModal(true);
  };

  const proveedoresFiltrados = proveedores.filter(p => 
    p.razon_social?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.rif?.toLowerCase().includes(busqueda.toLowerCase())
  );

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
        </div>

        {loading ? (
          <div className="prov-loading">
            <div className="spinner"></div>
            <p style={{ color: '#64748b', fontWeight: '600' }}>Cargando proveedores...</p>
          </div>
        ) : (
          <div className="prov-grid">
            {proveedoresFiltrados.map(p => (
              <div key={p.id} className="prov-card">
                <div className="prov-card-header">
                  <div className="flex-1">
                    <h3 className="prov-card-name">{p.razon_social}</h3>
                    <p className="prov-card-rif">{p.rif}</p>
                  </div>
                  <div className={`prov-badge ${p.status ? 'badge-active' : 'badge-inactive'}`}>
                    {p.status ? 'Activo' : 'Inactivo'}
                  </div>
                </div>

                <div className="prov-info-list">
                  <div className="prov-info-item">
                    <div className="prov-icon-box icon-mail">
                      <Mail size={16} />
                    </div>
                    <span>{p.correo || 'No registrado'}</span>
                  </div>
                  <div className="prov-info-item">
                    <div className="prov-icon-box icon-phone">
                      <Phone size={16} />
                    </div>
                    <span>{p.telefono || 'No registrado'}</span>
                  </div>
                  <div className="prov-info-item">
                    <div className="prov-icon-box icon-map">
                      <MapPin size={16} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
                      {p.direccion || 'Sin dirección fiscal'}
                    </span>
                  </div>
                </div>

                <div className="prov-card-actions">
                  <button 
                    onClick={() => handleEdit(p)}
                    className="prov-btn-action btn-edit"
                  >
                    <Edit size={14} /> Editar
                  </button>
                  <button 
                    onClick={() => eliminarProveedor(p.id)}
                    className="prov-btn-action btn-delete"
                  >
                    <Trash2 size={14} /> Eliminar
                  </button>
                </div>
              </div>
            ))}
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
                      onChange={e => setFormData({...formData, rif: e.target.value.toUpperCase()})}
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