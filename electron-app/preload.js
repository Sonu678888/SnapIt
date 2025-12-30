const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Storage operations
    storageGet: (keys) => ipcRenderer.invoke('storage-get', keys),
    storageSet: (data) => ipcRenderer.invoke('storage-set', data),
    storageRemove: (keys) => ipcRenderer.invoke('storage-remove', keys),

    // Window management
    openWindow: (config) => ipcRenderer.invoke('open-window', config),
    closeWindow: () => ipcRenderer.invoke('close-window'),

    // Download
    downloadFile: (dataUrl, filename) => ipcRenderer.invoke('download-file', { dataUrl, filename }),

    // Clipboard
    writeImageToClipboard: (dataUrl) => ipcRenderer.invoke('write-clipboard', dataUrl),

    // Platform info
    getPlatformInfo: () => ipcRenderer.invoke('get-platform-info'),

    // Storage change listener
    onStorageChanged: (callback) => {
        const listener = (event, changes) => {
            callback(changes);
        };

        ipcRenderer.on('storage-changed', listener);

        // Return cleanup function
        return () => {
            ipcRenderer.removeListener('storage-changed', listener);
        };
    },

    // State reset listener (when window is hidden)
    onResetState: (callback) => {
        ipcRenderer.on('reset-state', callback);
    }
});
