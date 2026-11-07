/**
 * Median gross wealth of households by age of the reference person, France, early 2024, in euros.
 *
 * Source: Insee Focus n° 371, « Les montants de patrimoine détenus par les ménages en 2024 »,
 * figure 3a, enquête Histoire de vie et Patrimoine 2023-2024 — https://www.insee.fr/fr/statistiques/8672665
 *
 * Medians only: the card states a ratio and a gap, never a percentile it could not back.
 */
export const INSEE_WEALTH_SOURCE_URL = 'https://www.insee.fr/fr/statistiques/8672665'

export type AgeBracket = 'under30' | '30to39' | '40to49' | '50to59' | '60to69' | '70plus' | 'all'

export const MEDIAN_GROSS_WEALTH: Record<AgeBracket, number> = {
  under30: 26_100,
  '30to39': 146_200,
  '40to49': 215_200,
  '50to59': 254_100,
  '60to69': 245_000,
  '70plus': 247_600,
  all: 205_100,
}

/** The INSEE bracket of an age; without one, every household ("ensemble"). */
export function ageBracket(age: number | null | undefined): AgeBracket {
  if (age == null) return 'all'
  if (age < 30) return 'under30'
  if (age < 40) return '30to39'
  if (age < 50) return '40to49'
  if (age < 60) return '50to59'
  if (age < 70) return '60to69'
  return '70plus'
}
