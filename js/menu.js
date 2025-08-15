
const user = JSON.parse(localStorage.getItem("usuarioLogado"));
if (!user) {
  Swal.fire("Usuário não logado.");
  window.location.href = "index.html";
}

(() => {
  const style = document.createElement('style');
  style.textContent = `.navbar-nav .nav-link { font-weight: 700; }\n.navbar-brand { font-weight: 700; }`;
  document.head.appendChild(style);
})();

document.addEventListener("DOMContentLoaded", () => {
  const userInfo = document.getElementById("user-info");
  const menu = document.getElementById("menu-links");

  function addLink(texto, href) {
    const li = document.createElement("li");
    li.className = "nav-item";
    li.innerHTML = `<a class="nav-link" href="${href}">${texto}</a>`;
    menu.appendChild(li);
  }

  if (user.tipo === "admin") {
    addLink("Solicitação de Coletas", "dashboard.html");
    addLink("Coletas Concluídas", "concluidas.html");
    addLink("Retornos KAD", "retornos.html");
    addLink("Retorno Transportadora", "retorno_transportadora.html");
    addLink("Log de Alterações", "log.html");
    addLink("Gerenciar Usuários", "usuarios.html");
  } else if (user.tipo === "operador") {
    addLink("Coletas Concluídas", "concluidas.html");
    addLink("Retornos KAD", "retornos.html");
  } else if (user.tipo === "transportadora") {
    addLink("Solicitação de Coletas", "dashboard.html");
    addLink("Coletas Concluídas", "concluidas.html");
  } else {
    addLink("Solicitação de Coletas", "dashboard.html");
  }

  const btnSair = document.createElement("button");
  btnSair.innerHTML = "<i class='fas fa-sign-out-alt'></i> Sair";
  btnSair.className = "btn btn-outline-light btn-sm";
  btnSair.onclick = () => {
    localStorage.removeItem("usuarioLogado");
    window.location.href = "index.html";
  };

  if (userInfo) {
    const nomeTipo = `${user.nome} (${user.tipo})`;
    userInfo.textContent = nomeTipo;
    userInfo.after(btnSair);
  }
});
