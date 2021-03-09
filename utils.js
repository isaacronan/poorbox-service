const http = require('http');

const post = (url, body) => new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
        res.on('error', reject);
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
});

const getRandomData = (schema) => {
    return post(`${process.env.RANDOM_SERVICE}/data`, schema);
};

const rateLimitMiddleware = (interval, limit) => {
    const requestCounts = {};
    const INTERVAL = interval;
    const LIMIT = limit;

    return ({ ip }, res, next) => {
        if (requestCounts[ip] >= LIMIT) {
            res.status(429).json({ error: 'Rate limit reached.' });
        } else {
            if (!requestCounts[ip]) {
                setTimeout(() => {
                    delete requestCounts[ip];
                }, INTERVAL);
            }
            requestCounts[ip] = (requestCounts[ip] || 0) + 1;
            next();
        }
    };
};

module.exports = { getRandomData, rateLimitMiddleware };