/**
 * Servicio Centralizado de Subida de Archivos y Soportes a VPS
 * SITC - Sistema Integrado Total Clean
 * 
 * Reglas de Arquitectura:
 * 1. Nomenclatura sanitaria: id_requisicion_NroFactura_nombreArticulo.ext
 * 2. Compresión previa en cliente (WebP / JPEG <= 250-300 KB)
 * 3. Almacenamiento en VPS (https://sitc.totalclean.com.ve/uploads/)
 * 4. Cero consumo de Storage/Egress en Supabase
 */

import { compressImage } from '../utils/compressImage';
import { supabase } from '../supabaseClient';

const VPS_API_URL = import.meta.env.VITE_VPS_API_URL || 'https://sitc.totalclean.com.ve';

/**
 * Sanitiza una cadena eliminando espacios, tildes y caracteres especiales
 */
export function sanitizarTextoNomenclatura(str, maxLen = 40) {
  if (!str) return '';
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/\s+/g, '_')           // Espacios a guión bajo
    .replace(/[^a-zA-Z0-9_-]/g, '') // Solo caracteres seguros
    .slice(0, maxLen);
}

/**
 * Genera el nombre de archivo sanitario según el estándar requerido
 * @param {Object} params
 * @param {string} params.requisicionId - ID o correlativo de la requisición o ticket
 * @param {string} params.nroFactura - Número de documento o factura
 * @param {string} params.nombreArticulo - Descripción o concepto del ítem
 * @param {string} params.extension - Extensión con o sin punto (ej. 'webp', 'pdf')
 */
export function generarNombreSanitario({ requisicionId, nroFactura, nombreArticulo, extension }) {
  const reqClean = sanitizarTextoNomenclatura(requisicionId || 'SIT') || 'SIT';
  const docClean = sanitizarTextoNomenclatura(nroFactura || 'SINDOC') || 'SINDOC';
  const artClean = sanitizarTextoNomenclatura(nombreArticulo || 'Soporte') || 'Soporte';
  const extClean = (extension || 'bin').replace(/^\./, '').toLowerCase();

  return `${reqClean}_${docClean}_${artClean}.${extClean}`;
}

/**
 * Sube un archivo a la VPS aplicando compresión automática y nomenclatura sanitaria.
 * 
 * @param {File|Blob} archivo - Archivo a subir (imagen o PDF)
 * @param {Object} metadatos - Información contextual para la nomenclatura
 * @param {string} [metadatos.requisicionId] - Correlativo o ID (ej: REQ-0012, TP-24-001)
 * @param {string} [metadatos.nroFactura] - Número de factura / comprobante (ej: F00249)
 * @param {string} [metadatos.nombreArticulo] - Nombre del artículo o concepto
 * @param {string} [metadatos.etiquetaPersonalizada] - Etiqueta descriptiva para la UI
 * @returns {Promise<{ url: string, filename: string, size: number, success: boolean }>}
 */
export async function subirArchivoAVps(archivo, metadatos = {}) {
  if (!archivo) {
    throw new Error('No se proporcionó ningún archivo para subir.');
  }

  // 1. Compresión en el cliente si es imagen (WebP/JPEG <= 300 KB, máx 1280px)
  let archivoListo = archivo;
  try {
    archivoListo = await compressImage(archivo, {
      maxWidth: 1280,
      maxHeight: 1280,
      quality: 0.75,
      targetMaxKB: 300
    });
  } catch (errComp) {
    console.warn('[uploadService] Error al comprimir imagen, usando archivo original:', errComp);
  }

  // 2. Determinar extensión y nombre sanitario
  const extension = (archivoListo.name || archivo.name || '').split('.').pop() || 'bin';
  const nombreSanitario = generarNombreSanitario({
    requisicionId: metadatos.requisicionId || metadatos.ticketId || metadatos.reqId || metadatos.id,
    nroFactura: metadatos.nroFactura || metadatos.docNumero || 'SOPORTE',
    nombreArticulo: metadatos.nombreArticulo || metadatos.descripcion || 'Comprobante',
    extension
  });

  // Re-empaquetar con el nombre sanitario
  const archivoFinal = new File([archivoListo], nombreSanitario, {
    type: archivoListo.type || 'application/octet-stream',
    lastModified: Date.now()
  });

  // 3. Preparar FormData
  const formData = new FormData();
  formData.append('file', archivoFinal);
  formData.append('requisicion_id', metadatos.requisicionId || metadatos.ticketId || '');
  formData.append('nro_factura', metadatos.nroFactura || metadatos.docNumero || '');
  formData.append('nombre_articulo', metadatos.nombreArticulo || metadatos.descripcion || '');

  // 4. Obtener token de Supabase para autenticación si existe
  const headers = {};
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // Si no hay sesión, continúa (el backend acepta peticiones en modo seguro o con clave)
  }

  // 5. Enviar al endpoint de la VPS
  const endpoint = `${VPS_API_URL.replace(/\/+$/, '')}/api/upload`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.error || `Error del servidor VPS (${res.status})`);
    }

    const data = await res.json();
    return {
      success: true,
      url: data.url,
      filename: data.filename || nombreSanitario,
      size: data.size || archivoFinal.size
    };
  } catch (error) {
    console.error(`[uploadService] Falló subida a VPS (${endpoint}):`, error.message);
    throw new Error(`Error al guardar archivo en el servidor VPS: ${error.message}`);
  }
}

