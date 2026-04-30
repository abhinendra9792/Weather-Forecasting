// ── State ─────────────────────────────────────────────────────
let currentWeather = null;
let currentLat = null;
let currentLon = null;
let currentCity = null;
let selectedCondition = 'rain';
let map = null;
let weatherLayer = null;
const API_KEY = '6c6e1992c5facf501296851ff0a474fd';

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();
  // NOTE: initMap() is NOT called here — the map div is hidden (display:none)
  // and Leaflet cannot measure a hidden container. It is called lazily in showSections().
  loadCommunityReports();
  checkOnlineStatus();
  window.addEventListener('online', () => document.getElementById('offline-banner').classList.add('hidden'));
  window.addEventListener('offline', () => document.getElementById('offline-banner').classList.remove('hidden'));
  document.getElementById('cityInput').addEventListener('keydown', e => { if (e.key === 'Enter') searchByCity(); });
  document.getElementById('voice-text-input').addEventListener('keydown', e => { if (e.key === 'Enter') handleVoiceTextInput(); });
  // Auto-detect location silently
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      currentLat = pos.coords.latitude;
      currentLon = pos.coords.longitude;
    }, () => {});
  }
});

function checkOnlineStatus() {
  if (!navigator.onLine) document.getElementById('offline-banner').classList.remove('hidden');
}

// ── Service Worker ────────────────────────────────────────────
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/static/sw.js').catch(() => {});
  }
}

// ── Notification Permission ───────────────────────────────────
function requestNotificationPermission() {
  if ('Notification' in window) {
    Notification.requestPermission().then(p => {
      document.getElementById('notif-btn').textContent = p === 'granted' ? '🔔' : '🔕';
      if (p === 'granted') showToast('Notifications enabled! You will receive weather alerts.');
    });
  } else {
    showToast('Notifications not supported in this browser.');
  }
}

function sendNotification(title, body, icon = '🌩️') {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/static/favicon.ico' });
  }
}

// ── Search by City ────────────────────────────────────────────
async function searchByCity() {
  const city = document.getElementById('cityInput').value.trim();
  if (!city) { showToast('Please enter a city name.'); return; }
  showLoading('Fetching weather for ' + city + '...');
  try {
    const [weatherData, forecastData] = await Promise.all([
      fetchJSON(`/weather?city=${encodeURIComponent(city)}`),
      fetchJSON(`/forecast?city=${encodeURIComponent(city)}`)
    ]);
    if (weatherData.error) { showToast('Error: ' + weatherData.error); hideLoading(); return; }
    currentCity = city;
    currentLat = weatherData.lat;
    currentLon = weatherData.lon;
    displayAll(weatherData, forecastData);
    fetchAndShowAQI(weatherData.lat, weatherData.lon);
    updateMapCenter(weatherData.lat, weatherData.lon, weatherData.city);
    cacheWeatherData(weatherData, forecastData);
  } catch (e) {
    const cached = loadCachedWeather();
    if (cached) { displayAll(cached.weather, cached.forecast); showOfflineBanner(); }
    else showToast('Network error. Please check your connection.');
  }
  hideLoading();
}

// ── Use GPS Location ──────────────────────────────────────────
function useMyLocation() {
  if (!navigator.geolocation) { showToast('Geolocation not supported.'); return; }
  const btn = document.getElementById('gps-btn');
  btn.disabled = true;
  showLoading('Detecting your location...');
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude: lat, longitude: lon } = pos.coords;
    currentLat = lat; currentLon = lon;
    try {
      const [weatherData, forecastData] = await Promise.all([
        fetchJSON(`/weather-by-coords?lat=${lat}&lon=${lon}`),
        fetchJSON(`/forecast?lat=${lat}&lon=${lon}`)
      ]);
      if (weatherData.error) { showToast(weatherData.error); hideLoading(); btn.disabled = false; return; }
      currentCity = weatherData.city;
      document.getElementById('cityInput').value = weatherData.city;
      displayAll(weatherData, forecastData);
      fetchAndShowAQI(lat, lon);
      updateMapCenter(lat, lon, weatherData.city);
      cacheWeatherData(weatherData, forecastData);
    } catch (e) {
      showToast('Could not fetch weather. Check your connection.');
    }
    hideLoading(); btn.disabled = false;
  }, err => {
    showToast('Location access denied. Please enter city manually.');
    hideLoading(); btn.disabled = false;
  });
}

// ── Display All Sections ──────────────────────────────────────
function displayAll(weather, forecast) {
  currentWeather = weather;
  displayCurrentWeather(weather);
  displaySuggestions(weather.suggestions || []);
  displayAlerts(weather.alerts || []);
  displayDailyLife(weather);
  if (forecast && forecast.forecast) displayForecast(forecast.forecast);
  showSections();
}

