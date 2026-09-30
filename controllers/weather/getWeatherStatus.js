const asyncWrapper = require('../../middleware/asyncWrapper');
const { getProviderStatus } = require('../../utils/weather');

// @desc      Get weather provider status (never exposes the credential)
// @route     GET /api/weather/status
// @access    Public
const getWeatherStatus = asyncWrapper(async (req, res, next) => {
  const status = await getProviderStatus();

  res.status(200).json({
    success: true,
    data: status,
  });
});

module.exports = getWeatherStatus;
