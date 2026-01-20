const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tidyup', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveApiKey: (apiKey) => ipcRenderer.invoke('save-api-key', apiKey),
  scanFolder: (folderPath) => ipcRenderer.invoke('scan-folder', folderPath),
  analyzeFiles: (files, apiKey) => ipcRenderer.invoke('analyze-files', files, apiKey),
  executeMoves: (moves, baseFolder) => ipcRenderer.invoke('execute-moves', moves, baseFolder),
  undoLast: () => ipcRenderer.invoke('undo-last'),
  getHistoryCount: () => ipcRenderer.invoke('get-history-count')
});
