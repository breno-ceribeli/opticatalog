import { useEffect, useState } from "react";
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { listarAnalises, Analise, excluirAnalise } from "../src/db/queries";

export default function HistoricoScreen() {
  const [analises, setAnalises] = useState<Analise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarAnalises();
  }, []);

  const carregarAnalises = () => {
    setLoading(true);
    const dados = listarAnalises();
    setAnalises(dados);
    setLoading(false);
  };

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

  const handleExcluir = async (id: string) => {
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
              carregarAnalises();
            } else {
              Alert.alert("Erro", "Não foi possível excluir a análise");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Carregando histórico...</Text>
      </View>
    );
  }

  if (analises.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Nenhuma análise registrada</Text>
        <Text style={styles.emptySubtext}>Tire uma foto para começar</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Histórico de Análises</Text>
      <FlatList
        data={analises}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({ pathname: "/revisao", params: { uri: item.imagem_uri, analysisId: item.id } } as any)}
            onLongPress={() => handleExcluir(item.id)}
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
                <Text style={styles.cardId}>ID: {item.id.slice(0, 8)}...</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingTop: 50,
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
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    paddingHorizontal: 20,
    paddingBottom: 16,
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
  cardId: {
    fontSize: 11,
    color: "#999",
    fontFamily: "monospace",
  },
  separator: {
    height: 12,
  },
});