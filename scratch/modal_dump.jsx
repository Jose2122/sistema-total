                <td data-label="STATUS COMPRA" style={{ textAlign: 'center' }}>
                  {req.estado_aprobacion === 'ANULADA' ? '-' : (
                    <span style={{
                      color:
                        req.status?.toUpperCase() === 'COMPLETADO' ? '#16a34a' :
                          req.status?.toUpperCase() === 'PARCIAL' ? '#f59e0b' : '#ca8a04',
                      fontSize: '0.7rem',
                      fontWeight: '900',
                      textTransform: 'uppercase'
                    }}>
                      {req.status}
                    </span>
                  )}
                </td>

                <td data-label="ACCIONES" style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
                    <button onClick={(e) => { e.stopPropagation(); verRequisicion(req); }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }} title="Ver Detalles">👁️</button>

                    {/* Solo José y Analistas pueden Anular */}
                    {req.estado_aprobacion !== 'ANULADA' && (currentUser?.correo?.toLowerCase() === 'jcontreras.totalclean@gmail.com' || (currentUser?.rol || '').toLowerCase().includes('analista')) && (
                      <button onClick={(e) => { e.stopPropagation(); anularRequisicion(req.id); }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }} title="Anular Requisición">🚫</button>
                    )}

                    {/* Solo José puede Borrar */}
                    {currentUser?.correo?.toLowerCase() === 'jcontreras.totalclean@gmail.com' && (
                      <button onClick={(e) => { e.stopPropagation(); manejarEliminar(req.id); }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }} title="Borrar Registro">🗑️</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && historialFiltrado.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--slate-400)' }}>No se encontraron registros con esos filtros.</div>}
      </div>

      {/* --- MODAL DE FORMULARIO (NUEVA / EDITAR) --- */}
      {(isOpen || showModal) && (
        <div className="modal-overlay">
          <div className="modal-card animate-modal" style={{ maxWidth: '95%', width: '1300px' }}>
            <div id="area-pdf">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, color: 'var(--slate-900)' }}>Requisición de Recursos</h2>

                  {/* DIAGNÓSTICO PARA GERENCIA */}
                  {(currentUser?.esAdminReal || (currentUser?.rol || '').toUpperCase().includes('GERENTE')) && (
                    <div style={{
                      backgroundColor: '#fffbeb',
                      border: '1px solid #fde68a',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      color: '#92400e',
                      marginTop: '5px'
                    }}>
                      <b>SISTEMA DETECTA:</b> {currentUser?.correo} | <b>ROL:</b> {(currentUser?.rol || 'N/D').toUpperCase()}
                    </div>
                  )}

                  {(datosPredefinidos?.id_control || (editandoId && historial.find(h => h.id === editandoId)?.origen?.startsWith('REF:'))) && (
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', marginTop: '4px' }}>
                      {datosPredefinidos?.id_control ? `REF: ${datosPredefinidos.id_control}` : historial.find(h => h.id === editandoId)?.origen}
                    </div>
                  )}
                  <div className="status-purchase-badge" style={{ marginTop: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '9px' }}>ESTATUS DE COMPRA:</span>
                    <span style={{ fontSize: '10px', color: estadoGlobal.color, fontWeight: '900' }}>{estadoGlobal.texto}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--slate-600)', textTransform: 'uppercase' }}>Nivel de prioridad:</span>
                  <button
                    className={`btn-tc ${prioridad === 'Normal' ? 'btn-tc-primary' : 'btn-tc-secondary'}`}
                    onClick={() => setPrioridad('Normal')}
                    disabled={!!editandoId}
                  >
                    NORMAL
                  </button>
                  <button
                    className={`btn-tc ${prioridad === 'Alta' ? 'btn-tc-danger' : 'btn-tc-secondary'}`}
                    onClick={() => setPrioridad('Alta')}
                    disabled={!!editandoId}
                  >
                    ALTA
                  </button>
                  <div style={{ backgroundColor: '#fef08a', padding: '10px 15px', borderRadius: '8px', fontWeight: '900' }}>
                    {editandoId ? (historial.find(h => h.id === editandoId)?.correlativo) : previewCorrelativo}
                  </div>
                </div>
              </div>

              <div className="req-header-line"></div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px', marginBottom: '25px' }}>
                <div>
                  <label className="stat-label">FECHA REQUERIDA</label>
                  <input className="input-tc" type="date" value={fechaRequerida} onChange={(e) => setFechaRequerida(e.target.value)} disabled={!!editandoId} />
                </div>
                <div>
                  <label className="stat-label">SOLICITANTE</label>
                  <div className="input-tc" style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#f8fafc', height: '42px', boxSizing: 'border-box' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      backgroundColor: 'var(--primary)', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.7rem', fontWeight: 'bold'
                    }}>
                      {getInitials(solicitante)}
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--slate-800)' }}>
                      {solicitante}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="stat-label">CENTRO DE COSTOS</label>
                  <select
                    className="input-tc"
                    value={centroCosto}
                    disabled={!!editandoId}
                    onChange={(e) => {
                      setCentroCosto(e.target.value);
                      // Resetear clasificaciones y categorías de todos los renglones al cambiar CC
                      setRenglones(prev => prev.map(r => ({ ...r, clasificacion: '', categoria: '' })));
                    }}
                  >
                    <option value="">Seleccione Centro de Costo...</option>
                    {centrosCosto.map(cc => <option key={cc.id} value={cc.nombre}>{cc.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="stat-label">GERENCIA</label>
                  <select className="input-tc" value={departamento} onChange={(e) => setDepartamento(e.target.value)} disabled={!!editandoId}>
                    {listaGerencias.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                    <label className="stat-label" style={{ marginBottom: 0 }}>ID REF. PROYECTO / CONTRATO</label>
                    {editandoId && !editandoObs && (
                      <button
                        onClick={() => {
                          setObsTemporal(observaciones);
                          setEditandoObs(true);
                        }}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
                        title="Editar Metadata"
                      >
                        ✏️
                      </button>
                    )}
                  </div>
                  <input
                    className="input-tc"
                    list="ids-proyecto-previos"
                    value={idReferenciaProyecto}
                    onChange={manejarCambioIdProyecto}
                    placeholder="XXX-0000-0000"
                    disabled={editandoId && !editandoObs}
                  />
                  <datalist id="ids-proyecto-previos">
                    {idsReferenciaPrevios.map(id => <option key={id} value={id} />)}
                  </datalist>
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label className="stat-label">JUSTIFICACIÓN DE LA SOLICITUD <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  className="input-tc"
                  type="text"
                  value={justificacion}
                  onChange={(e) => setJustificacion(e.target.value)}
                  placeholder="Explique el motivo de la requisición (Obligatorio)"
                  required
                  disabled={!!editandoId}
                />
              </div>

              {/* CAMPO DE OBSERVACIONES */}
              <div style={{ marginBottom: '25px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                  <label className="stat-label" style={{ marginBottom: 0 }}>OBSERVACIONES</label>
                  {editandoId && !editandoObs && (
                    <button
                      onClick={() => {
                        setObsTemporal(observaciones);
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
                      style={{ minHeight: '80px', paddingTop: '10px' }}
                      value={obsTemporal}
                      onChange={(e) => setObsTemporal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          guardarObservacionesDirecto();
                        }
                      }}
                      placeholder="Actualice las observaciones aquí..."
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn-tc btn-tc-success"
                        style={{ padding: '4px 12px', fontSize: '0.7rem' }}
                        onClick={guardarObservacionesDirecto}
                      >
                        ✓ GUARDAR
                      </button>
                      <button
                        className="btn-tc btn-tc-secondary"
                        style={{ padding: '4px 12px', fontSize: '0.7rem' }}
                        onClick={() => setEditandoObs(false)}
                      >
                        CANCELAR
                      </button>
                    </div>
                  </div>
                ) : (
                  <textarea
                    className="input-tc"
                    style={{ minHeight: '60px', paddingTop: '10px' }}
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Notas adicionales sobre la entrega, especificaciones técnicas, etc."
                    disabled={editandoId && !editandoObs}
                  />
                )}
              </div>

              {editandoId && historial.find(h => h.id === editandoId)?.estado_aprobacion === 'rechazada' && (
                <div style={{ marginBottom: '25px', padding: '15px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px' }}>
                  <label style={{ fontSize: '0.65rem', fontWeight: '900', color: '#991b1b', textTransform: 'uppercase', marginBottom: '5px', display: 'block' }}>
                    ⚠️ MOTIVO DE RECHAZO
                  </label>
                  <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.9rem', fontWeight: '500' }}>
                    {historial.find(h => h.id === editandoId)?.motivo_rechazo || 'No especificado'}
                  </p>
                </div>
              )}

              <table className="tc-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--slate-50)' }}>
                    <th style={{ width: '10px' }}>RENGLÓN</th>
                    <th style={{ width: '200px' }}>CLASIFICACIÓN</th>
                    <th style={{ width: '200px' }}>CATEGORÍA</th>
                    <th style={{ width: '70px' }}>CANT.</th>
                    <th style={{ width: '110px' }}>UNI.</th>
                    <th style={{ width: '500px' }}>DESCRIPCIÓN</th>
                    <th style={{ width: '300px' }}>BENEFICIARIO</th>
                    <th style={{ width: '60px', textAlign: 'right' }}>P.U.</th>
                    <th style={{ width: '60px', textAlign: 'right' }}>TOTAL</th>
                    <th style={{ width: '10px', textAlign: 'center' }}>TRAZAB.</th>
                    <th style={{ width: '5px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {(Array.isArray(renglones) ? renglones : []).map((f, index) => (
                      <React.Fragment key={f.id}>
                        <motion.tr
                          className="renglon-row"
                          initial={{ opacity: 0, height: 0, scaleY: 0.8 }}
                          animate={{ opacity: 1, height: 'auto', scaleY: 1 }}
                          exit={{ opacity: 0, height: 0, scaleY: 0.8, overflow: 'hidden' }}
                          transition={{ duration: 0.3 }}
                        >
                          <td style={{ textAlign: 'center' }}>{index + 1}</td>
                          <td><input className="input-tc" value={f.clasificacion} onChange={(e) => actualizarFila(f.id, 'clasificacion', e.target.value)} /></td>
                          <td><input className="input-tc" value={f.categoria} onChange={(e) => actualizarFila(f.id, 'categoria', e.target.value)} /></td>
                          <td><input className="input-tc" type="number" value={f.cant === '' ? '' : Number(f.cant)} onChange={(e) => actualizarFila(f.id, 'cant', e.target.value)} /></td>
                          <td>
                            <select className="input-tc" value={f.uni} onChange={(e) => actualizarFila(f.id, 'uni', e.target.value)}>
                              {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </td>
                          <td><textarea className="input-tc" value={f.descripcion} onChange={(e) => actualizarFila(f.id, 'descripcion', e.target.value)} style={{ resize: 'vertical', minHeight: '38px', paddingTop: '8px', width: '100%', boxSizing: 'border-box' }} rows="1" /></td>
                          <td><input className="input-tc" value={f.beneficiario} onChange={(e) => actualizarFila(f.id, 'beneficiario', e.target.value)} placeholder="Beneficiario" /></td>
                          <td><input className="input-tc" type="number" value={f.pu === '' ? '' : Number(f.pu)} style={{ textAlign: 'right' }} onChange={(e) => actualizarFila(f.id, 'pu', e.target.value)} /></td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{f.total.toLocaleString('de-DE')}</td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                              <button
                                onClick={() => setExpandirHistorial(prev => ({ ...prev, [f.id]: !prev[f.id] }))}
                                style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: (f.historial_compras?.length > 0) ? 1 : 0.3 }}
                                title="Ver Trazabilidad"
                                disabled={!f.historial_compras?.length}
                              >
                                {expandirHistorial[f.id] ? '🔼' : '🕒'}
                              </button>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => duplicarRenglon(f.id)}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem' }}
                              title="Duplicar Renglón"
                            >
                              👯
                            </button>
                          </td>
                        </motion.tr>
                        {expandirHistorial[f.id] && f.historial_compras?.length > 0 && (
                          <tr>
                            <td colSpan="11" style={{ padding: '0 0 15px 40px' }}>
                              <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                <div style={{ padding: '8px 12px', backgroundColor: '#f8fafc', fontSize: '0.7rem', fontWeight: '900', color: '#475569', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0' }}>
                                  <span>TRAZABILIDAD Y JUSTIFICACIONES DEL ÍTEM</span>
                                  <span style={{ color: 'var(--primary)' }}>{f.historial_compras.length} EVENTOS</span>
                                </div>
                                <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '0.65rem' }}>
                                      <th style={{ padding: '8px', textAlign: 'left' }}>FECHA</th>
                                      <th style={{ padding: '8px', textAlign: 'left' }}>EVENTO</th>
                                      <th style={{ padding: '8px', textAlign: 'left' }}>PROVEEDOR</th>
                                      <th style={{ padding: '8px', textAlign: 'left' }}>DETALLE / MOTIVO</th>
                                      <th style={{ padding: '8px', textAlign: 'center' }}>CANT.</th>
                                      <th style={{ padding: '8px', textAlign: 'right' }}>P.U. REAL</th>
                                      <th style={{ padding: '8px', textAlign: 'right' }}>TOTAL / COMENTARIO</th>
                                      <th style={{ padding: '8px', textAlign: 'right' }}>USUARIO</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {f.historial_compras.map((h, idx) => (
                                      <tr key={idx} style={{
                                        borderBottom: idx < f.historial_compras.length - 1 ? '1px solid #f1f5f9' : 'none',
                                        backgroundColor: h.tipo === 'JUSTIFICACION' ? '#fffbeb' : 'transparent'
                                      }}>
                                        <td style={{ padding: '8px', color: '#64748b' }}>{new Date(h.fecha).toLocaleDateString()}</td>
                                        <td style={{ padding: '8px', fontWeight: 'bold', color: h.tipo === 'JUSTIFICACION' ? '#d97706' : '#16a34a' }}>
                                          {h.tipo === 'JUSTIFICACION' ? '⚠️ JUSTIFICACIÓN' : '✅ COMPRA'}
                                        </td>
                                        <td style={{ padding: '8px', fontSize: '0.65rem', fontWeight: 'bold', color: '#64748b' }}>
                                          {h.tipo !== 'JUSTIFICACION' ? (h.proveedor_nombre || 'No asignado') : '-'}
                                        </td>
                                        <td style={{ padding: '8px' }}>
                                          {h.tipo === 'JUSTIFICACION' ? (
                                            <span style={{ fontStyle: 'italic', color: '#92400e', fontWeight: '600' }}>{h.motivo}</span>
                                          ) : 'Procesamiento de compra'}
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700' }}>{h.cant || '-'}</td>
                                        <td style={{ padding: '8px', textAlign: 'right' }}>{h.pu ? `$ ${h.pu.toLocaleString('de-DE')}` : '-'}</td>
                                        <td style={{ padding: '8px', textAlign: 'right' }}>
                                          {h.tipo === 'JUSTIFICACION' ? (
                                            <div style={{ fontSize: '0.7rem', color: '#475569', whiteSpace: 'pre-wrap', textAlign: 'left', backgroundColor: '#fef3c7', padding: '6px', borderRadius: '4px' }}>
                                              {h.comentario}
                                            </div>
                                          ) : <span style={{ fontWeight: 'bold' }}>$ {(h.cant * h.pu).toLocaleString('de-DE')}</span>}
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'right', color: '#64748b', fontSize: '0.65rem' }}>{h.usuario_nombre}</td>
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
                  </AnimatePresence>
                </tbody>
              </table>

              <div style={{ display: 'flex', gap: '30px', marginTop: '30px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  {/* SECCIÓN DE DOCUMENTOS DE SOPORTE (IMÁGENES DE COMPRA) */}
                  {editandoId && (
                    <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileText size={18} /> DOCUMENTOS Y SOPORTES
                        </h4>

                        {/* Restricción de Adjuntos: Solo creación, aprobada/finalizada o modo compras. No en aprobación. */}
                        {(() => {
                          const reqActual = historial.find(h => String(h.id) === String(editandoId));
                          const estado = reqActual?.estado_aprobacion;
                          const esProcesoAprobacion = estado === 'pendiente_area' || estado === 'enviada_general';
                          const esFinalizada = estado === 'aprobada' || estado === 'completado' || reqActual?.status_compra === 'Completado';

                          // Solo permitir si: No se está editando (Creación), o está finalizada, o NO está en proceso de aprobación
                          if (!editandoId || (!esProcesoAprobacion || esFinalizada)) {
                            return (
                              <label className="btn-tc btn-tc-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
                                {uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                                {uploading ? 'SUBIENDO...' : 'ADJUNTAR SOPORTE'}
                                <input
                                  type="file"
                                  multiple
                                  style={{ display: 'none' }}
                                  onChange={subirFactura}
                                  disabled={uploading}
                                  accept="image/*,application/pdf"
                                  capture="environment"
                                />
                              </label>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                        {(facturasUrls || []).map((item, idx) => {
                          const url = typeof item === 'string' ? item : item?.url;
                          const etiqueta = typeof item === 'string' ? 'Archivo' : (item?.etiqueta || 'Sin etiqueta');
                          if (!url || url.length < 5) return null;

                          const isImg = /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(url.split('?')[0]);
                          return (
                            <div key={idx} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '5px', width: '90px' }}>
                              <a href={url} target="_blank" rel="noreferrer" style={{
                                display: 'block',
                                width: '90px', height: '90px',
                                borderRadius: '16px',
                                overflow: 'hidden',
                                border: '2px solid #e2e8f0',
                                backgroundColor: 'white',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                transition: 'transform 0.2s'
                              }} onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                                {isImg ? (
                                  <img src={url} alt={`Soporte ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fef2f2', color: '#ef4444' }}>
                                    <FileText size={28} />
                                    <span style={{ fontSize: '0.6rem', fontWeight: '900', marginTop: '4px' }}>PDF</span>
                                  </div>
                                )}
                              </a>
                              <div style={{ fontSize: '0.65rem', fontWeight: '700', textAlign: 'center', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {etiqueta}
                              </div>
                              <button
                                onClick={() => eliminarSoporteDefinitivo(idx)}
                                style={{ position: 'absolute', top: '-8px', right: '-8px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '22px', height: '22px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', fontWeight: 'bold', zIndex: 10 }}
                                title="Eliminar Soporte"
                              >
                                X
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="totals-container" style={{ width: '100%', maxWidth: '350px', minWidth: '350px', marginTop: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#64748b' }}>
                    <span className="stat-label" style={{ color: 'inherit' }}>SUB-TOTAL ESTIMADO:</span>
                    <span style={{ fontWeight: 'bold' }}>$ {subTotalEstimado.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {subTotalEjecutado > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#16a34a' }}>
                      <span className="stat-label" style={{ color: 'inherit' }}>SUB-TOTAL EJECUTADO:</span>
                      <span style={{ fontWeight: 'bold' }}>$ {subTotalEjecutado.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--slate-200)', paddingTop: '10px', color: '#64748b' }}>
                    <span style={{ fontWeight: '900', fontSize: '1rem' }}>TOTAL ESTIMADO (C/IVA):</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: '900' }}>$ {totalEstimado.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                  </div>

                  {subTotalEjecutado > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', color: '#16a34a' }}>
                      <span style={{ fontWeight: '900', fontSize: '1rem' }}>TOTAL EJECUTADO (C/IVA):</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: '900' }}>$ {totalEjecutado.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  {/* Diferencia */}
                  {subTotalEjecutado > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', marginTop: '10px', borderTop: '1px dashed #cbd5e1' }}>
                      <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#475569' }}>DIFERENCIA:</span>
                      {(() => {
                        if (totalEstimado === 0) {
                          return <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#64748b' }}>+ $ {totalEjecutado.toLocaleString('de-DE', { minimumFractionDigits: 2 })} (Sin Est. Previa)</span>;
                        }
                        const diff = totalEjecutado - totalEstimado;
                        const pje = (diff / totalEstimado) * 100;
                        const isRed = diff > 0;
                        const isGreen = diff < 0;
                        const color = isRed ? '#ef4444' : isGreen ? '#16a34a' : '#64748b';
                        const sign = diff > 0 ? '+' : '';

                        // Prevent NaN or extreme values if close to 0
                        const pjeStr = isFinite(pje) ? `${pje > 0 ? '+' : ''}${pje.toFixed(1)}%` : 'N/A';

                        return (
                          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color }}>
                            {sign} $ {diff.toLocaleString('de-DE', { minimumFractionDigits: 2 })} ({pjeStr})
                          </span>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <button className="btn-tc btn-tc-secondary" onClick={() => { setShowModal(false); onClose?.(); resetearFormulario(); }}>Cerrar</button>
                  <button className="btn-tc btn-tc-dark" onClick={exportarPDF}>📥 PDF</button>

                  {editandoId ? (
                    <>
                      <button className="btn-tc btn-tc-primary" style={{ backgroundColor: '#0284c7' }} onClick={manejarGuardarUpdate} disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" size={16} /> : '💾 GUARDAR CAMBIOS'}
                      </button>
                      {/* ACCIONES PARA ANALISTA / COORDINADOR (Re-enviar si está rechazada) */}
                      {(currentUser?.rol === 'Analista' || currentUser?.rol === 'Coordinador') &&
                        historial.find(h => String(h.id) === String(editandoId))?.estado_aprobacion === 'rechazada' && (
                          <button className="btn-tc btn-tc-primary" onClick={manejarReenviar} disabled={loading}>
                            {loading ? <Loader2 className="animate-spin" size={16} /> : 'MODIFICAR Y RE-ENVIAR'}
                          </button>
                        )}

                      {/* BOTONES PARA GERENTE DE PROYECTO */}
                      {currentUser?.rol?.toLowerCase()?.includes('proyecto') &&
                        historial.find(h => String(h.id) === String(editandoId))?.estado_aprobacion === 'pendiente_proyecto' && (
                          <>
                            <button className="btn-tc btn-tc-danger" onClick={manejarRechazarGerenteProyecto} disabled={loading}>
                              {loading ? <Loader2 className="animate-spin" size={16} /> : 'RECHAZAR'}
                            </button>
                            <button className="btn-tc btn-tc-success" onClick={manejarAprobarGerenteProyecto} disabled={loading}>
                              {loading ? <Loader2 className="animate-spin" size={16} /> : '✓ APROBAR PROYECTO'}
                            </button>
                          </>
                        )}

                      {/* BOTONES PARA GERENTE DE ÁREA (Nivel 1) */}
                      {currentUser?.rol?.toLowerCase()?.includes('gerente') && !currentUser?.rol?.toLowerCase()?.includes('general') &&
                        historial.find(h => String(h.id) === String(editandoId))?.estado_aprobacion === 'pendiente_area' && (
                          <>
                            <button className="btn-tc btn-tc-danger" onClick={manejarRechazarGerenteArea} disabled={loading}>
                              {loading ? <Loader2 className="animate-spin" size={16} /> : 'RECHAZAR'}
                            </button>
                            <button className="btn-tc btn-tc-success" onClick={manejarAprobarGerenteArea} disabled={loading}>
                              {loading ? <Loader2 className="animate-spin" size={16} /> : '✓ APROBAR ÁREA'}
                            </button>
                          </>
                        )}

                      {(() => {
                        const rolUpper = (currentUser?.rol || '').toUpperCase();
                        const emailLower = (currentUser?.correo || '').toLowerCase();

                        const esGG = currentUser?.esAdminReal ||
                          rolUpper.includes('GERENTE') ||
                          rolUpper.includes('ADMIN') ||
                          emailLower.includes('cvega');

                        const reqActual = historial.find(h => String(h.id) === String(editandoId));

                        if (esGG && reqActual?.estado_aprobacion === 'enviada_general') {
                          return (
                            <>
                              <button className="btn-tc btn-tc-danger" onClick={manejarRechazarGeneral} disabled={loading}>
                                {loading ? <Loader2 className="animate-spin" size={16} /> : 'RECHAZAR'}
                              </button>
                              <button
                                className="btn-tc btn-tc-success"
                                onClick={(e) => {
                                  e.preventDefault();
                                  manejarAprobarGeneral();
                                }}
                                disabled={loading}
                              >
                                {loading ? <Loader2 className="animate-spin" size={16} /> : '✓ APROBACIÓN FINAL'}
                              </button>
                            </>
                          );
                        }
                        return null;
                      })()}
                    </>
                  ) : (
                    <button className="btn-tc btn-tc-primary" onClick={manejarGenerarOActualizar} disabled={loading}>
                      {loading ? <Loader2 className="animate-spin" size={16} /> : 'GENERAR REQUISICIÓN'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DE RECHAZO PERSONALIZADO --- */}
      <AnimatePresence>
        {showRechazoModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 20000, padding: '20px' }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{ backgroundColor: 'white', borderRadius: '24px', padding: '30px', width: '100%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
            >
              <h3 style={{ margin: '0 0 10px 0', fontSize: '1.25rem', color: '#1e293b', fontWeight: '800' }}>Indique el motivo del rechazo:</h3>
              <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: '#64748b' }}>Esta información será visible para el solicitante de la requisición.</p>

              <textarea
                autoFocus
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '150px',
                  borderRadius: '16px',
                  border: '2px solid #e2e8f0',
                  padding: '15px',
                  fontSize: '0.95rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  fontFamily: 'inherit',
                  resize: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#0ea5e9'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                placeholder="Escriba aquí las razones del rechazo detalladamente..."
              />
