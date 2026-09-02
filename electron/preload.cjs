const { contextBridge, ipcRenderer } = require('electron');

// Ponte mínima entre o jogo (renderer) e o disco. Nada mais que isto fica exposto.
contextBridge.exposeInMainWorld('wb2', {
  nativo: true,
  saves: {
    listar: () => ipcRenderer.invoke('save:listar'),
    gravar: (nome, texto) => ipcRenderer.invoke('save:gravar', nome, texto),
    ler: (nome) => ipcRenderer.invoke('save:ler', nome),
    apagar: (nome) => ipcRenderer.invoke('save:apagar', nome),
    pasta: () => ipcRenderer.invoke('app:pastaSaves'),
  },
  erroFatal: (mensagem) => ipcRenderer.invoke('app:erroFatal', mensagem),
});
