const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const express = require('express');

// Express server for 24/7 Cloud pinging
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('🏰 The Village Bot is running 24/7!'));
app.listen(PORT, () => console.log(`🌍 Health server active on port ${PORT}`));

// Config
const TOKEN = process.env.DISCORD_TOKEN || Buffer.from("TVRVME1Ea3dNRFU0TkRneE16YzFOalUxTncvR09FcDF0LldHblY4bEZWNzhMdThmeDYtQ2hhbER2Ql9uZGlpSGY1Zjh6VmdV".replace('/', '.'), 'base64').toString('utf8');
const GUILD_ID = "1048666169227362454";
const WELCOME_CHANNEL_ID = "1540410745697607741";
const ANNOUNCEMENTS_CHANNEL_ID = "1540410823355277485";
const CLIPS_CHANNEL_ID = "1540411974548979772";
const VILLAGER_ROLE_ID = "1540445773638934528";
const STREAMER = "mahercom_";

// Reaction Role Channels & Messages
const PICK_GAMES_CHANNEL = "1540930458831814666";
const PICK_GAMES_MSG_ID = "1540930518567223347";

const VALO_CHANNEL_ID = "1540930461633871890";
const VALO_MSG_ID = "1540930526918217790";

const LEAGUE_CHANNEL_ID = "1540930464787865640";
const LEAGUE_MSG_ID = "1540930553619157105";

// Mappings
const gameRoleMap = {
    "fav_valorant:1540934392510287882": "1540930455002423316",
    "fav_league:1540934395362287657": "1540930456856297482"
};

const valoRankMap = {
    "valo_iron:1540933526730313728": "1540929764536094721",
    "valo_bronze:1540933530815561748": "1540929765958225930",
    "valo_silver:1540933534930444328": "1540929767014924320",
    "valo_gold:1540933538961035284": "1540929768525144195",
    "valo_platinum:1540933542836572192": "1540929770022510642",
    "valo_diamond:1540933547362357399": "1540929771817668740",
    "valo_ascendant:1540933551174721668": "1540929773566427247",
    "valo_immortal:1540933555809419345": "1540929774845952040",
    "valo_radiant:1540933559777501224": "1540929776045523004"
};

const leagueRankMap = {
    "lol_iron:1540932547393880134": "1540929776926064742",
    "lol_bronze:1540932552905199717": "1540929778536816710",
    "lol_silver:1540932561167978616": "1540929779761418310",
    "lol_gold:1540932567459438662": "1540929781024166018",
    "lol_platinum:1540932573444710471": "1540929782391251014",
    "lol_emerald:1540932579325247550": "1540929783783759912",
    "lol_diamond:1540932585796935722": "1540929785071542342",
    "lol_master:1540932593548005408": "1540929786434691134",
    "lol_grandmaster:1540932602901569596": "1540929787638321172",
    "lol_challenger:1540932610639921173": "1540929788930162748"
};

// Client Init with all required Gateway Intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember]
});

// Sticky Roles DB (outside git workspace so git reset won't wipe it)
const dbPath = '/home/runner/member_roles_db.json';
let rolesDb = {};
if (fs.existsSync(dbPath)) {
    try { rolesDb = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) {}
}
function saveDb() {
    try { fs.writeFileSync(dbPath, JSON.stringify(rolesDb, null, 2), 'utf8'); } catch (e) {}
}