function showSections() {
  ['current-section','forecast-section','map-section','aqi-section','community-section'].forEach(id => {
    document.getElementById(id).classList.remove('hidden');
  });
  // Initialize map the first time (container is now visible so Leaflet can measure it)
  if (!map) {
    initMap();
  }
  // Always call invalidateSize after reveal so Leaflet repaints at correct dimensions
  setTimeout(() => { if (map) map.invalidateSize(); }, 150);
}

// ── Current Weather ───────────────────────────────────────────
function displayCurrentWeather(d) {
  document.getElementById('cw-city').textContent = d.city;
  document.getElementById('cw-country').textContent = d.country ? `📍 ${d.country}` : '';
  document.getElementById('cw-time').textContent = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  document.getElementById('cw-temp').textContent = d.temperature;
  document.getElementById('cw-feels').textContent = `Feels like ${d.feels_like}°C`;
  document.getElementById('cw-desc').textContent = d.weather;
  document.getElementById('cw-humidity').textContent = d.humidity + '%';
  document.getElementById('cw-wind').textContent = d.wind_speed + ' m/s';
  document.getElementById('cw-vis').textContent = (d.visibility / 1000).toFixed(1) + ' km';
  document.getElementById('cw-pressure').textContent = d.pressure + ' hPa';
  document.getElementById('cw-sunrise').textContent = formatUnixTime(d.sunrise);
  document.getElementById('cw-sunset').textContent = formatUnixTime(d.sunset);
  const icon = document.getElementById('cw-icon');
  icon.src = `https://openweathermap.org/img/wn/${d.icon}@2x.png`;
  icon.alt = d.weather;
}

// ── Suggestions ───────────────────────────────────────────────
function displaySuggestions(suggestions) {
  const list = document.getElementById('suggestions-list');
  if (!suggestions.length) { list.innerHTML = '<p style="color:var(--text-muted)">No specific suggestions — enjoy the weather!</p>'; return; }
  list.innerHTML = suggestions.map(s =>
    `<div class="suggestion-item"><span class="suggestion-icon">${s.icon}</span><span>${s.text}</span></div>`
  ).join('');
}

// ── Alerts ────────────────────────────────────────────────────
function displayAlerts(alerts) {
  const card = document.getElementById('alerts-card');
  const list = document.getElementById('alerts-list');
  if (!alerts.length) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');
  list.innerHTML = alerts.map(a =>
    `<div class="alert-item"><span style="font-size:24px">${a.icon}</span><span>${a.message}</span></div>`
  ).join('');
  // Show banner for first alert
  const banner = document.getElementById('alert-banner');
  banner.textContent = `${alerts[0].icon} ${alerts[0].message}`;
  banner.classList.remove('hidden');
  setTimeout(() => banner.classList.add('hidden'), 10000);
  // Push notification
  if (alerts.length) sendNotification('⚠️ Weather Alert', alerts[0].message);
}

// ── Daily Life Integration ────────────────────────────────────
function displayDailyLife(d) {
  const items = [];
  const now = new Date();
  const hour = now.getHours();
  if (d.weather.toLowerCase().includes('rain') || d.humidity > 70) {
    items.push({ icon: '🚂', title: 'Travel Impact', text: 'Rain may cause delays. Allow extra travel time.' });
    items.push({ icon: '📅', title: 'Meeting Alert', text: 'Outdoor meetings may be affected by rain. Consider indoors.' });
  }
  if (d.temperature > 35) {
    items.push({ icon: '🏃', title: 'Exercise Advisory', text: 'Avoid intense outdoor exercise. Best before 8 AM or after 6 PM.' });
  }
  if (d.wind_speed > 10) {
    items.push({ icon: '✈️', title: 'Flight Advisory', text: 'Strong winds may affect local flights. Check your airline.' });
  }
  if (d.visibility < 2000) {
    items.push({ icon: '🚗', title: 'Driving Alert', text: 'Low visibility detected. Drive slowly and use headlights.' });
  }
  if (!items.length) {
    items.push({ icon: '✅', title: 'All Clear', text: 'No significant weather impacts on daily activities.' });
    items.push({ icon: '🌳', title: 'Great Day Out', text: 'Conditions are ideal for outdoor plans today.' });
  }
  const container = document.getElementById('daily-life-list');
  container.innerHTML = items.map(i =>
    `<div class="daily-item"><div class="daily-item-icon">${i.icon}</div><div class="daily-item-title">${i.title}</div><div class="daily-item-text">${i.text}</div></div>`
  ).join('');
}

