import { useMemo, useState } from 'react';
import { filterVenues, neighborhoodsInLog, summarizeVenues, type VenueSummary } from '../../core/recommendFilter';
import { formatShare } from '../../core/shareFormatter';
import type { PriceFeel, Rating } from '../../core/types';
import { useLiveQuery } from '../../data/RepoContext';
import { go } from '../router';
import { Empty, PageHead, RatingPill } from '../shared/bits';
import { useShare } from '../shared/share';
import { useLocation } from '../shared/useLocation';
import { priceLabel } from '../format';

const NEAR_RADIUS_M = 1500;
const PRICES: PriceFeel[] = [1, 2, 3, 4];

function shareText(s: VenueSummary, rating: Rating): string {
  const flagged = new Set(s.orderAgain.map((n) => n.toLowerCase()));
  return formatShare({
    venueName: s.venue.name,
    neighborhood: s.venue.neighborhood,
    dishes: [
      ...s.orderAgain.map((name) => ({ name, orderAgain: true })),
      ...s.allDishes.filter((n) => !flagged.has(n.toLowerCase())).map((name) => ({ name, orderAgain: false })),
    ],
    rating,
  });
}

const distLabel = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

export function RecommendTab() {
  const share = useShare();
  const loc = useLocation();
  const data = useLiveQuery(async (r) => {
    const [venues, meals, dishes] = await Promise.all([r.listVenues(), r.listMeals(), r.listDishes()]);
    return { venues, meals, dishes };
  });
  const [where, setWhere] = useState<'any' | 'near' | string>('any');
  const [minRating, setMinRating] = useState<Rating | null>(null);
  const [prices, setPrices] = useState<PriceFeel[]>([]);

  const summaries = useMemo(
    () => (data ? summarizeVenues(data.venues, data.meals, data.dishes) : []),
    [data],
  );
  const hoods = useMemo(() => neighborhoodsInLog(summaries), [summaries]);

  const results = useMemo(
    () =>
      filterVenues(summaries, {
        neighborhood: where !== 'any' && where !== 'near' ? where : null,
        near: where === 'near' && loc.coords ? { ...loc.coords, radiusM: NEAR_RADIUS_M } : null,
        minRating,
        prices,
      }),
    [summaries, where, loc.coords, minRating, prices],
  );

  const pickNear = () => {
    setWhere('near');
    if (loc.status !== 'ok') loc.request();
  };

  const waitingForLocation = where === 'near' && !loc.coords;

  return (
    <>
      <PageHead title="Recommend" subtitle="Where should I eat? Only from places you've been." />
      <div className="stack" style={{ gap: 6 }}>
        <div className="section-title" style={{ margin: '4px 4px 0' }}>Where</div>
        <div className="chips" role="group" aria-label="Where">
          <button className="chip" aria-pressed={where === 'any'} onClick={() => setWhere('any')}>Anywhere</button>
          <button className="chip" aria-pressed={where === 'near'} onClick={pickNear}>Near me</button>
          {hoods.map((h) => (
            <button key={h} className="chip" aria-pressed={where === h} onClick={() => setWhere(h)}>{h}</button>
          ))}
        </div>
        {where === 'near' && loc.status === 'asking' && <p className="small muted" style={{ margin: '0 4px' }}>Finding you…</p>}
        {where === 'near' && (loc.status === 'denied' || loc.status === 'unavailable') && (
          <p className="small" role="alert" style={{ margin: '0 4px' }}>
            {loc.status === 'denied'
              ? 'Location is blocked. Allow it in your browser settings, or pick a neighborhood.'
              : 'Could not get your location. Pick a neighborhood instead.'}
          </p>
        )}

        <div className="section-title" style={{ margin: '10px 4px 0' }}>Rating</div>
        <div className="chips" role="group" aria-label="Minimum rating">
          <button className="chip" aria-pressed={minRating === null} onClick={() => setMinRating(null)}>Any</button>
          <button className="chip" aria-pressed={minRating === 'good'} onClick={() => setMinRating('good')}>Good or better</button>
          <button className="chip" aria-pressed={minRating === 'loved'} onClick={() => setMinRating('loved')}>Loved it</button>
        </div>

        <div className="section-title" style={{ margin: '10px 4px 0' }}>Price feel</div>
        <div className="chips" role="group" aria-label="Price feel">
          {PRICES.map((p) => (
            <button
              key={p}
              className="chip"
              aria-pressed={prices.includes(p)}
              onClick={() => setPrices((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))}
            >
              {'$'.repeat(p)}
            </button>
          ))}
        </div>
      </div>

      <div className="section-title">
        {data ? `${results.length} ${results.length === 1 ? 'place' : 'places'}` : ''}
      </div>
      <div className="stack">
        {data && summaries.length === 0 && (
          <Empty title="Your log is empty">Import photos or turn on demo mode to see recommendations.</Empty>
        )}
        {data && summaries.length > 0 && results.length === 0 && !waitingForLocation && (
          <Empty title="Nothing matches">Loosen a filter. Results only include places you&apos;ve logged.</Empty>
        )}
        {results.map((s) => (
          <article key={s.venue.id} className="card flat">
            <div className="card-body stack" style={{ gap: 10 }}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <button
                  className="back venue-name grow"
                  style={{ padding: 0, color: 'var(--text)', textAlign: 'left', fontSize: '1.25rem' }}
                  onClick={() => go('venue', s.venue.id)}
                >
                  {s.venue.name}
                </button>
                <RatingPill rating={s.rating} />
              </div>
              <div className="small muted">
                {[
                  s.venue.neighborhood,
                  s.priceFeel ? priceLabel(s.priceFeel) : '',
                  `${s.visits} ${s.visits === 1 ? 'visit' : 'visits'}`,
                  s.distanceM !== undefined ? distLabel(s.distanceM) : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              {(s.orderAgain.length > 0 || s.allDishes.length > 0) && (
                <div>
                  <span className="again">{s.orderAgain.length > 0 ? 'Get' : 'Had'}: </span>
                  {(s.orderAgain.length > 0 ? s.orderAgain : s.allDishes).slice(0, 4).join(', ')}
                </div>
              )}
              <button className="btn block" onClick={() => share(shareText(s, s.rating))}>
                Share
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
