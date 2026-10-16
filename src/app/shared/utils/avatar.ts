// Initials avatar helpers, paired with the global `.avatar` class.

// Palette tokens cycled per person (stable for a given id).
const AVATAR_COLORS = ['--color-primary', '--color-blue', '--color-gold', '--color-sage', '--color-warning', '--color-accent'];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** CSS value for `--avatar-color`, e.g. "var(--color-blue)". */
export function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return `var(${AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]})`;
}
