const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getData, saveData } = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ghost')
        .setDescription('[Admin] Manage Ghost Mode for yourself or others.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommandGroup(group =>
            group.setName('bot')
                .setDescription('Manage pings from the bot (levels, AI, etc.)')
                .addSubcommand(sub => sub.setName('on').setDescription('Enable Bot Ghost Mode indefinitely.').addUserOption(opt => opt.setName('user').setDescription('Target user (default: you)')) )
                .addSubcommand(sub => sub.setName('off').setDescription('Disable Bot Ghost Mode.').addUserOption(opt => opt.setName('user').setDescription('Target user (default: you)')))
                .addSubcommand(sub => sub.setName('timer')
                    .setDescription('Enable Bot Ghost Mode for a duration.')
                    .addStringOption(opt => opt.setName('duration').setDescription('e.g. 30m, 1h').setRequired(true))
                    .addUserOption(opt => opt.setName('user').setDescription('Target user (default: you)'))))
        .addSubcommandGroup(group =>
            group.setName('player')
                .setDescription('Manage pings from other players (marry, steal, chat, etc.)')
                .addSubcommand(sub => sub.setName('on').setDescription('Enable Player Ghost Mode indefinitely.').addUserOption(opt => opt.setName('user').setDescription('Target user (default: you)')))
                .addSubcommand(sub => sub.setName('off').setDescription('Disable Player Ghost Mode.').addUserOption(opt => opt.setName('user').setDescription('Target user (default: you)')))
                .addSubcommand(sub => sub.setName('timer')
                    .setDescription('Enable Player Ghost Mode for a duration.')
                    .addStringOption(opt => opt.setName('duration').setDescription('e.g. 30m, 1h').setRequired(true))
                    .addUserOption(opt => opt.setName('user').setDescription('Target user (default: you)'))))
        .addSubcommand(sub => 
            sub.setName('status')
                .setDescription('Check Ghost Mode status.')
                .addUserOption(opt => opt.setName('user').setDescription('Target user (default: you)'))),

    async execute(interaction) {
        const group = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userId = targetUser.id;
        let ghostData = getData('ghost_mode');

        // Migrate/Initialize user entry
        if (!ghostData[userId] || ghostData[userId].active !== undefined) {
             const oldData = ghostData[userId] || {};
             ghostData[userId] = {
                 bot: oldData.active !== undefined ? { active: oldData.active, expires: oldData.expires || null } : { active: false, expires: null },
                 player: { active: false, expires: null }
             };
        }

        if (subcommand === 'status') {
            const botGhost = ghostData[userId].bot;
            const playerGhost = ghostData[userId].player;

            const isBotActive = botGhost.active && (!botGhost.expires || botGhost.expires > Date.now());
            const isPlayerActive = playerGhost.active && (!playerGhost.expires || playerGhost.expires > Date.now());

            const embed = new EmbedBuilder()
                .setTitle(`📊 Ghost Mode Status: ${targetUser.username}`)
                .setColor(isBotActive || isPlayerActive ? '#95a5a6' : '#e74c3c')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { 
                        name: '🤖 Bot Ghost Mode', 
                        value: isBotActive 
                            ? `Active${botGhost.expires ? ` (Expires <t:${Math.floor(botGhost.expires/1000)}:R>)` : ' (Indefinite)'}` 
                            : 'Inactive', 
                        inline: true 
                    },
                    { 
                        name: '👤 Player Ghost Mode', 
                        value: isPlayerActive 
                            ? `Active${playerGhost.expires ? ` (Expires <t:${Math.floor(playerGhost.expires/1000)}:R>)` : ' (Indefinite)'}` 
                            : 'Inactive', 
                        inline: true 
                    }
                );

            return interaction.reply({ embeds: [embed] });
        }

        if (group === 'bot' || group === 'player') {
            const type = group;
            if (subcommand === 'on') {
                ghostData[userId][type] = { active: true, expires: null };
                saveData('ghost_mode', ghostData);

                const embed = new EmbedBuilder()
                    .setTitle(`👻 ${type === 'bot' ? 'Bot' : 'Player'} Ghost Mode Enabled`)
                    .setDescription(`Enabled **${type}** Ghost Mode indefinitely for **${targetUser.username}**.`)
                    .setColor('#95a5a6');

                return interaction.reply({ embeds: [embed] });
            }

            if (subcommand === 'off') {
                ghostData[userId][type] = { active: false, expires: null };
                saveData('ghost_mode', ghostData);

                const embed = new EmbedBuilder()
                    .setTitle(`🔔 ${type === 'bot' ? 'Bot' : 'Player'} Ghost Mode Disabled`)
                    .setDescription(`Disabled **${type}** Ghost Mode for **${targetUser.username}**.`)
                    .setColor('#2ecc71');

                return interaction.reply({ embeds: [embed] });
            }

            if (subcommand === 'timer') {
                const durationStr = interaction.options.getString('duration');
                const ms = parseDuration(durationStr);

                if (!ms) {
                    return interaction.reply({ 
                        content: '❌ Invalid duration format! Use something like `30m`, `1h`, or `1d`.', 
                        ephemeral: true 
                    });
                }

                const expires = Date.now() + ms;
                ghostData[userId][type] = { active: true, expires: expires };
                saveData('ghost_mode', ghostData);

                const timeLabel = formatDuration(ms);
                const embed = new EmbedBuilder()
                    .setTitle(`⌛ ${type === 'bot' ? 'Bot' : 'Player'} Ghost Mode Timer Set`)
                    .setDescription(`**${type}** Ghost Mode enabled for **${targetUser.username}** for **${timeLabel}**.\nExpires <t:${Math.floor(expires / 1000)}:R>.`)
                    .setColor('#3498db');

                return interaction.reply({ embeds: [embed] });
            }
        }
    }
};

function parseDuration(str) {
    const regex = /^(\d+)([smhd])$/i;
    const match = str.match(regex);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    switch (unit) {
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        default: return null;
    }
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours`;
    const days = Math.floor(hours / 24);
    return `${days} days`;
}
