/**
 * Utility to compress images on the client side using HTML5 Canvas.
 * Resizes images to a maximum of 1200px (width/height) and compresses quality to 80% JPEG.
 * Non-image files (e.g., PDFs) are returned untouched.
 * 
 * @param {File|Blob} fileOrBlob The file or blob to compress.
 * @param {Object} [options] Optional configuration.
 * @param {number} [options.maxWidth=1200] Maximum width of the compressed image.
 * @param {number} [options.maxHeight=1200] Maximum height of the compressed image.
 * @param {number} [options.quality=0.8] Compression quality (0.0 to 1.0).
 * @returns {Promise<File|Blob>} A promise that resolves to the compressed File or Blob.
 */
export function compressImage(fileOrBlob, options = {}) {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.8
  } = options;

  // Verify it is a file/blob and has an image mime type
  if (!fileOrBlob || !fileOrBlob.type || !fileOrBlob.type.startsWith('image/')) {
    return Promise.resolve(fileOrBlob); // Pass-through for PDFs, text files, etc.
  }

  // Handle GIF files (canvas export converts GIFs to static JPEGs, which destroys animation).
  // Let's pass GIFs through unmodified to preserve their animations.
  if (fileOrBlob.type === 'image/gif') {
    return Promise.resolve(fileOrBlob);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(fileOrBlob);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio and new dimensions
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

        // Draw image onto canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(fileOrBlob); // Fallback to original if export fails
              return;
            }

            // If input was a File, reconstruct it as a File preserving metadata
            if (fileOrBlob instanceof File) {
              // Convert PNG or other image types to .jpg filename extension
              let newName = fileOrBlob.name;
              const extIndex = newName.lastIndexOf('.');
              if (extIndex !== -1) {
                const baseName = newName.substring(0, extIndex);
                newName = `${baseName}.jpg`;
              } else {
                newName = `${newName}.jpg`;
              }

              const compressedFile = new File([blob], newName, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              
              // Only return compressed file if it is actually smaller than the original
              if (compressedFile.size < fileOrBlob.size) {
                resolve(compressedFile);
              } else {
                resolve(fileOrBlob);
              }
            } else {
              // If input was a raw Blob, return the compressed Blob
              resolve(blob);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => {
        console.error('[Image Compressor] Failed to load image element:', err);
        resolve(fileOrBlob); // Fail-safe fallback
      };
    };
    reader.onerror = (err) => {
      console.error('[Image Compressor] Failed to read file reader:', err);
      resolve(fileOrBlob); // Fail-safe fallback
    };
  });
}
