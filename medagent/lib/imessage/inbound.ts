"use strict";

import { z } from "zod";

export interface InboundMessage {
  bridgeMessageGuid: string;
  chatGuid: string;
  handle: string;
  text: string;
  attachments: InboundAttachment[];
  receivedAt: string;
}

export interface InboundAttachment {
  guid?: string;
  filename?: string;
  path?: string;
  mimeType?: string;
  uti?: string;
  transferName?: string;
  totalBytes?: number;
}

const BridgeAttachmentSchema = z.object({
  guid: z.string().optional(),
  filename: z.string().optional(),
  path: z.string().optional(),
  mimeType: z.string().optional(),
  uti: z.string().optional(),
  transferName: z.string().optional(),
  totalBytes: z.number().optional(),
});

const BridgeWebhookSchema = z.object({
  type: z.string(),
  data: z.object({
    guid: z.string(),
    text: z.string().default(""),
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
    attachments: z.array(BridgeAttachmentSchema).optional(),
  }),
});

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function parseInbound(rawPayload: unknown): InboundMessage | null {
  const result = BridgeWebhookSchema.safeParse(rawPayload);
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

  const attachments = payload.data.attachments ?? [];
  if (!payload.data.text.trim() && attachments.length === 0) {
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
    attachments,
    receivedAt: new Date(payload.data.dateCreated).toISOString(),
  };
}
