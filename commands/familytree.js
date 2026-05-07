const { SlashCommandBuilder, EmbedBuilder, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
const { getData } = require('../db');

function getFamilyData() {
    return getData('family');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('familytree')
        .setDescription('View a user\'s family tree.')
        .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user whose family tree you want to view')
                .setRequired(false)),
    
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const familyData = getFamilyData();
        const userData = familyData[targetUser.id] || { partner: null, children: [], parents: [] };

        const partnerStr = userData.partner ? `<@${userData.partner}>` : 'Nobody';
        const parentsStr = (userData.parents && userData.parents.length > 0) ? userData.parents.map(id => `<@${id}>`).join(', ') : 'None';
        const childrenStr = (userData.children && userData.children.length > 0) ? userData.children.map(id => `<@${id}>`).join(', ') : 'None';

        const embed = new EmbedBuilder()
            .setTitle(`🌳 Family Tree of ${targetUser.username}`)
            .setColor('#2ecc71')
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '💍 Partner', value: partnerStr, inline: false },
                { name: '👨‍👩‍👦 Parents', value: parentsStr, inline: false },
                { name: '👶 Children', value: childrenStr, inline: false }
            );

        await interaction.reply({ embeds: [embed] });
    },
};
