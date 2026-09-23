import { Component, ReactNode } from "react";
import { Text, View, StyleSheet } from "react-native";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Erro ao abrir o app</Text>
          <Text style={styles.message}>{String(this.state.error?.message ?? this.state.error)}</Text>
          <Text style={styles.stack}>{String(this.state.error?.stack ?? "")}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  message: {
    fontSize: 13,
    marginBottom: 12,
  },
  stack: {
    fontSize: 11,
    lineHeight: 15,
  },
});