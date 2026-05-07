const { SlashCommandBuilder, EmbedBuilder, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
const { getData, saveData } = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gamble')
        .setDescription('Bet your coins for a 50/50 chance to double them!')
        .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('Amount of coins to bet')
                .setRequired(true)
                .setMinValue(1)),
    async execute(interaction) {
        let economyData = getData('economy');
        const userId = interaction.user.id;
        const betAmount = interaction.options.getInteger('amount');

        if (!economyData[userId] || !economyData[userId].coins) {
            const errEmbed = new EmbedBuilder().setColor('#e74c3c').setDescription('❌ You don\'t have any coins to gamble! Use `/daily` first.');
            return interaction.reply({ embeds: [errEmbed], ephemeral: true });
        }

        if (economyData[userId].coins < betAmount) {
            const errEmbed = new EmbedBuilder().setColor('#e74c3c').setDescription(`❌ You don't have enough coins. Your balance: **${economyData[userId].coins}**`);
            return interaction.reply({ embeds: [errEmbed], ephemeral: true });
        }

        // Check for lucky charm
        let winChance = 0.5;
        const activeItems = getData('active_items');
        if (activeItems[userId] && activeItems[userId].lucky_charm) {
            winChance = 0.7;
            activeItems[userId].lucky_charm = false;
            saveData('active_items', activeItems);
        }

        const win = Math.random() < winChance;

        if (win) {
            economyData[userId].coins += betAmount;
            saveData('economy', economyData);
            
            const { updateQuestProgress } = require('../utils/questUtils');
            updateQuestProgress(userId, 'gamble_win', betAmount);
            
            const winEmbed = new EmbedBuilder()
                .setTitle('🎰 You Won!')
                .setColor('#2ecc71')
                .setDescription(`You bet **${betAmount}** and doubled it!\nNew Balance: **${economyData[userId].coins}** coins.`);
            await interaction.reply({ embeds: [winEmbed] });
        } else {
            economyData[userId].coins -= betAmount;
            saveData('economy', economyData);
            
            const loseEmbed = new EmbedBuilder()
                .setTitle('🎰 You Lost...')
                .setColor('#e74c3c')
                .setDescription(`You bet **${betAmount}** and lost it all.\nNew Balance: **${economyData[userId].coins}** coins.`);
            await interaction.reply({ embeds: [loseEmbed] });
        }
    },
};
