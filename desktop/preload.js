const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('asmaDesktop', {
  cursor: () => ipcRenderer.invoke('cursor'),
  ignore: v => ipcRenderer.send('ignore', !!v),
  show: () => ipcRenderer.send('show'),
  openApp: () => ipcRenderer.send('openApp'),
  ipLocation: () => ipcRenderer.invoke('ipLocation')
});
