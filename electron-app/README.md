# SnapIt Electron Desktop App

## Quick Start

### Launch the App

```bash
cd /Users/sonuverma/SnapIt/electron-app
npm start
```

For development with DevTools enabled:

```bash
npm run dev
```

## Architecture

### Project Structure

```
electron-app/
├── package.json          # Dependencies and scripts
├── main.js              # Electron main process (window management, IPC)
└── preload.js           # Secure IPC bridge
```

### How It Works

1. **main.js** creates a BrowserWindow that loads `../core/ui/popup.html`
2. **preload.js** exposes secure IPC APIs via `window.electronAPI`
3. **platform-electron.js** implements the Platform interface using IPC
4. Camera permissions are automatically granted via `session.setPermissionRequestHandler`

### Platform Abstraction

The app reuses all existing SnapIt UI code from `core/ui/`:
- `popup.html` / `popup.js` - Main interface
- `capture.html` / `capture.js` - Camera capture
- All CSS and libraries unchanged

Platform-specific code is in `core/platform/platform-electron.js`, which implements:
- Storage using `electron-store`
- Downloads using Electron's save dialog
- Window management via IPC

## Development Notes

### Camera Access

Camera permissions are automatically granted in `main.js`:

```javascript
session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
  if (permission === 'media' || permission === 'mediaDevices') {
    callback(true); // Grant camera/microphone
  }
});
```

### Window Configuration

- Main window: 800x900px
- Capture window: 1200x800px (configurable)
- Both windows use `contextIsolation: true` and `nodeIntegration: false` for security

### DevTools

Run with `npm run dev` to enable DevTools for debugging.

## Next Steps (Future Phases)

- [ ] Add global keyboard shortcuts (Cmd+Shift+2 / Ctrl+Shift+2)
- [ ] Package for distribution (Windows/macOS)
- [ ] Add auto-update functionality
- [ ] Implement monetization features
