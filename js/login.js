const usersFixos = {
  "koerich":     { senha: "eugenio", tipo: "admin" },
  "marketplace": { senha: "mkt", tipo: "admin" },
  "logistica":   { senha: "logkad", tipo: "admin" },
  "recebimento": { senha: "kad2025", tipo: "operador" },
  "recebimentokad": { senha: "kad2025", tipo: "operador" },
  "atual":       { senha: "atual1", tipo: "transportadora" },
  "reunidas":    { senha: "reu2", tipo: "transportadora" },
  "redesul":     { senha: "redes3", tipo: "transportadora" },
  "brasilweb":   { senha: "bw3", tipo: "transportadora" },
  "zanotelli":   { senha: "zano4", tipo: "transportadora" },
  "tjb":         { senha: "tjb1", tipo: "transportadora" }
};

function login() {
  const usuario = document.getElementById("username").value.trim().toLowerCase();
  const senha = document.getElementById("password").value.trim();
  const erro = document.getElementById("login-error");

  if (usersFixos[usuario] && usersFixos[usuario].senha === senha) {
    localStorage.setItem("usuarioLogado", JSON.stringify({
      nome: usuario,
      tipo: usersFixos[usuario].tipo
    }));
    window.location.href = "dashboard.html";
    return;
  }

  const usersDinamicos = JSON.parse(localStorage.getItem("usuariosSistema") || "{}");
  const user = usersDinamicos[usuario];

  if (user && user.senha === senha) {
    const tipo = user.tipo;
    const nome = tipo === "transportadora" ? user.transportadora : usuario;

    localStorage.setItem("usuarioLogado", JSON.stringify({
      nome: nome,
      tipo: tipo,
      transportadora: user.transportadora || null
    }));
    window.location.href = "dashboard.html";
    return;
  }

  erro.classList.remove("d-none");
}