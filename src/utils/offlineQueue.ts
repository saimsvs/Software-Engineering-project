import AsyncStorage from "@react-native-async-storage/async-storage";
import { PendingOperation } from "@/types/offline";

const QUEUE_KEY = "carbontrail_offline_queue";

export async function getQueue(): Promise<PendingOperation[]> {
  try {
    const data = await AsyncStorage.getItem(QUEUE_KEY);
    if (!data) return [];
    return JSON.parse(data) as PendingOperation[];
  } catch (error) {
    console.error("Error getting offline queue:", error);
    return [];
  }
}

export async function saveQueue(queue: PendingOperation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error("Error saving offline queue:", error);
  }
}

export async function enqueue(operation: PendingOperation): Promise<void> {
  const queue = await getQueue();
  queue.push(operation);
  await saveQueue(queue);
}

export async function dequeue(id: string): Promise<void> {
  const queue = await getQueue();
  const filtered = queue.filter((op) => op.id !== id);
  await saveQueue(filtered);
}

export async function updateOperation(
  id: string,
  updates: Partial<PendingOperation>
): Promise<void> {
  const queue = await getQueue();
  const updated = queue.map((op) =>
    op.id === id ? { ...op, ...updates } : op
  );
  await saveQueue(updated);
}

export async function clearQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(QUEUE_KEY);
  } catch (error) {
    console.error("Error clearing offline queue:", error);
  }
}

export async function getPendingCount(): Promise<number> {
  const queue = await getQueue();
  return queue.filter((op) => op.status === "pending" || op.status === "failed").length;
}
