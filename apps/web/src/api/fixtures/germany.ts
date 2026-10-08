import { rentalsFor } from './community';
import type { PlacesBlock, Screen } from '@educaro/shared';
import { type ApplicantState, DAY } from './common';

/** Germany mode, example data. With the API running, places come from OpenStreetMap Overpass. */

const CITIES: Record<string, { lat: number; lon: number; district: string; url: string }> = {
  cologne: { lat: 50.9497, lon: 6.9179, district: 'Ehrenfeld', url: 'https://www.stadt-koeln.de' },
  köln: { lat: 50.9497, lon: 6.9179, district: 'Ehrenfeld', url: 'https://www.stadt-koeln.de' },
  aachen: { lat: 50.7753, lon: 6.0839, district: 'Mitte', url: 'https://www.aachen.de' },
  bonn: { lat: 50.7374, lon: 7.0982, district: 'Zentrum', url: 'https://www.bonn.de' },
  munich: { lat: 48.1497, lon: 11.5679, district: 'Maxvorstadt', url: 'https://stadt.muenchen.de' },
  darmstadt: { lat: 49.8728, lon: 8.6512, district: 'Mitte', url: 'https://www.darmstadt.de' },
  berlin: { lat: 52.5208, lon: 13.4094, district: 'Mitte', url: 'https://service.berlin.de' },
  düsseldorf: { lat: 51.2277, lon: 6.7735, district: 'Stadtmitte', url: 'https://www.duesseldorf.de' },
  stuttgart: { lat: 48.7758, lon: 9.1829, district: 'Mitte', url: 'https://www.stuttgart.de' },
};

function places(lat: number, lon: number, district: string, city: string): PlacesBlock['groups'] {
  const at = (dLat: number, dLon: number) => ({ lat: lat + dLat, lon: lon + dLon, distanceM: Math.round(Math.hypot(dLat * 111_000, dLon * 70_000)) });
  return [
    { kind: 'office', label: 'Bürgeramt (Anmeldung)', places: [{ name: `Bürgeramt ${district}`, address: `${district}, ${city}`, ...at(0.0036, -0.0133) }] },
    {
      kind: 'grocery',
      label: 'Indian groceries',
      places: [
        { name: 'Indian grocery store', address: 'Near the main street', ...at(-0.0017, 0.0051) },
        { name: 'Asian supermarket with Indian aisle', ...at(-0.0032, 0.0262) },
        { name: 'South Indian restaurant', ...at(0.0021, 0.0088) },
      ],
    },
    {
      kind: 'worship',
      label: 'Temples, gurdwaras and churches',
      places: [
        { name: 'Hindu temple', ...at(0.0123, 0.0421) },
        { name: 'Gurdwara', ...at(-0.0205, 0.0172) },
        { name: 'Malayalam Mass, monthly', ...at(-0.0122, 0.0425) },
      ],
    },
    { kind: 'pharmacy', label: 'Pharmacies (Apotheke)', places: [{ name: 'Apotheke', ...at(0.0004, 0.0012) }, { name: 'Apotheke', ...at(-0.0026, -0.0049) }] },
  ];
}

