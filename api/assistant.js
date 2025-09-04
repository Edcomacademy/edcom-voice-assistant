import OpenAI, { toFile } from "openai";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

// Escenario base: Atención Ciudadana, tono empático, inclusivo y profesional.
function buildSystemPrompt(scenario = "atencion_ciudadana") {
  if (scenario === "atencion_ciudadana") {
    return [
      "Eres una persona asesora de Atención Ciudadana.",
      "Objetivo: contener, escuchar y resolver. Lenguaje inclusivo, claro y respetuoso.",
      "Si la solicitud rebasa tu competencia, orienta con pasos concretos.",
      "Responde en español de México, con cortesía y precisión.",
      "Sé firme con límites institucionales, sin sonar punitivo."
    ].join("\n");
  }
  return "Eres una persona asistente útil, clara y profesional en español.";
}

export async function OPTIONS() {
  return new Response(null, { headers: cors });
}

export async function POST(request) {
  try {
    const { message, audioBase64, scenario } = await request.json();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1) Si llega audio, transcribe; si no, usa el mensaje de texto
    let userText = message || "";
    if (audioBase64) {
      const audioBuffer = Buffer.from(audioBase64, "base64");
      const transcription = await openai.audio.transcriptions.create({
        // Modelos actuales de STT (más nuevos que Whisper):
        // gpt-4o-transcribe / gpt-4o-mini-transcribe
        // Para costo bajo usa el "mini":
        model: "gpt-4o-mini-transcribe",
        file: await toFile(audioBuffer, "audio.webm")
      });
      userText = (transcription.text || "").trim();
    }

    if (!userText) {
      return new Response(
        JSON.stringify({ error: "Falta 'message' o 'audioBase64'." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = buildSystemPrompt(scenario);

    // 2) Genera la respuesta en texto con Responses API
    const prompt = `${systemPrompt}\n\nPersona usuaria: ${userText}\n\nTu respuesta:`;
    const resp = await openai.responses.create({
      model: "gpt-4o-mini",
      input: prompt
    });
    const answer = (resp.output_text || "").trim();

    // 3) Convierte la respuesta a audio con TTS
    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",   // Puedes cambiar a: verse, coral, sage, etc.
      input: answer,
      format: "mp3"     // mp3 funciona bien en la mayoría de navegadores
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

