
const Discord = require('discord.js');
const { Client, GatewayIntentBits, Partials, ActivityType, ButtonStyle } = Discord;
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, AttachmentBuilder } = Discord;
const { REST, Routes } = Discord;

const fs = require('fs');
const path = require('path');
const request = require('request');

const controller = require('./Buttplug_ToyController.js');


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
                const subCommand = isCommand ?
                    interaction.options?._subcommand :
                    interaction.customId.split(' ')[0];
                const hoistedOptions = isCommand ?
                    interaction.options?._hoistedOptions :
                    [{ name: subCommand, type: 3, value: interaction.customId.split(' ')[1] }];

                switch (subCommand) {

                    default: {
                        // pong!
                        interaction.reply({ content: `interactionCreate isCommand ${subCommand}`, allowedMentions: { repliedUser: false }, ephemeral: true })
                            .catch(() => { });

                    } break;

                    case 'connect': {
                        let args = { gID, uID };
                        for (let { name, type, value } of hoistedOptions) {
                            args[name] = value;
                        }
                        const res = await controller.getConnection(args);

                        if (res === null) {
                            interaction.reply({
                                content: `Sorry, Can not connect to Buttplug server (${args.connect}) right now`,
                                allowedMentions: { repliedUser: false }, ephemeral: true
                            }).catch(() => { });
                            return;
                        }

                        let { user } = interaction;
                        let embed = new EmbedBuilder()
                            .setAuthor({
                                name: `${user.displayName} <@${user.id}>`,
                                iconURL: user.displayAvatarURL({ format: 'png', size: 1024 }).replace(/\.webp/, '.png')
                            })
                            .setTitle('Lovense panel')
                            .setDescription('Client connected');

                        // csv player panel
                        const buttons = [[{ label: 'Panel', customID: 'panel', style: ButtonStyle.Primary }]];
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

                        interaction.reply({
                            content: ` `, embeds: [embed], components,
                            allowedMentions: { repliedUser: false }, ephemeral: true
                        }).catch(() => { });

                    } break;

                    case 'status': {
                        const embed = new EmbedBuilder()
                            .setTitle(`Connected Toys`);
                        let fields = [];
						
						await controller.users[uID].client.startScanning();		

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


                    case 'vibrate': case 'rotate': {
                        let args = { gID, uID };
                        for (let { name, type, value } of hoistedOptions) {
                            args[name] = parseInt(value);
                        }
                        let res = await controller[subCommand](args);

                        let content = "There aren't any toys connected";
                        if (res === true) {
                            switch (subCommand) {
                                case 'vibrate': content = "Buzz buzz!"; break;
                                case 'rotate': content = "You spin me right round baby..."; break;
                            }
                        } else { content = res || content; }

                        interaction.reply({ content, allowedMentions: { repliedUser: false }, ephemeral: true }).catch(() => { });

                    } break;

                    case 'stop': {
                        let res = await controller.stop({ uID });

                        let content = "There aren't any toys connected";
                        if (res === true) { content = "Break-time!"; }
                        else { content = res || content; }

                        interaction.reply({ content, allowedMentions: { repliedUser: false }, ephemeral: true }).catch(() => { });
                    } break;

                    case 'panel': {

                        const channel = interaction.channel;
                        if (!channel) { return; }

                        const address = controller.users[uID]?.address;
                        if (!address) { return; }

                        const buttons = [[
                            { label: 'Vibrate', customID: 'vibrate', style: ButtonStyle.Primary },
                            { label: 'Rotate', customID: 'rotate', style: ButtonStyle.Primary },
                            { label: 'Stop', customID: 'stop', style: ButtonStyle.Danger },
                            { label: 'Reconnect', customID: `connect ${address}`, style: ButtonStyle.Secondary }
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

                    case 'csv': {

                        const channel = interaction.channel;
                        if (!channel) { return; }

                        const { attachment } = hoistedOptions[0];
                        const { name, url } = attachment;
                        const ext = path.extname(name);
                        if (ext != '.csv') {
                            interaction.reply({ content: 'Error: wrong file type' }).catch(() => { });
                            return;
                        }

                        // download csv file
                        const filepath = `./${name}`;
                        await new Promise((resolve) => { request(url).pipe(fs.createWriteStream(filepath)).on('close', resolve); });

                        // todo
                        // csv file check

                        // upload csv file
                        const files = [new AttachmentBuilder(filepath, { name })];

                        // csv player panel
                        const buttons = [[
                            { label: 'Play CSV', customID: 'csv:play', style: ButtonStyle.Primary },
                            { label: 'Stop', customID: 'csv:stop', style: ButtonStyle.Danger },
                            { label: 'Pause 100ms', customID: 'csv:pause', style: ButtonStyle.Secondary },
                            { label: 'Forward 100ms', customID: 'csv:forward', style: ButtonStyle.Secondary },
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

                        interaction.reply({ content: ' ' }).catch(() => { });

                        await channel.send({ embeds: [embed], components, files }).catch((e) => console.log(e.message));
                        fs.unlinkSync(filepath);

                    } break;


                    case 'csv:play': {
                        if (!isButton) { return; }
                        let { message } = interaction;

                        let args = { gID, uID };
                        // download csv file
                        for (const [key, value] of message.attachments) {
                            const { name, url } = value;
                            const filepath = `./${name}`;

                            if (fs.existsSync(filepath)) { fs.unlinkSync(filepath); }
                            await new Promise((resolve) => { request(url).pipe(fs.createWriteStream(filepath)).on('close', resolve); });
                            args.filepath = filepath;

                            let res = await controller.csvPattern(args);
                            fs.unlinkSync(filepath);

                            interaction.reply({
                                content: res ? `Here comes the ${res}!` : "There aren't any toys connected",
                                allowedMentions: { repliedUser: false }, ephemeral: true
                            }).catch(() => { });

                            break;
                        }

                    } break;

                    case 'csv:stop': {
                        await controller.csvStop({ uID });
                        let res = await controller.stop({ uID });

                        interaction.reply({
                            content: res ? "Break-time!" : "There aren't any toys connected",
                            allowedMentions: { repliedUser: false }, ephemeral: true
                        }).catch(() => { });

                    } break;

                    case 'csv:pause': case 'csv:forward': {
                        if (!isButton) { return; }

                        let args = { gID, uID, add: (subCommand == 'csv:pause') ? 100 : -100 };

                        let res = await controller.csvOffset(args);

                        interaction.reply({ content: ' ', allowedMentions: { repliedUser: false }, ephemeral: true }).catch(() => { });

                    } break;
                }
            }
        });


        // auto update guild member count
        client.once('ready', async () => {
            // dc bot online
            console.log(`=====Lovense test bot is online!=====`);

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

        // build new commands
        const commands = [
            new SlashCommandBuilder()
                .setName('lovense').setDescription('Lovense by Buttplug')
                .addSubcommand(subcommand => subcommand.setName('connect').setDescription('Connect a toy')
                    .addStringOption(option => option.setName('connect').setRequired(true).setDescription('The Buttplug server ip address'))
                )
                .addSubcommand(subcommand => subcommand.setName('status').setDescription('List connected toys'))


                .addSubcommand(subcommand => subcommand.setName('vibrate').setDescription('Vibrate all toys')
                    .addIntegerOption(option => option.setName('strength').setRequired(false).setDescription('Vibration strength (1-20). Defaults to 10'))
                    .addIntegerOption(option => option.setName('duration').setRequired(false).setDescription('Number of seconds it lasts. Defaults to 10 secconds'))
                )

                .addSubcommand(subcommand => subcommand.setName('rotate').setDescription('Rotate all toys')
                    .addIntegerOption(option => option.setName('strength').setRequired(false).setDescription('Rotation strength (1-20). Defaults to 10'))
                    .addIntegerOption(option => option.setName('duration').setRequired(false).setDescription('Number of seconds it lasts. Defaults to 10 secconds'))
                )


                .addSubcommand(subcommand => subcommand.setName('pattern').setDescription('Send a pattern to all toys. Loops until stopped, or replaced with another action')
                    .addStringOption(option => option.setName('pattern').setRequired(false).setDescription('The pattern to send'))
                    .addStringOption(option => option.setName('length').setRequired(false).setDescription('The length of pattern'))
                )

                .addSubcommand(subcommand => subcommand.setName('csv').setDescription('Send a csv pattern file')
                    .addAttachmentOption(option => option.setName('pattern').setRequired(true).setDescription('The pattern file to send'))
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

        let onlineCmd = (await rest.get(Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID)) || []).filter(cmd => cmd.name == 'lovense')[0];
        if (onlineCmd.name != commands[0].name || onlineCmd.description != commands[0].description) {

            // // delete global commands
            // for (let cmd of await rest.get(Routes.applicationCommands(client.user.id))) {
            //     if (cmd.name != 'lovense') { continue; }
            //     await rest.delete(Routes.applicationCommand(client.user.id, cmd.id))
            //         .then(() => console.log('Successfully deleted guild command')).catch(console.error);
            // }

            // delete guild-based commands
            for (let cmd of await rest.get(Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID))) {
                if (cmd.name != 'lovense') { continue; }
                await rest.delete(Routes.applicationGuildCommand(client.user.id, process.env.GUILD_ID, cmd.id))
                    .then(() => console.log('Successfully deleted guild command')).catch(console.error);
            }
        }

        await rest.put(Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID), { body: commands },);

        return client;
    }
}



























