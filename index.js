const express = require("express");
const dotenv = require("dotenv");
const HenrikDevValorantAPI = require("unofficial-valorant-api");
const _ = require("lodash");
const { Client, IntentsBitField, GatewayIntentBits } = require("discord.js");

const VAPI = new HenrikDevValorantAPI();
dotenv.config();
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/", (req, res) => {
  return res.json({ version: 1 });
});

const port = process.env.NODE_PORT || 3000;
const token = process.env.DISCORD_TOKEN || "";

app.listen(port, async () => {
  console.log(`Express server listening on SSL port ${port}`);
});

const getDetails = async (userName, tag) => {
  try {
    const user = (await VAPI.getAccount({ name: userName, tag: tag }))?.data;
    const mmr_data = await VAPI.getMatches({
      version: "v3",
      region: "ap",
      name: userName,
      tag: tag,
    });

    if (mmr_data.error) {
      throw mmr_data.error;
    }

    const lastPlayedMatch = mmr_data.data[0];

    const allPlayers = lastPlayedMatch.players.all_players;

    const currentPlayerTeam = _.lowerCase(
      _.find(allPlayers, ["puuid", user.puuid])?.team
    );

    const details = {
      metadata: lastPlayedMatch.metadata,
      players: allPlayers,
      status: lastPlayedMatch.teams[currentPlayerTeam],
      selectedPlayer: user,
    };

    return details;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const detailsSummary = (details, userId) => {
  const player = _.find(details.players, ["puuid", userId]);

  const message = `Last played on: ${
    details.metadata.game_start_patched
  }\nMap: ${details.metadata.map}\nMode: ${details.metadata.mode}\nStatus: ${
    details.status.has_won ? "won" : "lost"
  }\nAgent: ${player.character}\nKDA: ${player.stats.kills}/${
    player.stats.deaths
  }/${player.stats.assists}`;

  return {
    message,
    files: player.assets.card.small,
  };
};

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("messageCreate", async (msg) => {
  if (msg.content.includes("username:")) {
    try {
      const messageChannel = msg.content.replace("username:", "");
      const userDetails = messageChannel.split("#");
      const details = await getDetails(userDetails[0], userDetails[1]);
      const response = detailsSummary(details, details.selectedPlayer.puuid);
      msg.reply({ content: response.message, files: [response.files] });
    } catch (error) {
      msg.reply("Api limit reached. please try again");
    }
  }
});

client.login(token);
