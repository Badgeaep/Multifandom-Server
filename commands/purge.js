const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

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
            const messages = await interaction.channel.messages.fetch({ limit: amount });
            let filteredMessages = messages;

            if (user) {
                 filteredMessages = messages.filter(m => m.author.id === user.id);
            }

            await interaction.channel.bulkDelete(filteredMessages, true);
            await interaction.reply({ content: `Successfully deleted ${filteredMessages.size} messages${user ? ` from ${user.username}` : ''}.`, ephemeral: true });
        } catch (error) {
            console.error('Error during purge:', error);
            await interaction.reply({ content: 'There was an error trying to purge messages. Note that I cannot delete messages older than 14 days.', ephemeral: true });
        }
    },
};
