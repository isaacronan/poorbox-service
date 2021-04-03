require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const redis = require('redis');
const { promisify } = require('util');

const { valueSchema } = require('./schemae');
const { getRandomData, rateLimitMiddleware, getArrayPotential, ARRAY_POTENTIAL_MAX } = require('./utils');

const ssr = require('./ssr/poorbox-ssr');
const template = fs.readFileSync(path.resolve(__dirname, './ssr/poorbox.html')).toString();
const render = () => {
    const { head, html } = ssr.render();
    const rendered = template.replace('</head>', `${head}</head>`)
        .replace('<body>', `<body>${html}`);
    return rendered;
};

const app = express();
const apiRouter = express.Router();
const PORT = 8010;
const BASEPATH = '/poorbox';

const client = redis.createClient({
    host: process.env.STORE_HOST,
    port: Number(process.env.STORE_PORT),
    retry_strategy: () => 1000
});

const EXPIRATION = (Number(process.env.EXPIRATION) || 60);

app.set('trust proxy', true);
app.use(express.json());
app.use(BASEPATH, express.static('static', { redirect: false }));
app.use(`${BASEPATH}/api`, apiRouter);

app.get(BASEPATH, (_, res) => {
    res.send(render());
});

apiRouter.post('/test', rateLimitMiddleware(10000, 30), (req, res, next) => {
    const isValid = valueSchema.isValidSync(req.body);
    if (isValid) {
        const potential = getArrayPotential(req.body);
        if (potential > ARRAY_POTENTIAL_MAX) {
            res.status(400).json({ error: `Reduce max array lengths or array nesting. Potential item count may not exceed ${ARRAY_POTENTIAL_MAX}.` });
        } else {
            getRandomData(req.body).then(data => {
                res.json(data);
            }).catch(next);
        }
    } else {
        res.status(400).json({ error: 'Format is invalid.' });
    }
});

apiRouter.post('/config', async (req, res) => {
    const isValid = valueSchema.isValidSync(req.body);
    if (isValid) {
        const potential = getArrayPotential(req.body);
        if (potential > ARRAY_POTENTIAL_MAX) {
            res.status(400).json({ error: `Reduce max array lengths or array nesting. Potential item count may not exceed ${ARRAY_POTENTIAL_MAX}.` });
        } else {
            let id = null;
            do {
                id = crypto.randomBytes(4).toString('hex')
            } while(await promisify(client.exists).call(client, `pb:endpoint:${id}`));

            const multi = client.multi()
                .set(`pb:endpoint:${id}`, JSON.stringify(req.body))
                .expire(`pb:endpoint:${id}`, EXPIRATION)
            await promisify(multi.exec).call(multi);

            res.json({ message: 'Created endpoint.', url: `${BASEPATH}/api/${id}`, expiration: EXPIRATION, id });
        }
    } else {
        res.status(400).json({ error: 'Format is invalid.' });
    }
});

apiRouter.delete('/config/:id', async (req, res) => {
    if (await promisify(client.del).call(client, `pb:endpoint:${req.params.id}`)) {
        res.json({ message: 'Deleted endpoint.' })
    } else {
        res.status(404).json({ error: 'Endpoint not found.' });
    }
});

apiRouter.get('/config/:id', async (req, res) => {
    const id = req.params.id;
    const multi = client.multi()
        .get(`pb:endpoint:${id}`)
        .ttl(`pb:endpoint:${id}`)
    const [endpoint, expiration] = await promisify(multi.exec).call(multi);
    if (endpoint) {
        const schema = JSON.parse(endpoint);
        res.json({ message: 'Found endpoint.', url: `${BASEPATH}/api/${id}`, expiration, id, schema });
    } else {
        res.status(404).json({ error: 'Endpoint not found.' });
    }
});

apiRouter.get('/:id', cors(), rateLimitMiddleware(10000, 10), async (req, res, next) => {
    const id = req.params.id;
    const multi = client.multi()
        .get(`pb:endpoint:${id}`)
        .expire(`pb:endpoint:${id}`, EXPIRATION)
    const [endpoint] = await promisify(multi.exec).call(multi);
    if (endpoint) {
        const schema = JSON.parse(endpoint);
        getRandomData(schema).then(data => {
            res.json(data);
        }).catch(next);
    } else {
        res.status(404).json({ error: 'Endpoint not found.' });
    }
});

app.use((_req, res) => {
    res.status(404).send({ error: 'Route not found.' });
});

apiRouter.use((_err, _req, res, _next) => {
    res.status(500).send({ error: 'Server error encountered.' });
});

app.listen(PORT, () => {
    console.log(`listening on port ${PORT}...`);
});