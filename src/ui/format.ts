import { newUuid } from '../core/uuid';

const dayFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const shortFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

export const formatDay = (ms: number) => dayFmt.format(ms);
export const formatShort = (ms: number) => shortFmt.format(ms);
export const formatMonth = (ms: number) => monthFmt.format(ms);

export const priceLabel = (p: number | undefined) => (p ? '$'.repeat(p) : '');

export function newId(): string {
  return newUuid();
}
