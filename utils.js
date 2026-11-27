/* ==========================================================================
   GUARDEI — UTILITÁRIOS GERAIS (js/utils.js)
   Funções puras e reutilizáveis para classificação automática, formatação e busca.
   ========================================================================== */

/**
 * Detecta automaticamente se um conteúdo digitado ou colado é um link ('link')
 * ou uma anotação comum ('texto').
 * @param {string} valor - Texto ou URL informado pelo usuário.
 * @returns {'link' | 'texto'}
 */
export function detectarTipoConteudo(valor) {
  const limpo = (valor || '').trim();
  if (!limpo) return 'texto';

  // Se não tiver espaços e começar com http://, https:// ou www., trata como link
  const semEspacos = !/\s/.test(limpo);
  if (semEspacos && /^(https?:\/\/|www\.)\S+/i.test(limpo)) {
    return 'link';
  }

  return 'texto';
}

/**
 * Garante que um link tenha protocolo (https://) para abrir corretamente no navegador.
 * @param {string} url - URL informada pelo usuário.
 * @returns {string}
 */
export function normalizarUrl(url) {
  const limpo = (url || '').trim();
  if (!limpo) return '';
  if (/^https?:\/\//i.test(limpo)) return limpo;
  return `https://${limpo}`;
}

/**
 * Gera um título automático quando o usuário não preenche o campo título.
 * @param {{ tipo: 'texto' | 'link' | 'imagem', conteudo?: string, data?: Date | string }} params
 * @returns {string}
 */
export function gerarTituloAutomatico({ tipo, conteudo = '', data = new Date() }) {
  if (tipo === 'link') {
    try {
      const urlObj = new URL(normalizarUrl(conteudo));
      // Remove "www." do início do domínio para ficar mais limpo
      return urlObj.hostname.replace(/^www\./i, '');
    } catch {
      return conteudo.trim().slice(0, 45) || 'Link guardado';
    }
  }

  if (tipo === 'imagem') {
    const dt = data instanceof Date ? data : new Date(data);
    const dia = String(dt.getDate()).padStart(2, '0');
    const mes = String(dt.getMonth() + 1).padStart(2, '0');
    return `Imagem salva em ${dia}/${mes}`;
  }

  // Tipo 'texto': usa os primeiros 45 caracteres sem quebras excessivas
  const textoLimpo = conteudo.trim().replace(/\s+/g, ' ');
  if (!textoLimpo) return 'Nota rápida';
  return textoLimpo.length > 45 ? `${textoLimpo.slice(0, 45).trim()}...` : textoLimpo;
}

/**
 * Remove acentos e converte para minúsculas para facilitar buscas rápidas
 * (ex.: "Tênis" ou "Macarrão" correspondem a "tenis" ou "macarrao").
 * @param {string} texto
 * @returns {string}
 */
export function normalizarBusca(texto) {
  return (texto || '')
    .toString()
    .normalize('NFD')                // Separa letras dos sinais gráficos (acentos)
    .replace(/[\u0300-\u036f]/g, '') // Remove os acentos
    .toLowerCase()
    .trim();
}

/**
 * Converte uma string de tags separadas por vírgula em um array limpo e sem duplicatas.
 * Ex.: "promoção, Tênis, promoção " -> ["promoção", "tênis"]
 * @param {string | string[]} entradaTags
 * @returns {string[]}
 */
export function parseTags(entradaTags) {
  if (Array.isArray(entradaTags)) {
    return entradaTags.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  }

  const partes = String(entradaTags || '')
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);

  // Remove duplicatas mantendo a ordem
  return [...new Set(partes)];
}

/**
 * Formata uma data ISO ou Date para exibição curta em pt-BR (ex.: "23/11 • 11:24").
 * @param {string | Date} dataEntrada
 * @returns {string}
 */
export function formatarDataCurta(dataEntrada) {
  const dt = dataEntrada instanceof Date ? dataEntrada : new Date(dataEntrada);
  if (Number.isNaN(dt.getTime())) return '';

  const dia = String(dt.getDate()).padStart(2, '0');
  const mes = String(dt.getMonth() + 1).padStart(2, '0');
  const hora = String(dt.getHours()).padStart(2, '0');
  const minuto = String(dt.getMinutes()).padStart(2, '0');

  return `${dia}/${mes} • ${hora}:${minuto}`;
}

/**
 * Escapa caracteres especiais de HTML para evitar que textos colados quebrem a interface.
 * @param {string} texto
 * @returns {string}
 */
export function escaparHtml(texto) {
  const mapa = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return String(texto || '').replace(/[&<>"']/g, (char) => mapa[char]);
}
