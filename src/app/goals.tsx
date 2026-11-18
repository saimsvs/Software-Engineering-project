import { ScreenHeader } from "@/components/screen-header";
import { apiFetch } from "@/utils/api";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Goal = { id: string; name: string; targetValue: number; targetUnit: string; deadline: string; isPublic: boolean };
const units = ["kg CO₂e", "activities", "days"] as const;
export default function GoalsScreen() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState<(typeof units)[number]>("kg CO₂e");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const response = await apiFetch("/api/features/goals");
      if (!response.ok) throw new Error();
      setGoals((await response.json()).goals);
    } catch { Alert.alert("Connection error", "Could not load your goals."); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  async function create() {
    const amount = Number(target);
    if (!name.trim() || !(amount > 0) || !Number.isFinite(amount) || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
      Alert.alert("Check your goal", "Enter a name, positive target and deadline in YYYY-MM-DD format."); return;
    }
    setSaving(true);
    try {
      const response = await apiFetch("/api/features/goals", { method:"POST",body:JSON.stringify({ name:name.trim(),targetValue:amount,targetUnit:unit,deadline }) });
      if (!response.ok) { const data=await response.json(); throw new Error(data.message || "Could not create goal"); }
      setName(""); setTarget(""); setDeadline(""); await refresh();
      Alert.alert("Goal created", "Your new goal is private and saved to your goal list.");
    } catch (error) { Alert.alert("Unable to save", error instanceof Error ? error.message : "Try again."); }
    finally { setSaving(false); }
  }
  return <SafeAreaView style={s.safe} edges={["bottom"]}><ScreenHeader title="My Goals" />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <Text style={s.heading}>Create a sustainability goal</Text><Text style={s.help}>Make a measurable commitment. New goals are private by default.</Text>
      <Text style={s.label}>Goal name</Text><TextInput style={s.field} placeholder="e.g. Reduce my weekly emissions" value={name} onChangeText={setName} maxLength={120} />
      <Text style={s.label}>Target</Text><TextInput style={s.field} placeholder="e.g. 20" value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
      <View style={s.units}>{units.map(u=><TouchableOpacity key={u} style={[s.choice,unit===u&&s.selected]} onPress={()=>setUnit(u)}><Text style={[s.choiceText,unit===u&&s.selectedText]}>{u}</Text></TouchableOpacity>)}</View>
      <Text style={s.label}>Deadline</Text><TextInput style={s.field} placeholder="YYYY-MM-DD" value={deadline} onChangeText={setDeadline} maxLength={10} autoCapitalize="none" /><Text style={s.private}>🔒 Only you can view this goal</Text>
      <TouchableOpacity style={[s.button,saving&&{opacity:.5}]} disabled={saving} onPress={create}><Text style={s.buttonText}>{saving?"Saving…":"Create Goal"}</Text></TouchableOpacity>
      <Text style={s.heading}>Your goals</Text>{loading?<ActivityIndicator color="#2E7D32" />: goals.length===0?<Text style={s.help}>No goals yet. Create your first one above.</Text>:goals.map(g=><View key={g.id} style={s.goal}><Text style={s.goalName}>{g.name}</Text><Text style={s.help}>Target: {g.targetValue} {g.targetUnit}</Text><Text style={s.help}>Deadline: {g.deadline.slice(0,10)} · {g.isPublic?"Public":"Private"}</Text></View>)}
    </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#FFF"},content:{padding:20,paddingBottom:40,gap:12},heading:{fontWeight:"700",fontSize:20,color:"#1A1A1A",marginTop:10},help:{fontSize:13,color:"#666",lineHeight:20},label:{fontSize:14,fontWeight:"600",color:"#333",marginTop:8},field:{borderColor:"#E0E0E0",borderWidth:1,borderRadius:10,height:50,paddingHorizontal:14,fontSize:15,color:"#1A1A1A"},units:{flexDirection:"row",gap:8,flexWrap:"wrap"},choice:{paddingHorizontal:12,paddingVertical:9,borderRadius:20,backgroundColor:"#F2F2F2"},selected:{backgroundColor:"#E8F5E9",borderWidth:1,borderColor:"#2E7D32"},choiceText:{color:"#555",fontSize:12},selectedText:{color:"#2E7D32",fontWeight:"700"},private:{color:"#2E7D32",fontSize:12,marginTop:6},button:{height:50,backgroundColor:"#2E7D32",borderRadius:10,justifyContent:"center",alignItems:"center"},buttonText:{color:"#FFF",fontSize:16,fontWeight:"700"},goal:{borderWidth:1,borderColor:"#E0E0E0",borderRadius:12,padding:16,gap:6},goalName:{fontSize:16,fontWeight:"700",color:"#1A1A1A"}});
