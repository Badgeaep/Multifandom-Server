const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
const { getData, saveData } = require('../db');

// Default shop items — admins can add custom ones
const DEFAULT_ITEMS = [
    { id: 'xp_boost', name: '⚡ XP Boost (2x for 1 hour)', price: 500, description: 'Double your XP gain from messages for 1 hour.', type: 'buff' },
    { id: 'steal_shield', name: '🛡️ Steal Shield (24h)', price: 750, description: 'Protects you from /steal for 24 hours.', type: 'buff' },
    { id: 'lucky_charm', name: '🍀 Lucky Charm', price: 1000, description: 'Your next /gamble or /coinflip has a 70% win rate instead of 50%.', type: 'consumable' },
    { id: 'daily_bonus', name: '💎 Daily Bonus Upgrade', price: 3000, description: 'Permanently increase your /daily reward by 50 coins.', type: 'permanent' },
];

function getShopItems() {
    const shopData = getData('shop');
    if (!shopData.items || shopData.items.length === 0) {
        return DEFAULT_ITEMS;
    }
    return shopData.items;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Browse and buy items with your coins!')
        .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
        .addSubcommand(sub =>
            sub.setName('browse')
                .setDescription('View all available items in the shop.'))
        .addSubcommand(sub =>
            sub.setName('buy')
                .setDescription('Buy an item from the shop.')
                .addStringOption(option =>
                    option.setName('item')
                        .setDescription('The item to buy')
                        .setRequired(true)
                        .setAutocomplete(false)))
        .addSubcommand(sub =>
            sub.setName('inventory')
                .setDescription('Check your purchased items.')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Check another user\'s inventory')
                        .setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('use')
                .setDescription('Use a consumable item from your inventory.')
                .addStringOption(option =>
                    option.setName('item')
                        .setDescription('The item to use')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('additem')
                .setDescription('[Admin] Add a custom item to the shop.')
                .addStringOption(option => option.setName('name').setDescription('Item name').setRequired(true))
                .addIntegerOption(option => option.setName('price').setDescription('Item price in coins').setRequired(true).setMinValue(1))
                .addStringOption(option => option.setName('description').setDescription('Item description').setRequired(true))
                .addStringOption(option => option.setName('type').setDescription('Item type').setRequired(true)
                    .addChoices(
                        { name: 'Buff (timed effect)', value: 'buff' },
                        { name: 'Consumable (one-time use)', value: 'consumable' },
                        { name: 'Cosmetic (permanent look)', value: 'cosmetic' },
                        { name: 'Permanent (forever upgrade)', value: 'permanent' }
                    )))
        .addSubcommand(sub =>
            sub.setName('removeitem')
                .setDescription('[Admin] Remove an item from the shop.')
                .addStringOption(option => option.setName('name').setDescription('Item name to remove').setRequired(true))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'browse') {
            const items = getShopItems();
            const economyData = getData('economy');
            const userCoins = (economyData[interaction.user.id] || { coins: 0 }).coins;

            const typeEmojis = { buff: '⚡', consumable: '🎯', cosmetic: '🎨', permanent: '💎' };

            let desc = `Your Balance: **${userCoins} coins** 💰\n\n`;
            for (const item of items) {
                const canAfford = userCoins >= item.price ? '✅' : '🔒';
                desc += `${canAfford} **${item.name}**\n`;
                desc += `> ${item.description}\n`;
                desc += `> Price: **${item.price}** coins | Type: ${typeEmojis[item.type] || '📦'} ${item.type}\n\n`;
            }

            const embed = new EmbedBuilder()
                .setTitle('🛒 Coin Shop')
                .setColor('#e67e22')
                .setDescription(desc)
                .setFooter({ text: 'Use /shop buy <item name> to purchase!' });

            await interaction.reply({ embeds: [embed] });

        } else if (sub === 'buy') {
            const itemName = interaction.options.getString('item').toLowerCase();
            const items = getShopItems();
            const item = items.find(i => i.name.toLowerCase().includes(itemName) || i.id === itemName);

            if (!item) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription('❌ Item not found! Use `/shop browse` to see available items.')],
                    ephemeral: true
                });
            }

            let economyData = getData('economy');
            if (!economyData[interaction.user.id]) economyData[interaction.user.id] = { coins: 0 };

            if (economyData[interaction.user.id].coins < item.price) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(`❌ You need **${item.price} coins** but only have **${economyData[interaction.user.id].coins}**. Keep grinding!`)],
                    ephemeral: true
                });
            }

            // Check if it's a permanent item and already owned
            if (item.type === 'permanent') {
                let inventoryData = getData('inventory');
                if (!inventoryData[interaction.user.id]) inventoryData[interaction.user.id] = [];
                const alreadyOwned = inventoryData[interaction.user.id].find(i => i.id === item.id);
                if (alreadyOwned) {
                    return interaction.reply({
                        embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription('❌ You already own this permanent item!')],
                        ephemeral: true
                    });
                }
            }

            // Deduct coins
            economyData[interaction.user.id].coins -= item.price;
            saveData('economy', economyData);

            // Add to inventory
            let inventoryData = getData('inventory');
            if (!inventoryData[interaction.user.id]) inventoryData[interaction.user.id] = [];
            inventoryData[interaction.user.id].push({
                id: item.id,
                name: item.name,
                type: item.type,
                purchasedAt: Date.now(),
                used: false
            });
            saveData('inventory', inventoryData);

            const embed = new EmbedBuilder()
                .setTitle('🛍️ Purchase Successful!')
                .setColor('#2ecc71')
                .setDescription(`You bought **${item.name}** for **${item.price} coins**!\n\nRemaining Balance: **${economyData[interaction.user.id].coins}** coins`)
                .setFooter({ text: item.type === 'consumable' || item.type === 'buff' ? 'Use /shop use <item> to activate it!' : 'Item added to your inventory!' });

            await interaction.reply({ embeds: [embed] });

        } else if (sub === 'inventory') {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const inventoryData = getData('inventory');
            const userInventory = inventoryData[targetUser.id] || [];

            if (userInventory.length === 0) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#9b59b6').setDescription(`${targetUser.id === interaction.user.id ? 'You don\'t' : `**${targetUser.username}** doesn't`} have any items yet! Check out \`/shop browse\`.`)],
                    ephemeral: true
                });
            }

            const typeEmojis = { buff: '⚡', consumable: '🎯', cosmetic: '🎨', permanent: '💎' };
            let desc = '';
            for (const item of userInventory) {
                const status = item.used ? '~~' : '**';
                const usedTag = item.used ? ' *(used)*' : '';
                desc += `${typeEmojis[item.type] || '📦'} ${status}${item.name}${status}${usedTag}\n`;
            }

            const embed = new EmbedBuilder()
                .setTitle(`🎒 ${targetUser.username}'s Inventory`)
                .setColor('#9b59b6')
                .setDescription(desc)
                .setThumbnail(targetUser.displayAvatarURL());

            await interaction.reply({ embeds: [embed] });

        } else if (sub === 'use') {
            const itemName = interaction.options.getString('item').toLowerCase();
            let inventoryData = getData('inventory');
            if (!inventoryData[interaction.user.id]) inventoryData[interaction.user.id] = [];

            const itemIndex = inventoryData[interaction.user.id].findIndex(
                i => !i.used && (i.name.toLowerCase().includes(itemName) || i.id === itemName)
            );

            if (itemIndex === -1) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription('❌ You don\'t have that item (unused) in your inventory!')],
                    ephemeral: true
                });
            }

            const item = inventoryData[interaction.user.id][itemIndex];

            // Activate the item based on type
            let activationData = getData('active_items');
            if (!activationData[interaction.user.id]) activationData[interaction.user.id] = {};

            if (item.id === 'xp_boost') {
                activationData[interaction.user.id].xp_boost = Date.now() + (60 * 60 * 1000); // 1 hour
            } else if (item.id === 'steal_shield') {
                activationData[interaction.user.id].steal_shield = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
            } else if (item.id === 'lucky_charm') {
                activationData[interaction.user.id].lucky_charm = true; // consumed on next gamble/coinflip
            }
            saveData('active_items', activationData);

            // Mark as used
            inventoryData[interaction.user.id][itemIndex].used = true;
            saveData('inventory', inventoryData);

            const embed = new EmbedBuilder()
                .setTitle('✨ Item Activated!')
                .setColor('#2ecc71')
                .setDescription(`You used **${item.name}**!`);

            if (item.id === 'xp_boost') embed.setFooter({ text: 'Your XP is doubled for the next hour!' });
            if (item.id === 'steal_shield') embed.setFooter({ text: 'You\'re protected from /steal for 24 hours!' });
            if (item.id === 'lucky_charm') embed.setFooter({ text: 'Your next /gamble or /coinflip has 70% win odds!' });

            await interaction.reply({ embeds: [embed] });

        } else if (sub === 'additem') {
            if (!interaction.guild) {
                return interaction.reply({ content: '❌ This subcommand can only be used in a server.', ephemeral: true });
            }
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
            }

            const name = interaction.options.getString('name');
            const price = interaction.options.getInteger('price');
            const description = interaction.options.getString('description');
            const type = interaction.options.getString('type');
            const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');

            let shopData = getData('shop');
            if (!shopData.items) shopData.items = [...DEFAULT_ITEMS];

            if (shopData.items.find(i => i.id === id)) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription('❌ An item with that name already exists!')],
                    ephemeral: true
                });
            }

            shopData.items.push({ id, name, price, description, type });
            saveData('shop', shopData);

            const embed = new EmbedBuilder()
                .setTitle('✅ Item Added to Shop!')
                .setColor('#2ecc71')
                .setDescription(`**${name}** — ${price} coins\n> ${description}\n> Type: ${type}`);
            await interaction.reply({ embeds: [embed] });

        } else if (sub === 'removeitem') {
            if (!interaction.guild) {
                return interaction.reply({ content: '❌ This subcommand can only be used in a server.', ephemeral: true });
            }
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
            }

            const name = interaction.options.getString('name').toLowerCase();
            let shopData = getData('shop');
            if (!shopData.items) shopData.items = [...DEFAULT_ITEMS];

            const initialLen = shopData.items.length;
            shopData.items = shopData.items.filter(i => !i.name.toLowerCase().includes(name) && i.id !== name);

            if (shopData.items.length === initialLen) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription('❌ Item not found!')],
                    ephemeral: true
                });
            }

            saveData('shop', shopData);
            const embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setDescription(`🗑️ Removed item matching "**${name}**" from the shop.`);
            await interaction.reply({ embeds: [embed] });
        }
    },
};
