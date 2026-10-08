import PDFDocument from 'pdfkit';

/**
 * The demo papers, generated as real PDFs so the pipeline does real work on real files:
 * text extraction, rule-based sorting, claim reading, and a truth map that finds the planted
 * conflicts (Ananya's dates and her name, Rohan's unproved IELTS).
 *
 * The wording follows the Indian originals closely, because that is what the extractors read.
 */

export interface DemoDoc {
  name: string;
  build: (d: PDFKit.PDFDocument) => void;
}

const A = (d: PDFKit.PDFDocument, text: string, opts: PDFKit.Mixins.TextOptions = {}) => d.text(text, opts);

function head(d: PDFKit.PDFDocument, org: string, sub: string) {
  d.font('Helvetica-Bold').fontSize(15).text(org, { align: 'center' });
  d.font('Helvetica').fontSize(10).text(sub, { align: 'center' });
  d.moveDown(1.2);
  d.fontSize(11);
}

function sign(d: PDFKit.PDFDocument, who: string, role: string, place: string) {
  d.moveDown(2);
  d.font('Helvetica').fontSize(11);
  A(d, `Place: ${place}`);
  A(d, `Date: 12 March 2026`);
  d.moveDown(1.5);
  A(d, '____________________');
  A(d, who);
  A(d, role);
}

// ---------------------------------------------------------------- Ananya Nair (nursing)

