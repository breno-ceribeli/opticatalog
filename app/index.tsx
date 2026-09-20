import { useState, useCallback } from "react";
import { StyleSheet, Text, View, Image, ScrollView, Alert } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { listarItensInventario, ItemInventario } from "../src/db/queries";
import { Screen, Card, PrimaryButton, IconPill } from "../src/components";
import { useTheme, FONT, FONT_SIZES, spacing } from "../src/theme";

export default function HomeScreen() {
  const { colors, radius } = useTheme();
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

    const filename = `foto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
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
    router.push({ pathname: "/item/[id]", params: { id: item.id } } as any);
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { borderRadius: radius.xl }]}
        >
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroTitle}>Opticatalog</Text>
              <Text style={styles.heroTagline}>Inventário Visual</Text>
            </View>
            <View style={styles.heroIconBadge}>
              <Ionicons name="cube" size={26} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.heroDescription}>
            Fotografe, catalogue e organize seus itens em um único lugar.
          </Text>
        </LinearGradient>

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Como quer começar?</Text>
        <View style={styles.actionsRow}>
          <Card onPress={handleTirarFoto} style={styles.actionCard}>
            <IconPill name="camera" />
            <Text style={[styles.actionTitle, { color: colors.textPrimary }]}>Capturar</Text>
            <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>Tirar foto agora</Text>
          </Card>
          <Card onPress={handleEscolherGaleria} style={styles.actionCard}>
            <IconPill name="images" />
            <Text style={[styles.actionTitle, { color: colors.textPrimary }]}>Galeria</Text>
            <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>Escolher existente</Text>
          </Card>
        </View>

        {itensRecentes.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Itens recentes</Text>
            <View style={styles.recentList}>
              {itensRecentes.map((item) => (
                <Card
                  key={item.id}
                  onPress={() => handleItemPress(item)}
                  style={styles.recentItem}
                  contentStyle={styles.recentItemContent}
                >
                  {item.imagem_uri ? (
                    <Image
                      source={{ uri: item.imagem_uri }}
                      style={[styles.recentThumb, { borderRadius: radius.md }]}
                    />
                  ) : (
                    <View
                      style={[
                        styles.recentMonogram,
                        { backgroundColor: colors.surfaceMuted, borderRadius: radius.md },
                      ]}
                    >
                      <Text style={[styles.recentMonogramText, { color: colors.primary }]}>
                        {item.nome.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.recentInfo}>
                    <Text
                      style={[styles.recentName, { color: colors.textPrimary }]}
                      numberOfLines={1}
                    >
                      {item.nome}
                    </Text>
                    <Text
                      style={[styles.recentCategory, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {item.categoria}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Card>
              ))}
            </View>
          </>
        )}

        {itensRecentes.length === 0 && (
          <Card style={styles.emptyCard}>
            <View style={styles.emptyIconWrapper}>
              <Ionicons name="cube-outline" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              Nenhum item ainda
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Comece adicionando seu primeiro item ao inventário.
            </Text>
          </Card>
        )}

        <PrimaryButton
          title="Ver inventário completo"
          icon="arrow-forward"
          onPress={() => router.push("/historico")}
          style={styles.cta}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.xxl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxxl + spacing.xxl,
  },
  hero: {
    padding: spacing.xxl,
    marginBottom: spacing.xxl,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontFamily: FONT.extrabold,
    fontSize: FONT_SIZES.hero,
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  heroTagline: {
    fontFamily: FONT.medium,
    fontSize: 15,
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },
  heroIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroDescription: {
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255,255,255,0.92)",
  },
  sectionTitle: {
    fontFamily: FONT.bold,
    fontSize: FONT_SIZES.heading,
    marginBottom: spacing.md,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  actionCard: {
    flex: 1,
  },
  actionTitle: {
    fontFamily: FONT.semibold,
    fontSize: 15,
    marginTop: spacing.md,
  },
  actionSubtitle: {
    fontFamily: FONT.regular,
    fontSize: 12,
    marginTop: 2,
  },
  recentList: {
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  recentItem: {
    padding: 12,
  },
  recentItemContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  recentThumb: {
    width: 64,
    height: 64,
  },
  recentMonogram: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  recentMonogramText: {
    fontFamily: FONT.bold,
    fontSize: 24,
  },
  recentInfo: {
    flex: 1,
    marginHorizontal: 14,
    justifyContent: "center",
  },
  recentName: {
    fontFamily: FONT.semibold,
    fontSize: 15,
  },
  recentCategory: {
    fontFamily: FONT.regular,
    fontSize: 13,
    marginTop: 2,
  },
  emptyCard: {
    alignItems: "center",
    padding: spacing.xxl,
    marginBottom: spacing.xxl,
  },
  emptyIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(37,99,235,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontFamily: FONT.semibold,
    fontSize: 16,
  },
  emptySubtitle: {
    fontFamily: FONT.regular,
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
  cta: {
    marginTop: 4,
  },
});