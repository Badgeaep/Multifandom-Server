const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getData, saveData } = require('../db');

const triviaQuestions = [
    { q: 'What is Luffy\'s dream in One Piece?', options: ['Become Hokage', 'Become King of the Pirates', 'Find the Dragon Balls', 'Become the #1 Hero'], answer: 1, category: '🏴‍☠️ Anime' },
    { q: 'What is the name of Naruto\'s signature jutsu?', options: ['Kamehameha', 'Rasengan', 'Spirit Bomb', 'Getsuga Tenshou'], answer: 1, category: '🍥 Anime' },
    { q: 'Who is the main protagonist of Attack on Titan?', options: ['Levi Ackerman', 'Armin Arlert', 'Eren Yeager', 'Mikasa Ackerman'], answer: 2, category: '⚔️ Anime' },
    { q: 'What is the name of Goku\'s most powerful form in Dragon Ball Super?', options: ['Super Saiyan Blue', 'Ultra Instinct', 'Super Saiyan 4', 'Kaioken x20'], answer: 1, category: '🐉 Anime' },
    { q: 'In Death Note, what must you know to kill someone with the notebook?', options: ['Their address', 'Their face and name', 'Their birthday', 'Their blood type'], answer: 1, category: '📓 Anime' },
    { q: 'Who is known as the "Strongest Hero" in My Hero Academia?', options: ['Endeavor', 'All Might', 'Deku', 'Hawks'], answer: 1, category: '🦸 Anime' },
    { q: 'What breathing style does Tanjiro use in Demon Slayer?', options: ['Water Breathing', 'Sun Breathing', 'Thunder Breathing', 'Both A and B'], answer: 3, category: '🔥 Anime' },
    { q: 'Who directed the movie "Inception"?', options: ['Steven Spielberg', 'Christopher Nolan', 'James Cameron', 'Martin Scorsese'], answer: 1, category: '🎬 Movies' },
    { q: 'What is the name of the fictional metal in the MCU from Wakanda?', options: ['Adamantium', 'Vibranium', 'Uru', 'Carbonadium'], answer: 1, category: '🦸 Movies' },
    { q: 'In Star Wars, who says "I am your father"?', options: ['Obi-Wan', 'Yoda', 'Darth Vader', 'Emperor Palpatine'], answer: 2, category: '⭐ Movies' },
    { q: 'What year was the first Harry Potter movie released?', options: ['1999', '2000', '2001', '2002'], answer: 2, category: '🧙 Movies' },
    { q: 'Who played the Joker in "The Dark Knight"?', options: ['Jared Leto', 'Joaquin Phoenix', 'Jack Nicholson', 'Heath Ledger'], answer: 3, category: '🃏 Movies' },
    { q: 'What is the best-selling video game of all time?', options: ['GTA V', 'Minecraft', 'Tetris', 'Fortnite'], answer: 1, category: '🎮 Gaming' },
    { q: 'In Among Us, what color is commonly associated with being "sus"?', options: ['Blue', 'Green', 'Red', 'Yellow'], answer: 2, category: '🎮 Gaming' },
    { q: 'What game features the character Master Chief?', options: ['Gears of War', 'Destiny', 'Halo', 'Call of Duty'], answer: 2, category: '🎮 Gaming' },
    { q: 'In Fortnite, what is the name of the storm that closes in?', options: ['The Circle', 'The Storm', 'The Zone', 'The Gas'], answer: 1, category: '🎮 Gaming' },
    { q: 'What year was Roblox released?', options: ['2004', '2006', '2008', '2010'], answer: 1, category: '🎮 Gaming' },
    { q: 'Which game has a character called "Steve"?', options: ['Terraria', 'Roblox', 'Minecraft', 'Fortnite'], answer: 2, category: '🎮 Gaming' },
    { q: 'Who is known as the "Queen of Pop"?', options: ['Lady Gaga', 'Beyoncé', 'Madonna', 'Taylor Swift'], answer: 2, category: '🎵 Music' },
    { q: 'Which K-pop group has members named RM, Jin, Suga, J-Hope, Jimin, V, and Jungkook?', options: ['BLACKPINK', 'EXO', 'BTS', 'TWICE'], answer: 2, category: '🎵 Music' },
    { q: 'Who sang "Bohemian Rhapsody"?', options: ['The Beatles', 'Queen', 'Led Zeppelin', 'Pink Floyd'], answer: 1, category: '🎵 Music' },
    { q: 'What Taylor Swift album features the song "Anti-Hero"?', options: ['1989', 'Reputation', 'Midnights', 'Folklore'], answer: 2, category: '🎵 Music' },
    { q: 'What does "rizz" mean in internet slang?', options: ['Being funny', 'Charisma/charm', 'Being angry', 'Running fast'], answer: 1, category: '🌐 Internet' },
    { q: 'What platform was originally called "Musical.ly"?', options: ['Instagram Reels', 'YouTube Shorts', 'TikTok', 'Snapchat'], answer: 2, category: '🌐 Internet' },
    { q: 'What is the name of the green ogre in the Dreamworks franchise?', options: ['Fiona', 'Donkey', 'Shrek', 'Farquaad'], answer: 2, category: '🎬 Movies' },
];

