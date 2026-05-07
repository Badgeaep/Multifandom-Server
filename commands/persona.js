const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getData, saveData } = require('../db');

// In-memory map to track when a user last reset their chat history
// Key: `${userId}-${channelId}`, Value: timestamp
const resetTimestamps = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('persona')
        .setDescription('Manage the AI personalities for the bot.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName('create')
                .setDescription('Create a new personality.')
                .addStringOption(option => option.setName('name').setDescription('Name of the persona (e.g. Batman)').setRequired(true))
                .addStringOption(option => option.setName('prompt').setDescription('The AI prompt instruction').setRequired(true))
                .addStringOption(option => option.setName('avatar').setDescription('Optional: Direct image URL for the persona profile picture').setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('set')
                .setDescription('Set the currently active persona.')
                .addStringOption(option => option.setName('name').setDescription('Name of the persona to activate').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('list')
                .setDescription('List all available personas.'))
        .addSubcommand(subcommand =>
            subcommand.setName('disable')
                .setDescription('Turn off AI replies entirely.'))
        .addSubcommand(subcommand =>
            subcommand.setName('edit')
                .setDescription('Edit the prompt of an existing persona.')
                .addStringOption(option => option.setName('name').setDescription('Name of the persona').setRequired(true))
                .addStringOption(option => option.setName('prompt').setDescription('The new AI prompt instruction').setRequired(false))
                .addStringOption(option => option.setName('avatar').setDescription('The new image URL for the persona profile picture').setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('remove')
                .setDescription('Delete a persona.')
                .addStringOption(option => option.setName('name').setDescription('Name of the persona').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('reset')
                .setDescription('Reset your chat history with the AI in this channel.')),
                
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ You must be an Administrator to use this command.', ephemeral: true });
        }

        let personaData = getData('personas');
        if (!personaData.list) {
            personaData = { active: null, list: [] };
        }

        const sub = interaction.options.getSubcommand();

        if (sub === 'create') {
            const name = interaction.options.getString('name');
            const prompt = interaction.options.getString('prompt');
            
            // Check if exists
            if (personaData.list.find(p => p.name.toLowerCase() === name.toLowerCase())) {
                return interaction.reply({ content: `A persona named **${name}** already exists!`, ephemeral: true });
            }
            
            const avatar = interaction.options.getString('avatar');
            
            personaData.list.push({ 
                name, 
                prompt, 
                avatar,
                deny: [],
                agree: []
            });
            saveData('personas', personaData);
            
            const embed = new EmbedBuilder().setColor('#2ecc71').setDescription(`✅ Created persona **${name}**!`);
            await interaction.reply({ embeds: [embed] });
            
        } else if (sub === 'set') {
            const name = interaction.options.getString('name');
            const found = personaData.list.find(p => p.name.toLowerCase() === name.toLowerCase());
            
            if (!found) {
                return interaction.reply({ content: `❌ Could not find a persona named **${name}**!`, ephemeral: true });
            }
            
            personaData.active = found.name;
            saveData('personas', personaData);
            
            const embed = new EmbedBuilder().setColor('#2ecc71').setDescription(`✅ The bot is now acting as **${found.name}**!`);
            await interaction.reply({ embeds: [embed] });
            
        } else if (sub === 'disable') {
            personaData.active = null;
            saveData('personas', personaData);
            
            const embed = new EmbedBuilder().setColor('#e67e22').setDescription('⏸️ AI replies have been disabled.');
            await interaction.reply({ embeds: [embed] });
            
        } else if (sub === 'edit') {
            const name = interaction.options.getString('name');
            const prompt = interaction.options.getString('prompt');
            
            const found = personaData.list.find(p => p.name.toLowerCase() === name.toLowerCase());
            
            if (!found) {
                return interaction.reply({ content: `❌ Could not find a persona named **${name}**!`, ephemeral: true });
            }
            
            const avatar = interaction.options.getString('avatar');
            
            if (prompt) found.prompt = prompt;
            if (avatar) {
                found.avatar = (avatar.toLowerCase() === 'default' || avatar.toLowerCase() === 'none') ? null : avatar;
            }

            saveData('personas', personaData);
            
            const embed = new EmbedBuilder().setColor('#2ecc71').setDescription(`✏️ Updated **${found.name}**!`);
            await interaction.reply({ embeds: [embed] });
            
        } else if (sub === 'remove') {
            const name = interaction.options.getString('name');
            const initialLen = personaData.list.length;
            personaData.list = personaData.list.filter(p => p.name.toLowerCase() !== name.toLowerCase());
            
            if (personaData.list.length === initialLen) {
                return interaction.reply({ content: `❌ Could not find a persona named **${name}**!`, ephemeral: true });
            }
            
            if (personaData.active && personaData.active.toLowerCase() === name.toLowerCase()) {
                personaData.active = null; // deactivate if deleted
            }
            
            saveData('personas', personaData);
            const embed = new EmbedBuilder().setColor('#e74c3c').setDescription(`🗑️ Deleted persona **${name}**.`);
            await interaction.reply({ embeds: [embed] });
            
        } else if (sub === 'list') {
            const embed = new EmbedBuilder().setTitle('🤖 AI Personas').setColor('#9b59b6');
            
            if (personaData.list.length === 0) {
                embed.setDescription('No personas created yet! Use `/persona create` to make one.');
            } else {
                let desc = '';
                for (const p of personaData.list) {
                    const activeMark = (personaData.active === p.name) ? ' ✅ **(Active)**' : '';
                    desc += `• **${p.name}**${activeMark}\n`;
                }
                embed.setDescription(desc);
            }
            await interaction.reply({ embeds: [embed] });
        } else if (sub === 'reset') {
            const key = `${interaction.user.id}-${interaction.channelId}`;
            resetTimestamps.set(key, Date.now());
            
            // Clear disclaimer status if the event is loaded
            try {
                const messageCreate = require('../events/messageCreate');
                if (messageCreate.disclaimerSeen) {
                    messageCreate.disclaimerSeen.delete(key);
                }
            } catch (e) {}

            const embed = new EmbedBuilder().setColor('#3498db').setDescription('🔄 Chat history has been reset! The AI will start fresh in this channel for you.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
    resetTimestamps,
};
