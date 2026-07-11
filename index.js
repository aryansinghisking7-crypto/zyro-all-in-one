const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder()
    .setName('setup-ticket')
    .setDescription('Setup the ticket system in this channel'),

  new SlashCommandBuilder()
    .setName('vouch')
    .setDescription('Give a vouch to a user')
    .addUserOption(option => 
      option.setName('user').setDescription('User to vouch').setRequired(true))
    .addStringOption(option => 
      option.setName('reason').setDescription('Reason for vouch').setRequired(true)),

  new SlashCommandBuilder()
    .setName('vouchlist')
    .setDescription('Show vouch list of a user')
    .addUserOption(option => 
      option.setName('user').setDescription('User to check').setRequired(true)),

  new SlashCommandBuilder()
    .setName('upiqr')
    .setDescription('Setup UPI QR for payments')
    .addAttachmentOption(option => 
      option.setName('qr').setDescription('Upload UPI QR image').setRequired(true)),

  new SlashCommandBuilder()
    .setName('ltc')
    .setDescription('Setup LTC wallet address')
    .addStringOption(option => 
      option.setName('address').setDescription('Your LTC wallet address').setRequired(true)),

  new SlashCommandBuilder()
    .setName('setupi')
    .setDescription('Setup UPI ID')
    .addStringOption(option => 
      option.setName('upi').setDescription('Your UPI ID').setRequired(true)),

  new SlashCommandBuilder()
    .setName('setltc')
    .setDescription('Set LTC address for a user')
    .addUserOption(option => 
      option.setName('user').setDescription('User').setRequired(true))
    .addStringOption(option => 
      option.setName('address').setDescription('LTC address').setRequired(true)),

  new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a member to current ticket')
    .addUserOption(option => 
      option.setName('user').setDescription('User to add').setRequired(true)),

  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a member from current ticket')
    .addUserOption(option => 
      option.setName('user').setDescription('User to remove').setRequired(true)),

  new SlashCommandBuilder()
    .setName('claim')
    .setDescription('Claim the current ticket'),

  new SlashCommandBuilder()
    .setName('unclaim')
    .setDescription('Unclaim the current ticket'),

  new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close the current ticket'),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption(option => 
      option.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(option => 
      option.setName('reason').setDescription('Reason for ban')),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption(option => 
      option.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(option => 
      option.setName('reason').setDescription('Reason for kick')),

  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a user')
    .addUserOption(option => 
      option.setName('user').setDescription('User to timeout').setRequired(true))
    .addIntegerOption(option => 
      option.setName('minutes').setDescription('Timeout duration in minutes').setRequired(true)),

  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete messages in channel')
    .addIntegerOption(option => 
      option.setName('amount').setDescription('Number of messages to delete').setRequired(true)),

  new SlashCommandBuilder()
    .setName('slots')
    .setDescription('Play slots game'),
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();
