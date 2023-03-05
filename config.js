require('dotenv').config();

const openai = require('openai');

const fbVerifyToken = process.env.FB_VERIFY_TOKEN;
const fbAccessToken = process.env.FB_ACCESS_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;
const port = process.env.PORT || 3000;

const openaiClient = new openai.default({ apiKey: openaiApiKey });

module.exports = {
  fbVerifyToken,
  fbAccessToken,
  openaiClient,
  port,
};
