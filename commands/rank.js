const { SlashCommandBuilder, EmbedBuilder, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
const { getData } = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Check your current chat level and XP.')
        .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Check another user\'s rank')
                .setRequired(false)),
    async execute(interaction) {
        let levelsData = getData('levels');

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const rawData = levelsData[targetUser.id] || {};
        const data = {
            xp: rawData.xp || 0,
            level: rawData.level || 1
        };

        const xpNeeded = data.level * 100;
        
        // Simple visual ASCII progress bar mapping
        const progress = Math.max(0, Math.min(100, Math.floor((data.xp / xpNeeded) * 100)));
        const blocks = Math.max(0, Math.min(10, Math.floor(progress / 10)));
        const bar = '🟩'.repeat(blocks) + '⬛'.repeat(10 - blocks);

        const embed = new EmbedBuilder()
            .setTitle(`📊 Rank for ${targetUser.username}`)
            .setColor('#3498db')
            .addFields(
                { name: '🌟 Level', value: `${data.level}`, inline: true },
                { name: '✨ Experience', value: `${data.xp} / ${xpNeeded} XP`, inline: true },
                { name: '📈 Progress', value: `${bar} ${progress}%`, inline: false }
            )
            .setThumbnail(targetUser.displayAvatarURL())
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    },
};
