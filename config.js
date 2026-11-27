/* ==========================================================================
   GUARDEI — CONFIGURAÇÕES E CONEXÃO COM SUPABASE (js/config.js)
   Centraliza constantes do app e inicializa o cliente do Supabase.
   ========================================================================== */

// 1. Credenciais públicas do seu projeto no Supabase
// (Você encontra ambos em: Project Settings > API no painel do Supabase)
export const SUPABASE_URL = 'COLE_AQUI_A_SUA_PROJECT_URL';
export const SUPABASE_ANON_KEY = 'COLE_AQUI_A_SUA_ANON_PUBLIC_KEY';

// 2. Constantes do banco e do armazenamento
export const TABELA_ITENS = 'itens';
export const BUCKET_IMAGENS = 'imagens';

// 3. As 8 categorias definidas no escopo do Guardei
export const CATEGORIAS = [
  'Compras',
  'Ideias',
  'Receitas',
  'Lugares',
  'Estudos',
  'Documentos',
  'Referências',
  'Outros'
];

export const CATEGORIA_PADRAO = 'Outros';

// 4. Inicialização do cliente Supabase
// A variável global `window.supabase` vem do script CDN carregado no index.html
if (!window.supabase) {
  console.error('Biblioteca do Supabase não encontrada. Verifique o script no index.html.');
}

export const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
