
require('dotenv').config();

const fs = require("fs");
// const DiscordBot = require('./Lovense_bot.js');
const DiscordBot = require('./Buttplug_bot.js');

// const REQUEST_HEADRERS = {
//     'User-Agent': 'ToyBot/beep-boop'
// };

if (!fs.existsSync('./.env')) {
    fs.writeFileSync('./.env', [
        `DISCORD_TOKEN = ''`,
        `GUILD_ID = ''`
    ].join('\n'));
}

(async () => {

    const client = await DiscordBot.init();

})();






