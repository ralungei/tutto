# Tutto - Tu asistente para todo

Asistente personal con terminal web, voz e IA. Ejecuta comandos, habla con Claude, y controla todo desde cualquier lugar.

## Configuración

```bash
cp .env.local.example .env.local  # o edita .env.local directamente
npm install
npm run dev
```

### Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `ANTHROPIC_API_KEY` | Sí | API key de Anthropic para el chat con IA |
| `ELEVENLABS_API_KEY` | No | API key de ElevenLabs para respuestas de voz (TTS) |
| `ELEVENLABS_VOICE_ID` | No | ID de la voz de ElevenLabs (por defecto "Rachel") |
| `TUTTO_SECRET` | No | Token de acceso para proteger la app |

## Autenticación

Por defecto Tutto funciona sin autenticación (modo local). Si lo expones por internet (túnel, VPS, etc.), configura `TUTTO_SECRET` para protegerlo:

```bash
# En .env.local
TUTTO_SECRET=mi-token-super-secreto
```

### Cómo funciona

- Al abrir la app aparece una pantalla de login pidiendo el token
- El token se guarda en `sessionStorage` (se borra al cerrar la pestaña)
- Todas las llamadas a `/api/*` requieren `Authorization: Bearer <token>`
- Las conexiones SSE (terminal, voz) envían el token como query param
- **Rate limiting**: 10 intentos fallidos por minuto por IP → bloqueo temporal
- **Sin `TUTTO_SECRET`**: todo funciona sin login, cero fricción

## Stack

- **Frontend**: Next.js 16, React, Tailwind CSS, xterm.js
- **Backend**: Next.js API routes, node-pty
- **IA**: Claude (Anthropic API)
- **Voz**: ElevenLabs (TTS/STT), Web Speech API (fallback)
