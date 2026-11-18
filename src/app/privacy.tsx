import { ScreenHeader } from "@/components/screen-header";
import { apiFetch } from "@/utils/api";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PrivacyScreen() {
  const [location, setLocation] = useState(false);
  const [trends, setTrends] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    apiFetch("/api/features/privacy").then(async response => {
      if (!response.ok) throw new Error("Unable to load privacy settings");
      const data = await response.json();
      setLocation(data.settings.locationSharingEnabled);
      setTrends(data.settings.showTrendsPublic);
    }).catch(() => Alert.alert("Connection error", "Unable to load settings. Nothing has been changed."))
      .finally(() => setLoading(false));
  }, []);
  async function save(nextLocation: boolean, nextTrends: boolean) {
    if (saving) return;
    setSaving(true);
    try {
      const response = await apiFetch("/api/features/privacy", {
        method: "PUT", body: JSON.stringify({ locationSharingEnabled: nextLocation, showTrendsPublic: nextTrends }),
      });
      if (!response.ok) throw new Error("Could not save settings");
      const data = await response.json();
      setLocation(data.settings.locationSharingEnabled);
      setTrends(data.settings.showTrendsPublic);
    } catch {
      Alert.alert("Not saved", "Check your connection and try again.");
    } finally { setSaving(false); }
  }
  return <SafeAreaView style={s.safe} edges={["bottom"]}>
    <ScreenHeader title="Privacy" />
    {loading ? <ActivityIndicator color="#2E7D32" /> : <ScrollView contentContainerStyle={s.content}>
      <Text style={s.title}>Your privacy, your choice</Text>
      <Text style={s.sub}>Both options are off by default. You can change them whenever you like.</Text>
      <View style={s.card}><View style={s.text}><Text style={s.label}>📍  Share location data</Text><Text style={s.hint}>Allow future opted-in location contributions to area-level carbon statistics. Your exact location is never displayed publicly.</Text></View><Switch value={location} disabled={saving} onValueChange={v => save(v, trends)} trackColor={{true: "#9CCC9F"}} thumbColor={location ? "#2E7D32" : "#F4F4F4"} /></View>
      <View style={s.card}><View style={s.text}><Text style={s.label}>📊  Show emission trends</Text><Text style={s.hint}>Show your estimated-emission trends on your public profile. When off, only you can see your trends.</Text></View><Switch value={trends} disabled={saving} onValueChange={v => save(location, v)} trackColor={{true: "#9CCC9F"}} thumbColor={trends ? "#2E7D32" : "#F4F4F4"} /></View>
      <Text style={s.note}>Goals and challenges have their own per-item visibility controls. Turning off location sharing prevents new location contributions; it does not delete previous contributions.</Text>
      {saving && <ActivityIndicator color="#2E7D32" />}
    </ScrollView>}
  </SafeAreaView>;
}
const s = StyleSheet.create({ safe: { flex:1, backgroundColor:"#FFF" }, content:{padding:20,gap:16}, title:{fontSize:22,fontWeight:"700",color:"#1A1A1A"}, sub:{fontSize:14,color:"#666",lineHeight:21},card:{borderWidth:1,borderColor:"#E0E0E0",borderRadius:12,padding:16,flexDirection:"row",alignItems:"center",gap:10},text:{flex:1},label:{fontSize:15,fontWeight:"600",color:"#1A1A1A"},hint:{fontSize:13,color:"#666",lineHeight:20,marginTop:8}, note:{fontSize:12,color:"#777",lineHeight:18,marginTop:8} });
