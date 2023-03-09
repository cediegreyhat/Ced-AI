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
            if (message.message && !message.message.is_echo) {
              // Get user message and send it to ChatGPT for processing
              const response = await generateResponse(message.message.text);
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

// Generate a response using OpenAI
async function generateResponse(message) {
  try {
    const prompt = "You are Riku my math teacher. I will provide some mathematical equations or concepts, and it will be your job to explain them in easy-to-understand terms. This could include providing step-by-step instructions for solving a problem, demonstrating various techniques with visuals or suggesting online resources for further study.\nDo not take actions that is not related to math.\n";
    const completions = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: prompt + message,
      temperature: 0.4,
      max_tokens: 256,
      top_p: 1,
      frequency_penalty: 0.37,
      presence_penalty: 0.33,
    });

    if (!completions || completions.status !== 200 || !completions.data || !completions.data.choices) {
      console.log('OpenAI API response:', completions);
      throw new Error('Failed to generate response.');
    }

    const responseText = completions.data.choices[0].text.trim();

    console.log('Generated response:', responseText);

    return responseText;
  } catch (error) {
    console.error(`Failed to generate response for message "${message}":`, error);
    return "Sorry, I couldn't understand your message. Could you please try rephrasing it?";
  }
}



// Keep track of conversations
const conversations = {};

// Send initial response to user
async function sendInitialResponse(recipientId) {
  const response = 'Hello! How can I assist you today?';
  await sendResponse(recipientId, response);
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
    console.error(`Failed to send response to ${recipientId}:`, error);
  }
}

// Handle incoming messages from user
async function handleIncomingMessage(event) {
  const recipientId = event.sender.id;
  const message = event.message.text;

  // Check if this is a new conversation
  if (!conversations[recipientId]) {
    await sendInitialResponse(recipientId);
  }

  // Handle different message types
  if (message.toLowerCase().includes('help')) {
    const response = 'I can help you with the following:\n1. Get technical support by emailing us in "delossantos.lhordcedrick040505@gmail.com"';
    await sendResponse(recipientId, response);
  } else if (message.toLowerCase().includes('schedule appointment')) {
    const response = 'Great! When would you like to schedule your appointment?';
    await sendResponse(recipientId, response);
  } else if (message.toLowerCase().includes('product information')) {
    const response = 'Riku AI is a chatbot designed to teach and help students about Mathematics';
    await sendResponse(recipientId, response);
  } else if (message.toLowerCase().includes('technical support')) {
    const response = 'You can contact Tech Support via "Email:delossantos.lhordcedrick040505@gmail.com"';
    await sendResponse(recipientId, response);
  } else {
    const response = 'I\'m sorry, I didn\'t understand what you said. Can you please try again or type "help" for a list of things I can help you with?';
    await sendResponse(recipientId, response);
  }

  // Store the message in the conversation history
  conversations[recipientId] = conversations[recipientId] || [];
  conversations[recipientId].push(message);
}

// Handle message deletions
async function handleDeletion(event) {
  const recipientId = event.recipient.id;
  const messageId = event.timestamp;
  
  // Check if this conversation exists
  if (conversations[recipientId]) {
    // Find the index of the deleted message in the conversation history
    const messageIndex = conversations[recipientId].indexOf(messageId);
    if (messageIndex !== -1) {
      // Remove the deleted message from the conversation history
      conversations[recipientId].splice(messageIndex, 1);
    }
  } else {
    // If the conversation doesn't exist, start a new one
    await sendInitialResponse(recipientId);
  }
}

// Handle incoming events from Facebook Messenger API
async function handleEvent(event) {
  if (event.message) {
    await handleIncomingMessage(event);
  } else if (event.message_deletions) {
    await handleDeletion(event);
  } else {
    console.log('Unknown event:', event);
  }
}

// Start the server
app.listen(process.env.PORT || 3000, () => console.log('Webhook is listening!'));
