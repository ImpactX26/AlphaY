/**
 * Weather, from Open-Meteo. Free, no key, no account.
 *
 * It sounds like small talk and it is not. Someone leaving Kochi, where it has never been below
 * about 20 °C in their life, is moving to a city that spends three months near freezing and gets
 * dark at four in the afternoon. "Bring a winter jacket" means nothing without a number next to it,
 * and the first German winter is one of the most common reasons people go home early.
 *
 * So the agent answers a weather question with the thing that actually matters: what it is doing
 * there now, and what the coldest month of their first year looks like.
 */

export interface Weather {
  city: string;
  nowC: number | null;
  todayMinC: number | null;
  todayMaxC: number | null;
  description: string;
  coldestMonth: { name: string; avgLowC: number } | null;
  daylightHoursInDecember: number | null;
  source: string;
}

// WMO weather codes, the ones that actually come back for northern Europe.
const WMO: Record<number, string> = {
  0: 'clear',
  1: 'mostly clear',
  2: 'partly cloudy',
  3: 'overcast',
  45: 'fog',
  48: 'freezing fog',
  51: 'light drizzle',
  53: 'drizzle',
  55: 'heavy drizzle',
  61: 'light rain',
  63: 'rain',
  65: 'heavy rain',
  66: 'freezing rain',
  67: 'heavy freezing rain',
  71: 'light snow',
  73: 'snow',
  75: 'heavy snow',
  77: 'snow grains',
  80: 'rain showers',
  81: 'rain showers',
  82: 'violent rain showers',
  85: 'snow showers',
  86: 'heavy snow showers',
  95: 'thunderstorm',
  96: 'thunderstorm with hail',
  99: 'thunderstorm with heavy hail',
};

/**
 * German winter averages, so a question in July still gets an honest answer about January.
 * Open-Meteo's archive endpoint could compute these, but it is a second slow call for numbers that
 * do not move, and the point is to warn somebody, not to be precise to a tenth of a degree.
 */
const WINTER: Record<string, { month: string; avgLowC: number; decemberDaylight: number }> = {
  cologne: { month: 'January', avgLowC: 1, decemberDaylight: 7.9 },
  munich: { month: 'January', avgLowC: -3, decemberDaylight: 8.2 },
  aachen: { month: 'January', avgLowC: 1, decemberDaylight: 7.9 },
  darmstadt: { month: 'January', avgLowC: -1, decemberDaylight: 8.1 },
  berlin: { month: 'January', avgLowC: -2, decemberDaylight: 7.6 },
  hamburg: { month: 'January', avgLowC: -1, decemberDaylight: 7.2 },
  frankfurt: { month: 'January', avgLowC: -1, decemberDaylight: 8.0 },
  stuttgart: { month: 'January', avgLowC: -2, decemberDaylight: 8.3 },
  düsseldorf: { month: 'January', avgLowC: 1, decemberDaylight: 7.9 },
  dusseldorf: { month: 'January', avgLowC: 1, decemberDaylight: 7.9 },
  bonn: { month: 'January', avgLowC: 1, decemberDaylight: 7.9 },
};

export async function fetchWeather(city: string, lat: number, lon: number, fetchImpl: typeof fetch = fetch): Promise<Weather> {
  const winter = WINTER[city.toLowerCase()] ?? null;
  const base: Weather = {
    city,
    nowC: null,
    todayMinC: null,
    todayMaxC: null,
    description: 'not available right now',
    coldestMonth: winter ? { name: winter.month, avgLowC: winter.avgLowC } : null,
    daylightHoursInDecember: winter?.decemberDaylight ?? null,
    source: 'Open-Meteo',
  };
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=Europe%2FBerlin`;
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j: any = await res.json();
    return {
      ...base,
      nowC: Math.round(j?.current?.temperature_2m ?? NaN) || (j?.current?.temperature_2m === 0 ? 0 : null),
      todayMinC: Math.round(j?.daily?.temperature_2m_min?.[0] ?? NaN) || (j?.daily?.temperature_2m_min?.[0] === 0 ? 0 : null),
      todayMaxC: Math.round(j?.daily?.temperature_2m_max?.[0] ?? NaN) || (j?.daily?.temperature_2m_max?.[0] === 0 ? 0 : null),
      description: WMO[j?.current?.weather_code] ?? 'unclear skies',
    };
  } catch {
    return base;
  }
}

/** One or two sentences an applicant can act on, rather than a forecast they cannot. */
export function describeWeather(w: Weather, homeCity?: string | null): string {
  const parts: string[] = [];
  if (w.nowC !== null) {
    parts.push(`It is ${w.nowC} °C in ${w.city} right now, ${w.description}${w.todayMinC !== null && w.todayMaxC !== null ? `, between ${w.todayMinC} and ${w.todayMaxC} today` : ''}.`);
  } else {
    parts.push(`I could not reach the weather service for ${w.city} just now.`);
  }
  if (w.coldestMonth) {
    parts.push(
      `${w.coldestMonth.name} is the one to plan for: lows around ${w.coldestMonth.avgLowC} °C${w.daylightHoursInDecember ? `, and about ${w.daylightHoursInDecember} hours of daylight in December` : ''}.` +
        `${homeCity ? ` That is a long way from ${homeCity}, so a proper winter jacket and waterproof shoes belong on the packing list, not in the first German shopping trip.` : ' A proper winter jacket and waterproof shoes belong on the packing list.'}`,
    );
  }
  return parts.join(' ');
}
