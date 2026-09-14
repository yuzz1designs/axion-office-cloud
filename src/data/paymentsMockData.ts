/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SaaSSubscription, ClientPayment } from "../types/payments";

// Apenas serviços de Inteligência Artificial conforme a estrutura da empresa
export const MOCK_SAAS_SUBSCRIPTIONS: SaaSSubscription[] = [
  {
    id: "saas-01",
    serviceName: "ChatGPT Enterprise / Team AI",
    provider: "OpenAI Inc.",
    category: "AI Tools",
    iconName: "Bot",
    amount: 240.00,
    currency: "EUR",
    dueDate: "2026-09-05",
    billingCycle: "monthly",
    paymentMethod: "Cartão Corporativo AXION Black (•• 8821)",
    status: "pending",
    executiveRole: "Senior Partner & Brand Architect",
    assignedUser: {
      name: "Nelson Afonso",
      role: "Senior Partner & Brand Architect"
    },
    autoRenew: true,
    notes: "Plano corporativo com modelos o1-preview, GPT-4o e workspaces dedicados da equipa criativa.",
    websiteUrl: "https://chatgpt.com"
  },
  {
    id: "saas-02",
    serviceName: "Higgsfield AI Video Neural Engine",
    provider: "Higgsfield AI",
    category: "AI Tools",
    iconName: "Video",
    amount: 175.00,
    currency: "EUR",
    dueDate: "2026-09-08",
    billingCycle: "monthly",
    paymentMethod: "Cartão Corporativo AXION Black (•• 8821)",
    status: "pending",
    executiveRole: "Creative Direction & AI Motion",
    assignedUser: {
      name: "Nelson Afonso",
      role: "Senior Partner & Brand Architect"
    },
    autoRenew: true,
    notes: "Geração de renders cinematográficos, animação neuronal e motion capture para campanhas.",
    websiteUrl: "https://higgsfield.ai"
  },
  {
    id: "saas-03",
    serviceName: "Midjourney Pro Tier & Dedicated GPUs",
    provider: "Midjourney Inc.",
    category: "AI Tools",
    iconName: "Sparkles",
    amount: 60.00,
    currency: "EUR",
    dueDate: "2026-09-12",
    billingCycle: "monthly",
    paymentMethod: "Cartão Corporativo AXION Black (•• 8821)",
    status: "scheduled",
    executiveRole: "Design Lead & Art Direction",
    assignedUser: {
      name: "Mariana Costa",
      role: "Lead UI/UX Designer"
    },
    autoRenew: true,
    notes: "Licença comercial com modo stealth ativo e horas rápidas de GPU para concept art.",
    websiteUrl: "https://midjourney.com"
  },
  {
    id: "saas-04",
    serviceName: "Claude Enterprise AI / Anthropic API",
    provider: "Anthropic PBC",
    category: "AI Tools",
    iconName: "Bot",
    amount: 180.00,
    currency: "EUR",
    dueDate: "2026-09-16",
    billingCycle: "monthly",
    paymentMethod: "Cartão Corporativo AXION Black (•• 8821)",
    status: "scheduled",
    executiveRole: "Liderança Técnica & Arquitetura",
    assignedUser: {
      name: "Nelson Afonso",
      role: "Senior Partner & Brand Architect"
    },
    autoRenew: true,
    notes: "Modelos Claude 3.5 Sonnet para redação técnica, código e raciocínio de dossiers arquiteturais.",
    websiteUrl: "https://anthropic.com"
  },
  {
    id: "saas-05",
    serviceName: "ElevenLabs Voice AI Studio",
    provider: "ElevenLabs Inc.",
    category: "AI Tools",
    iconName: "Mic",
    amount: 99.00,
    currency: "EUR",
    dueDate: "2026-09-22",
    billingCycle: "monthly",
    paymentMethod: "Cartão Corporativo AXION Black (•• 8821)",
    status: "scheduled",
    executiveRole: "Creative Tech & Voice",
    assignedUser: {
      name: "Nelson Afonso",
      role: "Senior Partner & Brand Architect"
    },
    autoRenew: true,
    notes: "Síntese de voz hiper-realista para atas interativas e agentes virtuais AIVA.",
    websiteUrl: "https://elevenlabs.io"
  },
  {
    id: "saas-06",
    serviceName: "Runway Gen-3 Alpha AI Video Studio",
    provider: "Runway AI, Inc.",
    category: "AI Tools",
    iconName: "Video",
    amount: 95.00,
    currency: "EUR",
    dueDate: "2026-09-27",
    billingCycle: "monthly",
    paymentMethod: "Cartão Corporativo AXION Black (•• 8821)",
    status: "scheduled",
    executiveRole: "AI Filmmaking & Motion",
    assignedUser: {
      name: "Nelson Afonso",
      role: "Senior Partner & Brand Architect"
    },
    autoRenew: true,
    notes: "Geração de vídeo generativo e câmara dinâmica para apresentações imersivas.",
    websiteUrl: "https://runwayml.com"
  }
];

