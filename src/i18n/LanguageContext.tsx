import React, { createContext, useContext } from "react";

export type AppLanguage = "pt" | "en";

const translations = {
  pt: {
    "welcome.enter": "ENTRAR NO OFFICE",
    "welcome.atmosphere": "ÍNDICE ATMOSFÉRICO",
    "welcome.max": "Máx.",
    "welcome.loading": "A CARREGAR SISTEMA",
    "welcome.access": "ACESSO AXION PROTOCOL • LIGAÇÃO LISBOA",
    "welcome.audit": "TODAS AS ATIVIDADES SÃO REGISTADAS • PROTOCOLO V1.0.0",
    "nav.main": "Painel Principal",
    "nav.overview": "Visão Geral",
    "nav.clients": "Clientes",
    "nav.database": "Base de Dados",
    "nav.databaseSub": "Sincronização Excel",
    "nav.documents": "Documentos",
    "nav.documentsSub": "Cofre Digital",
    "nav.calendar": "Agenda e Reuniões",
    "nav.calendarSub": "Google Calendar e Tasks",
    "nav.payments": "Financeiro",
    "nav.paymentsSub": "Despesas e pagamentos",
    "nav.aiva": "AIVA Intelligence",
    "nav.soon": "Brevemente",
    "nav.settings": "Definições",
    "nav.settingsSub": "Configuração",
    "nav.aria": "Navegação principal",
    "home.access": "ACESSO PARTNER SEGURO",
    "home.goodMorning": "BOM DIA",
    "home.goodAfternoon": "BOA TARDE",
    "home.goodEvening": "BOA NOITE",
    "home.session": "TEMPO NO OFFICE",
    "home.meeting": "PRÓXIMO COMPROMISSO",
    "home.openMeeting": "ABRIR CONTEXTO DO CLIENTE",
    "home.activity": "ATIVIDADE RECENTE DO SISTEMA",
  },
  en: {
    "welcome.enter": "ENTER OFFICE",
    "welcome.atmosphere": "ATMOSPHERE INDEX",
    "welcome.max": "Max",
    "welcome.loading": "LOADING SYSTEM",
    "welcome.access": "AXION PROTOCOL ACCESS • LISBON GATEWAY",
    "welcome.audit": "ALL ACTIVITIES LOGGED • PROTOCOL V1.0.0",
    "nav.main": "Command Center",
    "nav.overview": "Overview",
    "nav.clients": "Clients",
    "nav.database": "Database",
    "nav.databaseSub": "Excel Data Sync",
    "nav.documents": "Documents",
    "nav.documentsSub": "Digital Vault",
    "nav.calendar": "Calendar and Meetings",
    "nav.calendarSub": "Google Calendar and Tasks",
    "nav.payments": "Finance",
    "nav.paymentsSub": "Expenses and payments",
    "nav.aiva": "AIVA Intelligence",
    "nav.soon": "Coming soon",
    "nav.settings": "Settings",
    "nav.settingsSub": "Configuration",
    "nav.aria": "Main navigation",
    "home.access": "PARTNER ACCESS SECURED",
    "home.goodMorning": "GOOD MORNING",
    "home.goodAfternoon": "GOOD AFTERNOON",
    "home.goodEvening": "GOOD EVENING",
    "home.session": "TIME IN OFFICE",
    "home.meeting": "UPCOMING ENGAGEMENT",
    "home.openMeeting": "OPEN CLIENT CONTEXT",
    "home.activity": "RECENT SYSTEM ACTIVITY",
  },
} as const;

type TranslationKey = keyof typeof translations.pt;

interface LanguageContextValue {
  language: AppLanguage;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "pt",
  t: (key) => translations.pt[key],
});

export function LanguageProvider({ language, children }: { language: AppLanguage; children: React.ReactNode }) {
  const value: LanguageContextValue = {
    language,
    t: (key) => translations[language][key],
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
