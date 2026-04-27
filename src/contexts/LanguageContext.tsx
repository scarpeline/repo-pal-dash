import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Language = "pt-BR" | "en-US" | "es-ES";

interface LanguageContextData {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  "pt-BR": {
    "welcome": "Bem-vindo",
    "edit": "Editar",
    "save": "Salvar",
    "terminal": "Terminal",
    "chat": "Chat IA",
    "preview": "Pré-visualização",
    "files": "Arquivos",
    "commits": "Commits",
    "modified": "Modificado",
    "repo_placeholder": "Selecione um arquivo",
    "connect_gh": "Conecte seu GitHub para começar",
    "change_repo": "Trocar repositório",
    "language": "Idioma",
    "logout": "Sair",
    "wallet": "Carteira",
    "admin": "Painel Admin"
  },
  "en-US": {
    "welcome": "Welcome",
    "edit": "Edit",
    "save": "Save",
    "terminal": "Terminal",
    "chat": "AI Chat",
    "preview": "Preview",
    "files": "Files",
    "commits": "Commits",
    "modified": "Modified",
    "repo_placeholder": "Select a file",
    "connect_gh": "Connect your GitHub to start",
    "change_repo": "Change repository",
    "language": "Language",
    "logout": "Logout",
    "wallet": "Wallet",
    "admin": "Admin Panel"
  },
  "es-ES": {
    "welcome": "Bienvenido",
    "edit": "Editar",
    "save": "Guardar",
    "terminal": "Terminal",
    "chat": "Chat IA",
    "preview": "Vista previa",
    "files": "Archivos",
    "commits": "Commits",
    "modified": "Modificado",
    "repo_placeholder": "Seleccione un archivo",
    "connect_gh": "Conecta tu GitHub para comenzar",
    "change_repo": "Cambiar repositorio",
    "language": "Idioma",
    "logout": "Salir",
    "wallet": "Billetera",
    "admin": "Panel Admin"
  }
};

const LanguageContext = createContext<LanguageContextData>({} as LanguageContextData);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>("pt-BR");

  useEffect(() => {
    // Detect system language automatically by region/browser settings
    const storedLang = localStorage.getItem("app_lang") as Language | null;

    if (storedLang && ["pt-BR", "en-US", "es-ES"].includes(storedLang)) {
      setLanguage(storedLang);
    } else {
      const systemLang = navigator.language.toLowerCase();
      if (systemLang.includes("pt")) {
        setLanguage("pt-BR");
      } else if (systemLang.includes("es")) {
        setLanguage("es-ES");
      } else {
        setLanguage("en-US");
      }
    }
  }, []);

  const changeLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("app_lang", lang);
    // Update HTML lang attribute for accessibility/SEO
    document.documentElement.lang = lang.split('-')[0];
  };

  const t = (key: string) => {
    return translations[language][key] || translations["en-US"][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
