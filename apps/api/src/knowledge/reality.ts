/**
 * The honest preview.
 *
 * Everything else an applicant reads about Germany is written by somebody who wants them to go:
 * agencies, universities, employers, us. The result is that people arrive having costed the visa
 * and not the first winter, and the ones who leave in year one rarely leave because of the
 * paperwork.
 *
 * So before anyone commits, the product says the hard parts out loud, with numbers. It is a strange
 * thing for a company that gets paid when people go — and it is the reason to trust the rest of the
 * screen. A plan that only contains good news is a brochure.
 *
 * Two things this file used to get wrong, both worth naming because they are the difference between
 * an honest preview and a page of text:
 *
 * - **`skilled_job` and `chancenkarte` were copies of `study`.** A nurse on the skilled-worker route
 *   was shown student shift patterns and told there are no tuition fees at a public university.
 *   Every route now has its own content, written for the people actually on it.
 * - **Nothing was personalised.** The figures are the same for everybody, which is correct for a
 *   shift pattern and wrong for money: what matters is what *they* will have left after *their*
 *   rent in *their* city. `personalise()` takes the computed numbers the specialists already hold
 *   and rewrites the money section around them, so the preview is about them rather than about a
 *   route.
 *
 * The alumni figures come from exit conversations and are labelled as that, not as a study.
 */

export interface Reality {
  route: string;
  headline: string;
  shifts: { label: string; detail: string }[];
  money: { label: string; detail: string }[];
  hard: { stat: string; detail: string }[];
  voices: { who: string; quote: string }[];
  source: string;
}

const SOURCE = 'TVöD-P and TVöD pay tables, Destatis cost-of-living data, and Educaro alumni exit conversations (n≈120, 2024–2026). Indicative, not a study.';

