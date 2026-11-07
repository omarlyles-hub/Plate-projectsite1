import { useMemo } from 'react';
import { summarizeVenues } from '../../core/recommendFilter';
import { dishesToOrderAgain, lovedNearby, oneYearAgo } from '../../core/resurface';
import type { Dish, Meal } from '../../core/types';
import { useLiveQuery } from '../../data/RepoContext';
import { formatShort } from '../format';
import { go } from '../router';
import { Empty, PageHead, RatingPill } from '../shared/bits';
import { useLocation } from '../shared/useLocation';
import { MealRow } from './JournalTab';

const todayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

export function TodayTab() {
  const loc = useLocation(true);
  const data = useLiveQuery(async (r) => {
    const [venues, meals, dishes] = await Promise.all([r.listVenues(), r.listMeals(), r.listDishes()]);
    return { venues, meals, dishes };
  });

  const view = useMemo(() => {
    if (!data) return null;
    const now = Date.now();
    const summaries = summarizeVenues(data.venues, data.meals, data.dishes);
    const venueById = new Map(data.venues.map((v) => [v.id, v]));
    const latest = [...data.meals].sort((a, b) => b.date - a.date)[0];
    const fallbackHood = latest ? venueById.get(latest.venueId)?.neighborhood ?? null : null;
    const dishesByMeal = new Map<string, Dish[]>();
    for (const d of data.dishes) dishesByMeal.set(d.mealId, [...(dishesByMeal.get(d.mealId) ?? []), d]);
    return {
      venueById,
      dishesByMeal,
      yearAgo: oneYearAgo(data.meals, now),
      loved: lovedNearby(summaries, loc.coords, fallbackHood),
      fallbackHood,
      again: dishesToOrderAgain(data.venues, data.meals, data.dishes),
      empty: data.meals.length === 0,
    };
  }, [data, loc.coords]);

  const mealRow = (m: Meal) => (
    <MealRow key={m.id} meal={m} venue={view?.venueById.get(m.venueId)} dishes={view?.dishesByMeal.get(m.id) ?? []} />
  );

  return (
    <>
      <PageHead title="Today" subtitle={todayFmt.format(new Date())} />
      {view?.empty && (
        <div className="card">
          <Empty title="Your journal starts here">
            Import photos from your last year of dining, or try demo mode to look around.
          </Empty>
          <div className="card-body">
            <button className="btn primary block" onClick={() => go('import')}>Go to Import</button>
          </div>
        </div>
      )}

      {view && !view.empty && (
        <div className="stack">
          <section>
            <div className="section-title" style={{ marginTop: 8 }}>One year ago</div>
            {view.yearAgo.length > 0 ? (
              <div className="stack" style={{ gap: 10 }}>{view.yearAgo.map(mealRow)}</div>
            ) : (
              <p className="muted small" style={{ margin: '0 4px' }}>Nothing logged around this date last year.</p>
            )}
          </section>

          <section>
            <div className="section-title">You loved this near here</div>
            {!loc.coords && loc.status !== 'asking' && (
              <div className="row" style={{ margin: '0 4px 10px' }}>
                <span className="small muted grow">
                  {view.fallbackHood
                    ? `Showing ${view.fallbackHood}, where you last ate.`
                    : 'Share your location to see favorites nearby.'}
                </span>
                {loc.status !== 'denied' && loc.status !== 'unavailable' && (
                  <button className="chip" onClick={loc.request}>Use my location</button>
                )}
              </div>
            )}
            {view.loved.length > 0 ? (
              <div className="stack" style={{ gap: 10 }}>
                {view.loved.map(({ summary: s, distanceM }) => (
                  <button key={s.venue.id} className="card flat" style={{ padding: 0 }} onClick={() => go('venue', s.venue.id)}>
                    <div className="card-body row">
                      <div className="grow">
                        <div className="venue-name">{s.venue.name}</div>
                        <div className="small muted">
                          {[s.venue.neighborhood, distanceM !== undefined ? `${Math.round(distanceM)} m away` : '']
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                      <RatingPill rating={s.rating} />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted small" style={{ margin: '0 4px' }}>No loved places near here yet.</p>
            )}
          </section>

          <section>
            <div className="section-title">Dishes to order again</div>
            {view.again.length > 0 ? (
              <div className="card flat">
                <ul className="dish-list card-body">
                  {view.again.map((e) => (
                    <li key={`${e.venue.id}|${e.dish}`}>
                      <button
                        className="back grow"
                        style={{ padding: 0, color: 'var(--text)', textAlign: 'left' }}
                        onClick={() => go('venue', e.venue.id)}
                      >
                        <span style={{ fontWeight: 600 }}>{e.dish}</span>
                        <span className="muted small"> at {e.venue.name}</span>
                      </button>
                      <span className="small muted">last {formatShort(e.lastOrdered)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="muted small" style={{ margin: '0 4px' }}>
                Flag dishes as &ldquo;order again&rdquo; when you log a meal and they&apos;ll show up here.
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
