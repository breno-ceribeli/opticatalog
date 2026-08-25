import * as FileSystem from "expo-file-system/legacy";
import Constants from "expo-constants";

const API_KEY = Constants.expoConfig?.extra?.googleVisionApiKey ?? process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY;

export type VisionResult = {
  objetoPrincipal: string;
  labels: { name: string; score: number }[];
};

export type VisionError = {
  code: number;
  message: string;
};

async function imageToBase64(uri: string): Promise<string> {
  // Verificar se arquivo existe antes de tentar ler
  const fileInfo = await FileSystem.getInfoAsync(uri);
  console.log("[VisionAPI] File info:", { uri, exists: fileInfo.exists });
  
  if (!fileInfo.exists) {
    throw new Error(`Arquivo não encontrado: ${uri}`);
  }
  
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64;
}

function buildRequestBody(base64: string) {
  return {
    requests: [
      {
        image: { content: base64 },
        features: [
          { type: "LABEL_DETECTION", maxResults: 5 },
          { type: "OBJECT_LOCALIZATION", maxResults: 1 },
        ],
      },
    ],
  };
}

function parseResponse(data: any): VisionResult {
  const annotation = data.responses?.[0];

  const labels = annotation?.labelAnnotations
    ?.filter((l: any) => l.score >= 0.5)
    .slice(0, 5)
    .map((l: any) => ({ name: l.description, score: l.score })) ?? [];

  const object = annotation?.localizedObjectAnnotations?.[0];
  const objetoPrincipal = object?.score >= 0.5
    ? object.name
    : labels[0]?.name ?? "Objeto não identificado";

  return { objetoPrincipal, labels };
}

export async function analisarImagem(uri: string, analysisId: string): Promise<VisionResult> {
  if (!API_KEY) {
    const error = new Error("Chave da API Google Vision não configurada");
    (error as any).code = 500;
    throw error;
  }

  console.log("[VisionAPI] Request started", { analysisId, uri });

  try {
    const base64 = await imageToBase64(uri);
    console.log("[VisionAPI] Image converted to base64", { analysisId, length: base64.length });

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestBody(base64)),
      }
    );

    console.log("[VisionAPI] HTTP response", { analysisId, status: response.status });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.error?.message ?? `HTTP ${response.status}`;
      console.error("[VisionAPI] API Error", { analysisId, status: response.status, error: errorMsg });
      const error = new Error(errorMsg);
      (error as any).code = response.status;
      throw error;
    }

    if (data.responses?.[0]?.error) {
      const apiError = data.responses[0].error;
      console.error("[VisionAPI] API Response Error", { analysisId, error: apiError });
      const error = new Error(apiError.message);
      (error as any).code = apiError.code;
      throw error;
    }

    const result = parseResponse(data);
    console.log("[VisionAPI] Success", { analysisId, objetoPrincipal: result.objetoPrincipal, labelsCount: result.labels.length });

    return result;
  } catch (error: any) {
    console.error("[VisionAPI] Failed", { analysisId, error: error.message, code: error.code });
    throw error;
  }
}