"use strict";

export interface HandleMapping {
  handle: string;
  identityId: string;
  identityKind: "clinician" | "patient";
  label: string;
}

const DEMO_HANDLES: HandleMapping[] = [
  { handle: "+353871000001", identityId: "dr-murphy", identityKind: "clinician", label: "Dr. Aoife Murphy (HSE)" },
  { handle: "+447700900201", identityId: "dr-okonkwo", identityKind: "clinician", label: "Dr. Chidi Okonkwo (NHS NI)" },
  { handle: "+353861000099", identityId: "unknown-emergency", identityKind: "clinician", label: "Unknown Emergency Clinician" },
  { handle: "+447700900401", identityId: "sarah-bennett", identityKind: "patient", label: "Sarah Bennett (Belfast)" },
  { handle: "+447700900402", identityId: "omar-haddad", identityKind: "patient", label: "Omar Haddad" },
  { handle: "+447700900403", identityId: "lucia-martin", identityKind: "patient", label: "Lucia Martin" },
];

export function resolveHandle(handle: string): HandleMapping | null {
  return DEMO_HANDLES.find((m) => m.handle === handle) ?? null;
}

export function listHandleMappings(): HandleMapping[] {
  return DEMO_HANDLES;
}
