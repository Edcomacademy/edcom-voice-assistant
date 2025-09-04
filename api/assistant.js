// api/assistant.js
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
      "La persona usuaria colabora.",
      "Evita lenguaje agresivo.",
      "Expone el problema en una o dos frases.",
      "Deja espacio para preguntas."
    ];
  }
  if (d === "dificil") {
    return [
      "La persona usuaria llega molesta.",
      "Usa expresiones firmes sin insultos.",
      "Exige soluciones inmediatas.",
      "Añade detalles confusos que prueban la escucha activa."
    ];
  }
  return [
    "La persona usuaria expresa inconformidad y acepta diálogo.",
    "Pide claridad sobre pasos y tiempos.",
    "Trae un folio o antecedente."
  ];
}

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
      "Sí haces:",
      "- Planteas el problema desde tu perspectiva.",
      "- Mantienes contexto municipal realista.",
      "- Respondes en turnos breves (2 a 4 oraciones).",
      "- Entregas datos razonables si te los piden (folio, fecha, área).",
      `Dificultad: ${difficulty}. Pistas:`,
      ...hints.map(h => `• ${h}`),
      "No haces:",
      "- No das la solución por la asesora.",
      "- No insultas ni usas lenguaje discriminatorio.",
      "Idioma: español de México. No rompas personaje."
    ].join("\n");
  }
  return "Simula a una persona usuaria de forma verosímil, sin romper personaje.";
}

export async function OPTIONS() {
  return new Response(null, { headers: cors });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      message,
      audioBase64,
      scenario = "atencion_ciudadana",
      mode = "tutor",          // "tutor" | "sim"
      difficulty = "media",    // "facil" | "media" | "dificil"
      start = false,           // true para que la IA inicie la simulación
      history = []             // [{role:"user"|"assi]()
