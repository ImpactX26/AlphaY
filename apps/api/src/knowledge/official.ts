/**
 * Official numbers the specialists cite. Each one names the page that states it and a short verbatim quote.
 * At run time the specialist opens the page (web_fetch logs it as a source for this run) and the
 * "no source, no save" guard checks the quote is still on the page. If the page changed, the value
 * is shown as AI-generated with a "could not confirm today" note and the fact-checker flags it.
 * Values and quotes are checked against research/knowledge.md.
 */
export interface OfficialFact {
  id: string;
  label: string;
  value: string;
  amount?: number;
  url: string;
  quote: string;
}

export const OFFICIAL: Record<string, OfficialFact> = {
  blocked_account: {
    id: 'blocked_account',
    label: 'Blocked account for students',
    value: '€11,904 per year (€992 per month)',
    amount: 992,
    url: 'https://www.auswaertiges-amt.de/en/sperrkonto/388600',
    quote: 'maximum rates for support received by German students',
  },
  aps_fee: {
    id: 'aps_fee',
    label: 'APS India fee',
    value: 'INR 18,000',
    amount: 18000,
    url: 'https://aps-india.de/',
    quote: '18,000',
  },
  aps_time: {
    id: 'aps_time',
    label: 'APS processing time',
    value: 'about 3 to 4 weeks',
    url: 'https://aps-india.de/',
    quote: 'weeks',
  },
  uniassist_fee: {
    id: 'uniassist_fee',
    label: 'uni-assist fee',
    value: '€75 for the first application, €30 for each further one in the same semester',
    amount: 75,
    url: 'https://www.uni-assist.de/en/how-to-apply/pay-all-fees/handling-fees',
    quote: 'EUR 75.00',
  },
  chancenkarte_points: {
    id: 'chancenkarte_points',
    label: 'Opportunity Card points',
    value: 'at least 6 points',
    amount: 6,
    url: 'https://www.make-it-in-germany.com/en/visa-residence/types/job-search-opportunity-card',
    quote: 'at least six points',
  },
  deutschlandticket: {
    id: 'deutschlandticket',
    label: 'Deutschlandticket',
    value: '€63 per month',
    amount: 63,
    url: 'https://www.bahn.de/angebot/regio/deutschland-ticket',
    quote: '63',
  },
  rundfunk: {
    id: 'rundfunk',
    label: 'Broadcasting fee (Rundfunkbeitrag)',
    value: '€18.36 per month per flat',
    amount: 18.36,
    url: 'https://www.rundfunkbeitrag.de/',
    quote: '18,36',
  },
  student_health: {
    id: 'student_health',
    label: 'Public health insurance for students',
    value: 'about €140 per month',
    amount: 140,
    url: 'https://www.study-in-germany.de/en/plan-your-studies/requirements/health-insurance/',
    quote: 'health insurance',
  },
  nursing_language: {
    id: 'nursing_language',
    label: 'German level for nursing recognition',
    value: 'usually B2',
    url: `${process.env.API_URL || 'http://localhost:3000'}/api/mock/anerkennung-nursing`,
    quote: 'B2',
  },
};
