/* ==========================================================================
   GUARDEI — CONTROLADOR PRINCIPAL DA APLICAÇÃO (js/app.js)
   Conecta autenticação, banco de dados, busca, filtros, abas e modais.
   ========================================================================== */

import { CATEGORIA_PADRAO } from './config.js';
import {
  entrarComGoogle,
  sairDaConta,
  observarMudancaAuth
} from './auth.js';
import {
  listarItens,
  criarItem,
  atualizarItem,
  alternarFavorito,
  excluirItem
} from './database.js';
import {
  normalizarBusca,
  formatarDataCurta,
  escaparHtml
} from './utils.js';

// Estado em memória da aplicação
let usuarioAtual = null;
let todosItens = [];
let termoBusca = '';
let categoriaSelecionada = 'Todas';
let itemEmDetalhe = null;

// ==========================================================================
// 1. REFERÊNCIAS DO DOM
// ==========================================================================
const telaLogin = document.getElementById('tela-login');
const appPrincipal = document.getElementById('app-principal');
const btnLoginGoogle = document.getElementById('btn-login-google');
const loginFeedback = document.getElementById('login-feedback');
const btnLogout = document.getElementById('btn-logout');
const usuarioEmailEl = document.getElementById('usuario-email');
const contadorTotalEl = document.getElementById('contador-total');

// Busca e abas
const containerBusca = document.getElementById('container-busca');
const inputBusca = document.getElementById('input-busca');
const btnLimparBusca = document.getElementById('btn-limpar-busca');
const abas = document.querySelectorAll('.aba');
const botoesNav = document.querySelectorAll('.nav-item');
const chipsCategoria = document.querySelectorAll('.chip-categoria');

// Listas
const listaRecentes = document.getElementById('lista-recentes');
const listaColecao = document.getElementById('lista-colecao');
const listaFavoritos = document.getElementById('lista-favoritos');

// Captura rápida
const formCapturaRapida = document.getElementById('form-captura-rapida');
const inputRapido = document.getElementById('input-rapido');
const inputImagemRapida = document.getElementById('input-imagem-rapida');

// Modal novo item
const modalNovo = document.getElementById('modal-novo');
const formModalNovo = document.getElementById('form-modal-novo');
const btnAbrirModalNovo = document.getElementById('btn-abrir-modal-novo');
const btnFecharModalNovo = document.getElementById('btn-fechar-modal-novo');
const novoConteudo = document.getElementById('novo-conteudo');
const novoImagem = document.getElementById('novo-imagem');
const novoTitulo = document.getElementById('novo-titulo');
const novoCategoria = document.getElementById('novo-categoria');
const novoDescricao = document.getElementById('novo-descricao');
const novoTags = document.getElementById('novo-tags');

// Modal detalhes e edição
const modalDetalhes = document.getElementById('modal-detalhes');
const btnFecharDetalhes = document.getElementById('btn-fechar-detalhes');
const btnFavoritarDetalhe = document.getElementById('btn-favoritar-detalhe');
const detalheTipoBadge = document.getElementById('detalhe-tipo-badge');
const detalhePreview = document.getElementById('detalhe-preview');
const btnCopiarConteudo = document.getElementById('btn-copiar-conteudo');
const btnAbrirLink = document.getElementById('btn-abrir-link');
const formEditarItem = document.getElementById('form-editar-item');
const editarId = document.getElementById('editar-id');
const editarTitulo = document.getElementById('editar-titulo');
const editarCategoria = document.getElementById('editar-categoria');
const editarDescricao = document.getElementById('editar-descricao');
const editarTags = document.getElementById('editar-tags');
const btnExcluirItem = document.getElementById('btn-excluir-item');

// ==========================================================================
// 2. AUTENTICAÇÃO E INICIALIZAÇÃO
// ==========================================================================
btnLoginGoogle?.addEventListener('click', async () => {
  loginFeedback.hidden = true;
  const { error } = await entrarComGoogle();
  if (error) {
    loginFeedback.textContent = `Não foi possível entrar com o Google: ${error.message}`;
    loginFeedback.hidden = false;
  }
});

btnLogout?.addEventListener('click', async () => {
  await sairDaConta();
});

