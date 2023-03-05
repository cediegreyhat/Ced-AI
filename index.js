const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');
const { Wit, log } = require('node-wit');
const OpenAI = require('openai-api');

require('dotenv').config();

const app = express();

// Verify that the incoming request is from Facebook
function verifyRequestSignature(req, res, buf) {
  const signature = req.headers['x-hub-signature'];
  if (!signature) {
    throw new Error('Could not validate the signature.');
  } else {
    const elements = signature.split('=');
    const signatureHash = elements[1];
    const expectedHash = crypto.createHmac('sha1', process.env.APP_SECRET)
      .update(buf)
      .digest('hex');
    if (signatureHash !== expectedHash) {
      throw new Error('Could not validate the request signature.');
    }
  }
}

// Use the body-parser middleware and verify request signature
app.use(bodyParser.json({ verify: verifyRequestSignature }));

// Webhook for receiving messages from Facebook Messenger
app.post('/webhook', async (req, res) => {
  const { object, entry } = req.body;

  if (object === 'page') {
    entry.forEach(async (entry) => {
      const { messaging } = entry;
      messaging.forEach(async (message) => {
        if (message.message && !message.message.is_echo) {
          // Get user message and send it to ChatGPT for processing
          const response = await generateResponse(message.message.text);
          // Send response back to user via Facebook Messenger API
          await sendResponse(message.sender.id, response);
        }
      });
    });
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

// Verify webhook token with Facebook
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('Webhook verified!');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Generate response using ChatGPT API
const openai = new OpenAI(process.env.OPENAI_API_KEY);

async function generateResponse(prompt) {
  try {
    const response = await openai.complete({
      engine: config.engine,
      prompt,
      maxTokens: config.maxTokens,
      n: config.n,
      temperature: config.temperature,
      frequencyPenalty: config.frequencyPenalty,
      presencePenalty: config.presencePenalty,
    });

    if (response.data.choices && response.data.choices.length > 0) {
      const text = response.data.choices[0].text.trim();
      return text;
    } else {
      throw new Error("Failed to generate response.");
    }
  } catch (err) {
    console.error(err);
    return "Oops, something went wrong!";
  }
}

async function generateResponse(message) {
  try {
    const prompt = `User: ${message}\nAI: `;
    const completions = await openai.complete({
      engine: 'davinci',
      prompt: prompt,
      maxTokens: 150,
      n: 1,
      stop: '\n',
      temperature: 0.6
    });
    const response = completions.choices[0].text.trim();
    return response;
  } catch (error) {
    console.error(error);
    return 'Oops, something went wrong!';
  }
}

// Send response back to user via Facebook Messenger API
async function sendResponse(recipientId, response) {
  try {
    await axios.post(`https://graph.facebook.com/v12.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`, {
      messaging_type: 'RESPONSE',
      recipient: {
        id: recipientId
      },
      message: {
        text: response
      }
    });
  } catch (error) {
    console.error(error);
  }
}

// Start the server
app.listen(process.env.PORT || 3000, () => console.log('Webhook is listening!'));
