const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Configuración de rutas portables
// process.cwd() en una app de Electron empaquetada apunta a la carpeta del ejecutable
const baseDir = app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd();
const dataDir = path.join(baseDir, 'data');
const facturasDir = path.join(baseDir, 'facturas');
const afipResDir = path.join(baseDir, 'afip_res');

// Asegurar que existan las carpetas necesarias
[dataDir, facturasDir, afipResDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configurar variables de entorno para el backend portable
const dbPath = path.join(dataDir, 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.PORTABLE_EXECUTABLE_DIR = baseDir;
process.env.NODE_ENV = 'production';

// Importar e iniciar el backend (Express)
// Asumimos que el backend compilado estará en una carpeta accesible
try {
  // En producción, el backend estará dentro de resources o en el mismo ASAR
  // Para simplificar la integración inicial, lo requerimos directamente
  require('./backend-dist/index.js');
  console.log('Backend iniciado correctamente en modo portable');
} catch (err) {
  console.error('Error al iniciar el backend:', err);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1300,
    height: 900,
    title: "Mascolo Facturador",
    icon: path.join(__dirname, 'public/logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Maximizar por defecto para mejor legibilidad industrial
  win.maximize();

  // En desarrollo carga el servidor de Vite, en producción el archivo index.html
  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