export const REALITY: Record<string, Reality> = {
  nursing: {
    route: 'nursing',
    headline: 'The work is real nursing, the money is better than home, and the first three months are the hardest thing most people have done.',
    shifts: [
      { label: 'Early, late, night', detail: 'A German ward runs three shifts: roughly 06:00–14:30, 13:30–22:00, 21:30–06:30. You will work all three in a month, usually in blocks.' },
      { label: 'Night duties', detail: 'Expect 4 to 8 nights a month. Nights pay a supplement of about 25%, Sundays 25%, public holidays up to 135%.' },
      { label: 'Patients per nurse', detail: 'Usually 8 to 12 on a general ward in daytime, more at night. Lower than most Indian hospitals, but you document far more.' },
      { label: 'Documentation', detail: 'Perhaps a quarter of your shift is written, in German. This is the part people underestimate, not the clinical work.' },
      { label: 'Holiday', detail: '30 days a year under TVöD, plus extra days for shift work. Most people go home once a year on it.' },
    ],
    money: [
      { label: 'Starting gross', detail: 'About EUR 3,300 a month in pay group P7, before supplements.' },
      { label: 'After tax', detail: 'Around EUR 2,200 net in tax class I, before rent. Supplements add EUR 150–400 depending on the shifts you take.' },
      { label: 'After rent', detail: 'A WG room in Cologne is about EUR 580 warm. Realistically you keep EUR 900–1,200 after everything.' },
      { label: 'Sending money home', detail: 'Most people send EUR 300–600 a month in the first year. Plan it, do not discover it.' },
      { label: 'While recognised', detail: 'During the adaptation period you are paid as an assistant, roughly 80% of the full rate, for up to 12 months.' },
    ],
    hard: [
      { stat: '8 in 10 say the first three months were the hardest part', detail: 'Not the exam and not the visa: the language at speed, on a ward, when someone needs an answer now.' },
      { stat: 'B2 on paper is not B2 on a ward', detail: 'Handover is fast, dialect is real, and nobody slows down for you at first. It takes most people another three to six months on the job.' },
      { stat: 'The first winter', detail: 'Dark by four in the afternoon from November, and about 1 °C in January in Cologne. People describe this as harder than the cold itself.' },
      { stat: 'Recognition takes 3 to 4 months after the file is complete', detail: 'And "complete" is the word doing the work: a missing translation adds weeks.' },
      { stat: 'Roughly 1 in 6 moves employer in the first two years', detail: 'Usually for a better ward or a different city, and that is allowed — your permit follows your qualification, not your contract.' },
    ],
    voices: [
      { who: 'Nurse, Kochi → Essen, 2024', quote: 'I thought the exam would be the hard part. The hard part was the first handover, when three people talked at once and I understood one of them.' },
      { who: 'Nurse, Kottayam → Cologne, 2023', quote: 'The money is genuinely better. But I did not plan for how expensive the first month is before the first salary arrives.' },
      { who: 'Nurse, Thrissur → Munich, 2025', quote: 'Find the Indian shop in week one. It sounds small. It is not small.' },
    ],
    source: SOURCE,
  },

  ausbildung: {
    route: 'ausbildung',
    headline: 'Three years of paid training that ends with the German qualification itself — low pay while you learn, no recognition fight afterwards.',
    shifts: [
      { label: 'School and ward', detail: 'Alternating blocks: weeks in the Pflegeschule, weeks on a ward. Both are in German from day one.' },
      { label: 'Exams', detail: 'Written, oral and practical at the end of the third year. People fail the German, almost never the nursing.' },
      { label: 'Hours', detail: 'About 38.5 a week, including school time. Night shifts start in the second year.' },
    ],
    money: [
      { label: 'Training salary', detail: 'Roughly EUR 1,340 in year one, 1,400 in year two, 1,500 in year three, gross.' },
      { label: 'After tax and rent', detail: 'About EUR 1,050 net. A WG room takes half of it, so this is a tight three years.' },
      { label: 'Afterwards', detail: 'You step straight onto the full P7 scale, about EUR 3,300, with no recognition procedure at all.' },
    ],
    hard: [
      { stat: 'Three years is a long time on a training wage', detail: 'People who arrive expecting to send money home in year one find they cannot. Plan for that honestly with your family before you go.' },
      { stat: 'School is in German, not English', detail: 'B1 gets you in the door; B2 is what gets you through the first year.' },
      { stat: 'It is the right route if your diploma will not be recognised', detail: 'A GNM diploma usually gets a deficit notice. Ausbildung avoids that entirely and ends higher.' },
    ],
    voices: [
      { who: 'Ausbildung, Pune → Dortmund, 2023', quote: 'Year one I had no money and no words. Year three I had both. I would do it again, but I would want somebody to tell me year one straight.' },
    ],
    source: SOURCE,
  },

  study: {
    route: 'study',
    headline: 'No tuition fees, a real degree, and the part nobody warns you about is how much of it you organise alone.',
    shifts: [
      { label: 'Contact hours', detail: 'Often only 12 to 18 a week. The rest is self-study, and nobody chases you.' },
      { label: 'Exams', detail: 'Frequently one exam at the end worth the entire module. Retakes are limited — usually three attempts, then you are out of the programme.' },
      { label: 'Working alongside', detail: '20 hours a week during term on a student visa, 140 full days a year. A student job pays about EUR 13–15 an hour.' },
    ],
    money: [
      { label: 'Tuition', detail: 'None at a public university. The semester contribution is EUR 85–350 and usually includes a transport ticket.' },
      { label: 'Blocked account', detail: 'EUR 11,904 for the first year, of which you may take EUR 992 a month. That is the real cost of starting.' },
      { label: 'Living', detail: 'Munich is about EUR 1,290 a month, Aachen about EUR 1,020. Choosing the city is choosing the budget.' },
    ],
    hard: [
      { stat: 'Roughly 1 in 4 international students does not finish', detail: 'Overwhelmingly the self-directed study and the exam format, not the subject.' },
      { stat: 'Finding a room is harder than getting admitted', detail: 'In Munich expect 30+ applications. Start before the visa, not after.' },
      { stat: 'The APS adds 4 to 6 weeks', detail: 'Before you can even apply. Starting it late is the single most common reason a semester is missed.' },
    ],
    voices: [
      { who: 'MSc, Pune → Darmstadt, 2024', quote: 'Nobody takes attendance. In the first semester that felt like freedom. By the exam it felt like a trap.' },
      { who: 'MSc, Hyderabad → Aachen, 2023', quote: 'I had the admission in March and a room in September. Four of those months I was genuinely frightened.' },
    ],
    source: SOURCE,
  },

  /**
   * Written for the skilled-worker route, which used to be served a copy of the student page —
   * so an engineer on a EUR 4,200 salary was told about blocked accounts and semester fees.
   */
  skilled_job: {
    route: 'skilled_job',
    headline: 'A proper salary and a proper job, and a first year where the language decides how much of either you enjoy.',
    shifts: [
      { label: 'The working week', detail: 'Usually 38 to 40 hours, Monday to Friday. Overtime exists but is logged and either paid or taken back as time off — a blanket "it is in the salary" clause is not enforceable.' },
      { label: 'How work feels different', detail: 'Meetings start on time, decisions are written down, and disagreeing with your manager in a meeting is normal rather than rude. Most people find the directness harder than the hours.' },
      { label: 'Holiday', detail: '25 to 30 days is typical, and you are expected to take it. Nobody is impressed by unused leave.' },
      { label: 'Probation', detail: 'Six months, during which either side can end it with two weeks notice. After that, dismissal protection is strong.' },
    ],
    money: [
      { label: 'Starting gross', detail: 'About EUR 4,000–4,800 a month for an engineer or developer with two years of experience. Less outside the big cities, and less in the east.' },
      { label: 'After tax', detail: 'Roughly EUR 2,600–3,000 net in tax class I. The gap between gross and net is the thing that surprises people most.' },
      { label: 'After rent', detail: 'A one-bedroom flat is EUR 900–1,400 depending on the city. You will keep EUR 1,300–1,900 after everything.' },
      { label: 'The first two months', detail: 'Deposit, furniture, the Anmeldung queue and no salary yet. Budget EUR 3,000–4,000 for the landing itself.' },
    ],
    hard: [
      { stat: 'English at work is not English outside it', detail: 'Your team may run in English. Your landlord, your Bürgeramt appointment, your doctor and your tax office will not. This is the single biggest complaint we hear from people on this route.' },
      { stat: 'Finding a flat takes longer than finding the job', detail: 'In Munich or Frankfurt expect two to three months and dozens of applications, often while paying for temporary accommodation.' },
      { stat: 'The Anmeldung bottleneck', detail: 'You cannot get a tax ID, a bank account or a permanent contract smoothly without registering, and appointments can be four to six weeks out. Book it before you land if the city allows it.' },
      { stat: 'Roughly 1 in 5 changes employer within two years', detail: 'Usually upwards. Your permit follows your qualification, not the company, but tell us before you resign so the paperwork follows you.' },
    ],
    voices: [
      { who: 'Software engineer, Pune → Berlin, 2024', quote: 'The job was the easy part. I underestimated every single thing that happens outside the office in German.' },
      { who: 'Mechanical engineer, Chennai → Stuttgart, 2023', quote: 'My gross looked enormous from India. My first payslip was a shock. Nobody had explained class I to me.' },
    ],
    source: SOURCE,
  },

  /** The opportunity card: a year to find the job, funded entirely by you. */
  chancenkarte: {
    route: 'chancenkarte',
    headline: 'A year in Germany to find the job yourself — the freedom is real, and so is the clock.',
    shifts: [
      { label: 'What you may do', detail: 'Work 20 hours a week while you search, plus two-week trial periods with an employer. Enough to slow the money going out, not enough to live on.' },
      { label: 'The search itself', detail: 'Applications are formal: a one-page CV in German format, a tailored cover letter, and certificates attached. A generic application is not read.' },
      { label: 'The clock', detail: 'Twelve months, extendable to two years only once you have a qualified job offer. There is no quiet extension.' },
    ],
    money: [
      { label: 'Before you go', detail: 'About EUR 13,092 in a blocked account — the whole year, up front, before the visa is granted. This is the single largest sum on the route.' },
      { label: 'What you may withdraw', detail: 'About EUR 1,091 a month. In Munich that is tight; in Leipzig or Dortmund it is workable.' },
      { label: 'The part-time work', detail: '20 hours a week at EUR 13–15 adds roughly EUR 700–900 gross a month, which extends the runway rather than replacing it.' },
    ],
    hard: [
      { stat: 'You fund the entire year yourself', detail: 'No employer, no university, no scholarship. If the blocked account is a stretch, one of the other routes is almost certainly the better plan.' },
      { stat: 'Two to four months to a signed contract is normal', detail: 'In German, with a recognised qualification. People who arrive expecting six weeks spend the back half of the year frightened.' },
      { stat: 'The points are not the hard part', detail: 'Qualifying for the card is arithmetic. Converting a year of freedom into a contract is the hard part, and it is mostly language and persistence.' },
      { stat: 'Recognition still matters', detail: 'The card lets you in; it does not make your qualification equivalent. Start Anerkennung before you fly, not after.' },
    ],
    voices: [
      { who: 'Chancenkarte, Hyderabad → Leipzig, 2025', quote: 'I chose the cheap city and it is the only reason the year worked. Munich would have eaten the blocked account by month seven.' },
    ],
    source: SOURCE,
  },
};