export function germanyScreen(s: ApplicantState, cityInput: string): Screen {
  const city = cityInput.trim() || 'Cologne';
  const c = CITIES[city.toLowerCase()] ?? CITIES.cologne;
  const first = s.applicant.name.split(' ')[0];
  const nurse = s.applicant.route === 'nursing';
  const arrive = new Date(Date.now() + 21 * DAY);
  const day = (offset: number) => new Date(arrive.getTime() + offset * DAY).toISOString().slice(0, 10);
  return {
    applicantId: s.applicant.id,
    version: s.screen.version,
    mode: 'germany',
    headline: `Welcome to ${city}, ${first}. This week: Anmeldung, a bank account and your SIM.`,
    footnote: 'Places come from OpenStreetMap. The numbers use your real rent and salary.',
    composedBy: 'agent',
    updatedAt: new Date().toISOString(),
    blocks: [
      {
        id: 'b-de-next',
        type: 'next_step',
        title: 'Your next step',
        body: 'Book your Anmeldung. You have 14 days after moving in. Bring your passport and the landlord’s form (Wohnungsgeberbestätigung). Your tax ID comes by post afterwards.',
        actions: [
          { label: 'Book at the Bürgeramt', kind: 'link', value: c.url },
          { label: 'What is the landlord form?', kind: 'chat', value: 'What is the Wohnungsgeberbestätigung?' },
        ],
        tags: ['web'],
      },
      {
        id: 'b-de-arrival',
        type: 'arrival',
        title: 'Your first weeks',
        phases: [
          {
            title: 'Before the flight',
            items: [
              { label: `Winter jacket, gloves and boots for ${city}`, done: false, note: 'Buy the jacket there: cheaper and warmer.' },
              { label: 'Passport, visa, contract and diploma in hand luggage', done: false },
              { label: 'Health insurance confirmed from day one', done: true },
              { label: 'Address for the first night', done: true, note: nurse ? 'With your sister' : 'Student residence' },
            ],
          },
          {
            title: 'First two weeks',
            items: [
              { label: 'Anmeldung at the Bürgeramt', done: false, note: 'Bring the Wohnungsgeberbestätigung' },
              { label: 'SIM card', done: false, note: 'Prepaid works without a bank account' },
              { label: 'Bank account', done: false },
              { label: 'Health insurance card', done: false },
              { label: 'Deutschlandticket', done: false, note: '€58 a month, all local transport' },
              { label: 'Tax ID by post', done: false, note: 'Arrives 2 to 3 weeks after Anmeldung' },
            ],
          },
          {
            title: 'Feel at home',
            items: [
              { label: `Join ${s.applicant.cohortChannel ?? 'your city channel'} on Discord`, done: Boolean(s.applicant.cohortChannel) },
              { label: 'Educaro intercultural workshop', done: false },
              { label: 'Meet your integration companion', done: false },
            ],
          },
        ],
      },
      {
        id: 'b-de-places',
        type: 'places',
        title: `Near you in ${c.district}`,
        body: 'Indian groceries, places of worship, the Bürgeramt and pharmacies.',
        city,
        center: { lat: c.lat, lon: c.lon },
        groups: places(c.lat, c.lon, c.district, city),
      },
      rentalsFor(city),
      {
        id: 'b-de-budget',
        type: 'budget',
        title: 'Your month, in real numbers',
        body: 'Your rent from the contract, everything else from the city averages.',
        city,
        lines: [
          { label: 'Rent, one-room flat (warm)', amount: 720, note: 'From your rental contract' },
          { label: 'Electricity and internet', amount: 70 },
          { label: 'Phone', amount: 15 },
          { label: 'Deutschlandticket', amount: 58 },
          { label: 'Food', amount: 300 },
          { label: 'Broadcasting fee (Rundfunkbeitrag)', amount: 18.36, note: 'Every flat pays it' },
          { label: 'Household and personal', amount: 120 },
        ],
        total: 1301.36,
        compare: [
          { city: 'Bonn', total: 1240 },
          { city: 'Düsseldorf', total: 1385 },
        ],
        sources: [
          { label: 'Deutschlandticket', url: 'https://www.deutschlandticket.de' },
          { label: 'Rundfunkbeitrag', url: 'https://www.rundfunkbeitrag.de' },
        ],
      },
      {
        id: 'b-de-payslip',
        type: 'budget',
        title: 'Your first payslip, explained',
        body: 'Tax class I, no children. Your employer pays the same again into pensions and insurance.',
        city,
        lines: [
          { label: 'Gross pay (Bruttolohn)', amount: 2950, note: 'From your contract' },
          { label: 'Income tax (Lohnsteuer)', amount: -281, note: 'Class I' },
          { label: 'Pension insurance', amount: -274, note: '9.3% of gross' },
          { label: 'Health insurance', amount: -258, note: 'Half the rate plus half the extra contribution' },
          { label: 'Long-term care insurance', amount: -71, note: 'A little higher without children' },
          { label: 'Unemployment insurance', amount: -38, note: '1.3% of gross' },
        ],
        total: 2028,
        compare: [],
        sources: [{ label: 'Federal Ministry of Finance tax calculator', url: 'https://www.bmf-steuerrechner.de' }],
      },
      {
        id: 'b-de-timeline',
        type: 'timeline',
        title: 'Coming up',
        items: [
          { date: day(0), label: `Land in ${city}`, kind: 'event' },
          { date: day(3), label: 'Anmeldung appointment', kind: 'task' },
          { date: day(7), label: nurse ? 'First day at work' : 'Enrolment at the university', kind: 'event' },
          { date: day(14), label: 'Anmeldung deadline (14 days)', kind: 'deadline' },
          { date: day(38), label: nurse ? 'First payslip' : 'Lectures start', kind: 'event' },
        ],
      },
      {
        id: 'b-de-services',
        type: 'services',
        title: 'Your people in Germany',
        services: [
          { id: 'svc-companion', name: 'Integration companion: Sabine Weber', url: 'https://www.educaro.de/fachkrafte/', why: `Your person in ${city}. She has your brief.` },
          { id: 'svc-workshop', name: 'Intercultural workshop', url: 'https://www.educaro.de/fachkrafte/', why: 'German workplace habits, in one afternoon.' },
        ],
      },
    ],
  };
}
