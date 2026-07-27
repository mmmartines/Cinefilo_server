const fetch = require('node-fetch');
fetch('https://cinefilo-server.vercel.app/api/public?action=check-nickname&nickname=mmartines')
  .then(r=>r.text())
  .then(console.log);
