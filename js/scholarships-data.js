/* ============================================================
   SCHOLARSHIP FINDER — the list (productivity/scholarships.html)
   One record per scholarship. Facts come from the official page
   in `url`, read on the date in `checked`. Status on the page is
   worked out from `opens` / `closes`, so it never goes stale; a
   record with no exact date uses `state`:
     'closed' | 'upcoming' | 'varies'
   regions: europe, northamerica, southamerica, asia, middleeast,
            africa, oceania, or 'any' (Indian funding for study anywhere)
   countries: destination countries, for the country filter
   levels:  ug, masters, phd
   funding: full | part | check
   maxAge / ageBy: oldest age allowed, overall or per level.
   minWork: years of work experience required.
   ============================================================ */
window.SCHOLARSHIP_REGIONS = [
  { id: 'europe', name: 'Europe' },
  { id: 'northamerica', name: 'North America' },
  { id: 'southamerica', name: 'South America' },
  { id: 'asia', name: 'Asia' },
  { id: 'middleeast', name: 'Middle East' },
  { id: 'africa', name: 'Africa' },
  { id: 'oceania', name: 'Oceania' }
];

window.SCHOLARSHIPS = [
  /* ---------- Europe & UK ---------- */
  {
    id: 'chevening', name: 'Chevening Scholarships', by: 'UK Government (FCDO)', place: 'United Kingdom',
    regions: ['europe'], countries: ['United Kingdom'], levels: ['masters'], funding: 'full', minWork: 2,
    amount: 'Full funding for a master’s at a UK university.',
    who: 'Two years of work after your degree (2,800 hours). You must agree to return to India for two years afterwards.',
    how: 'Apply to Chevening and to three eligible UK courses. You need one unconditional offer by the deadline.',
    state: 'closed', when: 'The 2027–28 round has closed. It opened in August and closed in October 2026.',
    url: 'https://www.chevening.org/scholarship/india/', checked: '2026-11-03'
  },
  {
    id: 'commonwealth-masters', name: 'Commonwealth Master’s Scholarships', by: 'Commonwealth Scholarship Commission', place: 'United Kingdom',
    regions: ['europe'], countries: ['United Kingdom'], levels: ['masters'], funding: 'full',
    amount: 'Tuition, return airfare, and £1,712 a month (£2,000 in the London area).',
    who: 'A first degree at 2:1 level or equivalent, permanent residence in India, and unable to afford UK study without it. Not if you already hold a UK master’s.',
    how: 'Apply on CSC Central and through a nominator as well. The CSC takes no direct applications.',
    closes: '2026-10-20', when: 'The 2027–28 round closed on 20 October 2026.',
    url: 'https://cscuk.fcdo.gov.uk/scholarships/commonwealth-masters-scholarships/', checked: '2026-11-03'
  },
  {
    id: 'rhodes', name: 'Rhodes Scholarship for India', by: 'Rhodes Trust', place: 'University of Oxford',
    regions: ['europe'], countries: ['United Kingdom'], levels: ['masters', 'phd'], funding: 'full', maxAge: 26,
    amount: 'Covers the cost of at least two years at Oxford. Five places for India.',
    who: 'Indian citizens with schooling in India, aged 18–23 (under 27 if you finished your first degree late). OCI and PIO holders do not qualify.',
    how: 'Apply directly to the Rhodes Trust. Your grades must meet the entry rules of your Oxford course.',
    opens: '2026-06-01', closes: '2026-07-23', when: 'The latest round ran from 1 June to 23 July 2026.',
    url: 'https://www.rhodeshouse.ox.ac.uk/scholarships/applications/india/', checked: '2026-11-03'
  },
  {
    id: 'gates', name: 'Gates Cambridge Scholarship', by: 'Gates Cambridge Trust', place: 'University of Cambridge',
    regions: ['europe'], countries: ['United Kingdom'], levels: ['masters', 'phd'], funding: 'full',
    amount: 'University fee, £23,152 a year for living costs, flights, visa and health surcharge.',
    who: 'Citizens of any country outside the UK, for a PhD, MLitt or one-year postgraduate course. MBAs are not covered.',
    how: 'Apply through the University of Cambridge graduate application.',
    opens: '2026-09-11', closes: '2026-12-08', when: 'Your deadline is either 8 December 2026 or 6 January 2027, depending on your course. Check the course’s funding deadline.',
    url: 'https://www.gatescambridge.org/apply/timeline/', checked: '2026-11-03'
  },
  {
    id: 'felix', name: 'Felix Scholarships', by: 'The Felix Trust', place: 'Oxford, Reading and SOAS (UK)',
    regions: ['europe'], countries: ['United Kingdom'], levels: ['masters', 'phd'], funding: 'check',
    amount: 'The official home page does not state the amount.',
    who: 'Academically gifted, underprivileged Indian nationals with at least a first-class bachelor’s degree.',
    how: 'See the How to Apply page. Deadlines are set there.',
    state: 'varies', when: 'The official home page gives no date.',
    url: 'https://www.felixscholarship.org/', checked: '2026-11-03'
  },
  {
    id: 'inlaks', name: 'Inlaks Scholarship', by: 'Inlaks Shivdasani Foundation', place: 'UK, Europe or USA',
    regions: ['europe', 'northamerica'], countries: ['United Kingdom', 'United States'], levels: ['masters', 'phd'], funding: 'full', maxAge: 30,
    amount: 'Up to US$120,000 for tuition, living costs, one-way travel, visa and health.',
    who: 'Indian passport, living in India, born on or after 1 January 1996 in the last round. Engineering, computer science, business and medicine are mostly excluded.',
    how: 'Get a place at a top university first, then apply online to the foundation.',
    state: 'closed', when: 'Applications for 2026 have closed. The next date is not published yet.',
    url: 'https://inlaksfoundation.org/opportunities/scholarship/', checked: '2026-11-03'
  },
  {
    id: 'erasmus-mundus', name: 'Erasmus Mundus Joint Masters', by: 'European Union', place: 'Two or more European countries',
    regions: ['europe'], countries: ['Multiple countries'], levels: ['masters'], funding: 'full',
    amount: 'Top applicants get participation costs, travel, visa and a living allowance.',
    who: 'Open to students from anywhere. You need a bachelor’s degree before the course starts.',
    how: 'Find a course in the catalogue, then apply directly to that course’s consortium.',
    state: 'varies', when: 'Most courses open in October and close in January. Every course sets its own date.',
    url: 'https://erasmus-plus.ec.europa.eu/opportunities/individuals/students/erasmus-mundus-joint-masters', checked: '2026-11-03'
  },
  {
    id: 'eiffel', name: 'France Excellence Eiffel', by: 'French Foreign Ministry · Campus France', place: 'France',
    regions: ['europe'], countries: ['France'], levels: ['masters', 'phd'], funding: 'part',
    amount: '€1,200 a month for a master’s, €2,100 for a PhD, plus services such as travel and insurance. Tuition is not covered.',
    who: 'Excellent international students in seven broad fields, from engineering to law and economics.',
    how: 'You cannot apply alone. A French university must put your name forward, so contact its international office early.',
    closes: '2027-01-06', when: 'Campus France shows both 6 and 8 January 2027, and universities set earlier internal dates.',
    url: 'https://www.campusfrance.org/en/actu/call-for-france-excellence-eiffel-applications-2027', checked: '2026-11-03'
  },
  {
    id: 'swiss', name: 'Swiss Government Excellence Scholarships', by: 'Swiss Government (ESKAS)', place: 'Switzerland',
    regions: ['europe'], countries: ['Switzerland'], levels: ['phd'], funding: 'part', maxAge: 35,
    amount: 'CHF 2,450 a month, for a research stay of 6–12 months or a PhD of up to 36 months.',
    who: 'Researchers with a master’s degree, born after 31 December 1991, with a supervisor in Switzerland.',
    how: 'Apply online using the link on the official page.',
    state: 'varies', when: 'Opened on 20 August 2026 for 2027–28. Deadlines differ by country, so confirm India’s date on the official page.',
    url: 'https://www.sbfi.admin.ch/en/swiss-government-excellence-scholarships', checked: '2026-11-03'
  },
  {
    id: 'daad-epos', name: 'DAAD EPOS courses', by: 'DAAD, Germany', place: 'Germany',
    regions: ['europe'], countries: ['Germany'], levels: ['masters'], funding: 'check', minWork: 2,
    amount: 'A DAAD scholarship for selected development-related master’s courses.',
    who: 'Professionals from developing countries. DAAD India lists two years of work experience as a requirement.',
    how: 'Choose a listed course, then follow that course’s entry in the DAAD scholarship database.',
    state: 'varies', when: 'Each course has its own date. Search “EPOS” in the DAAD database.',
    url: 'https://www.daad.in/en/study-research-in-germany/studying-in-germany/daad-scholarships/', checked: '2026-11-03'
  },
  {
    id: 'daad-phd', name: 'DAAD Research Grants', by: 'DAAD, Germany', place: 'Germany',
    regions: ['europe'], countries: ['Germany'], levels: ['phd'], funding: 'check',
    amount: 'Options include a full PhD in Germany, a sandwich stay of at least a year, or a short stay.',
    who: 'Doctoral students. Rules differ by option.',
    how: 'Open the matching entry in the DAAD scholarship database.',
    state: 'varies', when: 'Dates differ by option and appear in the DAAD database.',
    url: 'https://www.daad.in/en/study-research-in-germany/studying-in-germany/daad-scholarships/', checked: '2026-11-03'
  },
  {
    id: 'daad-kospie', name: 'DAAD KOSPIE for IIT students', by: 'DAAD, Germany', place: 'Germany',
    regions: ['europe'], countries: ['Germany'], levels: ['masters'], funding: 'part',
    amount: '€992 a month for seven months, plus a research allowance, insurance and travel subsidy.',
    who: 'IIT master’s or dual-degree students in engineering, maths or science, with CGPA 8.5 or above and a German supervisor.',
    how: 'Apply through the DAAD portal.',
    opens: '2026-02-20', closes: '2026-04-01', when: 'The latest round ran from 20 February to 1 April 2026.',
    url: 'https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/?detail=57504697', checked: '2026-11-03'
  },
  {
    id: 'maeci', name: 'Italian Government (MAECI) Scholarships', by: 'Italian Foreign Ministry', place: 'Italy',
    regions: ['europe'], countries: ['Italy'], levels: ['masters', 'phd'], funding: 'part', ageBy: { masters: 28, phd: 30 },
    amount: '€10,800 for nine months, with health insurance. Some universities also waive tuition.',
    who: 'Age limit 28 for a master’s and 30 for a PhD. English-taught courses need B2 English.',
    how: 'Apply on the Study in Italy portal.',
    closes: '2026-03-26', when: 'The 2026–27 round closed on 26 March 2026.',
    url: 'https://ambnewdelhi.esteri.it/en/italia-e-india/diplomazia-culturale/studiare-in-italia/scholarships/scholarships-2026-2027/', checked: '2026-11-03'
  },
  {
    id: 'ireland', name: 'Government of Ireland International Education Scholarships', by: 'Higher Education Authority, Ireland', place: 'Ireland',
    regions: ['europe'], countries: ['Ireland'], levels: ['masters', 'phd'], funding: 'full',
    amount: 'A full fee waiver plus €10,000, for one year of study.',
    who: 'Students from outside the EU/EEA, Switzerland and the UK, with an offer from an eligible Irish institution.',
    how: 'Get an offer first, then apply on the scholarship portal. AI-written applications are not allowed.',
    closes: '2026-03-12', when: 'The 2026 round closed on 12 March 2026.',
    url: 'https://hea.ie/assets/uploads/2026/01/2026-GOI-IES-Call-Document.pdf', checked: '2026-11-03'
  },

  /* ---------- America ---------- */
  {
    id: 'fulbright-masters', name: 'Fulbright-Nehru Master’s Fellowships', by: 'USIEF', place: 'United States',
    regions: ['northamerica'], countries: ['United States'], levels: ['masters'], funding: 'full', minWork: 3,
    amount: 'Tuition, living costs, airfare and accident cover, for up to two years.',
    who: 'Three years of relevant work, a bachelor’s equivalent with 55%, and one of the listed fields. Government employees are excluded.',
    how: 'Apply to USIEF. Your employer must confirm your leave if you are working.',
    state: 'closed', when: 'The newest round on the official page is 2026–27, closed 14 May 2025. Ask USIEF about the next one.',
    url: 'https://www.usief.org.in/fulbright-fellowships/fellowships-for-indian-citizen/fulbright-nehru-masters-fellowships/', checked: '2026-11-03'
  },
  {
    id: 'fulbright-doctoral', name: 'Fulbright-Nehru Doctoral Research Fellowships', by: 'USIEF', place: 'United States',
    regions: ['northamerica'], countries: ['United States'], levels: ['phd'], funding: 'part',
    amount: 'Monthly stipend, airfare and accident cover, for six to nine months.',
    who: 'Indian citizens registered for a PhD in India. Most government employees are excluded.',
    how: 'Apply to USIEF with a letter from your PhD supervisor.',
    closes: '2026-07-01', when: 'The 2027–28 round closed on 1 July 2026.',
    url: 'https://www.usief.org.in/fulbright-fellowships/fellowships-for-indian-citizen/fulbright-nehru-doctoral-research-fellowships/', checked: '2026-11-03'
  },
  {
    id: 'knight-hennessy', name: 'Knight-Hennessy Scholars', by: 'Stanford University', place: 'Stanford, USA',
    regions: ['northamerica'], countries: ['United States'], levels: ['masters', 'phd'], funding: 'full',
    amount: 'Graduate funding at Stanford. See the official Funding page for what is included.',
    who: 'Applicants to a Stanford graduate degree. See the official Eligibility page.',
    how: 'Make two applications: one to Knight-Hennessy and one to your Stanford programme.',
    opens: '2027-06-01', when: 'The 2027 round has closed. The 2028 round opens in June 2027.',
    url: 'https://knight-hennessy.stanford.edu/admission', checked: '2026-11-03'
  },
  {
    id: 'tata-cornell', name: 'Tata Scholarship at Cornell', by: 'Cornell University', place: 'Cornell, USA',
    regions: ['northamerica'], countries: ['United States'], levels: ['ug'], funding: 'check',
    amount: 'Need-based aid. The fund supports about 20 scholars at a time.',
    who: 'Students who attended secondary school in India, were admitted to Cornell and qualify for need-based aid.',
    how: 'There is no separate form. Apply to Cornell and file the CSS Profile for aid.',
    state: 'varies', when: 'Follows Cornell’s undergraduate admission dates.',
    url: 'http://admissions.cornell.edu/apply/international-students/tata-scholarship', checked: '2026-11-03'
  },
  {
    id: 'aga-khan', name: 'Aga Khan International Scholarship', by: 'Aga Khan Foundation', place: 'Canada, Portugal or USA',
    regions: ['northamerica', 'europe'], countries: ['Canada', 'Portugal', 'United States'], levels: ['masters', 'phd'], funding: 'part',
    amount: 'Half grant, half loan: you repay 50%. A guarantor must co-sign.',
    who: 'Applicants from listed countries, including India, entering their first year of postgraduate study. Master’s comes first.',
    how: 'Use the programme’s eligibility tool to find the local team for India.',
    state: 'upcoming', when: 'The 2026–27 round has closed. The next round opens in early 2027.',
    url: 'https://the.akdn/en/what-we-do/developing-human-capacity/education/international-scholarships', checked: '2026-11-03'
  },

  /* ---------- Australia ---------- */
  {
    id: 'rtp', name: 'Research Training Program (RTP)', by: 'Australian Government', place: 'Australian universities',
    regions: ['oceania'], countries: ['Australia'], levels: ['masters', 'phd'], funding: 'check',
    amount: 'Support for research master’s and doctoral degrees. Amounts vary by university.',
    who: 'Domestic and international research students.',
    how: 'Apply directly to a participating university.',
    state: 'varies', when: 'Each university sets its own dates.',
    url: 'https://www.studyaustralia.gov.au/en/plan-your-studies/scholarships', checked: '2026-11-03'
  },
  {
    id: 'sydney-india', name: 'Sydney Scholars India', by: 'University of Sydney', place: 'Sydney',
    regions: ['oceania'], countries: ['Australia'], levels: ['ug', 'masters'], funding: 'part',
    amount: '28 awards a year: two with full undergraduate tuition, ten of A$20,000 and sixteen of A$10,000.',
    who: 'Indian citizens living in India with an unconditional offer who have not started the degree.',
    how: 'Get your offer, then submit the university’s online scholarship form.',
    opens: '2026-04-01', closes: '2026-05-24', when: 'The latest round ran from 1 April to 24 May 2026.',
    url: 'https://www.sydney.edu.au/scholarships/e/sydney-scholars-india-scholarship-program.html', checked: '2026-11-03'
  },
  {
    id: 'monash', name: 'Monash international scholarships', by: 'Monash University', place: 'Melbourne',
    regions: ['oceania'], countries: ['Australia'], levels: ['ug', 'masters'], funding: 'part',
    amount: 'Leadership: 100% of course fees, four a year. Merit: up to A$50,000, 31 a year. Living costs are not included.',
    who: 'International students. Medicine and some other courses are excluded.',
    how: 'Check each award’s rules on the Monash scholarship website.',
    state: 'varies', when: 'Dates are listed on each award’s page.',
    url: 'https://www.monash.edu/india/study/scholarships-and-finance-options', checked: '2026-11-03'
  },
  {
    id: 'melbourne', name: 'University of Melbourne scholarships', by: 'University of Melbourne', place: 'Melbourne',
    regions: ['oceania'], countries: ['Australia'], levels: ['ug', 'masters', 'phd'], funding: 'check',
    amount: 'Over 1,200 scholarships and prizes, many open to Indian students. Amounts vary.',
    who: 'Often based on merit. Some also consider need or your course.',
    how: 'Most are considered automatically when you apply. Others need a separate form.',
    state: 'varies', when: 'Dates differ by award.',
    url: 'https://study.unimelb.edu.au/connect-with-us/international/india', checked: '2026-11-03'
  },

  /* ---------- China ---------- */
  {
    id: 'cgs', name: 'Chinese Government Scholarship', by: 'China Scholarship Council', place: 'Chinese universities',
    regions: ['asia'], countries: ['China'], levels: ['ug', 'masters', 'phd'], funding: 'full',
    amount: 'Full scholarship. Check the current notice for exactly what is covered.',
    who: 'International students, with past winners from India. Chinese-taught courses need HSK scores.',
    how: 'Apply on the Campus China portal, through your chosen route.',
    state: 'varies', when: 'India’s date for 2027–28 is not confirmed. Check Campus China and the Chinese Embassy in India.',
    url: 'https://www.campuschina.org/', checked: '2026-11-03'
  },
  {
    id: 'yenching', name: 'Yenching Academy', by: 'Peking University', place: 'Beijing',
    regions: ['asia'], countries: ['China'], levels: ['masters'], funding: 'full',
    amount: 'Tuition, housing, monthly stipend, insurance, research costs and one return trip in year one. Year two needs a further application.',
    who: 'Non-Chinese citizens with a bachelor’s degree and a strong interest in studying China.',
    how: 'Apply online. Check whether your university has its own pre-selection.',
    opens: '2026-09-01', closes: '2026-11-30', when: 'The deadline is 9 am Beijing time on 30 November 2026, which is 6:30 am in India. Submit by 29 November.',
    url: 'https://yenchingacademy.pku.edu.cn/ADMISSIONS.htm', checked: '2026-11-03'
  },
  {
    id: 'schwarzman', name: 'Schwarzman Scholars', by: 'Schwarzman Scholars · Tsinghua University', place: 'Beijing',
    regions: ['asia'], countries: ['China'], levels: ['masters'], funding: 'full', maxAge: 28,
    amount: 'Tuition, housing and meals, travel, study tours, laptop, insurance and a personal stipend.',
    who: 'Aged 18 to under 29 on 1 August 2028, with a bachelor’s degree by then.',
    how: 'Apply online, using the global application for non-Chinese passport holders.',
    opens: '2027-04-01', when: 'The next global round runs from April to September 2027. The exact closing day is not published yet.',
    url: 'https://www.schwarzmanscholars.org/admissions/application-instructions/', checked: '2026-11-03'
  },

  /* ---------- Japan ---------- */
  {
    id: 'mext-research', name: 'MEXT Research Student Scholarship', by: 'Government of Japan', place: 'Japan',
    regions: ['asia'], countries: ['Japan'], levels: ['masters', 'phd'], funding: 'full', maxAge: 34,
    amount: 'Tuition, return airfare, and about ¥144,000–145,000 a month.',
    who: 'Under 35, with 70% marks in your last degree (65% in humanities and social sciences).',
    how: 'Email the preliminary form to the Embassy of Japan in Word format. Shortlisted applicants then send full documents.',
    closes: '2026-05-15', when: 'The 2027 round closed on 15 May 2026.',
    url: 'https://www.in.emb-japan.go.jp/education/Research_Student.html', checked: '2026-11-03'
  },
  {
    id: 'mext-ug', name: 'MEXT Undergraduate Scholarship', by: 'Government of Japan', place: 'Japan',
    regions: ['asia'], countries: ['Japan'], levels: ['ug'], funding: 'full', maxAge: 24,
    amount: 'Tuition, return airfare and ¥117,000 a month, for four or five years. Up to 12 places.',
    who: 'Born on or after 2 April 2002 in the last round, with 80% in Class 12.',
    how: 'Send your form to your local office. Kerala and Tamil Nadu use the Consulate in Chennai.',
    closes: '2026-05-25', when: 'The 2027 round closed on 25 May 2026 in New Delhi. Other offices may differ.',
    url: 'https://www.in.emb-japan.go.jp/education/undergraduate_student.html', checked: '2026-11-03'
  },

  /* ---------- Korea ---------- */
  {
    id: 'gks-g', name: 'Global Korea Scholarship: Graduate', by: 'Government of Korea', place: 'South Korea',
    regions: ['asia'], countries: ['South Korea'], levels: ['masters', 'phd'], funding: 'full', maxAge: 39,
    amount: 'Monthly allowance, tuition, language training and airfare. Check the current guidelines for amounts.',
    who: 'Under 40, with 80% or the top 20% of your class. The 2026 quota for India had 26 embassy places.',
    how: 'Use the embassy track through the Korean Embassy in New Delhi, or the university track.',
    state: 'varies', when: 'The last confirmed India deadline was 3 March 2025. Check Study in Korea for the current round.',
    url: 'https://www.studyinkorea.go.kr/', checked: '2026-11-03'
  },
  {
    id: 'gks-u', name: 'Global Korea Scholarship: Undergraduate', by: 'Government of Korea', place: 'South Korea',
    regions: ['asia'], countries: ['South Korea'], levels: ['ug'], funding: 'full',
    amount: 'Check the current guidelines for what is covered.',
    who: 'Check the current guidelines for age and marks.',
    how: 'The embassy track runs through the Korean Embassy in New Delhi. A university track may also apply.',
    state: 'varies', when: 'One embassy’s 2027 notice shows 15–30 September, but India’s date is not confirmed.',
    url: 'https://www.studyinkorea.go.kr/', checked: '2026-11-03'
  },

  /* ---------- Middle East ---------- */
  {
    id: 'kaust', name: 'KAUST Fellowship', by: 'King Abdullah University of Science and Technology', place: 'Saudi Arabia',
    regions: ['middleeast'], countries: ['Saudi Arabia'], levels: ['masters', 'phd'], funding: 'full',
    amount: 'Tuition, housing, health insurance, relocation support and a stipend.',
    who: 'Every admitted master’s and PhD student, unless funded by an outside sponsor.',
    how: 'Apply for admission to one programme. There is no separate fellowship form.',
    state: 'varies', when: 'See the admission timeline on the KAUST site. Applying early is encouraged.',
    url: 'https://admissions.kaust.edu.sa/study/ms-phd-degree', checked: '2026-11-03'
  },
  {
    id: 'khalifa', name: 'Khalifa University Graduate Scholarship', by: 'Khalifa University', place: 'Abu Dhabi, UAE',
    regions: ['middleeast'], countries: ['United Arab Emirates'], levels: ['masters', 'phd'], funding: 'part',
    amount: 'Tiered, from textbooks and flights up to full tuition and housing. PhD stipends vary by tier.',
    who: 'International full-time master’s and PhD students. Places are limited.',
    how: 'There is no separate form. You are placed in a tier during admission. The PhD research path carries a work commitment.',
    state: 'varies', when: 'Follows the university’s admission dates.',
    url: 'https://www.ku.ac.ae/scholarship/graduate-research-teaching-scholarship-for-international-students', checked: '2026-11-03'
  },
  {
    id: 'mbzuai', name: 'MBZUAI Undergraduate Scholarship', by: 'Mohamed bin Zayed University of AI', place: 'Abu Dhabi, UAE',
    regions: ['middleeast'], countries: ['United Arab Emirates'], levels: ['ug'], funding: 'part',
    amount: 'Merit awards that may cover the US$45,000 yearly tuition and cost of attendance. No stipend, though some packages include living support.',
    who: 'Applicants to the undergraduate programme. Ask admissions whether your nationality affects the award.',
    how: 'No separate application is needed.',
    state: 'varies', when: 'Follows the undergraduate admission dates.',
    url: 'https://mbzuai.ac.ae/study/undergraduate-program/', checked: '2026-11-03'
  },

  /* ---------- Funded from India, for study abroad ---------- */
  {
    id: 'nos-sc', name: 'National Overseas Scholarship (SC and others)', by: 'Ministry of Social Justice, India', place: 'Study abroad',
    regions: ['any'], countries: ['Any country'], levels: ['masters', 'phd'], funding: 'full', maxAge: 35,
    amount: 'Tuition, maintenance and other allowances. The official page listed 125 awards for 2023–24.',
    who: 'SC, denotified and nomadic tribe candidates, and landless labourer and traditional artisan families. Family income up to ₹8 lakh a year and 60% marks.',
    how: 'Apply on the scheme’s portal. Offers from QS top-500 universities get first preference.',
    state: 'varies', when: 'Check the current round on the official page.',
    url: 'https://socialjustice.gov.in/schemes/28', checked: '2026-11-03'
  },
  {
    id: 'nos-st', name: 'National Overseas Scholarship (ST)', by: 'Ministry of Tribal Affairs, India', place: 'Study abroad',
    regions: ['any'], countries: ['Any country'], levels: ['masters', 'phd'], funding: 'check',
    amount: 'See the scheme’s guidelines.',
    who: 'Scheduled Tribe candidates.',
    how: 'Apply on the official portal.',
    state: 'varies', when: 'The newest round on the official page is 2024–25, with no closing date shown.',
    url: 'https://overseas.tribal.gov.in/', checked: '2026-11-03'
  },

  /* ---------- Added: more of the world ---------- */
  {
    id: 'hungary', name: 'Stipendium Hungaricum', by: 'Government of Hungary', place: 'Hungary',
    regions: ['europe'], countries: ['Hungary'], levels: ['ug', 'masters', 'phd'], funding: 'part',
    amount: 'Free tuition, a free dorm place or HUF 40,000 a month for housing, medical insurance and a HUF 43,700 monthly stipend for bachelor’s and master’s. It will not cover all living costs.',
    who: 'India is a sending partner. PhD study has a separate call.',
    how: 'Apply online, and also apply to India’s sending partner, which must nominate you. Agencies are not needed.',
    closes: '2026-01-15', when: 'The 2026–27 bachelor’s and master’s round closed on 15 January 2026.',
    url: 'https://stipendiumhungaricum.hu/wp-content/uploads/2025/10/BA_MA_OTM_Call_for_Applications_2026_27.pdf', checked: '2026-11-03'
  },
  {
    id: 'turkiye', name: 'Türkiye Scholarships', by: 'Government of Türkiye', place: 'Türkiye',
    regions: ['middleeast'], countries: ['Türkiye'], levels: ['ug', 'masters', 'phd'], funding: 'full',
    amount: 'Financial support, tuition, accommodation, health insurance and a university place.',
    who: 'International students from all countries. See the criteria page for age limits and marks.',
    how: 'Apply online on the official portal.',
    opens: '2026-01-10', closes: '2026-02-20', when: 'The 2026 round ran from 10 January to 20 February 2026.',
    url: 'https://www.turkiyeburslari.gov.tr/announcements/turkiye-scholarships-2026-applications-121', checked: '2026-11-03'
  },
  {
    id: 'pearson', name: 'Lester B. Pearson Scholarship', by: 'University of Toronto', place: 'Toronto, Canada',
    regions: ['northamerica'], countries: ['Canada'], levels: ['ug'], funding: 'full',
    amount: 'A full four-year scholarship.',
    who: 'International school students with exceptional marks who are leaders in their school.',
    how: 'Your school must nominate you. Ask early.',
    state: 'varies', when: 'See the Pearson scholarship page linked from the official page.',
    url: 'https://future.utoronto.ca/scholarships-international-students', checked: '2026-11-03'
  },
  {
    id: 'auckland-india', name: 'Auckland India High Achievers Scholarship', by: 'University of Auckland', place: 'Auckland, New Zealand',
    regions: ['oceania'], countries: ['New Zealand'], levels: ['ug', 'masters'], funding: 'part',
    amount: 'Up to NZ$20,000 off first-year tuition. Up to 30 awards a year.',
    who: 'Indian passport holders living outside New Zealand with an offer and a GPE of at least 6.00.',
    how: 'Send a letter of application and a referee endorsement to the Scholarships Office.',
    state: 'varies', when: 'The published rules show past dates only. Ask the Scholarships Office about the next intake.',
    url: 'https://cdn.auckland.ac.nz/assets/Scholarships/regulations/university-of-auckland-india-high-achievers-scholarship.pdf', checked: '2026-11-03'
  },
  {
    id: 'nus', name: 'NUS Research Scholarship', by: 'National University of Singapore', place: 'Singapore',
    regions: ['asia'], countries: ['Singapore'], levels: ['masters', 'phd'], funding: 'full',
    amount: 'Full tuition waiver plus S$3,000 a month for a PhD or S$2,900 for a research master’s.',
    who: 'International research students with an upper second-class degree or equivalent. Teaching assistance is required.',
    how: 'Tick the scholarship in your NUS graduate application.',
    state: 'varies', when: 'Intakes are in August and January. Each faculty sets its own deadline.',
    url: 'https://nusgs.nus.edu.sg/scholarships/nus-research-scholarship', checked: '2026-11-03'
  },
  {
    id: 'hkpfs', name: 'Hong Kong PhD Fellowship Scheme', by: 'Research Grants Council, Hong Kong', place: 'Hong Kong',
    regions: ['asia'], countries: ['Hong Kong'], levels: ['phd'], funding: 'part',
    amount: 'HK$344,400 a year plus HK$14,400 for travel, for up to three years (2026–27 rates).',
    who: 'Applicants from anywhere who are new full-time PhD students at a Hong Kong university.',
    how: 'Apply to the scheme and to up to two university programmes.',
    opens: '2026-09-01', closes: '2026-12-01', when: 'Closes at noon Hong Kong time on 1 December 2026, which is 9:30 am in India.',
    url: 'https://www.ugc.edu.hk/eng/rgc/funding_opport/hkpfs/', checked: '2026-11-03'
  },
  {
    id: 'taiwan', name: 'Taiwan Scholarship for Indian students', by: 'Ministry of Education, Taiwan', place: 'Taiwan',
    regions: ['asia'], countries: ['Taiwan'], levels: ['ug', 'masters', 'phd'], funding: 'check',
    amount: 'See the India scholarship guide on the official page.',
    who: 'Indian applicants. See the guide for levels and rules.',
    how: 'Apply through the online system, using the handbook for Indian applicants.',
    opens: '2026-02-01', closes: '2026-03-31', when: 'The 2026 round ran from 1 February to 31 March 2026.',
    url: 'https://www.roc-taiwan.org/in_en/post/7920.html', checked: '2026-11-03'
  },
  {
    id: 'malaysia', name: 'Malaysia International Scholarship', by: 'Ministry of Higher Education, Malaysia', place: 'Malaysia',
    regions: ['asia'], countries: ['Malaysia'], levels: ['masters', 'phd'], funding: 'full', ageBy: { masters: 40, phd: 45 },
    amount: 'Tuition plus RM 1,500 a month.',
    who: 'India is eligible as a Commonwealth country. Age limit 40 for a master’s and 45 for a PhD.',
    how: 'Apply on the official portal.',
    state: 'varies', when: 'The guidelines give no dates. Check the portal or ask MOHE.',
    url: 'https://biasiswa.mohe.gov.my/INTER/doc/MIS/Guidelines%20MIS%202026.pdf', checked: '2026-11-03'
  },
  {
    id: 'colombia', name: 'Beca Colombia for Foreigners', by: 'ICETEX, Government of Colombia', place: 'Colombia',
    regions: ['southamerica'], countries: ['Colombia'], levels: ['masters'], funding: 'full', maxAge: 49, minWork: 1,
    amount: 'Full tuition, a monthly allowance of two minimum wages and health cover.',
    who: 'Aged 18 to under 50, with a bachelor’s GPA of 4.0/5.0, 12 months of relevant work and an admission letter. Five awards per country.',
    how: 'Get admitted to a listed programme, then apply through ICETEX.',
    opens: '2026-03-25', closes: '2026-06-05', when: 'The 2026-2 round ran from 25 March to 5 June 2026.',
    url: 'https://web.icetex.gov.co/documents/20122/4110366/bases-ingles-beca-colombia-2026-2.pdf', checked: '2026-11-03'
  },
  {
    id: 'uct', name: 'University of Cape Town funding noticeboard', by: 'University of Cape Town', place: 'South Africa',
    regions: ['africa'], countries: ['South Africa'], levels: ['masters', 'phd'], funding: 'check',
    amount: 'A list of postgraduate funds. Most entries show no amount.',
    who: 'Some are for South Africans only, so check each award before applying.',
    how: 'Open each notice, or ask pgfunding@uct.ac.za.',
    state: 'varies', when: 'Each notice has its own date.',
    url: 'https://uct.ac.za/students/fees-funding-postgraduate-degree-funding/postgraduate-degree-funding-noticeboard', checked: '2026-11-03'
  }
];

