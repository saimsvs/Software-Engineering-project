export type PendingOperationType = "create" | "update" | "delete";

export interface PendingActivityPayload {
  activityId: string;
  category: string;
  distance: number;
  unit: string;
  note?: string;
}

export interface PendingOperation {
  id: string; // Temporary UUID for local tracking
  type: PendingOperationType;
  endpoint: string;
  method: "POST" | "PATCH" | "DELETE";
  payload?: PendingActivityPayload;
  serverId?: string;
  createdAt: number;
  retryCount: number;
  lastAttemptAt?: number;
  lastError?: string;
  status: "pending" | "syncing" | "failed";
}
