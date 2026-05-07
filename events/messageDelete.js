const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        if (!message.guild || message.author?.bot) return;

        try {
            const logChannelName = 'admin-logs'; // Using channel name for now
            const logChannel = message.guild.channels.cache.find(c => c.name === logChannelName);
            
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🗑️ Message Deleted')
                    .setColor('#e74c3c')
                    .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                    .addFields(
                        { name: 'Channel', value: `${message.channel}`, inline: true },
                        { name: 'Message ID', value: message.id, inline: true },
                        { name: 'Content', value: message.content || 'None (possibly an embed/attachment)' }
                    )
                    .setTimestamp();
                
                await logChannel.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Error logging deleted message:', error);
        }

        // --- Counting Channel Delete Detection ---
        const { getData, saveData } = require('../db');
        const countingData = getData('counting');
        if (countingData && countingData.channelId && message.channel.id === countingData.channelId) {
            // If a valid number was deleted, reset the count to avoid confusion
            const deletedNum = parseInt(message.content?.trim());
            const currentCount = countingData.currentCount || 0;

            if (!isNaN(deletedNum) && deletedNum <= currentCount) {
                countingData.currentCount = 0;
                countingData.lastUserId = null;
                saveData('counting', countingData);

                const embed = new EmbedBuilder()
                    .setTitle('💥 Count Reset — Message Deleted!')
                    .setDescription(`A message was deleted in the counting channel!\nTo keep things fair, the count has been reset to **0**. Start again from **1**!`)
                    .setColor('#e74c3c');
                message.channel.send({ embeds: [embed] }).catch(() => {});
            }
        }

        // --- Word Chain Channel Delete Detection ---
        const chainData = getData('wordchain');
        if (chainData && chainData.channelId && message.channel.id === chainData.channelId) {
            const oldChain = chainData.chainLength || 0;
            if (oldChain > 0) {
                chainData.lastWord = null;
                chainData.lastUserId = null;
                chainData.chainLength = 0;
                chainData.usedWords = [];
                saveData('wordchain', chainData);

                const embed = new EmbedBuilder()
                    .setTitle('💔 Chain Broken — Message Deleted!')
                    .setDescription(`A message was deleted in the word chain channel!\nThe chain has ended at **${oldChain}** words. Start a new chain!`)
                    .setColor('#e74c3c');
                message.channel.send({ embeds: [embed] }).catch(() => {});
            }
        }
    },
};
