const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'reaction_roles.json');

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
            return interaction.editReply({ content: 'Could not find that message ID in this channel! Please run this command in the same channel as the message.' });
        }

        try {
            await message.react(emojiStr);
        } catch (err) {
            return interaction.editReply({ content: `Failed to react to the message with Emoji \`${emojiStr}\`. Error: ${err.message}` });
        }

        let reactionData = {};
        if (fs.existsSync(dataPath)) {
            try {
                reactionData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
            } catch (err) {}
        }

        if (!reactionData[messageId]) {
            reactionData[messageId] = {};
        }

        let emojiKey = emojiStr;
        const customEmojiMatch = emojiStr.match(/<a?:.+:(\d+)>/);
        if (customEmojiMatch) {
            emojiKey = customEmojiMatch[1]; 
        }

        reactionData[messageId][emojiKey] = role.id;
        fs.writeFileSync(dataPath, JSON.stringify(reactionData, null, 2));

        await interaction.editReply({ content: `✅ Successfully bound emoji ${emojiStr} to role **${role.name}** on message \`${messageId}\`!` });
    },
};
