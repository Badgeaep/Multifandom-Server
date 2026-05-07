const { SlashCommandBuilder, AttachmentBuilder, InteractionContextType, ApplicationIntegrationType, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, EmbedBuilder } = require('discord.js');
if (typeof process.getBuiltinModule !== 'function') {
    process.getBuiltinModule = (name) => require(name);
}
const DOMMatrix = require('dommatrix');
global.DOMMatrix = DOMMatrix;
const { pdfToPng } = require('pdf-to-png-converter');
const axios = require('axios');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

ffmpeg.setFfmpegPath(ffmpegPath);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gif')
        .setDescription('Upload a photo, video, or PDF and convert it to a favorite-able gif!')
        .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
        .addAttachmentOption(option => 
            option.setName('file')
                .setDescription('Upload your image, video, or PDF file here')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('link')
                .setDescription('Or paste a direct link to an image, video, or PDF')
                .setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply();

        const file = interaction.options.getAttachment('file');
        const link = interaction.options.getString('link');

        let targetUrl = null;
        let contentType = '';

        if (file) {
            targetUrl = file.url;
            contentType = file.contentType || '';
        } else if (link) {
            targetUrl = link;
        } else {
            return interaction.editReply({ content: 'You need to attach a file or provide a link!' });
        }

        try {
            // If we don't know the content type yet (link was provided), fetch the headers
            if (!contentType) {
                try {
                    const headResponse = await axios.head(targetUrl);
                    contentType = headResponse.headers['content-type'] || '';
                } catch {
                    // Some servers don't support HEAD, we'll figure it out from the URL
                    contentType = '';
                }
            }

            const isVideo = contentType.includes('video') || 
                            targetUrl.match(/\.(mp4|mov|webm|avi|mkv|flv)(\?|$)/i);

            if (isVideo) {
                // --- VIDEO TO GIF ---
                const gifBuffer = await videoToGif(targetUrl);
                const attachment = new AttachmentBuilder(gifBuffer, { name: 'converted.gif' });
                const msg = await interaction.editReply({ files: [attachment] });
                try { await msg.react('⭐'); } catch { /* reactions may not work in DMs */ }
            } else if (contentType.includes('pdf') || targetUrl.match(/\.pdf(\?|$)/i)) {
                // --- PDF TO GIF ---
                const response = await axios.get(targetUrl, { responseType: 'arraybuffer' });
                const pdfBuffer = Buffer.from(response.data);

                // Get page count
                let pageCount = 0;
                try {
                    // pdfToPng often prefers Uint8Array for Buffers in some environments
                    const pdfUint8Array = new Uint8Array(pdfBuffer);
                    const pagesMetadata = await pdfToPng(pdfUint8Array, { returnMetadataOnly: true });
                    pageCount = pagesMetadata.length;
                } catch (metadataErr) {
                    console.error('PDF Metadata Error:', metadataErr);
                    throw new Error(`Failed to read PDF metadata: ${metadataErr.message}`);
                }

                if (pageCount === 0) {
                    return interaction.editReply({ content: '❌ This PDF appears to be empty or invalid.' });
                }

                let selectedPage = 1;

                if (pageCount > 1) {
                    const options = [];
                    for (let i = 1; i <= Math.min(pageCount, 25); i++) {
                        options.push({
                            label: `Page ${i}`,
                            value: i.toString(),
                        });
                    }

                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId('select_pdf_page')
                        .setPlaceholder('Select a page to convert')
                        .addOptions(options);

                    const row = new ActionRowBuilder().addComponents(selectMenu);

                    const prompt = await interaction.editReply({
                        content: `This PDF has **${pageCount}** pages. Which page would you like to convert to a GIF?${pageCount > 25 ? ' (Showing first 25)' : ''}`,
                        components: [row]
                    });

                    try {
                        const filter = i => i.customId === 'select_pdf_page' && i.user.id === interaction.user.id;
                        const selection = await prompt.awaitMessageComponent({ filter, time: 30000, componentType: ComponentType.StringSelect });
                        selectedPage = parseInt(selection.values[0]);
                        await selection.update({ content: `Converting page ${selectedPage}...`, components: [] });
                    } catch (err) {
                        return interaction.editReply({ content: 'Timed out waiting for page selection.', components: [] });
                    }
                }

                // Convert selected page to PNG
                let pngBuffer;
                try {
                    const pdfUint8Array = new Uint8Array(pdfBuffer);
                    const pngPages = await pdfToPng(pdfUint8Array, { 
                        pagesToProcess: [selectedPage],
                        viewportScale: 2.0 // Good quality
                    });

                    if (pngPages.length === 0 || !pngPages[0].content) {
                        throw new Error('No PNG content returned from converter.');
                    }
                    pngBuffer = pngPages[0].content;
                } catch (renderErr) {
                    console.error('PDF Render Error:', renderErr);
                    throw new Error(`Failed to render PDF page: ${renderErr.message}`);
                }

                // Convert PNG to GIF using sharp
                const gifBuffer = await sharp(pngBuffer)
                    .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
                    .gif({ 
                        colors: 256, 
                        dither: 1.0, 
                        effort: 10   
                    })
                    .toBuffer();

                const fileName = `page_${selectedPage}.gif`;
                const attachment = new AttachmentBuilder(gifBuffer, { name: fileName });
                const embed = new EmbedBuilder()
                    .setTitle(`📄 PDF Page ${selectedPage} Converted`)
                    .setImage(`attachment://${fileName}`)
                    .setColor('#3498db')
                    .setFooter({ text: 'Converted from PDF' });

                const msg = await interaction.editReply({ 
                    content: '', 
                    files: [attachment], 
                    embeds: [embed],
                    components: [] 
                });
                try { await msg.react('⭐'); } catch { /* reactions may not work in DMs */ }

            } else {
                // --- IMAGE LOGIC (same as before) ---
                const response = await axios.get(targetUrl, { responseType: 'arraybuffer' });
                const fetchedType = response.headers['content-type'] || contentType;

                let gifBuffer;

                if (fetchedType && fetchedType.includes('gif')) {
                    gifBuffer = response.data;
                } else if (fetchedType && fetchedType.includes('image')) {
                    gifBuffer = await sharp(response.data)
                        .gif({ 
                            colors: 256, 
                            dither: 1.0, 
                            effort: 10   
                        })
                        .toBuffer();
                } else {
                    // Not an image or video (like a Tenor webpage), just post the link
                    const msg = await interaction.editReply({ content: targetUrl });
                    try { await msg.react('⭐'); } catch { /* reactions may not work in DMs */ }
                    return;
                }

                const attachment = new AttachmentBuilder(gifBuffer, { name: 'hq_converted.gif' });
                const msg = await interaction.editReply({ files: [attachment] });
                try { await msg.react('⭐'); } catch { /* reactions may not work in DMs */ }
            }
        } catch (error) {
            console.error('GIF Conversion Error:', error);
            
            // Log to admin channel
            const logChannelId = '1494775931053670430';
            try {
                const logChannel = interaction.guild.channels.cache.get(logChannelId);
                if (logChannel) {
                    const errorEmbed = new EmbedBuilder()
                        .setTitle('❌ GIF Conversion Failure')
                        .setColor('#e74c3c')
                        .addFields(
                            { name: 'User', value: `${interaction.user.tag} (${interaction.user.id})` },
                            { name: 'URL', value: targetUrl ? (targetUrl.length > 1000 ? 'URL too long' : targetUrl) : 'N/A' },
                            { name: 'Error', value: (error.message || String(error)).substring(0, 1000) }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [errorEmbed] });
                }
            } catch (logErr) {
                console.error('Failed to log to admin channel:', logErr);
            }

            if (link) {
                const msg = await interaction.editReply({ content: link });
                try { await msg.react('⭐'); } catch { /* reactions may not work in DMs */ }
            } else {
                await interaction.editReply({ content: '❌ Sorry, there was an issue converting your file.' });
            }
        }
    },
};

