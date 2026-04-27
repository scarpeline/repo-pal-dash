// Obsidian Vault helpers — operate on a GitHub repo as the vault.
// Stores selected vault config in localStorage.

import {
  getRepos,
  getRepoTree,
  getFileContent,
  updateFile,
  createFile,
  getFileSha,
  type GitHubRepo,
  type FileNode,
} from "./github";

export interface VaultConfig {
  owner: string;
  repo: string;
  branch: string;
}

const VAULT_KEY = "obsidian_vault_config";

export function getVaultConfig(): VaultConfig | null {
  try {
    const v = localStorage.getItem(VAULT_KEY);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export function setVaultConfig(cfg: VaultConfig) {
  localStorage.setItem(VAULT_KEY, JSON.stringify(cfg));
}

export function clearVaultConfig() {
  localStorage.removeItem(VAULT_KEY);
}

export async function listVaultRepos(token: string): Promise<GitHubRepo[]> {
  return getRepos(token);
}

export interface VaultNote {
  path: string;
  name: string;
}

function flattenMd(nodes: FileNode[]): VaultNote[] {
  const out: VaultNote[] = [];
  const walk = (arr: FileNode[]) => {
    for (const n of arr) {
      if (n.type === "file" && n.name.toLowerCase().endsWith(".md")) {
        out.push({ path: n.path, name: n.name.replace(/\.md$/i, "") });
      } else if (n.type === "dir" && n.children) {
        walk(n.children);
      }
    }
  };
  walk(nodes);
  return out;
}

export async function listNotes(token: string, cfg: VaultConfig): Promise<VaultNote[]> {
  const tree = await getRepoTree(token, cfg.owner, cfg.repo, cfg.branch);
  return flattenMd(tree).sort((a, b) => a.name.localeCompare(b.name));
}

export async function readNote(
  token: string,
  cfg: VaultConfig,
  path: string,
): Promise<{ content: string; sha: string }> {
  return getFileContent(token, cfg.owner, cfg.repo, path, cfg.branch);
}

export async function saveNote(
  token: string,
  cfg: VaultConfig,
  path: string,
  content: string,
  message = "Update note via IAProgramador",
): Promise<void> {
  try {
    const sha = await getFileSha(token, cfg.owner, cfg.repo, path, cfg.branch);
    await updateFile(token, cfg.owner, cfg.repo, path, content, message, sha, cfg.branch);
  } catch {
    await createFile(token, cfg.owner, cfg.repo, path, content, message, cfg.branch);
  }
}

// Extract [[wiki-links]] from note body
export function extractLinks(content: string): string[] {
  const re = /\[\[([^\]\n|#]+)(?:[#|][^\]\n]*)?\]\]/g;
  const set = new Set<string>();
  let m;
  while ((m = re.exec(content)) !== null) {
    set.add(m[1].trim());
  }
  return [...set];
}

export interface GraphData {
  nodes: { id: string; label: string; path?: string; val: number }[];
  links: { source: string; target: string }[];
}

export async function buildGraph(
  token: string,
  cfg: VaultConfig,
  notes: VaultNote[],
  onProgress?: (loaded: number, total: number) => void,
): Promise<GraphData> {
  const nodes = new Map<string, { id: string; label: string; path?: string; val: number }>();
  for (const n of notes) {
    nodes.set(n.name.toLowerCase(), { id: n.name.toLowerCase(), label: n.name, path: n.path, val: 1 });
  }

  const links: { source: string; target: string }[] = [];
  let loaded = 0;
  // Limit concurrent requests
  const batchSize = 5;
  for (let i = 0; i < notes.length; i += batchSize) {
    const batch = notes.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (n) => {
        try {
          const { content } = await readNote(token, cfg, n.path);
          const targets = extractLinks(content);
          for (const t of targets) {
            const tid = t.toLowerCase();
            if (!nodes.has(tid)) {
              nodes.set(tid, { id: tid, label: t, val: 0.5 });
            }
            const src = n.name.toLowerCase();
            links.push({ source: src, target: tid });
            const node = nodes.get(tid)!;
            node.val += 1;
          }
        } catch {
          // ignore unreadable file
        }
        loaded++;
        onProgress?.(loaded, notes.length);
      }),
    );
  }

  return { nodes: [...nodes.values()], links };
}
