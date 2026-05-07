const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const questions = [
    { a: 'Be a hero in a world of villains', b: 'Be a villain in a world of heroes' },
    { a: 'Have the power of Flight', b: 'Have the power of Invisibility' },
    { a: 'Live in the Naruto Universe', b: 'Live in the One Piece Universe' },
    { a: 'Be able to speak all languages', b: 'Be able to speak to animals' },
    { a: 'Always be 10 minutes late', b: 'Always be 20 minutes early' },
    { a: 'Have a Rewind button for your life', b: 'Have a Pause button for your life' },
    { a: 'Never be able to use a touchscreen again', b: 'Never be able to use a keyboard again' },
    { a: 'Be the smartest person in the world', b: 'Be the richest person in the world' },
    { a: 'Live in a world with magic but no technology', b: 'Live in a world with advanced technology but no magic' },
    { a: 'Have a dragon as a pet', b: 'Have a phoenix as a pet' },
    { a: 'Be able to teleport anywhere', b: 'Be able to read minds' },
    { a: 'Always have to sing instead of speaking', b: 'Always have to dance instead of walking' }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wyr')
        .setDescription('Play a game of Would You Rather!'),
    async execute(interaction) {
        const question = questions[Math.floor(Math.random() * questions.length)];

        const embed = new EmbedBuilder()
            .setTitle('🤔 Would You Rather...')
            .setColor('#3498db')
            .setDescription(`🟦 **Option A:** ${question.a}\n\n**OR**\n\n🟥 **Option B:** ${question.b}`)
            .setFooter({ text: 'React with 🟦 or 🟥 to vote!' });

        const message = await interaction.reply({ embeds: [embed], fetchReply: true });
        await message.react('🟦');
        await message.react('🟥');
    },
};