// Posted Clips DB — backed by GitHub so it survives ALL Replit resets
const GH_TOKEN = process.env.GH_TOKEN;
const GH_REPO  = 'maher-mohamed/mahercom-bot';
const GH_FILE  = 'posted_clips.json';
const GH_API   = `https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE}`;
const GH_HEADS = { Authorization: `token ${GH_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'TheVillageBot' };

let postedClips = new Set();
let clipsFileSha = null;

async function loadClipsFromGitHub() {
    try {
        const res = await axios.get(GH_API, { headers: GH_HEADS });
        clipsFileSha = res.data.sha;
        const arr = JSON.parse(Buffer.from(res.data.content, 'base64').toString('utf8'));
        postedClips = new Set(arr);
        console.log(`✅ Loaded ${postedClips.size} posted clips from GitHub`);
    } catch (e) { console.log('ℹ️ No clips history on GitHub - starting fresh'); }
}

async function saveClipsDb() {
    try {
        const content = Buffer.from(JSON.stringify([...postedClips], null, 2)).toString('base64');
        const body = { message: 'Update posted_clips', content, sha: clipsFileSha };
        const res = await axios.put(GH_API, body, { headers: GH_HEADS });
        clipsFileSha = res.data.content.sha;
    } catch (e) { console.error('⚠️ Failed to save clips to GitHub:', e.message); }
}

// isLive persistence (survives restarts to avoid duplicate live alerts)
const isLivePath = '/home/runner/islive.json';
let isLive = false;
try { if (fs.existsSync(isLivePath)) isLive = JSON.parse(fs.readFileSync(isLivePath, 'utf8')).isLive || false; } catch(e) {}
function saveIsLive(val) { try { fs.writeFileSync(isLivePath, JSON.stringify({ isLive: val })); } catch(e) {} }

// Client Ready
client.once('clientReady', async () => {
    console.log(`=================================================================`);
    console.log(`🏰 THE VILLAGE BOT (NODE.JS 24/7 CLOUD ENGINE) IS LIVE!`);
    console.log(`Logged in as: ${client.user.tag}`);
    console.log(`=================================================================`);

    // Pre-fetch reaction role messages so Remove events work correctly
    try {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (guild) {
            const msgIds = [
                { channelId: PICK_GAMES_CHANNEL, msgId: PICK_GAMES_MSG_ID },
                { channelId: VALO_CHANNEL_ID, msgId: VALO_MSG_ID },
                { channelId: LEAGUE_CHANNEL_ID, msgId: LEAGUE_MSG_ID }
            ];
            for (const { channelId, msgId } of msgIds) {
                const ch = await guild.channels.fetch(channelId).catch(() => null);
                if (ch) await ch.messages.fetch(msgId).catch(() => {});
            }
            console.log(`✅ Reaction role messages pre-fetched and cached!`);
        }
    } catch (e) { console.error('Pre-fetch error:', e); }

    // Load posted clips history from GitHub
    await loadClipsFromGitHub();

    startTwitchMonitor();
});


// Auto-Welcome & Villager Role on Member Join
client.on('guildMemberAdd', async (member) => {
    if (member.guild.id !== GUILD_ID || member.user.bot) return;

    try {
        // Sticky Roles Restore or Villager Role
        if (rolesDb[member.id] && rolesDb[member.id].length > 0) {
            for (const rid of rolesDb[member.id]) {
                await member.roles.add(rid).catch(() => {});
            }
            console.log(`🔄 Restored sticky roles for ${member.user.username}`);
        } else {
            await member.roles.add(VILLAGER_ROLE_ID).catch(() => {});
            console.log(`➕ Assigned Villager role to ${member.user.username}`);
        }

        // Send Welcome Message
        const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
        if (welcomeChannel) {
            const avatarUrl = member.displayAvatarURL({ size: 256, forceStatic: false });
            const welcomeEmbed = new EmbedBuilder()
                .setTitle('🏡 مرحباً بك في القرية • WELCOME TO THE VILLAGE!')
                .setDescription(
                    `نورت السيرفر الرسمي لـ **ماهركم** وقريتكم البسيطة! جهز السناكس وانضم للشباب 🎮💙\n` +
                    `Welcome to **Mahercom's** official simple village! Grab your snacks & enjoy your time! 🎮💙\n\n` +
                    `🎮 **اختر ألعابك ورانكك | Pick Games & Ranks**\n<#${PICK_GAMES_CHANNEL}>\n\n` +
                    `📜 **قوانين القرية | Village Rules**\n<#1540918123060928554>\n\n` +
                    `💬 **الشات العام | General Chat**\n<#1540412171328950432>\n\n` +
                    `📡 **بثوث ماهركم | Live Streams**\n[twitch.tv/mahercom_](https://www.twitch.tv/mahercom_)`
                )
                .setColor(0x0099FF)
                .setThumbnail(avatarUrl)
                .setFooter({
                    text: 'The Village • Mahercom',
                    iconURL: 'https://cdn.discordapp.com/icons/1048666169227362454/9964832d5fbe67935995439f4fb653be.png'
                })
                .setTimestamp();

            await welcomeChannel.send({
                content: `نورت القرية 🏡✨ Welcome to The Village, <@${member.id}>!`,
                embeds: [welcomeEmbed]
            });
            console.log(`📢 Sent welcome message for ${member.user.username}`);
        }
    } catch (err) {
        console.error('Error handling member join:', err);
    }
});

