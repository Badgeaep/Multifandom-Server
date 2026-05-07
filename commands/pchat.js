const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getData } = require('../db');
const { enqueueAICall, isQuotaExceeded } = require('../utils/aiUtils');

// Track active conversations: ChannelID -> Boolean (true if active)
const activeChats = new Map();

module.exports = {
    activeChats, // Export so other commands can see it if needed
    data: new SlashCommandBuilder()
        .setName('pchat')
        .setDescription('Make two personas talk to each other.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName('start')
                .setDescription('Start a conversation between two personas.')
                .addStringOption(option => option.setName('persona1').setDescription('Name of the first persona').setRequired(true))
                .addStringOption(option => option.setName('persona2').setDescription('Name of the second persona').setRequired(true))
                .addStringOption(option => option.setName('topic').setDescription('What should they talk about?').setRequired(true))
                .addIntegerOption(option => option.setName('turns').setDescription('Number of back-and-forth turns (1-50, default 3)').setMinValue(1).setMaxValue(50).setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('stop')
                .setDescription('Stop the active persona conversation in this channel.')),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ You must be an Administrator to use this command.', ephemeral: true });
        }
        const sub = interaction.options.getSubcommand();

        if (sub === 'stop') {
            if (!activeChats.has(interaction.channelId)) {
                return interaction.reply({ content: '❌ There is no active persona conversation in this channel.', ephemeral: true });
            }
            activeChats.delete(interaction.channelId);
            return interaction.reply({ content: '🛑 Stopping the conversation... The next turn will be cancelled.' });
        }

        // --- Start Logic ---
        const p1Name = interaction.options.getString('persona1');
        const p2Name = interaction.options.getString('persona2');
        const topic = interaction.options.getString('topic');
        const turns = interaction.options.getInteger('turns') || 3;

        if (activeChats.has(interaction.channelId)) {
            return interaction.reply({ content: '❌ A conversation is already running in this channel! Use `/pchat stop` first.', ephemeral: true });
        }

        const personaData = getData('personas');
        const p1 = personaData?.list?.find(p => p.name.toLowerCase() === p1Name.toLowerCase());
        const p2 = personaData?.list?.find(p => p.name.toLowerCase() === p2Name.toLowerCase());

        if (!p1 || !p2) {
            return interaction.reply({ content: `❌ Could not find personas: ${p1Name}, ${p2Name}`, ephemeral: true });
        }

        if (!process.env.GEMINI_API_KEY) {
            return interaction.reply({ content: '❌ Gemini API Key not configured!', ephemeral: true });
        }

        if (isQuotaExceeded()) {
            const limitEmbed = new EmbedBuilder()
                .setTitle('🔌 AI Out of Power')
                .setColor('#e74c3c')
                .setDescription(`The AI personas have exhausted their energy (daily request limit) for today.`)
                .addFields({ name: '⏳ Reset Time', value: 'Midnight Pacific Time (PT)' })
                .setFooter({ text: 'Use /aistatus to check quota' });
            
            return interaction.reply({ embeds: [limitEmbed], ephemeral: true });
        }
        // ---------------------

        const startEmbed = new EmbedBuilder()
            .setTitle('🎭 Persona Conversation Started')
            .setColor('#3498db')
            .setDescription(`A back-and-forth debate has been initiated in this channel.`)
            .addFields(
                { name: '👥 Participants', value: `**${p1.name}** & **${p2.name}**`, inline: true },
                { name: '🔄 Turns', value: `${turns} rounds`, inline: true },
                { name: '📜 Topic', value: topic }
            )
            .setFooter({ text: 'Use /pchat stop to end this early.' })
            .setTimestamp();

        await interaction.reply({ embeds: [startEmbed] });
        activeChats.set(interaction.channelId, true);

        let currentTurn = 0;
        let lastMessageContent = topic;
        let currentSpeaker = p1;
        let otherSpeaker = p2;
        const chatHistory = [];

        try {
            while (currentTurn < turns * 2) {
                if (!activeChats.has(interaction.channelId)) break;

                await interaction.channel.sendTyping();
                
                const prompt = `${currentSpeaker.prompt}\n\nCRITICAL: You are talking to ${otherSpeaker.name}. Keep responses short (1-2 sentences). Stay in character.\n\nHistory:\n${chatHistory.join('\n')}\n\n${otherSpeaker.name}: ${lastMessageContent}`;
                
                const result = await enqueueAICall({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    config: {
                        safetySettings: [
                            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                        ]
                    }
                });
                
                const responseText = result.text.trim().replace(/\n+/g, '\n');
                

                const webhooks = await interaction.channel.fetchWebhooks();
                let webhook = webhooks.find(wh => wh.token && wh.owner.id === interaction.client.user.id);
                if (!webhook) {
                    webhook = await interaction.channel.createWebhook({ name: 'Persona Webhook', avatar: interaction.client.user.displayAvatarURL() });
                }
                
                await webhook.send({
                    content: responseText,
                    username: currentSpeaker.name,
                    avatarURL: currentSpeaker.avatar || interaction.client.user.displayAvatarURL()
                });

                chatHistory.push(`[${currentSpeaker.name}]: ${responseText}`);
                lastMessageContent = responseText;
                
                [currentSpeaker, otherSpeaker] = [otherSpeaker, currentSpeaker];
                currentTurn++;

                if (currentTurn < turns * 2) {
                    await new Promise(r => setTimeout(r, 4000));
                }
            }
        } catch (err) {
            console.error('PCHAT Loop Error:', err);
            const errEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setDescription('⚠️ The conversation encountered a technical error and had to stop.');
            await interaction.channel.send({ embeds: [errEmbed] });
        } finally {
            if (activeChats.has(interaction.channelId)) {
                activeChats.delete(interaction.channelId);
                const finishEmbed = new EmbedBuilder()
                    .setTitle('✅ Conversation Finished')
                    .setColor('#2ecc71')
                    .setDescription(`**${p1.name}** and **${p2.name}** have concluded their discussion.`)
                    .setTimestamp();
                await interaction.channel.send({ embeds: [finishEmbed] });
            } else {
                const stopEmbed = new EmbedBuilder()
                    .setTitle('🛑 Conversation Stopped')
                    .setColor('#f39c12')
                    .setDescription('The conversation was manually terminated by an administrator.')
                    .setTimestamp();
                await interaction.channel.send({ embeds: [stopEmbed] });
            }
        }
    },
};
