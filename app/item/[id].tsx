import { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import {
  obterItemPorId,
  atualizarItemInventario,
  obterAnalise,
  excluirItemInventario,
  ItemInventario,
} from "../../src/db/queries";
import {
  syncItemPeloId,
  obterAnaliseRemota,
  excluirItemEmTodoLugar,
} from "../../src/services/sync";
import { Card, Screen, PrimaryButton } from "../../src/components";
import { useTheme, FONT, FONT_SIZES, spacing, radius } from "../../src/theme";

export default function ItemScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ItemInventario | null>(null);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [tags, setTags] = useState("");
  const [descricao, setDescricao] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imagemSize, setImagemSize] = useState<{ width: number; height: number } | null>(null);
  const { width: screenWidth } = useWindowDimensions();

  const carregar = useCallback(() => {
    const dados = obterItemPorId(id);
    if (!dados) {
      setLoading(false);
      return;
    }
    setItem(dados);
    setNome(dados.nome);
    setCategoria(dados.categoria);
    setTags(dados.tags_json ? JSON.parse(dados.tags_json).join(", ") : "");
    setDescricao(dados.descricao ?? "");
    setQuantidade(String(dados.quantidade));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!item?.imagem_uri) return;
    setImagemSize(null);
    Image.getSize(
      item.imagem_uri,
      (w, h) => {
        if (w > 0 && h > 0) {
          const maxW = screenWidth - spacing.lg * 2;
          const maxH = 400;
          const scale = Math.min(maxW / w, maxH / h);
          setImagemSize({ width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) });
        }
      },
      () => {}
    );
  }, [item?.imagem_uri, screenWidth]);

  const handleSalvar = () => {
    if (!categoria.trim()) {
      Alert.alert("Categoria obrigatória", "Por favor, defina uma categoria para o item.");
      return;
    }
    const qtd = parseInt(quantidade, 10);
    const qtdFinal = isNaN(qtd) || qtd < 1 ? 1 : qtd;

    setSaving(true);
    try {
      atualizarItemInventario(id, {
        nome: nome.trim() || "Sem nome",
        categoria: categoria.trim(),
        tags_json: tags.trim() ? JSON.stringify(tags.split(",").map((t) => t.trim())) : undefined,
        descricao: descricao.trim() || undefined,
        quantidade: qtdFinal,
      });
      syncItemPeloId(id);
      setQuantidade(String(qtdFinal));
      setItem(obterItemPorId(id));
      Alert.alert("Item atualizado", "As alterações foram salvas no inventário.");
    } catch (error: any) {
      console.error("[Item] Erro ao salvar:", error);
      Alert.alert("Erro", "Não foi possível salvar o item.");
    } finally {
      setSaving(false);
    }
  };

  const handleVerAnalise = async () => {
    if (!item?.analise_origem_id) {
      Alert.alert("Análise", "Este item não possui análise vinculada.");
      return;
    }

    const local = obterAnalise(item.analise_origem_id);
    if (local) {
      router.push({
        pathname: "/revisao",
        params: { uri: item.imagem_uri ?? "", analysisId: item.analise_origem_id },
      } as any);
      return;
    }

    try {
      const remota = await obterAnaliseRemota(item.analise_origem_id);
      if (remota) {
        router.push({ pathname: "/revisao", params: { remota: JSON.stringify(remota) } } as any);
      } else {
        Alert.alert(
          "Análise não encontrada",
          "Não foi possível encontrar a análise na nuvem (offline ou registro inexistente)."
        );
      }
    } catch (error: any) {
      Alert.alert("Erro", error.message);
    }
  };

  const handleExcluir = () => {
    Alert.alert(
      "Excluir item",
      "Como deseja excluir?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apenas localmente",
          onPress: async () => {
            setDeleting(true);
            try {
              await excluirItemInventario(id);
              router.back();
            } catch (error: any) {
              Alert.alert("Erro", error.message);
            } finally {
              setDeleting(false);
            }
          },
        },
        {
          text: "Em todos os lugares",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              const sucesso = await excluirItemEmTodoLugar(id);
              if (!sucesso) {
                Alert.alert("Erro", "Não foi possível excluir o item em todos os lugares");
                return;
              }
              router.back();
            } catch (error: any) {
              Alert.alert("Erro", error.message);
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const formatarData = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const synced = item?.sincronizado === 1;

  if (loading) {
    return (
      <Screen style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Carregando item...</Text>
      </Screen>
    );
  }

  if (!item) {
    return (
      <Screen style={styles.loadingContainer}>
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Item não encontrado.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.imageWrap}>
          {item.imagem_uri ? (
            imagemSize ? (
              <Image
                source={{ uri: item.imagem_uri }}
                style={[styles.image, { width: imagemSize.width, height: imagemSize.height, borderRadius: radius.md }]}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.imageLoading, { backgroundColor: colors.surfaceMuted, borderRadius: radius.xl }]} />
            )
          ) : (
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.imagePlaceholder, { borderRadius: radius.xl }]}
            >
              <Text style={styles.imagePlaceholderText}>{item.nome.charAt(0).toUpperCase()}</Text>
            </LinearGradient>
          )}
        </View>

        <View style={styles.chipsRow}>
          <View style={[styles.chip, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name="phone-portrait" size={13} color={colors.primary} />
            <Text style={[styles.chipText, { color: colors.primary }]}>Local</Text>
          </View>
          {item.categoria ? (
            <View style={[styles.chip, { backgroundColor: colors.infoSoft }]}>
              <Ionicons name="pricetag" size={13} color={colors.info} />
              <Text style={[styles.chipText, { color: colors.info }]} numberOfLines={1}>{item.categoria}</Text>
            </View>
          ) : null}
          <View style={[styles.chip, { backgroundColor: synced ? colors.successSoft : colors.warningSoft }]}>
            <Ionicons
              name={synced ? "cloud-done-outline" : "cloud-upload-outline"}
              size={13}
              color={synced ? colors.success : colors.warning}
            />
            <Text style={[styles.chipText, { color: synced ? colors.success : colors.warning }]}>
              {synced ? "Sincronizado" : "Não sincronizado"}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textMuted }]}>NOME</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
            value={nome}
            onChangeText={setNome}
            placeholder="Ex: Cadeira, Furadeira, Notebook"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textMuted }]}>CATEGORIA <Text style={[styles.required, { color: colors.danger }]}>*</Text></Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
            value={categoria}
            onChangeText={setCategoria}
            placeholder="Ex: Móveis, Ferramentas, Eletrônicos"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textMuted }]}>TAGS</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
            value={tags}
            onChangeText={setTags}
            placeholder="Ex: furniture, wood, chair"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textMuted }]}>DESCRIÇÃO (OPCIONAL)</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
            value={descricao}
            onChangeText={setDescricao}
            placeholder="Detalhes, número de série, observações..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textMuted }]}>QUANTIDADE</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
            value={quantidade}
            onChangeText={setQuantidade}
            keyboardType="numeric"
            placeholder="1"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <PrimaryButton
          title={saving ? "Salvando..." : "Salvar alterações"}
          icon="checkmark"
          onPress={handleSalvar}
          disabled={saving}
          style={styles.saveBtn}
        />

        {item.analise_origem_id && (
          <Card
            style={styles.analysisCard}
            contentStyle={styles.analysisCardContent}
            onPress={handleVerAnalise}
          >
            <View style={[styles.analysisIcon, { backgroundColor: colors.surfaceMuted, borderRadius: radius.md }]}>
              <Ionicons name="document-text-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.analysisTextWrap}>
              <Text style={[styles.analysisTitle, { color: colors.textPrimary }]}>Análise de origem</Text>
              <Text style={[styles.analysisSubtitle, { color: colors.textSecondary }]}>Ver objeto detectado e rótulos da análise original</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Card>
        )}

        <TouchableOpacity
          style={[styles.deleteButton, { borderColor: colors.danger }]}
          onPress={handleExcluir}
          disabled={deleting}
          activeOpacity={0.8}
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={[styles.deleteButtonText, { color: colors.danger }]}>
            {deleting ? "Excluindo..." : "Excluir item"}
          </Text>
        </TouchableOpacity>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <View style={styles.footerRow}>
            <Text style={[styles.footerLabel, { color: colors.textMuted }]}>Criado em</Text>
            <Text style={[styles.footerValue, { color: colors.textSecondary }]}>{formatarData(item.criado_em)}</Text>
          </View>
          <View style={styles.footerRow}>
            <Text style={[styles.footerLabel, { color: colors.textMuted }]}>Atualizado em</Text>
            <Text style={[styles.footerValue, { color: colors.textSecondary }]}>{formatarData(item.atualizado_em)}</Text>
          </View>
          <View style={styles.footerRow}>
            <Text style={[styles.footerLabel, { color: colors.textMuted }]}>Status</Text>
            <Text style={[styles.footerValue, { color: synced ? colors.success : colors.warning }]}>
              {synced ? "Sincronizado" : "Não sincronizado"}
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontFamily: FONT.medium,
    fontSize: FONT_SIZES.body,
    marginTop: spacing.md,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  imageWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    minHeight: 120,
  },
  image: {
    backgroundColor: "transparent",
  },
  imageLoading: {
    width: "100%",
    aspectRatio: 2,
  },
  imagePlaceholder: {
    width: "100%",
    aspectRatio: 16 / 10,
    alignItems: "center",
    justifyContent: "center",
  },
  imagePlaceholderText: {
    fontFamily: FONT.extrabold,
    fontSize: 64,
    color: "#FFFFFF",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    maxWidth: "70%",
  },
  chipText: {
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.caption,
    flexShrink: 1,
  },
  section: {
    marginBottom: spacing.lg,
  },
  label: {
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.caption,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
    paddingHorizontal: 2,
  },
  required: {
    fontFamily: FONT.bold,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: FONT.regular,
    fontSize: FONT_SIZES.body,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  saveBtn: {
    marginTop: spacing.sm,
  },
  analysisCard: {
    marginTop: spacing.md,
  },
  analysisCardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
  },
  analysisIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  analysisTextWrap: {
    flex: 1,
    marginHorizontal: spacing.md,
  },
  analysisTitle: {
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.body,
  },
  analysisSubtitle: {
    fontFamily: FONT.regular,
    fontSize: FONT_SIZES.caption,
    marginTop: 1,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.lg,
  },
  deleteButtonText: {
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.body,
  },
  footer: {
    marginTop: spacing.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerLabel: {
    fontFamily: FONT.medium,
    fontSize: FONT_SIZES.caption,
  },
  footerValue: {
    fontFamily: FONT.regular,
    fontSize: FONT_SIZES.body,
  },
});