export const ANANYA_DOCS: DemoDoc[] = [
  {
    name: 'Ananya-Nair-CV.pdf',
    build: (d) => {
      d.font('Helvetica-Bold').fontSize(18).text('Curriculum Vitae');
      d.font('Helvetica-Bold').fontSize(13).text('Ananya Nair');
      d.font('Helvetica').fontSize(10).text('Staff Nurse · Kochi, Kerala, India · ananya.nair.demo@educaro.local · +91 98470 11234');
      d.moveDown();

      d.font('Helvetica-Bold').fontSize(12).text('Professional Summary');
      d.font('Helvetica').fontSize(10.5).text(
        'Registered nurse with four years of hospital experience in general medicine and post-operative care. ' +
          'Diploma in General Nursing and Midwifery (GNM). Looking for a nursing position in Germany; learning German.',
      );
      d.moveDown();

      d.font('Helvetica-Bold').fontSize(12).text('Education');
      d.font('Helvetica').fontSize(10.5);
      A(d, 'Diploma in General Nursing and Midwifery (GNM), Lourdes College of Nursing, Kochi, 2018 - 2021');
      A(d, 'Higher Secondary (Class XII), Science, Kerala Board, 2018');
      d.moveDown();

      d.font('Helvetica-Bold').fontSize(12).text('Work Experience');
      d.font('Helvetica').fontSize(10.5);
      // Planted conflict: the CV says the Amrita job started in March 2021; the letter says June 2021.
      A(d, 'Staff Nurse, Amrita Institute of Medical Sciences, Kochi — March 2021 to August 2023');
      A(d, 'Ward: General Medicine. Patient care, medication administration, wound care, post-operative monitoring.');
      d.moveDown(0.4);
      A(d, 'Staff Nurse, Lakeshore Hospital, Kochi — September 2023 to Present');
      A(d, 'Ward: Surgical ICU. Ventilator care, documentation, family counselling, trainee supervision.');
      d.moveDown();

      d.font('Helvetica-Bold').fontSize(12).text('Registration');
      d.font('Helvetica').fontSize(10.5).text('Kerala Nurses and Midwives Council, Registration No. KNMC/2021/48217');
      d.moveDown();

      d.font('Helvetica-Bold').fontSize(12).text('Languages');
      d.font('Helvetica').fontSize(10.5);
      // Planted claim: A2 German with no certificate anywhere in the pack.
      A(d, 'English: fluent. Malayalam: native. Hindi: conversational. German: A2 (self-study, no certificate yet).');
      d.moveDown();

      d.font('Helvetica-Bold').fontSize(12).text('Skills');
      d.font('Helvetica').fontSize(10.5).text('IV cannulation, ECG, ventilator care, wound dressing, BLS certified, electronic records.');
    },
  },
  {
    name: 'GNM-Diploma-Certificate.pdf',
    build: (d) => {
      head(d, 'KERALA NURSES AND MIDWIVES COUNCIL', 'Thiruvananthapuram, Kerala, India');
      d.font('Helvetica-Bold').fontSize(13).text('DIPLOMA CERTIFICATE', { align: 'center' });
      d.moveDown(1.5);
      d.font('Helvetica').fontSize(11.5);
      // Planted conflict: the certificate carries her full legal name, "Ananya Rajan Nair".
      A(d, 'This is to certify that ANANYA RAJAN NAIR, daughter of Rajan Nair, has successfully completed the course of study in');
      d.moveDown(0.5);
      d.font('Helvetica-Bold').text('GENERAL NURSING AND MIDWIFERY (GNM)');
      d.font('Helvetica');
      d.moveDown(0.5);
      A(d, 'at Lourdes College of Nursing, Kochi, a three-year programme, and has passed the final examination held in March 2021.');
      d.moveDown(0.8);
      A(d, 'Register Number: 2021/GNM/4418');
      A(d, 'Date of Award: 28 May 2021');
      A(d, 'Grade: First Class (72.4%)');
      sign(d, 'Dr. S. Radhakrishnan', 'Registrar, Kerala Nurses and Midwives Council', 'Thiruvananthapuram');
    },
  },
  {
    name: 'Experience-Letter-Amrita.pdf',
    build: (d) => {
      head(d, 'AMRITA INSTITUTE OF MEDICAL SCIENCES', 'AIMS Ponekkara P.O., Kochi 682041, Kerala, India');
      d.font('Helvetica-Bold').fontSize(12).text('EXPERIENCE CERTIFICATE', { align: 'center' });
      d.moveDown(1.2);
      d.font('Helvetica').fontSize(11.5);
      A(d, 'TO WHOM IT MAY CONCERN');
      d.moveDown(0.8);
      // Planted conflict: June 2021, not March 2021 as the CV says.
      A(d, 'This is to certify that Ms. Ananya Rajan Nair was employed with Amrita Institute of Medical Sciences, Kochi, as a Staff Nurse from 14 June 2021 to 31 August 2023.');
      d.moveDown(0.6);
      A(d, 'She worked in the Department of General Medicine, where her duties included patient care, administration of medication, wound care and post-operative monitoring. Her conduct and performance during the period of service were found to be good.');
      d.moveDown(0.6);
      A(d, 'Employee ID: AIMS-N-7741. We wish her success in her future endeavours.');
      sign(d, 'Sr. Mary Thomas', 'Nursing Superintendent, Amrita Institute of Medical Sciences', 'Kochi');
    },
  },
  {
    name: 'Nursing-Council-Registration.pdf',
    build: (d) => {
      head(d, 'KERALA NURSES AND MIDWIVES COUNCIL', 'Certificate of Registration');
      d.font('Helvetica').fontSize(11.5);
      A(d, 'Registration No: KNMC/2021/48217');
      d.moveDown(0.6);
      A(d, 'This is to certify that ANANYA RAJAN NAIR is a Registered Nurse and Registered Midwife, entered in the register maintained by this Council under the Kerala Nurses and Midwives Act.');
      d.moveDown(0.6);
      A(d, 'Qualification: General Nursing and Midwifery (GNM), 2021');
      A(d, 'Date of first registration: 12 July 2021');
      A(d, 'Valid up to: 11 July 2026');
      sign(d, 'Dr. S. Radhakrishnan', 'Registrar', 'Thiruvananthapuram');
    },
  },
  {
    name: 'Class12-Marksheet.pdf',
    build: (d) => {
      head(d, 'BOARD OF HIGHER SECONDARY EXAMINATION, KERALA', 'Higher Secondary Examination — Class XII');
      d.font('Helvetica').fontSize(11);
      A(d, 'Name of Candidate: ANANYA RAJAN NAIR');
      A(d, 'Register Number: 1842207   ·   Year of Examination: March 2018   ·   Stream: Science');
      d.moveDown(0.8);
      const rows: [string, string][] = [
        ['English', '78'],
        ['Physics', '81'],
        ['Chemistry', '84'],
        ['Biology', '89'],
        ['Mathematics', '72'],
      ];
      for (const [s, m] of rows) A(d, `${s.padEnd(28, '.')} ${m} / 100`);
      d.moveDown(0.6);
      A(d, 'Total: 404 / 500      Percentage: 80.8%      Result: PASSED (First Class)');
      sign(d, 'Controller of Examinations', 'Board of Higher Secondary Examination', 'Thiruvananthapuram');
    },
  },
];

