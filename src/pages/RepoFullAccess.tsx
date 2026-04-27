import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Github, 
  ExternalLink, 
  Code, 
  Eye, 
  Settings,
  Terminal,
  GitBranch,
  Users,
  Star,
  Zap,
  Globe,
  Smartphone,
  Monitor,
  Tablet
} from "lucide-react";
import { toast } from "sonner";
import AppPreview from "@/components/AppPreview";
import { getToken, validateToken, getRepoTree, getFileContent } from "@/lib/github";

interface RepoInfo {
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  defaultBranch: string;
  updatedAt: string;
  htmlUrl: string;
  owner: {
    login: string;
    avatarUrl: string;
  };
}

export default function RepoFullAccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  const repoOwner = searchParams.get("owner");
  const repoName = searchParams.get("repo");
  const isLive = searchParams.get("live") === "true";

  useEffect(() => {
    if (repoOwner && repoName) {
      loadRepoInfo();
    } else {
      // Redirecionar para seleção de repositório se não houver parâmetros
      navigate("/");
    }
  }, [repoOwner, repoName, navigate]);

  const loadRepoInfo = async () => {
    try {
      setIsLoading(true);
      const token = getToken();
      
      if (!token) {
        toast.error("Token GitHub não encontrado. Conecte-se primeiro.");
        navigate("/");
        return;
      }

      // Validar token
      const validation = await validateToken(token);
      if (!validation.valid) {
        toast.error("Token GitHub inválido. Conecte-se novamente.");
        navigate("/");
        return;
      }

      // Carregar informações do repositório
      const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ao carregar repositório: ${response.statusText}`);
      }

      const repoData = await response.json();
      
      setRepoInfo({
        name: repoData.name,
        fullName: repoData.full_name,
        description: repoData.description,
        language: repoData.language,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        defaultBranch: repoData.default_branch,
        updatedAt: repoData.updated_at,
        htmlUrl: repoData.html_url,
        owner: {
          login: repoData.owner.login,
          avatarUrl: repoData.owner.avatar_url
        }
      });

      // Carregar arquivos do repositório (sem limite)
      const tree = await getRepoTree(token, repoOwner, repoName, repoData.default_branch);
      setFiles(tree);

    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
      console.error('Error loading repo info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openInGitHub = () => {
    if (repoInfo) {
      window.open(repoInfo.htmlUrl, "_blank");
    }
  };

  const openInVSCode = () => {
    if (repoInfo) {
      const vscodeUrl = `vscode://vscode.github.com/github/${repoInfo.fullName}`;
      window.open(vscodeUrl, "_blank");
    }
  };

  const openInGitpod = () => {
    if (repoInfo) {
      const gitpodUrl = `https://gitpod.io/#https://github.com/${repoInfo.fullName}`;
      window.open(gitpodUrl, "_blank");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Carregando repositório...</p>
        </div>
      </div>
    );
  }

  if (!repoInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card>
          <CardContent className="p-8 text-center">
            <Github className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Repositório não encontrado</h2>
            <p className="text-muted-foreground mb-4">Não foi possível carregar as informações do repositório.</p>
            <Button onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <div className="flex items-center gap-3">
                <img 
                  src={repoInfo.owner.avatarUrl} 
                  alt={repoInfo.owner.login}
                  className="w-8 h-8 rounded-full"
                />
                <div>
                  <h1 className="text-lg font-semibold">{repoInfo.fullName}</h1>
                  <p className="text-sm text-muted-foreground">
                    {repoInfo.description || "Sem descrição"}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                <Code className="w-3 h-3 mr-1" />
                {repoInfo.language || "N/A"}
              </Badge>
              <Badge variant="secondary">
                <Star className="w-3 h-3 mr-1" />
                {repoInfo.stars}
              </Badge>
              <Badge variant="secondary">
                <GitBranch className="w-3 h-3 mr-1" />
                {repoInfo.defaultBranch}
              </Badge>
              {isLive && (
                <Badge variant="default">
                  <Zap className="w-3 h-3 mr-1" />
                  Ao Vivo
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="files" className="flex items-center gap-2">
              <Code className="w-4 h-4" />
              Arquivos
            </TabsTrigger>
            <TabsTrigger value="actions" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Ações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <Star className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold">{repoInfo.stars}</p>
                  <p className="text-sm text-muted-foreground">Estrelas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <GitBranch className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold">{repoInfo.forks}</p>
                  <p className="text-sm text-muted-foreground">Forks</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Code className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold">{repoInfo.language || "N/A"}</p>
                  <p className="text-sm text-muted-foreground">Linguagem</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Users className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold">{repoInfo.owner.login}</p>
                  <p className="text-sm text-muted-foreground">Dono</p>
                </CardContent>
              </Card>
            </div>

            {/* Repository Info */}
            <Card>
              <CardHeader>
                <CardTitle>Informações do Repositório</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Nome Completo</p>
                    <p className="font-mono">{repoInfo.fullName}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Branch Padrão</p>
                    <p className="font-mono">{repoInfo.defaultBranch}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Última Atualização</p>
                    <p>{new Date(repoInfo.updatedAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">URL</p>
                    <a 
                      href={repoInfo.htmlUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {repoInfo.htmlUrl}
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview">
            <AppPreview isLive={isLive} />
          </TabsContent>

          <TabsContent value="files" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Arquivos do Repositório</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Code className="w-4 h-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{file.path}</span>
                      </div>
                      <Badge variant="outline">
                        {file.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Ações Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button onClick={openInGitHub} className="flex items-center gap-2">
                    <Github className="w-4 h-4" />
                    Abrir no GitHub
                  </Button>
                  <Button onClick={openInVSCode} variant="outline" className="flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    Abrir no VS Code
                  </Button>
                  <Button onClick={openInGitpod} variant="outline" className="flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    Abrir no Gitpod
                  </Button>
                  <Button 
                    onClick={() => window.open(`https://iaprogramador.online`, "_blank")} 
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Globe className="w-4 h-4" />
                    Ver App Publicado
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Links Úteis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">App Publicado</p>
                    <p className="text-sm text-muted-foreground">iaprogramador.online</p>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => window.open("https://iaprogramador.online", "_blank")}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">Repositório GitHub</p>
                    <p className="text-sm text-muted-foreground">{repoInfo.fullName}</p>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={openInGitHub}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
