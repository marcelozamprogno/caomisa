const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API Mock endpoints
app.get('/api/products', (req, res) => {
  const filePath = path.join(__dirname, 'api_products.json');
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  res.status(404).json({ ok: false, message: 'Products JSON not found' });
});

app.get('/api/banners', (req, res) => {
  const filePath = path.join(__dirname, 'api_banners.json');
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  res.status(404).json({ ok: false, message: 'Banners JSON not found' });
});

app.get('/api/site-content', (req, res) => {
  const filePath = path.join(__dirname, 'api_site_content.json');
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  res.status(404).json({ ok: false, message: 'Site content JSON not found' });
});

app.get('/api/collections', (req, res) => {
  const filePath = path.join(__dirname, 'api_collections.json');
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  res.status(404).json({ ok: false, message: 'Collections JSON not found' });
});

// Mock POST/PUT/DELETE API endpoints to avoid front-end errors
app.all('/api/*', (req, res) => {
  res.json({ ok: true, message: 'Mocked API response success' });
});

// Serve static files from root and assets directories
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(express.static(__dirname));

// SPA Routing fallback: Redirect any path without file extension to index.html
app.get('*', (req, res, next) => {
  // If request contains an extension (e.g. .png, .js, .css), pass it through
  if (path.extname(req.path)) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`==========================================================`);
  console.log(`   Local Web Server running successfully for Caomisa Shop`);
  console.log(`   Access it at: http://localhost:${PORT}/`);
  console.log(`==========================================================`);
});
