/** Clamp a gain to the 0–1 range, treating non-finite input as silence. */
export function clampVolume(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}
