export const CORRECT_DAYS_PER_LEVEL = 3;
export function normalizeProgress(value = {}) {
  if (!value || typeof value !== 'object') value = {};
  return {
    day: Number.isSafeInteger(value.day) && value.day >= 0 ? value.day : 0,
    level: Number.isInteger(value.level) && value.level >= 1 && value.level <= 6 ? value.level : 1,
    correctDays: Number.isInteger(value.correctDays) && value.correctDays >= 0 && value.correctDays < CORRECT_DAYS_PER_LEVEL ? value.correctDays : 0
  };
}
export function finishDay(progress, correct) {
  const next = normalizeProgress(progress);
  if (!correct) return next;
  next.correctDays++;
  if (next.correctDays >= CORRECT_DAYS_PER_LEVEL) {
    next.level = Math.min(6, next.level + 1);
    next.correctDays = 0;
  }
  return next;
}
