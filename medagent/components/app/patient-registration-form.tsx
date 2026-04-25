"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type AllergyEntry = { substance: string; severity: string; reaction: string };
type MedicationEntry = { name: string; dose: string; frequency: string; critical: boolean };
type ConditionEntry = { label: string; major: boolean };

type FormState = {
  patientId: string;
  name: string;
  email: string;
  dob: string;
  sex: "male" | "female" | "other";
  bloodType: string;
  languages: string;
  homeCountry: string;
  allergies: AllergyEntry[];
  medications: MedicationEntry[];
  conditions: ConditionEntry[];
  alerts: string;
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  recentDischarge: string;
  emergencyAutoAccess: boolean;
  allowPatientApprovalRequests: boolean;
  breakGlassAllowed: boolean;
};

const defaultState: FormState = {
  patientId: "new-traveler",
  name: "New Traveler",
  email: "traveler@example.com",
  dob: "1993-01-15",
  sex: "female",
  bloodType: "A+",
  languages: "English,Spanish",
  homeCountry: "United Kingdom",
  allergies: [{ substance: "Penicillin", severity: "severe", reaction: "Rash" }],
  medications: [{ name: "Warfarin", dose: "5 mg", frequency: "Once nightly", critical: true }],
  conditions: [{ label: "Atrial fibrillation", major: true }],
  alerts: "anticoagulants",
  emergencyContactName: "Alex Traveler",
  emergencyContactRelation: "Sibling",
  emergencyContactPhone: "+44 7700 111 222",
  recentDischarge: "",
  emergencyAutoAccess: true,
  allowPatientApprovalRequests: true,
  breakGlassAllowed: true,
};

