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

        } catch (error) {
            console.error('Error during verification:', error);
            await interaction.reply({ content: 'There was an error verifying you. Please contact an admin.', ephemeral: true });
        }
    },
};
