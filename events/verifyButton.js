const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'verifyButton',
    async execute(interaction) {
        const memberRoleID = '1494777803881713904';
        
        try {
            const memberRole = interaction.guild.roles.cache.get(memberRoleID);
            
            if (!memberRole) {
                 return await interaction.reply({ content: 'Member role not found. Please contact an admin.', ephemeral: true });
            }

            // Since we don't know the unverified role ID, we'll try to find a role named "Unverified"
            const unverifiedRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'unverified');

            // Add member role
            await interaction.member.roles.add(memberRole);

            // Remove unverified role if it exists and the user has it
            if (unverifiedRole && interaction.member.roles.cache.has(unverifiedRole.id)) {
                await interaction.member.roles.remove(unverifiedRole);
            }

            await interaction.reply({ content: 'You have been successfully verified!', ephemeral: true });

            const fs = require('fs');
            const path = require('path');
            const userDataPath = path.join(__dirname, '..', 'userdata.json');
            let uData = {};
            if (fs.existsSync(userDataPath)) {
                try { uData = JSON.parse(fs.readFileSync(userDataPath, 'utf8')); } catch(e){}
            }
            if (!uData[interaction.user.id]) uData[interaction.user.id] = {};
            uData[interaction.user.id].verifiedAt = Date.now();
            fs.writeFileSync(userDataPath, JSON.stringify(uData, null, 2));

            const logChannelId = '1494775931053670430';
            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('✅ User Verified')
                    .setColor('#2ecc71')
                    .addFields(
                        { name: 'User', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
                        { name: 'User ID', value: interaction.user.id, inline: true }
                    )
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }

        } catch (error) {
            console.error('Error during verification:', error);
            await interaction.reply({ content: 'There was an error verifying you. Please contact an admin.', ephemeral: true });
        }
    },
};
