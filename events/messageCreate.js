const { Events, EmbedBuilder } = require('discord.js');

const BYPASS_ROLE_ID = '1495843645448917103';

// Simple in-memory spam tracker (User ID -> [timestamps])
const messageTracker = new Map();
const SPAM_THRESHOLD = 5; // Messages
const SPAM_TIME = 5000; // 5 seconds

// Extreme words/phrases filter using Regex to catch variations and leetspeak bypasses
// Uses [\W_]* to seamlessly ignore any exclamations, dots, spacing, or symbols placed between letters!
const badWordsRegex = [
    // Hitler bypasses (h i t l e r, h1tl3r)
    /h[\W_]*[1i!l\|]+[\W_]*t[\W_]*l[\W_]*[e3]+[\W_]*r/i,
    // N-words (n.i.g.g.e.r, ngga, n!gg@, n1bb3r, etc)
    /n[\W_]*[i1!l\|*()@]*[\W_]*[gq69][\W_]*[gq69]+[\W_]*[a@4e3*]+[\W_]*r?/i,
    /n[\W_]*[i1!l\|*()@]*[\W_]*b[\W_]*b+[\W_]*[a@4e3*]+[\W_]*r?/i,
    // F-slurs (f a g g o t, f4g)
    /f[\W_]*[a@4*]+[\W_]*[gq69][\W_]*[gq69]*(?:[\W_]*[0o*]+[\W_]*t)?/i,
    // Nazi
    /n[\W_]*[a@4]+[\W_]*z[\W_]*[1i!l\|]/i,
    // R-slur
    /r[\W_]*[e3]+[\W_]*t[\W_]*[a@4]+[\W_]*r[\W_]*d/i,
    // KYS (kill yourself equivalents)
    /k[\W_]*y[\W_]*s/i,
    // Whore
    /wh[\W_]*[0o*]+[\W_]*r[\W_]*[e3*]+/i,
    // Slut
    /sl[\W_]*[u*]+[\W_]*t/i,
    // Bitch
    /b[\W_]*[i1!l\|*]+[\W_]*t[\W_]*c[\W_]*h/i
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

        let content = message.content.toLowerCase();
        // Remove spaces for checking clever evasion like "H I T L E R"
        let squishedContent = content.replace(/\s+/g, '');
        let shouldDelete = false;
        let reason = '';

        // 1. Extreme Curse/Racist Filter
        for (const regex of badWordsRegex) {
            const match = content.match(regex) || squishedContent.match(regex);
            if (match) {
                shouldDelete = true;
                reason = `Profanity or bypassed word detected (Triggered by: "${match[0]}")`;
                break;
            }
        }

        // 2. Invite Link Filter
        const inviteRegex = /(discord\.gg\/|discord\.com\/invite\/)/;
        if (!shouldDelete && inviteRegex.test(content)) {
            shouldDelete = true;
            reason = 'Discord invite links are not allowed here.';
        }

        // 3. Scam/IP Link Filter
        if (!shouldDelete) {
            for (const scamInfo of scamLinks) {
                if (content.includes(scamInfo) || squishedContent.includes(scamInfo)) {
                    shouldDelete = true;
                    reason = `Suspicious scam/IP-grabber link detected (Triggered by: "${scamInfo}")`;
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
                
                // Warn the user using an embed
                const warningEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Message Deleted')
                    .setDescription(`**${message.author.username}**, your message was automatically removed by the security system.`)
                    .addFields({ name: 'Reason', value: reason })
                    .setColor('#e67e22');

                const warningMsg = await message.channel.send({ content: `${message.author}`, embeds: [warningEmbed] });
                setTimeout(() => warningMsg.delete().catch(() => {}), 5000);

                // Log the action explicitly to the provided channel ID
                const logChannelId = '1494775931053670430';
                const logChannel = message.guild.channels.cache.get(logChannelId);
                
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('Automod Action Initiated')
                        .setColor('#e74c3c')
                        .addFields(
                            { name: 'User', value: `${message.author} (${message.author.id})`, inline: true },
                            { name: 'Channel', value: `${message.channel}`, inline: true },
                            { name: 'Reason', value: reason },
                            { name: 'Deleted Content', value: message.content || 'None (likely an attachment)' }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] });
                }

            } catch (error) {
                 // Usually happens if bot lacks Manage Messages permission
                 console.error('Failed to moderate message:', error);
            }
        }
    },
};
