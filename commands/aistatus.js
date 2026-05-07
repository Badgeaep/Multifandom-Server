const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getData } = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('aistatus')
        .setDescription('Check the current AI request usage for today.'),

    async execute(interaction) {
        const usageData = getData('ai_usage');
        const today = new Date().toISOString().split('T')[0];
        const usage = usageData[today] || 0;
        const limit = 1500; // Standard Gemini Flash Free Tier RPD limit guideline
        const remaining = Math.max(0, limit - usage);
        const percentage = Math.min(100, (usage / limit) * 100).toFixed(1);

        const embed = new EmbedBuilder()
            .setTitle('🤖 AI API Status')
            .setColor(remaining > 0 ? '#2ecc71' : '#e74c3c')
            .setDescription(`Here is the current usage for the Gemini AI API today.`)
            .addFields(
                { name: '📅 Date', value: today, inline: true },
                { name: '📊 Usage', value: `${usage} / ${limit} requests`, inline: true },
                { name: '⏳ Remaining', value: `${remaining} requests`, inline: true },
                { name: '📈 Progress', value: `\`${percentage}%\` used` }
            )
            .setFooter({ text: 'Limits reset at midnight Pacific Time (PT)' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
