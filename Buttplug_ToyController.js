const fs = require('fs');
const path = require('path');

const request = require('request');
const util = require('util');
const get = util.promisify(request.get);
const post = util.promisify(request.post);

const Buttplug = require('buttplug');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

class CsvController {
    uID = null;
    patternList = [
        { time: -5000, power: 12 }, { time: -4800, power: 0 },
        { time: -4000, power: 12 }, { time: -3800, power: 0 },
        { time: -3000, power: 12 }, { time: -2800, power: 0 },
        { time: -2000, power: 12 }, { time: -1800, power: 0 },
        { time: -1000, power: 12 }, { time: -800, power: 0 },
        { time: 0, power: 20 }, { time: 600, power: 0 },
    ];   // [{ time: ms, power: 0-20 }...]
    index = 0;

    constructor(uID, patternList) {
        this.uID = uID;
        for (let p of patternList) {
            this.patternList.push(p);
        }
    }

    stopCsv = false;
    startTime = 0;
    offsetTime = 0;

    async playCsv() {
        this.startTime = Date.now() + 10000;

        for (let p of this.patternList) {

            // get next pattern time in ms
            const nextPatternTime = this.startTime + p.time + this.offsetTime;

            while (true) {
                // break by user called
                if (this.stopCsv) { break; }

                // get this tick time in ms
                const thisTickTime = Date.now();
                const sleepTime = nextPatternTime - thisTickTime;

                if (sleepTime <= 0) {

                    // over time, do this p
                    if (p.power <= 0.01) {
                        toyController.stop({ uID: this.uID });
                    } else {
                        toyController.vibrate({ uID: this.uID, strength: parseFloat(p.power / 20), duration: 0 });
                    }
                    break;  // break to next p
                } else if (sleepTime > 1000) {
                    await sleep(1000);
                } else {
                    await sleep(sleepTime > 5 ? sleepTime - 5 : sleepTime);
                }
            }
        }

        // all pattern done
    }

    stop() {
        this.stopCsv = true;
    }
}



class ToyController {
    users = {}
    uIDs = () => Object.keys(this.users).filter(key => /^\d+$/.test(key))
    toyCount = null;
    csvController = {};

    constructor() { }

    updateActivity() {
        let toyCount = this.getToys().length;

        if (toyCount !== this.toyCount) {
            let playing = `with ${toyCount == 0 ? 'no' : toyCount} ${toyCount == 1 ? 'toy' : 'toys'}`;
            console.log(`[Discord] Toy count is now ${toyCount}, was ${this.toyCount}. Updating presence.`);
            this.toyCount = toyCount;
            return playing;
        } else { return null; }
    }

    async getConnection({ uID, connect }) {

        const regIP = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?/;
        if (!regIP.test(connect)) { return null; }

        // get address
        const [, address, port] = connect.match(regIP);
        const fullAddress = `ws://${address}${port || ':12345'}`;

        // connect to server
        const client = new Buttplug.ButtplugClient("Buttplug Example Client");
        const connector = new Buttplug.ButtplugNodeWebsocketClientConnector(fullAddress);
        await client.connect(connector);

        await client.startScanning();

        this.addUser({ uID, user: { client, address } });
        return true;
    }

    async addUser({ uID, user }) {
        // console.log('addUser', uID, user);

        if (!this.users[uID]) {
            console.log(`[Toy Controller] Added new user with UID ${uID}`);
        }

        this.users[uID] = user;
    }

    getToys() {
        let toys = [];
        for (let uID of this.uIDs()) {
            let user = this.users[uID];
            for (let key of Object.keys(user.client.devices)) {
                toys.push(user.client.devices[key]);
            }
        }
        return toys;
    }

    async stop({ uID }) {
        const { client } = this.users[uID];
        if (client.devices.length == 0) { return false; }

        console.log('[Buttplug.io API] _function', uID, 'Stop');

        let res = false;
        for (const device of client.devices) {
            res = await device.stop().then(() => true).catch(e => e.message);
        }

        return res;
    }

    // Vibrate: 0 ~ 1.0
    // Rotate:  0 ~ 1.0
    async vibrate({ uID = null, strength = 1.0 }) { return this._function({ action: 'Vibrate', uID, strength }); }
    async rotate({ uID = null, strength = 1.0 }) { return this._function({ action: 'Rotate', uID, strength }); }

    async _function({ action, uID, strength = 1.0 }) {

        const { client } = this.users[uID];
        if (client.devices.length == 0) { return false; }

        console.log('[Buttplug.io API] _function', uID, action, strength);

        let res = false;
        for (const device of client.devices) {
            switch (action) {
                case 'Vibrate':
                    res = await device.vibrate(strength).then(() => true).catch(e => e.message);
                    break;
                case 'Rotate':
                    res = await device.rotate(strength).then(() => true).catch(e => e.message);
                    break;
            }
        }

        return res;
    }








    async csvPattern({ uID = null, filepath = null }) {
        if (!uID || !this.uIDs().includes(uID)) { return false; };

        // read pattern file
        const raw = fs.readFileSync(filepath, 'utf8');
        const lines = raw.split(/\r?\n/);
        const pattern = [];
        for (const _line of lines) {
            let line = `${_line}`;

            const regex = /([\d\.]+),([\d\.]+)$/;
            if (regex.test(line)) {
                // match
                const [, time, power] = line.match(regex);
                // csv decisecond time to ms
                // csv power: 0 ~ 20, patternList: 0 ~ 20, API power: 0 ~ 1.0
                pattern.push({ time: parseFloat(time * 100), power: parseFloat(power) });
            }
        }

        // format time value to 
        let timeSec = parseInt(pattern[pattern.length - 1].time / 1000);
        let timeHrs = parseInt(timeSec / 3600);
        let timeMin = parseInt(timeSec / 60) % 60;
        timeSec = timeSec % 60;
        timeHrs = timeHrs ? `${timeHrs}:` : '';
        timeMin = timeMin ? `${timeHrs ? timeMin.toString().padStart(2, '0') : timeMin}:` : '';
        timeSec = timeSec ? `${timeMin ? timeSec.toString().padStart(2, '0') : timeSec}` : '';

        let timeStr = timeHrs + timeMin + timeSec;
        let result = `${path.basename(filepath)} ${timeStr}`;
        console.log('[Buttplug.io API] csv pattern', uID, result);
        result = (await this.stop({ uID })) ? result : false;

        if (result) {
            // found user toys, set csv controller
            if (this.csvController[uID]) {
                this.csvController[uID].stop();
                delete this.csvController[uID];
            }
            this.csvController[uID] = new CsvController(uID, pattern);
            this.csvController[uID].playCsv();
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


}

const toyController = new ToyController();

module.exports = toyController;