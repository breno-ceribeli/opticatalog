import { useEffect, useState } from "react";
import { StyleSheet, View, Image, TouchableOpacity, Text, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";

export default function PreviewScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const [savedUri, setSavedUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (uri) {
      savePhotoLocally(uri);
    }
  }, [uri]);

  const savePhotoLocally = async (sourceUri: string) => {
    setSaving(true);
    try {
      const dir = `${FileSystem.documentDirectory}fotos/`;
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }

      const filename = `foto_${Date.now()}.jpg`;
      const destUri = `${dir}${filename}`;

      const manipulated = await ImageManipulator.manipulateAsync(
        sourceUri,
        [{ resize: { width: 1280 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: false }
      );

      await FileSystem.moveAsync({
        from: manipulated.uri,
        to: destUri,
      });

      setSavedUri(destUri);
    } catch (error) {
      console.error("Erro ao salvar foto:", error);
      Alert.alert("Erro", "Não foi possível salvar a foto");
    } finally {
      setSaving(false);
    }
  };

  const handleUsarFoto = () => {
    if (savedUri) {
      router.push({ pathname: "/revisao", params: { uri: savedUri } } as any);
    }
  };

  const handleTirarDeNovo = () => {
    router.back();
  };

  if (!uri || saving) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Processando imagem...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image source={{ uri }} style={styles.image} />
      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={handleTirarDeNovo} activeOpacity={0.7}>
          <Text style={styles.buttonTextSecondary}>Tirar de novo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={handleUsarFoto} activeOpacity={0.7}>
          <Text style={styles.buttonTextPrimary}>Usar esta foto</Text>
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