const { SlashCommandBuilder, EmbedBuilder, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
const { getData, saveData } = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin and bet on heads or tails!')
        .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
        .addStringOption(option =>
            option.setName('side')
                .setDescription('Pick heads or tails')
                .setRequired(true)
                .addChoices(
                    { name: '🪙 Heads', value: 'heads' },
                    { name: '🪙 Tails', value: 'tails' }
                ))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of coins to bet (leave empty for a free flip)')
                .setRequired(false)
                .setMinValue(1)),
    async execute(interaction) {
        let economyData = getData('economy');
        const userId = interaction.user.id;
        const chosenSide = interaction.options.getString('side');
        const betAmount = interaction.options.getInteger('amount');

        if (!economyData[userId]) {
            economyData[userId] = { coins: 0 };
        }

        if (betAmount && economyData[userId].coins < betAmount) {
            const errEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setDescription(`❌ You don't have enough coins. Your balance: **${economyData[userId].coins}**`);
            return interaction.reply({ embeds: [errEmbed], ephemeral: true });
        }

        // Check for lucky charm (only applies when betting)
        let luckyActive = false;
        if (betAmount) {
            const activeItems = getData('active_items');
            if (activeItems[userId] && activeItems[userId].lucky_charm) {
                luckyActive = true;
                activeItems[userId].lucky_charm = false;
                saveData('active_items', activeItems);
            }
        }

        // If lucky charm is active, bias the result toward the chosen side (70% chance)
        let result;
        if (luckyActive) {
            result = Math.random() < 0.7 ? chosenSide : (chosenSide === 'heads' ? 'tails' : 'heads');
        } else {
            result = Math.random() < 0.5 ? 'heads' : 'tails';
        }
        const won = chosenSide === result;

        const coinArt = result === 'heads' 
            ? '```\n  ┌─────────┐\n  │  ◉   ◉  │\n  │    ▽    │\n  │  ╰───╯  │\n  │  HEADS  │\n  └─────────┘\n```'
            : '```\n  ┌─────────┐\n  │ ╔═════╗ │\n  │ ║  ★  ║ │\n  │ ╚═════╝ │\n  │  TAILS  │\n  └─────────┘\n```';

        if (!betAmount) {
            const embed = new EmbedBuilder()
                .setTitle('🪙 Coin Flip!')
                .setColor(won ? '#2ecc71' : '#e74c3c')
                .setDescription(`${coinArt}\nThe coin landed on **${result}**!\nYou picked **${chosenSide}** — ${won ? '**You guessed right!** 🎉' : '**Wrong guess!** 😔'}`);
            return interaction.reply({ embeds: [embed] });
        }

        if (won) {
            economyData[userId].coins += betAmount;
            saveData('economy', economyData);
            const { updateQuestProgress } = require('../utils/questUtils');
            updateQuestProgress(userId, 'gamble_win', betAmount);

            const embed = new EmbedBuilder()
                .setTitle('🪙 Coin Flip — You Won!')
                .setColor('#2ecc71')
                .setDescription(`${coinArt}\nThe coin landed on **${result}**! You picked **${chosenSide}**.\n\n💰 You won **${betAmount} coins**!\nNew Balance: **${economyData[userId].coins}** coins.`);
            await interaction.reply({ embeds: [embed] });
        } else {
            economyData[userId].coins -= betAmount;
            saveData('economy', economyData);

            const embed = new EmbedBuilder()
                .setTitle('🪙 Coin Flip — You Lost!')
                .setColor('#e74c3c')
                .setDescription(`${coinArt}\nThe coin landed on **${result}**! You picked **${chosenSide}**.\n\n💸 You lost **${betAmount} coins**.\nNew Balance: **${economyData[userId].coins}** coins.`);
            await interaction.reply({ embeds: [embed] });
        }
    },
};
