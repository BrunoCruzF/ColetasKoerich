if (!user) window.location.href = "index.html";
// Se o usuário é do tipo "operador", ele não deve acessar a página de
// solicitação de coletas. Redirecionamos imediatamente para a lista de
// coletas concluídas.
if (user && user.tipo === "operador") {
  window.location.href = "concluidas.html";
}

// 🔧 Campo debug só para admin
const debugArea = document.createElement("div");
debugArea.style.fontSize = "12px";
debugArea.style.color = "#888";
debugArea.style.marginTop = "5px";
debugArea.innerHTML = `
  <div><strong></strong> Usuário logado: <code>${user.nome}</code></div>
  <div><strong></strong> Tipo: <code>${user.tipo}</code></div>
`;
document.getElementById("user-info").appendChild(debugArea);

// Botões e elementos
const btnNova = document.getElementById("btnNovaColeta");
const btnExcluir = document.getElementById("btnExcluirColetas");
const btnConcluir = document.getElementById("btnConcluirColetas");
const checkboxSelecionarTodos = document.getElementById("checkboxSelecionarTodos");

// === [Seleção em massa e exclusão] ===

// Selecionar todos
if (typeof checkboxSelecionarTodos !== "undefined" && checkboxSelecionarTodos) {
  checkboxSelecionarTodos.addEventListener("change", function () {
    document.querySelectorAll(".checkbox-coleta").forEach(cb => cb.checked = this.checked);
  });
}

// Mantém o "selecionar todos" coerente quando o usuário marca/desmarca itens individualmente
document.addEventListener("change", (e) => {
  if (e.target && e.target.classList && e.target.classList.contains("checkbox-coleta")) {
    const all = document.querySelectorAll(".checkbox-coleta");
    const checked = document.querySelectorAll(".checkbox-coleta:checked");
    if (typeof checkboxSelecionarTodos !== "undefined" && checkboxSelecionarTodos) {
      checkboxSelecionarTodos.checked = (all.length > 0 && checked.length === all.length);
    }
  }
});

// Excluir coletas selecionadas
function excluirColetasSelecionadas() {
  const selecionados = Array.from(document.querySelectorAll(".checkbox-coleta:checked"));
  if (!selecionados.length) {
    if (typeof Swal !== "undefined") {
      Swal.fire({ icon: "info", title: "Nada selecionado", text: "Selecione pelo menos uma coleta." });
    } else {
      alert("Selecione pelo menos uma coleta.");
    }
    return;
  }

  const confirmar = () => {
    // Pega índices originais e remove de trás pra frente para não bagunçar os índices
    const indices = selecionados.map(cb => Number(cb.dataset.index)).sort((a, b) => b - a);
    indices.forEach(idx => { if (!isNaN(idx)) coletas.splice(idx, 1); });

    localStorage.setItem("coletas", JSON.stringify(coletas));
    if (typeof exibirColetas === "function") exibirColetas();
    if (typeof registrarLog === "function") registrarLog(`Excluiu ${indices.length} coleta(s)`);
  };

  if (typeof Swal !== "undefined") {
    Swal.fire({
      title: "Confirmar exclusão",
      text: `Você vai excluir ${selecionados.length} coleta(s).`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, excluir",
      cancelButtonText: "Cancelar"
    }).then((res) => {
      if (res.isConfirmed) {
        confirmar();
        Swal.fire({ icon: "success", title: "Pronto!", text: "Coletas excluídas." });
      }
    });
  } else {
    if (confirm(`Você vai excluir ${selecionados.length} coleta(s). Confirmar?`)) {
      confirmar();
      alert("Coletas excluídas.");
    }
  }
}

// Liga o botão de excluir
if (typeof btnExcluir !== "undefined" && btnExcluir) {
  btnExcluir.addEventListener("click", excluirColetasSelecionadas);
}


// ==================================================
// Funções de registro de log
// ==================================================

// Captura o IP público do usuário. Utiliza o serviço ipify. Caso a requisição
// falhe (por exemplo, por falta de internet ou política de CORS), o IP será
// preenchido como "desconhecido". O resultado é armazenado em ipAtual.
// 🔒 Captura resiliente do IP público (silencia erros/400 e evita fora de HTTPS)
let ipAtual = "";

