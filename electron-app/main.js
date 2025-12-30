const { app, BrowserWindow, session, ipcMain, globalShortcut, screen, Menu } = require('electron');
const path = require('path');
const Store = require('electron-store');

// Initialize electron-store for persistent storage
const store = new Store();

// Ensure only one instance of the app runs at a time
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    console.log('Another instance is already running. Quitting this instance.');
    app.quit();
} else {
    // Handle second instance attempt - focus existing window
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        console.log('Second instance detected, focusing existing window');
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

let mainWindow = null;
let captureWindow = null;

function createMainWindow() {
    // Get the display where the cursor is currently located
    const cursorPoint = screen.getCursorScreenPoint();
    const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
    const { bounds } = activeDisplay;

    // Window dimensions - increased for better visibility
    const windowWidth = 540;
    const windowHeight = 720;

    // Calculate centered position on active display
    const x = Math.round(bounds.x + (bounds.width - windowWidth) / 2);
    const y = Math.round(bounds.y + (bounds.height - windowHeight) / 2);

    mainWindow = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        x: x,
        y: y,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            // Enable web APIs like getUserMedia
            enableRemoteModule: false
        },
        title: 'SnapIt - Document Capture',
        // Optional: Set app icon (uncomment when icon is available)
        // icon: path.join(__dirname, '../icons/icon-128.png')
    });

    // Load the popup.html from core/ui
    mainWindow.loadFile(path.join(__dirname, '../core/ui/popup.html'));

    // Open DevTools in development (optional)
    if (process.argv.includes('--enable-logging')) {
        mainWindow.webContents.openDevTools();
    }

    // Hide window on close (don't quit app - keep shortcut working)
    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();

            // Reset state before hiding - ensures fresh start on reopen
            mainWindow.webContents.send('reset-state');

            mainWindow.hide();

            // On macOS, hide from dock
            if (process.platform === 'darwin') {
                app.dock.hide();
            }
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function createMenu() {
    const template = [
        {
            label: 'SnapIt',
            submenu: [
                {
                    label: 'About SnapIt',
                    role: 'about'
                },
                { type: 'separator' },
                {
                    label: 'Quit SnapIt',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        app.isQuitting = true;
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function createCaptureWindow(config) {
    // Close existing capture window if open
    if (captureWindow) {
        captureWindow.close();
    }

    captureWindow = new BrowserWindow({
        width: config.width || 1400,
        height: config.height || 900,
        x: config.left,
        y: config.top,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        title: 'SnapIt - Camera Capture'
    });

    // Load the capture.html from core/ui
    captureWindow.loadFile(path.join(__dirname, '../core/ui/capture.html'));

    // Open DevTools in development (optional)
    if (process.argv.includes('--enable-logging')) {
        captureWindow.webContents.openDevTools();
    }

    captureWindow.on('closed', () => {
        captureWindow = null;
    });

    return captureWindow.id;
}

// Handle global keyboard shortcut
function handleGlobalShortcut() {
    console.log('Global shortcut triggered: Cmd/Ctrl+Shift+2');

    // Show main window (user can click "Open Camera" button)
    if (!mainWindow || mainWindow.isDestroyed()) {
        createMainWindow();
    } else {
        // Show and focus main window if it exists
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
        if (!mainWindow.isVisible()) {
            mainWindow.show();
        }
        mainWindow.focus();

        // Show in dock on macOS
        if (process.platform === 'darwin') {
            app.dock.show();
        }
    }
}

// Create system tray icon
function createTray() {
    // Use existing icon or create from path
    let icon;
    try {
        // Try to use existing icon
        icon = nativeImage.createFromPath(path.join(__dirname, '../icons/icon-16.png'));
        if (icon.isEmpty()) {
            throw new Error('Icon not found');
        }
    } catch (error) {
        console.log('Using default tray icon');
        // Electron will use a default icon
    }

    tray = new Tray(icon);
    tray.setToolTip('SnapIt - Document Capture');

    // Create context menu
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Open SnapIt',
            accelerator: 'CommandOrControl+Shift+2',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                    if (process.platform === 'darwin') {
                        app.dock.show();
                    }
                } else {
                    createMainWindow();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Quit SnapIt',
            click: () => {
                app.isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);

    // Click tray icon to toggle window (macOS: left click, Windows: any click)
    tray.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
                if (process.platform === 'darwin') {
                    app.dock.hide();
                }
            } else {
                mainWindow.show();
                mainWindow.focus();
                if (process.platform === 'darwin') {
                    app.dock.show();
                }
            }
        } else {
            createMainWindow();
        }
    });
}

// Grant camera and microphone permissions automatically
app.whenReady().then(() => {
    // Set permission handler for camera access
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        if (permission === 'media' || permission === 'mediaDevices') {
            // Grant camera/microphone permissions
            callback(true);
        } else {
            callback(false);
        }
    });

    // Create application menu
    createMenu();

    // Register global keyboard shortcut
    // CommandOrControl maps to Cmd on macOS and Ctrl on Windows
    const shortcutRegistered = globalShortcut.register('CommandOrControl+Shift+2', handleGlobalShortcut);

    if (shortcutRegistered) {
        console.log('✅ Global shortcut registered: Cmd/Ctrl+Shift+2');
    } else {
        console.error('❌ Failed to register global shortcut');
    }

    createMainWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});


