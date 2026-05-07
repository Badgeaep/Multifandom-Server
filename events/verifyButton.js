const { EmbedBuilder } = require('discord.js');
const { getData, saveData } = require('../db');

module.exports = {
    name: 'verifyButton',
    async execute(interaction) {
        const memberRoleID = '1494777803881713904';
        
        try {
            const memberRole = interaction.guild.roles.cache.get(memberRoleID);
            
            if (!memberRole) {
                 const errEmbed = new EmbedBuilder().setColor('#e74c3c').setDescription('❌ Member role not found. Please contact an admin.');
                 return await interaction.reply({ embeds: [errEmbed], ephemeral: true });
            }

            // Since we don't know the unverified role ID, we'll try to find a role named "Unverified"
            const unverifiedRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'unverified');

            // Add member role
            await interaction.member.roles.add(memberRole);

            // Remove unverified role if it exists and the user has it
            if (unverifiedRole && interaction.member.roles.cache.has(unverifiedRole.id)) {
                await interaction.member.roles.remove(unverifiedRole);
            }

            const successEmbed = new EmbedBuilder().setColor('#2ecc71').setDescription('✅ You have been successfully verified!');
            await interaction.reply({ embeds: [successEmbed], ephemeral: true });

            let uData = getData('userdata');
            if (!uData[interaction.user.id]) uData[interaction.user.id] = {};
            uData[interaction.user.id].verifiedAt = Date.now();
            saveData('userdata', uData);

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
            const errEmbed = new EmbedBuilder().setColor('#e74c3c').setDescription('❌ There was an error verifying you. Please contact an admin.');
            await interaction.reply({ embeds: [errEmbed], ephemeral: true });
        }
    },
};
