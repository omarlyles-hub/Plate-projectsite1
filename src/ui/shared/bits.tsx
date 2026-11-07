import type { ReactNode } from 'react';
import { RATING_LABEL, type Rating } from '../../core/types';

export function RatingPill({ rating }: { rating: Rating }) {
  return <span className={`pill ${rating === 'loved' ? 'loved' : ''}`}>{RATING_LABEL[rating]}</span>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p style={{ margin: 0 }}>{children}</p>
    </div>
  );
}

export function PageHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="page-head">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </header>
  );
}
