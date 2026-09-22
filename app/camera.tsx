import { useState, useEffect, useRef } from "react";
import { StyleSheet, Text, View, TouchableOpacity, Alert, useWindowDimensions } from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";

const RATIO = 4 / 3;

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraType, setCameraType] = useState<CameraType>("back");
  const cameraRef = useRef<CameraView>(null);
  const [isMounted, setIsMounted] = useState(false);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isLandscape = width > height;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <View style={styles.container} />;
  }

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Câmera não disponível</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Permitir acesso à câmera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Permissão de câmera negada</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const processAndNavigate = async (sourceUri: string) => {
    const dir = `${FileSystem.documentDirectory}fotos/`;
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }

    const filename = `foto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
    const destUri = `${dir}${filename}`;

    const manipulated = await ImageManipulator.manipulateAsync(
      sourceUri,
      [{ resize: { width: 1280 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: false }
    );

    await FileSystem.moveAsync({
      from: manipulated.uri,
      to: destUri,
    });

    const fileInfo = await FileSystem.getInfoAsync(destUri);
    if (!fileInfo.exists) {
      throw new Error("Falha ao mover arquivo para diretório permanente");
    }

    router.push({ pathname: "/preview", params: { uri: destUri } } as any);
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
          exif: false,
        });
        if (photo) {
          await processAndNavigate(photo.uri);
          FileSystem.deleteAsync(photo.uri, { idempotent: true }).catch(() => {});
        }
      } catch (error) {
        console.error("Erro ao processar foto:", error);
        Alert.alert("Erro", "Não foi possível processar a foto");
      }
    }
  };

  const flipCamera = () => {
    setCameraType((prev) => (prev === "back" ? "front" : "back"));
  };

  if (!isMounted) {
    return <View style={styles.container} />;
  }

  const frame = isLandscape
    ? (() => {
        const h = height;
        const w = h * RATIO;
        if (w > width) {
          return { width: Math.round(width), height: Math.round(width / RATIO) };
        }
        return { width: Math.round(w), height: Math.round(h) };
      })()
    : (() => {
        const w = width;
        return { width: Math.round(w), height: Math.round(w * 4 / 3) };
      })();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <CameraView
        ref={cameraRef}
        style={{ width: frame.width, height: frame.height }}
        facing={cameraType}
        autofocus="on"
        ratio="4:3"
      />

      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + 12, left: insets.left + 16 }]}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <Ionicons name="close" size={22} color="#FFFFFF" />
      </TouchableOpacity>

      {isLandscape ? (
        <View style={[styles.controlsLandscape, { right: insets.right + 20 }]}>
          <TouchableOpacity style={styles.iconButton} onPress={flipCamera} activeOpacity={0.7}>
            <Ionicons name="camera-reverse-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.captureButton} onPress={takePicture} activeOpacity={0.7}>
            <View style={styles.captureInner} />
          </TouchableOpacity>
          <View style={styles.landscapeBalance} />
        </View>
      ) : (
        <View style={[styles.controls, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.captureLayer}>
            <TouchableOpacity style={styles.captureButton} onPress={takePicture} activeOpacity={0.7}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.iconButton, styles.flipPortrait, { right: insets.right + 24 }]}
            onPress={flipCamera}
            activeOpacity={0.7}
          >
            <Ionicons name="camera-reverse-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  backButton: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  controls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 30,
  },
  captureLayer: {
    alignItems: "center",
  },
  flipPortrait: {
    position: "absolute",
    top: 40,
  },
  controlsLandscape: {
    position: "absolute",
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
  },
  landscapeBalance: {
    height: 60,
  },
  iconButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
  },
  text: {
    color: "#fff",
    fontSize: 18,
    marginBottom: 20,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
});