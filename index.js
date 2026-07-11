require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('croxydb');
const express = require('express'); // ADDED FOR UPTIMEROBOT

const TOKEN = process.env.TOKEN;
const TICKET_CATEGORY = process.env.TICKET_CATEGORY;
const TICKET_ROLE = process.env.TICKET_ROLE;

const app = express(); // KEEP RENDER AWAKE
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('ZYRO-BOT is running!'));
app.listen(PORT, () => console.log(`🌐 Web server on port ${PORT}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.once('ready', () => {
    console.log(`✅ ${client.user.tag} is online!`);
});

// ALL YOUR COMMANDS SAME AS BEFORE
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'ping') {
        message.reply(`Pong! ${client.ws.ping}ms`);
    }

    if (command === 'setup-ticket') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) 
            return message.reply('You need Admin perms');

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

        message.channel.send({ embeds: [embed], components: [row] });
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

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
});

client.login(TOKEN);
