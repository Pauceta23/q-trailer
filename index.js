const express = require('express');
const path = require('path');

const app = express();
const PORT = 80;

app.use(express.static(__dirname));

// Serve index.html from the root folder
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});