// ── Hourly Forecast ───────────────────────────────────────────
function displayForecast(hourly) {
  const scroll = document.getElementById('hourly-scroll');
  scroll.innerHTML = hourly.slice(0, 16).map(h => {
    const date = new Date(h.dt * 1000);
    const time = date.toLocaleTimeString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    const rainClass = h.rain_chance >= 60 ? ' rain-likely' : '';
    return `
      <div class="hourly-card${rainClass}">
        <div class="hourly-time">${formatHourlyTime(date)}</div>
        <img class="hourly-icon" src="https://openweathermap.org/img/wn/${h.icon}.png" alt="${h.weather}" />
        <div class="hourly-temp">${h.temp}°</div>
        <div class="hourly-rain">🌧️ ${h.rain_chance}%</div>
        <div class="hourly-wind">💨 ${h.wind_speed} m/s</div>
      </div>`;
  }).join('');
  findBestTimeOutside(hourly);
}

function formatHourlyTime(date) {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const prefix = isToday ? 'Today' : days[date.getDay()];
  return `${prefix}<br/>${date.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;
}

function findBestTimeOutside(hourly) {
  const best = hourly
    .filter(h => h.rain_chance < 30 && h.temp > 15 && h.temp < 35)
    .slice(0, 3);
  const container = document.getElementById('best-time-content');
  if (!best.length) {
    container.innerHTML = '<p style="color:var(--text-muted)">No ideal window found in the next 48 hours.</p>';
    return;
  }
  container.innerHTML = best.map(h => {
    const date = new Date(h.dt * 1000);
    return `<div class="best-time-slot" style="margin-bottom:10px">
      <div class="best-time-badge">${formatHourlyTime(date).replace('<br/>',' ')}</div>
      <div><strong>${h.temp}°C</strong> · ${h.weather} · 🌧️ ${h.rain_chance}% rain · 💨 ${h.wind_speed} m/s</div>
    </div>`;
  }).join('');
}

// ── AQI ───────────────────────────────────────────────────────
async function fetchAndShowAQI(lat, lon) {
  try {
    const data = await fetchJSON(`/aqi?lat=${lat}&lon=${lon}`);
    if (data.error) return;
    displayAQI(data);
  } catch (e) {}
}

function displayAQI(data) {
  const pct = ((data.aqi - 1) / 4) * 100;
  const gauge = document.getElementById('aqi-gauge');
  gauge.style.background = `conic-gradient(${data.color} ${pct * 3.6}deg, rgba(255,255,255,0.06) ${pct * 3.6}deg)`;
  document.getElementById('aqi-value').textContent = data.aqi;
  document.getElementById('aqi-value').style.color = data.color;
  document.getElementById('aqi-label').textContent = data.label;
  const tips = document.getElementById('aqi-tips');
  tips.innerHTML = (data.health_tips || []).map(t => `<div class="aqi-tip">${t}</div>`).join('');
  const comp = data.components || {};
  document.getElementById('pollutant-list').innerHTML = [
    { name: 'PM2.5', val: comp.pm2_5, unit: 'μg/m³' },
    { name: 'PM10',  val: comp.pm10,  unit: 'μg/m³' },
    { name: 'O₃ (Ozone)',   val: comp.o3,   unit: 'μg/m³' },
    { name: 'NO₂',  val: comp.no2,  unit: 'μg/m³' },
    { name: 'CO',   val: comp.co,   unit: 'μg/m³' }
  ].map(p =>
    `<div class="pollutant-row"><span class="pollutant-name">${p.name}</span><span class="pollutant-value">${p.val} <small style="color:var(--text-muted)">${p.unit}</small></span></div>`
  ).join('');
}

// ── Interactive Map ───────────────────────────────────────────
function initMap() {
  if (map) return; // guard against double init
  map = L.map('weather-map', { zoomControl: true, preferCanvas: true }).setView([20, 78], 4);
  // Base tile layer (OpenStreetMap)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
    opacity: 0.6
  }).addTo(map);
  // Default OWM overlay: precipitation
  weatherLayer = L.tileLayer(
    `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${API_KEY}`,
    { opacity: 0.75, attribution: '&copy; OpenWeatherMap' }
  ).addTo(map);
}

function setMapLayer(layerName) {
  if (weatherLayer) map.removeLayer(weatherLayer);
  weatherLayer = L.tileLayer(
    `https://tile.openweathermap.org/map/${layerName}/{z}/{x}/{y}.png?appid=${API_KEY}`,
    { opacity: 0.7, attribution: '© OpenWeatherMap' }
  ).addTo(map);
  document.querySelectorAll('.map-layer-btn').forEach(b => b.classList.remove('active'));
  const btnId = 'layer-' + layerName.replace('_new','');
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add('active');
}

