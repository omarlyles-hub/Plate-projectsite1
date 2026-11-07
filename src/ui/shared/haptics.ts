/**
 * Haptic feedback via the Vibration API. Supported on Android browsers; iOS Safari has no
 * equivalent, so swipes also get a visual snap (see SwipeCard).
 */
function vibrate(pattern: number | number[]) {
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

export const haptics = {
  confirm: () => vibrate(18),
  skip: () => vibrate(8),
  dismiss: () => vibrate([10, 40, 10]),
  warn: () => vibrate([20, 30, 20]),
};
