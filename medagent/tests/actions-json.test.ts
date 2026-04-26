import { describe, expect, it } from "vitest";

import { GET } from "@/app/actions.json/route";

describe("Solana Actions discovery", () => {
  it("does not advertise audit or share URLs as Blinks", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.rules).toEqual([]);
  });
});
