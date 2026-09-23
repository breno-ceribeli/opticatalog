import { Stack } from "expo-router";
import { useEffect } from "react";
import { useFonts } from "expo-font";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import NetInfo from "@react-native-community/netinfo";
import { iniciarBanco } from "../src/db/schema";
import { sincronizarTudo } from "../src/services/sync";
import { ThemeProvider, useTheme, FONT } from "../src/theme";
import { ErrorBoundary } from "../src/components/ErrorBoundary";

function AppNavigator() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontFamily: FONT.semibold },
        headerTitleAlign: "center",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, orientation: "portrait" }} />
      <Stack.Screen name="camera" options={{ headerShown: false, orientation: "all" }} />
      <Stack.Screen name="preview" options={{ headerShown: false, orientation: "portrait" }} />
      <Stack.Screen name="revisao" options={{ title: "Análise", orientation: "portrait" }} />
      <Stack.Screen name="historico" options={{ title: "Inventário", orientation: "portrait" }} />
      <Stack.Screen name="item/[id]" options={{ title: "Item", orientation: "portrait" }} />
    </Stack>
  );
}

function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    try {
      iniciarBanco();
    } catch (e) {
      console.error("[DB] Erro ao inicializar banco:", e);
    }

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

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <AppNavigator />
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <RootLayout />
    </ErrorBoundary>
  );
}
