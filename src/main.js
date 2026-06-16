const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron');
const path = require('path');

const WINDOW_SIZE = {
  collapsed: { width: 290, height: 230 },
  expanded: { width: 410, height: 575 }
};

let mainWindow;
let expanded = false;

function enableAutoLaunch() {
  if (!app.isPackaged || process.platform !== 'win32') return;

  app.setLoginItemSettings({
    openAtLogin: true,
    path: process.execPath
  });
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
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.webContents.on('context-menu', () => {
    Menu.buildFromTemplate([
      {
        label: '종료',
        click: () => app.quit()
      }
    ]).popup({ window: mainWindow });
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  enableAutoLaunch();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

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
