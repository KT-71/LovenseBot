const fs = require('fs');
const path = require('path');

const Callbacks = require('./Lovense_Callbacks.js');

const request = require('request');
const util = require('util');
const get = util.promisify(request.get);
const post = util.promisify(request.post);

// const API_URL_QR = 'https://api.lovense.com/api/lan/getQrCode';
// const API_URL_COMMAND = 'https://api.lovense.com/api/lan/v2/command';
const API_URL_QR = 'https://api.lovense-api.com/api/lan/getQrCode';
const API_URL_COMMAND = 'https://api.lovense-api.com/api/lan/v2/command';

const REFRESH_TIME = 30000;

const ngrok = require("@ngrok/ngrok");
ngrok.authtoken(process.env.NGROK_AUTHTOKEN)
    .then(async () => {
        const listener = await ngrok.forward({ addr: process.env.PORT, authtoken_from_env: true });
        console.log(`[Ngrok] Ingress established at:\n${listener.url()}\n`);
        console.log(`[Ngrok] Please set callback url at:\nhttps://ja.lovense.com/user/developer/info\n`);
    });

class CsvController {
    uID = null;
    patternList = [];   // [{ time, power }...]
    index = 0;

    constructor(uID, patternList) {
        this.uID = uID;
        this.patternList = patternList;
    }

    interval = null;
    startTime = 0;
    offsetTime = 0;

    play() {
        this.startTime = Date.now();

        this.interval = setInterval(() => this.tick(), 10);
    }

    async tick() {
        const p = this.patternList[this.index];
        if (!p) { return; }

        // get this tick time in ds
        const thisTickTime = Date.now();
        const nextPatternTime = this.startTime + p.time + this.offsetTime;

        if (nextPatternTime <= thisTickTime) {
            ++this.index;

            if (p.power <= 0.01) {
                toyController.stop({ uID: this.uID });
            } else {
                toyController.vibrate({ uID: this.uID, strength: p.power, duration: 0 });
            }

            if (this.index >= this.patternList.length) { await sleep(1000); this.stop(); }
        }
    }

    stop() {
        if (!this.interval) {
            clearInterval(this.interval);
        }
    }
}



class ToyController {
    BASE_REQ = { token: process.env.LOVENSE_DEVELOPER_TOKEN };
    users = {}
    uIDs = () => Object.keys(this.users).filter(key => /^\d+$/.test(key))
    toyCount = null;
    csvController = {};

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

    async addUser({ uID, user }) {
        // console.log('addUser', uID, user);

        if (!this.users[uID]) {
            console.log(`[Toy Controller] Added new user with UID ${uID}`);
        }

        user.lastUpdated = Date.now();
        this.users[uID] = user;
        this._save();
    }

    getToys() {
        this._refresh();

        let toys = [];
        for (let uID of this.uIDs()) {
            let user = this.users[uID];
            for (let key of Object.keys(user.toys)) {
                toys.push(user.toys[key]);
            }
        }
        return toys;
    }

