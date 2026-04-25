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
    requesterId:
      "did:solana:testnet:7YwL6mUFr9s6qQ2VwT4Qf3V3wq2f9m9p2B7qQn1vR8kH",
    requesterLabel: "Dr. Aoife Murphy",
    issuerId: "did:solana:testnet:9mDqM2kX4LJ9Gf1V7rQxS3yQ5bF2pN8tH6uP4kR1xCwZ",
    issuerLabel: "HSE Ireland (St. James's Hospital, Dublin)",
    locale: "en-IE",
    stronglyVerified: true,
  }),
  ClinicianPersonaSchema.parse({
    id: "dr-okonkwo",
    requesterId:
      "did:solana:testnet:6qWmZ8pR3HkN5fT2xV7cD1jL9sB4uY3nQ8rP2mK6tFvA",
    requesterLabel: "Dr. Chidi Okonkwo",
    issuerId: "did:solana:testnet:C3vK8pN2mQ7tR5xL1fH9wD4sY6uB2jP8qM5nT1rV4kZx",
    issuerLabel: "NHS Northern Ireland (Royal Victoria Hospital, Belfast)",
    locale: "en-GB",
    stronglyVerified: true,
  }),
  ClinicianPersonaSchema.parse({
    id: "unknown-emergency",
    requesterId:
      "did:solana:testnet:4xQmN7tV2kR9pH5fL1wD8sY3uB6jP2qM5nT4rC7vK1z",
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

export function getDemoClinician(requesterId: string) {
  return DEMO_CLINICIANS.find(
    (persona) =>
      persona.id === requesterId || persona.requesterId === requesterId,
  );
}

export function getDemoPatient(patientId: string) {
  return DEMO_PATIENTS.find((patient) => patient.patientId === patientId);
}
