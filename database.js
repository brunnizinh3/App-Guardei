/* ==========================================================================
   GUARDEI — OPERAÇÕES DE BANCO DE DADOS (js/database.js)
   CRUD completo na tabela `itens` do Supabase.
   ========================================================================== */

import { supabase, TABELA_ITENS, CATEGORIA_PADRAO } from './config.js';
import { enviarImagem, obterUrlImagem, removerImagem } from './storage.js';
import {
  detectarTipoConteudo,
  gerarTituloAutomatico,
  normalizarUrl,
  parseTags
} from './utils.js';

/**
 * Lista todos os itens do usuário ordenados do mais recente para o mais antigo,
 * anexando `imagem_preview_url` quando o item for do tipo 'imagem'.
 * @returns {Promise<{ itens: Array<Object>, error: Error | null }>}
 */
export async function listarItens() {
  const { data, error } = await supabase
    .from(TABELA_ITENS)
    .select('*')
    .order('criado_em', { ascending: false });

  if (error) {
    return { itens: [], error };
  }

  // Gera URLs temporárias apenas para os itens que possuem imagem
  const itensEnriquecidos = await Promise.all(
    (data || []).map(async (item) => {
      if (item.tipo === 'imagem' && item.imagem_url) {
        const previewUrl = await obterUrlImagem(item.imagem_url);
        return { ...item, imagem_preview_url: previewUrl };
      }
      return { ...item, imagem_preview_url: null };
    })
  );

  return { itens: itensEnriquecidos, error: null };
}

/**
 * Cria um novo registro no Guardei (texto, link ou imagem) de forma ultra-rápida.
 * @param {{
 *   userId: string,
 *   conteudo?: string,
 *   arquivoImagem?: File | null,
 *   titulo?: string,
 *   descricao?: string,
 *   categoria?: string,
 *   tags?: string | string[],
 *   favorito?: boolean
 * }} dados
 * @returns {Promise<{ item: Object | null, error: Error | null }>}
 */
export async function criarItem(dados) {
  const {
    userId,
    conteudo = '',
    arquivoImagem = null,
    titulo = '',
    descricao = '',
    categoria = CATEGORIA_PADRAO,
    tags = [],
    favorito = false
  } = dados;

  let tipo = 'texto';
  let conteudoFinal = conteudo.trim();
  let imagemUrl = null;
  let imagemPreviewUrl = null;

  // 1. Se houver imagem, prioriza o tipo 'imagem' (captura ultra-rápida)
  if (arquivoImagem) {
    tipo = 'imagem';
    const upload = await enviarImagem(arquivoImagem, userId);
    if (upload.error) {
      return { item: null, error: upload.error };
    }
    imagemUrl = upload.path;
    imagemPreviewUrl = upload.signedUrl;
  } else {
    // 2. Caso contrário, detecta se é 'link' ou 'texto'
    tipo = detectarTipoConteudo(conteudoFinal);
    if (tipo === 'link') {
      conteudoFinal = normalizarUrl(conteudoFinal);
    }
  }

  const tituloFinal =
    (titulo || '').trim() ||
    gerarTituloAutomatico({ tipo, conteudo: conteudoFinal });

  const novoRegistro = {
    user_id: userId,
    tipo,
    titulo: tituloFinal,
    conteudo: tipo === 'imagem' ? conteudoFinal : conteudoFinal,
    imagem_url: imagemUrl,
    descricao: (descricao || '').trim(),
    categoria: categoria || CATEGORIA_PADRAO,
    tags: parseTags(tags),
    favorito: Boolean(favorito)
  };

  const { data, error } = await supabase
    .from(TABELA_ITENS)
    .insert(novoRegistro)
    .select()
    .single();

  if (error) {
    return { item: null, error };
  }

  return {
    item: { ...data, imagem_preview_url: imagemPreviewUrl },
    error: null
  };
}

/**
 * Atualiza os campos editáveis de um registro existente.
 * @param {string} id
 * @param {{ titulo?: string, descricao?: string, categoria?: string, tags?: string | string[], favorito?: boolean }} campos
 * @returns {Promise<{ item: Object | null, error: Error | null }>}
 */
export async function atualizarItem(id, campos) {
  const payload = {};

  if (campos.titulo !== undefined) payload.titulo = campos.titulo.trim();
  if (campos.descricao !== undefined) payload.descricao = campos.descricao.trim();
  if (campos.categoria !== undefined) payload.categoria = campos.categoria;
  if (campos.tags !== undefined) payload.tags = parseTags(campos.tags);
  if (campos.favorito !== undefined) payload.favorito = Boolean(campos.favorito);

  const { data, error } = await supabase
    .from(TABELA_ITENS)
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return { item: null, error };
  }

  const previewUrl =
    data.tipo === 'imagem' && data.imagem_url
      ? await obterUrlImagem(data.imagem_url)
      : null;

  return {
    item: { ...data, imagem_preview_url: previewUrl },
    error: null
  };
}

/**
 * Alterna rapidamente o estado de favorito de um item.
 * @param {string} id
 * @param {boolean} estadoAtual
 */
export async function alternarFavorito(id, estadoAtual) {
  return atualizarItem(id, { favorito: !estadoAtual });
}

/**
 * Exclui um item da tabela e, se tiver imagem no Storage, remove o arquivo também.
 * @param {{ id: string, imagem_url?: string | null }} item
 * @returns {Promise<{ error: Error | null }>}
 */
export async function excluirItem(item) {
  if (item.imagem_url) {
    await removerImagem(item.imagem_url);
  }

  const { error } = await supabase
    .from(TABELA_ITENS)
    .delete()
    .eq('id', item.id);

  return { error };
}