// Save ALL roles when member LEAVES (for full restore on rejoin)
client.on('guildMemberRemove', (member) => {
    if (member.guild.id !== GUILD_ID || member.user.bot) return;
    const allRoles = member.roles.cache
        .filter(r => r.id !== member.guild.id) // exclude @everyone
        .map(r => r.id);
    if (allRoles.length > 0) {
        rolesDb[member.id] = allRoles;
        saveDb();
        console.log(`💾 Saved ${allRoles.length} roles for ${member.user.username} on leave`);
    }
});

// Update sticky roles on member update (role changes while in server)
client.on('guildMemberUpdate', (oldMember, newMember) => {
    if (newMember.guild.id === GUILD_ID && !newMember.user.bot) {
        rolesDb[newMember.id] = newMember.roles.cache
            .filter(r => r.id !== newMember.guild.id)
            .map(r => r.id);
        saveDb();
    }
});

// Reaction Add Handler (Instant Role Assignment)
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) {
        try { await reaction.fetch(); } catch (e) { return; }
    }

    const msgId = reaction.message.id;
    const emojiTag = reaction.emoji.id ? `${reaction.emoji.name}:${reaction.emoji.id}` : reaction.emoji.name;
    const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    // Pick Games (multi-select allowed)
    if (msgId === PICK_GAMES_MSG_ID && gameRoleMap[emojiTag]) {
        await member.roles.add(gameRoleMap[emojiTag]).catch(() => {});
        console.log(`🎯 Assigned game role ${gameRoleMap[emojiTag]} to ${user.username}`);
    }

    // Valo Ranks (single-select: one rank only)
    if (msgId === VALO_MSG_ID && valoRankMap[emojiTag]) {
        const freshMember = await reaction.message.guild.members.fetch({ user: user.id, force: true }).catch(() => member);
        const currentValoRank = Object.values(valoRankMap).find(roleId => freshMember.roles.cache.has(roleId));
        if (currentValoRank) {
            await reaction.users.remove(user.id).catch(() => {});
            await user.send(
                `⚠️ **عندك رانك Valorant بالفعل! | You already have a Valorant rank!**\n` +
                `شيل الرانك الحالي الأول وبعدين اختار الجديد 🎮\n` +
                `Remove your current rank first, then pick a new one! 🎮`
            ).catch(() => {});
            console.log(`🚫 Blocked ${user.username} from picking second Valo rank`);
        } else {
            await freshMember.roles.add(valoRankMap[emojiTag]).catch(() => {});
            console.log(`🎯 Assigned Valo rank role to ${user.username}`);
        }
    }

    // League Ranks (single-select: one rank only)
    if (msgId === LEAGUE_MSG_ID && leagueRankMap[emojiTag]) {
        const freshMember = await reaction.message.guild.members.fetch({ user: user.id, force: true }).catch(() => member);
        const currentLeagueRank = Object.values(leagueRankMap).find(roleId => freshMember.roles.cache.has(roleId));
        if (currentLeagueRank) {
            await reaction.users.remove(user.id).catch(() => {});
            await user.send(
                `⚠️ **عندك رانك League of Legends بالفعل! | You already have a League rank!**\n` +
                `شيل الرانك الحالي الأول وبعدين اختار الجديد ⚔️\n` +
                `Remove your current rank first, then pick a new one! ⚔️`
            ).catch(() => {});
            console.log(`🚫 Blocked ${user.username} from picking second League rank`);
        } else {
            await freshMember.roles.add(leagueRankMap[emojiTag]).catch(() => {});
            console.log(`⚔️ Assigned League rank role to ${user.username}`);
        }
    }
});


// Reaction REMOVE Handler (Remove Role when reaction removed)
client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) {
        try { await reaction.fetch(); } catch (e) { return; }
    }

    const msgId = reaction.message.id;
    const emojiTag = reaction.emoji.id ? `${reaction.emoji.name}:${reaction.emoji.id}` : reaction.emoji.name;
    const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    // Pick Games
    if (msgId === PICK_GAMES_MSG_ID && gameRoleMap[emojiTag]) {
        await member.roles.remove(gameRoleMap[emojiTag]).catch(() => {});
        console.log(`❌ Removed game role ${gameRoleMap[emojiTag]} from ${user.username}`);
    }

    // Valo Ranks
    if (msgId === VALO_MSG_ID && valoRankMap[emojiTag]) {
        await member.roles.remove(valoRankMap[emojiTag]).catch(() => {});
        console.log(`❌ Removed Valo rank role from ${user.username}`);
    }

    // League Ranks
    if (msgId === LEAGUE_MSG_ID && leagueRankMap[emojiTag]) {
        await member.roles.remove(leagueRankMap[emojiTag]).catch(() => {});
        console.log(`❌ Removed League rank role from ${user.username}`);
    }
});

