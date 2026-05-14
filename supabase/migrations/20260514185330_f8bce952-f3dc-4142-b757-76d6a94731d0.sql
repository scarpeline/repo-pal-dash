-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Projects table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    repository_url TEXT,
    provider TEXT DEFAULT 'github',
    architecture_map JSONB DEFAULT '{}',
    quality_score FLOAT DEFAULT 0,
    security_score FLOAT DEFAULT 0,
    performance_score FLOAT DEFAULT 0,
    scalability_score FLOAT DEFAULT 0,
    status TEXT DEFAULT 'pending',
    last_analyzed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Analysis results for security and performance
CREATE TABLE IF NOT EXISTS public.analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    agent_type TEXT NOT NULL, -- 'backend', 'frontend', 'devops', 'mobile', 'ia'
    vulnerability_type TEXT,
    severity TEXT,
    description TEXT,
    file_path TEXT,
    line_number INTEGER,
    remediation_plan TEXT,
    raw_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Semantic memory for the project brain
CREATE TABLE IF NOT EXISTS public.project_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536), -- Assuming OpenAI embeddings
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Autonomous patches
CREATE TABLE IF NOT EXISTS public.autonomous_patches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    analysis_result_id UUID REFERENCES public.analysis_results(id),
    title TEXT NOT NULL,
    description TEXT,
    diff TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'applied', 'rejected', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    applied_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autonomous_patches ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own projects" ON public.projects
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view analysis of their projects" ON public.analysis_results
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.projects WHERE id = analysis_results.project_id AND user_id = auth.uid())
    );

CREATE POLICY "Users can manage their project memory" ON public.project_memory
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.projects WHERE id = project_memory.project_id AND user_id = auth.uid())
    );

CREATE POLICY "Users can manage their project patches" ON public.autonomous_patches
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.projects WHERE id = autonomous_patches.project_id AND user_id = auth.uid())
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
