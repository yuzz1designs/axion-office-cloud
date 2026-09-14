import { 
  PriorityItem, 
  TodayItem, 
  PulseIndicator, 
  UpcomingMeeting, 
  ActivityLog, 
  AppState 
} from "../types";

export const INITIAL_STATE: AppState = {
  currentScreen: "welcome",
  bootTime: "2026-08-30T15:56:00.000Z",
  user: {
    name: "Nelson Afonso",
    role: "Senior Partner & Brand Architect",
    lastLogin: "Today, 15:55"
  },
  aiva: {
    status: "online",
    message: "AIVA • ALL SYSTEMS OPERATIONAL"
  }
};

export const MOCK_PRIORITIES: PriorityItem[] = [
  {
    id: "p1",
    project: "CASA SANTOS",
    description: "Waiting for client approval on brand blueprint",
    status: "waiting",
    statusText: "Awaiting Client"
  },
  {
    id: "p2",
    project: "CASAS DO BECO",
    description: "3 tasks pending integration of structural engineering",
    status: "pending",
    statusText: "Pending Input"
  }
];

export const MOCK_TODAY: TodayItem[] = [
  {
    id: "t1",
    type: "meeting",
    time: "16:00",
    title: "Project Sync • Casas do Beco",
    meta: "Zoom • with João and Clara",
    completed: false
  },
  {
    id: "t2",
    type: "task",
    time: "17:30",
    title: "Refine AXION brand assets",
    meta: "Figma workspace",
    completed: false
  },
  {
    id: "t3",
    type: "deadline",
    time: "20:00",
    title: "Proposal submission: Casa Santos",
    meta: "High Priority",
    completed: false
  }
];

export const MOCK_PULSE: PulseIndicator[] = [
  { label: "Sales", status: "Healthy", trend: "up" },
  { label: "Projects", status: "At Risk", trend: "down" },
  { label: "Clients", status: "Stable", trend: "stable" },
  { label: "Finance", status: "Normal", trend: "stable" },
  { label: "Team", status: "Healthy", trend: "up" }
];

export const MOCK_UPCOMING: UpcomingMeeting = {
  id: "u1",
  project: "CASA SANTOS",
  title: "Project Review & Financial Alignment",
  timeText: "Tomorrow • 10:30"
};

export const MOCK_ACTIVITIES: ActivityLog[] = [
  {
    id: "a1",
    timestamp: "22:41",
    user: "João",
    action: "completed homepage development"
  },
  {
    id: "a2",
    timestamp: "21:32",
    user: "System",
    action: "New lead added from AXION public portal"
  },
  {
    id: "a3",
    timestamp: "20:58",
    user: "Clara",
    action: "Proposal updated for Casa Santos"
  }
];
