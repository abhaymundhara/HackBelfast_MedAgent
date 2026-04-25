import { describe, expect, it } from "vitest";

import { buildEmergencySummaryFromReport } from "@/lib/imessage/medicalReportPdf";

describe("medical report PDF extraction", () => {
  it("parses wrapped OCR text with realistic section headers", () => {
    const reportText = [
      "Patient Name: Sameer Gul",
      "DOB: 1988-11-23",
      "Blood type: O-",
      "",
      "Known Allergies & Adverse Reactions",
      "• LIFE-THREATENING: Penicillin - Anaphylaxis",
      "History: Documented anaphylactic episode in 2018 following o",
      "ral amoxicillin. Patient carries EpiPen.",
      "",
      "Current Medications",
      "1. Warfarin 5 mg Once daily - CRITICAL - Anticoagulant for atrial fibrillation",
      "2. Salbutamol inhaler 100 mcg As needed - Reliever inhaler for mild intermittent asthma",
      "3. Omeprazole 20 mg Once daily - Gastric protection while on anticoagulant therapy",
      "",
      "Active Conditions",
      "1. Atrial fibrillation (Major) - Diagnosed Nov 2025, on anticoagulation",
      "2. Asthma (Minor) - Mild intermittent",
      "",
      "Emergency contact: J. Bennett (Brother) +44 7700 900 111",
    ].join("\n");

    const summary = buildEmergencySummaryFromReport({
      patientId: "sameer-gul-19881123",
      fullName: "Sameer Gul",
      dob: "1988-11-23",
      reportText,
    });

    expect(summary.demographics.bloodType).toBe("O-");
    expect(summary.allergies.map((a) => a.substance)).toEqual([
      "LIFE-THREATENING: Penicillin - Anaphylaxis",
    ]);

    expect(summary.medications).toHaveLength(3);
    expect(summary.medications[0]?.name).toMatch(/^Warfarin\b/i);
    expect(summary.medications[1]?.name).toMatch(/^Salbutamol inhaler\b/i);
    expect(summary.medications[2]?.name).toMatch(/^Omeprazole\b/i);

    expect(summary.conditions.map((c) => c.label)).toEqual([
      "Atrial fibrillation",
      "Asthma",
    ]);

    expect(summary.emergencyContact).toEqual({
      name: "J. Bennett",
      relation: "Brother",
      phone: "+44 7700 900 111",
    });

    expect(summary.alerts).toContain("anticoagulants");
  });
});
