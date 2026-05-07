const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'createTicket',
    async execute(interaction) {
        const guild = interaction.guild;
        const user = interaction.user;

        // Create the ticket channel
        const ticketChannel = await guild.channels.create({
            name: `ticket-${user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                {
                    id: guild.id, // @everyone
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                },
                // Add any support team roles here if needed
            ],
        });

        // Send welcome message in the new ticket channel
        const embed = new EmbedBuilder()
            .setTitle('Ticket Support')
            .setDescription(`Welcome ${user}! Support will be with you shortly.\n\nClick the button below to close this ticket.`)
            .setColor('#2ecc71');

        const button = new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Close Ticket')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(button);

        await ticketChannel.send({ content: `${user}`, embeds: [embed], components: [row] });
        const replyEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setDescription(`✅ Your ticket has been created: ${ticketChannel}`);
        await interaction.reply({ embeds: [replyEmbed], ephemeral: true });
    },
};
