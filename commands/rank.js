const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'levels.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Check your current chat level and XP.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Check another user\'s rank')
                .setRequired(false)),
    async execute(interaction) {
        let levelsData = {};
        if (fs.existsSync(dataPath)) {
            try { levelsData = JSON.parse(fs.readFileSync(dataPath, 'utf-8')); } catch(e){}
        }

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const data = levelsData[targetUser.id] || { xp: 0, level: 1 };

        const xpNeeded = data.level * 100;
        
        // Simple visual ASCII progress bar mapping
        const progress = Math.min(100, Math.floor((data.xp / xpNeeded) * 100));
        const blocks = Math.floor(progress / 10);
        const bar = '🟩'.repeat(blocks) + '⬛'.repeat(10 - blocks);

        const embed = new EmbedBuilder()
            .setTitle(`📊 Rank for ${targetUser.username}`)
            .setColor('#3498db')
            .addFields(
                { name: '🌟 Level', value: `${data.level}`, inline: true },
                { name: '✨ Experience', value: `${data.xp} / ${xpNeeded} XP`, inline: true },
                { name: '📈 Progress', value: `${bar} ${progress}%`, inline: false }
            )
            .setThumbnail(targetUser.displayAvatarURL())
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    },
};