function capturarIP() {
  // Evita tentativa em ambientes sem HTTPS (ex.: file:// ou http)
  if (location.protocol !== "https:") {
    ipAtual = "desconhecido";
    return;
  }
  try {
    fetch("https://api.ipify.org?format=json", { cache: "no-store" })
      .then((resp) => resp.ok ? resp.json() : Promise.reject(new Error("ipify not ok")))
      .then((data) => { ipAtual = data?.ip || "desconhecido"; })
      .catch(() => { ipAtual = "desconhecido"; });
  } catch {
    ipAtual = "desconhecido";
  }
}
capturarIP();// Registra um log no localStorage. O log contém a data/hora, o usuário
// responsável, a descrição da ação e o IP do dispositivo. A função é
// exposta globalmente em window para que outras páginas possam utilizá-la.
function registrarLog(acao) {
  const logs = JSON.parse(localStorage.getItem("logs") || "[]");
  logs.push({
    dataHora: new Date().toLocaleString(),
    usuario: user ? user.nome : "desconhecido",
    acao: acao,
    ip: ipAtual || ""
  });
  localStorage.setItem("logs", JSON.stringify(logs));
}

// Torna a função disponível globalmente
window.registrarLog = registrarLog;

if (user.tipo !== "admin") {
  btnNova.style.display = "none";
  btnExcluir.style.display = "none";
}

const form = document.getElementById("formColeta");

// === Campo "Urgente" (injetado via JS para evitar mexer no HTML) ===
if (form && !form.querySelector('#urgente')) {
  const divUrg = document.createElement('div');
  divUrg.className = 'col-md-2 form-check';
  divUrg.innerHTML = `
    <input class="form-check-input" type="checkbox" id="urgente" name="urgente">
    <label class="form-check-label" for="urgente">Urgente</label>
  `;
  form.appendChild(divUrg);
}
const tabela = document.getElementById("tabelaColetas");
let coletas = JSON.parse(localStorage.getItem("coletas") || "[]");

// Valor atual do filtro de busca. Quando não houver busca, permanece vazio.
let filtroBusca = "";

// Variáveis para ordenação e paginação
let currentSortColumn = "";      // Coluna atual de ordenação
let currentSortDir = 1;           // 1 para ascendente, -1 para descendente
let currentPage = 1;              // Página atual
const itemsPerPage = 10;          // Número de coletas por página

// Função para alterar a ordenação. É chamada ao clicar nos cabeçalhos da tabela.
window.ordenarPor = function(coluna) {
  // Se clicar na mesma coluna, alterna a direção. Caso contrário, define nova coluna ascendente.
  if (currentSortColumn === coluna) {
    currentSortDir = -currentSortDir;
  } else {
    currentSortColumn = coluna;
    currentSortDir = 1;
  }
  // Ao alterar a ordenação, voltamos para a primeira página
  currentPage = 1;
  exibirColetas();
};

// Listener para campo de busca. Atualiza variável de filtro e redesenha tabela.
const campoBusca = document.getElementById("searchInput");
if (campoBusca) {
  campoBusca.addEventListener("input", function () {
    filtroBusca = this.value.trim().toLowerCase();
    exibirColetas();
  });
}

exibirColetas();

