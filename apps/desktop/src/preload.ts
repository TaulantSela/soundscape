import { contextBridge, ipcRenderer } from 'electron';

type ToggleCallback = () => void;

contextBridge.exposeInMainWorld('soundscapeDesktop', {
  requestTogglePlay() {
    ipcRenderer.send('soundscape:toggle-play-request');
  },
  onTogglePlay(callback: ToggleCallback) {
    const listener = () => callback();
    ipcRenderer.on('soundscape:toggle-play', listener);
    return () => ipcRenderer.removeListener('soundscape:toggle-play', listener);
  }
});
