const { Events, EmbedBuilder } = require('discord.js');

const BYPASS_ROLE_ID = '1495843645448917103';

// Simple in-memory spam tracker (User ID -> [timestamps])
const messageTracker = new Map();
const SPAM_THRESHOLD = 5; // Messages
const SPAM_TIME = 5000; // 5 seconds

// Extreme words/phrases filter
const badWords = [
    'adolf hitler',
    'nazi',
    // We add common racist slurs or severe words here.
    // For this example, we keep it generalized.
    'nigg', // fuzzy match base
    'fagg',
];

const scamLinks = [
    'free-nitro',
    'steam-discord',
    'ip-locator',
    // more scam link substrings
];

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        // Check for bypass role
        const member = message.member;
        if (member && member.roles.cache.has(BYPASS_ROLE_ID)) {
            return;
        }

        const content = message.content.toLowerCase();
        let shouldDelete = false;
        let reason = '';

        // 1. Extreme Curse/Racist Filter
        for (const badWord of badWords) {
            if (content.includes(badWord)) {
                shouldDelete = true;
                reason = 'Extreme profanity/slur detected';
                break;
            }
        }

        // 2. Invite Link Filter
        const inviteRegex = /(discord\.gg\/|discord\.com\/invite\/)/;
        if (!shouldDelete && inviteRegex.test(content)) {
            shouldDelete = true;
            reason = 'Invite links are not allowed';
        }

        // 3. Scam/IP Link Filter
        if (!shouldDelete) {
            for (const scamInfo of scamLinks) {
                if (content.includes(scamInfo)) {
                    shouldDelete = true;
                    reason = 'Suspicious or scam link detected';
                    break;
                }
            }
        }

        // 4. Spam Filter
        if (!shouldDelete) {
            const now = Date.now();
            if (!messageTracker.has(message.author.id)) {
                messageTracker.set(message.author.id, []);
            }

            const timestamps = messageTracker.get(message.author.id);
            timestamps.push(now);

            // Keep only timestamps within the spam time frame
            const recentTimestamps = timestamps.filter(t => now - t < SPAM_TIME);
            messageTracker.set(message.author.id, recentTimestamps);

            if (recentTimestamps.length > SPAM_THRESHOLD) {
                shouldDelete = true;
                reason = 'Spamming (Sending messages too quickly)';
                // Optional: clear the tracker so they don't get warned for EVERY subsequent message unnecessarily
                messageTracker.set(message.author.id, []);
            }
        }

        // Execution
        if (shouldDelete) {
            try {
                await message.delete();
                
                // Warn the user
                const warningMsg = await message.channel.send(`${message.author}, your message was deleted. Reason: ${reason}`);
                setTimeout(() => warningMsg.delete().catch(() => {}), 5000);

                // Log the action (placeholder logic for logging channel)
                const logChannelName = 'admin-logs'; // Replace with ID if known
                const logChannel = message.guild.channels.cache.find(c => c.name === logChannelName);
                
                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle('Automod Action Initiated')
                        .setColor('#e74c3c')
                        .addFields(
                            { name: 'User', value: `${message.author} (${message.author.id})`, inline: true },
                            { name: 'Channel', value: `${message.channel}`, inline: true },
                            { name: 'Reason', value: reason },
                            { name: 'Deleted Content', value: message.content || 'None (likely an attachment)' }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [embed] });
                }

            } catch (error) {
                 // Usually happens if bot lacks Manage Messages permission
                 console.error('Failed to moderate message:', error);
            }
        }
    },
};
