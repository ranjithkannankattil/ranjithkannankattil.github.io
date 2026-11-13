/* ============================================================
   Internship finder — built-in list of official starting points
   (productivity/internships.html)

   These are always shown, matched to the student's fields, so the
   government tabs are never empty even when the AI search quota runs
   out. Windows are the usual pattern, not a promise: every card says
   "check the official page". The night search checks the most
   relevant ones and marks them open / opening soon when it can.

   fields: broad areas the programme suits ("any" = every course).
   ============================================================ */
window.INTERN_FIELDS = {
  any: 'Any course',
  policy: 'Policy, economics, social science',
  law: 'Law',
  finance: 'Finance, commerce, banking',
  science: 'Pure sciences',
  engg: 'Engineering & technology',
  it: 'Computers & IT',
  agri: 'Agriculture, fisheries, forestry, veterinary',
  health: 'Medicine, nursing, pharmacy, public health',
  env: 'Environment & climate',
  arts: 'Arts, culture, languages, media',
  mgmt: 'Management & business'
};

window.INTERN_CENTRAL = [
  { name: 'PM Internship Scheme', by: 'Ministry of Corporate Affairs', url: 'https://pminternship.mca.gov.in', when: 'Rounds through the year; companies post openings on a rolling basis', fields: ['any'], paid: true, note: 'Paid. Registration is free and only on the official portal.' },
  { name: 'AICTE Internship Portal', by: 'AICTE, Ministry of Education', url: 'https://internship.aicte-india.org', when: 'Rolling, all year', fields: ['any'], note: 'Thousands of internships from companies and government bodies.' },
  { name: 'NITI Aayog Internship Scheme', by: 'NITI Aayog', url: 'https://www.niti.gov.in/internship', when: 'Usually 1st–10th of every month', fields: ['policy', 'finance', 'law', 'env', 'health', 'agri', 'it', 'any'], note: 'Usually unpaid. UG, PG and research students.' },
  { name: 'MEA Internship', by: 'Ministry of External Affairs', url: 'https://internship.mea.gov.in', when: 'Usually two or three batches a year', fields: ['policy', 'law', 'arts', 'any'], paid: true },
  { name: 'Reserve Bank of India Summer Placement', by: 'Reserve Bank of India', url: 'https://www.rbi.org.in', when: 'Usually once a year; check the Opportunities section', fields: ['finance', 'policy', 'law', 'mgmt'], paid: true },
  { name: 'SEBI Internship', by: 'Securities and Exchange Board of India', url: 'https://www.sebi.gov.in', when: 'Check the Careers section', fields: ['finance', 'law', 'mgmt', 'it'] },
  { name: 'Digital India Internship', by: 'Ministry of Electronics & IT (MeitY)', url: 'https://www.meity.gov.in', when: 'Usually once a year', fields: ['it', 'engg', 'mgmt', 'policy'], paid: true },
  { name: 'Ministry of Finance Internship', by: 'Ministry of Finance', url: 'https://finmin.gov.in', when: 'Check the department pages', fields: ['finance', 'policy'] },
  { name: 'MoEFCC Internship', by: 'Ministry of Environment, Forest & Climate Change', url: 'https://moef.gov.in', when: 'Check the internship notices', fields: ['env', 'science', 'agri', 'law', 'policy'] },
  { name: 'NHRC Internship', by: 'National Human Rights Commission', url: 'https://nhrc.nic.in', when: 'Usually summer and winter batches', fields: ['law', 'policy', 'arts'] },
  { name: 'National Commission for Women Internship', by: 'National Commission for Women', url: 'https://ncw.gov.in', when: 'Check the internship page', fields: ['law', 'policy', 'arts'] },
  { name: 'Ministry of Women & Child Development Internship', by: 'Ministry of WCD', url: 'https://wcd.gov.in', when: 'Check the internship notices', fields: ['policy', 'law', 'health', 'arts'] },
  { name: 'Department of Legal Affairs Internship', by: 'Ministry of Law & Justice', url: 'https://legalaffairs.gov.in', when: 'Check the internship notices', fields: ['law'] },
  { name: 'Comptroller & Auditor General Internship', by: 'CAG of India', url: 'https://cag.gov.in', when: 'Check the notices', fields: ['finance', 'policy', 'law', 'it'] },
  { name: 'Parliament internships and research fellowships', by: 'Parliament of India', url: 'https://sansad.in', when: 'Check Lok Sabha and Rajya Sabha notices', fields: ['policy', 'law', 'arts'] },
  { name: 'Ministry of Culture Internship', by: 'Ministry of Culture', url: 'https://indiaculture.gov.in', when: 'Check the notices', fields: ['arts', 'policy'] },
  { name: 'DPIIT Internship', by: 'Dept. for Promotion of Industry & Internal Trade', url: 'https://dpiit.gov.in', when: 'Check the notices', fields: ['policy', 'finance', 'law', 'mgmt'], paid: true },
  { name: 'TRAI Internship', by: 'Telecom Regulatory Authority of India', url: 'https://www.trai.gov.in', when: 'Check the notices', fields: ['it', 'engg', 'law', 'finance', 'policy'] },
  { name: 'ISRO internships and project training', by: 'ISRO and its centres', url: 'https://www.isro.gov.in', when: 'Each centre runs its own; check the careers pages', fields: ['engg', 'science', 'it'] },
  { name: 'DRDO lab internships', by: 'DRDO laboratories', url: 'https://www.drdo.gov.in', when: 'Each lab runs its own; apply to the lab', fields: ['engg', 'science', 'it'] },
  { name: 'CSIR lab internships', by: 'CSIR and its 37 labs', url: 'https://www.csir.res.in', when: 'Each lab announces its own', fields: ['science', 'engg', 'health', 'env', 'agri'] },
  { name: 'ICAR institute internships', by: 'Indian Council of Agricultural Research', url: 'https://icar.org.in', when: 'Each institute announces its own', fields: ['agri', 'science', 'env'] },
  { name: 'ICMR Short Term Studentship', by: 'Indian Council of Medical Research', url: 'https://www.icmr.gov.in', when: 'Usually once a year', fields: ['health', 'science'], paid: true },
  { name: 'Summer Research Fellowship (IASc-INSA-NASI)', by: 'Indian Academy of Sciences', url: 'https://www.ias.ac.in', when: 'Usually applications late in the year for the summer', fields: ['science', 'engg'], paid: true },
  { name: 'IIT, IISc and IISER summer programmes', by: 'National institutes', url: 'https://www.iisc.ac.in', when: 'Usually announced from December to March', fields: ['science', 'engg', 'it'], note: 'Each institute has its own page; the night search looks for the ones in your field.' }
];

