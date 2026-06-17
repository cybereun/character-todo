const { app, BrowserWindow, Menu, Tray, ipcMain, screen } = require('electron');
const fs = require('fs');
const path = require('path');

const WINDOW_SIZE = {
  collapsed: { width: 290, height: 230 },
  expanded: { width: 410, height: 575 }
};

let mainWindow;
let tray;
let expanded = false;

const gotSingleInstanceLock = app.requestSingleInstanceLock();

function enableAutoLaunch() {
  if (!app.isPackaged || process.platform !== 'win32') return;

  app.setLoginItemSettings({
    name: 'Character Todo',
    openAtLogin: true,
    openAsHidden: false,
    path: process.execPath,
    args: []
  });
}

function getAppIconPath() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
  if (fs.existsSync(iconPath)) return iconPath;
  return path.join(__dirname, '..', 'assets', 'character-slim.png');
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function clampBounds(bounds) {
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;
  return {
    x: clamp(bounds.x, area.x, area.x + area.width - bounds.width),
    y: clamp(bounds.y, area.y, area.y + area.height - bounds.height),
    width: bounds.width,
    height: bounds.height
  };
}

function getVisibleRect(bounds) {
  if (expanded) {
    return bounds;
  }

  return {
    x: bounds.x + WINDOW_SIZE.expanded.width - WINDOW_SIZE.collapsed.width,
    y: bounds.y + WINDOW_SIZE.expanded.height - WINDOW_SIZE.collapsed.height,
    ...WINDOW_SIZE.collapsed
  };
}

function clampWindowByVisibleRect(bounds) {
  const visible = getVisibleRect(bounds);
  const display = screen.getDisplayMatching(visible);
  const area = display.workArea;
  const clampedVisible = {
    ...visible,
    x: clamp(visible.x, area.x, area.x + area.width - visible.width),
    y: clamp(visible.y, area.y, area.y + area.height - visible.height)
  };

  if (expanded) {
    return clampedVisible;
  }

  return {
    ...bounds,
    x: clampedVisible.x - (WINDOW_SIZE.expanded.width - WINDOW_SIZE.collapsed.width),
    y: clampedVisible.y - (WINDOW_SIZE.expanded.height - WINDOW_SIZE.collapsed.height)
  };
}

function setExpandedState(nextExpanded) {
  if (!mainWindow || expanded === nextExpanded) return;
  expanded = nextExpanded;

  if (expanded) {
    const current = mainWindow.getBounds();
    mainWindow.setBounds(clampBounds(current), false);
  }
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function hideMainWindow() {
  if (mainWindow) mainWindow.hide();
}

function createTray() {
  if (tray) return;

  tray = new Tray(getAppIconPath());
  tray.setToolTip('Character Todo');
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: '열기',
      click: showMainWindow
    },
    {
      label: '숨기기',
      click: hideMainWindow
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => app.quit()
    }
  ]));
  tray.on('click', showMainWindow);
  tray.on('double-click', showMainWindow);
}

function createWindow() {
  expanded = false;
  const size = WINDOW_SIZE.expanded;
  const area = screen.getPrimaryDisplay().workArea;

  mainWindow = new BrowserWindow({
    width: size.width,
    height: size.height,
    x: area.x + area.width - size.width - 18,
    y: area.y + area.height - size.height - 18,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    movable: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    hasShadow: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.setAlwaysOnTop(false);
  mainWindow.setVisibleOnAllWorkspaces(false);

  mainWindow.webContents.on('context-menu', () => {
    Menu.buildFromTemplate([
      {
        label: '종료',
        click: () => app.quit()
      }
    ]).popup({ window: mainWindow });
  });
  mainWindow.on('blur', () => {
    mainWindow.setAlwaysOnTop(false);
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', showMainWindow);

  app.whenReady().then(() => {
    enableAutoLaunch();
    createWindow();
    createTray();

    app.on('activate', () => {
      showMainWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('widget:set-expanded', (_event, nextExpanded) => {
  setExpandedState(Boolean(nextExpanded));
});

ipcMain.handle('widget:move-by', (_event, delta) => {
  if (!mainWindow) return;

  const current = mainWindow.getBounds();
  mainWindow.setBounds(
    clampWindowByVisibleRect({
      ...current,
      x: current.x + Math.round(delta.dx),
      y: current.y + Math.round(delta.dy)
    }),
    false
  );
});
