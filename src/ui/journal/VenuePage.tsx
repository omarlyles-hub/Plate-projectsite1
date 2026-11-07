import { useMemo } from 'react';
import { formatShare } from '../../core/shareFormatter';
import { useLiveQuery } from '../../data/RepoContext';
import { formatDay, priceLabel } from '../format';
import { go, goBack } from '../router';
import { Empty, RatingPill } from '../shared/bits';
import { useShare } from '../shared/share';
import { Photo } from '../shared/Photo';

/** The hero feature: what was ordered on the most recent visit, with order-again flags. */
function LastTimeCard({
  date,
  dishes,
  note,
}: {
  date: number;
  dishes: { id: string; name: string; orderAgain: boolean }[];
  note: string;
}) {
  return (
    <section className="hero" aria-labelledby="last-time">
      <h2 id="last-time">What did I order last time?</h2>
      <div className="small muted">{formatDay(date)}</div>
      {dishes.length === 0 ? (
        <p style={{ margin: '10px 0 0' }}>You didn&apos;t log any dishes for this visit.</p>
      ) : (
        <ul className="dish-list" style={{ marginTop: 6 }}>
          {dishes.map((d) => (
            <li key={d.id} style={{ borderColor: 'color-mix(in srgb, var(--accent) 25%, transparent)' }}>
              <span className="dish grow" style={{ padding: 0 }}>{d.name}</span>
              {d.orderAgain && <span className="again">Order again</span>}
            </li>
          ))}
        </ul>
      )}
      {note && <p style={{ margin: '10px 0 0', fontStyle: 'italic' }}>&ldquo;{note}&rdquo;</p>}
    </section>
  );
}

export function VenuePage({ venueId }: { venueId: string }) {
  const share = useShare();
  const data = useLiveQuery(async (r) => {
    const venue = await r.getVenue(venueId);
    if (!venue) return null;
    const meals = (await r.listMeals()).filter((m) => m.venueId === venueId).sort((a, b) => b.date - a.date);
    const allDishes = await r.listDishes();
    const ids = new Set(meals.map((m) => m.id));
    return { venue, meals, dishes: allDishes.filter((d) => ids.has(d.mealId)) };
  }, [venueId]);

  const visits = useMemo(() => {
    if (!data) return [];
    return data.meals.map((meal) => ({ meal, dishes: data.dishes.filter((d) => d.mealId === meal.id) }));
  }, [data]);

  if (data === undefined) return null;
  if (data === null) {
    return (
      <>
        <button className="back" onClick={() => goBack(['journal'])}>&larr; Journal</button>
        <Empty title="Venue not found" />
      </>
    );
  }

  const { venue } = data;
  const last = visits[0];
  // Distinct dishes flagged order-again across every visit.
  const orderAgain = [
    ...new Map(
      data.dishes.filter((d) => d.orderAgain).map((d) => [d.name.trim().toLowerCase(), d.name.trim()]),
    ).values(),
  ];

  return (
    <>
      <button className="back" onClick={() => goBack(['journal'])}>&larr; Journal</button>
      <header className="page-head" style={{ paddingTop: 12 }}>
        <h1>{venue.name}</h1>
        <p>
          {[venue.neighborhood, venue.address].filter(Boolean).join(' · ')}
          {` · ${visits.length} ${visits.length === 1 ? 'visit' : 'visits'}`}
        </p>
      </header>

      <div className="stack">
        {last && <LastTimeCard date={last.meal.date} dishes={last.dishes} note={last.meal.note} />}

        <button
          className="btn block"
          onClick={() =>
            share(
              formatShare({
                venueName: venue.name,
                neighborhood: venue.neighborhood,
                dishes: data.dishes,
                rating: last?.meal.rating ?? 'good',
              }),
            )
          }
        >
          Share this place
        </button>

        {orderAgain.length > 0 && (
          <>
            <div className="section-title" style={{ marginBottom: 0 }}>Order again</div>
            <div className="card flat">
              <ul className="dish-list card-body">
                {orderAgain.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          </>
        )}

        <div className="section-title" style={{ marginBottom: 0 }}>Every visit</div>
        {visits.map(({ meal, dishes }) => (
          <button key={meal.id} className="card flat" style={{ padding: 0 }} onClick={() => go('meal', meal.id)}>
            <div className="card-body">
              <div className="row">
                <div className="grow">
                  <strong>{formatDay(meal.date)}</strong>
                  {meal.companions && <span className="muted small"> · with {meal.companions}</span>}
                </div>
                {meal.priceFeel && <span className="muted small">{priceLabel(meal.priceFeel)}</span>}
                <RatingPill rating={meal.rating} />
              </div>
              {meal.photoIds.length > 0 && (
                <div className="row" style={{ marginTop: 10, gap: 6 }}>
                  {meal.photoIds.slice(0, 3).map((id) => (
                    <div key={id} style={{ width: 56, height: 56, borderRadius: 10, overflow: 'hidden' }}>
                      <Photo id={id} alt="" />
                    </div>
                  ))}
                </div>
              )}
              <ul className="dish-list" style={{ marginTop: 10 }}>
                {dishes.length === 0 && <li className="muted small">No dishes logged</li>}
                {dishes.map((d) => (
                  <li key={d.id}>
                    <span className="grow">{d.name}</span>
                    {d.orderAgain && <span className="again">Order again</span>}
                  </li>
                ))}
              </ul>
              {meal.note && <div className="small muted" style={{ marginTop: 6 }}>&ldquo;{meal.note}&rdquo;</div>}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
