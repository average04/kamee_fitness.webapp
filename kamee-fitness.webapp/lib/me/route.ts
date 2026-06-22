type LatLng = { lat: number; lng: number };

/** Coerce a jsonb route_points value into an array of {lat,lng}. */
function coerce(routePoints: unknown): LatLng[] {
  if (!Array.isArray(routePoints)) return [];
  const out: LatLng[] = [];
  for (const p of routePoints) {
    if (p && typeof p === "object") {
      const rec = p as Record<string, unknown>;
      const lat = rec.lat ?? rec.latitude;
      const lng = rec.lng ?? rec.longitude;
      if (typeof lat === "number" && typeof lng === "number") {
        out.push({ lat, lng });
      }
    }
  }
  return out;
}

/**
 * Normalize GPS points into an SVG `points` string within a `size`×`size` box,
 * preserving aspect via uniform scale + centering. `""` when fewer than 2 points.
 */
export function routeToPolyline(routePoints: unknown, size: number): string {
  const pts = coerce(routePoints);
  if (pts.length < 2) return "";
  const xs = pts.map((p) => p.lng);
  const ys = pts.map((p) => p.lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const pad = size * 0.1;
  const inner = size - pad * 2;
  const scale = inner / Math.max(spanX, spanY);
  const offX = pad + (inner - spanX * scale) / 2;
  const offY = pad + (inner - spanY * scale) / 2;
  return pts
    .map((p) => {
      const x = offX + (p.lng - minX) * scale;
      // invert Y so north is up
      const y = size - (offY + (p.lat - minY) * scale);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
