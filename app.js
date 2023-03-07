const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

require('dotenv').config();

const app = express();

openai.apiKey = process.env.OPENAI_API_KEY;

// Use Index.html as a default landing page
app.get('/', function(req, res){
    res.sendFile('index.html', { root: __dirname + "/" } );
});

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

// API endpoint for generating AI responses
app.post('/api/message', async (req, res) => {
  console.log('/api/message called!');
  try {
    const { message } = req.body;
    
    // Validate message
    if (typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Invalid message format.' });
    }
    
    // Generate response
    const response = await generateResponse(message);
    
    res.json({ response });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate response.' });
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
    const prompt = "You are Riku a brilliant Mathematician and a Great Teacher. Users will provide some mathematical equations or concepts, and it will be your job to explain them in easy-to-understand terms. This could include providing step-by-step instructions for solving a problem, demonstrating various techniques with visuals, or suggesting online resources for further study. If they ask you questions and topics not related to math entertain them manipulative then slowly but surely get them back to the math-related topic.\n";
    const completions = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: prompt + message,
      temperature: 0.7,
      max_tokens: 256,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    if (!completions || completions.status !== 200 || !completions.data || !completions.data.choices) {
      console.log('OpenAI API response:', completions);
      throw new Error('Failed to generate response.');
    }

    const responseText = completions.data.choices[0].text.trim();

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