form.addEventListener("submit", async function (e) {
  e.preventDefault();
  const formData = new FormData(form);
  // Converte campos simples em objeto
  const dados = Object.fromEntries(formData.entries());
  dados.urgente = !!(form.querySelector("#urgente") && form.querySelector("#urgente").checked);
// Remove os arquivos da coleta (serão tratados separadamente)
  delete dados.arquivo_nf_origem;
  delete dados.arquivo_nf_devolucao;
  // Obtenção dos arquivos anexados
  const arquivoOrigem = formData.get("arquivo_nf_origem");
  const arquivoDevolucao = formData.get("arquivo_nf_devolucao");
  // Função para converter arquivo em base64 (data URL). Se não houver arquivo, retorna null.
  async function lerArquivoComoBase64(file) {
    return new Promise((resolve) => {
      if (!file || file.size === 0) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }
  const base64Origem = await lerArquivoComoBase64(arquivoOrigem);
  const base64Devolucao = await lerArquivoComoBase64(arquivoDevolucao);
  // Armazena as strings base64 e nomes de arquivo (se houver)
  dados.arquivo_nf_origem = base64Origem;
  dados.nome_arquivo_nf_origem = base64Origem ? (arquivoOrigem ? arquivoOrigem.name : "") : "";
  dados.arquivo_nf_devolucao = base64Devolucao;
  dados.nome_arquivo_nf_devolucao = base64Devolucao ? (arquivoDevolucao ? arquivoDevolucao.name : "") : "";
  const index = form.getAttribute("data-index");
  if (index) {
    // Se estiver editando, mantém anexos anteriores se não forem enviados novos
    const coletaExistente = coletas[index];
    // Se não anexou novo arquivo, mantém o arquivo existente
    if (!base64Origem && coletaExistente.arquivo_nf_origem) {
      dados.arquivo_nf_origem = coletaExistente.arquivo_nf_origem;
      dados.nome_arquivo_nf_origem = coletaExistente.nome_arquivo_nf_origem;
    }
    if (!base64Devolucao && coletaExistente.arquivo_nf_devolucao) {
      dados.arquivo_nf_devolucao = coletaExistente.arquivo_nf_devolucao;
      dados.nome_arquivo_nf_devolucao = coletaExistente.nome_arquivo_nf_devolucao;
    }
    coletas[index] = dados;
    form.removeAttribute("data-index");
  } else {
    coletas.push(dados);
  }
  localStorage.setItem("coletas", JSON.stringify(coletas));
  form.reset();
  bootstrap.Modal.getInstance(document.getElementById("modalColeta")).hide();
  exibirColetas();
});

function normalizarTexto(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").toLowerCase();
}

function exibirColetas() {
  tabela.innerHTML = "";
  // Para usuário transportadora, filtrar coletas pelo nome do usuário (que representa transportadora)
  const transportadoraUsuario = user.tipo === "transportadora" ? normalizarTexto(user.transportadora || user.nome) : "";

  // Filtrar coletas em um array auxiliar, incluindo também o índice original para futuras operações
  let listaFiltrada = [];
  coletas.forEach((c, i) => {
    if (c.status === "Coleta Concluída") return;
    const transportadoraNormalizada = normalizarTexto(c.transportadora);
    const podeVer = user.tipo === "admin" || transportadoraNormalizada === transportadoraUsuario;
    // Filtro por termo de busca
    const termo = filtroBusca;
    const atendeFiltro = !termo ||
      (c.produto && c.produto.toLowerCase().includes(termo)) ||
      (c.nf_origem && c.nf_origem.toLowerCase().includes(termo)) ||
      (c.nf_devolucao && c.nf_devolucao.toLowerCase().includes(termo));
    if (podeVer && atendeFiltro) {
      listaFiltrada.push({ coleta: c, index: i });
    }
  });

  // Ordenação, se alguma coluna estiver selecionada
  if (currentSortColumn) {
    listaFiltrada.sort((a, b) => {
      const valA = a.coleta[currentSortColumn] || "";
      const valB = b.coleta[currentSortColumn] || "";
      // Para datas, usamos comparação de string ISO (YYYY-MM-DD) que já ordena corretamente
      if (valA < valB) return -1 * currentSortDir;
      if (valA > valB) return 1 * currentSortDir;
      return 0;
    });
  }

  // Paginação
  const totalItems = listaFiltrada.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * itemsPerPage;
  const pageItems = listaFiltrada.slice(start, start + itemsPerPage);

  // Construção das linhas da página atual
  pageItems.forEach(({ coleta: c, index: i }) => {
    const row = document.createElement("tr");
    if (c.urgente) { row.classList.add("urgente-row"); }
row.innerHTML = `
      <td><input type="checkbox" class="checkbox-coleta" data-index="${i}"></td>
      <td>${c.urgente ? \'<span class="badge bg-danger me-1">URGENTE</span>\' : ""}${c.produto}</td>
      <td>${c.arquivo_nf_origem ? `<a href="${c.arquivo_nf_origem}" download="${c.nome_arquivo_nf_origem}">${c.nf_origem}</a>` : c.nf_origem}</td>
      <td>${c.arquivo_nf_devolucao ? `<a href="${c.arquivo_nf_devolucao}" download="${c.nome_arquivo_nf_devolucao}">${c.nf_devolucao || ""}</a>` : (c.nf_devolucao || "")}</td>
      <td>${formatarData(c.data_solicitacao)}</td>
      <td>
        ${user.tipo === "transportadora" || user.tipo === "admin" ? `
          <input type="date" class="form-control form-control-sm" value="${c.data_prevista}" onchange="atualizarDataPrevista(this, ${i})">
        ` : formatarData(c.data_prevista)}
      </td>
      <td>
        ${user.tipo === "transportadora" || user.tipo === "admin" ? `
          <select class="form-select form-select-sm status-select" data-index="${i}" onchange="atualizarStatus(this, ${i})">         
            <option value="Coleta Solicitada" ${c.status === "Coleta Solicitada" ? "selected" : ""}>Coleta Solicitada</option>
            <option value="Aguardando Coleta" ${c.status === "Aguardando Coleta" ? "selected" : ""}>Aguardando Coleta</option>
            <option value="Coleta Realizada" ${c.status === "Coleta Realizada" ? "selected" : ""}>Coleta Realizada</option>
            <option value="Coleta Não Realizada" ${c.status === "Coleta Não Realizada" ? "selected" : ""}>Coleta Não Realizada</option>
            <option value="Coleta Agendada" ${c.status === "Coleta Agendada" ? "selected" : ""}>Coleta Agendada</option>
            <option value="Coleta Concluída" ${c.status === "Coleta Concluída" ? "selected" : ""}>Coleta Concluída</option>
          </select>
        ` : c.status}
      </td>
      <td>${c.transportadora}</td>
      <td>
        ${user.tipo === "transportadora" || user.tipo === "admin" ? `
          <select class="form-select form-select-sm" onchange="atualizarMotivo(this, ${i})">
            <option value="">Selecione</option>
            <option value="Cliente ausente" ${c.motivo === "Cliente ausente" ? "selected" : ""}>Cliente ausente</option>
            <option value="Endereço de difícil acesso" ${c.motivo === "Endereço de difícil acesso" ? "selected" : ""}>Endereço de difícil acesso</option>
            <option value="Endereço não localizado" ${c.motivo === "Endereço não localizado" ? "selected" : ""}>Endereço não localizado</option>
            <option value="Sem contato com cliente" ${c.motivo === "Sem contato com cliente" ? "selected" : ""}>Sem contato com cliente</option>
            <option value="Coleta efetuada" ${c.motivo === "Coleta efetuada" ? "selected" : ""}>Coleta efetuada</option>
          </select>
        ` : (c.motivo || "")}
      </td>
      <td>
        ${user.tipo === "transportadora" || user.tipo === "admin" ? `
          <div class="btn-group" role="group">
            <button class="btn btn-success btn-sm" style="min-width: 85px; padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="abrirModalConclusao(${i})">Concluir</button>
            <button class="btn btn-warning btn-sm" style="min-width: 85px; padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="devolverColeta(${i})">Devolver</button> <button class="btn btn-info btn-sm" style="min-width: 85px; padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="abrirChat(${i})"><i class="fas fa-comments"></i> Chat</button>
          </div>
        ` : ``}
      </td>
    `;
    tabela.appendChild(row);
  });

  // Reposiciona o estado do checkbox "selecionar todos" ao alterar a lista
  if (checkboxSelecionarTodos) checkboxSelecionarTodos.checked = false;

  // Atualiza a paginação
  renderPagination(totalPages);
}

// Desenha os controles de paginação. Recebe o total de páginas calculado.
function renderPagination(totalPages) {
  const pagContainer = document.getElementById("pagination");
  if (!pagContainer) return;
  pagContainer.innerHTML = "";
  // Função auxiliar para criar item de página
  function criarItem(pagina, rotulo, desativado = false, ativo = false) {
    const li = document.createElement("li");
    li.className = `page-item${desativado ? " disabled" : ""}${ativo ? " active" : ""}`;
    const a = document.createElement("a");
    a.className = "page-link";
    a.href = "#";
    a.textContent = rotulo;
    if (!desativado) {
      a.addEventListener("click", function(e) {
        e.preventDefault();
        currentPage = pagina;
        exibirColetas();
      });
    }
    li.appendChild(a);
    return li;
  }
  // Botão anterior
  pagContainer.appendChild(criarItem(Math.max(1, currentPage - 1), "Anterior", currentPage === 1));
  // Números de páginas
  for (let p = 1; p <= totalPages; p++) {
    pagContainer.appendChild(criarItem(p, p, false, p === currentPage));
  }
  // Botão próximo
  pagContainer.appendChild(criarItem(Math.min(totalPages, currentPage + 1), "Próxima", currentPage === totalPages));
}

// Variável global para armazenar o índice da coleta que será concluída.
let indiceColetaParaComprovante = null;

// Função chamada ao clicar no botão Concluir de uma linha. Ela define qual
// coleta será concluída e mostra o modal de comprovante.
function abrirModalConclusao(index) {
  indiceColetaParaComprovante = index;
  const modal = new bootstrap.Modal(document.getElementById('modalComprovante'));
  // Limpa qualquer arquivo previamente selecionado
  const fileInput = document.getElementById('comprovanteFile');
  if (fileInput) fileInput.value = '';
  modal.show();
}

// Evento para o botão de confirmar dentro do modal. Lê o arquivo (se houver)
// e conclui a coleta correspondente. Após concluir, esconde o modal.
const btnConfirmarConclusao = document.getElementById('btnConfirmarConclusao');
if (btnConfirmarConclusao) {
  btnConfirmarConclusao.addEventListener('click', function() {
    const index = indiceColetaParaComprovante;
    if (index === null || index === undefined) return;
    const fileInput = document.getElementById('comprovanteFile');
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const base64 = e.target.result;
        concluirColeta(index, base64, file.name);
        bootstrap.Modal.getInstance(document.getElementById('modalComprovante')).hide();
      };
      reader.readAsDataURL(file);
    } else {
      // Conclui sem comprovante
      concluirColeta(index);
      bootstrap.Modal.getInstance(document.getElementById('modalComprovante')).hide();
    }
    indiceColetaParaComprovante = null;
  });
}

