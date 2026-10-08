import type { RentalsBlock } from '@educaro/shared';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';

type Listing = RentalsBlock['listings'][number];

/** The place that decides their day: the hospital or the campus they commute to. */
function anchorIcon(label: string) {
  return L.divIcon({
    className: '',
    html: `<span style="display:grid;place-items:center;min-width:26px;height:26px;padding:0 8px;border-radius:13px;background:var(--ink);color:var(--bg);font:700 11px/1 system-ui;white-space:nowrap;box-shadow:0 0 0 3px var(--surface)">${label}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function Fit({ center, listings }: { center: { lat: number; lon: number }; listings: Listing[] }) {
  const map = useMap();
  useEffect(() => {
    const points: L.LatLngExpression[] = [[center.lat, center.lon], ...listings.map((l) => [l.lat, l.lon] as L.LatLngExpression)];
    if (points.length > 1) map.fitBounds(L.latLngBounds(points).pad(0.18), { animate: false });
  }, [map, center, listings]);
  return null;
}

export default function RentalsMap({
  block,
  active,
  onActive,
}: {
  block: RentalsBlock;
  active: string | null;
  onActive: (id: string | null) => void;
}) {
  const { center, anchor, listings, city } = block;
  return (
    <MapContainer
      center={[center.lat, center.lon]}
      zoom={12}
      scrollWheelZoom={false}
      style={{ height: 280 }}
      attributionControl
      aria-label={`Map of rooms and flats in ${city}`}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={18}
      />
      <Fit center={center} listings={listings} />

      {anchor ? (
        <Marker position={[anchor.lat, anchor.lon]} icon={anchorIcon(anchor.label)}>
          <Popup>{anchor.label}</Popup>
        </Marker>
      ) : null}

      {listings.map((l) => (
        <CircleMarker
          key={l.id}
          center={[l.lat, l.lon]}
          // Within budget or over it: the same green and amber as the list, so the two read as one.
          pathOptions={{
            color: l.affordable ? 'var(--ok)' : 'var(--warn)',
            fillColor: l.affordable ? 'var(--ok)' : 'var(--warn)',
            fillOpacity: active === l.id ? 0.95 : 0.6,
            weight: active === l.id ? 3 : 1.5,
          }}
          radius={active === l.id ? 11 : 7}
          eventHandlers={{ mouseover: () => onActive(l.id), mouseout: () => onActive(null) }}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            {l.title} · €{Math.round(l.warmRentEur)}
            {l.commuteMin !== null ? ` · ${l.commuteMin} min` : ''}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
