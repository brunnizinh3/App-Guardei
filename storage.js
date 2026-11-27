/* ==========================================================================
   GUARDEI — ARMAZENAMENTO E COMPRESSÃO DE IMAGENS (js/storage.js)
   Comprime imagens no cliente antes do upload e gerencia arquivos no Storage.
   ========================================================================== */

import { supabase, BUCKET_IMAGENS } from './config.js';

const LARGURA_MAXIMA = 1280; // Preserva boa leitura de prints e textos
const QUALIDADE_JPEG = 0.78;  // Bom equilíbrio entre tamanho de arquivo e nitidez

/**
 * Comprime um arquivo de imagem no navegador antes de enviar para a nuvem.
 * @param {File} arquivo - Imagem original escolhida ou compartilhada.
 * @returns {Promise<Blob>}
 */
export function comprimirImagem(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();

    leitor.onload = (evento) => {
      const img = new Image();

      img.onload = () => {
        let { width, height } = img;

        // Redimensiona proporcionalmente se a largura passar do limite
        if (width > LARGURA_MAXIMA) {
          height = Math.round((height * LARGURA_MAXIMA) / width);
          width = LARGURA_MAXIMA;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Não foi possível comprimir a imagem.'));
              return;
            }
            resolve(blob);
          },
          'image/jpeg',
          QUALIDADE_JPEG
        );
      };

      img.onerror = () => reject(new Error('Falha ao carregar a imagem para compressão.'));
      img.src = evento.target.result;
    };

    leitor.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'));
    leitor.readAsDataURL(arquivo);
  });
}

/**
 * Envia uma imagem comprimida para a pasta do usuário dentro do bucket `imagens`
 * e retorna o caminho interno do arquivo e uma URL assinada temporária para exibição.
 * @param {File} arquivo - Arquivo original.
 * @param {string} userId - ID do usuário autenticado.
 * @returns {Promise<{ path: string, signedUrl: string | null, error: Error | null }>}
 */
export async function enviarImagem(arquivo, userId) {
  try {
    const blobComprimido = await comprimirImagem(arquivo);
    const nomeUnico = `${Date.now()}-${crypto.randomUUID()}.jpg`;
    const caminhoArquivo = `${userId}/${nomeUnico}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_IMAGENS)
      .upload(caminhoArquivo, blobComprimido, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (uploadError) {
      return { path: null, signedUrl: null, error: uploadError };
    }

    const signedUrl = await obterUrlImagem(caminhoArquivo);
    return { path: caminhoArquivo, signedUrl, error: null };
  } catch (err) {
    return { path: null, signedUrl: null, error: err };
  }
}

/**
 * Gera uma URL assinada (válida por 1 hora) para exibir imagens de um bucket privado.
 * @param {string} caminhoArquivo
 * @returns {Promise<string | null>}
 */
export async function obterUrlImagem(caminhoArquivo) {
  if (!caminhoArquivo) return null;

  // Caso já seja uma URL completa (ex.: legado ou externa), retorna direto
  if (/^https?:\/\//i.test(caminhoArquivo)) {
    return caminhoArquivo;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_IMAGENS)
    .createSignedUrl(caminhoArquivo, 60 * 60);

  if (error) {
    console.error('Erro ao gerar URL da imagem:', error.message);
    return null;
  }

  return data.signedUrl;
}

/**
 * Remove uma imagem do Supabase Storage quando o item é excluído.
 * @param {string} caminhoArquivo
 */
export async function removerImagem(caminhoArquivo) {
  if (!caminhoArquivo || /^https?:\/\//i.test(caminhoArquivo)) return;

  const { error } = await supabase.storage
    .from(BUCKET_IMAGENS)
    .remove([caminhoArquivo]);

  if (error) {
    console.error('Erro ao remover imagem do Storage:', error.message);
  }
}
