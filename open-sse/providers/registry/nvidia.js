export default {
  id: "nvidia",
  priority: 20,
  hasFree: true,
  alias: "nvidia",
  display: {
    name: "NVIDIA NIM",
    icon: "developer_board",
    color: "#76B900",
    textIcon: "NV",
    website: "https://developer.nvidia.com/nim",
    notice: {
      text: "Free access for NVIDIA Developer Program members (prototyping & testing).",
      apiKeyUrl: "https://build.nvidia.com/settings/api-keys",
    },
  },
  category: "freeTier",
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
    validateUrl: "https://integrate.api.nvidia.com/v1/models",
  },
  // Keep only model IDs documented by NVIDIA's current NIM chat API.
  // Audio, embedding, and other task-specific models must not be routed
  // through /v1/chat/completions.
  models: [
    { id: "deepseek-ai/deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash" },
    { id: "deepseek-ai/deepseek-v4-pro", name: "DeepSeek V4 Pro" },
    { id: "minimaxai/minimax-m2.7", name: "MiniMax M2.7" },
    { id: "moonshotai/kimi-k3", name: "Kimi K3" },
    { id: "nvidia/nemotron-3-ultra-550b-a55b", name: "Nemotron 3 Ultra" },
    { id: "nvidia/nemotron-3.5-lightning-30b-a3b", name: "Nemotron 3.5 Lightning 30B" },
    { id: "nvidia/nemotron-3.5-bolt-e4b", name: "Nemotron 3.5 Bolt E4B" },
    { id: "nvidia/nemotron-3-nano-30b-a3b", name: "Nemotron 3 Nano 30B" },
    { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B" },
    { id: "qwen/qwen3-next-80b-a3b-instruct", name: "Qwen3 Next 80B Instruct" },
    { id: "meta/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct" },
    { id: "microsoft/phi-4-mini-instruct", name: "Phi-4 Mini Instruct" },
  ],
  serviceKinds: ["llm"],
};
