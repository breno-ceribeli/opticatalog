import { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
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
  obterAnalise,
  atualizarAnalise,
  criarItemInventario,
  obterItemPorAnalise,
  atualizarItemInventario,
  Analise,
  ItemInventario,
} from "../src/db/queries";
import { analisarImagem, lerTextoOcr } from "../src/services/visionApi";
import NetInfo from "@react-native-community/netinfo";
import { syncAnalisePeloId, syncItemPeloId, AnaliseRemota } from "../src/services/sync";
import { Card, Screen, PrimaryButton, GhostButton } from "../src/components";
import { useTheme, FONT, FONT_SIZES, spacing, radius } from "../src/theme";

export default function RevisaoScreen() {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const { uri, analysisId, remota } = useLocalSearchParams<{ uri: string; analysisId: string; remota?: string }>();
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [analiseRemota, setAnaliseRemota] = useState<AnaliseRemota | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [readingText, setReadingText] = useState(false);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [tags, setTags] = useState("");
  const [descricao, setDescricao] = useState("");
  const [itemExistente, setItemExistente] = useState<ItemInventario | null>(null);
  const [imagemSize, setImagemSize] = useState<{ width: number; height: number } | null>(null);

  const imagemUri = uri || analiseRemota?.imagem_url || null;

  const modo: "criar" | "item" | "remota" = analiseRemota
    ? "remota"
    : itemExistente
      ? "item"
      : "criar";

  useEffect(() => {
    if (!imagemUri) return;
    setImagemSize(null);
    Image.getSize(
      imagemUri,
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
  }, [imagemUri, screenWidth]);

  const carregarAnalise = useCallback(() => {
    if (remota) {
      try {
        const dados = JSON.parse(remota) as AnaliseRemota;
        setAnaliseRemota(dados);
        setItemExistente(obterItemPorAnalise(dados.id));
      } catch {}
      setLoading(false);
      return;
    }

    if (!analysisId) {
      setLoading(false);
      return;
    }

    const dados = obterAnalise(analysisId);
    setAnalise(dados);

    const item = obterItemPorAnalise(analysisId);
    setItemExistente(item);

    if (item) {
      setNome(item.nome);
      setCategoria(item.categoria);
      setTags(item.tags_json ? JSON.parse(item.tags_json).join(", ") : "");
      setDescricao(item.descricao ?? item.identificador_ocr ?? "");
    } else if (dados) {
      setNome(dados.objeto_detectado ?? "");
      setTags(dados.labels_json ? JSON.parse(dados.labels_json).map((l: any) => l.name).join(", ") : "");
      setDescricao(dados.texto_ocr ?? "");
    }
    setLoading(false);
  }, [analysisId, remota]);

  useEffect(() => {
    carregarAnalise();
  }, [carregarAnalise]);

  const handleReanalisar = async () => {
    if (!analise || !uri) return;
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected || !netInfo.isInternetReachable) {
      Alert.alert("Sem internet", "Conecte-se à internet para reanalisar a imagem.");
      return;
    }
    setAnalyzing(true);
    try {
      const result = await analisarImagem(uri, analysisId);
      atualizarAnalise(analysisId, {
        objeto_detectado: result.objetoPrincipal,
        labels_json: JSON.stringify(result.labels),
        status: "processado",
      });
      syncAnalisePeloId(analysisId);
      setNome(result.objetoPrincipal);
      setTags(result.labels.map((l) => l.name).join(", "));
      setAnalise({ ...analise!, objeto_detectado: result.objetoPrincipal, labels_json: JSON.stringify(result.labels), status: "processado" });
    } catch (error: any) {
      console.error("[Revisao] Reanalisar error:", error);
      atualizarAnalise(analysisId, { status: "erro" });
      setAnalise({ ...analise!, status: "erro" });
      Alert.alert("Erro na análise", error.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleLerTexto = async () => {
    if (!analise || !uri) return;
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected || !netInfo.isInternetReachable) {
      Alert.alert("Sem internet", "Conecte-se à internet para ler texto da imagem.");
      return;
    }
    setReadingText(true);
    try {
      const texto = await lerTextoOcr(uri, analysisId);
      if (texto) {
        setDescricao(texto);
        atualizarAnalise(analysisId, { texto_ocr: texto });
        syncAnalisePeloId(analysisId);
        Alert.alert("Texto extraído", "O texto foi preenchido no campo Descrição. Você pode editá-lo antes de salvar.");
      } else {
        Alert.alert("Nenhum texto encontrado", "A IA não detectou nenhum texto na imagem.");
      }
    } catch (error: any) {
      console.error("[Revisao] OCR error:", error);
      Alert.alert("Erro na leitura", error.message);
    } finally {
      setReadingText(false);
    }
  };

  const handleSalvar = () => {
    if (!categoria.trim()) {
      Alert.alert("Categoria obrigatória", "Por favor, defina uma categoria para o item.");
      return;
    }
    try {
      const dadosItem = {
        nome: nome.trim() || "Sem nome",
        categoria: categoria.trim(),
        tags_json: tags.trim() ? JSON.stringify(tags.split(",").map((t) => t.trim())) : undefined,
        descricao: descricao.trim() || undefined,
      };

      if (itemExistente) {
        atualizarItemInventario(itemExistente.id, dadosItem);
        syncItemPeloId(itemExistente.id);
        Alert.alert("Item atualizado", "Os dados do item foram atualizados no inventário.");
      } else {
        const novoId = criarItemInventario({
          analise_origem_id: analysisId,
          imagem_uri: uri,
          ...dadosItem,
        });
        syncItemPeloId(novoId);
        Alert.alert("Item salvo", "Item adicionado ao inventário com sucesso.");
      }

      setItemExistente(obterItemPorAnalise(analysisId));
    } catch (error: any) {
      console.error("[Revisao] Erro ao salvar item:", error);
      Alert.alert("Erro", "Não foi possível salvar o item no inventário.");
    }
  };

  if (loading) {
    return (
      <Screen style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Carregando análise...</Text>
      </Screen>
    );
  }

  if (!analise && !analiseRemota) {
    return (
      <Screen style={styles.loadingContainer}>
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Análise não encontrada.</Text>
      </Screen>
    );
  }

  const statusKey = analiseRemota?.status ?? analise?.status ?? "pendente";
  const statusCfg =
    statusKey === "pendente"
      ? { bg: colors.warningSoft, fg: colors.warning, icon: "time-outline", label: "Pendente" }
      : statusKey === "erro"
        ? { bg: colors.dangerSoft, fg: colors.danger, icon: "alert-circle-outline", label: "Erro" }
        : { bg: colors.successSoft, fg: colors.success, icon: "checkmark-circle-outline", label: "Processado" };

  const textoOcr = analiseRemota?.texto_ocr ?? analise?.texto_ocr ?? null;

  const formatarData = (ts: number) => {
    try {
      return new Date(ts).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const renderResumo = () => {
    const objeto = analiseRemota?.objeto_detectado ?? analise?.objeto_detectado ?? null;
    const labels: string[] = analiseRemota
      ? (Array.isArray(analiseRemota.labels) ? analiseRemota.labels.map((l: any) => l.name ?? "").filter(Boolean) : [])
      : (analise?.labels_json ? JSON.parse(analise.labels_json).map((l: any) => l.name) : []);
    const data = analiseRemota
      ? formatarData(new Date(analiseRemota.criado_em).getTime())
      : formatarData(analise?.criado_em ?? 0);

    return (
      <>
        <Card style={styles.resumoCard}>
          <Text style={[styles.resumoLabel, { color: colors.textMuted }]}>OBJETO DETECTADO</Text>
          <Text style={[styles.resumoValue, { color: colors.textPrimary }]}>{objeto ?? "—"}</Text>
          {labels.length > 0 && (
            <View style={styles.tagsRow}>
              {labels.map((tag, i) => (
                <View key={i} style={[styles.tag, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={[styles.tagText, { color: colors.textSecondary }]} numberOfLines={1}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        <Card style={styles.resumoCard}>
          <Text style={[styles.resumoLabel, { color: colors.textMuted }]}>TEXTO OCR</Text>
          {textoOcr ? (
            <Text style={[styles.resumoValue, { color: colors.textPrimary }]}>{textoOcr}</Text>
          ) : (
            <View style={styles.emptyResumo}>
              <Ionicons name="text-outline" size={18} color={colors.textMuted} />
              <Text style={[styles.resumoMuted, { color: colors.textMuted }]}>Nenhum texto lido</Text>
            </View>
          )}
        </Card>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <View style={styles.footerRow}>
            <Text style={[styles.footerLabel, { color: colors.textMuted }]}>Analisada em</Text>
            <Text style={[styles.footerValue, { color: colors.textSecondary }]}>{data}</Text>
          </View>
        </View>
      </>
    );
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.imageWrap}>
          {imagemUri ? (
            imagemSize ? (
              <Image
                source={{ uri: imagemUri }}
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
              <Ionicons name="image-outline" size={44} color="#FFFFFF" />
            </LinearGradient>
          )}
        </View>

        <View style={styles.chipsRow}>
          <View style={[styles.chip, { backgroundColor: statusCfg.bg }]}>
            <Ionicons name={statusCfg.icon as any} size={13} color={statusCfg.fg} />
            <Text style={[styles.chipText, { color: statusCfg.fg }]}>{statusCfg.label}</Text>
          </View>
          {analiseRemota && (
            <View style={[styles.chip, { backgroundColor: colors.infoSoft }]}>
              <Ionicons name="cloud" size={13} color={colors.info} />
              <Text style={[styles.chipText, { color: colors.info }]}>Nuvem</Text>
            </View>
          )}
          {itemExistente && (
            <View style={[styles.chip, { backgroundColor: colors.successSoft }]}>
              <Ionicons name="link-outline" size={13} color={colors.success} />
              <Text style={[styles.chipText, { color: colors.success }]} numberOfLines={1}>Item vinculado</Text>
            </View>
          )}
        </View>

        {modo === "criar" ? (
          <>
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.textMuted }]}>NOME DO OBJETO</Text>
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
              <Text style={[styles.label, { color: colors.textMuted }]}>TAGS (SUGERIDAS PELA IA, EDITÁVEIS)</Text>
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

            {!analiseRemota && analise && (analise.status === "erro" || analise.status === "pendente") && (
              <GhostButton
                title={analyzing ? "Analisando..." : "Analisar agora"}
                icon="sparkles"
                disabled={analyzing}
                onPress={handleReanalisar}
                style={styles.ghostBtn}
              />
            )}
            {!analiseRemota && analise && !analise.texto_ocr && (
              <GhostButton
                title={readingText ? "Lendo..." : "Ler texto (OCR)"}
                icon="text"
                disabled={readingText}
                onPress={handleLerTexto}
                style={styles.ghostBtn}
              />
            )}

            <PrimaryButton title="Salvar no inventário" icon="checkmark" onPress={handleSalvar} style={styles.saveBtn} />
          </>
        ) : (
          <>
            {renderResumo()}

            {itemExistente ? (
              <PrimaryButton
                title="Ver item"
                icon="arrow-forward"
                onPress={() => router.push({ pathname: "/item/[id]", params: { id: itemExistente.id } } as any)}
                style={styles.saveBtn}
              />
            ) : (
              <Text style={[styles.savedHint, { color: colors.textMuted }]}>Análise da nuvem (somente leitura).</Text>
            )}
          </>
        )}
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
  ghostBtn: {
    marginTop: spacing.md,
  },
  saveBtn: {
    marginTop: spacing.md,
  },
  resumoCard: {
    marginBottom: spacing.md,
  },
  resumoLabel: {
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.caption,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  resumoValue: {
    fontFamily: FONT.medium,
    fontSize: FONT_SIZES.body,
    lineHeight: 22,
  },
  resumoMuted: {
    fontFamily: FONT.regular,
    fontSize: FONT_SIZES.body,
  },
  emptyResumo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: spacing.sm,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    maxWidth: 140,
  },
  tagText: {
    fontFamily: FONT.medium,
    fontSize: FONT_SIZES.caption,
  },
  savedHint: {
    fontFamily: FONT.regular,
    fontSize: FONT_SIZES.caption,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  footer: {
    marginTop: spacing.lg,
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