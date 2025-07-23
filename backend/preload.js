//IPC. Inter Process Communicacation, tra main e preload
//Ponte tra backend e frontend
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  updateTask: (task) => ipcRenderer.invoke('update-task', task),
  resetDatabase: () => ipcRenderer.invoke('reset-database')
});
