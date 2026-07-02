import type { ContentProvider } from "@/providers/provider";
import type { ProviderType } from "@/providers/index";

let globalProvider: ContentProvider | null = null;

export function setProvider(provider: ContentProvider) {
  globalProvider = provider;
}

export function getProvider(): ContentProvider {
  if (!globalProvider) throw new Error("ContentProvider not initialized");
  return globalProvider;
}

export function cacheKeyForProvider(name: string): string {
  const map: Record<string, string> = {
    remote: "remote",
    fs: "filesystem",
    localStorage: "localStorage",
  };
  return map[name] || name;
}

export function getProviderDisplayInfo(name: string): {
  icon: string;
  label: string;
  type: ProviderType;
} {
  const map: Record<string, { icon: string; label: string; type: ProviderType }> = {
    remote: { icon: "☁️", label: "Server (Remote)", type: "remote" },
    fs: { icon: "💻", label: "Local Files", type: "filesystem" },
    localStorage: { icon: "🗄️", label: "Browser Storage", type: "localStorage" },
  };
  return map[name] || { icon: "❓", label: name, type: name as ProviderType };
}
