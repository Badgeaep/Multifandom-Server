const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getData, saveData } = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('paccess')
        .setDescription('Manage persona access (agree/deny) for a specific user.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to manage')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('persona')
                .setDescription('Optional: Manage for a specific persona by name')
                .setRequired(false)),
    
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ You must be an Administrator to use this command.', ephemeral: true });
        }
        const targetUser = interaction.options.getUser('user');
        const specificPersonaName = interaction.options.getString('persona');
        const personaData = getData('personas');

        if (!personaData.list) {
            return interaction.reply({ content: '❌ No personas found in the database.', ephemeral: true });
        }

        // Initialize global lists if missing
        if (!personaData.globalDeny) personaData.globalDeny = [];
        if (!personaData.globalAgree) personaData.globalAgree = [];

        let targetPersona = null;
        if (specificPersonaName) {
            targetPersona = personaData.list.find(p => p.name.toLowerCase() === specificPersonaName.toLowerCase());
            if (!targetPersona) {
                return interaction.reply({ content: `❌ Could not find a persona named **${specificPersonaName}**!`, ephemeral: true });
            }
        } else if (personaData.active) {
            targetPersona = personaData.list.find(p => p.name === personaData.active);
        }

        const renderEmbed = () => {
            const isGlobalDeny = personaData.globalDeny.includes(targetUser.id);
            const isGlobalAgree = personaData.globalAgree.includes(targetUser.id);
            
            const personaDeny = targetPersona && targetPersona.deny && targetPersona.deny.includes(targetUser.id);
            const personaAgree = targetPersona && targetPersona.agree && targetPersona.agree.includes(targetUser.id);

            const embed = new EmbedBuilder()
                .setTitle(`👤 Persona Access: ${targetUser.username}`)
                .setDescription(`Manage how personas interact with **${targetUser.tag}**.`)
                .setColor('#3498db')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: '🌐 Global Status', value: `Deny: ${isGlobalDeny ? '✅' : '❌'}\nAgree: ${isGlobalAgree ? '✅' : '❌'}`, inline: true }
                );

            if (targetPersona) {
                embed.addFields(
                    { name: `🤖 Persona: ${targetPersona.name}`, value: `Deny: ${personaDeny ? '✅' : '❌'}\nAgree: ${personaAgree ? '✅' : '❌'}`, inline: true }
                );
            } else {
                embed.addFields(
                    { name: '🤖 Persona-Specific', value: 'None active or specified.', inline: true }
                );
            }

            return embed;
        };

        const renderButtons = () => {
            const isGlobalDeny = personaData.globalDeny.includes(targetUser.id);
            const isGlobalAgree = personaData.globalAgree.includes(targetUser.id);

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('toggle_global_deny')
                    .setLabel(isGlobalDeny ? 'Untrust (Global Deny Off)' : 'Block (Global Deny On)')
                    .setStyle(isGlobalDeny ? ButtonStyle.Secondary : ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('toggle_global_agree')
                    .setLabel(isGlobalAgree ? 'Neutral (Global Agree Off)' : 'Trust (Global Agree On)')
                    .setStyle(isGlobalAgree ? ButtonStyle.Secondary : ButtonStyle.Success)
            );

            const row2 = new ActionRowBuilder();
            if (targetPersona) {
                const isPDeny = targetPersona.deny && targetPersona.deny.includes(targetUser.id);
                const isPAgree = targetPersona.agree && targetPersona.agree.includes(targetUser.id);

                row2.addComponents(
                    new ButtonBuilder()
                        .setCustomId('toggle_persona_deny')
                        .setLabel(`${targetPersona.name}: Block`)
                        .setStyle(isPDeny ? ButtonStyle.Danger : ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('toggle_persona_agree')
                        .setLabel(`${targetPersona.name}: Trust`)
                        .setStyle(isPAgree ? ButtonStyle.Success : ButtonStyle.Secondary)
                );
            }

            return targetPersona ? [row1, row2] : [row1];
        };

        const response = await interaction.reply({
            embeds: [renderEmbed()],
            components: renderButtons(),
            ephemeral: true
        });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async i => {
            const userId = targetUser.id;
            
            if (i.customId === 'toggle_global_deny') {
                if (personaData.globalDeny.includes(userId)) {
                    personaData.globalDeny = personaData.globalDeny.filter(id => id !== userId);
                } else {
                    personaData.globalDeny.push(userId);
                    personaData.globalAgree = personaData.globalAgree.filter(id => id !== userId); // Mutually exclusive
                }
            } else if (i.customId === 'toggle_global_agree') {
                if (personaData.globalAgree.includes(userId)) {
                    personaData.globalAgree = personaData.globalAgree.filter(id => id !== userId);
                } else {
                    personaData.globalAgree.push(userId);
                    personaData.globalDeny = personaData.globalDeny.filter(id => id !== userId); // Mutually exclusive
                }
            } else if (i.customId === 'toggle_persona_deny') {
                if (!targetPersona.deny) targetPersona.deny = [];
                if (!targetPersona.agree) targetPersona.agree = [];

                if (targetPersona.deny.includes(userId)) {
                    targetPersona.deny = targetPersona.deny.filter(id => id !== userId);
                } else {
                    targetPersona.deny.push(userId);
                    targetPersona.agree = targetPersona.agree.filter(id => id !== userId);
                }
            } else if (i.customId === 'toggle_persona_agree') {
                if (!targetPersona.deny) targetPersona.deny = [];
                if (!targetPersona.agree) targetPersona.agree = [];

                if (targetPersona.agree.includes(userId)) {
                    targetPersona.agree = targetPersona.agree.filter(id => id !== userId);
                } else {
                    targetPersona.agree.push(userId);
                    targetPersona.deny = targetPersona.deny.filter(id => id !== userId);
                }
            }

            saveData('personas', personaData);
            await i.update({ embeds: [renderEmbed()], components: renderButtons() });
        });
    }
};
