const { Client, Intents } = require('discord.js');
const Discord = require('discord.js')
const AXIOS = require('axios');
const CLIENT = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MEMBERS] });
const CONFIG = require('./config.json');
const HTTP_CONFIG = {
    headers: {
        "Content-type": "application/json",
    }
}

CLIENT.on('ready', () => {
    console.log(`Logged in as ${CLIENT.user.tag}!`)

    CLIENT.api.applications(CLIENT.user.id).commands.post({
        data: {
            name: "leave",
            description: "指定期間中に活動していないユーザーを取得できます",
            content: "Leave",
            options: [{
                name: "day",
                description: "期間(n日)",
                type: 3,
                required: true,
            }]
        }
    })
})

CLIENT.ws.on('INTERACTION_CREATE', async interaction => {
    const command = interaction.data.name.toLowerCase()

    if (command === 'leave') {
        const CHANNEL = await CLIENT.channels.fetch(interaction.channel_id)
        const DAY = interaction.data.options[0].value
        const { ok, reason } = await leaveCommand(CHANNEL, DAY)

        CLIENT.api.interactions(interaction.id, interaction.token).callback.post({
            data: ok ? {
                type: 4,
                data: {
                    content: `${DAY}日間活動のないメンバーを取得しました。`
                }
            } : {
                type: 4,
                data: {
                    content: '❌ ' + reason
                }
            }
        })
    }
})

CLIENT.on('messageCreate', async(msg) => {
    if (!isTargetChannel(msg.channelId)) {
        return;
    }
    // 投稿をinsert
    insertPost(msg);
})

CLIENT.on('messageUpdate', async(oldMsg, newMsg) => {
    if (!isTargetChannel(msg.channelId)) {
        return;
    }
    const postData = createPostData('edit', newMsg);

    await AXIOS.post(CONFIG.apiPostUrl, postData, HTTP_CONFIG);
})

CLIENT.on('messageDelete', async(msg) => {
    if (!isTargetChannel(msg.channelId)) {
        return;
    }
    const postData = createPostData('delete', msg);

    await AXIOS.post(CONFIG.apiPostUrl, postData, HTTP_CONFIG);
})

CLIENT.login(CONFIG.token);

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
/**
 * 投稿データ生成
 */
function createPostData(execType, msg) {
    return postData = {
        'token': CONFIG.apiToken,
        'execType': execType,
        'postId': msg.id,
        'channel': msg.channelId,
        'userId': msg.author.id,
        'userName': msg.author.tag,
        'content': msg.content
    }
}

/**
 * 投稿処理
 * */
async function insertPost(msg) {
    const postData = createPostData('insert', msg);

    await AXIOS.post(CONFIG.apiPostUrl, postData, HTTP_CONFIG);
}

/**
 * leaveコマンド処理
 * */
async function leaveCommand(channel, day) {

    if (!channel.guild.me.permissionsIn(channel).has(Discord.Permissions.FLAGS.MANAGE_WEBHOOKS)) {
        return { ok: false, reason: "このチャンネルでは /leave は使用できません (Webhook権限の設定)" }
    }


    // 引数エラー
    if (isNaN(day)) {
        channel.send('```\nERROR: ```');
        return { ok: false, reason: '引数に整数を入力してください!\nEXAMPLE: /leave 14 - 14日間投稿のないユーザーを取得します\n' }
    }

    const hooks = await channel.fetchWebhooks()
    const LeaveHooks = hooks.filter(e => e.name === 'Leave')
    if (LeaveHooks.size <= 0) {
        return { ok: false, reason: "このチャンネルでは /leave は使用できません (Webhookの設定)" }
    }

    // コマンド処理
    let apiResults = await AXIOS.get(CONFIG.apiGetUrl, {
        params: {
            'token': CONFIG.apiToken,
            'type': 'bot',
            'day': day
        }
    })

    console.log(apiResults.data)

    let resultMessage = ``
    resultMessage += `非アクティブ人数: ${apiResults.data.countOfLeaveUser}人\n`
    resultMessage += `アクティブ割合: ${apiResults.data.countOfAllUser - apiResults.data.countOfLeaveUser} / ${apiResults.data.countOfAllUser}\n`
    resultMessage += '詳細:\n'
    resultMessage += `${CONFIG.apiGetUrl}?type=page&day=${day}`
    channel.send(resultMessage)

    return { ok: true }
}

function isTargetChannel(targetId) {
    let channels = CONFIG.targetChannels;

    for (c of channels) {
        if (targetId == c) {
            return true;
        }
    }

    return false;
}