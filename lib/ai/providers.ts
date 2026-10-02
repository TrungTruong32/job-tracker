export type AiProvider = "openrouter" | "gemini" | "ollama" | "custom"

export const PROVIDER_PRESETS: Record<AiProvider, { label: string; baseUrl: string; modelHint: string; note?: string }> = {
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    modelHint: "vd: meta-llama/llama-3.3-70b-instruct:free",
  },
  gemini: {
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    modelHint: "vd: gemini-2.5-flash",
  },
  ollama: {
    label: "Ollama (máy local)",
    baseUrl: "http://localhost:11434/v1",
    modelHint: "vd: qwen2.5:7b",
    note: "Trình duyệt gọi thẳng Ollama trên máy này. Cần đặt biến môi trường OLLAMA_ORIGINS chứa domain của app rồi khởi động lại Ollama. Không dùng được trên thiết bị không chạy Ollama.",
  },
  custom: { label: "Tuỳ chỉnh (OpenAI-compatible)", baseUrl: "", modelHint: "tên model" },
}

/** Ollama runs on the user's machine, so the browser (not the server) must call it. */
export const isBrowserProvider = (p: AiProvider) => p === "ollama"
