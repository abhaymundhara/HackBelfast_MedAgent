import { getDb } from "@/lib/db";

type CountRow = { count: number };
type OnboardedUserRow = {
  handle: string;
  patient_id: string | null;
};
type AppointmentSlotRow = { slot_id: string };

export type ClearOnboardedResult = {
  mode: "dry-run" | "delete";
  before: number;
  onboardedDeleted: number;
  conversationsDeleted: number;
  appointmentsFreed: number;
  after: number;
};

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function placeholders(values: unknown[]) {
  return values.map(() => "?").join(",");
}

export function countOnboardedImessageUsers(): number {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT COUNT(*) AS count FROM imessage_users WHERE stage = 'onboarded'",
    )
    .get() as CountRow;
  return row.count;
}

function listOnboardedUsers() {
  return getDb()
    .prepare(
      "SELECT handle, patient_id FROM imessage_users WHERE stage = 'onboarded'",
    )
    .all() as OnboardedUserRow[];
}

function countConversationsForHandles(handles: string[]) {
  if (handles.length === 0) return 0;
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS count FROM imessage_conversations WHERE handle IN (${placeholders(handles)})`,
    )
    .get(...handles) as CountRow;
  return row.count;
}

function listAppointmentSlotIdsForPatients(patientIds: string[]) {
  if (patientIds.length === 0) return [];
  const rows = getDb()
    .prepare(
      `SELECT slot_id FROM appointments WHERE patient_id IN (${placeholders(patientIds)})`,
    )
    .all(...patientIds) as AppointmentSlotRow[];
  return unique(rows.map((row) => row.slot_id));
}

function countBookedSlots(slotIds: string[]) {
  if (slotIds.length === 0) return 0;
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS count FROM appointment_slots WHERE status = 'booked' AND id IN (${placeholders(slotIds)})`,
    )
    .get(...slotIds) as CountRow;
  return row.count;
}

export function clearOnboardedImessageState(input: { dryRun?: boolean } = {}) {
  const db = getDb();
  const users = listOnboardedUsers();
  const handles = unique(users.map((user) => user.handle));
  const patientIds = unique(
    users.flatMap((user) => (user.patient_id ? [user.patient_id] : [])),
  );
  const slotIds = listAppointmentSlotIdsForPatients(patientIds);
  const before = users.length;
  const conversationsToDelete = countConversationsForHandles(handles);
  const appointmentsToFree = countBookedSlots(slotIds);

  if (input.dryRun) {
    return {
      mode: "dry-run",
      before,
      onboardedDeleted: 0,
      conversationsDeleted: conversationsToDelete,
      appointmentsFreed: appointmentsToFree,
      after: before,
    } satisfies ClearOnboardedResult;
  }

  const result = db.transaction(() => {
    const onboardedDeleted = db
      .prepare("DELETE FROM imessage_users WHERE stage = 'onboarded'")
      .run().changes;

    let conversationsDeleted = 0;
    if (handles.length > 0) {
      conversationsDeleted = db
        .prepare(
          `DELETE FROM imessage_conversations WHERE handle IN (${placeholders(handles)})`,
        )
        .run(...handles).changes;
    }

    let appointmentsFreed = 0;
    if (slotIds.length > 0) {
      appointmentsFreed = db
        .prepare(
          `UPDATE appointment_slots
           SET status = 'available', updated_at = ?
           WHERE status = 'booked' AND id IN (${placeholders(slotIds)})`,
        )
        .run(new Date().toISOString(), ...slotIds).changes;
    }

    if (patientIds.length > 0) {
      db.prepare(
        `DELETE FROM appointments WHERE patient_id IN (${placeholders(patientIds)})`,
      ).run(...patientIds);
      db.prepare(
        `DELETE FROM patients WHERE id IN (${placeholders(patientIds)})`,
      ).run(...patientIds);
    }

    return {
      mode: "delete",
      before,
      onboardedDeleted,
      conversationsDeleted,
      appointmentsFreed,
      after: countOnboardedImessageUsers(),
    } satisfies ClearOnboardedResult;
  })();

  return result;
}
