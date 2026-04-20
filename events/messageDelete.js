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
    },
};