export function realityFor(route: string | null): Reality | null {
  return route ? (REALITY[route] ?? null) : null;
}

export interface PersonalFigures {
  city?: string | null;
  /** Monthly gross, where the money specialist computed one. */
  grossEur?: number | null;
  netEur?: number | null;
  /** Their own monthly budget total, including rent. */
  monthlyCostEur?: number | null;
  rentEur?: number | null;
  /** What the finance plan says they need before they can fly. */
  needBeforeTravelEur?: number | null;
  /** Their proven German, so "B2 is not B2 on a ward" can be aimed at where they actually are. */
  germanProven?: string | null;
  germanNeeded?: string | null;
  /** Coldest-month low and December daylight for their city, when we have them. */
  winterLowC?: number | null;
  homeCity?: string | null;
}

const eur = (n: number) => `EUR ${Math.round(n).toLocaleString('en-GB')}`;

/**
 * Rewrite the generic preview around this person's own numbers.
 *
 * Only the money section and a couple of the hard truths are replaced; the shift pattern is the
 * same for everyone on a ward and inventing per-person variation in it would be dishonest. Each
 * substitution only happens when the figure actually exists, so a file with nothing computed yet
 * degrades to the generic page rather than to blanks.
 */
export function personalise(base: Reality, who: PersonalFigures): Reality {
  const money = [...base.money];
  const hard = [...base.hard];
  const city = who.city ?? null;

  if (who.netEur && who.monthlyCostEur) {
    const left = Math.round(who.netEur - who.monthlyCostEur);
    money.unshift({
      label: `What this leaves you, in ${city ?? 'your city'}`,
      detail:
        left > 0
          ? `${eur(who.netEur)} net a month against ${eur(who.monthlyCostEur)} of living costs${who.rentEur ? ` (${eur(who.rentEur)} of it rent)` : ''}. That is about ${eur(left)} a month left — before anything you send home.`
          : `${eur(who.netEur)} net against ${eur(who.monthlyCostEur)} of living costs${who.rentEur ? ` (${eur(who.rentEur)} of it rent)` : ''}. On these figures it does not balance, which is worth facing now rather than in month two. A flat-share or a cheaper city closes most of the gap.`,
    });
  } else if (who.grossEur) {
    money.unshift({ label: 'Your starting salary', detail: `About ${eur(who.grossEur)} a month gross on this route, before supplements.` });
  }

  if (who.needBeforeTravelEur) {
    money.push({
      label: 'Before you can go at all',
      detail: `${eur(who.needBeforeTravelEur)} on your current plan — courses, papers, fees, the flight and the first month. This is the number people most often meet late.`,
    });
  }

  if (who.germanProven && who.germanNeeded && who.germanProven !== who.germanNeeded) {
    hard.unshift({
      stat: `You are at ${who.germanProven} and this route needs ${who.germanNeeded}`,
      detail: `That is the single biggest thing between you and going. Each level takes most people three to four months of real study, and the exam is the easy half — ${base.route === 'nursing' ? 'a handover at speed is the hard half' : 'using it all day is the hard half'}.`,
    });
  }

  if (city && who.winterLowC !== null && who.winterLowC !== undefined) {
    hard.push({
      stat: `Your first winter in ${city}`,
      detail: `About ${who.winterLowC} °C on an average January night, and dark by four in the afternoon from November${who.homeCity ? `. You have never lived through that in ${who.homeCity}` : ''}. Alumni describe the darkness as harder than the cold.`,
    });
  }

  return { ...base, money, hard };
}
