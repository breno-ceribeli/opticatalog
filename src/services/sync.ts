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
  criarItemInventario,
  listarItensPorAnalise,
  excluirItemInventario,
  excluirAnalise,
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
      console.warn("[Sync] Upload imagem falhou, sincronizando sem ela:", e.message);
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

// ─── Itens remotos (lista + download) ───────────────────────────────

export type ItemRemota = {
  id: string;
  analise_origem_id: string | null;
  nome: string;
  categoria: string | null;
  tags: unknown[] | null;
  descricao: string | null;
  identificador_ocr: string | null;
  quantidade: number | null;
  criado_em: string;
  atualizado_em: string;
  imagem_url: string | null;
};

export async function listarItensRemotos(): Promise<{
  itens: ItemRemota[];
  erros: string[];
}> {
  const netInfo = await NetInfo.fetch();
  if (!netInfo.isConnected || !netInfo.isInternetReachable) {
    return { itens: [], erros: ["Sem internet"] };
  }

  try {
    const { data, error } = await supabase
      .from("itens_inventario")
      .select("*")
      .order("atualizado_em", { ascending: false });

    if (error) return { itens: [], erros: [error.message] };

    const itens = await Promise.all(
      (data ?? []).map(async (item): Promise<ItemRemota> => {
        let imagem_url: string | null = null;
        if (item.analise_origem_id) {
          const { data: analise } = await supabase
            .from("analises")
            .select("imagem_url")
            .eq("id", item.analise_origem_id)
            .single();
          imagem_url = analise?.imagem_url ?? null;
        }
        return { ...item, imagem_url } as ItemRemota;
      })
    );

    return { itens, erros: [] };
  } catch (error: any) {
    return { itens: [], erros: [error.message] };
  }
}

export async function baixarItemRemoto(
  item: ItemRemota
): Promise<{ ok: boolean; erro?: string }> {
  try {
    if (obterItemPorId(item.id)) return { ok: true };

    let imagemUriLocal: string | null = null;
    if (item.imagem_url) {
      imagemUriLocal = await downloadImagemRemota(item.imagem_url, item.id);
    }

    criarItemInventario({
      id: item.id,
      analise_origem_id: item.analise_origem_id ?? "",
      nome: item.nome,
      categoria: item.categoria ?? "",
      tags_json: item.tags ? JSON.stringify(item.tags) : undefined,
      descricao: item.descricao ?? undefined,
      identificador_ocr: item.identificador_ocr ?? undefined,
      imagem_uri: imagemUriLocal ?? undefined,
      quantidade: item.quantidade ?? 1,
    });

    marcarItemSincronizado(item.id);
    return { ok: true };
  } catch (error: any) {
    return { ok: false, erro: error.message };
  }
}

export async function baixarItensRemotos(): Promise<{
  baixados: number;
  erros: string[];
}> {
  const { itens, erros } = await listarItensRemotos();
  if (erros.length > 0) return { baixados: 0, erros };

  let baixados = 0;
  for (const item of itens) {
    if (obterItemPorId(item.id)) continue;
    const result = await baixarItemRemoto(item);
    if (result.ok) baixados++;
    else if (result.erro) erros.push(`Item ${item.id.slice(0, 8)}: ${result.erro}`);
  }

  return { baixados, erros };
}

// ─── Downloads de análises (somente leitura, sem gravar local) ───────

export type AnaliseRemota = {
  id: string;
  imagem_url: string | null;
  objeto_detectado: string | null;
  labels: unknown[] | null;
  texto_ocr: string | null;
  status: string;
  criado_em: string;
};

export async function listarAnalisesRemotas(): Promise<{
  analises: AnaliseRemota[];
  erros: string[];
}> {
  const netInfo = await NetInfo.fetch();
  if (!netInfo.isConnected || !netInfo.isInternetReachable) {
    return { analises: [], erros: ["Sem internet"] };
  }

  try {
    const { data, error } = await supabase
      .from("analises")
      .select("*")
      .order("criado_em", { ascending: false });

    if (error) return { analises: [], erros: [error.message] };

    return { analises: (data ?? []) as AnaliseRemota[], erros: [] };
  } catch (error: any) {
    return { analises: [], erros: [error.message] };
  }
}

export async function obterAnaliseRemota(
  id: string
): Promise<AnaliseRemota | null> {
  const netInfo = await NetInfo.fetch();
  if (!netInfo.isConnected || !netInfo.isInternetReachable) return null;

  try {
    const { data, error } = await supabase
      .from("analises")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data as AnaliseRemota;
  } catch {
    return null;
  }
}

// ─── Exclusão remota ──────────────────────────────────────────────────

export async function excluirItemEmTodoLugar(itemId: string): Promise<boolean> {
  try {
    const item = obterItemPorId(itemId);
    const origemId = item?.analise_origem_id;

    await supabase.from("itens_inventario").delete().eq("id", itemId);
    if (origemId) {
      await supabase.from("analises").delete().eq("id", origemId);
      await deletarImagemRemota(origemId);
    }

    await excluirItemInventario(itemId);
    if (origemId) {
      const analiseLocal = obterAnalise(origemId);
      if (analiseLocal) await excluirAnalise(origemId);
    }
    return true;
  } catch (error: any) {
    console.error("[Sync] Erro excluir item em todo lugar:", error.message);
    return false;
  }
}

export async function excluirItemNuvem(itemId: string): Promise<boolean> {
  try {
    const { data: itemRemoto } = await supabase
      .from("itens_inventario")
      .select("analise_origem_id")
      .eq("id", itemId)
      .single();

    await supabase.from("itens_inventario").delete().eq("id", itemId);
    if (itemRemoto?.analise_origem_id) {
      await supabase.from("analises").delete().eq("id", itemRemoto.analise_origem_id);
      await deletarImagemRemota(itemRemoto.analise_origem_id);
    }
    return true;
  } catch (error: any) {
    console.error("[Sync] Erro excluir item na nuvem:", error.message);
    return false;
  }
}

export async function excluirAnaliseEmTodoLugar(id: string): Promise<boolean> {
  try {
    const itens = listarItensPorAnalise(id);

    for (const item of itens) {
      await supabase.from("itens_inventario").delete().eq("id", item.id);
    }
    await supabase.from("analises").delete().eq("id", id);
    await deletarImagemRemota(id);

    for (const item of itens) {
      await excluirItemInventario(item.id);
    }
    await excluirAnalise(id);
    return true;
  } catch (error: any) {
    console.error("[Sync] Erro excluir análise em todo lugar:", error.message);
    return false;
  }
}
