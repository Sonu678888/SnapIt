// Platform implementation for Electron Desktop App
// Implements the Platform interface defined in platform.js

class PlatformElectron extends Platform {
    constructor() {
        super();
        this.electronAPI = window.electronAPI;

        if (!this.electronAPI) {
            console.error('Electron API not available. Make sure preload.js is loaded correctly.');
        }
    }

    // Window Management
    async openWindow(config) {
        try {
            const result = await this.electronAPI.openWindow(config);
            return result;
        } catch (error) {
            console.error('Failed to open window:', error);
            throw error;
        }
    }

    async closeWindow() {
        try {
            await this.electronAPI.closeWindow();
        } catch (error) {
            console.error('Failed to close window:', error);
            throw error;
        }
    }

    // Storage
    async storageGet(keys) {
        try {
            const result = await this.electronAPI.storageGet(keys);
            return result;
        } catch (error) {
            console.error('Failed to get storage:', error);
            return {};
        }
    }

    async storageSet(data) {
        try {
            await this.electronAPI.storageSet(data);
        } catch (error) {
            console.error('Failed to set storage:', error);
            throw error;
        }
    }

    async storageRemove(keys) {
        try {
            await this.electronAPI.storageRemove(keys);
        } catch (error) {
            console.error('Failed to remove storage:', error);
            throw error;
        }
    }

    onStorageChanged(callback) {
        // Desktop app storage changes happen within the same process
        // We'll listen for IPC events from main process
        const cleanup = this.electronAPI.onStorageChanged((data) => {
            // Transform data into Chrome-compatible changes format
            const changes = {};
            Object.keys(data).forEach(key => {
                changes[key] = {
                    newValue: data[key],
                    oldValue: undefined
                };
            });
            callback(changes);
        });
        return cleanup;
    }

    // Downloads
    async download(dataUrl, filename) {
        try {
            const result = await this.electronAPI.downloadFile(dataUrl, filename);
            if (result.success) {
                console.log('File saved to:', result.path);
            }
            return result;
        } catch (error) {
            console.error('Failed to download file:', error);
            throw error;
        }
    }

    // Messaging (not needed for desktop app, but required by interface)
    async sendMessageToActivePage(message) {
        // Desktop app doesn't have "active page" concept like browser extension
        // This is a stub implementation
        console.warn('sendMessageToActivePage not implemented for Electron');
        return { success: false, message: 'Not supported in desktop app' };
    }

    onMessage(callback) {
        // Desktop app doesn't need cross-context messaging like browser extension
        // This is a stub implementation
        console.warn('onMessage not implemented for Electron');
        return () => { }; // Return empty cleanup function
    }

    // Platform info
    getPlatformName() {
        return 'electron';
    }

    isExtension() {
        return false;
    }

    isDesktopApp() {
        return true;
    }
}

// Initialize platform instance
if (typeof window !== 'undefined' && window.electronAPI) {
    window.platform = new PlatformElectron();
    console.log('Platform initialized: Electron Desktop App');
}
