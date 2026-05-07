const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getData, saveData } = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nuke')
        .setDescription('EMERGENCY: Disable or enable all bot functions.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('state')
                .setDescription('Turn the nuke state ON (Emergency) or OFF (Normal)')
                .setRequired(true)
                .addChoices(
                    { name: 'ON - EMERGENCY MODE', value: 'on' },
                    { name: 'OFF - NORMAL MODE', value: 'off' }
                ))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason for this action')
                .setRequired(false)),

    async execute(interaction) {
        const state = interaction.options.getString('state');
        const reason = interaction.options.getString('reason') || 'No reason provided.';
        const config = getData('systemConfig');

        if (state === 'on') {
            config.nukeActive = true;
            config.nukeReason = reason;
            config.nukedBy = interaction.user.id;
            config.nukedAt = Date.now();
            saveData('systemConfig', config);

            const nukeEmbed = new EmbedBuilder()
                .setTitle('☢️ EMERGENCY NUKE ACTIVATED')
                .setColor('#ff4757')
                .setDescription('The bot has been put into **Emergency Lock-down Mode**. All non-administrative functions are now disabled.')
                .addFields(
                    { name: 'Reason', value: reason },
                    { name: 'Activated By', value: `<@${interaction.user.id}>` }
                )
                .setTimestamp()
                .setFooter({ text: 'Emergency Shutdown System' });

            await interaction.reply({ embeds: [nukeEmbed] });
        } else {
            config.nukeActive = false;
            saveData('systemConfig', config);

            const recoverEmbed = new EmbedBuilder()
                .setTitle('✅ BOT RESTORED')
                .setColor('#2ed573')
                .setDescription('The emergency lock-down has been lifted. All systems are back online.')
                .setTimestamp()
                .setFooter({ text: 'Emergency Shutdown System' });

            await interaction.reply({ embeds: [recoverEmbed] });
        }
    },
};
