/**
 * Links that open in the map app someone already has.
 *
 * A pin on our own map is a picture. What an applicant actually does with "there is an Indian shop
 * at Venloer Str. 405" is work out how to get there, and they will do that in Google Maps whatever
 * we render — so the shortest path is to hand them the link rather than make them retype an address
 * they cannot yet spell.
 *
 * Google's documented `api=1` URLs need no key and no SDK, and they open the native app on a phone
 * and the web on a laptop.
 */

const q = (s: string) => encodeURIComponent(s);

/**
 * Drop a pin at the coordinates.
 *
 * Coordinates only, deliberately. Passing the name as well looks friendlier and is worse: `query`
 * may only appear once, Google keeps the last one, and a text search for "Asia Food Center" from a
 * phone that thinks it is in Kochi can land on the wrong continent. The pin is the thing that has
 * to be right.
 */
export function mapsUrl(place: { name?: string | null; address?: string | null; lat: number; lon: number }): string {
  return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lon}`;
}

/**
 * Directions by public transport, which is how this is actually travelled: almost nobody arriving
 * in Germany has a car in the first year, and the Deutschlandticket makes transit the default.
 */
export function directionsUrl(to: { lat: number; lon: number }, from?: { lat: number; lon: number } | string | null): string {
  const origin = typeof from === 'string' ? q(from) : from ? `${from.lat},${from.lon}` : '';
  return `https://www.google.com/maps/dir/?api=1${origin ? `&origin=${origin}` : ''}&destination=${to.lat},${to.lon}&travelmode=transit`;
}
