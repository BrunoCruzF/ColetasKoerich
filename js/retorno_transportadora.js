// Recupera o usuário logado. Renomeamos a variável para evitar conflito com
// a constante `user` declarada em menu.js.
const currentUser = JSON.parse(localStorage.getItem("usuarioLogado"));
if (!currentUser || currentUser.tipo !== "admin") {
  alert("Acesso restrito ao administrador.");
  window.location.href = "index.html";
}

let retornos = JSON.parse(localStorage.getItem("retornosTransportadora") || "[]");
let coletas = JSON.parse(localStorage.getItem("coletas") || "[]");

const tabela = document.getElementById("tabelaRetornos");

// Variável de busca. Quando preenchida, serve para filtrar retornos por NF, transportadora ou observação.
let filtroBusca = "";

// Variáveis de ordenação e paginação para os retornos da transportadora
let currentSortColTrans = "";
let currentSortDirTrans = 1;
let currentPageTrans = 1;
const itemsPerPageTrans = 10;

// Função de ordenação chamada ao clicar nos cabeçalhos
window.ordenarRetTrans = function(coluna) {
  if (currentSortColTrans === coluna) {
    currentSortDirTrans = -currentSortDirTrans;
  } else {
    currentSortColTrans = coluna;
    currentSortDirTrans = 1;
  }
  currentPageTrans = 1;
  exibirRetornos();
};

// Adiciona evento ao campo de busca, se existir. Ao digitar, atualiza o filtro e redesenha a tabela.
const campoBuscaRetornos = document.getElementById('searchInput');
if (campoBuscaRetornos) {
  campoBuscaRetornos.addEventListener('input', function() {
    filtroBusca = this.value.trim().toLowerCase();
    exibirRetornos();
  });
}

