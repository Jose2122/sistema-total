const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuración de almacenamiento persistente en VPS Linux o local
const DEFAULT_UPLOADS_DIR = process.platform === 'linux' ? '/var/www/sitc/uploads' : path.join(__dirname, 'uploads');
const UPLOADS_DIR = process.env.UPLOADS_DIR || DEFAULT_UPLOADS_DIR;

// URL pública para servir los archivos
const PUBLIC_UPLOADS_URL = process.env.PUBLIC_UPLOADS_URL || 'https://sitc.totalclean.com.ve/uploads';

// Supabase JWT Secret (configurado en VPS o fallback permisivo en dev)
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'your-supabase-jwt-secret';
const UPLOAD_API_KEY = process.env.UPLOAD_API_KEY || 'sitc-storage-secret-key-2026';

// Asegurar existencia del directorio de uploads
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log(`[STORAGE VPS] Directorio de uploads creado en: ${UPLOADS_DIR}`);
  }
} catch (e) {
  console.error(`[STORAGE VPS] Error al crear directorio ${UPLOADS_DIR}:`, e.message);
}

// Configuración de CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-upload-key']
}));

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Servir archivos estáticos directamente desde /uploads
app.use('/uploads', express.static(UPLOADS_DIR, {
  maxAge: '30d',
  immutable: true,
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=2592000, no-transform');
  }
}));

// Función de sanitización para nomenclatura sanitaria: id_requisicion_NroFactura_nombreArticulo.ext
function sanitizarCadena(str) {
  if (!str) return '';
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    .replace(/\s+/g, '_')           // Espacios a guión bajo
    .replace(/[^a-zA-Z0-9_-]/g, '') // Quitar caracteres especiales
    .slice(0, 50);                  // Longitud prudencial
}

