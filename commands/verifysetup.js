const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify_setup')
        .setDescription('Set up the verification system.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🔐 Server Verification')
            .setDescription('Click the button below to verify and gain access to the rest of the server.')
            .setColor('#f1c40f');

        const button = new ButtonBuilder()
            .setCustomId('verify_button')
            .setLabel('Verify')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(button);

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: 'Verification system setup complete!', ephemeral: true });
    },
};
