const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'closeTicket',
    async execute(interaction) {
        // Confirmation could be added here, but for now, we just close and delete.
        const closingEmbed = new EmbedBuilder().setColor('#e67e22').setDescription('🔒 Closing ticket in 5 seconds...');
        await interaction.reply({ embeds: [closingEmbed], ephemeral: true });
        
        setTimeout(async () => {
             try {
                 await interaction.channel.delete('Ticket closed by user');
             } catch (error) {
                 console.error('Failed to delete ticket channel:', error);
                 if (!interaction.deferred && !interaction.replied) {
                   const errEmbed = new EmbedBuilder().setColor('#e74c3c').setDescription('❌ Failed to close the ticket.');
                   await interaction.reply({ embeds: [errEmbed], ephemeral: true });
                 }
             }
        }, 5000);
    },
};
