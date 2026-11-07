import {
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { haptics } from '../shared/haptics';

export type SwipeDir = 'right' | 'left' | 'down';

export interface SwipeHandle {
  commit(dir: SwipeDir): void;
}

const THRESHOLD_X = 100;
const THRESHOLD_Y = 120;
const exitOffset = (dir: SwipeDir): { x: number; y: number } => {
  const w = Math.max(700, window.innerWidth);
  const h = Math.max(800, window.innerHeight);
  return dir === 'right' ? { x: w, y: 0 } : dir === 'left' ? { x: -w, y: 0 } : { x: 0, y: h };
};
const EXIT_MS = 200;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

interface Props {
  children: ReactNode;
  onDecide: (dir: SwipeDir) => void;
  /** When false, swiping right snaps back (e.g. a venue name is still required). */
  canConfirm: boolean;
  handle?: Ref<SwipeHandle>;
}

/** A draggable card. Right = confirm, left = skip, down = not a restaurant. */
export function SwipeCard({ children, onDecide, canConfirm, handle }: Props) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState<'idle' | 'drag' | 'settle' | 'exit'>('idle');
  const start = useRef<{ x: number; y: number } | null>(null);

  const commit = (dir: SwipeDir) => {
    if (mode === 'exit') return;
    if (dir === 'right' && !canConfirm) {
      haptics.warn();
      setMode('settle');
      setOffset({ x: 14, y: 0 });
      setTimeout(() => setOffset({ x: 0, y: 0 }), 120);
      return;
    }
    if (dir === 'right') haptics.confirm();
    else if (dir === 'left') haptics.skip();
    else haptics.dismiss();
    setMode('exit');
    setOffset(exitOffset(dir));
    setTimeout(() => onDecide(dir), EXIT_MS);
  };

  useImperativeHandle(handle, () => ({ commit }));

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (mode === 'exit') return;
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a, label')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    setMode('drag');
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current || mode !== 'drag') return;
    setOffset({ x: e.clientX - start.current.x, y: Math.max(0, e.clientY - start.current.y) });
  };
  const release = () => {
    if (!start.current) return;
    start.current = null;
    const { x, y } = offset;
    if (Math.abs(x) >= Math.abs(y)) {
      if (x >= THRESHOLD_X) return commit('right');
      if (x <= -THRESHOLD_X) return commit('left');
    } else if (y >= THRESHOLD_Y) {
      return commit('down');
    }
    setMode('settle');
    setOffset({ x: 0, y: 0 });
  };

  const horizontal = Math.abs(offset.x) >= Math.abs(offset.y);
  const yes = horizontal ? clamp01(offset.x / THRESHOLD_X) : 0;
  const no = horizontal ? clamp01(-offset.x / THRESHOLD_X) : 0;
  const dismiss = horizontal ? 0 : clamp01(offset.y / THRESHOLD_Y);

  return (
    <div
      className="card swipe-card"
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px) rotate(${offset.x / 25}deg)`,
        transition: mode === 'drag' ? 'none' : `transform ${EXIT_MS}ms ease-out, opacity ${EXIT_MS}ms ease-out`,
        opacity: mode === 'exit' ? 0 : 1,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={release}
      onPointerCancel={release}
    >
      {children}
      <div className="stamp yes" style={{ opacity: yes }} aria-hidden="true">Yes</div>
      <div className="stamp no" style={{ opacity: no }} aria-hidden="true">Skip</div>
      <div className="stamp dismiss" style={{ opacity: dismiss }} aria-hidden="true">Not food</div>
    </div>
  );
}
