const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const crypto = require('crypto');

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

module.exports = {
  verifyRequestSignature,
};


// Use the body-parser middleware
app.use(bodyParser.json({ verify: verifyRequestSignature }));

app.post("/webhook", (req, res) => {
  // Use the parsed body here
  const body = req.body;

  // Check that the body is a webhook event
  if (body.object === "page") {
    // Iterate over each entry
    body.entry.forEach(entry => {
      // Iterate over each messaging event
      entry.messaging.forEach(event => {
        console.log(event);
      });
    });
    // Return a '200 OK' response to all events
    res.status(200).send("EVENT_RECEIVED");
  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
});

app.get("/webhook", (req, res) => {
  // Your verify token. Should be a random string.
  const VERIFY_TOKEN = "YOUR_VERIFY_TOKEN";

  // Parse the query params
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  // Check if a token and mode is in the query string of the request
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      // Respond with the challenge token from the request
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Respond with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});

app.listen(process.env.PORT || 3000, () => console.log("Webhook is listening"));

