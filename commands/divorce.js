const { SlashCommandBuilder, EmbedBuilder, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
const { getData, saveData } = require('../db');

function getFamilyData() {
    return getData('family');
}

function saveFamilyData(data) {
    saveData('family', data);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('divorce')
        .setDescription('Divorce your current partner.')
        .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall]),
    
    async execute(interaction) {
        const familyData = getFamilyData();
        const userId = interaction.user.id;
        
        const userData = familyData[userId] || { partner: null, children: [], parents: [] };
        
        if (!userData.partner) {
            const errEmbed = new EmbedBuilder().setColor('#e74c3c').setDescription('❌ You are not married to anyone.');
            return interaction.reply({ embeds: [errEmbed], ephemeral: true });
        }
        
        const partnerId = userData.partner;
        
        if (partnerId.startsWith('persona:')) {
            const personaName = partnerId.split(':')[1];
            userData.partner = null;
            familyData[userId] = userData;
            saveFamilyData(familyData);
            
            const successEmbed = new EmbedBuilder()
                .setTitle('💔 Divorced')
                .setColor('#7f8c8d')
                .setDescription(`You have officially divorced the persona **${personaName}**.`);
            return interaction.reply({ embeds: [successEmbed] });
        }

        const partnerData = familyData[partnerId] || { partner: null, children: [], parents: [] };
        
        userData.partner = null;
        partnerData.partner = null;
        
        familyData[userId] = userData;
        familyData[partnerId] = partnerData;
        saveFamilyData(familyData);
        
        const { isGhost } = require('../db');
        const playerGhost = isGhost(partnerId, 'player');
        
        let partnerDisplay;
        if (playerGhost) {
            try {
                const partnerUser = await interaction.client.users.fetch(partnerId);
                partnerDisplay = `**${partnerUser.username}**`;
            } catch (e) {
                partnerDisplay = `**User (${partnerId})**`;
            }
        } else {
            partnerDisplay = `<@${partnerId}>`;
        }

        const successEmbed = new EmbedBuilder()
            .setTitle('💔 Divorced')
            .setColor('#7f8c8d')
            .setDescription(`You have officially divorced ${partnerDisplay}.`);
            
        await interaction.reply({ embeds: [successEmbed] });
    },
};
