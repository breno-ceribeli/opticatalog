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
} from "react-native";
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

export default function ItemScreen() {
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
  const [imagemAspect, setImagemAspect] = useState<number | null>(null);

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
    Image.getSize(
      item.imagem_uri,
      (w, h) => {
        if (w > 0 && h > 0) setImagemAspect(w / h);
      },
      () => {}
    );
  }, [item?.imagem_uri]);

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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#333" />
        <Text style={styles.loadingText}>Carregando item...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Item não encontrado.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {item.imagem_uri ? (
        <Image
          source={{ uri: item.imagem_uri }}
          style={[styles.image, imagemAspect ? { aspectRatio: imagemAspect } : null]}
          resizeMode="contain"
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderText}>{item.nome.charAt(0).toUpperCase()}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.label}>Nome</Text>
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
        <Text style={styles.label}>Tags</Text>
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

      <View style={styles.section}>
        <Text style={styles.label}>Quantidade</Text>
        <TextInput
          style={styles.input}
          value={quantidade}
          onChangeText={setQuantidade}
          keyboardType="numeric"
          placeholder="1"
        />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSalvar} disabled={saving} activeOpacity={0.7}>
        <Text style={styles.saveButtonText}>{saving ? "Salvando..." : "Salvar alterações"}</Text>
      </TouchableOpacity>

      {item.analise_origem_id && (
        <TouchableOpacity style={styles.analysisLink} onPress={handleVerAnalise} activeOpacity={0.7}>
          <Text style={styles.analysisLinkText}>Ver análise de origem</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.deleteButton} onPress={handleExcluir} disabled={deleting} activeOpacity={0.7}>
        <Text style={styles.deleteButtonText}>{deleting ? "Excluindo..." : "Excluir item"}</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Criado: {formatarData(item.criado_em)}</Text>
        <Text style={styles.footerText}>Atualizado: {formatarData(item.atualizado_em)}</Text>
        <Text style={styles.footerText}>
          {item.sincronizado === 1 ? "Sincronizado" : "Nao sincronizado"}
        </Text>
        <Text style={styles.footerId}>ID: {item.id}</Text>
      </View>
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
    backgroundColor: "#fff",
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
    color: "#2196f3",
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
  saveButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  analysisLink: {
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  analysisLinkText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2196f3",
  },
  deleteButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#f44336",
  },
  deleteButtonText: {
    color: "#f44336",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    marginTop: 24,
    alignItems: "center",
    gap: 4,
  },
  footerText: {
    fontSize: 13,
    color: "#999",
  },
  footerId: {
    fontSize: 11,
    color: "#bbb",
    fontFamily: "monospace",
    marginTop: 4,
  },
});