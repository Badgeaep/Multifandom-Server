const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`[READY] Logged in as ${client.user.tag}`);

        const allowedGuildId = process.env.ALLOWED_GUILD_ID;
        if (!allowedGuildId) {
            console.warn('[WARNING] ALLOWED_GUILD_ID is not set in .env. The bot will not restrict servers.');
            return;
        }

        // Process guilds sequentially to ensure we leave unauthorized ones first
        const logChannelId = '1494775931053670430';
        for (const [id, guild] of client.guilds.cache) {
            if (allowedGuildId && id !== allowedGuildId) {
                console.log(`[SECURITY] Leaving unauthorized guild on startup: ${guild.name} (${id})`);
                
                // Log the attempt
                const mainGuild = client.guilds.cache.get(allowedGuildId);
                if (mainGuild) {
                    const logChannel = mainGuild.channels.cache.get(logChannelId);
                    if (logChannel) {
                        const embed = new EmbedBuilder()
                            .setTitle('🛡️ Security: Unauthorized Server Purged')
                            .setColor('#e74c3c')
                            .setDescription(`The bot found itself in a foreign server on startup and has left.`)
                            .addFields(
                                { name: 'Server Name', value: guild.name, inline: true },
                                { name: 'Server ID', value: id, inline: true }
                            )
                            .setTimestamp();
                        await logChannel.send({ embeds: [embed] }).catch(() => {});
                    }
                }

                try {
                    await guild.leave();
                } catch (err) {
                    console.error(`Failed to leave guild ${guild.name}:`, err);
                }
            }
        }

        // Initialize invite cache only for the authorized guild
        client.invites = new Map();
        if (allowedGuildId) {
            const mainGuild = client.guilds.cache.get(allowedGuildId);
            if (mainGuild) {
                try {
                    const firstInvites = await mainGuild.invites.fetch();
                    client.invites.set(mainGuild.id, new Map(firstInvites.map((i) => [i.code, i.uses])));
                    console.log(`[INVITES] Cached ${firstInvites.size} invites for main guild.`);
                } catch (err) {
                    console.error(`[INVITES] Could not fetch invites for main guild:`, err.message);
                }
            }
        }

        // Register commands
        const { REST, Routes } = require('discord.js');
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        
        try {
            console.log('Started refreshing application (/) commands.');
            // Re-importing commands array from index is tricky, so we'll just use client.commands
            const commandsData = Array.from(client.commands.values()).map(c => c.data.toJSON());
            
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commandsData },
            );
            console.log('Successfully reloaded application (/) commands.');
        } catch (error) {
            console.error('Error reloading commands:', error);
        }
    },
};
