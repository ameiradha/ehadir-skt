import { Student } from '../types';

/**
 * Normalizes student name for strict, case-insensitive, whitespace-insensitive comparison.
 * Collapses multiple spaces, trims, and converts to uppercase.
 */
export function normalizeStudentName(name: string | undefined | null): string {
  if (!name) return '';
  return String(name)
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/**
 * Formats student name for clean display: trimmed, single spaces, uppercase.
 */
export function cleanDisplayName(name: string | undefined | null): string {
  if (!name) return 'Tiada Nama';
  return String(name)
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/**
 * Cleans class string: trimmed, single spaces, uppercase.
 */
export function cleanClassName(className: string | undefined | null): string {
  if (!className) return '';
  return String(className)
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/**
 * Comprehensive check to verify if a student is soft-deleted or inactive.
 */
export function isStudentDeleted(s: any): boolean {
  if (!s) return true;
  if (s.status === 'deleted' || s.status === 'DELETED') return true;
  if (s.deleted === true) return true;
  if (s.active === false) return true;
  return false;
}

/**
 * Consistently sorts students by Year (extracted digit from class name, e.g. 1-6) and then alphabetically by Name.
 */
export function sortStudents(students: Student[]): Student[] {
  return [...students].sort((a, b) => {
    const getYear = (className: string) => {
      const match = (className || '').match(/\d+/);
      return match ? parseInt(match[0], 10) : 99;
    };

    const yearA = getYear(a.class);
    const yearB = getYear(b.class);

    if (yearA !== yearB) return yearA - yearB;
    return (a.name || '').localeCompare(b.name || '');
  });
}

/**
 * Deduplicates a list of students so that only ONE record exists per normalized student name.
 * If duplicates exist:
 * - Prefers the one with a non-empty class
 * - Prefers the one with the latest update or active status
 */
export function deduplicateStudents(students: Student[]): Student[] {
  const map = new Map<string, Student>();

  for (const s of students) {
    const key = normalizeStudentName(s.name);
    if (!key) continue;

    if (!map.has(key)) {
      map.set(key, s);
    } else {
      // If we already have this student, keep the one with better class info or newer data
      const existing = map.get(key)!;
      if ((!existing.class || existing.class.trim() === '') && s.class && s.class.trim() !== '') {
        map.set(key, s);
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Takes raw docs (from onSnapshot or getDocs), filters out deleted/inactive students,
 * deduplicates any records with the same normalized name, and returns the sorted array.
 */
export function filterAndDeduplicateStudents(rawList: any[]): Student[] {
  const activeStudents: Student[] = [];

  for (const item of rawList) {
    if (!item) continue;
    if (isStudentDeleted(item)) continue;

    const name = cleanDisplayName(item.name);
    if (!name || name === 'TIADA NAMA') continue;

    activeStudents.push({
      id: item.id || '',
      name,
      class: cleanClassName(item.class),
      active: true,
      status: 'active',
      deleted: false,
      updatedAt: item.updatedAt
    });
  }

  const uniqueStudents = deduplicateStudents(activeStudents);
  return sortStudents(uniqueStudents);
}
