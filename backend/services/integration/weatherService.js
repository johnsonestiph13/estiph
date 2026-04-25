/**
 * ESTIF HOME ULTIMATE - WEATHER SERVICE
 * Weather data integration for automation triggers
 * Version: 2.0.0
 */

const { logger } = require('../../utils/logger');

class WeatherService {
    constructor() {
        this.apiKey = process.env.OPENWEATHER_API_KEY;
        this.baseUrl = 'https://api.openweathermap.org/data/2.5';
        this.cache = new Map();
    }

    async getCurrentWeather(lat, lon) {
        const cacheKey = `${lat},${lon}`;
        
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < 600000) { // 10 minutes
                return cached.data;
            }
        }
        
        const url = `${this.baseUrl}/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            this.cache.set(cacheKey, { data, timestamp: Date.now() });
            return data;
        } catch (error) {
            logger.error('Weather API error:', error);
            return null;
        }
    }

    async getForecast(lat, lon, days = 5) {
        const url = `${this.baseUrl}/forecast?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            return data.list.slice(0, days * 8);
        } catch (error) {
            logger.error('Forecast API error:', error);
            return null;
        }
    }

    async getTemperature(lat, lon) {
        const weather = await this.getCurrentWeather(lat, lon);
        return weather?.main?.temp || null;
    }

    async getSunriseSunset(lat, lon) {
        const weather = await this.getCurrentWeather(lat, lon);
        return {
            sunrise: weather?.sys?.sunrise,
            sunset: weather?.sys?.sunset
        };
    }

    async getAQI(lat, lon) {
        const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${this.apiKey}`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            return data.list[0]?.main?.aqi || null;
        } catch (error) {
            logger.error('AQI API error:', error);
            return null;
        }
    }
}

module.exports = new WeatherService();