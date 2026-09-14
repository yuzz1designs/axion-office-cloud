export interface ProfileDevice {
  id: string;
  name: string;
  browser: string;
  operatingSystem: string;
  ipAddress: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface AxionProfile {
  id: string;
  email: string;
  name: string;
  displayName: string;
  role: string;
  department: string;
  phone: string;
  deskLocation: string;
  timezone: string;
  bio: string;
  avatarUrl: string;
  initials: string;
  accentColor: string;
  axKey: string;
  focusMinutes: number;
  devices: ProfileDevice[];
  createdAt: string;
  updatedAt: string;
}
