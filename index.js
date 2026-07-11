const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const TICKET_CATEGORY = process.env.TICKET_CATEGORY; // Category ID
const TICKET_ROLE = process.env.TICKET_ROLE; // NEW: Support Role ID

// Slash Commands
const commands = [
  {
    name: 'setup-ticket',
    description: 'Setup the ticket panel'
  }
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} is online!`);
  
  try {
    console.log('Registering GLOBAL slash commands...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('All commands registered!');
  } catch (error) {
    console.error(error);
  }

  client.user.setStatus('online');
  client.user.setActivity('/setup-ticket');
});

client.on('interactionCreate', async interaction => {
  if (interaction.isCommand()) {
    if (interaction.commandName === 'setup-ticket') {
      // FIXED for v14
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You need Administrator to use this.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle('🎫 Support Ticket System')
        .setDescription('Click the button below to create a ticket!\n\nOur support team will help you.')
        .setColor(0x5865F2);

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('create_ticket')
            .setLabel('Create Ticket')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎫')
        );

      await interaction.reply({ embeds: [embed], components: [row] });
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'create_ticket') {
      if (!TICKET_CATEGORY) {
        return interaction.reply({ content: '❌ Set TICKET_CATEGORY in Render Environment first!', ephemeral: true });
      }
      if (!TICKET_ROLE) {
        return interaction.reply({ content: '❌ Set TICKET_ROLE in Render Environment first!', ephemeral: true });
      }

      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles]
          },
          { // NEW: Give support role access
            id: TICKET_ROLE,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages]
          }
        ]
      });

      // Ping user + role
      await ticketChannel.send(`<@${interaction.user.id}> <@&${TICKET_ROLE}> Support will be with you shortly!`);
      await interaction.reply({ content: `✅ Ticket created: ${ticketChannel}`, ephemeral: true });
    }
  }
});

// Keep Render alive
const http = require('http');
http.createServer((req, res) => res.end('Bot is running')).listen(10000);

client.login(TOKEN);