// Reseta o índice e o campo de arquivo quando o modal é fechado (cancelado)
const modalComprovanteEl = document.getElementById('modalComprovante');
if (modalComprovanteEl) {
  modalComprovanteEl.addEventListener('hidden.bs.modal', function() {
    indiceColetaParaComprovante = null;
    const fileInput = document.getElementById('comprovanteFile');
    if (fileInput) fileInput.value = '';
  });
}

function atualizarStatus(selectElement, index) {
  const novoStatus = selectElement.value;
  coletas[index].status = novoStatus;
  localStorage.setItem("coletas", JSON.stringify(coletas));
}

function atualizarDataPrevista(inputElement, index) {
  const novaData = inputElement.value;
  coletas[index].data_prevista = novaData;
  localStorage.setItem("coletas", JSON.stringify(coletas));
}


function atualizarMotivo(selectElement, index) {
  const novoMotivo = selectElement.value;
  if (!novoMotivo) return;
  coletas[index].motivo = novoMotivo;
  localStorage.setItem("coletas", JSON.stringify(coletas));
  exibirColetas();

  // Registrar observação no chat
  const coleta = coletas[index];
  const nf = coleta.nf_origem;
  const mensagens = JSON.parse(localStorage.getItem("chat_" + nf) || "[]");
  mensagens.push({
    usuario: user.nome,
    texto: `[Observação registrada]: ${novoMotivo}`,
    data: new Date().toLocaleString()
  });
  localStorage.setItem("chat_" + nf, JSON.stringify(mensagens));

  // Log
  registrarLog(`Observação registrada para NF ${nf}: ${novoMotivo}`);
}



