const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Deletes up to 100 messages.')
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('Number of messages to delete (1-100)')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true))
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Filter by a specific user or bot')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');
        const user = interaction.options.getUser('user');

        try {
            let messages = await interaction.channel.messages.fetch({ limit: 100 });
            
            if (user) {
                // If user specified, filter from the fetched messages
                messages = messages.filter(m => m.author.id === user.id);
                // Limit to the requested amount
                messages = Array.from(messages.values()).slice(0, amount);
            } else {
                // Limit to the requested amount
                messages = Array.from(messages.values()).slice(0, amount);
            }

            if (messages.length === 0) {
                return interaction.reply({ content: '❌ No messages found to delete.', ephemeral: true });
            }

            const deleted = await interaction.channel.bulkDelete(messages, true);

            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setDescription(`✅ Successfully deleted **${deleted.size}** messages${user ? ` from ${user}` : ''}.`);
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error during purge:', error);
            
            // Log the error to the admin log channel
            const logChannelId = '1494775931053670430';
            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            if (logChannel) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('🚨 Command Error: Purge')
                    .setColor('#e74c3c')
                    .addFields(
                        { name: 'User', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
                        { name: 'Channel', value: `${interaction.channel.name} (${interaction.channel.id})`, inline: true },
                        { name: 'Error', value: `\`\`\`${error.message || error}\`\`\`` }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [errorEmbed] }).catch(() => {});
            }

            let errorMessage = '❌ There was an error trying to purge messages.';
            if (error.code === 50034) errorMessage = '❌ I cannot delete messages older than 14 days.';
            if (error.code === 50013) errorMessage = '❌ I do not have permission to manage messages in this channel.';
            
            await interaction.reply({ content: errorMessage, ephemeral: true }).catch(() => {});
        }
    },
};
