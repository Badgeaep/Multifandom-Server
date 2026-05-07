const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getData } = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Get detailed information about a user (Administrator Only).')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to get info about')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        const levelsData = getData('levels');
        const warningsData = getData('warnings');
        const userData = getData('userdata');

        const uLevel = levelsData[targetUser.id] || { level: 1, xp: 0 };
        const uWarnings = warningsData[targetUser.id] || 0;
        const uData = userData[targetUser.id] || {};

        let verifiedText = 'Not Verified or Unknown';
        if (uData.verifiedAt) {
            verifiedText = `<t:${Math.floor(uData.verifiedAt / 1000)}:R> (<t:${Math.floor(uData.verifiedAt / 1000)}:f>)`;
        } else if (targetMember && targetMember.roles.cache.has('1494777803881713904')) {
            verifiedText = 'Verified (Before Tracking)';
        }

        const embed = new EmbedBuilder()
            .setTitle(`🔍 User Info: ${targetUser.tag}`)
            .setColor('#9b59b6')
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '🆔 User ID', value: targetUser.id, inline: true },
                { name: '🤖 Is Bot?', value: targetUser.bot ? 'Yes' : 'No', inline: true },
                { name: '📅 Account Created', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: false },
                { name: '🌟 Level & XP', value: `Level: **${uLevel.level}**\nXP: **${uLevel.xp}**`, inline: true },
                { name: '🚨 Automod Warnings', value: `**${uWarnings}** warnings`, inline: true },
                { name: '✅ Verification', value: verifiedText, inline: false }
            );

        if (targetMember) {
            const isTimedOut = targetMember.isCommunicationDisabled() ? `<t:${Math.floor(targetMember.communicationDisabledUntilTimestamp / 1000)}:R>` : 'No';
            const isBoosting = targetMember.premiumSinceTimestamp ? `<t:${Math.floor(targetMember.premiumSinceTimestamp / 1000)}:R>` : 'Not boosting';
            
            embed.addFields(
                { name: '📌 Server Nickname', value: targetMember.nickname || 'None', inline: true },
                { name: '📥 Joined Server', value: `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: '👑 Highest Role', value: targetMember.roles.highest ? targetMember.roles.highest.toString() : 'None', inline: true },
                { name: '🔇 Timed Out?', value: isTimedOut, inline: true },
                { name: '💎 Server Booster', value: isBoosting, inline: true },
                { name: '🎭 Roles', value: targetMember.roles.cache.map(r => r).join(', ').substring(0, 1024) || 'None', inline: false }
            );
        } else {
            embed.setDescription('⚠️ User is not currently in the server.');
        }

        await interaction.reply({ embeds: [embed] });
    },
};