function editarColeta(index) {
  const c = coletas[index];
  const modal = new bootstrap.Modal(document.getElementById("modalColeta"));
  modal.show();

  form.setAttribute("data-index", index);
  form.produto.value = c.produto;
  form.nf_origem.value = c.nf_origem;
  form.nf_devolucao.value = c.nf_devolucao || "";
  form.data_solicitacao.value = c.data_solicitacao;
  form.data_prevista.value = c.data_prevista || "";
  form.status.value = c.status;
  form.transportadora.value = c.transportadora;

const chkUrg = form.querySelector('#urgente');
if (chkUrg) chkUrg.checked = !!c.urgente;
}

function formatarData(dataISO) {
  if (!dataISO) return "";
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

function logout() {
  localStorage.removeItem("usuarioLogado");
  window.location.href = "index.html";
}


// ====================== CHAT POR NF ======================
let nfChatAtual = null;

function abrirChat(index) {
  const coleta = coletas[index];
  nfChatAtual = coleta.nf_origem;
  document.getElementById("chatNF").textContent = nfChatAtual;
  carregarMensagensChat();
  const modal = new bootstrap.Modal(document.getElementById("modalChat"));
  modal.show();
}

function carregarMensagensChat() {
  const historicoDiv = document.getElementById("chatHistorico");
  historicoDiv.innerHTML = "";
  const mensagens = JSON.parse(localStorage.getItem("chat_" + nfChatAtual) || "[]");
  mensagens.forEach(msg => {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("p-2", "mb-1", "rounded");
    if (msg.usuario === user.nome) {
      msgDiv.classList.add("bg-primary", "text-white", "text-end");
    } else {
      msgDiv.classList.add("bg-light", "text-dark", "text-start");
    }
    msgDiv.innerHTML = `<small><b>${msg.usuario}</b></small><br>${msg.texto}`;
    historicoDiv.appendChild(msgDiv);
  });
  historicoDiv.scrollTop = historicoDiv.scrollHeight;
}// ====================== FIM CHAT POR NF ======================


document.addEventListener("DOMContentLoaded", () => {
  const btnEnviar = document.getElementById("btnEnviarMensagem");
  if (btnEnviar) {
    btnEnviar.addEventListener("click", () => {
      const input = document.getElementById("chatMensagem");
      const texto = input.value.trim();
      if (!texto) return;
      const mensagens = JSON.parse(localStorage.getItem("chat_" + nfChatAtual) || "[]");
      mensagens.push({ usuario: user.nome, texto, data: new Date().toLocaleString() });
      localStorage.setItem("chat_" + nfChatAtual, JSON.stringify(mensagens));
      input.value = "";
      carregarMensagensChat();
    });
  }
});

function devolverColeta(index) {
  const coleta = coletas[index];

  Swal.fire({
    title: 'Confirmação',
    text: `Deseja realmente devolver a coleta da NF ${coleta.nf_origem}?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sim, devolver',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      coleta.status = "Devolvido";
      const retornos = JSON.parse(localStorage.getItem("retornosTransportadora") || "[]");
      retornos.push(coleta);
      coletas.splice(index, 1);
      localStorage.setItem("retornosTransportadora", JSON.stringify(retornos));
      localStorage.setItem("coletas", JSON.stringify(coletas));
      exibirColetas();
      registrarLog(`Coleta da NF ${coleta.nf_origem} marcada como devolvida`);
    }
  });
}


function concluirColeta(index) {
  const coleta = coletas[index];
  Swal.fire({
    title: 'Confirmação',
    text: `Deseja realmente concluir a coleta da NF ${coleta.nf_origem}?`,
    icon: 'success',
    showCancelButton: true,
    confirmButtonText: 'Sim, concluir',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      // Limpar arquivos base64 para economizar espaço
      coleta.arquivo_nf_origem = null;
      coleta.nome_arquivo_nf_origem = "";
      coleta.arquivo_nf_devolucao = null;
      coleta.nome_arquivo_nf_devolucao = "";

      const concluidas = JSON.parse(localStorage.getItem("coletasConcluidas") || "[]");
      coleta.status = "Coleta Concluída";
      concluidas.push(coleta);
      coletas.splice(index, 1);
      localStorage.setItem("coletasConcluidas", JSON.stringify(concluidas));
      localStorage.setItem("coletas", JSON.stringify(coletas));
      exibirColetas();
      registrarLog(`Coleta da NF ${coleta.nf_origem} marcada como concluída`);
    }
  });
}
