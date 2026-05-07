import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Trash2, Save, Printer, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { UNIDADES_MEDIDA } from '../../constants';
import { formatCurrency, getWeekNumber, getWeekRange } from '../../utils/helpers';
import { fondosService } from '../../services/fondosService';

const FondosFormModal = ({ isOpen, onClose, currentUser, maestros, onSaveSuccess, isEditing, editandoId }) => {
  const [form, setForm] = useState({
    responsable: `${currentUser?.nombre} ${currentUser?.apellido}`,
    gerencia: currentUser?.departamento || '',
    fecha: new Date().toISOString().split('T')[0],
    items: [{ id: Date.now(), desc: '', cant: 1, uni: 'UNID', pu: 0, tipo: 'Bs', centro_costo: '', clasificacion: '', sub: '' }],
    imprevistos: 0
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEditing && editandoId) {
      fondosService.getSolicitudDetails(editandoId).then(data => {
        // Mapear datos a estructura del formulario
      });
    }
  }, [isEditing, editandoId]);

  const subtotalBs = useMemo(() => form.items.filter(i => i.tipo === 'Bs').reduce((acc, it) => acc + (it.pu * it.cant), 0), [form.items]);
  const subtotalUsd = useMemo(() => form.items.filter(i => i.tipo === 'USD').reduce((acc, it) => acc + (it.pu * it.cant), 0), [form.items]);
  const totalGeneral = subtotalBs + subtotalUsd + parseFloat(form.imprevistos || 0);

  const manejarCambioItem = (idx, campo, valor) => {
    const nuevos = [...form.items];
    nuevos[idx][campo] = valor;
    setForm({ ...form, items: nuevos });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Lógica de validación y guardado usando fondosService
      onSaveSuccess();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ backgroundColor: 'white', width: '100%', maxWidth: '1200px', maxHeight: '90vh', borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ padding: '20px 30px', backgroundColor: '#0f172a', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>{isEditing ? 'Editar Solicitud' : 'Nueva Solicitud de Fondos'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24} /></button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '30px' }}>
          {/* Contenido del formulario */}
          <p>Lógica de formulario modularizada...</p>
        </div>

        <div style={{ padding: '20px 30px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: 'white' }}>Cancelar</button>
          <button onClick={handleSave} style={{ padding: '10px 25px', borderRadius: '12px', border: 'none', backgroundColor: '#0f172a', color: 'white', fontWeight: 'bold' }}>Guardar</button>
        </div>
      </motion.div>
    </div>
  );
};

export default FondosFormModal;
