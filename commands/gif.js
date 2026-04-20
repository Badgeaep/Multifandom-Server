const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const sharp = require('sharp');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gif')
        .setDescription('Upload a photo to chat and convert it to a favorite-able gif!')
        .addAttachmentOption(option => 
            option.setName('file')
                .setDescription('Upload your image file here')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('link')
                .setDescription('Or paste a direct Tenor or Giphy link here')
                .setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply();

        const file = interaction.options.getAttachment('file');
        const link = interaction.options.getString('link');

        if (file) {
            try {
                // Fetch the high-quality image from Discord
                const response = await axios.get(file.url, { responseType: 'arraybuffer' });
                
                let gifBuffer;
                if (!file.contentType.includes('gif')) {
                    // Maximum effort true GIF conversion 
                    // This is the absolute highest quality compression possible to minimize color destruction!
                    gifBuffer = await sharp(response.data)
                        .gif({ 
                            colors: 256, // Max limit for gif format
                            dither: 1.0, // Best gradient smoothing
                            effort: 10   // Max CPU encoding effort
                        })
                        .toBuffer();
                } else {
                    gifBuffer = response.data; // Already a real gif
                }

                // Send the authentically converted GIF
                const attachment = new AttachmentBuilder(gifBuffer, { name: 'hq_converted.gif' });
                await interaction.editReply({ files: [attachment] });
            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: 'Sorry, there was an issue converting your photo.' });
            }
        } else if (link) {
            await interaction.editReply({ content: link });
        } else {
            await interaction.editReply({ content: 'You need to attach a file or provide a link!' });
        }
    },
};
