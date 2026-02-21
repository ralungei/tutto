export const runtime = "nodejs";

export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ELEVENLABS_API_KEY not configured" },
      { status: 500 }
    );
  }

  const formData = await req.formData();
  const audioFile = formData.get("file");

  if (!audioFile || !(audioFile instanceof Blob)) {
    return Response.json(
      { error: "Audio file is required" },
      { status: 400 }
    );
  }

  try {
    const body = new FormData();
    body.append("file", audioFile, "audio.webm");
    body.append("model_id", "scribe_v2");
    const languageCode = formData.get("language_code")?.toString();
    if (languageCode) {
      body.append("language_code", languageCode);
    }

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
      },
      body,
    });

    if (!response.ok) {
      const error = await response.text();
      return Response.json(
        { error: `ElevenLabs STT error: ${error}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    return Response.json({ text: result.text || "" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
