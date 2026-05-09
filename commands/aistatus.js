const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getData } = require('../db');
const { AI_PRIMARY_MODEL, DAILY_LIMIT, AI_PROVIDER, OLLAMA_MODEL } = require('../utils/aiUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('aistatus')
        .setDescription('Check the current AI request usage for today.'),

    async execute(interaction) {
        const usageData = getData('ai_usage');
        const today = new Date().toISOString().split('T')[0];
        const usage = usageData[today] || 0;
        const isOllama = AI_PROVIDER === 'ollama';
        
        const limit = isOllama ? '∞ (Local)' : DAILY_LIMIT;
        const remaining = isOllama ? 'Unlimited' : Math.max(0, DAILY_LIMIT - usage);
        const percentage = isOllama ? '0.0' : Math.min(100, (usage / DAILY_LIMIT) * 100).toFixed(1);

        const embed = new EmbedBuilder()
            .setTitle('🤖 AI API Status')
            .setColor(isOllama ? '#3498db' : (remaining > 0 ? '#2ecc71' : '#e74c3c'))
            .setDescription(`Currently using **${isOllama ? 'Ollama (Local AI)' : 'Gemini (Cloud AI)'}** as the provider.`)
            .addFields(
                { name: '📅 Date', value: today, inline: true },
                { name: '📊 Usage', value: `${usage} / ${limit}`, inline: true },
                { name: '⏳ Remaining', value: `${remaining}`, inline: true },
                { name: '🤖 Active Model', value: `\`${isOllama ? OLLAMA_MODEL : AI_PRIMARY_MODEL}\``, inline: true },
                { name: '📈 Progress', value: isOllama ? 'Local Execution' : `\`${percentage}%\` used`, inline: true }
            )
            .setFooter({ text: isOllama ? 'No rate limits applied for local AI.' : 'Limits reset at midnight Pacific Time (PT)' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
