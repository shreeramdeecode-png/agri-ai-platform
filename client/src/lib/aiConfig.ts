import { formatGeminiModelLabel } from "./chatMessageUtils";

declare const __GEMINI_MODEL_ID__: string;

const modelId =
  typeof __GEMINI_MODEL_ID__ !== "undefined"
    ? __GEMINI_MODEL_ID__
    : "gemini-2.5-flash";

export const GEMINI_MODEL_ID = modelId;
export const GEMINI_MODEL_LABEL = formatGeminiModelLabel(modelId);
