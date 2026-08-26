import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import NetInfo from "@react-native-community/netinfo";
import { supabase } from "./supabase";
import {
  Analise,
  ItemInventario,
  listarAnalisesNaoSincronizadas,
  marcarAnaliseSincronizada,
  listarItensNaoSincronizados,
  marcarItemSincronizado,
  obterAnalise,
  obterItemPorId,
  criarAnalise,
  criarItemInventario,
} from "../db/queries";

const BUCKET = "fotos-inventario";
const FOTOS_DIR = FileSystem.documentDirectory + "fotos/";

let syncEmAndamento = false;

// ─── Helpers de mapeamento ──────────────────────────────────────────

function paraTimestampSupabase(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

function paraAnaliseSupabase(a: Analise) {
  return {
    id: a.id,
    imagem_url: null as string | null,
    objeto_detectado: a.objeto_detectado,
    labels: a.labels_json ? JSON.parse(a.labels_json) : null,
    texto_ocr: a.texto_ocr,
    status: a.status,
    criado_em: paraTimestampSupabase(a.criado_em),
  };
}

function paraItemSupabase(item: ItemInventario) {
  return {
    id: item.id,
    analise_origem_id: item.analise_origem_id,
    nome: item.nome,
    categoria: item.categoria,
    tags: item.tags_json ? JSON.parse(item.tags_json) : null,
    descricao: item.descricao,
    identificador_ocr: item.identificador_ocr,
    quantidade: item.quantidade,
    criado_em: paraTimestampSupabase(item.criado_em),
    atualizado_em: paraTimestampSupabase(item.atualizado_em),
  };
}

// ─── Upload / Download de imagens ───────────────────────────────────

export async function uploadImagemLocal(
  uri: string,
  id: string
): Promise<string> {
  const fileInfo = await FileSystem.getInfoAsync(uri);
  if (!fileInfo.exists) throw new Error(`Arquivo não encontrado: ${uri}`);

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const arrayBuffer = decode(base64);
  const path = `${id}.jpg`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return publicUrl;
}

export async function downloadImagemRemota(
  url: string,
  id: string
): Promise<string> {
  await FileSystem.makeDirectoryAsync(FOTOS_DIR, { intermediates: true });
  const localPath = FOTOS_DIR + `${id}.jpg`;

  const { status } = await FileSystem.downloadAsync(url, localPath);
  if (status !== 200)
    throw new Error(`Download falhou com status ${status}`);

  return localPath;
}

export async function deletarImagemRemota(id: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([`${id}.jpg`]);
  if (error) console.warn("[Sync] Erro ao deletar imagem remota:", error);
}

// ─── Sync individual ────────────────────────────────────────────────

export async function sincronizarAnalise(
  analise: Analise
): Promise<{ success: boolean; error?: string }> {
  try {
    let imagemUrl: string | null = null;
    try {
      imagemUrl = await uploadImagemLocal(analise.imagem_uri, analise.id);
    } catch (e: any) {
      console.warn("[Sync] Upload imagem falhou, sincronizando sem ella:", e.message);
    }

    const dadosRemoto = paraAnaliseSupabase(analise);
    dadosRemoto.imagem_url = imagemUrl;

    const { error } = await supabase
      .from("analises")
      .upsert(dadosRemoto, { onConflict: "id" });

    if (error) throw error;

    marcarAnaliseSincronizada(analise.id);
    return { success: true };
  } catch (error: any) {
    console.error("[Sync] Erro sync analise:", error.message);
    return { success: false, error: error.message };
  }
}

export async function sincronizarItem(
  item: ItemInventario
): Promise<{ success: boolean; error?: string }> {
  try {
    const dadosRemoto = paraItemSupabase(item);

    const { error } = await supabase
      .from("itens_inventario")
      .upsert(dadosRemoto, { onConflict: "id" });

    if (error) throw error;

    marcarItemSincronizado(item.id);
    return { success: true };
  } catch (error: any) {
    console.error("[Sync] Erro sync item:", error.message);
    return { success: false, error: error.message };
  }
}

// ─── Sync por ID ( chamado direto nas telas ) ──────────────────────

export async function syncAnalisePeloId(id: string): Promise<void> {
  try {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected || !netInfo.isInternetReachable) return;

    const analise = obterAnalise(id);
    if (!analise || analise.sincronizado === 1) return;

    await sincronizarAnalise(analise);
  } catch {}
}

