import type { PlacesBlock } from '@educaro/shared';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';

type Place = PlacesBlock['groups'][number]['places'][number] & { kind: string; groupLabel: string };

const COLOR: Record<string, string> = {
  office: 'var(--agent)',
  grocery: 'var(--applicant)',
  worship: 'var(--staff)',
  pharmacy: 'var(--bad)',
  restaurant: 'var(--loop)',
  transport: 'var(--rules)',
};

const homeIcon = L.divIcon({
  className: '',
  html: '<span style="display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--ink);color:var(--bg);font:700 11px/1 system-ui;box-shadow:0 0 0 3px var(--surface)">You</span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function FitBounds({ center, places }: { center: { lat: number; lon: number }; places: Place[] }) {
  const map = useMap();
  useEffect(() => {
    const points: L.LatLngExpression[] = [[center.lat, center.lon], ...places.map((p) => [p.lat, p.lon] as L.LatLngExpression)];
    if (points.length > 1) map.fitBounds(L.latLngBounds(points).pad(0.15), { animate: false });
  }, [map, center, places]);
  return null;
}

export default function PlacesMap({
  center,
  city,
  places,
  active,
  onActive,
}: {
  center: { lat: number; lon: number };
  city: string;
  places: Place[];
  active: string | null;
  onActive: (key: string | null) => void;
}) {
  return (
    <MapContainer center={[center.lat, center.lon]} zoom={13} scrollWheelZoom={false} style={{ height: 280 }} attributionControl aria-label={`Map of places near you in ${city}`}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' maxZoom={18} />
      <FitBounds center={center} places={places} />
      <Marker position={[center.lat, center.lon]} icon={homeIcon}>
        <Popup>Your address in {city}</Popup>
      </Marker>
      {places.map((p) => {
        const key = `${p.name}-${p.lat}-${p.lon}`;
        const on = active === key;
        return (
          <CircleMarker
            key={key}
            center={[p.lat, p.lon]}
            radius={on ? 10 : 7}
            pathOptions={{ color: COLOR[p.kind] ?? 'var(--ink)', fillColor: COLOR[p.kind] ?? 'var(--ink)', fillOpacity: on ? 0.95 : 0.6, weight: 2 }}
            eventHandlers={{ mouseover: () => onActive(key), mouseout: () => onActive(null) }}
          >
            <Tooltip>{p.name}</Tooltip>
            <Popup>
              <strong>{p.name}</strong>
              <br />
              {p.groupLabel}
              {p.address ? (
                <>
                  <br />
                  {p.address}
                </>
              ) : null}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
