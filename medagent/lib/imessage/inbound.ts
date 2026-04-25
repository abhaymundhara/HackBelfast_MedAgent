"use strict";

import { z } from "zod";

export interface InboundMessage {
  bridgeMessageGuid: string;
  chatGuid: string;
  handle: string;
  text: string;
  receivedAt: string;
}

const BlueBubblesWebhookSchema = z.object({
  type: z.string(),
  data: z.object({
    guid: z.string(),
    text: z.string(),
    handle: z.object({
      address: z.string(),
    }),
    chats: z.array(
      z.object({
        guid: z.string(),
      }),
    ).min(1),
    isFromMe: z.boolean(),
    dateCreated: z.number(),
  }),
});

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function parseInbound(rawPayload: unknown): InboundMessage | null {
  const result = BlueBubblesWebhookSchema.safeParse(rawPayload);
  if (!result.success) {
    return null;
  }

  const { data: payload } = result;

  if (payload.type !== "new-message") {
    return null;
  }

  if (payload.data.isFromMe) {
    return null;
  }

  if (!payload.data.text.trim()) {
    return null;
  }

  const age = Date.now() - payload.data.dateCreated;
  if (age > FIVE_MINUTES_MS) {
    return null;
  }

  return {
    bridgeMessageGuid: payload.data.guid,
    chatGuid: payload.data.chats[0].guid,
    handle: payload.data.handle.address,
    text: payload.data.text,
    receivedAt: new Date(payload.data.dateCreated).toISOString(),
  };
}
