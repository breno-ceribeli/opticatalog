import { PropsWithChildren } from "react";
import { StyleProp, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme";

type ScreenProps = PropsWithChildren<{ style?: StyleProp<ViewStyle> }>;

export function Screen({ children, style }: ScreenProps) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[{ flex: 1, backgroundColor: colors.background }, style]}
    >
      {children}
    </SafeAreaView>
  );
}