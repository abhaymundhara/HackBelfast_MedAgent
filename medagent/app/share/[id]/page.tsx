"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type ShareData = {
  patientName: string;
  fields: Record<string, unknown>;
  shareScope: string;
  doctorName: string;
  expiresAt: string;
  solscanUrl: string | null;
  shareChainRef: string | null;
  appointment: {
    id: string;
    clinic: string;
    startsAt: string;
  } | null;
  documents: Array<{
    id: string;
    title: string;
    mimeType: string;
    byteHash: string;
    downloadUrl: string;
  }>;
};

function listValue(value: unknown) {
  if (!Array.isArray(value)) return null;
  return value
    .map((item) => {
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return String(record.label ?? record.name ?? record.substance ?? JSON.stringify(record));
      }
      return String(item);
    })
    .join(", ");
}

export default function SharedRecordPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token") ?? "";
  }, []);

  useEffect(() => {
    if (!token) {
      setError("This share link is missing its access token.");
      setLoading(false);
      return;
    }
    fetch(`/api/share/${id}/access`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message ?? payload.error ?? "Unable to open share");
        }
        setData(payload);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to open share"))
      .finally(() => setLoading(false));
  }, [id, token]);

  if (loading) {
    return (
      <main className="min-h-screen px-6 py-12">
        <div className="mx-auto max-w-3xl text-sm text-slate-500">Opening secure record...</div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen px-6 py-12">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-semibold text-red-900">Record unavailable</h1>
          <p className="mt-2 text-sm text-red-700">{error ?? "This share cannot be opened."}</p>
        </div>
      </main>
    );
  }

  const fields = data.fields;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-xl border bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
            Full medical record share
          </p>
          <h1 className="mt-2 text-2xl font-semibold">{data.patientName}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Shared with {data.doctorName}. Live access expires{" "}
            {new Date(data.expiresAt).toLocaleString()}.
          </p>
          {data.appointment ? (
            <p className="mt-2 text-sm text-slate-600">
              Appointment: {new Date(data.appointment.startsAt).toLocaleString()} at{" "}
              {data.appointment.clinic}
            </p>
          ) : null}
          {data.solscanUrl ? (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2">
              <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-green-800">Verified on Solana</span>
              <a
                href={data.solscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-600 underline hover:text-green-700"
              >
                View proof on Solscan
              </a>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-400">Audit logged locally</p>
          )}
        </header>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Clinical Summary
          </h2>
          <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
            {["allergies", "medications", "conditions", "alerts"].map((key) => (
              <div key={key} className="rounded-lg border p-4">
                <p className="font-medium capitalize">{key}</p>
                <p className="mt-1 text-slate-600">{listValue(fields[key]) || "None recorded"}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Uploaded Documents
          </h2>
          {data.documents.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No approved uploaded documents.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {data.documents.map((document) => (
                <a
                  key={document.id}
                  href={document.downloadUrl}
                  className="block rounded-lg border p-4 text-sm hover:bg-slate-50"
                >
                  <span className="font-medium">{document.title}</span>
                  <span className="ml-2 text-slate-500">{document.mimeType}</span>
                  <span className="mt-1 block break-all font-mono text-xs text-slate-400">
                    {document.byteHash}
                  </span>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

