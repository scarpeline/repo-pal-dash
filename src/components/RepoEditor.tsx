import { useState } from "react";
import { type GitHubRepo } from "@/lib/github";
import AppHeader from "@/components/AppHeader";
import FileTree from "@/components/FileTree";
import CodeEditor from "@/components/CodeEditor";
import BranchSelector from "@/components/BranchSelector";
import CommitHistory from "@/components/CommitHistory";
import PullRequests from "@/components/PullRequests";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileCode, GitCommit, GitPullRequest } from "lucide-react";

interface RepoEditorProps {
  repo: GitHubRepo;
  onBack: () => void;
}

export default function RepoEditor({ repo, onBack }: RepoEditorProps) {
  const [branch, setBranch] = useState(repo.default_branch);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const owner = repo.owner.login;

  return (
    <div className="h-screen flex flex-col bg-background">
      <AppHeader repoName={repo.name} onBack={onBack} />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 border-r border-border bg-sidebar flex flex-col shrink-0">
          <div className="p-3 border-b border-sidebar-border">
            <BranchSelector
              owner={owner}
              repo={repo.name}
              currentBranch={branch}
              onBranchChange={setBranch}
            />
          </div>

          <Tabs defaultValue="files" className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b border-sidebar-border bg-transparent px-2 h-9">
              <TabsTrigger value="files" className="gap-1 text-xs data-[state=active]:bg-sidebar-accent">
                <FileCode className="h-3.5 w-3.5" /> Arquivos
              </TabsTrigger>
              <TabsTrigger value="commits" className="gap-1 text-xs data-[state=active]:bg-sidebar-accent">
                <GitCommit className="h-3.5 w-3.5" /> Commits
              </TabsTrigger>
              <TabsTrigger value="prs" className="gap-1 text-xs data-[state=active]:bg-sidebar-accent">
                <GitPullRequest className="h-3.5 w-3.5" /> PRs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="files" className="flex-1 overflow-y-auto scrollbar-thin mt-0">
              <FileTree
                owner={owner}
                repo={repo.name}
                branch={branch}
                onSelectFile={setSelectedFile}
                selectedFile={selectedFile || undefined}
              />
            </TabsContent>

            <TabsContent value="commits" className="flex-1 overflow-y-auto scrollbar-thin mt-0">
              <CommitHistory owner={owner} repo={repo.name} branch={branch} />
            </TabsContent>

            <TabsContent value="prs" className="flex-1 overflow-y-auto scrollbar-thin mt-0">
              <PullRequests owner={owner} repo={repo.name} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Main content */}
        {selectedFile ? (
          <CodeEditor
            owner={owner}
            repo={repo.name}
            filePath={selectedFile}
            branch={branch}
            onClose={() => setSelectedFile(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-editor-bg">
            <div className="text-center space-y-2">
              <FileCode className="h-12 w-12 text-muted-foreground/30 mx-auto" />
              <p className="text-muted-foreground text-sm">Selecione um arquivo para editar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
