import { StyleSheet, Text, View, Image } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function RevisaoScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>();

  return (
    <View style={styles.container}>
      {uri && <Image source={{ uri }} style={styles.image} />}
      <Text style={styles.text}>Tela de Revisão (Fase 4)</Text>
      <Text style={styles.subtext}>URI: {uri}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
  },
  image: {
    width: "100%",
    height: 300,
    marginBottom: 20,
    borderRadius: 8,
  },
  text: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 10,
  },
  subtext: {
    fontSize: 16,
    color: "#666",
  },
});