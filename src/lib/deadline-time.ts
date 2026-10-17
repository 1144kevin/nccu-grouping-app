export function formatDeadline(date: Date) { return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; }

export function createInitialDeadline(now = Date.now()) {
  const quarterHour = 15 * 60 * 1000;
  return new Date(Math.ceil((now + 3 * 60 * 60 * 1000) / quarterHour) * quarterHour);
}

export function startOfDay(now = Date.now()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date;
}
