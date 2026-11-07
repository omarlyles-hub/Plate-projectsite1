import { useState } from 'react';
import type { Enrichment } from '../../data/confirmMeal';
import { RATING_LABEL, type PriceFeel, type Rating } from '../../core/types';
import { Sheet } from '../shared/Sheet';

const RATINGS: Rating[] = ['loved', 'good', 'meh'];
const PRICES: PriceFeel[] = [1, 2, 3, 4];

interface DishRow {
  name: string;
  orderAgain: boolean;
}

/** Post-confirm prompt. Only the rating is required. */
export function EnrichSheet({
  venueName,
  onSave,
  onCancel,
  saving,
}: {
  venueName: string;
  onSave: (e: Enrichment) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [rating, setRating] = useState<Rating | null>(null);
  const [dishes, setDishes] = useState<DishRow[]>([{ name: '', orderAgain: false }]);
  const [note, setNote] = useState('');
  const [companions, setCompanions] = useState('');
  const [price, setPrice] = useState<PriceFeel | undefined>();

  const setDish = (i: number, patch: Partial<DishRow>) =>
    setDishes((rows) => rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const addRow = () => setDishes((rows) => [...rows, { name: '', orderAgain: false }]);

  return (
    <Sheet title={`How was ${venueName}?`} onClose={onCancel}>
      <div className="rating-row" role="group" aria-label="Rating">
        {RATINGS.map((r) => (
          <button
            key={r}
            className="rating-btn"
            aria-pressed={rating === r}
            onClick={() => setRating(r)}
          >
            {RATING_LABEL[r]}
          </button>
        ))}
      </div>

      <div className="section-title" style={{ marginTop: 8 }}>What did you order? (optional)</div>
      {dishes.map((d, i) => (
        <div className="dish-input-row" key={i}>
          <input
            className="input"
            placeholder="Dish name"
            aria-label={`Dish ${i + 1}`}
            value={d.name}
            enterKeyHint="next"
            autoComplete="off"
            onChange={(e) => setDish(i, { name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && d.name.trim() && i === dishes.length - 1) {
                e.preventDefault();
                addRow();
              }
            }}
            autoFocus={false}
          />
          <label className="toggle">
            <input
              type="checkbox"
              checked={d.orderAgain}
              onChange={(e) => setDish(i, { orderAgain: e.target.checked })}
            />
            Order again
          </label>
        </div>
      ))}
      <button className="btn ghost" onClick={addRow} style={{ marginBottom: 8 }}>
        + Add a dish
      </button>

      <div className="stack" style={{ gap: 10 }}>
        <input
          className="input"
          placeholder="One-line note (optional)"
          aria-label="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <input
          className="input"
          placeholder="Who was with you? (optional)"
          aria-label="Companions"
          value={companions}
          onChange={(e) => setCompanions(e.target.value)}
        />
        <div className="chips" role="group" aria-label="Price feel">
          <span className="muted small" style={{ alignSelf: 'center', marginRight: 4 }}>Price feel</span>
          {PRICES.map((p) => (
            <button
              key={p}
              className="chip"
              aria-pressed={price === p}
              onClick={() => setPrice(price === p ? undefined : p)}
            >
              {'$'.repeat(p)}
            </button>
          ))}
        </div>
      </div>

      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn ghost" onClick={onCancel}>Back</button>
        <button
          className="btn primary grow"
          disabled={!rating || saving}
          onClick={() => rating && onSave({ rating, dishes, note, companions, priceFeel: price })}
        >
          {rating ? 'Save meal' : 'Pick a rating to save'}
        </button>
      </div>
    </Sheet>
  );
}
