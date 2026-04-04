import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

const AuthErrorHandler = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const ghError = searchParams.get("gh_error");
    if (ghError) {
      toast.error(`Erro GitHub: ${ghError}`);
      searchParams.delete("gh_error");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return null;
};

export default AuthErrorHandler;
