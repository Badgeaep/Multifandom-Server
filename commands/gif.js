const { SlashCommandBuilder } = require('discord.js');
// In a real scenario, you'd use a package like 'node-fetch' to call the Tenor or Giphy API
// For simplicity and since we don't have a Tenor key, we'll construct a simple tenor search link.

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gif')
        .setDescription('Search for a gif.')
        .addStringOption(option => 
            option.setName('search')
                .setDescription('The term to search for')
                .setRequired(true)),
    async execute(interaction) {
        const searchTerm = interaction.options.getString('search');
        
        // As a fallback without an API key, Discord usually unfurls these tenor search links into the top gif
        const gifLink = `https://tenor.com/search/${encodeURIComponent(searchTerm)}-gifs`;

        await interaction.reply(gifLink);
    },
};
