// public/app.js
const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("text");
const sendBtn = document.getElementById("send");
const micBtn = document.getElementById("mic");
const player = document.getElementById("player");
const scenarioEl = document.getElementById("scenario");
const modeEl = document.getElementById("mode");
const difficultyEl = document.getElementById("difficulty");
const startSimBtn = document.getElementById("startSim");

const API_URL = "/api/assistant";

// Historial local para contexto
const history = []; // {role: "user"|"assistant", content: "..."}

function addMsg(text, who) {
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  const etiqueta =
    who === "yo" ? "Tú" : who === "ciudadania" ? "Ciudadanía" : "Asistente";
  div.textContent = `${etiqueta}: ${text}`;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

async function askServer(payload) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
  return res.json();
}

// Envío por texto
sendBtn.onclick = async () => {
  const text = inputEl.value.trim();
  if (!text) return;
  addMsg(text, "yo");
  history.push({ role: "user", content: text });
  inputEl.value = "";

  try {
    const { text: answer, audioDataUrl } = await askServer({
      message: text,
      scenario: scenarioEl.value,
      mode: modeEl.value,
      difficulty: difficultyEl.value,
      history
    });
    addMsg(answer, modeEl.value === "sim" ? "ciudadania" : "ia");
    history.push({ role: "assistant", content: answer });
    player.src = audioDataUrl;
    player.play().catch(() => {});
  } catch (e) {
    addMsg("Error al consultar el servidor.", "ia");
    console.error(e);
  }
};

// Inicio de simulación (IA habla primero como ciudadanía)
startSimBtn.onclick = async () => {
  if (modeEl.value !== "sim") {
    alert("Selecciona el modo Simulación.");
    return;
  }
  history.length = 0;
  chatEl.innerHTML = "";