/** What Ananya says to camera. Read aloud for a 60–90 s clip, or used as the transcript directly. */
export const ANANYA_VIDEO_SCRIPT = `Hello, my name is Ananya Nair. I am twenty-four years old and I am from Kochi in Kerala.

I finished my GNM nursing diploma in 2021 and I have been working as a staff nurse for about four years. First at Amrita hospital in Kochi from March 2021, in general medicine, and since September 2023 at Lakeshore Hospital in the surgical ICU.

I want to move to Germany to work as a nurse. My elder sister lives in Cologne with her husband, so I would like to go to Cologne if that is possible.

I have been learning German on my own in the evenings. I think I am around A2 level now, but I have not taken any exam yet.

I have my GNM certificate, my nursing council registration and my experience letter. I do not have a blocked account yet and I have not started the recognition of my qualification. I would like to know what I should do first, and how long the whole thing will take.`;

// ---------------------------------------------------------------- Rohan Mehta (Master's)

export const ROHAN_DOCS: DemoDoc[] = [
  {
    name: 'Rohan-Mehta-Resume.pdf',
    build: (d) => {
      d.font('Helvetica-Bold').fontSize(18).text('Resume');
      d.font('Helvetica-Bold').fontSize(13).text('Rohan Mehta');
      d.font('Helvetica').fontSize(10).text('Software Engineer · Pune, Maharashtra, India · rohan.mehta.demo@educaro.local · +91 90280 55417');
      d.moveDown();

      d.font('Helvetica-Bold').fontSize(12).text('Objective');
      d.font('Helvetica').fontSize(10.5).text(
        'Computer science graduate with two years of backend and data engineering experience, applying for a Master of Science in Data Science or Informatics in Germany for the winter intake.',
      );
      d.moveDown();

      d.font('Helvetica-Bold').fontSize(12).text('Education');
      d.font('Helvetica').fontSize(10.5);
      A(d, 'B.Tech in Computer Science and Engineering, Savitribai Phule Pune University, 2019 - 2023. CGPA 8.2 / 10.');
      A(d, 'Class XII (HSC), Maharashtra State Board, 2019. 88.4%.');
      d.moveDown();

      d.font('Helvetica-Bold').fontSize(12).text('Professional Experience');
      d.font('Helvetica').fontSize(10.5);
      A(d, 'Software Engineer, Persistent Systems, Pune — July 2023 to Present');
      A(d, 'Python and Java backend services, Kafka pipelines, PostgreSQL. Built an ETL pipeline moving 40 million records a day.');
      d.moveDown(0.4);
      A(d, 'Intern, Persistent Systems, Pune — January 2023 to June 2023');
      A(d, 'Machine learning prototypes for log anomaly detection, scikit-learn and PyTorch.');
      d.moveDown();

      d.font('Helvetica-Bold').fontSize(12).text('Tests and Languages');
      d.font('Helvetica').fontSize(10.5);
      // Planted claim: IELTS 7.0 with no Test Report Form in the pack. APS not started.
      A(d, 'IELTS: overall band 7.0 (claimed, report not attached). German: A1, self-study. English: fluent. Hindi, Marathi: native.');
      A(d, 'APS certificate: not yet applied.');
      d.moveDown();

      d.font('Helvetica-Bold').fontSize(12).text('Projects and Skills');
      d.font('Helvetica').fontSize(10.5).text('Python, Java, SQL, Kafka, Spark, Docker, Kubernetes, PyTorch. Open-source contributor to a time-series library.');
    },
  },
  {
    name: 'BTech-Degree-Certificate.pdf',
    build: (d) => {
      head(d, 'SAVITRIBAI PHULE PUNE UNIVERSITY', 'Ganeshkhind, Pune 411007, Maharashtra, India');
      d.font('Helvetica-Bold').fontSize(13).text('DEGREE CERTIFICATE', { align: 'center' });
      d.moveDown(1.5);
      d.font('Helvetica').fontSize(11.5);
      A(d, 'This is to certify that ROHAN MEHTA, son of Anil Mehta, having been examined and found qualified, has been');
      d.moveDown(0.4);
      d.font('Helvetica-Bold').text('awarded the degree of BACHELOR OF TECHNOLOGY (B.Tech)');
      d.font('Helvetica');
      d.moveDown(0.4);
      A(d, 'in Computer Science and Engineering, in the Second Class with Distinction, at the convocation held in August 2023.');
      d.moveDown(0.8);
      A(d, 'Seat Number: B190044127');
      A(d, 'CGPA: 8.2 on a scale of 10. Maximum CGPA awarded in this cohort: 10. Minimum passing CGPA: 4.');
      A(d, 'Date of Award: 19 August 2023');
      sign(d, 'Dr. A. P. Kulkarni', 'Registrar, Savitribai Phule Pune University', 'Pune');
    },
  },
  {
    name: 'BTech-Consolidated-Transcript.pdf',
    build: (d) => {
      head(d, 'SAVITRIBAI PHULE PUNE UNIVERSITY', 'Consolidated Statement of Marks — Transcript');
      d.font('Helvetica').fontSize(11);
      A(d, 'Name: ROHAN MEHTA   ·   Seat No: B190044127   ·   Programme: B.Tech Computer Science and Engineering');
      d.moveDown(0.8);
      const sems: [string, string][] = [
        ['Semester I', '7.6'],
        ['Semester II', '7.9'],
        ['Semester III', '8.0'],
        ['Semester IV', '8.1'],
        ['Semester V', '8.3'],
        ['Semester VI', '8.4'],
        ['Semester VII', '8.5'],
        ['Semester VIII', '8.8'],
      ];
      for (const [s, g] of sems) A(d, `${s.padEnd(26, '.')} SGPA ${g}`);
      d.moveDown(0.6);
      d.font('Helvetica-Bold').text('Cumulative Grade Point Average (CGPA): 8.2 / 10');
      d.font('Helvetica');
      A(d, 'Grading scale: maximum 10, minimum pass 4. Class awarded: Second Class with Distinction.');
      sign(d, 'Controller of Examinations', 'Savitribai Phule Pune University', 'Pune');
    },
  },
  {
    name: 'Experience-Letter-Persistent.pdf',
    build: (d) => {
      head(d, 'PERSISTENT SYSTEMS LIMITED', 'Bhageerath, 402 Senapati Bapat Road, Pune 411016, India');
      d.font('Helvetica-Bold').fontSize(12).text('EMPLOYMENT CERTIFICATE', { align: 'center' });
      d.moveDown(1.2);
      d.font('Helvetica').fontSize(11.5);
      A(d, 'TO WHOM IT MAY CONCERN');
      d.moveDown(0.8);
      A(d, 'This is to certify that Mr. Rohan Mehta (Employee ID PSL-44102) has been working with Persistent Systems Limited, Pune, as a Software Engineer from 03 July 2023 to date.');
      d.moveDown(0.6);
      A(d, 'He works in the Data Platform group on backend services in Python and Java, streaming pipelines with Apache Kafka and PostgreSQL. His performance has been rated "exceeds expectations" in the last review cycle.');
      sign(d, 'Priya Deshpande', 'Manager, Human Resources, Persistent Systems Limited', 'Pune');
    },
  },
];

export const ROHAN_VIDEO_SCRIPT = `Hi, I am Rohan Mehta from Pune. I finished my B.Tech in computer science in 2023 with a CGPA of 8.2, and I have been working at Persistent Systems as a software engineer for about two years.

I want to do a Master's in data science or informatics in Germany, starting next winter semester. I am looking at RWTH Aachen, TUM and TU Darmstadt.

I took IELTS and got an overall band of 7.0. I have not done the APS yet and I am not sure how long it takes. My German is very basic, maybe A1.

My main questions are whether my CGPA is good enough for these universities, what the German grade equivalent is, and whether I can apply for the winter intake if I start the APS now.`;
