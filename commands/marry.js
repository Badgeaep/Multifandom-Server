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
        .setName('marry')
        .setDescription('Propose to another user!')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user you want to marry')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('persona')
                .setDescription('The name of the persona you want to marry')
                .setRequired(false)),
    
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const personaName = interaction.options.getString('persona');
        const proposer = interaction.user;

        if (!targetUser && !personaName) {
            return interaction.reply({ content: '❌ You must specify either a user or a persona name!', ephemeral: true });
        }

        const familyData = getFamilyData();
        const personaData = getData('personas');
        const proposerData = familyData[proposer.id] || { partner: null, children: [], parents: [] };

        if (proposerData.partner) {
            return interaction.reply({ content: '❌ You are already married! You must divorce first.', ephemeral: true });
        }

        // --- Handle Persona Marriage ---
        if (personaName) {
            const foundPersona = personaData.list.find(p => p.name.toLowerCase() === personaName.toLowerCase());
            if (!foundPersona) {
                return interaction.reply({ content: `❌ Could not find a persona named **${personaName}**!`, ephemeral: true });
            }

            // Check trust/agree status
            const isTrusted = (personaData.globalAgree && personaData.globalAgree.includes(proposer.id)) || 
                              (foundPersona.agree && foundPersona.agree.includes(proposer.id));
            
            if (!isTrusted) {
                return interaction.reply({ 
                    content: `❌ **${foundPersona.name}** doesn't trust you enough to marry you yet! (You need to be on their 'Agree' list).`, 
                    ephemeral: true 
                });
            }

            // Perform marriage
            proposerData.partner = `persona:${foundPersona.name}`;
            familyData[proposer.id] = proposerData;
            saveFamilyData(familyData);

            const successEmbed = new EmbedBuilder()
                .setTitle('💍 A Match Made in AI')
                .setColor('#e84393')
                .setDescription(`${proposer} and the persona **${foundPersona.name}** are now happily married! 💍❤️\n\n*The personas will now be even more devoted to you.*`)
                .setThumbnail(foundPersona.avatar || interaction.client.user.displayAvatarURL());
            
            return interaction.reply({ embeds: [successEmbed] });
        }

        // --- Handle User Marriage ---
        if (targetUser.id === proposer.id) {
            return interaction.reply({ content: '❌ You cannot marry yourself!', ephemeral: true });
        }
        if (targetUser.bot) {
            return interaction.reply({ content: '❌ You cannot marry a standard bot. Use the `persona` option to marry an AI personality!', ephemeral: true });
        }

        const targetData = familyData[targetUser.id] || { partner: null, children: [], parents: [] };

        if (targetData.partner) {
            return interaction.reply({ content: `❌ ${targetUser} is already married!`, ephemeral: true });
        }

        const { isGhost } = require('../db');
        const playerGhost = isGhost(targetUser.id, 'player');
        const targetPing = playerGhost ? `**${targetUser.username}**` : `${targetUser}`;

        const embed = new EmbedBuilder()
            .setTitle('💍 Marriage Proposal')
            .setColor('#e84393')
            .setDescription(`${targetPing}, ${proposer} has proposed to you! Do you accept?`);

        const acceptBtn = new ButtonBuilder()
            .setCustomId('accept_proposal')
            .setLabel('Accept')
            .setStyle(ButtonStyle.Success);
        
        const declineBtn = new ButtonBuilder()
            .setCustomId('decline_proposal')
            .setLabel('Decline')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(acceptBtn, declineBtn);

        const response = await interaction.reply({ content: `${targetPing}`, embeds: [embed], components: [row], fetchReply: true });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id !== targetUser.id) {
                return i.reply({ content: 'You cannot answer this proposal.', ephemeral: true });
            }

            if (i.customId === 'accept_proposal') {
                familyData[proposer.id] = proposerData;
                familyData[targetUser.id] = targetData;
                proposerData.partner = targetUser.id;
                targetData.partner = proposer.id;
                
                saveFamilyData(familyData);

                const successEmbed = new EmbedBuilder()
                    .setTitle('🎉 They said yes!')
                    .setColor('#2ecc71')
                    .setDescription(`${proposer} and ${targetPing} are now happily married! 💍❤️`);
                
                await i.update({ embeds: [successEmbed], components: [] });
            } else if (i.customId === 'decline_proposal') {
                const declineEmbed = new EmbedBuilder()
                    .setTitle('💔 Proposal Declined')
                    .setColor('#e74c3c')
                    .setDescription(`${targetPing} declined the marriage proposal from ${proposer}.`);
                
                await i.update({ embeds: [declineEmbed], components: [] });
            }
        });

        collector.on('end', async collected => {
            if (collected.size === 0) {
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏰ Proposal Expired')
                    .setColor('#7f8c8d')
                    .setDescription(`The proposal from ${proposer} to ${targetPing} expired.`);
                try {
                    await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
                } catch(e){}
            }
        });
    },
};