// Cleanup: Unregister shortcuts when app quits
app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    console.log('Global shortcuts unregistered');
});

// Quit app when all windows are closed
app.on('window-all-closed', () => {
    app.quit();
});

// IPC Handlers for platform-electron.js

// Storage operations
ipcMain.handle('storage-get', async (event, keys) => {
    const result = {};
    keys.forEach(key => {
        const value = store.get(key);
        if (value !== undefined) {
            result[key] = value;
        }
    });
    return result;
});

ipcMain.handle('storage-set', async (event, data) => {
    Object.keys(data).forEach(key => {
        store.set(key, data[key]);
    });

    // Notify all windows about storage changes
    BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('storage-changed', data);
    });

    return true;
});

ipcMain.handle('storage-remove', async (event, keys) => {
    keys.forEach(key => {
        store.delete(key);
    });
    return true;
});

// Window management
ipcMain.handle('open-window', async (event, config) => {
    const windowId = createCaptureWindow(config);
    return { windowId };
});

ipcMain.handle('close-window', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        window.close();
    }
    return true;
});

// Download handler
ipcMain.handle('download-file', async (event, { dataUrl, filename }) => {
    const { dialog } = require('electron');
    const fs = require('fs');

    // Determine file type from filename extension
    const isPDF = filename.toLowerCase().endsWith('.pdf');

    // Set filters based on file type - PDF filter first for PDFs
    const filters = isPDF
        ? [
            { name: 'PDF', extensions: ['pdf'] },
            { name: 'All Files', extensions: ['*'] }
        ]
        : [
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png'] },
            { name: 'All Files', extensions: ['*'] }
        ];

    // Show save dialog
    const result = await dialog.showSaveDialog({
        defaultPath: filename,
        filters: filters
    });

    if (!result.canceled && result.filePath) {
        // Convert data URL to buffer
        const base64Data = dataUrl.replace(/^data:.*?;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Write file
        fs.writeFileSync(result.filePath, buffer);
        return { success: true, path: result.filePath };
    }

    return { success: false };
});

// Clipboard handler
ipcMain.handle('write-clipboard', async (event, dataUrl) => {
    const { clipboard, nativeImage } = require('electron');

    try {
        // Convert data URL to native image
        const image = nativeImage.createFromDataURL(dataUrl);

        // Write to clipboard
        clipboard.writeImage(image);

        return { success: true };
    } catch (error) {
        console.error('Clipboard error:', error);
        return { success: false, message: error.message };
    }
});

// Platform info
ipcMain.handle('get-platform-info', async () => {
    return {
        name: 'electron',
        isDesktopApp: true,
        isExtension: false
    };
});
