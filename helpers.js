const { verifyRequestSignature } = require('./helpers');

app.use(express.json({ verify: verifyRequestSignature }));
