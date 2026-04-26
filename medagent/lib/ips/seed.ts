import {
  ClinicianPersona,
  ClinicianPersonaSchema,
  EmergencySummary,
  PatientPolicy,
  PatientSeed,
} from "@/lib/types";

export const DEMO_CLINICIANS: ClinicianPersona[] = [
  ClinicianPersonaSchema.parse({
    id: "dr-murphy",
    requesterId: "MC12345",
    requesterLabel: "Dr. Aoife Murphy",
    issuerId: "did:solana:testnet:9mDqM2kX4LJ9Gf1V7rQxS3yQ5bF2pN8tH6uP4kR1xCwZ",
    issuerLabel: "HSE Ireland (St. James's Hospital, Dublin)",
    locale: "en-IE",
    stronglyVerified: true,
  }),
  ClinicianPersonaSchema.parse({
    id: "dr-okonkwo",
    requesterId: "GMC4921847",
    requesterLabel: "Dr. Chidi Okonkwo",
    issuerId: "did:solana:testnet:C3vK8pN2mQ7tR5xL1fH9wD4sY6uB2jP8qM5nT1rV4kZx",
    issuerLabel: "Belfast Trust (Royal Victoria Hospital, 274 Grosvenor Road, Belfast)",
    locale: "en-GB",
    stronglyVerified: true,
  }),
  ClinicianPersonaSchema.parse({
    id: "unknown-emergency",
    requesterId: "unknown-emergency",
    requesterLabel: "Emergency Doctor / Unknown Clinician",
    issuerId: "did:solana:testnet:B7kP2mQ5tR8xL1fH4wD9sY6uN3jV2qM5nT4rC7vK1zXp",
    issuerLabel: "Unverified Emergency Department",
    locale: "en-GB",
    stronglyVerified: false,
  }),
];

export const DEMO_PATIENTS: PatientSeed[] = [
  {
    patientId: "sarah-bennett",
    localIdentity: "patient:sarah-bennett",
    summary: EmergencySummary.parse({
      patientId: "sarah-bennett",
      demographics: {
        name: "Sarah Bennett",
        dob: "1991-08-14",
        sex: "female",
        bloodType: "O-",
        languages: ["English"],
        homeCountry: "United Kingdom",
        homeJurisdiction: "NI",
        email: "sarah.bennett@example.com",
      },
      allergies: [
        {
          substance: "Penicillin",
          severity: "life-threatening",
          reaction: "Anaphylaxis",
        },
      ],
      medications: [
        {
          name: "Warfarin",
          dose: "5 mg",
          frequency: "Once daily",
          critical: true,
        },
        {
          name: "Salbutamol inhaler",
          dose: "100 mcg",
          frequency: "As needed",
          critical: false,
        },
      ],
      conditions: [
        { label: "Atrial fibrillation", major: true },
        { label: "Asthma", major: false },
      ],
      alerts: ["anticoagulants"],
      emergencyContact: {
        name: "J. Bennett",
        relation: "Brother",
        phone: "+44 7700 900 111",
      },
      recentDischarge:
        "Belfast City Hospital — A&E discharge 2025-11-14, post-syncope investigation, cleared for discharge. Started warfarin 5mg OD for newly diagnosed AF.",
      documents: [
        {
          id: "sarah-gp-summary",
          title: "GP Emergency Summary",
          patientApprovedForTier1Or2: true,
        },
        {
          id: "sarah-insurance-note",
          title: "Insurance Emergency Letter",
          patientApprovedForTier1Or2: true,
        },
      ],
    }),
    policy: PatientPolicy.parse({
      emergencyAutoAccess: true,
      allowPatientApprovalRequests: true,
      breakGlassAllowed: true,
      shareableDocumentIds: ["sarah-gp-summary", "sarah-insurance-note"],
    }),
    docs: [
      {
        id: "sarah-gp-summary",
        title: "GP Emergency Summary",
        mimeType: "text/plain",
        content:
          "Sarah Bennett has a severe penicillin allergy, takes warfarin daily, and should avoid IM injections when INR status is unknown.",
        patientApprovedForTier1Or2: true,
      },
      {
        id: "sarah-insurance-note",
        title: "Insurance Emergency Letter",
        mimeType: "text/plain",
        content:
          "Emergency treatment is authorized. Contact insurer within 24 hours after stabilisation if admission occurs.",
        patientApprovedForTier1Or2: true,
      },
    ],
  },
  {
    patientId: "omar-haddad",
    localIdentity: "patient:omar-haddad",
    summary: EmergencySummary.parse({
      patientId: "omar-haddad",
      demographics: {
        name: "Omar Haddad",
        dob: "1987-03-02",
        sex: "male",
        bloodType: "O+",
        languages: ["Arabic", "English"],
        homeCountry: "United Kingdom",
        homeJurisdiction: "NI",
        email: "omar.haddad@qub.ac.uk",
      },
      allergies: [
        {
          substance: "Sulfa drugs",
          severity: "moderate",
          reaction: "Rash",
        },
      ],
      medications: [
        {
          name: "Metformin",
          dose: "500 mg",
          frequency: "Twice daily",
          critical: false,
        },
      ],
      conditions: [{ label: "Type 2 diabetes", major: true }],
      alerts: ["diabetes"],
      emergencyContact: {
        name: "Leila Haddad",
        relation: "Spouse",
        phone: "+44 7700 900 222",
      },
      documents: [],
    }),
    policy: PatientPolicy.parse({
      emergencyAutoAccess: false,
      allowPatientApprovalRequests: false,
      breakGlassAllowed: false,
      shareableDocumentIds: [],
    }),
    docs: [],
  },
  {
    patientId: "lucia-martin",
    localIdentity: "patient:lucia-martin",
    summary: EmergencySummary.parse({
      patientId: "lucia-martin",
      demographics: {
        name: "Lucia Martin",
        dob: "1978-11-23",
        sex: "female",
        bloodType: "B-",
        languages: ["English", "Irish"],
        homeCountry: "Ireland",
        homeJurisdiction: "ROI",
        email: "lucia.martin@example.com",
      },
      allergies: [
        {
          substance: "Latex",
          severity: "severe",
          reaction: "Respiratory distress",
        },
      ],
      medications: [
        {
          name: "Levetiracetam",
          dose: "500 mg",
          frequency: "Twice daily",
          critical: true,
        },
      ],
      conditions: [
        { label: "Epilepsy", major: true },
        { label: "Migraine", major: false },
      ],
      alerts: ["epilepsy"],
      emergencyContact: {
        name: "Jaime Martin",
        relation: "Partner",
        phone: "+353 86 111 2222",
      },
      recentDischarge:
        "Observed overnight at Daisy Hill Hospital, Newry after breakthrough seizure six months ago. Medication adherence restored. No further episodes reported.",
      documents: [
        {
          id: "lucia-neuro-letter",
          title: "Neurology travel note",
          patientApprovedForTier1Or2: true,
        },
      ],
    }),
    policy: PatientPolicy.parse({
      emergencyAutoAccess: true,
      allowPatientApprovalRequests: true,
      breakGlassAllowed: true,
      shareableDocumentIds: ["lucia-neuro-letter"],
    }),
    docs: [
      {
        id: "lucia-neuro-letter",
        title: "Neurology travel note",
        mimeType: "text/plain",
        content:
          "If Lucia Martin presents with a seizure, prioritize airway protection and confirm recent levetiracetam dosing before escalation.",
        patientApprovedForTier1Or2: true,
      },
    ],
  },
];