// Configuración de Multer para almacenamiento en disco
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    
    // Parámetros de nomenclatura sanitaria enviados en el body
    const reqId = sanitizarCadena(req.body.requisicion_id || req.body.id_requisicion || req.body.reqId || req.body.ticket_id);
    const nroDoc = sanitizarCadena(req.body.nro_factura || req.body.nroFactura || req.body.docNumero || 'SINDOC');
    const articulo = sanitizarCadena(req.body.nombre_articulo || req.body.nombreArticulo || req.body.descripcion || 'Soporte');

    let finalName = '';

    if (reqId) {
      // Estricta nomenclatura: id_requisicion_NroFactura_nombreArticulo.ext
      finalName = `${reqId}_${nroDoc}_${articulo}${ext}`;
    } else {
      // Si el cliente ya envió un nombre sanitizado en el archivo
      const cleanOriginal = sanitizarCadena(path.basename(file.originalname, ext));
      finalName = `${cleanOriginal || 'archivo'}_${Date.now()}${ext}`;
    }

    // Evitar sobreescrituras si el archivo ya existe
    const fullPath = path.join(UPLOADS_DIR, finalName);
    if (fs.existsSync(fullPath)) {
      const baseSinExt = path.basename(finalName, ext);
      finalName = `${baseSinExt}_${Date.now()}${ext}`;
    }

    cb(null, finalName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20 MB máx
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido (${file.mimetype}). Solo se aceptan PDFs e imágenes.`));
    }
  }
});

// Middleware de verificación de acceso para subidas
const verifyUploadAccess = (req, res, next) => {
  const apiKey = req.headers['x-upload-key'];
  if (apiKey && apiKey === UPLOAD_API_KEY) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Si no hay token en desarrollo local, permitir con aviso
    if (process.env.NODE_ENV !== 'production' || JWT_SECRET === 'your-supabase-jwt-secret') {
      return next();
    }
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    if (JWT_SECRET === 'your-supabase-jwt-secret') {
      const decoded = jwt.decode(token);
      if (!decoded) return res.status(403).json({ error: 'Token con formato inválido.' });
      req.user = decoded;
    } else {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    }
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido o expirado.' });
  }
};

// ============================================================================
// ENDPOINT: POST /api/upload (Almacenamiento de Facturas y Soportes en VPS)
// ============================================================================
app.post('/api/upload', verifyUploadAccess, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo en el campo "file".' });
    }

    const filename = req.file.filename;
    const publicUrl = `${PUBLIC_UPLOADS_URL.replace(/\/+$/, '')}/${filename}`;

    console.log(`[STORAGE VPS] Archivo recibido con éxito: "${filename}" (${(req.file.size / 1024).toFixed(1)} KB) -> ${publicUrl}`);

    return res.status(200).json({
      success: true,
      url: publicUrl,
      filename: filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (err) {
    console.error('[STORAGE VPS] Error procesando upload:', err);
    return res.status(500).json({ error: 'Error interno guardando archivo en VPS: ' + err.message });
  }
});

// ============================================================================
// ENDPOINT: GET /api/vps-status (Telemetría de disco del VPS)
// ============================================================================
app.get('/api/vps-status', (req, res) => {
  exec('df -k /', (error, stdout) => {
    if (error) {
      // Fallback para Windows en local
      if (process.platform === 'win32') {
        exec('wmic logicaldisk where "DeviceID=\'C:\'" get FreeSpace,Size /value', (winErr, winStdout) => {
          if (winErr) return res.json(getMockTelemetry());
          try {
            const lines = winStdout.split('\n').map(l => l.trim()).filter(Boolean);
            let freeSpace = 0;
            let size = 0;
            lines.forEach(line => {
              if (line.startsWith('FreeSpace=')) freeSpace = parseInt(line.split('=')[1], 10);
              if (line.startsWith('Size=')) size = parseInt(line.split('=')[1], 10);
            });
            if (size > 0) {
              const totalDisk = Math.round((size / (1024 * 1024 * 1024)) * 100) / 100;
              const freeDisk = Math.round((freeSpace / (1024 * 1024 * 1024)) * 100) / 100;
              const usedDisk = Math.round((totalDisk - freeDisk) * 100) / 100;
              const usagePercentage = Math.round((usedDisk / totalDisk) * 10000) / 100;
              return res.json({ totalDisk, usedDisk, freeDisk, usagePercentage });
            }
          } catch (e) {
            console.error('Error parseando Windows disk:', e);
          }
          return res.json(getMockTelemetry());
        });
        return;
      }
      return res.json(getMockTelemetry());
    }

    try {
      const lines = stdout.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        if (parts.length >= 5) {
          const totalKB = parseInt(parts[1], 10);
          const usedKB = parseInt(parts[2], 10);
          const freeKB = parseInt(parts[3], 10);

          const totalDisk = Math.round((totalKB / (1024 * 1024)) * 100) / 100;
          const usedDisk = Math.round((usedKB / (1024 * 1024)) * 100) / 100;
          const freeDisk = Math.round((freeKB / (1024 * 1024)) * 100) / 100;
          const usagePercentage = Math.round((usedDisk / totalDisk) * 10000) / 100;

          return res.json({ totalDisk, usedDisk, freeDisk, usagePercentage });
        }
      }
    } catch (parseErr) {
      console.error('Error parseando df:', parseErr);
    }
    return res.json(getMockTelemetry());
  });
});

function getMockTelemetry() {
  const totalDisk = 40.0;
  const usedDisk = 8.5;
  const freeDisk = 31.5;
  const usagePercentage = Math.round((usedDisk / totalDisk) * 10000) / 100;
  return { totalDisk, usedDisk, freeDisk, usagePercentage };
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uploadsDir: UPLOADS_DIR,
    publicUrl: PUBLIC_UPLOADS_URL,
    timestamp: new Date().toISOString()
  });
});

// Manejador de errores de Multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo excede el límite máximo permitido de 20MB.' });
    }
    return res.status(400).json({ error: 'Error de subida: ' + err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`[BACKEND SITC] Servidor escuchando en puerto ${PORT}`);
  console.log(`[BACKEND SITC] Carpeta de uploads: ${UPLOADS_DIR}`);
  console.log(`[BACKEND SITC] URL pública: ${PUBLIC_UPLOADS_URL}`);
});
