import { config } from "dotenv";

import { getDb } from "./lib/db";

const db = getDb();
console.log(db.prepare("SELECT id, status FROM appointment_slots LIMIT 2").all());
