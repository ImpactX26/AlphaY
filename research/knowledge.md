# Knowledge base: India to Germany (Educaro hackathon prototype)

Researched 2026-10-08. Line format: `- value | URL | "verbatim quote" | note`

How the quotes were checked: each URL was fetched on 2026-10-08 with a plain HTTP GET (curl, no JavaScript). Scripts and styles were removed, HTML entities decoded and whitespace collapsed, and each quote was then matched exactly. Unless a note says otherwise, every quote sits inside one HTML text node, so it does not depend on how tags are joined. `[inline-tags]` marks the few quotes that cross inline markup such as `<strong>`, `<a>` or `<code>`. The source always has a literal space at those boundaries, but your checker must collapse whitespace for them to match. UNCONFIRMED means I could not confirm the value on an official page.

---

## A. Educaro (educaro.de)

### A.0 Organisation and contacts
- Educaro (educaro Deutschland GmbH), headquarters in Düsseldorf | https://www.educaro.de/ | "Das Unternehmen basiert auf einer internationalen Unternehmensstruktur mit Hauptsitz in Düsseldorf" | Address: Graf-Adolf-Straße 22, 40212 Düsseldorf.
- Founded 2014 by MD Christian Sassin | https://www.educaro.de/ | "wurde im Jahr 2014 von Geschäftsführer Christian Sassin gegründet" | The /general/ page says "since 2013", which is inconsistent.
- Germany phone: +49 211 545 6101 | https://www.educaro.de/ | "+49 211 545 6101" | Short contact string, the same in every page footer.
- Germany email: info@educaro.de | https://www.educaro.de/ | "info@educaro.de" | Compliance email: report@educaro.de. Careers: career@educaro.de (on /karriere/).
- India office city: Bangalore (Bengaluru), Hebbal Kempapura, opened 2017 | https://www.educaro.de/ | "Der im Jahr 2017 eröffnete Standort in Bangalore gehört zu den ersten" | Full address: Educaro India, SAS Alexandria, No. 15-16, 18A Cross, Dasarhalli Main Road, Bhuvaneshwari Nagar, Hebbal Kempapura, Bangalore, Karnataka 560 025. Lines are separated by `<br>`, so quote only the last line.
- India address, last line | https://www.educaro.de/india/ | "Bangalore, Karnataka, India 560 025" | Short.
- India office consultations in person | https://www.educaro.de/india/ | "Send us an email and we can schedule a consultation in our office." | The heading on the same page reads "YOU CAN ALSO FIND US IN BANGALORE".
- India phone: +91 96 1154 3642 | https://www.educaro.de/india/ | "+91 96 1154 3642" | Short contact string.
- India email: india@educaro.de | https://www.educaro.de/india/ | "india@educaro.de" | Short contact string.
- India managing director: Vasundhara Agarwal | https://www.educaro.de/ | "Vasundhara Agarwal" | Shown as "Geschäftsführerin Indien" in a separate element.
- Track record: more than 1,500 professionals placed since 2014 | https://www.educaro.de/india/ | "Since 2014, Educaro has helped over 1,500 young professionals" |
- RAL quality mark for fair recruitment of nurses | https://www.educaro.de/india/ | "Educaro has been awarded the RAL Quality Mark for" | Full title: "Fair Recruitment of Nursing Professionals for Germany" (written with curly quotes on the page, so not quoted here).
- Free for candidates ("employer pays" principle, WHO code) | https://www.educaro.de/india/nursing-program/ | "This ensures that no fees are charged to candidates." |
- Exception: a security-deposit cheque is taken from nurses and refunded later | https://www.educaro.de/india/event/ | "security-deposit-cheque is retained when signing the employment contract" | The words before this quote are joined by NBSPs, so they were left out.
- Apply / registration form (choose Nursing program, Ausbildung, or Study in Germany / German Classes) | https://www.educaro.de/india/registration/ | "As soon as you have submitted the registry, one of our advisors will contact you shortly." | The "Apply now" button for Study in Germany goes to https://desk2.educaro.de/apply/... and may need JavaScript.

### A.1 Service catalogue
Each service starts with a header line (id, name, URL, who it is for, description), followed by its facts.

