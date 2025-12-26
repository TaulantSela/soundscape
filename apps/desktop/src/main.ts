import path from 'node:path';
import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, shell } from 'electron';
import { appConfig } from './config';
import { buildAppUrl } from '@soundscape/config';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;

const isDev = !app.isPackaged;
const devServerUrl = process.env.SOUNDSCAPE_DEV_SERVER ?? 'http://localhost:3000';
const trayIcon = nativeImage.createFromDataURL(
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAYAAAA71pVKAAAAVElEQVR4nGNgGAWjYBSMAgMD4/9vBIg3GSmGEGqCKYRmM9ASyKKB2GQgqYNIquClINkCUhVUg2QJSHlCFYf8L0m0AXIBqgWQG0nUgJINoHoQQBAMM0bYoY3UKAAAAAElFTkSuQmCC'
);

function resolveAppUrl() {
  if (isDev) {
    return devServerUrl;
  }

  if (appConfig.appUrl) {
    return buildAppUrl(appConfig, '/');
  }

  const fallback = appConfig.apiBaseUrl ?? devServerUrl;
  console.warn('[desktop] Falling back to API url for renderer:', fallback);
  return fallback;
}

async function createWindow() {
  const startUrl = resolveAppUrl();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: 'Soundscape Mixer',
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: isDev
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
    if (isDev) {
      mainWindow?.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  await mainWindow.loadURL(startUrl);
}

function createTray() {
  if (tray) {
    return;
  }

  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Soundscape Mixer');

  const template = Menu.buildFromTemplate([
    {
      label: 'Show Mixer',
      click: () => {
        mainWindow?.show();
      }
    },
    {
      label: 'Hide Mixer',
      click: () => {
        mainWindow?.hide();
      }
    },
    { type: 'separator' },
    {
      label: 'Toggle Play/Pause',
      click: () => dispatchToggle()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        quitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(template);
  tray.on('click', () => {
    if (!mainWindow) {
      void createWindow();
      return;
    }

    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });
}

function dispatchToggle() {
  mainWindow?.webContents.send('soundscape:toggle-play');
}

app.on('before-quit', () => {
  quitting = true;
});

app.on('ready', async () => {
  await createWindow();
  createTray();
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  } else {
    mainWindow?.show();
  }
});

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') {
    return;
  }
  app.quit();
});

ipcMain.on('soundscape:toggle-play-request', () => {
  dispatchToggle();
});
