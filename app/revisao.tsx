import { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Text, Image, TouchableOpacity, ActivityIndicator, ScrollView, TextInput, Alert } from "react-native";
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

export default function RevisaoScreen() {
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
  const [imagemAspect, setImagemAspect] = useState<number | null>(null);

  const imagemUri = uri || analiseRemota?.imagem_url || null;

  const modo: "criar" | "item" | "remota" = analiseRemota
    ? "remota"
    : itemExistente
      ? "item"
      : "criar";

  useEffect(() => {
    if (!imagemUri) return;
    Image.getSize(
      imagemUri,
      (w, h) => {
        if (w > 0 && h > 0) setImagemAspect(w / h);
      },
      () => {}
    );
  }, [imagemUri]);

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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#333" />
        <Text style={styles.loadingText}>Carregando análise...</Text>
      </View>
    );
  }

  if (!analise && !analiseRemota) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Análise não encontrada.</Text>
      </View>
    );
  }

  const statusColors: Record<string, string> = {
    pendente: "#ffa500",
    processado: "#4caf50",
    erro: "#f44336",
  };

  const statusLabels: Record<string, string> = {
    pendente: "Pendente",
    processado: "Processado",
    erro: "Erro",
  };

  const statusKey = analiseRemota?.status ?? analise?.status ?? "pendente";
  const statusColor = statusColors[statusKey] ?? "#999";
  const statusLabel = statusLabels[statusKey] ?? statusKey;

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
    const textoOcr = analiseRemota?.texto_ocr ?? analise?.texto_ocr ?? null;
    const data = analiseRemota
      ? formatarData(new Date(analiseRemota.criado_em).getTime())
      : formatarData(analise?.criado_em ?? 0);

    return (
      <>
        <View style={styles.section}>
          <Text style={styles.label}>Nome do objeto</Text>
          <Text style={styles.value}>{objeto ?? "—"}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Tags detectadas</Text>
          {labels.length > 0 ? (
            <Text style={styles.value}>{labels.join(", ")}</Text>
          ) : (
            <Text style={styles.valueMuted}>Nenhuma tag detectada</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Texto OCR</Text>
          {textoOcr ? (
            <Text style={styles.value}>{textoOcr}</Text>
          ) : (
            <Text style={styles.valueMuted}>Nenhum texto lido</Text>
          )}
        </View>

        <Text style={styles.itemSavedHint}>Analisada em {data}</Text>
      </>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {imagemUri ? (
        <Image
          source={{ uri: imagemUri }}
          style={[styles.image, imagemAspect ? { aspectRatio: imagemAspect } : null]}
          resizeMode="contain"
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderText}>?</Text>
        </View>
      )}

      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
        {!analiseRemota && analise && (analise.status === "erro" || analise.status === "pendente") && (
          <TouchableOpacity style={styles.retryButton} onPress={handleReanalisar} disabled={analyzing}>
            <Text style={styles.retryButtonText}>{analyzing ? "Analisando..." : "Analisar agora"}</Text>
          </TouchableOpacity>
        )}
        {!analiseRemota && analise && (analise.texto_ocr ? (
          <View style={[styles.ocrButton, styles.ocrButtonDone]}>
            <Text style={styles.ocrButtonText}>Texto já lido</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.ocrButton} onPress={handleLerTexto} disabled={readingText}>
            <Text style={styles.ocrButtonText}>{readingText ? "Lendo..." : "Ler texto"}</Text>
          </TouchableOpacity>
        ))}
        {analiseRemota && (
          <View style={[styles.statusBadge, { backgroundColor: "#9c27b0" }]}>
            <Text style={styles.statusText}>Nuvem</Text>
          </View>
        )}
      </View>

      {modo === "criar" ? (
        <>
          <View style={styles.section}>
            <Text style={styles.label}>Nome do objeto</Text>
            <TextInput
              style={styles.input}
              value={nome}
              onChangeText={setNome}
              placeholder="Ex: Cadeira, Furadeira, Notebook"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Categoria <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={categoria}
              onChangeText={setCategoria}
              placeholder="Ex: Móveis, Ferramentas, Eletrônicos"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Tags (sugeridas pela IA, editáveis)</Text>
            <TextInput
              style={styles.input}
              value={tags}
              onChangeText={setTags}
              placeholder="Ex: furniture, wood, chair"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Descrição (opcional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={descricao}
              onChangeText={setDescricao}
              placeholder="Detalhes, número de série, observações..."
              multiline
              numberOfLines={3}
            />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSalvar} activeOpacity={0.7}>
            <Text style={styles.saveButtonText}>Salvar no inventário</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {renderResumo()}

          {itemExistente ? (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => router.push({ pathname: "/item/[id]", params: { id: itemExistente.id } } as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.saveButtonText}>Ver item</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.itemSavedHint}>Análise da nuvem (somente leitura).</Text>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  image: {
    width: "100%",
    aspectRatio: 1,
    maxHeight: 400,
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: "#f0f0f0",
  },
  imagePlaceholder: {
    width: "100%",
    aspectRatio: 1,
    maxHeight: 400,
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: "#e3f2fd",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderText: {
    fontSize: 64,
    fontWeight: "700",
    color: "#999",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#2196f3",
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  ocrButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#9c27b0",
    borderRadius: 8,
  },
  ocrButtonDone: {
    backgroundColor: "#999",
  },
  ocrButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  required: {
    color: "#f44336",
  },
  value: {
    fontSize: 16,
    color: "#333",
    lineHeight: 22,
  },
  valueMuted: {
    fontSize: 15,
    color: "#999",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    backgroundColor: "#fafafa",
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  saveButton: {
    backgroundColor: "#2196f3",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  itemSavedHint: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    marginTop: 8,
  },
});