export const MOCK_CLIENT_PAYMENTS: ClientPayment[] = [
  {
    id: "cl-pay-01",
    invoiceNumber: "FT AX-2026/089",
    clientName: "Casas do Beco",
    projectName: "Reabilitação & Master Identity Casas do Beco",
    description: "Tranche 2 • Dossier de Engenharia Estrutural e Integração de Arquitetura Técnica",
    amount: 12000.00,
    taxRate: 0.23,
    totalAmount: 14760.00,
    currency: "EUR",
    issueDate: "2026-08-22",
    dueDate: "2026-09-05",
    status: "pending",
    paymentMethod: "Transferência Bancária SEPA / IBAN",
    milestone: "Fase 2 (Aprovação de Engenharia)",
    contactPerson: {
      name: "Dr. Rodrigo Bettencourt",
      email: "finance@casasdobeco.pt",
      phone: "+351 912 345 678"
    },
    hasReceipt: false,
    notes: "Aguardando liquidação bancária após reunião de aprovação técnica de 31 Ago."
  },
  {
    id: "cl-pay-02",
    invoiceNumber: "FT AX-2026/092",
    clientName: "Quinta do Sol",
    projectName: "Ecosistema Digital & Estratégia de Marca Quinta do Sol",
    description: "Tranche 2 • Produção de 3D Virtual Staging & Assets de Campanha",
    amount: 7400.00,
    taxRate: 0.23,
    totalAmount: 9102.00,
    currency: "EUR",
    issueDate: "2026-08-24",
    dueDate: "2026-09-08",
    status: "pending",
    paymentMethod: "Transferência Bancária SEPA",
    milestone: "Fase 2 (3D & Virtual Staging)",
    contactPerson: {
      name: "Engª. Teresa Carvalheiro",
      email: "teresa@quintadosol.pt",
      phone: "+351 961 889 002"
    },
    hasReceipt: false,
    notes: "Fatura emitida com vencimento a 15 dias."
  },
  {
    id: "cl-pay-03",
    invoiceNumber: "FT AX-2026/095",
    clientName: "Herdade das Flores",
    projectName: "Masterplan Arquitetónico & Identidade Territorial",
    description: "Tranche 1 • Sinal de Início e Levantamento Topográfico Digital",
    amount: 8800.00,
    taxRate: 0.23,
    totalAmount: 10824.00,
    currency: "EUR",
    issueDate: "2026-08-26",
    dueDate: "2026-09-15",
    status: "pending",
    paymentMethod: "Transferência Bancária SEPA",
    milestone: "Fase 1 (Sinal & Início)",
    contactPerson: {
      name: "Comendador Manuel Flores",
      email: "geral@herdadedasflores.pt",
      phone: "+351 934 112 334"
    },
    hasReceipt: false,
    notes: "Documentos de adjudicação assinados digitalmente."
  },
  {
    id: "cl-pay-04",
    invoiceNumber: "FT AX-2026/078",
    clientName: "Vivenda Miramar",
    projectName: "Design de Interiores & Reabilitação Costeira",
    description: "Tranche Final • Conclusão de Obra e Produção Gráfica",
    amount: 14500.00,
    taxRate: 0.23,
    totalAmount: 17835.00,
    currency: "EUR",
    issueDate: "2026-08-05",
    dueDate: "2026-08-20",
    paidDate: "2026-08-19",
    status: "paid",
    paymentMethod: "Transferência Bancária SEPA",
    milestone: "Entrega Final",
    contactPerson: {
      name: "Drª. Helena Guedes",
      email: "helena.guedes@miramar.pt"
    },
    hasReceipt: true,
    receiptNumber: "RC AX-2026/078",
    notes: "Liquidado atempadamente com recibo fiscal emitido."
  },
  {
    id: "cl-pay-05",
    invoiceNumber: "FT AX-2026/082",
    clientName: "Urban Loft Lisboa",
    projectName: "Consultoria de Marca & Web Application",
    description: "Tranche 1 • Arquitetura de Informação e UI Kit",
    amount: 5800.00,
    taxRate: 0.23,
    totalAmount: 7134.00,
    currency: "EUR",
    issueDate: "2026-08-10",
    dueDate: "2026-08-25",
    paidDate: "2026-08-24",
    status: "paid",
    paymentMethod: "Transferência Bancária SEPA",
    milestone: "Fase 1 Concluída",
    contactPerson: {
      name: "Bernardo Falcão",
      email: "bfalcao@urbanloft.pt"
    },
    hasReceipt: true,
    receiptNumber: "RC AX-2026/082",
    notes: "Liquidado."
  }
];