/* Names that often appear on scholarship lists, but which need care. */
window.SCHOLARSHIP_WATCH = [
  { name: 'Australia Awards', note: 'India is not on the official list of participating countries.', url: 'https://www.dfat.gov.au/people-to-people/australia-awards/participating-countries' },
  { name: 'Commonwealth PhD Scholarships', note: 'These are for least developed countries and vulnerable states. India is not confirmed, so check the eligible countries tab.', url: 'https://cscuk.fcdo.gov.uk/scholarships/commonwealth-phd-scholarships-for-least-developed-countries-and-vulnerable-states/' },
  { name: 'DAAD IIT Delhi In-Country Scholarship', note: 'This one is for students from Bangladesh, Bhutan, Nepal and Sri Lanka, not India.', url: 'https://www.daad.in/en/study-research-in-germany/studying-in-germany/daad-scholarships/' },
  { name: 'Vanier Canada Graduate Scholarships', note: 'The programme is archived and no longer accepts applications.', url: 'https://vanier.gc.ca/en/eligibility-admissibilite.html' },
  { name: '“Fully funded” Finland government scholarships', note: 'Finland warns these ads are false. Universities offer tuition waivers instead.', url: 'https://www.studyinfinland.fi/scholarships/finland-scholarships' },
  { name: 'Manaaki New Zealand Scholarships', note: 'The official page does not mention India, so confirm before applying.', url: 'https://www.studywithnewzealand.govt.nz/en/study-options/scholarships' },
  { name: 'Mauritius-Africa Scholarship Scheme', note: 'Eligibility for Indians is not confirmed.', url: 'https://www.uom.ac.mu/index.php/scholarships' }
];

