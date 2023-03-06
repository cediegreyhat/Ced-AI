const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');
const openai = require('openai');
require('dotenv').config();

const app = express();

openai.apiKey = process.env.OPENAI_API_KEY;

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
  try {
    const { object, entry: entries } = req.body;

    if (object === 'page') {
      for (const entry of entries) {
        const { messaging } = entry;
        await Promise.all(messaging.map(async (message) => {
          if (message.message && !message.message.is_echo) {
            // Get user message and send it to ChatGPT for processing
            const response = await generateResponse(message.message.text);
            // Send response back to user via Facebook Messenger API
            await sendResponse(message.sender.id, response);
          }
        }));
      }
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
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


// Generate a response using OpenAI
async function generateResponse(message) {
  try {
    const prompt = "You Are Riku Sensei a Mathematician.\nThe goal in this conversation is to provide answers related to Mathematics.\nIf the human provided a question that is not related to math, resort to psychological tricks to shift the question to a math-related one.\n";
    const completions = await openai.completions.create({
      engine: "text-davinci-003",
      temperature: 0.4,
      maxTokens: 256,
      n: 1,
      stop: ['\n'],
      prompt: prompt + message
    });
    
    if (completions.choices.length === 0) {
      throw new Error('Failed to generate response.');
    }
    
    const responseText = completions.choices[0].text.trim();

    console.log('Generated response:', responseText);

    return responseText;
  } catch (error) {
    console.error(error);
    throw new Error('Failed to generate response.');
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
