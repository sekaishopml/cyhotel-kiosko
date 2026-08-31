export function tap(): void {
  try {
    navigator.vibrate?.(12)
  } catch {
    // degrade silently
  }
}