export const DEMO_DOCTORS = [
  // ROI clinicians
  {
    regNumber: "MC12345",
    regBody: "IMC" as const,
    name: "Dr. Aoife Murphy",
    email: "aoife.murphy@stjames.ie",
    specialty: "Emergency Medicine",
    hospital: "St. James's Hospital, Dublin",
    jurisdiction: "ROI",
  },
  {
    regNumber: "MC99999",
    regBody: "IMC" as const,
    name: "Dr. Siobhan Kelly",
    email: "siobhan.kelly@hse.ie",
    specialty: "General Practice",
    hospital: "Dundalk Health Centre",
    jurisdiction: "ROI",
  },
  // NI — Royal Victoria Hospital (274 Grosvenor Road, Belfast BT12 6BA)
  {
    regNumber: "GMC4921847",
    regBody: "GMC" as const,
    name: "Dr. Chidi Okonkwo",
    email: "chidi.okonkwo@belfasttrust.hscni.net",
    specialty: "Emergency Medicine / A&E",
    hospital: "Royal Victoria Hospital, 274 Grosvenor Road, Belfast BT12 6BA",
    jurisdiction: "NI",
  },
  // NI — Musgrave Park Hospital (20 Stockmans Lane, Belfast BT9 7JB) — Regional Orthopaedic Centre
  {
    regNumber: "GMC5318264",
    regBody: "GMC" as const,
    name: "Mr. Conor Wilson",
    email: "conor.wilson@belfasttrust.hscni.net",
    specialty: "Orthopaedics / MSK",
    hospital: "Musgrave Park Hospital, 20 Stockmans Lane, Belfast BT9 7JB",
    jurisdiction: "NI",
  },
  // NI — Mater Infirmorum Hospital (45-51 Crumlin Road, Belfast BT14 6AB)
  {
    regNumber: "GMC6187432",
    regBody: "GMC" as const,
    name: "Dr. Roisin McAlister",
    email: "roisin.mcalister@belfasttrust.hscni.net",
    specialty: "General Medicine / Respiratory",
    hospital: "Mater Infirmorum Hospital, 45-51 Crumlin Road, Belfast BT14 6AB",
    jurisdiction: "NI",
  },
  // NI — Ormeau Health Centre (120 Ormeau Road, Belfast BT7 2EB) — GP Practice
  {
    regNumber: "GMC4756091",
    regBody: "GMC" as const,
    name: "Dr. Aisling Donaghy",
    email: "aisling.donaghy@ormeauhc.hscni.net",
    specialty: "General Practice",
    hospital: "Ormeau Health Centre, 120 Ormeau Road, Belfast BT7 2EB",
    jurisdiction: "NI",
  },
  // NI — Belfast City Hospital (51 Lisburn Road, Belfast BT9 7AB)
  {
    regNumber: "GMC5842617",
    regBody: "GMC" as const,
    name: "Dr. Sean Maguire",
    email: "sean.maguire@belfasttrust.hscni.net",
    specialty: "Cardiology",
    hospital: "Belfast City Hospital, 51 Lisburn Road, Belfast BT9 7AB",
    jurisdiction: "NI",
  },
];

export function getDemoClinician(requesterId: string) {
  return DEMO_CLINICIANS.find(
    (persona) =>
      persona.id === requesterId || persona.requesterId === requesterId,
  );
}

export function getDemoPatient(patientId: string) {
  return DEMO_PATIENTS.find((patient) => patient.patientId === patientId);
}
