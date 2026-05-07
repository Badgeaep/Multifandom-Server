const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Create a simple announcement embed message.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option => 
            option.setName('message')
                .setDescription('The announcement message')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('title')
                .setDescription('The title of the announcement')
                .setRequired(false))
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('The channel to send the announcement to')
                .setRequired(false))
        .addStringOption(option => 
            option.setName('color')
                .setDescription('Hex color code (e.g. #ff0000) (default: blue)')
                .setRequired(false)),
                
    async execute(interaction) {
        const message = interaction.options.getString('message');
        const title = interaction.options.getString('title');
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const color = interaction.options.getString('color') || '#3498db';

        // Validate color string
        const colorRegex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
        const finalColor = colorRegex.test(color) ? color : '#3498db';

        const embed = new EmbedBuilder()
            .setDescription(message)
            .setColor(finalColor);
            
        if (title) {
            embed.setTitle(title);
        }

        try {
            await channel.send({ embeds: [embed] });
            const successEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setDescription(`✅ Announcement sent to ${channel}!`);
            await interaction.reply({ embeds: [successEmbed], ephemeral: true });
        } catch (error) {
            console.error('Failed to send announcement:', error);
            const errEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setDescription('❌ Failed to send announcement. Please make sure I have permission to send messages in that channel.');
            await interaction.reply({ embeds: [errEmbed], ephemeral: true });
        }
    },
};
