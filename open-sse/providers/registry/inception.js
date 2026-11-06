export default {
  id: "inception",
  priority: 55,
  hasFree: true,
  alias: "inception",
  display: {
    name: "Inception Labs",
    icon: "bolt",
    color: "#6D5CE7",
    textIcon: "IN",
    website: "https://www.inceptionlabs.ai",
    notice: {
      text: "New accounts may receive 100 million free tokens. Availability and model access are subject to the account's current plan.",
      apiKeyUrl: "https://platform.inceptionlabs.ai",
    },
  },
  category: "apikey",
  authType: "apikey",
  transport: {
    baseUrl: "https://api.inceptionlabs.ai/v1/chat/completions",
    validateUrl: "https://api.inceptionlabs.ai/v1/models",
    thinkingFormat: "openai",
  },
  // Keep the static fallback conservative. The chat model picker uses the
  // connected account's live /models response, not this registry list.
  models: [
    { id: "mercury-3", name: "Mercury 3" },
  ],
  passthroughModels: false,
};
