
require('dotenv').config();

const fs = require("fs");
const ngrok = require("@ngrok/ngrok");
const DiscordBot = require('./bot.js');

// const REQUEST_HEADRERS = {
//     'User-Agent': 'ToyBot/beep-boop'
// };

if (!fs.existsSync('./.env')) {
    fs.writeFileSync('./.env', ["NGROK_AUTHTOKEN = ''\n", "DISCORD_TOKEN = ''", "GUILD_ID = ''\n", "LOVENSE_DEVELOPER_TOKEN = ''", "PORT = 8000"].join('\n'));
}

(async () => {
    await ngrok.authtoken(process.env.NGROK_AUTHTOKEN);

    const listener = await ngrok.forward({ addr: process.env.PORT, authtoken_from_env: true });
    console.log(`[Ngrok] Ingress established at:\n${listener.url()}`);
    console.log(`[Ngrok] Please set callback url at:\nhttps://ja.lovense.com/user/developer/info`);

    const client = await DiscordBot.init();

})();






