import { StyleSheet, StyleProp, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { IoniconName } from "./icons";

type IconPillProps = {
  name: IoniconName;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function IconPill({ name, size = 24, style }: IconPillProps) {
  const { colors, radius, shadows } = useTheme();

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.base,
        { width: 54, height: 54, borderRadius: radius.lg, ...shadows.button },
        style,
      ]}
    >
      <Ionicons name={name} size={size} color="#FFFFFF" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
});