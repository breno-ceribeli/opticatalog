import { PropsWithChildren } from "react";
import { StyleSheet, TouchableOpacity, View, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "../theme";

type CardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}>;

export function Card({ children, style, onPress, contentStyle }: CardProps) {
  const { colors, radius, shadows } = useTheme();

  const baseStyle = [
    styles.base,
    {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderColor: colors.border,
      ...shadows.card,
    },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={baseStyle}>
        <View style={contentStyle}>{children}</View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={baseStyle}>
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
});