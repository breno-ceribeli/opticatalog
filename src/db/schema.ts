import { openDatabaseSync } from "expo-sqlite";

export const db = openDatabaseSync("opticatalog.db");

export function iniciarBanco() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS analises (
      id TEXT PRIMARY KEY NOT NULL,
      imagem_uri TEXT NOT NULL,
      objeto_detectado TEXT,
      labels_json TEXT,
      texto_ocr TEXT,
      status TEXT NOT NULL DEFAULT 'pendente',
      criado_em INTEGER NOT NULL,
      sincronizado INTEGER NOT NULL DEFAULT 0
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS itens_inventario (
      id TEXT PRIMARY KEY NOT NULL,
      analise_origem_id TEXT NOT NULL,
      nome TEXT NOT NULL,
      categoria TEXT NOT NULL,
      tags_json TEXT,
      descricao TEXT,
      identificador_ocr TEXT,
      quantidade INTEGER NOT NULL DEFAULT 1,
      criado_em INTEGER NOT NULL,
      atualizado_em INTEGER NOT NULL,
      sincronizado INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (analise_origem_id) REFERENCES analises (id)
    );
  `);

  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_analises_status ON analises (status);
    CREATE INDEX IF NOT EXISTS idx_analises_sincronizado ON analises (sincronizado);
    CREATE INDEX IF NOT EXISTS idx_itens_sincronizado ON itens_inventario (sincronizado);
    CREATE INDEX IF NOT EXISTS idx_itens_identificador_ocr ON itens_inventario (identificador_ocr);
  `);
}