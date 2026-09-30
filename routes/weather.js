const express = require('express');
const router = express.Router();

const {
  getWeather, getWeatherStatus, updateWeather
} = require('../controllers/weather');

router
  .route('/')
  .get(getWeather);

router
  .route('/status')
  .get(getWeatherStatus);

router
  .route('/update')
  .get(updateWeather);


module.exports = router;
