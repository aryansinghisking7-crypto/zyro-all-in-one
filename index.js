const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, REST, Routes } = require('discord.js');
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

// Anti-spam tracker
const spamMap = new Map();
const claimedTickets = new Map(); // ticketID: userID

// ===== SLASH COMMANDS =====
const commands = [
  { name: 'setup-ticket', description: 'Setup the ZYRO ticket panel' },
  { name: 'add', description: 'Add user to ticket', options: [{name: 'user', type: 6, required: true}] },
  { name: 'remove', description: 'Remove user from ticket', options: [{name: 'user', type: 6, required: true}] },
  { name: 'close', description: 'Close this ticket' },
  { name: 'claim', description: 'Claim this ticket' },
  { name: 'unclaim', description: 'Unclaim this ticket' },
  { name: 'vouch', description: 'Give vouch', options: [{name: 'user', type: 6, required: true}, {name: 'item', type: 3, required: true}, {name: 'price', type: 3, required: true}] },
  { name: 'vouchlist', description: 'Check vouches of a user', options: [{name: 'user', type: 6, required: true}] },
  { name: 'setupi', description: 'Save your UPI ID', options: [{name: 'upi_id', type: 3, required: true}] },
  { name: 'setltc', description: 'Save your LTC Address', options: [{name: 'ltc', type: 3, required: true}] },
  { name: 'upiqr', description: 'Generate UPI QR', options: [{name: 'amount', type: 3, required: true}] },
  { name: 'ltc', description: 'Get LTC payment info', options: [{name: 'amount', type: 3, required: true}] },
  { name: 'purge', description: 'Delete messages', options: [{name: 'amount', type: 4, required: true}] },
  { name: 'ban', description: 'Ban user', options: [{name: 'user', type: 6, required: true}, {name: 'reason', type: 3, required: false}] },
  { name: 'kick', description: 'Kick user', options: [{name: 'user', type: 6, required: true}, {name: 'reason', type: 3, required: false}] },
  { name: 'timeout', description: 'Timeout user', options: [{name: 'user', type: 6, required: true}, {name: 'time', type: 4, required: true}] },
  { name: 'slots', description: 'Casino slots - bet amount', options: [{name: 'amount', type: 4, required: true}] },
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} is online!`);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log('✅ Commands registered');
});

// ===== ANTI-SPAM AUTO MOD =====
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
    // ===== TICKET PANEL =====
    if (interaction.isCommand() && interaction.commandName === 'setup-ticket') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) return await interaction.reply({content: '❌ Admin only', ephemeral: true});
      
      const embed = new EmbedBuilder()
    .setTitle('🎫 ZYRO Ticket System')
    .setDescription(`Welcome to the ZYRO Ticket System — your fast, secure, and professional support center.
Whether you need customer support, purchase assistance, order help, reports, partnerships, or general inquiries, our dedicated team is here to assist you as quickly as possible.
✨ **Why choose ZYRO?**
- ⚡ Fast response times
- 🔒 Private and secure tickets
- 👥 Professional support staff
- 💬 Friendly and reliable assistance
- ✅ Organized ticket management
Please create only one ticket per issue and provide all necessary details so we can help you efficiently.
Thank you for choosing ZYRO. We appreciate your patience and look forward to assisting you!`)
    .setColor(0x5865F2)
    .setThumbnail(client.user.displayAvatarURL())
    .setFooter({ text: 'ZYRO ALL IN ONE', iconURL: client.user.displayAvatarURL() });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('create_ticket').setLabel('Create Ticket').setStyle(ButtonStyle.Primary).setEmoji('🎫')
      );
      await interaction.reply({ embeds: [embed], components: [row] });
    }

    // ===== CREATE TICKET =====
    if (interaction.isButton() && interaction.customId === 'create_ticket') {
      await interaction.deferReply({ephemeral: true});
      const ticket = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: interaction.channel.parentId,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
          { id: SUPPORT_ROLE, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] }
        ]
      });

      claimedTickets.delete(ticket.id);

      const embed = new EmbedBuilder()
    .setDescription(`Hello <@${interaction.user.id}>,
