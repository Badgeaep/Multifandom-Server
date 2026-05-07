const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getData, saveData } = require('../db');

// Word bank with categories
const wordBank = [
    // Anime
    { word: 'naruto', hint: 'Anime' },
    { word: 'pikachu', hint: 'Anime/Games' },
    { word: 'goku', hint: 'Anime' },
    { word: 'titan', hint: 'Anime' },
    { word: 'sharingan', hint: 'Anime' },
    { word: 'bankai', hint: 'Anime' },
    { word: 'chakra', hint: 'Anime' },
    { word: 'saitama', hint: 'Anime' },
    { word: 'zanpakuto', hint: 'Anime' },
    { word: 'kamehameha', hint: 'Anime' },
    // Gaming
    { word: 'fortnite', hint: 'Gaming' },
    { word: 'minecraft', hint: 'Gaming' },
    { word: 'roblox', hint: 'Gaming' },
    { word: 'valorant', hint: 'Gaming' },
    { word: 'creeper', hint: 'Gaming' },
    { word: 'enderman', hint: 'Gaming' },
    { word: 'diamond', hint: 'Gaming' },
    { word: 'headshot', hint: 'Gaming' },
    { word: 'respawn', hint: 'Gaming' },
    { word: 'controller', hint: 'Gaming' },
    // Movies/Shows
    { word: 'avengers', hint: 'Movies' },
    { word: 'hogwarts', hint: 'Movies' },
    { word: 'lightsaber', hint: 'Movies' },
    { word: 'thanos', hint: 'Movies' },
    { word: 'wakanda', hint: 'Movies' },
    { word: 'stranger', hint: 'Shows' },
    { word: 'mandalorian', hint: 'Shows' },
    // Internet/Slang
    { word: 'discord', hint: 'Internet' },
    { word: 'memes', hint: 'Internet' },
    { word: 'streaming', hint: 'Internet' },
    { word: 'hashtag', hint: 'Internet' },
    { word: 'emoji', hint: 'Internet' },
    { word: 'notification', hint: 'Internet' },
    // General
    { word: 'butterfly', hint: 'Nature' },
    { word: 'thunderstorm', hint: 'Nature' },
    { word: 'skateboard', hint: 'Sports' },
    { word: 'basketball', hint: 'Sports' },
    { word: 'adventure', hint: 'General' },
    { word: 'treasure', hint: 'General' },
    { word: 'explosion', hint: 'General' },
];

function scrambleWord(word) {
    const arr = word.split('');
    // Shuffle until it's different from the original
    for (let i = 0; i < 50; i++) {
        for (let j = arr.length - 1; j > 0; j--) {
            const k = Math.floor(Math.random() * (j + 1));
            [arr[j], arr[k]] = [arr[k], arr[j]];
        }
        if (arr.join('') !== word) break;
    }
    return arr.join('');
}

const activeGames = new Set();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unscramble')
        .setDescription('Unscramble a word! First to guess it wins coins.'),
    async execute(interaction) {
        if (activeGames.has(interaction.channelId)) {
            return interaction.reply({ content: '❌ There\'s already an unscramble game active in this channel!', ephemeral: true });
        }

        const entry = wordBank[Math.floor(Math.random() * wordBank.length)];
        const scrambled = scrambleWord(entry.word);
        activeGames.add(interaction.channelId);

        const embed = new EmbedBuilder()
            .setTitle('🔀 Unscramble!')
            .setDescription(`Unscramble this word:\n\n# \`${scrambled.toUpperCase()}\`\n\n💡 **Hint:** ${entry.hint}\n⏱️ You have **20 seconds**!`)
            .setColor('#1abc9c')
            .setFooter({ text: 'Type your answer in chat!' });

        await interaction.reply({ embeds: [embed] });

        const filter = m => !m.author.bot && m.content.toLowerCase().trim() === entry.word;

        try {
            const collector = interaction.channel.createMessageCollector({ filter, time: 20000, max: 1 });

            collector.on('end', async (collected) => {
                activeGames.delete(interaction.channelId);

                if (collected.size > 0) {
                    const winner = collected.first().author;
                    let economyData = getData('economy');
                    if (!economyData[winner.id]) economyData[winner.id] = { coins: 0 };
                    const reward = Math.floor(Math.random() * 21) + 15; // 15-35 coins
                    economyData[winner.id].coins += reward;
                    saveData('economy', economyData);

                    const winEmbed = new EmbedBuilder()
                        .setTitle('🎉 Unscrambled!')
                        .setDescription(`**${winner.username}** got it!\nThe word was: **${entry.word}**\n\n💰 +**${reward}** coins!`)
                        .setColor('#2ecc71');
                    await interaction.followUp({ embeds: [winEmbed] });
                } else {
                    const timeoutEmbed = new EmbedBuilder()
                        .setTitle('⏰ Time\'s Up!')
                        .setDescription(`Nobody got it!\nThe word was: **${entry.word}**`)
                        .setColor('#e74c3c');
                    await interaction.followUp({ embeds: [timeoutEmbed] });
                }
            });
        } catch (err) {
            activeGames.delete(interaction.channelId);
            console.error('Unscramble error:', err);
        }
    },
};
