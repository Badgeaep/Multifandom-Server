const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'levels.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the Top 10 users with the highest level.'),
    async execute(interaction) {
        let levelsData = {};
        if (fs.existsSync(dataPath)) {
            try { levelsData = JSON.parse(fs.readFileSync(dataPath, 'utf-8')); } catch(e){}
        }

        // Convert the object into an array: [{ id: '123', xp: 50, level: 2 }, ...]
        // Default missing values to 0/1 so we don't break sorting
        const usersArray = Object.entries(levelsData).map(([id, data]) => ({
            id,
            xp: data.xp || 0,
            level: data.level || 1
        }));

        // Sort by level (descending), then by xp (descending)
        usersArray.sort((a, b) => {
            if (b.level !== a.level) {
                return b.level - a.level;
            }
            return b.xp - a.xp;
        });

        // Get Top 10
        const top10 = usersArray.slice(0, 10);

        let leaderboardText = '';
        for (let i = 0; i < top10.length; i++) {
            const userObj = top10[i];
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**#${i + 1}**`;
            leaderboardText += `${medal} <@${userObj.id}> - **Level ${userObj.level}** (${userObj.xp} XP)\n`;
        }

        if (!leaderboardText) {
            leaderboardText = '*No one has gained any XP yet.*';
        }

        const embed = new EmbedBuilder()
            .setTitle('🏆 Server Leaderboard - Top 10')
            .setColor('#f1c40f')
            .setDescription(leaderboardText)
            .setTimestamp();

        // Check user's own rank
        const callerIndex = usersArray.findIndex(u => u.id === interaction.user.id);
        
        let footerText = '';
        if (callerIndex === -1) {
            // User hasn't typed anything yet
            footerText = `You are unranked. Send some messages to get on the leaderboard!`;
        } else {
            const callerData = usersArray[callerIndex];
            footerText = `Your Rank: #${callerIndex + 1} | Level ${callerData.level} | ${callerData.xp} XP`;
        }

        embed.setFooter({ text: footerText, iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed] });
    },
};
