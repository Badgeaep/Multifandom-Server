const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'invites.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invites')
        .setDescription('Check invite statistics for yourself or the server leaderboard.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('View a specific user\'s invites')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('leaderboard')
                .setDescription('Show the top 10 invite leaderboard')
                .setRequired(false)),
    async execute(interaction) {
        let inviteData = {};
        if (fs.existsSync(dataPath)) {
            try { inviteData = JSON.parse(fs.readFileSync(dataPath, 'utf-8')); } catch(e){}
        }

        const showLeaderboard = interaction.options.getBoolean('leaderboard');
        
        if (showLeaderboard) {
            // Sort to top 10
            const sorted = Object.entries(inviteData).sort((a, b) => b[1] - a[1]).slice(0, 10);
            
            const embed = new EmbedBuilder()
                .setTitle('🏆 Top 10 Inviter Leaderboard')
                .setColor('#f1c40f')
                .setTimestamp();
            
            if (sorted.length === 0) {
                embed.setDescription('Nobody has invited anyone yet!');
            } else {
                let boardText = '';
                let rank = 1;
                for (const [id, count] of sorted) {
                    boardText += `**${rank}.** <@${id}> - **${count}** invites\n`;
                    rank++;
                }
                embed.setDescription(boardText);
            }
            
            return await interaction.reply({ embeds: [embed] });
        }

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const count = inviteData[targetUser.id] || 0;

        const embed = new EmbedBuilder()
            .setTitle(`📫 Invite Stats for ${targetUser.username}`)
            .setColor('#3498db')
            .setDescription(`<@${targetUser.id}> has invited **${count}** members to the server!`)
            .setThumbnail(targetUser.displayAvatarURL())
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    },
};
