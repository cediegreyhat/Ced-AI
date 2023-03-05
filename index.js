const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');
const { Configuration, OpenAIApi } = require('openai');

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

// Define a global variable to store conversation state
let conversationState = {};

// Webhook for receiving messages from Facebook Messenger
app.post('/webhook', async (req, res) => {
  const { object, entry } = req.body;

  if (object === 'page') {
    entry.forEach(async (entry) => {
      const { messaging } = entry;
      messaging.forEach(async (message) => {
        if (message.message && !message.message.is_echo) {
          // Get user message and conversation state
          const userMessage = message.message.text;
          const { sender } = message;
          const sessionId = sender.id;
          const state = conversationState[sessionId] || {};

          // Generate response based on conversation state
          const response = await generateResponse(userMessage, state);

          // Update conversation state
          conversationState[sessionId] = response.state;

          // Send response back to user via Facebook Messenger API
          await sendResponse(sender.id, response.text);
        }
      });
    });
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

// Generate response using OpenAI's GPT-3 API
async function generateResponse(userMessage, state) {
  try {
    // Build prompt based on conversation state and user message
    const prompt = buildPrompt(userMessage, state);

    // Call OpenAI API to generate response
    const response = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt,
      maxTokens: 150,
      temperature: 0.2,
      n: 1,
      stop: [" Human:", " AI:"],
    });

    // Parse response and extract conversation state
    const text = response.data.choices[0].text.trim();
    const nextState = parseResponse(text);

    // Merge conversation state and return response
    return {
      text,
      state: { ...state, ...nextState }
    };
  } catch (error) {
    console.error(error);
    return { text: 'Oops, something went wrong!', state };
  }
}

// Build prompt based on conversation state and user message
function buildPrompt(userMessage, state) {
  // Add user message to prompt
  let prompt = userMessage;

  // Add conversation state to prompt
  Object.entries(state).forEach(([key, value]) => {
    prompt += `\n${key}: ${value}`;
  });

  return prompt;
}

// Parse response and extract conversation state
function parseResponse(text) {
  const state = {};

  // Extract conversation state from response
  const matches = text.match(/\w+: \w+/g);
  if (matches) {
    matches.forEach((match) => {
      const [key, value] = match.split(': ');
      state[key] = value;
    });
  }

  return state;
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
          // Get user message and send it to GPT-3 for a response
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

// Generate response using OpenAI's GPT-3 API
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function generateResponse(message) {
  try {
    const response = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt: message,
      maxTokens: 150,
      temperature: 0.2,
      n: 1,
      stop: [" Human:", " AI:"],
    });
    return response.data.choices[0].text.trim();
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

app.listen(process.env.PORT || 3000, () => console.log('Webhook is listening!'));
