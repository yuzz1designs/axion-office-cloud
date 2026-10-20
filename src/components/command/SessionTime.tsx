import { memo, useEffect, useState } from "react";
import { officeSessionTime, type OfficeMemberPresence } from "../../lib/officePresence";

export default memo(function SessionTime({ member, offset = 0 }: { member?: OfficeMemberPresence; offset?: number }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const resume = () => {
      clearInterval(timer);
      if (document.visibilityState === "hidden") return;
      setNow(Date.now()); timer = setInterval(() => setNow(Date.now()), 1000);
    };
    resume(); document.addEventListener("visibilitychange", resume);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", resume); };
  }, []);
  return <>{member ? officeSessionTime(member, now + offset) || "—" : "—"}</>;
});
