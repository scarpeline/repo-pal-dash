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

export interface GitHubBranch {
  name: string;
  commit: { sha: string };
  protected: boolean;
}

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

export async function getContents(token: string, owner: string, repo: string, path: string, ref?: string): Promise<GitHubContent[]> {
  const q = ref ? `?ref=${ref}` : "";
  const data = await ghFetch<GitHubContent | GitHubContent[]>(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}${q}`, token);
  return Array.isArray(data) ? data : [data];
}

export async function getFileContent(token: string, owner: string, repo: string, path: string, ref?: string): Promise<string> {
  const q = ref ? `?ref=${ref}` : "";
  const data = await ghFetch<GitHubContent>(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}${q}`, token);
  if (data.content && data.encoding === "base64") {
    return atob(data.content.replace(/\n/g, ""));
  }
  return "";
}

export async function getFileSha(token: string, owner: string, repo: string, path: string, ref?: string): Promise<string> {
  const q = ref ? `?ref=${ref}` : "";
  const data = await ghFetch<GitHubContent>(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}${q}`, token);
  return data.sha;
}

export async function updateFile(
  token: string, owner: string, repo: string, path: string,
  content: string, message: string, sha: string, branch?: string
): Promise<void> {
  const body: Record<string, string> = { message, content: btoa(content), sha };
  if (branch) body.branch = branch;
  await ghFetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`, token, {
    method: "PUT",
    body: JSON.stringify(body),
  });
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
