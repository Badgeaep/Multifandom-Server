const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getData, saveData } = require('../db');

function getFamilyData() {
    return getData('family');
}

function saveFamilyData(data) {
    saveData('family', data);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('disown')
        .setDescription('Remove a child from your family.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The child you want to disown')
                .setRequired(true)),
    
    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const user = interaction.user;

        const familyData = getFamilyData();
        const userData = familyData[user.id] || { partner: null, children: [], parents: [] };
        const targetData = familyData[target.id] || { partner: null, children: [], parents: [] };

        if (!userData.children || !userData.children.includes(target.id)) {
            const errEmbed = new EmbedBuilder().setColor('#e74c3c').setDescription(`❌ ${target} is not your child.`);
            return interaction.reply({ embeds: [errEmbed], ephemeral: true });
        }

        // Remove from user
        userData.children = userData.children.filter(id => id !== target.id);
        if (targetData.parents) {
            targetData.parents = targetData.parents.filter(id => id !== user.id);
        }

        familyData[user.id] = userData;

        // Remove from partner if they exist
        if (userData.partner) {
            const partnerData = familyData[userData.partner];
            if (partnerData && partnerData.children) {
                partnerData.children = partnerData.children.filter(id => id !== target.id);
                familyData[userData.partner] = partnerData;
                
                if (targetData.parents) {
                    targetData.parents = targetData.parents.filter(id => id !== userData.partner);
                }
            }
        }

        familyData[target.id] = targetData;
        saveFamilyData(familyData);

        const { isGhost } = require('../db');
        const playerGhost = isGhost(target.id, 'player');
        const targetPing = playerGhost ? `**${target.username}**` : `${target}`;

        const successEmbed = new EmbedBuilder()
            .setTitle('👋 Child Removed')
            .setColor('#e67e22')
            .setDescription(`You have successfully disowned ${targetPing}.`);
            
        await interaction.reply({ embeds: [successEmbed] });
    },
};
