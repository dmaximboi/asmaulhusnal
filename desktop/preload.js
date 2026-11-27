const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('asmaDesktop', {
  cursor: () => ipcRenderer.invoke('cursor'),
  ignore: v => ipcRenderer.send('ignore', !!v),
  show: () => ipcRenderer.send('show'),
  openApp: () => ipcRenderer.send('openApp'),
  openUrl: u => ipcRenderer.send('openUrl', String(u || '')),
  holdAwake: on => ipcRenderer.send('holdAwake', !!on),
  ipLocation: () => ipcRenderer.invoke('ipLocation'),
  setIsland: o => ipcRenderer.send('setIsland', o || {}),
  getIslandCfg: () => ipcRenderer.invoke('getIslandCfg'),
  onIslandCfg: cb => { ipcRenderer.on('islandCfg', (e, o) => { try { cb(o); } catch (err) { /* ignore */ } }); }
});
