
require('dotenv').config();

const fs = require("fs");
const DiscordBot = require('./Lovense_bot.js');

// const REQUEST_HEADRERS = {
//     'User-Agent': 'ToyBot/beep-boop'
// };

if (!fs.existsSync('./.env')) {
    fs.writeFileSync('./.env', ["NGROK_AUTHTOKEN = ''\n", "DISCORD_TOKEN = ''", "GUILD_ID = ''\n", "LOVENSE_DEVELOPER_TOKEN = ''", "PORT = 8000"].join('\n'));
}

(async () => {

    const client = await DiscordBot.init();

})();






