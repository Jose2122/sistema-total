/**
 * Utilidad de compresión de imágenes en el cliente (Frontend)
 * SITC - Sistema Integrado Total Clean
 * 
 * Requisitos de optimización:
 * - Formato WebP (o JPEG como fallback)
 * - Calidad: 0.75
 * - Ancho / Alto máximo: 1280px
 * - Peso objetivo: <= 250 - 300 KB conservando legibilidad nítida de textos en facturas
 * - Pass-through intacto para PDFs y archivos no-imagen
 */

export async function compressImage(fileOrBlob, options = {}) {
  const {
    maxWidth = 1280,
    maxHeight = 1280,
    quality = 0.75,
    targetMaxKB = 300
  } = options;

  // Si no es un archivo o no es imagen, o es un PDF, no se toca
  if (!fileOrBlob || !fileOrBlob.type || !fileOrBlob.type.startsWith('image/')) {
    return fileOrBlob;
  }

  // Si es GIF animado, preservar sin alterar
  if (fileOrBlob.type === 'image/gif') {
    return fileOrBlob;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(fileOrBlob);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calcular escalado preservando relación de aspecto
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false });

        // Fondo blanco para evitar transparencias oscuras al convertir PNG a WebP/JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Detectar si el navegador soporta WebP en canvas
        const formatMime = 'image/webp';

        const exportBlob = (calidad) => {
          return new Promise((resBlob) => {
            canvas.toBlob(
              (blob) => {
                if (blob && blob.type === formatMime) {
                  resBlob(blob);
                } else {
                  // Fallback a JPEG si WebP no produjo el tipo esperado
                  canvas.toBlob(
                    (jpegBlob) => resBlob(jpegBlob || blob),
                    'image/jpeg',
                    calidad
                  );
                }
              },
              formatMime,
              calidad
            );
          });
        };

        exportBlob(quality).then(async (blob) => {
          if (!blob) {
            resolve(fileOrBlob);
            return;
          }

          let finalBlob = blob;
          // Paso adaptativo: si supera el peso objetivo de 300 KB, comprimir con calidad 0.65
          if (finalBlob.size > targetMaxKB * 1024 && quality > 0.65) {
            const secondPassBlob = await exportBlob(0.65);
            if (secondPassBlob && secondPassBlob.size < finalBlob.size) {
              finalBlob = secondPassBlob;
            }
          }

          // Si el archivo original era menor que el comprimido, usar el original
          if (fileOrBlob.size && finalBlob.size >= fileOrBlob.size) {
            resolve(fileOrBlob);
            return;
          }

          if (fileOrBlob instanceof File) {
            const ext = finalBlob.type === 'image/webp' ? 'webp' : 'jpg';
            const originalName = fileOrBlob.name || 'soporte';
            const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
            const newName = `${baseName}.${ext}`;

            const compressedFile = new File([finalBlob], newName, {
              type: finalBlob.type,
              lastModified: Date.now()
            });

            console.log(
              `[Compresor SITC] "${fileOrBlob.name}" (${(fileOrBlob.size / 1024).toFixed(1)} KB) -> "${compressedFile.name}" (${(compressedFile.size / 1024).toFixed(1)} KB) [-${Math.round((1 - compressedFile.size / fileOrBlob.size) * 100)}%]`
            );

            resolve(compressedFile);
          } else {
            resolve(finalBlob);
          }
        }).catch((err) => {
          console.warn('[Compresor SITC] Error en compresión, usando archivo original:', err);
          resolve(fileOrBlob);
        });
      };

      img.onerror = () => resolve(fileOrBlob);
    };

    reader.onerror = () => resolve(fileOrBlob);
  });
}
