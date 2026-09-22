import { PropsWithChildren } from "react";
import { StyleSheet, TouchableOpacity, View, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "../theme";

type CardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
}>;

export function Card({ children, style, contentStyle, onPress, onLongPress }: CardProps) {
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
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} onLongPress={onLongPress} style={baseStyle}>
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