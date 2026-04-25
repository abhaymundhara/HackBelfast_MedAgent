"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type ShareData = {
  patientName: string;
  fields: Record<string, unknown>;
  fieldsShared: string[];
  sharedAt: string;
  expiresAt: string;
  doctorName: string;
  solscanUrl: string | null;
  shareChainRef: string | null;
};

type ShareError = {
  error: string;
  code?: string;
  revokeChainRef?: string | null;
};

type Allergy = { substance: string; severity: string; reaction?: string };
type Medication = { name: string; dose: string; frequency: string; critical?: boolean };
type Condition = { label: string; major?: boolean };

function AllergyList({ items }: { items: Allergy[] }) {
  if (!items?.length) return <p className="text-sm text-slate-500">None recorded</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((a, i) => (
        <li key={i} className="flex items-center gap-2 text-sm">
          <span className={`inline-block h-2 w-2 rounded-full ${
            a.severity === "severe" || a.severity === "life-threatening"
              ? "bg-red-500" : a.severity === "moderate" ? "bg-amber-500" : "bg-green-500"
          }`} />
          <span className="font-medium">{a.substance}</span>
          <span className="text-slate-500">— {a.severity}</span>
          {a.reaction && <span className="text-slate-400">({a.reaction})</span>}
        </li>
      ))}
    </ul>
  );
}

function MedicationList({ items }: { items: Medication[] }) {
  if (!items?.length) return <p className="text-sm text-slate-500">None recorded</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((m, i) => (
        <li key={i} className="text-sm">
          <span className="font-medium">{m.name}</span>
          {m.dose && <span className="text-slate-500"> {m.dose}</span>}
          {m.frequency && <span className="text-slate-500"> — {m.frequency}</span>}
          {m.critical && (
            <span className="ml-1.5 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
              Critical
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function ConditionList({ items }: { items: Condition[] }) {
  if (!items?.length) return <p className="text-sm text-slate-500">None recorded</p>;
  return (
    <ul className="space-y-1">
      {items.map((c, i) => (
        <li key={i} className="text-sm">
          <span className="font-medium">{c.label}</span>
          {c.major && (
            <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
              Major
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function FieldSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </h3>
      {children}
    </div>
  );
}

function renderField(key: string, value: unknown) {
  if (key === "allergies") return <AllergyList items={value as Allergy[]} />;
  if (key === "medications") return <MedicationList items={value as Medication[]} />;
  if (key === "conditions") return <ConditionList items={value as Condition[]} />;
  if (key === "alerts" && Array.isArray(value)) {
    return value.length > 0 ? (
      <div className="flex flex-wrap gap-1.5">
        {value.map((a: string) => (
          <span key={a} className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            {a}
          </span>
        ))}
      </div>
    ) : <p className="text-sm text-slate-500">None</p>;
  }
  if (key === "emergencyContact" && typeof value === "object" && value) {
    const c = value as { name: string; relation: string; phone: string };
    return (
      <p className="text-sm">
        {c.name} ({c.relation}) — {c.phone || "No phone"}
      </p>
    );
  }
  if (key === "recentDischarge" && typeof value === "string") {
    return <p className="text-sm">{value}</p>;
  }
  return <pre className="text-xs text-slate-600">{JSON.stringify(value, null, 2)}</pre>;
}

export default function SharedRecordPage() {
  const params = useParams();
  const shareId = params.id as string;

  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<ShareError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hash = window.location.hash;
    const tokenMatch = hash.match(/token=([a-f0-9]+)/);
    if (!tokenMatch) {
      setError({ error: "Invalid access link. No token found in URL." });
      setLoading(false);
      return;
    }

    const token = tokenMatch[1];

    fetch(`/api/share/${shareId}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setError(json as ShareError);
        } else {
          setData(json as ShareData);
        }
      })
      .catch(() => {
        setError({ error: "Failed to load shared record" });
      })
      .finally(() => setLoading(false));
  }, [shareId]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
          <p className="mt-3 text-sm text-slate-500">Loading shared record...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <span className="text-xl">!</span>
          </div>
          <h1 className="text-lg font-semibold text-slate-900">
            {error.code === "revoked"
              ? "Access Revoked"
              : error.code === "expired"
                ? "Link Expired"
                : error.code === "rate_limited"
                  ? "View Limit Reached"
                  : "Access Denied"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">{error.error}</p>
          {error.revokeChainRef && !error.revokeChainRef.startsWith("local-solana:") && (
            <a
              href={`https://solscan.io/tx/${error.revokeChainRef}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm text-blue-600 hover:text-blue-700"
            >
              View revocation on Solana
            </a>
          )}
        </div>
      </main>
    );
  }

  if (!data) return null;

  const remaining = new Date(data.expiresAt).getTime() - Date.now();
  const hours = Math.max(0, Math.floor(remaining / (1000 * 60 * 60)));
  const minutes = Math.max(0, Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60)));

  const fieldLabels: Record<string, string> = {
    allergies: "Allergies",
    medications: "Medications",
    conditions: "Conditions",
    alerts: "Alerts",
    emergencyContact: "Emergency Contact",
    recentDischarge: "Recent Discharge",
    documents: "Documents",
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                MedAgent — Shared Medical Record
              </p>
              <h1 className="mt-1 text-xl font-semibold text-slate-900">
                {data.patientName}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Shared on {new Date(data.sharedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="text-sm text-slate-500">
                Expires in {hours}h {minutes}m
              </p>
            </div>
            {data.solscanUrl ? (
              <a
                href={data.solscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Verified on Solana
              </a>
            ) : (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-600">
                Local audit
              </span>
            )}
          </div>
        </div>

        {data.fieldsShared.map((key) => {
          const value = data.fields[key as keyof typeof data.fields];
          if (value === undefined) return null;
          return (
            <FieldSection key={key} label={fieldLabels[key] ?? key}>
              {renderField(key, value)}
            </FieldSection>
          );
        })}

        <div className="rounded-xl border bg-slate-900 p-5 text-white">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Blockchain Verification
          </h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Share TX</span>
              {data.shareChainRef && !data.shareChainRef.startsWith("local-solana:") ? (
                <a
                  href={`https://solscan.io/tx/${data.shareChainRef}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-blue-400 hover:text-blue-300"
                >
                  {data.shareChainRef.slice(0, 8)}...{data.shareChainRef.slice(-8)}
                </a>
              ) : (
                <span className="font-mono text-slate-500">Local fallback</span>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Fields shared</span>
              <span>{data.fieldsShared.length} field(s)</span>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            This record was shared via MedAgent. Records are encrypted and only
            accessible via this unique link.
          </p>
        </div>
      </div>
    </main>
  );
}
