import React from 'react';
import { X, Sparkles, CheckCircle2 } from 'lucide-react';

export default function ModalNovedades({ isOpen, version, descripcion, onClose }) {
  if (!isOpen) return null;

  // Separar líneas por saltos de línea para renderizar en viñetas
  const lineas = descripcion
    ? descripcion.split('\n').map(l => l.trim()).filter(Boolean)
    : [];

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all scale-100 duration-300 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header con gradiente premium */}
        <div className="p-6 bg-gradient-to-r from-sky-500 via-indigo-500 to-indigo-600 text-white relative">
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all duration-200"
            title="Cerrar"
          >
            <X size={18} />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/15 rounded-xl">
              <Sparkles size={24} className="text-yellow-300" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest bg-white/20 px-2 py-0.5 rounded-md">¡Nueva Versión!</span>
              <h2 className="text-xl font-black mt-1 leading-none">Novedades v{version}</h2>
            </div>
          </div>
        </div>

        {/* Contenido / Cambios */}
        <div className="p-6 max-h-[320px] overflow-y-auto">
          <p className="text-[11px] text-slate-500 font-bold mb-3 uppercase tracking-wider">Cambios y mejoras:</p>
          {lineas.length === 0 ? (
            <p className="text-xs text-slate-600 italic">No hay detalles específicos de cambios para esta versión.</p>
          ) : (
            <div className="space-y-2.5">
              {lineas.map((linea, index) => {
                const textoLimpio = linea.replace(/^-\s*/, '').replace(/^\*\s*/, '');
                return (
                  <div key={index} className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-indigo-50/20 transition-all duration-150">
                    <CheckCircle2 size={15} className="text-indigo-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-slate-700 font-semibold leading-relaxed">{textoLimpio}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button 
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] shadow-md shadow-indigo-200 active:scale-95 transition-all duration-150"
          >
            ¡Entendido!
          </button>
        </div>
      </div>
    </div>
  );
}
