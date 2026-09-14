export interface CalendarEvent {
  id: string;
  title: string;
  clientName?: string;
  clientRef?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  durationMinutes: number;
  locationType: "google_meet" | "zoom" | "in_person" | "discord_stage";
  locationUrl?: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  category: "client_sync" | "architecture" | "financial" | "creative" | "internal";
  description: string;
  attendees: {
    name: string;
    email: string;
    avatar?: string;
    role: string;
    status: "accepted" | "tentative" | "declined";
  }[];
  tasksCount: number;
  completedTasksCount: number;
  hasDiscordAta: boolean;
  discordAtaId?: string;
  discordChannelTarget?: string;
  gcalSynced: boolean;
  gcalEventId: string;
  updatedAt?: string;
  editable?: boolean;
}

export interface IntegratedTask {
  id: string;
  title: string;
  eventId?: string;
  eventTitle?: string;
  clientName?: string;
  clientRef?: string;
  priority: "high" | "medium" | "low";
  dueDate: string;
  dueTime?: string;
  completed: boolean;
  assignee: {
    name: string;
    avatar?: string;
  };
  estimatedTime?: string;
  syncedWithGCal: boolean;
  fromDiscordAta: boolean;
  notes?: string;
  estimatedMinutes?: number;
  googleTaskId?: string;
  updatedAt?: string;
}

export interface MeetingAta {
  id: string;
  eventId: string;
  meetingTitle: string;
  clientName: string;
  clientRef?: string;
  date: string;
  time: string;
  duration: string;
  recordedBy: string;
  audioDurationSeconds: number;
  discordChannel: string;
  discordStatus: "published" | "draft" | "queued";
  platformStatus: "published" | "pending_review" | "generating"; // Confirmação humana necessária
  discordMessageId?: string;
  discordPublishedAt?: string;
  reviewedBy?: string;
  executiveSummary: string;
  keyDecisions: string[];
  actionItems: {
    task: string;
    owner: string;
    deadline: string;
    syncedAsTask: boolean;
  }[];
  transcriptSegments: {
    id: string;
    speaker: string;
    role: string;
    timestamp: string;
    text: string;
  }[];
  tags: string[];
}

export interface MeetingInviteNotification {
  id: string;
  eventId: string;
  meetingTitle: string;
  clientName?: string;
  date: string;
  time: string;
  createdBy: {
    name: string;
    role: string;
    avatar?: string;
  };
  invitedUsers: string[]; // nomes ou emails dos membros convidados
  locationUrl?: string;
  timestamp: string;
  status: "pending" | "accepted" | "declined";
}

export interface DiscordChannelConfig {
  id: string;
  name: string;
  category: string;
  webhookStatus: "active" | "standby" | "disconnected";
  avatar: string;
  description: string;
}

export const DISCORD_CHANNELS: DiscordChannelConfig[] = [
  {
    id: "atas-executivas",
    name: "atas-executivas",
    category: "EXECUTIVE SUITE",
    webhookStatus: "active",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
    description: "Publicação automática de minutas com decisões estratégicas e sign-offs de clientes"
  },
  {
    id: "operacoes-projetos",
    name: "operacoes-projetos",
    category: "PROJECT DELIVERIES",
    webhookStatus: "active",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
    description: "Sincronização de tarefas técnicas e entregáveis saídos das reuniões de projeto"
  },
  {
    id: "comercial-propostas",
    name: "comercial-propostas",
    category: "COMMERCIAL & SALES",
    webhookStatus: "active",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
    description: "Alinhamento de novos orçamentos, pitches e aprovações de clientes"
  }
];

