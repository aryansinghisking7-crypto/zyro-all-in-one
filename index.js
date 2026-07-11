require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, SlashCommandBuilder, REST, Routes } = require('discord.js');
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
        GatewayIntentBits.DirectMessages
    ],
    partials: ['CHANNEL']
});

// 1. REGISTER ALL SLASH COMMANDS - GLOBAL
const commands = [
  // UTILITY
  new SlashCommandBuilder().setName('ping').setDescription('Check bot latency').setDMPermission(true),
  new SlashCommandBuilder().setName('avatar').setDescription('Get user avatar').addUserOption(o => o.setName('user').setDescription('User').setRequired(false)).setDMPermission(true),
  new SlashCommandBuilder().setName('userinfo').setDescription('Get user info').addUserOption(o => o.setName('user').setDescription('User').setRequired(false)),
  new SlashCommandBuilder().setName('serverinfo').setDescription('Get server info'),
  
  // MODERATION
  new SlashCommandBuilder().setName('ban').setDescription('Ban a member')
   .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true))
   .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),
  new SlashCommandBuilder().setName('kick').setDescription('Kick a member')
   .addUserOption(o => o.setName('user').setDescription('User to kick').setRequired(true))
   .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),
  new SlashCommandBuilder().setName('timeout').setDescription('Timeout a member')
   .addUserOption(o => o.setName('user').setDescription('User to timeout').setRequired(true))
   .addIntegerOption(o => o.setName('minutes').setDescription('Minutes').setRequired(true))
   .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),
  new SlashCommandBuilder().setName('clear').setDescription('Delete messages')
   .addIntegerOption(o => o.setName('amount').setDescription('Amount 1-100').setRequired(true)),
  
  // TICKET
  new SlashCommandBuilder().setName('setup-ticket').setDescription('Setup the ticket system panel').setDMPermission(false),
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} is online!`);
    try {
        console.log('Registering GLOBAL slash commands...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands.map(cmd => cmd.toJSON()) });
        console.log('All commands registered!');
    } catch (error) { console.error(error); }
});

// 2. HANDLE ALL COMMANDS
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() &&!interaction.isButton()) return;

    // UTILITY
    if (interaction.commandName === 'ping') {
        await interaction.reply(`Pong! ${client.ws.ping}ms 🏓`);
    }
    if (interaction.commandName === 'avatar') {
        const user = interaction.options.getUser('user') || interaction.user;
        const embed = new EmbedBuilder().setTitle(`${user.username}'s Avatar`).setImage(user.displayAvatarURL({size: 512})).setColor('Blurple');
        await interaction.reply({embeds: [embed]});
    }
    if (interaction.commandName === 'userinfo') {
        const user = interaction.options.getUser('user') || interaction.user;
        const member = interaction.guild.members.cache.get(user.id);
        const embed = new EmbedBuilder()
         .setTitle(`Info for ${user.username}`)
         .addFields(
            {name: 'Joined Server', value: `<t:${Math.floor(member.joinedTimestamp/1000)}:R>`, inline: true},
            {name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp/1000)}:R>`, inline: true},
            {name: 'Roles', value: member.roles.cache.map(r => r).join(' ').slice(0, 1024) || 'None'}
          ).setThumbnail(user.displayAvatarURL()).setColor('Blue');
        await interaction.reply({embeds: [embed]});
    }
    if (interaction.commandName === 'serverinfo') {
        const guild = interaction.guild;
        const embed = new EmbedBuilder()
         .setTitle(`${guild.name} Info`)
         .addFields(
            {name: 'Members', value: `${guild.memberCount}`, inline: true},
            {name: 'Owner', value: `<@${guild.ownerId}>`, inline: true},
            {name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp/1000)}:R>`, inline: true}
          ).setThumbnail(guild.iconURL()).setColor('Green');
        await interaction.reply({embeds: [embed]});
    }

    // MOD
    if (interaction.commandName === 'ban') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) return interaction.reply({content: 'No perms', ephemeral: true});
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason';
        await interaction.guild.members.ban(user, {reason});
        await interaction.reply(`✅ Banned ${user.tag} | ${reason}`);
    }
    if (interaction.commandName === 'kick') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) return interaction.reply({content: 'No perms', ephemeral: true});
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason';
        await interaction.guild.members.kick(user, reason);
        await interaction.reply(`✅ Kicked ${user.tag} | ${reason}`);
    }
    if (interaction.commandName === 'timeout') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return interaction.reply({content: 'No perms', ephemeral: true});
        const user = interaction.options.getUser('user');
        const minutes = interaction.options.getInteger('minutes');
        await interaction.guild.members.cache.get(user.id).timeout(minutes * 60 * 1000);
        await interaction.reply(`✅ Timed out ${user.tag} for ${minutes} minutes`);
    }
    if (interaction.commandName === 'clear') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return interaction.reply({content: 'No perms', ephemeral: true});
        const amount = interaction.options.getInteger('amount');
        await interaction.channel.bulkDelete(amount, true);
        await interaction.reply({content: `✅ Deleted ${amount} messages`, ephemeral: true});
    }

    // TICKET
    if (interaction.commandName === 'setup-ticket') {
        if (!interaction.inGuild()) return interaction.reply({content: 'This command only works in servers!', ephemeral: true});
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) 
            return interaction.reply({ content: 'You need Admin perms', ephemeral: true });
        const embed = new EmbedBuilder().setTitle('🎫 Support Ticket').setDescription('Click the button below to create a ticket').setColor('Blue');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('create_ticket').setLabel('Create Ticket').setStyle(ButtonStyle.Primary).setEmoji('🎫'));
        await interaction.reply({ embeds: [embed], components: [row] });
    }

    // BUTTONS
    if (interaction.isButton()) {
        if (interaction.customId === 'create_ticket') {
            const guild = interaction.guild;
            const user = interaction.user;
            const existingTicket = db.get(`ticket_${guild.id}_${user.id}`);
            if (existingTicket) return interaction.reply({ content: 'You already have an open ticket!', ephemeral: true });
            const channel = await guild.channels.create({
                name: `ticket-${user.username}`, type: ChannelType.GuildText, parent: TICKET_CATEGORY,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: TICKET_ROLE, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ]
            });
            db.set(`ticket_${guild.id}_${user.id}`, channel.id);
            const embed = new EmbedBuilder().setTitle('Ticket Created').setDescription(`Hello ${user}, staff will be with you shortly.`).setColor('Green');
            const closeBtn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger));
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