A staff member will be with you shortly.
Please describe your issue in detail.`)
    .setFooter({ text: 'Powered by ZYRO', iconURL: client.user.displayAvatarURL() })
    .setColor(0x2B2D31);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
        new ButtonBuilder().setCustomId('close_reason').setLabel('Close With Reason').setStyle(ButtonStyle.Danger).setEmoji('📝'),
        new ButtonBuilder().setCustomId('unclaim_btn').setLabel('Unclaim').setStyle(ButtonStyle.Secondary).setEmoji('🙋')
      );

      await ticket.send({ content: `<@&${SUPPORT_ROLE}> <@${interaction.user.id}>`, embeds: [embed], components: [row] });
      await interaction.editReply({content: `✅ Ticket created: ${ticket}`});
    }

    // ===== TICKET BUTTONS =====
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
      if (!interaction.member.roles.cache.has(SUPPORT_ROLE)) return await interaction.reply({content: '❌ Only Support can close', ephemeral: true});
      await interaction.reply('Closing ticket in 5s...');
      claimedTickets.delete(interaction.channel.id);
      setTimeout(() => interaction.channel.delete(), 5000);
    }

    if (interaction.isButton() && interaction.customId === 'close_reason') {
      if (!interaction.member.roles.cache.has(SUPPORT_ROLE)) return await interaction.reply({content: '❌ Only Support can close', ephemeral: true});
      const modal = new ModalBuilder().setCustomId('close_modal').setTitle('Close Ticket With Reason');
      const reasonInput = new TextInputBuilder().setCustomId('reason').setLabel("Reason for closing").setStyle(TextInputStyle.Paragraph).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
      await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'close_modal') {
      const reason = interaction.fields.getTextInputValue('reason');
      await interaction.reply(`Ticket closed by ${interaction.user} for: \`${reason}\``);
      claimedTickets.delete(interaction.channel.id);
      setTimeout(() => interaction.channel.delete(), 5000);
    }

    if (interaction.isButton() && interaction.customId === 'unclaim_btn') {
      if (claimedTickets.get(interaction.channel.id)!== interaction.user.id) return await interaction.reply({content: '❌ You did not claim this ticket', ephemeral: true});
      claimedTickets.delete(interaction.channel.id);
      await interaction.reply(`🙋 Ticket unclaimed by ${interaction.user}`);
    }

    // ===== TICKET COMMANDS =====
    if (interaction.isCommand() && interaction.commandName === 'add') {
      if (!interaction.channel.name.startsWith('ticket-')) return await interaction.reply({content: 'Use in ticket only', ephemeral: true});
      const user = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true });
      await interaction.reply(`✅ Added ${user} to ticket`);
    }

    if (interaction.isCommand() && interaction.commandName === 'remove') {
      if (!interaction.channel.name.startsWith('ticket-')) return await interaction.reply({content: 'Use in ticket only', ephemeral: true});
      const user = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: false });
      await interaction.reply(`✅ Removed ${user} from ticket`);
    }

    if (interaction.isCommand() && interaction.commandName === 'claim') {
      if (!interaction.channel.name.startsWith('ticket-')) return await interaction.reply({content: 'Use in ticket only', ephemeral: true});
      if (!interaction.member.roles.cache.has(SUPPORT_ROLE)) return await interaction.reply({content: '❌ Only Support can claim', ephemeral: true});
      if (claimedTickets.has(interaction.channel.id)) {
        return await interaction.reply({content: `❌ Already claimed by <@${claimedTickets.get(interaction.channel.id)}>`, ephemeral: true});
      }
      claimedTickets.set(interaction.channel.id, interaction.user.id);
      const embed = new EmbedBuilder().setDescription(`🎫 **${interaction.user} has claimed this ticket**`).setColor(0x57F287);
      await interaction.reply({ embeds: [embed] });
    }

    if (interaction.isCommand() && interaction.commandName === 'unclaim') {
      if (!interaction.channel.name.startsWith('ticket-')) return await interaction.reply({content: 'Use in ticket only', ephemeral: true});
      if (claimedTickets.get(interaction.channel.id)!== interaction.user.id) return await interaction.reply({content: '❌ You did not claim this ticket', ephemeral: true});
      claimedTickets.delete(interaction.channel.id);
      await interaction.reply(`🙋 Ticket unclaimed`);
    }

    if (interaction.isCommand() && interaction.commandName === 'close') {
      if (!interaction.channel.name.startsWith('ticket-')) return await interaction.reply({content: 'Use in ticket only', ephemeral: true});
      await interaction.reply('Closing in 5s...');
      claimedTickets.delete(interaction.channel.id);
      setTimeout(() => interaction.channel.delete(), 5000);
    }

    // ===== VOUCH SYSTEM =====
    if (interaction.isCommand() && interaction.commandName === 'vouch') {
      const user = interaction.options.getUser('user');
      const item = interaction.options.getString('item');
      const price = interaction.options.getString('price');
      let vouches = db.get(`vouches-${user.id}`) || [];
      vouches.push({ by: interaction.user.tag, item, price, date: new Date().toLocaleDateString() });
      db.set(`vouches-${user.id}`, vouches);
      const embed = new EmbedBuilder().setTitle('✅ New Vouch!').setDescription(`**To:** ${user}\n**Item:** ${item}\n**Price:** ${price}\n**By:** ${interaction.user}`).setColor(0x57F287);
      await interaction.reply({ embeds: [embed] });
    }

    if (interaction.isCommand() && interaction.commandName === 'vouchlist') {
      const user = interaction.options.getUser('user');
      let vouches = db.get(`vouches-${user.id}`) || [];
      if (vouches.length === 0) return await interaction.reply(`${user} has no vouches yet.`);
      const list = vouches.map((v, i) => `**${i+1}.** ${v.item} - \`${v.price}\` by ${v.by} on ${v.date}`).join('\n');
      const embed = new EmbedBuilder().setTitle(`Vouches for ${user.tag}`).setDescription(list).setColor(0x5865F2);
      await interaction.reply({ embeds: [embed] });
    }

    // ===== UPI / LTC SYSTEM =====
    if (interaction.isCommand() && interaction.commandName === 'setupi') {
      const upi = interaction.options.getString('upi_id');
      db.set(`upi-${interaction.user.id}`, upi);
      await interaction.reply({content: `✅ UPI saved! You won't need to enter again.`, ephemeral: true});
    }

    if (interaction.isCommand() && interaction.commandName === 'setltc') {
      const ltc = interaction.options.getString('ltc');
      db.set(`ltc-${interaction.user.id}`, ltc);
      await interaction.reply({content: `✅ LTC saved!`, ephemeral: true});
    }

    if (interaction.isCommand() && interaction.commandName === 'upiqr') {
      const amount = interaction.options.getString('amount');
      const upi = db.get(`upi-${interaction.user.id}`);
      if (!upi) return await interaction.reply({content: '❌ First use /setupi', ephemeral: true});
      const upiLink = `upi://pay?pa=${upi}&pn=ZYRO&am=${amount}&cu=INR`;
      const qr = await QRCode.toBuffer(upiLink);
      await interaction.reply({ content: `UPI QR for ₹${amount}`, files: [{ attachment: qr, name: 'upi-qr.png' }] });
    }

    if (interaction.isCommand() && interaction.commandName === 'ltc') {
      const amount = interaction.options.getString('amount');
      const ltc = db.get(`ltc-${interaction.user.id}`);
      if (!ltc) return await interaction.reply({content: '❌ First use /setltc', ephemeral: true});
      const embed = new EmbedBuilder().setTitle('LTC Payment').setDescription(`**Address:** \`${ltc}\`\n**Amount:** ${amount} LTC\nSend exact amount.`).setColor(0x3452FF);
      await interaction.reply({ embeds: [embed] });
    }

    // ===== MOD =====
    if (interaction.isCommand() && interaction.commandName === 'purge') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) return await interaction.reply({content: '❌ No perms', ephemeral: true});
      const amount = interaction.options.getInteger('amount');
      await interaction.channel.bulkDelete(amount);
      await interaction.reply({content: `✅ Deleted ${amount} messages`, ephemeral: true});
    }
    if (interaction.isCommand() && interaction.commandName === 'ban') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.BanMembers)) return await interaction.reply({content: '❌ No perms', ephemeral: true});
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason';
      await interaction.guild.members.ban(user, { reason });
      await interaction.reply(`🔨 Banned ${user.tag} | Reason: ${reason}`);
    }
    if (interaction.isCommand() && interaction.commandName === 'kick') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.KickMembers)) return await interaction.reply({content: '❌ No perms', ephemeral: true});
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason';
      await interaction.guild.members.kick(user, reason);
      await interaction.reply(`👢 Kicked ${user.tag} | Reason: ${reason}`);
    }
    if (interaction.isCommand() && interaction.commandName === 'timeout') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) return await interaction.reply({content: '❌ No perms', ephemeral: true});
      const user = interaction.options.getMember('user');
      const time = interaction.options.getInteger('time');
      await user.timeout(time * 1000);
      await interaction.reply(`⏰ Timed out ${user} for ${time} seconds`);
    }

    // ===== CASINO SLOTS =====
    if (interaction.isCommand() && interaction.commandName === 'slots') {
      const bet = interaction.options.getInteger('amount');
      const emojis = ['🍒', '🍋', '🔔', '💎', '7️⃣'];
      const result = [emojis[Math.floor(Math.random()*5)], emojis[Math.floor(Math.random()*5)], emojis[Math.floor(Math.random()*5)]];
      let win = result[0] === result[1] && result[1] === result[2];
      let payout = win? bet * 3 : 0;
      const embed = new EmbedBuilder().setTitle('🎰 ZYRO SLOTS').setDescription(`${result.join(' | ')}\n\n${win? `JACKPOT! You won ${payout}` : `You lost ${bet}`}`).setColor(win? 0xFFD700 : 0xED4245);
      await interaction.reply({ embeds: [embed] });
    }

  } catch (error) {
    console.error(error);
    if(!interaction.replied) await interaction.reply({content: `❌ Error: ${error.message}`, ephemeral: true});
  }
});

// Keep Render alive
const http = require('http');
http.createServer((req, res) => res.end('Bot is running')).listen(10000);
client.login(TOKEN);
