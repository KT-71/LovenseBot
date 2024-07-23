
const Discord = require('discord.js');
const { Client, GatewayIntentBits, Partials, ActivityType, ButtonStyle } = Discord;
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder } = Discord;
const { REST, Routes } = Discord;

const ToyController = require('./ToyController.js');
const controller = new ToyController();
const Callbacks = require('./Callbacks.js');


module.exports = {
    async init() {

        const client = new Client({
            intents: [
                GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.MessageContent
            ],
            partials: [
                Partials.Message,
                Partials.Channel,
                Partials.Reaction
            ]
        });

        client.on('interactionCreate', async (interaction) => {

            let isCommand = interaction.isCommand();
            let isButton = interaction.isButton();

            if (isCommand || isButton) {

                if (isCommand && interaction.commandName != 'lovense') { return false; }
                if (isButton && ((interaction.message?.embeds || [])[0] || { title: null }).title != 'Lovense panel') { return false; }

                // console.log(interaction);
                // console.log(interaction.commandName, interaction.options._subcommand);

                const gID = interaction.guildId;
                const uID = interaction.user.id;
                const subCommand = isCommand ? interaction.options?._subcommand : interaction.customId.split(' ')[0];
                const hoistedOptions = isCommand ? interaction.options._hoistedOptions :
                    [{ name: 'pattern', type: 3, value: interaction.customId.split(' ')[1] }];

                switch (subCommand) {

                    default: {
                        // pong!
                        interaction.reply({ content: `interactionCreate isCommand ${interaction.commandName}`, allowedMentions: { repliedUser: false }, ephemeral: true })
                            .catch(() => { });

                    } break;

                    case 'connect': {
                        const url = await controller.getConnectionQr({ uID });

                        if (url === null) {
                            interaction.reply({
                                content: `Sorry, Can not connect to Lovense right now`,
                                allowedMentions: { repliedUser: false }, ephemeral: true
                            }).catch(() => { });
                            return;
                        }

                        const description = [
                            'Using the Lovense Remote app, press the + button > Scan QR. ',
                            'This is *your* personal QR code, sharing it might prevent the connection from working'
                        ].join('\n');

                        const embed = new EmbedBuilder()
                            .setTitle(`Connect with Lovense Remote`)
                            .setDescription(description)
                            .setImage(url);

                        interaction.reply({
                            embeds: [embed],
                            allowedMentions: { repliedUser: false }, ephemeral: true
                        }).catch(() => { });

                    } break;

                    case 'status': {
                        const embed = new EmbedBuilder()
                            .setTitle(`Connected Toys`);
                        let fields = [];

                        let toyCount = {};
                        for (let toy of controller.getToys(gID)) {
                            let { name } = toy;
                            toyCount[name] = (toyCount[name] || 0) + 1;
                        }

                        for (let toy of Object.keys(toyCount)) {
                            fields.push({ name: toy, value: `${toyCount[toy]} connected` });
                        }
                        if (fields.length == 0) { embed.setDescription(`There aren't any toys connected`); }
                        else { embed.addFields(fields); }

                        interaction.reply({
                            embeds: [embed],
                            allowedMentions: { repliedUser: false }, ephemeral: true
                        }).catch(() => { });

                    } break;


                    case 'vibrate': case 'rotate': case 'pump': case 'thrusting': case 'fingering': case 'suction': {
                        let args = { gID, uID };
                        for (let { name, type, value } of hoistedOptions) {
                            args[name] = parseInt(value);
                        }
                        let res = await controller[subCommand](args);

                        let content = "There aren't any toys connected";
                        if (res) {
                            switch (subCommand) {
                                case 'vibrate': content = "Buzz buzz!"; break;
                                case 'rotate': content = "You spin me right round baby..."; break;
                                case 'pump': content = "Let's get pumped!"; break;
                                case 'thrusting': content = "Thrusting into action!"; break;
                                case 'fingering': content = "Getting to the point!"; break;
                                case 'suction': content = "Sucking it up!"; break;
                            }
                        }

                        interaction.reply({ content, allowedMentions: { repliedUser: false }, ephemeral: true }).catch(() => { });

                        if (isButton) {
                            let { message } = interaction;
                            let { embeds } = message;
                            let components = [];
                            for (let row of message.components) {
                                let newRow = new ActionRowBuilder();
                                for (let btn of row.components) {
                                    let newBtn = new ButtonBuilder(btn.data);
                                    if (!['Stop', 'QR code'].includes(btn.label)) { newBtn.setDisabled(!res); }
                                    newRow.addComponents(newBtn);
                                }
                                components.push(newRow);
                            }
                            message.edit({ embeds, components });
                        }

                    } break;


                    case 'pattern': {
                        let args = { gID, uID };
                        for (let { name, type, value } of hoistedOptions) {
                            args[name] = value;
                        }
                        let res = await controller.pattern(args);

                        interaction.reply({
                            content: res ? `Here comes the ${res}!` : "There aren't any toys connected",
                            allowedMentions: { repliedUser: false }, ephemeral: true
                        }).catch(() => { });

                        if (isButton) {
                            let { message } = interaction;
                            let { embeds } = message;
                            let components = [];
                            for (let row of message.components) {
                                let newRow = new ActionRowBuilder();
                                for (let btn of row.components) {
                                    let newBtn = new ButtonBuilder(btn.data);
                                    if (!['Stop', 'QR code'].includes(btn.label)) { newBtn.setDisabled(!res); }
                                    newRow.addComponents(newBtn);
                                }
                                components.push(newRow);
                            }
                            message.edit({ embeds, components });
                        }

                    } break;

                    case 'preset': {
                        let args = { gID, uID };
                        for (let { name, type, value } of hoistedOptions) {
                            args[name] = value;
                        }
                        let res = await controller.preset(args);

                        interaction.reply({
                            content: res ? `Here comes the ${args.pattern}!` : "There aren't any toys connected",
                            allowedMentions: { repliedUser: false }, ephemeral: true
                        }).catch(() => { });

                        if (isButton) {
                            let { message } = interaction;
                            let { embeds } = message;
                            let components = [];
                            for (let row of message.components) {
                                let newRow = new ActionRowBuilder();
                                for (let btn of row.components) {
                                    let newBtn = new ButtonBuilder(btn.data);
                                    if (!['Stop', 'QR code'].includes(btn.label)) { newBtn.setDisabled(!res); }
                                    newRow.addComponents(newBtn);
                                }
                                components.push(newRow);
                            }
                            message.edit({ embeds, components });
                        }

                    } break;

                    case 'stop': {
                        let res = await controller.stop(uID);

                        interaction.reply({
                            content: res ? "Break-time!" : "There aren't any toys connected",
                            allowedMentions: { repliedUser: false }, ephemeral: true
                        }).catch(() => { });

                        if (isButton) {
                            let { message } = interaction;
                            let { embeds } = message;
                            let components = [];
                            for (let row of message.components) {
                                let newRow = new ActionRowBuilder();
                                for (let btn of row.components) {
                                    let newBtn = new ButtonBuilder(btn.data);
                                    if (!['Stop', 'QR code'].includes(btn.label)) { newBtn.setDisabled(!res); }
                                    newRow.addComponents(newBtn);
                                }
                                components.push(newRow);
                            }
                            message.edit({ embeds, components });
                        }

                    } break;

                    case 'panel': {

                        const channel = interaction.channel;
                        if (!channel) { return; }

                        const buttons = [[
                            { label: 'Vibrate', customID: 'vibrate', style: ButtonStyle.Primary },
                            { label: 'Rotate', customID: 'rotate', style: ButtonStyle.Primary },
                            { label: 'Pump', customID: 'pump', style: ButtonStyle.Primary }
                        ], [
                            { label: 'Thrusting', customID: 'thrusting', style: ButtonStyle.Primary },
                            { label: 'Fingering', customID: 'fingering', style: ButtonStyle.Primary },
                            { label: 'Suction', customID: 'suction', style: ButtonStyle.Primary }
                        ], [
                            //     { label: 'Pulse', customID: 'preset pulse', style: ButtonStyle.Success },
                            //     { label: 'Wave', customID: 'preset wave', style: ButtonStyle.Success },
                            //     { label: 'Fireworks', customID: 'preset fireworks', style: ButtonStyle.Success },
                            //     { label: 'Earthquake', customID: 'preset earthquake', style: ButtonStyle.Success }
                            // ], [
                            { label: 'Stop', customID: 'stop', style: ButtonStyle.Danger },
                            { label: 'QR code', customID: 'connect', style: ButtonStyle.Secondary }
                        ]]

                        let components = [];
                        for (let row of buttons) {
                            let actionRow = new ActionRowBuilder();
                            for (let { label, customID, style } of row) {
                                actionRow.addComponents(new ButtonBuilder().setDisabled(false)
                                    .setLabel(label).setCustomId(customID).setStyle(style)
                                );
                            }
                            components.push(actionRow);
                        }

                        let { user } = interaction;
                        let embed = new EmbedBuilder()
                            .setAuthor({
                                name: `${user.displayName} <@${user.id}>`,
                                iconURL: user.displayAvatarURL({ format: 'png', size: 1024 }).replace(/\.webp/, '.png')
                            })
                            .setTitle('Lovense panel');

                        channel.send({ embeds: [embed], components }).catch(() => { });
                        interaction.reply({ content: ' ' }).catch(() => { });

                    } break;
                }
            }
        });


        // auto update guild member count
        client.once('ready', async () => {
            // dc bot online
            console.log(`=====Lovense test bot is online!=====`);

            // init callback server
            const callbacks = new Callbacks(controller);
            callbacks.webserver();

            // clock
            const intervalMethod = () => {

                let activity = controller.updateActivity();
                if (!activity) { return; }

                client.user.setPresence({ activities: [{ name: activity, type: ActivityType.Playing }] });
            }
            intervalMethod(); client.interval = setInterval(intervalMethod, 30 * 1000);
        });


        await client.login(process.env.DISCORD_TOKEN);  //.then(console.log);
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

        // // delete global commands
        // for (let cmd of await rest.get(Routes.applicationCommands(client.user.id))) {
        //     if (cmd.name != 'lovense') { continue; }
        //     await rest.delete(Routes.applicationCommand(client.user.id, cmd.id))
        //         .then(() => console.log('Successfully deleted guild command')).catch(console.error);
        // }

        // // delete guild-based commands
        // for (let cmd of await rest.get(Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID))) {
        //     if (cmd.name != 'lovense') { continue; }
        //     await rest.delete(Routes.applicationGuildCommand(client.user.id, process.env.GUILD_ID, cmd.id))
        //         .then(() => console.log('Successfully deleted guild command')).catch(console.error);
        // }

        // build new commands
        const commands = [
            new SlashCommandBuilder()
                .setName('lovense').setDescription('Lovense')
                .addSubcommand(subcommand => subcommand.setName('connect').setDescription('Connect a toy'))
                .addSubcommand(subcommand => subcommand.setName('status').setDescription('List connected toys'))


                .addSubcommand(subcommand => subcommand.setName('vibrate').setDescription('Vibrate all toys')
                    .addIntegerOption(option => option.setName('strength').setRequired(false).setDescription('Vibration strength (1-20). Defaults to 10'))
                    .addIntegerOption(option => option.setName('duration').setRequired(false).setDescription('Number of seconds it lasts. Defaults to 10 secconds'))
                )

                .addSubcommand(subcommand => subcommand.setName('rotate').setDescription('Rotate all toys')
                    .addIntegerOption(option => option.setName('strength').setRequired(false).setDescription('Rotation strength (1-20). Defaults to 10'))
                    .addIntegerOption(option => option.setName('duration').setRequired(false).setDescription('Number of seconds it lasts. Defaults to 10 secconds'))
                )

                .addSubcommand(subcommand => subcommand.setName('pump').setDescription('Pump all toys')
                    .addIntegerOption(option => option.setName('strength').setRequired(false).setDescription('Pump strength (1-3). Defaults to 2'))
                    .addIntegerOption(option => option.setName('duration').setRequired(false).setDescription('Number of seconds it lasts. Defaults to 10 secconds'))
                )

                .addSubcommand(subcommand => subcommand.setName('thrusting').setDescription('Thrusting all toys')
                    .addIntegerOption(option => option.setName('strength').setRequired(false).setDescription('Thrusting strength (1-20). Defaults to 10'))
                    .addIntegerOption(option => option.setName('duration').setRequired(false).setDescription('Number of seconds it lasts. Defaults to 10 secconds'))
                )

                .addSubcommand(subcommand => subcommand.setName('fingering').setDescription('Fingering all toys')
                    .addIntegerOption(option => option.setName('strength').setRequired(false).setDescription('Fingering strength (1-20). Defaults to 10'))
                    .addIntegerOption(option => option.setName('duration').setRequired(false).setDescription('Number of seconds it lasts. Defaults to 10 secconds'))
                )

                .addSubcommand(subcommand => subcommand.setName('suction').setDescription('Suction all toys')
                    .addIntegerOption(option => option.setName('strength').setRequired(false).setDescription('Suction strength (1-20). Defaults to 10'))
                    .addIntegerOption(option => option.setName('duration').setRequired(false).setDescription('Number of seconds it lasts. Defaults to 10 secconds'))
                )


                .addSubcommand(subcommand => subcommand.setName('pattern').setDescription('Send a pattern to all toys. Loops until stopped, or replaced with another action')
                    .addStringOption(option => option.setName('pattern').setRequired(false).setDescription('The pattern to send'))
                )

                // .addSubcommand(subcommand => subcommand.setName('preset').setDescription('Send a Preset pattern to all toys. Loops until stopped, or replaced with another action')
                //     .addStringOption(option => option.setName('pattern').setRequired(true).setDescription('The pattern to send')
                //         .setChoices(
                //             { name: 'Pulse', value: 'pulse' }, { name: 'Wave', value: 'wave' }, { name: 'Fireworks', value: 'fireworks' }, { name: 'Earthquake', value: 'earthquake' }
                //         )
                //     )
                // )

                .addSubcommand(subcommand => subcommand.setName('stop').setDescription('Stop all toys'))
                .addSubcommand(subcommand => subcommand.setName('panel').setDescription('Remote panel'))

        ];

        await rest.put(Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID), { body: commands },);

        return client;
    }
}



























