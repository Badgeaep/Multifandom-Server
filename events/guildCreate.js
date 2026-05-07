module.exports = {
    name: 'guildCreate',
    async execute(guild) {
        const allowedGuildId = process.env.ALLOWED_GUILD_ID;
        
        if (allowedGuildId && guild.id !== allowedGuildId) {
            console.log(`[SECURITY] Leaving unauthorized guild: ${guild.name} (${guild.id})`);
            
            // Log the attempt to the main server's log channel
            const logChannelId = '1494775931053670430';
            const mainGuild = guild.client.guilds.cache.get(allowedGuildId);
            if (mainGuild) {
                const logChannel = mainGuild.channels.cache.get(logChannelId);
                if (logChannel) {
                    const { EmbedBuilder } = require('discord.js');
                    const embed = new EmbedBuilder()
                        .setTitle('🛡️ Security: Unauthorized Invite Blocked')
                        .setColor('#e74c3c')
                        .setDescription(`The bot was invited to a foreign server and has automatically left.`)
                        .addFields(
                            { name: 'Server Name', value: guild.name, inline: true },
                            { name: 'Server ID', value: guild.id, inline: true },
                            { name: 'Member Count', value: String(guild.memberCount), inline: true }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [embed] }).catch(() => {});
                }
            }

            try {
                await guild.leave();
            } catch (err) {
                console.error('Failed to leave guild:', err);
            }
        }
    },
};
