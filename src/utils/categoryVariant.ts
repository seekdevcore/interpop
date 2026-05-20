/**
 * Maps a category slug or display name to a normalized variant key used by CSS
 * (`data-category="..."`) to select the editorial accent color.
 *
 * Tolerates accented and ASCII slugs that the Django backend may produce
 * depending on `slugify(..., allow_unicode=True/False)`.
 */
const VARIANT_MAP: Record<string, string> = {
  // Música
  musica: 'musica',
  música: 'musica',
  // Moda
  moda: 'moda',
  // Cinema
  cinema: 'cinema',
  // Literatura
  literatura: 'literatura',
  // Cultura Digital
  'cultura-digital': 'cultura-digital',
  'cultura digital': 'cultura-digital',
};

export function categoryVariant(input: string | null | undefined): string {
  if (!input) return 'default';
  const key = input.trim().toLowerCase();
  return VARIANT_MAP[key] ?? 'default';
}
