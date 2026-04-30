from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import requests
import sqlite3
import os
import time

app = Flask(__name__, template_folder='../templates', static_folder='../static')
CORS(app)

API_KEY = "6c6e1992c5facf501296851ff0a474fd"
DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'weather.db')

# ─── Database Setup ────────────────────────────────────────────────────────────
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS community_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lat REAL,
            lon REAL,
            city TEXT,
            condition TEXT,
            description TEXT,
            timestamp INTEGER
        )
    ''')
    conn.commit()
    conn.close()

init_db()

# ─── Helper ────────────────────────────────────────────────────────────────────
def owm_get(endpoint, params):
    params['appid'] = API_KEY
    try:
        res = requests.get(f"https://api.openweathermap.org/{endpoint}", params=params, timeout=8)
        res.raise_for_status()
        return res.json(), None
    except requests.exceptions.HTTPError as e:
        return None, str(e)
    except requests.exceptions.RequestException as e:
        return None, str(e)

# ─── Routes ───────────────────────────────────────────────────────────────────
@app.route('/')
def home():
    return render_template("index.html")

# Current weather by city name
@app.route('/weather', methods=['GET'])
def get_weather():
    city = request.args.get('city')
    if not city:
        return jsonify({"error": "City parameter is missing"}), 400

    data, err = owm_get("data/2.5/weather", {"q": city, "units": "metric"})
    if err:
        return jsonify({"error": f"Error fetching data: {err}"}), 500
    if data.get("cod") != 200:
        return jsonify({"error": data.get("message", "City not found")}), 404

    return jsonify(build_current_weather(data))

# Current weather by coordinates (GPS / hyperlocal)
@app.route('/weather-by-coords', methods=['GET'])
def get_weather_by_coords():
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    if not lat or not lon:
        return jsonify({"error": "lat and lon parameters required"}), 400

    data, err = owm_get("data/2.5/weather", {"lat": lat, "lon": lon, "units": "metric"})
    if err:
        return jsonify({"error": f"Error fetching data: {err}"}), 500

    return jsonify(build_current_weather(data))

def build_current_weather(data):
    main = data.get("main", {})
    wind = data.get("wind", {})
    weather = data.get("weather", [{}])[0]
    sys = data.get("sys", {})
    coord = data.get("coord", {})

    feels_like = main.get("feels_like", 0)
    temp = main.get("temp", 0)
    humidity = main.get("humidity", 0)
    wind_speed = wind.get("speed", 0)
    visibility = data.get("visibility", 0)
    pressure = main.get("pressure", 0)
    sunrise = sys.get("sunrise", 0)
    sunset = sys.get("sunset", 0)

    # Generate alerts
    alerts = []
    if temp > 40:
        alerts.append({"type": "heatwave", "icon": "☀️", "message": f"Heatwave alert! Temperature is {temp:.0f}°C. Stay hydrated and avoid outdoor exposure."})
    if wind_speed > 20:
        alerts.append({"type": "storm", "icon": "🌩️", "message": f"Storm warning! Wind speed is {wind_speed} m/s. Secure loose objects."})
    if humidity > 90:
        alerts.append({"type": "rain", "icon": "🌧️", "message": "Very high humidity. Heavy rain likely. Carry an umbrella."})
    if temp < 0:
        alerts.append({"type": "cold", "icon": "❄️", "message": f"Freezing temperatures ({temp:.0f}°C). Dress in heavy layers."})

    # Personalized suggestions
    suggestions = []
    description = weather.get("description", "").lower()
    icon_id = weather.get("icon", "01d")
    if "rain" in description or humidity > 70:
        suggestions.append({"icon": "☔", "text": "Carry an umbrella — rain is likely."})
    if temp > 30:
        suggestions.append({"icon": "👕", "text": "Wear light, breathable clothing."})
    if temp < 10:
        suggestions.append({"icon": "🧥", "text": "Bundle up — it's cold outside!"})
    if wind_speed > 10:
        suggestions.append({"icon": "🌬️", "text": "It's windy — avoid outdoor activities."})
    if "clear" in description and temp < 30:
        suggestions.append({"icon": "🚶", "text": "Great weather for a walk or outdoor exercise!"})
    if visibility < 1000:
        suggestions.append({"icon": "🚗", "text": "Low visibility — drive carefully."})

    return {
        "city": data.get("name", "Unknown"),
        "country": sys.get("country", ""),
        "lat": coord.get("lat", 0),
        "lon": coord.get("lon", 0),
        "temperature": round(temp, 1),
        "feels_like": round(feels_like, 1),
        "humidity": humidity,
        "pressure": pressure,
        "weather": weather.get("description", "").title(),
        "weather_main": weather.get("main", ""),
        "icon": icon_id,
        "wind_speed": wind_speed,
        "wind_deg": wind.get("deg", 0),
        "visibility": visibility,
        "sunrise": sunrise,
        "sunset": sunset,
        "alerts": alerts,
        "suggestions": suggestions
    }

# Hourly + daily forecast
@app.route('/forecast', methods=['GET'])
def get_forecast():
    city = request.args.get('city')
    lat = request.args.get('lat')
    lon = request.args.get('lon')

    params = {"units": "metric", "cnt": 40}
    if city:
        params["q"] = city
    elif lat and lon:
        params["lat"] = lat
        params["lon"] = lon
    else:
        return jsonify({"error": "Provide city or lat/lon"}), 400

    data, err = owm_get("data/2.5/forecast", params)
    if err:
        return jsonify({"error": f"Error fetching forecast: {err}"}), 500

    hourly = []
    for item in data.get("list", []):
        dt = item.get("dt", 0)
        main = item.get("main", {})
        weather = item.get("weather", [{}])[0]
        rain = item.get("rain", {}).get("3h", 0)
        pop = item.get("pop", 0)  # probability of precipitation

        hourly.append({
            "dt": dt,
            "temp": round(main.get("temp", 0), 1),
            "feels_like": round(main.get("feels_like", 0), 1),
            "humidity": main.get("humidity", 0),
            "weather": weather.get("description", "").title(),
            "weather_main": weather.get("main", ""),
            "icon": weather.get("icon", "01d"),
            "rain_mm": round(rain, 2),
            "rain_chance": round(pop * 100),
            "wind_speed": item.get("wind", {}).get("speed", 0)
        })

    return jsonify({"forecast": hourly})

# Air Quality Index
@app.route('/aqi', methods=['GET'])
def get_aqi():
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    city = request.args.get('city')

    # If city provided, get coords first
    if city and not (lat and lon):
        geo_data, err = owm_get("data/2.5/weather", {"q": city, "units": "metric"})
        if err or not geo_data:
            return jsonify({"error": "Could not resolve city coordinates"}), 400
        coord = geo_data.get("coord", {})
        lat = coord.get("lat")
        lon = coord.get("lon")

    if not lat or not lon:
        return jsonify({"error": "lat/lon or city required"}), 400

    data, err = owm_get("data/2.5/air_pollution", {"lat": lat, "lon": lon})
    if err:
        return jsonify({"error": f"Error fetching AQI: {err}"}), 500

    aqi_list = data.get("list", [])
    if not aqi_list:
        return jsonify({"error": "No AQI data available"}), 404

    aqi_item = aqi_list[0]
    aqi_value = aqi_item.get("main", {}).get("aqi", 1)
    components = aqi_item.get("components", {})

    aqi_labels = {1: "Good", 2: "Fair", 3: "Moderate", 4: "Poor", 5: "Very Poor"}
    aqi_colors = {1: "#4CAF50", 2: "#8BC34A", 3: "#FFC107", 4: "#FF5722", 5: "#B71C1C"}
    health_tips = {
        1: ["✅ Air quality is great!", "🚴 Perfect for outdoor exercise.", "🪟 Open windows for fresh air."],
        2: ["👍 Air quality is acceptable.", "🏃 Outdoor activities are fine.", "⚠️ Sensitive groups should monitor."],
        3: ["😷 Moderate pollution levels.", "🚶 Limit prolonged outdoor exertion.", "🌿 Keep indoor air clean."],
        4: ["🚫 Avoid outdoor exercise today.", "😷 Wear a mask if going out.", "🏠 Stay indoors if possible."],
        5: ["🚨 Hazardous air quality!", "🏥 Health emergency — stay indoors.", "😷 N95 mask required if outdoors."]
    }

    return jsonify({
        "aqi": aqi_value,
        "label": aqi_labels.get(aqi_value, "Unknown"),
        "color": aqi_colors.get(aqi_value, "#999"),
        "health_tips": health_tips.get(aqi_value, []),
        "components": {
            "pm2_5": round(components.get("pm2_5", 0), 2),
            "pm10": round(components.get("pm10", 0), 2),
            "o3": round(components.get("o3", 0), 2),
            "no2": round(components.get("no2", 0), 2),
            "co": round(components.get("co", 0), 2)
        }
    })

# Community Reports — Submit
@app.route('/report', methods=['POST'])
def submit_report():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    lat = data.get('lat', 0)
    lon = data.get('lon', 0)
    city = data.get('city', 'Unknown')
    condition = data.get('condition', 'rain')
    description = data.get('description', '')

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "INSERT INTO community_reports (lat, lon, city, condition, description, timestamp) VALUES (?,?,?,?,?,?)",
        (lat, lon, city, condition, description, int(time.time()))
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Report submitted! Thank you."})

# Community Reports — Fetch (last 2 hours)
@app.route('/reports', methods=['GET'])
def get_reports():
    cutoff = int(time.time()) - 7200  # 2 hours ago
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "SELECT id, lat, lon, city, condition, description, timestamp FROM community_reports WHERE timestamp > ? ORDER BY timestamp DESC LIMIT 50",
        (cutoff,)
    )
    rows = c.fetchall()
    conn.close()

    reports = []
    for row in rows:
        reports.append({
            "id": row[0],
            "lat": row[1],
            "lon": row[2],
            "city": row[3],
            "condition": row[4],
            "description": row[5],
            "timestamp": row[6]
        })

    return jsonify({"reports": reports})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)