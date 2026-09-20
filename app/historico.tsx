import { useState, useCallback, useEffect } from "react";
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView } from "react-native";
import { router, useFocusEffect } from "expo-router";
import NetInfo from "@react-native-community/netinfo";
import {
  listarAnalises,
  Analise,
  excluirAnalise,
  reanalisarAnalise,
  listarItensInventario,
  ItemInventario,
  excluirItemInventario,
  obterItemPorId,
} from "../src/db/queries";
import { sincronizarTudo, baixarItensRemotos, listarAnalisesRemotas, excluirAnaliseEmTodoLugar, AnaliseRemota, listarItensRemotos, baixarItemRemoto, excluirItemNuvem, excluirItemEmTodoLugar, ItemRemota } from "../src/services/sync";

type Tab = "analises" | "itens";

type FiltroItens = "todos" | "locais" | "nuvem";

type LinhaAnalise =
  | { tipo: "analise"; item: Analise }
  | { tipo: "cabecalhoNuvem" }
  | { tipo: "nuvem"; item: AnaliseRemota };

type LinhaItem =
  | { tipo: "local"; item: ItemInventario }
  | { tipo: "nuvem"; item: ItemRemota };

export default function HistoricoScreen() {
  const [tab, setTab] = useState<Tab>("analises");
  const [analises, setAnalises] = useState<Analise[]>([]);
  const [itens, setItens] = useState<ItemInventario[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [filtroItens, setFiltroItens] = useState<FiltroItens>("todos");
  const [isConnected, setIsConnected] = useState(true);
  const [analisesNuvem, setAnalisesNuvem] = useState<AnaliseRemota[] | null>(null);
  const [carregandoNuvem, setCarregandoNuvem] = useState(false);
  const [itensNuvem, setItensNuvem] = useState<ItemRemota[] | null>(null);
  const [carregandoItensNuvem, setCarregandoItensNuvem] = useState(false);
  const [erroItensNuvem, setErroItensNuvem] = useState<string | null>(null);
  const [baixandoItemId, setBaixandoItemId] = useState<string | null>(null);
  const [categoriasFiltro, setCategoriasFiltro] = useState<string[]>([]);
  const [tagsFiltro, setTagsFiltro] = useState<string[]>([]);

  const carregarDados = useCallback(() => {
    setLoading(true);
    setAnalises(listarAnalises());
    setItens(listarItensInventario());
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarDados();
    }, [carregarDados])
  );

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

  const formatarDataIso = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("pt-BR", {
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

  const handleExcluirAnalise = (id: string) => {
    Alert.alert(
      "Excluir análise",
      "Como deseja excluir?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apenas localmente",
          onPress: async () => {
            const sucesso = await excluirAnalise(id);
            if (sucesso) {
              carregarDados();
            } else {
              Alert.alert("Erro", "Não foi possível excluir a análise");
            }
          },
        },
        {
          text: "Em todos os lugares",
          style: "destructive",
          onPress: async () => {
            const sucesso = await excluirAnaliseEmTodoLugar(id);
            if (sucesso) {
              carregarDados();
              setAnalisesNuvem((prev) => (prev ? prev.filter((a) => a.id !== id) : prev));
            } else {
              Alert.alert("Erro", "Não foi possível excluir a análise em todos os lugares");
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
          onPress: async () => {
            await excluirItemInventario(id);
            carregarDados();
          },
        },
        {
          text: "Em todos os lugares",
          style: "destructive",
          onPress: async () => {
            const sucesso = await excluirItemEmTodoLugar(id);
            if (sucesso) {
              carregarDados();
              setItensNuvem((prev) => (prev ? prev.filter((i) => i.id !== id) : prev));
            } else {
              Alert.alert("Erro", "Não foi possível excluir o item em todos os lugares");
            }
          },
        },
      ]
    );
  };

  const handleCarregarItensNuvem = useCallback(async () => {
    if (carregandoItensNuvem) return;
    setCarregandoItensNuvem(true);
    setErroItensNuvem(null);
    try {
      const result = await listarItensRemotos();
      if (result.erros.length > 0) {
        setErroItensNuvem(result.erros.join("\n"));
        setItensNuvem(null);
        return;
      }
      setItensNuvem(result.itens);
    } catch (error: any) {
      setErroItensNuvem(error.message);
      setItensNuvem(null);
    } finally {
      setCarregandoItensNuvem(false);
    }
  }, [carregandoItensNuvem]);

  const handleSelecionarNuvem = () => {
    setFiltroItens("nuvem");
    handleCarregarItensNuvem();
  };

  const mudarTab = (novaTab: Tab) => {
    setTab(novaTab);
    if (novaTab === "itens" && itensNuvem === null) {
      handleCarregarItensNuvem();
    }
  };

  const handleBaixarItemNuvem = async (item: ItemRemota, abrir?: boolean) => {
    if (baixandoItemId) return;
    if (obterItemPorId(item.id)) {
      if (abrir) router.push({ pathname: "/item/[id]", params: { id: item.id } } as any);
      return;
    }
    setBaixandoItemId(item.id);
    try {
      const result = await baixarItemRemoto(item);
      if (!result.ok) {
        Alert.alert("Erro", result.erro ?? "Não foi possível baixar o item.");
        return;
      }
      carregarDados();
      if (abrir) {
        router.push({ pathname: "/item/[id]", params: { id: item.id } } as any);
      }
    } catch (error: any) {
      Alert.alert("Erro", error.message);
    } finally {
      setBaixandoItemId(null);
    }
  };

  const handleExcluirItemNuvem = (item: ItemRemota) => {
    Alert.alert(
      "Excluir na nuvem",
      `Excluir "${item.nome}" da nuvem? Isso apaga o item e a análise vinculada.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            const sucesso = await excluirItemNuvem(item.id);
            if (sucesso) {
              setItensNuvem((prev) => (prev ? prev.filter((i) => i.id !== item.id) : prev));
            } else {
              Alert.alert("Erro", "Não foi possível excluir o item na nuvem.");
            }
          },
        },
      ]
    );
  };

  const handleCarregarNuvem = async () => {
    if (carregandoNuvem) return;
    setCarregandoNuvem(true);
    try {
      const result = await listarAnalisesRemotas();
      if (result.erros.length > 0) {
        Alert.alert("Análises da nuvem", result.erros.join("\n"));
      }
      setAnalisesNuvem(result.analises);
    } catch (error: any) {
      Alert.alert("Erro", error.message);
    } finally {
      setCarregandoNuvem(false);
    }
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
      if (itensNuvem !== null) await handleCarregarItensNuvem();
    } catch (error: any) {
      Alert.alert("Erro", error.message);
    } finally {
      setDownloading(false);
    }
  };

  const itensNuvemSemLocal = (itensNuvem ?? []).filter(
    (n) => !itens.some((i) => i.id === n.id)
  );

  const linhasItens: LinhaItem[] =
    filtroItens === "nuvem"
      ? (itensNuvem ?? []).map<LinhaItem>((item) => ({ tipo: "nuvem", item }))
      : filtroItens === "locais"
        ? itens.map<LinhaItem>((item) => ({ tipo: "local", item }))
        : [
            ...itens.map<LinhaItem>((item) => ({ tipo: "local", item })),
            ...itensNuvemSemLocal.map<LinhaItem>((item) => ({ tipo: "nuvem", item })),
          ];

  const categoriaDeLinha = (linha: LinhaItem): string =>
    linha.tipo === "local" ? linha.item.categoria : (linha.item.categoria ?? "");

  const tagsDeLinha = (linha: LinhaItem): string[] =>
    linha.tipo === "local"
      ? linha.item.tags_json
        ? (JSON.parse(linha.item.tags_json) as unknown[]).map((t) => String(t)).filter(Boolean)
        : []
      : Array.isArray(linha.item.tags)
        ? linha.item.tags.map((t) => String(t ?? "")).filter(Boolean)
        : [];

  const opcoesCategorias: string[] = [...new Set(linhasItens.map(categoriaDeLinha).filter(Boolean))].sort();
  const opcoesTags: string[] = [...new Set(linhasItens.flatMap(tagsDeLinha))].sort();

  const filtroAtivo = categoriasFiltro.length > 0 || tagsFiltro.length > 0;

  const linhasFiltradas = linhasItens.filter((linha) => {
    if (categoriasFiltro.length > 0 && !categoriasFiltro.includes(categoriaDeLinha(linha))) {
      return false;
    }
    if (tagsFiltro.length > 0) {
      const tagsItem = tagsDeLinha(linha);
      if (!tagsFiltro.every((t) => tagsItem.includes(t))) return false;
    }
    return true;
  });

  const toggleCategoria = (categoria: string) => {
    setCategoriasFiltro((prev) =>
      prev.includes(categoria)
        ? prev.filter((c) => c !== categoria)
        : [...prev, categoria]
    );
  };

  const toggleTag = (tag: string) => {
    setTagsFiltro((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const limparFiltros = () => {
    setCategoriasFiltro([]);
    setTagsFiltro([]);
  };

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

  const renderAnaliseNuvem = ({ item }: { item: AnaliseRemota }) => {
    const labels: string[] = Array.isArray(item.labels)
      ? item.labels.slice(0, 3).map((l: any) => l.name ?? "").filter(Boolean)
      : [];

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({ pathname: "/revisao", params: { remota: JSON.stringify(item) } } as any)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          {item.imagem_url ? (
            <Image source={{ uri: item.imagem_url }} style={styles.thumbnail} />
          ) : (
            <View style={styles.itemIcon}>
              <Text style={styles.itemIconText}>☁️</Text>
            </View>
          )}
          <View style={styles.cardInfo}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardStatus, styles.cloudBadge]}>Nuvem</Text>
              <Text style={styles.cardDate}>{item.criado_em ? formatarDataIso(item.criado_em) : ""}</Text>
            </View>
            {item.objeto_detectado && (
              <Text style={styles.cardObject}>{item.objeto_detectado}</Text>
            )}
            {labels.length > 0 && (
              <View style={styles.tagsRow}>
                {labels.map((tag, i) => (
                  <Text key={i} style={styles.tag}>{tag}</Text>
                ))}
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderLinhaAnalise = ({ item }: { item: LinhaAnalise }) => {
    switch (item.tipo) {
      case "analise":
        return renderAnalise({ item: item.item });
      case "nuvem":
        return renderAnaliseNuvem({ item: item.item });
      case "cabecalhoNuvem":
        return (
          <Text style={styles.cloudHeader}>
            Analises da nuvem ({analisesNuvem?.length ?? 0})
          </Text>
        );
    }
  };

  const linhasAnalises: LinhaAnalise[] = [
    ...analises.map((a) => ({ tipo: "analise" as const, item: a })),
    ...(analisesNuvem && analisesNuvem.length > 0
      ? [
          { tipo: "cabecalhoNuvem" as const },
          ...analisesNuvem.map((a) => ({ tipo: "nuvem" as const, item: a })),
        ]
      : []),
  ];

  const renderItem = ({ item }: { item: ItemInventario }) => {
    let tags: string[] = [];
    try {
      tags = item.tags_json ? JSON.parse(item.tags_json) : [];
    } catch {}

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({ pathname: "/item/[id]", params: { id: item.id } } as any)}
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

  const renderItemNuvem = ({ item }: { item: ItemRemota }) => {
    const tags: string[] = Array.isArray(item.tags)
      ? item.tags.slice(0, 3).map((t: any) => t ?? "").filter(Boolean)
      : [];

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleBaixarItemNuvem(item, true)}
        onLongPress={() => handleExcluirItemNuvem(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          {item.imagem_url ? (
            <Image source={{ uri: item.imagem_url }} style={styles.thumbnail} />
          ) : (
            <View style={styles.itemIcon}>
              <Text style={styles.itemIconText}>☁️</Text>
            </View>
          )}
          <View style={styles.cardInfo}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardStatus, styles.cloudBadge]}>Nuvem</Text>
              <Text style={styles.cardDate}>
                {item.atualizado_em ? formatarDataIso(item.atualizado_em) : ""}
              </Text>
            </View>
            {item.categoria && (
              <View style={styles.cardHeader}>
                <Text style={styles.cardCategory}>{item.categoria}</Text>
              </View>
            )}
            <Text style={styles.cardObject}>{item.nome}</Text>
            {item.descricao && (
              <Text style={styles.cardDescription} numberOfLines={2}>{item.descricao}</Text>
            )}
            {tags.length > 0 && (
              <View style={styles.tagsRow}>
                {tags.map((tag, i) => (
                  <Text key={i} style={styles.tag}>{tag}</Text>
                ))}
              </View>
            )}
            <View style={styles.cardFooter}>
              <Text style={styles.cardId}>Qtd: {item.quantidade ?? 1}</Text>
              <TouchableOpacity
                style={[styles.syncButton, baixandoItemId === item.id && styles.syncButtonDisabled]}
                onPress={() => handleBaixarItemNuvem(item, false)}
                disabled={baixandoItemId === item.id}
              >
                <Text style={styles.syncButtonText}>
                  {baixandoItemId === item.id ? "Baixando..." : "Baixar"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderLinhaItem = ({ item }: { item: LinhaItem }) =>
    item.tipo === "local"
      ? renderItem({ item: item.item })
      : renderItemNuvem({ item: item.item });

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
          onPress={() => mudarTab("analises")}
        >
          <Text style={[styles.tabText, tab === "analises" && styles.tabTextActive]}>
            Analises ({analises.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "itens" && styles.tabActive]}
          onPress={() => mudarTab("itens")}
        >
          <Text style={[styles.tabText, tab === "itens" && styles.tabTextActive]}>
            Itens ({itens.length})
          </Text>
        </TouchableOpacity>
      </View>

      {tab === "itens" && (
        <>
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterPill, filtroItens === "todos" && styles.filterPillActive]}
              onPress={() => setFiltroItens("todos")}
            >
              <Text style={[styles.filterPillText, filtroItens === "todos" && styles.filterPillTextActive]}>Todos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterPill, filtroItens === "locais" && styles.filterPillActive]}
              onPress={() => setFiltroItens("locais")}
            >
              <Text style={[styles.filterPillText, filtroItens === "locais" && styles.filterPillTextActive]}>Locais</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterPill, filtroItens === "nuvem" && styles.filterPillActive]}
              onPress={handleSelecionarNuvem}
            >
              <Text style={[styles.filterPillText, filtroItens === "nuvem" && styles.filterPillTextActive]}>
                {carregandoItensNuvem ? "Carregando..." : "Nuvem"}
              </Text>
            </TouchableOpacity>
          </View>
          {opcoesCategorias.length > 0 && (
            <View style={styles.filtroSection}>
              <Text style={styles.filtroLabel}>Categoria</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtroChips}>
                {opcoesCategorias.map((categoria) => (
                  <TouchableOpacity
                    key={categoria}
                    style={[styles.filtroChip, categoriasFiltro.includes(categoria) && styles.filtroChipActive]}
                    onPress={() => toggleCategoria(categoria)}
                  >
                    <Text style={[styles.filtroChipText, categoriasFiltro.includes(categoria) && styles.filtroChipTextActive]}>
                      {categoria}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          {opcoesTags.length > 0 && (
            <View style={styles.filtroSection}>
              <Text style={styles.filtroLabel}>Tags</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtroChips}>
                {opcoesTags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.filtroChip, tagsFiltro.includes(tag) && styles.filtroChipActive]}
                    onPress={() => toggleTag(tag)}
                  >
                    <Text style={[styles.filtroChipText, tagsFiltro.includes(tag) && styles.filtroChipTextActive]}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          {filtroAtivo && (
            <View style={styles.filtroBar}>
              <Text style={styles.filtroCount}>
                {linhasFiltradas.length} de {linhasItens.length} itens
              </Text>
              <TouchableOpacity onPress={limparFiltros}>
                <Text style={styles.filtroClear}>Limpar</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.syncBar}>
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
              <Text style={styles.syncButtonText}>{downloading ? "Baixando..." : "Baixar todos"}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {tab === "analises" && (
        <View style={styles.syncBar}>
          <TouchableOpacity
            style={[styles.syncButton, (!isConnected || carregandoNuvem) && styles.syncButtonDisabled]}
            onPress={handleCarregarNuvem}
            disabled={!isConnected || carregandoNuvem}
          >
            <Text style={styles.syncButtonText}>
              {carregandoNuvem ? "Carregando..." : "Analises da nuvem"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {!isConnected && (
        <View style={styles.offlineBar}>
          <Text style={styles.offlineText}>Offline</Text>
        </View>
      )}

      {tab === "analises" ? (
        analises.length === 0 && (!analisesNuvem || analisesNuvem.length === 0) ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhuma analise registrada</Text>
            <Text style={styles.emptySubtext}>Tire uma foto para comecar</Text>
          </View>
        ) : (
          <FlatList
            data={linhasAnalises}
            keyExtractor={(linha) =>
              linha.tipo === "cabecalhoNuvem"
                ? "cabecalho-nuvem"
                : linha.tipo === "nuvem"
                  ? `nuvem-${linha.item.id}`
                  : `analise-${linha.item.id}`
            }
            renderItem={renderLinhaAnalise}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.listContent}
          />
        )
      ) : (
        linhasFiltradas.length === 0 ? (
          <View style={styles.emptyContainer}>
            {filtroAtivo ? (
              <>
                <Text style={styles.emptyText}>Nenhum item corresponde ao filtro</Text>
                <TouchableOpacity style={styles.clearFiltersButton} onPress={limparFiltros}>
                  <Text style={styles.clearFiltersButtonText}>Limpar filtros</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.emptyText}>
                  {filtroItens === "nuvem"
                    ? "Nenhum item na nuvem"
                    : filtroItens === "locais"
                      ? "Nenhum item local"
                      : "Nenhum item salvo"}
                </Text>
                <Text style={styles.emptySubtext}>
                  {filtroItens === "nuvem" && erroItensNuvem
                    ? erroItensNuvem
                    : filtroItens === "nuvem"
                      ? carregandoItensNuvem
                        ? "Carregando..."
                        : "Nenhum item na nuvem"
                      : filtroItens === "locais"
                        ? "Salve um item a partir de uma analise"
                        : "Tire uma foto ou baixe itens da nuvem"}
                </Text>
              </>
            )}
          </View>
        ) : (
          <FlatList
            data={linhasFiltradas}
            keyExtractor={(linha) => `${linha.tipo}-${linha.item.id}`}
            renderItem={renderLinhaItem}
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
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#e0e0e0",
  },
  filterPillActive: {
    backgroundColor: "#2196f3",
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#444",
  },
  filterPillTextActive: {
    color: "#fff",
  },
  filtroSection: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  filtroLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  filtroChips: {
    paddingRight: 4,
  },
  filtroChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "#e0e0e0",
    marginRight: 8,
  },
  filtroChipActive: {
    backgroundColor: "#2196f3",
  },
  filtroChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#444",
  },
  filtroChipTextActive: {
    color: "#fff",
  },
  filtroBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filtroCount: {
    fontSize: 12,
    color: "#666",
  },
  filtroClear: {
    fontSize: 13,
    fontWeight: "600",
    color: "#f44336",
  },
  clearFiltersButton: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#f44336",
  },
  clearFiltersButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
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
  cloudBadge: {
    color: "#fff",
    backgroundColor: "#9c27b0",
  },
  cloudHeader: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
    marginTop: 8,
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