export const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: "evt-0-past-1",
    title: "Alinhamento Estrutural & BIM • Casas do Beco",
    clientName: "Casas do Beco",
    clientRef: "ECO-004",
    date: "2026-08-31",
    startTime: "11:00",
    endTime: "12:15",
    durationMinutes: 75,
    locationType: "google_meet",
    locationUrl: "https://meet.google.com/axion-beco-bim",
    status: "completed",
    category: "architecture",
    description: "Revisão e cálculo da laje de cobertura com a equipa de engenharia e modelação tridimensional BIM.",
    attendees: [
      { name: "Nelson Afonso", email: "nelson@axion.io", role: "Brand Architect & Lead", status: "accepted" },
      { name: "João Silva", email: "joao.silva@axion.io", role: "Structural Engineer", status: "accepted" },
      { name: "Clara Mendes", email: "clara.mendes@axion.io", role: "Project Manager", status: "accepted" }
    ],
    tasksCount: 3,
    completedTasksCount: 3,
    hasDiscordAta: true,
    discordAtaId: "ata-pending-1",
    discordChannelTarget: "operacoes-projetos",
    gcalSynced: true,
    gcalEventId: "gcal_past_beco_01"
  },
  {
    id: "evt-0-past-2",
    title: "Kickoff de Identidade & Posicionamento • Herdade da Foz",
    clientName: "Herdade da Foz",
    clientRef: "ECO-002",
    date: "2026-08-30",
    startTime: "15:00",
    endTime: "16:30",
    durationMinutes: 90,
    locationType: "google_meet",
    locationUrl: "https://meet.google.com/axion-foz-kickoff",
    status: "completed",
    category: "client_sync",
    description: "Definição das diretrizes de marca, público-alvo de enoturismo e estratégia de lançamento.",
    attendees: [
      { name: "Nelson Afonso", email: "nelson@axion.io", role: "Brand Architect & Lead", status: "accepted" },
      { name: "Mariana Costa", email: "mariana.c@axion.io", role: "Design Systems", status: "accepted" },
      { name: "Dra. Teresa Foz", email: "teresa@herdadedajoz.pt", role: "Client Owner", status: "accepted" }
    ],
    tasksCount: 4,
    completedTasksCount: 4,
    hasDiscordAta: true,
    discordAtaId: "ata-foz-published",
    discordChannelTarget: "atas-executivas",
    gcalSynced: true,
    gcalEventId: "gcal_past_foz_99"
  },
  {
    id: "evt-0-past-3",
    title: "Revisão Orçamental & Alocação Q3 • Direção AXION",
    clientName: "AXION Core",
    clientRef: "INT-001",
    date: "2026-08-29",
    startTime: "10:00",
    endTime: "11:30",
    durationMinutes: 90,
    locationType: "in_person",
    locationUrl: "Sala de Conselho AXION Hub",
    status: "completed",
    category: "financial",
    description: "Revisão dos fluxos de caixa, investimento em infraestrutura cloud e margem operacional da agência.",
    attendees: [
      { name: "Nelson Afonso", email: "nelson@axion.io", role: "Senior Partner", status: "accepted" },
      { name: "Carlos Ferreira", email: "carlos.f@axion.io", role: "Finance Director", status: "accepted" }
    ],
    tasksCount: 2,
    completedTasksCount: 2,
    hasDiscordAta: true,
    discordAtaId: "ata-finance-published",
    discordChannelTarget: "atas-executivas",
    gcalSynced: true,
    gcalEventId: "gcal_past_fin_33"
  },
  {
    id: "evt-1",
    title: "Project Sync • Casas do Beco",
    clientName: "Casas do Beco",
    clientRef: "ECO-004",
    date: "2026-08-31",
    startTime: "16:00",
    endTime: "17:00",
    durationMinutes: 60,
    locationType: "google_meet",
    locationUrl: "https://meet.google.com/axion-beco-sync",
    status: "completed",
    category: "architecture",
    description: "Revisão e integração de cálculos de engenharia estrutural com a equipa de arquitetura técnica.",
    attendees: [
      { name: "Nelson Afonso", email: "nelson@axion.io", role: "Brand Architect & Lead", status: "accepted" },
      { name: "João Silva", email: "joao.silva@axion.io", role: "Structural Engineer", status: "accepted" },
      { name: "Clara Mendes", email: "clara.mendes@axion.io", role: "Project Manager", status: "accepted" }
    ],
    tasksCount: 3,
    completedTasksCount: 1,
    hasDiscordAta: true,
    discordAtaId: "ata-1",
    discordChannelTarget: "operacoes-projetos",
    gcalSynced: true,
    gcalEventId: "gcal_beco_882910"
  },
  {
    id: "evt-2",
    title: "Refinamento de Brand Assets AXION",
    clientName: "AXION Core",
    clientRef: "INT-001",
    date: "2026-08-31",
    startTime: "17:30",
    endTime: "18:45",
    durationMinutes: 75,
    locationType: "google_meet",
    locationUrl: "https://meet.google.com/axion-design-hub",
    status: "scheduled",
    category: "creative",
    description: "Sessão intensiva de tipografia, sistema vetorial das órbitas e padrões de UI em alta resolução.",
    attendees: [
      { name: "Nelson Afonso", email: "nelson@axion.io", role: "Creative Lead", status: "accepted" },
      { name: "Mariana Costa", email: "mariana.c@axion.io", role: "Design Systems", status: "accepted" }
    ],
    tasksCount: 2,
    completedTasksCount: 0,
    hasDiscordAta: false,
    discordChannelTarget: "operacoes-projetos",
    gcalSynced: true,
    gcalEventId: "gcal_axion_47192"
  },
  {
    id: "evt-3",
    title: "Submissão & Pitch: Casa Santos",
    clientName: "Casa Santos",
    clientRef: "ECO-001",
    date: "2026-08-31",
    startTime: "20:00",
    endTime: "21:00",
    durationMinutes: 60,
    locationType: "google_meet",
    locationUrl: "https://meet.google.com/axion-santos-pitch",
    status: "scheduled",
    category: "client_sync",
    description: "Entrega do brand blueprint e apresentação do dashboard financeiro de investimento.",
    attendees: [
      { name: "Nelson Afonso", email: "nelson@axion.io", role: "Senior Partner", status: "accepted" },
      { name: "Dr. Eduardo Santos", email: "eduardo@casasantos.pt", role: "Client Principal", status: "accepted" },
      { name: "Beatriz Lima", email: "beatriz@axion.io", role: "Account Lead", status: "accepted" }
    ],
    tasksCount: 4,
    completedTasksCount: 2,
    hasDiscordAta: true,
    discordAtaId: "ata-2",
    discordChannelTarget: "atas-executivas",
    gcalSynced: true,
    gcalEventId: "gcal_santos_991823"
  },
  {
    id: "evt-4",
    title: "Project Review & Financial Alignment",
    clientName: "Casa Santos",
    clientRef: "ECO-001",
    date: "2026-09-01",
    startTime: "10:30",
    endTime: "11:30",
    durationMinutes: 60,
    locationType: "google_meet",
    locationUrl: "https://meet.google.com/axion-finance-santos",
    status: "scheduled",
    category: "financial",
    description: "Revisão orçamental trimestral e alocação de verbas para o novo ecossistema digital.",
    attendees: [
      { name: "Nelson Afonso", email: "nelson@axion.io", role: "Senior Partner", status: "accepted" },
      { name: "Carlos Ferreira", email: "carlos.f@axion.io", role: "Finance Director", status: "accepted" }
    ],
    tasksCount: 2,
    completedTasksCount: 0,
    hasDiscordAta: false,
    gcalSynced: true,
    gcalEventId: "gcal_santos_rev_110"
  },
  {
    id: "evt-5",
    title: "Workshop de SEO & Arquitetura Web: Quinta do Sol",
    clientName: "Quinta do Sol",
    clientRef: "ECO-003",
    date: "2026-09-02",
    startTime: "14:00",
    endTime: "15:30",
    durationMinutes: 90,
    locationType: "google_meet",
    locationUrl: "https://meet.google.com/axion-quinta-seo",
    status: "scheduled",
    category: "client_sync",
    description: "Planeamento de palavras-chave turísticas, estrutura de landing pages e conversão de leads.",
    attendees: [
      { name: "Nelson Afonso", email: "nelson@axion.io", role: "Lead Strategist", status: "accepted" },
      { name: "Rita Vasconcelos", email: "rita@quintadosol.pt", role: "Marketing Director", status: "accepted" }
    ],
    tasksCount: 3,
    completedTasksCount: 0,
    hasDiscordAta: false,
    gcalSynced: true,
    gcalEventId: "gcal_quinta_4401"
  }
];

