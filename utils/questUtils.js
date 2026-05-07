const { getData, saveData } = require('../db');

const QUEST_TEMPLATES = [
    { id: 'ai_chat', name: 'Chatter', description: 'Talk to any AI persona {target} times.', target: 5, reward: 150, type: 'count' },
    { id: 'counting', name: 'Counter', description: 'Correctly count {target} times in the counting channel.', target: 10, reward: 200, type: 'count' },
    { id: 'gamble_win', name: 'Lucky Gambler', description: 'Win {target} coins in any gambling game.', target: 250, reward: 300, type: 'amount' },
    { id: 'word_chain', name: 'Chain Master', description: 'Successfully continue a word chain {target} times.', target: 5, reward: 150, type: 'count' },
    { id: 'daily_claim', name: 'Routine Check', description: 'Claim your /daily reward.', target: 1, reward: 50, type: 'count' },
    { id: 'trivia_win', name: 'Brainiac', description: 'Answer {target} trivia questions correctly.', target: 3, reward: 200, type: 'count' },
];

function getQuests(userId) {
    let questData = getData('quests');
    const now = new Date();
    const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

    if (!questData[userId] || questData[userId].lastReset !== today) {
        // Generate new random quests
        const shuffled = [...QUEST_TEMPLATES].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 3).map(q => ({
            ...q,
            progress: 0,
            claimed: false
        }));

        questData[userId] = {
            lastReset: today,
            active: selected
        };
        saveData('quests', questData);
    }

    return questData[userId].active;
}

function updateQuestProgress(userId, questIdType, amount = 1) {
    let questData = getData('quests');
    const now = new Date();
    const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

    // Ensure they have today's quests
    if (!questData[userId] || questData[userId].lastReset !== today) {
        getQuests(userId);
        questData = getData('quests'); // Refresh
    }

    let updated = false;
    for (const quest of questData[userId].active) {
        if (quest.id === questIdType && !quest.claimed && quest.progress < quest.target) {
            quest.progress = Math.min(quest.target, quest.progress + amount);
            updated = true;
        }
    }

    if (updated) {
        saveData('quests', questData);
    }
}

function claimQuest(userId, index) {
    let questData = getData('quests');
    if (!questData[userId] || !questData[userId].active[index]) return { success: false, message: 'Quest not found.' };

    const quest = questData[userId].active[index];
    if (quest.claimed) return { success: false, message: 'Quest already claimed.' };
    if (quest.progress < quest.target) return { success: false, message: 'Quest not finished yet.' };

    // Mark as claimed
    quest.claimed = true;
    saveData('quests', questData);

    // Give reward
    let economyData = getData('economy');
    if (!economyData[userId]) economyData[userId] = { coins: 0 };
    economyData[userId].coins += quest.reward;
    saveData('economy', economyData);

    return { success: true, reward: quest.reward, name: quest.name };
}

module.exports = {
    getQuests,
    updateQuestProgress,
    claimQuest
};
