import { db } from "./schema";
import * as FileSystem from "expo-file-system/legacy";
import NetInfo from "@react-native-community/netinfo";
import { analisarImagem } from "../services/visionApi";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}


export type Analise = {
  id: string;
  imagem_uri: string;
  objeto_detectado: string | null;
  labels_json: string | null;
  texto_ocr: string | null;
  status: "pendente" | "processado" | "erro";
  criado_em: number;
  sincronizado: 0 | 1;
};

export type ItemInventario = {
  id: string;
  analise_origem_id: string;
  nome: string;
  categoria: string;
  tags_json: string | null;
  descricao: string | null;
  identificador_ocr: string | null;
  quantidade: number;
  criado_em: number;
  atualizado_em: number;
  sincronizado: 0 | 1;
};

export function criarAnalise(dados: {
  imagem_uri: string;
  objeto_detectado?: string;
  labels_json?: string;
  texto_ocr?: string;
  status?: "pendente" | "processado" | "erro";
}): string {
  const id = generateUUID();
  const agora = Date.now();

  db.runSync(
    `INSERT INTO analises (id, imagem_uri, objeto_detectado, labels_json, texto_ocr, status, criado_em, sincronizado)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      dados.imagem_uri,
      dados.objeto_detectado ?? null,
      dados.labels_json ?? null,
      dados.texto_ocr ?? null,
      dados.status ?? "pendente",
      agora,
    ]
  );

  return id;
}

export function listarAnalises(): Analise[] {
  return db.getAllSync<Analise>(
    `SELECT * FROM analises ORDER BY criado_em DESC`
  );
}

export function obterAnalise(id: string): Analise | null {
  return db.getFirstSync<Analise>(`SELECT * FROM analises WHERE id = ?`, [id]) ?? null;
}

export function atualizarAnalise(
  id: string,
  dados: Partial<Pick<Analise, "objeto_detectado" | "labels_json" | "texto_ocr" | "status">>
): void {
  const campos: string[] = [];
  const valores: (string | null)[] = [];

  if (dados.objeto_detectado !== undefined) {
    campos.push("objeto_detectado = ?");
    valores.push(dados.objeto_detectado);
  }
  if (dados.labels_json !== undefined) {
    campos.push("labels_json = ?");
    valores.push(dados.labels_json);
  }
  if (dados.texto_ocr !== undefined) {
    campos.push("texto_ocr = ?");
    valores.push(dados.texto_ocr);
  }
  if (dados.status !== undefined) {
    campos.push("status = ?");
    valores.push(dados.status);
  }

  if (campos.length === 0) return;

  valores.push(id);
  db.runSync(`UPDATE analises SET ${campos.join(", ")} WHERE id = ?`, valores);
}

export function marcarAnaliseSincronizada(id: string): void {
  db.runSync(`UPDATE analises SET sincronizado = 1 WHERE id = ?`, [id]);
}

export function listarAnalisesNaoSincronizadas(): Analise[] {
  return db.getAllSync<Analise>(
    `SELECT * FROM analises WHERE sincronizado = 0 ORDER BY criado_em DESC`
  );
}

export async function excluirAnalise(id: string): Promise<boolean> {
  const analise = obterAnalise(id);
  if (!analise) return false;

  try {
    const fileInfo = await FileSystem.getInfoAsync(analise.imagem_uri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(analise.imagem_uri, { idempotent: true });
    }
  } catch (error) {
    console.warn("Erro ao deletar arquivo de imagem:", error);
  }

  db.runSync(`DELETE FROM analises WHERE id = ?`, [id]);
  return true;
}

export function criarItemInventario(dados: {
  analise_origem_id: string;
  nome: string;
  categoria: string;
  tags_json?: string;
  descricao?: string;
  identificador_ocr?: string;
  quantidade?: number;
}): string {
  const id = generateUUID();
  const agora = Date.now();

  db.runSync(
    `INSERT INTO itens_inventario (id, analise_origem_id, nome, categoria, tags_json, descricao, identificador_ocr, quantidade, criado_em, atualizado_em, sincronizado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      dados.analise_origem_id,
      dados.nome,
      dados.categoria,
      dados.tags_json ?? null,
      dados.descricao ?? null,
      dados.identificador_ocr ?? null,
      dados.quantidade ?? 1,
      agora,
      agora,
    ]
  );

  return id;
}

export function listarItensInventario(): ItemInventario[] {
  return db.getAllSync<ItemInventario>(
    `SELECT * FROM itens_inventario ORDER BY criado_em DESC`
  );
}

export function obterItemPorAnalise(analiseId: string): ItemInventario | null {
  return db.getFirstSync<ItemInventario>(
    `SELECT * FROM itens_inventario WHERE analise_origem_id = ?`,
    [analiseId]
  ) ?? null;
}

export function atualizarItemInventario(
  id: string,
  dados: Partial<Pick<ItemInventario, "nome" | "categoria" | "tags_json" | "descricao" | "identificador_ocr" | "quantidade">>
): void {
  const campos: string[] = [];
  const valores: (string | null)[] = [];

  if (dados.nome !== undefined) {
    campos.push("nome = ?");
    valores.push(dados.nome);
  }
  if (dados.categoria !== undefined) {
    campos.push("categoria = ?");
    valores.push(dados.categoria);
  }
  if (dados.tags_json !== undefined) {
    campos.push("tags_json = ?");
    valores.push(dados.tags_json);
  }
  if (dados.descricao !== undefined) {
    campos.push("descricao = ?");
    valores.push(dados.descricao);
  }
  if (dados.identificador_ocr !== undefined) {
    campos.push("identificador_ocr = ?");
    valores.push(dados.identificador_ocr);
  }
  if (dados.quantidade !== undefined) {
    campos.push("quantidade = ?");
    valores.push(String(dados.quantidade));
  }

  if (campos.length === 0) return;

  const agora = Date.now();
  campos.push("atualizado_em = ?");
  valores.push(String(agora));
  campos.push("sincronizado = 0");

  valores.push(id);
  db.runSync(`UPDATE itens_inventario SET ${campos.join(", ")} WHERE id = ?`, valores);
}

export function excluirItemInventario(id: string): boolean {
  db.runSync(`DELETE FROM itens_inventario WHERE id = ?`, [id]);
  return true;
}

export async function reanalisarAnalise(id: string): Promise<{ success: boolean; error?: string }> {
  const analise = obterAnalise(id);
  if (!analise) return { success: false, error: "Análise não encontrada" };

  const netInfo = await NetInfo.fetch();
  if (!netInfo.isConnected || !netInfo.isInternetReachable) {
    return { success: false, error: "Sem conexão com a internet" };
  }

  try {
    atualizarAnalise(id, { status: "pendente" });
    const result = await analisarImagem(analise.imagem_uri, id);
    atualizarAnalise(id, {
      objeto_detectado: result.objetoPrincipal,
      labels_json: JSON.stringify(result.labels),
      status: "processado",
    });
    return { success: true };
  } catch (error: any) {
    atualizarAnalise(id, { status: "erro" });
    return { success: false, error: error.message };
  }
}