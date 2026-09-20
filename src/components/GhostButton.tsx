import { StyleSheet, Text, TouchableOpacity, StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, FONT, FONT_SIZES } from "../theme";
import { IoniconName } from "./icons";

type GhostButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: IoniconName;
  style?: StyleProp<ViewStyle>;
};

export function GhostButton({ title, onPress, disabled, icon, style }: GhostButtonProps) {
  const { colors, radius } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.base,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.md,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {icon && (
        <Ionicons name={icon} size={18} color={colors.primary} style={styles.icon} />
      )}
      <Text style={[styles.text, { color: colors.textPrimary }]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.body,
  },
});