import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Save, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { requisicionesService } from '../../services/requisicionesService';

const RequisicionFormModal = ({ isOpen, onClose, requisicion, isEditing, currentUser, masters, onSaveSuccess }) => {
  const [form, setForm] = useState({
    solicitante: `${currentUser?.nombre} ${currentUser?.apellido}`,
    gerencia: currentUser?.departamento || '',
    items: [{ id: Date.now(), desc: '', cant: 1, uni: 'UNID', pu: 0 }]
  });

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ backgroundColor: 'white', width: '100%', maxWidth: '1000px', borderRadius: '28px', overflow: 'hidden' }}
      >
        <div style={{ padding: '20px', backgroundColor: '#0f172a', color: 'white', display: 'flex', justifyContent: 'space-between' }}>
          <h2>Requisición</h2>
          <button onClick={onClose} style={{ color: 'white', background: 'none', border: 'none' }}><X /></button>
        </div>
        <div style={{ padding: '30px' }}>
          <p>Lógica de Requisición modularizada...</p>
        </div>
      </motion.div>
    </div>
  );
};

export default RequisicionFormModal;
