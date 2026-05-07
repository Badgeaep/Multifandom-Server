const { SlashCommandBuilder, EmbedBuilder, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
const { getData, saveData } = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily coins!')
        .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall]),
    async execute(interaction) {
        let economyData = getData('economy');
        const userId = interaction.user.id;

        if (!economyData[userId]) {
            economyData[userId] = { coins: 0, lastDaily: 0 };
        }

        const now = Date.now();
        const cooldown = 24 * 60 * 60 * 1000; // 24 hours
        const lastDaily = economyData[userId].lastDaily || 0;

        if (now - lastDaily < cooldown) {
            const timeLeft = cooldown - (now - lastDaily);
            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            
            const errEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setDescription(`⏳ You already claimed your daily coins! Come back in **${hours}h ${minutes}m**.`);
            return interaction.reply({ embeds: [errEmbed], ephemeral: true });
        }

        const amount = Math.floor(Math.random() * (300 - 100 + 1)) + 100; // 100 to 300
        
        // Check for daily bonus upgrade from shop
        const inventoryData = getData('inventory');
        const userInventory = inventoryData[userId] || [];
        const hasDailyBonus = userInventory.find(i => i.id === 'daily_bonus');
        const bonusAmount = hasDailyBonus ? 50 : 0;
        const totalAmount = amount + bonusAmount;
        
        economyData[userId].coins += totalAmount;
        economyData[userId].lastDaily = now;
        
        saveData('economy', economyData);
        const { updateQuestProgress } = require('../utils/questUtils');
        updateQuestProgress(userId, 'daily_claim');

        const bonusText = bonusAmount > 0 ? ` (+${bonusAmount} 💎 Daily Bonus)` : '';
        const successEmbed = new EmbedBuilder()
            .setTitle('🎁 Daily Coins')
            .setColor('#f1c40f')
            .setDescription(`You claimed your daily reward of **${totalAmount} coins**!${bonusText}\nYou now have **${economyData[userId].coins}** coins.`)
            .setThumbnail(interaction.user.displayAvatarURL());
            
        await interaction.reply({ embeds: [successEmbed] });
    },
};
