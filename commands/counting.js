const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getData, saveData } = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('counting')
        .setDescription('Counting game management')
        .addSubcommand(sub =>
            sub.setName('setup')
                .setDescription('Set the counting channel')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('The channel to use for counting')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('highscore')
                .setDescription('View the server\'s highest count'))
        .setDefaultMemberPermissions(null),
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        let countingData = getData('counting');
        if (!countingData) countingData = {};

        if (sub === 'setup') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return interaction.reply({ content: '❌ You need **Manage Channels** permission to do this.', ephemeral: true });
            }

            const channel = interaction.options.getChannel('channel');
            countingData.channelId = channel.id;
            countingData.currentCount = 0;
            countingData.lastUserId = null;
            countingData.highScore = countingData.highScore || 0;
            saveData('counting', countingData);

            const embed = new EmbedBuilder()
                .setTitle('🔢 Counting Game Activated!')
                .setDescription(`Counting channel set to ${channel}!\n\n**Rules:**\n• Count up from **1**\n• You can't count **twice in a row**\n• Wrong number = **reset to 0**\n• Earn coins at milestones (50, 100, etc.)`)
                .setColor('#3498db');
            await interaction.reply({ embeds: [embed] });

            // Send a starting message in the counting channel
            try {
                const startEmbed = new EmbedBuilder()
                    .setTitle('🔢 Counting Game Started!')
                    .setDescription('Start counting from **1**!\n\n• One number per person\n• No counting twice in a row\n• Wrong number resets the count!')
                    .setColor('#3498db');
                await channel.send({ embeds: [startEmbed] });
            } catch (err) {
                console.error('Error sending counting start message:', err);
            }
        }

        if (sub === 'highscore') {
            const highScore = countingData.highScore || 0;
            const currentCount = countingData.currentCount || 0;
            const embed = new EmbedBuilder()
                .setTitle('🔢 Counting Highscore')
                .setColor('#f1c40f')
                .addFields(
                    { name: '🏆 All-Time High', value: `**${highScore}**`, inline: true },
                    { name: '📊 Current Count', value: `**${currentCount}**`, inline: true }
                );
            await interaction.reply({ embeds: [embed] });
        }
    },
};
