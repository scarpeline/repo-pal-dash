const GITHUB_API = "https://api.github.com";

export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
  bio: string | null;
  public_repos: number;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  default_branch: string;
  updated_at: string;
  owner: { login: string; avatar_url: string };
}

export type GHRepo = GitHubRepo;

export interface GitHubBranch {
  name: string;
  commit: { sha: string };
  protected: boolean;
}

export type GHBranch = GitHubBranch;

export interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: "file" | "dir";
  content?: string;
  encoding?: string;
  download_url: string | null;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  author: { login: string; avatar_url: string } | null;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  html_url: string;
  user: { login: string; avatar_url: string };
  head: { ref: string };
  base: { ref: string };
  created_at: string;
  merged_at: string | null;
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
  };
}

async function ghFetch<T>(url: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, headers: { ...headers(token), ...options?.headers } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error: ${res.status}`);
  }
  return res.json();
}

// Token management
export function getToken(): string | null {
  return localStorage.getItem("gh_token");
}

export function setToken(token: string) {
  localStorage.setItem("gh_token", token);
}

export function clearToken() {
  localStorage.removeItem("gh_token");
  localStorage.removeItem("gh_user");
}

export function getStoredUser(): { login: string; avatar_url: string; name: string } | null {
  try {
    const stored = localStorage.getItem("gh_user");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export async function validateToken(token: string): Promise<{ valid: boolean; user?: any; error?: string }> {
  try {
    const user = await getUser(token);
    return { valid: true, user: { login: user.login, avatar_url: user.avatar_url, name: user.name || user.login } };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

export async function exchangeCodeForToken(code: string, state?: string): Promise<any> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const res = await fetch(`https://${projectId}.supabase.co/functions/v1/github-oauth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, state }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    return { error: data.error || "Failed to exchange code" };
  }
  return data;
}

export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

export async function getRepoByUrl(token: string, owner: string, repo: string): Promise<GHRepo> {
  return ghFetch(`${GITHUB_API}/repos/${owner}/${repo}`, token);
}

// API functions
export async function getUser(token: string): Promise<GitHubUser> {
  return ghFetch(`${GITHUB_API}/user`, token);
}

export async function getRepos(token: string): Promise<GitHubRepo[]> {
  return ghFetch(`${GITHUB_API}/user/repos?sort=updated&per_page=50&affiliation=owner,collaborator`, token);
}

export async function getRepo(token: string, owner: string, repo: string): Promise<GitHubRepo> {
  return ghFetch(`${GITHUB_API}/repos/${owner}/${repo}`, token);
}

export async function getBranches(token: string, owner: string, repo: string): Promise<GitHubBranch[]> {
  return ghFetch(`${GITHUB_API}/repos/${owner}/${repo}/branches`, token);
}

export async function listBranches(token: string, owner: string, repo: string): Promise<GHBranch[]> {
  return getBranches(token, owner, repo);
}

export async function getContents(token: string, owner: string, repo: string, path: string, ref?: string): Promise<GitHubContent[]> {
  const q = ref ? `?ref=${ref}` : "";
  const data = await ghFetch<GitHubContent | GitHubContent[]>(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}${q}`, token);
  return Array.isArray(data) ? data : [data];
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileNode[];
}

export async function getRepoTree(token: string, owner: string, repo: string, branch: string): Promise<FileNode[]> {
  const res = await ghFetch<{ tree: { path: string; type: string }[] }>(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, token
  );
  
  const root: FileNode[] = [];
  const dirs: Record<string, FileNode> = {};

  for (const item of res.tree) {
    const parts = item.path.split("/");
    const name = parts[parts.length - 1];
    const type = item.type === "tree" ? "dir" : "file";
    const node: FileNode = { name, path: item.path, type, ...(type === "dir" ? { children: [] } : {}) };

    if (type === "dir") dirs[item.path] = node;

    if (parts.length === 1) {
      root.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join("/");
      dirs[parentPath]?.children?.push(node);
    }
  }

  // Sort: dirs first, then files
  const sortNodes = (nodes: FileNode[]): FileNode[] => {
    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    }).map(n => n.children ? { ...n, children: sortNodes(n.children) } : n);
  };

  return sortNodes(root);
}

export async function getFileContent(token: string, owner: string, repo: string, path: string, ref?: string): Promise<{ content: string; sha: string }> {
  const q = ref ? `?ref=${ref}` : "";
  const data = await ghFetch<GitHubContent>(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}${q}`, token);
  let content = "";
  if (data.content && data.encoding === "base64") {
    content = atob(data.content.replace(/\n/g, ""));
  }
  return { content, sha: data.sha };
}

export async function getFileSha(token: string, owner: string, repo: string, path: string, ref?: string): Promise<string> {
  const q = ref ? `?ref=${ref}` : "";
  const data = await ghFetch<GitHubContent>(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}${q}`, token);
  return data.sha;
}

export async function updateFile(
  token: string, owner: string, repo: string, path: string,
  content: string, message: string, sha: string, branch?: string
): Promise<{ sha: string; commitUrl: string }> {
  const body: Record<string, string> = { message, content: btoa(unescape(encodeURIComponent(content))), sha };
  if (branch) body.branch = branch;
  const res = await ghFetch<any>(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`, token, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return { sha: res.content?.sha || sha, commitUrl: res.commit?.html_url || "" };
}

export async function createFile(
  token: string, owner: string, repo: string, path: string,
  content: string, message: string, branch?: string
): Promise<void> {
  const body: Record<string, string> = { message, content: btoa(content) };
  if (branch) body.branch = branch;
  await ghFetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`, token, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function getCommits(token: string, owner: string, repo: string, branch?: string): Promise<GitHubCommit[]> {
  const q = branch ? `?sha=${branch}&per_page=30` : "?per_page=30";
  return ghFetch(`${GITHUB_API}/repos/${owner}/${repo}/commits${q}`, token);
}

export async function getPullRequests(token: string, owner: string, repo: string, state: "open" | "closed" | "all" = "open"): Promise<GitHubPullRequest[]> {
  return ghFetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls?state=${state}&per_page=30`, token);
}

export async function createPullRequest(
  token: string, owner: string, repo: string,
  title: string, head: string, base: string, body?: string
): Promise<GitHubPullRequest> {
  return ghFetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls`, token, {
    method: "POST",
    body: JSON.stringify({ title, head, base, body }),
  });
}

export async function createBranch(
  token: string, owner: string, repo: string,
  branchName: string, fromSha: string
): Promise<void> {
  await ghFetch(`${GITHUB_API}/repos/${owner}/${repo}/git/refs`, token, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: fromSha }),
  });
}

export function getLanguageColor(lang: string | null): string {
  const colors: Record<string, string> = {
    TypeScript: "#3178c6", JavaScript: "#f1e05a", Python: "#3572A5",
    Rust: "#dea584", Go: "#00ADD8", Java: "#b07219", Ruby: "#701516",
    CSS: "#563d7c", HTML: "#e34c26", Shell: "#89e051", Dart: "#00B4AB",
    Swift: "#F05138", Kotlin: "#A97BFF", C: "#555555", "C++": "#f34b7d",
    "C#": "#178600", PHP: "#4F5D95", Vue: "#41b883", Svelte: "#ff3e00",
  };
  return colors[lang || ""] || "#8b949e";
}
