import type { QueueStatus } from "@prisma/client";

export interface QueueNotification {
  tokenId: string;
  tokenNumber: string;
  status: QueueStatus;
  occurredAt: string;
}

export interface QueueNotificationProvider {
  publish(notification: QueueNotification): Promise<void>;
}

/**
 * Polling clients read the persisted queue state, so the in-app provider does
 * not need an out-of-process delivery channel. This seam can later be replaced
 * by an SMS, WebSocket, or push provider without changing queue transitions.
 */
export class InAppQueueNotificationProvider implements QueueNotificationProvider {
  async publish() {
    return Promise.resolve();
  }
}
