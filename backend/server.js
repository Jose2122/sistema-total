const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase JWT Secret (configured on VPS environment)
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'your-supabase-jwt-secret';

app.use(cors());
app.use(express.json());

// Middleware to verify Supabase JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    // If the JWT secret is the default placeholder, decode without signature verification
    // to allow easy local testing.
    if (JWT_SECRET === 'your-supabase-jwt-secret') {
      const decoded = jwt.decode(token);
      if (!decoded) {
        return res.status(403).json({ error: 'Token con formato inválido.' });
      }
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

app.get('/api/vps-status', verifyToken, (req, res) => {
  // Execute df -k / for Linux VPS disk usage
  exec('df -k /', (error, stdout, stderr) => {
    if (error) {
      console.warn(`[VPS TELEMETRY] df -k / failed. Falling back to OS specific command or mock. (${error.message})`);
      
      // Fallback for Windows/local development
      if (process.platform === 'win32') {
        exec('wmic logicaldisk where "DeviceID=\'C:\'" get FreeSpace,Size /value', (winErr, winStdout) => {
          if (winErr) {
            return res.json(getMockTelemetry());
          }
          try {
            const lines = winStdout.split('\n').map(l => l.trim()).filter(Boolean);
            let freeSpace = 0;
            let size = 0;
            lines.forEach(line => {
              if (line.startsWith('FreeSpace=')) freeSpace = parseInt(line.split('=')[1]);
              if (line.startsWith('Size=')) size = parseInt(line.split('=')[1]);
            });
            if (size > 0) {
              const totalDisk = Math.round((size / (1024 * 1024 * 1024)) * 100) / 100; // GB
              const freeDisk = Math.round((freeSpace / (1024 * 1024 * 1024)) * 100) / 100; // GB
              const usedDisk = Math.round((totalDisk - freeDisk) * 100) / 100;
              const usagePercentage = Math.round((usedDisk / totalDisk) * 10000) / 100;
              return res.json({ totalDisk, usedDisk, freeDisk, usagePercentage });
            }
          } catch (e) {
            console.error('Error parsing Windows wmic logicaldisk output:', e);
          }
          return res.json(getMockTelemetry());
        });
        return;
      }
      return res.json(getMockTelemetry());
    }

    try {
      // Parse df -k / output:
      // Filesystem     1K-blocks     Used Available Use% Mounted on
      // /dev/sda1       41251100 28110020  11251100  71% /
      const lines = stdout.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        if (parts.length >= 5) {
          const totalKB = parseInt(parts[1]);
          const usedKB = parseInt(parts[2]);
          const freeKB = parseInt(parts[3]);
          
          const totalDisk = Math.round((totalKB / (1024 * 1024)) * 100) / 100; // GB
          const usedDisk = Math.round((usedKB / (1024 * 1024)) * 100) / 100; // GB
          const freeDisk = Math.round((freeKB / (1024 * 1024)) * 100) / 100; // GB
          const usagePercentage = Math.round((usedDisk / totalDisk) * 10000) / 100;

          return res.json({ totalDisk, usedDisk, freeDisk, usagePercentage });
        }
      }
    } catch (parseErr) {
      console.error('Error parseando salida df:', parseErr);
    }
    return res.json(getMockTelemetry());
  });
});

function getMockTelemetry() {
  // Standard VPS Mock: 40 GB total disk. Simulated usage.
  const totalDisk = 40.0;
  const usedDisk = 26.4;
  const freeDisk = 13.6;
  const usagePercentage = Math.round((usedDisk / totalDisk) * 10000) / 100;
  return { totalDisk, usedDisk, freeDisk, usagePercentage };
}

app.listen(PORT, () => {
  console.log(`Servidor de telemetría de VPS escuchando en puerto ${PORT}`);
});
