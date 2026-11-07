import { useMemo, useState } from 'react';
import type { Dish, Meal, Venue } from '../../core/types';
import { useLiveQuery } from '../../data/RepoContext';
import { formatDay } from '../format';
import { go } from '../router';
import { Empty, PageHead, RatingPill } from '../shared/bits';
import { Photo } from '../shared/Photo';

export function MealRow({ meal, venue, dishes }: { meal: Meal; venue?: Venue; dishes: Dish[] }) {
  return (
    <button className="card flat meal-row" onClick={() => go('meal', meal.id)} style={{ width: '100%' }}>
      <div className="thumb">
        {meal.photoIds[0] ? <Photo id={meal.photoIds[0]} alt="" /> : <div className="photo" />}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="venue-name">{venue?.name ?? 'Unknown venue'}</div>
        <div className="small muted">
          {formatDay(meal.date)}
          {venue?.neighborhood ? ` · ${venue.neighborhood}` : ''}
        </div>
        <div className="row" style={{ marginTop: 6, flexWrap: 'wrap', gap: 6 }}>
          <RatingPill rating={meal.rating} />
          {dishes.length > 0 && (
            <span className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
              {dishes.map((d) => d.name).join(', ')}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export function JournalTab() {
  const data = useLiveQuery(async (r) => {
    const [meals, venues, dishes] = await Promise.all([r.listMeals(), r.listVenues(), r.listDishes()]);
    return { meals, venues, dishes };
  });
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    if (!data) return [];
    const venueById = new Map(data.venues.map((v) => [v.id, v]));
    const dishesByMeal = new Map<string, Dish[]>();
    for (const d of data.dishes) dishesByMeal.set(d.mealId, [...(dishesByMeal.get(d.mealId) ?? []), d]);
    const q = query.trim().toLowerCase();
    return [...data.meals]
      .sort((a, b) => b.date - a.date)
      .map((meal) => ({ meal, venue: venueById.get(meal.venueId), dishes: dishesByMeal.get(meal.id) ?? [] }))
      .filter(
        ({ venue, dishes }) =>
          !q ||
          venue?.name.toLowerCase().includes(q) ||
          venue?.neighborhood.toLowerCase().includes(q) ||
          dishes.some((d) => d.name.toLowerCase().includes(q)),
      );
  }, [data, query]);

  return (
    <>
      <PageHead title="Journal" subtitle={data ? `${data.meals.length} meals logged` : undefined} />
      <div className="stack">
        <input
          className="input"
          type="search"
          placeholder="Search venues, neighborhoods or dishes"
          aria-label="Search journal"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {data && rows.length === 0 && (
          <Empty title={query ? 'No matches' : 'Nothing here yet'}>
            {query
              ? 'Try a different venue or dish name.'
              : 'Import some photos, or turn on demo mode in the Import tab.'}
          </Empty>
        )}
        {rows.map(({ meal, venue, dishes }) => (
          <MealRow key={meal.id} meal={meal} venue={venue} dishes={dishes} />
        ))}
      </div>
    </>
  );
}