**1. `nursing-program` - Nursing Program (registered nurse pathway)** | https://www.educaro.de/india/nursing-program/ | For: nurses (Post Basic B.Sc., B.Sc. or M.Sc. Nursing) | A free, employer-paid programme. You learn German online in India up to B1 and interview with German hospitals. You then get a permanent contract, a visa and relocation help. In Germany you work while doing B2 and the Kenntnisprüfung for recognition.
- Requirement: high-school diploma plus at least a bachelor's degree in nursing | https://www.educaro.de/india/nursing-program/ | "A high school diploma and at least a bachelor's degree in nursing" | The apostrophe in the quote is ASCII.
- Eligible degrees: Post Basic B.Sc., B.Sc. and M.Sc. nurses | https://www.educaro.de/india/event/ | "suitable for Post Basic B.Sc., B.Sc. and M.Sc.nurses" | [inline-tags]. Candidates without a nursing degree are pointed to the Ausbildung.
- Time commitment: about 10 h/week | https://www.educaro.de/india/nursing-program/ | "Enough time to commit to German language classes (around 10 hours per week)" | The pages disagree. The /india/ FAQ says 7.5 h of lessons plus 7.5 h self-study, about 15 h/week. The blog says at least 12.5 h/week.
- Weekly load (FAQ) | https://www.educaro.de/india/ | "In total, the weekly time commitment is approximately 15 hours." |
- B1 is required for the work visa | https://www.educaro.de/india/nursing-program/ | "The German embassy requires a minimum B1 level to issue a work visa." |
- First hospital interview 6-10 weeks after starting | https://www.educaro.de/india/nursing-program/ | "You will typically have your first interview with a German hospital within 6 to 10 weeks" | Interviews are online, and an Educaro consultant translates.
- Contract arrives about 6-12 weeks after starting | https://www.educaro.de/india/nursing-program/ | "You will usually receive your contract around 6 to 12 weeks after starting the program." | Permanent contract signed directly with the hospital.
- Contract to arrival in Germany: 12 months, up to 15 | https://www.educaro.de/india/nursing-program/ | "It typically takes 12 months (up to 15 months) from signing your employment contract" |
- Recognition in Germany: 6-8 months, up to 13 if a retake is needed | https://www.educaro.de/india/nursing-program/ | "The full recognition process usually takes 6 to 8 months." |
- Flight paid, accommodation arranged, registration supported | https://www.educaro.de/india/nursing-program/ | "We cover the cost of your flight, arrange your accommodation, and support your official registration in Germany." | The FAQ adds that the employer pays the flight and finds the first apartment, while the nurse pays rent and deposit.
- Pre-departure cultural workshops | https://www.educaro.de/india/nursing-program/ | "You will also participate in cultural workshops to help you get familiar with life in Germany" |
- Whole programme takes about 24 months (India plus Germany) | https://www.educaro.de/india/ | "both the part in your home country and in Germany, will take about 24 months" |
- Benefits listed: up to 30 days paid leave | https://www.educaro.de/india/event/ | "Up to 30 days paid vacation per year" |
- Age limit 42 (blog) | https://www.educaro.de/everything-you-need-to-know-about-educaros-nursing-program/ | "Be no older than 42" | Blog post. The same post says "at least 12.5 hours per week".

**2. `ausbildung-program` - Ausbildung (vocational training, mainly nursing Ausbildung)** | https://www.educaro.de/india/ausbildung/ | For: Ausbildung candidates (school leavers with a high-school diploma, no degree needed) | Training contracts in German healthcare. Includes German courses to B1/B2, application, visa, relocation and mentoring, with a paid apprenticeship of 2.5-3 years.
- Training pay about €1,000-1,500/month | https://www.educaro.de/india/ausbildung/ | "Scholarship of approximately €1,000 - 1500 per month." | Educaro calls it a "scholarship". Legally it is the training allowance (Ausbildungsvergütung).
- German B1/B2 needed for the visa and to start training | https://www.educaro.de/india/ausbildung/ | "Prepare for B1/B2 - required for visa training start" |
- Duration 2.5-3 years | https://www.educaro.de/india/ausbildung/ | "An Ausbildung typically lasts 2.5 to 3 years" | [inline-tags]: the number is in `<strong>`.
- Healthcare training contracts | https://www.educaro.de/india/ausbildung/ | "Vocational training contracts in the German healthcare sector." |
- Accommodation and relocation help | https://www.educaro.de/india/ausbildung/ | "Accommodation and relocation help" | Other bullets on the page: pre-departure orientation, cultural and workplace training, ongoing mentorship.
- Reference case: Indian trainees (Kerala, Karnataka) brought to Cologne, Diakonie Michaelshoven | https://www.educaro.de/auszubildende/ | "begleitete educaro 2024 motivierte, junge Auszubildende auf dem Weg von Indien nach Köln" | Dates conflict: the India page says they started in "October 2023", the German home page says they travelled in October 2024. The German page says all of them received job offers for 2027.