function exibirRetornos() {
  tabela.innerHTML = "";
  // Aplica filtro de busca e monta lista com índices
  let lista = [];
  retornos.forEach((c, i) => {
    const termo = filtroBusca;
    const atendeFiltro = !termo ||
      (c.nf_origem && c.nf_origem.toLowerCase().includes(termo)) ||
      (c.nf_devolucao && c.nf_devolucao.toLowerCase().includes(termo)) ||
      (c.transportadora && c.transportadora.toLowerCase().includes(termo)) ||
      (c.observacao && c.observacao.toLowerCase().includes(termo));
    if (atendeFiltro) {
      lista.push({ coleta: c, index: i });
    }
  });
  // Ordenação
  if (currentSortColTrans) {
    lista.sort((a, b) => {
      const valA = a.coleta[currentSortColTrans] || "";
      const valB = b.coleta[currentSortColTrans] || "";
      if (valA < valB) return -1 * currentSortDirTrans;
      if (valA > valB) return 1 * currentSortDirTrans;
      return 0;
    });
  }
  // Paginação
  const totalItems = lista.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPageTrans));
  if (currentPageTrans > totalPages) currentPageTrans = totalPages;
  const start = (currentPageTrans - 1) * itemsPerPageTrans;
  const pageItems = lista.slice(start, start + itemsPerPageTrans);
  // Exibe cada item da página
  pageItems.forEach(({ coleta: c, index: i }) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${c.nf_origem}</td>
      <td>${c.nf_devolucao || ""}</td>
      <td>
        <input type="date" class="form-control form-control-sm" value="${c.data_prevista || ''}"
               onchange="atualizarDataPrevistaRetorno(${i}, this.value)" />
      </td>
      <td>${c.status}</td>
      <td>${c.transportadora}</td>
      <td>${c.observacao || ""}</td>
      <td class="text-center">
        <div class="btn-group" role="group">
          <button type="button" class="btn btn-primary btn-sm"
                  style="min-width: 90px; padding: 0.25rem 0.5rem; font-size: 0.8rem;"
                  onclick="abrirModal(${i})">Reencaminhar</button>
          <button type="button" class="btn btn-danger btn-sm"
                  style="min-width: 90px; padding: 0.25rem 0.5rem; font-size: 0.8rem;"
                  onclick="cancelarRetorno(${i})">Cancelar</button>
        </div>
      </td>
    `;
    tabela.appendChild(row);
  });
  renderPaginationRetTrans(totalPages);
}

// Desenha a paginação específica da tela de retorno da transportadora
function renderPaginationRetTrans(totalPages) {
  const pag = document.getElementById('paginationRetTrans');
  if (!pag) return;
  pag.innerHTML = '';
  function criar(pagina, rotulo, desativado = false, ativo = false) {
    const li = document.createElement('li');
    li.className = `page-item${desativado ? ' disabled' : ''}${ativo ? ' active' : ''}`;
    const a = document.createElement('a');
    a.className = 'page-link';
    a.href = '#';
    a.textContent = rotulo;
    if (!desativado) {
      a.addEventListener('click', function(e) {
        e.preventDefault();
        currentPageTrans = pagina;
        exibirRetornos();
      });
    }
    li.appendChild(a);
    return li;
  }
  // Anterior
  pag.appendChild(criar(Math.max(1, currentPageTrans - 1), 'Anterior', currentPageTrans === 1));
  // Números
  for (let p = 1; p <= totalPages; p++) {
    pag.appendChild(criar(p, p, false, p === currentPageTrans));
  }
  // Próxima
  pag.appendChild(criar(Math.min(totalPages, currentPageTrans + 1), 'Próxima', currentPageTrans === totalPages));
}

// Atualiza a data prevista de um retorno. Persiste a alteração no localStorage,
// registra no log (se disponível) e redesenha a tabela.
function atualizarDataPrevistaRetorno(index, novaData) {
  retornos[index].data_prevista = novaData;
  localStorage.setItem('retornosTransportadora', JSON.stringify(retornos));
  if (window.registrarLog) {
    const coleta = retornos[index];
    window.registrarLog(`Atualizou data prevista do retorno (NF Origem ${coleta.nf_origem}) para ${novaData}`);
  }
  exibirRetornos();
}

function abrirModal(index) {
  const modal = new bootstrap.Modal(document.getElementById("modalReencaminhar"));
  document.querySelector("#formReencaminhar input[name='index']").value = index;
  modal.show();
}

// Cancela uma coleta devolvida, removendo-a da lista de retornos. Solicita confirmação
// ao usuário antes de excluir. Após a exclusão, atualiza o localStorage e a tabela.

function cancelarRetorno(index) {
  Swal.fire({
    title: 'Confirmação',
    text: 'Tem certeza que deseja cancelar esta coleta?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sim',
    cancelButtonText: 'Não'
  }).then(result => {
    if (result.isConfirmed) {
      const coleta = retornos[index];
      // Remove anexos para evitar lotar o localStorage
      coleta.arquivo_nf_origem = null;
      coleta.nome_arquivo_nf_origem = "";
      coleta.arquivo_nf_devolucao = null;
      coleta.nome_arquivo_nf_devolucao = "";
      // Remove do array
      retornos.splice(index, 1);
      localStorage.setItem('retornosTransportadora', JSON.stringify(retornos));
      if (window.registrarLog) {
        window.registrarLog(`Cancelou retorno da coleta (NF Origem ${coleta.nf_origem})`);
      }
      exibirRetornos();
    }
  });
}

  // Atualiza a tabela
  exibirRetornos();

document.getElementById("formReencaminhar").addEventListener("submit", function (e) {
  e.preventDefault();
  const index = parseInt(this.index.value);
  const novaTransportadora = this.nova_transportadora.value;

  if (!novaTransportadora) return;

  const coleta = retornos[index];
  coleta.transportadora = novaTransportadora;
  coleta.status = "Aguardando Coleta";

  coletas.push(coleta);
  retornos.splice(index, 1);

  localStorage.setItem("coletas", JSON.stringify(coletas));
  localStorage.setItem("retornosTransportadora", JSON.stringify(retornos));

  bootstrap.Modal.getInstance(document.getElementById("modalReencaminhar")).hide();
  exibirRetornos();
});

exibirRetornos();
