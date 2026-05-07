const { Events, EmbedBuilder } = require('discord.js');
const { getData, saveData } = require('../db');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage, client) {
        // Ignore bots and DMs
        if (!newMessage.guild || newMessage.author?.bot) return;

        // --- Counting Channel Edit Detection ---
        const countingData = getData('counting');
        if (countingData && countingData.channelId && newMessage.channel.id === countingData.channelId) {
            // Someone edited a message in the counting channel — this is cheating!
            // Delete the edited message and reset the count
            const editor = newMessage.author?.username || 'Someone';

            // Check if this edited message was part of the current count
            // (i.e. was it at or below the current count position)
            const editedNum = parseInt(oldMessage.content?.trim());
            const currentCount = countingData.currentCount || 0;

            if (!isNaN(editedNum) && editedNum <= currentCount) {
                // They edited a message that was part of the active count — reset!
                countingData.currentCount = 0;
                countingData.lastUserId = null;
                saveData('counting', countingData);

                await newMessage.delete().catch(() => {});

                const embed = new EmbedBuilder()
                    .setTitle('💥 Count Reset — Edit Detected!')
                    .setDescription(`**${editor}** edited their message in the counting channel!\nEditing is not allowed — the count has been reset to **0**. Start again from **1**!`)
                    .setColor('#e74c3c');
                newMessage.channel.send({ embeds: [embed] }).catch(() => {});
            } else {
                // They edited a message that wasn't part of the count, just delete it
                await newMessage.delete().catch(() => {});
            }
            return;
        }

        // --- Word Chain Channel Edit Detection ---
        const chainData = getData('wordchain');
        if (chainData && chainData.channelId && newMessage.channel.id === chainData.channelId) {
            // Editing in word chain = chain breaks
            const editor = newMessage.author?.username || 'Someone';
            const oldChain = chainData.chainLength || 0;

            if (oldChain > 0) {
                chainData.lastWord = null;
                chainData.lastUserId = null;
                chainData.chainLength = 0;
                chainData.usedWords = [];
                saveData('wordchain', chainData);

                await newMessage.delete().catch(() => {});

                const embed = new EmbedBuilder()
                    .setTitle('💔 Chain Broken — Edit Detected!')
                    .setDescription(`**${editor}** edited their message in the word chain channel!\nEditing is not allowed — chain ended at **${oldChain}** words. Start a new chain!`)
                    .setColor('#e74c3c');
                newMessage.channel.send({ embeds: [embed] }).catch(() => {});
            } else {
                await newMessage.delete().catch(() => {});
            }
            return;
        }
    },
};
