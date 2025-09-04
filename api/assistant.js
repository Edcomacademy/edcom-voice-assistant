import OpenAI, { toFile } from "openai";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function difficultyHints(level = "media") {
  const d = String(level || "media").toLowerCase();
  if (d === "facil") {
    return [
      "La persona usuaria se muestra colaborativa.",
      "Evita lenguaje agresivo.",
      "Expone el problema en una o dos frases.",
      "Deja espacio para que la persona asesora pregunte."
    ];
  }
  if (d === "dificil") {
    return [
      "La persona usuaria llega molesta y con frustración acumulada.",
      "Usa expresiones firmes sin insultos.",
      "Interrumpe y exige soluciones inmediatas.",
      "Añade detalles que confunden para poner a prueba la escucha activa."
    ];
  }
  // media
  return [
    "La persona usuaria expresa inconformidad, pero acepta el diálogo.",
    "Pide claridad sobre pasos y tiempos.",
    "Trae un antecedente o folio previo."
  ];
}

// SISTEMA: plantillas
function systemForTutor(scenario = "atencion_ciudadana") {
  if (scenario === "atencion_ciudadana") {
    return [
      "Rol: Asesoría de Atención Ciudadana.",
      "Objetivo: contener, escuchar y resolver con lenguaje inclusivo y respetuoso.",
      "Pautas:",
      "- Saluda, valida la emoción y resume el problema antes de proponer.",
      "- Explica pasos concretos, tiempos y límites institucionales.",
      "- Evita tecnicismos innecesarios, ofrece alternativas realistas.",
      "- Cierra con confirmación de entendimiento y próximos pasos.",
      "Tono: empático, claro, profesional. Español de México."
    ].join("\n");
  }
  return "Eres una persona asistente clara, inclusiva y profesional en español.";
}

function systemForSimulation(scenario = "atencion_ciudadana", difficulty = "media") {
  const hints = difficultyHints(difficulty);
  if (scenario === "atencion_ciudadana") {
    return [
      "Rol: Persona ciudadana que acude a Atención Ciudadana.",
      "Objetivo: plantear un caso verosímil para que la persona asesora practique.",
      "Lo que SÍ haces:",
      "- Planteas el problema desde tu perspectiva.",
      "- Mantienes coherencia con el contexto de trámites municipales.",
      "- Respondes en turnos breves (2 a 4 oraciones) para permitir la interacción.",
      "- Si la asesora pide datos, entregas información razonable (folio, fecha, área).",
      `Dificultad: ${difficulty}. Pistas de actuación:`,
      ...hints.map(h => `• ${h}`),
      "Lo que NO haces:",
      "- No das la solución por la asesora.",
      "- No insultas ni usas lenguaje discriminatorio.",
      "Idioma: español de México. Mantén la simulación sin romper personaje."
    ].join("\n");
  }
  return "Simula a una persona usuaria de manera verosímil, sin romper personaje.";
}

export async function OPTIONS() {
  return new Response(null, { headers: cors });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      message,          // texto del usuario (cuando mode = tutor)
      audioBase64,      // audio del usuario (cuando mode = tutor)
      scenario,         // "atencion_ciudadana" | "general"
      mode,             // "tutor" | "sim"
      difficulty,       // "facil" | "media" | "dificil"
      start,            // true para que la IA inicie la simulación
      history = []      // historial [{role:"user"|"assistant"|"system", content:"..."}]
    } = body || {};

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1) Si llega audio, transcribe; si no, usa texto
    let userText = message || "";
    if (audioBase64) {
      const audioBuffer = Buffer.from(audioBase64, "base64");
      const transcription = await openai.audio.transcriptions.create({
        model: "gpt-4o-mini-transcribe",
        file: await toFile(audioBuffer, "audio.webm")
      });
      userText = (transcription.text || "").trim();
    }

    // 2) Construye el sistema según el modo
    let system;
    if (String(mode).toLowerCase() === "sim") {
      system = systemForSimulation(scenario, difficulty);
    } else {
      system = systemForTutor(scenario);
    }

    // 3) Prepara la entrada para Responses API
    //    Usamos un prompt compacto + historial del front.
    const messages = [];
    messages.push({ role: "system", content: system });

    // Si es simulación y start=true, pedimos a la IA que INICIE la interacción.
    if (String(mode).toLowerCase() === "sim" && start) {
      messages.push({
        role: "user",
        content:
          "Inicia la simulación con tu primera intervención como persona ciudadana. Presenta el caso en 2–3 oraciones y una petición clara."
      });
    } else {
      // Caso normal: agregamos historial + último mensaje del usuario si existe
      for (const m of history) {
        if (!m || !m.role || !m.content) continue;
        messages.push({ role: m.role, content: m.content });
      }
      if (userText) {
        messages.push({ role: "user", content: userText });
      }
    }

    const resp = await openai.responses.create({
      model: "gpt-4o-mini",
      input: messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n")
    });

    const answer = (resp.output_text || "").trim();

    // 4) Genera voz
    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: answer,
      format: "mp3"
    });
    const audioArrayBuffer = await speech.arrayBuffer();
    const audioBase64Out = Buffer.from(audioArrayBuffer).toString("base64");
    const dataUrl = `data:audio/mp3;base64,${audioBase64Out}`;

    return new Response(
      JSON.stringify({ text: answer, audioDataUrl: dataUrl }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "Error en el servidor", details: String(err) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
}