    async stop({ uID }) {
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

    async pattern({ uID = null, pattern = "20;20;5;20;10", length = 100 }) {
        this._refresh();
        if (!uID || !this.uIDs().includes(uID)) { return false; };

        console.log('[Lovense API] pattern', uID, pattern, length);

        const req = {
            token: this.BASE_REQ.token, apiVer: '2',
            uid: uID,
            command: 'Pattern',
            rule: `V:1;F:v;S:${length}#`,
            strength: pattern,
            timeSec: 0
        }

        let url = `https://${this.users[uID].domain}:${this.users[uID].httpsPort}/command`;
        return (await this.apiPost(req)) ? pattern : false;
    }

    async preset({ uID = null, preset }) {
        this._refresh();
        if (!uID || !this.uIDs().includes(uID)) { return false; };

        console.log('[Lovense API] preset', uID, preset);

        const req = {
            token: this.BASE_REQ.token, apiVer: '2',
            uid: uID,
            command: 'Preset',
            name: preset,
            timeSec: 0
        }

        let url = `https://${this.users[uID].domain}:${this.users[uID].httpsPort}/command`;
        return (await this.apiPost(req)) ? preset : false;
    }

    // Vibrate:   0 ~ 20
    // Rotate:    0 ~ 20
    // Pump:      0 ~  3
    // Thrusting: 0 ~ 20
    // Fingering: 0 ~ 20
    // Suction  : 0 ~ 20
    async vibrate({ uID = null, strength = 10, duration = 10 }) { return this._function({ action: 'Vibrate', uID, strength, duration }); }
    async rotate({ uID = null, strength = 10, duration = 10 }) { return this._function({ action: 'Rotate', uID, strength, duration }); }
    async pump({ uID = null, strength = 2, duration = 10 }) { return this._function({ action: 'Pump', uID, strength, duration }); }
    async thrusting({ uID = null, strength = 10, duration = 10 }) { return this._function({ action: 'Thrusting', uID, strength, duration }); }
    async fingering({ uID = null, strength = 10, duration = 10 }) { return this._function({ action: 'Fingering', uID, strength, duration }); }
    async suction({ uID = null, strength = 10, duration = 10 }) { return this._function({ action: 'Suction', uID, strength, duration }); }

    async _function({ action, uID, strength = 10, duration = 10 }) {
        this._refresh();
        if (!uID || !this.uIDs().includes(uID)) { return false; };

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








    async csvPattern({ uID = null, filepath = null }) {
        this._refresh();
        if (!uID || !this.uIDs().includes(uID)) { return false; };

        // read pattern file
        const raw = fs.readFileSync(filepath, 'utf8');
        const lines = raw.split(/\r?\n/);
        const pattern = [];
        let oldVersion = false; // time in sec
        for (const _line of lines) {
            let line = `${_line}`;

            const regex = /([\d\.]+),([\d\.]+)$/;
            if (regex.test(line)) {
                // match
                const [, time, power] = line.match(regex);
                if (!oldVersion && time.includes('.')) { oldVersion = true; }
                pattern.push({ time, power: (power / 10) });    // csv power: 0 ~ 200, API power: 0 ~ 20
            }
        }

        let timeSec = null;
        // format time value to decisecond
        for (let p of pattern) {
            // if is old version csv time is sec, if not, is ds. csv time: sec/ds, tick time: ms
            p.time = parseInt(oldVersion ? p.time * 1000 : p.time * 100);
            timeSec = parseInt(p.time / 1000);
        }

        let timeHrs = parseInt(timeSec / 3600);
        let timeMin = parseInt(timeSec / 60) % 60;
        timeSec = timeSec % 60;
        timeHrs = timeHrs ? `${timeHrs}:` : '';
        timeMin = timeMin ? `${timeHrs ? timeMin.toString().padStart(2, '0') : timeMin}:` : '';
        timeSec = timeSec ? `${timeMin ? timeSec.toString().padStart(2, '0') : timeSec}` : '';

        let timeStr = timeHrs + timeMin + timeSec;
        let result = `${path.basename(filepath)} ${timeStr}`;
        console.log('[Lovense API] csv pattern', uID, result);
        result = (await this.stop({ uID })) ? result : false;

        if (result) {
            // found user toys, set csv controller
            if (this.csvController[uID]) {
                this.csvController[uID].stop();
                delete this.csvController[uID];
            }
            this.csvController[uID] = new CsvController(uID, pattern);
            this.csvController[uID].play();
        }

        return result;
    }
    async csvOffset({ uID = null, add = 100 }) {
        if (this.csvController[uID]) {
            this.csvController[uID].offsetTime += add;
        }
    }
    async csvStop({ uID = null }) {
        if (this.csvController[uID]) {
            this.csvController[uID].stop();
            delete this.csvController[uID];
        }
    }


    _refresh() {
        const now = Date.now();
        let changed = false;
        for (let uID of this.uIDs()) {
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

const toyController = new ToyController();
// init callback server
const callbacks = new Callbacks(toyController);
callbacks.webserver();

module.exports = toyController;