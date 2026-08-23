import { useState, useEffect, useRef } from "react";
import { StyleSheet, View, Image, TouchableOpacity, Text, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { criarAnalise } from "../src/db/queries";

export default function PreviewScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const uriRef = useRef(uri);

  useEffect(() => {
    uriRef.current = uri;
  }, [uri]);

  useEffect(() => {
    return () => {
      if (!confirmed && uriRef.current) {
        FileSystem.deleteAsync(uriRef.current, { idempotent: true })
          .catch((e) => console.warn("Cleanup temp photo failed:", e));
      }
    };
  }, [confirmed]);

  const handleUsarFoto = async () => {
    if (!uri) return;
    setSaving(true);
    setConfirmed(true);
    try {
      const dir = `${FileSystem.documentDirectory}fotos/`;
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }

      const filename = `foto_${Date.now()}.jpg`;
      const destUri = `${dir}${filename}`;

      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: false }
      );

      await FileSystem.moveAsync({
        from: manipulated.uri,
        to: destUri,
      });

      const id = criarAnalise({ imagem_uri: destUri, status: "pendente" });
      router.push({ pathname: "/revisao", params: { uri: destUri, analysisId: id } } as any);
    } catch (error) {
      console.error("Erro ao salvar foto:", error);
      Alert.alert("Erro", "Não foi possível salvar a foto");
      setConfirmed(false);
    } finally {
      setSaving(false);
    }
  };

  const handleTirarDeNovo = async () => {
    if (uri) {
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch (error) {
        console.warn("Erro ao limpar foto temporária:", error);
      }
    }
    router.back();
  };

  if (!uri) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image source={{ uri }} style={styles.image} />
      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={handleTirarDeNovo} activeOpacity={0.7} disabled={saving}>
          <Text style={styles.buttonTextSecondary}>Tirar de novo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={handleUsarFoto} activeOpacity={0.7} disabled={saving}>
          <Text style={styles.buttonTextPrimary}>{saving ? "Salvando..." : "Usar esta foto"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  image: {
    flex: 1,
    width: "100%",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 30,
    paddingHorizontal: 20,
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 8,
    minWidth: 140,
  },
  buttonPrimary: {
    backgroundColor: "#fff",
  },
  buttonSecondary: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "#fff",
  },
  buttonTextPrimary: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonTextSecondary: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingText: {
    color: "#fff",
    fontSize: 18,
    textAlign: "center",
  },
});