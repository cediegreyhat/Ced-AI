const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const config = require('./config');

const app = express();

// Sets server port and logs message on success
app.listen(process.env.PORT || 3000, () => {
    console.log('Webhook server is listening, port 3000');
});

// Accepts POST requests at /webhook endpoint
app.post('/webhook', (req, res) => {
    // Parse the request body from the POST
    let body = req.body;

    // Check the webhook event is from a Page subscription
    if (body.object === 'page') {
        // Iterate over each entry - there may be multiple if batched
        body.entry.forEach(function(entry) {
            // Get the webhook event. entry.messaging is an array, but
            // will only ever contain one event, so we get index 0
            let webhook_event = entry.messaging[0];
            console.log(webhook_event);
        });

        // Return a '200 OK' response to all events
        res.status(200).send('EVENT_RECEIVED');
    } else {
        // Return a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }
});

// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {
    // Parse the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    // Check if a token and mode were sent
    if (mode && token) {
        // Check the mode and token sent are correct
        if (mode === 'subscribe' && token === config.verifyToken) {
            // Respond with 200 OK and challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            // Respond with 403 Forbidden if verify tokens do not match
            res.sendStatus(403);
        }
    }
});

// Verify that the callback came from Facebook
function verifyRequestSignature(req, res, buf) {
    let signature = req.headers['x-hub-signature'];

    if (!signature) {
        console.error("Couldn't validate the signature.");
    } else {
        let elements = signature.split('=');
        let signatureHash = elements[1];

        let expectedHash = crypto.createHmac('sha1', config.appSecret)
            .update(buf)
            .digest('hex');

        if (signatureHash !== expectedHash) {
            throw new Error("Couldn't validate the request signature.");
        }
    }
}

// Use body-parser middleware to parse request body
app.use(bodyParser.json({
    verify: verifyRequestSignature,
}));
