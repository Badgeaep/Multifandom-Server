const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getData, saveData } = require('../db');

function generateProblem() {
    const type = Math.floor(Math.random() * 4);
    let a, b, question, answer;

    switch (type) {
        case 0: // Addition
            a = Math.floor(Math.random() * 200) + 10;
            b = Math.floor(Math.random() * 200) + 10;
            question = `${a} + ${b}`;
            answer = a + b;
            break;
        case 1: // Subtraction
            a = Math.floor(Math.random() * 200) + 50;
            b = Math.floor(Math.random() * a);
            question = `${a} - ${b}`;
            answer = a - b;
            break;
        case 2: // Multiplication
            a = Math.floor(Math.random() * 20) + 2;
            b = Math.floor(Math.random() * 15) + 2;
            question = `${a} × ${b}`;
            answer = a * b;
            break;
        case 3: // Division (clean results only)
            b = Math.floor(Math.random() * 12) + 2;
            answer = Math.floor(Math.random() * 20) + 2;
            a = b * answer;
            question = `${a} ÷ ${b}`;
            break;
    }

    return { question, answer };
}

const activeGames = new Set();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mathrace')
        .setDescription('Race to solve a math problem! First correct answer wins.'),
    async execute(interaction) {
        if (activeGames.has(interaction.channelId)) {
            return interaction.reply({ content: '❌ There\'s already a math race active in this channel!', ephemeral: true });
        }

        const problem = generateProblem();
        activeGames.add(interaction.channelId);

        const embed = new EmbedBuilder()
            .setTitle('➕ Math Race!')
            .setDescription(`Solve this as fast as you can:\n\n# \`${problem.question} = ?\`\n\n⏱️ You have **15 seconds**!`)
            .setColor('#e91e63')
            .setFooter({ text: 'Type your answer in chat!' });

        await interaction.reply({ embeds: [embed] });

        const filter = m => !m.author.bot && parseInt(m.content.trim()) === problem.answer;

        try {
            const collector = interaction.channel.createMessageCollector({ filter, time: 15000, max: 1 });

            collector.on('end', async (collected) => {
                activeGames.delete(interaction.channelId);

                if (collected.size > 0) {
                    const winner = collected.first().author;
                    let economyData = getData('economy');
                    if (!economyData[winner.id]) economyData[winner.id] = { coins: 0 };
                    const reward = Math.floor(Math.random() * 16) + 10; // 10-25 coins
                    economyData[winner.id].coins += reward;
                    saveData('economy', economyData);

                    const winEmbed = new EmbedBuilder()
                        .setTitle('🏆 Solved!')
                        .setDescription(`**${winner.username}** got it first!\n\`${problem.question} = ${problem.answer}\`\n\n💰 +**${reward}** coins!`)
                        .setColor('#2ecc71');
                    await interaction.followUp({ embeds: [winEmbed] });
                } else {
                    const timeoutEmbed = new EmbedBuilder()
                        .setTitle('⏰ Time\'s Up!')
                        .setDescription(`Nobody solved it!\nThe answer was: **${problem.answer}**`)
                        .setColor('#e74c3c');
                    await interaction.followUp({ embeds: [timeoutEmbed] });
                }
            });
        } catch (err) {
            activeGames.delete(interaction.channelId);
            console.error('Math race error:', err);
        }
    },
};
