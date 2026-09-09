import { transform } from "@babel/standalone";
import { getRepoTree, getFileContent, type FileNode } from "@/lib/github";

/**
 * Motor de execução de apps do GitHub direto no navegador (estilo Lovable).
 * Lê os arquivos do repositório, compila TSX/TS/JSX em memória, resolve os imports
 * (relativos, alias "@/", CSS, assets e pacotes npm via esm.sh) e monta um documento
 * HTML executável exibido dentro de um iframe.
 */

const SOURCE_EXT = [".tsx", ".ts", ".jsx", ".js", ".mjs"];
const STYLE_EXT = [".css", ".scss", ".sass", ".less"];
const ASSET_EXT = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif", ".ico", ".mp4", ".mp3", ".woff", ".woff2", ".ttf"];
const MAX_FILES = 220;

export interface RepoAppBundle {
  html: string;
  entry: string;
  filesCompiled: number;
  warnings: string[];
}

const flatten = (nodes: FileNode[], acc: string[] = []): string[] => {
  for (const node of nodes) {
    if (node.type === "dir") flatten(node.children || [], acc);
    else acc.push(node.path);
  }
  return acc;
};

const isSource = (p: string) => SOURCE_EXT.some((e) => p.endsWith(e));
const isStyle = (p: string) => STYLE_EXT.some((e) => p.endsWith(e));
const isAsset = (p: string) => ASSET_EXT.some((e) => p.toLowerCase().endsWith(e));

const joinPath = (fromFile: string, spec: string) => {
  const base = fromFile.split("/").slice(0, -1);
  const parts = spec.split("/");
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") base.pop();
    else base.push(part);
  }
  return base.join("/");
};

