
const express = require('express');
const bodyParser = require('body-parser');

const CALLBACK_PORT = 8000;

class Callbacks {
    controller;
    server = null;

    constructor(controller) {
        this.controller = controller;
        this.server = null;
    }

    async webserver() {
        const port = process.env.PORT || CALLBACK_PORT;

        const app = express();
        app.use(bodyParser.json());

        const handler = async (req, res) => {
            if (req.body?.uid) {
                const body = req.body;
                // const pieces = body.uid.split(':');
                // this.controller.addUser(pieces[0], pieces[1], body);
                this.controller.addUser(body.uid, body);
            }
            res.json({ status: 'OK' });
        }

        app.get('/', handler);
        app.post('/', handler);

        this.server = app.listen(port, () => {
            console.log(`[Express] Server is listening on port ${port}`);
        });
    }

    async unload() {
        if (this.server) {
            await this.server.close();
        }
    }
}

module.exports = Callbacks;
