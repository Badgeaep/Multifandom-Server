const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getData, saveData } = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wordchain')
        .setDescription('Word chain game management')
        .addSubcommand(sub =>
            sub.setName('setup')
                .setDescription('Set the word chain channel')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('The channel to use for word chain')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('record')
                .setDescription('View the server\'s longest chain'))
        .setDefaultMemberPermissions(null),
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        let chainData = getData('wordchain');
        if (!chainData) chainData = {};

        if (sub === 'setup') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return interaction.reply({ content: '❌ You need **Manage Channels** permission to do this.', ephemeral: true });
            }

            const channel = interaction.options.getChannel('channel');
            chainData.channelId = channel.id;
            chainData.lastWord = null;
            chainData.lastUserId = null;
            chainData.chainLength = 0;
            chainData.record = chainData.record || 0;
            chainData.usedWords = [];
            saveData('wordchain', chainData);

            const embed = new EmbedBuilder()
                .setTitle('🔤 Word Chain Activated!')
                .setDescription(`Word chain channel set to ${channel}!\n\n**Rules:**\n• Start with any word\n• Next word must start with the **last letter** of the previous word\n• Minimum **3 letters**\n• **No repeating** words\n• Wrong word = **chain breaks**`)
                .setColor('#9b59b6');
            await interaction.reply({ embeds: [embed] });

            try {
                const startEmbed = new EmbedBuilder()
                    .setTitle('🔤 Word Chain Started!')
                    .setDescription('Type any word to start the chain!\n\n• Next word must start with the **last letter** of the previous word\n• Min 3 letters, no repeats!')
                    .setColor('#9b59b6');
                await channel.send({ embeds: [startEmbed] });
            } catch (err) {
                console.error('Error sending word chain start message:', err);
            }
        }

        if (sub === 'record') {
            const record = chainData.record || 0;
            const chainLength = chainData.chainLength || 0;
            const embed = new EmbedBuilder()
                .setTitle('🔤 Word Chain Record')
                .setColor('#f1c40f')
                .addFields(
                    { name: '🏆 Longest Chain', value: `**${record} words**`, inline: true },
                    { name: '📊 Current Chain', value: `**${chainLength} words**`, inline: true }
                );
            await interaction.reply({ embeds: [embed] });
        }
    },
};
