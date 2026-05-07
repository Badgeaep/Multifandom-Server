const { Events } = require('discord.js');
const { getData } = require('../db');

module.exports = {
    name: Events.MessageReactionRemove,
    async execute(reaction, user) {
        if (user.bot) return;

        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('Something went wrong when fetching the message:', error);
                return;
            }
        }

        let reactionData = getData('reaction_roles');

        const messageId = reaction.message.id;
        if (!reactionData[messageId]) return;

        const emojiKey = reaction.emoji.id ? reaction.emoji.id : reaction.emoji.name;
        const roleId = reactionData[messageId][emojiKey];

        if (roleId) {
            try {
                const member = await reaction.message.guild.members.fetch(user.id);
                if (member) {
                    await member.roles.remove(roleId);
                }
            } catch (error) {
                console.error('Failed to remove reaction role:', error);
            }
        }
    },
};
