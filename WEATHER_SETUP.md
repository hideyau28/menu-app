# Weather API Setup

The Weather page now uses the **OpenWeatherMap API** for real-time weather data.

## Setup Instructions

### 1. Get Your Free API Key

1. Visit [OpenWeatherMap](https://openweathermap.org/api)
2. Click "Sign Up" (or "Get API Key")
3. Create a free account
4. Verify your email address
5. Go to your account's API keys section
6. Copy your API key

**Note:** It may take 10-15 minutes after signup for your API key to become active.

### 2. Configure the API Key

1. In the project root directory, create a file named `.env.local`
2. Add the following line:
   ```
   NEXT_PUBLIC_OPENWEATHER_API_KEY=your_actual_api_key_here
   ```
3. Replace `your_actual_api_key_here` with your actual API key

**Example:**
```
NEXT_PUBLIC_OPENWEATHER_API_KEY=abc123def456ghi789jkl012mno345pq
```

### 3. Restart the Development Server

```bash
# Stop the current dev server (Ctrl+C)
# Then restart it:
npm run dev
```

### 4. Test It Out

1. Open http://localhost:3000/weather
2. Enter a city name (e.g., "London", "Tokyo", "New York")
3. Click "Search"
4. You should see real weather data with icons!

## Features

- **Current Weather:** Temperature, feels like, description, humidity, wind speed
- **Multi-Day Forecast:** Up to 7 days with high/low temps and weather icons
- **City Search:** Search any city worldwide
- **Auto-Save:** Your last searched city is saved to LocalStorage
- **Auto-Load:** When you return, it automatically loads your saved city's weather

## Free Tier Limits

OpenWeatherMap's free tier includes:
- 1,000 API calls per day
- Current weather data
- 5-day/3-hour forecast
- More than enough for personal use!

## Troubleshooting

### "City not found"
- Check spelling
- Try adding country code: "Paris,FR" or "London,GB"

### "API key not configured"
- Make sure `.env.local` exists in the root directory
- Verify the variable name is exactly: `NEXT_PUBLIC_OPENWEATHER_API_KEY`
- Restart your dev server after creating/editing `.env.local`

### "Failed to fetch weather data"
- Check if your API key is active (wait 10-15 minutes after signup)
- Verify you have internet connection
- Check browser console for detailed error messages

## Security Note

For this personal utility app, the API key is exposed in the client-side code (via `NEXT_PUBLIC_` prefix). This is acceptable for:
- Personal projects
- Free tier API keys
- Non-production applications

For production apps, you would want to:
- Use a backend proxy to hide the API key
- Implement rate limiting
- Use server-side API routes
