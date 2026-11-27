/* ==========================================================================
   GUARDEI — AUTENTICAÇÃO COM GOOGLE (js/auth.js)
   Gerencia login social via Supabase Auth, sessão ativa e logout.
   ========================================================================== */

import { supabase } from './config.js';

/**
 * Inicia o fluxo de login com a conta Google.
 * Redireciona o usuário para o Google e retorna para a URL atual do app.
 * @returns {Promise<{ error: Error | null }>}
 */
export async function entrarComGoogle() {
  const redirectTo = `${window.location.origin}${window.location.pathname}`;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo
    }
  });

  return { error };
}

/**
 * Encerra a sessão atual do usuário.
 * @returns {Promise<{ error: Error | null }>}
 */
export async function sairDaConta() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Busca a sessão atual (se o usuário já estiver autenticado).
 * @returns {Promise<import('@supabase/supabase-js').Session | null>}
 */
export async function obterSessaoAtual() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Erro ao obter sessão:', error.message);
    return null;
  }
  return data.session;
}

/**
 * Registra um observador para reagir automaticamente quando o usuário
 * entra, sai ou quando o token de sessão é atualizado.
 * @param {(session: import('@supabase/supabase-js').Session | null) => void} callback
 */
export function observarMudancaAuth(callback) {
  supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}
