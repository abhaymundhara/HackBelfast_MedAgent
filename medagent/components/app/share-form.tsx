"use client";

import { useState } from "react";

const FIELD_OPTIONS = [
  { value: "allergies", label: "Allergies" },
  { value: "medications", label: "Medications" },
  { value: "conditions", label: "Conditions" },
  { value: "alerts", label: "Alerts" },
  { value: "emergencyContact", label: "Emergency Contact" },
  { value: "recentDischarge", label: "Recent Discharge" },
] as const;

const TTL_OPTIONS = [
  { value: 1, label: "1 hour" },
  { value: 6, label: "6 hours" },
  { value: 24, label: "24 hours" },
  { value: 72, label: "3 days" },
  { value: 168, label: "7 days" },
];

export function ShareForm() {
  const [doctorName, setDoctorName] = useState("");
  const [doctorEmail, setDoctorEmail] = useState("");
  const [fields, setFields] = useState<string[]>(["allergies", "medications"]);
  const [ttlHours, setTtlHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    shareUrl: string;
    shareId: string;
    chainRef: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleField(field: string) {
    setFields((prev) =>
      prev.includes(field)
        ? prev.filter((f) => f !== field)
        : [...prev, field],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/share/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorName,
          doctorEmail,
          fieldsToShare: fields,
          ttlHours,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create share");
        return;
      }

      setResult(data);
    } catch {
      setError("Failed to create share link");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    const fullUrl = `${window.location.origin}${result.shareUrl}`;
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            Share link created successfully!
          </p>
          <p className="mt-1 text-xs text-green-600">
            Send this link to {doctorName}. They can view your selected records
            without needing an account.
          </p>
        </div>

        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="mb-1 text-xs font-medium text-slate-500">Share Link</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-white px-2 py-1.5 text-xs">
              {fullUrl}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(fullUrl)}
              className="shrink-0 rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              Copy
            </button>
          </div>
        </div>

        <button
          onClick={() => {
            setResult(null);
            setDoctorName("");
            setDoctorEmail("");
          }}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Create another share
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Doctor&apos;s name
          </label>
          <input
            type="text"
            required
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
            placeholder="Dr. Sarah Smith"
            className="w-full rounded-md border px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Doctor&apos;s email
          </label>
          <input
            type="email"
            required
            value={doctorEmail}
            onChange={(e) => setDoctorEmail(e.target.value)}
            placeholder="sarah@hospital.ie"
            className="w-full rounded-md border px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-600">
          Fields to share
        </label>
        <div className="flex flex-wrap gap-2">
          {FIELD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleField(opt.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                fields.includes(opt.value)
                  ? "bg-blue-100 text-blue-700"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {fields.includes(opt.value) ? "✓ " : ""}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Expires in
        </label>
        <select
          value={ttlHours}
          onChange={(e) => setTtlHours(Number(e.target.value))}
          className="rounded-md border px-3 py-1.5 text-sm"
        >
          {TTL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || fields.length === 0}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Creating..." : "Share Records"}
      </button>
    </form>
  );
}
