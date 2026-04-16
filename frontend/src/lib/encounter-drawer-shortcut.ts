export function buildEncounterDrawerShortcutHint() {
  if (typeof navigator === 'undefined') {
    return 'Ctrl+.';
  }

  return /mac/i.test(navigator.platform) ? '⌘.' : 'Ctrl+.';
}