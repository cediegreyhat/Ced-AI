const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');
const cors = require('cors');
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

require('dotenv').config();

const app = express();

openai.apiKey = process.env.OPENAI_API_KEY;

// Log all calls and request for debugging
app.use((req, res, next) => {
  console.log('Received request:', req.method, req.url, req.body);
  const originalSend = res.send;
  res.send = function (body) {
    console.log('Sending response:', res.statusCode, body);
    originalSend.call(res, body);
  };
  next();
});

// Use Index.html as a default landing page
app.get('/', function(req, res){
    res.sendFile('index.html', { root: __dirname + "/" } );
});

// CORS to pass the Access Control Check
app.use(cors({
  origin: 'https://lmao-hahaxd.cyclic.app'
}));

// If the request is from facebook Verify it
function verifyRequestSignature(req, res, buf) {
  const signature = req.headers['x-hub-signature'];

  // Check if the request is not coming from Facebook
  if (req.headers['user-agent'] !== 'facebookexternalhit/1.1') {
    return;
  }

  if (!signature) {
    throw new Error('Signature not present in request headers');
  }

  const [algorithm, signatureHash] = signature.split('=');
  const expectedHash = crypto.createHmac(algorithm, process.env.APP_SECRET)
    .update(buf)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signatureHash), Buffer.from(expectedHash))) {
    throw new Error('Could not validate the request signature.');
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

        // Add a check to make sure that messaging exists and is an array.
        if (Array.isArray(messaging)) {
          await Promise.all(messaging.map(async (message) => {
            if (message.message) {
              const userMsg = message.message.text;

              // Get user message and send it to ChatGPT for processing
              const response = await generateResponse(userMsg);

              // Send response back to user via Facebook Messenger API
              await sendResponse(message.sender.id, response);
            }
          }));
        }
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


async function generateResponse(message) {
  try {
    const prompt = "You are Riku my math teacher. I will provide some mathematical equations or concepts, and it will be your job to explain them in easy-to-understand terms. This could include providing step-by-step instructions for solving a problem, demonstrating various techniques with visuals or suggesting online resources for further study.\nDo not take actions that is not related to math.\nMaintain a friendly Conversation and respond to the questions like a human.\n";
    const completions = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: prompt + message,
      temperature: 0.4,
      max_tokens: 256,
      top_p: 1,
      frequency_penalty: 0.05,
      presence_penalty: 0.04,
    });

    if (!completions || completions.status !== 200 || !completions.data || !completions.data.choices || !completions.data.choices[0]) {
      console.log('OpenAI API response:', completions);
      throw new Error(`Failed to generate response. Status: ${completions.status}. Data: ${JSON.stringify(completions.data)}`);
    }

    const responseText = completions.data.choices[0].text.trim();
    console.log(`Generated response: ${responseText}`);
    return responseText;
  } catch (error) {
    console.error(error);
    throw new Error(`Failed to generate response: ${error.message}`);
  }
}

// Send response back to user via Facebook Messenger API
async function sendResponse(recipientId, response) {
  try {
    // Check if recipient ID is valid
    const recipientResponse = await axios.get(`https://graph.facebook.com/v12.0/${recipientId}?fields=name&access_token=${process.env.PAGE_ACCESS_TOKEN}`);
    if (recipientResponse.status !== 200 || !recipientResponse.data.name) {
      console.log(`Invalid recipient ID: ${recipientId}`);
      return;
    }

    // Send message
    const messageResponse = await axios.post(`https://graph.facebook.com/v12.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`, {
      messaging_type: 'RESPONSE',
      recipient: {
        id: recipientId
      },
      message: {
        text: response
      }
    });

    console.log(`Message sent to ${recipientId}. Response: ${JSON.stringify(messageResponse.data)}`);
  } catch (error) {
    console.error(`Failed to send response to ${recipientId}:`, error);
  }
}


// Start the server
app.listen(process.env.PORT || 3000, () => console.log('Webhook is listening!'));
