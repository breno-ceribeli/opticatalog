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

  return <Stack />;
}