function updateMapCenter(lat, lon, city) {
  map.setView([lat, lon], 10);
  L.marker([lat, lon])
    .addTo(map)
    .bindPopup(`<b>${city}</b><br/>📍 ${lat.toFixed(3)}, ${lon.toFixed(3)}`)
    .openPopup();
}

// ── Community Reports ─────────────────────────────────────────
function selectCondition(btn, condition) {
  document.querySelectorAll('.condition-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedCondition = condition;
}

async function submitReport() {
  const desc = document.getElementById('report-desc').value.trim();
  const lat = currentLat || 20;
  const lon = currentLon || 78;
  const city = currentCity || 'Unknown';
  try {
    const res = await fetch('/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lon, city, condition: selectedCondition, description: desc })
    });
    const data = await res.json();
    showToast(data.message || 'Report submitted!');
    document.getElementById('report-desc').value = '';
    loadCommunityReports();
    addReportMarker(lat, lon, selectedCondition, city, desc);
  } catch (e) { showToast('Failed to submit report. Check connection.'); }
}

async function loadCommunityReports() {
  try {
    const data = await fetchJSON('/reports');
    displayReports(data.reports || []);
  } catch (e) {}
}

const conditionEmoji = { rain:'🌧️', storm:'⛈️', fog:'🌫️', hail:'🌨️', wind:'💨', clear:'☀️' };
const conditionColor  = { rain:'#4fc3f7', storm:'#ef5350', fog:'#90a4ae', hail:'#b0bec5', wind:'#aed581', clear:'#ffd54f' };

function displayReports(reports) {
  const list = document.getElementById('reports-list');
  if (!reports.length) { list.innerHTML = '<p class="empty-state">No reports in the last 2 hours.</p>'; return; }
  list.innerHTML = reports.map(r => {
    const ago = timeAgo(r.timestamp);
    const emoji = conditionEmoji[r.condition] || '🌤️';
    return `<div class="report-item">
      <div class="report-item-header">
        <span class="report-condition">${emoji} ${capitalize(r.condition)}</span>
        <span class="report-time">${ago}</span>
      </div>
      <div class="report-city">📍 ${r.city}</div>
      ${r.description ? `<div class="report-desc-text">${r.description}</div>` : ''}
    </div>`;
  }).join('');
  // Add markers
  reports.forEach(r => addReportMarker(r.lat, r.lon, r.condition, r.city, r.description));
}

function addReportMarker(lat, lon, condition, city, desc) {
  if (!map || !lat || !lon) return;
  const color = conditionColor[condition] || '#fff';
  const emoji = conditionEmoji[condition] || '📍';
  const icon = L.divIcon({
    html: `<div style="font-size:22px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">${emoji}</div>`,
    className: '', iconSize: [30, 30], iconAnchor: [15, 15]
  });
  L.marker([lat, lon], { icon }).addTo(map)
    .bindPopup(`<b>Community Report</b><br/>${emoji} ${capitalize(condition)}<br/>📍 ${city}${desc ? '<br/>' + desc : ''}`);
}

// ── Voice Assistant ───────────────────────────────────────────
let recognition = null;

function startVoiceInput() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) { showToast('Voice recognition not supported. Use Chrome or Edge.'); return; }
  const btn = document.getElementById('mic-btn');
  if (recognition) { recognition.stop(); return; }
  recognition = new SpeechRec();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  btn.classList.add('listening');
  recognition.start();
  recognition.onresult = e => {
    const text = e.results[0][0].transcript;
    handleVoiceText(text);
  };
  recognition.onend = () => { btn.classList.remove('listening'); recognition = null; };
  recognition.onerror = () => { btn.classList.remove('listening'); recognition = null; showToast('Could not understand. Try again.'); };
}

