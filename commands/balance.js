const { SlashCommandBuilder, EmbedBuilder, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
const { getData } = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your coin balance.')
        .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Check another user\'s balance')
                .setRequired(false)),
    async execute(interaction) {
        const economyData = getData('economy');
        const targetUser = interaction.options.getUser('user') || interaction.user;
        
        const userData = economyData[targetUser.id] || { coins: 0 };
        const coins = userData.coins || 0;

        const embed = new EmbedBuilder()
            .setTitle(`💰 Balance for ${targetUser.username}`)
            .setColor('#f1c40f')
            .setDescription(`<@${targetUser.id}> currently has **${coins} coins**.`)
            .setThumbnail(targetUser.displayAvatarURL());
            
        await interaction.reply({ embeds: [embed] });
    },
};