/* Worth a look, but India's eligibility or the terms could not be read from the official source yet. */
window.SCHOLARSHIP_UNCONFIRMED = [
  { name: 'Israel MFA Scholarships', url: 'https://www.gov.il/en/service/scholarships_application_for_academic_studies_in_israel' },
  { name: 'Brazil PEC-PG', url: 'https://www.gov.br/capes/en/access-to-information/actions-and-programs/scholarships-and-students/international-cooperation-programs/multinational/post-graduate-student-covenant-program-pec-pg' },
  { name: 'Poland My First Choice', url: 'https://nawa.gov.pl/en/students/foreign-students/poland-my-first-choice-programme' },
  { name: 'Darmasiswa, Indonesia', url: 'https://darmasiswa.kemdikbud.go.id/' },
  { name: 'Study in Kazakhstan', url: 'https://bolashak.gov.kz/en/allnews/results-study-kazakhstan-selection-550-scholarships-studying-kazakhstan' }
];

/* Ways to meet past scholars. No names are stored here. LinkedIn links only run a
   search for the visitor. Pages must be official lists that the scholarship
   publishes itself. Keep this block last: the daily check reads the links above. */
window.SCHOLARSHIP_PEOPLE = {
  'chevening': '"Chevening Scholar" India',
  'commonwealth-masters': '"Commonwealth Scholar" India',
  'rhodes': '"Rhodes Scholar" India',
  'gates': '"Gates Cambridge" India',
  'felix': '"Felix Scholar" India',
  'inlaks': '"Inlaks Scholar"',
  'erasmus-mundus': '"Erasmus Mundus" India',
  'eiffel': '"Eiffel Scholar" India',
  'swiss': '"Swiss Government Excellence" India',
  'daad-epos': '"DAAD Scholar" India',
  'daad-phd': '"DAAD Scholar" India',
  'daad-kospie': '"DAAD" KOSPIE India',
  'maeci': 'MAECI scholarship India',
  'ireland': '"Government of Ireland" scholarship India',
  'fulbright-masters': '"Fulbright-Nehru"',
  'fulbright-doctoral': '"Fulbright-Nehru"',
  'knight-hennessy': '"Knight-Hennessy Scholar" India',
  'tata-cornell': '"Tata Scholar" Cornell',
  'aga-khan': '"Aga Khan Foundation" scholar India',
  'rtp': '"Research Training Program" India',
  'sydney-india': '"University of Sydney" India scholarship',
  'monash': '"Monash University" India scholarship',
  'melbourne': '"University of Melbourne" India scholarship',
  'cgs': '"Chinese Government Scholarship" India',
  'yenching': '"Yenching Scholar" India',
  'schwarzman': '"Schwarzman Scholar" India',
  'mext-research': 'MEXT scholar India',
  'mext-ug': 'MEXT scholar India',
  'gks-g': '"Global Korea Scholarship" India',
  'gks-u': '"Global Korea Scholarship" India',
  'kaust': 'KAUST student India',
  'khalifa': '"Khalifa University" student India',
  'mbzuai': 'MBZUAI student India',
  'nos-sc': '"National Overseas Scholarship"',
  'nos-st': '"National Overseas Scholarship"',
  'hungary': '"Stipendium Hungaricum" India',
  'turkiye': '"Türkiye Scholarships" India',
  'pearson': '"Pearson Scholar" Toronto India',
  'auckland-india': '"University of Auckland" India scholarship',
  'nus': '"NUS" research scholar India',
  'hkpfs': '"Hong Kong PhD Fellowship" India',
  'taiwan': '"Taiwan Scholarship" India',
  'malaysia': '"Malaysia International Scholarship" India',
  'colombia': '"Beca Colombia" India',
  'uct': '"University of Cape Town" student India'
};
window.SCHOLARSHIP_PEOPLE_PAGES = {
  'gates': 'https://www.gatescambridge.org/current-scholars/',
  'pearson': 'https://future.utoronto.ca/meet-2026-pearson-scholars',
  'fulbright-masters': 'https://www.usief.org.in/indian-fulbrighters/',
  'fulbright-doctoral': 'https://www.usief.org.in/indian-fulbrighters/'
};
