import { NextResponse } from "next/server";

const API_KEY = process.env.WEATHER_API_KEY;

export async function GET(req: Request) {
  if (!API_KEY) {
    return NextResponse.json(
      { error: "Missing WEATHER_API_KEY" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city") || "Hong Kong";

  const url = `https://api.weatherapi.com/v1/current.json?key=${API_KEY}&q=${encodeURIComponent(
    city
  )}&aqi=no`;

  const res = await fetch(url);

  if (!res.ok) {
    return NextResponse.json(
      { error: "Weather API request failed" },
      { status: 500 }
    );
  }

  const data = await res.json();

  return NextResponse.json({
    city: data.location.name,
    country: data.location.country,
    temp: data.current.temp_c,
    condition: data.current.condition.text,
    icon: data.current.condition.icon,
    humidity: data.current.humidity,
    wind: data.current.wind_kph,
  });
}
