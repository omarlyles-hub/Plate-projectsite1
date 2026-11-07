import { useState } from 'react';
import { useLiveQuery, useRepo } from '../../data/RepoContext';
import { formatDay, priceLabel } from '../format';
import { go, goBack } from '../router';
import { Empty, RatingPill } from '../shared/bits';
import { Photo } from '../shared/Photo';

export function MealDetail({ mealId }: { mealId: string }) {
  const repo = useRepo();
  const data = useLiveQuery(async (r) => {
    const meal = await r.getMeal(mealId);
    if (!meal) return null;
    const [venue, dishes] = await Promise.all([r.getVenue(meal.venueId), r.dishesForMeal(mealId)]);
    return { meal, venue, dishes };
  }, [mealId]);
  const [confirming, setConfirming] = useState(false);

  if (data === undefined) return null;
  if (data === null) {
    return (
      <>
        <button className="back" onClick={() => goBack(['journal'])}>&larr; Journal</button>
        <Empty title="Meal not found" />
      </>
    );
  }
  const { meal, venue, dishes } = data;

  return (
    <>
      <button className="back" onClick={() => goBack(['journal'])}>&larr; Back</button>
      <div className="stack" style={{ marginTop: 12 }}>
        {meal.photoIds.length > 0 && (
          <div className="stack" style={{ gap: 8 }}>
            {meal.photoIds.map((id) => (
              <div key={id} className="card flat" style={{ aspectRatio: '4 / 3' }}>
                <Photo id={id} alt={`Photo from ${venue?.name ?? 'this meal'}`} />
              </div>
            ))}
          </div>
        )}
        <div>
          {venue ? (
            <button className="back venue-name" style={{ padding: 0, fontSize: '1.7rem', color: 'var(--text)', textAlign: 'left' }} onClick={() => go('venue', venue.id)}>
              {venue.name}
            </button>
          ) : (
            <div className="venue-name">Unknown venue</div>
          )}
          <div className="muted">
            {formatDay(meal.date)}
            {venue?.neighborhood ? ` · ${venue.neighborhood}` : ''}
          </div>
          <div className="row" style={{ marginTop: 10, gap: 8 }}>
            <RatingPill rating={meal.rating} />
            {meal.priceFeel && <span className="pill">{priceLabel(meal.priceFeel)}</span>}
            {meal.companions && <span className="pill">with {meal.companions}</span>}
          </div>
        </div>
        {meal.note && <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: '1.1rem' }}>&ldquo;{meal.note}&rdquo;</p>}
        {dishes.length > 0 && (
          <div className="card flat">
            <ul className="dish-list card-body">
              {dishes.map((d) => (
                <li key={d.id}>
                  <span className="grow">{d.name}</span>
                  {d.orderAgain && <span className="again">Order again</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="row">
          {confirming ? (
            <>
              <button className="btn danger" onClick={() => void repo.deleteMeal(meal.id).then(() => goBack(['journal']))}>
                Delete this meal
              </button>
              <button className="btn ghost" onClick={() => setConfirming(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn ghost danger" onClick={() => setConfirming(true)}>Delete…</button>
          )}
        </div>
      </div>
    </>
  );
}
