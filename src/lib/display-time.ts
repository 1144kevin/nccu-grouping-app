function validDate(value: string | number | Date) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
export function dayKey(value: string | number | Date) {
  const date = validDate(value);
  return date ? `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}` : '';
}
export function displayTime(value: string | number | Date) {
  return (
    validDate(value)
      ?.toLocaleTimeString('zh-TW', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      .replace(/\s/g, '') ?? ''
  );
}
export function displayDay(value: string | number | Date, now = new Date()) {
  const date = validDate(value);
  return (
    date?.toLocaleDateString('zh-TW', {
      ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' as const } : {}),
      month: 'numeric',
      day: 'numeric',
    }) ?? ''
  );
}
export function displayTimestamp(value: string | number | Date, now = new Date()) {
  const time = displayTime(value);
  if (!time) return '';
  return dayKey(value) === dayKey(now) ? time : `${displayDay(value, now)} ${time}`;
}
