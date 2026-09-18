import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import AxionLogo from "../ui/AxionLogo";
import { Cloud, CloudRain, LoaderCircle, Settings2, Sun, X } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext";

interface WelcomeScreenProps {
  onEnter: () => void;
}

type WeatherType = "sunny" | "cloudy" | "rainy";

interface WeatherConfig {
  name: string;
  imageUrl: string;
  fallbackGradient: string;
  overlayOpacity: number;
  imageBrightness: number;
  statusLabel: string;
}

interface WeatherReading {
  currentTemp: number;
  maxTemp: number;
  locationLabel: string;
}

const WEATHER_MODES: Record<WeatherType, WeatherConfig> = {
  sunny: {
    name: "Sol",
    imageUrl: "/weather/sunny-lisbon.jpg",
    fallbackGradient: "from-amber-950/15 via-[#030712]/90 to-[#030712]",
    overlayOpacity: 0.2,
    imageBrightness: 0.78,
    statusLabel: "CÉU LIMPO",
  },
  cloudy: {
    name: "Nublado",
    imageUrl: "/weather/cloudy-lisbon.jpg",
    fallbackGradient: "from-slate-800/30 via-[#030712]/90 to-[#030712]",
    overlayOpacity: 0.24,
    imageBrightness: 0.72,
    statusLabel: "COBERTURA NUBLADA",
  },
  rainy: {
    name: "Chuva",
    imageUrl: "/weather/rainy-lisbon.jpg",
    fallbackGradient: "from-blue-950/15 via-[#030712]/90 to-[#030712]",
    overlayOpacity: 0.28,
    imageBrightness: 0.68,
    statusLabel: "PRECIPITAÇÃO ATIVA",
  },
};

const LISBON_COORDINATES = { latitude: 38.7223, longitude: -9.1393 };
const WEATHER_BACKGROUND_STORAGE_KEY = "axion_welcome_weather_background_linked";
const LEGACY_WEATHER_BACKGROUND_STORAGE_KEY = "axion_welcome_weather_enabled";

const getWeatherType = (weatherCode: number): WeatherType => {
  if (weatherCode === 0) return "sunny";
  if ([1, 2, 3, 45, 48].includes(weatherCode)) return "cloudy";
  return "rainy";
};

const FLOATING_TRIANGLES = [
  // Left Side (dense)
  { id: 1, size: 24, x: 10, y: 15, speedX: -55, speedY: -45, opacity: 0.08, duration: 8, delay: 0 },
  { id: 2, size: 38, x: 22, y: 25, speedX: -45, speedY: -55, opacity: 0.05, duration: 12, delay: 1.5 },
  { id: 3, size: 16, x: 15, y: 75, speedX: -35, speedY: 55, opacity: 0.12, duration: 7, delay: 0.5 },
  { id: 4, size: 42, x: 28, y: 60, speedX: -40, speedY: 35, opacity: 0.06, duration: 14, delay: 2 },
  { id: 5, size: 28, x: 8, y: 45, speedX: -60, speedY: -30, opacity: 0.09, duration: 9, delay: 3 },
  { id: 6, size: 32, x: 25, y: 85, speedX: -50, speedY: 45, opacity: 0.07, duration: 13, delay: 1 },
  { id: 7, size: 20, x: 14, y: 55, speedX: -30, speedY: 60, opacity: 0.11, duration: 6, delay: 2.5 },
  
  // Right Side (lighter)
  { id: 8, size: 34, x: 88, y: 20, speedX: 60, speedY: -40, opacity: 0.06, duration: 11, delay: 0.8 },
  { id: 9, size: 22, x: 76, y: 15, speedX: 45, speedY: -35, opacity: 0.08, duration: 10, delay: 1.2 },
  { id: 10, size: 48, x: 82, y: 72, speedX: 55, speedY: 40, opacity: 0.04, duration: 15, delay: 3.5 },
  { id: 11, size: 18, x: 92, y: 85, speedX: 40, speedY: 65, opacity: 0.10, duration: 8, delay: 1.8 },
  { id: 12, size: 30, x: 74, y: 48, speedX: 50, speedY: 20, opacity: 0.07, duration: 12, delay: 2.2 },
];

const RAIN_DROPS = Array.from({ length: 32 }, (_, index) => ({
  id: index,
  left: `${(index * 37 + 9) % 101}%`,
  delay: `${-((index * 0.37) % 3.2)}s`,
  duration: `${1.25 + (index % 7) * 0.16}s`,
  height: `${34 + (index % 5) * 13}px`,
  opacity: 0.2 + (index % 4) * 0.08,
}));