export const MOCK_INTEGRATED_TASKS: IntegratedTask[] = [
  {
    id: "task-1",
    title: "Revisão e validação do relatório de engenharia estrutural",
    eventId: "evt-1",
    eventTitle: "Project Sync • Casas do Beco",
    clientName: "Casas do Beco",
    clientRef: "ECO-004",
    priority: "high",
    dueDate: "2026-08-31",
    dueTime: "15:30",
    completed: true,
    assignee: { name: "João Silva" },
    estimatedTime: "45m",
    syncedWithGCal: true,
    fromDiscordAta: true
  },
  {
    id: "task-2",
    title: "Exportar pranchas de renders e layout técnico para PDF",
    eventId: "evt-1",
    eventTitle: "Project Sync • Casas do Beco",
    clientName: "Casas do Beco",
    clientRef: "ECO-004",
    priority: "high",
    dueDate: "2026-08-31",
    dueTime: "15:50",
    completed: false,
    assignee: { name: "Clara Mendes" },
    estimatedTime: "25m",
    syncedWithGCal: true,
    fromDiscordAta: true
  },
  {
    id: "task-3",
    title: "Preparar questionário técnico de materiais acústicos",
    eventId: "evt-1",
    eventTitle: "Project Sync • Casas do Beco",
    clientName: "Casas do Beco",
    clientRef: "ECO-004",
    priority: "medium",
    dueDate: "2026-08-31",
    dueTime: "18:00",
    completed: false,
    assignee: { name: "Nelson Afonso" },
    estimatedTime: "30m",
    syncedWithGCal: false,
    fromDiscordAta: false
  },
  {
    id: "task-4",
    title: "Finalizar pitch deck comercial de 12 slides para Casa Santos",
    eventId: "evt-3",
    eventTitle: "Submissão & Pitch: Casa Santos",
    clientName: "Casa Santos",
    clientRef: "ECO-001",
    priority: "high",
    dueDate: "2026-08-31",
    dueTime: "19:30",
    completed: true,
    assignee: { name: "Nelson Afonso" },
    estimatedTime: "1h 15m",
    syncedWithGCal: true,
    fromDiscordAta: false
  },
  {
    id: "task-5",
    title: "Sincronizar contrato de prestação de serviços com o Vault",
    eventId: "evt-3",
    eventTitle: "Submissão & Pitch: Casa Santos",
    clientName: "Casa Santos",
    clientRef: "ECO-001",
    priority: "medium",
    dueDate: "2026-08-31",
    dueTime: "19:45",
    completed: true,
    assignee: { name: "Beatriz Lima" },
    estimatedTime: "15m",
    syncedWithGCal: true,
    fromDiscordAta: true
  },
  {
    id: "task-6",
    title: "Testar cálculo orçamental de servidores em Cloud Run no Excel",
    eventId: "evt-4",
    eventTitle: "Project Review & Financial Alignment",
    clientName: "Casa Santos",
    clientRef: "ECO-001",
    priority: "low",
    dueDate: "2026-09-01",
    dueTime: "09:45",
    completed: false,
    assignee: { name: "Carlos Ferreira" },
    estimatedTime: "30m",
    syncedWithGCal: true,
    fromDiscordAta: false
  },
  {
    id: "task-7",
    title: "Mapeamento de 25 palavras-chave de alto tráfego no Google Search",
    eventId: "evt-5",
    eventTitle: "Workshop de SEO: Quinta do Sol",
    clientName: "Quinta do Sol",
    clientRef: "ECO-003",
    priority: "high",
    dueDate: "2026-09-02",
    dueTime: "13:00",
    completed: false,
    assignee: { name: "Mariana Costa" },
    estimatedTime: "1h 30m",
    syncedWithGCal: true,
    fromDiscordAta: false
  }
];

