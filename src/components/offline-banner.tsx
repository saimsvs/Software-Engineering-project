import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { getPendingCount } from "@/utils/offlineQueue";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

export function OfflineBanner() {
  const { isOffline } = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const updateCount = async () => {
      const count = await getPendingCount();
      setPendingCount(count);
    };

    updateCount();
    const interval = setInterval(updateCount, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!isOffline && pendingCount === 0) {
    return null;
  }

  return (
    <View style={[styles.banner, isOffline ? styles.offline : styles.pending]}>
      <Text style={styles.text}>
        {isOffline
          ? `You're offline. ${
              pendingCount > 0
                ? `${pendingCount} activity${
                    pendingCount === 1 ? "" : "s"
                  } waiting to sync.`
                : "Activities will be saved locally."
            }`
          : `${pendingCount} activity${
              pendingCount === 1 ? "" : "s"
            } waiting to sync.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  offline: {
    backgroundColor: "#FF9800",
  },
  pending: {
    backgroundColor: "#2196F3",
  },
  text: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
});
