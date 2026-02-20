const express = require('express');
const cors = require('cors');
const path = require('path');
const analyzeRouter = require('./routes/analyze');

const app = express();
app.use(cors());

app.use(express.json());

app.use('/api', analyzeRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`PharmaGuard backend listening on port ${PORT}`);
});
