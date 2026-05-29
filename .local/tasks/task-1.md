---
title: Gemini migration, PDF analysis & reliability fixes
---
# Gemini Migration, PDF Analysis & Reliability Fixes

## What & Why
Replace OpenAI with Google Gemini for all AI tasks (PDF understanding, image analysis, query intent extraction, and response generation). Also fix PDF upload so the agent deeply understands and explains uploaded documents, add robust error handling throughout, cache/store search responses so the same question doesn't re-hit the API, and resolve timeout errors that leave users waiting indefinitely.

## Done looks like
- All AI calls (chat responses, PDF analysis, image analysis) use the `GOOGLE_API_KEY` / Gemini API — no OpenAI calls remain in the AI service layer
- Uploading a PDF causes Gemini to read and explain its contents; users can ask questions and get document-grounded answers
- Timeout errors show a clear user-facing message instead of crashing or hanging
- Every search response is saved to `search_history` and reused when the same question is asked again (cache hit shown to user)
- Error states (API failure, upload failure, timeout) all display a helpful inline message in the chat UI — no silent failures

## Out of scope
- Replacing HDX HAPI or other external agriculture data API calls (those stay as-is)
- Adding new document types beyond PDF and images
- User-facing cache management (clearing cache, seeing cache stats)

## Steps
1. **Install Gemini SDK and store the API key** — Add `@google/generative-ai` package; register `GOOGLE_API_KEY` as an environment secret so the server can read it.
2. **Rewrite the AI service with Gemini** — Replace `server/utils/openai-service.ts` entirely: swap the OpenAI client for `GoogleGenerativeAI`, use `gemini-1.5-flash` for text tasks and `gemini-1.5-pro` (vision-capable) for image analysis. Keep the same exported function signatures so nothing else needs to change.
3. **Deep PDF understanding** — In the PDF upload route and in `searchInDocuments`, pass the full extracted PDF text to Gemini with a detailed system prompt so it genuinely explains contents, not just keyword-searches them. Add a dedicated `/api/documents/:id/ask` endpoint so users can ask follow-up questions about a specific document.
4. **Response caching in search_history** — Before hitting any AI/API, check `search_history` for an identical or near-identical query (same query string, same user). On cache hit, return the stored result immediately with a `cached: true` flag. On new queries, save the full AI response to `search_history.results`.
5. **Timeout and error handling** — Wrap all Gemini calls and external API calls with a `Promise.race` against a 30-second timeout. Add a top-level Express error-handling middleware that returns structured JSON errors. On the frontend (`ChatPage.tsx`), catch errors from mutations and display an inline error banner with a retry button.

## Relevant files
- `server/utils/openai-service.ts`
- `server/utils/external-apis.ts`
- `server/utils/file-processor.ts`
- `server/routes.ts`
- `server/index.ts`
- `shared/schema.ts`
- `client/src/pages/ChatPage.tsx`