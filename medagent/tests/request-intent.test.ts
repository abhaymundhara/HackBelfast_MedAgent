import { describe, expect, it } from "vitest";

import { analyzeRequestIntent } from "@/lib/agent/tools/analyzeRequestIntent";

describe("request intent analysis", () => {
  it("highlights requested authorized fields without widening access", () => {
    const intent = analyzeRequestIntent({
      naturalLanguageRequest:
        "Patient collapsed. Need allergy, medication, and discharge context for emergency care.",
      fieldsAllowed: [
        "allergies",
        "medications",
        "conditions",
        "alerts",
        "emergencyContact",
        "documents",
      ],
    });

    expect(intent.matchedAuthorizedFields).toEqual(["allergies", "medications"]);
    expect(intent.withheldRequestedFields).toEqual(["recentDischarge"]);
    expect(intent.priorityTopics).toContain("allergy safety");
    expect(intent.priorityTopics).toContain("medication safety");
  });

  it("changes emphasis between different clinician requests while staying within the same tier", () => {
    const medicationIntent = analyzeRequestIntent({
      naturalLanguageRequest: "Need medication and allergy context immediately.",
      fieldsAllowed: ["allergies", "medications", "conditions", "alerts", "emergencyContact"],
    });
    const contactIntent = analyzeRequestIntent({
      naturalLanguageRequest: "Please contact family and share emergency contact details.",
      fieldsAllowed: ["allergies", "medications", "conditions", "alerts", "emergencyContact"],
    });

    expect(medicationIntent.matchedAuthorizedFields).not.toEqual(
      contactIntent.matchedAuthorizedFields,
    );
    expect(contactIntent.matchedAuthorizedFields).toContain("emergencyContact");
    expect(medicationIntent.withheldRequestedFields).toEqual([]);
    expect(contactIntent.withheldRequestedFields).toEqual([]);
  });
});
