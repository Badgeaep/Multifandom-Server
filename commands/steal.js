const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getData, saveData } = require('../db');

const stealCooldowns = new Map();
const STEAL_COOLDOWN = 60 * 60 * 1000; // 1 hour cooldown

module.exports = {
    data: new SlashCommandBuilder()
        .setName('steal')
        .setDescription('Attempt to steal coins from another user... risky!')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user you want to rob')
                .setRequired(true)),
    async execute(interaction) {
        let economyData = getData('economy');
        const thiefId = interaction.user.id;
        const target = interaction.options.getUser('target');

        // Can't steal from yourself
        if (target.id === thiefId) {
            return interaction.reply({ 
                embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription('❌ You can\'t steal from yourself lmao.')], 
                ephemeral: true 
            });
        }

        // Can't steal from bots
        if (target.bot) {
            return interaction.reply({ 
                embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription('❌ You can\'t steal from a bot.')], 
                ephemeral: true 
            });
        }

        // Cooldown check
        const now = Date.now();
        const lastSteal = stealCooldowns.get(thiefId) || 0;
        if (now - lastSteal < STEAL_COOLDOWN) {
            const timeLeft = STEAL_COOLDOWN - (now - lastSteal);
            const minutes = Math.floor(timeLeft / (1000 * 60));
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(`⏳ You're laying low after your last heist. Try again in **${minutes}m**.`)],
                ephemeral: true
            });
        }

        // Check if target has a steal shield active
        const activeItems = getData('active_items');
        if (activeItems[target.id] && activeItems[target.id].steal_shield && activeItems[target.id].steal_shield > Date.now()) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#3498db').setDescription(`🛡️ **${target.username}** has an active Steal Shield! You can't rob them right now.`)],
                ephemeral: true
            });
        }

        // Init economy data
        if (!economyData[thiefId]) economyData[thiefId] = { coins: 0 };
        if (!economyData[target.id]) economyData[target.id] = { coins: 0 };

        const thiefCoins = economyData[thiefId].coins;
        const targetCoins = economyData[target.id].coins;

        // Need coins to steal (you're risking something)
        if (thiefCoins < 50) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription('❌ You need at least **50 coins** to attempt a robbery (you risk losing them).')],
                ephemeral: true
            });
        }

        // Target needs coins worth stealing
        if (targetCoins < 20) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(`❌ **${target.username}** is broke, there's nothing to steal.`)],
                ephemeral: true
            });
        }

        stealCooldowns.set(thiefId, now);

        // 40% success, 60% fail — stealing should be risky
        const success = Math.random() < 0.4;

        if (success) {
            // Steal 10-30% of the target's coins
            const stealPercent = (Math.random() * 0.2) + 0.1; // 10% to 30%
            const stolenAmount = Math.max(1, Math.floor(targetCoins * stealPercent));

            economyData[thiefId].coins += stolenAmount;
            economyData[target.id].coins -= stolenAmount;
            saveData('economy', economyData);

            const embed = new EmbedBuilder()
                .setTitle('🦹 Heist Successful!')
                .setColor('#2ecc71')
                .setDescription(
                    `You snuck into **${target.username}**'s wallet and swiped **${stolenAmount} coins**! 💰\n\n` +
                    `Your Balance: **${economyData[thiefId].coins}** coins\n` +
                    `${target.username}'s Balance: **${economyData[target.id].coins}** coins`
                )
                .setFooter({ text: 'Crime pays... sometimes.' });
            await interaction.reply({ embeds: [embed] });
        } else {
            // Fail — lose 10-25% of YOUR coins as a fine
            const finePercent = (Math.random() * 0.15) + 0.1; // 10% to 25%
            const fineAmount = Math.max(1, Math.floor(thiefCoins * finePercent));

            economyData[thiefId].coins -= fineAmount;
            // Give the fine to the target as compensation
            economyData[target.id].coins += fineAmount;
            saveData('economy', economyData);

            const failMessages = [
                `You tripped over a rock trying to rob **${target.username}** and got caught! 🚔`,
                `**${target.username}** caught you red-handed and called the cops! 👮`,
                `You dropped your disguise running away from **${target.username}**'s house! 🎭`,
                `**${target.username}** was waiting for you with a baseball bat. Bad idea. 🏏`,
                `You got spotted by a security camera outside **${target.username}**'s vault! 📸`,
                `**${target.username}**'s guard dog chased you 3 blocks and you lost your wallet! 🐕`,
            ];
            const failMsg = failMessages[Math.floor(Math.random() * failMessages.length)];

            const embed = new EmbedBuilder()
                .setTitle('🚨 Heist Failed!')
                .setColor('#e74c3c')
                .setDescription(
                    `${failMsg}\n\n` +
                    `You were fined **${fineAmount} coins** (paid to ${target.username} as compensation).\n\n` +
                    `Your Balance: **${economyData[thiefId].coins}** coins\n` +
                    `${target.username}'s Balance: **${economyData[target.id].coins}** coins`
                )
                .setFooter({ text: 'Crime doesn\'t always pay.' });
            await interaction.reply({ embeds: [embed] });
        }
    },
};
