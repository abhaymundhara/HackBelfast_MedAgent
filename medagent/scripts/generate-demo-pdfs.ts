/**
 * Generate demo patient PDFs following the GP Emergency Medical Summary template.
 * Usage: npx tsx scripts/generate-demo-pdfs.ts
 */
import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const OUTPUT_DIR = path.join(__dirname, "../fixtures/demo-patients");

interface DemoPatient {
  name: string;
  dob: string;
  sex: string;
  bloodType: string;
  homeCountry: string;
  languages: string;
  issued: string;
  practice: string;
  allergies: string[];
  medications: string[];
  conditions: string[];
  emergencyAlerts: string[];
  emergencyContact: string;
  recentDischarge: string[];
}

const PATIENTS: DemoPatient[] = [
  {
    name: "Liam O'Connor",
    dob: "1987-06-14",
    sex: "Male",
    bloodType: "O+",
    homeCountry: "Ireland",
    languages: "English, Irish",
    issued: "20 April 2026",
    practice: "Malone Medical Centre, Belfast",
    allergies: [
      "Penicillin — severe — Reaction: Anaphylaxis",
      "Latex — moderate — Reaction: Contact dermatitis",
    ],
    medications: [
      "Warfarin 5 mg once daily",
      "Bisoprolol 2.5 mg once daily",
      "Atorvastatin 40 mg once daily",
      "Omeprazole 20 mg once daily",
    ],
    conditions: [
      "Atrial fibrillation (major)",
      "Hypertension — well controlled on current regimen",
      "Hypercholesterolaemia",
      "Gastro-oesophageal reflux disease",
    ],
    emergencyAlerts: [
      "Anticoagulant therapy — warfarin, confirm INR before procedures",
      "Penicillin allergy — anaphylaxis risk, carries EpiPen",
    ],
    emergencyContact: "Siobhan O'Connor (Wife) +353 86 321 4567",
    recentDischarge: [
      "Royal Victoria Hospital, Belfast — Cardiology, March 2026.",
      "Cardioversion for persistent atrial fibrillation.",
      "Post-procedure: warfarin resumed, target INR 2.0–3.0,",
      "bisoprolol uptitrated, cardiology review at 8 weeks.",
    ],
  },
  {
    name: "Aoife Murphy",
    dob: "2001-11-03",
    sex: "Female",
    bloodType: "B-",
    homeCountry: "Ireland",
    languages: "English",
    issued: "18 April 2026",
    practice: "Stranmillis Family Practice, Belfast",
    allergies: [
      "Sulfonamides — moderate — Reaction: Skin rash and urticaria",
    ],
    medications: [
      "Salbutamol inhaler 100 mcg as needed",
      "Fluticasone inhaler 250 mcg twice daily",
      "Montelukast 10 mg once daily",
      "Loratadine 10 mg once daily",
    ],
    conditions: [
      "Moderate persistent asthma (major)",
      "Allergic rhinitis — perennial",
      "Exercise-induced bronchospasm",
      "Eczema — mild, intermittent flares",
    ],
    emergencyAlerts: [
      "Asthma — carries reliever inhaler at all times",
      "Previous ICU admission for acute severe asthma exacerbation (2023)",
    ],
    emergencyContact: "Roisin Murphy (Mother) +44 28 9012 3456",
    recentDischarge: [
      "Ulster Hospital, Dundonald — Respiratory medicine, January 2026.",
      "Admitted with acute asthma exacerbation triggered by viral URTI.",
      "Post-discharge: oral prednisolone taper completed,",
      "fluticasone stepped up, respiratory review at 6 weeks.",
    ],
  },
  {
    name: "Tomasz Kowalski",
    dob: "1975-03-22",
    sex: "Male",
    bloodType: "AB+",
    homeCountry: "Poland",
    languages: "Polish, English",
    issued: "22 April 2026",
    practice: "Falls Road Medical Group, Belfast",
    allergies: [
      "Codeine — severe — Reaction: Respiratory depression",
      "NSAIDs — moderate — Reaction: GI bleeding",
      "Contrast dye — mild — Reaction: Urticaria",
    ],
    medications: [
      "Metformin 1000 mg twice daily",
      "Insulin glargine 22 units once daily",
      "Lisinopril 20 mg once daily",
      "Aspirin 75 mg once daily",
      "Rosuvastatin 10 mg once daily",
    ],
    conditions: [
      "Type 2 diabetes mellitus (major)",
      "Diabetic nephropathy — stage 2 CKD",
      "Hypertension — on ACE inhibitor",
      "Peripheral neuropathy — bilateral feet",
      "Previous myocardial infarction, November 2024",
    ],
    emergencyAlerts: [
      "Diabetes — insulin-dependent, risk of hypoglycaemia",
      "Codeine contraindicated — respiratory depression history",
      "Renal impairment — dose-adjust nephrotoxic drugs",
    ],
    emergencyContact: "Katarzyna Kowalska (Wife) +44 78 1234 5678",
    recentDischarge: [
      "Belfast City Hospital — Cardiology, November 2024.",
      "NSTEMI with PCI to LAD, single drug-eluting stent.",
      "Post-op: dual antiplatelet therapy (aspirin + clopidogrel x 12 months),",
      "cardiac rehab programme, HbA1c target <53 mmol/mol.",
      "Endocrinology and cardiology follow-up at 3 months.",
    ],
  },
  {
    name: "Priya Sharma",
    dob: "1992-08-09",
    sex: "Female",
    bloodType: "A-",
    homeCountry: "United Kingdom",
    languages: "English, Hindi, Punjabi",
    issued: "19 April 2026",
    practice: "Botanic Avenue Surgery, Belfast",
    allergies: [
      "Amoxicillin — moderate — Reaction: Maculopapular rash",
      "Egg — mild — Reaction: Nausea",
    ],
    medications: [
      "Levothyroxine 100 mcg once daily",
      "Sertraline 50 mg once daily",
      "Combined oral contraceptive pill once daily",
    ],
    conditions: [
      "Hypothyroidism — Hashimoto's thyroiditis (major)",
      "Generalised anxiety disorder",
      "Iron deficiency anaemia — resolved, monitoring",
      "Migraine with aura — infrequent episodes",
    ],
    emergencyAlerts: [
      "Migraine with aura — avoid combined oestrogen contraceptives if stroke risk increases",
      "Thyroid disorder — do not discontinue levothyroxine abruptly",
    ],
    emergencyContact: "Vikram Sharma (Father) +44 77 9876 5432",
    recentDischarge: [
      "Mater Hospital, Belfast — Endocrinology, February 2026.",
      "Thyroid storm secondary to non-compliance with levothyroxine.",
      "Post-discharge: levothyroxine dose optimised, TFTs at 6 weeks,",
      "pharmacy compliance support initiated, endocrine review at 3 months.",
    ],
  },
  {
    name: "Sean McAllister",
    dob: "1958-12-30",
    sex: "Male",
    bloodType: "O-",
    homeCountry: "United Kingdom",
    languages: "English",
    issued: "21 April 2026",
    practice: "Lisburn Road Practice, Belfast",
    allergies: [
      "ACE inhibitors — severe — Reaction: Angioedema",
      "Statins — moderate — Reaction: Rhabdomyolysis (atorvastatin)",
    ],
    medications: [
      "Apixaban 5 mg twice daily",
      "Amlodipine 10 mg once daily",
      "Losartan 100 mg once daily",
      "Ezetimibe 10 mg once daily",
      "Paracetamol 1 g as needed for arthritis pain",
    ],
    conditions: [
      "Atrial fibrillation — permanent (major)",
      "Heart failure with preserved ejection fraction (major)",
      "Osteoarthritis — bilateral knees and lumbar spine",
      "Benign prostatic hyperplasia",
      "Previous TIA, August 2025",
    ],
    emergencyAlerts: [
      "Anticoagulant therapy — apixaban, withhold 48h before surgery",
      "ACE inhibitor contraindicated — angioedema history",
      "Do not prescribe statins — prior rhabdomyolysis",
    ],
    emergencyContact: "Margaret McAllister (Daughter) +44 28 9045 6789",
    recentDischarge: [
      "Royal Victoria Hospital, Belfast — Stroke unit, August 2025.",
      "TIA with transient right-sided weakness and dysphasia.",
      "CT angiogram: no significant carotid stenosis.",
      "Post-discharge: apixaban commenced, echocardiogram confirmed HFpEF,",
      "driving restriction 1 month, neurology review at 3 months.",
    ],
  },
];

