const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { token } = require('./config.json');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

let serverTag = '';
let membersWithTag = [];

client.once('ready', async () => {
  console.log(`Connected with ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('start')
      .setDescription('Initializes the server tag and displays the number of members'),
    new SlashCommandBuilder()
      .setName('checkmembers')
      .setDescription('Displays the list of members with the server tag')
      .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands),
  ];

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('Deploying slash commands...');
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: commands.map(command => command.toJSON()),
    });
    console.log('Orders successfully deployed.');
  } catch (error) {
    console.error('Error deploying commands :', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'start') {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply('This command must be used in a server.');
      return;
    }

    serverTag = guild.name.toLowerCase().replace(/\s+/g, '');
    const memberCount = guild.memberCount;
    membersWithTag = guild.members.cache.filter(member => member.user.username.toLowerCase().includes(serverTag)).map(member => ({
      username: member.user.username,
      id: member.user.id,
    }));

    await interaction.reply({
      content: `Server tag : \`${serverTag}\`\nTotal number of memberss : ${memberCount}`,
    });
  } else if (commandName === 'checkmembers') {
    if (membersWithTag.length === 0) {
      await interaction.reply('No members with the tag found.');
      return;
    }

    const embeds = [];
    const membersPerPage = 10;
    const totalPages = Math.ceil(membersWithTag.length / membersPerPage);

    for (let i = 0; i < totalPages; i++) {
      const pageMembers = membersWithTag.slice(i * membersPerPage, (i + 1) * membersPerPage);
      const embed = new EmbedBuilder()
        .setTitle(`Membres avec le tag "${serverTag}" - Page ${i + 1}/${totalPages}`)
        .setColor('#0099ff')
        .setDescription(pageMembers.map(member => `${member.username} (${member.id})`).join('\n'));
      embeds.push(embed);
    }

    const buttons = [
      new ButtonBuilder().setCustomId('previous').setLabel('Précédent').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('next').setLabel('Suivant').setStyle(ButtonStyle.Secondary),
    ];

    const row = new ActionRowBuilder().addComponents(buttons);

    await interaction.reply({
      embeds: [embeds[0]],
      components: [row],
    });

    let currentPage = 0;

    const filter = i => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async i => {
      if (i.customId === 'next' && currentPage < totalPages - 1) {
        currentPage++;
      } else if (i.customId === 'previous' && currentPage > 0) {
        currentPage--;
      }

      await i.update({
        embeds: [embeds[currentPage]],
        components: [row],
      });
    });

    collector.on('end', () => {
      row.components.forEach(button => button.setDisabled(true));
      interaction.editReply({ components: [row] });
    });
  }
});

client.login(token);
