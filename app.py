from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

API_KEY = "6c6e1992c5facf501296851ff0a474fd"  

@app.route('/')
def home():
    return render_template("index.html")

@app.route('/weather', methods=['GET'])
def get_weather():
    city = request.args.get('city')
    if not city:
        return jsonify({"error": "City parameter is missing"}), 400

    url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={API_KEY}&units=metric"
    try:
        res = requests.get(url)
        res.raise_for_status()  
        data = res.json()
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Error fetching data: {e}"}), 500

    if data.get("cod") != 200:
        return jsonify({"error": data.get("message", "City not found")}), data.get("cod", 404)

    weather_info = {
        "city": data["name"],
        "temperature": data["main"]["temp"],
        "humidity": data["main"]["humidity"],
        "weather": data["weather"][0]["description"],
        "wind_speed": data["wind"]["speed"]
    }
    return jsonify(weather_info)
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)