**3. `study-in-germany` - University Pathway Program (study guidance)** | https://www.educaro.de/india/study-in-germany/ | For: students (Bachelor/Master) and people who only want to learn German | Help choosing a programme, German courses in small groups, university application and documents, pre-enrolment, a student-residence room and visa preparation.
- Programme search plus support at every step | https://www.educaro.de/india/study-in-germany/ | "we help you find your ideal study program in Germany" |
- Enrolment in a language course at a German school | https://www.educaro.de/india/study-in-germany/ | "Enrollment in a language course at a German school" |
- Pre-enrolment at a German university | https://www.educaro.de/india/study-in-germany/ | "Pre-enrollment at a German university" |
- Student-residence accommodation | https://www.educaro.de/india/study-in-germany/ | "Pre-arranged accommodation in a German student residence" |
- Visa preparation | https://www.educaro.de/india/study-in-germany/ | "Visa application preparation for the German embassy" |
- Application and documents support | https://www.educaro.de/india/study-in-germany/ | "Support with university applications and documentation" |
- Small-group German lessons | https://www.educaro.de/india/study-in-germany/ | "Small group lessons" | Short heading.
- Prices and fees for students | UNCONFIRMED | - | No prices are published on any page.

**4. `skilled-worker-placement` - Work in Germany as a Qualified Professional** | https://www.educaro.de/work-in-germany/ | For: skilled workers with a vocational or academic qualification | Recognition of the foreign qualification, language training, visa documents and admin help, accommodation, matching with German employers, and integration training. Sectors: healthcare, hospitality, renewable energy, (civil) engineering, transport, electrical engineering, logistics.
- Eligibility: a completed qualification | https://www.educaro.de/work-in-germany/ | "A completed vocational or academic qualification" | Work experience is "ideal, but not always required".
- Employer matching | https://www.educaro.de/work-in-germany/ | "We facilitate matching qualified professionals with the right employers in Germany" |
- Available in India | https://www.educaro.de/work-in-germany/ | "Tunisia, India, Mexico, Colombia" | Follows "Our program for qualified professionals is currently available in".

**5. `german-courses-online` - Online German courses A1-B2 (Zoom batches)** | https://www.educaro.de/india/ | For: nurses and Ausbildung candidates (free inside the programmes) and students | Live online classes on Zoom, 2-4 sessions a week. A1 to B1 in India, B2 in Germany for nurses.
- Free online language and culture classes, A1-B2 | https://www.educaro.de/india/event/ | "Free online language and culture classes (A1-B2)" | The /india/ page has the same text with an en dash ("A1–B2").
- Online via Zoom | https://www.educaro.de/india/ | "You will learn the language together with us in online classes via Zoom." |
- 7.5 h of lessons per week | https://www.educaro.de/india/ | "You will have approximately 7.5 hours of German lesson per week." |
- 2, 3 or 4 sessions per week depending on batch | https://www.educaro.de/india/ | "The course takes place 2, 3 or 4 times a week depending on the class" |
- A1 to B1 takes about 9 months | https://www.educaro.de/india/ | "For the German courses A1, A2 and B1 you need about 9 months." |
- B1.2 for the visa, B2.2 for recognition | https://www.educaro.de/india/ | "you will complete level B1.2, which is necessary to receive a work visa" | A second quote on the same page: "For recognition in Germany, you will need level B2.2".
- Course catalogue for employers (A1-B2, with job-specific modules for care, technical trades and logistics) | https://www.educaro.de/sprachkurse/ | "educaro bietet praxisorientierte Deutschkurse für internationale Mitarbeitende für die Niveaustufen A1-B2" | Uses its own learning platform with blended learning and flipped classroom.
- Batch start dates and prices for paying (non-programme) learners in India | UNCONFIRMED | - | Not published. Contact india@educaro.de.

