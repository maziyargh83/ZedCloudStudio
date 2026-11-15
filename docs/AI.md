# Liara text generation

The `/ai` workspace sends an explicitly submitted text prompt to the loopback Hono API, which calls Liara's OpenAI-compatible `/chat/completions` endpoint. The default model is `openai/gpt-4o-mini`; change `LIARA_MODEL` on the server to use another model allowed by the service plan.

The ignored root `.env` contains `LIARA_API_KEY`, `LIARA_BASE_URL` and optional `LIARA_MODEL`. The URL must be the complete service URL (`https://ai.liara.ir/api/v1/<service-id>`), not the console address or the generic domain. Keep the file owner-only (`0600`). Restart the API after changing environment settings. Never put the key in a `VITE_` variable, browser storage, committed files or MCP output.

`GET /v1/ai/status` reports configuration presence and the selected model; it does not test upstream availability or credit. `POST /v1/ai/generate` accepts `{ "prompt": "..." }` and returns `{ "text": "...", "provider": "liara", "model": "..." }`. Requests are limited to 8000 prompt characters, one active generation per API process, 1024 output tokens and a 60-second upstream timeout. There are no automatic retries or background AI jobs. The UI supports cancellation and presents provider failures without echoing upstream response bodies. Responses arrive as complete text, not simulated streaming.

Each request is independent. Prompts and replies are not persisted by Z Cloud; they remain in the current page state until navigation/reload. Only the entered prompt is submitted, alongside a fixed system instruction. No media, catalog entries, browser memories, drafts or conversation history are included automatically. The separate review-question and trip-travelogue actions explicitly submit the text described in their UI; see `TRAVEL_WORKFLOWS.md`. Liara/provider retention follows the external service's policy. AI answers are labeled and rendered as plain text.

The existing gateway and retrieval contracts remain available, but vector search, RAG, media analysis, automatic tagging, embeddings and MCP generation are not integrated. The inspector links to the AI workspace rather than implying it has analyzed the selected asset.

Official references: [service URL and setup](https://docs.liara.ir/ai/quick-start/) and [OpenAI-compatible models and requests](https://docs.liara.ir/ai/openai/).