async function generatePdf(patient: DemoPatient): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const black = rgb(0, 0, 0);
  const grey = rgb(0.35, 0.35, 0.35);
  const lineColor = rgb(0.7, 0.15, 0.15);

  let y = 800;
  const leftMargin = 50;
  const contentIndent = 65;

  const drawTitle = (text: string, size: number) => {
    page.drawText(text, { x: leftMargin, y, size, font: helveticaBold, color: black });
    y -= size + 6;
  };

  const drawSectionHeader = (text: string) => {
    y -= 8;
    page.drawText(text, { x: leftMargin, y, size: 12, font: helveticaBold, color: black });
    y -= 18;
  };

  const drawLine = (text: string, indent = contentIndent) => {
    page.drawText(text, { x: indent, y, size: 9.5, font: helvetica, color: black });
    y -= 14;
  };

  const drawSubLabel = (label: string, value: string) => {
    page.drawText(`${label}: ${value}`, { x: contentIndent, y, size: 9.5, font: helvetica, color: black });
    y -= 14;
  };

  // Title
  drawTitle("GP Emergency Medical Summary", 18);
  page.drawText(`Issued: ${patient.issued} | Practice: ${patient.practice}`, {
    x: leftMargin, y, size: 9, font: helvetica, color: grey,
  });
  y -= 14;

  // Red line separator
  page.drawLine({
    start: { x: leftMargin, y },
    end: { x: 545, y },
    thickness: 1.5,
    color: lineColor,
  });
  y -= 16;

  // Patient Details
  drawSectionHeader("Patient Details");
  drawSubLabel("Name", patient.name);
  drawSubLabel("Date of Birth", patient.dob);
  drawSubLabel("Sex", patient.sex);
  drawSubLabel("Blood Type", patient.bloodType);
  drawSubLabel("Home Country", patient.homeCountry);
  drawSubLabel("Languages", patient.languages);

  // Allergies
  drawSectionHeader("Allergies");
  for (const allergy of patient.allergies) {
    drawLine(allergy);
  }

  // Current Medications
  drawSectionHeader("Current Medications");
  for (const med of patient.medications) {
    drawLine(med);
  }

  // Active Conditions
  drawSectionHeader("Active Conditions");
  for (const condition of patient.conditions) {
    drawLine(condition);
  }

  // Emergency Alerts
  drawSectionHeader("Emergency Alerts");
  for (const alert of patient.emergencyAlerts) {
    drawLine(alert);
  }

  // Emergency Contact
  drawSectionHeader("Emergency Contact");
  drawLine(patient.emergencyContact);

  // Recent Discharge
  drawSectionHeader("Recent Discharge");
  for (const line of patient.recentDischarge) {
    drawLine(line);
  }

  return doc.save();
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const patient of PATIENTS) {
    const pdfBytes = await generatePdf(patient);
    const slug = patient.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const filePath = path.join(OUTPUT_DIR, `test-patient-${slug}.pdf`);
    fs.writeFileSync(filePath, pdfBytes);
    console.log(`Generated: ${filePath}`);
  }

  console.log(`\nDone — ${PATIENTS.length} demo PDFs created in ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
