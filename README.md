# Weather Forecasting Application

A modern, user-friendly web application that provides real-time weather forecasts for any location. Built with Flask and integrated with a weather API to deliver accurate weather information.

## 📋 Table of Contents
- [Features](#features)
- [Technologies Used](#technologies-used)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Usage](#usage)
- [Application Screenshots](#application-screenshots)
- [API Details](#api-details)
- [Contributing](#contributing)
- [License](#license)

## ✨ Features

- **Real-Time Weather Data**: Get current weather information for any city worldwide
- **Comprehensive Weather Information**: 
  - Temperature (in Celsius)
  - Humidity levels
  - Weather conditions (clear sky, clouds, rain, etc.)
  - Wind speed
- **User-Friendly Interface**: Clean, intuitive design for easy navigation
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Quick Search**: Simply enter a city name to get instant weather updates
- **Beautiful Background**: Dynamic sky-themed background that complements the weather theme

## 🛠️ Technologies Used

- **Backend**: Flask (Python web framework)
- **Frontend**: HTML, CSS, JavaScript
- **Weather Data**: OpenWeatherMap API (or similar weather service)
- **Styling**: Custom CSS with responsive design principles
- **Server**: Python-based lightweight server

## 📁 Project Structure

```
Weather-Forecasting/
│
├── app.py                    # Main Flask application
├── README.md                 # Project documentation
│
├── static/                   # Static files (CSS, Images)
│   ├── style.css            # Application styling
│   └── background.jpg       # Background image
│
└── templates/               # HTML templates
    └── index.html           # Main application page
```

## 🚀 Installation

### Prerequisites
- Python 3.7 or higher
- pip (Python package installer)
- Git

### Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/abhinendra9792/Weather-Forecasting.git
   cd Weather-Forecasting
   ```

2. **Create a Virtual Environment** (Optional but recommended)
   ```bash
   python -m venv venv
   ```

3. **Activate Virtual Environment**
   - On Windows:
     ```bash
     venv\Scripts\activate
     ```
   - On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

4. **Install Required Dependencies**
   ```bash
   pip install flask
   pip install requests
   ```

5. **Get API Key**
   - Visit [OpenWeatherMap](https://openweathermap.org/api)
   - Sign up for a free account
   - Generate your API key from the dashboard
   - Add your API key to the `app.py` file

6. **Run the Application**
   ```bash
   python app.py
   ```

7. **Access the Application**
   - Open your web browser
   - Navigate to `http://localhost:5000`

## 💻 Usage

1. **Enter Location**: Type the name of a city in the search box
2. **Click "Get Weather"**: Press the button to fetch weather data
3. **View Results**: The application displays:
   - City name
   - Current temperature
   - Humidity percentage
   - Weather description
   - Wind speed
4. **Search Again**: Enter a different city to get new weather information

## 📸 Application Screenshots

### Main Interface
![Weather Forecasting Application](./static/background%20\(2\).jpg)

The application features:
- **Clean Layout**: White card interface against a beautiful blue sky background
- **Search Box**: Enter any city name worldwide
- **Get Weather Button**: Green button for easy access
- **Weather Details**: Organized display of temperature, humidity, conditions, and wind speed

## 🌐 API Details

### OpenWeatherMap API Endpoint
```
https://api.openweathermap.org/data/2.5/weather?q={city}&appid={API_KEY}&units=metric
```

### Response Parameters
- `temp`: Temperature in Celsius
- `humidity`: Humidity percentage
- `description`: Weather condition description
- `speed`: Wind speed in m/s

## 🎨 Customization

### Change Background
Replace the image file in `static/` directory with your own background image and update the CSS reference in `style.css`

### Modify Styling
Edit `static/style.css` to customize:
- Card styling
- Button colors
- Font sizes
- Layout dimensions
- Color scheme

### Update API Provider
If you want to use a different weather API:
1. Sign up for the new API service
2. Modify the API endpoint in `app.py`
3. Adjust the JSON parsing to match the new response format

## 🤝 Contributing

Contributions are welcome! To contribute:

1. **Fork the Repository**
2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/YourFeatureName
   ```
3. **Make Your Changes**
4. **Commit Your Changes**
   ```bash
   git commit -m 'Add some feature'
   ```
5. **Push to the Branch**
   ```bash
   git push origin feature/YourFeatureName
   ```
6. **Open a Pull Request**

## 📝 License

This project is open source and available under the MIT License - feel free to use, modify, and distribute this project.

## 📞 Support & Contact

For issues, questions, or suggestions:
- Open an issue on the [GitHub repository](https://github.com/abhinendra9792/Weather-Forecasting/issues)
- Contact the developer for more information

---

**Enjoy using the Weather Forecasting Application!** ☀️🌤️⛅

