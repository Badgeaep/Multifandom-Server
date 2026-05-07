const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getData, saveData } = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reactionrole')
        .setDescription('Bind an emoji reaction to a role on a specific message.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option => 
            option.setName('message_id')
                .setDescription('The ID of the message to bind to (must be in this channel)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('emoji')
                .setDescription('The emoji to react with (e.g., 🍎 or a raw custom emoji)')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to assign when someone reacts')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const messageId = interaction.options.getString('message_id');
        const emojiStr = interaction.options.getString('emoji');
        const role = interaction.options.getRole('role');

        let message;
        try {
            message = await interaction.channel.messages.fetch(messageId);
        } catch (err) {
            const errEmbed = new EmbedBuilder().setColor('#e74c3c').setDescription('❌ Could not find that message ID in this channel! Please run this command in the same channel as the message.');
            return interaction.editReply({ embeds: [errEmbed] });
        }

        try {
            await message.react(emojiStr);
        } catch (err) {
            const errEmbed = new EmbedBuilder().setColor('#e74c3c').setDescription(`❌ Failed to react to the message with Emoji \`${emojiStr}\`. Error: ${err.message}`);
            return interaction.editReply({ embeds: [errEmbed] });
        }

        let reactionData = getData('reaction_roles');

        if (!reactionData[messageId]) {
            reactionData[messageId] = {};
        }

        let emojiKey = emojiStr;
        const customEmojiMatch = emojiStr.match(/<a?:.+:(\d+)>/);
        if (customEmojiMatch) {
            emojiKey = customEmojiMatch[1]; 
        }

        reactionData[messageId][emojiKey] = role.id;
        saveData('reaction_roles', reactionData);

        const successEmbed = new EmbedBuilder().setColor('#2ecc71').setDescription(`✅ Successfully bound emoji ${emojiStr} to role **${role.name}** on message \`${messageId}\`!`);
        await interaction.editReply({ embeds: [successEmbed] });
    },
};