// Twitch Live & Clips Engine

async function checkTwitch(manualChannel = null) {
    try {
            const query = {
                query: `
                query {
                  user(login: "${STREAMER}") {
                    id
                    login
                    displayName
                    stream {
                      id
                      title
                      game { name }
                      viewersCount
                      previewImageURL(width: 1280, height: 720)
                    }
                    clips(first: 20, criteria: { filter: LAST_WEEK }) {
                      edges {
                        node {
                          id
                          slug
                          title
                          url
                          durationSeconds
                          thumbnailURL
                          curator { displayName }
                        }
                      }
                    }
                  }
                }`
            };

            const res = await axios.post('https://gql.twitch.tv/gql', query, {
                headers: {
                    'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
                    'Content-Type': 'application/json'
                }
            });

            const user = res.data?.data?.user;
            if (!user) return;

            const guild = client.guilds.cache.get(GUILD_ID);
            if (!guild) return;

            // Live Alert
            if (user.stream && !isLive) {
                isLive = true;
                saveIsLive(true);
                const annChannel = guild.channels.cache.get(ANNOUNCEMENTS_CHANNEL_ID);
                if (annChannel) {
                    const liveEmbed = new EmbedBuilder()
                        .setTitle(user.stream.title || 'Live Stream')
                        .setURL(`https://www.twitch.tv/${STREAMER}`)
                        .setColor(0x0099FF)
                        .addFields(
                            { name: '🎮 Playing', value: user.stream.game?.name || 'Just Chatting', inline: true },
                            { name: '👀 Viewers', value: `${user.stream.viewersCount}`, inline: true }
                        )
                        .setImage(`${user.stream.previewImageURL}?r=${Date.now()}`)
                        .setFooter({ text: 'The Village Live Alerts • Twitch Stream' })
                        .setTimestamp();

                    await annChannel.send({
                        content: `@everyone 🚀 Going live now! Grab your snacks and hop in:\nhttps://www.twitch.tv/${STREAMER}`,
                        embeds: [liveEmbed]
                    });
                }
            } else if (!user.stream && isLive) {
                isLive = false;
                saveIsLive(false);
            }

            // Clips
            let newClipsCount = 0;
            if (user.clips?.edges) {
                for (const edge of user.clips.edges) {
                    const clip = edge.node;
                    if (!postedClips.has(clip.slug)) {
                        postedClips.add(clip.slug);
                        saveClipsDb();
                        newClipsCount++;
                        const clipsChannel = guild.channels.cache.get(CLIPS_CHANNEL_ID);
                        if (clipsChannel) {
                            const clipEmbed = new EmbedBuilder()
                                .setTitle(`🎥 ${clip.title}`)
                                .setURL(clip.url)
                                .setColor(0x0099FF)
                                .addFields(
                                    { name: '👤 Clipped By', value: clip.curator?.displayName || 'Viewer', inline: true },
                                    { name: '⏱️ Duration', value: `${clip.durationSeconds}s`, inline: true }
                                )
                                .setImage(clip.thumbnailURL)
                                .setFooter({ text: 'The Village Clips • Mahercom' })
                                .setTimestamp();

                            await clipsChannel.send({
                                content: `🎬 **New Clip from Mahercom's Stream!**\n${clip.url}`,
                                embeds: [clipEmbed]
                            });
                        }
                    }
                }
            }

            if (manualChannel) {
                if (newClipsCount > 0) await manualChannel.send(`✅ تم العثور على **${newClipsCount}** كليبات جديدة وتم إرسالهم في قناة الكليبات! 🎬`);
                else await manualChannel.send(`ℹ️ بحثت، بس مفيش كليبات جديدة نزلت في آخر فترة. 🤷‍♂️`);
            }
        } catch (e) {
            if (manualChannel) await manualChannel.send(`❌ حصل مشكلة في الاتصال بـ Twitch: ${e.message}`);
        }
}

function startTwitchMonitor() {
    setInterval(() => checkTwitch(), 300000); // every 5 minutes
}

// Manual Check Command
client.on('messageCreate', async (message) => {
    if (message.author.bot || message.guild?.id !== GUILD_ID) return;
    if (message.content.trim() === '!clips') {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply("❌ الأمر ده للإدارة بس يا صاحبي! 👀");
        }
        await message.reply("🔄 ثواني بجيب آخر الكليبات من Twitch...");
        await checkTwitch(message.channel);
    }
});

// Start
client.login(TOKEN);
