/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PriorityItem {
  id: string;
  project: string;
  description: string;
  status: "pending" | "waiting" | "critical";
  statusText: string;
}

export interface TodayItem {
  id: string;
  type: "task" | "meeting" | "deadline";
  time: string;
  title: string;
  meta?: string;
  completed?: boolean;
}

export interface PulseIndicator {
  label: string;
  status: "Healthy" | "Stable" | "Normal" | "At Risk";
  trend?: "up" | "down" | "stable";
}

export interface UpcomingMeeting {
  id: string;
  project: string;
  title: string;
  timeText: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
}

export interface AppState {
  currentScreen: "welcome" | "command-center";
  bootTime: string;
  user: {
    name: string;
    role: string;
    lastLogin: string;
  };
  aiva: {
    status: "online" | "idle" | "analyzing";
    message: string;
  };
}
