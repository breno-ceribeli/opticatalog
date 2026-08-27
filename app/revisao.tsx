import { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Text, Image, TouchableOpacity, ActivityIndicator, ScrollView, TextInput, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
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
import { syncAnalisePeloId, syncItemPeloId } from "../src/services/sync";

export default function RevisaoScreen() {
  const { uri, analysisId } = useLocalSearchParams<{ uri: string; analysisId: string }>();
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [readingText, setReadingText] = useState(false);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [tags, setTags] = useState("");
  const [descricao, setDescricao] = useState("");
  const [itemExistente, setItemExistente] = useState<ItemInventario | null>(null);
  const [imagemAspect, setImagemAspect] = useState<number | null>(null);

  useEffect(() => {
    if (!uri) return;
    Image.getSize(
      uri,
      (w, h) => {
        if (w > 0 && h > 0) setImagemAspect(w / h);
      },
      () => {}
    );
  }, [uri]);

  const carregarAnalise = useCallback(() => {
    if (!analysisId) return;
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
  }, [analysisId]);

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

  if (loading || !analise) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#333" />
        <Text style={styles.loadingText}>Carregando análise...</Text>
      </View>
    );
  }

  const statusColors = {
    pendente: "#ffa500",
    processado: "#4caf50",
    erro: "#f44336",
  };

  const statusLabels = {
    pendente: "Pendente",
    processado: "Processado",
    erro: "Erro",
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {uri && (
        <Image
          source={{ uri }}
          style={[styles.image, imagemAspect ? { aspectRatio: imagemAspect } : null]}
          resizeMode="contain"
        />
      )}

      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[analise.status] }]}>
          <Text style={styles.statusText}>{statusLabels[analise.status]}</Text>
        </View>
        {(analise.status === "erro" || analise.status === "pendente") && (
          <TouchableOpacity style={styles.retryButton} onPress={handleReanalisar} disabled={analyzing}>
            <Text style={styles.retryButtonText}>{analyzing ? "Analisando..." : "Analisar agora"}</Text>
          </TouchableOpacity>
        )}
        {analise.texto_ocr ? (
          <View style={[styles.ocrButton, styles.ocrButtonDone]}>
            <Text style={styles.ocrButtonText}>Texto já lido</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.ocrButton} onPress={handleLerTexto} disabled={readingText}>
            <Text style={styles.ocrButtonText}>{readingText ? "Lendo..." : "Ler texto"}</Text>
          </TouchableOpacity>
        )}
      </View>

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

      <TouchableOpacity style={[styles.saveButton, itemExistente && styles.saveButtonUpdate]} onPress={handleSalvar} activeOpacity={0.7}>
        <Text style={styles.saveButtonText}>{itemExistente ? "Atualizar item" : "Salvar no inventário"}</Text>
      </TouchableOpacity>
      {itemExistente && (
        <Text style={styles.itemSavedHint}>Este item já foi salvo no inventário.</Text>
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
  saveButtonUpdate: {
    backgroundColor: "#ff9800",
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