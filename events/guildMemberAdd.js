const { EmbedBuilder } = require('discord.js');

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
                    const dataPath = require('path').join(__dirname, '..', 'invites.json');
                    const fs = require('fs');
                    
                    let inviteData = {};
                    if (fs.existsSync(dataPath)) {
                        try { inviteData = JSON.parse(fs.readFileSync(dataPath, 'utf-8')); } catch(e){}
                    }
                    
                    const inviterId = invite.inviter.id;
                    if (!inviteData[inviterId]) inviteData[inviterId] = 0;
                    inviteData[inviterId] += 1;
                    
                    fs.writeFileSync(dataPath, JSON.stringify(inviteData, null, 2));

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
        
        if (welcomeChannel) {
             const welcomeEmbed = new EmbedBuilder()
                .setTitle(`🌟 Welcome to ${member.guild.name}! 🌟`)
                .setDescription(`Hey ${member}, we're incredibly excited to have you here in the central hub for all fandoms!\n\n🔒 **Important:** To unlock the rest of the server and start chatting with everyone, please head over to the Verification channel and click the green button!${inviterText}`)
                .setColor('#9b59b6')
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp();
             try {
                 await welcomeChannel.send({ content: `Welcome to the show, ${member}!`, embeds: [welcomeEmbed] });
             } catch (err) {
                 console.error('Error sending welcome message.', err);
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
