const fs = require('fs');

const request = require('request');
const util = require('util');
const get = util.promisify(request.get);
const post = util.promisify(request.post);

// const API_URL_QR = 'https://api.lovense.com/api/lan/getQrCode';
// const API_URL_COMMAND = 'https://api.lovense.com/api/lan/v2/command';
const API_URL_QR = 'https://api.lovense-api.com/api/lan/getQrCode';
const API_URL_COMMAND = 'https://api.lovense-api.com/api/lan/v2/command';

const REFRESH_TIME = 30;

class ToyController {
    BASE_REQ = { token: process.env.LOVENSE_DEVELOPER_TOKEN };
    users = { uIDs: () => Object.keys(this.users).filter(key => /^\d+$/.test(key)) }
    toyCount = null;

    constructor() {
        try {
            const raw = fs.readFileSync('./users.json', 'utf8');
            let jsonRaw = JSON.parse(raw);
            for (let uID of Object.keys(jsonRaw)) {
                this.users[uID] = jsonRaw[uID];
            }
        } catch (e) { }
    }

    updateActivity() {
        let toyCount = this.getToys().length;

        if (toyCount !== this.toyCount) {
            let playing = `with ${toyCount == 0 ? 'no' : toyCount} ${toyCount == 1 ? 'toy' : 'toys'}`;
            console.log(`[Discord] Toy count is now ${toyCount}, was ${this.toyCount}. Updating presence.`);
            this.toyCount = toyCount;
            return playing;
        } else { return null; }
    }

    async getConnectionQr({ uID }) {
        const req = {
            token: this.BASE_REQ.token, apiVer: '2',
            uid: uID,
        }

        try {
            const response = await post({ url: API_URL_QR, json: true, body: req });
            if (!response.body.result) { throw response.body.message; }

            return response.body.message;
        } catch (error) {
            console.error('Error:', error);
            return null;
        }
    }

    async addUser(uID, user) {
        // console.log('addUser', uID, user);

        if (!this.users[uID]) {
            console.log(`[Toy Controller] Added new user with UID ${uID}`);
        }

        user.lastUpdated = Math.round(Date.now() / 1000);
        this.users[uID] = user;
        this._save();
    }

    getToys() {
        this._refresh();

        let toys = [];
        for (let uID of this.users.uIDs()) {
            let user = this.users[uID];
            for (let key of Object.keys(user.toys)) {
                toys.push(user.toys[key]);
            }
        }
        return toys;
    }

    async stop(uID) {
        return this._function({ action: 'Stop', uID, strength: 0, duration: 0 });
    }

    async apiPost(req, url = API_URL_COMMAND) {
        try {
            const response = await post({
                url, json: true,
                body: req, timeout: 5000  // 5 seconds timeout
            });

            // console.log(response.body);
            return response.statusCode == 200;
        } catch (error) {
            console.error('Error:', error);
            return false;
        }
    }

    async pattern({ uID = null, pattern = "20;20;5;20;10" }) {
        this._refresh();
        if (!uID || !this.users.uIDs().includes(uID)) { return false; };

        console.log('[Lovense API] pattern', uID, pattern);

        const req = {
            token: this.BASE_REQ.token, apiVer: '2',
            uid: uID,
            command: 'Pattern',
            rule: "V:1;F:v;S:100#",
            strength: pattern,
            timeSec: 0
        }

        let url = `https://${this.users[uID].domain}:${this.users[uID].httpsPort}/command`;
        return (await this.apiPost(req)) ? pattern : false;
    }

    async preset({ uID = null, pattern }) {
        this._refresh();
        if (!uID || !this.users.uIDs().includes(uID)) { return false; };

        console.log('[Lovense API] preset', uID, pattern);

        const req = {
            token: this.BASE_REQ.token, apiVer: '2',
            uid: uID,
            command: 'Preset',
            name: pattern,
            timeSec: 0
        }

        let url = `https://${this.users[uID].domain}:${this.users[uID].httpsPort}/command`;
        return (await this.apiPost(req)) ? pattern : false;
    }

    // Vibrate:0 ~ 20
    // Rotate: 0~20
    // Pump:0~3
    // Thrusting:0~20
    // Fingering:0~20
    // Suction  :0~20
    async vibrate({ uID = null, strength = 10, duration = 10 }) { return this._function({ action: 'Vibrate', uID, strength, duration }); }
    async rotate({ uID = null, strength = 10, duration = 10 }) { return this._function({ action: 'Rotate', uID, strength, duration }); }
    async pump({ uID = null, strength = 2, duration = 10 }) { return this._function({ action: 'Pump', uID, strength, duration }); }
    async thrusting({ uID = null, strength = 10, duration = 10 }) { return this._function({ action: 'Thrusting', uID, strength, duration }); }
    async fingering({ uID = null, strength = 10, duration = 10 }) { return this._function({ action: 'Fingering', uID, strength, duration }); }
    async suction({ uID = null, strength = 10, duration = 10 }) { return this._function({ action: 'Suction', uID, strength, duration }); }

    async _function({ action, uID, strength = 10, duration = 10 }) {
        this._refresh();
        if (!uID || !this.users.uIDs().includes(uID)) { return false; };

        console.log('[Lovense API] _function', action, uID, strength, duration);

        if (strength > 0) { action = `${action}:${strength}`; }

        const req = {
            token: this.BASE_REQ.token, apiVer: '1',
            uid: uID,
            command: 'Function',
            action: action,
            timeSec: duration
        }

        let url = `https://${this.users[uID].domain}:${this.users[uID].httpsPort}/command`;
        return (await this.apiPost(req));
    }

    _refresh() {
        const now = Math.round(Date.now() / 1000);
        let changed = false;
        for (let uID of this.users.uIDs()) {
            let lastUpdated = this.users[uID].lastUpdated;

            if (lastUpdated < now - REFRESH_TIME) {
                delete this.users[uID];
                changed = true;
            }
        }

        if (changed) { this._save(); }
    }

    _save() {
        fs.writeFileSync('./users.json', JSON.stringify(this.users, null, 2));
    }

}

module.exports = ToyController;
