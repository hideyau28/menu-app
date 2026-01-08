"use client";

import { useEffect, useState } from "react";
import { Search, MapPin, Loader2, Wind, Droplets, X } from "lucide-react";

// --- Types ---
type HourForecast = {
  time: string;
  temp_c: number;
  condition: { text: string; code: number };
};

type DayForecast = {
  date: string;
  day: {
    maxtemp_c: number;
    mintemp_c: number;
    condition: { text: string; code: number };
  };
  hour: HourForecast[];
};

type WeatherResponse = {
  location: { name: string };
  current: {
    temp_c: number;
    feelslike_c: number;
    condition: { text: string; code: number };
    humidity: number;
    wind_kph: number;
  };
  forecast: {
    forecastday: DayForecast[];
  };
};

export default function WeatherPage() {
  // --- State ---
  const [city, setCity] = useState("Hong Kong");
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [savedCities, setSavedCities] = useState<string[]>(["Hong Kong", "Tokyo", "Osaka"]);

  // Toast State (統一 UI)
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const API_KEY = process.env.NEXT_PUBLIC_WEATHERAPI_KEY;

  // --- Effects ---
  useEffect(() => {
    const saved = localStorage.getItem("weather_data");
    const cities = localStorage.getItem("weather_saved_cities");
    if (cities) {
      try {
        setSavedCities(JSON.parse(cities));
      } catch { }
    }
    if (saved) {
      try {
        setData(JSON.parse(saved));
      } catch { }
    } else {
      fetchByCity("Hong Kong"); // 預設載入
    }
  }, []);

  // Toast Timer
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // --- Helper Functions ---
  const showToast = (msg: string, type: "success" | "error" = "error") => {
    setToast({ msg, type });
  };

  const fetchByCity = async (searchCity: string = city) => {
    if (!searchCity.trim()) return;
    if (!API_KEY) {
      showToast("請設定 API Key");
      return;
    }

    setLoading(true);
    // 收起鍵盤
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    try {
      const res = await fetch(
        `https://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${searchCity}&days=7&aqi=no&alerts=no&lang=zh_tw`
      );
      if (!res.ok) throw new Error("City not found");
      const json = await res.json();
      setData(json);
      setCity(json.location.name); // Auto correct name formatting
      localStorage.setItem("weather_data", JSON.stringify(json));

      // Add to saved cities if not already present (max 3)
      const cityName = json.location.name;
      if (!savedCities.includes(cityName)) {
        const updated = [cityName, ...savedCities].slice(0, 3);
        setSavedCities(updated);
        localStorage.setItem("weather_saved_cities", JSON.stringify(updated));
      }

      showToast(`已更新: ${json.location.name}`, "success");
    } catch {
      showToast("找不到城市或網絡錯誤", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchByLocation = () => {
    if (!navigator.geolocation) {
      showToast("瀏覽器不支援定位");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${pos.coords.latitude},${pos.coords.longitude}&days=7&aqi=no&alerts=no&lang=zh_tw`
          );
          const json = await res.json();
          setData(json);
          setCity(json.location.name);
          localStorage.setItem("weather_data", JSON.stringify(json));
          showToast(`已定位: ${json.location.name}`, "success");
        } catch {
          showToast("定位天氣失敗");
        } finally {
          setLoading(false);
        }
      },
      () => {
        showToast("請允許定位權限");
        setLoading(false);
      }
    );
  };

  const getWeatherIcon = (text?: string) => {
    if (!text) return "🌤️";
    const t = text.toLowerCase();
    if (t.includes("晴") || t.includes("sun") || t.includes("clear")) return "☀️";
    if (t.includes("陰") || t.includes("多雲") || t.includes("cloud") || t.includes("overcast")) return "☁️";
    if (t.includes("雨") || t.includes("rain") || t.includes("drizzle")) return "🌧️";
    if (t.includes("雷") || t.includes("thunder")) return "⛈️";
    if (t.includes("雪") || t.includes("snow")) return "❄️";
    if (t.includes("霧") || t.includes("fog") || t.includes("mist")) return "🌫️";
    return "🌤️";
  };

  const weekday = (date: string) =>
    new Date(date).toLocaleDateString("zh-HK", { weekday: "short" });

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-black p-4 pb-24 text-white">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-semibold">天氣</h1>
          <button
            onClick={fetchByLocation}
            className="p-2 bg-white/10 rounded-full active:bg-white/20 transition-colors"
          >
            <MapPin size={20} className="text-blue-400" />
          </button>
        </div>

        {/* City Switcher */}
        <div className="flex gap-2 mb-4">
          {savedCities.map((savedCity) => (
            <button
              key={savedCity}
              onClick={() => fetchByCity(savedCity)}
              className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                data?.location.name === savedCity
                  ? "bg-blue-500 text-white"
                  : "bg-white/10 text-white/60 active:bg-white/20"
              }`}
            >
              {savedCity}
            </button>
          ))}
        </div>

        {/* Search Bar (Enhanced UX) */}
        <div className="relative mb-6">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchByCity()}
            enterKeyHint="search" // 手機鍵盤顯示「搜尋」
            className="w-full pl-10 pr-10 py-3 bg-[#1c1c1e]/80 border border-white/10 rounded-2xl focus:border-blue-500 focus:outline-none placeholder-gray-500 text-white transition-all"
            placeholder="搜尋城市 (例如: Tokyo)"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />

          {/* Right Side Actions: Clear or Loading */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
            {loading ? (
              <Loader2 size={18} className="animate-spin text-blue-500" />
            ) : city ? (
              <button onClick={() => setCity("")} className="text-gray-500 active:text-white p-1">
                <X size={16} />
              </button>
            ) : null}
          </div>
        </div>

        {/* Main Content */}
        {data?.location && data?.current && (
          <div className="animate-fade-in">
            {/* Current Weather Card */}
            <div className="relative overflow-hidden bg-gradient-to-br from-blue-600/20 to-purple-600/10 border border-white/10 rounded-3xl p-6 mb-8 backdrop-blur-md shadow-2xl">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-lg font-medium text-white/90 mb-1 flex items-center gap-2">
                    <MapPin size={16} className="text-blue-400" />
                    {data.location.name}
                  </div>
                  <div className="text-sm text-white/50">
                    {new Date().toLocaleDateString("zh-HK", { month: "long", day: "numeric" })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-5xl mb-2 drop-shadow-lg">{getWeatherIcon(data.current.condition.text)}</div>
                </div>
              </div>

              <div className="flex items-baseline gap-2 mt-4 mb-2">
                <div className="text-7xl font-thin tracking-tighter">
                  {Math.round(data.current.temp_c)}°
                </div>
                <div className="text-xl text-white/60 font-light">
                  {data.current.condition.text}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-6 pt-6 border-t border-white/10">
                <div className="text-center">
                  <div className="text-xs text-white/40 mb-1">體感</div>
                  <div className="font-medium">{Math.round(data.current.feelslike_c)}°</div>
                </div>
                <div className="text-center border-l border-white/10">
                  <div className="text-xs text-white/40 mb-1 flex items-center justify-center gap-1">
                    <Droplets size={10} /> 濕度
                  </div>
                  <div className="font-medium">{data.current.humidity}%</div>
                </div>
                <div className="text-center border-l border-white/10">
                  <div className="text-xs text-white/40 mb-1 flex items-center justify-center gap-1">
                    <Wind size={10} /> 風速
                  </div>
                  <div className="font-medium">{data.current.wind_kph} <span className="text-[10px]">km/h</span></div>
                </div>
              </div>
            </div>

            {/* 7-Day Forecast */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-3 px-1">
                七日預報
              </h3>
              <div className="bg-[#1c1c1e]/50 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-md">
                {data.forecast.forecastday.map((d, i) => (
                  <div key={i}>
                    <div
                      onClick={() => setExpandedDay(expandedDay === i ? null : i)}
                      className={`px-5 py-4 flex items-center justify-between cursor-pointer transition-colors ${expandedDay === i ? "bg-white/5" : "active:bg-white/5"
                        }`}
                    >
                      <div className="flex items-center gap-4 w-1/3">
                        <span className={`text-sm font-medium ${i === 0 ? "text-blue-400" : "text-white"}`}>
                          {i === 0 ? "今日" : weekday(d.date)}
                        </span>
                        <span className="text-xl">{getWeatherIcon(d.day.condition.text)}</span>
                      </div>

                      <div className="flex-1 text-xs text-white/40 text-center truncate px-2">
                        {d.day.condition.text}
                      </div>

                      <div className="flex items-center gap-3 w-1/3 justify-end tabular-nums">
                        <span className="text-white/30 text-sm">{Math.round(d.day.mintemp_c)}°</span>
                        <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden relative">
                          <div className="absolute top-0 bottom-0 bg-gradient-to-r from-blue-500 to-yellow-500 opacity-60 w-full rounded-full"></div>
                        </div>
                        <span className="text-white text-sm">{Math.round(d.day.maxtemp_c)}°</span>
                      </div>
                    </div>

                    {/* Hourly Forecast */}
                    {expandedDay === i && (
                      <div className="px-5 pb-5 pt-2 bg-black/20 border-t border-white/5 animate-fade-in">
                        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                          {d.hour.map((h, idx) => {
                            if (idx % 3 !== 0) return null; // 每 3 小時顯示一次，避免太擁擠
                            return (
                              <div
                                key={idx}
                                className="flex-shrink-0 w-12 flex flex-col items-center gap-2"
                              >
                                <div className="text-[10px] text-white/40 tabular-nums">
                                  {h.time.slice(11, 16)}
                                </div>
                                <div className="text-lg">
                                  {getWeatherIcon(h.condition.text)}
                                </div>
                                <div className="text-sm font-medium tabular-nums">
                                  {Math.round(h.temp_c)}°
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {i < data.forecast.forecastday.length - 1 && (
                      <div className="h-px bg-white/5 mx-5"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification (統一 UI) */}
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl z-50 border border-white/10 transition-all duration-300 ${toast.type === "error" ? "bg-red-900/90" : "bg-[#2c2c2e]/90"} text-white backdrop-blur-md flex items-center gap-2 whitespace-nowrap`}>
          <span>{toast.type === "success" ? "✅" : "❌"} {toast.msg}</span>
        </div>
      )}
    </div>
  );
}