const activeGames = new Set();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trivia')
        .setDescription('Start a trivia question with buttons!'),
    async execute(interaction) {
        if (activeGames.has(interaction.channelId)) {
            return interaction.reply({ content: '❌ There\'s already a trivia game active here!', ephemeral: true });
        }

        const question = triviaQuestions[Math.floor(Math.random() * triviaQuestions.length)];
        activeGames.add(interaction.channelId);

        const row = new ActionRowBuilder().addComponents(
            question.options.map((opt, i) => 
                new ButtonBuilder()
                    .setCustomId(`trivia_${i}`)
                    .setLabel(opt.substring(0, 80))
                    .setStyle(ButtonStyle.Primary)
            )
        );

        const embed = new EmbedBuilder()
            .setTitle(`${question.category} Trivia!`)
            .setDescription(`**${question.q}**\n\n⏱️ You have **15 seconds** to click the correct button!`)
            .setColor('#e67e22')
            .setFooter({ text: 'First person to click the right answer wins!' });

        const response = await interaction.reply({ embeds: [embed], components: [row] });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 15000 });
        let winner = null;

        collector.on('collect', async i => {
            const choice = parseInt(i.customId.split('_')[1]);

            if (choice === question.answer) {
                winner = i.user;
                collector.stop('won');
            } else {
                await i.reply({ content: '❌ Wrong answer! Keep trying (if there is time left).', ephemeral: true });
            }
        });

        collector.on('end', async (collected, reason) => {
            activeGames.delete(interaction.channelId);

            // Disable buttons
            const disabledRow = new ActionRowBuilder().addComponents(
                row.components.map(b => ButtonBuilder.from(b).setDisabled(true).setStyle(b.data.style === ButtonStyle.Primary ? ButtonStyle.Secondary : b.data.style))
            );

            if (winner) {
                let economyData = getData('economy');
                if (!economyData[winner.id]) economyData[winner.id] = { coins: 0 };
                const reward = Math.floor(Math.random() * 16) + 10;
                economyData[winner.id].coins += reward;
                saveData('economy', economyData);
                const { updateQuestProgress } = require('../utils/questUtils');
                updateQuestProgress(winner.id, 'trivia_win');

                const winEmbed = new EmbedBuilder()
                    .setTitle('🎉 Correct!')
                    .setDescription(`**${winner.username}** won!\nThe answer was: **${question.options[question.answer]}**\n\n💰 +**${reward}** coins!`)
                    .setColor('#2ecc71');
                
                await interaction.editReply({ components: [disabledRow] });
                await interaction.followUp({ embeds: [winEmbed] });
            } else {
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏰ Time\'s Up!')
                    .setDescription(`Nobody got it right!\nThe answer was: **${question.options[question.answer]}**`)
                    .setColor('#e74c3c');
                
                await interaction.editReply({ components: [disabledRow] });
                await interaction.followUp({ embeds: [timeoutEmbed] });
            }
        });
    },
};