**6. `oesd-exam-centre` - ÖSD exam centre (official German certificate)** | https://www.educaro.de/sprachkurse/ | For: all candidates who need a recognised German certificate (visa, recognition, university) | educaro is an official ÖSD (Österreichisches Sprachdiplom Deutsch) exam centre.
- Official ÖSD exam centre | https://www.educaro.de/sprachkurse/ | "educaro ist offizielles Prüfungszentrum für das" | The text continues "Österreichische Sprachdiplom Deutsch (ÖSD)" in `<strong>`.
- What ÖSD is | https://www.educaro.de/sprachkurse/ | "Das ÖSD ist ein international anerkanntes Prüfungssystem für Deutsch als Fremd- und Zweitsprache." |
- ÖSD exams accepted by German embassies | https://www.educaro.de/general/ | "we prepare for and conduct internal ÖSD exams which are recognized by German Embassies globally" |
- ÖSD exam fees in India | UNCONFIRMED | - | The only published fee list (https://www.educaro.de/osd/) is for Tunisia in Tunisian dinars, e.g. B1 complete 600 DT. It does not apply to India.

**7. `educaro-akademie` - educaro Akademie (AZAV-certified training provider)** | https://www.educaro.de/educaro-akademie/ | For: employers and international staff already in Germany | Delivers the recognition courses, German courses for staff and intercultural workshops. The measures are AZAV-certified, so they can be funded through a Bildungsgutschein.
- AZAV-certified provider | https://www.educaro.de/educaro-akademie/ | "Als AZAV-zertifizierter Bildungsträger bieten wir Maßnahmen, die höchsten Qualitätsstandards entsprechen" |
- Up to 100% fundable | https://www.educaro.de/educaro-akademie/ | "Bis zu 100 % förderfähig" | Short.
- Purpose | https://www.educaro.de/educaro-akademie/ | "Die educaro Akademie ist die Bildungseinrichtung von educaro, spezialisiert auf die Qualifizierung internationaler Fachkräfte." |

**8. `anerkennung-support` - Recognition (Anerkennung) support and Kenntnisprüfung preparation** | https://www.educaro.de/anerkennung/ | For: nurses (main case), truck drivers and other trades, plus their employers | Educaro runs the whole recognition procedure: document check, application, contact with authorities, language courses, adaptation or exam-prep courses, until the Berufsurkunde (licence).
- Full organisation of the recognition procedure | https://www.educaro.de/anerkennung/ | "educaro übernimmt für Sie die komplette Organisation des Anerkennungsverfahrens." |
- Documents checked, authorities handled | https://www.educaro.de/anerkennung/ | "Wir prüfen die notwendigen Dokumente, kommunizieren mit den zuständigen Behörden" |
- B2 course and Kenntnisprüfung prep are free for nurse and employer (Bildungsgutschein) | https://www.educaro.de/anerkennung/ | "sind somit sowohl für das Pflegepersonal als auch für die Arbeitgebenden kostenlos" | Nurses work full-time as nursing assistants during this phase. The employment agency wage subsidy is usually 50-100%.
- What the training consists of | https://www.educaro.de/international-nursing-program/ | "The training measure consists of a B2 nursing language course at Educaro and a preparatory course for the knowledge test" | Then the telc B2 Pflege exam and the Kenntnisprüfung.
- Wage subsidy 50-100% | https://www.educaro.de/international-nursing-program/ | "The subsidy is usually between 50 and 100%." |
- Nursing qualification course: 9+ months, 899+ teaching units, 530+ hours of practice | https://www.educaro.de/anerkennung/ | "160 Stunden Fachsprachunterricht" | These numbers are counter widgets in separate elements and cannot be quoted reliably. The quote shown belongs to the truck-driver course, which runs 5-7 months with 160 h of specialist language.
- Reference: 150 engineers and IT specialists through recognition (ProRecognition project) | https://www.educaro.de/anerkennung/ | "begleiteten wir zudem 150 Ingenieure und Informatiker erfolgreich auf ihrem Weg zur Anerkennung" |

**9. `intercultural-workshop` - Interkulturelle Workshops** | https://www.educaro.de/interkulturelle-workshops/ | For: employers' existing German staff; candidates get cultural workshops before departure | Hands-on workshops with exercises and role plays on cultural differences, communication and conflict prevention in mixed teams.
- Purpose | https://www.educaro.de/interkulturelle-workshops/ | "Unsere Workshops helfen Ihrer Bestandsbelegschaft, kulturelle Unterschiede zu verstehen" |
- Format | https://www.educaro.de/interkulturelle-workshops/ | "Praktische Übungen und Rollenspiele sorgen dafür, dass das Gelernte sofort in die Praxis umgesetzt wird." | Price and duration not published (UNCONFIRMED). Booked via the "Jetzt Workshop anfragen" form.

**10. `integration-companion` - Integration companions (Integrationsbegleiter / Integrationscoaches / Community Manager)** | https://www.educaro.de/fachkrafte/ | For: nurses, trainees and skilled workers after arrival, and their employers | Airport pick-up, accommodation, SIM card, bank account, Anmeldung (address registration), health insurance and other official appointments. A personal contact person until recognition.
- Integration coaches with expertise in official procedures | https://www.educaro.de/fachkrafte/ | "verfügen unsere Integrationscoaches über Expertise bei den behördlichen Prozessen und der persönlichen Integrationsbegleitung" | The home page team list includes three people with the title "Integrationsbegleiterin".
- Help with official appointments | https://www.educaro.de/fachkrafte/ | "Wir begleiten die Teilnehmenden bei allen relevanten Behördengängen" |
- Arrival package | https://www.educaro.de/fachkrafte/ | "Vor Ort sorgen wir für einen reibungslosen Start, inklusive Abholung, Unterkunft, Mobilfunk und Bankkonto." |
- India nurses get a Community Manager until licensing | https://www.educaro.de/india/nursing-program/ | "you will stay in regular contact with your Community Manager" |

**11. `info-events` - Free webinars and Open Day in Bangalore** | https://www.educaro.de/india/event/ | For: nurses, Ausbildung candidates and students | Free online info events, plus walk-in info days at the Bangalore (Hebbal) office with consultants and document checks.
- Live Open Day in Bangalore (Hebbal) | https://www.educaro.de/india/event/ | "Live event: Open Day in Bangalore, Hebbal" |
- Nursing webinar | https://www.educaro.de/india/event/ | "Webinar: Scholarship to work as a nurse in Germany" |
- Free registration | https://www.educaro.de/india/event/ | "Register for a free info-event" | Event dates are not in the static HTML (UNCONFIRMED).

**12. `consultant-contact` - Consultation and contact** | https://www.educaro.de/india/ | For: everyone | Email or phone the India office to book a consultation, or register online.
- Office consultation in Bangalore | https://www.educaro.de/india/ | "Send us an email and we can schedule a consultation in our office." | Contacts: india@educaro.de, +91 96 1154 3642. Germany (employers): info@educaro.de, +49 211 545 6101, plus a form at https://www.educaro.de/contact-page/.

**13. `employer-apprentices` - Auszubildende (apprentice recruitment for German employers)** | https://www.educaro.de/auszubildende/ | For: employers | Selection, a German course up to B2 with cultural training, visa and authority coordination, arrival, and integration support during the Ausbildung.
- Course up to B2 plus culture training | https://www.educaro.de/auszubildende/ | "Sprachkurs bis B2 mit Kulturtraining" |
- Current intake | https://www.educaro.de/auszubildende/ | "Aktuell rekrutieren Arbeitgebende mit educaro für September 2026!" | Probably out of date: that date has already passed (today is 2026-10-08).

**14. `employer-skilled-workers` - Fachkräfte (skilled-worker recruitment for German employers)** | https://www.educaro.de/fachkrafte/ | For: employers | Recruitment and aptitude testing, B1+/B2 language programmes, interviews in the home country, recognition and visa (including the Bundesagentur für Arbeit and IHK FOSA), arrival and onboarding.
- Selection against criteria agreed with the employer | https://www.educaro.de/fachkrafte/ | "Wir übernehmen die Auswahl qualifizierter KandidatInnen anhand gemeinsam definierter Kriterien." |
- Language level | https://www.educaro.de/fachkrafte/ | "Unsere intensiven Sprachprogramme (B1+/B2) bereiten gezielt auf den beruflichen Alltag in Deutschland vor." |
- Recognition and visa coordination | https://www.educaro.de/fachkrafte/ | "inklusive Übersetzungen, Beglaubigungen und Abstimmungen mit Behörden wie der Bundesagentur für Arbeit oder IHK FOSA" |

---

## B. Official German requirements

(B_SECTION_PLACEHOLDER)

---

## C. Master's programmes (B.Tech CS, CGPA 8.2/10)

(C_SECTION_PLACEHOLDER)

---

## D. APIs

### D.1 Bundesagentur für Arbeit Jobsuche API (unofficial: reverse-engineered and documented by the bundesAPI community)
- Status: the BA publishes no official API. The community docs are the reference | https://github.com/bundesAPI/jobsuche-api | "bietet die Bundesagentur für Arbeit dafür bis heute keine offizielle API an" | Interactive docs: https://jobsuche.api.bund.dev/ (JavaScript UI).
- Base URL: https://rest.arbeitsagentur.de/jobboerse/jobsuche-service | https://github.com/bundesAPI/jobsuche-api | "Die Jobsuche ermöglicht verfügbare Jobangebote mit verschiedenen get Parametern zu filtern" | The full search URL appears on the page as the link text "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs".
- Search endpoint: GET /pc/v6/jobs (current) | https://github.com/bundesAPI/jobsuche-api | "Stellen suchen via /pc/v6/jobs oder /pc/v4/app/jobs" | [inline-tags]. The same sentence is plain text in https://raw.githubusercontent.com/bundesAPI/jobsuche-api/main/openapi.yaml. Live test on 2026-10-08: /pc/v6/jobs returned HTTP 200, while /pc/v4/jobs and /pc/v4/app/jobs returned HTTP 403. Use v6.
- Details endpoint: GET /pc/v4/jobdetails/{base64(refnr)} | https://github.com/bundesAPI/jobsuche-api | "Details abrufen via /pc/v4/jobdetails/{base64(refnr)} (empfohlen)" | [inline-tags]. Live test: v4 jobdetails returned 200, v3 returned 403. In v6, refnr is the field `referenznummer`.
- Required header: `X-API-Key: jobboerse-jobsuche` | https://github.com/bundesAPI/jobsuche-api | "Bei folgenden GET-requests ist die clientId als Header-Parameter 'X-API-Key' zu übergeben." | Live test: the request fails with 403 without the header.
- Header value | https://github.com/bundesAPI/jobsuche-api | "Falls client_id nicht funktioniert kann man stattdessen "X-API-KEY: jobboerse-jobsuche" verwenden" | The quote contains ASCII double quotes.
- Param `was`: free-text job title | https://github.com/bundesAPI/jobsuche-api | "Freitextsuche Jobtitel (z.B. Referatsleiter)." |
- Param `wo`: free-text location | https://github.com/bundesAPI/jobsuche-api | "Freitextsuche Beschäftigungsort (z.B. Berlin)." | Use the real name, URL-encoded (`K%C3%B6ln`). "Koeln" returned `suchmodus: UNGUELTIG` with 0 hits.
- Param `umkreis`: radius in km around `wo` | https://github.com/bundesAPI/jobsuche-api | "Umkreis: in Kilometern von" | The sentence continues "Wo-Parameter (z.B. 25 oder 200)", with "Wo" in `<em>`.
- Param `angebotsart`: 1 = Arbeit, 2 = Selbständigkeit, 4 = Ausbildung/Duales Studium, 34 = Praktikum/Trainee | https://github.com/bundesAPI/jobsuche-api | "Angebotsart: 1=ARBEIT; 2=SELBSTAENDIGKEIT; 4=AUSBILDUNG/Duales Studium; 34=Praktikum/Trainee." | Other params: page (from 1), size, arbeitszeit (vz, tz, snw, ho, mj), befristung (1 or 2), veroeffentlichtseit (0-100 days), zeitarbeit, pav, berufsfeld, arbeitgeber.
- v6 response shape (live test, not documented in prose) | - | - | `{ergebnisliste:[{stellenangebotsTitel, stellenangebotsart, firma, referenznummer, stellenlokationen:[{adresse:{plz,ort,region}, breite, laenge}], hauptberuf, eintrittszeitraum, datumErsteVeroeffentlichung, externeURL?, gehaltsspanneVon?, gehaltsspanneBis?, verguetungsangabe?}], maxErgebnisse, page, size, woOutput:{suchmodus, bereinigterOrt}, facetten:{...}}`. Example: was=Pflegefachkraft, wo=Köln, umkreis=25, angebotsart=1 gave 625 hits; angebotsart=4 in München gave 58 nursing Ausbildung offers.

### D.2 OpenStreetMap Overpass API
- Public endpoint: https://overpass-api.de/api/interpreter (main instance, run by FOSSGIS; POST or GET with `data=<OverpassQL>`) | https://wiki.openstreetmap.org/wiki/Overpass_API | "Open https://overpass-api.de/api/interpreter in a new tab" | [inline-tags]. Fair-use limit: fewer than 10,000 queries/day and less than 1 GB/day.
- Fair use | https://wiki.openstreetmap.org/wiki/Overpass_API | "You can assume that you don't disturb other users when you do less than 10,000 queries per day" | The apostrophe is ASCII.
- Send an identifying User-Agent | https://wiki.openstreetmap.org/wiki/Overpass_API | "headers to requests that uniquely identify your app" | The preceding words are "adds User-Agent or Referer". Live test on 2026-10-08: overpass-api.de returned HTTP 406 for the default curl, python-requests and node User-Agents, and 200 with a custom UA such as "EducaroAgent/1.0 (contact email)". Always set one.
- Hindu temples: `amenity=place_of_worship` + `religion=hindu` | https://wiki.openstreetmap.org/wiki/Tag:religion%3Dhindu | "Classify a religious feature (e.g. temple) as Hindu" | The page says the tag needs a main tag such as amenity=place_of_worship. Optional: denomination=hare_krishna for ISKCON.
- Gurdwaras: `amenity=place_of_worship` + `religion=sikh` | https://wiki.openstreetmap.org/wiki/Tag:religion%3Dsikh | "Classify a religious feature (e.g. temple) as Sikhism." | There is no separate "gurdwara" tag. Names usually contain "Gurdwara" or "Sikh-Tempel".
- Indian restaurants: `amenity=restaurant` + `cuisine=indian` | https://wiki.openstreetmap.org/wiki/Key:cuisine | "Food originating from India" | 4-word table cell (value "indian"). Values are often lists such as "afghan;indian", so match with the regex `["cuisine"~"indian"]`. A separate value `south_indian` exists. Also add amenity=fast_food.
- Indian/Asian grocery: `shop=supermarket|convenience|deli|greengrocer|food` + `cuisine=indian|asian` (or `origin=indian|asian`) | https://wiki.openstreetmap.org/wiki/Key:cuisine | "The key can also be used to describe shops that sell processed food and ingredients from a particular cuisine." | The tagging convention is weak, and many Asian shops carry only a name. Add a name regex fallback such as `["name"~"Asia|India|Desi|Bazaar|Spice",i]`.
- `origin=*` for shop goods | https://wiki.openstreetmap.org/wiki/Key:origin | "Tag to describe the origin, e.g. the country of origin, for the goods of a shop." | Values include asian and indian. For food shops, the page prefers cuisine=*.
- Bürgeramt (wiki recommendation): `office=government` + `government=public_service` | https://wiki.openstreetmap.org/wiki/Key:government | "An office with public services for government affairs, e.g. ID cards, passports, registrations, etc." | The German page https://wiki.openstreetmap.org/wiki/DE:Tag:amenity%3Dtownhall lists "Bürgeramt: office=government government=public_service".
- Bürgeramt (real-world data) | - | - | Live test (Köln bbox, 2026-10-08): most Bürgerämter are tagged `amenity=townhall` with name "Bürgeramt ...", "Bürgerbüro" or "Kundenzentrum". Only 3 objects used government=public_service. Query both forms: amenity=townhall OR (office=government + government=public_service), filtered with `["name"~"Bürgeramt|Bürgerbüro|Bürgerservice|Kundenzentrum",i]`.
- Live test counts, Köln bbox 50.83,6.77,51.08,7.16 | - | - | Hindu places of worship: 3. Sikh (gurdwaras): 4. Restaurants with cuisine~indian: about 51. Shops with cuisine or origin asian: 4. Townhall objects: 25, about 10 of them Bürgerämter.
- Example query (bbox version, verified to return 200 on 2026-10-08):
  `[out:json][timeout:25][bbox:50.83,6.77,51.08,7.16];(nwr["amenity"="place_of_worship"]["religion"~"hindu|sikh"];nwr["amenity"="restaurant"]["cuisine"~"indian"];nwr["shop"]["cuisine"~"indian|asian"];nwr["shop"]["origin"~"indian|asian"];nwr["office"="government"]["government"="public_service"];nwr["amenity"="townhall"];);out tags center;`
  The same query using an area lookup (`area["name"="Köln"]["admin_level"="6"]->.a; ... (area.a)`) returned HTTP 504 once. Prefer bbox or around: `(around:5000,LAT,LON)`.
