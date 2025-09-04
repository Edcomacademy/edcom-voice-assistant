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

// Historial local para mantener el contexto de la conversación
const history = []; // elementos { role: "user"|"assistant", content: "..." }

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

// Enviar por texto
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

// Iniciar simulación (la IA habla primero como Ciudadanía)
startSimBtn.onclick = async () => {
  if (modeEl.value !== "sim") {
    alert("Selecciona el modo Simulación para iniciar.");
    return;
  }

  // Reinicia historial y chat para una nueva simulación
  history.length = 0;
  chatEl.innerHTML = "";

  try {
    const { text: answer, audioDataUrl } = await askServer({
      start: true,                    // << clave para que el backend inicie
      scenario: scenarioEl.value,
      mode: "sim",
      difficulty: difficultyEl.value,
      history: []
    });

    addMsg(answer, "ciudadania");
    history.push({ role: "assistant", content: answer });

    player.src = audioDataUrl;
    player.play().catch(() => {});
  } catch (e) {
    addMsg("No se pudo iniciar la simulación.", "ia");
    console.error(e);
  }
};

// Envío por voz
let mediaRecorder;
let chunks = [];
micBtn.onclick = async () => {
  try {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const base64 = await blobToBase64(blob);

        addMsg("Mensaje de voz enviado.", "yo");
        history.push({ role: "user", content: "[Voz del estudiante]" });

        try {
          const { text: answer, audioDataUrl } = await askServer({
            audioBase64: base64.split(",")[1],
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
          addMsg("Error al transcribir o responder.", "ia");
          console.error(e);
        }
      };

      mediaRecorder.start();
      micBtn.textContent = "⏹️ Detener";
    } else {
      mediaRecorder.stop();
      micBtn.textContent = "🎤 Hablar";
    }
  } catch (e) {
    alert("Permite el micrófono para usar voz.");
    console.error(e);
  }
};

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
