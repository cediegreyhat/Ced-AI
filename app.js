const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');
const cors = require('cors');
const { Configuration, OpenAIApi } = require("openai");
const { promisify } = require('util');




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

// Thread Control Handler for facebook
const requestThreadControl = async (userId) => {
  try {
    await axios.post(
      `https://graph.facebook.com/v16.0/me/request_thread_control`,
      {
        "recipient": { "id": userId },
        "metadata": "Requesting thread control"
      },
      {
        params: {
          "access_token": process.env.PAGE_ACCESS_TOKEN
        }
      }
    );
    console.log(`Requested thread control from user ${userId}`);
  } catch (error) {
    console.error(`Error requesting thread control from user ${userId}:`, error.response.data);
  }
}

const releaseThreadControl = async (userId) => {
  try {
    await axios.post(
      `https://graph.facebook.com/v16.0/me/pass_thread_control`,
      {
        "recipient": { "id": userId },
        "target_app_id": process.env.FACEBOOK_APP_ID,
        "metadata": "Releasing thread control"
      },
      {
        params: {
          "access_token": process.env.PAGE_ACCESS_TOKEN
        }
      }
    );
    console.log(`Released thread control from user ${userId}`);
  } catch (error) {
    console.error(`Error releasing thread control from user ${userId}:`, error.response.data);
  }
}

const checkThreadControl = async (userId) => {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v16.0/${userId}/thread_owner`,
      {
        params: {
          "access_token": process.env.PAGE_ACCESS_TOKEN
        }
      }
    );
    const threadOwner = response.data.data[0];
    console.log(`Thread control for user ${userId} is with ${threadOwner.name} (${threadOwner.id})`);
    return threadOwner.id === process.env.FACEBOOK_APP_ID;
  } catch (error) {
    console.error(`Error checking thread control for user ${userId}:`, error.response.data);
    return false;
  }
}

// Caching for faster processing
const cache = {};

// Webhook for receiving messages from Facebook Messenger
app.post('/webhook', async (req, res) => {
  try {
    const { object, entry: entries, standby } = req.body;

    // Check if the request is a standby event
    if (object === 'page' && standby) {
      console.log('Received standby event:', standby);

      // Check if there are user queries/questions in the standby event
      if (standby.length > 0 && ((standby[0].message && standby[0].message.text) || standby[0].text)) {
        const userMsg = (standby[0].message && standby[0].message.text) || standby[0].text;
        const userId = standby[0].sender.id;

        // Check if bot has thread control
        const hasThreadControl = await checkThreadControl(userId);
        if (hasThreadControl) {
          // Check cache for previous response
          if (cache[userId] && cache[userId].msg === userMsg) {
            console.log('Response found in cache:', cache[userId].response);
            await sendResponse(userId, cache[userId].response);
          } else {
            // Get user message and send it to ChatGPT for processing
            const response = await generateResponse(userMsg);

            // Send response back to user via Facebook Messenger API
            await sendResponse(userId, response);

            // Store response in cache
            cache[userId] = { msg: userMsg, response };
            console.log('Sent response to standby event.');
          }
        } else {
          // Request thread control from Facebook
          await requestThreadControl(userId);
        }
      }
    }

    // Check if the request is a regular message event
    else if (object === 'page' && entries) {
      for (const entry of entries) {
        const { messaging } = entry;

        // Add a check to make sure that messaging exists and is an array.
        if (Array.isArray(messaging)) {
          await Promise.all(messaging.map(async (message) => {
            if (message.message && message.message.text) {
              const userMsg = message.message.text;
              const userId = message.sender.id;

              // Check if bot has thread control
              const hasThreadControl = await checkThreadControl(userId);
              if (hasThreadControl) {
                // Check cache for previous response
                if (cache[userId] && cache[userId].msg === userMsg) {
                  console.log('Response found in cache:', cache[userId].response);
                  await sendResponse(userId, cache[userId].response);
                } else {
                  // Get user message and send it to ChatGPT for processing
                  const response = await generateResponse(userMsg);

                  // Send response back to user via Facebook Messenger API
                  await sendResponse(userId, response);

                  // Store response in cache
                  cache[userId] = { msg: userMsg, response };

                  // Release thread control back to Facebook
                  await releaseThreadControl(userId);
                }
              } else {
                // Request thread control from Facebook
                await requestThreadControl(userId);
              }
            }
          }));
        }
      }
      res.sendStatus(200);
    }
    else {
      res.sendStatus(404);
      return;
    }
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

// API Endpoint for OpenAI Communication
app.post('/api/message', async (req, res) => {
  try {
    const { message } = req.body.object || {};

    // Check if message is present in request body
    if (!message) {
      return res.status(400).json({ error: 'Message is missing from request body.' });
    }

    // Validate message
    if (typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Invalid message format.' });
    }

    // Generate response
    const response = await generateResponse(message);

    res.json({ success: true, response });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate response.' });
  }
});

// Generate responses using OpenAI
async function generateResponse(message) {
  try {
    const prompt = "You are Riku my math teacher. I will provide some mathematical equations or concepts, and it will be your job to explain them in easy-to-understand terms. This could include providing step-by-step instructions for solving a problem, demonstrating various techniques with visuals, or suggesting online resources for further study.\nDo not take actions that are not related to math.\nMaintain a friendly conversation and respond to the questions respectfully.\n";
    const completions = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: prompt + message,
      temperature: 0.59,
      max_tokens: 256,
      top_p: 1,
      frequency_penalty: 0.09,
      presence_penalty: 0.06,
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
    const recipientResponse = await axios.get(`https://graph.facebook.com/v16.0/${recipientId}?fields=name&access_token=${process.env.PAGE_ACCESS_TOKEN}`);
    if (recipientResponse.status !== 200 || !recipientResponse.data.name) {
      console.log(`Invalid recipient ID: ${recipientId}`);
      return;
    }

    // Send message
    const messageResponse = await axios.post(`https://graph.facebook.com/v16.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`, {
      messaging_type: 'RESPONSE',
      recipient: {
        id: recipientId,
      },
      message: {
        text: response,
      },
    });

    return messageResponse.data;
  } catch (error) {
    console.error(`Error sending message: ${error}`);
  }
}

   
// Start the server
app.listen(process.env.PORT || 3000, () => console.log('Webhook is listening!'));