observarMudancaAuth(async (session) => {
  if (session?.user) {
    usuarioAtual = session.user;
    telaLogin.hidden = true;
    appPrincipal.hidden = false;
    usuarioEmailEl.textContent = usuarioAtual.email || 'Conta Google conectada';

    await carregarDados();
    verificarCompartilhamentoExterno();
  } else {
    usuarioAtual = null;
    todosItens = [];
    appPrincipal.hidden = true;
    telaLogin.hidden = false;
  }
});

async function carregarDados() {
  const { itens, error } = await listarItens();
  if (error) {
    console.error('Erro ao carregar itens:', error.message);
    return;
  }
  todosItens = itens;
  renderizarTudo();
}

// ==========================================================================
// 3. NAVEGAÇÃO ENTRE ABAS, FILTROS E BUSCA
// ==========================================================================
botoesNav.forEach((btn) => {
  btn.addEventListener('click', () => {
    const alvoId = btn.dataset.alvo;

    botoesNav.forEach((b) => b.classList.remove('ativo'));
    btn.classList.add('ativo');

    abas.forEach((aba) => {
      aba.hidden = aba.id !== alvoId;
      aba.classList.toggle('ativa', aba.id === alvoId);
    });

    // Mantém a barra de busca visível apenas nas abas Início e Coleção
    const mostrarBusca = alvoId === 'aba-inicio' || alvoId === 'aba-colecao';
    containerBusca.hidden = !mostrarBusca;
  });
});

chipsCategoria.forEach((chip) => {
  chip.addEventListener('click', () => {
    chipsCategoria.forEach((c) => c.classList.remove('ativo'));
    chip.classList.add('ativo');
    categoriaSelecionada = chip.dataset.categoria;
    renderizarColecao();
  });
});

inputBusca?.addEventListener('input', (e) => {
  termoBusca = e.target.value;
  btnLimparBusca.hidden = !termoBusca.trim();
  renderizarListasFiltradas();
});

btnLimparBusca?.addEventListener('click', () => {
  inputBusca.value = '';
  termoBusca = '';
  btnLimparBusca.hidden = true;
  renderizarListasFiltradas();
  inputBusca.focus();
});

/**
 * Verifica se um item corresponde ao termo de busca (sem acentos, em várias áreas).
 */
function itemCorrespondeBusca(item, termoLimpo) {
  if (!termoLimpo) return true;

  const alvo = normalizarBusca([
    item.titulo,
    item.conteudo,
    item.descricao,
    item.categoria,
    ...(item.tags || [])
  ].join(' '));

  return alvo.includes(termoLimpo);
}

// ==========================================================================
// 4. CAPTURA ULTRA-RÁPIDA (INÍCIO, MODAL "+" E WEB SHARE TARGET)
// ==========================================================================
formCapturaRapida?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!usuarioAtual) return;

  const texto = inputRapido.value.trim();
  const arquivo = inputImagemRapida.files?.[0] || null;

  if (!texto && !arquivo) return;

  const { item, error } = await criarItem({
    userId: usuarioAtual.id,
    conteudo: texto,
    arquivoImagem: arquivo,
    categoria: CATEGORIA_PADRAO
  });

  if (error) {
    alert(`Erro ao guardar: ${error.message}`);
    return;
  }

  inputRapido.value = '';
  inputImagemRapida.value = '';
  todosItens.unshift(item);
  renderizarTudo();
});

// Envio imediato ao escolher uma foto/print pela captura rápida
inputImagemRapida?.addEventListener('change', () => {
  if (inputImagemRapida.files?.length) {
    formCapturaRapida.requestSubmit();
  }
});

btnAbrirModalNovo?.addEventListener('click', () => {
  formModalNovo.reset();
  novoCategoria.value = CATEGORIA_PADRAO;
  modalNovo.showModal();
});

btnFecharModalNovo?.addEventListener('click', () => {
  modalNovo.close();
});

formModalNovo?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!usuarioAtual) return;

  const conteudo = novoConteudo.value.trim();
  const arquivo = novoImagem.files?.[0] || null;

  if (!conteudo && !arquivo) {
    alert('Digite um texto/link ou escolha uma imagem antes de guardar.');
    return;
  }

  const { item, error } = await criarItem({
    userId: usuarioAtual.id,
    conteudo,
    arquivoImagem: arquivo,
    titulo: novoTitulo.value,
    descricao: novoDescricao.value,
    categoria: novoCategoria.value,
    tags: novoTags.value
  });

  if (error) {
    alert(`Erro ao guardar: ${error.message}`);
    return;
  }

  todosItens.unshift(item);
  modalNovo.close();
  renderizarTudo();
});

