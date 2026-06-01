export const Colors = {
  primary: '#6366f1', // Indigo
  secondary: '#f43f5e', // Rose
  background: '#0f172a', // Slate 900
  surface: '#1e293b', // Slate 800
  text: '#f8fafc', // Slate 50
  textSecondary: '#94a3b8', // Slate 400
  border: '#334155', // Slate 700
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
};

export const STATUS_COLORS: Record<string, string> = {
  NEW: '#f59e0b',
  CALLBACK: '#3b82f6',
  INTERESTED: '#10b981',
  VISIT_BOOKED: '#06b6d4',
  VISITED: '#0d9488',
  RE_VISIT: '#a855f7',
  BOOKED: '#10b981',
  NOT_INTERESTED: '#ef4444',
  INVALID_NUMBER: '#94a3b8',
};

/**
 * Converts a hex color (e.g. "#0d9488") to an rgba() string with the
 * given alpha value.  This avoids the #RRGGBBAA hex format, which can
 * be misinterpreted or unsupported on some React Native platforms.
 *
 * @param hex  - 6-character hex string, with or without leading "#"
 * @param alpha - Opacity between 0 and 1 (e.g. 0.09 ≈ 9 %)
 * @returns     - e.g. "rgba(13, 148, 136, 0.09)"
 */
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
