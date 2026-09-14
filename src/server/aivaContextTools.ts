export function currentDateTime() {
  const timezone = "Europe/Lisbon";
  return { timestamp: new Date().toISOString(), local: new Intl.DateTimeFormat("pt-PT", { dateStyle: "full", timeStyle: "long", timeZone: timezone }).format(new Date()), timezone };
}
export async function getWeather(location: string) {
  if (!location.trim() || location.length > 120) throw new Error("Indica uma cidade válida.");
  const get = async (url: string) => {
    const result = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!result.ok) throw new Error("O serviço de meteorologia está indisponível.");
    return result.json();
  };
  const places = await get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=pt&format=json`);
  const place = places.results?.[0];
  if (!place) throw new Error("Localidade não encontrada. Indica cidade e país.");
  const forecast = await get(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&hourly=temperature_2m,precipitation_probability,precipitation&forecast_days=2&timezone=auto`);
  return { location: `${place.name}, ${place.country}`, timezone: forecast.timezone, hourly: forecast.hourly, units: forecast.hourly_units, source: "https://open-meteo.com/", fetchedAt: new Date().toISOString() };
}