export function PatientRegistrationForm() {
  const [form, setForm] = useState<FormState>(defaultState);
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function updateAllergy(index: number, patch: Partial<AllergyEntry>) {
    setForm((s) => ({
      ...s,
      allergies: s.allergies.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    }));
  }
  function addAllergy() {
    setForm((s) => ({ ...s, allergies: [...s.allergies, { substance: "", severity: "mild", reaction: "" }] }));
  }
  function removeAllergy(index: number) {
    setForm((s) => ({ ...s, allergies: s.allergies.filter((_, i) => i !== index) }));
  }

  function updateMedication(index: number, patch: Partial<MedicationEntry>) {
    setForm((s) => ({
      ...s,
      medications: s.medications.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    }));
  }
  function addMedication() {
    setForm((s) => ({ ...s, medications: [...s.medications, { name: "", dose: "", frequency: "", critical: false }] }));
  }
  function removeMedication(index: number) {
    setForm((s) => ({ ...s, medications: s.medications.filter((_, i) => i !== index) }));
  }

  function updateCondition(index: number, patch: Partial<ConditionEntry>) {
    setForm((s) => ({
      ...s,
      conditions: s.conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  }
  function addCondition() {
    setForm((s) => ({ ...s, conditions: [...s.conditions, { label: "", major: false }] }));
  }
  function removeCondition(index: number) {
    setForm((s) => ({ ...s, conditions: s.conditions.filter((_, i) => i !== index) }));
  }

  async function handleSubmit() {
    setBusy(true);
    setMessage(null);

    const generatedId = form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || form.patientId;

    const summary = {
      patientId: generatedId,
      demographics: {
        name: form.name,
        dob: form.dob,
        sex: form.sex,
        bloodType: form.bloodType || undefined,
        languages: form.languages
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        homeCountry: form.homeCountry,
        email: form.email,
      },
      allergies: form.allergies.filter((a) => a.substance),
      medications: form.medications.filter((m) => m.name),
      conditions: form.conditions.filter((c) => c.label),
      alerts: form.alerts
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      emergencyContact: {
        name: form.emergencyContactName,
        relation: form.emergencyContactRelation,
        phone: form.emergencyContactPhone,
      },
      recentDischarge: form.recentDischarge || undefined,
      documents: files.map((file) => ({
        id: `${generatedId}-${file.name.replace(/[^a-zA-Z0-9]/g, "-")}`,
        title: file.name,
        patientApprovedForTier1Or2: true,
      })),
    };

    const policy = {
      emergencyAutoAccess: form.emergencyAutoAccess,
      allowPatientApprovalRequests: form.allowPatientApprovalRequests,
      breakGlassAllowed: form.breakGlassAllowed,
      shareableDocumentIds: files.map(
        (file) => `${generatedId}-${file.name.replace(/[^a-zA-Z0-9]/g, "-")}`,
      ),
    };

    const payload = new FormData();
    payload.append("patientId", generatedId);
    payload.append("localIdentity", `patient:${generatedId}`);
    payload.append("summary", JSON.stringify(summary));
    payload.append("policy", JSON.stringify(policy));
    files.forEach((file) => payload.append("documents", file));

    const response = await fetch("/api/patients", {
      method: "POST",
      body: payload,
    });
    const result = await response.json();
    setBusy(false);
    setMessage(
      response.ok
        ? `Profile created for ${form.name}. You can now view your dashboard.`
        : result.error ?? "Unable to create patient profile.",
    );
  }

  return (
    <div className="space-y-5">
      {/* Personal Information */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Personal information</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            value={form.name}
            onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))}
            placeholder="Full name"
          />
          <Input
            value={form.email}
            onChange={(event) => setForm((state) => ({ ...state, email: event.target.value }))}
            placeholder="Email"
          />
          <Input
            value={form.homeCountry}
            onChange={(event) =>
              setForm((state) => ({ ...state, homeCountry: event.target.value }))
            }
            placeholder="Home country"
          />
          <Input
            value={form.languages}
            onChange={(event) =>
              setForm((state) => ({ ...state, languages: event.target.value }))
            }
            placeholder="Languages (comma-separated)"
          />
          <Input
            value={form.bloodType}
            onChange={(event) =>
              setForm((state) => ({ ...state, bloodType: event.target.value }))
            }
            placeholder="Blood type"
          />
        </div>
      </div>

      {/* Allergies */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Allergies</p>
          <Button type="button" variant="outline" size="sm" onClick={addAllergy} className="border-primary text-primary hover:bg-primary/5">+ Add allergy</Button>
        </div>
        <div className="space-y-3">
          {form.allergies.map((allergy, i) => (
            <div key={i} className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto] items-center">
              <Input
                value={allergy.substance}
                onChange={(e) => updateAllergy(i, { substance: e.target.value })}
                placeholder="Substance (e.g. Penicillin)"
              />
              <select
                className="h-10 rounded-[10px] border-[1.5px] border-[#E2E8F0] bg-white px-3 text-sm transition-all focus:outline-none focus:ring-[3px] focus:ring-primary/12 focus:border-primary"
                value={allergy.severity}
                onChange={(e) => updateAllergy(i, { severity: e.target.value })}
              >
                <option value="mild">Mild</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
                <option value="life-threatening">Life-threatening</option>
              </select>
              <div className="flex items-center gap-2">
                <Input
                  value={allergy.reaction}
                  onChange={(e) => updateAllergy(i, { reaction: e.target.value })}
                  placeholder="Reaction (e.g. Rash)"
                />
                <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  allergy.severity === "severe" || allergy.severity === "life-threatening"
                    ? "bg-red-50 text-red-700"
                    : allergy.severity === "moderate"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-green-50 text-green-700"
                }`}>
                  {allergy.severity}
                </span>
              </div>
              <button type="button" onClick={() => removeAllergy(i)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500" title="Remove allergy">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Medications */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Medications</p>
          <Button type="button" variant="outline" size="sm" onClick={addMedication} className="border-primary text-primary hover:bg-primary/5">+ Add medication</Button>
        </div>
        <div className="space-y-3">
          {form.medications.map((med, i) => (
            <div key={i} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto_auto] items-center">
              <Input
                value={med.name}
                onChange={(e) => updateMedication(i, { name: e.target.value })}
                placeholder="Medication name"
              />
              <Input
                value={med.dose}
                onChange={(e) => updateMedication(i, { dose: e.target.value })}
                placeholder="Dose (e.g. 5 mg)"
              />
              <Input
                value={med.frequency}
                onChange={(e) => updateMedication(i, { frequency: e.target.value })}
                placeholder="Frequency"
              />
              <label className="flex items-center gap-2 text-sm h-10 whitespace-nowrap">
                <Switch
                  checked={med.critical}
                  onCheckedChange={(checked) => updateMedication(i, { critical: checked })}
                />
                {med.critical ? (
                  <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-[#F43F5E]">Critical</span>
                ) : (
                  <span className="text-muted-foreground">Critical</span>
                )}
              </label>
              <button type="button" onClick={() => removeMedication(i)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500" title="Remove medication">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Conditions */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Conditions</p>
          <Button type="button" variant="outline" size="sm" onClick={addCondition} className="border-primary text-primary hover:bg-primary/5">+ Add condition</Button>
        </div>
        <div className="space-y-3">
          {form.conditions.map((cond, i) => (
            <div key={i} className="grid gap-3 md:grid-cols-[1fr_auto_auto] items-center">
              <Input
                value={cond.label}
                onChange={(e) => updateCondition(i, { label: e.target.value })}
                placeholder="Condition (e.g. Atrial fibrillation)"
              />
              <label className="flex items-center gap-2 text-sm h-10 whitespace-nowrap">
                <Switch
                  checked={cond.major}
                  onCheckedChange={(checked) => updateCondition(i, { major: checked })}
                />
                Major condition
              </label>
              <button type="button" onClick={() => removeCondition(i)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500" title="Remove condition">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Alerts</p>
        <Input
          value={form.alerts}
          onChange={(event) => setForm((state) => ({ ...state, alerts: event.target.value }))}
          placeholder="e.g. anticoagulants, epilepsy, implanted-device"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">Comma-separated list of critical alerts</p>
      </div>

      {/* Recent discharge summary */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Recent discharge summary</p>
        <Textarea
          value={form.recentDischarge}
          onChange={(event) =>
            setForm((state) => ({ ...state, recentDischarge: event.target.value }))
          }
          rows={4}
          placeholder="Optional: paste a recent hospital discharge summary"
        />
      </div>

      {/* Emergency contact */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Emergency contact</p>
        <div className="grid gap-4 md:grid-cols-3">
          <Input
            value={form.emergencyContactName}
            onChange={(event) =>
              setForm((state) => ({ ...state, emergencyContactName: event.target.value }))
            }
            placeholder="Contact name"
          />
          <Input
            value={form.emergencyContactRelation}
            onChange={(event) =>
              setForm((state) => ({
                ...state,
                emergencyContactRelation: event.target.value,
              }))
            }
            placeholder="Relationship"
          />
          <Input
            value={form.emergencyContactPhone}
            onChange={(event) =>
              setForm((state) => ({ ...state, emergencyContactPhone: event.target.value }))
            }
            placeholder="Phone number"
          />
        </div>
      </div>

      {/* Access settings — vertical layout */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Access settings</p>
        <div className="divide-y divide-[#E2E8F0]">
          <label className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm font-medium text-foreground">Verified clinicians get immediate access</p>
              <p className="text-xs text-muted-foreground">Verified emergency doctors can view your records instantly</p>
            </div>
            <Switch
              checked={form.emergencyAutoAccess}
              onCheckedChange={(checked) =>
                setForm((state) => ({ ...state, emergencyAutoAccess: checked }))
              }
            />
          </label>
          <label className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm font-medium text-foreground">Allow approval requests from others</p>
              <p className="text-xs text-muted-foreground">Non-verified clinicians can request access that you approve</p>
            </div>
            <Switch
              checked={form.allowPatientApprovalRequests}
              onCheckedChange={(checked) =>
                setForm((state) => ({ ...state, allowPatientApprovalRequests: checked }))
              }
            />
          </label>
          <label className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm font-medium text-foreground">Emergency override when unconscious</p>
              <p className="text-xs text-muted-foreground">Allows break-glass access when you cannot give consent</p>
            </div>
            <Switch
              checked={form.breakGlassAllowed}
              onCheckedChange={(checked) =>
                setForm((state) => ({ ...state, breakGlassAllowed: checked }))
              }
            />
          </label>
        </div>
      </div>

      {/* Documents */}
      <details>
        <summary className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B] cursor-pointer hover:text-primary">
          Supporting documents (optional)
        </summary>
        <div className="mt-3 rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <Input
            type="file"
            multiple
            accept=".pdf,.txt,image/*"
            onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 3))}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">Upload up to 3 files (PDF, text, or images)</p>
        </div>
      </details>

      {/* CTA */}
      <Button disabled={busy} onClick={handleSubmit} className="w-full shadow-[0_4px_14px_rgba(13,115,119,0.3)] transition-all hover:shadow-[0_6px_20px_rgba(13,115,119,0.4)] hover:-translate-y-px">
        {busy ? "Creating profile..." : (
          <span className="flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Create encrypted emergency profile
          </span>
        )}
      </Button>
      {message ? (
        <div className={`rounded-2xl border p-4 text-sm ${
          message.startsWith("Profile created")
            ? "border-green-200 bg-green-50 text-green-800"
            : "border-red-200 bg-red-50 text-red-800"
        }`}>
          {message}
        </div>
      ) : null}
    </div>
  );
}
