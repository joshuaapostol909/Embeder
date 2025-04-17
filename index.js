const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const { spawn } = require("child_process");

app.use(express.json());

const requestCounts = {};
const TIME_WINDOW = 15 * 1000;
const MAX_REQUESTS = 20;

app.use((req, res, next) => {
    const ip = req.ip;

    if (!requestCounts[ip]) {
        requestCounts[ip] = { count: 1, startTime: Date.now() };
    } else {
        requestCounts[ip].count += 1;
    }

    const currentTime = Date.now();
    const timeDiff = currentTime - requestCounts[ip].startTime;

    if (timeDiff > TIME_WINDOW) {
        requestCounts[ip] = { count: 1, startTime: currentTime };
    }

    if (requestCounts[ip].count > MAX_REQUESTS) {
        return res.status(403).send('Forbidden: Too many requests, potential DDoS detected.');
    }

    next();
});

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.post('/generate-embed', (req, res) => {
    const { url, title } = req.body;
    const embedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body, html {
            margin: 0;
            padding: 0;
            height: 100%;
            overflow: hidden;
            font-family: Arial, sans-serif;
        }
        iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: none;
        }
    </style>
</head>
<body>
    <script>
        // Obfuscating the URL to make it less readable
        const obfuscatedUrl = "${Buffer.from(url).toString('base64')}";
        const decodedUrl = atob(obfuscatedUrl);
        document.write('<iframe src="' + decodedUrl + '" title="${title}"></iframe>');
    </script>
</body>
</html>`;

    const encodedHtml = Buffer.from(embedHtml).toString('base64');
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body>
    <script>
        document.write(atob('${encodedHtml}'));
    </script>
</body>
</html>`;

    const fileName = `${title.toLowerCase().replace(/\s+/g, '-')}.html`;
    const filePath = path.join(__dirname, 'public', fileName);

    fs.writeFile(filePath, htmlContent, (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Failed to generate embed file.' });
        }
        return res.json({ success: true, filePath: `/${fileName}` });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
