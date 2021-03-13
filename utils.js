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
    return post(`${process.env.RANDOM_SERVICE}/config`, schema);
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

const ARRAY_POTENTIAL_MAX = 10000;
function getArrayPotential(config) {
    switch (config.type) {
        case 'multi':
            return config.values.reduce((acc, { value }) => {
                return Math.max(getArrayPotential(value), acc);
            }, 0);
        case 'array':
            return config.maxlength * Math.max(getArrayPotential(config.value), 1);
        case 'object':
            return config.fields.reduce((acc, { value }) => {
                return acc + getArrayPotential(value);
            }, 0);
        default:
            return 0;
    }
};

module.exports = { getRandomData, rateLimitMiddleware, getArrayPotential, ARRAY_POTENTIAL_MAX };