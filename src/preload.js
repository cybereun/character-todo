const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('characterTodo', {
  setExpanded: (expanded) => ipcRenderer.invoke('widget:set-expanded', expanded),
  moveBy: (dx, dy) => ipcRenderer.invoke('widget:move-by', { dx, dy })
});
