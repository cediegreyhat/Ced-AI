// Import dependencies and set up http server
const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const config = require("./config");
const app = express().use(bodyParser.json());

// Create the endpoint for your webhook
app.post("/webhook", (req, res) => {
  let body = req.body;

  console.log(`Received webhook:`);
  console.dir(body, { depth: null });

  // Verify that the callback came from Facebook.
  try {
    verifyRequestSignature(req, res, body);
  } catch (error) {
    console.error(error);
    res.sendStatus(403);
    return;
  }

  // Send a 200 OK response if this is a page webhook
  if (body.object === "page") {
    res.status(200).send("EVENT_RECEIVED");

    // Determine which webhooks were triggered and get sender PSIDs and locale, message content and more.
    let webhook_event = body.entry[0].messaging[0];
    console.log(webhook_event);
  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
});

// Add support for GET requests to our webhook
app.get("/messaging-webhook", (req, res) => {
  // Parse the query params
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  // Check if a token and mode is in the query string of the request
  if (mode && token) {
    // Check the mode and token sent is correct
    if (mode === "subscribe" && token === config.verifyToken) {
      // Respond with the challenge token from the request
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Respond with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});

//Server Listener
const port = process.env.PORT || 3000;

async function startServer() {
  try {
    await app.listen(port);
    console.log(`Server listening on port ${port}`);
  } catch (err) {
    console.error(`Error starting server: ${err.message}`);
    process.exit(1);
  }
}

startServer();


// Verify that the callback came from Facebook.
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature-256"];

  if (!signature) {
    console.warn(`Couldn't find "x-hub-signature-256" in headers.`);
  } else {
    var elements = signature.split("=");
    var signatureHash = elements[1];
    var expectedHash = crypto
      .createHmac("sha256", config.appSecret)
      .update(buf)
      .digest("hex");
    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}