export const MOCK_MEETING_ATAS: MeetingAta[] = [
  {
    id: "ata-pending-1",
    eventId: "evt-0-past-1",
    meetingTitle: "Alinhamento Estrutural & BIM • Casas do Beco",
    clientName: "Casas do Beco",
    date: "2026-08-31",
    time: "11:00 - 12:15",
    duration: "75 minutos",
    recordedBy: "AIVA Neural Voice Engine v3.1",
    audioDurationSeconds: 4500,
    discordChannel: "operacoes-projetos",
    discordStatus: "draft",
    platformStatus: "pending_review", // Não publicada na plataforma, a IA preparou e aguarda confirmação humana!
    executiveSummary: "AIVA IA RESUMO PRELIMINAR: Reunião técnica com João Silva e Clara Mendes. Concluída a validação das armaduras da laje de cobertura. Ficou pendente a confirmação do diâmetro dos pilares P4 e P7. A transcrição completa e os action items foram gerados e aguardam validação do gestor para publicação oficial na plataforma e despacho para o Discord.",
    keyDecisions: [
      "Aprovada a secção transversal dos pilares centrais em C30/37.",
      "Definido o envio do modelo IFC para a equipa de instalações hidráulicas.",
      "Acordado agendamento de visita ao estaleiro de obra no próximo dia 4."
    ],
    actionItems: [
      { task: "Submeter ficheiro IFC 2x3 para a plataforma AXION Vault", owner: "João Silva", deadline: "Hoje • 18:00", syncedAsTask: true },
      { task: "Aprovar minuta preliminar e publicar no Discord", owner: "Nelson Afonso", deadline: "Hoje • 19:00", syncedAsTask: false }
    ],
    transcriptSegments: [
      {
        id: "tr-p1",
        speaker: "Nelson Afonso",
        role: "Brand Architect & Lead",
        timestamp: "00:01:10",
        text: "Vamos rever a integração das cargas da cobertura ajardinada. Precisamos garantir que a flecha da laje não excede L/500."
      },
      {
        id: "tr-p2",
        speaker: "João Silva",
        role: "Structural Engineer",
        timestamp: "00:14:20",
        text: "Perfeito, recalculei com armadura dupla de reforço nos apoios. A flecha máxima ficou em 1.2cm, perfeitamente dentro do limite regulamentar."
      },
      {
        id: "tr-p3",
        speaker: "Clara Mendes",
        role: "Project Manager",
        timestamp: "00:35:40",
        text: "Excelente. A AIVA já capturou a sessão de áudio. Nelson, podes rever os pontos chave para publicarmos a ata no ecossistema?"
      }
    ],
    tags: ["Engenharia", "BIM", "Estruturas", "Aguardando Publicação"]
  },
  {
    id: "ata-foz-published",
    eventId: "evt-0-past-2",
    meetingTitle: "Kickoff de Identidade & Posicionamento • Herdade da Foz",
    clientName: "Herdade da Foz",
    date: "2026-08-30",
    time: "15:00 - 16:30",
    duration: "90 minutos",
    recordedBy: "AIVA Neural Voice Engine v3.1",
    audioDurationSeconds: 5400,
    discordChannel: "atas-executivas",
    discordStatus: "published",
    platformStatus: "published",
    discordMessageId: "msg_foz_98127391",
    discordPublishedAt: "30 Ago, 16:45",
    reviewedBy: "Nelson Afonso (Brand Architect)",
    executiveSummary: "Reunião de alinhamento com a Dra. Teresa Foz. Ficou validado o território de posicionamento 'Tradição & Arquitetura Contemporânea'. A paleta de cores primárias foi aprovada com unanimidade. Segue para desenvolvimento do manual de normas gráficas.",
    keyDecisions: [
      "Aprovado o conceito de packaging para vinhos de reserva e azeite biológico.",
      "Estabelecido o cronograma de ensaio fotográfico para a vindima de Setembro.",
      "Definido o orçamento de marketing digital para o Q4 em €18.000."
    ],
    actionItems: [
      { task: "Criar diretório de marca no Vault Digital com permissão de cliente", owner: "Mariana Costa", deadline: "31 Ago", syncedAsTask: true },
      { task: "Preparar proposta de contrato para produção audiovisual", owner: "Nelson Afonso", deadline: "01 Set", syncedAsTask: true }
    ],
    transcriptSegments: [
      {
        id: "tr-foz-1",
        speaker: "Dra. Teresa Foz",
        role: "Client Owner",
        timestamp: "00:05:22",
        text: "Queremos uma linguagem que reflita a história secular da quinta mas com o minimalismo que o mercado nórdico valoriza."
      },
      {
        id: "tr-foz-2",
        speaker: "Nelson Afonso",
        role: "Brand Architect & Lead",
        timestamp: "00:12:45",
        text: "Exatamente Dra. Teresa. O nosso foco foi desenhar uma tipografia com serifa clássica suportada por uma grelha moderna e fotografias de alto contraste."
      }
    ],
    tags: ["Branding", "Enoturismo", "Pitch Ganho", "Publicado"]
  },
  {
    id: "ata-finance-published",
    eventId: "evt-0-past-3",
    meetingTitle: "Revisão Orçamental & Alocação Q3 • Direção AXION",
    clientName: "AXION Core",
    clientRef: "INT-001",
    date: "2026-08-29",
    time: "10:00 - 11:30",
    duration: "90 minutos",
    recordedBy: "AIVA Neural Voice Engine v3.1",
    audioDurationSeconds: 5400,
    discordChannel: "atas-executivas",
    discordStatus: "published",
    platformStatus: "published",
    discordMessageId: "msg_fin_77261902",
    discordPublishedAt: "29 Ago, 11:40",
    reviewedBy: "Nelson Afonso (Senior Partner)",
    executiveSummary: "A direção financeira e executiva concluiu a auditoria do Q2 e alocou os orçamentos de expansão do Q3. Margem operacional estabilizada em 38.2%. Aprovado o investimento em novas licenças de IA e aceleração de servidores Cloud.",
    keyDecisions: [
      "Aprovado aumento de 15% na verba de infraestrutura tecnológica da agência.",
      "Validada a contratação de 2 novos engenheiros de software para o módulo AIVA.",
      "Fixadas as metas de faturação do Q3 em €240.000."
    ],
    actionItems: [
      { task: "Atualizar folha de cálculo mestre no conector Excel", owner: "Carlos Ferreira", deadline: "30 Ago", syncedAsTask: true }
    ],
    transcriptSegments: [
      {
        id: "tr-fin-1",
        speaker: "Carlos Ferreira",
        role: "Finance Director",
        timestamp: "00:08:15",
        text: "Os números do trimestre estão consolidados com 100% de cobranças em dia e fluxo de caixa positivo."
      }
    ],
    tags: ["Finanças", "Direção", "Q3", "Publicado"]
  },
  {
    id: "ata-1",
    eventId: "evt-1",
    meetingTitle: "Project Sync • Casas do Beco (Sessão de Engenharia)",
    clientName: "Casas do Beco",
    date: "2026-08-31",
    time: "16:00 - 17:00",
    duration: "58 minutos",
    recordedBy: "AIVA Meeting Bot (Voice Sync v2.4)",
    audioDurationSeconds: 3480,
    discordChannel: "operacoes-projetos",
    discordStatus: "published",
    platformStatus: "published",
    discordMessageId: "msg_12899478129048",
    discordPublishedAt: "Hoje, 17:05",
    reviewedBy: "Nelson Afonso",
    executiveSummary: "A reunião concluiu a revisão estrutural dos 3 blocos residenciais. Foi acordada a transição do esquema de vigas para betão armado de baixa espessura, reduzindo os custos de fundação em cerca de 8.4%. O modelo BIM atualizado será submetido à câmara municipal após validação do Nelson.",
    keyDecisions: [
      "Aprovada a mudança estrutural de vigas em aço para lajes fungiformes com aligeiramento.",
      "Definido o prazo de entrega final das especialidades para 12 de Setembro.",
      "Aprovado o orçamento revisto de licenciamento sem penalidades para o cliente."
    ],
    actionItems: [
      { task: "Atualizar pranchas técnicas no repositório Vault", owner: "João Silva", deadline: "Hoje • 20:00", syncedAsTask: true },
      { task: "Enviar ata oficial e extrato de decisões para o Discord e e-mail do cliente", owner: "Clara Mendes", deadline: "Hoje • 18:00", syncedAsTask: true },
      { task: "Rever modelo 3D no visualizador com Nelson Afonso", owner: "Nelson Afonso", deadline: "Amanhã • 09:30", syncedAsTask: false }
    ],
    transcriptSegments: [
      {
        id: "tr-1",
        speaker: "Nelson Afonso",
        role: "Brand Architect & Lead",
        timestamp: "00:02:15",
        text: "Boa tarde a todos. Vamos focar nos 3 nós críticos da cobertura e na passagem das condutas técnicas para não comprometer a altura livre do pé-direito."
      },
      {
        id: "tr-2",
        speaker: "João Silva",
        role: "Structural Engineer",
        timestamp: "00:08:40",
        text: "Exato Nelson. Fizemos a revalidação com lajes fungiformes aligeiradas. O ganho é de 18cm de altura útil e conseguimos embutir a climatização sem sancas falsas."
      },
      {
        id: "tr-3",
        speaker: "Clara Mendes",
        role: "Project Manager",
        timestamp: "00:24:10",
        text: "Excelente. Em termos de custos de obra, o empreiteiro já validou que isto não tem acréscimo de custo por m2. Podemos consolidar a ata com esta decisão?"
      },
      {
        id: "tr-4",
        speaker: "Nelson Afonso",
        role: "Brand Architect & Lead",
        timestamp: "00:48:30",
        text: "Sim, aprovado. Vamos despachar imediatamente a ata para o canal de operações no Discord para que toda a equipa de engenharia fique alinhada."
      }
    ],
    tags: ["Engenharia", "Arquitetura", "Aprovações", "Orçamento", "Discord Synced"]
  },
  {
    id: "ata-2",
    eventId: "evt-3",
    meetingTitle: "Submissão & Pitch: Casa Santos (Apresentação Executiva)",
    clientName: "Casa Santos",
    date: "2026-08-31",
    time: "20:00 - 21:00",
    duration: "45 minutos",
    recordedBy: "AIVA Meeting Bot (Voice Sync v2.4)",
    audioDurationSeconds: 2700,
    discordChannel: "atas-executivas",
    discordStatus: "draft",
    platformStatus: "pending_review",
    executiveSummary: "Apresentação da estratégia global de rebranding e expansão de canal digital. Dr. Eduardo Santos aprovou a identidade visual preliminar com a paleta AXION, solicitando apenas detalhe no faseamento de pagamentos para o Q4.",
    keyDecisions: [
      "Identidade visual do blueprint e tipografia aprovadas sem reservas pelo conselho.",
      "Aprovado o pacote de lançamento com campanhas Google Ads e Meta Ads com budget inicial de €4.500/mês.",
      "Agendada reunião de fecho de contrato para amanhã às 10:30."
    ],
    actionItems: [
      { task: "Inserir cronograma de desembolsos no dashboard financeiro do cliente", owner: "Beatriz Lima", deadline: "Amanhã • 09:00", syncedAsTask: true },
      { task: "Gerar link do Google Meet e minuta para assinatura digital", owner: "Nelson Afonso", deadline: "Amanhã • 10:00", syncedAsTask: true }
    ],
    transcriptSegments: [
      {
        id: "tr-10",
        speaker: "Dr. Eduardo Santos",
        role: "Client Principal",
        timestamp: "00:04:12",
        text: "Nelson, o trabalho da equipa no posicionamento da marca superou as nossas expectativas. O tom sofisticado e a presença digital transmitem a autoridade que precisávamos."
      },
      {
        id: "tr-11",
        speaker: "Nelson Afonso",
        role: "Senior Partner",
        timestamp: "00:15:30",
        text: "Muito obrigado, Dr. Eduardo. A nossa prioridade foi garantir coerência absoluta entre o espaço físico, o website e o ecossistema de vendas automáticas."
      }
    ],
    tags: ["Comercial", "Rebranding", "Aprovação", "Lead Executivo"]
  }
];

export const MOCK_MEETING_INVITES: MeetingInviteNotification[] = [];
