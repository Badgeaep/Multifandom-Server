module.exports = {
    name: 'inviteDelete',
    async execute(invite, client) {
        if (!client.invites) return;
        const guildInvites = client.invites.get(invite.guild.id);
        if (guildInvites) {
            guildInvites.delete(invite.code);
        }
    }
};
