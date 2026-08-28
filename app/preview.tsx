import { useState, useEffect, useRef } from "react";
import { StyleSheet, View, Image, TouchableOpacity, Text, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import { criarAnalise, atualizarAnalise } from "../src/db/queries";
import NetInfo from "@react-native-community/netinfo";
import { analisarImagem } from "../src/services/visionApi";
import { syncAnalisePeloId } from "../src/services/sync";

export default function PreviewScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const uriRef = useRef(uri);
  const photoUsedRef = useRef(false);
  const analysisIdRef = useRef<string | null>(null);

  useEffect(() => {
    uriRef.current = uri;
  }, [uri]);

  // Cleanup só no unmount real da tela
  useEffect(() => {
    return () => {
      if (!photoUsedRef.current && uriRef.current) {
        FileSystem.deleteAsync(uriRef.current, { idempotent: true })
          .catch((e) => console.warn("Cleanup temp photo failed:", e));
      }
    };
  }, []);

  const handleUsarFoto = async () => {
    if (!uri) return;

    // Guarda contra uso duplicado da mesma foto (nunca criar 2 análises para ela)
    if (analysisIdRef.current) {
      router.push({ pathname: "/revisao", params: { uri, analysisId: analysisIdRef.current } } as any);
      return;
    }

    setSaving(true);
    photoUsedRef.current = true;
    try {
      const id = criarAnalise({ imagem_uri: uri, status: "pendente" });
      analysisIdRef.current = id;

      // Verificar conectividade e chamar API se online
      const netInfo = await NetInfo.fetch();
      if (netInfo.isConnected && netInfo.isInternetReachable) {
        setAnalyzing(true);
        try {
          const result = await analisarImagem(uri, id);
          atualizarAnalise(id, {
            objeto_detectado: result.objetoPrincipal,
            labels_json: JSON.stringify(result.labels),
            status: "processado",
          });
          syncAnalisePeloId(id);
        } catch {
          atualizarAnalise(id, { status: "erro" });
        } finally {
          setAnalyzing(false);
        }
      } else {
        console.log("[Preview] Offline - analysis queued as pendente", { id });
      }

      // Firmar o stack: remove camera+preview e pousa a revisão sobre a Home.
      // Voltar do Revisão cai na tela inicial, sem preview órfão no meio.
      try {
        router.dismissTo("/");
        setTimeout(() => {
          router.push({ pathname: "/revisao", params: { uri, analysisId: id } } as any);
        }, 50);
      } catch {
        router.replace({ pathname: "/revisao", params: { uri, analysisId: id } } as any);
      }
    } catch (error) {
      console.error("Erro ao salvar foto:", error);
      Alert.alert("Erro", "Não foi possível salvar a foto");
      photoUsedRef.current = false;
    } finally {
      setSaving(false);
    }
  };

  const handleTirarDeNovo = async () => {
    if (uri) {
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch (error) {
        console.warn("Erro ao limpar foto:", error);
      }
    }
    router.back();
  };

  if (!uri) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image source={{ uri }} style={styles.image} resizeMode="contain" />
      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={handleTirarDeNovo} activeOpacity={0.7} disabled={saving || analyzing}>
          <Text style={styles.buttonTextSecondary}>Tirar de novo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={handleUsarFoto} activeOpacity={0.7} disabled={saving || analyzing}>
          <Text style={styles.buttonTextPrimary}>
            {saving ? "Salvando..." : analyzing ? "Analisando..." : "Usar esta foto"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  image: {
    flex: 1,
    width: "100%",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 30,
    paddingHorizontal: 20,
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 8,
    minWidth: 140,
  },
  buttonPrimary: {
    backgroundColor: "#fff",
  },
  buttonSecondary: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "#fff",
  },
  buttonTextPrimary: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonTextSecondary: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingText: {
    color: "#fff",
    fontSize: 18,
    textAlign: "center",
  },
});