/** Encode float channels as a 16-bit PCM WAV file (little-endian). */
export function encodeWav(sound: { sampleRate: number; channels: Float32Array[] }): Uint8Array {
  const { sampleRate, channels } = sound;
  const channelCount = channels.length;
  const length = channels[0]?.length ?? 0;
  const blockAlign = channelCount * 2;
  const dataSize = length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);

  // Every platform the apps run on is little-endian, so an Int16Array view
  // writes the samples in WAV byte order without per-sample DataView calls.
  const pcm = new Int16Array(buffer, 44, length * channelCount);
  let offset = 0;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channelCount; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      pcm[offset++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
  }

  return new Uint8Array(buffer);
}
