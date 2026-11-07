import { useEffect, useState } from 'react';
import { useRepo } from '../../data/RepoContext';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Placeholder for demo data: a deterministic warm tile with a plate, no real photo involved. */
function DemoTile({ id }: { id: string }) {
  const h = hash(id);
  const hue = [12, 24, 36, 48, 96, 150, 340][h % 7];
  const hue2 = (hue + 28 + (h % 20)) % 360;
  return (
    <div
      className="photo-tile"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 60% 78%), hsl(${hue2} 55% 62%))` }}
      aria-hidden="true"
    >
      <div className="plate">
        <div className="food" style={{ background: `hsl(${(hue + 180) % 360} 45% 45%)` }} />
      </div>
    </div>
  );
}

function StoredPhoto({ id, alt }: { id: string; alt: string }) {
  const repo = useRepo();
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    let objectUrl: string | undefined;
    let cancelled = false;
    void repo.getPhoto(id).then((blob) => {
      if (blob && !cancelled) {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      }
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [repo, id]);

  return url ? <img src={url} alt={alt} draggable={false} /> : null;
}

export function Photo({ id, alt = '' }: { id: string; alt?: string }) {
  return (
    <div className="photo">
      {id.startsWith('demo:') ? <DemoTile id={id} /> : <StoredPhoto id={id} alt={alt} />}
    </div>
  );
}

/** Up to three photos laid out as a compact collage. */
export function PhotoStrip({ ids, alt }: { ids: readonly string[]; alt?: string }) {
  const shown = ids.slice(0, 3);
  if (shown.length === 0) return <div className="photo" />;
  return (
    <div className={`strip n${shown.length}`} style={{ width: '100%', height: '100%' }}>
      {shown.map((id) => (
        <Photo key={id} id={id} alt={alt} />
      ))}
    </div>
  );
}
