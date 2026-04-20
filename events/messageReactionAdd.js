const { Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'reaction_roles.json');

module.exports = {
    name: Events.MessageReactionAdd,
    async execute(reaction, user) {
        if (user.bot) return;

        // When a reaction is received on an old message, the reaction structure might be partial
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('Something went wrong when fetching the message:', error);
                return;
            }
        }

        if (!fs.existsSync(dataPath)) return;

        let reactionData;
        try {
            reactionData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
        } catch (err) {
            return;
        }

        const messageId = reaction.message.id;
        if (!reactionData[messageId]) return;

        const emojiKey = reaction.emoji.id ? reaction.emoji.id : reaction.emoji.name;
        const roleId = reactionData[messageId][emojiKey];

        if (roleId) {
            try {
                const member = await reaction.message.guild.members.fetch(user.id);
                if (member) {
                    await member.roles.add(roleId);
                }
            } catch (error) {
                console.error('Failed to add reaction role:', error);
            }
        }
    },
};
