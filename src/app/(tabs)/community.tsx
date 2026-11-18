import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/utils/api";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const GREEN = "#2E7D32";
const DARK = "#1A1A1A";
const LIGHT_GREEN = "#E8F5E9";
const BORDER = "#E0E0E0";
const GRAY = "#666";

type Relationship = "none" | "connected" | "request_sent" | "request_received";

type Person = {
  id: string;
  name: string;
  relationship: Relationship;
  connectionId?: string;
};

type ConnectionItem = {
  id: string;
  connectedAt: string | null;
  user: { id: string; name: string };
};

type RequestItem = {
  id: string;
  createdAt: string;
  user: { id: string; name: string };
};

function initials(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export default function CommunityScreen() {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  // Connections + incoming requests
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [connectionsRes, requestsRes] = await Promise.all([
          apiFetch("/api/connections"),
          apiFetch("/api/connections/requests"),
        ]);
        if (cancelled) return;

        if (connectionsRes.ok) {
          const data = await connectionsRes.json();
          if (!cancelled && Array.isArray(data.connections)) {
            setConnections(data.connections);
          }
        }
        if (requestsRes.ok) {
          const data = await requestsRes.json();
          if (!cancelled && Array.isArray(data.requests)) {
            setRequests(data.requests);
          }
        }
      } catch {
        // keep whatever we already have
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [version]);

  // Discover (empty query) or search, debounced while typing
  useEffect(() => {
    let cancelled = false;
    const term = query.trim();

    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/users?q=${encodeURIComponent(term)}`);
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.users)) setPeople(data.users);
      } catch {
        // keep previous results
      }
    }, term ? 300 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, version]);

  const run = async (
    id: string,
    action: () => Promise<Response>,
    failTitle: string
  ) => {
    setBusyId(id);
    try {
      const res = await action();
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        Alert.alert(failTitle, data.message ?? "Something went wrong");
      }
      refresh();
    } catch {
      Alert.alert("Error", "Cannot connect to server");
    } finally {
      setBusyId(null);
    }
  };

  const connect = (person: Person) =>
    run(
      person.id,
      () =>
        apiFetch("/api/connections", {
          method: "POST",
          body: JSON.stringify({ userId: person.id }),
        }),
      "Could not send request"
    );

  const respond = (connectionId: string, action: "accept" | "reject") =>
    run(
      connectionId,
      () =>
        apiFetch(`/api/connections/${connectionId}/${action}`, {
          method: "POST",
        }),
      action === "accept" ? "Could not accept" : "Could not reject"
    );

  const remove = (item: ConnectionItem) =>
    Alert.alert(
      "Remove connection?",
      `You will no longer be connected with ${item.user.name}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            run(
              item.id,
              () =>
                apiFetch(`/api/connections/${item.id}`, { method: "DELETE" }),
              "Could not remove connection"
            ),
        },
      ]
    );

  const renderPersonAction = (person: Person) => {
    if (person.relationship === "connected") {
      return (
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>Connected</Text>
        </View>
      );
    }
    if (person.relationship === "request_sent") {
      return (
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>Requested</Text>
        </View>
      );
    }
    if (person.relationship === "request_received" && person.connectionId) {
      return (
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => respond(person.connectionId!, "accept")}
          disabled={busyId === person.connectionId}
        >
          <Text style={styles.primaryBtnText}>Accept</Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={() => connect(person)}
        disabled={busyId === person.id}
      >
        <Text style={styles.primaryBtnText}>
          {busyId === person.id ? "..." : "Connect"}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              refresh();
            }}
            tintColor={GREEN}
          />
        }
      >
        <Text style={styles.title}>Community</Text>
        <Text style={styles.subtitle}>
          Find people who care about sustainability.
        </Text>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={GRAY} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or email"
            placeholderTextColor="#9E9E9E"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color="#BDBDBD" />
            </TouchableOpacity>
          )}
        </View>

        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator color={GREEN} />
          </View>
        )}

        {requests.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Requests ({requests.length})
            </Text>
            {requests.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(item.user.name)}</Text>
                </View>
                <View style={styles.personInfo}>
                  <Text style={styles.personName}>{item.user.name}</Text>
                  <Text style={styles.personMeta}>Wants to connect</Text>
                </View>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => respond(item.id, "accept")}
                  disabled={busyId === item.id}
                >
                  <Text style={styles.primaryBtnText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => respond(item.id, "reject")}
                  disabled={busyId === item.id}
                >
                  <Text style={styles.secondaryBtnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {connections.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              My Connections ({connections.length})
            </Text>
            {connections.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(item.user.name)}</Text>
                </View>
                <View style={styles.personInfo}>
                  <Text style={styles.personName}>{item.user.name}</Text>
                  <Text style={styles.personMeta}>Connected</Text>
                </View>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => remove(item)}
                  disabled={busyId === item.id}
                >
                  <Text style={styles.secondaryBtnText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>
          {query.trim() ? "Search Results" : "Discover People"}
        </Text>

        {people.length === 0 && !loading && (
          <Text style={styles.empty}>
            {query.trim()
              ? "No users match your search."
              : "No other users yet — check back once more people join."}
          </Text>
        )}

        {people.map((person) => (
          <View key={person.id} style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(person.name)}</Text>
            </View>
            <View style={styles.personInfo}>
              <Text style={styles.personName}>{person.name}</Text>
              <Text style={styles.personMeta}>
                {person.relationship === "connected"
                  ? "Connected"
                  : person.relationship === "request_sent"
                  ? "Request sent"
                  : person.relationship === "request_received"
                  ? "Sent you a request"
                  : "Not connected"}
              </Text>
            </View>
            {renderPersonAction(person)}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFF" },
  content: { paddingHorizontal: 20, paddingBottom: 110 },

  title: { fontSize: 28, fontWeight: "bold", color: DARK, marginTop: 8 },
  subtitle: { fontSize: 14, color: GRAY, marginTop: 4, marginBottom: 16 },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: DARK },

  loading: { paddingVertical: 20 },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: DARK,
    marginTop: 18,
    marginBottom: 10,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EFEFEF",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: LIGHT_GREEN,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "700", color: GREEN },
  personInfo: { flex: 1, marginLeft: 12 },
  personName: { fontSize: 15, fontWeight: "600", color: DARK },
  personMeta: { fontSize: 12, color: GRAY, marginTop: 2 },

  primaryBtn: {
    backgroundColor: GREEN,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: 8,
  },
  primaryBtnText: { color: "#FFF", fontSize: 13, fontWeight: "600" },

  secondaryBtn: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 8,
  },
  secondaryBtnText: { color: GRAY, fontSize: 13, fontWeight: "600" },

  statusPill: {
    backgroundColor: LIGHT_GREEN,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginLeft: 8,
  },
  statusPillText: { color: GREEN, fontSize: 12, fontWeight: "600" },

  empty: {
    fontSize: 14,
    color: GRAY,
    textAlign: "center",
    marginVertical: 16,
  },
});
