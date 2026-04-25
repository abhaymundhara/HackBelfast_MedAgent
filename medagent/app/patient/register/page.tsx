"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export default function PatientRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    dob: "",
    sex: "other",
    bloodType: "",
    homeCountry: "United Kingdom",
    homeJurisdiction: "NI",
    allergies: "",
    medications: "",
    conditions: "",
    emergencyContactName: "",
    emergencyContactRelation: "",
    emergencyContactPhone: "",
  });

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/patient/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          password: form.password,
          dob: form.dob,
          sex: form.sex,
          bloodType: form.bloodType || undefined,
          homeCountry: form.homeCountry,
          homeJurisdiction: form.homeJurisdiction,
          allergies: form.allergies
            ? form.allergies.split(",").map((s) => s.trim())
            : [],
          medications: form.medications
            ? form.medications.split(",").map((s) => s.trim())
            : [],
          conditions: form.conditions
            ? form.conditions.split(",").map((s) => s.trim())
            : [],
          emergencyContact: form.emergencyContactName
            ? {
                name: form.emergencyContactName,
                relation: form.emergencyContactRelation || "Unknown",
                phone: form.emergencyContactPhone || "",
              }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed.");
        return;
      }
      document.cookie = `patient_token=${data.jwt}; path=/; max-age=${24 * 60 * 60}; samesite=strict`;
      router.push("/patient/dashboard");
    } catch {
      setError("Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <main className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Patient Registration
          </h1>
          <p className="text-sm text-muted-foreground">
            Create your MedAgent account to view your medical access history
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="border rounded-xl p-6 space-y-4 bg-white shadow-sm"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password *
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => updateField("password", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Date of Birth *
              </label>
              <input
                type="date"
                required
                value={form.dob}
                onChange={(e) => updateField("dob", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Sex
              </label>
              <select
                value={form.sex}
                onChange={(e) => updateField("sex", e.target.value)}
                className={inputClass}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Blood Type
              </label>
              <input
                type="text"
                placeholder="e.g. O-"
                value={form.bloodType}
                onChange={(e) => updateField("bloodType", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <hr className="border-slate-100" />

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-900">
              Medical Information
            </h3>
            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Allergies (comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g. Penicillin, Latex"
                value={form.allergies}
                onChange={(e) => updateField("allergies", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Medications (comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g. Warfarin, Metformin"
                value={form.medications}
                onChange={(e) => updateField("medications", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Conditions (comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g. Asthma, Type 2 Diabetes"
                value={form.conditions}
                onChange={(e) => updateField("conditions", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <hr className="border-slate-100" />

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-900">
              Emergency Contact
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Name"
                value={form.emergencyContactName}
                onChange={(e) =>
                  updateField("emergencyContactName", e.target.value)
                }
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Relation"
                value={form.emergencyContactRelation}
                onChange={(e) =>
                  updateField("emergencyContactRelation", e.target.value)
                }
                className={inputClass}
              />
              <input
                type="tel"
                placeholder="Phone"
                value={form.emergencyContactPhone}
                onChange={(e) =>
                  updateField("emergencyContactPhone", e.target.value)
                }
                className={inputClass}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating account..." : "Create account"}
          </Button>

          <p className="text-center text-sm text-slate-500">
            Already have an account?{" "}
            <a href="/patient/login" className="text-blue-600 hover:underline">
              Log in
            </a>
          </p>
        </form>
      </div>
    </main>
  );
}
