const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, REST, Routes, SlashCommandBuilder } = require('discord.js');
const QRCode = require('qrcode');
const db = require('wio.db');
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
const SUPPORT_ROLE = process.env.SUPPORT_ROLE;

const spamMap = new Map();
const claimedTickets = new Map();

// ===== SLASH COMMANDS =====
const commands = [
  new SlashCommandBuilder().setName('setup-ticket').setDescription('Setup the ZYRO ticket panel'),
  new SlashCommandBuilder().setName('add').setDescription('Add user to ticket').addUserOption(o => o.setName('user').setDescription('User to add').setRequired(true)),
  new SlashCommandBuilder().setName('remove').setDescription('Remove user from ticket').addUserOption(o => o.setName('user').setDescription('User to remove').setRequired(true)),
  new SlashCommandBuilder().setName('close').setDescription('Close this ticket'),
  new SlashCommandBuilder().setName('claim').setDescription('Claim this ticket'),
  new SlashCommandBuilder().setName('unclaim').setDescription('Unclaim this ticket'),
  new SlashCommandBuilder().setName('vouch').setDescription('Give vouch').addUserOption(o => o.setName('user').setDescription('User to vouch').setRequired(true)).addStringOption(o => o.setName('item').setDescription('Item bought').setRequired(true)).addStringOption(o => o.setName('price').setDescription('Price').setRequired(true)),
  new SlashCommandBuilder().setName('vouchlist').setDescription('Check vouches of a user').addUserOption(o => o.setName('user').setDescription('User to check').setRequired(true)),
  new SlashCommandBuilder().setName('setupi').setDescription('Save your UPI ID').addStringOption(o => o.setName('upi_id').setDescription('Your UPI ID').setRequired(true)),
  new SlashCommandBuilder().setName('setltc').setDescription('Save your LTC Address').addStringOption(o => o.setName('ltc').setDescription('Your LTC address').setRequired(true)),
  new SlashCommandBuilder().setName('upiqr').setDescription('Generate UPI QR').addStringOption(o => o.setName('amount').setDescription('Amount in INR').setRequired(true)),
  new SlashCommandBuilder().setName('ltc').setDescription('Get LTC payment info').addStringOption(o => o.setName('amount').setDescription('Amount in LTC').setRequired(true)),
  new SlashCommandBuilder().setName('purge').setDescription('Delete messages').addIntegerOption(o => o.setName('amount').setDescription('Number of messages').setRequired(true)),
  new SlashCommandBuilder().setName('ban').setDescription('Ban user').addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason for ban')),
  new SlashCommandBuilder().setName('kick').setDescription('Kick user').addUserOption(o => o.setName('user').setDescription('User to kick').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason for kick')),
  new SlashCommandBuilder().setName('timeout').setDescription('Timeout user').addUserOption(o => o.setName('user').setDescription('User to timeout').setRequired(true)).addIntegerOption(o => o.setName('time').setDescription('Time in seconds').setRequired(true)),
  new SlashCommandBuilder().setName('slots').setDescription('Casino slots - bet amount').addIntegerOption(o => o.setName('amount').setDescription('Bet amount').setRequired(true)),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} is online!`);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log(`✅ Successfully registered ${commands.length} commands globally`);
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
  }
});

// ===== ANTI-SPAM =====
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const mentions = message.mentions.users.map(u => u.id);
  if (mentions.length === 0) return;
  const key = `${message.guild.id}-${message.author.id}`;
  const now = Date.now();
  let timestamps = (spamMap.get(key) || []).filter(t => now - t < 60000);
  timestamps.push(now);
  spamMap.set(key, timestamps);
  if (timestamps.length > 5) {
    spamMap.set(key, []);
    try {
      await message.member.timeout(60 * 1000, 'Spam pinging > 5 times in 1 minute');
      await message.channel.send(`🔨 ${message.author} was timed out for 1 min for spam pinging.`);
    } catch {}
  }
});

// ===== INTERACTIONS =====
client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isCommand() && interaction.commandName === 'setup-ticket') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) return await interaction.reply({content: '❌ Admin only', ephemeral: true});
      const embed = new EmbedBuilder().setTitle('🎫 ZYRO Ticket System').setDescription(`Welcome to the ZYRO Ticket System — your fast, secure, and professional support center.\nWhether you need customer support, purchase assistance, order help, reports, partnerships, or general inquiries, our dedicated team is here to assist you as quickly as possible.\n✨ **Why choose ZYRO?**\n- ⚡ Fast response times\n- 🔒 Private and secure tickets\n- 👥 Professional support staff\n- 💬 Friendly and reliable assistance\n- ✅ Organized ticket management\nPlease create only one ticket per issue and provide all necessary details so we can help you efficiently.\nThank you for choosing ZYRO. We appreciate your patience and look forward to assisting you!`).setColor(0x5865F2).setThumbnail(client.user.displayAvatarURL()).setFooter({ text: 'ZYRO ALL IN ONE', iconURL: client.user.displayAvatarURL() });
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('create_ticket').setLabel('Create Ticket').setStyle(ButtonStyle.Primary).setEmoji('🎫'));
      await interaction.reply({ embeds: [embed], components: [row] });
    }

    // ===== CREATE TICKET =====
    if (interaction.isButton() && interaction.customId === 'create_ticket') {
      await interaction.deferReply({ephemeral: true});
      const ticket = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: interaction.channel.parentId,
        topic: interaction.user.id, // Save user ID for later
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
          { id: SUPPORT_ROLE, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] }
        ]
      });

      claimedTickets.delete(ticket.id);

      const embed = new EmbedBuilder()
.setDescription(`Hello <@${interaction.user.id}>,\nA staff member will be with you shortly.\nPlease describe your issue in detail.`)
.setFooter({ text: 'Powered by ZYRO', iconURL: client.user.displayAvatarURL() })
.setColor(0x2B2D31);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Success).setEmoji('✅'),
        new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
        new ButtonBuilder().setCustomId('close_reason').setLabel('Close With Reason').setStyle(ButtonStyle.Danger).setEmoji('📝')
      );

      await ticket.send({ content: `<@&${SUPPORT_ROLE}> <@${interaction.user.id}>`, embeds: [embed], components: [row] });
      await interaction.editReply({content: `✅ Ticket created: ${ticket}`});
    }

    // ===== CLAIM BUTTON =====
    if (interaction.isButton() && interaction.customId === 'claim_ticket') {
      if (!interaction.member.roles.cache.has(SUPPORT_ROLE)) return await interaction.reply({content: '❌ Only Support can claim', ephemeral: true});
      if (claimedTickets.has(interaction.channel.id)) {
        return await interaction.reply({content: `❌ Already claimed by <@${claimedTickets.get(interaction.channel.id)}>`, ephemeral: true});
      }
      
      claimedTickets.set(interaction.channel.id, interaction.user.id);
      const embed = new EmbedBuilder().setDescription(`🎫 **${interaction.user} has claimed this ticket**`).setColor(0x57F287);
      
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('unclaim_btn').setLabel('Unclaim').setStyle(ButtonStyle.Secondary).setEmoji('🙋'),
        new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
        new ButtonBuilder().setCustomId('close_reason').setLabel('Close With Reason').setStyle(ButtonStyle.Danger).setEmoji('📝')
      );
      
      await interaction.update({ embeds: [embed], components: [row] });
    }

    // ===== UNCLAIM BUTTON =====
    if (interaction.isButton() && interaction.customId === 'unclaim_btn') {
      if (claimedTickets.get(interaction.channel.id)!== interaction.user.id) return await interaction.reply({content: '❌ You did not claim this ticket', ephemeral: true});
      claimedTickets.delete(interaction.channel.id);
      
      const userId = interaction.channel.topic;
      const embed = new EmbedBuilder().setDescription(`Hello <@${userId}>,\nA staff member will be with you shortly.\nPlease describe your issue in detail.`).setFooter({ text: 'Powered by ZYRO', iconURL: client.user.displayAvatarURL() }).setColor(0x2B2D31);
      
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Success).setEmoji('✅'),
        new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
        new ButtonBuilder().setCustomId('close_reason').setLabel('Close With Reason').setStyle(ButtonStyle.Danger).setEmoji('📝')
      );
      
      await interaction.update({ embeds: [embed], components: [row] });
    }

    if (interaction.isButton() && interaction.customId === 'close_ticket') {if (!interaction.member.roles.cache.has(SUPPORT_ROLE)) return await interaction.reply({content: '❌ Only Support can close', ephemeral: true});await interaction.reply('Closing ticket in 5s...');claimedTickets.delete(interaction.channel.id);setTimeout(() => interaction.channel.delete(), 5000);}
    if (interaction.isButton() && interaction.customId === 'close_reason') {if (!interaction.member.roles.cache.has(SUPPORT_ROLE)) return await interaction.reply({content: '❌ Only Support can close', ephemeral: true});const modal = new ModalBuilder().setCustomId('close_modal').setTitle('Close Ticket With Reason');const reasonInput = new TextInputBuilder().setCustomId('reason').setLabel("Reason for closing").setStyle(TextInputStyle.Paragraph).setRequired(true);modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));await interaction.showModal(modal);}
    if (interaction.isModalSubmit() && interaction.customId === 'close_modal') {const reason = interaction.fields.getTextInputValue('reason');await interaction.reply(`Ticket closed by ${interaction.user} for: \`${reason}\``);claimedTickets.delete(interaction.channel.id);setTimeout(() => interaction.channel.delete(), 5000);}

    if (interaction.isCommand() && interaction.commandName === 'add') {if (!interaction.channel.name.startsWith('ticket-')) return await interaction.reply({content: 'Use in ticket only', ephemeral: true});const user = interaction.options.getUser('user');await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true });await interaction.reply(`✅ Added ${user} to ticket`);}
    if (interaction.isCommand() && interaction.commandName === 'remove') {if (!interaction.channel.name.startsWith('ticket-')) return await interaction.reply({content: 'Use in ticket only', ephemeral: true});const user = interaction.options.getUser('user');await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: false });await interaction.reply(`✅ Removed ${user} from ticket`);}
    if (interaction.isCommand() && interaction.commandName === 'claim') {if (!interaction.channel.name.startsWith('ticket-')) return await interaction.reply({content: 'Use in ticket only', ephemeral: true});if (!interaction.member.roles.cache.has(SUPPORT_ROLE)) return await interaction.reply({content: '❌ Only Support can claim', ephemeral: true});if (claimedTickets.has(interaction.channel.id)) {return await interaction.reply({content: `❌ Already claimed by <@${claimedTickets.get(interaction.channel.id)}>`, ephemeral: true});}claimedTickets.set(interaction.channel.id, interaction.user.id);await interaction.reply(`🎫 Ticket claimed by ${interaction.user}`);}
    if (interaction.isCommand() && interaction.commandName === 'unclaim') {if (!interaction.channel.name.startsWith('ticket-')) return await interaction.reply({content: 'Use in ticket only', ephemeral: true});if (claimedTickets.get(interaction.channel.id)!== interaction.user.id) return await interaction.reply({content: '❌ You did not claim this ticket', ephemeral: true});claimedTickets.delete(interaction.channel.id);await interaction.reply(`🙋 Ticket unclaimed`);}
    if (interaction.isCommand() && interaction.commandName === 'close') {if (!interaction.channel.name.startsWith('ticket-')) return await interaction.reply({content: 'Use in ticket only', ephemeral: true});await interaction.reply('Closing in 5s...');claimedTickets.delete(interaction.channel.id);setTimeout(() => interaction.channel.delete(), 5000);}

    // ===== VOUCH - CLEAN FORMAT =====
    if (interaction.isCommand() && interaction.commandName === 'vouch') {
      const user = interaction.options.getUser('user');
      const item = interaction.options.getString('item');
      const price = interaction.options.getString('price');
      let vouches = db.get(`vouches-${user.id}`) || [];
      vouches.push({ by: interaction.user.tag, item, price, date: new Date().toLocaleDateString() });
      db.set(`vouches-${user.id}`, vouches);
      await interaction.reply(`+rep ${user} | ${item} | ${price}`);
    }

    if (interaction.isCommand() && interaction.commandName === 'vouchlist') {
      const user = interaction.options.getUser('user');
      let vouches = db.get(`vouches-${user.id}`) || [];
      if (vouches.length === 0) return await interaction.reply(`${user} has no vouches yet.`);
      const list = vouches.map((v, i) => `**${i+1}.** ${v.item} - \`${v.price}\` by ${v.by} on ${v.date}`).join('\n');
      const embed = new EmbedBuilder().setTitle(`Vouches for ${user.tag}`).setDescription(list).setColor(0x5865F2);
      await interaction.reply({ embeds: [embed] });
    }

    if (interaction.isCommand() && interaction.commandName === 'setupi') {const upi = interaction.options.getString('upi_id');db.set(`upi-${interaction.user.id}`, upi);await interaction.reply({content: `✅ UPI saved!`, ephemeral: true});}
    if (interaction.isCommand() && interaction.commandName === 'setltc') {const ltc = interaction.options.getString('ltc');db.set(`ltc-${interaction.user.id}`, ltc);await interaction.reply({content: `✅ LTC saved!`, ephemeral: true});}
    if (interaction.isCommand() && interaction.commandName === 'upiqr') {await interaction.deferReply();const amount = interaction.options.getString('amount');const upi = db.get(`upi-${interaction.user.id}`);if (!upi) return await interaction.editReply({content: '❌ First use /setupi'});const upiLink = `upi://pay?pa=${upi}&pn=ZYRO&am=${amount}&cu=INR`;const qr = await QRCode.toBuffer(upiLink);await interaction.editReply({ content: `UPI QR for ₹${amount}`, files: [{ attachment: qr, name: 'upi-qr.png' }] });}
    if (interaction.isCommand() && interaction.commandName === 'ltc') {const amount = interaction.options.getString('amount');const ltc = db.get(`ltc-${interaction.user.id}`);if (!ltc) return await interaction.reply({content: '❌ First use /setltc', ephemeral: true});const embed = new EmbedBuilder().setTitle('LTC Payment').setDescription(`**Address:** \`${ltc}\`\n**Amount:** ${amount} LTC\nSend exact amount.`).setColor(0x3452FF);await interaction.reply({ embeds: [embed] });}

    if (interaction.isCommand() && interaction.commandName === 'purge') {if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) return await interaction.reply({content: '❌ No perms', ephemeral: true});const amount = interaction.options.getInteger('amount');await interaction.deferReply({ephemeral: true});try {await interaction.channel.bulkDelete(amount, true);await interaction.editReply(`✅ Deleted ${amount} messages`);} catch (e) {await interaction.editReply(`❌ Failed. Max 100 messages and none older than 14 days.`);}}
    if (interaction.isCommand() && interaction.commandName === 'ban') {if (!interaction.memberPermissions.has(PermissionFlagsBits.BanMembers)) return await interaction.reply({content: '❌ No perms', ephemeral: true});const user = interaction.options.getUser('user');const reason = interaction.options.getString('reason') || 'No reason';await interaction.deferReply();await interaction.guild.members.ban(user, { reason });await interaction.editReply(`🔨 Banned ${user.tag} | Reason: ${reason}`);}
    if (interaction.isCommand() && interaction.commandName === 'kick') {if (!interaction.memberPermissions.has(PermissionFlagsBits.KickMembers)) return await interaction.reply({content: '❌ No perms', ephemeral: true});const user = interaction.options.getUser('user');const reason = interaction.options.getString('reason') || 'No reason';await interaction.deferReply();await interaction.guild.members.kick(user, reason);await interaction.editReply(`👢 Kicked ${user.tag} | Reason: ${reason}`);}
    if (interaction.isCommand() && interaction.commandName === 'timeout') {if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) return await interaction.reply({content: '❌ No perms', ephemeral: true});const user = interaction.options.getMember('user');const time = interaction.options.getInteger('time');await interaction.deferReply();await user.timeout(time * 1000);await interaction.editReply(`⏰ Timed out ${user} for ${time} seconds`);}

    if (interaction.isCommand() && interaction.commandName === 'slots') {const bet = interaction.options.getInteger('amount');const emojis = ['🍒', '🍋', '🔔', '💎', '7️⃣'];const result = [emojis[Math.floor(Math.random()*5)], emojis[Math.floor(Math.random()*5)], emojis[Math.floor(Math.random()*5)]];let win = result[0] === result[1] && result[1] === result[2];let payout = win? bet * 3 : 0;const embed = new EmbedBuilder().setTitle('🎰 ZYRO SLOTS').setDescription(`${result.join(' | ')}\n\n${win? `JACKPOT! You won ${payout}` : `You lost ${bet}`}`).setColor(win? 0xFFD700 : 0xED4245);await interaction.reply({ embeds: [embed] });}

  } catch (error) {console.error(error);if(!interaction.replied &&!interaction.deferred) await interaction.reply({content: `❌ Error: ${error.message}`, ephemeral: true});else if(interaction.deferred) await interaction.editReply({content: `❌ Error: ${error.message}`});}
});

const http = require('http');
http.createServer((req, res) => res.end('Bot is running')).listen(10000);
client.login(TOKEN);
