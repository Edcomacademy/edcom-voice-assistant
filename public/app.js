const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("text");
const sendBtn = document.getElementById("send");
const micBtn = document.getElementById("mic");
const player = document.getElementById("player");
const scenarioEl = document.getElementById("scenario");

const API_URL = "/api/assistant"; // mismo dominio en Vercel

function addMsg(text, who) {
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.textContent = `${who === "yo" ? "Tú" : "Asistente"}: ${text}`;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

async function askServer({ message, audioBase64 }) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      audioBase64,
      scenario: scenarioEl.value
    })
  });
  if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
  return res.json();
}

sendBtn.onclick = async () => {
  const text = inputEl.value.trim();
  if (!text) return;
  addMsg(text, "yo");
  inputEl.value = "";
  try {
    const { text: answer, audioDataUrl } = await askServer({ message: text });
    addMsg(answer, "ia");
    player.src = audioDataUrl;
    player.play().catch(() => {});
  } catch (e) {
    addMsg("Error al consultar el servidor.", "ia");
    console.error(e);
  }
};

let mediaRecorder;
let chunks = [];
micBtn.onclick = async () => {
  try {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunks = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const base64 = await blobToBase64(blob);
        addMsg("Mensaje de voz enviado.", "yo");
        try {
          const { text: answer, audioDataUrl } = await askServer({ audioBase64: base64.split(",")[1] });
          addMsg(answer, "ia");
          player.src = audioDataUrl;
          player.play().catch(() => {});
        } catch (e) {
          addMsg("Error al transcribir o responder.", "ia");
          console.error(e);
        }
      };
      mediaRecorder.start(); // inicia
      micBtn.textContent = "⏹️ Detener";
    } else {
      mediaRecorder.stop();  // detiene
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

