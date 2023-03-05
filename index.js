const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();
const { verifyRequestSignature } = require('./helpers');
const Configs = require('./Configs');

const app = express();
app.use(bodyParser.json());

const openaiClient = Configs.openaiClient;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/api/ai', (req, res) => {
  const question = req.query.q;

  openaiClient.complete({
    engine: 'text-davinci-002',
    prompt: question,
    maxTokens: 150,
    n: 1,
    stop: '\n',
  })
    .then((response) => {
      const answer = response.data.choices[0].text.trim();
      res.json({ answer });
    })
    .catch((error) => {
      console.log(error);
      res.status(500).json({ error });
    });
});

app.get('/webhook', (req, res) => {
  if (
    req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === Configs.fbVerifyToken
  ) {
    console.log('Validating webhook');
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error('Failed validation. Make sure the validation tokens match.');
    res.sendStatus(403);
  }
});

app.post('/webhook', (req, res) => {
  const data = req.body;

  if (!verifyRequestSignature(req.headers['x-hub-signature'], data)) {
    res.sendStatus(400);
    return;
  }

  if (data.object === 'page') {
    data.entry.forEach((entry) => {
      entry.messaging.forEach((event) => {
        if (event.message) {
          const message = event.message.text;
          console.log(`Received message: ${message}`);

          openaiClient.complete({
            engine: 'text-davinci-003',
            prompt: message,
            maxTokens: 150,
            n: 1,
            stop: '\n',
          })
            .then((response) => {
              const answer = response.data.choices[0].text.trim();
              console.log(`Answer: ${answer}`);
              const senderId = event.sender.id;
              const body = {
                recipient: { id: senderId },
                message: { text: answer },
              };
              axios.post(`https://graph.facebook.com/v12.0/me/messages?access_token=${Configs.fbAccessToken}`, body)
                .then(() => {
                  console.log('Message sent');
                })
                .catch((error) => {
                  console.log(error);
                });
            })
            .catch((error) => {
              console.log(error);
            });
        }
      });
    });
  }

  res.sendStatus(200);
});

const server = app.listen(Configs.port, () => {
  console.log(`Listening on port ${Configs.port}`);
});
