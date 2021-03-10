require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

const { valueSchema } = require('./schemae');
const { getRandomData, rateLimitMiddleware } = require('./utils');

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

const EXPIRATION = 1000 * (Number(process.env.EXPIRATION) || 60);

const endpoints = [];
const resetEndpointInterval = (id) => {
    const endpoint = getEndpoint(id);
    clearTimeout(endpoint.timeoutID);
    endpoint.timeoutID = setTimeout(() => deleteEndpoint(id), EXPIRATION);
};
const deleteEndpoint = (id) => {
    const index = getEndpointIndex(id);
    if (index === -1) {
        return null;
    } else {
        clearTimeout(endpoints[index].timeoutID);
        endpoints.splice(index, 1);
        return id;
    }
};
const getEndpointIndex = (id) => endpoints.findIndex((endpoint) => endpoint.id === id);
const getEndpoint = (id) => endpoints[getEndpointIndex(id)] || null;

app.use(express.json());
app.use(BASEPATH, express.static('static', { redirect: false }));
app.use(`${BASEPATH}/api`, apiRouter);

app.get(BASEPATH, (_, res) => {
    res.send(render());
});

apiRouter.post('/test', (req, res) => {
    const isValid = valueSchema.isValidSync(req.body);
    if (isValid) {
        getRandomData(req.body).then(data => {
            res.json(data);
        }).catch(console.log);
    } else {
        res.status(400).json({ error: 'Format is invalid.' });
    }
});

apiRouter.post('/config', (req, res) => {
    const isValid = valueSchema.isValidSync(req.body);
    if (isValid) {
        let id = null;
        do {
            id = crypto.randomBytes(4).toString('hex')
        } while(endpoints.findIndex((endpoint) => endpoint.id === id) !== -1);
        endpoints.push({ schema: req.body, id });
        resetEndpointInterval(id);
        res.json({ message: 'Created endpoint.', url: `${BASEPATH}/api/${id}`, expiration: EXPIRATION / 1000, id });
    } else {
        res.status(400).json({ error: 'Format is invalid.' });
    }
});

apiRouter.delete('/config/:id', (req, res) => {
    if (deleteEndpoint(req.params.id)) {
        res.json({ message: 'Deleted endpoint.' })
    } else {
        res.status(404).json({ error: 'Endpoint not found.' });
    }
});

apiRouter.get('/config/:id', (req, res) => {
    const endpoint = getEndpoint(req.params.id);
    if (endpoint) {
        const { id, schema } = endpoint;
        res.json({ message: 'Found endpoint.', url: `${BASEPATH}/api/${id}`, expiration: EXPIRATION / 1000, id, schema });
    } else {
        res.status(404).json({ error: 'Endpoint not found.' });
    }
});

apiRouter.get('/:id', cors(), rateLimitMiddleware(10000, 10), (req, res) => {
    const endpoint = getEndpoint(req.params.id);
    if (endpoint) {
        resetEndpointInterval(req.params.id);
        getRandomData(endpoint.schema).then(data => {
            res.json(data);
        }).catch(console.log);
    } else {
        res.status(404).json({ error: 'Endpoint not found.' });
    }
});

app.use((_req, res) => {
    res.status(404).send({ error: 'Route not found.' });
});

app.listen(PORT, () => {
    console.log(`listening on port ${PORT}...`);
});