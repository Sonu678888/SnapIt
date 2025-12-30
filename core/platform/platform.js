// Platform abstraction interface
// Implementations: platform-chrome.js (Chrome Extension), platform-electron.js (Desktop App)

class Platform {
    // Window Management
    async openWindow(config) {
        throw new Error('Not implemented');
    }

    async closeWindow() {
        throw new Error('Not implemented');
    }

    // Storage
    async storageGet(keys) {
        throw new Error('Not implemented');
    }

    async storageSet(data) {
        throw new Error('Not implemented');
    }

    async storageRemove(keys) {
        throw new Error('Not implemented');
    }

    onStorageChanged(callback) {
        throw new Error('Not implemented');
    }

    // Downloads
    async download(dataUrl, filename) {
        throw new Error('Not implemented');
    }

    // Messaging (for webpage attachment feature)
    async sendMessageToActivePage(message) {
        throw new Error('Not implemented');
    }

    onMessage(callback) {
        throw new Error('Not implemented');
    }

    // Platform info
    getPlatformName() {
        throw new Error('Not implemented');
    }

    isExtension() {
        return false;
    }

    isDesktopApp() {
        return false;
    }
}

// Global platform instance (set by platform-specific loader)
window.platform = null;