window.INTERN_PSU = [
  { name: 'ONGC', url: 'https://ongcindia.com', fields: ['engg', 'science', 'finance', 'mgmt'] },
  { name: 'Indian Oil (IOCL)', url: 'https://iocl.com', fields: ['engg', 'science', 'mgmt', 'finance'] },
  { name: 'NTPC', url: 'https://ntpc.co.in', fields: ['engg', 'env', 'mgmt'] },
  { name: 'BHEL', url: 'https://www.bhel.com', fields: ['engg'] },
  { name: 'GAIL', url: 'https://gailonline.com', fields: ['engg', 'mgmt'] },
  { name: 'SAIL', url: 'https://sail.co.in', fields: ['engg', 'science'] },
  { name: 'HAL', url: 'https://hal-india.co.in', fields: ['engg', 'it'] },
  { name: 'BEL', url: 'https://bel-india.in', fields: ['engg', 'it'] },
  { name: 'Coal India', url: 'https://www.coalindia.in', fields: ['engg', 'env', 'mgmt'] },
  { name: 'POWERGRID', url: 'https://www.powergrid.in', fields: ['engg'] },
  { name: 'BPCL', url: 'https://www.bharatpetroleum.in', fields: ['engg', 'mgmt', 'finance'] },
  { name: 'HPCL', url: 'https://www.hindustanpetroleum.com', fields: ['engg', 'mgmt', 'finance'] },
  { name: 'CONCOR', url: 'https://concorindia.co.in', fields: ['mgmt', 'engg', 'finance'] },
  { name: 'Airports Authority of India', url: 'https://www.aai.aero', fields: ['engg', 'mgmt'] },
  { name: 'NABARD', url: 'https://www.nabard.org', fields: ['agri', 'finance', 'policy'], paid: true },
  { name: 'SIDBI', url: 'https://www.sidbi.in', fields: ['finance', 'mgmt'] },
  { name: 'LIC', url: 'https://licindia.in', fields: ['finance', 'mgmt'] },
  { name: 'NHPC', url: 'https://www.nhpcindia.com', fields: ['engg', 'env'] },
  { name: 'Cochin Shipyard', url: 'https://cochinshipyard.in', fields: ['engg'] },
  { name: 'FACT (Fertilisers and Chemicals Travancore)', url: 'https://www.fact.co.in', fields: ['engg', 'agri', 'science'] }
];

window.INTERN_STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'];
