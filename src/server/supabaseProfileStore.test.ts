import assert from "node:assert/strict";
import test from "node:test";
import { profileFromSupabase } from "./supabaseProfileStore";

test("converte perfil e dispositivos Supabase para o contrato AXION existente", () => {
  const profile = profileFromSupabase({
    user_id: "user-1",
    email: "nelson@example.com",
    display_name: "Nelson Afonso",
    job_title: "Partner",
    department: "Direção",
    phone: "123",
    desk_location: "Lisboa",
    timezone: "Europe/Lisbon",
    bio: "Bio",
    avatar_path: "avatars/user-1.png",
    initials: "NA",
    accent_color: "#fff",
    ax_key: "AX-123",
    focus_minutes: 90,
    created_at: "2026-09-03T10:00:00Z",
    updated_at: "2026-09-03T11:00:00Z",
    user_devices: [{
      device_id_hash: "device-hash",
      label: "Safari em macOS",
      browser: "Safari",
      operating_system: "macOS",
      ip_address: "127.0.0.1",
      first_seen_at: "2026-09-03T10:00:00Z",
      last_seen_at: "2026-09-03T11:00:00Z",
    }],
  });
  assert.equal(profile.id, "user-1");
  assert.equal(profile.name, "Nelson Afonso");
  assert.equal(profile.focusMinutes, 90);
  assert.equal(profile.devices[0].operatingSystem, "macOS");
});
