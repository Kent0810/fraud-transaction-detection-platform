import { type ReactNode, useState } from 'react';

export type Series = {
  key: string;
  label: string;
  color: string;
};

export type Bucket = {
  label: string;
  detail?: string;
  values: Record<string, number>;
};

/**
 * Stacked columns on one baseline. Hovering a column shows every series' value; the caller passes a
 * formatter for values and a short label for the axis.
 */
export function StackedColumns({
  buckets,
  series,
  format,
  height = 140,
  axisEvery = 1,
  caption,
}: {
  buckets: Bucket[];
  series: Series[];
  format: (n: number) => string;
  height?: number;
  axisEvery?: number;
  caption: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = buckets.map((b) => series.reduce((sum, s) => sum + (b.values[s.key] ?? 0), 0));
  const max = Math.max(...totals, 1);
  const W = 100 / Math.max(buckets.length, 1);
  const active = hover === null ? null : buckets[hover];

  return (
    <figure className="chart">
      <div className="chart-legend" aria-hidden>
        {series.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="chart-plot" style={{ height }} onMouseLeave={() => setHover(null)}>
        <div className="chart-grid" aria-hidden>
          <span data-v={format(max)} />
          <span data-v={format(max / 2)} />
          <span data-v="0" />
        </div>
        <div className="chart-cols" role="img" aria-label={caption}>
          {buckets.map((b, i) => {
            let acc = 0;
            return (
              <div
                key={b.label + i}
                className={`chart-col${hover === i ? ' hot' : ''}`}
                style={{ width: `${W}%` }}
                onMouseEnter={() => setHover(i)}
              >
                <div className="chart-stack" style={{ height: `${(totals[i] / max) * 100}%` }}>
                  {series.map((s) => {
                    const v = b.values[s.key] ?? 0;
                    if (!v) return null;
                    acc += v;
                    return (
                      <span
                        key={s.key}
                        style={{ flexGrow: v, background: s.color }}
                        className={acc === totals[i] ? 'top' : undefined}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {active && hover !== null && (
          <div
            className="tip"
            style={{
              left: `${(hover + 0.5) * W}%`,
              transform: `translateX(${hover > buckets.length / 2 ? '-100%' : '0'})`,
            }}
          >
            <strong>{active.detail ?? active.label}</strong>
            {series.map((s) => (
              <div key={s.key} className="tip-row">
                <i style={{ background: s.color }} />
                <span>{s.label}</span>
                <b>{format(active.values[s.key] ?? 0)}</b>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="chart-axis" aria-hidden>
        {buckets.map((b, i) => (
          <span key={b.label + i} style={{ width: `${W}%` }}>
            {i % axisEvery === 0 ? b.label : ''}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
    </figure>
  );
}

/** Horizontal bars for one series, each labelled with its name and value. */
export function BarList({
  rows,
  format = String,
  empty,
}: {
  rows: { key: string; label: ReactNode; value: number; onClick?: () => void; active?: boolean }[];
  format?: (n: number) => string;
  empty: string;
}) {
  if (rows.length === 0) return <p className="muted small">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="barlist">
      {rows.map((r) => (
        <li key={r.key}>
          <button
            type="button"
            className={r.active ? 'on' : undefined}
            onClick={r.onClick}
            disabled={!r.onClick}
            aria-pressed={r.onClick ? r.active : undefined}
          >
            <span className="barlist-fill" style={{ width: `${(r.value / max) * 100}%` }} />
            <span className="barlist-label">{r.label}</span>
            <b>{format(r.value)}</b>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** A 0–1 score as a short track with a marker; colour follows the verdict thresholds. */
export function ScoreMeter({ value }: { value: number }) {
  const v = Math.max(0, Math.min(1, value));
  const tone = v >= 0.8 ? 'hi' : v >= 0.5 ? 'mid' : 'lo';
  return (
    <span className={`meter m-${tone}`} title={`Risk score ${v.toFixed(2)}`}>
      <span className="meter-track">
        <span style={{ width: `${v * 100}%` }} />
      </span>
      <b>{v.toFixed(2)}</b>
    </span>
  );
}

/** A semicircle gauge for the card's risk score. */
export function Gauge({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(1, value));
  const R = 42;
  const len = Math.PI * R;
  const tone = v >= 0.8 ? 'hi' : v >= 0.5 ? 'mid' : 'lo';
  return (
    <div className={`gauge m-${tone}`} role="img" aria-label={`${label} ${v.toFixed(2)}`}>
      <svg viewBox="0 0 100 56">
        <path d="M8 50a42 42 0 0 1 84 0" className="gauge-track" />
        <path d="M8 50a42 42 0 0 1 84 0" className="gauge-fill" strokeDasharray={`${len * v} ${len}`} />
      </svg>
      <div className="gauge-value">
        <b>{v.toFixed(2)}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}

/** Small inline trend, one series, no axes; the tile it sits in names it. */
export function Spark({ values, height = 28 }: { values: number[]; height?: number }) {
  const max = Math.max(...values, 1);
  const n = values.length;
  if (n < 2) return null;
  const pts = values.map((v, i) => `${(i / (n - 1)) * 100},${height - (v / max) * (height - 3) - 1.5}`);
  return (
    <svg className="spark" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden>
      <polyline points={`0,${height} ${pts.join(' ')} 100,${height}`} className="spark-area" />
      <polyline points={pts.join(' ')} className="spark-line" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export type Place = { key: string; merchant: string; lat: number; long: number; count: number };

/**
 * Where a card paid, as dots at their longitude and latitude (east-west distance corrected for latitude, so the
 * shape is true), sized by how many payments were made there. Hover or focus a dot for its merchant.
 */
export function PlaceMap({ places, caption }: { places: Place[]; caption: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const PAD = 28;

  const lats = places.map((p) => p.lat);
  const longs = places.map((p) => p.long);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  // At least 0.1° each way, so one place or a tight cluster still sits in a readable frame.
  const spanLat = Math.max(Math.max(...lats) - Math.min(...lats), 0.1);
  const spanLong = Math.max(Math.max(...longs) - Math.min(...longs), 0.1);
  // As tall as the places' true shape needs, within reason.
  const H = Math.round(Math.min(320, Math.max(200, (spanLat / (spanLong * kx)) * (W - 2 * PAD) + 2 * PAD)));
  const scale = Math.min((W - 2 * PAD) / (spanLong * kx), (H - 2 * PAD) / spanLat);
  const cLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const cLong = (Math.min(...longs) + Math.max(...longs)) / 2;
  const x = (long: number) => W / 2 + (long - cLong) * kx * scale;
  const y = (lat: number) => H / 2 - (lat - cLat) * scale;

  // Graticule: per axis, the round step that gives at most `lines` lines across the frame.
  const grid = (from: number, to: number, lines: number) => {
    const step = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10].find((s) => (to - from) / s <= lines) ?? 20;
    const digits = step < 0.1 ? 2 : step < 1 ? 1 : 0;
    const out: { v: number; label: string }[] = [];
    for (let v = Math.ceil(from / step) * step; v <= to; v += step) out.push({ v, label: `${v.toFixed(digits)}°` });
    return out;
  };
  // No label where it would be clipped by the right edge or run into the longitude labels along the bottom.
  const longTicks = grid(cLong - W / 2 / (kx * scale), cLong + W / 2 / (kx * scale), 6).map((t) => ({
    ...t,
    label: x(t.v) > W - 40 ? '' : t.label,
  }));
  const latTicks = grid(cLat - H / 2 / scale, cLat + H / 2 / scale, 5).map((t) => ({
    ...t,
    label: y(t.v) > H - 22 || y(t.v) < 14 ? '' : t.label,
  }));

  const maxCount = Math.max(...places.map((p) => p.count), 1);
  const r = (count: number) => 4 + 6 * Math.sqrt(count / maxCount);
  // Big dots first, so a small one on top of a big one can still be hovered.
  const order = places.map((_, i) => i).sort((a, b) => places[b].count - places[a].count);
  const active = hover === null ? null : places[hover];

  return (
    <figure className="chart placemap" onMouseLeave={() => setHover(null)}>
      <div className="placemap-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={caption}>
          <g className="placemap-grid" aria-hidden>
            {longTicks.map(({ v, label }) => (
              <g key={`x${v}`}>
                <line x1={x(v)} x2={x(v)} y1={0} y2={H} />
                <text x={x(v) + 4} y={H - 6}>
                  {label}
                </text>
              </g>
            ))}
            {latTicks.map(({ v, label }) => (
              <g key={`y${v}`}>
                <line x1={0} x2={W} y1={y(v)} y2={y(v)} />
                <text x={4} y={y(v) - 4}>
                  {label}
                </text>
              </g>
            ))}
          </g>
          {order.map((i) => {
            const p = places[i];
            return (
              <g
                key={p.key}
                className={`placemap-dot${hover === i ? ' hot' : ''}`}
                tabIndex={0}
                aria-label={`${p.merchant}, ${p.count} payment${p.count > 1 ? 's' : ''}`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              >
                <circle cx={x(p.long)} cy={y(p.lat)} r={Math.max(r(p.count) + 6, 12)} className="hit" />
                <circle cx={x(p.long)} cy={y(p.lat)} r={r(p.count)} />
              </g>
            );
          })}
        </svg>
        {active && hover !== null && (
          <div
            className="tip"
            style={{
              left: `${(x(active.long) / W) * 100}%`,
              top: `${(y(active.lat) / H) * 100}%`,
              transform: `translate(${x(active.long) > W / 2 ? 'calc(-100% - 14px)' : '14px'}, -50%)`,
            }}
          >
            <strong>{active.merchant}</strong>
            <div className="tip-row">
              <span>Payments</span>
              <b>{active.count}</b>
            </div>
            <div className="tip-row">
              <span>Lat, long</span>
              <b className="mono">
                {active.lat.toFixed(3)}, {active.long.toFixed(3)}
              </b>
            </div>
          </div>
        )}
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
    </figure>
  );
}
