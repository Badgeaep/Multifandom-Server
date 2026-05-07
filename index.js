require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes, Partials, InteractionContextType, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getData } = require('./db');
const { PermissionFlagsBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
    ],
    partials: [Partials.Message, Partials.Reaction, Partials.User, Partials.Channel],
});

client.commands = new Collection();
const commands = [];

// Load Events
const eventsPath = path.join(__dirname, 'events');
if (!fs.existsSync(eventsPath)) fs.mkdirSync(eventsPath);

const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// Load Commands
const commandsPath = path.join(__dirname, 'commands');
if (!fs.existsSync(commandsPath)) fs.mkdirSync(commandsPath);

const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
}


client.on('interactionCreate', async (interaction) => {
    // --- EMERGENCY NUKE CHECK ---
    const config = getData('systemConfig');
    if (config.nukeActive) {
        const isAdmin = interaction.member && interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const isNukeCommand = interaction.isChatInputCommand() && interaction.commandName === 'nuke';

        // Block everything except admins running the /nuke command
        if (!isAdmin || !isNukeCommand) {
            const emergencyEmbed = new EmbedBuilder()
                .setTitle('☢️ SYSTEM LOCK-DOWN')
                .setColor('#ff4757')
                .setDescription('The bot is currently in **Emergency Lock-down Mode**. All functions have been disabled by an administrator.')
                .addFields({ name: 'Reason', value: config.nukeReason || 'No reason provided.' })
                .setTimestamp()
                .setFooter({ text: 'Emergency Shutdown System' });

            return interaction.reply({ embeds: [emergencyEmbed], ephemeral: true });
        }
    }

    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    } else if (interaction.isButton()) {
        try {
             if (interaction.customId === 'verify_button') {
                const verifyEvent = require('./events/verifyButton');
                await verifyEvent.execute(interaction);
             } else if (interaction.customId === 'create_ticket') {
                const ticketEvent = require('./events/createTicket');
                await ticketEvent.execute(interaction);
             } else if (interaction.customId === 'close_ticket') {
                const closeTicketEvent = require('./events/closeTicket');
                await closeTicketEvent.execute(interaction);
             } else if (interaction.customId.startsWith('delete_toxic_')) {
                const parts = interaction.customId.split('_');
                const channelId = parts[2];
                const messageId = parts[3];

                try {
                    const channel = await client.channels.fetch(channelId);
                    if (channel) {
                        const targetMsg = await channel.messages.fetch(messageId);
                        if (targetMsg) {
                            await targetMsg.delete();
                            
                            const oldEmbed = interaction.message.embeds[0];
                            const newEmbed = EmbedBuilder.from(oldEmbed)
                                .setTitle('🤖 AI AutoMod: Content Deleted')
                                .setColor('#2ecc71')
                                .addFields({ name: 'Action By', value: `${interaction.user.tag}`, inline: true });
                            
                            await interaction.update({ embeds: [newEmbed], components: [] });
                        }
                    }
                } catch (err) {
                    console.error('Failed to delete message via button:', err);
                    await interaction.reply({ content: '❌ Failed to delete the message. It might have already been removed.', ephemeral: true });
                }
             }
        } catch (error) {
            console.error(error);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