function handleVoiceTextInput() {
  const input = document.getElementById('voice-text-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  handleVoiceText(text);
}

function handleVoiceText(text) {
  addVoiceBubble(text, 'user');
  const response = generateVoiceResponse(text.toLowerCase());
  setTimeout(() => {
    addVoiceBubble(response, 'assistant');
    speak(response);
  }, 400);
}

function addVoiceBubble(text, role) {
  const container = document.getElementById('voice-bubbles');
  const div = document.createElement('div');
  div.className = `voice-bubble ${role}-bubble`;
  div.innerHTML = `<span>${text}</span>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function generateVoiceResponse(q) {
  const w = currentWeather;
  if (!w) return "🔍 Please search for a city first, then I can answer weather questions!";
  if (q.includes('rain')) {
    const rainWord = w.weather.toLowerCase().includes('rain') || w.humidity > 70 ? 'Yes' : 'No';
    return `${rainWord}, ${rainWord === 'Yes' ? 'it is raining or likely to rain' : 'no rain expected'} in ${w.city}. Humidity is ${w.humidity}%. ${rainWord === 'Yes' ? '☔ Carry an umbrella!' : ''}`;
  }
  if (q.includes('temperature') || q.includes('hot') || q.includes('cold')) {
    return `The temperature in ${w.city} is ${w.temperature}°C and feels like ${w.feels_like}°C. The weather is ${w.weather}.`;
  }
  if (q.includes('umbrella')) {
    return w.humidity > 70 || w.weather.toLowerCase().includes('rain')
      ? `☔ Yes! Take an umbrella. It's ${w.weather} with ${w.humidity}% humidity in ${w.city}.`
      : `No umbrella needed today in ${w.city}. Weather is ${w.weather}.`;
  }
  if (q.includes('wind')) {
    return `Wind speed in ${w.city} is ${w.wind_speed} m/s. ${w.wind_speed > 10 ? '⚠️ It is quite windy — be careful outdoors.' : 'Winds are moderate.'}`;
  }
  if (q.includes('air') || q.includes('aqi') || q.includes('quality')) {
    return `I am fetching air quality data for ${w.city}. Check the Air Quality section on this page for detailed AQI information.`;
  }
  if (q.includes('wear') || q.includes('clothes') || q.includes('dress')) {
    if (w.temperature > 30) return `👕 It's ${w.temperature}°C in ${w.city} — wear light, breathable clothes.`;
    if (w.temperature < 10) return `🧥 It's cold at ${w.temperature}°C in ${w.city} — wear warm layers.`;
    return `🙂 Temperature is comfortable at ${w.temperature}°C in ${w.city}. Dress casually.`;
  }
  if (q.includes('travel') || q.includes('drive') || q.includes('safe')) {
    return w.visibility < 2000
      ? `⚠️ Low visibility in ${w.city} (${(w.visibility/1000).toFixed(1)} km). Drive carefully and use headlights.`
      : `✅ Conditions in ${w.city} look safe for travel. Visibility is good.`;
  }
  if (q.includes('humidity')) {
    return `Humidity in ${w.city} is ${w.humidity}%. ${w.humidity > 80 ? 'It feels very muggy — stay hydrated.' : 'Feels comfortable.'}`;
  }
  return `In ${w.city} right now: ${w.temperature}°C, ${w.weather}, humidity ${w.humidity}%, wind ${w.wind_speed} m/s. Ask me more specific questions!`;
}

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text.replace(/[🌧️☔⚠️✅🧥👕🙂💨🔍]/g,''));
  utter.lang = 'en-US';
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}

// ── Offline Caching ───────────────────────────────────────────
function cacheWeatherData(weather, forecast) {
  try {
    localStorage.setItem('cached_weather', JSON.stringify({ weather, forecast, time: Date.now() }));
  } catch (e) {}
}

function loadCachedWeather() {
  try {
    const raw = localStorage.getItem('cached_weather');
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function showOfflineBanner() {
  const cached = loadCachedWeather();
  if (!cached) return;
  const age = Math.round((Date.now() - cached.time) / 60000);
  const banner = document.getElementById('offline-banner');
  banner.textContent = `📶 Offline — showing cached data from ${age} minute${age !== 1 ? 's' : ''} ago`;
  banner.classList.remove('hidden');
}

// ── Utilities ─────────────────────────────────────────────────
async function fetchJSON(url) {
  const res = await fetch(url);
  return res.json();
}

function showLoading(text = 'Loading...') {
  document.getElementById('loading-text').textContent = text;
  document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() { document.getElementById('loading').classList.add('hidden'); }

function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  toast.style.cssText = `position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:rgba(30,35,55,0.95);color:#e8eaf6;padding:12px 24px;border-radius:50px;border:1px solid rgba(255,255,255,0.15);font-size:14px;z-index:999;backdrop-filter:blur(12px);box-shadow:0 8px 32px rgba(0,0,0,0.4);animation:fadeIn 0.3s ease;`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function formatUnixTime(unix) {
  if (!unix) return '--';
  return new Date(unix * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(ts) {
  const diff = Math.round((Date.now() / 1000) - ts);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.round(diff / 60) + 'm ago';
  return Math.round(diff / 3600) + 'h ago';
}

function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}
