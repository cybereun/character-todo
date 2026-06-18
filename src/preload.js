const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('characterTodo', {
  setExpanded: (expanded) => ipcRenderer.invoke('widget:set-expanded', expanded),
  moveBy: (dx, dy) => ipcRenderer.invoke('widget:move-by', { dx, dy }),
  loadTodos: () => ipcRenderer.invoke('todos:load'),
  saveTodos: (todos) => ipcRenderer.invoke('todos:save', todos)
});
