const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getData, saveData } = require('../db');

function getFamilyData() {
    return getData('family');
}

function saveFamilyData(data) {
    saveData('family', data);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('adopt')
        .setDescription('Ask someone to be your child!')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user you want to adopt')
                .setRequired(true)),
    
    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const adopter = interaction.user;

        if (target.id === adopter.id) {
            const errEmbed = new EmbedBuilder().setColor('#e74c3c').setDescription('❌ You cannot adopt yourself!');
            return interaction.reply({ embeds: [errEmbed], ephemeral: true });
        }
        if (target.bot) {
            const errEmbed = new EmbedBuilder().setColor('#e74c3c').setDescription('❌ You cannot adopt a bot!');
            return interaction.reply({ embeds: [errEmbed], ephemeral: true });
        }

        const familyData = getFamilyData();
        const adopterData = familyData[adopter.id] || { partner: null, children: [], parents: [] };
        const targetData = familyData[target.id] || { partner: null, children: [], parents: [] };

        if (adopterData.children && adopterData.children.includes(target.id)) {
            const errEmbed = new EmbedBuilder().setColor('#e74c3c').setDescription(`❌ ${target} is already your child!`);
            return interaction.reply({ embeds: [errEmbed], ephemeral: true });
        }
        
        if (targetData.parents && targetData.parents.includes(adopter.id)) {
            const errEmbed = new EmbedBuilder().setColor('#e74c3c').setDescription(`❌ ${target} is already your child!`);
            return interaction.reply({ embeds: [errEmbed], ephemeral: true });
        }

        const { isGhost } = require('../db');
        const playerGhost = isGhost(target.id, 'player');
        const targetPing = playerGhost ? `**${target.username}**` : `${target}`;

        const embed = new EmbedBuilder()
            .setTitle('👶 Adoption Request')
            .setColor('#f1c40f')
            .setDescription(`${targetPing}, ${adopter} wants to adopt you! Do you accept?`);

        const acceptBtn = new ButtonBuilder()
            .setCustomId('accept_adopt')
            .setLabel('Accept')
            .setStyle(ButtonStyle.Success);
        
        const declineBtn = new ButtonBuilder()
            .setCustomId('decline_adopt')
            .setLabel('Decline')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(acceptBtn, declineBtn);

        const response = await interaction.reply({ content: `${targetPing}`, embeds: [embed], components: [row], fetchReply: true });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id !== target.id) {
                return i.reply({ content: 'You cannot answer this request.', ephemeral: true });
            }

            if (i.customId === 'accept_adopt') {
                if (!adopterData.children) adopterData.children = [];
                if (!targetData.parents) targetData.parents = [];
                
                adopterData.children.push(target.id);
                targetData.parents.push(adopter.id);
                
                familyData[adopter.id] = adopterData;
                familyData[target.id] = targetData;
                
                // If adopter is married, add child to partner too
                if (adopterData.partner) {
                    const partnerData = familyData[adopterData.partner] || { partner: adopter.id, children: [], parents: [] };
                    if (!partnerData.children) partnerData.children = [];
                    if (!partnerData.children.includes(target.id)) {
                        partnerData.children.push(target.id);
                        targetData.parents.push(adopterData.partner);
                        familyData[adopterData.partner] = partnerData;
                    }
                }
                
                saveFamilyData(familyData);

                const successEmbed = new EmbedBuilder()
                    .setTitle('👨‍👩‍👧 Family Grown!')
                    .setColor('#2ecc71')
                    .setDescription(`${adopter} has successfully adopted ${targetPing}! ❤️`);
                
                await i.update({ embeds: [successEmbed], components: [] });
            } else if (i.customId === 'decline_adopt') {
                const declineEmbed = new EmbedBuilder()
                    .setTitle('💔 Request Declined')
                    .setColor('#e74c3c')
                    .setDescription(`${targetPing} declined the adoption request from ${adopter}.`);
                
                await i.update({ embeds: [declineEmbed], components: [] });
            }
        });

        collector.on('end', async collected => {
            if (collected.size === 0) {
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏰ Request Expired')
                    .setColor('#7f8c8d')
                    .setDescription(`The adoption request from ${adopter} to ${targetPing} expired.`);
                try {
                    await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
                } catch(e){}
            }
        });
    },
};
