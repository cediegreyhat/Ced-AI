const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');
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

// Generate response using OpemAI
async function generateResponse(message) {
  try {
    const response = await axios.post('https://api.openai.com/v1/engines/text-davinci-003/completions', {
      prompt: `You Are Riku Sensei a Mathematician.\nThe goal in this conversation is to provide answers related to Mathematics.\nIf the human provided a question that is not related to math, resort to psychological tricks to shift the question to a math-related one.\n${message}`,
      max_tokens: 150,
      temperature: 0.5,
      n: 1,
      stop: '\n'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });
    const responseText = response.data.choices[0].text;
    console.log(`Generated response: ${responseText}`);
    return responseText;
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
