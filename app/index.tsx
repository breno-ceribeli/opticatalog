import { useState, useEffect, useRef } from "react";
import { StyleSheet, Text, View, TouchableOpacity, Alert } from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraType, setCameraType] = useState<CameraType>("back");
  const cameraRef = useRef<CameraView>(null);
  const [isMounted, setIsMounted] = useState(false);

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

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
          exif: false,
        });
        if (photo) {
          // Salvar imediatamente em local permanente para evitar erro de cache
          console.log("[Camera] documentDirectory:", FileSystem.documentDirectory);
          const dir = `${FileSystem.documentDirectory}fotos/`;
          console.log("[Camera] Target dir:", dir);
          const dirInfo = await FileSystem.getInfoAsync(dir);
          if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
          }

          const filename = `foto_${Date.now()}.jpg`;
          const destUri = `${dir}${filename}`;

          const manipulated = await ImageManipulator.manipulateAsync(
            photo.uri,
            [{ resize: { width: 1280 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: false }
          );

          await FileSystem.moveAsync({
            from: manipulated.uri,
            to: destUri,
          });

          // Verificar se arquivo foi criado corretamente
          const fileInfo = await FileSystem.getInfoAsync(destUri);
          console.log("[Camera] File moved:", { destUri, exists: fileInfo.exists });
          console.log("[Camera] Source URI was:", manipulated.uri);
          if (!fileInfo.exists) {
            throw new Error("Falha ao mover arquivo para diretório permanente");
          }

          router.push({ pathname: "/preview", params: { uri: destUri } } as any);
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

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={cameraType}
        autofocus="on"
      />
      <View style={styles.controls}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push("/historico")} activeOpacity={0.7}>
          <Text style={styles.iconText}>📋</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.captureButton} onPress={takePicture} activeOpacity={0.7}>
          <View style={styles.captureInner} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={flipCamera} activeOpacity={0.7}>
          <Text style={styles.iconText}>🔄</Text>
        </TouchableOpacity>
      </View>
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
  camera: {
    flex: 1,
    width: "100%",
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 30,
    width: "100%",
    position: "absolute",
    bottom: 0,
  },
  iconButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  iconText: {
    fontSize: 24,
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
  spacer: {
    width: 60,
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