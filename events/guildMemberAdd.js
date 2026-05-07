const { EmbedBuilder } = require('discord.js');
const { getData, saveData } = require('../db');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        // Ensure the bot applies the Unverified role right away.
        let unverifiedRole = member.guild.roles.cache.find(r => r.name.toLowerCase() === 'unverified');
        
        if (!unverifiedRole) {
            try {
                unverifiedRole = await member.guild.roles.create({
                    name: 'Unverified',
                    color: '#808080',
                    reason: 'Created for the verification system'
                });
            } catch (error) {
                console.error('Could not create Unverified role:', error);
                return;
            }
        }

        try {
            await member.roles.add(unverifiedRole);
        } catch (error) {
            console.error('Error adding unverified role:', error);
        }

        // Invite Tracking Logic
        let inviterText = '';
        if (client && client.invites) {
            try {
                const newInvites = await member.guild.invites.fetch();
                const oldInvites = client.invites.get(member.guild.id);
                
                // Find which invite's use count went up
                const invite = newInvites.find(i => {
                    const oldInviteUses = (oldInvites && oldInvites.get(i.code)) || 0;
                    return i.uses > oldInviteUses;
                });

                if (invite && invite.inviter) {
                    let inviteData = getData('invites');
                    
                    const inviterId = invite.inviter.id;
                    if (!inviteData[inviterId]) inviteData[inviterId] = 0;
                    inviteData[inviterId] += 1;
                    
                    saveData('invites', inviteData);

                    inviterText = `\n\n📫 **Invited by:** <@${inviterId}> (${inviteData[inviterId]} invites)`;
                }

                // Push new mapping to cache
                client.invites.set(member.guild.id, new Map(newInvites.map((i) => [i.code, i.uses])));
            } catch (error) {
                console.error('Invite tracking error:', error);
            }
        }

        // Welcome Embed
        const welcomeChannelId = '1494768368425636013';
        const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
        
        const { isGhost } = require('../db');
        const botGhost = isGhost(member.id, 'bot');

        if (welcomeChannel) {
             const welcomePing = botGhost ? `**${member.user.username}**` : `${member}`;
             const welcomeEmbed = new EmbedBuilder()
                .setTitle(`🌟 Welcome to ${member.guild.name}! 🌟`)
                .setDescription(`Hey ${welcomePing}, we're incredibly excited to have you here in the central hub for all fandoms!\n\n🔒 **Important:** To unlock the rest of the server and start chatting with everyone, please head over to the Verification channel and click the green button!${inviterText}`)
                .setColor('#9b59b6')
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp();
             try {
                 await welcomeChannel.send({ content: `Welcome to the show, ${welcomePing}!`, embeds: [welcomeEmbed] });
             } catch (err) {
                 console.error('Error sending welcome message.', err);
             }
        }

        // Invis tag spam - ghost ping the new member 5 times
        const invisChannelId = '1495857383040090293';
        const invisChannel = member.guild.channels.cache.get(invisChannelId);
        if (invisChannel && !botGhost) {
            for (let i = 0; i < 5; i++) {
                try {
                    const ping = await invisChannel.send(`${member}`);
                    await ping.delete();
                } catch (err) {
                    console.error('Invis tag error:', err);
                }
                // Small delay between pings so Discord registers each one
                await new Promise(r => setTimeout(r, 300));
            }
        }

        // To GUARANTEE they ONLY see the verify channel no matter what other roles they randomly get
        // given by auto-role bots, we loop through all the roles they have (except @everyone) and strip them!
        setTimeout(async () => {
            try {
                const fetchedMember = await member.guild.members.fetch(member.id);
                // Find roles that give them permissions they shouldn't have while unverified
                const rolesToRemove = fetchedMember.roles.cache.filter(r => r.id !== member.guild.id && r.id !== unverifiedRole.id);
                if (rolesToRemove.size > 0) {
                    await fetchedMember.roles.remove(rolesToRemove);
                }
            } catch (error) {
                console.error('Error removing foreign roles from unverified user:', error);
            }
        }, 1500); // 1.5 second delay to let other initial auto-roles assign themselves before we nuke them
    }
};
