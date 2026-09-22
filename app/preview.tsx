import { useState, useEffect, useRef } from "react";
import { StyleSheet, View, Image, TouchableOpacity, Text, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import { criarAnalise, atualizarAnalise } from "../src/db/queries";
import NetInfo from "@react-native-community/netinfo";
import { analisarImagem } from "../src/services/visionApi";
import { syncAnalisePeloId } from "../src/services/sync";
import { PrimaryButton } from "../src/components";
import { FONT, FONT_SIZES, spacing, radius } from "../src/theme";

export default function PreviewScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const uriRef = useRef(uri);
  const photoUsedRef = useRef(false);
  const analysisIdRef = useRef<string | null>(null);
  const insets = useSafeAreaInsets();

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
      <StatusBar style="light" />
      <Text style={[styles.hint, { top: insets.top + 12 }]}>Confira a foto</Text>
      <Image source={{ uri }} style={styles.image} resizeMode="contain" />
      <View style={[styles.buttonRow, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderRadius: radius.md }]}
          onPress={handleTirarDeNovo}
          activeOpacity={0.7}
          disabled={saving || analyzing}
        >
          <Ionicons name="camera-reverse-outline" size={18} color="#FFFFFF" />
          <Text style={styles.secondaryBtnText}>Tirar de novo</Text>
        </TouchableOpacity>
        <PrimaryButton
          title={saving ? "Salvando..." : analyzing ? "Analisando..." : "Usar esta foto"}
          icon={saving || analyzing ? undefined : "checkmark"}
          onPress={handleUsarFoto}
          disabled={saving || analyzing}
          style={[
            styles.primaryBtn,
            {
              borderRadius: radius.md,
              opacity: saving || analyzing ? 0.8 : 1,
            },
          ]}
        />
        {(saving || analyzing) && <ActivityIndicator size="small" color="#FFFFFF" style={styles.progress} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  hint: {
    position: "absolute",
    alignSelf: "center",
    color: "#FFFFFF",
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.body,
    letterSpacing: 0.4,
  },
  image: {
    flex: 1,
    width: "100%",
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingTop: 20,
    paddingHorizontal: spacing.lg,
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.75)",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.6)",
    backgroundColor: "rgba(255,255,255,0.1)",
    flexShrink: 1,
  },
  secondaryBtnText: {
    color: "#FFFFFF",
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.body,
  },
  primaryBtn: {
    flex: 1,
    minWidth: 160,
  },
  progress: {
    position: "absolute",
    right: spacing.lg,
  },
  loadingText: {
    color: "#fff",
    fontSize: 18,
    textAlign: "center",
  },
});