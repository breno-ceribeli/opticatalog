import { StyleSheet, Text, TouchableOpacity, StyleProp, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, FONT, FONT_SIZES } from "../theme";
import { IoniconName } from "./icons";

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: IoniconName;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({ title, onPress, disabled, icon, style }: PrimaryButtonProps) {
  const { colors, radius, shadows } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      disabled={disabled}
      style={style}
    >
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.base,
          {
            borderRadius: radius.md,
            opacity: disabled ? 0.5 : 1,
            ...shadows.button,
          },
        ]}
      >
        {icon && (
          <Ionicons name={icon} size={18} color="#FFFFFF" style={styles.icon} />
        )}
        <Text style={styles.text}>{title}</Text>
      </LinearGradient>
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
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: "#FFFFFF",
    fontFamily: FONT.semibold,
    fontSize: FONT_SIZES.body,
  },
});