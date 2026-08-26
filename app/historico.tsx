import { useEffect, useState, useCallback } from "react";
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert, Switch } from "react-native";
import { router } from "expo-router";
import NetInfo from "@react-native-community/netinfo";
import {
  listarAnalises,
  Analise,
  excluirAnalise,
  reanalisarAnalise,
  listarItensInventario,
  ItemInventario,
  excluirItemInventario,
} from "../src/db/queries";
import { sincronizarTudo, baixarItensRemotos, excluirRemoto } from "../src/services/sync";

type Tab = "analises" | "itens";

export default function HistoricoScreen() {
  const [tab, setTab] = useState<Tab>("analises");
  const [analises, setAnalises] = useState<Analise[]>([]);
  const [itens, setItens] = useState<ItemInventario[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showOnlyUnsynced, setShowOnlyUnsynced] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  const carregarDados = useCallback(() => {
    setLoading(true);
    setAnalises(listarAnalises());
    setItens(listarItensInventario());
    setLoading(false);
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected === true && state.isInternetReachable === true);
    });
    return unsubscribe;
  }, []);

  const formatarData = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: Analise["status"]) => {
    switch (status) {
      case "pendente": return "#ffa500";
      case "processado": return "#4caf50";
      case "erro": return "#f44336";
      default: return "#999";
    }
  };

  const getStatusLabel = (status: Analise["status"]) => {
    switch (status) {
      case "pendente": return "Pendente";
      case "processado": return "Processado";
      case "erro": return "Erro";
      default: return status;
    }
  };

  const handleExcluirAnalise = async (id: string) => {
    Alert.alert(
      "Excluir análise",
      "Tem certeza? Isso apagará a foto e o registro permanentemente.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            const sucesso = await excluirAnalise(id);
            if (sucesso) {
              carregarDados();
            } else {
              Alert.alert("Erro", "Não foi possível excluir a análise");
            }
          },
        },
      ]
    );
  };

  const handleExcluirItem = (id: string) => {
    Alert.alert(
      "Excluir item",
      "Como deseja excluir?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apenas localmente",
          onPress: () => {
            excluirItemInventario(id);
            carregarDados();
          },
        },
        {
          text: "Em todos os lugares",
          style: "destructive",
          onPress: async () => {
            excluirItemInventario(id);
            await excluirRemoto(id);
            carregarDados();
          },
        },
      ]
    );
  };

  const handleAnalisar = async (item: Analise) => {
    if (analyzingId) return;
    setAnalyzingId(item.id);
    try {
      const result = await reanalisarAnalise(item.id);
      if (result.success) {
        carregarDados();
      } else {
        Alert.alert("Erro na análise", result.error ?? "Erro desconhecido");
      }
    } catch (error: any) {
      Alert.alert("Erro", error.message);
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleSincronizar = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await sincronizarTudo();
      if (result.erros.length > 0) {
        Alert.alert("Sincronização", `${result.analisesSync} análises e ${result.itensSync} itens sincronizados.\n\nErros:\n${result.erros.join("\n")}`);
      } else {
        Alert.alert("Sincronização", `${result.analisesSync} análises e ${result.itensSync} itens sincronizados com sucesso.`);
      }
      carregarDados();
    } catch (error: any) {
      Alert.alert("Erro", error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleBaixarRemotos = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const result = await baixarItensRemotos();
      if (result.erros.length > 0) {
        Alert.alert("Download", `${result.baixados} itens baixados.\n\nErros:\n${result.erros.join("\n")}`);
      } else {
        Alert.alert("Download", `${result.baixados} itens baixados da nuvem.`);
      }
      carregarDados();
    } catch (error: any) {
      Alert.alert("Erro", error.message);
    } finally {
      setDownloading(false);
    }
  };

  const itensFiltrados = showOnlyUnsynced
    ? itens.filter((item) => item.sincronizado === 0)
    : itens;

  const renderAnalise = ({ item }: { item: Analise }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: "/revisao", params: { uri: item.imagem_uri, analysisId: item.id } } as any)}
      onLongPress={() => handleExcluirAnalise(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        <Image source={{ uri: item.imagem_uri }} style={styles.thumbnail} />
        <View style={styles.cardInfo}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardStatus, { color: getStatusColor(item.status) }]}>
              {getStatusLabel(item.status)}
            </Text>
            <Text style={styles.cardDate}>{formatarData(item.criado_em)}</Text>
          </View>
          {item.objeto_detectado && (
            <Text style={styles.cardObject}>{item.objeto_detectado}</Text>
          )}
          <View style={styles.cardFooter}>
            <Text style={styles.cardId}>ID: {item.id.slice(0, 8)}...</Text>
            {item.sincronizado === 0 ? (
              <Text style={styles.syncPending}>Nao sincronizado</Text>
            ) : (
              <Text style={styles.syncOk}>Sincronizado</Text>
            )}
          </View>
          {item.status === "pendente" && (
            <TouchableOpacity
              style={styles.analyzeButton}
              onPress={() => handleAnalisar(item)}
              disabled={analyzingId === item.id}
              activeOpacity={0.7}
            >
              <Text style={styles.analyzeButtonText}>
                {analyzingId === item.id ? "Analisando..." : "Analisar agora"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: ItemInventario }) => {
    let tags: string[] = [];
    try {
      tags = item.tags_json ? JSON.parse(item.tags_json) : [];
    } catch {}

    return (
      <TouchableOpacity
        style={styles.card}
        onLongPress={() => handleExcluirItem(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          {item.imagem_uri ? (
            <Image source={{ uri: item.imagem_uri }} style={styles.thumbnail} />
          ) : (
            <View style={styles.itemIcon}>
              <Text style={styles.itemIconText}>{item.nome.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.cardInfo}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardCategory}>{item.categoria}</Text>
              <Text style={styles.cardDate}>{formatarData(item.criado_em)}</Text>
            </View>
            <Text style={styles.cardObject}>{item.nome}</Text>
            {item.descricao && (
              <Text style={styles.cardDescription} numberOfLines={2}>{item.descricao}</Text>
            )}
            {tags.length > 0 && (
              <View style={styles.tagsRow}>
                {tags.slice(0, 3).map((tag, i) => (
                  <Text key={i} style={styles.tag}>{tag}</Text>
                ))}
                {tags.length > 3 && <Text style={styles.tagMore}>+{tags.length - 3}</Text>}
              </View>
            )}
            <View style={styles.cardFooter}>
              <Text style={styles.cardId}>Qtd: {item.quantidade}</Text>
              {item.sincronizado === 0 ? (
                <Text style={styles.syncPending}>Nao sincronizado</Text>
              ) : (
                <Text style={styles.syncOk}>Sincronizado</Text>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === "analises" && styles.tabActive]}
          onPress={() => setTab("analises")}
        >
          <Text style={[styles.tabText, tab === "analises" && styles.tabTextActive]}>
            Analises ({analises.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "itens" && styles.tabActive]}
          onPress={() => setTab("itens")}
        >
          <Text style={[styles.tabText, tab === "itens" && styles.tabTextActive]}>
            Itens ({itens.length})
          </Text>
        </TouchableOpacity>
      </View>

      {tab === "itens" && (
        <View style={styles.syncBar}>
          <View style={styles.syncBarLeft}>
            <Text style={styles.filterLabel}>Nao sincronizados:</Text>
            <Switch
              value={showOnlyUnsynced}
              onValueChange={setShowOnlyUnsynced}
              trackColor={{ false: "#ccc", true: "#81b0ff" }}
              thumbColor={showOnlyUnsynced ? "#2196f3" : "#f4f3f4"}
            />
          </View>
          <View style={styles.syncBarRight}>
            <TouchableOpacity
              style={[styles.syncButton, (!isConnected || syncing) && styles.syncButtonDisabled]}
              onPress={handleSincronizar}
              disabled={!isConnected || syncing}
            >
              <Text style={styles.syncButtonText}>{syncing ? "Enviando..." : "Sincronizar"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.syncButton, styles.downloadButton, (!isConnected || downloading) && styles.syncButtonDisabled]}
              onPress={handleBaixarRemotos}
              disabled={!isConnected || downloading}
            >
              <Text style={styles.syncButtonText}>{downloading ? "Baixando..." : "Baixar"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!isConnected && (
        <View style={styles.offlineBar}>
          <Text style={styles.offlineText}>Offline</Text>
        </View>
      )}

      {tab === "analises" ? (
        analises.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhuma analise registrada</Text>
            <Text style={styles.emptySubtext}>Tire uma foto para comecar</Text>
          </View>
        ) : (
          <FlatList
            data={analises}
            keyExtractor={(item) => item.id}
            renderItem={renderAnalise}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.listContent}
          />
        )
      ) : (
        itensFiltrados.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {showOnlyUnsynced ? "Todos os itens sincronizados" : "Nenhum item salvo"}
            </Text>
            <Text style={styles.emptySubtext}>
              {showOnlyUnsynced ? "Nada pendente de sincronizacao" : "Salve um item a partir de uma analise"}
            </Text>
          </View>
        ) : (
          <FlatList
            data={itensFiltrados}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.listContent}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingTop: 50,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#e0e0e0",
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: "#333",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  tabTextActive: {
    color: "#fff",
  },
  syncBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  syncBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterLabel: {
    fontSize: 13,
    color: "#666",
  },
  syncBarRight: {
    flexDirection: "row",
    gap: 8,
  },
  syncButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#2196f3",
    borderRadius: 6,
  },
  downloadButton: {
    backgroundColor: "#4caf50",
  },
  syncButtonDisabled: {
    backgroundColor: "#bbb",
  },
  syncButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  offlineBar: {
    backgroundColor: "#ff9800",
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginBottom: 12,
    marginHorizontal: 16,
    borderRadius: 6,
    alignItems: "center",
  },
  offlineText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: "#999",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
  },
  cardContent: {
    flexDirection: "row",
    padding: 12,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#eee",
  },
  itemIcon: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#e3f2fd",
    justifyContent: "center",
    alignItems: "center",
  },
  itemIconText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#2196f3",
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardStatus: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  cardCategory: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2196f3",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#e3f2fd",
  },
  cardDate: {
    fontSize: 12,
    color: "#999",
  },
  cardObject: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: "#666",
    marginBottom: 4,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  cardId: {
    fontSize: 11,
    color: "#999",
    fontFamily: "monospace",
  },
  syncPending: {
    fontSize: 11,
    color: "#ff9800",
    fontWeight: "600",
  },
  syncOk: {
    fontSize: 11,
    color: "#4caf50",
    fontWeight: "600",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
    gap: 4,
  },
  tag: {
    fontSize: 11,
    color: "#666",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagMore: {
    fontSize: 11,
    color: "#999",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  analyzeButton: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#2196f3",
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  analyzeButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  separator: {
    height: 12,
  },
});
