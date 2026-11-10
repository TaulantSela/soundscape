import path from 'node:path';
import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, shell } from 'electron';
import { buildAppUrl } from '@soundscape/config';
import { appConfig } from './config';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;

const isDev = !app.isPackaged;
const devServerUrl = process.env.SOUNDSCAPE_DEV_SERVER ?? 'http://localhost:3000';
const trayIcon = nativeImage.createFromDataURL(
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAYAAAA71pVKAAAAVElEQVR4nGNgGAWjYBSMAgMD4/9vBIg3GSmGEGqCKYRmM9ASyKKB2GQgqYNIquClINkCUhVUg2QJSHlCFYf8L0m0AXIBqgWQG0nUgJINoHoQQBAMM0bYoY3UKAAAAAElFTkSuQmCC'
);

/** The renderer is the web app: the local dev server, or the deployed site. */
function resolveAppUrl() {
  return isDev ? devServerUrl : buildAppUrl(appConfig, '/');
}

const appOrigin = new URL(resolveAppUrl()).origin;

function isWebUrl(url: string) {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/** Open links in the user's browser, and only ordinary web links. */
function openExternally(url: string) {
  if (isWebUrl(url)) {
    void shell.openExternal(url);
  }
}

async function createWindow() {
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
      devTools: isDev,
      // The tray's Play/Pause is not a gesture inside the page, so let the
      // page start audio without one.
      autoplayPolicy: 'no-user-gesture-required'
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
    openExternally(url);
    return { action: 'deny' };
  });

  // The window (and its preload bridge) must only ever show the mixer itself.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== appOrigin) {
      event.preventDefault();
      openExternally(url);
    }
  });

  await mainWindow.loadURL(resolveAppUrl());
}

function showWindow() {
  if (!mainWindow) {
    void createWindow();
    return;
  }
  mainWindow.show();
}

function createTray() {
  if (tray) {
    return;
  }

  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Soundscape Mixer');

  const template = Menu.buildFromTemplate([
    { label: 'Show Mixer', click: showWindow },
    { label: 'Hide Mixer', click: () => mainWindow?.hide() },
    { type: 'separator' },
    { label: 'Toggle Play/Pause', click: () => dispatchToggle() },
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
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      showWindow();
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

app.on('activate', () => {
  showWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.on('soundscape:toggle-play-request', () => {
  dispatchToggle();
});