export async function syncItemPeloId(id: string): Promise<void> {
  try {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected || !netInfo.isInternetReachable) return;

    const item = obterItemPorId(id);
    if (!item || item.sincronizado === 1) return;

    await sincronizarItem(item);
  } catch {}
}

// ─── Sync principal ─────────────────────────────────────────────────

export async function sincronizarTudo(): Promise<{
  analisesSync: number;
  itensSync: number;
  erros: string[];
}> {
  if (syncEmAndamento) return { analisesSync: 0, itensSync: 0, erros: [] };

  const netInfo = await NetInfo.fetch();
  if (!netInfo.isConnected || !netInfo.isInternetReachable) {
    return { analisesSync: 0, itensSync: 0, erros: ["Sem internet"] };
  }

  syncEmAndamento = true;
  const erros: string[] = [];
  let analisesSync = 0;
  let itensSync = 0;

  try {
    const analises = listarAnalisesNaoSincronizadas();
    for (const a of analises) {
      const result = await sincronizarAnalise(a);
      if (result.success) analisesSync++;
      else if (result.error) erros.push(`Analise ${a.id.slice(0, 8)}: ${result.error}`);
    }

    const itens = listarItensNaoSincronizados();
    for (const item of itens) {
      const result = await sincronizarItem(item);
      if (result.success) itensSync++;
      else if (result.error) erros.push(`Item ${item.id.slice(0, 8)}: ${result.error}`);
    }
  } finally {
    syncEmAndamento = false;
  }

  if (erros.length > 0) {
    console.warn("[Sync] Erros na sincronização:", erros);
  }

  return { analisesSync, itensSync, erros };
}

// ─── Download de itens remotos ──────────────────────────────────────

export async function baixarItensRemotos(): Promise<{
  baixados: number;
  erros: string[];
}> {
  const netInfo = await NetInfo.fetch();
  if (!netInfo.isConnected || !netInfo.isInternetReachable) {
    return { baixados: 0, erros: ["Sem internet"] };
  }

  const erros: string[] = [];
  let baixados = 0;

  try {
    const { data: itensRemotos, error: fetchError } = await supabase
      .from("itens_inventario")
      .select("*");

    if (fetchError) throw fetchError;
    if (!itensRemotos || itensRemotos.length === 0) return { baixados: 0, erros: [] };

    for (const itemRemoto of itensRemotos) {
      const existente = obterItemPorId(itemRemoto.id);
      if (existente) continue;

      try {
        let imagemUriLocal: string | null = null;

        if (itemRemoto.analise_origem_id) {
          const { data: analiseRemota } = await supabase
            .from("analises")
            .select("id, imagem_url")
            .eq("id", itemRemoto.analise_origem_id)
            .single();

          if (analiseRemota?.imagem_url) {
            imagemUriLocal = await downloadImagemRemota(
              analiseRemota.imagem_url,
              itemRemoto.id
            );
          }

          if (analiseRemota) {
            const existenteAnalise = obterAnalise(analiseRemota.id);
            if (!existenteAnalise) {
              criarAnalise({
                id: analiseRemota.id,
                imagem_uri: imagemUriLocal ?? "",
                status: "processado",
              });
            }
          }
        }

        criarItemInventario({
          id: itemRemoto.id,
          analise_origem_id: itemRemoto.analise_origem_id ?? "",
          nome: itemRemoto.nome,
          categoria: itemRemoto.categoria ?? "",
          tags_json: itemRemoto.tags ? JSON.stringify(itemRemoto.tags) : undefined,
          descricao: itemRemoto.descricao ?? undefined,
          identificador_ocr: itemRemoto.identificador_ocr ?? undefined,
          imagem_uri: imagemUriLocal ?? undefined,
          quantidade: itemRemoto.quantidade ?? 1,
        });

        baixados++;
      } catch (e: any) {
        erros.push(`Item ${itemRemoto.id?.slice(0, 8)}: ${e.message}`);
      }
    }
  } catch (error: any) {
    erros.push(`Erro ao buscar itens remotos: ${error.message}`);
  }

  return { baixados, erros };
}

// ─── Exclusão remota ────────────────────────────────────────────────

export async function excluirRemoto(id: string): Promise<boolean> {
  try {
    await supabase.from("itens_inventario").delete().eq("id", id);
    await supabase.from("analises").delete().eq("id", id);
    await deletarImagemRemota(id);
    return true;
  } catch (error: any) {
    console.error("[Sync] Erro excluir remoto:", error);
    return false;
  }
}