const ATMOSPHERIC_PARTICLES = Array.from({ length: 42 }, (_, index) => ({
  id: index,
  left: `${(index * 47 + 13) % 101}%`,
  top: `${(index * 71 + 7) % 97}%`,
  size: 1 + (index % 3) * 0.7,
  delay: `${-((index * 0.61) % 8)}s`,
  duration: `${8 + (index % 9) * 1.4}s`,
  opacity: 0.1 + (index % 5) * 0.045,
}));

export default function WelcomeScreen({ onEnter }: WelcomeScreenProps) {
  const { language, t } = useLanguage();
  const [isExiting, setIsExiting] = useState(false);
  const [logoExit, setLogoExit] = useState(false);
  const [weather, setWeather] = useState<WeatherType>("sunny");
  const [weatherReading, setWeatherReading] = useState<WeatherReading | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(true);
  const [isWeatherBackgroundLinked, setIsWeatherBackgroundLinked] = useState(() => {
    if (typeof window === "undefined") return true;
    const storedPreference = window.localStorage.getItem(WEATHER_BACKGROUND_STORAGE_KEY)
      ?? window.localStorage.getItem(LEGACY_WEATHER_BACKGROUND_STORAGE_KEY);
    return storedPreference !== "false";
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [time, setTime] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
  const [isHovering, setIsHovering] = useState(false);

  // Smooth mouse move parallax & tracking listener
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Calculate normalized relative position from -0.5 to 0.5 relative to center
      const x = (e.clientX / window.innerWidth) - 0.5;
      const y = (e.clientY / window.innerHeight) - 0.5;
      setMouseOffset({ x, y });
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Live weather follows the device location, with Lisbon as a resilient fallback.
  useEffect(() => {
    let isActive = true;

    setIsWeatherLoading(true);

    const loadWeather = async (
      latitude: number,
      longitude: number,
      locationLabel: string,
    ) => {
      try {
        const params = new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude),
          current: "temperature_2m,weather_code",
          daily: "temperature_2m_max",
          timezone: "auto",
          forecast_days: "1",
        });
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
        if (!response.ok) throw new Error("Weather service unavailable");

        const data = await response.json() as {
          current: { temperature_2m: number; weather_code: number };
          daily: { temperature_2m_max: number[] };
        };

        if (!isActive) return;
        setWeather(getWeatherType(data.current.weather_code));
        setWeatherReading({
          currentTemp: Math.round(data.current.temperature_2m),
          maxTemp: Math.round(data.daily.temperature_2m_max[0]),
          locationLabel,
        });
      } catch {
        if (!isActive) return;
        setWeather("cloudy");
        setWeatherReading(null);
      } finally {
        if (isActive) setIsWeatherLoading(false);
      }
    };

    const loadLisbonWeather = () => loadWeather(
      LISBON_COORDINATES.latitude,
      LISBON_COORDINATES.longitude,
      "LISBOA",
    );

    // Use location only when it has already been granted; opening Home must not prompt for permission.
    if (navigator.geolocation && navigator.permissions?.query) {
      void navigator.permissions.query({ name: "geolocation" }).then((permission) => {
        if (!isActive) return;
        if (permission.state !== "granted") return void loadLisbonWeather();
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => { void loadWeather(coords.latitude, coords.longitude, "LOCAL"); },
          () => { void loadLisbonWeather(); },
          { enableHighAccuracy: false, maximumAge: 15 * 60 * 1000, timeout: 5000 },
        );
      }).catch(() => { if (isActive) void loadLisbonWeather(); });
    } else {
      void loadLisbonWeather();
    }

    return () => { isActive = false; };
  }, []);

  // Live ticking clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      
      // Time in HH:MM:SS format
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      setTime(`${hours}:${minutes}:${seconds}`);

      // Date string in Portuguese for premium AXION vibe
      const days = language === "pt"
        ? ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"]
        : ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
      const months = language === "pt"
        ? ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]
        : ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      const dayName = days[now.getDay()];
      const dayVal = now.getDate();
      const monthName = months[now.getMonth()];
      setDateStr(`${dayName}, ${dayVal} ${monthName}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [language]);

  const handleEnterClick = () => {
    if (isExiting) return;
    setIsExiting(true);
    setLogoExit(true);
    onEnter();
  };

  const handleWeatherBackgroundLinkChange = () => {
    const nextValue = !isWeatherBackgroundLinked;
    setIsWeatherBackgroundLinked(nextValue);
    window.localStorage.setItem(WEATHER_BACKGROUND_STORAGE_KEY, String(nextValue));
  };

  const currentConfig = WEATHER_MODES[weather];
  const currentHour = Number(time.slice(0, 2));
  const isNight = Number.isFinite(currentHour) && (currentHour >= 20 || currentHour < 7);

  return (
    <div 
      id="welcome-screen-container" 
      className="relative w-screen h-screen overflow-hidden bg-slate-950 flex flex-col justify-between items-center py-12 px-6 z-50 select-none transition-all duration-1000 font-sans"
    >
      {/* Dynamic Weather Background Layer */}
      <div className="absolute inset-0 w-full h-full z-0 overflow-hidden bg-[#050609]">
        {/* Weather imagery or the private abstract alternative. */}
        <AnimatePresence mode="popLayout">
          {isWeatherBackgroundLinked ? (
            <motion.img
              key={`weather-${weather}`}
              src={currentConfig.imageUrl}
              alt={`AXION Background ${weather}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: [0.25, 1, 0.5, 1] }}
              className="absolute inset-0 w-full h-full object-cover z-0 contrast-[1.06]"
              style={{ filter: `brightness(${currentConfig.imageBrightness})` }}
            />
          ) : (
            <motion.div
              key="abstract-background"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2 }}
              className="welcome-abstract-background"
              aria-hidden="true"
            >
              <span className="welcome-abstract-orb welcome-abstract-orb-a" />
              <span className="welcome-abstract-orb welcome-abstract-orb-b" />
              <span className="welcome-abstract-orb welcome-abstract-orb-c" />
              <span className="welcome-abstract-wave" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Weather-specific immersion layer. These effects remain decorative and input-transparent. */}
        <AnimatePresence mode="wait">
          {isWeatherBackgroundLinked && weather === "sunny" && (
            <motion.div
              key="sun-effects"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4 }}
              className="absolute inset-0 z-[1] pointer-events-none overflow-hidden"
              aria-hidden="true"
            >
              <div className="welcome-sun-flare" />
              <div className="welcome-sun-rays" />
              <div className="welcome-sun-glass" />
              <div className="welcome-sun-horizon" />
            </motion.div>
          )}

          {isWeatherBackgroundLinked && weather === "cloudy" && (
            <motion.div
              key="cloud-effects"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4 }}
              className="absolute inset-0 z-[1] pointer-events-none overflow-hidden"
              aria-hidden="true"
            >
              <div className="welcome-cloud-haze welcome-cloud-haze-a" />
              <div className="welcome-cloud-haze welcome-cloud-haze-b" />
              <div className="welcome-cloud-haze welcome-cloud-haze-c" />
            </motion.div>
          )}

          {isWeatherBackgroundLinked && weather === "rainy" && (
            <motion.div
              key="rain-effects"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2 }}
              className="absolute inset-0 z-[1] pointer-events-none overflow-hidden welcome-rain-pane"
              aria-hidden="true"
            >
              {RAIN_DROPS.map((drop) => (
                <span
                  key={drop.id}
                  className="welcome-rain-drop"
                  style={{
                    left: drop.left,
                    height: drop.height,
                    opacity: drop.opacity,
                    animationDelay: drop.delay,
                    animationDuration: drop.duration,
                  }}
                />
              ))}
              <div className="welcome-rain-glass" />
              <div className="welcome-rain-mist" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Shared depth field: slow atmospheric matter suspended between the image and UI. */}
        {isWeatherBackgroundLinked && <div className={`welcome-depth-field welcome-depth-field--${weather}`} aria-hidden="true">
          {ATMOSPHERIC_PARTICLES.map((particle) => (
            <span
              key={particle.id}
              style={{
                left: particle.left,
                top: particle.top,
                width: particle.size,
                height: particle.size,
                opacity: particle.opacity,
                animationDelay: particle.delay,
                animationDuration: particle.duration,
              }}
            />
          ))}
        </div>}

        {/* Ambient base gradient blend */}
        {isWeatherBackgroundLinked && <div 
          className={`absolute inset-0 bg-gradient-to-tr ${currentConfig.fallbackGradient} mix-blend-multiply opacity-45 transition-all duration-1000 ease-in-out z-[1]`} 
        />}
        
        {/* Sophisticated Cinematic Glassmorphic Blur Overlays */}
        <div 
          className="absolute inset-0 bg-slate-950/50 transition-opacity duration-1000 z-[2] pointer-events-none"
          style={{ opacity: isWeatherBackgroundLinked ? currentConfig.overlayOpacity : 0.12 }}
        />
        <div className={`absolute inset-0 bg-gradient-to-b from-transparent via-transparent z-[2] pointer-events-none ${isWeatherBackgroundLinked ? "to-[#050609]/95" : "to-[#050609]/55"}`} />
        {isWeatherBackgroundLinked && <div className={`welcome-time-grade ${isNight ? "is-night" : "is-day"}`} aria-hidden="true" />}
        <div className={`welcome-cinematic-vignette ${isWeatherBackgroundLinked ? "" : "is-abstract"}`} aria-hidden="true" />

        {/* Floating parallax triangles */}
        {FLOATING_TRIANGLES.map((item) => (
          <motion.div
            key={item.id}
            className="absolute pointer-events-none select-none z-[3] text-white"
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              width: item.size,
              height: item.size,
              opacity: item.opacity * 3.2,
            }}
            animate={{
              x: mouseOffset.x * item.speedX,
              y: mouseOffset.y * item.speedY,
            }}
            transition={{
              type: "spring",
              stiffness: 45,
              damping: 25,
              mass: 0.8
            }}
          >
            <motion.div
              animate={{
                y: [0, -15, 0],
                rotate: [0, 120, 360]
              }}
              transition={{
                y: {
                  duration: item.duration,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: item.delay,
                },
                rotate: {
                  duration: item.duration * 1.8,
                  repeat: Infinity,
                  ease: "linear",
                  delay: item.delay,
                }
              }}
              className="w-full h-full"
            >
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {item.id % 2 === 0 ? (
                  <polygon 
                    points="50,15 90,85 10,85" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="3" 
                  />
                ) : (
                  <polygon 
                    points="50,15 90,85 10,85" 
                    fill="currentColor" 
                    fillOpacity="0.1" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                  />
                )}
              </svg>
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Grid overlay for a technological digital aesthetic */}
      <div className="absolute inset-0 tech-grid opacity-[0.12] z-4 pointer-events-none" />

      {/* 1. TOP HEADER - METRICS & SECURITY STATUS */}
      <AnimatePresence>
        {!isExiting && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30, filter: "blur(10px)" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="w-full max-w-7xl flex flex-col sm:flex-row justify-between items-center gap-4 z-10 px-4 md:px-12 font-sans text-xs text-white"
          >
            {/* Core System Protocol */}
            <div className="flex items-center gap-2 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-white pulse-active" />
              <span className="tracking-[0.25em] font-medium text-[10px]">AXION OFFICE</span>
            </div>

            {/* Live Weather Atmosphere Stats & Toggle Controls */}
            <div className="flex items-center gap-4 font-sans">
              {/* Live weather state, with manual preview controls for the three atmospheres */}
              {isWeatherBackgroundLinked && <div className="flex bg-white/5 border border-white/10 rounded-full p-0.5 backdrop-blur-md">
                <button
                  onClick={() => setWeather("sunny")}
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] tracking-[0.15em] font-medium transition-all duration-300 ${
                    weather === "sunny"
                      ? "bg-white/15 text-white font-semibold shadow-sm"
                      : "text-white hover:text-white"
                  }`}
                >
                  <Sun size={11} className="text-white" />
                  SOL
                </button>
                <button
                  onClick={() => setWeather("cloudy")}
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] tracking-[0.15em] font-medium transition-all duration-300 ${
                    weather === "cloudy"
                      ? "bg-white/15 text-white font-semibold shadow-sm"
                      : "text-white hover:text-white"
                  }`}
                >
                  <Cloud size={11} className="text-white" />
                  NUBLADO
                </button>
                <button
                  onClick={() => setWeather("rainy")}
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] tracking-[0.15em] font-medium transition-all duration-300 ${
                    weather === "rainy"
                      ? "bg-white/15 text-white font-semibold shadow-sm"
                      : "text-white hover:text-white"
                  }`}
                >
                  <CloudRain size={11} className="text-white" />
                  CHUVA
                </button>
              </div>}
              <button
                type="button"
                onClick={() => setIsSettingsOpen((current) => !current)}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                className="group flex items-center gap-2 px-2 py-1 text-[9px] tracking-[0.18em] uppercase text-white transition-opacity duration-300 hover:opacity-65"
                aria-expanded={isSettingsOpen}
                aria-label="Abrir definições da Welcome Screen"
              >
                <Settings2 size={13} className="transition-transform duration-500 group-hover:rotate-90" />
                <span className="hidden sm:inline">Definições</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSettingsOpen && !isExiting && (
          <motion.aside
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute right-6 top-24 z-30 w-[min(22rem,calc(100vw-3rem))] border border-white/15 bg-[#06080d]/90 p-5 shadow-2xl backdrop-blur-xl md:right-16"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-white">Welcome Screen</p>
                <p className="mt-1 text-xs leading-relaxed text-white/60">Personaliza a atmosfera apresentada antes de entrares no Office.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 text-white transition-opacity hover:opacity-60"
                aria-label="Fechar definições"
              >
                <X size={15} />
              </button>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={isWeatherBackgroundLinked}
              onClick={handleWeatherBackgroundLinkChange}
              className="group flex w-full items-center justify-between gap-5 border-t border-white/10 pt-4 text-left"
            >
              <span>
                <span className="block text-xs font-medium text-white">Fundo associado à meteorologia</span>
                <span className="mt-1 block text-[10px] leading-relaxed text-white/55">
                  {isWeatherBackgroundLinked
                    ? "O fundo acompanha o estado do tempo local. Os dados meteorológicos permanecem sempre ativos."
                    : "O fundo abstrato está ativo. Os dados meteorológicos continuam disponíveis."}
                </span>
              </span>
              <span className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-300 ${isWeatherBackgroundLinked ? "border-white bg-white" : "border-white/35 bg-white/5"}`}>
                <span className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full transition-all duration-300 ${isWeatherBackgroundLinked ? "left-[19px] bg-[#050609]" : "left-[3px] bg-white/70"}`} />
              </span>
            </button>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* 2. DYNAMIC ATMOSPHERIC INDEX (Floating Editorial Panel) */}
      <AnimatePresence>
        {!isExiting && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 35, filter: "blur(10px)" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute right-6 md:right-16 top-24 z-10 hidden md:block flex flex-col items-end gap-1 font-sans text-right"
          >
            <span className="text-[9px] text-white tracking-[0.25em] font-medium uppercase">{t("welcome.atmosphere")}</span>
            <div className="flex items-baseline gap-1.5">
              {isWeatherLoading ? (
                <LoaderCircle size={22} className="text-white animate-spin" />
              ) : (
                <>
                  <span className="text-3xl font-light text-white tracking-tighter">
                    {weatherReading ? `${weatherReading.currentTemp}°C` : "--°C"}
                  </span>
                  <span className="text-xs text-white">
                    / {t("welcome.max")}: {weatherReading ? `${weatherReading.maxTemp}°C` : "--°C"}
                  </span>
                </>
              )}
            </div>
            <span className="text-[9px] text-white uppercase tracking-[0.2em] font-medium flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-white animate-ping" />
              {currentConfig.statusLabel} · {weatherReading?.locationLabel ?? "OFFLINE"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. CENTER LOGO GROUP & REVEAL SYSTEM */}
      <div className="flex-1 flex flex-col justify-center items-center relative z-10 w-full px-4">
        <AnimatePresence mode="popLayout">
          {!logoExit ? (
            <motion.div
              key="logo-group"
              initial={{ opacity: 0, filter: "blur(20px)", scale: 0.95 }}
              animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
              exit={{ 
                scale: 1.18, 
                opacity: 0,
                filter: "blur(12px)",
                transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
              }}
              transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              className="relative flex flex-col items-center gap-4 cursor-none"
            >
              {/* Dynamic AXION Logo (Uses uploaded assets with SVG fallback) */}
              <div className="relative z-[1]">
                <AxionLogo size="xl" animate={true} pulse={false} />
              </div>
              
              {/* Elegant Metadata Container */}
              <div className="flex flex-col items-center gap-1 mt-1">
                <motion.div
                  initial={{ opacity: 0, letterSpacing: "0.2em" }}
                  animate={{ opacity: 0.45, letterSpacing: "0.55em" }}
                  transition={{ duration: 2, delay: 0.8 }}
                  className="font-sans text-xs md:text-sm text-white font-light uppercase text-center ml-[0.55em]"
                >
                  OFFICE OPERATING SYSTEM
                </motion.div>
                
                {/* Mobile Atmospheric Info */}
                <AnimatePresence>
                  {!isExiting && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.3 }}
                      exit={{ opacity: 0, filter: "blur(5px)" }}
                      className="flex md:hidden items-center gap-2 font-sans text-[9px] text-white mt-1 tracking-wider"
                    >
                      <span>{weatherReading ? `${weatherReading.currentTemp}°C` : "--°C"}</span>
                      <span>•</span>
                      <span>MAX: {weatherReading ? `${weatherReading.maxTemp}°C` : "--°C"}</span>
                      <span>•</span>
                      <span>{currentConfig.name.toUpperCase()}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Chrono Module Panel - Grouped tightly right below the logo */}
              <AnimatePresence>
                {!isExiting && (
                  <motion.div 
                    initial={{ opacity: 0, y: 0 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12, filter: "blur(8px)" }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="flex flex-col items-center justify-center font-sans text-center gap-1 mt-4"
                  >
                    {/* Live Realtime Clock */}
                    <span className="text-4xl md:text-5xl font-extralight tracking-[0.25em] text-white select-none filter drop-shadow-[0_0_15px_rgba(255,255,255,0.08)]">
                      {time || "00:00:00"}
                    </span>
                    
                    {/* Date stamp */}
                    <span className="text-[10px] md:text-[11px] text-white tracking-[0.3em] font-light uppercase mt-2">
                      {dateStr || t("welcome.loading")}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Button & Secure Indicators - Brought closer to the clock */}
              <AnimatePresence>
                {!isExiting && (
                  <motion.div 
                    initial={{ opacity: 0, y: 0 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 16, filter: "blur(8px)" }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="flex flex-col items-center gap-6 mt-8 md:mt-10 w-full"
                  >
                    {/* Minimal typographic entry action */}
                    <button
                      id="enter-office-btn"
                      onClick={handleEnterClick}
                      onMouseEnter={() => setIsHovering(true)}
                      onMouseLeave={() => setIsHovering(false)}
                      className="group relative px-5 py-3 text-white font-sans text-[11px] tracking-[0.35em] uppercase font-medium transition-all duration-500 ease-out hover:-translate-y-0.5 hover:tracking-[0.44em] active:translate-y-0 active:scale-[0.98]"
                    >
                      <span className="relative z-10 text-white transition-all duration-500 group-hover:[text-shadow:0_0_18px_rgba(255,255,255,0.65)]">
                        {t("welcome.enter")}
                      </span>
                      <span
                        aria-hidden="true"
                        className="absolute bottom-1 left-1/2 h-px w-0 -translate-x-1/2 bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.55)] transition-all duration-500 ease-out group-hover:w-[calc(100%-2.5rem)]"
                      />
                    </button>

                    {/* Restricted access indicator */}
                    <div className="flex flex-col items-center gap-1 text-center font-sans">
                      <span className="text-[9px] text-white font-light tracking-[0.25em] uppercase">
                        {t("welcome.access")}
                      </span>
                      <span className="text-[8px] text-white font-light tracking-[0.25em]">
                        {t("welcome.audit")}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Abstract geometric borders to frame the screen beautifully */}
      <AnimatePresence>
        {!isExiting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.05 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 flex justify-between pointer-events-none z-4"
          >
            <motion.div 
              initial={{ height: 0 }}
              animate={{ height: "100%" }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              className="w-[1px] bg-gradient-to-b from-transparent via-white to-transparent left-12 md:left-24" 
            />
            <motion.div 
              initial={{ height: 0 }}
              animate={{ height: "100%" }}
              transition={{ duration: 1.5, ease: "easeInOut", delay: 0.3 }}
              className="w-[1px] bg-gradient-to-b from-transparent via-white to-transparent right-12 md:right-24" 
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Unified Cursor System - Keeps dot and ring perfectly aligned */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9999] mix-blend-difference hidden md:block"
        animate={{
          x: mousePos.x,
          y: mousePos.y,
        }}
        transition={{
          type: "spring",
          stiffness: 350,
          damping: 26,
          mass: 0.1
        }}
      >
        {/* Outer Ring */}
        <motion.div
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border"
          animate={{
            width: isHovering ? 28 : 22,
            height: isHovering ? 28 : 22,
            borderColor: isHovering ? "rgba(255, 255, 255, 0.85)" : "rgba(255, 255, 255, 0.35)",
            backgroundColor: isHovering ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0)",
          }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        />
        
        {/* Precision inner core dot - Always perfectly centered */}
        <div 
          className="absolute -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full"
        />
      </motion.div>
    </div>
  );
}
