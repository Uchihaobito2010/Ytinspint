const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pinRouter = require('./api/pin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', pinRouter);

app.get('/', (req, res) => {
  res.json({ message: 'Pinterest Downloader API is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
