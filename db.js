const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.json');

// Old file paths
const oldFiles = {
    family: path.join(__dirname, 'family.json'),
    favorites: path.join(__dirname, 'favorites.json'),
    levels: path.join(__dirname, 'levels.json'),
    warnings: path.join(__dirname, 'warnings.json'),
    userdata: path.join(__dirname, 'userdata.json'),
    invites: path.join(__dirname, 'invites.json'),
    reaction_roles: path.join(__dirname, 'reaction_roles.json')
};

// Initialize DB with empty structures
let db = {
    family: {},
    favorites: {},
    levels: {},
    warnings: {},
    userdata: {},
    invites: {},
    reaction_roles: {},
    ghost_mode: {},
    systemConfig: { nukeActive: false }
};

if (fs.existsSync(dbPath)) {
    try {
        const fileContent = fs.readFileSync(dbPath, 'utf8');
        db = { ...db, ...JSON.parse(fileContent) };
    } catch (e) {
        console.error('Error reading database.json:', e);
    }
} else {
    // Migrate old files if database.json doesn't exist
    for (const [key, filePath] of Object.entries(oldFiles)) {
        if (fs.existsSync(filePath)) {
            try {
                db[key] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                console.log(`Successfully migrated ${filePath} into database.json`);
            } catch (e) {
                console.error(`Error reading ${filePath}:`, e);
            }
        }
    }
    // Save migrated db
    saveDatabase();
}

function saveDatabase() {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

module.exports = {
    getData: (table) => {
        return db[table] || {};
    },
    saveData: (table, data) => {
        db[table] = data;
        saveDatabase();
    },
    isGhost: (userId, type = 'bot') => {
        const ghostData = db.ghost_mode || {};
        const userGhost = ghostData[userId];
        if (!userGhost) return false;

        // Support both old and new structure during transition
        const settings = userGhost[type] || (type === 'bot' ? userGhost : null);
        if (!settings) return false;

        return settings.active && (!settings.expires || settings.expires > Date.now());
    }
};
