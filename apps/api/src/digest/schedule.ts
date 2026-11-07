import { CronExpressionParser } from 'cron-parser';

export interface ScheduleFields {
  frequency: 'daily' | 'weekly' | 'monthly';
  hour: number;
  minute: number;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  timezone: string;
}

export function cronFor(s: ScheduleFields) {
  const base = `${s.minute} ${s.hour}`;
  if (s.frequency === 'weekly') return `${base} * * ${s.dayOfWeek ?? 1}`;
  if (s.frequency === 'monthly') return `${base} ${s.dayOfMonth ?? 1} * *`;
  return `${base} * * *`;
}

/** Next time this schedule fires after `from`, honouring the user's timezone (and DST). */
export function nextRunAt(s: ScheduleFields, from = new Date()): Date {
  return CronExpressionParser.parse(cronFor(s), { currentDate: from, tz: s.timezone }).next().toDate();
}

export function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Every Monday at 09:00 (Asia/Kolkata)" */
export function describeSchedule(s: ScheduleFields) {
  const time = `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`;
  const when =
    s.frequency === 'daily'
      ? 'Every day'
      : s.frequency === 'weekly'
        ? `Every ${DAYS[s.dayOfWeek ?? 1]}`
        : `Monthly on day ${s.dayOfMonth ?? 1}`;
  return `${when} at ${time} (${s.timezone})`;
}
