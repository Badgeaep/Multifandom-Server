module.exports = {
    name: 'closeTicket',
    async execute(interaction) {
        // Confirmation could be added here, but for now, we just close and delete.
        await interaction.reply({ content: 'Closing ticket in 5 seconds...', ephemeral: true });
        
        setTimeout(async () => {
             try {
                 await interaction.channel.delete('Ticket closed by user');
             } catch (error) {
                 console.error('Failed to delete ticket channel:', error);
                 if (!interaction.deferred && !interaction.replied) {
                   await interaction.reply({ content: 'Failed to close the ticket.', ephemeral: true });
                 }
             }
        }, 5000);
    },
};
