const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getQuests, claimQuest } = require('../utils/questUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quests')
        .setDescription('View and claim your daily quests.')
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('Check your current daily quests and progress.'))
        .addSubcommand(sub =>
            sub.setName('claim')
                .setDescription('Claim rewards for completed quests.')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (sub === 'view') {
            const quests = getQuests(userId);
            
            const embed = new EmbedBuilder()
                .setTitle('📜 Daily Quests')
                .setColor('#3498db')
                .setDescription('Complete these tasks to earn extra coins! Quests reset every 24 hours.')
                .setThumbnail(interaction.user.displayAvatarURL());

            let allFinished = true;
            quests.forEach((q, i) => {
                const progressPercent = Math.min(100, Math.floor((q.progress / q.target) * 100));
                const progressBar = generateProgressBar(progressPercent);
                const status = q.claimed ? '✅ **Claimed**' : (q.progress >= q.target ? '⭐ **Ready to Claim!**' : `**${q.progress}/${q.target}**`);
                
                if (!q.claimed) allFinished = false;

                embed.addFields({
                    name: `${i + 1}. ${q.name}`,
                    value: `${q.description.replace('{target}', q.target)}\n${progressBar} ${status}\nReward: **${q.reward}** coins 💰`
                });
            });

            if (allFinished) {
                embed.setFooter({ text: 'You finished all your quests for today! Come back tomorrow.' });
            } else {
                embed.setFooter({ text: 'Use /quests claim to get your rewards!' });
            }

            await interaction.reply({ embeds: [embed] });

        } else if (sub === 'claim') {
            const quests = getQuests(userId);
            const claimable = quests.filter(q => q.progress >= q.target && !q.claimed);

            if (claimable.length === 0) {
                return interaction.reply({ content: '❌ You don\'t have any completed quests to claim right now.', ephemeral: true });
            }

            let totalReward = 0;
            let claimedNames = [];

            quests.forEach((q, i) => {
                if (q.progress >= q.target && !q.claimed) {
                    const result = claimQuest(userId, i);
                    if (result.success) {
                        totalReward += result.reward;
                        claimedNames.push(result.name);
                    }
                }
            });

            const embed = new EmbedBuilder()
                .setTitle('✨ Quests Claimed!')
                .setColor('#2ecc71')
                .setDescription(`You successfully claimed rewards for:\n${claimedNames.map(n => `• **${n}**`).join('\n')}\n\nTotal Reward: **${totalReward} coins** 💰`)
                .setThumbnail(interaction.user.displayAvatarURL());

            await interaction.reply({ embeds: [embed] });
        }
    },
};

function generateProgressBar(percent) {
    const size = 10;
    const filled = Math.floor(size * (percent / 100));
    const empty = size - filled;
    return '🟩'.repeat(filled) + '⬜'.repeat(empty);
}
