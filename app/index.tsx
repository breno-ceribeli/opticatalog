import { useState, useCallback } from "react";
import { StyleSheet, Text, View, TouchableOpacity, FlatList, Alert } from "react-native";
import { useFocusEffect, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { listarItensInventario, ItemInventario } from "../src/db/queries";

export default function HomeScreen() {
  const [itensRecentes, setItensRecentes] = useState<ItemInventario[]>([]);

  useFocusEffect(
    useCallback(() => {
      const itens = listarItensInventario().slice(0, 5);
      setItensRecentes(itens);
    }, [])
  );

  const processAndNavigate = async (sourceUri: string) => {
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

    const fileInfo = await FileSystem.getInfoAsync(destUri);
    if (!fileInfo.exists) {
      throw new Error("Falha ao mover arquivo para diretório permanente");
    }

    router.push({ pathname: "/preview", params: { uri: destUri } } as any);
  };

  const handleTirarFoto = () => {
    router.push({ pathname: "/camera" } as any);
  };

  const handleEscolherGaleria = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets[0]) {
        await processAndNavigate(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Erro ao selecionar imagem:", error);
      Alert.alert("Erro", "Não foi possível selecionar a imagem");
    }
  };

  const handleItemPress = (item: ItemInventario) => {
    router.push({
      pathname: "/revisao",
      params: { uri: item.imagem_uri ?? "", analysisId: item.analise_origem_id },
    } as any);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.appName}>Opticatalog</Text>
        <Text style={styles.tagline}>Inventário Visual</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionCard} onPress={handleTirarFoto} activeOpacity={0.7}>
          <Text style={styles.actionIcon}>📷</Text>
          <Text style={styles.actionTitle}>Tirar foto</Text>
          <Text style={styles.actionSubtitle}>Capturar com a câmera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={handleEscolherGaleria} activeOpacity={0.7}>
          <Text style={styles.actionIcon}>🖼️</Text>
          <Text style={styles.actionTitle}>Galeria</Text>
          <Text style={styles.actionSubtitle}>Escolher existente</Text>
        </TouchableOpacity>
      </View>

      {itensRecentes.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Itens recentes</Text>
          <FlatList
            data={itensRecentes}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.recentItem} onPress={() => handleItemPress(item)} activeOpacity={0.7}>
                <View style={styles.recentItemIcon}>
                  <Text style={styles.recentItemLetter}>{item.nome.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.recentItemInfo}>
                  <Text style={styles.recentItemName}>{item.nome}</Text>
                  <Text style={styles.recentItemCategory}>{item.categoria}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <TouchableOpacity style={styles.viewAllButton} onPress={() => router.push("/historico")} activeOpacity={0.7}>
        <Text style={styles.viewAllText}>Ver inventário completo</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 20,
  },
  header: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 32,
  },
  appName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2196f3",
  },
  tagline: {
    fontSize: 16,
    color: "#666",
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 32,
  },
  actionCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  actionSubtitle: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  recentSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  recentItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e3f2fd",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  recentItemLetter: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2196f3",
  },
  recentItemInfo: {
    flex: 1,
  },
  recentItemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  recentItemCategory: {
    fontSize: 13,
    color: "#999",
    marginTop: 2,
  },
  viewAllButton: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  viewAllText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2196f3",
  },
});
