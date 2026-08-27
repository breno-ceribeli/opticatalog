import { Stack } from "expo-router";
import { useEffect } from "react";
import NetInfo from "@react-native-community/netinfo";
import { iniciarBanco } from "../src/db/schema";
import { sincronizarTudo } from "../src/services/sync";

export default function RootLayout() {
  useEffect(() => {
    iniciarBanco();

    // Sync inicial ao abrir o app
    NetInfo.fetch().then((state) => {
      if (state.isConnected && state.isInternetReachable) {
        sincronizarTudo().catch(() => {});
      }
    });

    // Listener para reconexão
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        sincronizarTudo().catch(() => {});
      }
    });

    return unsubscribe;
  }, []);

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="camera" options={{ headerShown: false }} />
      <Stack.Screen name="preview" options={{ headerShown: false }} />
      <Stack.Screen name="revisao" options={{ title: "Revisar análise" }} />
      <Stack.Screen name="historico" options={{ title: "Inventário" }} />
    </Stack>
  );
}
