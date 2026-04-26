"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";

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

  return (
    <div className="landing-root">
      <SiteNav />
      <main className="auth-page">
        <div className="auth-shell auth-shell-wide">
          <div className="auth-head">
            <span className="eyebrow">Patient portal</span>
            <h1>Create your account</h1>
            <p>So you can view your medical access history and consent rules.</p>
          </div>

          <form className="auth-card" onSubmit={handleSubmit}>
            <div className="auth-row auth-row-2">
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="auth-label">Full name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className="auth-input"
                />
              </div>
              <div>
                <label className="auth-label">Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className="auth-input"
                />
              </div>
              <div>
                <label className="auth-label">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className="auth-input"
                />
              </div>
              <div>
                <label className="auth-label">Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  className="auth-input"
                />
              </div>
              <div>
                <label className="auth-label">Date of birth *</label>
                <input
                  type="date"
                  required
                  value={form.dob}
                  onChange={(e) => updateField("dob", e.target.value)}
                  className="auth-input"
                />
              </div>
              <div>
                <label className="auth-label">Sex</label>
                <select
                  value={form.sex}
                  onChange={(e) => updateField("sex", e.target.value)}
                  className="auth-select"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="auth-label">Blood type</label>
                <input
                  type="text"
                  placeholder="e.g. O−"
                  value={form.bloodType}
                  onChange={(e) => updateField("bloodType", e.target.value)}
                  className="auth-input"
                />
              </div>
            </div>

            <hr className="auth-divider" />

            <div className="auth-row" style={{ gap: 14 }}>
              <h3 className="auth-section-title">Medical information</h3>
              <div>
                <label className="auth-label">Allergies (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Penicillin, Latex"
                  value={form.allergies}
                  onChange={(e) => updateField("allergies", e.target.value)}
                  className="auth-input"
                />
              </div>
              <div>
                <label className="auth-label">Medications (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Warfarin, Metformin"
                  value={form.medications}
                  onChange={(e) => updateField("medications", e.target.value)}
                  className="auth-input"
                />
              </div>
              <div>
                <label className="auth-label">Conditions (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Asthma, Type 2 Diabetes"
                  value={form.conditions}
                  onChange={(e) => updateField("conditions", e.target.value)}
                  className="auth-input"
                />
              </div>
            </div>

            <hr className="auth-divider" />

            <div className="auth-row" style={{ gap: 14 }}>
              <h3 className="auth-section-title">Emergency contact</h3>
              <div className="auth-row auth-row-3">
                <input
                  type="text"
                  placeholder="Name"
                  value={form.emergencyContactName}
                  onChange={(e) =>
                    updateField("emergencyContactName", e.target.value)
                  }
                  className="auth-input"
                />
                <input
                  type="text"
                  placeholder="Relation"
                  value={form.emergencyContactRelation}
                  onChange={(e) =>
                    updateField("emergencyContactRelation", e.target.value)
                  }
                  className="auth-input"
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  value={form.emergencyContactPhone}
                  onChange={(e) =>
                    updateField("emergencyContactPhone", e.target.value)
                  }
                  className="auth-input"
                />
              </div>
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-lg auth-btn"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>

            <div className="auth-bottom">
              Already have an account?{" "}
              <Link href="/patient/login" className="auth-link-blue">
                Log in
              </Link>
            </div>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
