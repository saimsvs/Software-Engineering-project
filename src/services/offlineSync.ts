import { apiFetch } from "@/utils/api";
import { dequeue, getQueue, updateOperation } from "@/utils/offlineQueue";
import NetInfo from "@react-native-community/netinfo";

// Only server rejections (4xx/5xx) count against this. Network failures are
// retried forever, so a flaky connection can never silently abandon an entry.
const MAX_RETRIES = 5;

export type SyncResult = {
  synced: number;
  failed: number;
  remaining: number;
};

type SyncListener = (result: SyncResult) => void;

const listeners = new Set<SyncListener>();

/** Subscribe to sync completions (used to refresh the history list). */
export function onSync(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(result: SyncResult): void {
  listeners.forEach((listener) => {
    try {
      listener(result);
    } catch (error) {
      console.error("Error in sync listener:", error);
    }
  });
}

export async function syncQueue(): Promise<SyncResult> {
  try {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected || netState.isInternetReachable === false) {
      return { synced: 0, failed: 0, remaining: (await getQueue()).length };
    }

    const queue = await getQueue();
    const pendingOps = queue.filter(
      (op) => op.status === "pending" || op.status === "failed"
    );

    if (pendingOps.length === 0) {
      return { synced: 0, failed: 0, remaining: 0 };
    }

    let synced = 0;
    let failed = 0;

    for (const op of pendingOps) {
      // Skip if the server kept rejecting it
      if (op.retryCount >= MAX_RETRIES) {
        failed++;
        continue;
      }

      try {
        await updateOperation(op.id, {
          status: "syncing",
          lastAttemptAt: Date.now(),
        });

        const res = await apiFetch(op.endpoint, {
          method: op.method,
          headers: {
            "Idempotency-Key": op.id,
          },
          body: op.payload ? JSON.stringify(op.payload) : undefined,
        });

        if (res.ok) {
          // Successfully synced, remove from queue
          await dequeue(op.id);
          synced++;
        } else if (res.status === 401) {
          // Auth expired, stop syncing and mark as failed
          await updateOperation(op.id, {
            status: "failed",
            retryCount: op.retryCount + 1,
            lastError: "Authentication expired. Please log in again.",
          });
          failed++;
          break; // Stop processing queue if auth failed
        } else {
          // Other error, increment retry count
          const data = await res.json().catch(() => ({}));
          await updateOperation(op.id, {
            status: "failed",
            retryCount: op.retryCount + 1,
            lastError: data.message || `HTTP ${res.status}`,
          });
          failed++;
        }
      } catch (error) {
        // Network error — leave the retry count alone so this keeps trying
        // on every reconnect instead of being dropped after 5 attempts.
        await updateOperation(op.id, {
          status: "failed",
          lastError: error instanceof Error ? error.message : "Network error",
        });
        failed++;
        // Stop on network error
        break;
      }
    }

    const remaining = (await getQueue()).filter(
      (op) => op.status === "pending" || op.status === "failed"
    ).length;

    const result = { synced, failed, remaining };
    if (synced > 0) emit(result);
    return result;
  } catch (error) {
    console.error("Error syncing queue:", error);
    return { synced: 0, failed: 0, remaining: (await getQueue()).length };
  }
}

let syncInProgress = false;

export async function syncQueueIfNeeded(): Promise<void> {
  if (syncInProgress) return;
  syncInProgress = true;
  try {
    await syncQueue();
  } finally {
    syncInProgress = false;
  }
}

export function setupAutoSync(): () => void {
  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      syncQueueIfNeeded();
    }
  });
  return unsubscribe;
}
