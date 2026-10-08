/**
 * The honest preview.
 *
 * Everything else an applicant reads about Germany is written by somebody who wants them to go:
 * agencies, universities, employers, us. The result is that people arrive having costed the visa
 * and not the first winter, and the ones who leave in year one rarely leave because of the paperwork.
 *
 * So before anyone commits, the product says the hard parts out loud, with numbers. It is a strange
 * thing for a company that gets paid when people go — and it is the reason to trust the rest of the
 * screen. A plan that only contains good news is a brochure.
 *
 * The figures below are drawn from the published collective agreements and from what alumni tell us
 * in exit conversations; the block says so rather than implying a study.
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

const SOURCE = 'TVöD-P pay tables, Educaro alumni conversations (n≈120, 2024–2026). Indicative, not a study.';

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
};

REALITY.skilled_job = { ...REALITY.study, route: 'skilled_job', headline: 'A proper salary and a proper job, and a first year where the language decides how much of either you enjoy.' };
REALITY.chancenkarte = {
  ...REALITY.study,
  route: 'chancenkarte',
  headline: 'A year to find the job, funded entirely by you — the freedom is real and so is the clock.',
  hard: [
    { stat: 'You must fund the whole year yourself', detail: 'About EUR 1,091 a month in a blocked account before the visa is granted.' },
    { stat: 'You may work only 20 hours a week while searching', detail: 'Plus two-week trial periods with an employer.' },
    { stat: 'Applications take longer than people plan for', detail: 'Expect two to four months to a signed contract, in German, with a recognised qualification.' },
  ],
};

export function realityFor(route: string | null): Reality | null {
  return route ? REALITY[route] ?? null : null;
}
