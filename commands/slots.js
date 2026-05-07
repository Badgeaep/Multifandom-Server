const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getData, saveData } = require('../db');

const symbols = ['🍒', '🍋', '🍇', '🔔', '💎', '7️⃣'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slots')
        .setDescription('Play the slots machine and win coins!')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of coins to bet')
                .setRequired(true)
                .setMinValue(1)),
    async execute(interaction) {
        let economyData = getData('economy');
        const userId = interaction.user.id;
        const betAmount = interaction.options.getInteger('amount');

        if (!economyData[userId] || economyData[userId].coins < betAmount) {
            return interaction.reply({ content: `❌ You don't have enough coins! Your balance: **${economyData[userId]?.coins || 0}**`, ephemeral: true });
        }

        const reel1 = symbols[Math.floor(Math.random() * symbols.length)];
        const reel2 = symbols[Math.floor(Math.random() * symbols.length)];
        const reel3 = symbols[Math.floor(Math.random() * symbols.length)];

        const isWin = (reel1 === reel2 && reel2 === reel3);
        const isPartial = (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) && !isWin;

        let multiplier = 0;
        let resultText = '';

        if (isWin) {
            multiplier = 5;
            resultText = '🎰 **JACKPOT!** 🎰';
        } else if (isPartial) {
            multiplier = 2;
            resultText = '✨ **Partial Win!** ✨';
        } else {
            multiplier = 0;
            resultText = '❌ **Better luck next time!** ❌';
        }

        const winAmount = betAmount * multiplier;
        if (multiplier > 0) {
            economyData[userId].coins += (winAmount - betAmount); // winAmount includes the bet back, but we already have the coins in db, so we add the profit
        } else {
            economyData[userId].coins -= betAmount;
        }
        
        saveData('economy', economyData);
        if (multiplier > 0) {
            const { updateQuestProgress } = require('../utils/questUtils');
            updateQuestProgress(userId, 'gamble_win', winAmount - betAmount);
        }

        const embed = new EmbedBuilder()
            .setTitle('🎰 Slots Machine')
            .setDescription(`**[ ${reel1} | ${reel2} | ${reel3} ]**\n\n${resultText}`)
            .setColor(isWin ? '#f1c40f' : (isPartial ? '#2ecc71' : '#e74c3c'))
            .addFields(
                { name: 'Bet', value: `${betAmount} coins`, inline: true },
                { name: 'Result', value: multiplier > 0 ? `+${winAmount} coins` : `-${betAmount} coins`, inline: true },
                { name: 'New Balance', value: `${economyData[userId].coins} coins`, inline: true }
            );

        await interaction.reply({ embeds: [embed] });
    },
};