/** Remove diretivas que precisam de build (Tailwind) mantendo o resto do CSS utilizável. */
const sanitizeCss = (css: string) =>
  css
    .replace(/@tailwind[^;]*;/g, "")
    .replace(/@apply[^;}]*;/g, "")
    .replace(/@layer\s+[a-z-]+\s*\{/g, "")
    .replace(/@config[^;]*;/g, "");

export async function buildRepoApp(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  onProgress?: (msg: string) => void
): Promise<RepoAppBundle> {
  const warnings: string[] = [];
  onProgress?.("Lendo arquivos do repositório...");

  const tree = await getRepoTree(token, owner, repo, branch);
  const allPaths = flatten(tree);

  const wanted = allPaths.filter(
    (p) =>
      !p.includes("node_modules/") &&
      !p.startsWith("dist/") &&
      !p.startsWith("build/") &&
      !/\.(test|spec)\./.test(p) &&
      (isSource(p) || isStyle(p) || p === "index.html" || p === "package.json")
  );

  if (!wanted.some((p) => isSource(p))) {
    throw new Error("Nenhum código-fonte JavaScript/TypeScript encontrado neste repositório.");
  }

  const paths = wanted.slice(0, MAX_FILES);
  if (wanted.length > MAX_FILES) warnings.push(`Repositório grande: carregados ${MAX_FILES} de ${wanted.length} arquivos.`);

  onProgress?.(`Baixando ${paths.length} arquivos...`);
  const sources = new Map<string, string>();
  for (let i = 0; i < paths.length; i += 8) {
    const chunk = paths.slice(i, i + 8);
    await Promise.all(
      chunk.map(async (path) => {
        try {
          const { content } = await getFileContent(token, owner, repo, path, branch);
          sources.set(path, content);
        } catch {
          warnings.push(`Não foi possível ler ${path}`);
        }
      })
    );
  }

  // Dependências do package.json para fixar versões no esm.sh
  let deps: Record<string, string> = {};
  try {
    const pkg = JSON.parse(sources.get("package.json") || "{}");
    deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  } catch {
    warnings.push("package.json inválido ou ausente — usando versões padrão dos pacotes.");
  }
  const reactVersion = (deps.react || "18").replace(/[^\d.]/g, "") || "18";

  const cdnFor = (spec: string) => {
    const scoped = spec.startsWith("@");
    const name = scoped ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
    const sub = spec.slice(name.length);
    const version = deps[name] ? `@${deps[name].replace(/^[\^~]/, "")}` : "";
    return `https://esm.sh/${name}${version}${sub}?external=react,react-dom&deps=react@${reactVersion},react-dom@${reactVersion}`;
  };

  const rawUrl = (path: string) => `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;

  // Resolve um especificador de import para um caminho do repositório
  const resolveLocal = (fromFile: string, spec: string): string | null => {
    let target: string | null = null;
    if (spec.startsWith(".")) target = joinPath(fromFile, spec);
    else if (spec.startsWith("@/")) target = `src/${spec.slice(2)}`;
    else if (spec.startsWith("~/")) target = `src/${spec.slice(2)}`;
    else if (spec.startsWith("src/")) target = spec;
    if (!target) return null;

    if (sources.has(target)) return target;
    for (const ext of [...SOURCE_EXT, ...STYLE_EXT]) {
      if (sources.has(target + ext)) return target + ext;
    }
    for (const ext of SOURCE_EXT) {
      if (sources.has(`${target}/index${ext}`)) return `${target}/index${ext}`;
    }
    if (isAsset(target)) return target;
    return null;
  };

  const collectedCss: string[] = [];
  const blobUrls = new Map<string, string>();
  const building = new Set<string>();
  let compiled = 0;

  const specifierRegex = /(import\s+[^'"();]*?from\s*|export\s+[^'"();]*?from\s*|import\s*|import\(\s*)(['"])([^'"]+)\2/g;

  const buildModule = (path: string): string => {
    const existing = blobUrls.get(path);
    if (existing) return existing;

    if (isStyle(path)) {
      collectedCss.push(sanitizeCss(sources.get(path) || ""));
      const url = URL.createObjectURL(new Blob(["export default {};"], { type: "text/javascript" }));
      blobUrls.set(path, url);
      return url;
    }

    if (isAsset(path) || !isSource(path)) {
      const url = URL.createObjectURL(
        new Blob([`export default ${JSON.stringify(rawUrl(path))};`], { type: "text/javascript" })
      );
      blobUrls.set(path, url);
      return url;
    }

    const code = sources.get(path) || "";
    let output = "";
    try {
      output =
        transform(code, {
          filename: path,
          presets: [
            ["typescript", { isTSX: path.endsWith("x"), allExtensions: true }],
            ["react", { runtime: "automatic" }],
          ],
          sourceType: "module",
        }).code || "";
    } catch (err) {
      warnings.push(`Erro ao compilar ${path}: ${err instanceof Error ? err.message : String(err)}`);
      const url = URL.createObjectURL(new Blob(["export default {};"], { type: "text/javascript" }));
      blobUrls.set(path, url);
      return url;
    }

    // Placeholder para permitir dependências circulares
    const placeholder = URL.createObjectURL(new Blob([""], { type: "text/javascript" }));
    blobUrls.set(path, placeholder);
    building.add(path);

    const rewritten = output.replace(specifierRegex, (match, prefix, quote, spec) => {
      if (spec.startsWith("http") || spec.startsWith("blob:") || spec.startsWith("data:")) return match;
      const local = resolveLocal(path, spec);
      const url = local ? buildModule(local) : cdnFor(spec);
      return `${prefix}${quote}${url}${quote}`;
    });

    building.delete(path);
    URL.revokeObjectURL(placeholder);
    const finalUrl = URL.createObjectURL(new Blob([rewritten], { type: "text/javascript" }));
    blobUrls.set(path, finalUrl);
    compiled += 1;
    return finalUrl;
  };

  const entryCandidates = [
    "src/main.tsx", "src/main.jsx", "src/main.ts", "src/main.js",
    "src/index.tsx", "src/index.jsx", "src/index.ts", "src/index.js",
    "index.tsx", "index.jsx", "app/main.tsx", "src/App.tsx", "src/App.jsx",
  ];
  const entry = entryCandidates.find((c) => sources.has(c));
  if (!entry) throw new Error("Não encontrei o ponto de entrada do app (ex: src/main.tsx).");

  onProgress?.("Compilando o app...");
  const entryUrl = buildModule(entry);

  const usesTailwind = Boolean(deps.tailwindcss) || allPaths.some((p) => p.startsWith("tailwind.config"));
  const rootId = (sources.get("index.html")?.match(/id=["'](root|app)["']/) || [])[1] || "root";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${usesTailwind ? '<script src="https://cdn.tailwindcss.com"></script>' : ""}
<style>${collectedCss.join("\n")}</style>
<style>html,body,#${rootId}{min-height:100%;}body{margin:0;}</style>
</head>
<body>
<div id="${rootId}"></div>
<script type="module">
window.addEventListener("error", (e) => {
  document.body.insertAdjacentHTML("afterbegin",
    '<pre style="font:12px ui-monospace;color:#fca5a5;background:#1f2937;padding:12px;margin:0;white-space:pre-wrap">' +
    String(e.message).replace(/</g, "&lt;") + '</pre>');
});
import(${JSON.stringify(entryUrl)}).catch((err) => {
  document.body.insertAdjacentHTML("afterbegin",
    '<pre style="font:12px ui-monospace;color:#fca5a5;background:#1f2937;padding:12px;margin:0;white-space:pre-wrap">' +
    String(err && err.message || err).replace(/</g, "&lt;") + '</pre>');
});
</script>
</body>
</html>`;

  return { html, entry, filesCompiled: compiled, warnings };
}

export const revokeRepoAppUrls = () => {
  /* blobs são liberados quando a aba é fechada; mantido para futura limpeza explícita */
};