/**
 * Downloads a video from a URL and converts the first 3 seconds (or full video if ≤3s) to a GIF.
 * Returns a Buffer of the GIF.
 */
function videoToGif(url) {
    return new Promise(async (resolve, reject) => {
        const tmpDir = path.join(__dirname, '..', '.tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        const id = crypto.randomBytes(8).toString('hex');
        const tmpVideo = path.join(tmpDir, `${id}_input.mp4`);
        const tmpGif = path.join(tmpDir, `${id}_output.gif`);

        try {
            // Download the video
            const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
            fs.writeFileSync(tmpVideo, Buffer.from(response.data));

            // Probe the video to get its duration
            const duration = await getVideoDuration(tmpVideo);
            // Use full duration if 3s or shorter, otherwise cap at 3s
            const clipDuration = (duration && duration <= 3) ? duration : 3;

            // Convert to GIF: scale down to max 480px wide, 15fps for reasonable file size
            ffmpeg(tmpVideo)
                .setStartTime(0)
                .setDuration(clipDuration)
                .outputOptions([
                    '-vf', 'fps=15,scale=480:-1:flags=lanczos',
                    '-gifflags', '+transdiff',
                ])
                .output(tmpGif)
                .on('end', () => {
                    try {
                        const gifData = fs.readFileSync(tmpGif);
                        resolve(gifData);
                    } catch (readErr) {
                        reject(readErr);
                    } finally {
                        // Cleanup temp files
                        cleanup(tmpVideo, tmpGif);
                    }
                })
                .on('error', (err) => {
                    cleanup(tmpVideo, tmpGif);
                    reject(err);
                })
                .run();
        } catch (err) {
            cleanup(tmpVideo, tmpGif);
            reject(err);
        }
    });
}

function getVideoDuration(filePath) {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err || !metadata || !metadata.format) {
                resolve(null);
            } else {
                resolve(metadata.format.duration || null);
            }
        });
    });
}

function cleanup(...files) {
    for (const f of files) {
        try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
}
