require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, SlashCommandBuilder, REST, Routes, ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');
const db = require('croxydb');
const express = require('express');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const TICKET_CATEGORY = process.env.TICKET_CATEGORY;
const TICKET_ROLE = process.env.TICKET_ROLE;

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('ZYRO-BOT is running!'));
app.listen(PORT, () => console.log(`🌐 Web server on port ${PORT}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages // ADD THIS FOR DM SUPPORT
    ],
    partials: ['CHANNEL'] // ADD THIS FOR DM SUPPORT
});

// 1. REGISTER GLOBAL SLASH COMMANDS - WORKS IN ALL SERVERS + DM
const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency')
    .setDMPermission(true), // ALLOWS IN DM
    
  new SlashCommandBuilder()
    .setName('setup-ticket')
    .setDescription('Setup the ticket system panel')
    .setDMPermission(false), // TICKETS ONLY WORK IN SERVERS
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} is online!`);

    // GLOBAL REGISTER - TAKES UP TO 1 HOUR TO SHOW IN ALL SERVERS
    try {
        console.log('Registering GLOBAL slash commands...');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID), // CHANGED THIS LINE
            { body: commands.map(cmd => cmd.toJSON()) },
        );
        console.log('Global slash commands registered!');
    } catch (error) {
        console.error(error);
    }
});

// 2. HANDLE SLASH COMMANDS
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

    // /ping command - WORKS IN DM TOO
    if (interaction.isChatInputCommand() && interaction.commandName === 'ping') {
        await interaction.reply(`Pong! ${client.ws.ping}ms 🏓`);
    }

    // /setup-ticket command - ONLY IN SERVERS
    if (interaction.isChatInputCommand() && interaction.commandName === 'setup-ticket') {
        if (!interaction.inGuild()) return interaction.reply({content: 'This command only works in servers!', ephemeral: true});
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) 
            return interaction.reply({ content: 'You need Admin perms', ephemeral: true });

        const embed = new EmbedBuilder()
          .setTitle('🎫 Support Ticket')
          .setDescription('Click the button below to create a ticket')
          .setColor('Blue');

        const row = new ActionRowBuilder()
          .addComponents(
                new ButtonBuilder()
                  .setCustomId('create_ticket')
                  .setLabel('Create Ticket')
                  .setStyle(ButtonStyle.Primary)
                  .setEmoji('🎫'),
            );

        await interaction.reply({ embeds: [embed], components: [row] });
    }

    // BUTTON HANDLERS - SAME AS BEFORE
    if (interaction.isButton()) {
        if (interaction.customId === 'create_ticket') {
            const guild = interaction.guild;
            const user = interaction.user;

            const existingTicket = db.get(`ticket_${guild.id}_${user.id}`);
            if (existingTicket) return interaction.reply({ content: 'You already have an open ticket!', ephemeral: true });

            const channel = await guild.channels.create({
                name: `ticket-${user.username}`,
                type: ChannelType.GuildText,
                parent: TICKET_CATEGORY,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: TICKET_ROLE, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ]
            });

            db.set(`ticket_${guild.id}_${user.id}`, channel.id);

            const embed = new EmbedBuilder()
              .setTitle('Ticket Created')
              .setDescription(`Hello ${user}, staff will be with you shortly.`)
              .setColor('Green');

            const closeBtn = new ActionRowBuilder()
              .addComponents(
                    new ButtonBuilder()
                      .setCustomId('close_ticket')
                      .setLabel('Close Ticket')
                      .setStyle(ButtonStyle.Danger)
                );

            channel.send({ content: `<@${user.id}> <@&${TICKET_ROLE}>`, embeds: [embed], components: [closeBtn] });
            interaction.reply({ content: `Ticket created: ${channel}`, ephemeral: true });
        }

        if (interaction.customId === 'close_ticket') {
            db.delete(`ticket_${interaction.guild.id}_${interaction.user.id}`);
            await interaction.channel.delete();
        }
    }
});

client.login(TOKEN);
