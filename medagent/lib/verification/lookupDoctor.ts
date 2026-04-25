import { getDb } from "@/lib/db";

export interface DoctorRecord {
  regNumber: string;
  regBody: "IMC" | "GMC";
  name: string;
  email: string;
  specialty: string | null;
  hospital: string | null;
  jurisdiction: string;
  status: string;
}

type DoctorRow = {
  reg_number: string;
  reg_body: string;
  name: string;
  email: string;
  specialty: string | null;
  hospital: string | null;
  jurisdiction: string;
  status: string;
};

function normalizeLookup(value: string) {
  return value.trim().toLowerCase();
}

function mapDoctorRow(row: DoctorRow): DoctorRecord {
  return {
    regNumber: row.reg_number,
    regBody: row.reg_body as "IMC" | "GMC",
    name: row.name,
    email: row.email,
    specialty: row.specialty,
    hospital: row.hospital,
    jurisdiction: row.jurisdiction,
    status: row.status,
  };
}

export function lookupDoctor(regNumber: string): DoctorRecord | null {
  const query = normalizeLookup(regNumber);
  if (!query) return null;

  const db = getDb();
  const exact = db
    .prepare(
      "SELECT * FROM doctor_registry WHERE lower(reg_number) = ? AND status = 'active' LIMIT 1",
    )
    .get(query) as DoctorRow | undefined;

  if (exact) return mapDoctorRow(exact);

  const compactQuery = query.replace(/\s+/g, "");
  const partial = db
    .prepare(
      `SELECT * FROM doctor_registry
       WHERE status = 'active'
         AND (lower(reg_number) LIKE @like OR replace(lower(reg_number), ' ', '') LIKE @compactLike)
       ORDER BY length(reg_number) ASC
       LIMIT 1`,
    )
    .get({ like: `%${query}%`, compactLike: `%${compactQuery}%` }) as
    | DoctorRow
    | undefined;

  if (partial) return mapDoctorRow(partial);

  const terms = query.split(/\s+/).filter((term) => term.length >= 2);
  if (terms.length > 0) {
    const candidates = db
      .prepare("SELECT * FROM doctor_registry WHERE status = 'active'")
      .all() as DoctorRow[];
    const fuzzy = candidates.find((candidate) => {
      const name = candidate.name.toLowerCase();
      return terms.every((term) => name.includes(term));
    });
    if (fuzzy) return mapDoctorRow(fuzzy);
  }

  return null;
}