/**
 * Recebe dados compartilhados de outros apps via URL (Web Share Target).
 */
function verificarCompartilhamentoExterno() {
  const params = new URLSearchParams(window.location.search);
  const sharedTitle = params.get('shared_title') || '';
  const sharedText = params.get('shared_text') || '';
  const sharedUrl = params.get('shared_url') || '';

  const combinado = [sharedUrl, sharedText].filter(Boolean).join('\n').trim();

  if (combinado || sharedTitle) {
    formModalNovo.reset();
    novoConteudo.value = combinado;
    novoTitulo.value = sharedTitle;
    novoCategoria.value = CATEGORIA_PADRAO;
    modalNovo.showModal();

    // Limpa os parâmetros da URL para não reabrir o modal ao atualizar a página
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// ==========================================================================
// 5. RENDERIZAÇÃO DOS CARDS E LISTAS
// ==========================================================================
function renderizarTudo() {
  contadorTotalEl.textContent = `${todosItens.length} ${todosItens.length === 1 ? 'item' : 'itens'}`;
  renderizarListasFiltradas();
}

function renderizarListasFiltradas() {
  const termoLimpo = normalizarBusca(termoBusca);
  const filtradosPorBusca = todosItens.filter((item) => itemCorrespondeBusca(item, termoLimpo));

  // Aba Início: 10 itens mais recentes (ou todos os resultados se estiver buscando)
  const recentes = termoLimpo
    ? filtradosPorBusca
    : filtradosPorBusca.slice(0, 10);

  renderizarLista(
    listaRecentes,
    recentes,
    termoLimpo ? 'Nenhum item encontrado para essa busca.' : 'Nada guardado ainda. Cole um link ou anote algo acima!'
  );

  renderizarColecao(filtradosPorBusca);

  // Aba Favoritos
  const favoritos = filtradosPorBusca.filter((item) => item.favorito);
  renderizarLista(
    listaFavoritos,
    favoritos,
    'Nenhum item favoritado ainda.'
  );
}

function renderizarColecao(baseItens = null) {
  const termoLimpo = normalizarBusca(termoBusca);
  const fonte = baseItens || todosItens.filter((item) => itemCorrespondeBusca(item, termoLimpo));

  const itensCategoria =
    categoriaSelecionada === 'Todas'
      ? fonte
      : fonte.filter((item) => item.categoria === categoriaSelecionada);

  renderizarLista(
    listaColecao,
    itensCategoria,
    'Nenhum item nesta categoria.'
  );
}

function renderizarLista(container, itens, mensagemVazia) {
  if (!container) return;

  if (!itens.length) {
    container.innerHTML = `<div class="estado-vazio">${escaparHtml(mensagemVazia)}</div>`;
    return;
  }

  container.innerHTML = itens
    .map((item) => {
      const midiaHtml =
        item.tipo === 'imagem' && item.imagem_preview_url
          ? `<img class="card-thumb" src="${escaparHtml(item.imagem_preview_url)}" alt="${escaparHtml(item.titulo)}" loading="lazy" />`
          : `<div class="card-icone-tipo">${item.tipo === 'link' ? '🔗' : item.tipo === 'imagem' ? '🖼️' : '📝'}</div>`;

      const previaTexto =
        item.descricao?.trim() ||
        (item.tipo !== 'imagem' ? item.conteudo : 'Imagem guardada no acervo');

      const estrelaHtml = item.favorito
        ? `<span class="card-estrela" aria-label="Favorito">★</span>`
        : '';

      return `
        <article class="card-item" data-id="${escaparHtml(item.id)}">
          ${midiaHtml}
          <div class="card-corpo">
            <div class="card-topo">
              <h3 class="card-titulo">${escaparHtml(item.titulo)}</h3>
              ${estrelaHtml}
            </div>
            <p class="card-previa">${escaparHtml(previaTexto)}</p>
            <div class="card-rodape">
              <span class="tag-categoria">${escaparHtml(item.categoria)}</span>
              <span class="card-data">${escaparHtml(formatarDataCurta(item.criado_em))}</span>
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  // Adiciona evento de clique em cada card para abrir detalhes/edição
  container.querySelectorAll('.card-item').forEach((cardEl) => {
    cardEl.addEventListener('click', () => {
      const encontrado = todosItens.find((i) => i.id === cardEl.dataset.id);
      if (encontrado) abrirDetalhesItem(encontrado);
    });
  });
}

// ==========================================================================
// 6. MODAL DE DETALHES, FAVORITAR, EDITAR E EXCLUIR
// ==========================================================================
function abrirDetalhesItem(item) {
  itemEmDetalhe = item;
  editarId.value = item.id;
  editarTitulo.value = item.titulo || '';
  editarCategoria.value = item.categoria || CATEGORIA_PADRAO;
  editarDescricao.value = item.descricao || '';
  editarTags.value = (item.tags || []).join(', ');

  detalheTipoBadge.textContent = item.tipo.toUpperCase();
  atualizarBotaoFavorito(item.favorito);

  // Renderiza o conteúdo conforme o tipo
  if (item.tipo === 'imagem' && item.imagem_preview_url) {
    detalhePreview.innerHTML = `<img src="${escaparHtml(item.imagem_preview_url)}" alt="${escaparHtml(item.titulo)}" />`;
    btnAbrirLink.hidden = true;
  } else if (item.tipo === 'link') {
    detalhePreview.innerHTML = `<a href="${escaparHtml(item.conteudo)}" target="_blank" rel="noopener noreferrer">${escaparHtml(item.conteudo)}</a>`;
    btnAbrirLink.href = item.conteudo;
    btnAbrirLink.hidden = false;
  } else {
    detalhePreview.textContent = item.conteudo || '';
    btnAbrirLink.hidden = true;
  }

  modalDetalhes.showModal();
}

function atualizarBotaoFavorito(isFavorito) {
  btnFavoritarDetalhe.textContent = isFavorito ? '★' : '☆';
  btnFavoritarDetalhe.style.color = isFavorito ? 'var(--cor-favorito)' : '';
}

btnFecharDetalhes?.addEventListener('click', () => {
  itemEmDetalhe = null;
  modalDetalhes.close();
});

btnFavoritarDetalhe?.addEventListener('click', async () => {
  if (!itemEmDetalhe) return;

  const { item: atualizado, error } = await alternarFavorito(
    itemEmDetalhe.id,
    itemEmDetalhe.favorito
  );

  if (error) {
    alert(`Erro ao atualizar favorito: ${error.message}`);
    return;
  }

  itemEmDetalhe = atualizado;
  atualizarBotaoFavorito(atualizado.favorito);
  substituirItemNoEstado(atualizado);
  renderizarTudo();
});

btnCopiarConteudo?.addEventListener('click', async () => {
  if (!itemEmDetalhe) return;
  const textoParaCopiar = itemEmDetalhe.conteudo || itemEmDetalhe.titulo || '';
  try {
    await navigator.clipboard.writeText(textoParaCopiar);
    btnCopiarConteudo.textContent = 'Copiado!';
    setTimeout(() => {
      btnCopiarConteudo.textContent = 'Copiar';
    }, 1500);
  } catch {
    alert('Não foi possível copiar automaticamente.');
  }
});

formEditarItem?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!itemEmDetalhe) return;

  const { item: atualizado, error } = await atualizarItem(itemEmDetalhe.id, {
    titulo: editarTitulo.value,
    categoria: editarCategoria.value,
    descricao: editarDescricao.value,
    tags: editarTags.value
  });

  if (error) {
    alert(`Erro ao salvar alterações: ${error.message}`);
    return;
  }

  substituirItemNoEstado(atualizado);
  renderizarTudo();
  modalDetalhes.close();
});

btnExcluirItem?.addEventListener('click', async () => {
  if (!itemEmDetalhe) return;
  const confirmar = confirm('Deseja realmente excluir este item guardado?');
  if (!confirmar) return;

  const { error } = await excluirItem(itemEmDetalhe);
  if (error) {
    alert(`Erro ao excluir: ${error.message}`);
    return;
  }

  todosItens = todosItens.filter((i) => i.id !== itemEmDetalhe.id);
  itemEmDetalhe = null;
  renderizarTudo();
  modalDetalhes.close();
});

function substituirItemNoEstado(itemAtualizado) {
  todosItens = todosItens.map((i) =>
    i.id === itemAtualizado.id ? itemAtualizado : i
  );
}

// ==========================================================================
// 7. REGISTRO DO SERVICE WORKER (PWA)
// ==========================================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.error('Falha ao registrar Service Worker:', err);
    });
  });
}
