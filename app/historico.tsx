import { useState, useCallback, useEffect } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, FlatList } from "react-native";
import { router, useFocusEffect } from "expo-router";
import NetInfo from "@react-native-community/netinfo";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Card, Screen, PrimaryButton, GhostButton } from "../src/components";
import { useTheme, FONT, FONT_SIZES, spacing, radius } from "../src/theme";
import type { IoniconName } from "../src/components/icons";
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

function SyncChip({ sincronizado }: { sincronizado: number }) {
  const { colors } = useTheme();
  const ok = sincronizado === 1;
  const color = ok ? colors.success : colors.warning;
  const bg = ok ? colors.successSoft : colors.warningSoft;
  return (
    <View style={[styles.syncChip, { backgroundColor: bg }]}>
      <Ionicons name={ok ? "cloud-done-outline" : "cloud-upload-outline"} size={13} color={color} />
      <Text style={[styles.syncChipText, { color }]}>{ok ? "Sincronizado" : "Não sincronizado"}</Text>
    </View>
  );
}

function CategoriaChip({ categoria }: { categoria: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.categoryChip, { backgroundColor: colors.infoSoft }]}>
      <Ionicons name="pricetag" size={12} color={colors.info} />
      <Text style={[styles.categoryChipText, { color: colors.info }]} numberOfLines={1}>{categoria}</Text>
    </View>
  );
}

function TagChip({ tag }: { tag: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tag, { backgroundColor: colors.surfaceMuted }]}>
      <Text style={[styles.tagText, { color: colors.textSecondary }]} numberOfLines={1}>#{tag}</Text>
    </View>
  );
}

function CloudBadge() {
  const { colors } = useTheme();
  return (
    <View style={[styles.cloudChip, { backgroundColor: colors.infoSoft }]}>
      <Ionicons name="cloud" size={12} color={colors.info} />
      <Text style={[styles.cloudChipText, { color: colors.info }]}>Nuvem</Text>
    </View>
  );
}

function LocalBadge() {
  const { colors } = useTheme();
  return (
    <View style={[styles.localChip, { backgroundColor: colors.surfaceMuted }]}>
      <Ionicons name="phone-portrait" size={12} color={colors.primary} />
      <Text style={[styles.localChipText, { color: colors.primary }]}>Local</Text>
    </View>
  );
}

function BaixarButton({
  label,
  busy,
  onPress,
}: {
  label: string;
  busy: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      disabled={busy}
    >
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.downloadChip, { opacity: busy ? 0.7 : 1 }]}
      >
        <Ionicons name={busy ? "hourglass-outline" : "download-outline"} size={14} color="#FFFFFF" />
        <Text style={styles.downloadChipText}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  if (active) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.filterChipGradient}
        >
          <Text style={styles.filterChipTextActive}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.filterChipIdle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.filterChipTextIdle, { color: colors.textSecondary }]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

function FiltroChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  if (active) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.filtroChipGradient}
        >
          <Text style={styles.filtroChipTextActive}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.filtroChipIdle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.filtroChipTextIdle, { color: colors.textSecondary }]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

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

  const { colors } = useTheme();

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

  const statusCfg = (status: Analise["status"], colors: ReturnType<typeof useTheme>["colors"]) => {
    switch (status) {
      case "pendente": return { bg: colors.warningSoft, fg: colors.warning, icon: "time-outline" as IoniconName };
      case "processado": return { bg: colors.successSoft, fg: colors.success, icon: "checkmark-circle-outline" as IoniconName };
      case "erro": return { bg: colors.dangerSoft, fg: colors.danger, icon: "alert-circle-outline" as IoniconName };
      default: return { bg: colors.surfaceMuted, fg: colors.textMuted, icon: "ellipse-outline" as IoniconName };
    }
  };

  const renderAnalise = ({ item }: { item: Analise }) => {
    const cfg = statusCfg(item.status, colors);
    return (
      <Card
        style={styles.card}
        contentStyle={styles.cardContent}
        onPress={() => router.push({ pathname: "/revisao", params: { uri: item.imagem_uri, analysisId: item.id } } as any)}
        onLongPress={() => handleExcluirAnalise(item.id)}
      >
        {item.imagem_uri ? (
          <Image source={{ uri: item.imagem_uri }} style={[styles.thumb, { borderRadius: radius.md }]} />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: colors.surfaceMuted, borderRadius: radius.md }]}>
            <Ionicons name="image-outline" size={26} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.cardInfo}>
          <View style={styles.cardTopRow}>
            <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon} size={13} color={cfg.fg} />
              <Text style={[styles.badgeText, { color: cfg.fg }]}>{getStatusLabel(item.status)}</Text>
            </View>
            <Text style={[styles.cardDate, { color: colors.textMuted }]}>{formatarData(item.criado_em)}</Text>
          </View>
          {item.objeto_detectado && (
            <Text style={[styles.cardObject, { color: colors.textPrimary }]} numberOfLines={1}>{item.objeto_detectado}</Text>
          )}
          <View style={styles.cardFooter}>
            <Text style={[styles.cardId, { color: colors.textMuted }]}>ID: {item.id.slice(0, 8)}…</Text>
            <SyncChip sincronizado={item.sincronizado} />
          </View>
          {item.status === "pendente" && (
            <TouchableOpacity
              style={[styles.cta, { opacity: analyzingId === item.id ? 0.7 : 1 }]}
              onPress={() => handleAnalisar(item)}
              disabled={analyzingId === item.id}
            >
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGradient}
              >
                <Ionicons name="sparkles" size={15} color="#FFFFFF" />
                <Text style={styles.ctaText}>
                  {analyzingId === item.id ? "Analisando..." : "Analisar agora"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Card>
    );
  };

  const renderAnaliseNuvem = ({ item }: { item: AnaliseRemota }) => {
    const labels: string[] = Array.isArray(item.labels)
      ? item.labels.slice(0, 3).map((l: any) => l.name ?? "").filter(Boolean)
      : [];

    return (
      <Card
        style={styles.card}
        contentStyle={styles.cardContent}
        onPress={() => router.push({ pathname: "/revisao", params: { remota: JSON.stringify(item) } } as any)}
      >
        {item.imagem_url ? (
          <Image source={{ uri: item.imagem_url }} style={[styles.thumb, { borderRadius: radius.md }]} />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: colors.infoSoft, borderRadius: radius.md }]}>
            <Ionicons name="cloud" size={26} color={colors.info} />
          </View>
        )}
        <View style={styles.cardInfo}>
          <View style={styles.cardTopRow}>
            <CloudBadge />
            <Text style={[styles.cardDate, { color: colors.textMuted }]}>{item.criado_em ? formatarDataIso(item.criado_em) : ""}</Text>
          </View>
          {item.objeto_detectado && (
            <Text style={[styles.cardObject, { color: colors.textPrimary }]} numberOfLines={1}>{item.objeto_detectado}</Text>
          )}
          {labels.length > 0 && (
            <View style={styles.tagsRow}>
              {labels.map((tag, i) => <TagChip key={i} tag={tag} />)}
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Card>
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
          <Text style={[styles.cloudHeader, { color: colors.textMuted }]}>
            Análises da nuvem ({analisesNuvem?.length ?? 0})
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
      <Card
        style={styles.card}
        contentStyle={styles.cardContent}
        onPress={() => router.push({ pathname: "/item/[id]", params: { id: item.id } } as any)}
        onLongPress={() => handleExcluirItem(item.id)}
      >
        {item.imagem_uri ? (
          <Image source={{ uri: item.imagem_uri }} style={[styles.thumb, { borderRadius: radius.md }]} />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: colors.surfaceMuted, borderRadius: radius.md }]}>
            <Ionicons name="cube-outline" size={30} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.cardInfo}>
          <View style={styles.cardTopRow}>
            <LocalBadge />
            <Text style={[styles.cardDate, { color: colors.textMuted }]}>{formatarData(item.criado_em)}</Text>
          </View>
          <Text style={[styles.cardObject, { color: colors.textPrimary }]} numberOfLines={1}>{item.nome}</Text>
          {item.descricao && (
            <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={1}>{item.descricao}</Text>
          )}
          {(item.categoria || tags.length > 0) && (
            <View style={styles.tagsRow}>
              {item.categoria ? <CategoriaChip categoria={item.categoria} /> : null}
              {tags.slice(0, 3).map((tag, i) => <TagChip key={i} tag={tag} />)}
              {tags.length > 3 && (
                <TagChip tag={`+${tags.length - 3}`} />
              )}
            </View>
          )}
          <View style={styles.cardFooter}>
            <View style={styles.qtyRow}>
              <Ionicons name="layers-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.cardId, { color: colors.textMuted }]}>Qtd: {item.quantidade}</Text>
            </View>
            <SyncChip sincronizado={item.sincronizado} />
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Card>
    );
  };

  const renderItemNuvem = ({ item }: { item: ItemRemota }) => {
    const tags: string[] = Array.isArray(item.tags)
      ? item.tags.slice(0, 3).map((t: any) => t ?? "").filter(Boolean)
      : [];

    return (
      <Card
        style={styles.card}
        contentStyle={styles.cardContent}
        onPress={() => handleBaixarItemNuvem(item, true)}
        onLongPress={() => handleExcluirItemNuvem(item)}
      >
        {item.imagem_url ? (
          <Image source={{ uri: item.imagem_url }} style={[styles.thumb, { borderRadius: radius.md }]} />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: colors.infoSoft, borderRadius: radius.md }]}>
            <Ionicons name="cloud" size={26} color={colors.info} />
          </View>
        )}
        <View style={styles.cardInfo}>
          <View style={styles.cardTopRow}>
            <CloudBadge />
            <Text style={[styles.cardDate, { color: colors.textMuted }]}>
              {item.atualizado_em ? formatarDataIso(item.atualizado_em) : ""}
            </Text>
          </View>
          <Text style={[styles.cardObject, { color: colors.textPrimary }]} numberOfLines={1}>{item.nome}</Text>
          {item.descricao && (
            <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={1}>{item.descricao}</Text>
          )}
          {(item.categoria || tags.length > 0) && (
            <View style={styles.tagsRow}>
              {item.categoria ? <CategoriaChip categoria={item.categoria} /> : null}
              {tags.map((tag, i) => <TagChip key={i} tag={tag} />)}
            </View>
          )}
          <View style={styles.cardFooter}>
            <View style={styles.qtyRow}>
              <Ionicons name="layers-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.cardId, { color: colors.textMuted }]}>Qtd: {item.quantidade ?? 1}</Text>
            </View>
            <BaixarButton
              label={baixandoItemId === item.id ? "Baixando..." : "Baixar"}
              busy={baixandoItemId === item.id}
              onPress={() => handleBaixarItemNuvem(item, false)}
            />
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Card>
    );
  };

  const renderLinhaItem = ({ item }: { item: LinhaItem }) =>
    item.tipo === "local"
      ? renderItem({ item: item.item })
      : renderItemNuvem({ item: item.item });

  if (loading) {
    return (
      <Screen style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Carregando...</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={[styles.tabBar, { backgroundColor: colors.surfaceMuted, borderRadius: radius.pill }]}>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => mudarTab("analises")}
        >
          {tab === "analises" ? (
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.tabActive, { borderRadius: radius.pill }]}
            >
              <Text style={styles.tabTextActive}>Análises ({analises.length})</Text>
            </LinearGradient>
          ) : (
            <View style={styles.tabInactive}>
              <Text style={[styles.tabTextInactive, { color: colors.textSecondary }]}>Análises ({analises.length})</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => mudarTab("itens")}
        >
          {tab === "itens" ? (
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.tabActive, { borderRadius: radius.pill }]}
            >
              <Text style={styles.tabTextActive}>Itens ({itens.length})</Text>
            </LinearGradient>
          ) : (
            <View style={styles.tabInactive}>
              <Text style={[styles.tabTextInactive, { color: colors.textSecondary }]}>Itens ({itens.length})</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {tab === "itens" && (
        <>
          <View style={styles.filterRow}>
            <FilterChip label="Todos" active={filtroItens === "todos"} onPress={() => setFiltroItens("todos")} />
            <FilterChip label="Locais" active={filtroItens === "locais"} onPress={() => setFiltroItens("locais")} />
            <FilterChip
              label={carregandoItensNuvem ? "Carregando..." : "Nuvem"}
              active={filtroItens === "nuvem"}
              onPress={handleSelecionarNuvem}
            />
          </View>
          {opcoesCategorias.length > 0 && (
            <View style={styles.filtroSectionBox}>
              <Text style={[styles.filtroLabel, { color: colors.textMuted }]}>Categoria</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtroChips}>
                {opcoesCategorias.map((categoria) => (
                  <FiltroChip
                    key={categoria}
                    label={categoria}
                    active={categoriasFiltro.includes(categoria)}
                    onPress={() => toggleCategoria(categoria)}
                  />
                ))}
              </ScrollView>
            </View>
          )}
          {opcoesTags.length > 0 && (
            <View style={styles.filtroSectionBox}>
              <Text style={[styles.filtroLabel, { color: colors.textMuted }]}>Tags</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtroChips}>
                {opcoesTags.map((tag) => (
                  <FiltroChip
                    key={tag}
                    label={tag}
                    active={tagsFiltro.includes(tag)}
                    onPress={() => toggleTag(tag)}
                  />
                ))}
              </ScrollView>
            </View>
          )}
          {filtroAtivo && (
            <View style={styles.filtroBar}>
              <Text style={[styles.filtroCount, { color: colors.textSecondary }]}>
                {linhasFiltradas.length} de {linhasItens.length} itens
              </Text>
              <TouchableOpacity onPress={limparFiltros} activeOpacity={0.8}>
                <View style={[styles.filtroClearPill, { backgroundColor: colors.dangerSoft }]}>
                  <Ionicons name="close" size={13} color={colors.danger} />
                  <Text style={[styles.filtroClear, { color: colors.danger }]}>Limpar</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.syncBar}>
            <PrimaryButton
              title={syncing ? "Enviando..." : "Sincronizar"}
              onPress={handleSincronizar}
              disabled={!isConnected || syncing}
              icon="sync"
              style={styles.syncBtn}
            />
            <GhostButton
              title={downloading ? "Baixando..." : "Baixar todos"}
              onPress={handleBaixarRemotos}
              disabled={!isConnected || downloading}
              icon="download-outline"
              style={styles.syncBtn}
            />
          </View>
        </>
      )}

      {tab === "analises" && (
        <View style={styles.syncBar}>
          <PrimaryButton
            title={carregandoNuvem ? "Carregando..." : "Análises da nuvem"}
            onPress={handleCarregarNuvem}
            disabled={!isConnected || carregandoNuvem}
            icon="cloud-download-outline"
            style={styles.syncBtnFull}
          />
        </View>
      )}

      {!isConnected && (
        <View style={[styles.offlineBar, { backgroundColor: colors.warningSoft, borderRadius: radius.md }]}>
          <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
          <Text style={[styles.offlineText, { color: colors.warning }]}>Offline</Text>
        </View>
      )}

      {tab === "analises" ? (
        analises.length === 0 && (!analisesNuvem || analisesNuvem.length === 0) ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceMuted }]}>
              <Ionicons name="document-text-outline" size={34} color={colors.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Nenhuma análise registrada</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>Tire uma foto para começar</Text>
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
            contentContainerStyle={styles.listContent}
          />
        )
      ) : (
        linhasFiltradas.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceMuted }]}>
              <Ionicons name={filtroAtivo ? "funnel-outline" : "cube-outline"} size={34} color={colors.textMuted} />
            </View>
            {filtroAtivo ? (
              <>
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Nenhum item corresponde ao filtro</Text>
                <TouchableOpacity
                  style={[styles.clearFiltersButton, { backgroundColor: colors.dangerSoft, borderRadius: radius.pill }]}
                  onPress={limparFiltros}
                >
                  <Text style={[styles.clearFiltersButtonText, { color: colors.danger }]}>Limpar filtros</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  {filtroItens === "nuvem"
                    ? "Nenhum item na nuvem"
                    : filtroItens === "locais"
                      ? "Nenhum item local"
                      : "Nenhum item salvo"}
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  {filtroItens === "nuvem" && erroItensNuvem
                    ? erroItensNuvem
                    : filtroItens === "nuvem"
                      ? carregandoItensNuvem
                        ? "Carregando..."
                        : "Nenhum item na nuvem"
                      : filtroItens === "locais"
                        ? "Salve um item a partir de uma análise"
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
            contentContainerStyle={styles.listContent}
          />
        )
      )}
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
  tabBar: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
  },
  tabActive: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
  },
  tabInactive: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
  },
  tabTextActive: {
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.body,
    color: "#FFFFFF",
  },
  tabTextInactive: {
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.body,
  },
  filterRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  filterChipGradient: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  filterChipTextActive: {
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.body,
    color: "#FFFFFF",
  },
  filterChipIdle: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterChipTextIdle: {
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.body,
  },
  filtroChipGradient: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  filtroChipTextActive: {
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.caption,
    color: "#FFFFFF",
  },
  filtroChipIdle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filtroChipTextIdle: {
    fontFamily: FONT.medium,
    fontSize: FONT_SIZES.caption,
  },
  filtroSectionBox: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  filtroLabel: {
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.caption,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
    paddingHorizontal: 2,
  },
  filtroChips: {
    paddingRight: spacing.xs,
    gap: spacing.sm,
  },
  filtroBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  filtroCount: {
    fontFamily: FONT.medium,
    fontSize: FONT_SIZES.caption,
  },
  filtroClearPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  filtroClear: {
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.caption,
  },
  clearFiltersButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  clearFiltersButtonText: {
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.body,
  },
  syncBar: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  syncBtn: {
    flex: 1,
  },
  syncBtnFull: {
    flex: 1,
  },
  offlineBar: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  offlineText: {
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.body,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.bodyLarge,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontFamily: FONT.regular,
    fontSize: FONT_SIZES.body,
    textAlign: "center",
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  card: {
    padding: spacing.md,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  thumb: {
    width: 64,
    height: 64,
  },
  thumbFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: {
    flex: 1,
    marginLeft: spacing.md,
    justifyContent: "center",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: 2,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.caption,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    maxWidth: "70%",
  },
  categoryChipText: {
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.caption,
  },
  cloudChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  cloudChipText: {
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.caption,
  },
  localChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  localChipText: {
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.caption,
  },
  syncChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  syncChipText: {
    fontFamily: FONT.medium,
    fontSize: 11,
  },
  cardObject: {
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.body,
    marginTop: 2,
  },
  cardDate: {
    fontFamily: FONT.regular,
    fontSize: 11,
  },
  cardDesc: {
    fontFamily: FONT.regular,
    fontSize: FONT_SIZES.caption,
    marginTop: 1,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cardId: {
    fontFamily: FONT.regular,
    fontSize: 11,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: spacing.xs,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    maxWidth: 110,
  },
  tagText: {
    fontFamily: FONT.medium,
    fontSize: 11,
  },
  downloadChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  downloadChipText: {
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.caption,
    color: "#FFFFFF",
  },
  cta: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
  },
  ctaGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  ctaText: {
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.caption,
    color: "#FFFFFF",
  },
  cloudHeader: {
    fontFamily: FONT.extrabold,
    fontSize: FONT_SIZES.body,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
});
